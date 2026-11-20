#!/usr/bin/env python3
"""Crawl yonex.com/ezap and publish Yonex EZONE α to Baseline (admin API)."""

from __future__ import annotations

import json
import mimetypes
import sys
import urllib.error
import urllib.request
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO / "backend"))

from app.import_yonex_product import fetch_yonex_product, tech_specs_for_store  # noqa: E402

API = "http://14.225.212.3:8000"
TENANT = "baseline"
LOGIN_USER = "superadmin"
LOGIN_PASS = "admin123"
YONEX_URL = "https://www.yonex.com/ezap"
PRICE = 3_700_000
PRODUCT_SLUG = "yonex-ezone-alpha-100-275g"


def _request(method: str, path: str, token: str, data: dict | None = None) -> object:
    headers = {"Authorization": f"Bearer {token}", "X-Tenant": TENANT}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{API}{path}", data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def _login() -> str:
    payload = json.dumps({"username": LOGIN_USER, "password": LOGIN_PASS}).encode()
    req = urllib.request.Request(
        f"{API}/api/admin/auth/login",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())["access_token"]


def _download(url: str) -> tuple[bytes, str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    name = url.rsplit("/", 1)[-1]
    ctype = mimetypes.guess_type(name)[0] or "image/jpeg"
    return data, name, ctype


def _multipart_upload(token: str, filename: str, content: bytes, ctype: str) -> dict:
    boundary = "----InspoYonexBoundary7MA4YWxk"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {ctype}\r\n\r\n"
    ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{API}/api/admin/media/upload",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant": TENANT,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode())


def _ensure_collection(token: str) -> int:
    cols = _request("GET", "/api/admin/collections", token)
    for c in cols:
        if c["slug"] == "yonex-rackets":
            return int(c["id"])
    created = _request(
        "POST",
        "/api/admin/collections",
        token,
        {
            "slug": "yonex-rackets",
            "name": "Yonex Rackets",
            "name_vi": "Vợt Yonex",
            "tagline": "EZONE, VCORE, and Japanese engineering.",
            "tagline_vi": "EZONE, VCORE và công nghệ Nhật Bản.",
            "display_order": 5,
            "is_featured": True,
            "is_active": True,
        },
    )
    return int(created["id"])


def main() -> int:
    draft = fetch_yonex_product(YONEX_URL)
    print(f"Crawled {draft.name} ({draft.item_code}), {len(draft.image_urls)} images")

    token = _login()
    rackets_cat = next(c for c in _request("GET", "/api/admin/categories", token) if c["slug"] == "rackets")
    yonex_col = _ensure_collection(token)

    images = []
    for pos, url in enumerate(draft.image_urls):
        data, name, ctype = _download(url)
        media = _multipart_upload(token, f"yonex-ezap-{name}", data, ctype)
        images.append(
            {"media_id": media["id"], "url": media["url"], "alt": draft.name, "position": pos, "enabled": True}
        )
        print(f"  image {pos + 1}: {name}")

    desc_en = draft.tagline
    desc_vi = (
        "Dành cho junior đang lên và người chơi phong trào cần sức mạnh bùng nổ "
        "và cảm giác êm ái tối đa."
    )
    subtitle = f"YONEX · {draft.item_code}"

    payload = {
        "slug": PRODUCT_SLUG,
        "name": draft.name.upper(),
        "name_vi": draft.name.upper(),
        "subtitle": subtitle,
        "subtitle_vi": subtitle,
        "description": desc_en,
        "description_vi": desc_vi,
        "price": PRICE,
        "brand": "yonex",
        "category_id": rackets_cat["id"],
        "category_ids": [rackets_cat["id"]],
        "collection_id": yonex_col,
        "badge": "NEW",
        "gallery_layout": "slideshow",
        "colors": [{"name": "ESPRESSO BROWN / BLAST BLUE", "hex": "#5c4033"}],
        "sizes": [
            {"name": "GRIP 1", "available": True},
            {"name": "GRIP 2", "available": True},
        ],
        "tech_specs": tech_specs_for_store(draft.specs),
        "features": [
            {
                "icon": "sports_tennis",
                "title": "EZONE α POWER",
                "description": draft.tagline,
                "title_vi": "SỨC MẠNH EZONE α",
                "description_vi": desc_vi,
            },
            {
                "icon": "link",
                "title": "OFFICIAL SPECS",
                "description": f"Source: {YONEX_URL}",
                "title_vi": "THÔNG SỐ CHÍNH HÃNG",
                "description_vi": f"Nguồn: {YONEX_URL}",
            },
        ],
        "is_active": True,
        "is_featured": True,
        "is_bestseller": False,
        "images": images,
    }

    products = _request("GET", "/api/admin/products", token)
    existing = next((p for p in products if p["slug"] == PRODUCT_SLUG), None)
    if existing:
        product = _request("PUT", f"/api/admin/products/{existing['id']}", token, {**existing, **payload})
    else:
        product = _request("POST", "/api/admin/products", token, payload)
    print(f"Product id={product['id']} slug={product['slug']} price={product['price']}")
    print("Collection: /collections/yonex-rackets")
    print("Brand filter: /products?category=rackets&brand=yonex")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.HTTPError as e:
        print(e.read().decode(), file=sys.stderr)
        raise SystemExit(1)