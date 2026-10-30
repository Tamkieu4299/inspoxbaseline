import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { SOCIAL_NETWORKS, phoneTelHref } from "../footerContact";
import { useLanguage } from "../i18n";
import Icon from "./Icon";
import RevealOnScroll from "./RevealOnScroll";
import SocialIconLink from "./SocialIconLink";
import type { FooterLinkPublic } from "../types";
import { navCategories } from "../categoryNav";

function FooterLinkItem({ label, url }: FooterLinkPublic) {
  const className =
    "font-body text-body-sm text-secondary hover:text-forest-green transition-colors flex items-start gap-2";
  const dot = <span className="mt-2 w-1.5 h-1.5 rounded-full bg-forest-green shrink-0" aria-hidden />;
  const text = <span>{label}</span>;
  if (!url) {
    return (
      <li className={className}>
        {dot}
        {text}
      </li>
    );
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return (
      <li>
        <a href={url} className={className} target="_blank" rel="noopener noreferrer">
          {dot}
          {text}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link to={url} className={className}>
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
  return (
    <>
      <details open={defaultOpen} className="group lg:[&>summary]:hidden">
        <summary className="font-headline text-headline-md text-primary uppercase mb-4 cursor-pointer list-none flex items-center justify-between lg:cursor-default">
          {title}
          <Icon name="expand_more" className="lg:hidden group-open:rotate-180 transition-transform" />
        </summary>
        <div className="pb-6 lg:pb-0">{children}</div>
      </details>
    </>
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
      <Icon name={icon} className="text-primary text-[22px] shrink-0 mt-0.5" />
      <span className="font-body text-body-sm text-secondary whitespace-pre-line">{children}</span>
    </>
  );
  const rowClass = "flex gap-3 items-start";
  if (href) {
    return (
      <a href={href} className={`${rowClass} hover:text-forest-green`}>
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
  const footerLinks = site?.footer_links ?? [];
  const contact = site?.footer_contact;
  const categoryNav = navCategories(categories);
  const socialEntries = SOCIAL_NETWORKS.filter((n) => contact?.social?.[n]);

  const hasContactBlock =
    contact &&
    (contact.phone ||
      contact.email ||
      contact.address ||
      contact.business_registration ||
      contact.showroom_note ||
      contact.opening_hours ||
      socialEntries.length > 0);

  return (
    <footer className="bg-surface-container-lowest w-full border-t border-outline-variant mt-16">
      <RevealOnScroll className="px-4 sm:px-8 py-12 sm:py-16 w-full max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* Brand + contact */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {site?.logo_url ? (
              <Link to="/" className="h-12 w-fit">
                <img src={site.logo_url} alt={site.site_name} className="h-full w-auto object-contain" />
              </Link>
            ) : (
              <Link
                to="/"
                className="font-display text-3xl font-extrabold text-primary tracking-tighter hover:text-forest-green transition-colors w-fit"
              >
                {site?.site_name || "INSPO"}
              </Link>
            )}
            <p className="font-body text-body-sm text-secondary leading-relaxed max-w-md">{footerTagline}</p>

            {hasContactBlock ? (
              <div className="flex flex-col gap-4">
                {contact?.phone ? (
                  <ContactRow icon="call" href={phoneTelHref(contact.phone)}>
                    {contact.phone}
                  </ContactRow>
                ) : null}
                {contact?.address ? (
                  <ContactRow icon="location_on">{contact.address}</ContactRow>
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

            {socialEntries.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {socialEntries.map((network) => (
                  <SocialIconLink key={network} network={network} href={contact!.social![network]!} />
                ))}
              </div>
            ) : null}

            {contact?.registration_badge_url ? (
              <img
                src={contact.registration_badge_url}
                alt=""
                className="h-14 w-auto object-contain mt-2"
                loading="lazy"
              />
            ) : null}
          </div>

          {/* Useful links */}
          {footerLinks.length > 0 ? (
            <div className="lg:col-span-3">
              <FooterColumn title={contact?.useful_links_title || t("footer.usefulLinks")}>
                <ul className="flex flex-col gap-3">
                  {footerLinks.map((link, index) => (
                    <FooterLinkItem key={`${link.label}-${index}`} {...link} />
                  ))}
                </ul>
              </FooterColumn>
            </div>
          ) : null}

          {/* Categories + embeds */}
          <div className={`lg:col-span-4 flex flex-col gap-8 ${footerLinks.length === 0 ? "lg:col-start-6" : ""}`}>
            {contact?.show_product_categories !== false && categoryNav.length > 0 ? (
              <FooterColumn title={contact?.categories_title || t("footer.productCategories")}>
                <ul className="flex flex-col gap-3">
                  {categoryNav.map((cat) => (
                    <li key={cat.id}>
                      <Link
                        to={`/products?category=${cat.slug}`}
                        className="font-body text-body-sm text-secondary hover:text-forest-green transition-colors flex items-start gap-2"
                      >
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-forest-green shrink-0" aria-hidden />
                        {cat.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </FooterColumn>
            ) : null}

            {contact?.facebook_page_embed_url ? (
              <div className="w-full max-w-[340px] overflow-hidden rounded-sm border border-outline-variant">
                <iframe
                  title={t("footer.facebookEmbed")}
                  src={contact.facebook_page_embed_url}
                  width="340"
                  height="130"
                  className="w-full max-w-full border-0"
                  loading="lazy"
                  scrolling="no"
                  allow="encrypted-media"
                />
              </div>
            ) : null}

            {contact?.map_embed_url ? (
              <div className="w-full max-w-[400px] aspect-[4/3] overflow-hidden rounded-sm border border-outline-variant">
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
        </div>

        <div className="font-body text-body-sm text-secondary mt-12 pt-8 border-t border-outline-variant">
          {contact?.copyright_line?.trim() ||
            `© ${new Date().getFullYear()} ${site?.site_name || "INSPO"}.`}
        </div>
      </RevealOnScroll>
    </footer>
  );
}
