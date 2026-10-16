import type { ShopQuiz } from "../types";
import {
  legacyDimensionDefs,
  mergeDimensionWeights,
  tennisWarehouseReviewDimensions,
} from "./dimensions";
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
    title: "Find your bespoke racquet",
    title_vi: "Tìm cây vợt phù hợp",
    subtitle: "Ten questions tuned to Tennis Warehouse playtest scores in our catalog.",
    subtitle_vi: "Mười câu hỏi ghép với điểm playtest kiểu Tennis Warehouse trong catalog.",
    nav_label: "RACQUET FINDER",
    nav_label_vi: "TÌM VỢT",
    show_in_nav: false,
    is_published: false,
    hero_kicker: "FITTING LAB",
    hero_kicker_vi: "PHÒNG FIT",
    hero_badges: [
      { icon: "data_object", label: "TW review matching", label_vi: "Ghép theo điểm TW" },
      { icon: "shield_with_heart", label: "RA & weight filters", label_vi: "Lọc RA & trọng lượng" },
    ],
    faq: [],
    dimensions,
    dimension_weights: mergeDimensionWeights(dimensions, {}),
    product_filter: { category_slugs: [], require_finder_profile: true },
    steps: twRacquetFinderSteps(),
  };
}

/** Alias for TW-axis racquet finder (same as racquetFinderTemplate). */
export function tennisWarehouseReviewTemplate(): Partial<ShopQuiz> {
  return {
    ...racquetFinderTemplate(),
    slug: "racquet-review-match",
    title: "Match by TW-style review scores",
    title_vi: "Ghép theo điểm review kiểu TW",
    nav_label: "RACQUET MATCH",
    nav_label_vi: "GHÉP VỢT",
  };
}
