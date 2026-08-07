import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { Collection, Media } from "../types";
import { ImageField } from "./MediaLibrary";
import { Checkbox, DangerButton, Field, PrimaryButton, SecondaryButton, Select, TextArea, TextInput, ViArea, ViInput } from "./ui";

interface Draft {
  id?: number;
  slug: string;
  name: string;
  name_vi: string;
  tagline: string;
  tagline_vi: string;
  description: string;
  description_vi: string;
  hero_image_id: number | "";
  badge: string;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
}

function blankDraft(): Draft {
  return {
    slug: "",
    name: "",
    name_vi: "",
    tagline: "",
    tagline_vi: "",
    description: "",
    description_vi: "",
    hero_image_id: "",
    badge: "",
    is_featured: false,
    is_active: true,
    display_order: 0,
  };
}

function toDraft(c: Collection): Draft {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    name_vi: c.name_vi || "",
    tagline: c.tagline || "",
    tagline_vi: c.tagline_vi || "",
    description: c.description || "",
    description_vi: c.description_vi || "",
    hero_image_id: c.hero_image_id ?? "",
    badge: c.badge || "",
    is_featured: c.is_featured,
    is_active: c.is_active,
    display_order: c.display_order,
  };
}

export default function CollectionsTab() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { data: collections, isLoading } = useQuery({ queryKey: ["admin-collections"], queryFn: adminApi.getCollections });
  const { data: media } = useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });

  const [selectedId, setSelectedId] = useState<number | "new">();
  const [draft, setDraft] = useState<Draft | null>(null);

  const saveMutation = useMutation({
    mutationFn: (d: Draft) =>
      d.id ? adminApi.updateCollection(d.id, d) : adminApi.createCollection(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["home"] });
      setDraft(null);
      setSelectedId(undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-collections"] });
      setDraft(null);
      setSelectedId(undefined);
    },
  });

  const mediaById = new Map((media || []).map((m) => [m.id, m]));

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-3 flex flex-col gap-2 max-h-[70vh] overflow-auto pr-2">
        <PrimaryButton onClick={() => { setDraft(blankDraft()); setSelectedId("new"); }}>{t("admin.newCollection")}</PrimaryButton>
        {isLoading ? (
          <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>
        ) : (
          collections?.map((c) => (
            <button
              key={c.id}
              onClick={() => { setDraft(toDraft(c)); setSelectedId(c.id); }}
              className={`text-left border p-2 transition-colors ${
                selectedId === c.id ? "border-forest-green bg-white" : "border-transparent hover:border-surface-container-highest"
              }`}
            >
              <span className="font-headline text-headline-md text-primary uppercase block truncate">{c.name}</span>
              <span className="font-label text-label-caps text-secondary">{c.is_featured ? t("admin.featured") : ""}</span>
            </button>
          ))
        )}
      </div>

      <div className="lg:col-span-9 bg-white border border-surface-container-highest p-6">
        {!draft ? (
          <p className="font-body text-body-md text-secondary">{t("admin.selectCollection")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-headline-md text-primary uppercase">
                {draft.id ? t("admin.editCollection") : t("admin.newCollectionTitle")}
              </h3>
              <div className="flex gap-2">
                {draft.id && <DangerButton onClick={() => deleteMutation.mutate(draft.id!)}>{t("admin.delete")}</DangerButton>}
                <SecondaryButton onClick={() => { setDraft(null); setSelectedId(undefined); }}>{t("admin.cancel")}</SecondaryButton>
                <PrimaryButton onClick={() => saveMutation.mutate(draft)} disabled={!draft.name || !draft.slug}>
                  {t("admin.saveCollection")}
                </PrimaryButton>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label={t("admin.name")}>
                <TextInput value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="THE EDEN COLLECTION" />
              </Field>
              <Field label={t("admin.slug")}>
                <TextInput value={draft.slug} onChange={(e) => set("slug", e.target.value)} placeholder="the-eden-collection" />
              </Field>
              <Field label={t("admin.displayOrder")}>
                <TextInput type="number" value={draft.display_order} onChange={(e) => set("display_order", Number(e.target.value))} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("admin.tagline")}>
                <TextInput value={draft.tagline} onChange={(e) => set("tagline", e.target.value)} />
              </Field>
              <ViInput label={t("admin.tagline")} value={draft.tagline_vi} onChange={(e) => set("tagline_vi", e.target.value)} placeholder="Khẩu hiệu tiếng Việt" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("admin.description")}>
                <TextArea rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <ViArea label={t("admin.description")} rows={2} value={draft.description_vi} onChange={(e) => set("description_vi", e.target.value)} placeholder="Mô tả tiếng Việt" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("admin.badge")}>
                <Select value={draft.badge} onChange={(e) => set("badge", e.target.value)}>
                  <option value="">{t("admin.none")}</option>
                  <option>NEW</option>
                  <option>LIMITED</option>
                  <option>BESTSELLER</option>
                </Select>
              </Field>
              <ImageField
                label={t("admin.heroImage")}
                value={draft.hero_image_id ? (mediaById.get(draft.hero_image_id) as Media) || null : null}
                onChange={(m) => set("hero_image_id", m ? m.id : "")}
              />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 font-body text-body-md text-on-background">
                <Checkbox checked={draft.is_active} onChange={(e) => set("is_active", e.target.checked)} /> {t("admin.active")}
              </label>
              <label className="flex items-center gap-2 font-body text-body-md text-on-background">
                <Checkbox checked={draft.is_featured} onChange={(e) => set("is_featured", e.target.checked)} /> {t("admin.featuredTrending")}
              </label>
            </div>
            {saveMutation.isError && <p className="text-error text-sm">{String(saveMutation.error)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
