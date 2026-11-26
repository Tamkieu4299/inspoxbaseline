"""Storefront retail price rounding (VND)."""

from __future__ import annotations

RETAIL_VND_ROUND = 10_000


def round_retail_vnd(amount: float | int | None) -> float:
    """Round to nearest 10,000₫ for customer-facing retail (e.g. 2_859_200 → 2_860_000)."""
    if amount is None:
        return 0.0
    n = float(amount)
    if n < RETAIL_VND_ROUND:
        return float(round(n))
    if n % RETAIL_VND_ROUND == RETAIL_VND_ROUND / 2:
        return float(round(n))
    return float(round(n / RETAIL_VND_ROUND) * RETAIL_VND_ROUND)


def apply_retail_price_on_save(
    amount: float | int | None,
    *,
    product_id: int | None = None,
    slug: str | None = None,
) -> float:
    from .baseline_physical_stock import retail_price_is_exact

    if amount is None:
        return 0.0
    if retail_price_is_exact(product_id, slug):
        return float(amount)
    return round_retail_vnd(amount)


def storefront_unit_price(
    amount: float | int | None,
    *,
    product_id: int | None = None,
    slug: str | None = None,
) -> float:
    """Checkout / cart line unit price."""
    return apply_retail_price_on_save(amount, product_id=product_id, slug=slug)