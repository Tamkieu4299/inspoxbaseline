import type { Lang } from "./i18n";
import type { Product, ProductImage } from "./types";

export type ColorSwatch = { name: string; hex: string; nameVi?: string };

export function parseProductColors(colors: Product["colors"]): ColorSwatch[] {
  return (colors || [])
    .map((c) => {
      if (typeof c === "string") {
        return { name: c, hex: "#cccccc" };
      }
      return {
        name: (c.name || "").trim(),
        hex: c.hex || "#cccccc",
        nameVi: c.name_vi?.trim() || undefined,
      };
    })
    .filter((c) => c.name.length > 0);
}

export function colorDisplayName(c: ColorSwatch, lang: Lang): string {
  if (lang === "vi" && c.nameVi) return c.nameVi;
  return c.name;
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

/** Images tagged for a colorway; falls back to untagged, then all enabled. */
export function parseProductSizes(sizes: string[] | undefined): string[] {
  return (sizes || []).map((s) => String(s).trim()).filter(Boolean);
}

export type ProductVariantOptions = {
  hasColors: boolean;
  hasSizes: boolean;
  colors: ColorSwatch[];
  sizes: string[];
};

/** Storefront pickers are driven only by what the merchant configured (may be color only, size only, both, or neither). */
export function getProductVariantOptions(product: Pick<Product, "colors" | "sizes">): ProductVariantOptions {
  const colors = parseProductColors(product.colors);
  const sizes = parseProductSizes(product.sizes);
  return {
    hasColors: colors.length > 0,
    hasSizes: sizes.length > 0,
    colors,
    sizes,
  };
}

export function variantStorefrontSummaryKey(options: ProductVariantOptions): string {
  if (options.hasColors && options.hasSizes) return "product.variantsColorAndSize";
  if (options.hasColors) return "product.variantsColorOnly";
  if (options.hasSizes) return "product.variantsSizeOnly";
  return "product.variantsNone";
}

export function canPurchaseWithVariants(
  options: ProductVariantOptions,
  selected: { size: string | null }
): boolean {
  if (options.hasSizes && !selected.size) return false;
  return true;
}

export function enabledProductImages(images: ProductImage[] | undefined): ProductImage[] {
  return (images || []).filter((i) => i.enabled !== false);
}

/** Index in enabled gallery order of the first image tagged for this colorway, or null. */
export function firstImageIndexForColorway(
  images: ProductImage[] | undefined,
  colorName: string
): number | null {
  const enabled = enabledProductImages(images);
  const key = norm(colorName);
  const idx = enabled.findIndex((i) => i.color_name && norm(i.color_name) === key);
  return idx >= 0 ? idx : null;
}

/** @deprecated Prefer showing all images on PDP and jumping via firstImageIndexForColorway. */
export function imagesForColorway(images: ProductImage[], colorName: string | null): ProductImage[] {
  const enabled = enabledProductImages(images);
  if (!colorName) return enabled;
  const key = norm(colorName);
  const tagged = enabled.filter((i) => i.color_name && norm(i.color_name) === key);
  if (tagged.length > 0) return tagged;
  const shared = enabled.filter((i) => !i.color_name?.trim());
  return shared.length > 0 ? shared : enabled;
}
