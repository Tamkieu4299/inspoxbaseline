/** Normalize racquet title for dedupe groups (not for DB). */
export function racquetFamilyKey(name: string): string {
  let s = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  s = s.replace(/\bwr\d+[a-z]?\d*\b/g, "");
  s = s.replace(/\b(frm|unstrung|strung)\b/g, " ");
  const stripEdition = [
    "roland garros",
    "laver cup",
    "fighter",
    "us open",
    "minions",
    "horse",
    "qz",
    "pretty fast",
    "carbon grey",
    "chua cang day",
    "chưa căng dây",
  ];
  for (const frag of stripEdition) s = s.split(frag).join(" ");
  s = s.replace(/\brf\s*0?1\b/g, "rf01");
  s = s.replace(/[^a-z0-9x]+/g, " ").replace(/\s+/g, " ").trim();
  const tokens = s.split(" ").filter((t) => {
    if (!t) return false;
    if (t === "vot" || t === "tennis" || t === "2") return false;
    return t.length > 1 || /\d/.test(t);
  });
  return tokens.slice(0, 10).join(" ");
}

export function formatQuizProductName(name: string, lang: string): string {
  let s = name.trim();
  if (lang === "vi") {
    s = s.replace(/^vợt\s+tennis\s+/i, "");
  } else {
    s = s.replace(/^tennis\s+racquet\s+/i, "");
  }
  s = s.replace(/\s+frm\s*\d*\s*/gi, " ");
  s = s.replace(/\s+wr\d+[a-z]?\d*\s*$/i, "");
  s = s.replace(/\s+chưa\s+căng\s+dây\s*/gi, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s || name;
}

export type RankedMatch = {
  slug: string;
  match: number;
  product: { name: string; [k: string]: unknown };
};

/** Keep best match per model family so results are not three editions of the same frame. */
export function diversifyRankedMatches<T extends RankedMatch>(
  ranked: T[],
  limit: number,
  maxPerFamily = 1
): T[] {
  const out: T[] = [];
  const seen = new Map<string, number>();
  for (const row of ranked) {
    const key = racquetFamilyKey(row.product.name);
    const n = seen.get(key) || 0;
    if (n >= maxPerFamily) continue;
    seen.set(key, n + 1);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}
