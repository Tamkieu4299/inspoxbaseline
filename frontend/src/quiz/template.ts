import type { ShopQuiz } from "../types";
import {
  legacyDimensionDefs,
  mergeDimensionWeights,
  tennisWarehouseReviewDimensions,
} from "./dimensions";

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
  const dimensions = legacyDimensionDefs();
  return {
    slug: "racquet-finder",
    title: "Find your bespoke racquet",
    title_vi: "Tìm cây vợt phù hợp",
    subtitle: "Interview-style matching against your catalog.",
    subtitle_vi: "Ghép vợt theo phong cách chơi và nhu cầu êm tay.",
    nav_label: "RACQUET FINDER",
    nav_label_vi: "TÌM VỢT",
    show_in_nav: false,
    is_published: false,
    hero_kicker: "FITTING LAB",
    hero_kicker_vi: "PHÒNG FIT",
    hero_badges: [
      { icon: "data_object", label: "Data-driven matching", label_vi: "Ghép theo dữ liệu" },
      { icon: "shield_with_heart", label: "Arm-safe RA filters", label_vi: "Lọc RA êm tay" },
    ],
    faq: [],
    dimensions,
    dimension_weights: mergeDimensionWeights(dimensions, {}),
    product_filter: { category_slugs: [], require_finder_profile: true },
    steps: [
      {
        id: "comfort",
        step_key: "01_COMFORT",
        title: "Arm comfort",
        title_vi: "Độ êm tay",
        subtitle: "",
        subtitle_vi: "",
        required: true,
        options: [
          {
            id: "elbow",
            icon: "healing",
            title: "Sensitive arm / tennis elbow",
            title_vi: "Đau khuỷu / cần êm",
            deltas: { comfort: 35 },
            guardrails: { max_ra: 63 },
          },
          {
            id: "ok",
            title: "No issues",
            title_vi: "Không vấn đề",
            deltas: { control: 10 },
          },
        ],
      },
    ],
  };
}

/** Quiz using Tennis Warehouse–style review axes (scores 0–100 on products). */
export function tennisWarehouseReviewTemplate(): Partial<ShopQuiz> {
  const dimensions = tennisWarehouseReviewDimensions();
  return {
    ...racquetFinderTemplate(),
    slug: "racquet-review-match",
    title: "Match by TW-style review scores",
    title_vi: "Ghép theo điểm review kiểu TW",
    subtitle: "Define products with Groundstrokes, Volleys, Power, etc. Questions nudge those axes.",
    subtitle_vi: "Nhập điểm Groundstrokes, Volleys, Power… trên sản phẩm; câu trả lời điều chỉnh trục tương ứng.",
    nav_label: "RACQUET MATCH",
    nav_label_vi: "GHÉP VỢT",
    dimensions,
    dimension_weights: mergeDimensionWeights(dimensions, {}),
    steps: [
      {
        id: "style",
        step_key: "01_STYLE",
        title: "Where do you win most points?",
        title_vi: "Bạn ghi điểm chủ yếu ở đâu?",
        required: true,
        options: [
          {
            id: "baseline",
            title: "Baseline",
            title_vi: "Baseline",
            deltas: { groundstrokes: 25, topspin: 15 },
          },
          {
            id: "net",
            title: "Net / volleys",
            title_vi: "Lên lưới",
            deltas: { volleys: 25, touch: 10 },
          },
          {
            id: "serve",
            title: "Serve + first strike",
            title_vi: "Giao bóng / tấn công",
            deltas: { serves: 25, power: 10 },
          },
        ],
      },
      {
        id: "comfort",
        step_key: "02_COMFORT",
        title: "Arm comfort",
        title_vi: "Độ êm tay",
        required: true,
        options: [
          {
            id: "elbow",
            title: "Need arm-friendly frame",
            title_vi: "Cần vợt êm tay",
            deltas: { comfort: 30 },
            guardrails: { max_ra: 63 },
          },
          {
            id: "ok",
            title: "No arm issues",
            title_vi: "Không vấn đề",
            deltas: { control: 10 },
          },
        ],
      },
    ],
  };
}
