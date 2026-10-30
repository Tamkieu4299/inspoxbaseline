import type { FooterContactConfig, FooterFloatingLink, FooterSocialLink } from "./types";

export const SOCIAL_NETWORKS = [
  "facebook",
  "instagram",
  "youtube",
  "tiktok",
  "zalo",
  "threads",
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const FLOATING_CONTACT_ICONS = ["zalo", "messenger", "phone"] as const;

export type FloatingContactIcon = (typeof FLOATING_CONTACT_ICONS)[number];

export const FLOATING_CONTACT_LABELS: Record<FloatingContactIcon, string> = {
  zalo: "Zalo",
  messenger: "Messenger",
  phone: "Hotline / gọi điện",
};

export const SOCIAL_NETWORK_LABELS: Record<SocialNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  zalo: "Zalo",
  threads: "Threads",
};

function normalizePhoneHref(urlOrPhone: string): string {
  const raw = urlOrPhone.trim();
  if (!raw) return "";
  if (raw.toLowerCase().startsWith("tel:")) return raw;
  return phoneTelHref(raw);
}

function normalizeFloatingContactLinks(
  raw: FooterContactConfig,
  socialLinks: FooterSocialLink[]
): FooterFloatingLink[] {
  const links = raw.floating_contact_links;
  if (Array.isArray(links) && links.length > 0) {
    return links
      .map((item) => ({
        icon: (item.icon || "").toLowerCase() as FloatingContactIcon,
        url: (item.url || "").trim(),
      }))
      .filter((item) => FLOATING_CONTACT_ICONS.includes(item.icon as FloatingContactIcon) && item.url)
      .map((item) =>
        item.icon === "phone" ? { ...item, url: normalizePhoneHref(item.url) || item.url } : item
      );
  }
  const out: FooterFloatingLink[] = [];
  const zaloSocial = socialLinks.find((l) => l.icon === "zalo")?.url;
  const zalo =
    zaloSocial ||
    (raw.phone?.trim() ? `https://zalo.me/${raw.phone.replace(/\D/g, "")}` : "");
  if (zalo) out.push({ icon: "zalo", url: zalo });
  const messenger = raw.messenger_url?.trim();
  if (messenger) out.push({ icon: "messenger", url: messenger });
  if (raw.phone?.trim()) {
    const tel = normalizePhoneHref(raw.phone);
    if (tel) out.push({ icon: "phone", url: tel });
  }
  return out;
}

function normalizeSocialLinks(raw: FooterContactConfig): FooterSocialLink[] {
  const links = raw.social_links;
  if (Array.isArray(links) && links.length > 0) {
    return links
      .map((item) => ({
        icon: (item.icon || "").toLowerCase() as SocialNetwork,
        url: (item.url || "").trim(),
      }))
      .filter((item) => SOCIAL_NETWORKS.includes(item.icon) && item.url);
  }
  const legacy = raw.social;
  if (!legacy) return [];
  return SOCIAL_NETWORKS.filter((icon) => legacy[icon]?.trim()).map((icon) => ({
    icon,
    url: legacy[icon]!.trim(),
  }));
}

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
    registration_badge_url: null,
    useful_links_title: null,
    useful_links_title_vi: null,
    categories_title: null,
    categories_title_vi: null,
    copyright_text: null,
    copyright_text_vi: null,
    show_product_categories: true,
    follow_section_title: null,
    follow_section_title_vi: null,
    floating_contact_enabled: true,
    floating_contact_links: [],
    show_footer_brand: true,
    show_footer_tagline: true,
    show_footer_contact_details: true,
    show_footer_social_icons: true,
    show_footer_registration_badge: true,
    social_links: [],
  };
}

export function normalizeFooterContact(raw: FooterContactConfig | null | undefined): FooterContactConfig {
  const base = defaultFooterContact();
  if (!raw) return base;
  const merged = { ...base, ...raw };
  const social_links = normalizeSocialLinks(merged);
  return {
    ...merged,
    social_links,
    floating_contact_links: normalizeFloatingContactLinks(merged, social_links),
  };
}

export function phoneTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? `tel:${digits}` : `tel:${digits.replace(/^0/, "+84")}`;
}
