"""Inspo data bridge: catalog export + inventory patch (no sync scheduler here)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from ..inspo_inventory import apply_stock_by_sku
from ..tamhub_export import export_tenant
from ..tamhub_sync_config import verify_integration_token

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _integration_auth(x_inspo_sync_admin_token: str | None = Header(default=None, alias="X-Inspo-Sync-Admin-Token")) -> None:
    if verify_integration_token(x_inspo_sync_admin_token):
        return
    raise HTTPException(status_code=401, detail="Invalid integration token")


class InventoryPatchIn(BaseModel):
    tenant_slug: str
    stock_by_sku: dict[str, bool] = Field(default_factory=dict)


@router.get("/catalog-export/{tenant_slug}")
def get_catalog_export(tenant_slug: str, _: None = Depends(_integration_auth)):
    try:
        return export_tenant(tenant_slug, categories=True, products=True)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err


@router.post("/inventory-availability")
def post_inventory_availability(body: InventoryPatchIn, _: None = Depends(_integration_auth)):
    try:
        stats = apply_stock_by_sku(body.tenant_slug, body.stock_by_sku)
        return {"ok": True, "tenant_slug": body.tenant_slug, **stats}
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
