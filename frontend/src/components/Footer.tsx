import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useLanguage } from "../i18n";
import type { FooterLinkPublic } from "../types";

function FooterLinkItem({ label, url }: FooterLinkPublic) {
  const className =
    "font-body text-body-md text-secondary hover:text-forest-green transition-colors w-fit";
  if (!url) {
    return <span className={className}>{label}</span>;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return (
      <a href={url} className={className} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }
  return (
    <Link to={url} className={className}>
      {label}
    </Link>
  );
}

export default function Footer() {
  const { lang, t } = useLanguage();
  const { data: site } = useQuery({
    queryKey: ["site", lang],
    queryFn: () => api.getSite(lang),
    staleTime: 60_000,
  });
  const footerTagline = site?.footer_tagline?.trim() || t("footer.tagline");
  const footerLinks = site?.footer_links ?? [];
  const mid = Math.ceil(footerLinks.length / 2);
  const colA = footerLinks.slice(0, mid);
  const colB = footerLinks.slice(mid);

  return (
    <footer className="bg-surface-container-lowest w-full border-t border-outline-variant mt-16">
      <div className="grid grid-cols-12 gap-6 px-4 sm:px-8 py-12 sm:py-16 w-full max-w-[1440px] mx-auto">
        <div className="col-span-12 md:col-span-6 flex flex-col justify-between mb-8 md:mb-0">
          {site?.logo_url ? (
            <Link to="/" className="h-10 w-fit mb-6">
              <img src={site.logo_url} alt={site.site_name} className="h-full w-auto object-contain" />
            </Link>
          ) : (
            <Link
              to="/"
              className="font-display text-3xl font-extrabold text-primary mb-6 tracking-tighter hover:text-forest-green transition-colors w-fit"
            >
              {site?.site_name || "INSPO"}
            </Link>
          )}
          <div className="font-body text-body-md text-secondary mt-auto">
            © 2026 {site?.site_name || "INSPO"}. {footerTagline}
          </div>
        </div>
        {footerLinks.length > 0 ? (
          <div className="col-span-12 md:col-span-6 grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              {colA.map((link, index) => (
                <FooterLinkItem key={`${link.label}-${index}`} {...link} />
              ))}
            </div>
            <div className="flex flex-col gap-4">
              {colB.map((link, index) => (
                <FooterLinkItem key={`${link.label}-b-${index}`} {...link} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
