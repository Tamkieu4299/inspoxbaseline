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
    SiteSettings,
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
    ProductOut,
    SitePublic,
)

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
    products = (
        db.execute(
            select(Product)
            .options(selectinload(Product.images), selectinload(Product.category))
            .where(Product.collection_id == collection.id, Product.is_active.is_(True))
            .order_by(Product.created_at.desc())
        )
        .scalars()
        .all()
    )
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
def get_home(lang: str = "en", db: Session = Depends(get_db)):
    home = db.execute(select(HomeContent).limit(1)).scalar_one_or_none()
    if home is None:
        home = HomeContent()
        db.add(home)
        db.commit()
        db.refresh(home)

    def loc(en, vi):
        return (vi or en) if lang == "vi" else en

    trending = (
        db.execute(
            select(Collection)
            .options(selectinload(Collection.hero_media))
            .where(Collection.is_featured.is_(True), Collection.is_active.is_(True))
            .order_by(Collection.display_order, Collection.name)
        )
        .scalars()
        .all()
    )
    latest = (
        db.execute(
            select(Product)
            .options(selectinload(Product.images), selectinload(Product.category))
            .where(Product.is_active.is_(True))
            .order_by(Product.created_at.desc())
            .limit(8)
        )
        .scalars()
        .all()
    )

    hero_image = home.hero_media.url if home.hero_media else None
    master_image = home.master_media.url if home.master_media else None

    hero = {
        "kicker": loc(home.hero_kicker, home.hero_kicker_vi),
        "title": loc(home.hero_title, home.hero_title_vi),
        "subtitle": loc(home.hero_subtitle, home.hero_subtitle_vi),
        "image": hero_image,
        "primary_cta": loc(home.hero_primary_cta, home.hero_primary_cta_vi),
        "primary_url": home.hero_primary_url,
        "secondary_cta": loc(home.hero_secondary_cta, home.hero_secondary_cta_vi),
        "secondary_url": home.hero_secondary_url,
    }
    master = {
        "title": loc(home.master_title, home.master_title_vi),
        "description": loc(home.master_description, home.master_description_vi),
        "media": master_image,
        "features": _vi_list(home.features or [], [("title", "title_vi")]),
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
    )


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(lang: str = "en", db: Session = Depends(get_db)):
    categories = db.execute(select(Category).order_by(Category.name)).scalars().all()
    if lang != "vi":
        return categories
    out = []
    for c in categories:
        data = CategoryOut.model_validate(c).model_dump()
        data["name"] = data["name_vi"] or data["name"]
        out.append(CategoryOut.model_validate(data))
    return out


@router.get("/collections", response_model=list[CollectionOut])
def list_collections(lang: str = "en", db: Session = Depends(get_db)):
    collections = (
        db.execute(
            select(Collection)
            .options(selectinload(Collection.hero_media))
            .where(Collection.is_active.is_(True))
            .order_by(Collection.display_order, Collection.name)
        )
        .scalars()
        .all()
    )
    return [_load_collection(db, c, lang) for c in collections]


@router.get("/collections/{slug}", response_model=CollectionOut)
def get_collection(slug: str, lang: str = "en", db: Session = Depends(get_db)):
    collection = (
        db.execute(
            select(Collection)
            .options(selectinload(Collection.hero_media))
            .where(Collection.slug == slug, Collection.is_active.is_(True))
        )
        .scalar_one_or_none()
    )
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    return _load_collection(db, collection, lang)


@router.get("/products", response_model=list[ProductOut])
def list_products(
    collection: str | None = None,
    category: str | None = None,
    size: str | None = None,
    color: str | None = None,
    sort: str = "newest",
    q: str | None = None,
    lang: str = "en",
    db: Session = Depends(get_db),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.category))
        .where(Product.is_active.is_(True))
    )
    if collection:
        col = db.execute(
            select(Collection).where(Collection.slug == collection)
        ).scalar_one_or_none()
        if col is None:
            raise HTTPException(status_code=404, detail="Collection not found")
        stmt = stmt.where(Product.collection_id == col.id)
    if category:
        cat = db.execute(select(Category).where(Category.slug == category)).scalar_one_or_none()
        if cat is None:
            raise HTTPException(status_code=404, detail="Category not found")
        stmt = stmt.where(Product.category_id == cat.id)
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))

    products = db.execute(stmt).scalars().all()

    if size:
        products = [p for p in products if size in (p.sizes or [])]
    if color:
        products = [p for p in products if any(
            c.get("name") == color if isinstance(c, dict) else c == color
            for c in (p.colors or [])
        )]

    sort_map = {
        "newest": lambda p: (p.created_at,),
        "price_asc": lambda p: (p.price,),
        "price_desc": lambda p: (-p.price,),
        "name": lambda p: (p.name.upper(),),
    }
    products = sorted(products, key=sort_map.get(sort, sort_map["newest"]))

    return [_load_product(db, p, lang) for p in products]


@router.get("/products/{slug}", response_model=ProductOut)
def get_product(slug: str, lang: str = "en", db: Session = Depends(get_db)):
    product = (
        db.execute(
            select(Product)
            .options(
                selectinload(Product.images),
                selectinload(Product.category),
                selectinload(Product.collection),
            )
            .where(Product.slug == slug, Product.is_active.is_(True))
        )
        .scalar_one_or_none()
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return _load_product(db, product, lang)


@router.get("/brand", response_model=EditorialOut)
def get_brand_experience(lang: str = "en", db: Session = Depends(get_db)):
    items = (
        db.execute(
            select(EditorialItem)
            .options(selectinload(EditorialItem.media))
            .where(EditorialItem.is_active.is_(True))
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
                .where(EditorialItem.kind == "image", EditorialItem.is_active.is_(True))
                .order_by(EditorialItem.position, EditorialItem.id)
            )
            .scalars()
            .first()
        )
        if first_image is not None:
            hero_media = first_image.media

    def loc(en, vi):
        return (vi or en) if lang == "vi" else en

    return EditorialOut(
        hero_title=loc(EDITORIAL_HERO["title"], EDITORIAL_HERO["title_vi"]),
        hero_subtitle=loc(EDITORIAL_HERO["subtitle"], EDITORIAL_HERO["subtitle_vi"]),
        hero_cta=loc(EDITORIAL_HERO["cta"], EDITORIAL_HERO["cta_vi"]),
        hero_image=hero_media.url if hero_media else None,
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
def list_media(db: Session = Depends(get_db)):
    return [MediaOut.model_validate(m) for m in db.execute(select(Media)).scalars().all()]


@router.get("/pages", response_model=list[PageNavOut])
def list_pages(lang: str = "en", db: Session = Depends(get_db)):
    pages = (
        db.execute(
            select(Page)
            .where(Page.is_active.is_(True), Page.show_in_nav.is_(True))
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
def get_page(slug: str, lang: str = "en", db: Session = Depends(get_db)):
    page = (
        db.execute(
            select(Page)
            .options(selectinload(Page.hero_media), selectinload(Page.blocks))
            .where(Page.slug == slug, Page.is_active.is_(True))
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
def list_blog_posts(lang: str = "en", db: Session = Depends(get_db)):
    posts = (
        db.execute(
            select(BlogPost)
            .options(selectinload(BlogPost.cover_media))
            .where(BlogPost.is_active.is_(True))
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
def get_blog_post(slug: str, lang: str = "en", db: Session = Depends(get_db)):
    post = (
        db.execute(
            select(BlogPost)
            .options(selectinload(BlogPost.cover_media))
            .where(BlogPost.slug == slug, BlogPost.is_active.is_(True))
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


@router.get("/site", response_model=SitePublic)
def get_site(db: Session = Depends(get_db)):
    site = db.execute(select(SiteSettings).limit(1)).scalar_one_or_none()
    if site is None:
        site = SiteSettings()
        db.add(site)
        db.commit()
        db.refresh(site)
    return SitePublic(
        site_name=site.site_name,
        logo_url=site.logo_media.url if site.logo_media else None,
        favicon_url=site.favicon_media.url if site.favicon_media else None,
        nav_items=site.nav_items or [],
    )
