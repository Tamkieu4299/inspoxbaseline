"""Baseline in-store racket lines → fixed web retail (VND). Hong An sync skips these ids."""

from __future__ import annotations

# product id → web retail price (from Baseline cost sheet)
PHYSICAL_STOCK_RETAIL: dict[int, float] = {
    122: 6_299_000,  # Babolat Pure Aero 98 305g
    124: 5_999_000,  # Babolat Pure Aero 100 300g
    127: 5_555_000,  # Babolat Pure Aero 100 285g (Lite)
    18: 5_555_000,  # Wilson Blade 100 285g (100L)
    9: 5_555_000,  # Wilson Blade 100 300g
    10: 5_555_000,  # Wilson Blade 98 305g
    7: 5_555_000,  # Wilson Defyer 100 285g
    55: 4_321_000,  # Head Squared
}

# Fixed retail by slug (resolved to id at sync time)
PHYSICAL_STOCK_SLUG_RETAIL: dict[str, float] = {
    "yonex-ezone-alpha-100-275g": 3_700_000,
    "yonex-percept-100l-280g": 5_600_000,
}

PHYSICAL_STOCK_IDS: frozenset[int] = frozenset(PHYSICAL_STOCK_RETAIL)