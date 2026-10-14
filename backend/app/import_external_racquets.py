"""One-time import: tennis racquets from Thu Sports + Forheads into the baseline tenant.

Usage (from repo root, stack running):

    docker exec inspo-backend python -m app.import_external_racquets

    docker exec inspo-backend python -m app.import_external_racquets --dry-run

Options:
    --tenant SLUG       default: baseline
    --dry-run           crawl only, no DB writes
    --skip-thusports    Forheads only
    --skip-forheads     Thu Sports only
    --max-pages N       Thu Sports listing pages (default: all)
    --inactive          import with is_active=False (review in admin)
    --restructure-catalog   rackets category only + product.brand (Wilson/Head filters)

Re-run is idempotent per product slug (updates name, price, specs, replaces images).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from html import unescape
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .minio_client import save_file
from .models import Category, Collection, Product, ProductImage, Tenant

USER_AGENT = "inspo-baseline-import/1.0 (+local one-time catalog)"
THUSPORTS_LIST = "https://thusports.vn/vot-tennis.html"
FORHEADS_COLLECTION = "https://forheads.vn/collections/vot-tennis-1"

SKIP_NAME_FRAGMENTS = (
    "chọn vợt",
    "huong dan",
    "hướng dẫn",
    "chon vot",
)

RETAILER_HOSTS = ("thusports.vn", "forheads.vn")
RETAILER_LABELS = frozenset({"thusports", "forheads", "thu sports", "for heads"})

_REFERENCE_FOOTER_RE = re.compile(
    r"\n*—?\n*Reference listing:\s*https?://(?:www\.)?(?:thusports\.vn|forheads\.vn)\S*\s*",
    re.I,
)
_RETAILER_URL_RE = re.compile(
    r"https?://(?:www\.)?(?:thusports\.vn|forheads\.vn)\S*",
    re.I,
)


@dataclass
class ImportedRacquet:
    source: str
    source_url: str
    slug: str
    name: str
    price_vnd: float
    brand: str
    sku: str | None
    description_html: str
    image_urls: list[str]
    tech_specs: list[dict[str, str]]
    badge: str | None = None
    finder_specs: dict[str, Any] = field(default_factory=dict)


class _TableSpecParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_table = False
        self.in_cell = False
        self.cell_buf: list[str] = []
        self.row: list[str] = []
        self.pairs: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            classes = dict(attrs).get("class") or ""
            if "table_responsive" in classes or self.in_table:
                self.in_table = True
        if self.in_table and tag in ("td", "th"):
            self.in_cell = True
            self.cell_buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag in ("td", "th") and self.in_cell:
            text = " ".join(self.cell_buf).strip()
            self.row.append(text)
            self.in_cell = False
        if tag == "tr" and self.row:
            if len(self.row) >= 2:
                self.pairs.append((self.row[0], self.row[1]))
            elif len(self.row) == 1 and self.row[0]:
                self.pairs.append(("Spec", self.row[0]))
            self.row = []
        if tag == "table":
            self.in_table = False


def _slugify(text: str, *, prefix: str, max_len: int = 180) -> str:
    s = unicodedata.normalize("NFKD", text)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    if not s:
        s = "item"
    out = f"{prefix}-{s}"[:max_len].strip("-")
    return out or f"{prefix}-item"


def _parse_vnd_price(raw: str) -> float:
    digits = re.sub(r"[^\d]", "", raw or "")
    return float(digits) if digits else 0.0


def clean_retailer_text(text: str | None) -> str:
    """Remove reference footers and retailer URLs from storefront copy."""
    if not text:
        return ""
    out = _REFERENCE_FOOTER_RE.sub("", text)
    out = _RETAILER_URL_RE.sub("", out)
    out = re.sub(r"[ \t]+\n", "\n", out)
    out = re.sub(r"\n{3,}", "\n\n", out).strip()
    return out


def clean_retailer_subtitle(subtitle: str | None) -> str:
    if not subtitle:
        return ""
    parts = [p.strip() for p in subtitle.split("·") if p.strip()]
    kept = [p for p in parts if p.lower() not in RETAILER_LABELS]
    return " · ".join(kept)


def _strip_html(html: str) -> str:
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html or "", flags=re.I | re.S)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"<li[^>]*>", "\n• ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(re.sub(r"\s+", " ", text)).strip()
    return text


def _specs_from_html(html: str) -> list[dict[str, str]]:
    specs: list[dict[str, str]] = []
    parser = _TableSpecParser()
    try:
        parser.feed(html or "")
    except Exception:
        pass
    for label, value in parser.pairs:
        if not value:
            continue
        label = label.strip().rstrip(":")
        value = value.strip()
        if len(label) > 80 or len(value) > 300:
            continue
        specs.append(
            {
                "label": label[:60].upper(),
                "value": value[:200],
                "label_vi": label[:60],
                "value_vi": value[:200],
            }
        )
    if specs:
        return specs
    plain = _strip_html(html)
    for line in plain.split("\n"):
        line = line.strip(" •\t")
        if not line or len(line) < 4:
            continue
        if ":" in line:
            k, _, v = line.partition(":")
            if v.strip():
                specs.append(
                    {
                        "label": k.strip()[:60].upper(),
                        "value": v.strip()[:200],
                        "label_vi": k.strip()[:60],
                        "value_vi": v.strip()[:200],
                    }
                )
    return specs[:24]


def _infer_brand(name: str, vendor: str | None = None) -> str:
    blob = f"{name} {vendor or ''}".lower()
    for b in ("wilson", "head", "babolat", "yonex", "prince", "dunlop", "technifibre", "prokennex"):
        if b in blob:
            return b
    return "other"


def _finder_from_specs(specs: list[dict[str, str]]) -> dict[str, Any]:
    blob = " ".join(f"{s.get('label_vi','')} {s.get('value_vi','')}" for s in specs).lower()
    out: dict[str, Any] = {}
    m = re.search(r"(\d{2,3}(?:[.,]\d+)?)\s*g", blob)
    if m:
        g = float(m.group(1).replace(",", "."))
        if 200 < g < 400:
            out["weight_g"] = int(round(g))
    m = re.search(r"(\d{2,3})\s*cm", blob.replace("cm²", "cm"))
    if m:
        cm = int(m.group(1))
        if 550 < cm < 780:
            if cm > 100:
                out["head_sq_in"] = round(cm / 6.4516, 1)
    m = re.search(r"(\d+)\s*x\s*(\d+)", blob)
    if m:
        out["pattern"] = f"{m.group(1)}x{m.group(2)}"
    return out


def _thusports_full_image(thumb: str) -> str:
    if "/thumbs/" in thumb:
        return re.sub(r"/thumbs/\d+_", "/", thumb)
    return thumb


def _fetch(client: httpx.Client, url: str) -> str:
    r = client.get(url, timeout=45.0)
    r.raise_for_status()
    return r.text


def _json_ld_product(html: str) -> dict[str, Any] | None:
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S | re.I):
        block = block.strip()
        if '"@type": "Product"' not in block and '"@type":"Product"' not in block:
            continue
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("@type") == "Product":
            return data
    return None


def crawl_thusports_list(client: httpx.Client, max_pages: int | None) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    first = _fetch(client, THUSPORTS_LIST)
    pages = [int(x) for x in re.findall(r"vot-tennis\.html/\?p=(\d+)", first)]
    last = max(pages) if pages else 1
    if max_pages is not None:
        last = min(last, max_pages)

    price_by_path: dict[str, str] = {}
    image_by_path: dict[str, str] = {}

    for p in range(1, last + 1):
        url = THUSPORTS_LIST if p == 1 else f"{THUSPORTS_LIST}/?p={p}"
        html = first if p == 1 else _fetch(client, url)
        chunk_m = re.search(r'<div class="lstproduct">(.*?)<div class="pagination">', html, re.S)
        chunk = chunk_m.group(1) if chunk_m else html
        for block in re.findall(r'<div class="itemProduct">(.*?)</div>\s*</div>\s*</div>', chunk, re.S):
            m_href = re.search(r'<a href="([^"]+)"', block)
            m_img = re.search(r'<img src="([^"]+)"', block)
            m_price = re.search(r'class="pricenews">([^<]+)<', block)
            if m_href:
                path = m_href.group(1)
                if m_price:
                    price_by_path[path] = m_price.group(1)
                if m_img:
                    image_by_path[path] = m_img.group(1)

        for path, name_raw in re.findall(
            r'<div class="namePro">\s*<h3>\s*<a href="([^"]+)"[^>]*>(.*?)</a>',
            chunk,
            re.S,
        ):
            name = unescape(re.sub(r"\s+", " ", name_raw)).strip()
            if any(s in name.lower() for s in SKIP_NAME_FRAGMENTS):
                continue
            if "vot-tennis" not in path and not path.startswith("/vot-"):
                continue
            full_url = urljoin(THUSPORTS_LIST, path)
            items.append(
                {
                    "url": full_url,
                    "name": name,
                    "price": price_by_path.get(path, ""),
                    "image": image_by_path.get(path, ""),
                }
            )
        time.sleep(0.35)
    return items


def enrich_thusports_product(client: httpx.Client, stub: dict[str, str]) -> ImportedRacquet | None:
    html = _fetch(client, stub["url"])
    ld = _json_ld_product(html) or {}
    name = (ld.get("name") or stub["name"] or "").strip()
    if not name:
        return None
    brand = _infer_brand(name, (ld.get("brand") or {}).get("name") if isinstance(ld.get("brand"), dict) else None)
    sku = str(ld.get("sku") or "").strip() or None
    offers = ld.get("offers") or {}
    price = float(offers.get("price") or 0) if offers else _parse_vnd_price(stub.get("price", ""))

    image_urls: list[str] = []
    for m in re.findall(r'href="(/vnt_upload/product/[^"]+\.(?:jpeg|jpg|png|webp))"', html, re.I):
        image_urls.append(urljoin(stub["url"], m))
    if not image_urls and ld.get("image"):
        image_urls.append(str(ld["image"]))
    if not image_urls and stub.get("image"):
        image_urls.append(_thusports_full_image(stub["image"]))
    # dedupe preserve order
    seen: set[str] = set()
    deduped: list[str] = []
    for u in image_urls:
        u = _thusports_full_image(u)
        if u not in seen:
            seen.add(u)
            deduped.append(u)

    desc_block = ""
    m_desc = re.search(r'class="contentDetail[^"]*".*?</div>\s*</div>', html, re.S | re.I)
    if m_desc:
        desc_block = m_desc.group(0)
    specs = _specs_from_html(html)
    path = urlparse(stub["url"]).path.strip("/").replace(".html", "")
    slug = _slugify(path, prefix="ts")

    return ImportedRacquet(
        source="thusports",
        source_url=stub["url"],
        slug=slug,
        name=name,
        price_vnd=price,
        brand=brand,
        sku=sku,
        description_html=clean_retailer_text(_strip_html(desc_block)),
        image_urls=deduped[:8],
        tech_specs=specs,
        badge="NEW" if re.search(r"\bnew\b", html[:8000], re.I) else None,
        finder_specs=_finder_from_specs(specs),
    )


def crawl_forheads(client: httpx.Client) -> list[ImportedRacquet]:
    out: list[ImportedRacquet] = []
    page = 1
    while True:
        url = f"{FORHEADS_COLLECTION}/products.json?limit=250&page={page}"
        r = client.get(url, timeout=45.0)
        r.raise_for_status()
        products = r.json().get("products") or []
        if not products:
            break
        for p in products:
            title = (p.get("title") or "").strip()
            if not title:
                continue
            handle = p.get("handle") or title
            vendor = p.get("vendor") or ""
            brand = _infer_brand(title, vendor)
            variants = p.get("variants") or []
            price = float(variants[0].get("price") or 0) if variants else 0.0
            sku = str(variants[0].get("sku") or "").strip() or None
            body = p.get("body_html") or ""
            specs = _specs_from_html(body)
            images = [img.get("src") for img in (p.get("images") or []) if img.get("src")]
            tags = p.get("tags") or ""
            badge = "NEW" if "mới" in tags.lower() or "new" in tags.lower() else None
            product_url = f"https://forheads.vn/products/{handle}"
            slug = _slugify(handle, prefix="fh")
            out.append(
                ImportedRacquet(
                    source="forheads",
                    source_url=product_url,
                    slug=slug,
                    name=title,
                    price_vnd=price,
                    brand=brand,
                    sku=sku,
                    description_html=clean_retailer_text(_strip_html(body)),
                    image_urls=images[:8],
                    tech_specs=specs,
                    badge=badge,
                    finder_specs=_finder_from_specs(specs),
                )
            )
        if len(products) < 250:
            break
        page += 1
        time.sleep(0.25)
    return out


def _download_image(client: httpx.Client, url: str) -> tuple[bytes, str, str]:
    r = client.get(url, timeout=60.0, follow_redirects=True)
    r.raise_for_status()
    content = r.content
    path = urlparse(url).path.lower()
    if path.endswith(".png"):
        ctype, ext = "image/png", ".png"
    elif path.endswith(".webp"):
        ctype, ext = "image/webp", ".webp"
    else:
        ctype, ext = "image/jpeg", ".jpg"
    name = path.split("/")[-1][:120] or f"image{ext}"
    if not name.lower().endswith(ext):
        name += ext
    return content, ctype, name


def _get_or_create_category(db, tenant_id: int, slug: str, name: str) -> Category:
    cat = db.scalar(select(Category).where(Category.tenant_id == tenant_id, Category.slug == slug))
    if cat is None:
        cat = Category(tenant_id=tenant_id, slug=slug, name=name, name_vi=name)
        db.add(cat)
        db.flush()
    return cat


def _rackets_category(db, tenant_id: int) -> Category:
    return _get_or_create_category(db, tenant_id, "rackets", "RACKETS")


def _normalize_brand(brand: str) -> str | None:
    b = (brand or "").strip().lower()
    if not b or b == "other":
        return None
    return b


def _brand_from_product_row(product: Product) -> str | None:
    if product.brand:
        return product.brand.strip().lower()
    for c in product.categories or []:
        if c.slug.startswith("brand-"):
            legacy = c.slug.removeprefix("brand-")
            normalized = _normalize_brand(legacy)
            if normalized:
                return normalized
    sub = (product.subtitle or "").split("·")[0].strip().lower()
    if sub and sub not in RETAILER_LABELS:
        return sub
    return _normalize_brand(_infer_brand(product.name or "", None))


def _replace_images(db, client: httpx.Client, tenant_id: int, product: Product, urls: list[str]) -> None:
    db.execute(delete(ProductImage).where(ProductImage.product_id == product.id))
    for pos, url in enumerate(urls):
        if not url:
            continue
        try:
            content, ctype, fname = _download_image(client, url)
        except Exception as exc:
            print(f"  ! image skip {url}: {exc}")
            continue
        media = save_file(db, content, fname, ctype, tenant_id=tenant_id)
        db.add(
            ProductImage(
                product_id=product.id,
                media_id=media.id,
                url=media.url,
                alt=product.name,
                position=pos,
                enabled=True,
            )
        )
        time.sleep(0.15)


def _upsert_racquet(
    db,
    client: httpx.Client,
    tenant_id: int,
    item: ImportedRacquet,
    *,
    collection_id: int | None,
    active: bool,
    dry_run: bool,
) -> str:
    if dry_run:
        return "dry-run"
    rackets = _rackets_category(db, tenant_id)
    product = db.scalar(select(Product).where(Product.tenant_id == tenant_id, Product.slug == item.slug))
    product_brand = _normalize_brand(item.brand)
    subtitle = item.brand.upper()
    if item.sku:
        subtitle = f"{subtitle} · {item.sku}"

    finder = {
        "enabled": False,
        "vectors": {},
        "specs": item.finder_specs,
        "tags": [item.brand] if item.brand else [],
    }

    if product is None:
        product = Product(
            tenant_id=tenant_id,
            slug=item.slug,
            name=item.name,
            name_vi=item.name,
            subtitle=subtitle,
            subtitle_vi=subtitle,
            description=item.description_html,
            description_vi=item.description_html,
            price=item.price_vnd,
            category_id=rackets.id,
            brand=product_brand,
            collection_id=collection_id,
            badge=item.badge,
            gallery_layout="slideshow",
            colors=[],
            sizes=["ONE SIZE"],
            tech_specs=item.tech_specs,
            features=[],
            is_active=active,
            is_featured=False,
            is_bestseller=False,
            finder_profile=finder,
        )
        db.add(product)
        db.flush()
    else:
        product.name = item.name
        product.name_vi = item.name
        product.subtitle = subtitle
        product.subtitle_vi = subtitle
        product.description = item.description_html
        product.description_vi = item.description_html
        product.price = item.price_vnd
        product.category_id = rackets.id
        product.brand = product_brand
        product.collection_id = collection_id
        product.badge = item.badge
        product.tech_specs = item.tech_specs
        product.finder_profile = finder
        product.is_active = active

    product.categories = [rackets]
    _replace_images(db, client, tenant_id, product, item.image_urls)
    return product


def restructure_racquet_catalog(*, tenant_slug: str = "baseline", dry_run: bool = False) -> None:
    """One category (rackets) + product.brand for Wilson/Head filters; drop brand-* categories from products."""
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")
        rackets = _rackets_category(db, tenant.id)
        products = db.scalars(
            select(Product)
            .options(selectinload(Product.categories))
            .where(Product.tenant_id == tenant.id)
        ).all()
        updated = 0
        for p in products:
            is_imported = p.slug.startswith("ts-") or p.slug.startswith("fh-")
            cats = p.categories or []
            is_racket = (
                is_imported
                or p.category_id == rackets.id
                or any(c.slug == "rackets" for c in cats)
                or any(c.slug.startswith("brand-") for c in cats)
            )
            if not is_racket and not is_imported:
                continue
            brand = _brand_from_product_row(p)
            new_cats = [rackets]
            if (
                p.category_id != rackets.id
                or [c.id for c in p.categories] != [rackets.id]
                or p.brand != brand
            ):
                if dry_run:
                    print(f"would restructure: {p.slug} brand={brand}")
                else:
                    p.category_id = rackets.id
                    p.categories = new_cats
                    p.brand = brand
                updated += 1
        if dry_run:
            print(f"Dry run: {updated} racquet product(s) would be updated.")
            return
        db.commit()
        print(f"Restructured {updated} racquet product(s) on tenant '{tenant_slug}' (category=rackets, brand field set).")
    finally:
        db.close()


def cleanup_retailer_references(*, tenant_slug: str = "baseline", dry_run: bool = False) -> None:
    """Strip Thu Sports / Forheads URLs and labels from existing imported products."""
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")
        products = db.scalars(select(Product).where(Product.tenant_id == tenant.id)).all()
        changed = 0
        for p in products:
            touched = False
            for field in ("description", "description_vi"):
                raw = getattr(p, field) or ""
                cleaned = clean_retailer_text(raw)
                if cleaned != raw:
                    setattr(p, field, cleaned or None)
                    touched = True
            for field in ("subtitle", "subtitle_vi"):
                raw = getattr(p, field) or ""
                cleaned = clean_retailer_subtitle(raw)
                if cleaned != raw:
                    setattr(p, field, cleaned or None)
                    touched = True
            fp = dict(p.finder_profile) if p.finder_profile else None
            if fp and isinstance(fp.get("tags"), list):
                tags = [t for t in fp["tags"] if str(t).lower() not in RETAILER_LABELS]
                if tags != fp["tags"]:
                    fp["tags"] = tags
                    p.finder_profile = fp
                    touched = True
            specs = p.tech_specs or []
            if specs:
                new_specs = []
                specs_changed = False
                for row in specs:
                    if not isinstance(row, dict):
                        new_specs.append(row)
                        continue
                    row = dict(row)
                    for key in ("value", "value_vi", "label", "label_vi"):
                        if key in row and row[key]:
                            cleaned = clean_retailer_text(str(row[key]))
                            if cleaned != row[key]:
                                row[key] = cleaned
                                specs_changed = True
                    new_specs.append(row)
                if specs_changed:
                    p.tech_specs = new_specs
                    touched = True
            if touched:
                changed += 1
                if dry_run:
                    print(f"would clean: {p.slug}")
        if dry_run:
            print(f"Dry run: {changed} product(s) would be updated.")
            return
        db.commit()
        print(f"Cleaned retailer references on {changed} product(s) for tenant '{tenant_slug}'.")
    finally:
        db.close()


def run(
    *,
    tenant_slug: str = "baseline",
    dry_run: bool = False,
    skip_thusports: bool = False,
    skip_forheads: bool = False,
    max_pages: int | None = None,
    active: bool = True,
) -> None:
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"}
    items: list[ImportedRacquet] = []

    with httpx.Client(headers=headers, follow_redirects=True) as client:
        if not skip_thusports:
            print("Crawling Thu Sports listing…")
            stubs = crawl_thusports_list(client, max_pages)
            print(f"  {len(stubs)} listing rows")
            for i, stub in enumerate(stubs, 1):
                try:
                    item = enrich_thusports_product(client, stub)
                except Exception as exc:
                    print(f"  ! [{i}] {stub.get('url')}: {exc}")
                    continue
                if item:
                    items.append(item)
                time.sleep(0.3)
                if i % 10 == 0:
                    print(f"  … enriched {i}/{len(stubs)}")

        if not skip_forheads:
            print("Fetching Forheads collection JSON…")
            fh = crawl_forheads(client)
            print(f"  {len(fh)} products")
            items.extend(fh)

    print(f"Total normalized: {len(items)}")
    if dry_run:
        for it in items[:5]:
            print(f"  - [{it.source}] {it.name} ({it.price_vnd:,.0f} VND) → {it.slug}")
        if len(items) > 5:
            print(f"  … and {len(items) - 5} more")
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
                    _upsert_racquet(
                        db,
                        client,
                        tenant.id,
                        item,
                        collection_id=collection_id,
                        active=active,
                        dry_run=False,
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
        print(f"Done for tenant '{tenant_slug}': {created} created, {updated} updated.")
        print("Tip: enable quiz matching + scores in admin; review prices and descriptions before publish.")
    finally:
        db.close()


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Import tennis racquets into baseline tenant")
    p.add_argument("--tenant", default="baseline")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--skip-thusports", action="store_true")
    p.add_argument("--skip-forheads", action="store_true")
    p.add_argument("--max-pages", type=int, default=None)
    p.add_argument("--inactive", action="store_true", help="import as is_active=False")
    p.add_argument(
        "--cleanup-references",
        action="store_true",
        help="remove Thu Sports/Forheads URLs and labels from existing products (no crawl)",
    )
    p.add_argument(
        "--restructure-catalog",
        action="store_true",
        help="assign racquets to rackets category only and set brand field for filtering",
    )
    args = p.parse_args(argv)
    if args.cleanup_references:
        cleanup_retailer_references(tenant_slug=args.tenant, dry_run=args.dry_run)
        return
    if args.restructure_catalog:
        restructure_racquet_catalog(tenant_slug=args.tenant, dry_run=args.dry_run)
        return
    run(
        tenant_slug=args.tenant,
        dry_run=args.dry_run,
        skip_thusports=args.skip_thusports,
        skip_forheads=args.skip_forheads,
        max_pages=args.max_pages,
        active=not args.inactive,
    )


if __name__ == "__main__":
    main(sys.argv[1:])
