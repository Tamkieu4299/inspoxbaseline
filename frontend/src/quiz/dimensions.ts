import type { ShopQuiz } from "../types";

/** Legacy default when no quiz dimensions are configured. */
export const LEGACY_QUIZ_DIMENSIONS = ["power", "control", "comfort", "spin", "maneuver"] as const;

export type QuizDimensionDef = {
  id: string;
  label: string;
  label_vi?: string;
  /** Relative importance in match % (normalized on save/score). */
  default_weight?: number;
};

export function slugifyDimensionId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function legacyDimensionDefs(): QuizDimensionDef[] {
  const w = 1 / LEGACY_QUIZ_DIMENSIONS.length;
  return LEGACY_QUIZ_DIMENSIONS.map((id) => ({ id, label: id, default_weight: w }));
}

/** Tennis Warehouse–style review scores (enter 0–100; TW 0–10 × 10). */
export function tennisWarehouseReviewDimensions(): QuizDimensionDef[] {
  const labels: { id: string; label: string; label_vi: string }[] = [
    { id: "groundstrokes", label: "Groundstrokes", label_vi: "Groundstroke" },
    { id: "volleys", label: "Volleys", label_vi: "Volley" },
    { id: "serves", label: "Serves", label_vi: "Giao bóng" },
    { id: "returns", label: "Returns", label_vi: "Return" },
    { id: "power", label: "Power", label_vi: "Lực" },
    { id: "control", label: "Control", label_vi: "Kiểm soát" },
    { id: "maneuverability", label: "Maneuverability", label_vi: "Linh hoạt" },
    { id: "stability", label: "Stability", label_vi: "Ổn định" },
    { id: "comfort", label: "Comfort", label_vi: "Êm tay" },
    { id: "touch", label: "Touch / Feel", label_vi: "Cảm giác" },
    { id: "topspin", label: "Topspin", label_vi: "Topspin" },
    { id: "slice", label: "Slice", label_vi: "Slice" },
    { id: "overall", label: "Overall", label_vi: "Tổng thể" },
  ];
  const w = 1 / labels.length;
  return labels.map((d) => ({ ...d, default_weight: w }));
}

export function resolveQuizDimensions(quiz: Pick<ShopQuiz, "dimensions" | "dimension_weights">): QuizDimensionDef[] {
  const configured = (quiz.dimensions || []).filter((d) => d.id?.trim());
  if (configured.length) return configured;
  const weightKeys = Object.keys(quiz.dimension_weights || {}).filter(Boolean);
  if (weightKeys.length) {
    return weightKeys.map((id) => ({
      id,
      label: id,
      default_weight: Number(quiz.dimension_weights?.[id]) || undefined,
    }));
  }
  return legacyDimensionDefs();
}

export function dimensionIdsFromQuiz(quiz: Pick<ShopQuiz, "dimensions" | "dimension_weights">): string[] {
  return resolveQuizDimensions(quiz).map((d) => d.id);
}

export function defaultWeightsForDimensions(defs: QuizDimensionDef[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of defs) {
    const w = d.default_weight;
    out[d.id] = Number.isFinite(w) && w! > 0 ? w! : 1;
  }
  return out;
}

export function mergeDimensionWeights(
  defs: QuizDimensionDef[],
  existing: Record<string, number> | undefined
): Record<string, number> {
  const base = defaultWeightsForDimensions(defs);
  const merged = { ...base, ...(existing || {}) };
  const ids = new Set(defs.map((d) => d.id));
  for (const k of Object.keys(merged)) {
    if (!ids.has(k)) delete merged[k];
  }
  for (const d of defs) {
    if (merged[d.id] == null || !Number.isFinite(Number(merged[d.id]))) {
      merged[d.id] = base[d.id] ?? 1;
    }
  }
  return merged;
}

/** Union of dimension defs across quizzes (first label wins). */
export function collectDimensionsFromQuizzes(quizzes: ShopQuiz[]): QuizDimensionDef[] {
  const byId = new Map<string, QuizDimensionDef>();
  for (const q of quizzes) {
    for (const d of resolveQuizDimensions(q)) {
      if (!byId.has(d.id)) byId.set(d.id, d);
    }
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}
