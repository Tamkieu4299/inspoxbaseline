"""Merchandising sort helpers (HOT lines first, flagship before Team/Lite)."""

from __future__ import annotations

import re

from .models import Product


def _product_blob(product: Product) -> str:
    return f"{product.name or ''} {product.slug or ''}".lower()


def product_variant_tier(product: Product) -> int:
    """Lower = higher priority. Flagship frames before Team / Lite / VS."""
    b = _product_blob(product)
    if "super lite" in b or " s lite" in b:
        return 4
    if re.search(r"\blite\b", b):
        return 3
    if "team" in b:
        return 2
    if re.search(r"\bvs\b", b):
        return 2
    if re.search(r"\b(110|103)\b", b):
        return 2
    return 0


def product_merch_line_rank(product: Product) -> int:
    """Lower = show earlier. HOT racket lines per brand."""
    brand = (product.brand or "").lower()
    b = _product_blob(product)

    if brand == "babolat":
        if re.search(r"pure[\s-]+aero", b):
            return 0
        if re.search(r"pure[\s-]+drive", b):
            return 10
        if re.search(r"pure[\s-]+strike", b):
            return 20
        return 90

    if brand == "head":
        for idx, line in enumerate(("speed", "gravity", "boom", "radical")):
            if line in b:
                return idx * 10
        return 90

    if brand == "wilson":
        if "defyer" in b or "defier" in b:
            return 0
        if "blade" in b:
            return 10
        if "clash" in b:
            return 20
        if "pro staff" in b or "prostaff" in b or "pro-staff" in b:
            return 30
        if "ultra" in b:
            return 40
        if re.search(r"\brf\b|rf01|roger[\s-]?federer", b):
            return 50
        return 90

    return 100


def product_hot_sort_key(product: Product) -> tuple:
    order = int(getattr(product, "list_order", 0) or 0)
    return (
        0 if product.is_featured else 1,
        0 if product.is_bestseller else 1,
        product_merch_line_rank(product),
        product_variant_tier(product),
        order,
        (product.name or "").upper(),
    )
