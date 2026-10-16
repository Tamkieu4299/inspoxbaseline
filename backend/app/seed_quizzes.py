"""Idempotent default quiz seeds + upgrade path for racquet-finder."""

from __future__ import annotations

import argparse

from sqlalchemy import select

from .database import SessionLocal
from .models import ShopQuiz, Tenant
from .quiz_defaults import DEFAULT_RACQUET_FINDER


def ensure_default_quizzes(tenant_id: int | None = None) -> None:
    db = SessionLocal()
    try:
        if tenant_id is None:
            tenants = db.execute(select(Tenant)).scalars().all()
        else:
            tenants = [db.get(Tenant, tenant_id)]
        for tenant in tenants:
            if tenant is None:
                continue
            existing = db.scalar(
                select(ShopQuiz.id).where(
                    ShopQuiz.tenant_id == tenant.id,
                    ShopQuiz.slug == DEFAULT_RACQUET_FINDER["slug"],
                )
            )
            if existing:
                continue
            data = {k: v for k, v in DEFAULT_RACQUET_FINDER.items()}
            quiz = ShopQuiz(tenant_id=tenant.id, **data)
            db.add(quiz)
            print(f"Seed: added quiz '{quiz.slug}' for tenant {tenant.slug}")
        db.commit()
    finally:
        db.close()


def upgrade_racquet_finder_quiz(tenant_slug: str = "baseline") -> None:
    """Refresh steps, dimensions, and weights on an existing racquet-finder quiz."""
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")
        quiz = db.scalar(
            select(ShopQuiz).where(
                ShopQuiz.tenant_id == tenant.id,
                ShopQuiz.slug == DEFAULT_RACQUET_FINDER["slug"],
            )
        )
        if quiz is None:
            data = {k: v for k, v in DEFAULT_RACQUET_FINDER.items()}
            quiz = ShopQuiz(tenant_id=tenant.id, **data)
            db.add(quiz)
            print(f"Created quiz '{quiz.slug}' for tenant {tenant_slug}")
        else:
            quiz.subtitle = DEFAULT_RACQUET_FINDER["subtitle"]
            quiz.subtitle_vi = DEFAULT_RACQUET_FINDER["subtitle_vi"]
            quiz.hero_badges = DEFAULT_RACQUET_FINDER["hero_badges"]
            quiz.faq = DEFAULT_RACQUET_FINDER["faq"]
            quiz.dimensions = DEFAULT_RACQUET_FINDER["dimensions"]
            quiz.dimension_weights = DEFAULT_RACQUET_FINDER["dimension_weights"]
            quiz.steps = DEFAULT_RACQUET_FINDER["steps"]
            quiz.product_filter = DEFAULT_RACQUET_FINDER["product_filter"]
            print(
                f"Upgraded quiz '{quiz.slug}' for tenant {tenant_slug}: "
                f"{len(quiz.steps or [])} steps, {len(quiz.dimensions or [])} dimensions"
            )
        db.commit()
    finally:
        db.close()


def main() -> None:
    p = argparse.ArgumentParser(description="Seed or upgrade shop quizzes.")
    p.add_argument("--tenant", default=None, help="Tenant slug (default: all tenants for seed)")
    p.add_argument(
        "--upgrade-racquet-finder",
        action="store_true",
        help="Replace racquet-finder steps/dimensions with latest TW-aligned template",
    )
    args = p.parse_args()

    if args.upgrade_racquet_finder:
        slug = args.tenant or "baseline"
        upgrade_racquet_finder_quiz(slug)
        return

    if args.tenant:
        db = SessionLocal()
        try:
            tenant = db.scalar(select(Tenant).where(Tenant.slug == args.tenant))
            if tenant is None:
                raise SystemExit(f"Tenant not found: {args.tenant}")
            ensure_default_quizzes(tenant.id)
        finally:
            db.close()
    else:
        ensure_default_quizzes()


if __name__ == "__main__":
    main()
