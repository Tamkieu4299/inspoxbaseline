import type { FooterContactConfig } from "./types";

export const SOCIAL_NETWORKS = [
  "facebook",
  "instagram",
  "threads",
  "youtube",
  "tiktok",
  "zalo",
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export function defaultFooterContact(): FooterContactConfig {
  return {
    phone: null,
    email: null,
    address: null,
    address_vi: null,
    business_registration: null,
    business_registration_vi: null,
    showroom_note: null,
    showroom_note_vi: null,
    opening_hours: null,
    opening_hours_vi: null,
    map_embed_url: null,
    facebook_page_embed_url: null,
    registration_badge_media_id: null,
    useful_links_title: null,
    useful_links_title_vi: null,
    categories_title: null,
    categories_title_vi: null,
    copyright_text: null,
    copyright_text_vi: null,
    show_product_categories: true,
    follow_section_title: null,
    follow_section_title_vi: null,
    social: {
      facebook: null,
      instagram: null,
      threads: null,
      youtube: null,
      tiktok: null,
      zalo: null,
    },
  };
}

export function normalizeFooterContact(raw: FooterContactConfig | null | undefined): FooterContactConfig {
  const base = defaultFooterContact();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    social: { ...base.social, ...(raw.social || {}) },
  };
}

export function phoneTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? `tel:${digits}` : `tel:${digits.replace(/^0/, "+84")}`;
}
