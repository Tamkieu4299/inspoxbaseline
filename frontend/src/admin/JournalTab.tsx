import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { BlogPost, Media, PageBlock } from "../types";
import { BlocksField, blankBlock } from "./BlockEditor";
import { ImageField } from "./MediaLibrary";
import { Checkbox, DangerButton, Field, PrimaryButton, SecondaryButton, TextArea, TextInput, ViArea, ViInput } from "./ui";

type Workflow = "published" | "scheduled" | "drafts";

function postPayload(draft: Partial<BlogPost> & { blocks?: PageBlock[] }): unknown {
  return {
    slug: draft.slug,
    title: draft.title,
    title_vi: draft.title_vi || null,
    excerpt: draft.excerpt || null,
    excerpt_vi: draft.excerpt_vi || null,
    cover_image_id: draft.cover_image_id ?? null,
    hero_text_color: draft.hero_text_color || "#1c1917",
    gradient: draft.gradient ?? true,
    is_active: draft.is_active ?? true,
    published_at: draft.published_at || null,
    content: (draft.blocks || []).map((b: PageBlock) => ({ type: b.block_type, data: b.data })),
  };
}

function toBlocks(content: { type: string; data: Record<string, unknown> }[]): PageBlock[] {
  return (content || []).map((b) => ({ id: 0, block_type: b.type, data: b.data, position: 0 }));
}

function blankPost(): Partial<BlogPost> & { blocks?: PageBlock[] } {
  return {
    slug: "",
    title: "",
    title_vi: "",
    excerpt: "",
    excerpt_vi: "",
    cover_image_id: null,
    is_active: false,
    published_at: new Date().toISOString(),
    blocks: [blankBlock("text")],
  };
}

function workflowOf(post: BlogPost): Workflow {
  if (!post.is_active) return "drafts";
  const pub = post.published_at ? new Date(post.published_at) : null;
  if (pub && pub.getTime() > Date.now()) return "scheduled";
  return "published";
}

function readingMinutes(blocks: PageBlock[] | undefined, excerpt?: string | null): number {
  const text = [
    excerpt || "",
    ...(blocks || []).map((b) => {
      const d = b.data as { body?: string; quote?: string; text?: string };
      return d.body || d.quote || d.text || "";
    }),
  ].join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export default function JournalTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: posts, isLoading } = useQuery({ queryKey: ["admin-posts"], queryFn: adminApi.getBlogPosts });
  const { data: media } = useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });
  const mediaById = useMemo(() => new Map((media || []).map((m) => [m.id, m])), [media]);

  const [workflow, setWorkflow] = useState<Workflow>("published");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Partial<BlogPost> & { blocks?: PageBlock[] } | null>(null);

  const saveMutation = useMutation({
    mutationFn: (d: Partial<BlogPost> & { blocks?: PageBlock[] }) =>
      d.id ? adminApi.updateBlogPost(d.id, postPayload(d)) : adminApi.createBlogPost(postPayload(d)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
      setDraft(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteBlogPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
      setDraft(null);
    },
  });

  const counts = useMemo(() => {
    const c = { published: 0, scheduled: 0, drafts: 0 };
    for (const p of posts || []) c[workflowOf(p)] += 1;
    return c;
  }, [posts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (posts || []).filter((p) => {
      if (workflowOf(p) !== workflow) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    });
  }, [posts, workflow, search]);

  function set<K extends keyof (BlogPost & { blocks?: PageBlock[] })>(
    key: K,
    value: (BlogPost & { blocks?: PageBlock[] })[K]
  ) {
    setDraft((d) => ({ ...(d || blankPost()), [key]: value }));
  }

  function openPost(p: BlogPost) {
    setDraft({ ...p, blocks: toBlocks(p.content) });
  }

  return (
    <div className="flex flex-col w-full -mx-0">
      <section className="px-6 lg:px-8 py-8 bg-white border-b border-surface-container-high">
        <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-label text-label-caps uppercase text-secondary tracking-widest">
                {t("admin.journal.eyebrow")}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="font-label text-label-caps uppercase text-on-surface">{t("admin.journal.division")}</span>
            </div>
            <h1 className="font-headline text-3xl lg:text-4xl uppercase text-primary tracking-tight">
              {t("admin.journal.title")}
            </h1>
            <p className="font-body text-body-md text-secondary mt-2 max-w-2xl">{t("admin.journal.subtitle")}</p>
          </div>
          <PrimaryButton
            className="uppercase font-label text-label-caps px-8 py-4"
            onClick={() => setDraft(blankPost())}
          >
            <span className="material-symbols-outlined text-[18px] align-middle mr-2">add</span>
            {t("admin.journal.newStory")}
          </PrimaryButton>
        </div>
      </section>

      <section className="px-6 lg:px-8 py-4 bg-surface sticky top-14 z-20 border-b border-surface-container shadow-sm">
        <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(
              [
                ["published", t("admin.journal.tabPublished"), counts.published],
                ["scheduled", t("admin.journal.tabScheduled"), counts.scheduled],
                ["drafts", t("admin.journal.tabDrafts"), counts.drafts],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setWorkflow(key)}
                className={`px-4 py-2.5 rounded font-label text-label-caps uppercase whitespace-nowrap transition-all ${
                  workflow === key
                    ? "bg-primary text-on-primary"
                    : "text-secondary hover:text-on-surface hover:bg-surface-container-low"
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded min-w-[260px]">
            <span className="material-symbols-outlined text-[18px] text-secondary">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.journal.searchPlaceholder")}
              className="bg-transparent text-sm w-full focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section className="px-6 lg:px-8 py-8 max-w-[1440px] mx-auto w-full">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <div className="xl:col-span-5 flex flex-col gap-4">
            {isLoading ? (
              <p className="text-secondary">{t("admin.loading")}</p>
            ) : filtered.length === 0 ? (
              <p className="text-secondary p-6 bg-white rounded border border-surface-container-high">
                {t("admin.journal.emptyQueue")}
              </p>
            ) : (
              filtered.map((p) => {
                const cover = p.cover_image_id ? mediaById.get(p.cover_image_id) : null;
                const mins = readingMinutes(toBlocks(p.content), p.excerpt);
                const active = draft?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openPost(p)}
                    className={`text-left w-full bg-white rounded overflow-hidden border transition-shadow flex gap-4 p-4 ${
                      active ? "border-primary shadow-md" : "border-surface-container-high hover:shadow-sm"
                    }`}
                  >
                    <div className="w-24 h-28 shrink-0 bg-surface-container rounded overflow-hidden">
                      {cover ? (
                        <img src={cover.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-secondary">
                          <span className="material-symbols-outlined">image</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-1">
                      <span className="font-label text-[10px] uppercase text-secondary tracking-widest">
                        {t("admin.journal.edition")} · {mins} {t("admin.journal.minRead")}
                      </span>
                      <h3 className="font-headline text-lg text-primary uppercase leading-tight truncate">{p.title}</h3>
                      <p className="text-xs text-secondary truncate">/blogs/{p.slug}</p>
                      <div className="flex items-center gap-2 mt-auto pt-2">
                        <StatusBadge workflow={workflowOf(p)} />
                        {p.published_at ? (
                          <span className="font-label text-[10px] uppercase text-secondary">
                            {new Date(p.published_at).toLocaleDateString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="xl:col-span-7 bg-white rounded border border-surface-container-high p-6 lg:p-8 min-h-[420px]">
            {!draft ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-secondary gap-3 py-16">
                <span className="material-symbols-outlined text-4xl">menu_book</span>
                <p className="max-w-sm">{t("admin.journal.selectStory")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-container pb-4">
                  <h2 className="font-headline text-xl uppercase text-primary">
                    {draft.id ? t("admin.editPost") : t("admin.newPostTitle")}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {draft.id ? (
                      <DangerButton onClick={() => deleteMutation.mutate(draft.id!)}>{t("admin.delete")}</DangerButton>
                    ) : null}
                    <SecondaryButton onClick={() => setDraft(null)}>{t("admin.cancel")}</SecondaryButton>
                    <PrimaryButton onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending}>
                      {t("admin.savePost")}
                    </PrimaryButton>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t("admin.journal.editionSlug")}>
                    <TextInput
                      value={draft.slug || ""}
                      onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    />
                  </Field>
                  <Field label={t("admin.publishDate")}>
                    <TextInput
                      type="datetime-local"
                      value={(draft.published_at || "").slice(0, 16)}
                      onChange={(e) =>
                        set("published_at", e.target.value ? new Date(e.target.value).toISOString() : null)
                      }
                    />
                  </Field>
                  <Field label={t("admin.title")}>
                    <TextInput value={draft.title || ""} onChange={(e) => set("title", e.target.value)} />
                  </Field>
                  <ViInput
                    label={t("admin.title")}
                    value={draft.title_vi || ""}
                    onChange={(e) => set("title_vi", e.target.value)}
                    placeholder="Tiêu đề tiếng Việt"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t("admin.excerpt")}>
                    <TextArea rows={3} value={draft.excerpt || ""} onChange={(e) => set("excerpt", e.target.value)} />
                  </Field>
                  <ViArea
                    label={t("admin.excerpt")}
                    rows={3}
                    value={draft.excerpt_vi || ""}
                    onChange={(e) => set("excerpt_vi", e.target.value)}
                    placeholder="Tóm tắt tiếng Việt"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <ImageField
                    label={t("admin.journal.coverCanvas")}
                    value={draft.cover_image_id ? mediaById.get(draft.cover_image_id) || null : null}
                    onChange={(m) => set("cover_image_id", m ? m.id : null)}
                  />
                  <div className="flex flex-col gap-3 pt-6">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={draft.is_active ?? false} onChange={(e) => set("is_active", e.target.checked)} />
                      {t("admin.postActive")}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={draft.gradient ?? true} onChange={(e) => set("gradient", e.target.checked)} />
                      {t("admin.heroGradient")}
                    </label>
                    <p className="font-label text-label-caps uppercase text-secondary text-xs">
                      {t("admin.journal.readingTime")}: {readingMinutes(draft.blocks, draft.excerpt)}{" "}
                      {t("admin.journal.minRead")}
                    </p>
                  </div>
                </div>

                <BlocksField
                  blocks={draft.blocks || []}
                  onChange={(blocks) => set("blocks", blocks)}
                  mediaById={mediaById}
                />

                {saveMutation.isError ? <p className="text-error text-sm">{String(saveMutation.error)}</p> : null}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ workflow }: { workflow: Workflow }) {
  const { t } = useLanguage();
  const map = {
    published: { cls: "bg-surface-container text-on-surface", label: t("admin.journal.statusPublished") },
    scheduled: { cls: "bg-primary/10 text-primary", label: t("admin.journal.statusScheduled") },
    drafts: { cls: "bg-surface-container-high text-secondary", label: t("admin.journal.statusDraft") },
  }[workflow];
  return (
    <span className={`font-label text-[10px] uppercase px-2 py-0.5 rounded ${map.cls}`}>{map.label}</span>
  );
}
