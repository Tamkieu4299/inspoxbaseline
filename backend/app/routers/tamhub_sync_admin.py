"""TamHub catalog sync status + settings (Inspo admin + integration token)."""

from __future__ import annotations

import threading

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from ..tamhub_sync import run_sync_all
from ..tamhub_sync_config import clear_stale_running, get_status, update_config, verify_integration_token

router = APIRouter(tags=["tamhub-sync"])


class TamHubSyncConfigIn(BaseModel):
    enabled: bool | None = None
    interval_seconds: int | None = Field(default=None, ge=60, le=86400)
    sync_inventory_to_inspo: bool | None = None


def _integration_auth(
    x_inspo_sync_admin_token: str | None = Header(default=None, alias="X-Inspo-Sync-Admin-Token"),
) -> None:
    if verify_integration_token(x_inspo_sync_admin_token):
        return
    raise HTTPException(status_code=401, detail="Invalid integration token")


@router.get("/tamhub-sync")
def get_tamhub_sync_status():
    return get_status()


@router.put("/tamhub-sync")
def put_tamhub_sync_config(body: TamHubSyncConfigIn):
    update_config(
        enabled=body.enabled,
        interval_seconds=body.interval_seconds,
        sync_inventory_to_inspo=body.sync_inventory_to_inspo,
    )
    return get_status()


@router.post("/tamhub-sync/reset-stale")
def post_tamhub_sync_reset_stale():
    cleared = clear_stale_running(max_age_seconds=0)
    return {"ok": True, "cleared": cleared, "status": get_status()}


@router.post("/tamhub-sync/run")
def post_tamhub_sync_run():
    clear_stale_running()
    status = get_status()
    if status.get("running"):
        raise HTTPException(status_code=409, detail="Sync already running")
    threading.Thread(target=run_sync_all, kwargs={"reason": "manual"}, daemon=True).start()
    return {"ok": True, "message": "Sync started"}


integration_router = APIRouter(prefix="/integrations", tags=["integrations"])


@integration_router.get("/tamhub-sync")
def integration_get_status(_: None = Depends(_integration_auth)):
    return get_status()


@integration_router.put("/tamhub-sync")
def integration_put_config(body: TamHubSyncConfigIn, _: None = Depends(_integration_auth)):
    update_config(
        enabled=body.enabled,
        interval_seconds=body.interval_seconds,
        sync_inventory_to_inspo=body.sync_inventory_to_inspo,
    )
    return get_status()


@integration_router.post("/tamhub-sync/run")
def integration_run_sync(_: None = Depends(_integration_auth)):
    status = get_status()
    if status.get("running"):
        raise HTTPException(status_code=409, detail="Sync already running")
    threading.Thread(target=run_sync_all, kwargs={"reason": "manual"}, daemon=True).start()
    return {"ok": True, "message": "Sync started"}
