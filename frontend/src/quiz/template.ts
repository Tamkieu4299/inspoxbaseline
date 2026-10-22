import type { ShopQuiz } from "../types";
import {
  legacyDimensionDefs,
  mergeDimensionWeights,
  tennisWarehouseReviewDimensions,
} from "./dimensions";
import { headRacquetFinderSteps } from "./headRacquetFinderSteps";
import { twRacquetFinderSteps } from "./racquetFinderSteps";

/** Starter racquet-finder quiz (matches backend quiz_defaults). */
export function blankQuiz(): Partial<ShopQuiz> {
  const dimensions = legacyDimensionDefs();
  return {
    slug: "",
    title: "",
    title_vi: "",
    subtitle: "",
    subtitle_vi: "",
    nav_label: "",
    nav_label_vi: "",
    show_in_nav: false,
    is_published: false,
    hero_kicker: "",
    hero_kicker_vi: "",
    hero_badges: [],
    faq: [],
    dimensions,
    dimension_weights: mergeDimensionWeights(dimensions, {}),
    product_filter: { category_slugs: [], require_finder_profile: true },
    steps: [],
  };
}

export function racquetFinderTemplate(): Partial<ShopQuiz> {
  const dimensions = tennisWarehouseReviewDimensions();
  return {
    slug: "racquet-finder",
    title: "Tennis racquet finder",
    title_vi: "Tìm vợt tennis phù hợp",
    subtitle: "Six quick questions inspired by the HEAD Racquet Finder — matched to our full racquet catalog.",
    subtitle_vi: "Sáu câu hỏi theo phong cách HEAD Racquet Finder — ghép với toàn bộ catalog vợt.",
    nav_label: "RACQUET FINDER",
    nav_label_vi: "TÌM VỢT",
    show_in_nav: false,
    is_published: false,
    hero_kicker: "RACQUET FINDER",
    hero_kicker_vi: "TÌM VỢT",
    hero_badges: [
      { icon: "quiz", label: "6-question profile", label_vi: "Hồ sơ 6 câu hỏi" },
      { icon: "data_object", label: "Catalog match scores", label_vi: "Điểm ghép catalog" },
      { icon: "shield_with_heart", label: "Weight & RA filters", label_vi: "Lọc trọng lượng & RA" },
    ],
    faq: [],
    dimensions,
    dimension_weights: mergeDimensionWeights(dimensions, {}),
    product_filter: { category_slugs: [], require_finder_profile: true },
    steps: headRacquetFinderSteps(),
  };
}

/** Alias for TW-axis racquet finder (same as racquetFinderTemplate). */
export function tennisWarehouseReviewTemplate(): Partial<ShopQuiz> {
  const dimensions = tennisWarehouseReviewDimensions();
  return {
    ...racquetFinderTemplate(),
    slug: "racquet-review-match",
    title: "Match by TW-style review scores",
    title_vi: "Ghép theo điểm review kiểu TW",
    subtitle: "Twelve questions tuned to Tennis Warehouse playtest scores in our catalog.",
    subtitle_vi: "Mười hai câu hỏi ghép với điểm playtest kiểu Tennis Warehouse trong catalog.",
    nav_label: "RACQUET MATCH",
    nav_label_vi: "GHÉP VỢT",
    hero_kicker: "FITTING LAB",
    hero_kicker_vi: "PHÒNG FIT",
    steps: twRacquetFinderSteps(),
    dimensions,
    dimension_weights: mergeDimensionWeights(dimensions, {}),
  };
}
