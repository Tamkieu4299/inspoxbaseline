"""Serialize Product ORM rows for API responses."""

from __future__ import annotations

from .baseline_physical_stock import retail_price_is_exact
from .models import Product
from .schemas import ProductOut


def serialize_product_out(product: Product, data: dict | None = None) -> ProductOut:
    base = data if data is not None else ProductOut.model_validate(product).model_dump()
    base["retail_price_exact"] = retail_price_is_exact(product.id, product.slug)
    return ProductOut.model_validate(base)