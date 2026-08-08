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
    PageBlock,
    Product,
    ProductImage,
    SiteSettings,
    Tenant,
)
from ..schemas import (
    BlogPostIn,
    BlogPostOut,
    CategoryIn,
    CategoryOut,
    CollectionIn,
    CollectionOut,
    EditorialItemIn,
    EditorialItemOut,
    HomeContentIn,
    HomeContentOut,
    MediaOut,
    PageIn,
    PageOut,
    ProductIn,
    ProductOut,
    SiteSettingsIn,
    SiteSettingsOut,
)
from ..security import AdminDep

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _apply_collection(collection: Collection, payload: CollectionIn):
    for field, value in payload.model_dump().items():
        setattr(collection, field, value)


def _apply_product(db: Session, product: Product | None, payload: ProductIn, tenant_id: int):
    data = payload.model_dump(exclude={"images"})
    if product is None:
        product = Product(**data, tenant_id=tenant_id)
        db.add(product)
        db.flush()
    else:
        for field, value in data.items():
            setattr(product, field, value)
    for img in payload.images:
        url = img.url
        if img.media_id:
            media = db.get(Media, img.media_id)
            if media:
                url = media.url
        db.add(
            ProductImage(
                product_id=product.id,
                media_id=img.media_id,
                url=url,
                alt=img.alt,
                position=img.position,
                enabled=img.enabled,
            )
        )
    return product


# ---------------- Media ----------------
@router.get("/media", response_model=list[MediaOut])
def list_media(db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    return db.execute(select(Media).order_by(Media.created_at.desc())).scalars().all()


@router.delete("/media/{media_id}")
def delete_media(media_id: int, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    media = db.get(Media, media_id)
    if media is None:
        raise HTTPException(status_code=404, detail="Media not found")
    referenced = (
        db.scalar(select(ProductImage.id).where(ProductImage.media_id == media_id))
        or db.scalar(select(Collection.id).where(Collection.hero_image_id == media_id))
        or db.scalar(select(EditorialItem.id).where(EditorialItem.media_id == media_id))
        or db.scalar(
            select(HomeContent.id).where(
                (HomeContent.hero_image_id == media_id) | (HomeContent.master_media_id == media_id)
            )
        )
        or db.scalar(select(Page.id).where(Page.hero_image_id == media_id))
        or db.scalar(select(BlogPost.id).where(BlogPost.cover_image_id == media_id))
        or db.scalar(
            select(SiteSettings.id).where(
                (SiteSettings.logo_media_id == media_id) | (SiteSettings.favicon_media_id == media_id)
            )
        )
    )
    if referenced:
        raise HTTPException(
            status_code=409,
            detail="Media is still in use by products or pages and cannot be deleted.",
        )
    try:
        from ..minio_client import get_client

        get_client().remove_object(settings.MINIO_BUCKET, media.object_key)
    except Exception:
        pass
    db.delete(media)
    db.commit()
    return {"ok": True}


# ---------------- Categories ----------------
@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    return (
        db.execute(select(Category).where(Category.tenant_id == tenant.id).order_by(Category.name))
        .scalars()
        .all()
    )


@router.post("/categories", response_model=CategoryOut)
def create_category(payload: CategoryIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    category = Category(**payload.model_dump(), tenant_id=tenant.id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int, payload: CategoryIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep
):
    category = db.scalar(
        select(Category).where(Category.id == category_id, Category.tenant_id == tenant.id)
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump().items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    category = db.scalar(
        select(Category).where(Category.id == category_id, Category.tenant_id == tenant.id)
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
    return {"ok": True}


# ---------------- Collections ----------------
@router.get("/collections", response_model=list[CollectionOut])
def list_collections(db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    return [
        CollectionOut.model_validate(
            {**{k: v for k, v in c.__dict__.items() if not k.startswith("_")}, "products": []}
        )
        for c in db.execute(
            select(Collection)
            .where(Collection.tenant_id == tenant.id)
            .order_by(Collection.display_order)
        )
        .scalars()
        .all()
    ]


@router.post("/collections", response_model=CollectionOut)
def create_collection(
    payload: CollectionIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep
):
    collection = Collection(**payload.model_dump(), tenant_id=tenant.id)
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return CollectionOut.model_validate(
        {**{k: v for k, v in collection.__dict__.items() if not k.startswith("_")}, "products": []}
    )


@router.put("/collections/{collection_id}", response_model=CollectionOut)
def update_collection(
    collection_id: int, payload: CollectionIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep
):
    collection = db.scalar(
        select(Collection).where(Collection.id == collection_id, Collection.tenant_id == tenant.id)
    )
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    _apply_collection(collection, payload)
    db.commit()
    db.refresh(collection)
    return CollectionOut.model_validate(
        {**{k: v for k, v in collection.__dict__.items() if not k.startswith("_")}, "products": []}
    )


@router.delete("/collections/{collection_id}")
def delete_collection(collection_id: int, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    collection = db.scalar(
        select(Collection).where(Collection.id == collection_id, Collection.tenant_id == tenant.id)
    )
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    db.delete(collection)
    db.commit()
    return {"ok": True}


# ---------------- Products ----------------
@router.get("/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    return [
        ProductOut.model_validate(p)
        for p in db.execute(
            select(Product)
            .options(selectinload(Product.images))
            .where(Product.tenant_id == tenant.id)
            .order_by(Product.created_at.desc())
        )
        .scalars()
        .all()
    ]


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    product = (
        db.execute(
            select(Product)
            .options(selectinload(Product.images))
            .where(Product.id == product_id, Product.tenant_id == tenant.id)
        )
        .scalars()
        .one_or_none()
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductOut.model_validate(product)


@router.post("/products", response_model=ProductOut)
def create_product(payload: ProductIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    product = _apply_product(db, None, payload, tenant.id)
    db.commit()
    db.refresh(product)
    return ProductOut.model_validate(product)


@router.put("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int, payload: ProductIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep
):
    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.tenant_id == tenant.id)
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for img in list(product.images):
        db.delete(img)
    _apply_product(db, product, payload, tenant.id)
    db.commit()
    db.refresh(product)
    return ProductOut.model_validate(product)


@router.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.tenant_id == tenant.id)
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"ok": True}


# ---------------- Home Content ----------------
@router.get("/home", response_model=HomeContentOut)
def get_home(db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    home = db.scalar(select(HomeContent).where(HomeContent.tenant_id == tenant.id))
    if home is None:
        home = HomeContent(tenant_id=tenant.id)
        db.add(home)
        db.commit()
        db.refresh(home)
    return home


@router.put("/home", response_model=HomeContentOut)
def update_home(payload: HomeContentIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    home = db.scalar(select(HomeContent).where(HomeContent.tenant_id == tenant.id))
    if home is None:
        home = HomeContent(tenant_id=tenant.id)
        db.add(home)
    for field, value in payload.model_dump().items():
        setattr(home, field, value)
    db.commit()
    db.refresh(home)
    return home


# ---------------- Editorial / Brand ----------------
@router.get("/editorial", response_model=list[EditorialItemOut])
def list_editorial(db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    return (
        db.execute(
            select(EditorialItem)
            .where(EditorialItem.tenant_id == tenant.id)
            .order_by(EditorialItem.position, EditorialItem.id)
        )
        .scalars()
        .all()
    )


@router.post("/editorial", response_model=EditorialItemOut)
def create_editorial(payload: EditorialItemIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    item = EditorialItem(**payload.model_dump(), tenant_id=tenant.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/editorial/{item_id}", response_model=EditorialItemOut)
def update_editorial(
    item_id: int, payload: EditorialItemIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep
):
    item = db.scalar(
        select(EditorialItem).where(EditorialItem.id == item_id, EditorialItem.tenant_id == tenant.id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Editorial item not found")
    for field, value in payload.model_dump().items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/editorial/{item_id}")
def delete_editorial(item_id: int, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    item = db.scalar(
        select(EditorialItem).where(EditorialItem.id == item_id, EditorialItem.tenant_id == tenant.id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Editorial item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ---------------- Pages ----------------
def _apply_page(db: Session, page: Page | None, payload: PageIn, tenant_id: int):
    data = payload.model_dump(exclude={"blocks"})
    if page is None:
        page = Page(**data, tenant_id=tenant_id)
        db.add(page)
        db.flush()
    else:
        for field, value in data.items():
            setattr(page, field, value)
    for block in payload.blocks:
        db.add(
            PageBlock(
                page_id=page.id,
                block_type=block.block_type,
                data=block.data,
                position=block.position,
            )
        )
    return page


@router.get("/pages", response_model=list[PageOut])
def list_pages(db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    return (
        db.execute(
            select(Page)
            .options(selectinload(Page.hero_media), selectinload(Page.blocks))
            .where(Page.tenant_id == tenant.id)
            .order_by(Page.position, Page.id)
        )
        .scalars()
        .all()
    )


@router.post("/pages", response_model=PageOut)
def create_page(payload: PageIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    page = _apply_page(db, None, payload, tenant.id)
    db.commit()
    db.refresh(page)
    return PageOut.model_validate(page)


@router.put("/pages/{page_id}", response_model=PageOut)
def update_page(
    page_id: int, payload: PageIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep
):
    page = db.scalar(
        select(Page).where(Page.id == page_id, Page.tenant_id == tenant.id)
    )
    if page is None:
        raise HTTPException(status_code=404, detail="Page not found")
    for block in list(page.blocks):
        db.delete(block)
    _apply_page(db, page, payload, tenant.id)
    db.commit()
    db.refresh(page)
    return PageOut.model_validate(page)


@router.delete("/pages/{page_id}")
def delete_page(page_id: int, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    page = db.scalar(
        select(Page).where(Page.id == page_id, Page.tenant_id == tenant.id)
    )
    if page is None:
        raise HTTPException(status_code=404, detail="Page not found")
    db.delete(page)
    db.commit()
    return {"ok": True}


# ---------------- Blog Posts ----------------
@router.get("/blog-posts", response_model=list[BlogPostOut])
def list_blog_posts(db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    return (
        db.execute(
            select(BlogPost)
            .options(selectinload(BlogPost.cover_media))
            .where(BlogPost.tenant_id == tenant.id)
            .order_by(BlogPost.published_at.desc().nulls_last(), BlogPost.created_at.desc())
        )
        .scalars()
        .all()
    )


@router.post("/blog-posts", response_model=BlogPostOut)
def create_blog_post(payload: BlogPostIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    post = BlogPost(**payload.model_dump(), tenant_id=tenant.id)
    db.add(post)
    db.commit()
    db.refresh(post)
    return BlogPostOut.model_validate(post)


@router.put("/blog-posts/{post_id}", response_model=BlogPostOut)
def update_blog_post(
    post_id: int, payload: BlogPostIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep
):
    post = db.scalar(
        select(BlogPost).where(BlogPost.id == post_id, BlogPost.tenant_id == tenant.id)
    )
    if post is None:
        raise HTTPException(status_code=404, detail="Blog post not found")
    for field, value in payload.model_dump().items():
        setattr(post, field, value)
    db.commit()
    db.refresh(post)
    return BlogPostOut.model_validate(post)


@router.delete("/blog-posts/{post_id}")
def delete_blog_post(post_id: int, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    post = db.scalar(
        select(BlogPost).where(BlogPost.id == post_id, BlogPost.tenant_id == tenant.id)
    )
    if post is None:
        raise HTTPException(status_code=404, detail="Blog post not found")
    db.delete(post)
    db.commit()
    return {"ok": True}


# ---------------- Site Settings / Branding ----------------
def _get_or_create_site(db: Session, tenant_id: int) -> SiteSettings:
    site = db.scalar(select(SiteSettings).where(SiteSettings.tenant_id == tenant_id))
    if site is None:
        site = SiteSettings(tenant_id=tenant_id)
        db.add(site)
        db.commit()
        db.refresh(site)
    return site


@router.get("/site", response_model=SiteSettingsOut)
def get_site_settings(db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    site = _get_or_create_site(db, tenant.id)
    return SiteSettingsOut.model_validate(site)


@router.put("/site", response_model=SiteSettingsOut)
def update_site_settings(
    payload: SiteSettingsIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep
):
    site = _get_or_create_site(db, tenant.id)
    for field, value in payload.model_dump().items():
        setattr(site, field, value)
    db.commit()
    db.refresh(site)
    return SiteSettingsOut.model_validate(site)
