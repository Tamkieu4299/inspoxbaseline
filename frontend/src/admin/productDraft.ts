import type { Product, ProductFinderProfile } from "../types";

export interface ProductDraft {
  id?: number;
  slug: string;
  name: string;
  name_vi: string;
  subtitle: string;
  subtitle_vi: string;
  description: string;
  description_vi: string;
  price: number;
  category_id: number | "";
  category_ids: number[];
  collection_id: number | "";
  badge: string;
  gallery_layout: string;
  colors: { name: string; hex: string }[];
  sizes: string[];
  tech_specs: { label: string; value: string; label_vi: string; value_vi: string }[];
  features: { icon: string; title: string; description: string; title_vi: string; description_vi: string }[];
  is_active: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  images: { media_id?: number; url: string; alt: string; color_name?: string; position: number; enabled: boolean }[];
  finder_profile: ProductFinderProfile;
}

export const PRODUCT_BADGES = ["", "NEW", "LIMITED", "BESTSELLER", "NEW ARRIVAL"];

export function blankProductDraft(): ProductDraft {
  return {
    slug: "",
    name: "",
    name_vi: "",
    subtitle: "",
    subtitle_vi: "",
    description: "",
    description_vi: "",
    price: 0,
    category_id: "",
    category_ids: [],
    collection_id: "",
    badge: "",
    gallery_layout: "collage",
    colors: [],
    sizes: [],
    tech_specs: [],
    features: [],
    is_active: true,
    is_featured: false,
    is_bestseller: false,
    images: [],
    finder_profile: { enabled: false, vectors: {}, specs: {}, tags: [] },
  };
}

export function productToDraft(p: Product): ProductDraft {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    name_vi: p.name_vi || "",
    subtitle: p.subtitle || "",
    subtitle_vi: p.subtitle_vi || "",
    description: p.description || "",
    description_vi: p.description_vi || "",
    price: p.price,
    category_id: p.category_id ?? "",
    category_ids:
      p.categories?.map((c) => c.id) ?? (p.category_id != null ? [p.category_id] : []),
    collection_id: p.collection_id ?? "",
    badge: p.badge || "",
    gallery_layout: p.gallery_layout || "collage",
    colors: (p.colors || []).map((c) =>
      typeof c === "string" ? { name: c, hex: "#ffffff" } : { name: c.name || "", hex: c.hex || "#ffffff" }
    ),
    sizes: p.sizes || [],
    tech_specs: (p.tech_specs || []).map((s) => ({
      label: s.label || "",
      value: s.value || "",
      label_vi: s.label_vi || "",
      value_vi: s.value_vi || "",
    })),
    features: (p.features || []).map((f) => ({
      icon: f.icon || "",
      title: f.title || "",
      description: f.description || "",
      title_vi: f.title_vi || "",
      description_vi: f.description_vi || "",
    })),
    is_active: p.is_active,
    is_featured: p.is_featured,
    is_bestseller: p.is_bestseller,
    finder_profile: p.finder_profile
      ? {
          enabled: Boolean(p.finder_profile.enabled),
          vectors: { ...(p.finder_profile.vectors || {}) },
          specs: { ...(p.finder_profile.specs || {}) },
          tags: [...(p.finder_profile.tags || [])],
        }
      : { enabled: false, vectors: {}, specs: {}, tags: [] },
    images: (p.images || []).map((i) => ({
      media_id: i.media_id || undefined,
      url: i.url,
      alt: i.alt || "",
      color_name: i.color_name || "",
      position: i.position,
      enabled: i.enabled !== false,
    })),
  };
}

export function skuFromSlug(slug: string): string {
  const core = slug.replace(/[^a-z0-9-]/gi, "-").toUpperCase().replace(/-+/g, "-");
  return `APX-${core.slice(0, 24)}`;
}

export type LiveStatusKey =
  | "active"
  | "limited"
  | "scheduled"
  | "draft";

export function liveStatus(product: Product): LiveStatusKey {
  if (!product.is_active) return "draft";
  if (product.badge === "LIMITED") return "limited";
  if (product.badge === "NEW" || product.badge === "NEW ARRIVAL") return "scheduled";
  return "active";
}

export function viCompleteness(product: Product): "full" | "draft" | "partial" {
  const hasVi = Boolean(product.name_vi?.trim() && product.description_vi?.trim());
  const hasSome = Boolean(product.name_vi?.trim() || product.description_vi?.trim());
  if (hasVi) return "full";
  if (hasSome) return "partial";
  return "draft";
}
