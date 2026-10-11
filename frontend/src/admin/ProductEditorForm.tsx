import { useEffect, useRef, useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { Category, CollectionSummary } from "../types";
import ProductGallery from "../components/ProductGallery";
import {
  DangerButton,
  Field,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextArea,
  TextInput,
  ViArea,
  ViInput,
  inputCls,
} from "./ui";
import { useLanguage } from "../i18n";
import { formatMoney } from "../money";
import { PRODUCT_BADGES, type ProductDraft } from "./productDraft";
import { StudioModule, StudioToggle, studioInputClass } from "./studioUi";

export type ProductStudioTab = "general" | "media" | "story" | "variants";

function CategoryChipField({
  categories,
  categoryIds,
  onChange,
  draftKey,
}: {
  categories: Category[] | undefined;
  categoryIds: number[];
  onChange: (ids: number[]) => void;
  /** Reset closed state when switching products */
  draftKey: number | undefined;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [draftKey]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const selected = (categories || []).filter((c) => categoryIds.includes(c.id));
  const primaryId = categoryIds[0];
  const available = (categories || []).filter((c) => !categoryIds.includes(c.id));

  function remove(id: number) {
    onChange(categoryIds.filter((x) => x !== id));
  }

  function add(id: number) {
    onChange([...categoryIds, id]);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2 md:col-span-2">
      <span className="font-label text-label-caps uppercase tracking-wider text-on-surface">{t("admin.categories")}</span>
      <div className="p-2.5 bg-surface-container-low rounded min-h-[50px] flex flex-wrap gap-2 items-center">
        {selected.length === 0 ? (
          <span className="font-body text-body-sm text-secondary px-1">{t("admin.none")}</span>
        ) : (
          selected.map((c) => (
            <span
              key={c.id}
              className={`px-2.5 py-1 rounded font-label text-[11px] uppercase tracking-wider flex items-center gap-1.5 ${
                c.id === primaryId ? "bg-primary text-on-primary" : "bg-surface-container-highest text-on-surface"
              }`}
            >
              {c.name}
              <button type="button" aria-label={t("admin.remove")} onClick={() => remove(c.id)} className="leading-none opacity-80 hover:opacity-100">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          ))
        )}
        {available.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="px-2.5 py-1 rounded border border-dashed border-surface-container-highest font-label text-[11px] uppercase text-forest-green hover:bg-surface-container-lowest"
          >
            + {t("admin.add")}
          </button>
        ) : null}
      </div>
      {open && available.length > 0 ? (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 border border-surface-container-highest bg-white shadow-lg py-1 max-h-40 overflow-y-auto">
          {available.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => add(c.id)}
              className="w-full text-left px-3 py-2 font-body text-body-md hover:bg-surface-container-low"
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-secondary text-xs font-body">{t("admin.productCategoriesHint")}</p>
    </div>
  );
}

const GALLERY_LAYOUTS = [
  { id: "collage", icon: "dashboard_customize", labelKey: "admin.galleryCollage" },
  { id: "grid", icon: "grid_view", labelKey: "admin.galleryGrid" },
  { id: "masonry", icon: "view_quilt", labelKey: "admin.galleryMasonry" },
  { id: "slideshow", icon: "view_carousel", labelKey: "admin.gallerySlideshow" },
] as const;

export function ProductEditorForm({
  draft,
  set,
  categories,
  collections,
  selectedCell,
  setSelectedCell,
  pickImageFor,
  setPickImageFor,
  cropTarget,
  setCropTarget,
  moveImage,
  uploadMutation,
  queryClient,
  onDelete,
  compactHeader,
  studioTab = "general",
}: {
  draft: ProductDraft;
  set: <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => void;
  categories: Category[] | undefined;
  collections: CollectionSummary[] | undefined;
  selectedCell: number | null;
  setSelectedCell: (n: number | null) => void;
  pickImageFor: number | null;
  setPickImageFor: (n: number | null) => void;
  cropTarget: number | null;
  setCropTarget: (n: number | null) => void;
  moveImage: (index: number, dir: -1 | 1) => void;
  uploadMutation: UseMutationResult<unknown, Error, File | Blob, unknown>;
  queryClient: QueryClient;
  onDelete?: () => void;
  compactHeader?: boolean;
  studioTab?: ProductStudioTab;
}) {
  const { t, lang } = useLanguage();
  const currency = "VND";
  const locale = "vi-VN";
  const [priceText, setPriceText] = useState("");
  useEffect(() => {
    const p = Number(draft.price);
    setPriceText(p > 0 ? String(Math.round(p)) : "");
  }, [draft.id]);

  const mainImageIndex = draft.images.findIndex((i) => i.enabled);
  const heroIndex = mainImageIndex >= 0 ? mainImageIndex : 0;
  const heroImage = draft.images[heroIndex];

  return (
    <div className="flex flex-col gap-8">
      {studioTab === "general" ? (
        <StudioModule
          n="01"
          title={t("admin.studio.generalTitle")}
          subtitle={t("admin.studio.generalSubtitle")}
          badge={t("admin.studio.moduleActive")}
        >
          <div className="p-4 rounded-lg bg-surface-container-low flex flex-col sm:flex-row items-center gap-5">
            <div className="w-24 h-24 rounded-lg overflow-hidden relative shrink-0 bg-surface-container">
              {heroImage?.url ? (
                <img src={heroImage.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined">image</span>
                </div>
              )}
              {heroImage?.enabled !== false && heroImage?.url ? (
                <span className="absolute bottom-1 left-1 right-1 text-center font-label text-[9px] bg-primary text-on-primary px-1 py-0.5 rounded uppercase tracking-wider">
                  {t("admin.studio.heroKey")}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-label text-label-caps text-primary uppercase">{t("admin.studio.mainCover")}</span>
              <span className="font-body text-[13px] text-secondary truncate mt-1">
                {heroImage?.url ? heroImage.url.split("/").pop() : t("admin.noVisibleImages")}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <SecondaryButton onClick={() => setPickImageFor(heroIndex)}>{t("admin.change")}</SecondaryButton>
              {heroImage?.url ? (
                <SecondaryButton
                  onClick={() => {
                    if (draft.images.length <= 1) {
                      set("images", [{ media_id: 0, url: "", alt: "", position: 0, enabled: false }]);
                    } else {
                      set(
                        "images",
                        draft.images.map((im, i) => (i === heroIndex ? { ...im, enabled: false } : im))
                      );
                    }
                  }}
                >
                  {t("admin.studio.clearHero")}
                </SecondaryButton>
              ) : null}
            </div>
          </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Name *">
                <TextInput value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="CLUB PERFORMANCE POLO" />
              </Field>
              <ViInput label={t("admin.name")} value={draft.name_vi} onChange={(e) => set("name_vi", e.target.value)} placeholder="Tên tiếng Việt" />
              <Field label="Slug *">
                <TextInput value={draft.slug} onChange={(e) => set("slug", e.target.value)} placeholder="club-performance-polo" />
              </Field>
              <Field label={t("admin.priceInCurrency", { currency })}>
                <TextInput
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="350000"
                  value={priceText}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setPriceText(digits);
                    set("price", digits === "" ? 0 : Number(digits));
                  }}
                />
                <p className="text-secondary text-xs mt-1 font-body">
                  {t("admin.priceStorefrontPreview", {
                    price: formatMoney(Number(draft.price) || 0, currency, locale),
                  })}
                </p>
              </Field>
              <CategoryChipField
                categories={categories}
                categoryIds={draft.category_ids}
                draftKey={draft.id}
                onChange={(ids) => {
                  set("category_ids", ids);
                  set("category_id", ids[0] ?? "");
                }}
              />
              <Field label="Collection">
                <Select
                  value={draft.collection_id}
                  onChange={(e) => set("collection_id", e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">{t("admin.none")}</option>
                  {(collections || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Badge">
                <Select value={draft.badge} onChange={(e) => set("badge", e.target.value)}>
                  {PRODUCT_BADGES.map((b) => (
                    <option key={b || "none"} value={b}>{b || t("admin.none")}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("admin.productCaption")}>
                <TextArea rows={2} value={draft.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder={t("admin.productCaptionHint")} />
              </Field>
              <ViArea label={t("admin.productCaption")} rows={2} value={draft.subtitle_vi} onChange={(e) => set("subtitle_vi", e.target.value)} placeholder="Phụ đề / caption tiếng Việt" />
            </div>
            <Field label={t("admin.description")}>
              <TextArea rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <ViArea label={t("admin.description")} rows={3} value={draft.description_vi} onChange={(e) => set("description_vi", e.target.value)} placeholder="Mô tả tiếng Việt" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StudioToggle
                label={t("admin.active")}
                checked={draft.is_active}
                onChange={(v) => set("is_active", v)}
              />
              <StudioToggle
                label={t("admin.featuredHome")}
                checked={draft.is_featured}
                onChange={(v) => set("is_featured", v)}
              />
              <StudioToggle
                label={t("admin.bestseller")}
                checked={draft.is_bestseller}
                onChange={(v) => set("is_bestseller", v)}
              />
            </div>
        </StudioModule>
      ) : null}

      {studioTab === "media" ? (
        <>
            <StudioModule
              n="02"
              title={t("admin.studio.mediaTitle")}
              subtitle={t("admin.studio.mediaSubtitle")}
              badge={t("admin.studio.moduleActive")}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {GALLERY_LAYOUTS.map((layout) => {
                  const active = draft.gallery_layout === layout.id;
                  return (
                    <button
                      key={layout.id}
                      type="button"
                      onClick={() => set("gallery_layout", layout.id)}
                      className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                        active
                          ? "border-primary bg-surface-container-low"
                          : "border-surface-container bg-surface-container-lowest hover:bg-surface-container-low"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[28px] text-primary">{layout.icon}</span>
                      <span className="font-label text-[10px] uppercase tracking-wider text-on-surface">{t(layout.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="font-label text-label-caps text-secondary text-xs">{t("admin.galleryCollageHint")}</p>
            </StudioModule>

            {/* Layout preview */}
            <div>
              <h4 className="font-headline text-headline-md text-primary uppercase mb-2">{t("admin.layoutPreview")}</h4>
              <p className="font-label text-label-caps text-secondary mb-2">{t("admin.layoutPreviewHint")}</p>
              <div className="border border-surface-container-highest bg-white p-4 md:p-6 relative">
                {draft.images.some((i) => i.enabled) ? (
                  (() => {
                    const visibleIndices = draft.images
                      .map((im, i) => (im.enabled ? i : -1))
                      .filter((i) => i >= 0);
                    return (
                      <>
                        <ProductGallery
                          images={draft.images}
                          name={draft.name || "PRODUCT"}
                          layout={draft.gallery_layout}
                          activeIndex={
                            selectedCell != null ? visibleIndices.indexOf(selectedCell) : undefined
                          }
                          onImageClick={(vIdx) => {
                            const draftIdx = visibleIndices[vIdx];
                            if (draftIdx !== undefined) setSelectedCell(draftIdx);
                          }}
                        />
                        {selectedCell !== null && draft.images[selectedCell] && (
                          <div className="mt-4 w-full max-w-md border border-forest-green bg-surface-container-lowest shadow-lg rounded-lg p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <p className="font-headline text-headline-md text-primary uppercase">
                                {t("admin.imageEditor")}
                              </p>
                              <button
                                onClick={() => setSelectedCell(null)}
                                aria-label={t("admin.done")}
                                className="text-primary hover:text-forest-green text-xl leading-none"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="flex items-center gap-3">
                              <img
                                src={draft.images[selectedCell].url}
                                alt=""
                                className="w-14 h-[72px] object-cover bg-surface-container-low"
                              />
                              <div>
                                <p className="font-label text-label-caps text-secondary uppercase">
                                  {t("admin.imageN")} {selectedCell + 1} / {draft.images.length}
                                </p>
                                <p className="font-body text-body-md text-on-background">
                                  {draft.images[selectedCell].enabled
                                    ? t("admin.navEnabled")
                                    : t("admin.hidden")}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <PrimaryButton onClick={() => setCropTarget(selectedCell)}>
                                {t("admin.crop")}
                              </PrimaryButton>
                              <SecondaryButton onClick={() => setPickImageFor(selectedCell)}>
                                {t("admin.change")}
                              </SecondaryButton>
                              <SecondaryButton
                                onClick={() => {
                                  const idx = selectedCell;
                                  if (idx === 0) return;
                                  moveImage(idx, -1);
                                  setSelectedCell(idx - 1);
                                }}
                                disabled={selectedCell === 0}
                              >
                                ↑ {t("admin.navUp")}
                              </SecondaryButton>
                              <SecondaryButton
                                onClick={() => {
                                  const idx = selectedCell;
                                  if (idx === draft.images.length - 1) return;
                                  moveImage(idx, 1);
                                  setSelectedCell(idx + 1);
                                }}
                                disabled={selectedCell === draft.images.length - 1}
                              >
                                ↓ {t("admin.navDown")}
                              </SecondaryButton>
                              {draft.images[selectedCell].enabled &&
                                selectedCell !== draft.images.findIndex((i) => i.enabled) && (
                                  <SecondaryButton
                                    onClick={() => {
                                      const images = [...draft.images];
                                      const [image] = images.splice(selectedCell, 1);
                                      images.unshift(image);
                                      set("images", images.map((im, i) => ({ ...im, position: i })));
                                      setSelectedCell(0);
                                    }}
                                    className="col-span-2"
                                  >
                                    {t("admin.setAsMain")}
                                  </SecondaryButton>
                                )}
                              <SecondaryButton
                                onClick={() => {
                                  set(
                                    "images",
                                    draft.images.map((im, i) =>
                                      i === selectedCell ? { ...im, enabled: !im.enabled } : im
                                    )
                                  );
                                  setSelectedCell(null);
                                }}
                              >
                                {draft.images[selectedCell].enabled ? t("admin.hide") : t("admin.show")}
                              </SecondaryButton>
                              <DangerButton
                                onClick={() => {
                                  set("images", draft.images.filter((_, i) => i !== selectedCell));
                                  setSelectedCell(null);
                                }}
                              >
                                {t("admin.remove")}
                              </DangerButton>
                            </div>
                            <PrimaryButton onClick={() => setSelectedCell(null)}>
                              {t("admin.done")}
                            </PrimaryButton>
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <p className="font-body text-body-md text-secondary">
                    {t("admin.noVisibleImages")}
                  </p>
                )}
              </div>
            </div>

            {/* Images */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-headline text-headline-md text-primary uppercase">{t("admin.images")}</h4>
                <SecondaryButton onClick={() => setPickImageFor(draft.images.length)}>{t("admin.addImage")}</SecondaryButton>
              </div>
              <p className="font-label text-label-caps text-secondary mb-2">
                {t("admin.imagesHint")}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(() => {
                  const mainIndex = draft.images.findIndex((i) => i.enabled);
                  return draft.images.map((img, index) => (
                    <div
                      key={index}
                      className={`relative border border-surface-container-highest bg-white p-2 ${
                        img.enabled ? "" : "opacity-60"
                      }`}
                    >
                      {index === mainIndex && (
                        <span className="absolute top-1 left-1 z-10 bg-forest-green text-white font-label text-label-caps px-2 py-0.5 uppercase">
                          {t("admin.main")}
                        </span>
                      )}
                      {!img.enabled && (
                        <span className="absolute top-1 right-1 z-10 bg-error text-white font-label text-label-caps px-2 py-0.5 uppercase">
                          {t("admin.hidden")}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            "images",
                            draft.images.map((im, i) => (i === index ? { ...im, enabled: !im.enabled } : im))
                          )
                        }
                        title={img.enabled ? t("admin.hide") : t("admin.show")}
                        className="block w-full relative p-0 border-0 bg-surface-container-low cursor-pointer"
                      >
                        <img src={img.url} alt={img.alt} className="w-full aspect-[3/4] object-cover" />
                        <span
                          className={`absolute bottom-1 right-1 z-10 rounded-full h-6 w-6 flex items-center justify-center text-white ${
                            img.enabled ? "bg-forest-green" : "bg-black/60"
                          }`}
                        >
                          {img.enabled ? "✓" : "✕"}
                        </span>
                      </button>
                      <div className="flex flex-col gap-1 mt-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => moveImage(index, -1)}
                              disabled={index === 0}
                              className={`font-label text-label-caps uppercase ${
                                index === 0
                                  ? "text-outline cursor-not-allowed"
                                  : "text-primary hover:text-forest-green hover:underline"
                              }`}
                            >
                              {t("admin.navUp")}
                            </button>
                            <button
                              onClick={() => moveImage(index, 1)}
                              disabled={index === draft.images.length - 1}
                              className={`font-label text-label-caps uppercase ${
                                index === draft.images.length - 1
                                  ? "text-outline cursor-not-allowed"
                                  : "text-primary hover:text-forest-green hover:underline"
                              }`}
                            >
                              {t("admin.navDown")}
                            </button>
                          </div>
                          {index !== mainIndex && img.enabled && (
                            <button
                              onClick={() => {
                                const images = [...draft.images];
                                const [image] = images.splice(index, 1);
                                images.unshift(image);
                                set("images", images.map((im, i) => ({ ...im, position: i })));
                              }}
                              className="font-label text-label-caps text-forest-green hover:underline uppercase"
                            >
                              {t("admin.setAsMain")}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setCropTarget(index)}
                            className="font-label text-label-caps text-primary hover:underline uppercase"
                          >
                            {t("admin.crop")}
                          </button>
                          <button
                            onClick={() => setPickImageFor(index)}
                            className="font-label text-label-caps text-secondary hover:underline uppercase"
                          >
                            {t("admin.change")}
                          </button>
                          <button
                            onClick={() => set("images", draft.images.filter((_, i) => i !== index))}
                            className="font-label text-label-caps text-error hover:underline uppercase"
                          >
                            {t("admin.remove")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
        </>
      ) : null}

      {studioTab === "variants" ? (
        <StudioModule
          n="04"
          title={t("admin.studio.variantsTitle")}
          subtitle={t("admin.studio.variantsSubtitle")}
          badge={t("admin.studio.moduleActive")}
        >
            <KeyValueList
              title={t("admin.colorways")}
              addLabel={t("admin.addColor")}
              values={draft.colors}
              onChange={(colors) => set("colors", colors)}
              render={(c) => [
                <TextInput key="n" value={c.name || ""} placeholder="OPTIC WHITE" onChange={(e) => (c.name = e.target.value)} />,
                <TextInput key="h" type="color" value={c.hex || "#ffffff"} className="h-[38px] p-1 w-16" onChange={(e) => (c.hex = e.target.value)} />,
              ]}
            />

            {/* Sizes */}
            <Field label={t("admin.sizes")}>
              <TextInput
                value={draft.sizes.join(", ")}
                onChange={(e) => set("sizes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                placeholder="XS, S, M, L, XL, XXL"
              />
            </Field>
        </StudioModule>
      ) : null}

      {studioTab === "story" ? (
        <StudioModule
          n="03"
          title={t("admin.studio.storyTitle")}
          subtitle={t("admin.studio.storySubtitle")}
          badge={t("admin.studio.moduleActive")}
        >
            <PairList
              title={t("admin.techSpecs")}
              addLabel={t("admin.addSpec")}
              values={draft.tech_specs}
              onChange={(v) => set("tech_specs", v)}
              aPlaceholder={t("admin.specLabel")}
              bPlaceholder={t("admin.specValue")}
            />

            <FeatureList values={draft.features} onChange={(v) => set("features", v)} />
        </StudioModule>
      ) : null}
    </div>
  );
}

function KeyValueList<T extends { name?: string; hex?: string }>({
  title,
  addLabel,
  values,
  onChange,
  render,
}: {
  title: string;
  addLabel: string;
  values: T[];
  onChange: (v: T[]) => void;
  render: (item: T) => React.ReactNode[];
}) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-headline text-headline-md text-primary uppercase">{title}</h4>
        <SecondaryButton onClick={() => onChange([...values, {} as T])}>{addLabel}</SecondaryButton>
      </div>
      <div className="flex flex-col gap-2">
        {values.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {render(item).map((node, i) => <div key={i} className="flex-1">{node}</div>)}
            <DangerButton onClick={() => onChange(values.filter((_, i) => i !== index))}>{t("admin.remove")}</DangerButton>
          </div>
        ))}
      </div>
    </div>
  );
}

function PairList<T extends { label?: string; value?: string; label_vi?: string; value_vi?: string }>({
  title,
  addLabel,
  values,
  onChange,
  aPlaceholder,
  bPlaceholder,
}: {
  title: string;
  addLabel: string;
  values: T[];
  onChange: (v: T[]) => void;
  aPlaceholder: string;
  bPlaceholder: string;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-headline text-headline-md text-primary uppercase">{title}</h4>
        <SecondaryButton onClick={() => onChange([...values, {} as T])}>{addLabel}</SecondaryButton>
      </div>
      <div className="flex flex-col gap-2">
        {values.map((item, index) => (
          <div key={index} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <TextInput
                value={item.label || ""}
                placeholder={aPlaceholder}
                onChange={(e) => (item.label = e.target.value)}
              />
              <TextInput
                value={item.value || ""}
                placeholder={bPlaceholder}
                onChange={(e) => (item.value = e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <TextInput
                value={item.label_vi || ""}
                placeholder={`VI · ${aPlaceholder}`}
                onChange={(e) => (item.label_vi = e.target.value)}
              />
              <TextInput
                value={item.value_vi || ""}
                placeholder={`VI · ${bPlaceholder}`}
                onChange={(e) => (item.value_vi = e.target.value)}
              />
              <DangerButton onClick={() => onChange(values.filter((_, i) => i !== index))}>{t("admin.remove")}</DangerButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureList({
  values,
  onChange,
}: {
  values: { icon: string; title: string; description: string; title_vi: string; description_vi: string }[];
  onChange: (v: { icon: string; title: string; description: string; title_vi: string; description_vi: string }[]) => void;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-headline text-headline-md text-primary uppercase">{t("admin.engineeringFeatures")}</h4>
        <SecondaryButton
          onClick={() => onChange([...values, { icon: "", title: "", description: "", title_vi: "", description_vi: "" }])}
        >
          + ADD FEATURE
        </SecondaryButton>
      </div>
      <div className="flex flex-col gap-3">
        {values.map((item, index) => (
          <div key={index} className="border border-surface-container-highest p-3 flex flex-col gap-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <TextInput
                value={item.icon}
                placeholder="Icon name (e.g. balance, straighten, air)"
                onChange={(e) => (item.icon = e.target.value)}
              />
              <TextInput
                value={item.title}
                placeholder="Title (e.g. LATERAL LOCKDOWN)"
                onChange={(e) => (item.title = e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <TextArea
                rows={2}
                value={item.description}
                placeholder="Description"
                className="flex-1"
                onChange={(e) => (item.description = e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <TextInput
                value={item.title_vi}
                placeholder="VI · Title (Tiêu đề tiếng Việt)"
                onChange={(e) => (item.title_vi = e.target.value)}
              />
              <TextArea
                rows={2}
                value={item.description_vi}
                placeholder="VI · Description (Mô tả tiếng Việt)"
                className="flex-1"
                onChange={(e) => (item.description_vi = e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <DangerButton onClick={() => onChange(values.filter((_, i) => i !== index))}>{t("admin.remove")}</DangerButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
