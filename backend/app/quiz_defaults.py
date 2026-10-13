"""Default racquet-finder quiz template (tenant-agnostic JSON)."""

DEFAULT_DIMENSION_WEIGHTS = {
    "power": 0.2,
    "control": 0.2,
    "comfort": 0.2,
    "spin": 0.2,
    "maneuver": 0.2,
}

DEFAULT_DIMENSIONS = [
    {"id": "power", "label": "Power", "label_vi": "Lực", "default_weight": 0.2},
    {"id": "control", "label": "Control", "label_vi": "Kiểm soát", "default_weight": 0.2},
    {"id": "comfort", "label": "Comfort", "label_vi": "Êm tay", "default_weight": 0.2},
    {"id": "spin", "label": "Spin", "label_vi": "Spin", "default_weight": 0.2},
    {"id": "maneuver", "label": "Maneuver", "label_vi": "Linh hoạt", "default_weight": 0.2},
]

DEFAULT_RACQUET_FINDER = {
    "slug": "racquet-finder",
    "title": "Find your bespoke racquet",
    "title_vi": "Tìm cây vợt phù hợp",
    "subtitle": "A short interview to match your swing, comfort needs, and playing style to frames in our catalog.",
    "subtitle_vi": "Vài câu hỏi ngắn để ghép phong cách và nhu cầu êm tay với vợt trong catalog.",
    "nav_label": "RACQUET FINDER",
    "nav_label_vi": "TÌM VỢT",
    "show_in_nav": False,
    "is_published": False,
    "hero_kicker": "FITTING LAB",
    "hero_kicker_vi": "PHÒNG FIT",
    "hero_badges": [
        {"icon": "data_object", "label": "Data-driven matching", "label_vi": "Ghép theo dữ liệu"},
        {"icon": "shield_with_heart", "label": "Arm-safe RA filters", "label_vi": "Lọc chỉ số RA êm tay"},
        {"icon": "sports_tennis", "label": "Pro stringing advice", "label_vi": "Tư vấn căng dây"},
    ],
    "faq": [
        {
            "q": "What is RA (frame stiffness)?",
            "q_vi": "RA (độ cứng khung) là gì?",
            "a": "Lower RA generally means a more flexible, arm-friendly frame. Our comfort guardrails filter stiff frames when you report arm pain.",
            "a_vi": "RA thấp thường êm tay hơn. Khi bạn báo đau khuỷu, hệ thống lọc các khung quá cứng.",
        },
    ],
    "dimensions": DEFAULT_DIMENSIONS,
    "dimension_weights": DEFAULT_DIMENSION_WEIGHTS,
    "product_filter": {"category_slugs": [], "require_finder_profile": True},
    "steps": [
        {
            "id": "skill",
            "step_key": "01_SKILL",
            "title": "What best describes your game?",
            "title_vi": "Phong cách chơi của bạn?",
            "subtitle": "Baseline vs all-court vs serve-and-volley tendencies.",
            "subtitle_vi": "Thiên baseline, đa dụng hay lên lưới.",
            "required": True,
            "options": [
                {
                    "id": "baseline",
                    "icon": "terrain",
                    "title": "Baseline grinder",
                    "title_vi": "Thiên baseline",
                    "deltas": {"power": 5, "spin": 10, "control": 5},
                },
                {
                    "id": "allcourt",
                    "icon": "hub",
                    "title": "All-court",
                    "title_vi": "Đa dụng",
                    "deltas": {"control": 10, "maneuver": 10},
                },
                {
                    "id": "net",
                    "icon": "sports_martial_arts",
                    "title": "Net rusher",
                    "title_vi": "Lên lưới",
                    "deltas": {"maneuver": 15, "control": 10},
                },
            ],
        },
        {
            "id": "comfort",
            "step_key": "02_COMFORT",
            "title": "Arm comfort & sensitivity",
            "title_vi": "Độ êm & nhạy cảm tay",
            "subtitle": "We apply guardrails for tennis elbow and wrist fatigue.",
            "subtitle_vi": "Áp dụng bộ lọc khi đau khuỷu hoặc mỏi cổ tay.",
            "required": True,
            "options": [
                {
                    "id": "elbow",
                    "icon": "healing",
                    "badge": "ARM-SAFE",
                    "title": "Active tennis elbow / sensitive arm",
                    "title_vi": "Đang đau khuỷu / cần êm tối đa",
                    "deltas": {"comfort": 35, "power": -10},
                    "guardrails": {"max_ra": 63},
                },
                {
                    "id": "fatigue",
                    "icon": "sports_gymnastics",
                    "title": "Occasional fatigue",
                    "title_vi": "Thỉnh thoảng mỏi",
                    "deltas": {"comfort": 15, "maneuver": 10},
                    "guardrails": {"max_ra": 65},
                },
                {
                    "id": "healthy_control",
                    "icon": "target",
                    "title": "Healthy — prioritize control",
                    "title_vi": "Khỏe — ưu tiên kiểm soát",
                    "deltas": {"control": 25, "comfort": -5},
                },
                {
                    "id": "healthy_power",
                    "icon": "bolt",
                    "title": "Healthy — prioritize power",
                    "title_vi": "Khỏe — ưu tiên lực",
                    "deltas": {"power": 25, "spin": 10},
                },
            ],
        },
        {
            "id": "weight",
            "step_key": "03_WEIGHT",
            "title": "Frame weight preference",
            "title_vi": "Trọng lượng khung",
            "subtitle": "Static weight and swing feel.",
            "subtitle_vi": "Cảm giác vung và khối lượng.",
            "required": True,
            "options": [
                {
                    "id": "light",
                    "title": "Light & fast (≤ 285g)",
                    "title_vi": "Nhẹ & nhanh (≤ 285g)",
                    "deltas": {"maneuver": 25, "power": -5},
                    "guardrails": {"max_weight_g": 290},
                },
                {
                    "id": "medium",
                    "title": "Balanced (285–300g)",
                    "title_vi": "Cân bằng (285–300g)",
                    "deltas": {"maneuver": 10, "control": 10},
                },
                {
                    "id": "heavy",
                    "title": "Stable & heavy (300g+)",
                    "title_vi": "Nặng & ổn định (300g+)",
                    "deltas": {"control": 15, "power": 10, "maneuver": -10},
                    "guardrails": {"min_weight_g": 295},
                },
            ],
        },
    ],
}
