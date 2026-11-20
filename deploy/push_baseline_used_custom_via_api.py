#!/usr/bin/env python3
"""Create used + custom rackets on live Baseline via admin API (run locally)."""

from __future__ import annotations

import json
import mimetypes
import sys
from pathlib import Path

import urllib.error
import urllib.request

API = "http://14.225.212.3:8000"
TENANT = "baseline"
LOGIN_USER = "superadmin"
LOGIN_PASS = "admin123"

_REPO = Path(__file__).resolve().parents[1]
IMAGES = _REPO / "SampleImages" / "baseline"

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


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


def _multipart_upload(token: str, path: Path) -> dict:
    boundary = "----InspoBoundary7MA4YWxk"
    ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    file_data = path.read_bytes()
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
        f"Content-Type: {ctype}\r\n\r\n"
    ).encode() + file_data + f"\r\n--{boundary}--\r\n".encode()
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


def _image_paths(folder: Path) -> list[Path]:
    files = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES]
    by_stem: dict[str, Path] = {}
    for p in sorted(files, key=lambda x: x.name.lower()):
        stem = p.stem.replace(" (1)", "").strip()
        prev = by_stem.get(stem)
        if prev is None or (" (1)" in prev.stem and " (1)" not in p.stem):
            by_stem[stem] = p
    return sorted(by_stem.values(), key=lambda x: x.name.lower())


def _ensure_category(token: str, slug: str, name: str, name_vi: str, nav_order: int) -> int:
    cats = _request("GET", "/api/admin/categories", token)
    for c in cats:
        if c["slug"] == slug:
            if c.get("nav_order") != nav_order or c.get("name_vi") != name_vi:
                _request(
                    "PUT",
                    f"/api/admin/categories/{c['id']}",
                    token,
                    {**c, "name_vi": name_vi, "nav_order": nav_order},
                )
            return int(c["id"])
    created = _request(
        "POST",
        "/api/admin/categories",
        token,
        {
            "slug": slug,
            "name": name,
            "name_vi": name_vi,
            "nav_order": nav_order,
            "content_blocks": [],
        },
    )
    return int(created["id"])


def _find_product(token: str, slug: str) -> dict | None:
    for p in _request("GET", "/api/admin/products", token):
        if p["slug"] == slug:
            return p
    return None


def _upsert_product(token: str, payload: dict) -> dict:
    existing = _find_product(token, payload["slug"])
    if existing:
        payload["images"] = payload.get("images") or existing.get("images") or []
        return _request("PUT", f"/api/admin/products/{existing['id']}", token, {**existing, **payload})
    return _request("POST", "/api/admin/products", token, payload)


def _upload_gallery(token: str, slug: str, folder: Path) -> list[dict]:
    out: list[dict] = []
    for pos, path in enumerate(_image_paths(folder)):
        media = _multipart_upload(token, path)
        out.append(
            {
                "media_id": media["id"],
                "url": media["url"],
                "alt": slug,
                "position": pos,
                "enabled": True,
            }
        )
        print(f"  uploaded {path.name} -> {media['id']}")
    return out


def main() -> int:
    if not IMAGES.is_dir():
        print(f"Missing images: {IMAGES}", file=sys.stderr)
        return 1
    token = _login()
    print("Logged in.")

    used_cat = _ensure_category(
        token,
        "used-rackets",
        "USED RACKETS",
        "Vợt đã qua sử dụng",
        35,
    )
    custom_cat = _ensure_category(
        token,
        "custom-rackets",
        "Custom Rackets",
        "Vợt custom",
        30,
    )
    print(f"Categories: used={used_cat}, custom={custom_cat}")

    custom_col_id = 11  # custom-rackets collection on baseline VPS

    specs = [
        {
            "slug": "head-speed-pro-legend-2025-used",
            "folder": IMAGES / "usedrackets" / "headspeedlegendpro2025",
            "name": "HEAD SPEED PRO LEGEND 2025",
            "name_vi": "HEAD SPEED PRO LEGEND 2025",
            "subtitle": "PRE-OWNED",
            "subtitle_vi": "ĐÃ QUA SỬ DỤNG",
            "price": 3_900_000,
            "brand": "head",
            "badge": "USED",
            "category_id": used_cat,
            "category_ids": [used_cat],
            "collection_id": None,
        },
        {
            "slug": "head-speed-legend-mp-2025-used",
            "folder": IMAGES / "usedrackets" / "headspeedlegendmp2025",
            "name": "HEAD SPEED LEGEND MP 2025",
            "name_vi": "HEAD SPEED LEGEND MP 2025",
            "subtitle": "PRE-OWNED",
            "subtitle_vi": "ĐÃ QUA SỬ DỤNG",
            "price": 3_700_000,
            "brand": "head",
            "badge": "USED",
            "category_id": used_cat,
            "category_ids": [used_cat],
            "collection_id": None,
        },
        {
            "slug": "babolat-pure-strike-gen4-baseline-custom",
            "folder": IMAGES / "Custom rackets" / "babolatstrikegen4",
            "name": "BABOLAT PURE STRIKE GEN 4 × BASELINE",
            "name_vi": "BABOLAT PURE STRIKE GEN 4 × BASELINE",
            "subtitle": "CUSTOM PAINT",
            "subtitle_vi": "SƠN TÙY CHỈNH",
            "price": 2_800_000,
            "brand": "babolat",
            "badge": "CUSTOM",
            "category_id": custom_cat,
            "category_ids": [custom_cat],
            "collection_id": custom_col_id,
            "is_featured": True,
        },
    ]

    for spec in specs:
        folder = spec.pop("folder")
        slug = spec["slug"]
        print(f"Gallery for {slug} …")
        images = _upload_gallery(token, slug, folder)
        spec["images"] = images
        spec["gallery_layout"] = "slideshow"
        spec["is_active"] = True
        spec.setdefault("colors", [{"name": "AS SHOWN", "hex": "#4a4a4a"}])
        if spec["slug"].endswith("-used"):
            spec.setdefault("sizes", [{"name": "GRIP 2", "available": True}])
        else:
            spec.setdefault("sizes", [{"name": "GRIP AS LISTED", "available": True}])
        spec.setdefault("is_featured", False)
        spec.setdefault("is_bestseller", False)
        spec.setdefault("tech_specs", [])
        spec.setdefault("features", [])
        product = _upsert_product(token, spec)
        print(f"OK product id={product['id']} slug={product['slug']}")

    print("Done. Verify:")
    print(f"  {API.replace(':8000', ':3001')}/products?category=used-rackets")
    print(f"  {API.replace(':8000', ':3001')}/products?category=custom-rackets")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.HTTPError as e:
        print(e.read().decode(), file=sys.stderr)
        raise SystemExit(1)