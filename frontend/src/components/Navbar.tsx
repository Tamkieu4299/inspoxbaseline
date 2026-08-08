import { Link, NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import Icon from "./Icon";
import { useLanguage } from "../i18n";
import type { NavItem } from "../types";

interface BuiltLink {
  key: string;
  label: string;
  to: string;
  children?: { label: string; to: string }[];
}

function isCategoryView(pathname: string, search: string): boolean {
  return (
    pathname === "/products" &&
    Boolean(new URLSearchParams(search).get("category"))
  );
}

export default function Navbar() {
  const { lang, setLang, t } = useLanguage();
  const { data: pages } = useQuery({
    queryKey: ["nav-pages", lang],
    queryFn: () => api.getPages(lang),
    staleTime: 60_000,
  });
  const { data: categories } = useQuery({
    queryKey: ["nav-categories", lang],
    queryFn: () => api.getCategories(lang),
    staleTime: 60_000,
  });
  const { data: site } = useQuery({
    queryKey: ["site"],
    queryFn: api.getSite,
    staleTime: 60_000,
  });

  const pageBySlug = new Map((pages || []).map((p) => [p.slug, p]));

  function buildItem(item: NavItem): BuiltLink | null {
    switch (item.type) {
      case "home":
        return { key: "home", label: t("nav.home"), to: "/" };
      case "collections":
        return { key: "collections", label: t("nav.collections"), to: "/collections" };
      case "new_arrivals":
        return { key: "new_arrivals", label: t("nav.newArrivals"), to: "/collections/new-arrivals" };
      case "brand":
        return { key: "brand", label: t("nav.brand"), to: "/brand" };
      case "categories":
        return {
          key: "categories",
          label: t("nav.categories"),
          to: "/collections",
          children: (categories || []).map((c) => ({
            label: c.name,
            to: `/products?category=${c.slug}`,
          })),
        };
      case "page": {
        const page = item.ref ? pageBySlug.get(item.ref) : undefined;
        if (!page) return null;
        return {
          key: `page:${page.slug}`,
          label: page.nav_label || page.title,
          to: page.slug === "blogs" ? "/blogs" : `/pages/${page.slug}`,
        };
      }
      default:
        return null;
    }
  }

  let links: BuiltLink[] = [];
  const configured = (site?.nav_items || []).filter((i) => i.enabled);
  if (configured.length > 0) {
    links = configured
      .map(buildItem)
      .filter((l): l is BuiltLink => l !== null);
  } else {
    const fallback: NavItem[] = [
      { type: "home", enabled: true },
      ...(pages || []).map((p) => ({ type: "page" as const, ref: p.slug, enabled: true })),
      { type: "new_arrivals", enabled: true },
      { type: "collections", enabled: true },
      { type: "categories", enabled: true },
      { type: "brand", enabled: true },
    ];
    links = fallback.map(buildItem).filter((l): l is BuiltLink => l !== null);
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `font-label text-label-caps px-3 py-2 transition-all duration-150 ${
      isActive
        ? "text-forest-green border-b-2 border-forest-green"
        : "text-secondary hover:text-forest-green hover:bg-surface-container-low"
    }`;

  const location = useLocation();

  const collectionsActive = location.pathname === "/collections";
  const categoriesActive = isCategoryView(location.pathname, location.search);

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
          {links.map((link) =>
            link.children && link.children.length > 0 ? (
              <div key={link.key} className="relative group">
                <NavLink
                  to={link.to}
                  className={() => `${linkClass({ isActive: categoriesActive })} flex items-center gap-1`}
                >
                  {link.label} <Icon name="expand_more" className="text-[16px] leading-none" />
                </NavLink>
                <div className="absolute left-0 top-full pt-2 hidden group-hover:block z-50">
                  <div className="bg-surface-container-lowest border border-outline-variant shadow-lg min-w-[200px] py-2">
                    {link.children.map((child) => (
                      <Link
                        key={child.to}
                        to={child.to}
                        className="block px-4 py-2 font-label text-label-caps text-secondary hover:text-forest-green hover:bg-surface-container-low transition-colors"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <NavLink
                key={link.key}
                to={link.to}
                className={() =>
                  `${linkClass({
                    isActive: link.to === "/collections" ? collectionsActive : location.pathname === link.to,
                  })} inline-block`
                }
              >
                {link.label}
              </NavLink>
            )
          )}
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
        </div>
      </div>
    </header>
  );
}
