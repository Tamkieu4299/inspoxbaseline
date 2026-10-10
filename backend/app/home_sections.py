"""Homepage section layout (order, visibility, per-section options)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

HOME_SECTION_IDS = ("hero", "trending", "latest_drops", "master")

DEFAULT_HOME_SECTIONS: list[dict[str, Any]] = [
    {"id": "hero", "enabled": True},
    {"id": "trending", "enabled": True, "limit": 2},
    {"id": "latest_drops", "enabled": True, "limit": 8, "show_view_all": True},
    {"id": "master", "enabled": True},
]

_DEFAULT_BY_ID = {s["id"]: deepcopy(s) for s in DEFAULT_HOME_SECTIONS}


def normalize_home_sections(raw: list | None) -> list[dict[str, Any]]:
    """Merge saved layout with defaults; unknown ids dropped; missing ids appended."""
    if not raw:
        return deepcopy(DEFAULT_HOME_SECTIONS)

    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        sid = item.get("id")
        if sid not in HOME_SECTION_IDS or sid in seen:
            continue
        seen.add(sid)
        base = deepcopy(_DEFAULT_BY_ID[sid])
        base["enabled"] = bool(item.get("enabled", base.get("enabled", True)))
        if sid == "trending":
            lim = item.get("limit", base.get("limit", 2))
            base["limit"] = max(1, min(4, int(lim) if lim is not None else 2))
        if sid == "latest_drops":
            lim = item.get("limit", base.get("limit", 8))
            base["limit"] = max(1, min(12, int(lim) if lim is not None else 8))
            if "show_view_all" in item:
                base["show_view_all"] = bool(item["show_view_all"])
        out.append(base)

    for sid in HOME_SECTION_IDS:
        if sid not in seen:
            out.append(deepcopy(_DEFAULT_BY_ID[sid]))
    return out


def latest_drops_fetch_limit(sections: list[dict[str, Any]]) -> int:
    for s in sections:
        if s.get("id") == "latest_drops" and s.get("enabled", True):
            return int(s.get("limit") or 8)
    return 8
