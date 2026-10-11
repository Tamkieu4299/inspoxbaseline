"""Store currency normalization (VND-only storefront)."""

from __future__ import annotations

STOREFRONT_CURRENCIES = ("VND",)
DEFAULT_USD_TO_VND = 24_500.0


def normalize_base_currency(code: str | None) -> str:
    c = (code or "VND").upper()
    return c if c in STOREFRONT_CURRENCIES else "VND"


def convert_amount(
    amount: float,
    base_currency: str,
    target_currency: str,
    usd_to_vnd_rate: float,
) -> float:
    base = normalize_base_currency(base_currency)
    target = normalize_base_currency(target_currency)
    if base == target:
        return amount
    rate = usd_to_vnd_rate if usd_to_vnd_rate and usd_to_vnd_rate > 0 else DEFAULT_USD_TO_VND
    if base == "USD" and target == "VND":
        return round(amount * rate)
    if base == "VND" and target == "USD":
        return round((amount / rate) * 100) / 100
    return amount
