import BlockRenderer from "./BlockRenderer";
import type { Media } from "../types";

export type CatalogIntroProps = {
  tagline?: string | null;
  description?: string | null;
  hero?: Media | null;
  blocks?: { block_type: string; position?: number; data: Record<string, unknown> }[];
};

export default function CatalogIntro({ tagline, description, hero, blocks }: CatalogIntroProps) {
  const sorted = [...(blocks || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const hasCopy = Boolean(tagline || description || hero?.url || sorted.length > 0);
  if (!hasCopy) return null;

  return (
    <section className="mb-8 flex flex-col gap-6 border-b border-surface-container-high pb-8">
      {hero?.url ? (
        <div className="w-full max-h-[420px] overflow-hidden bg-surface-container-low">
          <img src={hero.url} alt="" className="w-full h-full max-h-[420px] object-cover" />
        </div>
      ) : null}
      {tagline ? (
        <p className="font-label text-label-caps text-forest-green uppercase tracking-widest">{tagline}</p>
      ) : null}
      {description ? (
        <p className="font-body text-body-md sm:text-body-lg text-secondary max-w-3xl leading-relaxed whitespace-pre-line">
          {description}
        </p>
      ) : null}
      {sorted.length > 0 ? (
        <div className="flex flex-col gap-6">
          {sorted.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      ) : null}
    </section>
  );
}