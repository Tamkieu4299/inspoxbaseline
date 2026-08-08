import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useLanguage } from "../i18n";

export default function Footer() {
  const { t } = useLanguage();
  const { data: site } = useQuery({ queryKey: ["site"], queryFn: api.getSite, staleTime: 60_000 });
  return (
    <footer className="bg-surface-container-lowest w-full border-t border-outline-variant mt-16">
      <div className="grid grid-cols-12 gap-6 px-8 py-16 w-full max-w-[1440px] mx-auto">
        <div className="col-span-12 md:col-span-6 flex flex-col justify-between mb-8 md:mb-0">
          {site?.logo_url ? (
            <Link to="/" className="h-10 w-fit mb-6">
              <img src={site.logo_url} alt={site.site_name} className="h-full w-auto object-contain" />
            </Link>
          ) : (
            <Link to="/" className="font-display text-3xl font-extrabold text-primary mb-6 tracking-tighter hover:text-forest-green transition-colors w-fit">
              {site?.site_name || "INSPO"}
            </Link>
          )}
          <div className="font-body text-body-md text-secondary mt-auto">
            © 2026 {site?.site_name || "INSPO"}. {t("footer.tagline")}
          </div>
        </div>
        <div className="col-span-12 md:col-span-6 grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <span className="font-body text-body-md text-secondary hover:text-forest-green transition-colors w-fit cursor-pointer">{t("footer.privacy")}</span>
            <span className="font-body text-body-md text-secondary hover:text-forest-green transition-colors w-fit cursor-pointer">{t("footer.terms")}</span>
            <span className="font-body text-body-md text-secondary hover:text-forest-green transition-colors w-fit cursor-pointer">{t("footer.shipping")}</span>
          </div>
          <div className="flex flex-col gap-4">
            <Link to="/brand" className="font-body text-body-md text-secondary hover:text-forest-green transition-colors w-fit">{t("footer.brandExperience")}</Link>
            <Link to="/admin" className="font-body text-body-md text-secondary hover:text-forest-green transition-colors w-fit">{t("footer.admin")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
