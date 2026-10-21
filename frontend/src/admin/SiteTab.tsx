import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { Media, SiteSettings } from "../types";
import { ImageField } from "./MediaLibrary";
import { Field, PrimaryButton, TextInput, ViInput } from "./ui";

export default function SiteTab() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { data: site, isLoading } = useQuery({ queryKey: ["admin-site"], queryFn: adminApi.getSite });
  const { data: media } = useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });
  const mediaById = new Map((media || []).map((m) => [m.id, m]));

  const [draft, setDraft] = useState<SiteSettings | null>(null);

  const saveMutation = useMutation({
    mutationFn: adminApi.updateSite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-site"] });
      queryClient.invalidateQueries({ queryKey: ["site"] });
      setDraft(null);
    },
  });

  if (isLoading || !site) {
    return <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>;
  }

  const draftValue = draft || site;

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setDraft((d) => ({ ...(d ?? site!), [key]: value }));
  }

  return (
    <div className="bg-white border border-surface-container-highest p-6 flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="font-headline text-headline-md text-primary uppercase">{t("admin.siteBranding")}</h3>
        <PrimaryButton
          onClick={() => saveMutation.mutate({ ...draftValue, currency_code: "VND" })}
          disabled={!draft}
        >
          {t("admin.saveBranding")}
        </PrimaryButton>
      </div>

      <p className="font-body text-body-md text-secondary">
        {t("admin.brandingHint")}
      </p>

      <div className="flex flex-col gap-4">
        <Field label={t("admin.siteName")}>
          <TextInput value={draftValue.site_name} onChange={(e) => set("site_name", e.target.value)} />
        </Field>
        <Field label={t("admin.baseCurrency")}>
          <p className="font-body text-body-md text-primary py-2">VND — {t("admin.vndOnlyHint")}</p>
          {(draftValue.currency_code || "VND").toUpperCase() !== "VND" && (
            <PrimaryButton type="button" className="mt-2 text-xs" onClick={() => set("currency_code", "VND")}>
              {t("admin.switchToVnd")}
            </PrimaryButton>
          )}
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ImageField
            label={t("admin.logo")}
            value={draftValue.logo_media_id ? mediaById.get(draftValue.logo_media_id) as Media || null : null}
            onChange={(m) => set("logo_media_id", m ? m.id : null)}
          />
          <ImageField
            label={t("admin.favicon")}
            preserveTransparency
            value={draftValue.favicon_media_id ? mediaById.get(draftValue.favicon_media_id) as Media || null : null}
            onChange={(m) => set("favicon_media_id", m ? m.id : null)}
          />
        </div>
      </div>

      <div className="border-t border-surface-container-highest pt-6 flex flex-col gap-4">
        <h4 className="font-headline text-headline-md text-primary uppercase">{t("admin.storefrontCopy")}</h4>
        <p className="font-body text-body-md text-secondary -mt-2">{t("admin.storefrontCopyHint")}</p>
        <Field label={t("admin.footerTagline")}>
          <TextInput
            value={draftValue.footer_tagline || ""}
            onChange={(e) => set("footer_tagline", e.target.value || null)}
            placeholder={t("admin.footerTaglinePlaceholder")}
          />
        </Field>
        <ViInput
          label={t("admin.footerTagline")}
          value={draftValue.footer_tagline_vi || ""}
          onChange={(e) => set("footer_tagline_vi", e.target.value || null)}
          placeholder="Dòng tagline footer (tiếng Việt)"
        />
        <Field label={t("admin.collectionsSubtitle")}>
          <TextInput
            value={draftValue.collections_subtitle || ""}
            onChange={(e) => set("collections_subtitle", e.target.value || null)}
            placeholder={t("admin.collectionsSubtitlePlaceholder")}
          />
        </Field>
        <ViInput
          label={t("admin.collectionsSubtitle")}
          value={draftValue.collections_subtitle_vi || ""}
          onChange={(e) => set("collections_subtitle_vi", e.target.value || null)}
          placeholder="Phụ đề trang /collections (tiếng Việt)"
        />
      </div>

      {draftValue.logo_media && (
        <div className="border border-surface-container-highest p-3 flex items-center gap-4">
          <span className="font-label text-label-caps text-secondary uppercase">{t("admin.preview")}</span>
          <img src={draftValue.logo_media.url} alt="Logo preview" className="h-10 w-auto object-contain" />
        </div>
      )}

      {saveMutation.isError && <p className="text-error text-sm">{String(saveMutation.error)}</p>}
      {saveMutation.isSuccess && !draft && <p className="text-forest-green text-sm">{t("admin.brandingSaved")}</p>}
    </div>
  );
}
