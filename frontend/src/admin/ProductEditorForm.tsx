import type { UseMutationResult } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../api";
import type { Category, CollectionSummary } from "../types";
import ProductGallery from "../components/ProductGallery";
import {
  Checkbox,
  DangerButton,
  Field,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextArea,
  TextInput,
  ViArea,
  ViInput,
} from "./ui";
import { useLanguage } from "../i18n";
import { formatMoney, priceInputStep, usesWholeCurrencyUnits } from "../money";
import { PRODUCT_BADGES, type ProductDraft } from "./productDraft";

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
}) {
  const { t, lang } = useLanguage();
  const { data: siteSettings } = useQuery({ queryKey: ["admin-site"], queryFn: adminApi.getSite });
  const currency = (siteSettings?.currency_code || "USD").toUpperCase();
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const wholeUnits = usesWholeCurrencyUnits(currency);

  return (
    <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Name *">
                <TextInput value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="CLUB PERFORMANCE POLO" />
              </Field>
              <ViInput label={t("admin.name")} value={draft.name_vi} onChange={(e) => set("name_vi", e.target.value)} placeholder="Tên tiếng Việt" />
              <Field label="Slug *">
                <TextInput value={draft.slug} onChange={(e) => set("slug", e.target.value)} placeholder="club-performance-polo" />
              </Field>
              <Field label={t("admin.priceInCurrency", { currency })}>
                <TextInput
                  type="number"
                  min={0}
                  step={priceInputStep(currency)}
                  value={draft.price}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = raw === "" ? 0 : Number(raw);
                    set("price", wholeUnits ? Math.round(n) : n);
                  }}
                />
                <p className="text-secondary text-xs mt-1 font-body">
                  {t("admin.priceStorefrontPreview", {
                    price: formatMoney(Number(draft.price) || 0, currency, locale),
                  })}
                </p>
                <p className="text-secondary text-xs mt-0.5 font-body">{t("admin.priceCurrencyHint")}</p>
              </Field>
              <Field label="Category">
                <Select
                  value={draft.category_id}
                  onChange={(e) => set("category_id", e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">{t("admin.none")}</option>
                  {(categories || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
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
              <Field label={t("admin.subtitle")}>
                <TextInput value={draft.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
              </Field>
              <ViInput label={t("admin.subtitle")} value={draft.subtitle_vi} onChange={(e) => set("subtitle_vi", e.target.value)} placeholder="Phụ đề tiếng Việt" />
            </div>
            <Field label={t("admin.description")}>
              <TextArea rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <ViArea label={t("admin.description")} rows={3} value={draft.description_vi} onChange={(e) => set("description_vi", e.target.value)} placeholder="Mô tả tiếng Việt" />

            <div className="flex gap-6">
              <label className="flex items-center gap-2 font-body text-body-md text-on-background">
                <Checkbox checked={draft.is_active} onChange={(e) => set("is_active", e.target.checked)} /> {t("admin.active")}
              </label>
              <label className="flex items-center gap-2 font-body text-body-md text-on-background">
                <Checkbox checked={draft.is_featured} onChange={(e) => set("is_featured", e.target.checked)} /> {t("admin.featuredHome")}
              </label>
              <label className="flex items-center gap-2 font-body text-body-md text-on-background">
                <Checkbox checked={draft.is_bestseller} onChange={(e) => set("is_bestseller", e.target.checked)} /> {t("admin.bestseller")}
              </label>
            </div>

            <Field label={t("admin.galleryLayout")}>
              <Select value={draft.gallery_layout} onChange={(e) => set("gallery_layout", e.target.value)}>
                <option value="collage">{t("admin.galleryCollage")}</option>
                <option value="grid">{t("admin.galleryGrid")}</option>
                <option value="masonry">{t("admin.galleryMasonry")}</option>
                <option value="slideshow">{t("admin.gallerySlideshow")}</option>
              </Select>
              <span className="font-label text-label-caps text-secondary">
                {t("admin.galleryCollageHint")}
              </span>
            </Field>

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

            {/* Colors */}
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

            {/* Tech Specs */}
            <PairList
              title={t("admin.techSpecs")}
              addLabel={t("admin.addSpec")}
              values={draft.tech_specs}
              onChange={(v) => set("tech_specs", v)}
              aPlaceholder={t("admin.specLabel")}
              bPlaceholder={t("admin.specValue")}
            />

            {/* Features */}
            <FeatureList values={draft.features} onChange={(v) => set("features", v)} />
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
