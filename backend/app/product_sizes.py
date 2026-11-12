"""Normalize product size / grip options (name + in-stock flag)."""

from __future__ import annotations

import re
from typing import Any


def normalize_product_sizes(raw: list | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw:
        if isinstance(item, str):
            name = item.strip()
            available = True
        elif isinstance(item, dict):
            name = str(item.get("name") or "").strip()
            available = item.get("available")
            if available is None and "sold_out" in item:
                available = not bool(item.get("sold_out"))
            if available is None:
                available = True
            else:
                available = bool(available)
        else:
            continue
        if not name:
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append({"name": name, "available": available})
    return out


def size_option_names(sizes: list | None) -> list[str]:
    return [row["name"] for row in normalize_product_sizes(sizes)]


def size_is_valid_and_available(sizes: list | None, size: str | None) -> bool:
    return resolve_order_size(sizes, size) is not None


def resolve_order_size(sizes: list | None, size: str | None) -> str | None:
    """Return canonical size name for checkout, or None if invalid/unavailable."""
    normalized = normalize_product_sizes(sizes)
    if not normalized:
        return None
    raw = (size or "").strip()
    if not raw:
        return None

    def _match(name: str) -> str | None:
        key = name.strip().casefold()
        for row in normalized:
            if row["name"].casefold() == key and row["available"]:
                return row["name"]
        return None

    hit = _match(raw)
    if hit:
        return hit

    legacy = raw.casefold()
    if legacy in {"one size", "one-size", "os"}:
        for candidate in ("GRIP 2", "GRIP 1", "GRIP 3", "GRIP 4"):
            hit = _match(candidate)
            if hit:
                return hit

    grip_num = re.fullmatch(r"grip\s*(\d)", legacy) or re.fullmatch(r"(\d)", legacy)
    if grip_num:
        hit = _match(f"GRIP {grip_num.group(1)}")
        if hit:
            return hit

    return None


def merge_size_availability(
    sizes: list[dict[str, Any]],
    size_name: str,
    available: bool,
) -> list[dict[str, Any]]:
    key = size_name.strip().casefold()
    out: list[dict[str, Any]] = []
    for row in normalize_product_sizes(sizes):
        if row["name"].casefold() == key:
            out.append({"name": row["name"], "available": bool(available)})
        else:
            out.append(row)
    return out


def default_racket_grip_sizes(*, all_available: bool = True) -> list[dict[str, Any]]:
    return [
        {"name": f"GRIP {n}", "available": all_available}
        for n in range(1, 5)
    ]
