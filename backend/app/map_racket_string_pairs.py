"""Auto-map tennis strings to racquets (complements role=tennis_string).

    docker exec inspo-backend python -m app.map_racket_string_pairs --dry-run
    docker exec inspo-backend python -m app.map_racket_string_pairs --apply
"""

from __future__ import annotations

import argparse
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .import_external_racquets import _finder_from_specs, _rackets_category
from .models import Category, Product, Tenant
from .product_complements import merge_complement_links, normalize_complement_links
from .quiz_racquet_pool import infer_vectors_from_product


def _is_racquet(product: Product, rackets_cat_id: int | None) -> bool:
    if product.slug.startswith(("ts-", "fh-", "gs-")):
        return product.slug.startswith(("ts-", "fh-"))
    if rackets_cat_id and product.category_id == rackets_cat_id:
        return True
    if any(c.slug == "rackets" for c in (product.categories or [])):
        return True
    fp = product.finder_profile or {}
    return bool(fp.get("enabled"))


def _is_string(product: Product, strings_cat_id: int | None) -> bool:
    if product.slug.startswith("gs-"):
        return True
    if strings_cat_id and product.category_id == strings_cat_id:
        return True
    return any(c.slug == "tennis-strings" for c in (product.categories or []))


def _string_kind(name: str, brand: str | None) -> str:
    n = (name or "").casefold()
    b = (brand or "").casefold()
    if any(k in n for k in ("natural gut", "touch vs", "nxt", "sensation", "multi", "multifilament")):
        return "multifilament"
    if any(k in n for k in ("syn gut", "synthetic gut", "synthetic", "x-one", "x one")):
        return "syn_gut"
    if any(k in n for k in ("soft", "comfort", "addiction", "reflex", "nxt")):
        return "soft_poly"
    if any(
        k in n or k in b
        for k in (
            "luxilon",
            "alu",
            "4g",
            "poly",
            "confidential",
            "hyper",
            "bite",
            "rpm",
            "black code",
            "revolve",
            "element",
            "eco spin",
            "signum",
            "msv",
            "solinco",
        )
    ):
        return "poly"
    return "other"


def _racquet_specs(product: Product) -> dict[str, Any]:
    fp = product.finder_profile or {}
    specs = dict(fp.get("specs") or {})
    if not specs:
        specs = _finder_from_specs(product.tech_specs or [])
    vectors = dict(fp.get("vectors") or {})
    if not vectors or sum(1 for v in vectors.values() if v != 50) < 3:
        vectors = infer_vectors_from_product(product.name, product.brand, specs)
    ra = specs.get("ra")
    try:
        ra_n = int(ra) if ra is not None else None
    except (TypeError, ValueError):
        ra_n = None
    return {"vectors": vectors, "ra": ra_n, "specs": specs}


def _score_pair(racket: Product, rspec: dict[str, Any], string_p: Product) -> float:
    v = rspec["vectors"]
    comfort = float(v.get("comfort") or 50)
    topspin = float(v.get("topspin") or 50)
    power = float(v.get("power") or 50)
    control = float(v.get("control") or 50)
    ra = rspec.get("ra")

    kind = _string_kind(string_p.name, string_p.brand)
    score = 0.0
    sname = string_p.name.casefold()

    if racket.brand and string_p.brand and racket.brand == string_p.brand:
        score += 28

    arm_friendly = comfort >= 62 or (ra is not None and ra >= 66)
    spin_power = topspin >= 60 or power >= 62
    control_player = control >= 62

    if arm_friendly:
        if kind in ("multifilament", "syn_gut", "soft_poly"):
            score += 38
        elif kind == "poly":
            score -= 12
    if spin_power:
        if kind == "poly":
            score += 34
        if "hyper" in sname or "alu" in sname or "4g" in sname:
            score += 10
    if control_player:
        if any(k in sname for k in ("rpm", "rough", "bite", "control", "razor")):
            score += 14

    if kind == "multifilament" and comfort >= 58:
        score += 12
    if kind == "other":
        score += 4

    if float(string_p.price or 0) > 0:
        score += 6

    if re.search(r"junior|trẻ em|tr\u1ebb em", racket.name, re.I):
        if kind in ("syn_gut", "multifilament"):
            score += 10

    return score


def map_pairs(*, tenant_slug: str = "baseline", dry_run: bool = False, per_racket: int = 3) -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")

        rackets_cat = db.scalar(
            select(Category).where(Category.tenant_id == tenant.id, Category.slug == "rackets")
        )
        strings_cat = db.scalar(
            select(Category).where(Category.tenant_id == tenant.id, Category.slug == "tennis-strings")
        )

        products = db.scalars(
            select(Product)
            .options(selectinload(Product.categories))
            .where(Product.tenant_id == tenant.id, Product.is_active.is_(True))
        ).all()

        racquets = [p for p in products if _is_racquet(p, rackets_cat.id if rackets_cat else None)]
        strings = [p for p in products if _is_string(p, strings_cat.id if strings_cat else None)]
        if not racquets or not strings:
            print(f"No racquets ({len(racquets)}) or strings ({len(strings)}) to map.")
            return

        updated = 0
        for racket in racquets:
            rspec = _racquet_specs(racket)
            ranked: list[tuple[float, Product]] = []
            for s in strings:
                if s.id == racket.id:
                    continue
                ranked.append((_score_pair(racket, rspec, s), s))
            ranked.sort(key=lambda x: (-x[0], x[1].name))
            picks: list[int] = []
            seen_brands: set[str] = set()
            for sc, s in ranked:
                if sc < 20:
                    continue
                if len(picks) >= per_racket:
                    break
                b = (s.brand or "").lower()
                if b and b in seen_brands and len(picks) >= 1:
                    continue
                picks.append(s.id)
                if b:
                    seen_brands.add(b)
            if not picks:
                continue

            new_links = merge_complement_links(
                racket.complements,
                role="tennis_string",
                product_ids=picks,
            )
            if normalize_complement_links(racket.complements) == new_links:
                continue
            if dry_run:
                names = [next(x.name for x in strings if x.id == pid) for pid in picks]
                print(f"would map {racket.slug}: {names}")
            else:
                racket.complements = new_links
            updated += 1

        if dry_run:
            print(f"Dry run: {updated} racquet(s) would get string suggestions.")
            return
        db.commit()
        print(
            f"Mapped tennis strings for {updated} racquet(s) on '{tenant_slug}' "
            f"({len(strings)} strings in pool, up to {per_racket} each)."
        )
    finally:
        db.close()


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Map tennis strings to racquets (complements)")
    p.add_argument("--tenant", default="baseline")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--per-racket", type=int, default=3)
    args = p.parse_args(argv)
    if not args.apply and not args.dry_run:
        raise SystemExit("Pass --dry-run or --apply")
    map_pairs(tenant_slug=args.tenant, dry_run=args.dry_run and not args.apply, per_racket=args.per_racket)


if __name__ == "__main__":
    main()
