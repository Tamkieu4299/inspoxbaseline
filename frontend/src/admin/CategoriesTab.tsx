import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { Category, PageBlock } from "../types";
import { BlocksField } from "./BlockEditor";
import { DangerButton, Field, PrimaryButton, SecondaryButton, TextArea, TextInput, ViArea, ViInput } from "./ui";

type Draft = {
  id?: number;
  slug: string;
  name: string;
  name_vi: string;
  tagline: string;
  tagline_vi: string;
  description: string;
  description_vi: string;
  content_blocks: PageBlock[];
  nav_order: number;
};

function toBlocks(blocks: Category["content_blocks"]): PageBlock[] {
  return (blocks || []).map((b, i) => ({
    id: 0,
    block_type: b.block_type,
    position: b.position ?? i,
    data: (b.data || {}) as Record<string, unknown>,
  }));
}

function toDraft(c: Category): Draft {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    name_vi: c.name_vi || "",
    tagline: c.tagline || "",
    tagline_vi: c.tagline_vi || "",
    description: c.description || "",
    description_vi: c.description_vi || "",
    content_blocks: toBlocks(c.content_blocks),
    nav_order: c.nav_order ?? 0,
  };
}

function blocksToPayload(blocks: PageBlock[]) {
  return blocks.map((b, i) => ({
    block_type: b.block_type,
    position: i,
    data: b.data || {},
  }));
}

export default function CategoriesTab() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: adminApi.getCategories,
  });
  const { data: media } = useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });
  const mediaById = useMemo(() => new Map((media || []).map((m) => [m.id, m])), [media]);

  const [selectedId, setSelectedId] = useState<number | "new">();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [createName, setCreateName] = useState("");
  const [createNameVi, setCreateNameVi] = useState("");
  const [createSlug, setCreateSlug] = useState("");

  const sorted = useMemo(
    () =>
      [...(categories || [])].sort(
        (a, b) =>
          (a.parent_id ?? 0) - (b.parent_id ?? 0) ||
          (a.nav_order ?? 0) - (b.nav_order ?? 0) ||
          a.name.localeCompare(b.name),
      ),
    [categories],
  );

  const createMutation = useMutation({
    mutationFn: adminApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setCreateName("");
      setCreateNameVi("");
      setCreateSlug("");
    },
  });

  const saveMutation = useMutation({
    mutationFn: (d: Draft) =>
      adminApi.updateCategory(d.id!, {
        slug: d.slug,
        name: d.name,
        name_vi: d.name_vi || null,
        tagline: d.tagline || null,
        tagline_vi: d.tagline_vi || null,
        description: d.description || null,
        description_vi: d.description_vi || null,
        content_blocks: blocksToPayload(d.content_blocks),
        nav_order: d.nav_order,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setDraft(null);
      setSelectedId(undefined);
    },
  });

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-3 flex flex-col gap-2 max-h-[70vh] overflow-auto pr-2">
        <div className="bg-white border border-surface-container-highest p-3 mb-2">
          <h4 className="font-label text-label-caps text-secondary uppercase mb-2">{t("admin.categories")}</h4>
          <div className="flex flex-col gap-2">
            <TextInput placeholder={t("admin.categoryName")} value={createName} onChange={(e) => setCreateName(e.target.value)} />
            <ViInput
              label={t("admin.categoryName")}
              placeholder="Tên tiếng Việt"
              value={createNameVi}
              onChange={(e) => setCreateNameVi(e.target.value)}
            />
            <TextInput
              placeholder={t("admin.categorySlug")}
              value={createSlug}
              onChange={(e) => setCreateSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            />
            <PrimaryButton
              onClick={() =>
                createMutation.mutate({ name: createName, name_vi: createNameVi || null, slug: createSlug })
              }
              disabled={!createName || !createSlug}
            >
              {t("admin.add")}
            </PrimaryButton>
          </div>
        </div>
        {isLoading ? (
          <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>
        ) : (
          sorted.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setDraft(toDraft(c));
                setSelectedId(c.id);
              }}
              className={`text-left p-2 border transition-colors ${
                selectedId === c.id ? "border-forest-green bg-white" : "border-transparent hover:border-surface-container-highest"
              }`}
            >
              <span className="font-headline text-headline-md text-primary uppercase block truncate">{c.name}</span>
              <code className="font-brand-label text-label-caps text-secondary">{c.slug}</code>
            </button>
          ))
        )}
      </div>

      <div className="lg:col-span-9 bg-white border border-surface-container-highest p-6">
        {!draft ? (
          <p className="font-body text-body-md text-secondary">{t("admin.selectCategory")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-headline text-headline-md text-primary uppercase">{t("admin.editCategory")}</h3>
              <div className="flex gap-2">
                <DangerButton onClick={() => deleteMutation.mutate(draft.id!)}>{t("admin.delete")}</DangerButton>
                <SecondaryButton onClick={() => { setDraft(null); setSelectedId(undefined); }}>{t("admin.cancel")}</SecondaryButton>
                <PrimaryButton onClick={() => saveMutation.mutate(draft)} disabled={!draft.name || !draft.slug}>
                  {t("admin.save")}
                </PrimaryButton>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("admin.name")}>
                <TextInput value={draft.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <ViInput label={t("admin.name")} value={draft.name_vi} onChange={(e) => set("name_vi", e.target.value)} />
              <Field label={t("admin.slug")}>
                <TextInput value={draft.slug} onChange={(e) => set("slug", e.target.value)} />
              </Field>
              <Field label={t("admin.categoryNavOrder")}>
                <TextInput
                  type="number"
                  value={draft.nav_order}
                  onChange={(e) => set("nav_order", Number(e.target.value) || 0)}
                />
              </Field>
            </div>
            <p className="font-body text-body-sm text-secondary -mt-2">{t("admin.categoryNavOrderHint")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("admin.tagline")}>
                <TextInput value={draft.tagline} onChange={(e) => set("tagline", e.target.value)} />
              </Field>
              <ViInput label={t("admin.tagline")} value={draft.tagline_vi} onChange={(e) => set("tagline_vi", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("admin.description")}>
                <TextArea rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <ViArea label={t("admin.description")} rows={3} value={draft.description_vi} onChange={(e) => set("description_vi", e.target.value)} />
            </div>
            <div className="border-t border-surface-container-high pt-4">
              <p className="font-label text-label-caps text-secondary uppercase mb-2">{t("admin.categoryIntro")}</p>
              <BlocksField
                blocks={draft.content_blocks}
                onChange={(blocks) => set("content_blocks", blocks)}
                mediaById={mediaById}
              />
            </div>
            {saveMutation.isError ? <p className="text-error text-sm">{String(saveMutation.error)}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}