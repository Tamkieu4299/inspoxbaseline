import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { EditorialItem, HomeContentAdmin, Media } from "../types";
import { ImageField, MediaPicker } from "./MediaLibrary";
import { Checkbox, DangerButton, Field, PrimaryButton, SecondaryButton, Select, TextArea, TextInput, ViArea, ViInput } from "./ui";

function blank(): Partial<EditorialItem> {
  return {
    kind: "image",
    title: "",
    title_vi: "",
    subtitle: "",
    subtitle_vi: "",
    quote: "",
    quote_vi: "",
    author: "",
    author_vi: "",
    media_id: null,
    content: [],
    link_text: "",
    link_text_vi: "",
    link_url: "",
    position: 0,
    is_active: true,
  };
}

export default function BrandTab() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { data: items, isLoading } = useQuery({ queryKey: ["admin-editorial"], queryFn: adminApi.getEditorial });
  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: ["admin-home"],
    queryFn: adminApi.getHome,
  });
  const { data: media } = useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });

  const [draft, setDraft] = useState<Partial<EditorialItem> | null>(null);
  const [heroDraft, setHeroDraft] = useState<HomeContentAdmin | null>(null);
  const [heroDirty, setHeroDirty] = useState(false);
  const [gridImageIndex, setGridImageIndex] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: (d: Partial<EditorialItem>) =>
      d.id ? adminApi.updateEditorial(d.id, d) : adminApi.createEditorial(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-editorial"] });
      queryClient.invalidateQueries({ queryKey: ["brand"] });
      setDraft(null);
    },
  });

  const saveHeroMutation = useMutation({
    mutationFn: adminApi.updateHome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-home"] });
      queryClient.invalidateQueries({ queryKey: ["home"] });
      queryClient.invalidateQueries({ queryKey: ["brand"] });
      setHeroDirty(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteEditorial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-editorial"] });
      setDraft(null);
    },
  });

  const mediaById = new Map((media || []).map((m) => [m.id, m]));

  useEffect(() => {
    if (home && !heroDirty) {
      setHeroDraft(home);
    }
  }, [home, heroDirty]);

  function setHero<K extends keyof HomeContentAdmin>(key: K, value: HomeContentAdmin[K]) {
    setHeroDraft((d) => ({ ...(d ?? home!), [key]: value }));
    setHeroDirty(true);
  }

  function set<K extends keyof EditorialItem>(key: K, value: EditorialItem[K]) {
    setDraft((d) => ({ ...(d || blank()), [key]: value }));
  }

  const h = heroDraft || home;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-surface-container-highest p-6 max-w-3xl">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-headline text-headline-md text-primary uppercase">{t("admin.brandPageHero")}</h3>
            <p className="font-body text-body-md text-secondary mt-1">{t("admin.brandPageHeroHint")}</p>
          </div>
          <PrimaryButton
            disabled={!heroDirty || !h || homeLoading}
            onClick={() => h && home && saveHeroMutation.mutate({ ...home, ...h })}
          >
            {t("admin.saveBrandHero")}
          </PrimaryButton>
        </div>
        {homeLoading || !h ? (
          <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <ImageField
              label={t("admin.brandHeroImage")}
              value={h.brand_hero_image_id ? (mediaById.get(h.brand_hero_image_id) as Media) || null : null}
              onChange={(m) => setHero("brand_hero_image_id", m ? m.id : null)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("admin.title")}>
                <TextInput
                  value={h.brand_hero_title || ""}
                  onChange={(e) => setHero("brand_hero_title", e.target.value || null)}
                />
              </Field>
              <ViInput
                label={t("admin.title")}
                value={h.brand_hero_title_vi || ""}
                onChange={(e) => setHero("brand_hero_title_vi", e.target.value || null)}
              />
              <Field label={t("admin.subtitle")}>
                <TextArea
                  rows={2}
                  value={h.brand_hero_subtitle || ""}
                  onChange={(e) => setHero("brand_hero_subtitle", e.target.value || null)}
                />
              </Field>
              <ViInput
                label={t("admin.subtitle")}
                value={h.brand_hero_subtitle_vi || ""}
                onChange={(e) => setHero("brand_hero_subtitle_vi", e.target.value || null)}
              />
              <Field label={t("admin.heroCta")}>
                <TextInput
                  value={h.brand_hero_cta || ""}
                  onChange={(e) => setHero("brand_hero_cta", e.target.value || null)}
                />
              </Field>
              <ViInput
                label={t("admin.heroCta")}
                value={h.brand_hero_cta_vi || ""}
                onChange={(e) => setHero("brand_hero_cta_vi", e.target.value || null)}
              />
            </div>
          </div>
        )}
        {saveHeroMutation.isSuccess && !heroDirty && (
          <p className="text-forest-green text-sm mt-3">{t("admin.brandHeroSaved")}</p>
        )}
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 flex flex-col gap-2 max-h-[70vh] overflow-auto pr-2">
        <PrimaryButton onClick={() => setDraft(blank())}>{t("admin.newItem")}</PrimaryButton>
        {isLoading ? (
          <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>
        ) : (
          (items || []).map((item) => (
            <button
              key={item.id}
              onClick={() => setDraft({ ...item })}
              className={`text-left border p-2 transition-colors ${
                draft?.id === item.id ? "border-forest-green bg-white" : "border-transparent hover:border-surface-container-highest"
              }`}
            >
              <span className="font-headline text-headline-md text-primary uppercase block">
                {item.kind === "quote" ? "QUOTE" : item.kind === "product_grid" ? "IMAGE GRID" : item.title || "IMAGE"}
              </span>
              <span className="font-label text-label-caps text-secondary">POS {item.position}</span>
            </button>
          ))
        )}
      </div>

      <div className="lg:col-span-8 bg-white border border-surface-container-highest p-6">
        {!draft ? (
          <p className="font-body text-body-md text-secondary">{t("admin.selectItem")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-headline-md text-primary uppercase">
                {draft.id ? t("admin.editItem") : t("admin.newItemTitle")}
              </h3>
              <div className="flex gap-2">
                {draft.id && <DangerButton onClick={() => deleteMutation.mutate(draft.id!)}>{t("admin.delete")}</DangerButton>}
                <SecondaryButton onClick={() => setDraft(null)}>{t("admin.cancel")}</SecondaryButton>
                <PrimaryButton onClick={() => saveMutation.mutate(draft)}>{t("admin.saveItem")}</PrimaryButton>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label={t("admin.kind")}>
                <Select value={draft.kind} onChange={(e) => set("kind", e.target.value as EditorialItem["kind"])}>
                  <option value="image">IMAGE</option>
                  <option value="quote">QUOTE</option>
                  <option value="product_grid">IMAGE GRID (2 UP)</option>
                </Select>
              </Field>
              <Field label={t("admin.position")}>
                <TextInput
                  type="number"
                  value={draft.position || 0}
                  onChange={(e) => set("position", Number(e.target.value))}
                />
              </Field>
              <label className="flex items-end gap-2 font-body text-body-md text-on-background pb-2">
                <Checkbox
                  checked={draft.is_active}
                  onChange={(e) => set("is_active", e.target.checked)}
                />{" "}
                {t("admin.active")}
              </label>
            </div>

            {draft.kind === "image" && (
              <>
                <ImageField
                  label={t("admin.image")}
                  value={draft.media_id ? (mediaById.get(draft.media_id) as Media) || null : null}
                  onChange={(m) => set("media_id", m ? m.id : null)}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t("admin.subtitleOverlay")}>
                    <TextInput value={draft.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} />
                  </Field>
                  <Field label={t("admin.title")}>
                    <TextInput value={draft.title || ""} onChange={(e) => set("title", e.target.value)} />
                  </Field>
                  <Field label={t("admin.linkText")}>
                    <TextInput value={draft.link_text || ""} onChange={(e) => set("link_text", e.target.value)} />
                  </Field>
                  <Field label={t("admin.linkUrl")}>
                    <TextInput value={draft.link_url || ""} onChange={(e) => set("link_url", e.target.value)} />
                  </Field>
                  <ViInput label={t("admin.subtitleOverlay")} value={draft.subtitle_vi || ""} onChange={(e) => set("subtitle_vi", e.target.value)} placeholder="Phụ đề tiếng Việt" />
                  <ViInput label={t("admin.title")} value={draft.title_vi || ""} onChange={(e) => set("title_vi", e.target.value)} placeholder="Tiêu đề tiếng Việt" />
                  <ViInput label={t("admin.linkText")} value={draft.link_text_vi || ""} onChange={(e) => set("link_text_vi", e.target.value)} placeholder="Văn bản liên kết tiếng Việt" />
                </div>
              </>
            )}

            {draft.kind === "quote" && (
              <>
                <Field label={t("admin.quote")}>
                  <TextArea rows={3} value={draft.quote || ""} onChange={(e) => set("quote", e.target.value)} />
                </Field>
                <Field label={t("admin.author")}>
                  <TextInput value={draft.author || ""} onChange={(e) => set("author", e.target.value)} />
                </Field>
                <ViArea label={t("admin.quote")} rows={3} value={draft.quote_vi || ""} onChange={(e) => set("quote_vi", e.target.value)} placeholder="Trích dẫn tiếng Việt" />
                <ViInput label={t("admin.author")} value={draft.author_vi || ""} onChange={(e) => set("author_vi", e.target.value)} placeholder="Tác giả tiếng Việt" />
              </>
            )}

            {draft.kind === "product_grid" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-headline text-headline-md text-primary uppercase">{t("admin.gridImages")}</h4>
                  <SecondaryButton onClick={() => setGridImageIndex((draft.content || []).length)}>
                    {t("admin.addImageShort")}
                  </SecondaryButton>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(draft.content || []).map((cell, index) => (
                    <div key={index} className="border border-surface-container-highest p-2 flex flex-col gap-2">
                      <img src={cell.url} alt={cell.alt || ""} className="w-full h-32 object-cover" />
                      <TextInput
                        value={cell.link_text || ""}
                        placeholder={t("admin.gridLinkLabel")}
                        onChange={(e) => {
                          const content = [...(draft.content || [])];
                          content[index] = { ...content[index], link_text: e.target.value };
                          set("content", content);
                        }}
                      />
                      <TextInput
                        value={cell.link_url || ""}
                        placeholder={t("admin.linkUrl")}
                        onChange={(e) => {
                          const content = [...(draft.content || [])];
                          content[index] = { ...content[index], link_url: e.target.value };
                          set("content", content);
                        }}
                      />
                      <TextInput
                        value={cell.link_text_vi || ""}
                        placeholder={`VI · ${t("admin.gridLinkLabel")}`}
                        onChange={(e) => {
                          const content = [...(draft.content || [])];
                          content[index] = { ...content[index], link_text_vi: e.target.value };
                          set("content", content);
                        }}
                      />
                      <DangerButton
                        onClick={() => set("content", (draft.content || []).filter((_, i) => i !== index))}
                      >
                        {t("admin.remove")}
                      </DangerButton>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {saveMutation.isError && <p className="text-error text-sm">{String(saveMutation.error)}</p>}
          </div>
        )}
      </div>

      {gridImageIndex !== null && (
        <MediaPicker
          onSelect={(m) => {
            const content = [...(draft!.content || [])];
            const index = gridImageIndex;
            const cell = { url: m.url, alt: m.filename, link_text: "", link_text_vi: "", link_url: "" };
            if (index < content.length) content[index] = cell;
            else content.push(cell);
            set("content", content);
          }}
          onClose={() => setGridImageIndex(null)}
        />
      )}
    </div>
    </div>
  );
}
