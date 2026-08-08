from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MediaOut(ORMModel):
    id: int
    filename: str
    url: str
    content_type: str
    size: int


class CategoryBase(BaseModel):
    slug: str
    name: str
    name_vi: str | None = None


class CategoryIn(CategoryBase):
    pass


class CategoryOut(CategoryBase, ORMModel):
    id: int


class ProductImageIn(BaseModel):
    media_id: int | None = None
    url: str = ""
    alt: str | None = None
    position: int = 0
    enabled: bool = True


class ProductImageOut(ORMModel):
    id: int
    media_id: int | None
    url: str
    alt: str | None
    position: int
    enabled: bool


class ProductBase(BaseModel):
    slug: str
    name: str
    name_vi: str | None = None
    subtitle: str | None = None
    subtitle_vi: str | None = None
    description: str | None = None
    description_vi: str | None = None
    price: float = 0.0
    category_id: int | None = None
    collection_id: int | None = None
    badge: str | None = None
    gallery_layout: str = "collage"
    colors: list[Any] = Field(default_factory=list)
    sizes: list[Any] = Field(default_factory=list)
    tech_specs: list[Any] = Field(default_factory=list)
    features: list[Any] = Field(default_factory=list)
    is_active: bool = True
    is_featured: bool = False
    is_bestseller: bool = False


class ProductIn(ProductBase):
    images: list[ProductImageIn] = Field(default_factory=list)


class ProductOut(ProductBase, ORMModel):
    id: int
    created_at: datetime
    images: list[ProductImageOut] = Field(default_factory=list)
    category: CategoryOut | None = None
    collection: "CollectionSummary | None" = None


class ProductSummary(ProductOut):
    pass


class CollectionBase(BaseModel):
    slug: str
    name: str
    name_vi: str | None = None
    tagline: str | None = None
    tagline_vi: str | None = None
    description: str | None = None
    description_vi: str | None = None
    hero_image_id: int | None = None
    badge: str | None = None
    is_featured: bool = False
    is_active: bool = True
    display_order: int = 0


class CollectionIn(CollectionBase):
    pass


class CollectionSummary(CollectionBase, ORMModel):
    id: int
    hero_media: MediaOut | None = None


class CollectionOut(CollectionSummary):
    products: list[ProductOut] = Field(default_factory=list)


class HomeContentIn(BaseModel):
    hero_kicker: str = "EDEN COLLECTION"
    hero_kicker_vi: str | None = None
    hero_title: str = "THE EDEN DRESS"
    hero_title_vi: str | None = None
    hero_subtitle: str = ""
    hero_subtitle_vi: str | None = None
    hero_image_id: int | None = None
    hero_primary_cta: str = "SHOP THE DRESS"
    hero_primary_cta_vi: str | None = None
    hero_primary_url: str = "/collections/eden-collection"
    hero_secondary_cta: str = "EXPLORE THE BRAND"
    hero_secondary_cta_vi: str | None = None
    hero_secondary_url: str = "/brand"
    trending_title: str = "THE EDEN COLLECTION"
    trending_title_vi: str | None = None
    trending_view_all_label: str = "VIEW ALL"
    trending_view_all_label_vi: str | None = None
    trending_view_all_url: str = "/collections"
    latest_drops_title: str = "LATEST DROPS"
    latest_drops_title_vi: str | None = None
    master_title: str = "THE EDEN DRESS"
    master_title_vi: str | None = None
    master_description: str = ""
    master_description_vi: str | None = None
    master_media_id: int | None = None
    features: list[Any] = Field(default_factory=list)


class HomeContentOut(HomeContentIn, ORMModel):
    id: int
    hero_media: MediaOut | None = None
    master_media: MediaOut | None = None


class EditorialItemIn(BaseModel):
    kind: str = "image"
    title: str | None = None
    title_vi: str | None = None
    subtitle: str | None = None
    subtitle_vi: str | None = None
    quote: str | None = None
    quote_vi: str | None = None
    author: str | None = None
    author_vi: str | None = None
    caption: str | None = None
    caption_vi: str | None = None
    media_id: int | None = None
    content: list[Any] = Field(default_factory=list)
    link_text: str | None = None
    link_text_vi: str | None = None
    link_url: str | None = None
    position: int = 0
    is_active: bool = True


class EditorialItemOut(EditorialItemIn, ORMModel):
    id: int
    media: MediaOut | None = None


class HomeOut(BaseModel):
    hero: dict[str, Any]
    trending: list[CollectionOut]
    latest_drops: list[ProductOut]
    master: dict[str, Any]


class EditorialOut(BaseModel):
    hero_title: str
    hero_subtitle: str
    hero_cta: str
    hero_image: str | None = None
    items: list[EditorialItemOut]


class PageBlockIn(BaseModel):
    block_type: str = "text"
    data: dict[str, Any] = Field(default_factory=dict)
    position: int = 0


class PageBlockOut(ORMModel):
    id: int
    block_type: str
    data: dict[str, Any]
    position: int


class PageBase(BaseModel):
    slug: str
    title: str
    title_vi: str | None = None
    subtitle: str | None = None
    subtitle_vi: str | None = None
    hero_image_id: int | None = None
    is_active: bool = True
    show_in_nav: bool = True
    nav_label: str | None = None
    nav_label_vi: str | None = None
    position: int = 0


class PageIn(PageBase):
    blocks: list[PageBlockIn] = Field(default_factory=list)


class PageNavOut(ORMModel):
    id: int
    slug: str
    title: str
    title_vi: str | None = None
    nav_label: str | None = None
    nav_label_vi: str | None = None
    position: int


class PageOut(PageBase, ORMModel):
    id: int
    hero_media: MediaOut | None = None
    blocks: list[PageBlockOut] = Field(default_factory=list)


class BlogPostBase(BaseModel):
    slug: str
    title: str
    title_vi: str | None = None
    excerpt: str | None = None
    excerpt_vi: str | None = None
    cover_image_id: int | None = None
    content: list[Any] = Field(default_factory=list)
    is_active: bool = True
    published_at: datetime | None = None


class BlogPostIn(BlogPostBase):
    pass


class BlogPostSummaryOut(BlogPostBase, ORMModel):
    id: int
    cover_media: MediaOut | None = None
    created_at: datetime


class BlogPostOut(BlogPostSummaryOut):
    pass


class SiteSettingsBase(BaseModel):
    site_name: str = "INSPO"
    logo_media_id: int | None = None
    favicon_media_id: int | None = None
    nav_items: list[Any] = Field(default_factory=list)


class SiteSettingsIn(SiteSettingsBase):
    pass


class SiteSettingsOut(SiteSettingsBase, ORMModel):
    id: int
    logo_media: MediaOut | None = None
    favicon_media: MediaOut | None = None


class SitePublic(BaseModel):
    site_name: str
    logo_url: str | None = None
    favicon_url: str | None = None
    nav_items: list[Any] = Field(default_factory=list)


from pydantic import model_validator


class ProductInValidator(ProductIn):
    @model_validator(mode="after")
    def check_slug(self):
        if not self.slug:
            self.slug = ""
        return self


ProductOut.model_rebuild()
