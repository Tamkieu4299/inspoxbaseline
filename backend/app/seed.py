"""Database bootstrap: schema, tenant migrations, admin user.

Shop1 (INSPO) catalog data comes from ``deploy/backup`` (import) or ``seed_inspo.py``
(real MinIO uploads). This module does **not** insert demo tennis SKUs.
"""

from sqlalchemy import MetaData, select, text

from .config import settings
from .database import Base, SessionLocal, engine
from .models import (
    BlogPost,
    Category,
    Collection,
    HomeContent,
    Media,
    Page,
    Product,
    Tenant,
    User,
    UserTenantMembership,
)
from .security import hash_password

TENANTED_TABLES = [
    "categories",
    "collections",
    "products",
    "home_content",
    "editorial_items",
    "pages",
    "blog_posts",
    "site_settings",
]

SLUG_UNIQUE_MODELS = [Category, Collection, Product, Page, BlogPost]

# Canonical shop1 SKUs (real INSPO catalog — see deploy/backup)
from .seed_inspo import INSPO_PRODUCT_SLUGS as SHOP1_CATALOG_SLUGS  # noqa: E402

INSPO_V1_PRODUCT_SLUGS = SHOP1_CATALOG_SLUGS


def _ensure_tenant(db) -> Tenant:
    slug = settings.DEFAULT_TENANT_SLUG or "shop1"
    tenant = db.scalar(select(Tenant).where(Tenant.slug == slug))
    if tenant is None:
        tenant = Tenant(slug=slug, name=slug.replace("-", " ").title())
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    return tenant


def _rebuild_slug_tables(db):
    for model in SLUG_UNIQUE_MODELS:
        table = model.__table__
        name = table.name
        ddl = db.execute(
            text(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{name}'")
        ).scalar() or ""
        if "UNIQUE (slug)".upper() not in ddl.upper():
            continue
        meta = MetaData()
        for ref in [Tenant, Media, Category, Collection, Product, Page, BlogPost]:
            ref.__table__.to_metadata(meta)
        tmp_name = f"_mig_{name}"
        tmp = table.to_metadata(meta, name=tmp_name)
        tmp.create(bind=db.get_bind())
        cols = ", ".join(c.name for c in table.columns)
        db.execute(text(f"INSERT INTO {tmp_name} ({cols}) SELECT {cols} FROM {name}"))
        db.execute(text(f"DROP TABLE {name}"))
        db.execute(text(f"ALTER TABLE {tmp_name} RENAME TO {name}"))
        db.commit()
        print(f"Migration: removed legacy UNIQUE(slug) from {name}")


def _add_column_if_missing(db, table: str, column: str, ddl: str):
    cols = {r[1] for r in db.execute(text(f"PRAGMA table_info({table})")).fetchall()}
    if column not in cols:
        db.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
        db.commit()
        print(f"Migration: added {table}.{column}")


def _migrate_existing(db, tenant_id: int):
    for table in TENANTED_TABLES:
        try:
            db.execute(text(f"ALTER TABLE {table} ADD COLUMN tenant_id INTEGER"))
        except Exception:
            pass
        db.execute(text(f"UPDATE {table} SET tenant_id = :tid WHERE tenant_id IS NULL"), {"tid": tenant_id})
    db.commit()
    _add_column_if_missing(db, "home_content", "hero_gradient", "BOOLEAN DEFAULT 1")
    _add_column_if_missing(db, "home_content", "hero_text_color", "VARCHAR(20) DEFAULT '#1c1917'")
    _add_column_if_missing(db, "home_content", "hero_carousel", "BOOLEAN DEFAULT 0")
    _add_column_if_missing(db, "home_content", "hero_image_ids", "JSON")
    _add_column_if_missing(db, "home_content", "hero_carousel_interval", "INTEGER DEFAULT 5")
    _add_column_if_missing(db, "home_content", "hero_colors", "JSON")
    db.execute(text("UPDATE home_content SET hero_colors='{}' WHERE hero_colors IS NULL"))
    _add_column_if_missing(db, "home_content", "sections", "JSON")
    db.execute(text("UPDATE home_content SET sections='[]' WHERE sections IS NULL"))
    db.execute(text("UPDATE home_content SET hero_image_ids='[]' WHERE hero_image_ids IS NULL"))
    db.commit()
    _add_column_if_missing(db, "pages", "gradient", "BOOLEAN DEFAULT 1")
    _add_column_if_missing(db, "pages", "hero_text_color", "VARCHAR(20) DEFAULT '#1c1917'")
    _add_column_if_missing(db, "blog_posts", "gradient", "BOOLEAN DEFAULT 1")
    _add_column_if_missing(db, "blog_posts", "hero_text_color", "VARCHAR(20) DEFAULT '#1c1917'")
    _add_column_if_missing(db, "site_settings", "currency_code", "VARCHAR(3) DEFAULT 'VND'")
    db.execute(text("UPDATE site_settings SET currency_code='VND' WHERE currency_code IS NULL OR currency_code='' OR currency_code='USD'"))
    _add_column_if_missing(db, "site_settings", "usd_to_vnd_rate", "FLOAT DEFAULT 24500")
    db.execute(text("UPDATE site_settings SET usd_to_vnd_rate=24500 WHERE usd_to_vnd_rate IS NULL OR usd_to_vnd_rate<=0"))
    db.commit()
    _backfill_media_tenant(db, tenant_id)
    _rewrite_media_urls(db)
    _rebuild_slug_tables(db)
    _migrate_platform_users(db)


def _backfill_media_tenant(db, tenant_id: int):
    _add_column_if_missing(db, "media", "tenant_id", "INTEGER")
    db.execute(
        text(
            "UPDATE media SET tenant_id = (SELECT p.tenant_id FROM product_images pi "
            "JOIN products p ON p.id = pi.product_id WHERE pi.media_id = media.id) "
            "WHERE tenant_id IS NULL AND EXISTS (SELECT 1 FROM product_images pi "
            "JOIN products p ON p.id = pi.product_id WHERE pi.media_id = media.id)"
        )
    )
    db.execute(
        text(
            "UPDATE media SET tenant_id = (SELECT c.tenant_id FROM collections c "
            "WHERE c.hero_image_id = media.id) "
            "WHERE tenant_id IS NULL AND EXISTS (SELECT 1 FROM collections c "
            "WHERE c.hero_image_id = media.id)"
        )
    )
    db.execute(
        text(
            "UPDATE media SET tenant_id = (SELECT e.tenant_id FROM editorial_items e "
            "WHERE e.media_id = media.id) "
            "WHERE tenant_id IS NULL AND EXISTS (SELECT 1 FROM editorial_items e "
            "WHERE e.media_id = media.id)"
        )
    )
    db.execute(
        text(
            "UPDATE media SET tenant_id = (SELECT h.tenant_id FROM home_content h "
            "WHERE h.hero_image_id = media.id OR h.master_media_id = media.id) "
            "WHERE tenant_id IS NULL AND EXISTS (SELECT 1 FROM home_content h "
            "WHERE h.hero_image_id = media.id OR h.master_media_id = media.id)"
        )
    )
    db.execute(
        text(
            "UPDATE media SET tenant_id = (SELECT pg.tenant_id FROM pages pg "
            "WHERE pg.hero_image_id = media.id) "
            "WHERE tenant_id IS NULL AND EXISTS (SELECT 1 FROM pages pg "
            "WHERE pg.hero_image_id = media.id)"
        )
    )
    db.execute(
        text(
            "UPDATE media SET tenant_id = (SELECT b.tenant_id FROM blog_posts b "
            "WHERE b.cover_image_id = media.id) "
            "WHERE tenant_id IS NULL AND EXISTS (SELECT 1 FROM blog_posts b "
            "WHERE b.cover_image_id = media.id)"
        )
    )
    db.execute(
        text(
            "UPDATE media SET tenant_id = (SELECT s.tenant_id FROM site_settings s "
            "WHERE s.logo_media_id = media.id OR s.favicon_media_id = media.id) "
            "WHERE tenant_id IS NULL AND EXISTS (SELECT 1 FROM site_settings s "
            "WHERE s.logo_media_id = media.id OR s.favicon_media_id = media.id)"
        )
    )
    db.execute(text("UPDATE media SET tenant_id = :tid WHERE tenant_id IS NULL"), {"tid": tenant_id})
    db.commit()
    print(f"Migration: media tenant_ids assigned (fallback tenant {tenant_id})")


def _rewrite_media_urls(db):
    base = settings.public_base_url.rstrip("/")
    bucket = settings.MINIO_BUCKET
    rows = db.execute(
        text("SELECT id, object_key, url FROM media WHERE object_key IS NOT NULL")
    ).fetchall()
    changed = 0
    for media_id, object_key, url in rows:
        if not url or not url.startswith(base):
            db.execute(
                text("UPDATE media SET url = :url WHERE id = :id"),
                {"url": f"{base}/{bucket}/{object_key}", "id": media_id},
            )
            changed += 1
    if changed:
        db.commit()
        print(f"Migration: rewrote {changed} media URL(s) to {base}")


def _migrate_platform_users(db):
    _add_column_if_missing(db, "users", "is_super_admin", "BOOLEAN DEFAULT 0")
    Base.metadata.create_all(bind=engine)

    tenants = {t.id: t for t in db.execute(select(Tenant)).scalars().all()}
    for user in db.execute(select(User)).scalars().all():
        tenant = tenants.get(user.tenant_id)
        if tenant and user.username == "admin":
            new_username = f"admin-{tenant.slug}"
            if not db.scalar(
                select(User).where(User.username == new_username, User.id != user.id)
            ):
                user.username = new_username
    db.commit()

    for user in db.execute(select(User).where(User.is_super_admin.is_(False))).scalars().all():
        has = db.scalar(
            select(UserTenantMembership.id).where(
                UserTenantMembership.user_id == user.id,
                UserTenantMembership.tenant_id == user.tenant_id,
            )
        )
        if has is None and user.tenant_id:
            db.add(UserTenantMembership(user_id=user.id, tenant_id=user.tenant_id))
    db.commit()

    super_name = settings.SUPER_ADMIN_USERNAME.strip().lower()
    if not db.scalar(select(User).where(User.username == super_name)):
        first = db.scalar(select(Tenant).order_by(Tenant.id))
        if first:
            db.add(
                User(
                    tenant_id=first.id,
                    username=super_name,
                    password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
                    is_super_admin=True,
                )
            )
            db.commit()
            print(
                f"Migration: created super admin '{super_name}' "
                f"(password from ADMIN_DEFAULT_PASSWORD env, default admin123 in dev)"
            )


def _ensure_admin_user(db, tenant_id: int):
    tenant = db.get(Tenant, tenant_id)
    slug = tenant.slug if tenant else "shop1"
    username = f"admin-{slug}"
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        user = db.scalar(select(User).where(User.tenant_id == tenant_id, User.username == "admin"))
    if user is None:
        user = User(
            tenant_id=tenant_id,
            username=username,
            password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
        )
        db.add(user)
        db.flush()
    elif user.username == "admin":
        user.username = username
    mem = db.scalar(
        select(UserTenantMembership).where(
            UserTenantMembership.user_id == user.id,
            UserTenantMembership.tenant_id == tenant_id,
        )
    )
    if mem is None:
        db.add(UserTenantMembership(user_id=user.id, tenant_id=tenant_id))
    db.commit()


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    tenant = _ensure_tenant(db)
    _migrate_existing(db, tenant.id)
    _ensure_admin_user(db, tenant.id)
    db.close()

    from .seed_baseline_club import run as run_baseline_club
    from .seed_inspo import run as run_inspo_catalog

    run_inspo_catalog()
    try:
        run_baseline_club()
    except (SystemExit, FileNotFoundError) as exc:
        print(f"Baseline Club seed skipped: {exc}")
    print("Bootstrap complete (migrations + optional INSPO catalog).")


if __name__ == "__main__":
    run()
