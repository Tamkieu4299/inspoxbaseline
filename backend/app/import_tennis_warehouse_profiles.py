"""Import Tennis Warehouse racquet review data into product finder_profile + tech_specs.

Crawls https://www.tennis-warehouse.com/reviewedracquets.html, fetches each review page,
matches baseline tenant racquets, and stores TW breakdown scores (quiz vectors), lab data,
and standardized tech specs.

Usage:

    docker exec inspo-backend python -m app.import_tennis_warehouse_profiles --dry-run
    docker exec inspo-backend python -m app.import_tennis_warehouse_profiles --apply

Optional overrides (slug -> TW product code): backend/data/tw_product_overrides.json
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
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import httpx
from sqlalchemy import select

from .database import SessionLocal
from .models import Category, Product, Tenant
from .tw_racquet_schema import TW_BREAKDOWN_TO_VECTOR, TW_LAB_ROWS, TW_TECH_SPEC_ORDER

TW_BASE = "https://www.tennis-warehouse.com"
TW_LISTING = f"{TW_BASE}/reviewedracquets.html"
USER_AGENT = "inspo-baseline-tw-import/1.0 (+one-time catalog enrichment)"
OVERRIDES_PATH = Path(__file__).resolve().parent.parent / "data" / "tw_product_overrides.json"

TECH_SPEC_VI: dict[str, str] = {
    "Length": "Chiều dài",
    "Head Size": "Mặt vợt",
    "Weight": "Trọng lượng",
    "Balance Point": "Điểm cân bằng",
    "Construction": "Cấu tạo khung",
    "String Pattern": "Mặt cước",
    "Flex Rating Test": "Độ cứng (RA)",
    "Swing Weight": "Swingweight",
}

BRAND_ALIASES: dict[str, str] = {
    "wilson": "wilson",
    "head": "head",
    "babolat": "babolat",
    "yonex": "yonex",
    "dunlop": "dunlop",
    "prince": "prince",
    "technifibre": "technifibre",
    "tecnifibre": "technifibre",
}

FRAME_VARIANTS = frozenset(
    {
        "elite",
        "mp",
        "pro",
        "team",
        "plus",
        "lite",
        "ul",
        "100ul",
        "tour",
        "classic",
        "s",
        "l",
    }
)

MODEL_LINES: tuple[tuple[str, str], ...] = (
    ("pro staff", "prostaff"),
    ("prostaff", "prostaff"),
    ("pure aero", "aero"),
    ("pure drive", "drive"),
    ("pure strike", "strike"),
    ("clash", "clash"),
    ("ultra", "ultra"),
    ("shift", "shift"),
    ("blade", "blade"),
    ("burn", "burn"),
    ("boom", "boom"),
    ("gravity", "gravity"),
    ("radical", "radical"),
    ("speed", "speed"),
    ("prestige", "prestige"),
    ("defyer", "defyer"),
    ("ezone", "ezone"),
    ("vcore", "vcore"),
    ("percept", "percept"),
    ("tfight", "tfight"),
    ("t fight", "tfight"),
    ("tf40", "tf40"),
    ("tf 40", "tf40"),
)

MATCH_STOP = frozenset(
    {
        "vot",
        "vợt",
        "tennis",
        "racquet",
        "racket",
        "frm",
        "unstrung",
        "strung",
        "chua",
        "cang",
        "day",
        "đay",
        "chưa",
        "căng",
        "the",
        "and",
        "for",
        "with",
        "new",
        "moi",
        "mới",
        "edition",
        "racquets",
    }
)


@dataclass
class TwCatalogItem:
    code: str
    name: str
    brand: str
    review_path: str

    @property
    def review_url(self) -> str:
        return urljoin(TW_BASE, self.review_path)


@dataclass
class TwReviewData:
    breakdown: dict[str, float] = field(default_factory=dict)
    verdict: float | None = None
    tech_us: dict[str, str] = field(default_factory=dict)
    tech_eu: dict[str, str] = field(default_factory=dict)
    lab: dict[str, dict[str, str]] = field(default_factory=dict)


def _ascii_lower(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = s.encode("ascii", "ignore").decode("ascii")
    return s.lower().strip()


def _tokens(name: str) -> set[str]:
    n = _ascii_lower(name)
    n = re.sub(r"\bv(\d+)\.0\b", r"v\1", n)
    n = re.sub(r"\bwr\d+[a-z]?\d*\b", " ", n)
    raw = re.sub(r"[^a-z0-9]+", " ", n)
    parts = {p for p in raw.split() if len(p) > 1 and p not in MATCH_STOP}
    for m in re.finditer(r"\b(\d{2,3})(l|ul|s)\b", n.replace(" ", "")):
        parts.add(f"{m.group(1)}{m.group(2)}")
    return parts


def _frame_variants(name: str) -> set[str]:
    n = _ascii_lower(name).replace("-", " ")
    found: set[str] = set()
    for m in re.finditer(r"\b(\d{2,3})(ul|l|s)\b", n.replace(" ", "")):
        found.add(f"{m.group(1)}{m.group(2)}")
    for v in FRAME_VARIANTS:
        if re.search(rf"\b{re.escape(v)}\b", n):
            found.add(v)
    return found


def _model_line(name: str) -> str | None:
    n = _ascii_lower(name).replace("-", " ")
    for needle, line_id in MODEL_LINES:
        if needle in n:
            return line_id
    return None


def _brand_key(brand: str | None) -> str | None:
    if not brand:
        return None
    b = _ascii_lower(brand)
    return BRAND_ALIASES.get(b, b)


def _extract_wilson_sku(text: str) -> str | None:
    m = re.search(r"\b(WR\d+[A-Z]?\d*)\b", text, re.I)
    return m.group(1).upper() if m else None


def _parse_table_rows(html_chunk: str) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for m in re.finditer(r"<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>", html_chunk, re.S | re.I):
        label = re.sub(r"<[^>]+>", "", m.group(1))
        value = re.sub(r"<[^>]+>", "", m.group(2))
        label = unescape(label).strip()
        value = unescape(value).strip()
        if not label or label.lower() in ("score", "grade"):
            continue
        if "final verdict" in label.lower():
            continue
        rows.append((label, value))
    return rows


def _section_after(html: str, marker: str, max_len: int = 12000) -> str:
    idx = html.find(marker)
    if idx < 0:
        return ""
    return html[idx : idx + max_len]


def parse_tw_listing(html: str) -> list[TwCatalogItem]:
    items: list[TwCatalogItem] = []
    seen: set[str] = set()
    cell_re = re.compile(
        r'class="cattable-wrap-cell gtm_impression"\s+data-code="([^"]+)"'
        r'[^>]*data-gtm_impression_name="([^"]+)"'
        r'[^>]*data-gtm_impression_brand="([^"]+)"',
        re.I | re.S,
    )
    for m in cell_re.finditer(html):
        code, name, brand = m.group(1), unescape(m.group(2)), unescape(m.group(3))
        block = html[m.start() : m.start() + 8000]
        path_m = re.search(r"(/learning_center/racquet_reviews/[^\s\"']+\.html)", block)
        if not path_m:
            continue
        path = re.sub(r"\s+", "", path_m.group(1))
        if code in seen:
            continue
        seen.add(code)
        items.append(TwCatalogItem(code=code, name=name, brand=brand, review_path=path))
    return items


def parse_tw_review(html: str) -> TwReviewData:
    out = TwReviewData()

    verdict_m = re.search(
        r'class="review-summary_verdict_score[^"]*">\s*([\d.]+)\s*<',
        html,
        re.I,
    )
    if verdict_m:
        out.verdict = float(verdict_m.group(1))

    summary_chunk = _section_after(html, 'id="breakdown_summary"')
    for label, value in _parse_table_rows(summary_chunk):
        key = _ascii_lower(label)
        dim = TW_BREAKDOWN_TO_VECTOR.get(key)
        if not dim:
            continue
        try:
            out.breakdown[dim] = float(value)
        except ValueError:
            continue

    us_chunk = _section_after(html, 'id="US"')
    eu_chunk = _section_after(html, 'id="EU"')
    for label, value in _parse_table_rows(us_chunk):
        out.tech_us[label] = value
    for label, value in _parse_table_rows(eu_chunk):
        out.tech_eu[label] = value

    lab_chunk = _section_after(html, "Tennis Warehouse University Lab Data")
    for row in re.finditer(
        r"<tr>\s*<td>\s*(Flex Rating Test|Swing Weight)\s*</td>\s*<td>\s*([^<]+)\s*</td>\s*<td>\s*([^<]+)\s*</td>",
        lab_chunk,
        re.I,
    ):
        name = row.group(1).strip()
        out.lab[name] = {"score": row.group(2).strip(), "grade": row.group(3).strip()}

    if out.verdict is None:
        for label, value in _parse_table_rows(summary_chunk):
            if "final verdict" in label.lower():
                try:
                    out.verdict = float(re.sub(r"[^\d.]", "", value))
                except ValueError:
                    pass

    return out


def _tw_score_to_vector(score: float) -> int:
    return max(0, min(100, int(round(score * 10))))


def _parse_number(s: str) -> float | None:
    m = re.search(r"([\d.]+)", s.replace(",", ""))
    return float(m.group(1)) if m else None


def _finder_specs_from_tw(review: TwReviewData) -> dict[str, Any]:
    specs: dict[str, Any] = {}
    flex = review.lab.get("Flex Rating Test", {}).get("score")
    sw = review.lab.get("Swing Weight", {}).get("score")
    if flex:
        try:
            specs["ra"] = int(float(flex))
        except ValueError:
            pass
    if sw:
        try:
            specs["swing_weight"] = int(float(sw))
        except ValueError:
            pass

    w_eu = review.tech_eu.get("Weight") or review.tech_us.get("Weight", "")
    wg = _parse_number(w_eu)
    if wg and wg > 200:
        specs["weight_g"] = int(round(wg))

    hs_us = review.tech_us.get("Head Size", "")
    hs = _parse_number(hs_us)
    if hs and hs > 50:
        specs["head_sq_in"] = hs

    pat = review.tech_us.get("String Pattern") or review.tech_eu.get("String Pattern")
    if pat:
        specs["pattern"] = pat.replace(" ", "")

    bal = _parse_number(review.tech_us.get("Balance Point", ""))
    if bal and bal > 20:
        specs["balance_in"] = bal
    length = _parse_number(review.tech_us.get("Length", ""))
    if length and 20 < length < 30:
        specs["length_in"] = length

    return specs


def _tech_specs_from_tw(review: TwReviewData) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for label in TW_TECH_SPEC_ORDER:
        us = review.tech_us.get(label, "")
        eu = review.tech_eu.get(label, "")
        if not us and not eu:
            continue
        rows.append(
            {
                "label": label,
                "value": us,
                "label_vi": TECH_SPEC_VI.get(label, label),
                "value_vi": eu or us,
            }
        )
    for lab_label in TW_LAB_ROWS:
        entry = review.lab.get(lab_label)
        if not entry:
            continue
        val = f"{entry['score']} ({entry['grade']})"
        rows.append(
            {
                "label": lab_label,
                "value": val,
                "label_vi": TECH_SPEC_VI.get(lab_label, lab_label),
                "value_vi": val,
            }
        )
    return rows


def _preserve_sku_rows(existing: list[dict[str, str]] | None) -> list[dict[str, str]]:
    if not existing:
        return []
    kept: list[dict[str, str]] = []
    for row in existing:
        lab = _ascii_lower(row.get("label") or "")
        lab_vi = _ascii_lower(row.get("label_vi") or "")
        if "sku" in lab or "mã" in lab_vi or "ma sp" in lab_vi:
            kept.append(dict(row))
    return kept


def _match_score(product: Product, tw: TwCatalogItem) -> float:
    pb = _brand_key(product.brand)
    tb = _brand_key(tw.brand)
    if pb and tb and pb != tb:
        return 0.0

    pl = _model_line(product.name)
    tl = _model_line(tw.name)
    if pl and tl and pl != tl:
        return 0.0

    pv = _frame_variants(product.name)
    tv = _frame_variants(tw.name)
    if pv and tv and not (pv & tv):
        return 0.0

    pt = _tokens(product.name)
    tt = _tokens(tw.name)
    if not pt or not tt:
        return 0.0

    inter = len(pt & tt)
    union = len(pt | tt)
    jaccard = inter / union if union else 0.0

    bonus = 0.0
    for size in ("100", "98", "95", "97", "105", "107", "110"):
        if size in pt and size in tt:
            bonus += 0.08
    for variant in ("plus", "team", "pro", "mp", "xl", "tour", "lite", "ultra"):
        if variant in pt and variant in tt:
            bonus += 0.06
    py = re.findall(r"\b20\d{2}\b", product.name)
    ty = re.findall(r"\b20\d{2}\b", tw.name)
    if py and ty and set(py) & set(ty):
        bonus += 0.12
    elif py and ty:
        bonus -= 0.05

    sku = _extract_wilson_sku(product.name) or _extract_wilson_sku(product.subtitle or "")
    if sku and sku.lower() in _ascii_lower(tw.name):
        bonus += 0.2

    for w in re.findall(r"\b(2[0-9]{2})\b", product.name):
        if w in tw.name:
            bonus += 0.12

    return min(1.0, jaccard + bonus)


def _load_overrides() -> dict[str, str]:
    if not OVERRIDES_PATH.is_file():
        return {}
    try:
        data = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(k): str(v) for k, v in data.items()}


def _match_product(
    product: Product,
    catalog: list[TwCatalogItem],
    overrides: dict[str, str],
    by_code: dict[str, TwCatalogItem],
) -> tuple[TwCatalogItem | None, float]:
    if product.slug in overrides:
        code = overrides[product.slug]
        item = by_code.get(code)
        return (item, 1.0) if item else (None, 0.0)

    best: TwCatalogItem | None = None
    best_score = 0.0
    for tw in catalog:
        s = _match_score(product, tw)
        if s > best_score:
            best_score = s
            best = tw
    return best, best_score


def _fetch(client: httpx.Client, url: str) -> str:
    r = client.get(url, timeout=60.0, follow_redirects=True)
    r.raise_for_status()
    return r.text


def run(
    *,
    tenant_slug: str = "baseline",
    dry_run: bool = True,
    min_score: float = 0.38,
    sleep_s: float = 0.45,
    limit: int | None = None,
    slug_filter: str | None = None,
) -> dict[str, Any]:
    overrides = _load_overrides()
    report: dict[str, Any] = {
        "tenant": tenant_slug,
        "dry_run": dry_run,
        "matched": [],
        "skipped_low_score": [],
        "unmatched": [],
        "errors": [],
    }

    with httpx.Client(headers={"User-Agent": USER_AGENT}) as client:
        listing_html = _fetch(client, TW_LISTING)
        catalog = parse_tw_listing(listing_html)
        by_code = {c.code: c for c in catalog}
        report["tw_catalog_count"] = len(catalog)

        db = SessionLocal()
        try:
            tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
            if tenant is None:
                raise SystemExit(f"Tenant not found: {tenant_slug}")
            rackets = db.scalar(
                select(Category).where(Category.tenant_id == tenant.id, Category.slug == "rackets")
            )
            q = select(Product).where(Product.tenant_id == tenant.id, Product.is_active.is_(True))
            if rackets:
                q = q.where(Product.category_id == rackets.id)
            if slug_filter:
                q = q.where(Product.slug == slug_filter)
            products = list(db.scalars(q.order_by(Product.slug)))
            if limit:
                products = products[:limit]
            report["product_count"] = len(products)

            review_cache: dict[str, TwReviewData] = {}
            matched_slugs: set[str] = set()

            for product in products:
                tw_item, score = _match_product(product, catalog, overrides, by_code)
                if tw_item is None or score < min_score:
                    entry = {
                        "slug": product.slug,
                        "name": product.name,
                        "brand": product.brand,
                        "score": round(score, 3),
                        "tw_name": tw_item.name if tw_item else None,
                    }
                    if tw_item and score < min_score:
                        report["skipped_low_score"].append(entry)
                    else:
                        report["unmatched"].append(entry)
                    continue

                try:
                    if tw_item.code not in review_cache:
                        html = _fetch(client, tw_item.review_url)
                        review_cache[tw_item.code] = parse_tw_review(html)
                        time.sleep(sleep_s)
                    review = review_cache[tw_item.code]
                except Exception as exc:  # noqa: BLE001
                    report["errors"].append({"slug": product.slug, "tw_code": tw_item.code, "error": str(exc)})
                    continue

                vectors: dict[str, int] = {}
                for dim, val in review.breakdown.items():
                    vectors[dim] = _tw_score_to_vector(val)
                if review.verdict is not None:
                    vectors["overall"] = _tw_score_to_vector(review.verdict)

                specs = _finder_specs_from_tw(review)
                tw_specs_rows = _tech_specs_from_tw(review)
                sku_rows = _preserve_sku_rows(product.tech_specs)
                new_tech_specs = sku_rows + tw_specs_rows

                fp = dict(product.finder_profile or {})
                fp["enabled"] = True
                fp["vectors"] = {**(fp.get("vectors") or {}), **vectors}
                fp["specs"] = {**(fp.get("specs") or {}), **specs}
                fp["tw"] = {
                    "code": tw_item.code,
                    "name": tw_item.name,
                    "review_url": tw_item.review_url,
                    "verdict": review.verdict,
                    "breakdown_0_10": review.breakdown,
                    "lab": review.lab,
                }
                tags = list(fp.get("tags") or [])
                if product.brand and product.brand not in tags:
                    tags.append(product.brand)
                fp["tags"] = tags

                matched_slugs.add(product.slug)

                if not dry_run:
                    product.finder_profile = fp
                    product.tech_specs = new_tech_specs

                report["matched"].append(
                    {
                        "slug": product.slug,
                        "name": product.name,
                        "score": round(score, 3),
                        "tw_code": tw_item.code,
                        "tw_name": tw_item.name,
                        "verdict": review.verdict,
                        "vectors": vectors,
                    }
                )

            if not dry_run:
                for product in products:
                    if product.slug in matched_slugs:
                        continue
                    fp = dict(product.finder_profile or {})
                    if not fp.get("tw"):
                        continue
                    fp["enabled"] = False
                    fp.pop("tw", None)
                    fp["vectors"] = {}
                    product.finder_profile = fp

                db.commit()
                from .quiz_racquet_pool import sync_quiz_racquet_pool

                pool_stats = sync_quiz_racquet_pool(tenant_slug=tenant_slug, dry_run=False)
                report["quiz_pool_sync"] = pool_stats
        finally:
            db.close()

    report["summary"] = {
        "products": report.get("product_count", 0),
        "matched": len(report["matched"]),
        "unmatched": len(report["unmatched"]),
        "low_score": len(report["skipped_low_score"]),
        "errors": len(report["errors"]),
    }
    return report


def main() -> None:
    p = argparse.ArgumentParser(description="Import TW racquet review profiles for baseline quiz.")
    p.add_argument("--tenant", default="baseline")
    p.add_argument("--dry-run", action="store_true", default=True)
    p.add_argument("--apply", action="store_true", help="Write finder_profile + tech_specs to DB")
    p.add_argument("--min-score", type=float, default=0.38)
    p.add_argument("--sleep", type=float, default=0.45, help="Delay between review page fetches (seconds)")
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--slug", default=None, help="Single product slug")
    p.add_argument("--report", default=None, help="Write JSON report to path")
    args = p.parse_args()
    dry_run = not args.apply

    report = run(
        tenant_slug=args.tenant,
        dry_run=dry_run,
        min_score=args.min_score,
        sleep_s=args.sleep,
        limit=args.limit,
        slug_filter=args.slug,
    )
    text = json.dumps(report, indent=2, ensure_ascii=False)
    if args.report:
        Path(args.report).write_text(text, encoding="utf-8")
    print(text)
    if report["errors"]:
        sys.exit(2)


if __name__ == "__main__":
    main()
