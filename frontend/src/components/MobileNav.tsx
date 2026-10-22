import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import Icon from "./Icon";
import { useLanguage } from "../i18n";

export interface MobileNavLink {
  key: string;
  label: string;
  to: string;
  children?: { label: string; to: string }[];
}

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  links: MobileNavLink[];
  categoriesActive: boolean;
  collectionsActive: boolean;
  pathname: string;
}

export default function MobileNav({
  open,
  onClose,
  links,
  categoriesActive,
  collectionsActive,
  pathname,
}: MobileNavProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setExpanded(null);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close drawer when route changes
  }, [pathname]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label={t("nav.menu")}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={t("nav.closeMenu")}
        onClick={onClose}
      />
      <div className="absolute top-0 right-0 h-full w-full max-w-sm bg-surface-container-lowest border-l border-outline-variant shadow-xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-4 h-16 border-b border-outline-variant shrink-0">
          <span className="font-label text-label-caps uppercase text-primary">{t("nav.menu")}</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 text-primary hover:text-forest-green"
            aria-label={t("nav.closeMenu")}
          >
            <Icon name="close" className="text-[26px]" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
          {links.map((link) =>
            link.children && link.children.length > 0 ? (
              <div key={link.key} className="border-b border-outline-variant/60">
                <button
                  type="button"
                  onClick={() => setExpanded((k) => (k === link.key ? null : link.key))}
                  className="w-full flex items-center justify-between gap-2 px-3 py-3.5 font-label text-label-caps text-left text-primary uppercase"
                >
                  {link.label}
                  <Icon
                    name={expanded === link.key ? "expand_less" : "expand_more"}
                    className="text-[22px] shrink-0"
                  />
                </button>
                {expanded === link.key ? (
                  <div className="pb-2 pl-2">
                    <NavLink
                      to={link.to}
                      onClick={onClose}
                      className={() =>
                        `block px-3 py-2.5 font-label text-label-caps text-sm uppercase ${
                          categoriesActive ? "text-forest-green font-bold" : "text-secondary"
                        }`
                      }
                    >
                      {t("collection.all")}
                    </NavLink>
                    {link.children.map((child) => (
                      <Link
                        key={child.to}
                        to={child.to}
                        onClick={onClose}
                        className="block px-3 py-2.5 font-body text-body-md text-secondary hover:text-forest-green"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <NavLink
                key={link.key}
                to={link.to}
                onClick={onClose}
                className={() => {
                  const active =
                    link.to === "/collections"
                      ? collectionsActive
                      : link.to === pathname || (link.to !== "/" && pathname.startsWith(link.to));
                  return `block px-3 py-3.5 font-label text-label-caps uppercase border-b border-outline-variant/60 ${
                    active ? "text-forest-green font-bold" : "text-primary"
                  }`;
                }}
              >
                {link.label}
              </NavLink>
            )
          )}
        </nav>
      </div>
    </div>
  );
}
