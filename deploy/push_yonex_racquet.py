#!/usr/bin/env python3
"""Crawl a yonex.com PDP and publish to Baseline (admin API)."""

from __future__ import annotations

import argparse
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
    ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
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


def _colors_from_specs(specs: list[dict[str, str]]) -> list[dict[str, str]]:
    for row in specs:
        if row["label"].lower() == "color(s)":
            return [{"name": row["value"].upper(), "hex": "#1b2838"}]
    return [{"name": "AS SHOWN", "hex": "#4a4a4a"}]


def _vi_blurb(en: str, line: str) -> str:
    if "percept" in line.lower():
        return (
            "Percept 100L tối ưu cho di chuyển, cảm giác êm ái và thi đấu nhiều set "
            "liên tục."
        )
    if "ezone" in line.lower():
        return (
            "Dành cho junior đang lên và người chơi phong trào cần sức mạnh bùng nổ "
            "và cảm giác êm ái tối đa."
        )
    return en


def publish_yonex(
    *,
    url: str,
    slug: str,
    price: int,
    grips: list[int],
    image_prefix: str,
) -> dict:
    draft = fetch_yonex_product(url)
    print(f"Crawled {draft.name} ({draft.item_code}), {len(draft.image_urls)} images")

    token = _login()
    rackets_cat = next(c for c in _request("GET", "/api/admin/categories", token) if c["slug"] == "rackets")
    yonex_col = _ensure_collection(token)

    images = []
    for pos, img_url in enumerate(draft.image_urls):
        data, name, ctype = _download(img_url)
        media = _multipart_upload(token, f"{image_prefix}-{name}", data, ctype)
        images.append(
            {"media_id": media["id"], "url": media["url"], "alt": draft.name, "position": pos, "enabled": True}
        )
        print(f"  image {pos + 1}: {name}")

    desc_vi = _vi_blurb(draft.tagline, draft.name)
    subtitle = f"YONEX · {draft.item_code}"
    line_title = draft.name.split("(")[0].strip().split()[-1] if draft.name else "YONEX"

    payload = {
        "slug": slug,
        "name": draft.name.upper(),
        "name_vi": draft.name.upper(),
        "subtitle": subtitle,
        "subtitle_vi": subtitle,
        "description": draft.tagline,
        "description_vi": desc_vi,
        "price": float(price),
        "brand": "yonex",
        "category_id": rackets_cat["id"],
        "category_ids": [rackets_cat["id"]],
        "collection_id": yonex_col,
        "badge": "NEW",
        "gallery_layout": "slideshow",
        "colors": _colors_from_specs(draft.specs),
        "sizes": [{"name": f"GRIP {g}", "available": True} for g in grips],
        "tech_specs": tech_specs_for_store(draft.specs),
        "features": [
            {
                "icon": "sports_tennis",
                "title": f"YONEX {line_title}",
                "description": draft.tagline,
                "title_vi": f"YONEX {line_title}",
                "description_vi": desc_vi,
            },
            {
                "icon": "link",
                "title": "OFFICIAL SPECS",
                "description": f"Source: {url}",
                "title_vi": "THÔNG SỐ CHÍNH HÃNG",
                "description_vi": f"Nguồn: {url}",
            },
        ],
        "is_active": True,
        "is_featured": True,
        "is_bestseller": False,
        "images": images,
    }

    products = _request("GET", "/api/admin/products", token)
    existing = next((p for p in products if p["slug"] == slug), None)
    if existing:
        return _request("PUT", f"/api/admin/products/{existing['id']}", token, {**existing, **payload})
    return _request("POST", "/api/admin/products", token, payload)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Publish a Yonex racquet from yonex.com to Baseline")
    p.add_argument("--url", required=True)
    p.add_argument("--slug", required=True)
    p.add_argument("--price", type=int, required=True)
    p.add_argument("--grips", default="2", help="Comma-separated grip numbers, e.g. 1,2 or 2")
    p.add_argument("--image-prefix", default="yonex")
    args = p.parse_args(argv)
    grips = [int(x.strip()) for x in args.grips.split(",") if x.strip()]
    product = publish_yonex(
        url=args.url,
        slug=args.slug,
        price=args.price,
        grips=grips,
        image_prefix=args.image_prefix,
    )
    print(f"Product id={product['id']} slug={product['slug']} price={product['price']}")
    print("Collection: /collections/yonex-rackets")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.HTTPError as e:
        print(e.read().decode(), file=sys.stderr)
        raise SystemExit(1)