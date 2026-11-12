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

const REMOVED_FOOTER_KEYS = new Set([
  "privacy",
  "shipping_policy",
  "return_policy",
  "careers",
  "contact",
  "order_lookup",
]);

const DEFAULT_ENABLED_FOOTER_KEYS = new Set(["terms", "shipping", "brand", "admin"]);

function presetEnabledByDefault(key: string): boolean {
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

export function newFooterLinkKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `link-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `link-${Date.now().toString(36)}`;
}

/** Preserve admin order; only sanitize fields. Empty storage → legacy preset starter list. */
export function normalizeFooterLinkConfigs(stored?: FooterLinkConfig[] | null): FooterLinkConfig[] {
  if (!stored?.length) return defaultFooterLinkConfigs();
  const out: FooterLinkConfig[] = [];
  const seen = new Set<string>();
  for (const row of stored) {
    const key = (row.key || "").trim();
    if (!key || REMOVED_FOOTER_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);
    const enabled = row.enabled ?? (FOOTER_PRESET_KEYS as readonly string[]).includes(key)
      ? presetEnabledByDefault(key as (typeof FOOTER_PRESET_KEYS)[number])
      : true;
    out.push({
      key,
      enabled: Boolean(enabled),
      label: row.label ?? null,
      label_vi: row.label_vi ?? null,
      url: row.url ?? null,
    });
  }
  return out.length ? out : defaultFooterLinkConfigs();
}

export function footerLinkPresetTitle(key: string): string | null {
  const preset = FOOTER_PRESET_LABELS[key as keyof typeof FOOTER_PRESET_LABELS];
  return preset ? `${preset.en} / ${preset.vi}` : null;
}
