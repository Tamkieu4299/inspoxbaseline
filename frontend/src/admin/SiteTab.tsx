import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { Media, SiteSettings } from "../types";
import { ImageField } from "./MediaLibrary";
import { Field, PrimaryButton, TextInput } from "./ui";

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
          onClick={() => saveMutation.mutate(draftValue)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ImageField
            label={t("admin.logo")}
            value={draftValue.logo_media_id ? mediaById.get(draftValue.logo_media_id) as Media || null : null}
            onChange={(m) => set("logo_media_id", m ? m.id : null)}
          />
          <ImageField
            label={t("admin.favicon")}
            value={draftValue.favicon_media_id ? mediaById.get(draftValue.favicon_media_id) as Media || null : null}
            onChange={(m) => set("favicon_media_id", m ? m.id : null)}
          />
        </div>
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
