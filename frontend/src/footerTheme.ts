/** Matches Tailwind `forest-green` — default footer band. */
export const FOOTER_FOREST_HEX = "#004225";

const FOOTER_TEXT_ON_DARK = "#ffffff";
const FOOTER_TEXT_ON_LIGHT = "#1a1c1c";

export function normalizeHexColor(raw: string | null | undefined): string | null {
  const c = (raw || "").trim();
  if (!c) return null;
  return c.startsWith("#") ? c.toLowerCase() : `#${c.toLowerCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "");
  if (h.length !== 3 && h.length !== 6) return null;
  const full =
    h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Relative luminance 0–1 (WCAG). */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.45;
}

export type ResolvedFooterColors = {
  background: string;
  text: string;
  border: string;
  /** Light icons on dark footer (white social glyphs). */
  socialOnDark: boolean;
  textIsAuto: boolean;
};

export function resolveFooterColors(
  bgRaw: string | null | undefined,
  textRaw: string | null | undefined,
): ResolvedFooterColors {
  const background = normalizeHexColor(bgRaw) ?? FOOTER_FOREST_HEX;
  const textNorm = normalizeHexColor(textRaw);
  const textIsAuto = !textNorm;
  const text = textNorm ?? (isLightColor(background) ? FOOTER_TEXT_ON_LIGHT : FOOTER_TEXT_ON_DARK);
  const socialOnDark = !isLightColor(text);
  const border = socialOnDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)";
  return { background, text, border, socialOnDark, textIsAuto };
}
