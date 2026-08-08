import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import type { Media, Product } from "../types";
import ImageCropModal from "./ImageCropModal";
import ProductGallery from "../components/ProductGallery";
import { MediaPicker } from "./MediaLibrary";
import { Checkbox, DangerButton, Field, PrimaryButton, SecondaryButton, Select, TextArea, TextInput, ViArea, ViInput } from "./ui";
import { useLanguage } from "../i18n";

interface Draft {
  id?: number;
  slug: string;
  name: string;
  name_vi: string;
  subtitle: string;
  subtitle_vi: string;
  description: string;
  description_vi: string;
  price: number;
  category_id: number | "";
  collection_id: number | "";
  badge: string;
  gallery_layout: string;
  colors: { name: string; hex: string }[];
  sizes: string[];
  tech_specs: { label: string; value: string; label_vi: string; value_vi: string }[];
  features: { icon: string; title: string; description: string; title_vi: string; description_vi: string }[];
  is_active: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  images: { media_id?: number; url: string; alt: string; position: number; enabled: boolean }[];
}

function blankDraft(): Draft {
  return {
    slug: "",
    name: "",
    name_vi: "",
    subtitle: "",
    subtitle_vi: "",
    description: "",
    description_vi: "",
    price: 0,
    category_id: "",
    collection_id: "",
    badge: "",
    gallery_layout: "collage",
    colors: [{ name: "OPTIC WHITE", hex: "#ffffff" }],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    tech_specs: [],
    features: [],
    is_active: true,
    is_featured: false,
    is_bestseller: false,
    images: [],
  };
}

function toDraft(p: Product): Draft {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    name_vi: p.name_vi || "",
    subtitle: p.subtitle || "",
    subtitle_vi: p.subtitle_vi || "",
    description: p.description || "",
    description_vi: p.description_vi || "",
    price: p.price,
    category_id: p.category_id ?? "",
    collection_id: p.collection_id ?? "",
    badge: p.badge || "",
    gallery_layout: p.gallery_layout || "collage",
    colors: (p.colors || []).map((c) =>
      typeof c === "string" ? { name: c, hex: "#ffffff" } : { name: c.name || "", hex: c.hex || "#ffffff" }
    ),
    sizes: p.sizes || [],
    tech_specs: (p.tech_specs || []).map((s) => ({
      label: s.label || "",
      value: s.value || "",
      label_vi: s.label_vi || "",
      value_vi: s.value_vi || "",
    })),
    features: (p.features || []).map((f) => ({
      icon: f.icon || "",
      title: f.title || "",
      description: f.description || "",
      title_vi: f.title_vi || "",
      description_vi: f.description_vi || "",
    })),
    is_active: p.is_active,
    is_featured: p.is_featured,
    is_bestseller: p.is_bestseller,
    images: (p.images || []).map((i) => ({
      media_id: i.media_id || undefined,
      url: i.url,
      alt: i.alt || "",
      position: i.position,
      enabled: i.enabled !== false,
    })),
  };
}

const BADGES = ["", "NEW", "LIMITED", "BESTSELLER", "NEW ARRIVAL"];

export default function ProductsTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: products, isLoading } = useQuery({ queryKey: ["admin-products"], queryFn: adminApi.getProducts });
  const { data: categories } = useQuery({ queryKey: ["admin-categories"], queryFn: adminApi.getCategories });
  const { data: collections } = useQuery({ queryKey: ["admin-collections"], queryFn: adminApi.getCollections });
  const { data: media } = useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });

  const [selectedId, setSelectedId] = useState<number | "new">();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pickImageFor, setPickImageFor] = useState<number | null>(null);
  const [cropTarget, setCropTarget] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File | Blob) => adminApi.uploadMedia(file),
  });

  const saveMutation = useMutation({
    mutationFn: (d: Draft) =>
      d.id
        ? adminApi.updateProduct(d.id, d)
        : adminApi.createProduct(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setDraft(null);
      setSelectedId(undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setDraft(null);
      setSelectedId(undefined);
    },
  });

  function open(draft: Draft, id: number | "new") {
    setDraft(draft);
    setSelectedId(id);
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function moveImage(index: number, dir: -1 | 1) {
    setDraft((d) => {
      if (!d) return d;
      const images = [...d.images];
      const target = index + dir;
      if (target < 0 || target >= images.length) return d;
      [images[index], images[target]] = [images[target], images[index]];
      return { ...d, images: images.map((im, i) => ({ ...im, position: i })) };
    });
  }

  const mediaById = new Map((media || []).map((m) => [m.id, m]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* List */}
      <div className="lg:col-span-3 flex flex-col gap-2 max-h-[70vh] overflow-auto pr-2">
        <PrimaryButton onClick={() => open(blankDraft(), "new")}>{t("admin.newProduct")}</PrimaryButton>
        {isLoading ? (
          <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>
        ) : (
          products?.map((p) => (
            <button
              key={p.id}
              onClick={() => open(toDraft(p), p.id)}
              className={`text-left border p-2 transition-colors ${
                selectedId === p.id ? "border-forest-green bg-white" : "border-transparent hover:border-surface-container-highest"
              }`}
            >
              <span className="font-headline text-headline-md text-primary uppercase block truncate">{p.name}</span>
              <span className="font-label text-label-caps text-secondary">${Math.round(p.price)}</span>
            </button>
          ))
        )}
      </div>

      {/* Editor */}
      <div className="lg:col-span-9 bg-white border border-surface-container-highest p-6">
        {!draft ? (
          <p className="font-body text-body-md text-secondary">
            {t("admin.selectProduct")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-headline-md text-primary uppercase">
                {draft.id ? t("admin.editProduct") : t("admin.newProductTitle")}
              </h3>
              <div className="flex gap-2">
                {draft.id && <DangerButton onClick={() => deleteMutation.mutate(draft.id!)}>{t("admin.delete")}</DangerButton>}
                <SecondaryButton onClick={() => { setDraft(null); setSelectedId(undefined); }}>{t("admin.cancel")}</SecondaryButton>
                <PrimaryButton onClick={() => saveMutation.mutate(draft)} disabled={!draft.name || !draft.slug}>
                  {t("admin.saveProduct")}
                </PrimaryButton>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Name *">
                <TextInput value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="CLUB PERFORMANCE POLO" />
              </Field>
              <ViInput label={t("admin.name")} value={draft.name_vi} onChange={(e) => set("name_vi", e.target.value)} placeholder="Tên tiếng Việt" />
              <Field label="Slug *">
                <TextInput value={draft.slug} onChange={(e) => set("slug", e.target.value)} placeholder="club-performance-polo" />
              </Field>
              <Field label="Price (USD)">
                <TextInput type="number" value={draft.price} onChange={(e) => set("price", Number(e.target.value))} />
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
                  {BADGES.map((b) => (
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
              <div className="border border-surface-container-highest bg-white p-4">
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
                          <div className="fixed top-20 right-4 z-50 w-80 border border-forest-green bg-white shadow-2xl p-4 flex flex-col gap-3">
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
        )}
      </div>

      {pickImageFor !== null && (
        <MediaPicker
          onSelect={(m: Media) => {
            const index = pickImageFor;
            const images = [...draft!.images];
            if (index < images.length) {
              images[index] = {
                media_id: m.id,
                url: m.url,
                alt: images[index].alt,
                position: index,
                enabled: images[index].enabled,
              };
            } else {
              images.push({ media_id: m.id, url: m.url, alt: "", position: index, enabled: true });
            }
            set("images", images);
          }}
          onClose={() => setPickImageFor(null)}
        />
      )}
      {cropTarget !== null && draft && (
        <ImageCropModal
          src={draft.images[cropTarget]?.url || ""}
          title="CROP PRODUCT IMAGE"
          onClose={() => setCropTarget(null)}
          onComplete={async (blob) => {
            try {
              const media = await uploadMutation.mutateAsync(blob);
              const images = [...draft.images];
              images[cropTarget] = {
                media_id: media.id,
                url: media.url,
                alt: images[cropTarget]?.alt || "",
                position: cropTarget,
                enabled: images[cropTarget]?.enabled ?? true,
              };
              set("images", images);
              queryClient.invalidateQueries({ queryKey: ["admin-media"] });
              setCropTarget(null);
            } catch {
              alert(t("admin.cropUploadFailed"));
            }
          }}
        />
      )}
      {saveMutation.isError && <p className="text-error text-sm">{String(saveMutation.error)}</p>}
      {saveMutation.isSuccess && <p className="text-forest-green text-sm">{t("admin.productSaved")}</p>}
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
