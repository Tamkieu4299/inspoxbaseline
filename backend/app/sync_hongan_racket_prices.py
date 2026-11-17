"""Sync Baseline racket prices from Hồng Ân Sports (regular price × 0.8 + 300,000₫).

    docker exec inspo-backend python -m app.sync_hongan_racket_prices --dry-run
    docker exec inspo-backend python -m app.sync_hongan_racket_prices --apply
"""

from __future__ import annotations

import argparse
import re
import time
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .map_racket_string_pairs import _is_racquet
from .models import Category, Product, Tenant

HONGAN_STORE_API = "https://hongansports.com/wp-json/wc/store/v1/products"
HONGAN_TENNIS_CATEGORY_ID = 184
HONGAN_LIST_URL = "https://hongansports.com/danh-muc-san-pham/quan-vot/vot-tennis/"
HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; inspo-baseline/1.0; +https://baseline.club)",
    "Accept": "application/json",
}

MARGIN_FACTOR = 0.8
MARGIN_ADD_VND = 300_000


def baseline_web_price_from_hongan_regular(regular_vnd: int | float) -> float:
    return float(int(regular_vnd) * MARGIN_FACTOR + MARGIN_ADD_VND)


def _hongan_regular_vnd(item: dict[str, Any]) -> int | None:
    prices = item.get("prices") or {}
    raw = prices.get("regular_price") or prices.get("price")
    if raw is None or raw == "":
        return None
    try:
        return int(float(str(raw).replace(",", "").replace(".", "")))
    except ValueError:
        return None


def _fetch_hongan_tennis_catalog(client: httpx.Client) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    page = 1
    while True:
        resp = client.get(
            HONGAN_STORE_API,
            params={"category": HONGAN_TENNIS_CATEGORY_ID, "per_page": 100, "page": page},
            timeout=60.0,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not isinstance(batch, list) or not batch:
            break
        out.extend(batch)
        if len(batch) < 100:
            break
        page += 1
        time.sleep(0.2)
    return out


def _normalize_slug_key(slug: str) -> str:
    slug = slug.lower().strip()
    slug = re.sub(r"-\d{3,5}$", "", slug)
    return slug


def _baseline_slug_keys(product: Product) -> set[str]:
    slug = (product.slug or "").lower()
    keys: set[str] = {_normalize_slug_key(slug)}
    for prefix in (
        "ha-",
        "fh-vot-tennis-",
        "ts-vot-tennis-",
        "fh-vot-",
        "ts-vot-",
        "fh-",
        "ts-",
    ):
        if slug.startswith(prefix):
            trimmed = slug[len(prefix) :]
            keys.add(_normalize_slug_key(trimmed))
    return keys


def _baseline_sku(product: Product) -> str | None:
    sub = (product.subtitle or "").strip()
    if "·" in sub:
        sku = sub.split("·")[-1].strip().upper()
        if sku and sku not in {"BABOLAT", "HEAD", "WILSON", "YONEX"}:
            return sku
    for spec in product.tech_specs or []:
        if not isinstance(spec, dict):
            continue
        lab = f"{spec.get('label') or ''} {spec.get('label_vi') or ''}".lower()
        if "sku" in lab or "mã" in lab:
            val = (spec.get("value") or spec.get("value_vi") or "").strip().upper()
            if val:
                return val
    return None


def _index_hongan(items: list[dict[str, Any]]) -> tuple[dict[str, dict], dict[str, dict]]:
    by_slug: dict[str, dict] = {}
    by_sku: dict[str, dict] = {}
    for row in items:
        slug = (row.get("slug") or "").lower()
        if slug:
            by_slug[slug] = row
            by_slug[_normalize_slug_key(slug)] = row
        sku = (row.get("sku") or "").strip().upper()
        if sku:
            by_sku[sku] = row
    return by_slug, by_sku


def _match_hongan(
    product: Product,
    by_slug: dict[str, dict],
    by_sku: dict[str, dict],
) -> dict[str, Any] | None:
    for key in _baseline_slug_keys(product):
        if key in by_slug:
            return by_slug[key]
        ha_key = key.removeprefix("ha-")
        if ha_key in by_slug:
            return by_slug[ha_key]
    sku = _baseline_sku(product)
    if sku and sku in by_sku:
        return by_sku[sku]
    return None


def sync(
    *,
    dry_run: bool = True,
    tenant_slug: str = "baseline",
    active_only: bool = True,
) -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")

        rackets_cat = db.scalar(
            select(Category).where(Category.tenant_id == tenant.id, Category.slug == "rackets")
        )
        rackets_id = rackets_cat.id if rackets_cat else None

        with httpx.Client(headers=HTTP_HEADERS, follow_redirects=True) as client:
            catalog = _fetch_hongan_tennis_catalog(client)
        print(f"Hồng Ân tennis catalog: {len(catalog)} product(s) ({HONGAN_LIST_URL})")
        by_slug, by_sku = _index_hongan(catalog)

        products = db.scalars(
            select(Product)
            .options(selectinload(Product.categories))
            .where(Product.tenant_id == tenant.id)
        ).all()

        updated = matched = skipped = 0
        for product in products:
            if not _is_racquet(product, rackets_id):
                continue
            if active_only and not product.is_active:
                continue
            row = _match_hongan(product, by_slug, by_sku)
            if row is None:
                skipped += 1
                if dry_run:
                    print(f"SKIP id={product.id} {product.slug} (no Hồng Ân match)")
                continue
            regular = _hongan_regular_vnd(row)
            if regular is None or regular <= 0:
                skipped += 1
                print(f"SKIP id={product.id} {product.slug} (no regular price on Hồng Ân)")
                continue
            target = baseline_web_price_from_hongan_regular(regular)
            matched += 1
            on_sale = bool(row.get("on_sale"))
            ha_name = (row.get("name") or "")[:50]
            line = (
                f"id={product.id} {product.slug} <- {row.get('slug')} "
                f"regular={regular:,}₫ -> {target:,.0f}₫"
                + (" (on_sale; used regular)" if on_sale else "")
            )
            if product.price != target:
                updated += 1
                if not dry_run:
                    product.price = target
            if dry_run:
                print(line)
            else:
                print(f"UPDATED {line}  [{ha_name}]")

        if dry_run:
            print(
                f"Dry run: matched {matched}, price changes {updated}, "
                f"no match {skipped} (formula: regular×{MARGIN_FACTOR}+ {MARGIN_ADD_VND:,}₫)"
            )
            return
        db.commit()
        print(f"Applied: matched {matched}, updated {updated}, no match {skipped}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Price Baseline rackets from Hồng Ân Sports list price")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--tenant", default="baseline")
    parser.add_argument(
        "--all-rackets",
        action="store_true",
        help="Include inactive rackets (default: active only)",
    )
    args = parser.parse_args()
    sync(dry_run=not args.apply, tenant_slug=args.tenant, active_only=not args.all_rackets)


if __name__ == "__main__":
    main()