import BlockRenderer from "./BlockRenderer";
import type { Media } from "../types";

export type CatalogIntroProps = {
  tagline?: string | null;
  description?: string | null;
  hero?: Media | null;
  blocks?: { block_type: string; position?: number; data: Record<string, unknown> }[];
  /** Tighter spacing when rendered in the shop product column. */
  variant?: "shop" | "page";
};

function isSoloIntroBlock(blocks: CatalogIntroProps["blocks"]) {
  const sorted = [...(blocks || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (sorted.length !== 1) return false;
  const t = sorted[0].block_type;
  if (t === "service_package") return true;
  return (
    t === "image" && (sorted[0].data?.layout === "banner" || sorted[0].data?.layout === "poster")
  );
}

export default function CatalogIntro({
  tagline,
  description,
  hero,
  blocks,
  variant = "page",
}: CatalogIntroProps) {
  const sorted = [...(blocks || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const soloIntro = isSoloIntroBlock(blocks);
  const hasCopy = Boolean(
    hero?.url || sorted.length > 0 || (!soloIntro && (tagline || description)),
  );
  if (!hasCopy) return null;

  const shop = variant === "shop";
  const sectionClass = shop
    ? "flex flex-col gap-4"
    : "mb-8 flex flex-col gap-6 border-b border-surface-container-high pb-8";

  return (
    <section className={sectionClass} aria-label="Category introduction">
      {hero?.url ? (
        <div className="w-full overflow-hidden rounded-lg bg-surface-container-low border border-surface-container-high">
          <img src={hero.url} alt="" className="w-full h-auto object-contain" />
        </div>
      ) : null}
      {!soloIntro && tagline ? (
        <p className="font-label text-label-caps text-forest-green uppercase tracking-widest">{tagline}</p>
      ) : null}
      {!soloIntro && description ? (
        <p className="font-body text-body-md sm:text-body-lg text-secondary max-w-3xl leading-relaxed whitespace-pre-line">
          {description}
        </p>
      ) : null}
      {sorted.length > 0 ? (
        <div
          className={`flex flex-col w-full ${soloIntro ? "gap-0" : shop ? "gap-4" : "gap-6"}`}
        >
          {sorted.map((block, i) => (
            <BlockRenderer key={i} block={block} context={shop ? "catalog" : "page"} />
          ))}
        </div>
      ) : null}
    </section>
  );
}