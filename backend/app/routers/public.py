from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import (
    BlogPost,
    Category,
    Collection,
    EditorialItem,
    HomeContent,
    Media,
    Page,
    Product,
    ShopQuiz,
    SiteSettings,
    Tenant,
)
from ..schemas import (
    BlogPostOut,
    BlogPostSummaryOut,
    CategoryOut,
    CollectionOut,
    EditorialOut,
    EditorialItemOut,
    HomeOut,
    MediaOut,
    PageNavOut,
    PageOut,
    ProductImageOut,
    ProductListOut,
    ProductOut,
    QuizMatchProductOut,
    QuizNavOut,
    ShopQuizOut,
    ShopQuizPublicOut,
    SitePublic,
)
from ..home_sections import latest_drops_fetch_limit, normalize_home_sections
from ..security import get_tenant

router = APIRouter(prefix="/api", tags=["public"])

EDITORIAL_HERO = {
    "title": "THE EDEN COLLECTION",
    "title_vi": "BỘ SƯU TẬP EDEN",
    "subtitle": (
        "A study in precision — recycled crepe, sculpted seams, and a drape "
        "that follows every line. Three colorways, one silhouette."
    ),
    "subtitle_vi": (
        "Một nghiên cứu về sự tinh xảo — vải crepe tái chế, đường may tạo khối, "
        "và lớp vải rũ ôm theo từng đường nét. Ba màu, một dáng đầm."
    ),
    "cta": "Explore Heritage & Innovation",
    "cta_vi": "Khám phá Di sản & Đổi mới",
}


def _vi_list(items: list | None, mapping: list[tuple[str, str]]):
    if not items:
        return items or []
    out = []
    for item in items:
        if isinstance(item, dict):
            it = dict(item)
            for en_key, vi_key in mapping:
                if it.get(vi_key):
                    it[en_key] = it[vi_key]
                it.pop(vi_key, None)
            out.append(it)
        else:
            out.append(item)
    return out


def _localize_home_feature_list(items: list | None, lang: str) -> list:
    """Master panel featured rows: pick title by lang (vi falls back to en)."""
    out = []
    for item in items or []:
        if not isinstance(item, dict):
            out.append(item)
            continue
        row = dict(item)
        if lang == "vi":
            row["title"] = (row.get("title_vi") or row.get("title") or "").strip() or (row.get("title") or "")
        else:
            row["title"] = row.get("title") or ""
        row.pop("title_vi", None)
        out.append(row)
    return out


def _vi_dict(data: dict | None, mapping: list[tuple[str, str]]):
    if not data:
        return data or {}
    it = dict(data)
    for en_key, vi_key in mapping:
        if it.get(vi_key):
            it[en_key] = it[vi_key]
        it.pop(vi_key, None)
    return it


BLOCK_DATA_VI = {
    "heading": [("text", "text_vi")],
    "text": [("body", "body_vi")],
    "image": [("caption", "caption_vi")],
    "quote": [("quote", "quote_vi"), ("author", "author_vi")],
    "list": [("items", "items_vi")],
    "cta": [("label", "label_vi")],
}


def _localize_block_data(data: dict | None, block_type: str | None = None):
    mapping = BLOCK_DATA_VI.get(block_type or "", [("body", "body_vi")])
    return _vi_dict(data, mapping)


def _load_collection(db: Session, collection: Collection, lang: str = "en") -> CollectionOut:
    stmt = (
        select(Product)
        .options(
            selectinload(Product.images),
            selectinload(Product.category),
            selectinload(Product.categories),
        )
        .where(Product.collection_id == collection.id, Product.is_active.is_(True))
        .order_by(Product.created_at.desc())
    )
    if collection.slug in ("baseline-gear",):
        rackets = db.scalar(
            select(Category).where(Category.tenant_id == collection.tenant_id, Category.slug == "rackets")
        )
        if rackets is not None:
            stmt = stmt.where(Product.category_id != rackets.id)
    products = db.execute(stmt).scalars().all()
    products = sorted(products, key=_product_hot_rank)
    data = CollectionOut.model_validate(collection).model_dump()
    if lang == "vi":
        data["name"] = data["name_vi"] or data["name"]
        data["tagline"] = data["tagline_vi"] or data["tagline"]
        data["description"] = data["description_vi"] or data["description"]
    data["products"] = [_load_product(db, p, lang) for p in products]
    return CollectionOut.model_validate(data)


def _load_product(db: Session, product: Product, lang: str = "en") -> ProductOut:
    data = ProductOut.model_validate(product).model_dump()
    if lang == "vi":
        data["name"] = data["name_vi"] or data["name"]
        data["subtitle"] = data["subtitle_vi"] or data["subtitle"]
        data["description"] = data["description_vi"] or data["description"]
        data["tech_specs"] = _vi_list(
            data["tech_specs"], [("label", "label_vi"), ("value", "value_vi")]
        )
        data["features"] = _vi_list(
            data["features"], [("title", "title_vi"), ("description", "description_vi")]
        )
    data["images"] = [
        ProductImageOut.model_validate(i) for i in product.images if i.enabled
    ]
    return ProductOut.model_validate(data)


@router.get("/home", response_model=HomeOut)
def get_home(
    lang: str = "vi",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    lang = "vi" if lang == "vi" else "en"
    home = db.scalar(select(HomeContent).where(HomeContent.tenant_id == tenant.id))
    if home is None:
        home = HomeContent(tenant_id=tenant.id)
        db.add(home)
        db.commit()
        db.refresh(home)

    def loc(en, vi):
        return (vi or en) if lang == "vi" else en

    sections = normalize_home_sections(home.sections)
    latest_limit = latest_drops_fetch_limit(sections)

    trending = (
        db.execute(
            select(Collection)
            .options(selectinload(Collection.hero_media))
            .where(
                Collection.tenant_id == tenant.id,
                Collection.is_featured.is_(True),
                Collection.is_active.is_(True),
            )
            .order_by(Collection.display_order, Collection.name)
        )
        .scalars()
        .all()
    )
    latest = (
        db.execute(
            select(Product)
            .options(
                selectinload(Product.images),
                selectinload(Product.category),
                selectinload(Product.categories),
            )
            .where(Product.tenant_id == tenant.id, Product.is_active.is_(True))
            .order_by(Product.created_at.desc())
            .limit(latest_limit)
        )
        .scalars()
        .all()
    )

    hero_image = home.hero_media.url if home.hero_media else None
    master_media_obj = home.master_media
    master_image = master_media_obj.url if master_media_obj else None
    master_media_type = _media_kind(master_media_obj)

    carousel_images = []
    carousel_slides: list[dict[str, str | None]] = []
    if home.hero_image_ids:
        media_list = db.execute(
            select(Media).where(Media.id.in_(home.hero_image_ids))
        ).scalars().all()
        by_id = {m.id: m for m in media_list}
        for mid in home.hero_image_ids:
            m = by_id.get(mid)
            if m is None:
                continue
            carousel_images.append(m.url)
            carousel_slides.append({"url": m.url, "media_type": _media_kind(m)})

    hero = {
        "kicker": loc(home.hero_kicker, home.hero_kicker_vi),
        "title": loc(home.hero_title, home.hero_title_vi),
        "subtitle": loc(home.hero_subtitle, home.hero_subtitle_vi),
        "image": hero_image,
        "gradient": home.hero_gradient,
        "text_color": home.hero_text_color,
        "carousel": home.hero_carousel,
        "images": carousel_images,
        "slides": carousel_slides,
        "interval": home.hero_carousel_interval,
        "colors": home.hero_colors or {},
        "primary_cta": loc(home.hero_primary_cta, home.hero_primary_cta_vi),
        "primary_url": home.hero_primary_url,
        "secondary_cta": loc(home.hero_secondary_cta, home.hero_secondary_cta_vi),
        "secondary_url": home.hero_secondary_url,
    }
    master = {
        "title": loc(home.master_title, home.master_title_vi),
        "description": loc(home.master_description, home.master_description_vi),
        "media": master_image,
        "media_type": master_media_type,
        "features": _localize_home_feature_list(home.features or [], lang),
        "trending_title": loc(home.trending_title, home.trending_title_vi),
        "trending_view_all_label": loc(
            home.trending_view_all_label, home.trending_view_all_label_vi
        ),
        "trending_view_all_url": home.trending_view_all_url,
        "latest_drops_title": loc(home.latest_drops_title, home.latest_drops_title_vi),
    }

    return HomeOut(
        hero=hero,
        trending=[_load_collection(db, c, lang) for c in trending],
        latest_drops=[_load_product(db, p, lang) for p in latest],
        master=master,
        sections=sections,
    )


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    categories = (
        db.execute(
            select(Category)
            .where(
                Category.tenant_id == tenant.id,
                ~Category.slug.like("brand-%"),
            )
            .order_by(Category.name)
        )
        .scalars()
        .all()
    )
    if lang != "vi":
        return categories
    out = []
    for c in categories:
        data = CategoryOut.model_validate(c).model_dump()
        data["name"] = data["name_vi"] or data["name"]
        out.append(CategoryOut.model_validate(data))
    return out


@router.get("/collections", response_model=list[CollectionOut])
def list_collections(
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    collections = (
        db.execute(
            select(Collection)
            .options(selectinload(Collection.hero_media))
            .where(
                Collection.tenant_id == tenant.id,
                Collection.is_active.is_(True),
            )
            .order_by(Collection.display_order, Collection.name)
        )
        .scalars()
        .all()
    )
    return [_load_collection(db, c, lang) for c in collections]


@router.get("/collections/{slug}", response_model=CollectionOut)
def get_collection(
    slug: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    collection = (
        db.execute(
            select(Collection)
            .options(selectinload(Collection.hero_media))
            .where(
                Collection.tenant_id == tenant.id,
                Collection.slug == slug,
                Collection.is_active.is_(True),
            )
        )
        .scalar_one_or_none()
    )
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    return _load_collection(db, collection, lang)


@router.get("/products/brands", response_model=list[str])
def list_product_brands(
    category: str | None = None,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    stmt = (
        select(Product.brand)
        .where(
            Product.tenant_id == tenant.id,
            Product.is_active.is_(True),
            Product.brand.isnot(None),
            Product.brand != "",
        )
        .distinct()
    )
    if category:
        cat = db.execute(
            select(Category).where(
                Category.tenant_id == tenant.id, Category.slug == category
            )
        ).scalar_one_or_none()
        if cat is None:
            raise HTTPException(status_code=404, detail="Category not found")
        stmt = stmt.where(
            (Product.category_id == cat.id)
            | Product.categories.any(Category.id == cat.id)
        )
    brands = db.execute(stmt.order_by(Product.brand)).scalars().all()
    return [b for b in brands if b]


def _product_hot_rank(product: Product) -> tuple:
    """Hot (featured) and bestseller first; lower list_order = higher in list."""
    created_ts = product.created_at.timestamp() if product.created_at else 0.0
    order = int(getattr(product, "list_order", 0) or 0)
    return (
        0 if product.is_featured else 1,
        0 if product.is_bestseller else 1,
        order,
        -created_ts,
    )


def _sort_products(products: list[Product], sort: str) -> list[Product]:
    hot = _product_hot_rank

    def with_hot(tail_key):
        def key(p: Product):
            h = hot(p)
            tail = tail_key(p)
            if isinstance(tail, tuple):
                return h + tail
            return h + (tail,)

        return key

    sort_map = {
        "recommended": hot,
        "newest": with_hot(lambda p: (p.created_at,)),
        "price_asc": with_hot(lambda p: (p.price, p.name.upper())),
        "price_desc": with_hot(lambda p: (-p.price, p.name.upper())),
        "name": with_hot(lambda p: (p.name.upper(),)),
    }
    key_fn = sort_map.get(sort) or sort_map["recommended"]
    return sorted(products, key=key_fn)


def _media_kind(media: Media | None) -> str | None:
    if media is None:
        return None
    ct = (media.content_type or "").lower()
    if ct.startswith("video/"):
        return "video"
    if ct.startswith("image/"):
        return "image"
    url = (media.url or "").lower().split("?")[0]
    if url.endswith((".mp4", ".webm", ".mov", ".m4v")):
        return "video"
    return "image"


@router.get("/products", response_model=ProductListOut)
def list_products(
    collection: str | None = None,
    category: str | None = None,
    brand: str | None = None,
    size: str | None = None,
    color: str | None = None,
    sort: str = "newest",
    q: str | None = None,
    page: int = 1,
    page_size: int = 24,
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    stmt = (
        select(Product)
        .options(
            selectinload(Product.images),
            selectinload(Product.category),
            selectinload(Product.categories),
        )
        .where(Product.tenant_id == tenant.id, Product.is_active.is_(True))
    )
    if collection:
        col = db.execute(
            select(Collection).where(
                Collection.tenant_id == tenant.id, Collection.slug == collection
            )
        ).scalar_one_or_none()
        if col is None:
            raise HTTPException(status_code=404, detail="Collection not found")
        stmt = stmt.where(Product.collection_id == col.id)
        if col.slug in ("baseline-gear",):
            rackets = db.scalar(
                select(Category).where(Category.tenant_id == tenant.id, Category.slug == "rackets")
            )
            if rackets is not None:
                stmt = stmt.where(Product.category_id != rackets.id)
    if category:
        cat = db.execute(
            select(Category).where(
                Category.tenant_id == tenant.id, Category.slug == category
            )
        ).scalar_one_or_none()
        if cat is None:
            raise HTTPException(status_code=404, detail="Category not found")
        stmt = stmt.where(
            (Product.category_id == cat.id)
            | Product.categories.any(Category.id == cat.id)
        )
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    if brand:
        stmt = stmt.where(Product.brand == brand.strip().lower())

    products = db.execute(stmt).scalars().all()

    if size:
        products = [p for p in products if size in (p.sizes or [])]
    if color:
        products = [p for p in products if any(
            c.get("name") == color if isinstance(c, dict) else c == color
            for c in (p.colors or [])
        )]

    products = _sort_products(products, sort)

    page = max(1, page)
    page_size = max(1, min(48, page_size))
    total = len(products)
    total_pages = max(1, (total + page_size - 1) // page_size)
    if page > total_pages:
        page = total_pages
    start = (page - 1) * page_size
    page_items = products[start : start + page_size]

    return ProductListOut(
        items=[_load_product(db, p, lang) for p in page_items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/products/{slug}", response_model=ProductOut)
def get_product(
    slug: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    product = (
        db.execute(
            select(Product)
            .options(
                selectinload(Product.images),
                selectinload(Product.category),
                selectinload(Product.categories),
                selectinload(Product.collection),
            )
            .where(
                Product.tenant_id == tenant.id,
                Product.slug == slug,
                Product.is_active.is_(True),
            )
        )
        .scalar_one_or_none()
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return _load_product(db, product, lang)


@router.get("/brand", response_model=EditorialOut)
def get_brand_experience(
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    items = (
        db.execute(
            select(EditorialItem)
            .options(selectinload(EditorialItem.media))
            .where(
                EditorialItem.tenant_id == tenant.id,
                EditorialItem.is_active.is_(True),
            )
            .order_by(EditorialItem.position, EditorialItem.id)
        )
        .scalars()
        .all()
    )
    hero_media = db.execute(
        select(Media).where(Media.filename == "serve_grass")
    ).scalar_one_or_none()
    if hero_media is None:
        first_image = (
            db.execute(
                select(EditorialItem)
                .options(selectinload(EditorialItem.media))
                .where(
                    EditorialItem.tenant_id == tenant.id,
                    EditorialItem.kind == "image",
                    EditorialItem.is_active.is_(True),
                )
                .order_by(EditorialItem.position, EditorialItem.id)
            )
            .scalars()
            .first()
        )
        if first_image is not None:
            hero_media = first_image.media

    hero_title = EDITORIAL_HERO["title"]
    hero_title_vi = EDITORIAL_HERO["title_vi"]
    hero_subtitle = EDITORIAL_HERO["subtitle"]
    hero_subtitle_vi = EDITORIAL_HERO["subtitle_vi"]
    hero_cta = EDITORIAL_HERO["cta"]
    hero_cta_vi = EDITORIAL_HERO["cta_vi"]

    home = db.scalar(select(HomeContent).where(HomeContent.tenant_id == tenant.id))
    if home is not None and (home.hero_title or home.hero_title_vi):
        hero_title = home.hero_title or hero_title
        hero_title_vi = home.hero_title_vi or hero_title_vi
        hero_subtitle = home.hero_subtitle or hero_subtitle
        hero_subtitle_vi = home.hero_subtitle_vi or hero_subtitle_vi
        hero_cta = home.hero_secondary_cta or hero_cta
        hero_cta_vi = home.hero_secondary_cta_vi or hero_cta_vi
        if home.hero_image_id:
            home_media = db.get(Media, home.hero_image_id)
            if home_media is not None:
                hero_media = home_media

    def loc(en, vi):
        return (vi or en) if lang == "vi" else en

    return EditorialOut(
        hero_title=loc(hero_title, hero_title_vi),
        hero_subtitle=loc(hero_subtitle, hero_subtitle_vi),
        hero_cta=loc(hero_cta, hero_cta_vi),
        hero_image=hero_media.url if hero_media else None,
        hero_gradient=home.hero_gradient if home is not None else True,
        hero_text_color=home.hero_text_color if home is not None else "#1c1917",
        items=[_load_editorial(db, i, lang) for i in items],
    )


def _load_editorial(db: Session, item: EditorialItem, lang: str = "en") -> EditorialItemOut:
    data = EditorialItemOut.model_validate(item).model_dump()
    if lang == "vi":
        for k in ("title", "subtitle", "quote", "author", "caption", "link_text"):
            if data.get(f"{k}_vi"):
                data[k] = data[f"{k}_vi"]
        data["content"] = _vi_list(
            data.get("content") or [], [("alt", "alt_vi"), ("link_text", "link_text_vi")]
        )
    return EditorialItemOut.model_validate(data)


@router.get("/media", response_model=list[MediaOut])
def list_media(db: Session = Depends(get_db), tenant: Tenant = Depends(get_tenant)):
    return [
        MediaOut.model_validate(m)
        for m in db.execute(
            select(Media).where(Media.tenant_id == tenant.id)
        ).scalars().all()
    ]


@router.get("/pages", response_model=list[PageNavOut])
def list_pages(
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    pages = (
        db.execute(
            select(Page)
            .where(
                Page.tenant_id == tenant.id,
                Page.is_active.is_(True),
                Page.show_in_nav.is_(True),
            )
            .order_by(Page.position, Page.id)
        )
        .scalars()
        .all()
    )
    out = []
    for p in pages:
        data = PageNavOut.model_validate(p).model_dump()
        if lang == "vi":
            if data.get("title_vi"):
                data["title"] = data["title_vi"]
            if data.get("nav_label_vi"):
                data["nav_label"] = data["nav_label_vi"]
        out.append(PageNavOut.model_validate(data))
    return out


@router.get("/pages/{slug}", response_model=PageOut)
def get_page(
    slug: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    page = (
        db.execute(
            select(Page)
            .options(selectinload(Page.hero_media), selectinload(Page.blocks))
            .where(
                Page.tenant_id == tenant.id,
                Page.slug == slug,
                Page.is_active.is_(True),
            )
        )
        .scalar_one_or_none()
    )
    if page is None:
        raise HTTPException(status_code=404, detail="Page not found")
    data = PageOut.model_validate(page).model_dump()
    if lang == "vi":
        for k in ("title", "subtitle", "nav_label"):
            if data.get(f"{k}_vi"):
                data[k] = data[f"{k}_vi"]
        blocks = []
        for b in data.get("blocks") or []:
            b["data"] = _localize_block_data(b.get("data"), b.get("block_type"))
            blocks.append(b)
        data["blocks"] = blocks
    return PageOut.model_validate(data)


@router.get("/blog-posts", response_model=list[BlogPostSummaryOut])
def list_blog_posts(
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    posts = (
        db.execute(
            select(BlogPost)
            .options(selectinload(BlogPost.cover_media))
            .where(BlogPost.tenant_id == tenant.id, BlogPost.is_active.is_(True))
            .order_by(BlogPost.published_at.desc().nulls_last(), BlogPost.created_at.desc())
        )
        .scalars()
        .all()
    )
    out = []
    for p in posts:
        data = BlogPostSummaryOut.model_validate(p).model_dump()
        if lang == "vi":
            if data.get("title_vi"):
                data["title"] = data["title_vi"]
            if data.get("excerpt_vi"):
                data["excerpt"] = data["excerpt_vi"]
        out.append(BlogPostSummaryOut.model_validate(data))
    return out


@router.get("/blog-posts/{slug}", response_model=BlogPostOut)
def get_blog_post(
    slug: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    post = (
        db.execute(
            select(BlogPost)
            .options(selectinload(BlogPost.cover_media))
            .where(
                BlogPost.tenant_id == tenant.id,
                BlogPost.slug == slug,
                BlogPost.is_active.is_(True),
            )
        )
        .scalar_one_or_none()
    )
    if post is None:
        raise HTTPException(status_code=404, detail="Blog post not found")
    data = BlogPostOut.model_validate(post).model_dump()
    if lang == "vi":
        if data.get("title_vi"):
            data["title"] = data["title_vi"]
        if data.get("excerpt_vi"):
            data["excerpt"] = data["excerpt_vi"]
        content = []
        for b in data.get("content") or []:
            b["data"] = _localize_block_data(b.get("data"), b.get("type"))
            content.append(b)
        data["content"] = content
    return BlogPostOut.model_validate(data)


def _localize_quiz(data: dict, lang: str) -> dict:
    if lang != "vi":
        return data
    for key in ("title", "subtitle", "nav_label", "hero_kicker"):
        if data.get(f"{key}_vi"):
            data[key] = data[f"{key}_vi"]
    badges = []
    for b in data.get("hero_badges") or []:
        bb = dict(b)
        if bb.get("label_vi"):
            bb["label"] = bb["label_vi"]
        badges.append(bb)
    data["hero_badges"] = badges
    faq = []
    for item in data.get("faq") or []:
        fi = dict(item)
        if fi.get("q_vi"):
            fi["q"] = fi["q_vi"]
        if fi.get("a_vi"):
            fi["a"] = fi["a_vi"]
        faq.append(fi)
    data["faq"] = faq
    steps = []
    for step in data.get("steps") or []:
        st = dict(step)
        for key in ("title", "subtitle", "note"):
            if st.get(f"{key}_vi"):
                st[key] = st[f"{key}_vi"]
        opts = []
        for opt in st.get("options") or []:
            o = dict(opt)
            for key in ("title", "subtitle", "badge"):
                if o.get(f"{key}_vi"):
                    o[key] = o[f"{key}_vi"]
            opts.append(o)
        st["options"] = opts
        steps.append(st)
    data["steps"] = steps
    return data


def _quiz_match_products(db: Session, tenant_id: int, product_filter: dict | None) -> list[QuizMatchProductOut]:
    pf = product_filter or {}
    category_slugs = [str(s).strip() for s in (pf.get("category_slugs") or []) if str(s).strip()]
    require_profile = bool(pf.get("require_finder_profile", True))

    q = (
        select(Product)
        .where(Product.tenant_id == tenant_id, Product.is_active.is_(True))
        .options(selectinload(Product.images), selectinload(Product.categories))
        .order_by(Product.name)
    )
    products = db.execute(q).scalars().all()
    out: list[QuizMatchProductOut] = []
    slug_set = set(category_slugs)
    for p in products:
        profile = p.finder_profile or {}
        if require_profile and not profile.get("enabled"):
            continue
        if slug_set:
            cat_slugs = {c.slug for c in (p.categories or [])}
            if not cat_slugs.intersection(slug_set):
                continue
        image_url = None
        for img in p.images or []:
            if img.enabled:
                image_url = img.url
                break
        if not image_url and p.images:
            image_url = p.images[0].url
        out.append(
            QuizMatchProductOut(
                id=p.id,
                slug=p.slug,
                name=p.name,
                price=float(p.price or 0),
                image_url=image_url,
                finder_profile=profile if profile else None,
            )
        )
    return out


@router.get("/quizzes", response_model=list[QuizNavOut])
def list_quizzes_nav(
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    rows = (
        db.execute(
            select(ShopQuiz)
            .where(
                ShopQuiz.tenant_id == tenant.id,
                ShopQuiz.is_published.is_(True),
            )
            .order_by(ShopQuiz.slug)
        )
        .scalars()
        .all()
    )
    out = []
    for q in rows:
        data = QuizNavOut(
            slug=q.slug,
            title=q.title,
            nav_label=q.nav_label or q.title,
        ).model_dump()
        if lang == "vi":
            if q.title_vi:
                data["title"] = q.title_vi
            if q.nav_label_vi:
                data["nav_label"] = q.nav_label_vi
        out.append(QuizNavOut.model_validate(data))
    return out


@router.get("/quizzes/{slug}", response_model=ShopQuizPublicOut)
def get_quiz(
    slug: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    quiz = db.scalar(
        select(ShopQuiz).where(
            ShopQuiz.tenant_id == tenant.id,
            ShopQuiz.slug == slug,
            ShopQuiz.is_published.is_(True),
        )
    )
    if quiz is None:
        raise HTTPException(status_code=404, detail="Quiz not found")
    data = ShopQuizOut.model_validate(quiz).model_dump()
    data = _localize_quiz(data, lang)
    data["match_products"] = _quiz_match_products(db, tenant.id, quiz.product_filter)
    return ShopQuizPublicOut.model_validate(data)


@router.get("/site", response_model=SitePublic)
def get_site(db: Session = Depends(get_db), tenant: Tenant = Depends(get_tenant)):
    from ..currency import normalize_base_currency

    site = db.scalar(select(SiteSettings).where(SiteSettings.tenant_id == tenant.id))
    if site is None:
        site = SiteSettings(tenant_id=tenant.id)
        db.add(site)
        db.commit()
        db.refresh(site)
    rate = float(site.usd_to_vnd_rate or 24500)
    if rate <= 0:
        rate = 24500.0
    return SitePublic(
        site_name=site.site_name,
        logo_url=site.logo_media.url if site.logo_media else None,
        favicon_url=site.favicon_media.url if site.favicon_media else None,
        nav_items=site.nav_items or [],
        currency_code=normalize_base_currency(site.currency_code),
        usd_to_vnd_rate=rate,
        supported_currencies=["VND"],
    )
