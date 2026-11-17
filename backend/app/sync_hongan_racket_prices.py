"""Sync Baseline rackets with Hồng Ân Sports: price formula + import missing catalog rows.

Price: regular_price × 0.8 + 300,000₫ (never sale price).

    docker exec inspo-backend python -m app.sync_hongan_racket_prices
    docker exec inspo-backend python -m app.sync_hongan_racket_prices --apply
    docker exec inspo-backend python -m app.sync_hongan_racket_prices --apply --no-import
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
from .import_external_racquets import (
    HONGAN_SKIP_URL_PARTS,
    USER_AGENT,
    _slugify,
    _upsert_racquet,
    enrich_hongan_product,
)
from .map_racket_string_pairs import _is_racquet
from .models import Category, Collection, Product, Tenant
from .racket_catalog_rules import is_junior_racket

HONGAN_STORE_API = "https://hongansports.com/wp-json/wc/store/v1/products"
HONGAN_TENNIS_CATEGORY_ID = 184
HONGAN_LIST_URL = "https://hongansports.com/danh-muc-san-pham/quan-vot/vot-tennis/"
HTTP_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
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


def _ha_product_slug(hongan_slug: str) -> str:
    return _slugify(hongan_slug, prefix="ha")


def _skip_hongan_row(row: dict[str, Any]) -> str | None:
    permalink = (row.get("permalink") or "").lower()
    if any(part in permalink for part in HONGAN_SKIP_URL_PARTS):
        return "excluded URL"
    name = row.get("name") or ""
    slug = row.get("slug") or ""
    ha_slug = _ha_product_slug(slug)
    if is_junior_racket(name, ha_slug, name):
        return "junior"
    return None


def _apply_price(
    product: Product,
    row: dict[str, Any],
    *,
    dry_run: bool,
) -> tuple[bool, str]:
    regular = _hongan_regular_vnd(row)
    if regular is None or regular <= 0:
        return False, "no regular price"
    target = baseline_web_price_from_hongan_regular(regular)
    on_sale = bool(row.get("on_sale"))
    line = (
        f"id={product.id} {product.slug} <- {row.get('slug')} "
        f"regular={regular:,}₫ -> {target:,.0f}₫"
        + (" (on_sale; used regular)" if on_sale else "")
    )
    changed = product.price != target
    if not dry_run and changed:
        product.price = target
    return changed, line


def sync(
    *,
    dry_run: bool = True,
    tenant_slug: str = "baseline",
    import_missing: bool = True,
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
        gear = db.scalar(
            select(Collection).where(Collection.tenant_id == tenant.id, Collection.slug == "baseline-gear")
        )
        collection_id = gear.id if gear else None

        headers = dict(HTTP_HEADERS)
        with httpx.Client(headers=headers, follow_redirects=True) as client:
            catalog = _fetch_hongan_tennis_catalog(client)

        print(f"Hồng Ân tennis catalog: {len(catalog)} product(s) ({HONGAN_LIST_URL})")
        by_slug, by_sku = _index_hongan(catalog)

        products = db.scalars(
            select(Product)
            .options(selectinload(Product.categories))
            .where(Product.tenant_id == tenant.id)
        ).all()

        covered_hongan: set[str] = set()
        price_updated = price_matched = price_skipped = 0

        for product in products:
            if not _is_racquet(product, rackets_id):
                continue
            row = _match_hongan(product, by_slug, by_sku)
            if row is None:
                price_skipped += 1
                continue
            ha_slug = (row.get("slug") or "").lower()
            if ha_slug:
                covered_hongan.add(ha_slug)
            price_matched += 1
            changed, line = _apply_price(product, row, dry_run=dry_run)
            if changed:
                price_updated += 1
            prefix = "PRICE" if not dry_run and changed else "price"
            if dry_run or changed:
                print(f"{prefix} {line}")

        imported = import_failed = import_skipped = 0
        if import_missing:
            print("— import pass (missing on Baseline) —")
            with httpx.Client(headers=headers, follow_redirects=True) as client:
                for i, row in enumerate(catalog, 1):
                    ha_slug = (row.get("slug") or "").lower()
                    if not ha_slug or ha_slug in covered_hongan:
                        continue
                    skip = _skip_hongan_row(row)
                    if skip:
                        import_skipped += 1
                        if dry_run:
                            print(f"SKIP import {ha_slug}: {skip}")
                        continue

                    catalog_slug = _ha_product_slug(ha_slug)
                    existing = db.scalar(
                        select(Product).where(
                            Product.tenant_id == tenant.id,
                            Product.slug == catalog_slug,
                        )
                    )
                    if existing:
                        covered_hongan.add(ha_slug)
                        if _is_racquet(existing, rackets_id):
                            changed, line = _apply_price(existing, row, dry_run=dry_run)
                            if changed:
                                price_updated += 1
                            if dry_run or changed:
                                print(f"price (existing slug) {line}")
                        continue

                    permalink = row.get("permalink")
                    if not permalink:
                        import_failed += 1
                        continue

                    regular = _hongan_regular_vnd(row)
                    if regular is None or regular <= 0:
                        import_failed += 1
                        print(f"SKIP import {ha_slug}: no regular price")
                        continue

                    target = baseline_web_price_from_hongan_regular(regular)
                    if dry_run:
                        print(
                            f"IMPORT {catalog_slug} <- {ha_slug} "
                            f"{(row.get('name') or '')[:45]} @ {target:,.0f}₫ (inactive)"
                        )
                        imported += 1
                        continue

                    try:
                        item = enrich_hongan_product(client, permalink, brand_filter="all")
                    except Exception as exc:
                        import_failed += 1
                        print(f"FAIL import {ha_slug}: {exc}")
                        continue
                    if item is None:
                        import_failed += 1
                        print(f"SKIP import {ha_slug}: no product page / tech specs")
                        continue

                    item.price_vnd = target
                    _upsert_racquet(
                        db,
                        client,
                        tenant.id,
                        item,
                        collection_id=collection_id,
                        active=False,
                        dry_run=False,
                        replace_images=True,
                    )
                    product = db.scalar(
                        select(Product).where(
                            Product.tenant_id == tenant.id,
                            Product.slug == item.slug,
                        )
                    )
                    if product:
                        product.price = target
                    covered_hongan.add(ha_slug)
                    imported += 1
                    print(f"IMPORTED {item.slug} @ {target:,.0f}₫ (inactive)")
                    time.sleep(0.35)
                    if i % 10 == 0:
                        db.flush()

        summary = (
            f"Prices: matched {price_matched}, updated {price_updated}, "
            f"no Hồng Ân match {price_skipped}"
        )
        if import_missing:
            summary += (
                f"; import: {imported} new, {import_failed} failed/skipped enrich, "
                f"{import_skipped} junior/excluded"
            )
        summary += f" (formula: regular×{MARGIN_FACTOR}+ {MARGIN_ADD_VND:,}₫)"
        if dry_run:
            print(f"Dry run: {summary}")
            return
        db.commit()
        print(f"Applied: {summary}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync Baseline rackets with Hồng Ân (prices + import missing)"
    )
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--tenant", default="baseline")
    parser.add_argument(
        "--no-import",
        action="store_true",
        help="Only update prices for existing catalog matches",
    )
    args = parser.parse_args()
    sync(dry_run=not args.apply, tenant_slug=args.tenant, import_missing=not args.no_import)


if __name__ == "__main__":
    main()