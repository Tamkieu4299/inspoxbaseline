"""Keep all active racquets in the shop quiz product pool (finder_profile.enabled).

TW-matched racquets keep review vectors; others get name/spec heuristics so matching still works.
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

from sqlalchemy import select

from .database import SessionLocal
from .models import Product, Tenant

TW_QUIZ_VECTOR_IDS: tuple[str, ...] = (
    "groundstrokes",
    "volleys",
    "serves",
    "returns",
    "power",
    "control",
    "maneuverability",
    "stability",
    "comfort",
    "touch",
    "topspin",
    "slice",
    "overall",
)


def _baseline_vectors() -> dict[str, int]:
    return {d: 50 for d in TW_QUIZ_VECTOR_IDS}


def infer_vectors_from_product(name: str, brand: str | None, specs: dict[str, Any]) -> dict[str, int]:
    """Rough TW-style 0–100 scores when no Tennis Warehouse review is linked."""
    v = _baseline_vectors()
    n = (name or "").lower()
    b = (brand or "").lower()

    def bump(**kwargs: int) -> None:
        for key, val in kwargs.items():
            if key in v:
                v[key] = int(max(0, min(100, val)))

    if "pure aero" in n or (b == "babolat" and "aero" in n):
        bump(topspin=74, power=63, maneuverability=58, groundstrokes=62, control=54, slice=52)
    elif "pure drive" in n or (b == "babolat" and "drive" in n and "pure" in n):
        bump(power=74, topspin=58, comfort=60, groundstrokes=62, control=55)
    elif "pure strike" in n or (b == "babolat" and "strike" in n):
        bump(control=72, stability=65, power=58, touch=58, topspin=52)
    elif "evoke" in n or "boost" in n or "b'fly" in n or "b fly" in n:
        bump(comfort=68, power=62, maneuverability=66, control=48)
    elif "clash" in n:
        bump(comfort=70, power=62, maneuverability=58)
    elif "blade" in n:
        bump(control=70, touch=68, stability=62, power=55)
    elif "ultra" in n:
        bump(power=72, stability=60, serves=62)
    elif "pro staff" in n or "prostaff" in n:
        bump(control=68, touch=65, stability=64, power=58)
    elif "radical" in n:
        bump(control=66, stability=62, groundstrokes=60)
    elif "speed" in n and b == "head":
        bump(power=65, maneuverability=62, groundstrokes=62)
    elif "gravity" in n:
        bump(stability=64, comfort=62, control=60)
    elif "ezone" in n or "vcore" in n:
        bump(power=66, topspin=64, groundstrokes=62)

    head = specs.get("head_sq_in")
    if head is not None:
        try:
            h = float(head)
        except (TypeError, ValueError):
            h = None
        if h is not None:
            if h <= 98:
                bump(control=min(v["control"] + 6, 88), maneuverability=max(v["maneuverability"] - 4, 38))
            elif h >= 102:
                bump(power=min(v["power"] + 5, 88), maneuverability=min(v["maneuverability"] + 5, 88))

    ra = specs.get("ra")
    if ra is not None:
        try:
            ra_n = int(ra)
        except (TypeError, ValueError):
            ra_n = None
        if ra_n is not None:
            if ra_n >= 68:
                bump(comfort=min(v["comfort"] + 8, 90), power=min(v["power"] + 3, 85))
            elif ra_n <= 64:
                bump(control=min(v["control"] + 6, 90), touch=min(v["touch"] + 5, 88))

    v["overall"] = int(round(sum(v[d] for d in TW_QUIZ_VECTOR_IDS if d != "overall") / (len(TW_QUIZ_VECTOR_IDS) - 1)))
    return v


def _has_tw_vectors(fp: dict[str, Any]) -> bool:
    if fp.get("tw"):
        return True
    vectors = fp.get("vectors") or {}
    if not isinstance(vectors, dict) or not vectors:
        return False
    non_default = [v for v in vectors.values() if isinstance(v, (int, float)) and int(v) != 50]
    return len(non_default) >= 4


def sync_quiz_racquet_pool(*, tenant_slug: str = "baseline", dry_run: bool = False) -> dict[str, int]:
    from .import_external_racquets import _finder_from_specs, _rackets_category

    db = SessionLocal()
    stats = {"total_active": 0, "newly_enabled": 0, "vectors_inferred": 0, "specs_updated": 0}
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")
        rackets = _rackets_category(db, tenant.id)
        products = db.scalars(
            select(Product).where(
                Product.tenant_id == tenant.id,
                Product.category_id == rackets.id,
                Product.is_active.is_(True),
            )
        ).all()
        stats["total_active"] = len(products)

        for product in products:
            fp = dict(product.finder_profile or {})
            from_specs = _finder_from_specs(product.tech_specs or [])
            merged_specs = {**(fp.get("specs") or {}), **from_specs}
            if merged_specs != (fp.get("specs") or {}):
                stats["specs_updated"] += 1

            was_enabled = bool(fp.get("enabled"))
            fp["enabled"] = True
            if not was_enabled:
                stats["newly_enabled"] += 1

            if _has_tw_vectors(fp):
                fp["specs"] = merged_specs
            else:
                fp["vectors"] = infer_vectors_from_product(product.name, product.brand, merged_specs)
                fp["specs"] = merged_specs
                stats["vectors_inferred"] += 1

            tags = list(fp.get("tags") or [])
            if product.brand and product.brand not in tags:
                tags.append(product.brand)
            fp["tags"] = tags

            if fp != (product.finder_profile or {}):
                if not dry_run:
                    product.finder_profile = fp

        if not dry_run:
            db.commit()
    finally:
        db.close()

    return stats


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Enable quiz pool for all active racquets on a tenant.")
    p.add_argument("--tenant", default="baseline")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--apply", action="store_true", help="Write changes (default is dry-run)")
    args = p.parse_args(argv)
    dry_run = args.dry_run or not args.apply
    stats = sync_quiz_racquet_pool(tenant_slug=args.tenant, dry_run=dry_run)
    mode = "dry-run" if dry_run else "applied"
    print(
        f"Quiz pool sync ({mode}) tenant={args.tenant}: "
        f"{stats['total_active']} active racquets, "
        f"{stats['newly_enabled']} newly enabled, "
        f"{stats['vectors_inferred']} heuristic vector profiles, "
        f"{stats['specs_updated']} spec merges."
    )


if __name__ == "__main__":
    main(sys.argv[1:])
