import { LEGACY_QUIZ_DIMENSIONS, type QuizDimensionDef } from "./dimensions";

export type VectorProfile = Record<string, number>;

export type QuizGuardrails = {
  max_ra?: number;
  min_ra?: number;
  max_weight_g?: number;
  min_weight_g?: number;
  min_swing_weight?: number;
  max_swing_weight?: number;
  min_head_sq_in?: number;
  max_head_sq_in?: number;
  exclude_tags?: string[];
};

export type QuizOptionDef = {
  id: string;
  deltas?: Partial<VectorProfile> & Record<string, number | undefined>;
  guardrails?: QuizGuardrails;
};

export type MatchProduct = {
  slug: string;
  name: string;
  price: number;
  image_url?: string | null;
  finder_profile?: {
    enabled?: boolean;
    vectors?: Record<string, number | undefined>;
    specs?: {
      ra?: number;
      weight_g?: number;
      swing_weight?: number;
      head_sq_in?: number;
      pattern?: string;
      [k: string]: unknown;
    };
    tags?: string[];
  } | null;
};

const LEGACY_DEFAULT_WEIGHT = 0.2;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function resolveDimensionIds(
  dimensions: QuizDimensionDef[] | undefined,
  dimensionWeights: Record<string, number> | undefined
): string[] {
  if (dimensions?.length) return dimensions.map((d) => d.id).filter(Boolean);
  const keys = Object.keys(dimensionWeights || {}).filter(Boolean);
  if (keys.length) return keys;
  return [...LEGACY_QUIZ_DIMENSIONS];
}

export function emptyProfile(dimensionIds: string[]): VectorProfile {
  const p: VectorProfile = {};
  for (const d of dimensionIds) p[d] = 50;
  return p;
}

export function normalizeWeights(
  raw: Record<string, number> | undefined,
  dimensionIds: string[]
): Record<string, number> {
  const w: Record<string, number> = {};
  let sum = 0;
  for (const d of dimensionIds) {
    const v = Number(raw?.[d]);
    if (Number.isFinite(v) && v > 0) {
      w[d] = v;
      sum += v;
    } else {
      w[d] = LEGACY_DEFAULT_WEIGHT;
      sum += LEGACY_DEFAULT_WEIGHT;
    }
  }
  if (sum <= 0 || !dimensionIds.length) {
    const n = dimensionIds.length || LEGACY_QUIZ_DIMENSIONS.length;
    const each = 1 / n;
    for (const d of dimensionIds.length ? dimensionIds : [...LEGACY_QUIZ_DIMENSIONS]) w[d] = each;
    return w;
  }
  for (const d of dimensionIds) w[d] = w[d] / sum;
  return w;
}

export function applyOptions(
  profile: VectorProfile,
  options: QuizOptionDef[],
  dimensionIds: string[]
): VectorProfile {
  const next = { ...profile };
  for (const opt of options) {
    const d = opt.deltas || {};
    for (const dim of dimensionIds) {
      if (d[dim] != null) next[dim] = clamp(next[dim] + Number(d[dim]), 0, 100);
    }
  }
  return next;
}

export function mergeGuardrails(options: QuizOptionDef[]): QuizGuardrails {
  const merged: QuizGuardrails = {};
  for (const opt of options) {
    const g = opt.guardrails;
    if (!g) continue;
    if (g.max_ra != null) merged.max_ra = merged.max_ra == null ? g.max_ra : Math.min(merged.max_ra, g.max_ra);
    if (g.min_ra != null) merged.min_ra = merged.min_ra == null ? g.min_ra : Math.max(merged.min_ra, g.min_ra);
    if (g.max_weight_g != null)
      merged.max_weight_g =
        merged.max_weight_g == null ? g.max_weight_g : Math.min(merged.max_weight_g, g.max_weight_g);
    if (g.min_weight_g != null)
      merged.min_weight_g =
        merged.min_weight_g == null ? g.min_weight_g : Math.max(merged.min_weight_g, g.min_weight_g);
    if (g.max_swing_weight != null)
      merged.max_swing_weight =
        merged.max_swing_weight == null ? g.max_swing_weight : Math.min(merged.max_swing_weight, g.max_swing_weight);
    if (g.min_swing_weight != null)
      merged.min_swing_weight =
        merged.min_swing_weight == null ? g.min_swing_weight : Math.max(merged.min_swing_weight, g.min_swing_weight);
    if (g.min_head_sq_in != null)
      merged.min_head_sq_in =
        merged.min_head_sq_in == null ? g.min_head_sq_in : Math.max(merged.min_head_sq_in, g.min_head_sq_in);
    if (g.max_head_sq_in != null)
      merged.max_head_sq_in =
        merged.max_head_sq_in == null ? g.max_head_sq_in : Math.min(merged.max_head_sq_in, g.max_head_sq_in);
    if (g.exclude_tags?.length) {
      merged.exclude_tags = [...(merged.exclude_tags || []), ...g.exclude_tags];
    }
  }
  return merged;
}

function passesGuardrails(product: MatchProduct, guardrails: QuizGuardrails): boolean {
  const specs = product.finder_profile?.specs || {};
  const tags = new Set(product.finder_profile?.tags || []);
  if (guardrails.max_ra != null && specs.ra != null && Number(specs.ra) > guardrails.max_ra) return false;
  if (guardrails.min_ra != null && specs.ra != null && Number(specs.ra) < guardrails.min_ra) return false;
  if (guardrails.max_weight_g != null && specs.weight_g != null && Number(specs.weight_g) > guardrails.max_weight_g)
    return false;
  if (guardrails.min_weight_g != null && specs.weight_g != null && Number(specs.weight_g) < guardrails.min_weight_g)
    return false;
  if (
    guardrails.max_swing_weight != null &&
    specs.swing_weight != null &&
    Number(specs.swing_weight) > guardrails.max_swing_weight
  )
    return false;
  if (
    guardrails.min_swing_weight != null &&
    specs.swing_weight != null &&
    Number(specs.swing_weight) < guardrails.min_swing_weight
  )
    return false;
  if (
    guardrails.min_head_sq_in != null &&
    specs.head_sq_in != null &&
    Number(specs.head_sq_in) < guardrails.min_head_sq_in
  )
    return false;
  if (
    guardrails.max_head_sq_in != null &&
    specs.head_sq_in != null &&
    Number(specs.head_sq_in) > guardrails.max_head_sq_in
  )
    return false;
  for (const t of guardrails.exclude_tags || []) {
    if (tags.has(t)) return false;
  }
  return true;
}

export function rankProducts(
  profile: VectorProfile,
  products: MatchProduct[],
  weights: Record<string, number> | undefined,
  guardrails: QuizGuardrails,
  dimensionIds: string[]
): { slug: string; match: number; product: MatchProduct }[] {
  const ids = dimensionIds.length ? dimensionIds : [...LEGACY_QUIZ_DIMENSIONS];
  const w = normalizeWeights(weights, ids);
  let maxDist = 0;
  for (const d of ids) maxDist += w[d] * 100 * 100;
  maxDist = Math.sqrt(maxDist) || 1;

  const ranked: { slug: string; match: number; product: MatchProduct }[] = [];
  for (const product of products) {
    if (!passesGuardrails(product, guardrails)) continue;
    const rv = product.finder_profile?.vectors || {};
    let distSq = 0;
    for (const d of ids) {
      const pVal = profile[d] ?? 50;
      const rVal = clamp(Number(rv[d] ?? 50), 0, 100);
      const diff = pVal - rVal;
      distSq += w[d] * diff * diff;
    }
    const dist = Math.sqrt(distSq);
    const match = Math.round(clamp(100 * (1 - dist / maxDist), 0, 100));
    ranked.push({ slug: product.slug, match, product });
  }
  ranked.sort((a, b) => b.match - a.match);
  return ranked;
}

/** @deprecated use LEGACY_QUIZ_DIMENSIONS from ./dimensions */
export const QUIZ_DIMENSIONS = LEGACY_QUIZ_DIMENSIONS;
