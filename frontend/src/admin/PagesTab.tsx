import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { Media, Page, PageBlock } from "../types";
import { BlocksField, blankBlock } from "./BlockEditor";
import { ImageField } from "./MediaLibrary";
import { Checkbox, DangerButton, Field, PrimaryButton, SecondaryButton, TextArea, TextInput, ViArea, ViInput } from "./ui";

function pagePayload(draft: Partial<Page>): unknown {
  return {
    slug: draft.slug,
    title: draft.title,
    title_vi: draft.title_vi || null,
    subtitle: draft.subtitle || null,
    subtitle_vi: draft.subtitle_vi || null,
    hero_image_id: draft.hero_image_id ?? null,
    hero_text_color: draft.hero_text_color || "#1c1917",
    gradient: draft.gradient ?? true,
    is_active: draft.is_active ?? true,
    show_in_nav: draft.show_in_nav ?? true,
    nav_label: draft.nav_label || null,
    nav_label_vi: draft.nav_label_vi || null,
    position: draft.position ?? 0,
    blocks: (draft.blocks || []).map((b, i) => ({
      block_type: b.block_type,
      data: b.data,
      position: i,
    })),
  };
}

export default function PagesTab() {
  const { data: media } = useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });
  const mediaById = new Map((media || []).map((m) => [m.id, m]));
  return <PagesEditor mediaById={mediaById} />;
}

function PagesEditor({ mediaById }: { mediaById: Map<number, Media> }) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { data: pages, isLoading } = useQuery({ queryKey: ["admin-pages"], queryFn: adminApi.getPages });
  const [draft, setDraft] = useState<Partial<Page> | null>(null);

  const saveMutation = useMutation({
    mutationFn: (d: Partial<Page>) =>
      d.id ? adminApi.updatePage(d.id, pagePayload(d)) : adminApi.createPage(pagePayload(d)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      queryClient.invalidateQueries({ queryKey: ["nav-pages"] });
      setDraft(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: adminApi.deletePage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      queryClient.invalidateQueries({ queryKey: ["nav-pages"] });
      setDraft(null);
    },
  });

  function set<K extends keyof Page>(key: K, value: Page[K]) {
    setDraft((d) => ({ ...(d || blankPage()), [key]: value }));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 flex flex-col gap-2 max-h-[70vh] overflow-auto pr-2">
        <PrimaryButton onClick={() => setDraft(blankPage())}>{t("admin.newPage")}</PrimaryButton>
        {isLoading ? (
          <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>
        ) : (
          (pages || []).map((p) => (
            <button
              key={p.id}
              onClick={() => setDraft({ ...p })}
              className={`text-left border p-2 transition-colors ${
                draft?.id === p.id
                  ? "border-forest-green bg-white"
                  : "border-transparent hover:border-surface-container-highest"
              }`}
            >
              <span className="font-headline text-headline-md text-primary uppercase block">
                {p.title}
              </span>
              <span className="font-label text-label-caps text-secondary">
                /pages/{p.slug} · {p.is_active ? t("admin.active") : t("admin.pageOff")}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="lg:col-span-8 bg-white border border-surface-container-highest p-6">
        {!draft ? (
          <p className="font-body text-body-md text-secondary">
            {t("admin.selectPage")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-headline-md text-primary uppercase">
                {draft.id ? t("admin.editPage") : t("admin.newPageTitle")}
              </h3>
              <div className="flex gap-2">
                {draft.id && <DangerButton onClick={() => deleteMutation.mutate(draft.id!)}>{t("admin.delete")}</DangerButton>}
                <SecondaryButton onClick={() => setDraft(null)}>{t("admin.cancel")}</SecondaryButton>
                <PrimaryButton onClick={() => saveMutation.mutate(draft)}>{t("admin.savePage")}</PrimaryButton>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label={t("admin.slugUrl")}>
                <TextInput
                  value={draft.slug || ""}
                  onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                />
              </Field>
              <Field label={t("admin.title")}>
                <TextInput value={draft.title || ""} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label={t("admin.navLabel")}>
                <TextInput
                  value={draft.nav_label || ""}
                  placeholder="e.g. ABOUT"
                  onChange={(e) => set("nav_label", e.target.value)}
                />
              </Field>
              <Field label={t("admin.positionNav")}>
                <TextInput
                  type="number"
                  value={draft.position ?? 0}
                  onChange={(e) => set("position", Number(e.target.value))}
                />
              </Field>
              <ViInput label={t("admin.title")} value={draft.title_vi || ""} onChange={(e) => set("title_vi", e.target.value)} placeholder="Tiêu đề tiếng Việt" />
              <ViInput label={t("admin.navLabel")} value={draft.nav_label_vi || ""} onChange={(e) => set("nav_label_vi", e.target.value)} placeholder="Nhãn menu tiếng Việt" />
              <div className="flex items-end gap-4 font-body text-body-md text-on-background pb-2">
                <label className="flex items-center gap-2">
                  <Checkbox checked={draft.is_active ?? true} onChange={(e) => set("is_active", e.target.checked)} />
                  {t("admin.pageOn")}
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={draft.show_in_nav ?? true} onChange={(e) => set("show_in_nav", e.target.checked)} />
                  {t("admin.showInNav")}
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={draft.gradient ?? true} onChange={(e) => set("gradient", e.target.checked)} />
                  {t("admin.heroGradient")}
                </label>
              </div>
              <Field label={t("admin.heroTextColor")}>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={draft.hero_text_color || "#1c1917"}
                    onChange={(e) => set("hero_text_color", e.target.value)}
                    className="h-10 w-14 cursor-pointer border border-surface-container-highest bg-white p-1"
                  />
                  <TextInput
                    value={draft.hero_text_color || ""}
                    onChange={(e) => set("hero_text_color", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </Field>
              <Field label={t("admin.subtitle")}>
                <TextArea rows={2} value={draft.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} />
              </Field>
              <ViArea label={t("admin.subtitle")} rows={2} value={draft.subtitle_vi || ""} onChange={(e) => set("subtitle_vi", e.target.value)} placeholder="Phụ đề tiếng Việt" />
              <ImageField
                label={t("admin.heroImage")}
                value={draft.hero_image_id ? mediaById.get(draft.hero_image_id) || null : null}
                onChange={(m) => set("hero_image_id", m ? m.id : null)}
              />
            </div>

            <BlocksField
              blocks={draft.blocks || []}
              onChange={(blocks) => set("blocks", blocks)}
              mediaById={mediaById}
            />

            {saveMutation.isError && <p className="text-error text-sm">{String(saveMutation.error)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function blankPage(): Partial<Page> {
  return {
    slug: "",
    title: "",
    title_vi: "",
    subtitle: "",
    subtitle_vi: "",
    hero_image_id: null,
    is_active: true,
    show_in_nav: true,
    nav_label: "",
    nav_label_vi: "",
    position: 10,
    blocks: [blankBlock("heading")],
  };
}

