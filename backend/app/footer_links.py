"""Footer link presets and resolution for storefront / admin site settings."""

from __future__ import annotations

from typing import Any

FOOTER_PRESET_DEFAULTS: dict[str, dict[str, str | None]] = {
    "terms": {
        "label": "Terms of service",
        "label_vi": "Điều khoản sử dụng",
        "url": None,
    },
    "shipping": {
        "label": "Shipping & returns",
        "label_vi": "Giao hàng & đổi trả",
        "url": None,
    },
    "brand": {
        "label": "Brand experience",
        "label_vi": "Trải nghiệm thương hiệu",
        "url": "/brand",
    },
    "admin": {
        "label": "Admin",
        "label_vi": "Quản trị",
        "url": "/admin",
    },
}

FOOTER_PRESET_KEYS = list(FOOTER_PRESET_DEFAULTS.keys())

# Quoc Sport-style presets removed from admin; drop if still stored in JSON.
REMOVED_FOOTER_PRESET_KEYS = frozenset(
    {
        "privacy",
        "shipping_policy",
        "return_policy",
        "careers",
        "contact",
        "order_lookup",
    }
)

DEFAULT_ENABLED_FOOTER_KEYS = frozenset({"terms", "shipping", "brand", "admin"})


def _preset_enabled_by_default(key: str) -> bool:
    return key in DEFAULT_ENABLED_FOOTER_KEYS


def default_footer_link_configs() -> list[dict[str, Any]]:
    return [
        {
            "key": key,
            "enabled": _preset_enabled_by_default(key),
            "label": None,
            "label_vi": None,
            "url": None,
        }
        for key in FOOTER_PRESET_KEYS
    ]


def normalize_footer_link_configs(stored: list | None) -> list[dict[str, Any]]:
    """Sanitize rows and preserve merchant-defined order (add/remove/reorder in admin)."""
    if not stored:
        return default_footer_link_configs()
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in stored:
        if not isinstance(raw, dict):
            continue
        key = str(raw.get("key") or "").strip()
        if not key or key in REMOVED_FOOTER_PRESET_KEYS or key in seen:
            continue
        seen.add(key)
        enabled = raw.get("enabled")
        if enabled is None:
            enabled = _preset_enabled_by_default(key) if key in FOOTER_PRESET_DEFAULTS else True
        out.append(
            {
                "key": key,
                "enabled": bool(enabled),
                "label": raw.get("label"),
                "label_vi": raw.get("label_vi"),
                "url": raw.get("url"),
            }
        )
    return out if out else default_footer_link_configs()


def resolve_footer_links(stored: list | None, lang: str) -> list[dict[str, str | None]]:
    configs = normalize_footer_link_configs(stored)
    resolved: list[dict[str, str | None]] = []
    for item in configs:
        if not item.get("enabled", True):
            continue
        key = str(item.get("key") or "")
        preset = FOOTER_PRESET_DEFAULTS.get(key, {})
        label_en = (item.get("label") or preset.get("label") or "").strip()
        label_vi = (item.get("label_vi") or preset.get("label_vi") or "").strip()
        if lang == "vi":
            label = label_vi or label_en
        else:
            label = label_en or label_vi
        if not label:
            continue
        url = item.get("url")
        if url is None or url == "":
            url = preset.get("url")
        url = (url or "").strip() or None
        if not url:
            continue
        resolved.append({"label": label, "url": url})
    return resolved
