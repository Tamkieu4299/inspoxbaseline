"""Seed the database with the v1 design content so the storefront works out of the box.

Images reference the design's remote assets (no upload needed). Upload new media
through the admin API / MinIO to replace them.
"""

from datetime import datetime

from sqlalchemy import MetaData, select, text
from sqlalchemy.orm import selectinload

from .config import settings
from .database import Base, SessionLocal, engine
from .models import (
    BlogPost,
    Category,
    Collection,
    EditorialItem,
    HomeContent,
    Media,
    Page,
    PageBlock,
    Product,
    ProductImage,
    SiteSettings,
    Tenant,
    User,
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

IMG = {
    "hero_grass": "https://lh3.googleusercontent.com/aida-public/AB6AXuDVZ4o8ccG3OPMo1jjKgFcBx-pbZQh0gDXgBVuslu52oPiskREGWNaE8YKOMfstZI9XVlbNMzAqFN6mVlr__2IZeDk_IJ31VVG9fNg3UDqD-pFjujiNWmhngHtecsV8gqoyOh1khZIuLX3r-Ywb9oxwTNS_rGnPQ3nqM9Ta4dm2Qz56ZT4IbRGWV9pl-BzZqI63L0qKVeUrndJ71DaIBf8RsrVo5hoxiC6DvTadIdF3VVeDVDr8qlCi",
    "pro_court_shoe": "https://lh3.googleusercontent.com/aida-public/AB6AXuBG3d6P4w33kwQlY-o2hCTiiREO121XJpRC06o2eHYG-QlPEbtW1er7a7t1Hrg7s0BWsKkOq3o-HtwU7Z7XWgkwPWsBeBAazUS1piRzusSzL1lFj8ZO0JiokQAfUq3WRPwpseiRBmDaEBZs__LxohMd-JQVQuoFpgpqRFnWsciXmBimpr2yiZHSdfJ8ds7vztCwTC_7rPCZwEuCp9ESlYIgLW1KPJxqiROyJfxniH4b03aBQfRKZsG4",
    "tour_bag": "https://lh3.googleusercontent.com/aida-public/AB6AXuBh9W6aHiD4yLzUngC5P_XLTlLeSgmbD4petf6WjKH9lMlZ6iOJ9eaMYNMO0spun3mYzOpUiU1ebngaT5bcXHIixD8NW-R5wgzQBbbgQ7Bh8sN7TXMm4ngtiL085qz8WbCrnA1VQ05nf9ZMfV3Hjy5EuvSmWrmBmjrLDTTDoch3RXOzzwBW0RnHBcZRVP5XBwZG_YCYH5awlr96Mbwx5Odk-H5GLE3oswXcDPjpBbmIIx2oZf7du50y",
    "polo": "https://lh3.googleusercontent.com/aida-public/AB6AXuCsnLA88Uq-LjrXD3rxaFsu2q7pTXZgiLhmaGm73c79smzN1s5pcgXo1l9hJPpZjdKfXYvbcEngnGh9C-FIG6Ev1qiig4UFy3DmOfzpsDUB4dpVgBP0htM49FFFxQQHF30-fp5hugO65qKleiG7EjhZBdg_lY3tnq6WKfHnIQi-N2TWUEmgu8m8kPTgt4X9hiEen9KS1w_oHd7A77uBX5GM8OCrRUqT2veXFvABuODiYdKZrsqKVsGD",
    "skirt_home": "https://lh3.googleusercontent.com/aida-public/AB6AXuCA2ZUxHPVjTLnp7mkOlY-XgoGdFQq0_Fg6FT_W5F9PwTUllGQz_DYQM9FgQ95J-AR0R6Vt8dGopQKgCDliFelGgbL_rpeYf3_a6LGYnkICMGr1PMSC4-DQrQERKhy7u8QHUB9SN-2KnKiGvoB8mAeFEY1t0P8om79XDT9GPuGWIBZS7I8_ZIoun1hp1VWXVWaQq5W9XtWXVJOzFLZ1Y7FvqARTYSHxs45JL1IN6z3VgfG0UCizhiD9",
    "jacket": "https://lh3.googleusercontent.com/aida-public/AB6AXuBySVMCRBoW9l9q3aF-KbcaJ642c7zmNBEGVPc5V0RC5iQaXYcJgXGqO4zQSpJ4InllqExqLV2Wt4k6dO4trtZF_BCoENIXAbEEtVNNKT4OCz9RgvYgklbnNtHa1XY1JAMaGxp2_Mh6F5oU4fBrdLYuHtwmWKx42E1ZVI-UBess5U9HcIwtTJFkOiyHM-2clF8PTCAdWiUb5tHnkNvnyhn7IHU0dblGuqUhNy3X8T_sb6dpdKKu0KCS",
    "visor": "https://lh3.googleusercontent.com/aida-public/AB6AXuDOJ4qRAD5lc_Drl45brEovGYRid1_N0zRSh-tF7Wno9JfU4n0CIWKCBf_MlNk3sy9QvOi_RwY4Ee8StLrpfxXXeWAhSj_LGeYCsu_znqkPnMWsCoeNGVghYMAZie8P18jhZ-Xq6_7jB5-mA7ZpVC-7W1HjU-Qwy4y7IqpEvPmK6nL1wk_ye-nNp3Evee_XbxGEw5vLl-lQY46zVZMcFMOf6qT7VRc4dtNP3LOihPY4yF4xone2Pycg",
    "grand_slam_polo": "https://lh3.googleusercontent.com/aida-public/AB6AXuDz0DYbpl5gzhgSfdulihRwmglR_N0lAmuLo32LVntWRNXsJowlSgeCMkHioz_T3_FhF9SLFq5I-ccA-dvPSYEp7s5k06BWIxEslvLbfLWQ7lKgwtSHOLJVIznBDqU8eaazQYiD-uE6sh2b13hNsn4BJU7rsgUPR97cpT29UqpoFYrE58B5IyzzbDtot4HffdtA48_5JdKWyyHpLrTy6E_QyKi99ZK4Vt1JSqJrSkT8dPiula5eO8KP",
    "skirt_collection": "https://lh3.googleusercontent.com/aida-public/AB6AXuBxQD4aHd-h2TSlpcw-tTR7_Z0LYEOW9QdRew3IqwY5Cl2fE6RTMtDlVY0z7_6x_LXhChjsJPLRbY2tDT2gUS-CJilovhMUNU6jkUxq7CmTtyjsbAfl-1khERYOqZeHqv5kLEMr5oDna28w0pevdPQd0lFrIJb61E--yo8RRv4Ud3M3h3UugCuGCys3j9Zo3kQ3Pn0oT0GX9Y9BdtCRLA9RtQsxd_NDSddb5QkYH-9lbmIZ0sq1kZIi",
    "court_short": "https://lh3.googleusercontent.com/aida-public/AB6AXuAjqdAqqh_7ZVup_YwjR4bl7C5Fp2JlSOnCi4CchKJ414o64djKBI7uQgNHDu4IevH_BHsgxRHK5ZN-swk8bT9DS3lY2xqvJAvBhTFe5IBieMMaNcuY7z2c22K2c0WQSTmkLAiRhlCTrkp_L88Fqt9RY2llY9E3_rBuwIU_mVzKsq3dV-EOlDx9gv7zgz1jrnas3w90pcTA2BHMSuanLC-Hf2EFMJPzHOAqqEt7nT9MNGwRWMAFAOp5",
    "pro_tour_bag": "https://lh3.googleusercontent.com/aida-public/AB6AXuDQZd3d15J9YgEJuExHV-f17JGM3vJaSVX2w4CmMTtBl0O6tkdJuvILO83teVivkrDXs4v8JLNNP8Qv6bMqpwaATulzV8_JSKAMPwmLAih42qaDImSvLT-Nan3ADLRfVNyX5xCMk5gj541dc1yIt4OA4yzln3UnqVaez7q3y7PQv509x9KlU6dc-ppkcwo9dpXQ_qkx7ZbdaK8rgox698CcMglmOVNCVEAoFK5COg8uwNY8hbd4EA32",
    "aero_dress": "https://lh3.googleusercontent.com/aida-public/AB6AXuBAvvK-9iOHlYXwTnX-1ds1I9hpDlRvlcqI_4WhqtlgUJUf41LClvgybFZ8QFo3H0W2pUdaySv_gJve8Ye0vOUjorE_N27j1GJmI_AkJ6qzDYpSrOgPOJlTOT9AR_e241NdKhc6177VwEvuIMN7RbGPm37L45dA-M4XsSj62MwVeVVhulA6fBI8jnE6wK910TeszLdu47ALGaC9FebTrOn4mwmi75ORhTTeDXeOCi6Fz7n9tuYSmcPT",
    "shoe_main": "https://lh3.googleusercontent.com/aida-public/AB6AXuCQLjka3dQcgwfvkY9WqgSrfv5bjl5RgHnYWU9dGq3lCzt_XDngMKUwzCZogJoL1xiWY19zMoDVqrdYq_NI_6xt0TOuEBA7HhjhPmSZAtOIrC5j-Y_kaA8R6MDdjReMFCsHbBfslvrXl47UdC50Ya-M9EGYtQ6P8MjjoU6sK2C3CcuyS0SnP9F-crGrb5tNjw48O8zZsQrevIhIPkrFG1EPJ7UqIM97RJ0qxbCD9Ry0D6d9nZALlTf3",
    "shoe_detail": "https://lh3.googleusercontent.com/aida-public/AB6AXuAhlO_uaRAsa8xOWrxcLrqbz5DGVVaITfdwcgi2E2FLlCGEIfdd-ilxWfggzYR0HdnTue3KVGQP4VkqL6G0HpQupTH4jKSYPVfGRXs1iQ4UVt5Kd_8OwAaSC5kJM8MXOKB9IKinNU0SOwjZthCzFJ20Vv1Oafjb8sTzeeNaNq9FHplJJ0V6Tw8JzYNphZLGGY-X6VY5OFKCaLOq9atn7Vs7Y3FH8WUiFnwkDzMFVAY1PlIBgqtK7CXp",
    "shoe_tread": "https://lh3.googleusercontent.com/aida-public/AB6AXuD0BsLZeGgWDLSnUM037ZpXplvL8__sRq_uNDMxwYegaMqxin1LwPVeTG_8hgIMn7lUnwnX54C6ZxEyBIAgDdOv1lV8sJx8IDSGjPJmLZ4T6WWc7wjW_VBVb4lUSj8tQwMWAVBPs6hFrCy5BiC2LZorTb2y57fpRjXhKIeVV8ifMWtgRYSDt_MHBYbZnmA8qPTaJHVYxlbFD4WM9Ib5dcyLYi-cZFposYQ7_VIC2Dmk0rvvMzxHgV4H",
    "serve_grass": "https://lh3.googleusercontent.com/aida-public/AB6AXuBkM3HglH3BvpsJZINWzxnaX4v7C6vPhVoUokQyDwMzNfevtsjdPCeQxHEiUsI5SAdSpsHHsZYWVwJEzms62qbJXg7LIvZ_DBvlWgdVIDc7eidcex6xO0MM_rIj7d1sGF_xQZ72l5QblHjsqiW2Pb41VSAZoaMkSDEIQwTEQUnLobVEwO-_ZbInKRQNL93F64vKwqK2IZz1hQTLsTtKrnEHkRJaUG0UucU24KShaN3qae3UlmtsGbqV",
    "strings": "https://lh3.googleusercontent.com/aida-public/AB6AXuC9ATMlydqwJPHhCW87XXYSGr3q_A1kdRTsI1-5Ej7D3TUt-cCppi-QS2_jT_w0ZYlkwS5xlRkaJ-r8giz2_cdYlRUxn4e91P1NtN1_XZTvizeW2eyx8viBXtVbP_Vistkz4Ne79UEchZoF_2_yCPrgHnofenRygN0OQSmI_vqXz61r6KwSQH9Htq-YGJDWa6eG5Z6DC3GPfx3Q92y5PpnCGJhKilUXMek0DjdvuVJvtRNvwPwTK41t",
    "smash": "https://lh3.googleusercontent.com/aida-public/AB6AXuAcE5iH3mVI7tZ_WudsAhzdY1HVTSN5miwfM5TDpoUSBEv9T4269_fKRb1Lh420oUlgw08UnV09_xdwcOuzh4JFnuxE33RUiyT7sxSVB5smv09njMPrIy2y9Wl_rLkIEDKIk-1ssZKj18LE3WRf4eXwm2kfr1IECSu5zAnpcV5mjxC2Qb-ATcTA_bSJtT-maCBEXVr7bIQP0onGyIlLaDJncXlYe95bMMh1BJUfNU-2qG614WQNWqME",
    "ball": "https://lh3.googleusercontent.com/aida-public/AB6AXuDCxt2db81VE-aevCXhLsMXyxZIC4N9itafxPouq08ISU4DFuaVmSPyLSdgXuOwypg28hdwHgthiwupIpHzLoGfRohIVivmFV9hzd4ekh7OluO59vBtWvxVlW2FMP3y7n5ulPiIpKWeR3WhA9vzXu2yJizXojuIFTGrfN-deKKE1u86CfIhCEN20j8cFL1iR5znQkTI-DTeAAxvR91aGsPWo-WiLgHLyiMQ4LwzNTmTJrE1yL1nY9oS",
    "polo_folded": "https://lh3.googleusercontent.com/aida-public/AB6AXuBpZKbQFBEYs49fTbDJFr7W3pb3l5Qx_plJguL2CXinRCAp-SFO5lNX_xoi1drb_4PcqsB_A3NGzpCxH7miCGSDEgaCCBHw82LDnCZWRLmkf3FK6AI2OMciKMEGS4g50Dmc8jmMDBFLasISPMYWrxB39YI-mRRuNmOg4xgHFw3Vz0G1uDgSww1AF-1opu22I1cnird7E00RD3hTHDVFZWGd7-FnSsX1QcupDTykleDSlFx0wrunkIaR",
    "panoramic_court": "https://lh3.googleusercontent.com/aida-public/AB6AXuAhy6kGmuRo7EFB6ZIjfjrU8Msvks5v5saemhdbtsMX8aSj3IV9VAhq9EoZPCK7oGugOnzScKxbanqZQhF4HcDKlVA0CwYxRCzyekvm6EBkjw-04TZdOaACA7V9f4UIqY_Qb4rt8qv0HeFRYEHxHvAfhAzb5b_5qoujtC1z1jzqtldSej8WNy92r78uQvm_Bmc9CzjFu7_kz1AUep0pXZpIQj2YRKs09g96FqS7w30oV50jfHuosSiW",
    "forehand": "https://lh3.googleusercontent.com/aida-public/AB6AXuAlFzIjdTNAxLwnoPmBxiCyYpGrdA2eW3rUftmtNzTt9r5nMYZTv7zomZmh-zhWtUJB6zQmr1DJmTYed4OdvFGxqzd6vzDrZdu0v2YI0JfBQRpodEp87h5RlPZ87htNH4-kWNb7f3fu8_SKkGTW4SxfjTefgnHE9-MivAvWnfvzkeoBu__JCz6QicMyDVIKub9bDXoaBM7DwPlO6h16K2_htsZqDaURSvsibupQxhBV7uP3Kc0BxM_A",
}

CATEGORIES = [
    ("tennis-polos", "TENNIS POLOS"),
    ("pleated-skirts", "PLEATED SKIRTS"),
    ("court-shorts", "COURT SHORTS"),
    ("racquet-bags", "RACQUET BAGS"),
    ("outerwear", "OUTERWEAR"),
    ("tops", "TOPS"),
    ("bottoms", "BOTTOMS"),
    ("accessories", "ACCESSORIES"),
    ("footwear", "FOOTWEAR"),
    ("dresses", "DRESSES"),
]

APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"]
SHOE_SIZES = ["8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5"]
WHITE = {"name": "OPTIC WHITE", "hex": "#ffffff"}
GREEN = {"name": "FOREST GREEN", "hex": "#2C5530"}
NAVY = {"name": "NAVY", "hex": "#1B263B"}
STEALTH = {"name": "STEALTH / WHITE", "hex": "#121212"}
CLAY = {"name": "CLAY", "hex": "#c05a3b"}

SEED_TENANT_ID: int | None = None


def _media(db, key: str) -> Media:
    url = IMG[key]
    media = db.execute(select(Media).where(Media.url == url)).scalar_one_or_none()
    if media is None:
        media = Media(filename=key, object_key=f"seed/{key}", url=url, content_type="image/jpeg", size=0)
        if SEED_TENANT_ID is not None:
            media.tenant_id = SEED_TENANT_ID
        db.add(media)
        db.flush()
    return media


def _product(
    db,
    tenant_id: int,
    slug: str,
    name: str,
    price: float,
    category: str,
    collection: Collection | None,
    image_key: str,
    badge: str | None = None,
    subtitle: str = "",
    description: str = "",
    colors=None,
    sizes=None,
    tech_specs=None,
    features=None,
    is_featured: bool = False,
):
    cat = db.execute(
        select(Category).where(Category.name == category, Category.tenant_id == tenant_id)
    ).scalar_one()
    media = _media(db, image_key)
    product = Product(
        tenant_id=tenant_id,
        slug=slug,
        name=name,
        subtitle=subtitle,
        price=price,
        category_id=cat.id,
        collection_id=collection.id if collection else None,
        badge=badge,
        description=description,
        colors=colors or [WHITE],
        sizes=sizes or APPAREL_SIZES,
        tech_specs=tech_specs or [],
        features=features or [],
        is_active=True,
        is_featured=is_featured,
    )
    db.add(product)
    db.flush()
    db.add(
        ProductImage(product_id=product.id, media_id=media.id, url=media.url, alt=name, position=0)
    )
    return product


def _ensure_tenant(db) -> Tenant:
    slug = settings.DEFAULT_TENANT_SLUG or "shop1"
    tenant = db.scalar(select(Tenant).where(Tenant.slug == slug))
    if tenant is None:
        tenant = Tenant(slug=slug, name=slug.replace("-", " ").title())
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    return tenant


SLUG_UNIQUE_MODELS = [Category, Collection, Product, Page, BlogPost]


def _rebuild_slug_tables(db):
    """Drop legacy table-level UNIQUE(slug) constraints so slugs are unique per-tenant.

    The pre-multi-tenant schema enforced globally-unique slugs. The tenant migration
    added a tenant_id column but never removed that constraint, which blocks reuse
    of slugs (e.g. "about-us", "tops") across tenants. Rebuilds affected tables with
    the current model schema (per-tenant UniqueConstraint(tenant_id, slug)).
    """
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
    cols = {
        r[1] for r in db.execute(text(f"PRAGMA table_info({table})")).fetchall()
    }
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
    db.execute(text("UPDATE home_content SET hero_image_ids='[]' WHERE hero_image_ids IS NULL"))
    db.commit()
    _add_column_if_missing(db, "pages", "gradient", "BOOLEAN DEFAULT 1")
    _add_column_if_missing(db, "pages", "hero_text_color", "VARCHAR(20) DEFAULT '#1c1917'")
    _add_column_if_missing(db, "blog_posts", "gradient", "BOOLEAN DEFAULT 1")
    _add_column_if_missing(db, "blog_posts", "hero_text_color", "VARCHAR(20) DEFAULT '#1c1917'")
    _backfill_media_tenant(db, tenant_id)
    _rewrite_media_urls(db)
    _rebuild_slug_tables(db)


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
    """Rewrite stored media URLs to the current public base URL (e.g. after changing domains)."""
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


def _ensure_admin_user(db, tenant_id: int):
    user = db.scalar(select(User).where(User.tenant_id == tenant_id, User.username == "admin"))
    if user is None:
        user = User(
            tenant_id=tenant_id,
            username="admin",
            password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
        )
        db.add(user)
        db.commit()


def run():
    global SEED_TENANT_ID
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    tenant = _ensure_tenant(db)
    _migrate_existing(db, tenant.id)
    _ensure_admin_user(db, tenant.id)
    TENANT_ID = tenant.id
    SEED_TENANT_ID = tenant.id

    if db.scalar(select(Product.id).where(Product.tenant_id == TENANT_ID).limit(1)) is not None:
        db.close()
        print("Seed skipped: data already present.")
        return

    categories = {
        slug: Category(slug=slug, name=name, tenant_id=TENANT_ID)
        for slug, name in CATEGORIES
    }
    db.add_all(categories.values())
    db.flush()

    def cat(name):
        return next(c for c in categories.values() if c.name == name)

    court = Collection(
        tenant_id=TENANT_ID,
        slug="the-court-collection",
        name="THE COURT COLLECTION",
        tagline="ENGINEERED FOR THE GRASS SEASON",
        description="Curated tennis gear engineered for elite performance on grass.",
        hero_image_id=_media(db, "hero_grass").id,
        badge="NEW",
        is_featured=False,
        is_active=True,
        display_order=1,
    )
    new_arrivals = Collection(
        tenant_id=TENANT_ID,
        slug="new-arrivals",
        name="NEW ARRIVALS",
        tagline="THE LATEST DROPS",
        description="Fresh from the design lab.",
        hero_image_id=_media(db, "grand_slam_polo").id,
        is_featured=False,
        is_active=True,
        display_order=2,
    )
    performance = Collection(
        tenant_id=TENANT_ID,
        slug="performance",
        name="PERFORMANCE",
        tagline="TECHNICAL PRECISION",
        description="High-performance gear engineered for the court.",
        hero_image_id=_media(db, "shoe_main").id,
        is_featured=False,
        is_active=True,
        display_order=3,
    )
    lifestyle = Collection(
        tenant_id=TENANT_ID,
        slug="lifestyle",
        name="LIFESTYLE",
        tagline="CLUB HERITAGE",
        description="Off-court elegance rooted in tennis tradition.",
        hero_image_id=_media(db, "serve_grass").id,
        is_featured=False,
        is_active=True,
        display_order=4,
    )
    accessories = Collection(
        tenant_id=TENANT_ID,
        slug="accessories",
        name="ACCESSORIES",
        tagline="THE FINISHING TOUCHES",
        description="Complete the look.",
        hero_image_id=_media(db, "visor").id,
        is_featured=False,
        is_active=True,
        display_order=5,
    )
    pro_court = Collection(
        tenant_id=TENANT_ID,
        slug="pro-court-series",
        name="PRO-COURT SERIES",
        tagline="FOOTWEAR // GRASS SPECIFIC",
        description="Grass-specific footwear engineered for precision movement.",
        hero_image_id=_media(db, "pro_court_shoe").id,
        is_featured=True,
        is_active=True,
        display_order=6,
    )
    tour_bags = Collection(
        tenant_id=TENANT_ID,
        slug="tour-racket-bags",
        name="TOUR RACKET BAGS",
        tagline="ACCESSORIES",
        description="Premium, structured tour racket bags.",
        hero_image_id=_media(db, "tour_bag").id,
        is_featured=True,
        is_active=True,
        display_order=7,
    )
    db.add_all([court, new_arrivals, performance, lifestyle, accessories, pro_court, tour_bags])
    db.flush()

    products = [
        _product(db, TENANT_ID, "club-performance-polo", "CLUB PERFORMANCE POLO", 110.0, "TOPS", new_arrivals, "polo", "NEW", "TOPS", "A crisp white performance tennis polo.", colors=[WHITE], is_featured=True),
        _product(db, TENANT_ID, "heritage-pleated-skirt", "HERITAGE PLEATED SKIRT", 95.0, "PLEATED SKIRTS", court, "skirt_collection", None, "WHITE & GREEN", "Classic pleated white tennis skirt with forest green trim.", colors=[WHITE, GREEN]),
        _product(db, TENANT_ID, "tour-warm-up-jacket", "TOUR WARM-UP JACKET", 185.0, "OUTERWEAR", new_arrivals, "jacket", "LIMITED", "OUTERWEAR", "White tour warm-up jacket.", colors=[WHITE]),
        _product(db, TENANT_ID, "pro-tennis-visor", "PRO TENNIS VISOR", 35.0, "ACCESSORIES", accessories, "visor", None, "ACCESSORIES", "Classic white tennis visor.", colors=[WHITE]),
        _product(db, TENANT_ID, "grand-slam-polo", "GRAND SLAM POLO", 110.0, "TENNIS POLOS", court, "grand_slam_polo", "NEW", "OPTIC WHITE", "A crisp, high-performance tennis polo built for match day.", colors=[WHITE, GREEN], is_featured=True),
        _product(db, TENANT_ID, "advantage-court-short", "ADVANTAGE COURT SHORT", 85.0, "COURT SHORTS", court, "court_short", "BESTSELLER", "OPTIC WHITE", "Tailored white court shorts with deep ball pockets.", colors=[WHITE]),
        _product(db, TENANT_ID, "pro-tour-racquet-bag", "PRO TOUR RACQUET BAG", 180.0, "RACQUET BAGS", tour_bags, "pro_tour_bag", None, "FOREST GREEN", "A sleek, structured racquet bag in forest green and white.", colors=[GREEN, WHITE]),
        _product(db, TENANT_ID, "aero-performance-dress", "AERO PERFORMANCE DRESS", 135.0, "DRESSES", court, "aero_dress", None, "NAVY", "Navy high-performance tennis dress.", colors=[NAVY]),
        _product(db, TENANT_ID, "tour-racket-bag", "TOUR RACKET BAG", 165.0, "RACQUET BAGS", tour_bags, "tour_bag", "BESTSELLER", "RACQUET BAGS", "A sleek, high-end tennis racket bag.", colors=[GREEN]),
        _product(
            db, TENANT_ID, "grassmaster-prime", "GRASSMASTER PRIME", 260.0, "FOOTWEAR", pro_court, "shoe_detail", "LIMITED", "GRASS SPECIFIC", "A grass-specific court shoe with a herringbone tread engineered for explosive lateral movement.", colors=[WHITE, GREEN], sizes=SHOE_SIZES, is_featured=True,
        ),
        _product(db, TENANT_ID, "heritage-club-crew", "HERITAGE CLUB CREW", 145.0, "OUTERWEAR", lifestyle, "serve_grass", None, "CLUB HERITAGE", "An elegant off-court crew sweater cut for club heritage.", colors=[WHITE, NAVY]),
        _product(
            db,
            TENANT_ID,
            "apex-court-v1-prime",
            "APEX COURT-V1 PRIME",
            240.0,
            "FOOTWEAR",
            performance,
            "shoe_main",
            "NEW ARRIVAL",
            "STEALTH / WHITE",
            "Engineered for absolute baseline dominance. The COURT-V1 utilizes a reinforced lateral stability chassis paired with a multi-surface grip compound for explosive direction changes and relentless rallying power.",
            colors=[STEALTH, CLAY, WHITE],
            sizes=SHOE_SIZES,
            tech_specs=[
                {"label": "OUTSOLE", "value": "MULTI-SURFACE HERRINGBONE"},
                {"label": "STABILITY", "value": "TPU LATERAL WING"},
                {"label": "UPPER", "value": "ENDURANCE MESH PRO"},
            ],
            features=[
                {"icon": "balance", "title": "LATERAL LOCKDOWN", "description": "A reinforced TPU chassis provides essential stability during aggressive side-to-side movements, preventing ankle roll on hard stops."},
                {"icon": "sports_tennis", "title": "ALL-COURT TRACTION", "description": "The durable rubber compound and modified herringbone tread ensure optimal grip and slide control on both hard court and clay surfaces."},
                {"icon": "air", "title": "ENDURANCE MESH", "description": "Highly breathable, abrasion-resistant upper materials keep feet cool during five-set matches while withstanding toe-drag friction."},
            ],
            is_featured=True,
        ),
    ]
    db.add_all(products)
    db.flush()

    apex = db.execute(
        select(Product).where(
            Product.slug == "apex-court-v1-prime", Product.tenant_id == TENANT_ID
        )
    ).scalar_one()
    db.add_all(
        [
            ProductImage(product_id=apex.id, media_id=_media(db, "shoe_detail").id, url=IMG["shoe_detail"], alt="Detail mesh", position=1),
            ProductImage(product_id=apex.id, media_id=_media(db, "shoe_tread").id, url=IMG["shoe_tread"], alt="Tread pattern", position=2),
        ]
    )

    home = HomeContent(
        tenant_id=TENANT_ID,
        hero_kicker="THE GRASS SEASON",
        hero_title="OWN THE COURT",
        hero_subtitle="ENGINEERED FOR ELITE PERFORMANCE ON THE GRASS. PRECISION, ELEGANCE, AND UNYIELDING POWER.",
        hero_image_id=_media(db, "hero_grass").id,
        hero_primary_cta="SHOP COLLECTION",
        hero_primary_url="/collections/the-court-collection",
        hero_secondary_cta="EXPLORE TECH",
        hero_secondary_url="/brand",
        master_title="MASTER\nTHE GAME",
        master_description="Our latest collection bridges the gap between classic club elegance and modern athletic performance. Built for the modern player who respects tradition.",
        master_media_id=_media(db, "forehand").id,
        features=[
            {"index": "01", "title": "LIGHTWEIGHT BREATHABILITY"},
            {"index": "02", "title": "PRECISION TAILORING"},
            {"index": "03", "title": "FOUR-WAY STRETCH"},
        ],
    )
    db.add(home)
    db.flush()

    editorial = [
        EditorialItem(tenant_id=TENANT_ID, kind="image", title="Carbon Tension", subtitle="PRECISION SERIES", media_id=_media(db, "strings").id, link_text="VIEW COLLECTION", link_url="/collections/performance", position=1),
        EditorialItem(tenant_id=TENANT_ID, kind="quote", quote='"Every point is a calculation. Every swing, a testament to physics."', author="— Elena R., Grand Slam Champion", position=2),
        EditorialItem(tenant_id=TENANT_ID, kind="image", title="Air Supremacy", subtitle="AERO DYNAMICS", media_id=_media(db, "smash").id, link_text="SHOP LIFESTYLE", link_url="/collections/lifestyle", position=3),
        EditorialItem(
            tenant_id=TENANT_ID,
            kind="product_grid",
            position=4,
            content=[
                {"url": IMG["ball"], "alt": "Tennis ball and court line", "link_text": "TECH SPECS", "link_url": "/products/apex-court-v1-prime"},
                {"url": IMG["polo_folded"], "alt": "Folded tennis polo", "link_text": "FABRIC TECH", "link_url": "/products/club-performance-polo"},
            ],
        ),
        EditorialItem(tenant_id=TENANT_ID, kind="image", title="Master the Surface", subtitle="COURT EXCELLENCE", media_id=_media(db, "panoramic_court").id, link_text="GEAR UP", link_url="/collections", position=5),
    ]
    db.add_all(editorial)
    db.flush()

    def _block(block_type: str, data: dict, position: int) -> PageBlock:
        return PageBlock(block_type=block_type, data=data, position=position)

    pages = [
        Page(
            tenant_id=TENANT_ID,
            slug="about-us",
            title="ABOUT US",
            subtitle="The story, craft, and people behind the Eden Dress.",
            hero_image_id=_media(db, "hero_grass").id,
            is_active=True,
            show_in_nav=True,
            nav_label="ABOUT",
            position=1,
            blocks=[
                _block("heading", {"text": "OUR STORY"}, 1),
                _block(
                    "text",
                    {"body": "INSPO began with a simple belief: clothing should move with you. The Eden Dress is a study in precision — recycled performance crepe, sculpted seams, and a drape that follows every line. Cut in small batches, finished by hand."},
                    2,
                ),
                _block("image", {"url": IMG["serve_grass"], "caption": "The Eden Dress in forest green"}, 3),
                _block("heading", {"text": "WHY EDEN"}, 4),
                _block("list", {"items": ["RECYCLED PERFORMANCE CREPE", "PRECISION SEAMS", "DESIGNED IN SMALL BATCHES"]}, 5),
                _block("quote", {"quote": "Movement, elegance, and confidence — cut from a single line of fabric.", "author": "— INSPO STUDIO"}, 6),
                _block("cta", {"label": "SHOP THE EDEN DRESS", "url": "/collections/eden-collection"}, 7),
            ],
        ),
        Page(
            tenant_id=TENANT_ID,
            slug="blogs",
            title="JOURNAL",
            subtitle="Stories, notes, and behind-the-seams from the studio.",
            hero_image_id=_media(db, "panoramic_court").id,
            is_active=True,
            show_in_nav=True,
            nav_label="BLOGS",
            position=2,
            blocks=[],
        ),
    ]
    db.add_all(pages)
    db.flush()

    blog_posts = [
        BlogPost(
            tenant_id=TENANT_ID,
            slug="the-making-of-eden",
            title="The Making of the Eden Dress",
            excerpt="How recycled crepe, precision seams, and three colorways became a single silhouette.",
            cover_image_id=_media(db, "aero_dress").id,
            is_active=True,
            published_at=datetime(2026, 1, 15),
            content=[
                {"type": "text", "data": {"body": "Every Eden Dress begins with the fabric: a recycled performance crepe that drapes like a day dress and moves like an athletic piece."}},
                {"type": "image", "data": {"url": IMG["serve_grass"], "caption": "Draping in the studio"}},
                {"type": "text", "data": {"body": "Three colorways — blue, green, pink — each cut on the same block, finished by hand."}},
            ],
        ),
        BlogPost(
            tenant_id=TENANT_ID,
            slug="a-midi-for-everywhere",
            title="A Midi for Everywhere",
            excerpt="From the court to the city — why the midi length is the new uniform.",
            cover_image_id=_media(db, "grand_slam_polo").id,
            is_active=True,
            published_at=datetime(2026, 2, 2),
            content=[
                {"type": "text", "data": {"body": "The midi length sits at the perfect midpoint: elegant enough for dinner, easy enough for a full day in motion."}},
                {"type": "cta", "data": {"label": "SHOP THE EDEN DRESS", "url": "/collections/eden-collection"}},
            ],
        ),
    ]
    db.add_all(blog_posts)
    db.flush()

    db.add(SiteSettings(tenant_id=TENANT_ID, site_name="INSPO"))

    db.commit()
    db.close()
    print("Seed complete: categories, collections, products, home content, and editorial seeded.")


if __name__ == "__main__":
    run()
