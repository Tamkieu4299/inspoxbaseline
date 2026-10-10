export type HomeSectionId = "hero" | "trending" | "latest_drops" | "master";

export interface HomeSectionConfig {
  id: HomeSectionId;
  enabled: boolean;
  /** Trending collections (1–4) or latest products (1–12). */
  limit?: number;
  /** Latest drops footer CTA. */
  show_view_all?: boolean;
}

export const HOME_SECTION_IDS: HomeSectionId[] = ["hero", "trending", "latest_drops", "master"];

export const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = [
  { id: "hero", enabled: true },
  { id: "trending", enabled: true, limit: 2 },
  { id: "latest_drops", enabled: true, limit: 8, show_view_all: true },
  { id: "master", enabled: true },
];

const defaultById = Object.fromEntries(DEFAULT_HOME_SECTIONS.map((s) => [s.id, { ...s }])) as Record<
  HomeSectionId,
  HomeSectionConfig
>;

export function normalizeHomeSections(raw: HomeSectionConfig[] | null | undefined): HomeSectionConfig[] {
  if (!raw?.length) return DEFAULT_HOME_SECTIONS.map((s) => ({ ...s }));

  const out: HomeSectionConfig[] = [];
  const seen = new Set<HomeSectionId>();
  for (const item of raw) {
    if (!item?.id || !HOME_SECTION_IDS.includes(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    const base = { ...defaultById[item.id] };
    base.enabled = item.enabled !== false;
    if (item.id === "trending") {
      base.limit = clamp(Number(item.limit ?? base.limit ?? 2), 1, 4);
    }
    if (item.id === "latest_drops") {
      base.limit = clamp(Number(item.limit ?? base.limit ?? 8), 1, 12);
      if (item.show_view_all !== undefined) base.show_view_all = item.show_view_all;
    }
    out.push(base);
  }
  for (const id of HOME_SECTION_IDS) {
    if (!seen.has(id)) out.push({ ...defaultById[id] });
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function sectionLabelKey(id: HomeSectionId): string {
  return `admin.homeSection.${id}`;
}
