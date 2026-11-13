"""Persisted TamHub sync settings + status (overrides env for interval/enabled)."""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_LOCK = threading.Lock()
_STATE_PATH = Path(os.getenv("TAMHUB_SYNC_STATE_PATH", "/data/tamhub_sync_state.json"))

_DEFAULT: dict[str, Any] = {
    "enabled": None,
    "interval_seconds": None,
    "sync_inventory_to_inspo": None,
    "last_run_at": None,
    "last_finished_at": None,
    "last_status": "idle",
    "last_error": None,
    "last_duration_ms": None,
    "last_reason": None,
    "running": False,
    "tenants": {},
    "recent_errors": [],
}


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.lower() in ("1", "true", "yes")


def _load_raw() -> dict[str, Any]:
    if not _STATE_PATH.is_file():
        return {}
    try:
        return json.loads(_STATE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_raw(data: dict[str, Any]) -> None:
    _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(_STATE_PATH)


def get_effective_config() -> dict[str, Any]:
    """Merged view for worker + APIs."""
    stored = _load_raw()
    enabled = stored.get("enabled")
    if enabled is None:
        enabled = _env_bool("TAMHUB_SYNC_ENABLED", default=False)
    interval = stored.get("interval_seconds")
    if interval is None:
        interval = int(os.getenv("TAMHUB_SYNC_INTERVAL_SECONDS", "900"))
    interval = max(60, int(interval))
    inv = stored.get("sync_inventory_to_inspo")
    if inv is None:
        inv = _env_bool("TAMHUB_SYNC_INVENTORY_TO_INSPO", default=True)
    return {
        "enabled": bool(enabled),
        "interval_seconds": interval,
        "sync_inventory_to_inspo": bool(inv),
        "env_interval_seconds": int(os.getenv("TAMHUB_SYNC_INTERVAL_SECONDS", "900")),
        "state_path": str(_STATE_PATH),
    }


def _parse_run_at(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        return datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
    except (ValueError, TypeError):
        return None


def clear_orphaned_running_on_startup() -> bool:
    """After process restart, any `running=true` in disk state is stale."""
    with _LOCK:
        data = {**_DEFAULT, **_load_raw()}
        if not data.get("running"):
            return False
        data["running"] = False
        if not data.get("last_finished_at"):
            data["last_status"] = "error"
            data["last_error"] = (
                "Previous sync was interrupted (backend restarted). "
                "Use Run sync now to run again."
            )
            data["last_finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        _save_raw(data)
        return True


def clear_stale_running(*, max_age_seconds: int | None = None) -> bool:
    """If running flag was left set (e.g. backend restart mid-sync), clear it."""
    limit = max_age_seconds if max_age_seconds is not None else int(
        os.getenv("TAMHUB_SYNC_STALE_SECONDS", "600")
    )
    with _LOCK:
        data = {**_DEFAULT, **_load_raw()}
        if not data.get("running"):
            return False
        if limit == 0:
            stale = True
        else:
            started = _parse_run_at(data.get("last_run_at"))
            stale = started is None or (time.time() - started) > limit
        if stale:
            data["running"] = False
            if not data.get("last_finished_at"):
                data["last_status"] = "error"
                data["last_error"] = (
                    "Previous sync did not finish (backend restarted or timed out). "
                    "Status was reset automatically — use Run sync now."
                )
                data["last_finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            _save_raw(data)
            return True
    return False


def get_status() -> dict[str, Any]:
    clear_stale_running()
    with _LOCK:
        stored = {**_DEFAULT, **_load_raw()}
        cfg = get_effective_config()
        return {
            **cfg,
            "last_run_at": stored.get("last_run_at"),
            "last_finished_at": stored.get("last_finished_at"),
            "last_status": stored.get("last_status") or "idle",
            "last_error": stored.get("last_error"),
            "last_duration_ms": stored.get("last_duration_ms"),
            "last_reason": stored.get("last_reason"),
            "running": bool(stored.get("running")),
            "tenants": stored.get("tenants") or {},
            "recent_errors": (stored.get("recent_errors") or [])[-20:],
        }


def update_config(
    *,
    enabled: bool | None = None,
    interval_seconds: int | None = None,
    sync_inventory_to_inspo: bool | None = None,
) -> dict[str, Any]:
    with _LOCK:
        data = {**_DEFAULT, **_load_raw()}
        if enabled is not None:
            data["enabled"] = bool(enabled)
        if interval_seconds is not None:
            data["interval_seconds"] = max(60, int(interval_seconds))
        if sync_inventory_to_inspo is not None:
            data["sync_inventory_to_inspo"] = bool(sync_inventory_to_inspo)
        _save_raw(data)
    return get_status()


def record_sync_start(reason: str) -> None:
    with _LOCK:
        data = {**_DEFAULT, **_load_raw()}
        data["running"] = True
        data["last_status"] = "running"
        data["last_reason"] = reason
        data["last_run_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        data["last_error"] = None
        _save_raw(data)


def record_sync_success(*, duration_ms: int, reason: str, tenants: dict[str, Any]) -> None:
    with _LOCK:
        data = {**_DEFAULT, **_load_raw()}
        data["running"] = False
        data["last_status"] = "ok"
        data["last_reason"] = reason
        data["last_finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        data["last_duration_ms"] = duration_ms
        data["last_error"] = None
        data["tenants"] = tenants
        _save_raw(data)


def record_sync_error(*, message: str, reason: str, duration_ms: int | None = None) -> None:
    with _LOCK:
        data = {**_DEFAULT, **_load_raw()}
        data["running"] = False
        data["last_status"] = "error"
        data["last_reason"] = reason
        data["last_finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        data["last_error"] = message[:2000]
        if duration_ms is not None:
            data["last_duration_ms"] = duration_ms
        errs = list(data.get("recent_errors") or [])
        errs.append(
            {
                "at": data["last_finished_at"],
                "reason": reason,
                "message": message[:500],
            }
        )
        data["recent_errors"] = errs[-30:]
        _save_raw(data)


def verify_integration_token(header: str | None) -> bool:
    secret = (os.getenv("INSPO_CATALOG_SYNC_SECRET") or os.getenv("ORDER_WEBHOOK_SECRET") or "").strip()
    if not secret:
        return False
    return (header or "").strip() == secret
