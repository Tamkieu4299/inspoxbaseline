/** Material Symbols names used in product features (allowlist + sanitize typos). */
const COMMON_ICONS = [
  "auto_awesome",
  "straighten",
  "shield",
  "palette",
  "brush",
  "tune",
  "bolt",
  "sports_tennis",
  "verified",
  "star",
] as const;

const VALID_ICON = /^[a-z][a-z0-9_]{0,31}$/;

/** Return a safe Material Symbols ligature name, or null if unusable. */
export function sanitizeMaterialIcon(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const lower = raw.trim().toLowerCase();
  if (VALID_ICON.test(lower)) return lower;

  for (const name of COMMON_ICONS) {
    if (lower === name) return name;
    if (lower.startsWith(name + name)) return name;
    if (lower.startsWith(name) && !/^[a-z0-9_]/i.test(raw.trim().slice(name.length))) {
      return name;
    }
  }

  const head = lower.match(/^[a-z][a-z0-9_]*/)?.[0];
  if (head && head.length <= 32 && VALID_ICON.test(head)) return head;

  return null;
}
