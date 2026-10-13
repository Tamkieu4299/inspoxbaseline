export const QUIZ_DIMENSIONS = ["power", "control", "comfort", "spin", "maneuver"] as const;
export type QuizDimension = (typeof QUIZ_DIMENSIONS)[number];
export type VectorProfile = Record<QuizDimension, number>;

export type QuizGuardrails = {
  max_ra?: number;
  min_ra?: number;
  max_weight_g?: number;
  min_weight_g?: number;
  exclude_tags?: string[];
};

export type QuizOptionDef = {
  id: string;
  deltas?: Partial<VectorProfile>;
  guardrails?: QuizGuardrails;
};

export type MatchProduct = {
  slug: string;
  name: string;
  price: number;
  image_url?: string | null;
  finder_profile?: {
    enabled?: boolean;
    vectors?: Partial<VectorProfile>;
    specs?: { ra?: number; weight_g?: number; [k: string]: unknown };
    tags?: string[];
  } | null;
};

const DEFAULT_WEIGHTS: VectorProfile = {
  power: 0.2,
  control: 0.2,
  comfort: 0.2,
  spin: 0.2,
  maneuver: 0.2,
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function emptyProfile(): VectorProfile {
  return { power: 50, control: 50, comfort: 50, spin: 50, maneuver: 50 };
}

export function normalizeWeights(raw: Partial<VectorProfile> | Record<string, number> | undefined): VectorProfile {
  const w = { ...DEFAULT_WEIGHTS };
  if (!raw) return w;
  let sum = 0;
  for (const d of QUIZ_DIMENSIONS) {
    const v = Number(raw[d]);
    if (Number.isFinite(v) && v > 0) {
      w[d] = v;
      sum += v;
    }
  }
  if (sum <= 0) return DEFAULT_WEIGHTS;
  for (const d of QUIZ_DIMENSIONS) w[d] = w[d] / sum;
  return w;
}

export function applyOptions(profile: VectorProfile, options: QuizOptionDef[]): VectorProfile {
  let next = { ...profile };
  for (const opt of options) {
    const d = opt.deltas || {};
    for (const dim of QUIZ_DIMENSIONS) {
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
  for (const t of guardrails.exclude_tags || []) {
    if (tags.has(t)) return false;
  }
  return true;
}

export function rankProducts(
  profile: VectorProfile,
  products: MatchProduct[],
  weights: Partial<VectorProfile> | undefined,
  guardrails: QuizGuardrails
): { slug: string; match: number; product: MatchProduct }[] {
  const w = normalizeWeights(weights);
  let maxDist = 0;
  for (const d of QUIZ_DIMENSIONS) maxDist += w[d] * 100 * 100;
  maxDist = Math.sqrt(maxDist) || 1;

  const ranked: { slug: string; match: number; product: MatchProduct }[] = [];
  for (const product of products) {
    if (!passesGuardrails(product, guardrails)) continue;
    const rv = product.finder_profile?.vectors || {};
    let distSq = 0;
    for (const d of QUIZ_DIMENSIONS) {
      const pVal = profile[d];
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
