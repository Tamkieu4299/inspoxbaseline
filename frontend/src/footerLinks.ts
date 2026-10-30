import type { FooterLinkConfig } from "./types";

export const FOOTER_PRESET_KEYS = ["terms", "shipping", "brand", "admin"] as const;

export const FOOTER_PRESET_LABELS: Record<
  (typeof FOOTER_PRESET_KEYS)[number],
  { en: string; vi: string }
> = {
  terms: { en: "Terms of service", vi: "Điều khoản sử dụng" },
  shipping: { en: "Shipping & returns", vi: "Giao hàng & đổi trả" },
  brand: { en: "Brand experience", vi: "Trải nghiệm thương hiệu" },
  admin: { en: "Admin", vi: "Quản trị" },
};

const DEFAULT_ENABLED_FOOTER_KEYS = new Set(["terms", "shipping", "brand", "admin"]);

function presetEnabledByDefault(key: (typeof FOOTER_PRESET_KEYS)[number]): boolean {
  return DEFAULT_ENABLED_FOOTER_KEYS.has(key);
}

export function defaultFooterLinkConfigs(): FooterLinkConfig[] {
  return FOOTER_PRESET_KEYS.map((key) => ({
    key,
    enabled: presetEnabledByDefault(key),
    label: null,
    label_vi: null,
    url: null,
  }));
}

export function normalizeFooterLinkConfigs(stored?: FooterLinkConfig[] | null): FooterLinkConfig[] {
  if (!stored?.length) return defaultFooterLinkConfigs();
  const byKey = new Map(stored.map((row) => [row.key, row]));
  const merged: FooterLinkConfig[] = FOOTER_PRESET_KEYS.map((key) => {
    const defaults = defaultFooterLinkConfigs().find((d) => d.key === key)!;
    const stored = byKey.get(key);
    if (!stored) return { ...defaults, key };
    const enabled = stored.enabled ?? defaults.enabled;
    return { ...defaults, ...stored, key, enabled };
  });
  for (const row of stored) {
    if (!(FOOTER_PRESET_KEYS as readonly string[]).includes(row.key)) {
      merged.push(row);
    }
  }
  return merged;
}
