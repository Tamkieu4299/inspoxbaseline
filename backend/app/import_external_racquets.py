"""One-time import: tennis racquets from Thu Sports + Forheads into the baseline tenant.

Usage (from repo root, stack running):

    docker exec inspo-backend python -m app.import_external_racquets

    docker exec inspo-backend python -m app.import_external_racquets --dry-run

Options:
    --tenant SLUG       default: baseline
    --dry-run           crawl only, no DB writes
    --skip-thusports    Forheads only
    --skip-forheads     Thu Sports only
    --hongan            crawl Hồng Ân Sports tennis racquets (see --hongan-brand)
    --hongan-brand NAME default: babolat (use "all" for every racquet on category)
    --skip-hongan       skip Hồng Ân when other sources run
    --max-pages N       Thu Sports / Hồng Ân listing pages (default: all)
    --inactive          import with is_active=False (review in admin)
    --restructure-catalog   rackets category only + product.brand (Wilson/Head filters)
    --refresh-content       re-crawl and refresh copy/specs/prices (keep images)

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
HONGAN_TENNIS_LIST = "https://hongansports.com/quan-vot/vot-tennis/"

HONGAN_SKIP_URL_PARTS = ("__trashed", "/feed/", "pro-last", "syn-gut", "200m")

HONGAN_SPEC_LABEL_EN: dict[str, str] = {
    "Kích cỡ đầu vợt": "HEAD SIZE",
    "Kích thước đầu": "HEAD SIZE",
    "Chiều dài": "LENGTH",
    "Trọng lượng (chưa căng dây)": "WEIGHT (UNSTRUNG)",
    "Trọng lượng (loại không xỏ dây)": "WEIGHT (UNSTRUNG)",
    "Cân bằng (không dây)": "BALANCE (UNSTRUNG)",
    "Thăng bằng (loại không xỏ dây)": "BALANCE (UNSTRUNG)",
    "Trọng lượng đu đưa": "SWING WEIGHT",
    "Trọng lượng khi swing": "SWING WEIGHT",
    "Mẫu dây": "STRING PATTERN",
    "Stringing Pattern": "STRING PATTERN",
    "Độ cứng (RA)": "STIFFNESS (RA)",
    "Stiffness (RA)": "STIFFNESS (RA)",
    "Phần": "BEAM WIDTH",
    "Section": "BEAM WIDTH",
    "Bố cục": "COMPOSITION",
    "Thành phần": "COMPOSITION",
    "Chuỗi được đề xuất": "RECOMMENDED STRING",
    "Độ căng được khuyến nghị": "RECOMMENDED TENSION",
    "Tay cầm được khuyến nghị": "RECOMMENDED GRIP",
    "Khuyến khích cán vợt": "RECOMMENDED GRIP",
    "Khuyến khích dây đan": "RECOMMENDED STRING",
    "Khuyến khích chịu lực": "RECOMMENDED TENSION",
    "Xỏ dây / Không xỏ dây": "STRUNG / UNSTRUNG",
    "Đã căng dây / Chưa căng dây": "STRUNG / UNSTRUNG",
}

SKIP_NAME_FRAGMENTS = (
    "chọn vợt",
    "huong dan",
    "hướng dẫn",
    "chon vot",
)

RETAILER_HOSTS = ("thusports.vn", "forheads.vn", "hongansports.com")
RETAILER_LABELS = frozenset({"thusports", "forheads", "thu sports", "for heads", "hong an", "hồng ân"})

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
    features: list[dict[str, str]] = field(default_factory=list)
    badge: str | None = None
    finder_specs: dict[str, Any] = field(default_factory=dict)


_SPEC_SECTION_SPLIT = re.compile(
    r"<p[^>]*>\s*(?:<[^>]+>\s*)*Thông\s+số\s+kỹ\s+thuật",
    re.I | re.S,
)
_JUNK_SPEC_LABELS = frozenset(
    {
        "chi tiết sản phẩm",
        "nhận xét đánh giá",
        "thông số kỹ thuật",
        "thông số kỹ thuật:",
        "thông số",
        "chi tiết",
        "công nghệ nổi bật",
    }
)
_SPEC_SECTION_START_PATTERNS = (
    re.compile(r"<p[^>]*>\s*<strong>\s*Công\s+nghệ\s+nổi\s+bật", re.I | re.S),
    re.compile(
        r"<table[^>]*>\s*<thead>\s*<tr>\s*<th[^>]*>\s*<strong>\s*Thông\s+số\s*</strong>",
        re.I | re.S,
    ),
    _SPEC_SECTION_SPLIT,
    re.compile(r"Thông\s+số\s+kỹ\s+thuật", re.I),
)


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


def _table_spec_pairs(html: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for table in re.findall(r"<table[^>]*>(.*?)</table>", html or "", re.S | re.I):
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S | re.I):
            cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
            texts = [_strip_html(c).strip() for c in cells]
            texts = [t for t in texts if t]
            if len(texts) >= 2:
                pairs.append((texts[0], texts[1]))
    return pairs


def _paragraph_spec_pairs(html: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for block in re.findall(r"<p[^>]*>(.*?)</p>", html or "", re.S | re.I):
        text = _strip_html(block).strip()
        if not text or ":" not in text:
            continue
        label, _, value = text.partition(":")
        label, value = label.strip(), value.strip()
        if label and value:
            pairs.append((label, value))
    return pairs


def _list_spec_pairs(html: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for block in re.findall(r"<li[^>]*>(.*?)</li>", html or "", re.S | re.I):
        text = _strip_html(block).strip()
        if not text or len(text) < 3:
            continue
        low = text.lower()
        if low.startswith("thông số kỹ thuật"):
            continue
        if ":" in text:
            label, _, value = text.partition(":")
            label, value = label.strip(), value.strip()
            if label and value:
                pairs.append((label, value))
    return pairs


def _spec_pairs_from_html(html: str) -> list[tuple[str, str]]:
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for label, value in (
        _table_spec_pairs(html)
        + _paragraph_spec_pairs(html)
        + _list_spec_pairs(html)
    ):
        label = label.strip().rstrip(":").strip()
        value = value.strip()
        if not label or not value:
            continue
        key = label.lower()
        if key in _JUNK_SPEC_LABELS or key in seen:
            continue
        if len(label) > 80 or len(value) > 300:
            continue
        seen.add(key)
        out.append((label, value))
    return out


def _pairs_to_specs(pairs: list[tuple[str, str]]) -> list[dict[str, str]]:
    specs: list[dict[str, str]] = []
    for label, value in pairs[:32]:
        specs.append(
            {
                "label": label[:60].upper(),
                "value": value[:200],
                "label_vi": label[:60],
                "value_vi": value[:200],
            }
        )
    return specs


def _specs_from_html(html: str) -> list[dict[str, str]]:
    return _pairs_to_specs(_spec_pairs_from_html(html))


def _thusports_detail_tab_html(html: str) -> str:
    m = re.search(
        r'<div class="ppconttabpro"\s+id="iitab1">(.*?)<div class="ppconttabpro"\s+id="iitab',
        html or "",
        re.S | re.I,
    )
    return m.group(1) if m else ""


def _thusports_desc_inner_html(detail_html: str) -> str:
    m = re.search(r'<div class="desc">(.*?)</div>', detail_html or "", re.S | re.I)
    if m:
        return m.group(1)
    m = re.search(r'<div class="ppcont">(.*)', detail_html or "", re.S | re.I)
    return m.group(1) if m else detail_html


def _split_thusports_story_and_specs(desc_html: str) -> tuple[str, str]:
    if not desc_html:
        return "", ""
    m = _SPEC_SECTION_SPLIT.search(desc_html)
    if m:
        return desc_html[: m.start()], desc_html[m.start() :]
    m2 = re.search(r"Thông\s+số\s+kỹ\s+thuật", desc_html, re.I)
    if m2:
        return desc_html[: m2.start()], desc_html[m2.start() :]
    return desc_html, ""


def _spec_section_start(html: str) -> int | None:
    starts: list[int] = []
    for pat in _SPEC_SECTION_START_PATTERNS:
        m = pat.search(html)
        if m:
            starts.append(m.start())
    return min(starts) if starts else None


def _normalize_cmp_text(text: str) -> str:
    s = unicodedata.normalize("NFKD", text)
    s = s.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def _is_disclaimer_paragraph(text: str) -> bool:
    low = text.lower()
    return "vui lòng liên hệ" in low and (
        "kiểm tra" in low or "hàng trước" in low or "size" in low
    )


def _is_title_duplicate(text: str, product_name: str) -> bool:
    if not product_name or len(text) < 20:
        return False
    a, b = _normalize_cmp_text(text), _normalize_cmp_text(product_name)
    if not a or not b:
        return False
    if a == b:
        return True
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    return len(shorter) >= 30 and shorter in longer


def _product_story_description(story_html: str, product_name: str = "") -> str:
    """Short intro copy — not tech blocks, spec tables, or bullet spec lists."""
    parts: list[str] = []
    for block in re.findall(r"<p[^>]*>(.*?)</p>", story_html or "", re.S | re.I):
        text = _strip_html(block).strip()
        if not text:
            continue
        low = text.lower().strip().rstrip(":")
        if low in ("mô tả sản phẩm",):
            continue
        if _is_disclaimer_paragraph(text):
            continue
        if _is_title_duplicate(text, product_name):
            continue
        parts.append(text)
    desc = " ".join(parts) if parts else _strip_html(story_html)
    return clean_retailer_text(desc)


_CORE_SPEC_LABEL_RE = re.compile(
    r"(?:thương hiệu|brand|mã sku|sku|trọng lượng|cấu trúc dây|mật độ dây|diện tích|"
    r"điểm cân bằng|độ dài|vành vợt|tên sản phẩm|kích thước|chất liệu|độ dày khung|"
    r"chiều dài\s*\(|balance|string pattern|head size|weight|beam|"
    r"kích thước đầu|mẫu dây|độ cứng|trọng lượng đu đưa|phần|bố cục|cân bằng)",
    re.I,
)
_MEASUREMENT_VALUE_RE = re.compile(
    r"\d|(?:\d+\s*/\s*\d+)|(?:\d+\s*x\s*\d+)|(?:\d+\s*g\b)|(?:\d+\s*mm\b)|(?:\d+\s*cm)|in²|(?:\d+\s*oz\b)",
    re.I,
)


def _looks_like_measurement_spec(label: str, value: str) -> bool:
    label = label.strip()
    value = value.strip()
    if not label or not value:
        return False
    if _CORE_SPEC_LABEL_RE.search(label):
        return True
    # Long copy with embedded numbers (e.g. "690 cm² giúp mở rộng...") is a feature blurb, not a spec row.
    if len(value) > 48:
        return False
    return bool(_MEASUREMENT_VALUE_RE.search(value))


def _looks_like_feature_title(title: str) -> bool:
    t = title.strip()
    if _CORE_SPEC_LABEL_RE.search(t):
        return False
    if len(t) < 6:
        return False
    letters = re.sub(r"[^A-Za-z]", "", t)
    if len(letters) >= 4:
        if t == t.upper() and re.search(r"[A-Z]{4,}", t):
            return True
        upper = sum(1 for c in letters if c.isupper())
        if upper / len(letters) >= 0.75:
            return True
    # Vietnamese marketing headings (mixed case, no leading digits)
    if re.search(r"[\u00c0-\u1ef9]", t) and not re.match(r"^\d", t):
        return True
    return False


def _feature_icon(title: str) -> str:
    low = title.lower()
    if "power" in low:
        return "bolt"
    if "control" in low:
        return "tune"
    if "design" in low:
        return "palette"
    if "shock" in low or "stop" in low:
        return "shield"
    if "length" in low or "oversized" in low:
        return "straighten"
    return "auto_awesome"


def _feature_row(title: str, description: str) -> dict[str, str]:
    title_clean = title.strip()[:80]
    desc = description.strip()[:500]
    display_en = title_clean.upper() if title_clean.isascii() else title_clean
    return {
        "icon": _feature_icon(title_clean),
        "title": display_en,
        "description": desc,
        "title_vi": title_clean,
        "description_vi": desc,
    }


def _colon_bullet_pairs(html: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for block in re.findall(r"<li[^>]*>(.*?)</li>", html or "", re.S | re.I):
        text = _strip_html(block).strip()
        if ":" not in text:
            continue
        title, _, desc = text.partition(":")
        title, desc = title.strip(), desc.strip()
        if title and desc:
            pairs.append((title, desc))
    return pairs


def _features_from_bullet_html(html: str, *, strict: bool = False) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for title, desc in _colon_bullet_pairs(html):
        if _looks_like_measurement_spec(title, desc):
            continue
        if strict and not _looks_like_feature_title(title):
            continue
        if len(title) < 4 or len(desc) < 8:
            continue
        key = title.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(_feature_row(title, desc))
    return out[:12]


def _measurement_specs_from_html(html: str) -> list[dict[str, str]]:
    pairs: list[tuple[str, str]] = []
    for title, desc in _colon_bullet_pairs(html):
        if _looks_like_measurement_spec(title, desc):
            pairs.append((title, desc))
    pairs.extend(_table_spec_pairs(html))
    # de-dupe by label
    seen: set[str] = set()
    unique: list[tuple[str, str]] = []
    for label, value in pairs:
        key = label.casefold()
        if key in seen:
            continue
        seen.add(key)
        unique.append((label, value))
    return _pairs_to_specs(unique)


def _split_specs_and_features(specs: list[dict[str, str]]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    kept: list[dict[str, str]] = []
    features: list[dict[str, str]] = []
    seen_feat: set[str] = set()
    for row in specs:
        label = (row.get("label_vi") or row.get("label") or "").strip()
        value = (row.get("value_vi") or row.get("value") or "").strip()
        if _looks_like_measurement_spec(label, value):
            kept.append(row)
            continue
        if _looks_like_feature_title(label):
            key = label.casefold()
            if key not in seen_feat:
                seen_feat.add(key)
                features.append(_feature_row(label, value))
        else:
            kept.append(row)
    return kept, features


def _intro_description(intro_html: str, product_name: str) -> str:
    parts: list[str] = []
    for block in re.findall(r"<p[^>]*>(.*?)</p>", intro_html or "", re.S | re.I):
        text = _strip_html(block).strip()
        if not text:
            continue
        if re.search(r"thông\s+số\s+kỹ\s+thuật", text, re.I):
            continue
        if _is_disclaimer_paragraph(text) or _is_title_duplicate(text, product_name):
            continue
        parts.append(text)
    if parts:
        return clean_retailer_text(" ".join(parts[:2]))
    return clean_retailer_text(_strip_html(intro_html))


def _forheads_tagline(story_html: str, product_name: str) -> str:
    for block in re.findall(r"<p[^>]*>(.*?)</p>", story_html or "", re.S | re.I):
        text = _strip_html(block).strip()
        if not text:
            continue
        if re.fullmatch(r"mô tả\s*:?", text, flags=re.I):
            continue
        if _is_disclaimer_paragraph(text) or _is_title_duplicate(text, product_name):
            continue
        return clean_retailer_text(text)
    return ""


def _parse_forheads_product_body(
    html: str, product_name: str = ""
) -> tuple[str, list[dict[str, str]], list[dict[str, str]]]:
    body = html or ""
    mo_ta = re.search(r"MÔ\s+TẢ\s*:", body, re.I)
    if mo_ta:
        spec_html = body[: mo_ta.start()]
        story_html = body[mo_ta.start() :]
        description = _forheads_tagline(story_html, product_name)
        features = _features_from_bullet_html(story_html, strict=True)
        specs = _measurement_specs_from_html(spec_html)
        if not specs:
            specs_raw = _specs_from_html(spec_html)
            specs, extra = _split_specs_and_features(specs_raw)
            features.extend(extra)
        return description, specs, features

    spec_m = re.search(r"Thông\s+số\s+kỹ\s+thuật", body, re.I)
    hi_m = re.search(r"Điểm\s+Nổi\s+Bật", body, re.I)
    tech_m = re.search(
        r"CÔNG\s+NGHỆ\s+NỔI\s+BẬT|KEY\s+TECHNOLOGIES|Công\s+nghệ\s+nổi\s+bật",
        body,
        re.I,
    )
    if spec_m:
        intro = body[: spec_m.start()]
        spec_end = len(body)
        for m in (hi_m, tech_m):
            if m and spec_m.start() < m.start() < spec_end:
                spec_end = m.start()
        spec_html = body[spec_m.start() : spec_end]
        description = _intro_description(intro, product_name)
        specs = _measurement_specs_from_html(spec_html)
        features: list[dict[str, str]] = []
        if hi_m:
            hi_end = tech_m.start() if tech_m and tech_m.start() > hi_m.start() else len(body)
            features.extend(_features_from_bullet_html(body[hi_m.start() : hi_end], strict=False))
        if tech_m:
            features.extend(_features_from_bullet_html(body[tech_m.start() :], strict=False))
        if not specs:
            specs_raw = _specs_from_html(spec_html)
            specs, extra = _split_specs_and_features(specs_raw)
            for row in extra:
                key = (row.get("title_vi") or row.get("title") or "").casefold()
                if key and key not in {f.get("title_vi", "").casefold() for f in features}:
                    features.append(row)
        return description, specs, features

    description, specs = _parse_rich_product_body(html, product_name)
    specs, features = _split_specs_and_features(specs)
    return description, specs, features


def _parse_rich_product_body(html: str, product_name: str = "") -> tuple[str, list[dict[str, str]]]:
    """Split retailer HTML into intro description + structured tech_specs."""
    if not html:
        return "", []
    cut = _spec_section_start(html)
    if cut is not None:
        story_html, spec_html = html[:cut], html[cut:]
    else:
        story_html, spec_html = _split_thusports_story_and_specs(html)
    description = _product_story_description(story_html, product_name)
    spec_source = spec_html or html
    specs = _specs_from_html(spec_source)
    if not specs and spec_html:
        specs = _specs_from_html(html)
    return description, specs


def _merge_core_specs(
    specs: list[dict[str, str]],
    *,
    brand: str | None,
    sku: str | None,
) -> list[dict[str, str]]:
    """Ensure brand/SKU appear in tech_specs when imports provide them."""
    keys = {(s.get("label_vi") or s.get("label") or "").strip().lower() for s in specs}
    out = list(specs)
    if brand and "thương hiệu" not in keys and "brand" not in keys:
        b = brand.replace("-", " ").title()
        out.insert(
            0,
            {
                "label": "BRAND",
                "value": b[:200],
                "label_vi": "Thương hiệu",
                "value_vi": b[:200],
            },
        )
    if sku and "mã sku" not in keys and "sku" not in keys:
        out.append(
            {
                "label": "SKU",
                "value": sku[:200],
                "label_vi": "Mã SKU",
                "value_vi": sku[:200],
            }
        )
    return out[:32]


def _finalize_product_detail(
    product_name: str,
    description: str,
    specs: list[dict[str, str]],
    *,
    brand: str | None = None,
    sku: str | None = None,
    features: list[dict[str, str]] | None = None,
) -> tuple[str, list[dict[str, str]], list[dict[str, str]]]:
    desc = clean_retailer_text(description or "")
    merged = _merge_core_specs(specs or [], brand=brand, sku=sku)
    specs_only, from_specs = _split_specs_and_features(merged)
    out_features: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in (features or []) + from_specs:
        key = (row.get("title") or "").upper()
        if not key or key in seen:
            continue
        seen.add(key)
        out_features.append(row)
    return desc, specs_only, out_features[:12]


def _parse_thusports_product_body(html: str, product_name: str = "") -> tuple[str, list[dict[str, str]]]:
    detail = _thusports_detail_tab_html(html)
    inner = _thusports_desc_inner_html(detail)
    if not inner:
        return "", []
    return _parse_rich_product_body(inner, product_name)


def _infer_brand(name: str, vendor: str | None = None) -> str:
    blob = f"{name} {vendor or ''}".lower()
    for b in ("wilson", "head", "babolat", "yonex", "prince", "dunlop", "technifibre", "prokennex"):
        if b in blob:
            return b
    return "other"


def _finder_from_specs(specs: list[dict[str, str]]) -> dict[str, Any]:
    blob = " ".join(f"{s.get('label_vi','')} {s.get('value_vi','')}" for s in specs).lower()
    out: dict[str, Any] = {}
    for row in specs:
        lab = (row.get("label_vi") or row.get("label") or "").lower()
        val = (row.get("value_vi") or row.get("value") or "").strip()
        if "đu đưa" in lab or "swing weight" in lab:
            m = re.search(r"(\d{2,3})", val)
            if m:
                sw = int(m.group(1))
                if 250 < sw < 400:
                    out["swing_weight"] = sw
        if "độ cứng" in lab or "(ra)" in lab:
            m = re.search(r"(\d{2,3})", val)
            if m:
                ra = int(m.group(1))
                if 40 < ra < 85:
                    out["ra"] = ra
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


def _normalize_hongan_product_url(raw: str) -> str | None:
    u = (raw or "").split("&")[0].split("#")[0].strip()
    if not u.startswith("https://hongansports.com/san-pham/"):
        return None
    low = u.lower()
    if any(part in low for part in HONGAN_SKIP_URL_PARTS):
        return None
    if not u.endswith("/"):
        u += "/"
    return u


def _hongan_normalize_spec_value(value: str) -> str:
    value = unescape(value.strip())
    value = value.replace("×", "x").replace("&#215;", "x")
    value = re.sub(r"(\d+)\s*/\s*(\d+)", r"\1x\2", value)
    return value


def _parse_hongan_tech_grid(html: str) -> list[tuple[str, str]]:
    idx = html.find("m-product-detail__tech-characteristics")
    if idx < 0:
        return []
    chunk = html[idx : idx + 25000]
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    body_re = re.compile(r"m-product-detail__tech-characteristics-body(.*?)</div>\s*</div>", re.S | re.I)
    for body in body_re.finditer(chunk):
        fragment = body.group(1)
        lab_m = re.search(
            r"m-product-detail__tech-characteristics-label(.*?)m-product-detail__tech-characteristics-value",
            fragment,
            re.S | re.I,
        )
        val_m = re.search(r"m-product-detail__tech-characteristics-value(.*)", fragment, re.S | re.I)
        if not lab_m or not val_m:
            continue
        label = _strip_html(lab_m.group(1)).strip().rstrip(":").strip()
        value = _hongan_normalize_spec_value(_strip_html(val_m.group(1)))
        if not label or not value:
            continue
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)
        pairs.append((label, value))
    return pairs


def _parse_hongan_wc_attributes(html: str) -> list[tuple[str, str]]:
    table_m = re.search(
        r'woocommerce-product-attributes shop_attributes(.*?)</table>',
        html,
        re.S | re.I,
    )
    if not table_m:
        return []
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    for row in re.finditer(r"<tr[^>]*>(.*?)</tr>", table_m.group(1), re.S | re.I):
        lab_m = re.search(r"woocommerce-product-attributes-item__label[^>]*>(.*?)</th>", row.group(1), re.S | re.I)
        val_m = re.search(r"woocommerce-product-attributes-item__value[^>]*>(.*?)</td>", row.group(1), re.S | re.I)
        if not lab_m or not val_m:
            continue
        label = _strip_html(lab_m.group(1)).strip().rstrip(":").strip()
        value = _hongan_normalize_spec_value(_strip_html(val_m.group(1)))
        if not label or not value:
            continue
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)
        pairs.append((label, value))
    return pairs


def _parse_hongan_technical_specs(html: str) -> list[tuple[str, str]]:
    grid = _parse_hongan_tech_grid(html)
    if grid:
        return grid
    return _parse_hongan_wc_attributes(html)


def _hongan_specs_rows(pairs: list[tuple[str, str]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for label, value in pairs[:24]:
        en = HONGAN_SPEC_LABEL_EN.get(label, label[:60].upper())
        rows.append(
            {
                "label": en[:60],
                "value": value[:200],
                "label_vi": label[:60],
                "value_vi": value[:200],
            }
        )
    return rows


def _hongan_description(html: str, product_name: str) -> str:
    desc_m = re.search(r'id="collapsible-description-1"(.*?)</div>\s*</div>\s*</div>', html, re.S | re.I)
    if desc_m:
        return _product_story_description(desc_m.group(1), product_name)
    idx = html.find("m-product-detail__tech-characteristics")
    chunk = html[:idx] if idx > 0 else html
    start = chunk.rfind('class="layout layout--with-padding"')
    if start > 0:
        chunk = chunk[start:]
    return _product_story_description(chunk, product_name)


def _hongan_price_vnd(html: str) -> float:
    m = re.search(
        r'class="woocommerce-Price-amount amount"[^>]*>\s*<bdi>([\d.,]+)',
        html,
        re.I,
    )
    if m:
        return _parse_vnd_price(m.group(1))
    m = re.search(r'"display_price"\s*:\s*(\d+(?:\.\d+)?)', html)
    return float(m.group(1)) if m else 0.0


def _hongan_sku(html: str) -> str | None:
    for m in re.finditer(r'"sku"\s*:\s*"([^"]+)"', html):
        sku = m.group(1).strip()
        if sku and sku.upper() not in ("N/A", "NA"):
            return sku
    m = re.search(r'class="sku">([^<]+)<', html, re.I)
    if m:
        sku = m.group(1).strip()
        if sku and sku.upper() not in ("N/A", "NA"):
            return sku
    return None


def _hongan_gallery_urls(html: str) -> list[str]:
    urls: list[str] = []
    for key in ("data-large_image", "data-src", "src"):
        for u in re.findall(rf'{key}="(https://hongansports\.com/wp-content/uploads/[^"]+)"', html):
            if "-300x300" in u or "-100x100" in u or "-50x50" in u:
                continue
            urls.append(u)
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out[:8]


def _hongan_is_babolat(name: str, sku: str | None, html: str) -> bool:
    if sku and sku.upper().startswith("BAB"):
        return True
    low = name.lower()
    tokens = (
        "pure aero",
        "pure drive",
        "pure strike",
        "evo aero",
        "evo drive",
        "evo strike",
        "boost aero",
        "boost drive",
        "boost strike",
        "pulsion",
        "ballfighter",
        "b-fly",
        "aero damp",
        "carlitos",
        "drive junior",
        "aero junior",
    )
    if any(t in low for t in tokens):
        return True
    return "babolat" in html.lower()[:120000]


def crawl_hongan_tennis_urls(client: httpx.Client, max_pages: int | None) -> list[str]:
    urls: set[str] = set()
    page = 1
    while True:
        list_url = HONGAN_TENNIS_LIST if page == 1 else f"{HONGAN_TENNIS_LIST}page/{page}/"
        html = _fetch(client, list_url)
        for raw in re.findall(r'href="(https://hongansports\.com/san-pham/[^"]+)"', html):
            norm = _normalize_hongan_product_url(raw)
            if norm:
                urls.add(norm)
        has_next = 'rel="next"' in html or f"/page/{page + 1}/" in html
        if not has_next:
            break
        page += 1
        if max_pages is not None and page > max_pages:
            break
        time.sleep(0.25)
    return sorted(urls)


def enrich_hongan_product(
    client: httpx.Client,
    product_url: str,
    *,
    brand_filter: str = "babolat",
) -> ImportedRacquet | None:
    html = _fetch(client, product_url)
    title_m = re.search(r'class="page-title--title">([^<]+)<', html) or re.search(
        r'class="product_title">([^<]+)<', html
    )
    title = unescape(title_m.group(1)).strip() if title_m else ""
    if not title:
        return None
    pairs = _parse_hongan_technical_specs(html)
    if not pairs:
        return None
    sku = _hongan_sku(html)
    if brand_filter == "babolat" and not _hongan_is_babolat(title, sku, html):
        return None
    brand = _infer_brand(title, "Babolat" if brand_filter == "babolat" else None)
    if brand_filter not in ("all", "babolat") and brand != brand_filter:
        return None
    if brand_filter == "babolat":
        brand = "babolat"
    description = _hongan_description(html, title)
    specs = _hongan_specs_rows(pairs)
    description, specs, features = _finalize_product_detail(
        title, description, specs, brand=_normalize_brand(brand), sku=sku
    )
    price = _hongan_price_vnd(html)
    images = _hongan_gallery_urls(html)
    path = urlparse(product_url).path.strip("/").replace("san-pham/", "")
    slug = _slugify(path, prefix="ha")
    display = title if re.search(r"vợt", title, re.I) else f"Vợt Tennis {title}"
    return ImportedRacquet(
        source="hongan",
        source_url=product_url,
        slug=slug,
        name=display,
        price_vnd=price,
        brand=brand,
        sku=sku,
        description_html=description,
        image_urls=images,
        tech_specs=specs,
        features=features,
        badge="NEW" if re.search(r"sản phẩm mới|product-new", html[:10000], re.I) else None,
        finder_specs=_finder_from_specs(specs),
    )


def crawl_hongan(
    client: httpx.Client,
    *,
    max_pages: int | None,
    brand_filter: str = "babolat",
) -> list[ImportedRacquet]:
    urls = crawl_hongan_tennis_urls(client, max_pages)
    out: list[ImportedRacquet] = []
    for i, url in enumerate(urls, 1):
        try:
            item = enrich_hongan_product(client, url, brand_filter=brand_filter)
        except Exception as exc:
            print(f"  ! [{i}] {url}: {exc}")
            continue
        if item:
            out.append(item)
        time.sleep(0.35)
        if i % 10 == 0:
            print(f"  … Hồng Ân {i}/{len(urls)} ({len(out)} matched)")
    return out


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

    description, specs = _parse_thusports_product_body(html, name)
    description, specs, features = _finalize_product_detail(
        name, description, specs, brand=_normalize_brand(brand), sku=sku
    )
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
        description_html=description,
        image_urls=deduped[:8],
        tech_specs=specs,
        features=features,
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
            description_body, specs, features = _parse_forheads_product_body(body, title)
            description_body, specs, features = _finalize_product_detail(
                title,
                description_body,
                specs,
                brand=_normalize_brand(brand),
                sku=sku,
                features=features,
            )
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
                    description_html=description_body,
                    image_urls=images[:8],
                    tech_specs=specs,
                    features=features,
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
    replace_images: bool = True,
) -> str:
    if dry_run:
        return "dry-run"
    rackets = _rackets_category(db, tenant_id)
    product = db.scalar(select(Product).where(Product.tenant_id == tenant_id, Product.slug == item.slug))
    product_brand = _normalize_brand(item.brand)
    desc, specs, features = _finalize_product_detail(
        item.name,
        item.description_html,
        item.tech_specs,
        brand=product_brand,
        sku=item.sku,
        features=item.features,
    )
    subtitle = item.brand.upper()
    if item.sku:
        subtitle = f"{subtitle} · {item.sku}"

    finder = {
        "enabled": False,
        "vectors": {},
        "specs": _finder_from_specs(specs) or item.finder_specs,
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
            description=desc,
            description_vi=desc,
            price=item.price_vnd,
            category_id=rackets.id,
            brand=product_brand,
            collection_id=collection_id,
            badge=item.badge,
            gallery_layout="slideshow",
            colors=[],
            sizes=["ONE SIZE"],
            tech_specs=specs,
            features=features,
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
        product.description = desc
        product.description_vi = desc
        product.price = item.price_vnd
        product.category_id = rackets.id
        product.brand = product_brand
        product.collection_id = collection_id
        product.badge = item.badge
        product.tech_specs = specs
        product.features = features
        product.finder_profile = finder
        product.is_active = active

    product.categories = [rackets]
    if replace_images:
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
    skip_hongan: bool = False,
    hongan: bool = False,
    hongan_brand: str = "babolat",
    max_pages: int | None = None,
    active: bool = True,
    replace_images: bool = True,
) -> None:
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"}
    items: list[ImportedRacquet] = []

    with httpx.Client(headers=headers, follow_redirects=True) as client:
        if hongan and not skip_hongan:
            print(f"Crawling Hồng Ân tennis ({hongan_brand})…")
            ha = crawl_hongan(client, max_pages=max_pages, brand_filter=hongan_brand)
            print(f"  {len(ha)} racquets with Đặc tính kỹ thuật")
            items.extend(ha)

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
    p.add_argument("--hongan", action="store_true", help="import from hongansports.com/quan-vot/vot-tennis/")
    p.add_argument(
        "--hongan-brand",
        default="babolat",
        help="brand filter for Hồng Ân crawl (babolat | all | wilson | head | …)",
    )
    p.add_argument("--skip-hongan", action="store_true")
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
    p.add_argument(
        "--refresh-content",
        action="store_true",
        help="re-crawl listings and update descriptions/specs/prices (keep existing images)",
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
        skip_hongan=args.skip_hongan,
        hongan=args.hongan,
        hongan_brand=args.hongan_brand,
        max_pages=args.max_pages,
        active=not args.inactive,
        replace_images=not args.refresh_content,
    )


if __name__ == "__main__":
    main(sys.argv[1:])
