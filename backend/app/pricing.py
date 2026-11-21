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