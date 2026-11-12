"""Import tennis strings from Gusport (gusport.com.vn) into the baseline tenant.

Usage:

    docker exec inspo-backend python -m app.import_gusport_strings --dry-run
    docker exec inspo-backend python -m app.import_gusport_strings --apply

Re-run is idempotent by product slug (gs-<gusport-path-slug>).
"""

from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import dataclass, field
from html import unescape
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import select

from .database import SessionLocal
from .import_external_racquets import (
    _download_image,
    _get_or_create_category,
    _infer_brand,
    _merge_core_specs,
    _normalize_brand,
    _parse_vnd_price,
    _replace_images,
    _strip_html,
    clean_retailer_text,
)
from .models import Collection, Product, Tenant

# Gusport hides listing/PDP prices when using bot-like User-Agent strings.
GUSPORT_HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
}
USER_AGENT = GUSPORT_HTTP_HEADERS["User-Agent"]
GUSPORT_CATEGORY = "https://www.gusport.com.vn/day-vot-tennis"
STRINGS_CATEGORY_SLUG = "tennis-strings"
STRINGS_CATEGORY_NAME = "TENNIS STRINGS"
STRINGS_CATEGORY_NAME_VI = "Dây vợt tennis"
ACCESSORIES_CATEGORY_SLUG = "accessories"

# Brand-only listing URLs under day-vot-tennis (not product PDPs).
GUSPORT_BRAND_PATHS = frozenset(
    {
        "day-tennis-babolat",
        "day-tennis-wilson",
        "day-tennis-head",
        "day-tennis-luxilon",
        "day-tennis-yonex",
        "day-tennis-solinco",
        "day-tennis-tecnifibre",
        "day-tennis-signum-pro",
        "day-tennis-pros-pro",
        "day-tennis-pro-supex",
        "day-tennis-msv",
        "day-tennis-gosen",
        "day-tennis-dunlop",
        "day-tennis-ashaway",
        "day-tennis-alpha",
        "day-tennis-akpro",
        "day-tennis-zons",
    }
)

_IMAGE_SKIP_PARTS = ("/logo/", "/icon/", "hot-0x0")


@dataclass
class ImportedString:
    source_url: str
    slug: str
    name: str
    price_vnd: float
    brand: str
    sku: str | None
    description: str
    image_urls: list[str]
    tech_specs: list[dict[str, str]] = field(default_factory=list)
    features: list[dict[str, str]] = field(default_factory=list)


def _product_path_from_url(url: str) -> str:
    return urlparse(url).path.strip("/").split("?")[0]


def _is_gusport_product_url(url: str) -> bool:
    path = _product_path_from_url(url)
    if not path.startswith("day-tennis-"):
        return False
    if path in GUSPORT_BRAND_PATHS:
        return False
    return True


def _slug_for_url(url: str) -> str:
    path = _product_path_from_url(url)
    base = re.sub(r"[^a-z0-9-]+", "-", path.lower()).strip("-") or "item"
    slug = f"gs-{base}"
    return slug[:180].strip("-") or "gs-item"


def _listing_product_urls(html: str) -> set[str]:
    found: set[str] = set()
    for _full, path in re.findall(
        r'href="(https://www\.gusport\.com\.vn/(day-[^"?#]+))"',
        html,
        flags=re.I,
    ):
        path = path.strip("/")
        url = f"https://www.gusport.com.vn/{path}"
        if _is_gusport_product_url(url):
            found.add(url.split("?")[0])
    return found


def _max_listing_page(html: str) -> int:
    pages = [int(p) for p in re.findall(r"day-vot-tennis\?page=(\d+)", html, flags=re.I)]
    return max(pages) if pages else 1


def _listing_prices_from_html(html: str) -> dict[str, float]:
    """Category/brand grid prices keyed by canonical product URL."""
    prices: dict[str, float] = {}
    for block in re.findall(
        r'<div class="product-bottom">(.*?)</div>\s*</div>\s*</div>',
        html,
        flags=re.S | re.I,
    ):
        urls = re.findall(
            r'href="(https://www\.gusport\.com\.vn/day-tennis-[^"?#]+)"',
            block,
            flags=re.I,
        )
        if not urls:
            continue
        product_url = urls[-1].split("?")[0]
        m = re.search(
            r'class="price-box"[^>]*>\s*<span class="price">([^<]+)</span>',
            block,
            flags=re.I,
        )
        if not m:
            continue
        raw = m.group(1).strip()
        if not raw or "liên hệ" in raw.casefold():
            continue
        val = _parse_vnd_price(raw)
        if val > 0:
            prices[product_url] = val
    return prices


def crawl_gusport_listing(
    client: httpx.Client, *, max_pages: int | None = None
) -> tuple[list[str], dict[str, float]]:
    first = client.get(GUSPORT_CATEGORY, timeout=60.0)
    first.raise_for_status()
    last_page = _max_listing_page(first.text)
    if max_pages is not None:
        last_page = min(last_page, max_pages)

    urls: set[str] = set()
    listing_prices: dict[str, float] = {}
    for page in range(1, last_page + 1):
        url = GUSPORT_CATEGORY if page == 1 else f"{GUSPORT_CATEGORY}?page={page}"
        if page == 1:
            html = first.text
        else:
            r = client.get(url, timeout=60.0)
            r.raise_for_status()
            html = r.text
            time.sleep(0.25)
        batch = _listing_product_urls(html)
        listing_prices.update(_listing_prices_from_html(html))
        if not batch and page > 1:
            break
        urls |= batch
        priced = sum(1 for u in batch if listing_prices.get(u.split("?")[0], 0) > 0)
        print(
            f"  listing page {page}/{last_page}: {len(batch)} products "
            f"({len(urls)} total, {priced} with VND on page)"
        )

    for brand_path in sorted(GUSPORT_BRAND_PATHS):
        brand_url = f"https://www.gusport.com.vn/{brand_path}"
        try:
            r = client.get(brand_url, timeout=60.0)
            r.raise_for_status()
        except Exception as exc:
            print(f"  ! brand listing {brand_path}: {exc}")
            continue
        before = len(listing_prices)
        listing_prices.update(_listing_prices_from_html(r.text))
        added = len(listing_prices) - before
        if added:
            print(f"  brand {brand_path}: +{added} priced row(s)")
        time.sleep(0.2)

    return sorted(urls), listing_prices


def _pdp_price_scope(html: str) -> str:
    m = re.search(r'id="add-to-cart-form"(.*?)</form>', html, flags=re.S | re.I)
    if m:
        return m.group(1)
    m = re.search(r'id="product"(.*?)(?:<div[^>]+class="[^"]*tab|$)', html, flags=re.S | re.I)
    return m.group(1) if m else html


def _parse_ld_json_product(html: str) -> dict[str, Any]:
    for block in re.findall(
        r'<script type="application/ld\+json">(.*?)</script>',
        html,
        flags=re.S | re.I,
    ):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("@type") == "Product":
            return data
    return {}


def _parse_price_vnd(html: str, ld: dict[str, Any]) -> float:
    scope = _pdp_price_scope(html)
    candidates: list[float] = []

    for m in re.finditer(r'itemprop="price"\s+content="([0-9.]+)"', scope, flags=re.I):
        val = _parse_vnd_price(m.group(1))
        if val > 0:
            candidates.append(val)

    for m in re.finditer(
        r'class="[^"]*\bproduct-price\b[^"]*"[^>]*>\s*([^<]+)',
        scope,
        flags=re.I,
    ):
        raw = m.group(1).strip()
        if raw and "liên hệ" not in raw.casefold():
            val = _parse_vnd_price(raw)
            if val > 0:
                candidates.append(val)

    m = re.search(
        r'class="price-box clearfix"[^>]*>.*?class="price[^"]*"[^>]*>\s*([^<]+)',
        scope,
        flags=re.S | re.I,
    )
    if m:
        raw = m.group(1).strip()
        if raw and "liên hệ" not in raw.casefold():
            val = _parse_vnd_price(raw)
            if val > 0:
                candidates.append(val)

    if candidates:
        return candidates[0]

    offers = ld.get("offers") if isinstance(ld.get("offers"), dict) else {}
    for key in ("highPrice", "lowPrice", "price"):
        raw = offers.get(key)
        if raw is not None and str(raw) not in ("0", "0.0", ""):
            val = _parse_vnd_price(str(raw))
            if val > 0:
                return val
    return 0.0


def _description_block_html(html: str) -> str:
    m = re.search(
        r'id="description"[^>]*>(.*?)</div>\s*</div>\s*</div>\s*</div>\s*</div>',
        html,
        flags=re.S | re.I,
    )
    if m:
        return m.group(1)
    m = re.search(r'id="tab-1"[^>]*>.*?id="content"[^>]*>(.*?)</div>\s*</div>\s*</div>\s*</div>',
                  html, flags=re.S | re.I)
    return m.group(1) if m else ""


def _description_and_specs_from_html(block: str) -> tuple[str, list[dict[str, str]]]:
    if not block:
        return "", []
    specs: list[dict[str, str]] = []
    story_parts: list[str] = []

    for p in re.findall(r"<p[^>]*>(.*?)</p>", block, flags=re.S | re.I):
        inner = p.strip()
        if not inner or inner in ("&nbsp;", " "):
            continue
        plain = _strip_html(inner)
        if not plain:
            continue
        strong_m = re.search(r"<strong[^>]*>(.*?)</strong>", inner, flags=re.S | re.I)
        if strong_m:
            label_vi = _strip_html(strong_m.group(1)).strip(" :")
            value_vi = _strip_html(inner[strong_m.end() :]).strip(" :")
            if label_vi and value_vi and len(label_vi) < 80:
                label_en = {
                    "cấu trúc": "CONSTRUCTION",
                    "độ dày": "GAUGE",
                    "màu sắc": "COLOR",
                    "chiều dài": "LENGTH",
                    "trọng lượng": "WEIGHT",
                }.get(label_vi.casefold(), label_vi.upper())
                specs.append(
                    {
                        "label": label_en[:120],
                        "value": value_vi[:200],
                        "label_vi": label_vi[:120],
                        "value_vi": value_vi[:200],
                    }
                )
                continue
        story_parts.append(plain)

    description = "\n\n".join(story_parts).strip()
    return description, specs


def _product_image_urls(html: str, *, source_url: str) -> list[str]:
    path = _product_path_from_url(source_url)
    slug_hint = path.removeprefix("day-tennis-")
    folder_hints = {slug_hint, path, path.replace("day-tennis-", "")}

    candidates: list[str] = []
    for url in re.findall(
        r'https://www\.gusport\.com\.vn/image/catalog/san-pham/[^"\']+\.(?:jpg|jpeg|png|webp)',
        html,
        flags=re.I,
    ):
        low = url.lower()
        if any(skip in low for skip in _IMAGE_SKIP_PARTS):
            continue
        if "/day-vot/" not in low and not any(h in low for h in folder_hints if len(h) > 8):
            continue
        candidates.append(url)

    if not candidates:
        for url in re.findall(
            r'https://www\.gusport\.com\.vn/image/cache/catalog/san-pham/day-vot/[^"\']+\.(?:jpg|jpeg|png|webp)',
            html,
            flags=re.I,
        ):
            low = url.lower()
            if any(skip in low for skip in _IMAGE_SKIP_PARTS):
                continue
            if not any(h in low for h in folder_hints if len(h) > 8):
                continue
            full = re.sub(r"-\d+x\d+\.(webp|jpg|jpeg|png)$", r".\1", url, flags=re.I)
            full = full.replace("/image/cache/catalog/", "/image/catalog/")
            candidates.append(full)

    seen: set[str] = set()
    ordered: list[str] = []
    for url in candidates:
        key = url.split("/")[-1].casefold()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(url)
    return ordered[:12]


def _infer_string_brand(name: str) -> str:
    blob = name.casefold()
    for needle, slug in (
        ("signum pro", "signum-pro"),
        ("pro's pro", "pros-pro"),
        ("pro supex", "pro-supex"),
        ("tecnifibre", "tecnifibre"),
        ("luxilon", "luxilon"),
        ("solinco", "solinco"),
        ("babolat", "babolat"),
        ("wilson", "wilson"),
        ("head", "head"),
        ("yonex", "yonex"),
        ("gosen", "gosen"),
        ("dunlop", "dunlop"),
        ("msv", "msv"),
        ("ashaway", "ashaway"),
    ):
        if needle in blob:
            return slug
    return _infer_brand(name, None)


def _product_title(html: str, ld: dict[str, Any]) -> str:
    name = (ld.get("name") or "").strip()
    if name:
        return unescape(name)
    m = re.search(r"<h1[^>]*>([^<]+)", html, flags=re.I)
    if m:
        return unescape(m.group(1).strip())
    m = re.search(r"<title>([^<]+)</title>", html, flags=re.I)
    return unescape(m.group(1).strip()) if m else "Tennis string"


def enrich_gusport_product(
    client: httpx.Client,
    url: str,
    *,
    listing_prices: dict[str, float] | None = None,
) -> ImportedString | None:
    r = client.get(url, timeout=60.0)
    r.raise_for_status()
    html = r.text
    ld = _parse_ld_json_product(html)
    name = _product_title(html, ld)
    if not name or "day-vot-tennis" in name.casefold():
        return None

    canonical = url.split("?")[0]
    price = _parse_price_vnd(html, ld)
    if price <= 0 and listing_prices:
        price = float(listing_prices.get(canonical, 0.0))
    sku = (ld.get("sku") or "").strip() or None
    if not sku:
        m = re.search(r'"sku"\s*:\s*"([^"]+)"', html, flags=re.I)
        sku = m.group(1).strip() if m else None

    brand_raw = _infer_string_brand(name)
    block = _description_block_html(html)
    description, specs = _description_and_specs_from_html(block)
    if not description:
        meta = re.search(r'<meta name="description" content="([^"]+)"', html, flags=re.I)
        if meta:
            description = unescape(meta.group(1)).strip()
            if name and description.startswith(name):
                description = description[len(name) :].strip(" -–—")

    images = _product_image_urls(html, source_url=url)
    if price <= 0 and not images:
        print(f"  ! skip (no price/images): {url}")
        return None

    return ImportedString(
        source_url=url,
        slug=_slug_for_url(url),
        name=name,
        price_vnd=price,
        brand=brand_raw,
        sku=sku,
        description=description,
        image_urls=images,
        tech_specs=specs,
    )


def _accessories_category(db, tenant_id: int):
    return _get_or_create_category(
        db,
        tenant_id,
        ACCESSORIES_CATEGORY_SLUG,
        "ACCESSORIES",
        name_vi="Phụ kiện",
    )


def _strings_category(db, tenant_id: int):
    accessories = _accessories_category(db, tenant_id)
    return _get_or_create_category(
        db,
        tenant_id,
        STRINGS_CATEGORY_SLUG,
        STRINGS_CATEGORY_NAME,
        name_vi=STRINGS_CATEGORY_NAME_VI,
        parent_id=accessories.id,
    )


def _upsert_string(
    db,
    client: httpx.Client,
    tenant_id: int,
    item: ImportedString,
    *,
    collection_id: int | None,
    active: bool,
    dry_run: bool,
    replace_images: bool,
) -> None:
    if dry_run:
        return
    strings_cat = _strings_category(db, tenant_id)
    product = db.scalar(select(Product).where(Product.tenant_id == tenant_id, Product.slug == item.slug))
    product_brand = _normalize_brand(item.brand)
    desc = clean_retailer_text(item.description or "")
    specs = _merge_core_specs(item.tech_specs, brand=product_brand, sku=item.sku)
    features = list(item.features)
    subtitle = (product_brand or item.brand or "").replace("-", " ").title()
    if item.sku:
        subtitle = f"{subtitle} · {item.sku}" if subtitle else item.sku

    if product is None:
        product = Product(
            tenant_id=tenant_id,
            slug=item.slug,
            name=item.name,
            name_vi=item.name,
            subtitle=subtitle or None,
            subtitle_vi=subtitle or None,
            description=desc or None,
            description_vi=desc or None,
            price=item.price_vnd,
            category_id=strings_cat.id,
            brand=product_brand,
            collection_id=collection_id,
            gallery_layout="slideshow",
            colors=[],
            sizes=["12m"],
            tech_specs=specs,
            features=features,
            is_active=active,
            finder_profile={"enabled": False, "vectors": {}, "specs": {}, "tags": [item.brand] if item.brand else []},
        )
        db.add(product)
        db.flush()
    else:
        product.name = item.name
        product.name_vi = item.name
        product.subtitle = subtitle or None
        product.subtitle_vi = subtitle or None
        product.description = desc or None
        product.description_vi = desc or None
        product.price = item.price_vnd
        product.category_id = strings_cat.id
        product.brand = product_brand
        product.collection_id = collection_id
        product.tech_specs = specs
        product.features = features
        product.is_active = active
        if not product.sizes:
            product.sizes = ["12m"]

    product.categories = [strings_cat]
    if replace_images and item.image_urls:
        _replace_images(db, client, tenant_id, product, item.image_urls)


def run(
    *,
    tenant_slug: str = "baseline",
    dry_run: bool = False,
    apply: bool = False,
    max_pages: int | None = None,
    active: bool = True,
    replace_images: bool = True,
    limit: int | None = None,
) -> None:
    if apply:
        dry_run = False
    headers = dict(GUSPORT_HTTP_HEADERS)
    with httpx.Client(headers=headers, follow_redirects=True) as client:
        print(f"Crawling Gusport category {GUSPORT_CATEGORY}…")
        urls, listing_prices = crawl_gusport_listing(client, max_pages=max_pages)
        if limit is not None:
            urls = urls[:limit]
        print(f"  {len(urls)} product URL(s), {len(listing_prices)} with VND on Gusport listings")

        items: list[ImportedString] = []
        for i, url in enumerate(urls, 1):
            try:
                item = enrich_gusport_product(client, url, listing_prices=listing_prices)
            except Exception as exc:
                print(f"  ! [{i}] {url}: {exc}")
                continue
            if item:
                items.append(item)
            time.sleep(0.35)
            if i % 10 == 0:
                print(f"  … enriched {i}/{len(urls)}")

    priced = sum(1 for it in items if it.price_vnd > 0)
    print(f"Total normalized: {len(items)} ({priced} with price, {len(items) - priced} Liên hệ / no public price)")
    if dry_run:
        for it in items[:8]:
            print(
                f"  - {it.name} ({it.price_vnd:,.0f} VND, {len(it.image_urls)} img, "
                f"{len(it.tech_specs)} specs) → {it.slug}"
            )
        if len(items) > 8:
            print(f"  … and {len(items) - 8} more")
        return

    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")
        gear = db.scalar(
            select(Collection).where(Collection.tenant_id == tenant.id, Collection.slug == "baseline-gear")
        )
        collection_id = gear.id if gear else None

        created = updated = 0
        with httpx.Client(headers=headers, follow_redirects=True) as client:
            for i, item in enumerate(items, 1):
                try:
                    existed = db.scalar(
                        select(Product.id).where(Product.tenant_id == tenant.id, Product.slug == item.slug)
                    )
                    _upsert_string(
                        db,
                        client,
                        tenant.id,
                        item,
                        collection_id=collection_id,
                        active=active,
                        dry_run=False,
                        replace_images=replace_images,
                    )
                    if existed:
                        updated += 1
                    else:
                        created += 1
                except Exception as exc:
                    print(f"! DB [{item.slug}]: {exc}")
                    db.rollback()
                    continue
                if i % 5 == 0:
                    db.commit()
                    print(f"  … saved {i}/{len(items)}")
            db.commit()
        print(
            f"Done for tenant '{tenant_slug}' (category={STRINGS_CATEGORY_SLUG}): "
            f"{created} created, {updated} updated."
        )
    finally:
        db.close()


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Import Gusport tennis strings into baseline tenant")
    p.add_argument("--tenant", default="baseline")
    p.add_argument("--dry-run", action="store_true", help="Crawl only, no DB writes")
    p.add_argument("--apply", action="store_true", help="Write products to DB")
    p.add_argument("--max-pages", type=int, default=None, help="Limit category listing pages")
    p.add_argument("--limit", type=int, default=None, help="Limit number of products (debug)")
    p.add_argument("--inactive", action="store_true", help="Import as is_active=False")
    p.add_argument("--skip-images", action="store_true", help="Do not re-download images")
    args = p.parse_args(argv)

    if not args.apply and not args.dry_run:
        print("Pass --dry-run or --apply")
        raise SystemExit(2)

    run(
        tenant_slug=args.tenant,
        dry_run=args.dry_run,
        apply=args.apply,
        max_pages=args.max_pages,
        active=not args.inactive,
        replace_images=not args.skip_images,
        limit=args.limit,
    )


if __name__ == "__main__":
    main()
