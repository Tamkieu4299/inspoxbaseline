import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import { FOOTER_PRESET_LABELS, normalizeFooterLinkConfigs } from "../footerLinks";
import {
  FLOATING_CONTACT_ICONS,
  FLOATING_CONTACT_LABELS,
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  normalizeFooterContact,
  type FloatingContactIcon,
  type SocialNetwork,
} from "../footerContact";
import type {
  FooterContactConfig,
  FooterFloatingLink,
  FooterLinkConfig,
  FooterSocialLink,
  Media,
  SiteSettings,
} from "../types";
import { ImageField } from "./MediaLibrary";
import { Checkbox, Field, PrimaryButton, SecondaryButton, Select, TextInput, ViInput } from "./ui";

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

  const footerLinks = normalizeFooterLinkConfigs(draftValue.footer_links);
  const footerContact = normalizeFooterContact(draftValue.footer_contact);

  function setFooterContact(patch: Partial<FooterContactConfig>) {
    set("footer_contact", normalizeFooterContact({ ...footerContact, ...patch }));
  }

  function setSocialLinks(links: FooterSocialLink[]) {
    setFooterContact({ social_links: links });
  }

  function updateSocialLink(index: number, patch: Partial<FooterSocialLink>) {
    const next = [...(footerContact.social_links || [])];
    next[index] = { ...next[index], ...patch };
    setSocialLinks(next);
  }

  function removeSocialLink(index: number) {
    setSocialLinks((footerContact.social_links || []).filter((_, i) => i !== index));
  }

  function addSocialLink() {
    setSocialLinks([...(footerContact.social_links || []), { icon: "facebook", url: "" }]);
  }

  function setFloatingLinks(links: FooterFloatingLink[]) {
    setFooterContact({ floating_contact_links: links });
  }

  function updateFloatingLink(index: number, patch: Partial<FooterFloatingLink>) {
    const next = [...(footerContact.floating_contact_links || [])];
    next[index] = { ...next[index], ...patch };
    setFloatingLinks(next);
  }

  function removeFloatingLink(index: number) {
    setFloatingLinks((footerContact.floating_contact_links || []).filter((_, i) => i !== index));
  }

  function addFloatingLink() {
    setFloatingLinks([...(footerContact.floating_contact_links || []), { icon: "zalo", url: "" }]);
  }

  function setFooterLink(index: number, patch: Partial<FooterLinkConfig>) {
    const next = footerLinks.map((row, i) => (i === index ? { ...row, ...patch } : row));
    set("footer_links", next);
  }

  return (
    <div className="bg-white border border-surface-container-highest p-6 flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h3 className="font-headline text-headline-md text-primary uppercase">{t("admin.siteBranding")}</h3>
        <PrimaryButton
          onClick={() =>
            saveMutation.mutate({
              ...draftValue,
              currency_code: "VND",
              footer_contact: normalizeFooterContact(draftValue.footer_contact),
            })
          }
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
          <p className="font-body text-body-sm text-secondary mt-1">{t("admin.footerTaglineHint")}</p>
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

      <div className="border-t border-surface-container-highest pt-6 flex flex-col gap-4">
        <h4 className="font-headline text-headline-md text-primary uppercase">{t("admin.footerContact")}</h4>
        <p className="font-body text-body-md text-secondary -mt-2">{t("admin.footerContactHint")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t("admin.footerPhone")}>
            <TextInput
              value={footerContact.phone || ""}
              onChange={(e) => setFooterContact({ phone: e.target.value || null })}
              placeholder="0939 22 63 69"
            />
          </Field>
          <Field label={t("admin.footerEmail")}>
            <TextInput
              value={footerContact.email || ""}
              onChange={(e) => setFooterContact({ email: e.target.value || null })}
              placeholder="hello@example.com"
            />
          </Field>
          <Field label={t("admin.footerAddress")}>
            <TextInput
              value={footerContact.address || ""}
              onChange={(e) => setFooterContact({ address: e.target.value || null })}
            />
          </Field>
          <ViInput
            label={t("admin.footerAddressVi")}
            value={footerContact.address_vi || ""}
            onChange={(e) => setFooterContact({ address_vi: e.target.value || null })}
          />
          <Field label={t("admin.footerBusinessReg")}>
            <TextInput
              value={footerContact.business_registration || ""}
              onChange={(e) => setFooterContact({ business_registration: e.target.value || null })}
            />
          </Field>
          <ViInput
            label={t("admin.footerBusinessRegVi")}
            value={footerContact.business_registration_vi || ""}
            onChange={(e) => setFooterContact({ business_registration_vi: e.target.value || null })}
          />
          <Field label={t("admin.footerShowroom")}>
            <TextInput
              value={footerContact.showroom_note || ""}
              onChange={(e) => setFooterContact({ showroom_note: e.target.value || null })}
            />
          </Field>
          <ViInput
            label={t("admin.footerShowroomVi")}
            value={footerContact.showroom_note_vi || ""}
            onChange={(e) => setFooterContact({ showroom_note_vi: e.target.value || null })}
          />
          <Field label={t("admin.footerHours")}>
            <TextInput
              value={footerContact.opening_hours || ""}
              onChange={(e) => setFooterContact({ opening_hours: e.target.value || null })}
            />
          </Field>
          <ViInput
            label={t("admin.footerHoursVi")}
            value={footerContact.opening_hours_vi || ""}
            onChange={(e) => setFooterContact({ opening_hours_vi: e.target.value || null })}
          />
        </div>
        <Field label={t("admin.footerMapEmbed")}>
          <TextInput
            value={footerContact.map_embed_url || ""}
            onChange={(e) => setFooterContact({ map_embed_url: e.target.value || null })}
            placeholder="https://www.google.com/maps/embed?pb=..."
          />
        </Field>
        <Field label={t("admin.footerFbEmbed")}>
          <TextInput
            value={footerContact.facebook_page_embed_url || ""}
            onChange={(e) => setFooterContact({ facebook_page_embed_url: e.target.value || null })}
            placeholder="https://www.facebook.com/plugins/page.php?href=..."
          />
        </Field>
        <div className="border-t border-surface-container-highest pt-4 flex flex-col gap-3">
          <label className="flex items-center gap-2 font-body text-body-md text-primary">
            <Checkbox
              checked={footerContact.floating_contact_enabled !== false}
              onChange={(e) => setFooterContact({ floating_contact_enabled: e.target.checked })}
            />
            {t("admin.footerFloatingContact")}
          </label>
          <p className="font-body text-body-sm text-secondary">{t("admin.footerFloatingContactHint")}</p>
          {footerContact.floating_contact_enabled !== false ? (
            <>
              <div className="flex flex-col gap-3">
                {(footerContact.floating_contact_links || []).map((link, index) => (
                  <div
                    key={`float-${index}`}
                    className="grid grid-cols-1 md:grid-cols-[minmax(140px,180px)_1fr_auto] gap-3 items-end border border-surface-container-highest p-3"
                  >
                    <Field label={t("admin.socialLinkIcon")}>
                      <Select
                        value={link.icon}
                        onChange={(e) =>
                          updateFloatingLink(index, { icon: e.target.value as FloatingContactIcon })
                        }
                      >
                        {FLOATING_CONTACT_ICONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {FLOATING_CONTACT_LABELS[icon]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("admin.socialLinkUrl")}>
                      <TextInput
                        value={link.url}
                        onChange={(e) => updateFloatingLink(index, { url: e.target.value })}
                        placeholder={
                          link.icon === "phone"
                            ? "tel:0834086256 or 0834 086 256"
                            : "https://"
                        }
                      />
                    </Field>
                    <SecondaryButton type="button" onClick={() => removeFloatingLink(index)}>
                      {t("admin.socialLinkRemove")}
                    </SecondaryButton>
                  </div>
                ))}
              </div>
              <SecondaryButton type="button" onClick={addFloatingLink}>
                {t("admin.floatingLinkAdd")}
              </SecondaryButton>
            </>
          ) : null}
        </div>
        <ImageField
          label={t("admin.footerRegBadge")}
          value={
            footerContact.registration_badge_media_id
              ? (mediaById.get(footerContact.registration_badge_media_id) as Media) || null
              : null
          }
          onChange={(m) => setFooterContact({ registration_badge_media_id: m ? m.id : null })}
        />
        <div className="border-t border-surface-container-highest pt-4 flex flex-col gap-3">
          <p className="font-label text-label-caps text-primary uppercase">{t("admin.footerBrandColumn")}</p>
          <p className="font-body text-body-sm text-secondary -mt-1">{t("admin.footerBrandColumnHint")}</p>
          <label className="flex items-center gap-2 font-body text-body-md text-primary">
            <Checkbox
              checked={footerContact.show_footer_brand !== false}
              onChange={(e) => setFooterContact({ show_footer_brand: e.target.checked })}
            />
            {t("admin.footerShowBrand")}
          </label>
          <label className="flex items-center gap-2 font-body text-body-md text-primary">
            <Checkbox
              checked={footerContact.show_footer_tagline !== false}
              onChange={(e) => setFooterContact({ show_footer_tagline: e.target.checked })}
            />
            {t("admin.footerShowTagline")}
          </label>
          <label className="flex items-center gap-2 font-body text-body-md text-primary">
            <Checkbox
              checked={footerContact.show_footer_contact_details !== false}
              onChange={(e) => setFooterContact({ show_footer_contact_details: e.target.checked })}
            />
            {t("admin.footerShowContactDetails")}
          </label>
          <label className="flex items-center gap-2 font-body text-body-md text-primary">
            <Checkbox
              checked={footerContact.show_footer_social_icons !== false}
              onChange={(e) => setFooterContact({ show_footer_social_icons: e.target.checked })}
            />
            {t("admin.footerShowSocialIcons")}
          </label>
          <label className="flex items-center gap-2 font-body text-body-md text-primary">
            <Checkbox
              checked={footerContact.show_footer_registration_badge !== false}
              onChange={(e) => setFooterContact({ show_footer_registration_badge: e.target.checked })}
            />
            {t("admin.footerShowRegBadge")}
          </label>
        </div>
        <div className="border-t border-surface-container-highest pt-4 flex flex-col gap-4">
          <p className="font-label text-label-caps text-primary uppercase">{t("admin.footerLayout")}</p>
          <Field label={t("admin.footerUsefulLinksTitle")}>
            <TextInput
              value={footerContact.useful_links_title || ""}
              onChange={(e) => setFooterContact({ useful_links_title: e.target.value || null })}
              placeholder={t("footer.usefulLinks")}
            />
          </Field>
          <ViInput
            label={t("admin.footerUsefulLinksTitle")}
            value={footerContact.useful_links_title_vi || ""}
            onChange={(e) => setFooterContact({ useful_links_title_vi: e.target.value || null })}
          />
          <Field label={t("admin.footerCategoriesTitle")}>
            <TextInput
              value={footerContact.categories_title || ""}
              onChange={(e) => setFooterContact({ categories_title: e.target.value || null })}
              placeholder={t("footer.productCategories")}
            />
          </Field>
          <ViInput
            label={t("admin.footerCategoriesTitle")}
            value={footerContact.categories_title_vi || ""}
            onChange={(e) => setFooterContact({ categories_title_vi: e.target.value || null })}
          />
          <Field label={t("admin.footerCopyright")}>
            <TextInput
              value={footerContact.copyright_text || ""}
              onChange={(e) => setFooterContact({ copyright_text: e.target.value || null })}
              placeholder={`© ${new Date().getFullYear()} ${draftValue.site_name}`}
            />
          </Field>
          <ViInput
            label={t("admin.footerCopyright")}
            value={footerContact.copyright_text_vi || ""}
            onChange={(e) => setFooterContact({ copyright_text_vi: e.target.value || null })}
          />
          <label className="flex items-center gap-2 font-body text-body-md text-primary">
            <Checkbox
              checked={footerContact.show_product_categories !== false}
              onChange={(e) => setFooterContact({ show_product_categories: e.target.checked })}
            />
            {t("admin.footerShowCategories")}
          </label>
          <Field label={t("admin.footerFollowTitle")}>
            <TextInput
              value={footerContact.follow_section_title || ""}
              onChange={(e) => setFooterContact({ follow_section_title: e.target.value || null })}
              placeholder={t("footer.followUs")}
            />
          </Field>
          <ViInput
            label={t("admin.footerFollowTitle")}
            value={footerContact.follow_section_title_vi || ""}
            onChange={(e) => setFooterContact({ follow_section_title_vi: e.target.value || null })}
          />
        </div>
        <div>
          <p className="font-label text-label-caps text-primary uppercase mb-1">{t("admin.socialLinks")}</p>
          <p className="font-body text-body-sm text-secondary mb-4">{t("admin.socialLinksHint")}</p>
          <div className="flex flex-col gap-3">
            {(footerContact.social_links || []).map((link, index) => (
              <div
                key={`social-${index}`}
                className="grid grid-cols-1 md:grid-cols-[minmax(140px,180px)_1fr_auto] gap-3 items-end border border-surface-container-highest p-3"
              >
                <Field label={t("admin.socialLinkIcon")}>
                  <Select
                    value={link.icon}
                    onChange={(e) => updateSocialLink(index, { icon: e.target.value as SocialNetwork })}
                  >
                    {SOCIAL_NETWORKS.map((network) => (
                      <option key={network} value={network}>
                        {SOCIAL_NETWORK_LABELS[network]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("admin.socialLinkUrl")}>
                  <TextInput
                    value={link.url}
                    onChange={(e) => updateSocialLink(index, { url: e.target.value })}
                    placeholder="https://"
                  />
                </Field>
                <SecondaryButton type="button" onClick={() => removeSocialLink(index)}>
                  {t("admin.socialLinkRemove")}
                </SecondaryButton>
              </div>
            ))}
          </div>
          <SecondaryButton type="button" className="mt-3" onClick={addSocialLink}>
            {t("admin.socialLinkAdd")}
          </SecondaryButton>
        </div>
      </div>

      <div className="border-t border-surface-container-highest pt-6 flex flex-col gap-4">
        <h4 className="font-headline text-headline-md text-primary uppercase">{t("admin.footerLinks")}</h4>
        <p className="font-body text-body-md text-secondary -mt-2">{t("admin.footerLinksHint")}</p>
        <div className="flex flex-col gap-4">
          {footerLinks.map((row, index) => {
            const preset = FOOTER_PRESET_LABELS[row.key as keyof typeof FOOTER_PRESET_LABELS];
            const presetTitle = preset ? `${preset.en} / ${preset.vi}` : row.key;
            return (
              <div
                key={row.key}
                className="border border-surface-container-highest p-4 flex flex-col gap-3"
              >
                <label className="flex items-center gap-2 font-body text-body-md text-primary">
                  <Checkbox
                    checked={row.enabled}
                    onChange={(e) => setFooterLink(index, { enabled: e.target.checked })}
                  />
                  <span className="font-label text-label-caps">{presetTitle}</span>
                </label>
                {row.enabled ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                    <Field label={t("admin.footerLinkLabelEn")}>
                      <TextInput
                        value={row.label || ""}
                        onChange={(e) => setFooterLink(index, { label: e.target.value || null })}
                        placeholder={preset?.en}
                      />
                    </Field>
                    <ViInput
                      label={t("admin.footerLinkLabelVi")}
                      value={row.label_vi || ""}
                      onChange={(e) => setFooterLink(index, { label_vi: e.target.value || null })}
                      placeholder={preset?.vi}
                    />
                    <Field label={t("admin.linkUrl")}>
                      <TextInput
                        value={row.url || ""}
                        onChange={(e) => setFooterLink(index, { url: e.target.value || null })}
                        placeholder={
                          row.key === "brand"
                            ? "/brand"
                            : row.key === "admin"
                              ? "/admin"
                              : "/pages/shipping-policy"
                        }
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            );
          })}
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
