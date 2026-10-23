"""Shared rules for baseline adult racket catalog (lines + junior exclusion)."""

from __future__ import annotations

import re

_JUNIOR_NAME = re.compile(
    r"""
    \bjunior\b
    | \bjr\.?\b
    | \byouth\b
    | \bkids?\b
    | \bballfighter\b
    | \bb[\s'-]?fly\b
    | \btr[eẻ]\s*em\b
    | \bthanh\s*thi[eế]u\s*ni[eê]n\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Inch lengths in junior model names (e.g. "PURE DRIVE JUNIOR 25 GEN11", "Blade 26 v9").
_JUNIOR_LENGTH_INCH = re.compile(
    r"\bjunior\s+(?:gen\s*)?(19|21|23|25|26)\b",
    re.IGNORECASE,
)


def is_junior_racket(
    name: str | None,
    slug: str | None = None,
    name_vi: str | None = None,
) -> bool:
    """True for kids / youth racquet SKUs (by product title or slug)."""
    blob = " ".join(
        part for part in (name or "", slug or "", name_vi or "") if part
    ).strip()
    if not blob:
        return False
    if _JUNIOR_NAME.search(blob):
        return True
    return _JUNIOR_LENGTH_INCH.search(blob) is not None
