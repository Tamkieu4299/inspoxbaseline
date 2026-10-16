"""Tennis Warehouse racquet review field names (quiz + specs)."""

from __future__ import annotations

# TW Breakdown Summary label -> quiz dimension id (0–10 scores stored as 0–100 in vectors).
TW_BREAKDOWN_TO_VECTOR: dict[str, str] = {
    "groundstrokes": "groundstrokes",
    "volleys": "volleys",
    "serves": "serves",
    "returns": "returns",
    "power": "power",
    "control": "control",
    "maneuverability": "maneuverability",
    "stability": "stability",
    "comfort": "comfort",
    "touch / feel": "touch",
    "touch/feel": "touch",
    "touch": "touch",
    "topspin": "topspin",
    "slice": "slice",
}

TW_TECH_SPEC_ORDER: tuple[str, ...] = (
    "Length",
    "Head Size",
    "Weight",
    "Balance Point",
    "Construction",
    "String Pattern",
)

TW_LAB_ROWS: tuple[str, ...] = ("Flex Rating Test", "Swing Weight")
