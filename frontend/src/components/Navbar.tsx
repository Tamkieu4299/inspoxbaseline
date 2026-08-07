import { Link, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import Icon from "./Icon";
import { useLanguage } from "../i18n";

export default function Navbar() {
  const { lang, setLang, t } = useLanguage();
  const { data: pages } = useQuery({
    queryKey: ["nav-pages", lang],
    queryFn: () => api.getPages(lang),
    staleTime: 60_000,
  });
  const { data: site } = useQuery({
    queryKey: ["site"],
    queryFn: api.getSite,
    staleTime: 60_000,
  });
  const STATIC_LINKS = [
    { label: t("nav.collections"), to: "/collections" },
    { label: t("nav.newArrivals"), to: "/collections/new-arrivals" },
    { label: t("nav.brand"), to: "/brand" },
  ];
  const pageLinks = (pages || []).map((p) => ({
    label: p.nav_label || p.title,
    to: p.slug === "blogs" ? "/blogs" : `/pages/${p.slug}`,
  }));
  const links = [...STATIC_LINKS, ...pageLinks];

  return (
    <header className="bg-surface-container-lowest fixed top-0 w-full z-50 border-b border-outline-variant">
      <div className="flex justify-between items-center w-full px-8 h-20 max-w-[1440px] mx-auto">
        {site?.logo_url ? (
          <Link to="/" className="h-10 w-fit shrink-0">
            <img src={site.logo_url} alt={site.site_name} className="h-full w-auto object-contain" />
          </Link>
        ) : (
          <Link
            to="/"
            className="font-display text-display-lg text-primary tracking-tighter hover:text-forest-green transition-colors"
          >
            INSPO
          </Link>
        )}
        <nav className="hidden md:flex space-x-6 items-center">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `font-label text-label-caps px-3 py-2 transition-all duration-150 ${
                  isActive
                    ? "text-forest-green border-b-2 border-forest-green"
                    : "text-secondary hover:text-forest-green hover:bg-surface-container-low"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center space-x-6 text-primary">
          <button
            aria-label={t("nav.search")}
            className="hover:bg-surface-container-low hover:text-forest-green transition-all duration-150 p-2 focus:outline-none focus:ring-1 focus:ring-forest-green"
          >
            <Icon name="search" />
          </button>
          <button
            onClick={() => setLang(lang === "en" ? "vi" : "en")}
            aria-label="Language"
            title="EN / VI"
            className="font-label text-label-caps border border-outline-variant px-2 py-1 hover:bg-surface-container-low hover:text-forest-green transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-forest-green"
          >
            {lang === "en" ? "VI" : "EN"}
          </button>
          <Link
            to="/admin"
            aria-label={t("nav.admin")}
            className="hover:bg-surface-container-low hover:text-forest-green transition-all duration-150 p-2 focus:outline-none focus:ring-1 focus:ring-forest-green"
          >
            <Icon name="person" />
          </Link>
        </div>
      </div>
    </header>
  );
}
