import type { FooterLinkConfig } from "./types";

export const FOOTER_PRESET_KEYS = ["privacy", "terms", "shipping", "brand", "admin"] as const;

export const FOOTER_PRESET_LABELS: Record<
  (typeof FOOTER_PRESET_KEYS)[number],
  { en: string; vi: string }
> = {
  privacy: { en: "Privacy policy", vi: "Chính sách bảo mật" },
  terms: { en: "Terms of service", vi: "Điều khoản sử dụng" },
  shipping: { en: "Shipping & returns", vi: "Giao hàng & đổi trả" },
  brand: { en: "Brand experience", vi: "Trải nghiệm thương hiệu" },
  admin: { en: "Admin", vi: "Quản trị" },
};

export function defaultFooterLinkConfigs(): FooterLinkConfig[] {
  return FOOTER_PRESET_KEYS.map((key) => ({
    key,
    enabled: true,
    label: null,
    label_vi: null,
    url: null,
  }));
}

export function normalizeFooterLinkConfigs(stored?: FooterLinkConfig[] | null): FooterLinkConfig[] {
  if (!stored?.length) return defaultFooterLinkConfigs();
  const byKey = new Map(stored.map((row) => [row.key, row]));
  return FOOTER_PRESET_KEYS.map((key) => ({
    ...defaultFooterLinkConfigs().find((d) => d.key === key)!,
    ...byKey.get(key),
    key,
  }));
}
