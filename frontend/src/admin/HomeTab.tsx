import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { HomeContentAdmin, Media } from "../types";
import { ImageField, MediaPicker } from "./MediaLibrary";
import { Checkbox, ColorField, DangerButton, Field, PrimaryButton, SecondaryButton, TextArea, TextInput, ViArea, ViInput } from "./ui";

export default function HomeTab() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { data: home, isLoading } = useQuery({ queryKey: ["admin-home"], queryFn: adminApi.getHome });
  const { data: media } = useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });

  const [draft, setDraft] = useState<HomeContentAdmin | null>(null);
  const [dirty, setDirty] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: adminApi.updateHome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-home"] });
      queryClient.invalidateQueries({ queryKey: ["home"] });
      setDirty(false);
    },
  });

  const mediaById = new Map((media || []).map((m) => [m.id, m]));

  if (isLoading || !home) {
    return <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>;
  }

  const draftValue = draft || home;

  function set<K extends keyof HomeContentAdmin>(key: K, value: HomeContentAdmin[K]) {
    setDraft((d) => ({ ...(d ?? home!), [key]: value }));
    setDirty(true);
  }

  function setColor(key: string, value: string | undefined) {
    const next = { ...(draftValue.hero_colors || {}) };
    if (value) next[key] = value;
    else delete next[key];
    set("hero_colors", next);
  }

  return (
    <div className="bg-white border border-surface-container-highest p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-headline text-headline-md text-primary uppercase">{t("admin.homepageContent")}</h3>
        <PrimaryButton
          onClick={() => saveMutation.mutate(draftValue)}
          disabled={!dirty}
        >
          {t("admin.saveHomepage")}
        </PrimaryButton>
      </div>

      {/* Hero */}
      <section className="border border-surface-container-high p-4 flex flex-col gap-3">
        <h4 className="font-headline text-headline-md text-primary uppercase">{t("admin.heroBanner")}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t("admin.kicker")}>
            <TextInput value={draftValue.hero_kicker} onChange={(e) => set("hero_kicker", e.target.value)} />
          </Field>
          <Field label={t("admin.title")}>
            <TextInput value={draftValue.hero_title} onChange={(e) => set("hero_title", e.target.value)} />
          </Field>
          <ViInput label={t("admin.kicker")} value={draftValue.hero_kicker_vi || ""} onChange={(e) => set("hero_kicker_vi", e.target.value)} placeholder="Kicker tiếng Việt" />
          <ViInput label={t("admin.title")} value={draftValue.hero_title_vi || ""} onChange={(e) => set("hero_title_vi", e.target.value)} placeholder="Tiêu đề tiếng Việt" />
          <ImageField
            label={t("admin.heroImage")}
            value={draftValue.hero_image_id ? (mediaById.get(draftValue.hero_image_id) as Media) || null : null}
            onChange={(m) => set("hero_image_id", m ? m.id : null)}
          />
          <label className="flex flex-col gap-2">
            <span className="font-label text-label-caps text-secondary uppercase">{t("admin.heroGradient")}</span>
            <Checkbox
              checked={draftValue.hero_gradient !== false}
              onChange={(e) => set("hero_gradient", e.target.checked)}
            />
          </label>
          <Field label={t("admin.heroTextColor")}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={draftValue.hero_text_color || "#1c1917"}
                onChange={(e) => set("hero_text_color", e.target.value)}
                className="h-10 w-14 cursor-pointer border border-surface-container-highest bg-white p-1"
              />
              <TextInput
                value={draftValue.hero_text_color || ""}
                onChange={(e) => set("hero_text_color", e.target.value)}
                className="flex-1"
              />
            </div>
          </Field>
          <label className="flex flex-col gap-2">
            <span className="font-label text-label-caps text-secondary uppercase">{t("admin.heroCarousel")}</span>
            <Checkbox
              checked={draftValue.hero_carousel ?? false}
              onChange={(e) => set("hero_carousel", e.target.checked)}
            />
          </label>
          <Field label={t("admin.heroCarouselInterval")}>
            <div className="flex items-center gap-2">
              <TextInput
                type="number"
                min={1}
                value={draftValue.hero_carousel_interval ?? 5}
                onChange={(e) => set("hero_carousel_interval", Math.max(1, Number(e.target.value) || 5))}
                className="w-24"
              />
              <span className="font-body text-body-md text-secondary">{t("admin.seconds")}</span>
            </div>
          </Field>
          <Field label={t("admin.subtitle")} className="md:col-span-1">
            <TextArea rows={2} value={draftValue.hero_subtitle} onChange={(e) => set("hero_subtitle", e.target.value)} />
          </Field>
          <Field label={t("admin.primaryCtaText")}>
            <TextInput value={draftValue.hero_primary_cta} onChange={(e) => set("hero_primary_cta", e.target.value)} />
          </Field>
          <Field label={t("admin.primaryCtaUrl")}>
            <TextInput value={draftValue.hero_primary_url} onChange={(e) => set("hero_primary_url", e.target.value)} />
          </Field>
          <Field label={t("admin.secondaryCtaText")}>
            <TextInput value={draftValue.hero_secondary_cta} onChange={(e) => set("hero_secondary_cta", e.target.value)} />
          </Field>
          <Field label={t("admin.secondaryCtaUrl")}>
            <TextInput value={draftValue.hero_secondary_url} onChange={(e) => set("hero_secondary_url", e.target.value)} />
          </Field>
          <ViArea label={t("admin.subtitle")} rows={2} value={draftValue.hero_subtitle_vi || ""} onChange={(e) => set("hero_subtitle_vi", e.target.value)} placeholder="Phụ đề tiếng Việt" />
          <ViInput label={t("admin.primaryCtaText")} value={draftValue.hero_primary_cta_vi || ""} onChange={(e) => set("hero_primary_cta_vi", e.target.value)} placeholder="Nút CTA chính tiếng Việt" />
          <ViInput label={t("admin.secondaryCtaText")} value={draftValue.hero_secondary_cta_vi || ""} onChange={(e) => set("hero_secondary_cta_vi", e.target.value)} placeholder="Nút CTA phụ tiếng Việt" />
        </div>
        <div className="flex flex-col gap-2 border-t border-surface-container-high pt-4">
          <div className="flex items-center justify-between">
            <span className="font-label text-label-caps text-secondary uppercase">{t("admin.heroCarouselImages")}</span>
            <SecondaryButton onClick={() => setCarouselOpen(true)}>{t("admin.addImage")}</SecondaryButton>
          </div>
          <p className="font-body text-body-md text-secondary">{t("admin.heroCarouselHint")}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(draftValue.hero_image_ids || []).map((id) => {
              const m = mediaById.get(id);
              if (!m) return null;
              return (
                <div key={id} className="relative border border-surface-container-highest bg-white p-2">
                  <img src={m.url} alt={m.filename} className="w-full h-24 object-cover" />
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-body text-body-md text-on-background text-xs truncate max-w-[140px]">
                      {m.filename}
                    </span>
                    <button
                      onClick={() => set("hero_image_ids", (draftValue.hero_image_ids || []).filter((x) => x !== id))}
                      className="font-label text-label-caps text-error hover:underline uppercase"
                    >
                      {t("admin.remove")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {(draftValue.hero_image_ids || []).length === 0 && (
            <p className="font-body text-body-md text-secondary">{t("admin.none")}</p>
          )}
        </div>
        <div className="flex flex-col gap-3 border-t border-surface-container-high pt-4">
          <div className="flex items-center justify-between">
            <span className="font-label text-label-caps text-secondary uppercase">{t("admin.heroColors")}</span>
            <SecondaryButton onClick={() => set("hero_colors", {})}>{t("admin.reset")}</SecondaryButton>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorField label={t("admin.colorKickerBg")} value={draftValue.hero_colors?.kickerBg} onChange={(v) => setColor("kickerBg", v)} clearLabel={t("admin.clear")} />
            <ColorField label={t("admin.colorKickerText")} value={draftValue.hero_colors?.kickerText} onChange={(v) => setColor("kickerText", v)} clearLabel={t("admin.clear")} />
            <ColorField label={t("admin.colorTitle")} value={draftValue.hero_colors?.title} onChange={(v) => setColor("title", v)} clearLabel={t("admin.clear")} />
            <ColorField label={t("admin.colorSubtitle")} value={draftValue.hero_colors?.subtitle} onChange={(v) => setColor("subtitle", v)} clearLabel={t("admin.clear")} />
            <ColorField label={t("admin.colorPrimaryBg")} value={draftValue.hero_colors?.primaryBg} onChange={(v) => setColor("primaryBg", v)} clearLabel={t("admin.clear")} />
            <ColorField label={t("admin.colorPrimaryText")} value={draftValue.hero_colors?.primaryText} onChange={(v) => setColor("primaryText", v)} clearLabel={t("admin.clear")} />
            <ColorField label={t("admin.colorSecondaryBg")} value={draftValue.hero_colors?.secondaryBg} onChange={(v) => setColor("secondaryBg", v)} clearLabel={t("admin.clear")} />
            <ColorField label={t("admin.colorSecondaryBorder")} value={draftValue.hero_colors?.secondaryBorder} onChange={(v) => setColor("secondaryBorder", v)} clearLabel={t("admin.clear")} />
            <ColorField label={t("admin.colorSecondaryText")} value={draftValue.hero_colors?.secondaryText} onChange={(v) => setColor("secondaryText", v)} clearLabel={t("admin.clear")} />
          </div>
        </div>
      </section>

      {/* Trending / Latest section titles */}
      <section className="border border-surface-container-high p-4 flex flex-col gap-3">
        <h4 className="font-headline text-headline-md text-primary uppercase">{t("admin.trendingLatest")}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={t("admin.trendingTitle")}>
            <TextInput value={draftValue.trending_title} onChange={(e) => set("trending_title", e.target.value)} />
          </Field>
          <Field label={t("admin.viewAllLabel")}>
            <TextInput value={draftValue.trending_view_all_label} onChange={(e) => set("trending_view_all_label", e.target.value)} />
          </Field>
          <Field label={t("admin.viewAllUrl")}>
            <TextInput value={draftValue.trending_view_all_url} onChange={(e) => set("trending_view_all_url", e.target.value)} />
          </Field>
          <Field label={t("admin.latestDropsTitle")}>
            <TextInput value={draftValue.latest_drops_title} onChange={(e) => set("latest_drops_title", e.target.value)} />
          </Field>
          <ViInput label={t("admin.trendingTitle")} value={draftValue.trending_title_vi || ""} onChange={(e) => set("trending_title_vi", e.target.value)} placeholder="Tiêu đề Trending tiếng Việt" />
          <ViInput label={t("admin.viewAllLabel")} value={draftValue.trending_view_all_label_vi || ""} onChange={(e) => set("trending_view_all_label_vi", e.target.value)} placeholder="Nhãn Xem tất cả tiếng Việt" />
          <ViInput label={t("admin.latestDropsTitle")} value={draftValue.latest_drops_title_vi || ""} onChange={(e) => set("latest_drops_title_vi", e.target.value)} placeholder="Tiêu đề Sản phẩm mới tiếng Việt" />
        </div>
        <p className="font-body text-body-md text-secondary">
          {t("admin.trendingHint")}
        </p>
      </section>

      {/* Master Section */}
      <section className="border border-surface-container-high p-4 flex flex-col gap-3">
        <h4 className="font-headline text-headline-md text-primary uppercase">{t("admin.masterSection")}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t("admin.title")}>
            <TextInput value={draftValue.master_title} onChange={(e) => set("master_title", e.target.value)} />
          </Field>
          <ImageField
            label={t("admin.mediaImage")}
            value={draftValue.master_media_id ? (mediaById.get(draftValue.master_media_id) as Media) || null : null}
            onChange={(m) => set("master_media_id", m ? m.id : null)}
          />
          <Field label={t("admin.description")} className="md:col-span-2">
            <TextArea rows={2} value={draftValue.master_description} onChange={(e) => set("master_description", e.target.value)} />
          </Field>
          <ViInput label={t("admin.title")} value={draftValue.master_title_vi || ""} onChange={(e) => set("master_title_vi", e.target.value)} placeholder="Tiêu đề tiếng Việt" />
          <ViArea label={t("admin.description")} rows={2} value={draftValue.master_description_vi || ""} onChange={(e) => set("master_description_vi", e.target.value)} placeholder="Mô tả tiếng Việt" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-label text-label-caps text-secondary uppercase">{t("admin.featuredList")}</span>
            <SecondaryButton
              onClick={() => set("features", [...draftValue.features, { index: "", title: "", title_vi: "" }])}
            >
              {t("admin.add")}
            </SecondaryButton>
          </div>
          <div className="flex flex-col gap-2">
            {draftValue.features.map((feature, index) => (
              <div key={index} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <TextInput
                    value={feature.index || ""}
                    placeholder="01"
                    className="w-20"
                    onChange={(e) => (feature.index = e.target.value)}
                  />
                  <TextInput
                    value={feature.title || ""}
                    placeholder="TITLE"
                    className="flex-1"
                    onChange={(e) => (feature.title = e.target.value)}
                  />
                  <DangerButton
                    onClick={() => set("features", draftValue.features.filter((_, i) => i !== index))}
                  >
                    {t("admin.remove")}
                  </DangerButton>
                </div>
                <TextInput
                  value={feature.title_vi || ""}
                  placeholder="VI · Tiêu đề"
                  className="ml-20"
                  onChange={(e) => (feature.title_vi = e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {saveMutation.isError && <p className="text-error text-sm">{String(saveMutation.error)}</p>}
      {saveMutation.isSuccess && !dirty && <p className="text-forest-green text-sm">{t("admin.homepageSaved")}</p>}
      {carouselOpen && (
        <MediaPicker
          onSelect={(m) => {
            const current = draftValue.hero_image_ids || [];
            if (!current.includes(m.id)) set("hero_image_ids", [...current, m.id]);
          }}
          onClose={() => setCarouselOpen(false)}
        />
      )}
    </div>
  );
}
