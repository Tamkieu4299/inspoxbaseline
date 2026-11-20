"""Fetch Yonex racquet PDP HTML (Magento) → structured import payload.

    python -c "from app.import_yonex_product import fetch_yonex_product; import json; print(json.dumps(fetch_yonex_product('https://www.yonex.com/ezap'), indent=2))"
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from urllib.parse import unquote
from urllib.request import Request, urlopen

USER_AGENT = "Mozilla/5.0 (compatible; BaselineClubCatalog/1.0)"
_IMAGE_FULL_RE = re.compile(r'"full":"(https:\\/\\/[^"]+)"')
_SPECS_ROW_RE = re.compile(
    r"<tr>\s*<th[^>]*>([^<]+)</th>\s*<td[^>]*>([^<]+)</td>\s*</tr>",
    re.IGNORECASE | re.DOTALL,
)


@dataclass
class YonexProductDraft:
    source_url: str
    item_code: str
    name: str
    tagline: str
    specs: list[dict[str, str]]
    image_urls: list[str] = field(default_factory=list)


class _H1Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._in_h1 = False
        self.title_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() == "h1":
            self._in_h1 = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "h1":
            self._in_h1 = False

    def handle_data(self, data: str) -> None:
        if self._in_h1:
            chunk = data.strip()
            if chunk:
                self.title_parts.append(chunk)


def _fetch_html(url: str) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _gallery_urls(raw_html: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for match in _IMAGE_FULL_RE.finditer(raw_html):
        u = html.unescape(unquote(match.group(1).replace("\\/", "/")))
        stem = u.split("?")[0].rsplit("/", 1)[-1]
        if stem in seen:
            continue
        # Product angles first; skip duplicate "_1" copies when base exists.
        base = stem.replace("_1.jpg", ".jpg")
        if stem.endswith("_1.jpg") and base in seen:
            continue
        if base in seen and not stem.endswith("_1.jpg"):
            # Prefer non-_1 variant when both exist.
            pass
        seen.add(stem)
        if not stem.endswith("_1.jpg"):
            seen.add(base)
        out.append(u.split("?")[0])
    return out


def _spec_table(raw_html: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for label, value in _SPECS_ROW_RE.findall(raw_html):
        label = re.sub(r"\s+", " ", html.unescape(label)).strip()
        value = re.sub(r"\s+", " ", html.unescape(value)).strip()
        if label and value:
            rows.append({"label": label, "value": value})
    return rows


def _tagline(raw_html: str) -> str:
    m = re.search(
        r'product-item-name[^>]*>\s*[^<]*</[^>]+>\s*<[^>]+>([^<]+)</',
        raw_html,
        re.IGNORECASE | re.DOTALL,
    )
    if m:
        return html.unescape(m.group(1)).strip()
    m = re.search(
        r'<meta\s+name="description"\s+content="([^"]+)"',
        raw_html,
        re.IGNORECASE,
    )
    if m:
        return html.unescape(m.group(1)).strip()
    return (
        "For aspiring juniors and recreational players looking for electrifying "
        "blasts of power and ultimate comfort."
    )


def fetch_yonex_product(url: str) -> YonexProductDraft:
    raw = _fetch_html(url)
    parser = _H1Parser()
    parser.feed(raw)
    title = " ".join(parser.title_parts) or "YONEX Racquet"
    if "α" in title or "ezone" in title.lower():
        display = "YONEX EZONE α 100"
    else:
        display = f"YONEX {title.upper()}"

    specs = _spec_table(raw)
    item_code = next((r["value"] for r in specs if r["label"].lower() == "item code"), "YONEX")
    weight = next((r["value"] for r in specs if r["label"].lower() == "weight"), "")

    images = _gallery_urls(raw)
    # Keep PDP angles (839-*) before lifestyle/tech (786-*).
    images.sort(key=lambda u: (0 if "839-" in u else 1, u))

    return YonexProductDraft(
        source_url=url,
        item_code=item_code,
        name=display if not weight else f"{display} ({weight.split('/')[0].strip()})",
        tagline=_tagline(raw),
        specs=specs,
        image_urls=images[:12],
    )


def tech_specs_for_store(specs: list[dict[str, str]]) -> list[dict[str, str]]:
    """Map Yonex rows → PDP tech_specs (EN + VI labels where obvious)."""
    vi_map = {
        "Head Size": ("KÍCH THƯỚC MẶT VỢT", None),
        "Weight": ("TRỌNG LƯỢNG", None),
        "Grip Size": ("CỠ CẦM VỢT", None),
        "Length": ("CHIỀU DÀI", None),
        "Balance Point": ("ĐIỂM CÂN BẰNG", None),
        "Material": ("CHẤT LIỆU", None),
        "Stringing Pattern": ("MẪU ĐAN DÂY", None),
        "Item Code": ("MÃ SẢN PHẨM", None),
    }
    out: list[dict[str, str]] = []
    for row in specs:
        label = row["label"]
        value = row["value"]
        entry = {"label": label.upper(), "value": value}
        if label in vi_map:
            entry["label_vi"] = vi_map[label][0]
            entry["value_vi"] = value
        out.append(entry)
    return out