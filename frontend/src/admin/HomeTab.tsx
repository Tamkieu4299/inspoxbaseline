import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { HomeContentAdmin, Media, Product } from "../types";
import { ImageField, MediaPicker } from "./MediaLibrary";
import { ColorField, PrimaryButton, SecondaryButton } from "./ui";

const studioInputClass =
  "px-3.5 py-2.5 rounded bg-white border border-surface-container-high text-on-surface font-body text-body-md focus:outline-none focus:ring-1 focus:ring-primary shadow-sm w-full";

function countViFields(d: HomeContentAdmin): { en: number; vi: number; total: number } {
  const enKeys: (keyof HomeContentAdmin)[] = [
    "hero_kicker",
    "hero_title",
    "hero_subtitle",
    "hero_primary_cta",
    "hero_secondary_cta",
    "trending_title",
    "trending_view_all_label",
    "latest_drops_title",
    "master_title",
    "master_description",
  ];
  const viKeys: (keyof HomeContentAdmin)[] = [
    "hero_kicker_vi",
    "hero_title_vi",
    "hero_subtitle_vi",
    "hero_primary_cta_vi",
    "hero_secondary_cta_vi",
    "trending_title_vi",
    "trending_view_all_label_vi",
    "latest_drops_title_vi",
    "master_title_vi",
    "master_description_vi",
  ];
  const en = enKeys.filter((k) => String(d[k] ?? "").trim()).length;
  const vi = viKeys.filter((k) => String(d[k] ?? "").trim()).length;
  return { en, vi, total: enKeys.length };
}

function ModuleBadge({ n }: { n: string }) {
  return (
    <span className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-label text-label-caps text-xs shrink-0">
      {n}
    </span>
  );
}

export default function HomeTab() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { data: home, isLoading } = useQuery({ queryKey: ["admin-home"], queryFn: adminApi.getHome });
  const { data: media } = useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });
  const { data: products } = useQuery({ queryKey: ["admin-products"], queryFn: adminApi.getProducts });

  const [draft, setDraft] = useState<HomeContentAdmin | null>(null);
  const [dirty, setDirty] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [heroPickOpen, setHeroPickOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const ingestRef = useRef<HTMLInputElement>(null);

  const saveMutation = useMutation({
    mutationFn: adminApi.updateHome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-home"] });
      queryClient.invalidateQueries({ queryKey: ["home"] });
      setDirty(false);
      setLastSavedAt(new Date());
    },
  });

  const mediaById = useMemo(() => new Map((media || []).map((m) => [m.id, m])), [media]);

  const featuredPreview = useMemo(() => {
    return (products || []).filter((p) => p.is_featured && p.is_active).slice(0, 4);
  }, [products]);

  if (isLoading || !home) {
    return <p className="font-body text-body-md text-secondary px-8 py-12">{t("admin.loading")}</p>;
  }

  const d = draft || home;

  function set<K extends keyof HomeContentAdmin>(key: K, value: HomeContentAdmin[K]) {
    setDraft((prev) => ({ ...(prev ?? home!), [key]: value }));
    setDirty(true);
  }

  function setColor(key: string, value: string | undefined) {
    const next = { ...(d.hero_colors || {}) };
    if (value) next[key] = value;
    else delete next[key];
    set("hero_colors", next);
  }

  function discard() {
    setDraft(null);
    setDirty(false);
  }

  function setHeroCarouselIds(ids: number[]) {
    set("hero_image_ids", ids);
    set("hero_carousel", ids.length > 0);
  }

  const loc = countViFields(d);
  const carouselSlideUrls = (d.hero_image_ids || [])
    .map((id) => mediaById.get(id)?.url)
    .filter((u): u is string => Boolean(u));
  const heroBg =
    carouselSlideUrls[0] ||
    (d.hero_image_id && mediaById.get(d.hero_image_id)?.url) ||
    undefined;
  const colors = d.hero_colors || {};
  const slideCount = Math.max(1, (d.hero_image_ids || []).length || (d.hero_image_id ? 1 : 0));

  return (
    <div className="flex flex-col w-full bg-surface">
      {/* Studio header */}
      <div className="px-6 lg:px-8 py-6 bg-white shadow-sm flex flex-col gap-6 border-b border-surface-container-high">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap text-xs font-label text-label-caps uppercase text-secondary">
              <span>{t("admin.hub.suite")}</span>
              <span>/</span>
              <span>{t("admin.homeStudio.crumb")}</span>
              <span>/</span>
              <span className="text-primary font-bold">{t("admin.homeStudio.version")}</span>
            </div>
            <h1 className="font-headline text-3xl lg:text-4xl uppercase text-primary tracking-tight mt-1">
              {t("admin.homeStudio.title")}
            </h1>
            <p className="font-body text-body-md text-secondary max-w-4xl mt-1">{t("admin.homeStudio.subtitle")}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low text-secondary">
              <span className={`w-2 h-2 rounded-full ${dirty ? "bg-amber-500" : "bg-primary animate-pulse"}`} />
              <span className="font-label text-label-caps uppercase tracking-wider text-xs">
                {dirty
                  ? t("admin.homeStudio.unsaved")
                  : lastSavedAt
                    ? t("admin.homeStudio.savedAt") + " " + lastSavedAt.toLocaleTimeString()
                    : t("admin.homeStudio.synced")}
              </span>
            </div>
            <SecondaryButton type="button" className="flex items-center gap-2 uppercase text-xs" onClick={() => window.open("/", "_blank")}>
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              {t("admin.homeStudio.preview")}
            </SecondaryButton>
            <button
              type="button"
              onClick={discard}
              disabled={!dirty}
              className="px-4 py-2.5 rounded font-label text-label-caps uppercase text-secondary hover:bg-error-container hover:text-error disabled:opacity-40"
            >
              {t("admin.homeStudio.discard")}
            </button>
            <PrimaryButton
              type="button"
              className="flex items-center gap-2 px-7 py-2.5 uppercase tracking-widest"
              onClick={() => saveMutation.mutate(d)}
              disabled={!dirty || saveMutation.isPending}
            >
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              {t("admin.homeStudio.publish")}
            </PrimaryButton>
          </div>
        </div>
        <div className="flex items-center gap-8 overflow-x-auto border-b border-transparent -mb-px">
          <span className="pb-3 text-primary font-label text-label-caps uppercase tracking-widest relative">
            {t("admin.homeStudio.navHome")}
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          </span>
          <span className="pb-3 text-secondary font-label text-label-caps uppercase tracking-widest">{t("admin.homeStudio.navMedia")}</span>
          <span className="pb-3 text-secondary font-label text-label-caps uppercase tracking-widest">{t("admin.homeStudio.navJournal")}</span>
          <span className="pb-3 text-secondary font-label text-label-caps uppercase tracking-widest">{t("admin.homeStudio.navCollections")}</span>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-8 max-w-[1600px] mx-auto w-full grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_min(420px,38%)] gap-8 xl:gap-10 items-start">
        {/* Left editor */}
        <div className="flex flex-col gap-10 min-w-0 relative z-[2]">
          {/* M1 Hero */}
          <section className="bg-white p-6 lg:p-8 rounded-xl shadow-sm flex flex-col gap-8 min-w-0">
            <div className="flex items-center justify-between pb-2 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <ModuleBadge n="M1" />
                <div>
                  <h2 className="font-headline text-xl uppercase tracking-tight text-primary">{t("admin.heroBanner")}</h2>
                  <p className="font-label text-label-caps uppercase text-secondary text-xs tracking-wider">{t("admin.homeStudio.m1Sub")}</p>
                </div>
              </div>
              <span className="font-label text-label-caps uppercase px-3 py-1 bg-surface-container-low rounded-full text-xs">
                {t("admin.homeStudio.activeCampaign")}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-lg bg-surface-container-low">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="font-label text-label-caps uppercase text-primary font-bold text-xs">{t("admin.homeStudio.enMaster")}</span>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.kicker")}</span>
                  <input className={studioInputClass} value={d.hero_kicker} onChange={(e) => set("hero_kicker", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.title")}</span>
                  <input className={`${studioInputClass} font-headline text-lg`} value={d.hero_title} onChange={(e) => set("hero_title", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.subtitle")}</span>
                  <textarea className={`${studioInputClass} resize-none`} rows={3} value={d.hero_subtitle} onChange={(e) => set("hero_subtitle", e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.primaryCtaText")}</span>
                    <input className={studioInputClass} value={d.hero_primary_cta} onChange={(e) => set("hero_primary_cta", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.primaryCtaUrl")}</span>
                    <input className={`${studioInputClass} font-mono text-xs`} value={d.hero_primary_url} onChange={(e) => set("hero_primary_url", e.target.value)} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.secondaryCtaText")}</span>
                    <input className={studioInputClass} value={d.hero_secondary_cta} onChange={(e) => set("hero_secondary_cta", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.secondaryCtaUrl")}</span>
                    <input className={`${studioInputClass} font-mono text-xs`} value={d.hero_secondary_url} onChange={(e) => set("hero_secondary_url", e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                  <span className="font-label text-label-caps uppercase text-primary font-bold text-xs">{t("admin.homeStudio.viLocale")}</span>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.kicker")} (VI)</span>
                  <input className={studioInputClass} value={d.hero_kicker_vi || ""} onChange={(e) => set("hero_kicker_vi", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.title")} (VI)</span>
                  <input className={`${studioInputClass} font-headline text-lg`} value={d.hero_title_vi || ""} onChange={(e) => set("hero_title_vi", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.subtitle")} (VI)</span>
                  <textarea className={`${studioInputClass} resize-none`} rows={3} value={d.hero_subtitle_vi || ""} onChange={(e) => set("hero_subtitle_vi", e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.primaryCtaText")} (VI)</span>
                    <input className={studioInputClass} value={d.hero_primary_cta_vi || ""} onChange={(e) => set("hero_primary_cta_vi", e.target.value)} />
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.homeStudio.syncSlug")}</span>
                    <div className="px-3 py-2.5 rounded bg-surface-container text-secondary text-xs font-mono truncate">{d.hero_primary_url}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.secondaryCtaText")} (VI)</span>
                    <input className={studioInputClass} value={d.hero_secondary_cta_vi || ""} onChange={(e) => set("hero_secondary_cta_vi", e.target.value)} />
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.homeStudio.syncSlug")}</span>
                    <div className="px-3 py-2.5 rounded bg-surface-container text-secondary text-xs font-mono truncate">{d.hero_secondary_url}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-surface-container-low flex items-center justify-between shadow-sm">
                <div>
                  <span className="font-label text-label-caps uppercase text-primary font-bold text-xs">{t("admin.heroGradient")}</span>
                  <p className="text-xs text-secondary mt-0.5">{t("admin.homeStudio.scrimHint")}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={d.hero_gradient !== false}
                    onChange={(e) => set("hero_gradient", e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
              <div className="p-4 rounded-lg bg-surface-container-low flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-label text-label-caps uppercase text-primary font-bold text-xs">{t("admin.heroCarousel")}</span>
                  {d.hero_carousel ? (
                    <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-label text-[10px] uppercase">ON</span>
                  ) : null}
                </div>
                <label className="flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={d.hero_carousel ?? false} onChange={(e) => set("hero_carousel", e.target.checked)} />
                  <span className="text-xs text-secondary">{t("admin.homeStudio.autoCarousel")}</span>
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-secondary">{t("admin.heroCarouselInterval")}:</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="w-14 px-2 py-1 rounded bg-white text-center font-bold text-sm border border-surface-container-high"
                    value={d.hero_carousel_interval ?? 5}
                    onChange={(e) => set("hero_carousel_interval", Math.max(1, Number(e.target.value) || 5))}
                  />
                  <span className="font-label text-label-caps text-secondary text-xs">{t("admin.seconds")}</span>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-surface-container-low flex items-center justify-between shadow-sm">
                <div>
                  <span className="font-label text-label-caps uppercase text-primary font-bold text-xs">{t("admin.heroTextColor")}</span>
                  <span className="font-mono text-xs text-secondary uppercase block">{d.hero_text_color || "#1c1917"}</span>
                </div>
                <input
                  type="color"
                  value={d.hero_text_color || "#1c1917"}
                  onChange={(e) => set("hero_text_color", e.target.value)}
                  className="w-8 h-8 rounded-full cursor-pointer border-0"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-label text-label-caps uppercase text-primary font-bold tracking-widest text-xs">
                  {t("admin.heroCarouselImages")} ({(d.hero_image_ids || []).length})
                </span>
                <SecondaryButton type="button" className="flex items-center gap-1.5 text-xs uppercase" onClick={() => setCarouselOpen(true)}>
                  <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                  {t("admin.addImage")}
                </SecondaryButton>
              </div>

              <HeroMediaRow
                label={t("admin.homeStudio.primaryAnchor")}
                badge={t("admin.homeStudio.primaryBadge")}
                media={d.hero_image_id ? mediaById.get(d.hero_image_id) : null}
                onChange={() => setHeroPickOpen(true)}
                onClear={() => set("hero_image_id", null)}
                t={t}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(d.hero_image_ids || []).map((id, idx) => {
                  const m = mediaById.get(id);
                  if (!m) return null;
                  return (
                    <div key={id} className="p-3 rounded-lg bg-surface-container-low flex flex-col gap-2">
                      <div className="w-full h-28 rounded overflow-hidden bg-surface-container">
                        <img src={m.url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-label text-label-caps uppercase text-primary text-xs truncate block">
                            {t("admin.homeStudio.slide")} {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span className="font-mono text-[11px] text-secondary truncate block">{m.filename}</span>
                        </div>
                        <button
                          type="button"
                          className="p-1 text-secondary hover:text-error"
                          onClick={() =>
                            setHeroCarouselIds((d.hero_image_ids || []).filter((x) => x !== id))
                          }
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg bg-surface-container-low flex flex-col gap-4 border-t border-surface-container-high pt-8 mt-2">
              <div className="flex items-center justify-between px-1">
                <span className="font-label text-label-caps uppercase text-primary font-bold tracking-widest text-xs">{t("admin.heroColors")}</span>
                <button type="button" className="font-label text-label-caps uppercase text-secondary hover:text-primary text-xs" onClick={() => set("hero_colors", {})}>
                  {t("admin.reset")}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-1 pb-1">
                <ColorField label={t("admin.colorKickerBg")} value={colors.kickerBg} onChange={(v) => setColor("kickerBg", v)} clearLabel={t("admin.clear")} />
                <ColorField label={t("admin.colorKickerText")} value={colors.kickerText} onChange={(v) => setColor("kickerText", v)} clearLabel={t("admin.clear")} />
                <ColorField label={t("admin.colorTitle")} value={colors.title} onChange={(v) => setColor("title", v)} clearLabel={t("admin.clear")} />
                <ColorField label={t("admin.colorSubtitle")} value={colors.subtitle} onChange={(v) => setColor("subtitle", v)} clearLabel={t("admin.clear")} />
                <ColorField label={t("admin.colorPrimaryBg")} value={colors.primaryBg} onChange={(v) => setColor("primaryBg", v)} clearLabel={t("admin.clear")} />
                <ColorField label={t("admin.colorPrimaryText")} value={colors.primaryText} onChange={(v) => setColor("primaryText", v)} clearLabel={t("admin.clear")} />
                <ColorField label={t("admin.colorSecondaryBorder")} value={colors.secondaryBorder} onChange={(v) => setColor("secondaryBorder", v)} clearLabel={t("admin.clear")} />
                <ColorField label={t("admin.colorSecondaryText")} value={colors.secondaryText} onChange={(v) => setColor("secondaryText", v)} clearLabel={t("admin.clear")} />
              </div>
            </div>
          </section>

          {/* M2 Trending */}
          <section className="bg-white p-6 lg:p-8 rounded-xl shadow-sm flex flex-col gap-8">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <ModuleBadge n="M2" />
                <div>
                  <h2 className="font-headline text-xl uppercase tracking-tight text-primary">{t("admin.trendingLatest")}</h2>
                  <p className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.homeStudio.m2Sub")}</p>
                </div>
              </div>
              <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.homeStudio.pimSync")}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4 p-5 rounded-lg bg-surface-container-low">
                <span className="font-label text-label-caps uppercase text-primary font-bold text-xs">{t("admin.homeStudio.trendingHeader")}</span>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.trendingTitle")} (EN)</span>
                  <input className={studioInputClass} value={d.trending_title} onChange={(e) => set("trending_title", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.trendingTitle")} (VI)</span>
                  <input className={studioInputClass} value={d.trending_title_vi || ""} onChange={(e) => set("trending_title_vi", e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.viewAllLabel")} (EN)</span>
                    <input className={studioInputClass} value={d.trending_view_all_label} onChange={(e) => set("trending_view_all_label", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.viewAllLabel")} (VI)</span>
                    <input className={studioInputClass} value={d.trending_view_all_label_vi || ""} onChange={(e) => set("trending_view_all_label_vi", e.target.value)} />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.viewAllUrl")}</span>
                  <input className={`${studioInputClass} font-mono text-xs`} value={d.trending_view_all_url} onChange={(e) => set("trending_view_all_url", e.target.value)} />
                </label>
              </div>
              <div className="flex flex-col gap-4 p-5 rounded-lg bg-surface-container-low">
                <span className="font-label text-label-caps uppercase text-primary font-bold text-xs">{t("admin.homeStudio.latestHeader")}</span>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.latestDropsTitle")} (EN)</span>
                  <input className={studioInputClass} value={d.latest_drops_title} onChange={(e) => set("latest_drops_title", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.latestDropsTitle")} (VI)</span>
                  <input className={studioInputClass} value={d.latest_drops_title_vi || ""} onChange={(e) => set("latest_drops_title_vi", e.target.value)} />
                </label>
                <p className="p-3 rounded bg-surface-container text-xs text-secondary leading-relaxed">{t("admin.trendingHint")}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <span className="font-label text-label-caps uppercase text-primary font-bold tracking-widest text-xs">{t("admin.homeStudio.manifestPreview")}</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {featuredPreview.length === 0 ? (
                  <p className="col-span-full text-secondary text-sm">{t("admin.homeStudio.noFeatured")}</p>
                ) : (
                  featuredPreview.map((p, i) => (
                    <ProductSlot key={p.id} product={p} index={i + 1} />
                  ))
                )}
              </div>
            </div>
          </section>

          {/* M3 Master */}
          <section className="bg-white p-6 lg:p-8 rounded-xl shadow-sm flex flex-col gap-8">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <ModuleBadge n="M3" />
                <div>
                  <h2 className="font-headline text-xl uppercase tracking-tight text-primary">{t("admin.masterSection")}</h2>
                  <p className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.homeStudio.m3Sub")}</p>
                </div>
              </div>
              <span className="font-label text-label-caps uppercase px-3 py-1 bg-surface-container-high rounded text-xs font-bold">{t("admin.homeStudio.featuredPillar")}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.title")} (EN)</span>
                <input className={`${studioInputClass} font-headline text-lg`} value={d.master_title} onChange={(e) => set("master_title", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.title")} (VI)</span>
                <input className={`${studioInputClass} font-headline text-lg`} value={d.master_title_vi || ""} onChange={(e) => set("master_title_vi", e.target.value)} />
              </label>
            </div>
            <ImageField
              label={t("admin.mediaImage")}
              value={d.master_media_id ? mediaById.get(d.master_media_id) || null : null}
              onChange={(m) => set("master_media_id", m ? m.id : null)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.description")} (EN)</span>
                <textarea className={`${studioInputClass} resize-none`} rows={4} value={d.master_description} onChange={(e) => set("master_description", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.description")} (VI)</span>
                <textarea className={`${studioInputClass} resize-none`} rows={4} value={d.master_description_vi || ""} onChange={(e) => set("master_description_vi", e.target.value)} />
              </label>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-label text-label-caps uppercase text-primary font-bold tracking-widest text-xs">{t("admin.featuredList")}</span>
                <SecondaryButton type="button" className="text-xs uppercase" onClick={() => set("features", [...d.features, { index: "", title: "", title_vi: "" }])}>
                  {t("admin.add")}
                </SecondaryButton>
              </div>
              {d.features.map((feature, index) => (
                <div key={index} className="p-3.5 rounded-lg bg-surface-container-low flex flex-col sm:flex-row items-center gap-3">
                  <span className="font-mono text-xs font-bold text-primary w-8 text-center">{feature.index || String(index + 1).padStart(2, "0")}</span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    <input
                      className={studioInputClass}
                      value={feature.title || ""}
                      placeholder="EN"
                      onChange={(e) => {
                        const next = [...d.features];
                        next[index] = { ...next[index], title: e.target.value };
                        set("features", next);
                      }}
                    />
                    <input
                      className={studioInputClass}
                      value={feature.title_vi || ""}
                      placeholder="VI"
                      onChange={(e) => {
                        const next = [...d.features];
                        next[index] = { ...next[index], title_vi: e.target.value };
                        set("features", next);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="p-2 text-secondary hover:text-error"
                    onClick={() => set("features", d.features.filter((_, i) => i !== index))}
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          {saveMutation.isError && <p className="text-error text-sm">{String(saveMutation.error)}</p>}
        </div>

        {/* Right staging panel — scrolls inside column so it does not cover the editor */}
        <div className="flex flex-col gap-8 min-w-0 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto xl:z-[1] xl:overscroll-contain">
          <div className="bg-white p-6 rounded-xl shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                <span className="font-label text-label-caps uppercase text-primary font-bold text-xs">{t("admin.homeStudio.viewport")}</span>
              </div>
              <span className="font-label text-label-caps text-secondary uppercase text-xs">{t("admin.homeStudio.scaleLive")}</span>
            </div>
            <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden shadow-lg bg-primary">
              {heroBg ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url('${heroBg}')` }}
                />
              ) : null}
              {d.hero_gradient !== false ? (
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              ) : null}
              <div className="absolute inset-0 p-6 flex flex-col justify-end text-white" style={{ color: d.hero_text_color || undefined }}>
                <span
                  className="inline-block self-start px-2.5 py-1 text-[10px] font-label tracking-widest uppercase rounded mb-2"
                  style={{
                    backgroundColor: colors.kickerBg || "#1c1917",
                    color: colors.kickerText || "#ffd700",
                  }}
                >
                  {d.hero_kicker}
                </span>
                <h3 className="font-editorial text-3xl font-extrabold uppercase tracking-tight whitespace-pre-line" style={{ color: colors.title || "#fff" }}>
                  {d.hero_title}
                </h3>
                <p className="text-xs max-w-sm mt-1 line-clamp-2 opacity-90" style={{ color: colors.subtitle || "#e5e7eb" }}>
                  {d.hero_subtitle}
                </p>
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <span
                    className="px-4 py-2 text-[11px] font-label uppercase tracking-wider rounded font-bold"
                    style={{ backgroundColor: colors.primaryBg || "#004225", color: colors.primaryText || "#fff" }}
                  >
                    {d.hero_primary_cta}
                  </span>
                  <span
                    className="px-4 py-2 text-[11px] font-label uppercase tracking-wider rounded font-bold border"
                    style={{
                      borderColor: colors.secondaryBorder || "#fff",
                      color: colors.secondaryText || "#fff",
                      backgroundColor: colors.secondaryBg || "transparent",
                    }}
                  >
                    {d.hero_secondary_cta}
                  </span>
                </div>
                {(d.hero_image_ids || []).length > 1 ? (
                  <div className="flex items-center gap-1.5 mt-4 self-center">
                    {Array.from({ length: Math.min(slideCount, 5) }).map((_, i) => (
                      <div key={i} className={`h-1 rounded-full ${i === 0 ? "w-6 bg-white" : "w-2 bg-white/40"}`} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-secondary font-mono flex justify-between">
              <span>{t("admin.homeStudio.viewportSize")}</span>
              <Link to="/" className="text-primary hover:underline">{t("admin.viewStore")}</Link>
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-label text-label-caps uppercase text-primary font-bold tracking-widest text-xs">{t("admin.homeStudio.localization")}</span>
              <span className="font-mono text-xs font-bold text-primary">
                {Math.round((loc.vi / loc.total) * 100)}% {t("admin.homeStudio.viComplete")}
              </span>
            </div>
            <LocBar label={t("admin.homeStudio.enMaster")} filled={loc.en} total={loc.total} />
            <LocBar label={t("admin.homeStudio.viLocale")} filled={loc.vi} total={loc.total} />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col gap-3">
            <span className="font-label text-label-caps uppercase text-primary font-bold tracking-widest text-xs">{t("admin.homeStudio.directIngest")}</span>
            <input ref={ingestRef} type="file" accept="image/*" className="hidden" onChange={() => setCarouselOpen(true)} />
            <button
              type="button"
              onClick={() => ingestRef.current?.click()}
              className="p-8 rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center hover:bg-surface-container transition-all border border-dashed border-surface-container-high"
            >
              <span className="material-symbols-outlined text-4xl text-secondary mb-2">cloud_upload</span>
              <span className="font-label text-label-caps uppercase text-primary font-bold text-xs">{t("admin.homeStudio.dropAsset")}</span>
              <span className="text-xs text-secondary mt-1">{t("admin.homeStudio.dropHint")}</span>
            </button>
          </div>
        </div>
      </div>

      {carouselOpen && (
        <MediaPicker
          onSelect={(m) => {
            const current = d.hero_image_ids || [];
            if (!current.includes(m.id)) setHeroCarouselIds([...current, m.id]);
            setCarouselOpen(false);
          }}
          onClose={() => setCarouselOpen(false)}
        />
      )}
      {heroPickOpen && (
        <MediaPicker
          onSelect={(m) => {
            set("hero_image_id", m.id);
            setHeroPickOpen(false);
          }}
          onClose={() => setHeroPickOpen(false)}
        />
      )}
    </div>
  );
}

function HeroMediaRow({
  label,
  badge,
  media,
  onChange,
  onClear,
  t,
}: {
  label: string;
  badge: string;
  media: Media | null | undefined;
  onChange: () => void;
  onClear: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="p-4 rounded-lg bg-surface-container-low flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-28 h-20 rounded overflow-hidden bg-surface-container shrink-0">
          {media ? <img src={media.url} alt="" className="w-full h-full object-cover" /> : null}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-label text-[10px] uppercase">{badge}</span>
            <span className="font-label text-label-caps text-primary font-bold truncate text-xs">{media?.filename || label}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <SecondaryButton type="button" className="text-xs uppercase" onClick={onChange}>
          {t("admin.change")}
        </SecondaryButton>
        <button type="button" onClick={onClear} className="px-3 py-1.5 text-xs uppercase text-secondary hover:text-error font-label">
          {t("admin.clear")}
        </button>
      </div>
    </div>
  );
}

function ProductSlot({ product, index }: { product: Product; index: number }) {
  const thumb = product.images?.[0]?.url;
  return (
    <div className="p-3 rounded-lg bg-surface-container-low flex flex-col gap-2 relative">
      <span className="absolute top-4 left-4 z-10 px-2 py-0.5 rounded bg-primary text-on-primary font-label text-[10px]">#{String(index).padStart(2, "0")}</span>
      <div className="w-full h-36 rounded overflow-hidden bg-surface-container">
        {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : null}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-label text-label-caps uppercase text-primary truncate text-xs">{product.name}</span>
        <span className="font-mono text-xs text-secondary truncate">{product.slug}</span>
      </div>
    </div>
  );
}

function LocBar({ label, filled, total }: { label: string; filled: number; total: number }) {
  const pct = total ? Math.round((filled / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="font-label uppercase text-secondary">{label}</span>
        <span className="font-mono font-bold text-primary">
          {filled}/{total}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
