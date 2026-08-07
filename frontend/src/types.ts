export interface Media {
  id: number;
  filename: string;
  url: string;
  content_type: string;
  size: number;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  name_vi?: string | null;
}

export interface ProductImage {
  id: number;
  media_id?: number | null;
  url: string;
  alt?: string | null;
  position: number;
  enabled?: boolean;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  name_vi?: string | null;
  subtitle?: string | null;
  subtitle_vi?: string | null;
  description?: string | null;
  description_vi?: string | null;
  price: number;
  category_id?: number | null;
  collection_id?: number | null;
  badge?: string | null;
  gallery_layout?: string;
  colors: { name?: string; hex?: string; name_vi?: string }[] | string[];
  sizes: string[];
  tech_specs: { label?: string; value?: string; label_vi?: string; value_vi?: string }[];
  features: { icon?: string; title?: string; description?: string; title_vi?: string; description_vi?: string }[];
  is_active: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  created_at: string;
  images: ProductImage[];
  category?: Category | null;
  collection?: CollectionSummary | null;
}

export interface CollectionSummary {
  id: number;
  slug: string;
  name: string;
  name_vi?: string | null;
  tagline?: string | null;
  tagline_vi?: string | null;
  description?: string | null;
  description_vi?: string | null;
  hero_image_id?: number | null;
  hero_media?: Media | null;
  badge?: string | null;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
}

export interface Collection extends CollectionSummary {
  products: Product[];
}

export interface HomeData {
  hero: {
    kicker: string;
    title: string;
    subtitle: string;
    image: string | null;
    primary_cta: string;
    primary_url: string;
    secondary_cta: string;
    secondary_url: string;
  };
  trending: Collection[];
  latest_drops: Product[];
  master: {
    title: string;
    description: string;
    media: string | null;
    features: { index?: string; title?: string }[];
    trending_title: string;
    trending_view_all_label: string;
    trending_view_all_url: string;
    latest_drops_title: string;
  };
}

export interface EditorialItem {
  id: number;
  kind: "image" | "quote" | "product_grid";
  title?: string | null;
  title_vi?: string | null;
  subtitle?: string | null;
  subtitle_vi?: string | null;
  quote?: string | null;
  quote_vi?: string | null;
  author?: string | null;
  author_vi?: string | null;
  caption?: string | null;
  caption_vi?: string | null;
  media_id?: number | null;
  media?: Media | null;
  content?: {
    url: string;
    alt?: string;
    alt_vi?: string;
    link_text?: string;
    link_text_vi?: string;
    link_url?: string;
  }[];
  link_text?: string | null;
  link_text_vi?: string | null;
  link_url?: string | null;
  position: number;
  is_active: boolean;
}

export interface BrandData {
  hero_title: string;
  hero_subtitle: string;
  hero_cta: string;
  hero_image?: string | null;
  items: EditorialItem[];
}

export interface HomeContentAdmin {
  id: number;
  hero_kicker: string;
  hero_kicker_vi?: string | null;
  hero_title: string;
  hero_title_vi?: string | null;
  hero_subtitle: string;
  hero_subtitle_vi?: string | null;
  hero_image_id?: number | null;
  hero_primary_cta: string;
  hero_primary_cta_vi?: string | null;
  hero_primary_url: string;
  hero_secondary_cta: string;
  hero_secondary_cta_vi?: string | null;
  hero_secondary_url: string;
  trending_title: string;
  trending_title_vi?: string | null;
  trending_view_all_label: string;
  trending_view_all_label_vi?: string | null;
  trending_view_all_url: string;
  latest_drops_title: string;
  latest_drops_title_vi?: string | null;
  master_title: string;
  master_title_vi?: string | null;
  master_description: string;
  master_description_vi?: string | null;
  master_media_id?: number | null;
  features: { index?: string; title?: string; title_vi?: string }[];
}

export interface PageBlock {
  id: number;
  block_type: string;
  data: Record<string, any>;
  position: number;
}

export interface Page {
  id: number;
  slug: string;
  title: string;
  title_vi?: string | null;
  subtitle?: string | null;
  subtitle_vi?: string | null;
  hero_image_id?: number | null;
  hero_media?: Media | null;
  is_active: boolean;
  show_in_nav: boolean;
  nav_label?: string | null;
  nav_label_vi?: string | null;
  position: number;
  blocks: PageBlock[];
}

export interface PageNav {
  id: number;
  slug: string;
  title: string;
  title_vi?: string | null;
  nav_label?: string | null;
  nav_label_vi?: string | null;
  position: number;
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  title_vi?: string | null;
  excerpt?: string | null;
  excerpt_vi?: string | null;
  cover_image_id?: number | null;
  cover_media?: Media | null;
  content: { type: string; data: Record<string, any> }[];
  is_active: boolean;
  published_at?: string | null;
  created_at: string;
}

export interface SitePublic {
  site_name: string;
  logo_url?: string | null;
  favicon_url?: string | null;
}

export interface SiteSettings {
  id: number;
  site_name: string;
  logo_media_id?: number | null;
  logo_media?: Media | null;
  favicon_media_id?: number | null;
  favicon_media?: Media | null;
}
