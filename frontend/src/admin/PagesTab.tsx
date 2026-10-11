import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { Media, Page, PageBlock } from "../types";
import { BlocksField, blankBlock } from "./BlockEditor";
import { ImageField } from "./MediaLibrary";
import { PageStudioPreview } from "./PageStudioPreview";
import { StudioModule, StudioToggle, studioInputClass } from "./studioUi";
import { DangerButton, Field, TextArea, TextInput } from "./ui";

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

  const sortedPages = useMemo(
    () => [...(pages || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [pages]
  );

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

  function copyPageUrl() {
    if (!draft?.slug) return;
    const url = `${window.location.origin}/pages/${draft.slug}`;
    void navigator.clipboard?.writeText(url);
  }

  const heroMedia = draft?.hero_image_id ? mediaById.get(draft.hero_image_id) : null;

  return (
    <div className="flex flex-col w-full bg-surface min-h-full -mx-0">
      <section className="w-full bg-surface-container-lowest px-6 lg:px-8 py-6 shadow-sm border-b border-surface-container">
        <div className="max-w-[1440px] mx-auto flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div className="flex flex-col space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-secondary">
              <span className="font-label text-label-caps uppercase tracking-widest text-xs">{t("admin.pagesStudio.breadcrumbSuite")}</span>
              <span className="text-xs">/</span>
              <span className="font-label text-label-caps uppercase tracking-widest text-xs">{t("admin.pagesStudio.breadcrumbContent")}</span>
              <span className="text-xs">/</span>
              <span className="font-label text-label-caps uppercase text-primary font-bold tracking-widest text-xs">
                {t("admin.pagesStudio.breadcrumbPages")}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="font-headline text-headline-lg tracking-tight uppercase text-primary">{t("admin.pagesStudio.title")}</h1>
              <span className="px-2.5 py-0.5 rounded bg-surface-container-high text-primary font-label text-[10px] tracking-wider uppercase font-bold">
                {t("admin.pagesStudio.versionBadge")}
              </span>
            </div>
            <p className="font-body text-body-md text-secondary max-w-3xl">{t("admin.pagesStudio.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <button
              type="button"
              disabled={!draft}
              onClick={() => setDraft(null)}
              className="px-5 py-3 rounded bg-surface-container-low text-primary font-label text-label-caps uppercase tracking-wider hover:bg-surface-container transition-colors flex items-center gap-2 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              {t("admin.pagesStudio.discard")}
            </button>
            {draft?.slug ? (
              <Link
                to={`/pages/${draft.slug}`}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 rounded bg-surface-container-high text-primary font-label text-label-caps uppercase tracking-wider hover:bg-surface-dim transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                {t("admin.pagesStudio.previewStorefront")}
              </Link>
            ) : (
              <span className="px-6 py-3 rounded bg-surface-container-high text-secondary font-label text-label-caps uppercase tracking-wider opacity-50 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                {t("admin.pagesStudio.previewStorefront")}
              </span>
            )}
            <button
              type="button"
              disabled={!draft || !draft.slug || !draft.title || saveMutation.isPending}
              onClick={() => draft && saveMutation.mutate(draft)}
              className="px-7 py-3 rounded bg-forest-green text-on-primary font-label text-label-caps uppercase tracking-wider shadow-md hover:bg-[#00331d] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
              {t("admin.pagesStudio.publishLive")}
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto w-full px-6 lg:px-8 py-8 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between pb-4 gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">folder_special</span>
                <h2 className="font-headline text-headline-md uppercase tracking-tight text-primary">{t("admin.pagesStudio.repository")}</h2>
              </div>
              <button
                type="button"
                onClick={() => setDraft(blankPage())}
                className="px-4 py-2 rounded bg-forest-green text-on-primary font-label text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:bg-[#00331d] transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                {t("admin.newPage")}
              </button>
            </div>
            {isLoading ? (
              <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>
            ) : sortedPages.length === 0 ? (
              <p className="text-secondary">{t("admin.selectPage")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
                {sortedPages.map((p, idx) => {
                  const selected = draft?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDraft({ ...p })}
                      className={`p-3.5 rounded-lg cursor-pointer relative transition-all text-left ${
                        selected
                          ? "bg-surface-container-low shadow-sm ring-1 ring-primary/30"
                          : "bg-surface-container-lowest hover:bg-surface-container-low"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`font-label text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${
                            p.is_active
                              ? "text-[#004225] font-bold bg-emerald-100"
                              : "text-secondary bg-surface-container-high"
                          }`}
                        >
                          {p.is_active ? t("admin.active") : t("admin.pageOff")}
                        </span>
                        <span className="font-label text-[10px] text-secondary font-mono">
                          POS: {String(p.position ?? idx + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <p className="font-headline text-[15px] uppercase text-primary leading-tight font-bold line-clamp-2">{p.title}</p>
                      {p.title_vi ? (
                        <p className="font-body text-[12px] text-secondary truncate mt-0.5">{p.title_vi}</p>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-body text-[11px] text-secondary font-mono truncate">/pages/{p.slug}</span>
                        {selected ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#004225] shrink-0" />
                        ) : (
                          <span className="material-symbols-outlined text-[14px] text-secondary shrink-0">arrow_forward</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!draft ? (
            <div className="bg-surface-container-lowest p-10 rounded-xl border border-dashed border-surface-container text-center text-secondary">
              <span className="material-symbols-outlined text-4xl mb-3 block">web</span>
              <p className="max-w-md mx-auto font-body text-body-md">{t("admin.selectPage")}</p>
            </div>
          ) : (
            <>
              <StudioModule
                n="01"
                title={t("admin.pagesStudio.attributesTitle")}
                subtitle={t("admin.pagesStudio.attributesSubtitle")}
                badge={t("admin.studio.moduleActive")}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-3">
                    <span className="font-label text-label-caps uppercase text-primary font-bold block mb-1">{t("admin.slugUrl")}</span>
                    <span className="font-body text-[12px] text-secondary">{t("admin.pagesStudio.slugHint")}</span>
                  </div>
                  <div className="md:col-span-9 flex items-center gap-2">
                    <div className="flex-1 flex items-center bg-surface-container-low px-4 py-3 rounded min-w-0">
                      <span className="font-body text-secondary select-none text-[13px] mr-1 shrink-0">/pages/</span>
                      <input
                        className={`${studioInputClass} !p-0 !bg-transparent flex-1 min-w-0 font-bold`}
                        value={draft.slug || ""}
                        onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={copyPageUrl}
                      disabled={!draft.slug}
                      className="p-3 rounded bg-surface-container text-primary hover:bg-surface-container-high transition-colors disabled:opacity-40"
                      title={t("admin.pagesStudio.copyUrl")}
                    >
                      <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="bg-surface-container-low p-4 rounded-lg flex flex-col gap-2">
                    <label className="font-label text-label-caps uppercase text-primary font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      {t("admin.pagesStudio.titleEn")}
                    </label>
                    <input
                      className={`${studioInputClass} font-headline text-lg uppercase tracking-tight`}
                      value={draft.title || ""}
                      onChange={(e) => set("title", e.target.value)}
                    />
                    <div className="flex items-center justify-between pt-1 gap-2">
                      <span className="font-body text-[11px] text-secondary">{t("admin.navLabel")}</span>
                      <input
                        className="w-32 text-right bg-surface-container-lowest px-2 py-1 rounded font-label text-[11px] uppercase tracking-wider text-primary focus:outline-none shadow-sm"
                        value={draft.nav_label || ""}
                        placeholder="ABOUT"
                        onChange={(e) => set("nav_label", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-lg flex flex-col gap-2">
                    <label className="font-label text-label-caps uppercase text-primary font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-600" />
                      {t("admin.pagesStudio.titleVi")}
                    </label>
                    <input
                      className={`${studioInputClass} font-headline text-lg uppercase tracking-tight`}
                      value={draft.title_vi || ""}
                      onChange={(e) => set("title_vi", e.target.value)}
                    />
                    <div className="flex items-center justify-between pt-1 gap-2">
                      <span className="font-body text-[11px] text-secondary">{t("admin.navLabel")} (VI)</span>
                      <input
                        className="w-32 text-right bg-surface-container-lowest px-2 py-1 rounded font-label text-[11px] uppercase tracking-wider text-primary focus:outline-none shadow-sm"
                        value={draft.nav_label_vi || ""}
                        onChange={(e) => set("nav_label_vi", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label={t("admin.subtitle")}>
                    <TextArea rows={2} value={draft.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} />
                  </Field>
                  <Field label={`VI · ${t("admin.subtitle")}`}>
                    <TextArea rows={2} value={draft.subtitle_vi || ""} onChange={(e) => set("subtitle_vi", e.target.value)} />
                  </Field>
                </div>

                <div className="p-4 rounded-lg bg-surface-container-low grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <StudioToggle label={t("admin.pageOn")} checked={draft.is_active ?? true} onChange={(v) => set("is_active", v)} />
                  <StudioToggle label={t("admin.showInNav")} checked={draft.show_in_nav ?? true} onChange={(v) => set("show_in_nav", v)} />
                  <div className="flex flex-col gap-1 px-2">
                    <span className="font-label text-[11px] uppercase text-primary font-bold">{t("admin.positionNav")}</span>
                    <input
                      type="number"
                      className="w-full max-w-[4rem] text-center bg-surface-container-lowest py-1 rounded font-bold font-mono text-[13px] text-primary focus:outline-none shadow-sm"
                      value={draft.position ?? 0}
                      onChange={(e) => set("position", Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center justify-between px-2 gap-2">
                    <div>
                      <span className="font-label text-[11px] uppercase text-primary font-bold block">{t("admin.heroTextColor")}</span>
                      <span className="font-body text-[10px] text-secondary font-mono">{draft.hero_text_color || "#1c1917"}</span>
                    </div>
                    <input
                      type="color"
                      value={draft.hero_text_color || "#1c1917"}
                      onChange={(e) => set("hero_text_color", e.target.value)}
                      className="w-8 h-8 rounded-full cursor-pointer border-0 p-0 shadow-sm ring-2 ring-surface-container-lowest"
                    />
                  </div>
                </div>

                <StudioToggle label={t("admin.heroGradient")} checked={draft.gradient ?? true} onChange={(v) => set("gradient", v)} />

                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-label text-label-caps uppercase text-primary font-bold">{t("admin.pagesStudio.heroCover")}</span>
                    {heroMedia ? (
                      <span className="font-label text-[11px] text-secondary uppercase tracking-widest font-mono">ID: {heroMedia.id}</span>
                    ) : null}
                  </div>
                  {heroMedia?.url ? (
                    <div className="relative w-full h-56 rounded-lg overflow-hidden group shadow-sm bg-surface-container">
                      <img src={heroMedia.url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent flex flex-col justify-between p-6">
                        <span className="self-start px-2.5 py-1 rounded bg-surface-container-lowest text-primary font-label text-[10px] font-bold tracking-widest uppercase shadow">
                          {t("admin.pagesStudio.activeHero")}
                        </span>
                        <div className="flex items-end justify-between gap-3 flex-wrap">
                          <h4 className="font-headline text-headline-md text-on-primary uppercase tracking-tight line-clamp-2">
                            {draft.title || t("admin.newPageTitle")}
                          </h4>
                          <button
                            type="button"
                            onClick={() => set("hero_image_id", null)}
                            className="p-1.5 rounded bg-primary/60 backdrop-blur-sm text-on-primary hover:bg-error transition-all"
                            aria-label={t("admin.remove")}
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <ImageField
                    label={heroMedia ? t("admin.change") : t("admin.heroImage")}
                    value={heroMedia || null}
                    onChange={(m) => set("hero_image_id", m ? m.id : null)}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-surface-container">
                  {draft.id ? (
                    <DangerButton onClick={() => deleteMutation.mutate(draft.id!)}>{t("admin.delete")}</DangerButton>
                  ) : null}
                </div>
              </StudioModule>

              <StudioModule
                n="02"
                title={t("admin.pagesStudio.blocksTitle")}
                subtitle={t("admin.pagesStudio.blocksSubtitle")}
                badge={t("admin.pagesStudio.blockCount", { count: draft.blocks?.length ?? 0 })}
              >
                <BlocksField
                  blocks={draft.blocks || []}
                  onChange={(blocks) => set("blocks", blocks as PageBlock[])}
                  mediaById={mediaById}
                  variant="studio"
                />
              </StudioModule>

              {saveMutation.isError && <p className="text-error text-sm">{String(saveMutation.error)}</p>}
            </>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4">
          {draft ? (
            <PageStudioPreview draft={draft} mediaById={mediaById} />
          ) : (
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm text-center text-secondary sticky top-4">
              <span className="material-symbols-outlined text-4xl mb-2 block">preview</span>
              <p className="font-body text-sm">{t("admin.pagesStudio.previewIdle")}</p>
            </div>
          )}
        </div>
      </section>
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
