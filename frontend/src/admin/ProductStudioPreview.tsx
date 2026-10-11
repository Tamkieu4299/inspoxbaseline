import ProductGallery from "../components/ProductGallery";
import { useLanguage } from "../i18n";
import { formatMoney } from "../money";
import type { ProductDraft } from "./productDraft";
import { skuFromSlug } from "./productDraft";

export function ProductStudioPreview({
  draft,
  currency,
  locale,
}: {
  draft: ProductDraft;
  currency: string;
  locale: string;
}) {
  const { t } = useLanguage();
  const hero = draft.images.find((i) => i.enabled) || draft.images[0];

  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-md flex flex-col gap-4 sticky top-4">
      <div className="flex items-center gap-2 pb-2 border-b border-surface-container">
        <span className="material-symbols-outlined text-[18px] text-primary">visibility</span>
        <span className="font-label text-label-caps uppercase text-primary font-bold">{t("admin.studio.livePdp")}</span>
      </div>
      <div className="mx-auto w-full max-w-[360px] bg-surface rounded-2xl overflow-hidden shadow-xl p-4 flex flex-col gap-3">
        <div className="relative w-full aspect-[4/5] bg-surface-container-low rounded-xl overflow-hidden">
          {hero?.url ? (
            <img src={hero.url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-secondary text-sm">{t("admin.noVisibleImages")}</div>
          )}
          {draft.badge ? (
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded bg-forest-green text-white font-label text-[9px] uppercase font-bold tracking-widest">
              {draft.badge}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase text-secondary tracking-wider">
            SKU: {draft.slug ? skuFromSlug(draft.slug) : "—"}
          </span>
          <h3 className="font-headline text-lg uppercase tracking-tight text-primary leading-tight line-clamp-2">
            {draft.name || t("admin.newProductTitle")}
          </h3>
          <p className="font-body text-sm font-bold text-primary">
            {formatMoney(Number(draft.price) || 0, currency, locale)}
          </p>
          {(draft.subtitle || draft.description) && (
            <p className="font-body text-xs text-secondary leading-relaxed line-clamp-3">
              {draft.subtitle || draft.description}
            </p>
          )}
        </div>
        {draft.images.filter((i) => i.enabled).length > 1 && (
          <div className="border border-surface-container rounded-lg overflow-hidden scale-[0.85] origin-top -mt-2 pointer-events-none">
            <ProductGallery images={draft.images} name={draft.name} layout={draft.gallery_layout} />
          </div>
        )}
      </div>
    </div>
  );
}
