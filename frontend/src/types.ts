import type { HomeSectionConfig } from "./homeSections";

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
  /** When set, image is shown for this colorway name on the PDP. */
  color_name?: string | null;
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
  category_ids?: number[];
  collection_id?: number | null;
  badge?: string | null;
  brand?: string | null;
  gallery_layout?: string;
  colors: { name?: string; hex?: string; name_vi?: string }[] | string[];
  sizes: string[];
  tech_specs: { label?: string; value?: string; label_vi?: string; value_vi?: string }[];
  features: { icon?: string; title?: string; description?: string; title_vi?: string; description_vi?: string }[];
  is_active: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  /** Lower = higher in catalog lists (after hot/bestseller). */
  list_order?: number;
  created_at: string;
  images: ProductImage[];
  category?: Category | null;
  categories?: Category[];
  collection?: CollectionSummary | null;
  finder_profile?: ProductFinderProfile | null;
}

export interface ProductListPage {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type ProductFinderProfile = {
  enabled?: boolean;
  vectors?: Record<string, number | undefined>;
  specs?: {
    ra?: number;
    weight_g?: number;
    swing_weight?: number;
    head_sq_in?: number;
    pattern?: string;
    balance_in?: number;
    length_in?: number;
    [k: string]: unknown;
  };
  tags?: string[];
  /** Tennis Warehouse review source (import_tennis_warehouse_profiles). */
  tw?: {
    code?: string;
    name?: string;
    review_url?: string;
    verdict?: number;
    breakdown_0_10?: Record<string, number>;
    lab?: Record<string, { score?: string; grade?: string }>;
  };
};

export type QuizDimensionDef = {
  id: string;
  label: string;
  label_vi?: string;
  default_weight?: number;
};

export type QuizStepOption = {
  id: string;
  icon?: string;
  image_url?: string;
  badge?: string;
  title: string;
  title_vi?: string;
  subtitle?: string;
  subtitle_vi?: string;
  deltas?: Record<string, number | undefined>;
  guardrails?: {
    max_ra?: number;
    min_ra?: number;
    max_weight_g?: number;
    min_weight_g?: number;
    min_swing_weight?: number;
    max_swing_weight?: number;
    min_head_sq_in?: number;
    max_head_sq_in?: number;
    pattern_any?: string[];
    exclude_tags?: string[];
  };
};

export type QuizStep = {
  id: string;
  step_key?: string;
  title: string;
  title_vi?: string;
  subtitle?: string;
  subtitle_vi?: string;
  note?: string;
  note_vi?: string;
  image_url?: string;
  image_media_id?: number | null;
  required?: boolean;
  options: QuizStepOption[];
};

export interface ShopQuiz {
  id: number;
  slug: string;
  title: string;
  title_vi?: string | null;
  subtitle?: string | null;
  subtitle_vi?: string | null;
  nav_label?: string | null;
  nav_label_vi?: string | null;
  show_in_nav: boolean;
  is_published: boolean;
  hero_kicker?: string | null;
  hero_kicker_vi?: string | null;
  hero_badges: { icon?: string; label: string; label_vi?: string }[];
  faq: { q: string; q_vi?: string; a: string; a_vi?: string }[];
  dimensions?: QuizDimensionDef[];
  dimension_weights: Record<string, number>;
  steps: QuizStep[];
  product_filter: { category_slugs?: string[]; require_finder_profile?: boolean };
  created_at: string;
  updated_at: string;
}

export interface ShopQuizPublic extends Omit<ShopQuiz, "created_at" | "updated_at" | "is_published"> {
  match_products: QuizMatchProduct[];
}

export interface QuizMatchProduct {
  id: number;
  slug: string;
  name: string;
  price: number;
  image_url?: string | null;
  finder_profile?: ProductFinderProfile | null;
}

export interface QuizNavItem {
  slug: string;
  title: string;
  nav_label?: string | null;
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
    gradient?: boolean;
    text_color?: string | null;
    carousel?: boolean;
    images?: (string | null)[];
    slides?: { url: string; media_type?: "image" | "video" | null }[];
    interval?: number;
    colors?: Record<string, string>;
    primary_cta: string;
    primary_url: string;
    secondary_cta: string;
    secondary_url: string;
  };
  trending: Collection[];
  latest_drops: Product[];
  sections?: HomeSectionConfig[];
  master: {
    title: string;
    description: string;
    media: string | null;
    media_type?: "image" | "video" | null;
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
  hero_gradient?: boolean;
  hero_text_color?: string | null;
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
  hero_gradient?: boolean;
  hero_text_color?: string;
  hero_carousel?: boolean;
  hero_image_ids?: number[];
  hero_carousel_interval?: number;
  hero_colors?: Record<string, string>;
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
  sections?: HomeSectionConfig[];
  brand_hero_title?: string | null;
  brand_hero_title_vi?: string | null;
  brand_hero_subtitle?: string | null;
  brand_hero_subtitle_vi?: string | null;
  brand_hero_cta?: string | null;
  brand_hero_cta_vi?: string | null;
  brand_hero_image_id?: number | null;
  brand_hero_gradient?: boolean;
  brand_hero_text_color?: string | null;
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
  hero_text_color?: string | null;
  gradient?: boolean;
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
  hero_text_color?: string | null;
  gradient?: boolean;
  content: { type: string; data: Record<string, any> }[];
  is_active: boolean;
  published_at?: string | null;
  created_at: string;
}

export interface NavItem {
  type: "home" | "collections" | "new_arrivals" | "brand" | "categories" | "page" | "quiz";
  ref?: string | null;
  enabled: boolean;
}

export interface FooterLinkConfig {
  key: string;
  enabled: boolean;
  label?: string | null;
  label_vi?: string | null;
  url?: string | null;
}

export interface FooterLinkPublic {
  label: string;
  url?: string | null;
}

export interface FooterSocialLinks {
  facebook?: string | null;
  instagram?: string | null;
  threads?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
  zalo?: string | null;
}

export interface FooterContactConfig {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  address_vi?: string | null;
  business_registration?: string | null;
  business_registration_vi?: string | null;
  showroom_note?: string | null;
  showroom_note_vi?: string | null;
  opening_hours?: string | null;
  opening_hours_vi?: string | null;
  map_embed_url?: string | null;
  facebook_page_embed_url?: string | null;
  registration_badge_media_id?: number | null;
  useful_links_title?: string | null;
  useful_links_title_vi?: string | null;
  categories_title?: string | null;
  categories_title_vi?: string | null;
  copyright_text?: string | null;
  copyright_text_vi?: string | null;
  show_product_categories?: boolean;
  social?: FooterSocialLinks;
}

export interface FooterContactPublic {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  business_registration?: string | null;
  showroom_note?: string | null;
  opening_hours?: string | null;
  map_embed_url?: string | null;
  facebook_page_embed_url?: string | null;
  registration_badge_url?: string | null;
  useful_links_title?: string | null;
  categories_title?: string | null;
  copyright_line?: string | null;
  show_product_categories?: boolean;
  social?: Record<string, string>;
}

export interface SitePublic {
  site_name: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  nav_items: NavItem[];
  currency_code?: string;
  usd_to_vnd_rate?: number;
  supported_currencies?: string[];
  footer_tagline?: string | null;
  collections_subtitle?: string | null;
  footer_links?: FooterLinkPublic[];
  footer_contact?: FooterContactPublic | null;
}

export interface SiteSettings {
  id: number;
  site_name: string;
  logo_media_id?: number | null;
  logo_media?: Media | null;
  favicon_media_id?: number | null;
  favicon_media?: Media | null;
  nav_items: NavItem[];
  currency_code?: string;
  usd_to_vnd_rate?: number;
  footer_tagline?: string | null;
  footer_tagline_vi?: string | null;
  collections_subtitle?: string | null;
  collections_subtitle_vi?: string | null;
  footer_links?: FooterLinkConfig[];
  footer_contact?: FooterContactConfig | null;
}

export interface TenantAdmin {
  id: number;
  slug: string;
  name: string;
  is_active: boolean;
  created_at: string;
  admin_username?: string | null;
}

export interface AdminUserRecord {
  id: number;
  username: string;
  is_active: boolean;
  is_super_admin: boolean;
  tenant_ids: number[];
  created_at: string;
}
