from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class Media(Base, TimestampMixin):
    __tablename__ = "media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    object_key: Mapped[str] = mapped_column(String(500), unique=True)
    url: Mapped[str] = mapped_column(String(1000))
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer, default=0)


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    name_vi: Mapped[str | None] = mapped_column(String(100), nullable=True)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Collection(Base, TimestampMixin):
    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    name_vi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tagline: Mapped[str | None] = mapped_column(String(300), nullable=True)
    tagline_vi: Mapped[str | None] = mapped_column(String(300), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    hero_image_id: Mapped[int | None] = mapped_column(
        ForeignKey("media.id"), nullable=True
    )
    hero_media: Mapped["Media | None"] = relationship("Media", foreign_keys=[hero_image_id])
    badge: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    products: Mapped[list["Product"]] = relationship(back_populates="collection")


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(String(300))
    name_vi: Mapped[str | None] = mapped_column(String(300), nullable=True)
    subtitle: Mapped[str | None] = mapped_column(String(300), nullable=True)
    subtitle_vi: Mapped[str | None] = mapped_column(String(300), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Float, default=0.0)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True
    )
    collection_id: Mapped[int | None] = mapped_column(
        ForeignKey("collections.id"), nullable=True
    )
    badge: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gallery_layout: Mapped[str] = mapped_column(
        String(20), default="collage"
    )  # collage | grid | masonry | slideshow
    colors: Mapped[list] = mapped_column(JSON, default=list)
    sizes: Mapped[list] = mapped_column(JSON, default=list)
    tech_specs: Mapped[list] = mapped_column(JSON, default=list)
    features: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_bestseller: Mapped[bool] = mapped_column(Boolean, default=False)

    category: Mapped["Category | None"] = relationship(back_populates="products")
    collection: Mapped["Collection | None"] = relationship(back_populates="products")
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.position",
    )


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    media_id: Mapped[int | None] = mapped_column(ForeignKey("media.id"), nullable=True)
    url: Mapped[str] = mapped_column(String(1000))
    alt: Mapped[str | None] = mapped_column(String(500), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    product: Mapped["Product"] = relationship(back_populates="images")
    media: Mapped["Media | None"] = relationship("Media")


class HomeContent(Base, TimestampMixin):
    __tablename__ = "home_content"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hero_kicker: Mapped[str] = mapped_column(String(200), default="EDEN COLLECTION")
    hero_kicker_vi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hero_title: Mapped[str] = mapped_column(String(300), default="THE EDEN DRESS")
    hero_title_vi: Mapped[str | None] = mapped_column(String(300), nullable=True)
    hero_subtitle: Mapped[str] = mapped_column(
        Text,
        default="A midi dress cut for movement. Precision seams, recycled crepe, and a drape that follows every line.",
    )
    hero_subtitle_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    hero_image_id: Mapped[int | None] = mapped_column(ForeignKey("media.id"), nullable=True)
    hero_media: Mapped["Media | None"] = relationship("Media", foreign_keys=[hero_image_id])
    hero_primary_cta: Mapped[str] = mapped_column(String(200), default="SHOP THE DRESS")
    hero_primary_cta_vi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hero_primary_url: Mapped[str] = mapped_column(String(500), default="/collections/eden-collection")
    hero_secondary_cta: Mapped[str] = mapped_column(String(200), default="EXPLORE THE BRAND")
    hero_secondary_cta_vi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hero_secondary_url: Mapped[str] = mapped_column(String(500), default="/brand")
    trending_title: Mapped[str] = mapped_column(String(200), default="THE EDEN COLLECTION")
    trending_title_vi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    trending_view_all_label: Mapped[str] = mapped_column(String(200), default="VIEW ALL")
    trending_view_all_label_vi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    trending_view_all_url: Mapped[str] = mapped_column(String(500), default="/collections")
    latest_drops_title: Mapped[str] = mapped_column(String(200), default="LATEST DROPS")
    latest_drops_title_vi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    master_title: Mapped[str] = mapped_column(String(300), default="THE EDEN DRESS")
    master_title_vi: Mapped[str | None] = mapped_column(String(300), nullable=True)
    master_description: Mapped[str] = mapped_column(
        Text,
        default="Three colorways. One silhouette. Cut from recycled performance crepe for movement, elegance, and everyday wear.",
    )
    master_description_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    master_media_id: Mapped[int | None] = mapped_column(ForeignKey("media.id"), nullable=True)
    master_media: Mapped["Media | None"] = relationship("Media", foreign_keys=[master_media_id])
    features: Mapped[list] = mapped_column(JSON, default=list)


class EditorialItem(Base, TimestampMixin):
    __tablename__ = "editorial_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(20), default="image")  # image | quote | product_grid
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    title_vi: Mapped[str | None] = mapped_column(String(300), nullable=True)
    subtitle: Mapped[str | None] = mapped_column(String(300), nullable=True)
    subtitle_vi: Mapped[str | None] = mapped_column(String(300), nullable=True)
    quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    quote_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    author: Mapped[str | None] = mapped_column(String(200), nullable=True)
    author_vi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)
    caption_vi: Mapped[str | None] = mapped_column(String(500), nullable=True)
    media_id: Mapped[int | None] = mapped_column(ForeignKey("media.id"), nullable=True)
    media: Mapped["Media | None"] = relationship("Media")
    content: Mapped[list] = mapped_column(JSON, default=list)
    link_text: Mapped[str | None] = mapped_column(String(200), nullable=True)
    link_text_vi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Page(Base, TimestampMixin):
    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    title: Mapped[str] = mapped_column(String(300))
    title_vi: Mapped[str | None] = mapped_column(String(300), nullable=True)
    subtitle: Mapped[str | None] = mapped_column(Text, nullable=True)
    subtitle_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    hero_image_id: Mapped[int | None] = mapped_column(ForeignKey("media.id"), nullable=True)
    hero_media: Mapped["Media | None"] = relationship("Media", foreign_keys=[hero_image_id])
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    show_in_nav: Mapped[bool] = mapped_column(Boolean, default=True)
    nav_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    nav_label_vi: Mapped[str | None] = mapped_column(String(100), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)

    blocks: Mapped[list["PageBlock"]] = relationship(
        back_populates="page",
        cascade="all, delete-orphan",
        order_by="PageBlock.position",
    )


class PageBlock(Base):
    __tablename__ = "page_blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"))
    block_type: Mapped[str] = mapped_column(String(20), default="text")
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    position: Mapped[int] = mapped_column(Integer, default=0)

    page: Mapped["Page"] = relationship(back_populates="blocks")


class BlogPost(Base, TimestampMixin):
    __tablename__ = "blog_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    title: Mapped[str] = mapped_column(String(300))
    title_vi: Mapped[str | None] = mapped_column(String(300), nullable=True)
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    excerpt_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image_id: Mapped[int | None] = mapped_column(ForeignKey("media.id"), nullable=True)
    cover_media: Mapped["Media | None"] = relationship("Media", foreign_keys=[cover_image_id])
    content: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class SiteSettings(Base, TimestampMixin):
    __tablename__ = "site_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    site_name: Mapped[str] = mapped_column(String(200), default="INSPO")
    logo_media_id: Mapped[int | None] = mapped_column(ForeignKey("media.id"), nullable=True)
    logo_media: Mapped["Media | None"] = relationship("Media", foreign_keys=[logo_media_id])
    favicon_media_id: Mapped[int | None] = mapped_column(ForeignKey("media.id"), nullable=True)
    favicon_media: Mapped["Media | None"] = relationship("Media", foreign_keys=[favicon_media_id])
    nav_items: Mapped[list] = mapped_column(JSON, default=list)
