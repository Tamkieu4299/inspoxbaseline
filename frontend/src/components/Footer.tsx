import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { phoneTelHref } from "../footerContact";
import type { SocialNetwork } from "../footerContact";
import { isLightColor, resolveFooterColors } from "../footerTheme";
import { useLanguage } from "../i18n";
import Icon from "./Icon";
import RevealOnScroll from "./RevealOnScroll";
import SocialIconLink, { SocialIconsRow } from "./SocialIconLink";
import type { FooterLinkPublic } from "../types";
import { navCategories } from "../categoryNav";

function FooterLinkItem({ label, url }: FooterLinkPublic) {
  const href = (url || "").trim();
  if (!href) return null;
  const className =
    "footer-link font-body text-body-sm text-inherit opacity-90 hover:opacity-100 transition-opacity flex items-start gap-2";
  const dot = (
    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-current opacity-90 shrink-0" aria-hidden />
  );
  const text = <span>{label}</span>;
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <li>
        <a href={href} className={className} target="_blank" rel="noopener noreferrer">
          {dot}
          {text}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link to={href} className={className}>
        {dot}
        {text}
      </Link>
    </li>
  );
}

function FooterColumn({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const titleClass = "font-headline text-headline-md uppercase mb-2 text-inherit";
  return (
    <div>
      <h3 className={`hidden lg:block ${titleClass}`}>{title}</h3>
      <details open={defaultOpen} className="group lg:[&>summary]:hidden">
        <summary
          className={`${titleClass} cursor-pointer list-none flex items-center justify-between lg:cursor-default`}
        >
          {title}
          <Icon name="expand_more" className="lg:hidden group-open:rotate-180 transition-transform text-inherit" />
        </summary>
        <div className="pb-4 lg:pb-0">{children}</div>
      </details>
    </div>
  );
}

function ContactRow({
  icon,
  children,
  href,
}: {
  icon: string;
  children: ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <Icon name={icon} className="text-inherit text-[20px] shrink-0 mt-0.5 opacity-90" />
      <span className="font-body text-body-sm text-inherit opacity-90 whitespace-pre-line">{children}</span>
    </>
  );
  const rowClass = "flex gap-2.5 items-start hover:opacity-100 opacity-90 transition-opacity";
  if (href) {
    return (
      <a href={href} className={rowClass}>
        {inner}
      </a>
    );
  }
  return <div className={rowClass}>{inner}</div>;
}

export default function Footer() {
  const { lang, t } = useLanguage();
  const { data: site } = useQuery({
    queryKey: ["site", lang],
    queryFn: () => api.getSite(lang),
    staleTime: 60_000,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories", lang],
    queryFn: () => api.getCategories(lang),
    staleTime: 60_000,
  });

  const footerTagline = site?.footer_tagline?.trim() || t("footer.tagline");
  const footerLinks = (site?.footer_links ?? []).filter((link) => (link.url || "").trim());
  const contact = site?.footer_contact;
  const categoryNav = navCategories(categories);
  const socialEntries = contact?.social_links ?? [];

  const showBrand = contact?.show_footer_brand !== false;
  const showTagline = contact?.show_footer_tagline !== false;
  const showContactDetails = contact?.show_footer_contact_details !== false;
  const showSocialIcons = contact?.show_footer_social_icons !== false;
  const showRegBadge = contact?.show_footer_registration_badge !== false;

  const hasContactDetails =
    contact &&
    (contact.phone ||
      contact.email ||
      contact.address ||
      contact.business_registration ||
      contact.showroom_note ||
      contact.opening_hours);

  const showBrandColumn =
    showBrand ||
    (showTagline && !!footerTagline) ||
    (showContactDetails && hasContactDetails) ||
    (showSocialIcons && socialEntries.length > 0) ||
    (showRegBadge && !!contact?.registration_badge_url);

  const colors = resolveFooterColors(site?.footer_background_color, site?.footer_text_color);
  const embedFrameClass = isLightColor(colors.background)
    ? "border border-outline-variant bg-surface-container-lowest"
    : "border border-white/20 bg-white";

  const footerStyle: CSSProperties = {
    backgroundColor: colors.background,
    color: colors.text,
    borderTopColor: colors.border,
  };

  return (
    <footer className="w-full border-t mt-10" style={footerStyle}>
      <RevealOnScroll className="px-4 sm:px-8 lg:px-stack-xl py-8 sm:py-10 w-full max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-gutter">
          {showBrandColumn ? (
            <div className="lg:col-span-5 flex flex-col gap-3">
              {showBrand ? (
                site?.logo_url ? (
                  <Link to="/" className="h-10 w-fit">
                    <img src={site.logo_url} alt={site.site_name} className="h-full w-auto object-contain" />
                  </Link>
                ) : (
                  <Link
                    to="/"
                    className="font-display text-[28px] sm:text-[32px] font-extrabold text-inherit tracking-tighter opacity-100 hover:opacity-90 transition-opacity w-fit"
                  >
                    {site?.site_name || "INSPO"}
                  </Link>
                )
              ) : null}
              {showTagline ? (
                <p className="font-body text-body-sm text-inherit opacity-90 leading-snug max-w-md">{footerTagline}</p>
              ) : null}

              {showContactDetails && hasContactDetails ? (
                <div className="flex flex-col gap-2.5">
                  {contact?.phone ? (
                    <ContactRow icon="call" href={phoneTelHref(contact.phone)}>
                      {contact.phone}
                    </ContactRow>
                  ) : null}
                  {contact?.address ? (
                    <ContactRow
                      icon="location_on"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`}
                    >
                      {contact.address}
                    </ContactRow>
                  ) : null}
                  {contact?.business_registration ? (
                    <ContactRow icon="badge">{contact.business_registration}</ContactRow>
                  ) : null}
                  {contact?.showroom_note ? (
                    <ContactRow icon="storefront">{contact.showroom_note}</ContactRow>
                  ) : null}
                  {contact?.email ? (
                    <ContactRow icon="mail" href={`mailto:${contact.email}`}>
                      {contact.email}
                    </ContactRow>
                  ) : null}
                  {contact?.opening_hours ? (
                    <ContactRow icon="schedule">{contact.opening_hours}</ContactRow>
                  ) : null}
                </div>
              ) : null}

              {showSocialIcons && socialEntries.length > 0 ? (
                <SocialIconsRow>
                  {socialEntries.map((link, index) => (
                    <SocialIconLink
                      key={`${link.icon}-${index}`}
                      network={link.icon as SocialNetwork}
                      href={link.url}
                      onDark={colors.socialOnDark}
                    />
                  ))}
                </SocialIconsRow>
              ) : null}

              {showRegBadge && contact?.registration_badge_url ? (
                <img
                  src={contact.registration_badge_url}
                  alt=""
                  className="h-11 w-auto object-contain mt-1"
                  loading="lazy"
                />
              ) : null}
            </div>
          ) : null}

          {footerLinks.length > 0 ? (
            <div className="lg:col-span-3">
              <FooterColumn title={contact?.useful_links_title || t("footer.usefulLinks")}>
                <ul className="flex flex-col gap-2">
                  {footerLinks.map((link, index) => (
                    <FooterLinkItem key={`${link.label}-${index}`} {...link} />
                  ))}
                </ul>
              </FooterColumn>
            </div>
          ) : null}

          <div
            className={`lg:col-span-4 flex flex-col gap-5 ${
              footerLinks.length === 0 && !showBrandColumn
                ? "lg:col-start-1"
                : footerLinks.length === 0
                  ? "lg:col-start-6"
                  : ""
            }`}
          >
            {contact?.show_product_categories !== false && categoryNav.length > 0 ? (
              <FooterColumn title={contact?.categories_title || t("footer.productCategories")}>
                <ul className="flex flex-col gap-2">
                  {categoryNav.map((cat) => (
                    <li key={cat.id}>
                      <Link
                        to={`/products?category=${cat.slug}`}
                        className="font-body text-body-sm text-inherit opacity-90 hover:opacity-100 transition-opacity flex items-start gap-2"
                      >
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden />
                        {cat.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </FooterColumn>
            ) : null}

            {contact?.facebook_page_embed_url || contact?.map_embed_url ? (
              <FooterColumn title={contact?.follow_section_title || t("footer.followUs")} defaultOpen>
                <div className="flex flex-col gap-3">
                  {contact?.facebook_page_embed_url ? (
                    <div className={`w-full max-w-[300px] overflow-hidden rounded-sm ${embedFrameClass}`}>
                      <iframe
                        title={t("footer.facebookEmbed")}
                        src={contact.facebook_page_embed_url}
                        width="300"
                        height="110"
                        className="w-full max-w-full border-0"
                        loading="lazy"
                        scrolling="no"
                        allow="encrypted-media"
                      />
                    </div>
                  ) : null}
                  {contact?.map_embed_url ? (
                    <div className={`w-full max-w-[280px] h-[160px] overflow-hidden rounded-sm ${embedFrameClass}`}>
                      <iframe
                        title={t("footer.mapEmbed")}
                        src={contact.map_embed_url}
                        className="w-full h-full border-0"
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  ) : null}
                </div>
              </FooterColumn>
            ) : null}
          </div>
        </div>

        <div
          className="font-body text-body-sm text-inherit opacity-80 mt-6 pt-4 border-t"
          style={{ borderColor: colors.border }}
        >
          {contact?.copyright_line?.trim() ||
            `© ${new Date().getFullYear()} ${site?.site_name || "INSPO"}.`}
        </div>
      </RevealOnScroll>
    </footer>
  );
}
