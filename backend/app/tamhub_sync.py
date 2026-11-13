"""Automatic Inspo → TamHub catalog sync + TamHub inventory → storefront availability.

Runs in a background thread (no manual scripts). Configure via env on inspo-backend.
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .models import Product, Tenant
from .product_sizes import merge_size_availability, normalize_product_sizes
from .tamhub_export import export_tenant
from .tamhub_sync_config import (
    clear_orphaned_running_on_startup,
    clear_stale_running,
    get_effective_config,
    record_sync_error,
    record_sync_start,
    record_sync_success,
)

logger = logging.getLogger("tamhub_sync")

_SYNC_LOCK = threading.Lock()
_LAST_RUN: dict[str, float] = {}

INSPO_SKU_PREFIX = "inspo:"


def _env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, "true" if default else "false").lower() in ("1", "true", "yes")


def _tenant_map() -> dict[str, str]:
    raw = (os.getenv("INSPO_TENANT_MAP") or "").strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("INSPO_TENANT_MAP is not valid JSON")
        return {}


def _configured_slugs() -> list[str]:
    slugs = (os.getenv("TAMHUB_SYNC_TENANTS") or os.getenv("INSPO_TENANT_SLUGS") or "shop1,baseline").strip()
    return [s.strip() for s in slugs.split(",") if s.strip()]


def _variant_sku(tenant_slug: str, product_slug: str, color: str | None, size: str | None) -> str:
    base = f"{INSPO_SKU_PREFIX}{tenant_slug}:{product_slug}"
    c = (color or "").strip()
    s = (size or "").strip()
    if not c and not s:
        return base
    return f"{base}:{c or '-'}:{s or '-'}"


class TamHubClient:
    def __init__(self) -> None:
        base = (os.getenv("TAMHUB_API_URL") or "http://tamhub-api-gateway:8080/api/v1").rstrip("/")
        self.api_base = base
        self.customer_base = (os.getenv("TAMHUB_CUSTOMER_API_URL") or base).rstrip("/")
        self.email = os.getenv("TAMHUB_ADMIN_EMAIL") or "admin@tamhub.com"
        self.password = os.getenv("TAMHUB_ADMIN_PASSWORD") or "Admin@123"
        self.sync_secret = (os.getenv("INSPO_CATALOG_SYNC_SECRET") or os.getenv("ORDER_WEBHOOK_SECRET") or "").strip()
        self._token: str | None = None
        self._client = httpx.Client(timeout=180.0)

    def close(self) -> None:
        self._client.close()

    def _headers(self, tenant_id: str | None = None) -> dict[str, str]:
        h: dict[str, str] = {}
        if self._token:
            h["Authorization"] = f"Bearer {self._token}"
        if tenant_id:
            h["x-tenant-id"] = tenant_id
        if self.sync_secret:
            h["X-Inspo-Catalog-Sync"] = self.sync_secret
        return h

    def login(self) -> None:
        res = self._client.post(
            f"{self.api_base}/auth/login",
            json={"email": self.email, "password": self.password},
        )
        res.raise_for_status()
        token = res.json().get("data", {}).get("accessToken")
        if not token:
            raise RuntimeError("TamHub login failed")
        self._token = token

    def get_json(self, url: str, *, tenant_id: str | None = None, params: dict | None = None) -> Any:
        res = self._client.get(url, headers=self._headers(tenant_id), params=params)
        res.raise_for_status()
        return res.json()

    def post_json(self, url: str, body: dict, *, tenant_id: str | None = None) -> Any:
        res = self._client.post(url, json=body, headers=self._headers(tenant_id))
        res.raise_for_status()
        return res.json()

    def put_json(self, url: str, body: dict, *, tenant_id: str | None = None) -> Any:
        res = self._client.put(url, json=body, headers=self._headers(tenant_id))
        res.raise_for_status()
        return res.json()

    def paginated_items(self, path: str, tenant_id: str) -> list[dict]:
        items: list[dict] = []
        page = 1
        while page <= 50:
            data = self.get_json(
                f"{self.customer_base}{path}",
                tenant_id=tenant_id,
                params={"page": page, "limit": 100},
            )
            chunk = data.get("data", {})
            if isinstance(chunk, list):
                rows = chunk
            else:
                rows = chunk.get("data") or chunk.get("items") or []
            if not rows:
                break
            items.extend(rows)
            if len(rows) < 100:
                break
            page += 1
        return items


def _parse_inspo_variant_sku(sku: str) -> tuple[str, str, str | None, str | None] | None:
    if not sku.startswith(INSPO_SKU_PREFIX):
        return None
    rest = sku[len(INSPO_SKU_PREFIX) :]
    parts = rest.split(":")
    if len(parts) < 2:
        return None
    tenant_slug, product_slug = parts[0], parts[1]
    color = size = None
    if len(parts) >= 4:
        color = parts[2] if parts[2] != "-" else None
        size = parts[3] if parts[3] != "-" else None
    elif len(parts) == 3:
        size = parts[2] if parts[2] != "-" else None
    return tenant_slug, product_slug, color, size


def sync_tenant_catalog(client: TamHubClient, inspo_slug: str, tamhub_tenant_id: str) -> None:
    payload = export_tenant(inspo_slug, categories=True, products=True)
    slug_to_cat: dict[str, str] = {}
    for c in client.paginated_items("/product-categories", tamhub_tenant_id):
        meta = c.get("metadata") or {}
        inspo_cat = meta.get("inspoSlug")
        if inspo_cat:
            slug_to_cat[str(inspo_cat)] = c["id"]

    for c in payload.get("categories") or []:
        if slug_to_cat.get(c["slug"]):
            continue
        slug = f"inspo-{inspo_slug}-{c['slug']}"
        try:
            created = client.post_json(
                f"{client.customer_base}/product-categories",
                {
                    "tenantId": tamhub_tenant_id,
                    "name": c.get("name_vi") or c["name"],
                    "slug": slug,
                    "isActive": True,
                    "metadata": {"inspoCategoryId": c["id"], "inspoSlug": c["slug"]},
                },
                tenant_id=tamhub_tenant_id,
            )
            cid = created.get("data", {}).get("id")
            if cid:
                slug_to_cat[c["slug"]] = cid
        except httpx.HTTPError as err:
            logger.warning("TamHub category %s: %s", c["slug"], err)

    for p in payload.get("products") or []:
        sku = f"{INSPO_SKU_PREFIX}{inspo_slug}:{p['slug']}"
        primary = (p.get("category_slugs") or [None])[0]
        category_id = slug_to_cat.get(primary) if primary else None
        body = {
            "tenantId": tamhub_tenant_id,
            "name": p["name"],
            "slug": p["slug"],
            "sku": sku,
            "description": p.get("description") or None,
            "shortDescription": p.get("tagline") or None,
            "basePrice": float(p.get("price") or 0),
            "status": "draft" if not p.get("is_active") else "active",
            "categoryId": category_id,
            "images": p.get("images") or [],
            "metadata": {"inspoProductId": p["id"], "inspoSlug": p["slug"], "source": "inspo"},
        }
        product_id: str | None = None
        try:
            created = client.post_json(
                f"{client.customer_base}/products",
                body,
                tenant_id=tamhub_tenant_id,
            )
            product_id = created.get("data", {}).get("id")
        except httpx.HTTPError:
            listing = client.get_json(
                f"{client.customer_base}/products",
                tenant_id=tamhub_tenant_id,
                params={"search": sku, "limit": 25},
            )
            rows = listing.get("data", {}).get("data") or listing.get("data", {}).get("items") or []
            hit = next((x for x in rows if x.get("sku") == sku), None)
            product_id = hit.get("id") if hit else None
            if product_id:
                client.put_json(
                    f"{client.customer_base}/products/{product_id}",
                    {
                        "name": body["name"],
                        "slug": body["slug"],
                        "description": body["description"],
                        "shortDescription": body["shortDescription"],
                        "basePrice": body["basePrice"],
                        "status": body["status"],
                        "categoryId": category_id,
                        "images": body["images"],
                        "metadata": body["metadata"],
                    },
                    tenant_id=tamhub_tenant_id,
                )

        if not product_id:
            logger.warning("TamHub product missing for %s", p["slug"])
            continue

        colors: list[str | None] = p.get("colorways") or [None]
        if not colors:
            colors = [None]
        size_rows = normalize_product_sizes(p.get("sizes"))
        sizes: list[str | None] = [r["name"] for r in size_rows] if size_rows else [None]

        existing_variants = client.get_json(
            f"{client.customer_base}/products/{product_id}/variants",
            tenant_id=tamhub_tenant_id,
        )
        ev = existing_variants.get("data") or []
        by_sku = {v.get("sku"): v for v in ev if v.get("sku")}

        for color in colors:
            for size in sizes:
                v_sku = _variant_sku(inspo_slug, p["slug"], color, size)
                v_name = " / ".join(x for x in [p["name"], color, size] if x)
                v_body = {
                    "tenantId": tamhub_tenant_id,
                    "sku": v_sku,
                    "name": v_name,
                    "color": color,
                    "size": size,
                    "price": float(p.get("price") or 0),
                    "isActive": True,
                }
                if v_sku in by_sku:
                    vid = by_sku[v_sku]["id"]
                    client.put_json(
                        f"{client.customer_base}/products/{product_id}/variants/{vid}",
                        v_body,
                        tenant_id=tamhub_tenant_id,
                    )
                else:
                    try:
                        client.post_json(
                            f"{client.customer_base}/products/{product_id}/variants",
                            v_body,
                            tenant_id=tamhub_tenant_id,
                        )
                    except httpx.HTTPError as err:
                        logger.debug("variant %s: %s", v_sku, err)

    logger.info("TamHub catalog synced for inspo tenant %s", inspo_slug)


def pull_inventory_to_inspo(inspo_slug: str, tamhub_tenant_id: str, client: TamHubClient) -> None:
    """TamHub stock → Inspo grip/size availability (Inspo PDP); merchandising still from Inspo."""
    inv_rows = client.paginated_items("/inventory", tamhub_tenant_id)
    stock_by_sku: dict[str, bool] = {}
    for row in inv_rows:
        variant = row.get("variant") or {}
        sku = variant.get("sku") or row.get("sku")
        if not sku:
            continue
        qty = int(row.get("quantity") or 0)
        reserved = int(row.get("reserved") or 0)
        stock_by_sku[str(sku)] = (qty - reserved) > 0

    if not stock_by_sku:
        return

    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == inspo_slug))
        if not tenant:
            return
        products = db.scalars(
            select(Product).where(Product.tenant_id == tenant.id).options(selectinload(Product.images))
        ).all()
        by_slug = {p.slug: p for p in products}
        changed = 0
        for sku, in_stock in stock_by_sku.items():
            parsed = _parse_inspo_variant_sku(sku)
            if not parsed or parsed[0] != inspo_slug:
                continue
            _, product_slug, _color, size = parsed
            product = by_slug.get(product_slug)
            if not product or not size:
                continue
            sizes = normalize_product_sizes(product.sizes)
            if not sizes:
                continue
            updated = merge_size_availability(sizes, size, in_stock)
            if updated != sizes:
                product.sizes = updated
                changed += 1
        if changed:
            db.commit()
            logger.info("Inspo availability updated from TamHub for %s (%s products)", inspo_slug, changed)
    finally:
        db.close()


def run_sync_all(*, reason: str = "scheduled") -> None:
    cfg = get_effective_config()
    if not cfg["enabled"]:
        return
    tenant_map = _tenant_map()
    if not tenant_map:
        logger.debug("TamHub sync skipped: INSPO_TENANT_MAP not set (%s)", reason)
        return

    if not _SYNC_LOCK.acquire(blocking=False):
        logger.debug("TamHub sync already running")
        return
    started = time.time()
    record_sync_start(reason)
    tenant_notes: dict[str, Any] = {}
    try:
        client = TamHubClient()
        try:
            client.login()
        except Exception as err:
            logger.warning("TamHub sync login failed: %s", err)
            record_sync_error(message=str(err), reason=reason, duration_ms=int((time.time() - started) * 1000))
            return

        try:
            for inspo_slug in _configured_slugs():
                tamhub_id = tenant_map.get(inspo_slug)
                if not tamhub_id:
                    continue
                try:
                    sync_tenant_catalog(client, inspo_slug, tamhub_id)
                    if cfg["sync_inventory_to_inspo"]:
                        pull_inventory_to_inspo(inspo_slug, tamhub_id, client)
                    tenant_notes[inspo_slug] = {"status": "ok", "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
                    _LAST_RUN[inspo_slug] = time.time()
                except Exception as err:
                    tenant_notes[inspo_slug] = {"status": "error", "message": str(err)[:300]}
                    raise
        finally:
            client.close()
        record_sync_success(
            duration_ms=int((time.time() - started) * 1000),
            reason=reason,
            tenants=tenant_notes,
        )
    except Exception as err:
        logger.exception("TamHub sync failed: %s", err)
        record_sync_error(message=str(err), reason=reason, duration_ms=int((time.time() - started) * 1000))
    finally:
        _SYNC_LOCK.release()


def schedule_tenant_sync(inspo_slug: str) -> None:
    """Queue a soon catalog sync after admin edits (debounced in worker)."""
    _LAST_RUN[inspo_slug] = 0.0


def _worker_loop() -> None:
    time.sleep(15)
    while True:
        cfg = get_effective_config()
        interval = cfg["interval_seconds"]
        try:
            if cfg["enabled"]:
                run_sync_all(reason="interval")
                # Debounced admin saves: any slug touched in last interval
                now = time.time()
                for slug in list(_LAST_RUN.keys()):
                    if _LAST_RUN[slug] != 0.0:  # 0.0 = debounced after admin save
                        continue
                    tenant_map = _tenant_map()
                    tid = tenant_map.get(slug)
                    if not tid:
                        continue
                    client = TamHubClient()
                    try:
                        client.login()
                        sync_tenant_catalog(client, slug, tid)
                        if cfg["sync_inventory_to_inspo"]:
                            pull_inventory_to_inspo(slug, tid, client)
                        _LAST_RUN[slug] = now
                    except Exception as err:
                        logger.warning("TamHub debounced sync %s: %s", slug, err)
                    finally:
                        client.close()
        except Exception as err:
            logger.exception("TamHub sync worker error: %s", err)
        time.sleep(interval)


def start_background_sync() -> None:
    if clear_orphaned_running_on_startup():
        logger.warning("Cleared orphaned TamHub sync running flag after backend start")
    thread = threading.Thread(target=_worker_loop, name="tamhub-sync", daemon=True)
    thread.start()
    logger.info("TamHub background sync worker started (enabled=%s)", get_effective_config()["enabled"])
