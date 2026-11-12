import type { Lang } from "./i18n";
import type { Product, ProductImage, ProductSizeInput, ProductSizeOption } from "./types";

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

export function parseProductSizeOptions(sizes: ProductSizeInput[] | undefined): ProductSizeOption[] {
  const out: ProductSizeOption[] = [];
  const seen = new Set<string>();
  for (const item of sizes || []) {
    let name = "";
    let available = true;
    if (typeof item === "string") {
      name = item.trim();
    } else if (item && typeof item === "object") {
      name = String(item.name || "").trim();
      if (item.available !== undefined) available = Boolean(item.available);
      else if (item.sold_out !== undefined) available = !item.sold_out;
    }
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, available });
  }
  return out;
}

/** @deprecated use parseProductSizeOptions */
export function parseProductSizes(sizes: ProductSizeInput[] | undefined): string[] {
  return parseProductSizeOptions(sizes).map((s) => s.name);
}

export type ProductVariantOptions = {
  hasColors: boolean;
  hasSizes: boolean;
  colors: ColorSwatch[];
  sizes: string[];
  sizeOptions: ProductSizeOption[];
};

/** Storefront pickers are driven only by what the merchant configured (may be color only, size only, both, or neither). */
export function getProductVariantOptions(product: Pick<Product, "colors" | "sizes">): ProductVariantOptions {
  const colors = parseProductColors(product.colors);
  const sizeOptions = parseProductSizeOptions(product.sizes);
  const sizes = sizeOptions.map((s) => s.name);
  return {
    hasColors: colors.length > 0,
    hasSizes: sizes.length > 0,
    colors,
    sizes,
    sizeOptions,
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
  if (options.hasSizes) {
    if (!selected.size) return false;
    const opt = options.sizeOptions.find((o) => o.name === selected.size);
    if (!opt?.available) return false;
  }
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
