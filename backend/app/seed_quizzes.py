"""Idempotent default quiz seeds per tenant."""

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
