import type { ShopQuiz } from "../types";

/** Starter racquet-finder quiz (matches backend quiz_defaults). */
export function blankQuiz(): Partial<ShopQuiz> {
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
    dimension_weights: { power: 0.2, control: 0.2, comfort: 0.2, spin: 0.2, maneuver: 0.2 },
    product_filter: { category_slugs: [], require_finder_profile: true },
    steps: [],
  };
}

export function racquetFinderTemplate(): Partial<ShopQuiz> {
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
    dimension_weights: { power: 0.2, control: 0.2, comfort: 0.2, spin: 0.2, maneuver: 0.2 },
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
