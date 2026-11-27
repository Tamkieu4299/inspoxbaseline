import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n";

export type AdminTab =
  | "products"
  | "collections"
  | "media"
  | "home"
  | "brand"
  | "pages"
  | "journal"
  | "quizzes"
  | "categories"
  | "nav"
  | "site"
  | "orders"
  | "analytics"
  | "auctions"
  | "users";

type NavItem = { tab: AdminTab; icon: string; labelKey: string };
type NavGroup = { labelKey: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "admin.hub.content",
    items: [
      { tab: "home", icon: "home", labelKey: "admin.tab.homepage" },
      { tab: "brand", icon: "auto_stories", labelKey: "admin.tab.brand" },
    ],
  },
  {
    labelKey: "admin.hub.catalog",
    items: [
      { tab: "products", icon: "inventory_2", labelKey: "admin.tab.products" },
      { tab: "collections", icon: "category", labelKey: "admin.tab.collections" },
      { tab: "categories", icon: "sell", labelKey: "admin.tab.categories" },
    ],
  },
  {
    labelKey: "admin.hub.assets",
    items: [{ tab: "media", icon: "perm_media", labelKey: "admin.tab.media" }],
  },
  {
    labelKey: "admin.hub.editorial",
    items: [
      { tab: "journal", icon: "menu_book", labelKey: "admin.tab.journal" },
      { tab: "pages", icon: "newspaper", labelKey: "admin.tab.pages" },
      { tab: "quizzes", icon: "tune", labelKey: "admin.tab.quizzes" },
      { tab: "nav", icon: "menu", labelKey: "admin.tab.nav" },
    ],
  },
  {
    labelKey: "admin.hub.system",
    items: [
      { tab: "orders", icon: "receipt_long", labelKey: "admin.tab.orders" },
      { tab: "analytics", icon: "monitoring", labelKey: "admin.tab.analytics" },
      { tab: "auctions", icon: "gavel", labelKey: "admin.tab.auctions" },
      { tab: "site", icon: "settings", labelKey: "admin.tab.site" },
      { tab: "users", icon: "group", labelKey: "admin.tab.users" },
    ],
  },
];

function navGroups(isSuperAdmin: boolean): NavGroup[] {
  if (isSuperAdmin) return NAV_GROUPS;
  return NAV_GROUPS.map((g) =>
    g.labelKey === "admin.hub.system"
      ? { ...g, items: g.items.filter((i) => i.tab !== "users") }
      : g,
  );
}

function AdminNavList({
  groups,
  tab,
  onSelect,
  t,
}: {
  groups: NavGroup[];
  tab: AdminTab;
  onSelect: (tab: AdminTab) => void;
  t: (k: string) => string;
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.labelKey}>
          <p className="px-2 mb-2 font-label text-[10px] text-muted uppercase tracking-[0.14em]">
            {t(group.labelKey)}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = tab === item.tab;
              return (
                <li key={item.tab}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.tab)}
                    className={`w-full flex items-center gap-3 px-3 py-3 min-h-[44px] text-left transition-colors rounded-sm ${
                      active
                        ? "bg-forest-green text-white"
                        : "text-secondary hover:bg-surface-container-low hover:text-charcoal"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[22px] ${active ? "text-white" : "text-forest-green"}`}
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                    <span className="font-label text-label-caps uppercase">{t(item.labelKey)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

const SCREEN_SUBTITLE: Record<AdminTab, string> = {
  home: "admin.screen.home",
  products: "admin.screen.products",
  collections: "admin.screen.collections",
  categories: "admin.screen.categories",
  media: "admin.screen.media",
  brand: "admin.screen.brand",
  pages: "admin.screen.pages",
  journal: "admin.screen.journal",
  quizzes: "admin.screen.quizzes",
  nav: "admin.screen.nav",
  site: "admin.screen.site",
  orders: "admin.screen.orders",
  analytics: "admin.screen.analytics",
  auctions: "admin.screen.auctions",
  users: "admin.screen.users",
};

export function AdminPageHeader({ tab }: { tab: AdminTab }) {
  const { t } = useLanguage();
  const tabLabel =
    NAV_GROUPS.flatMap((g) => g.items).find((i) => i.tab === tab)?.labelKey ?? "admin.tab.homepage";
  return (
    <header className="mb-6 border-b border-surface-container-high pb-4">
      <p className="font-label text-label-caps text-forest-green uppercase tracking-widest mb-1">
        {t("admin.hub.suite")}
      </p>
      <h1 className="font-editorial text-2xl md:text-3xl text-charcoal tracking-tight">{t(tabLabel)}</h1>
      <p className="font-body text-body-md text-muted mt-1 max-w-3xl">{t(SCREEN_SUBTITLE[tab])}</p>
    </header>
  );
}

export function AdminAuthFrame({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#f3f3f4] font-body text-body-md flex items-stretch">
      <aside className="hidden lg:flex w-[min(420px,38vw)] bg-forest-green text-white flex-col justify-between p-10">
        <div>
          <p className="font-label text-label-caps opacity-80 uppercase tracking-widest">INSPO</p>
          <h1 className="font-editorial text-4xl mt-3 leading-tight">{title}</h1>
          {subtitle ? <p className="mt-4 text-white/80 text-sm leading-relaxed max-w-sm">{subtitle}</p> : null}
        </div>
        <p className="font-label text-label-caps text-white/50 uppercase text-xs tracking-widest">
          INSPO · HQ Admin Suite
        </p>
      </aside>
      <div className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div
          className={`w-full bg-white border border-surface-container-highest shadow-sm p-8 ${
            wide ? "max-w-2xl" : "max-w-md"
          }`}
        >
          <div className="lg:hidden mb-6">
            <p className="font-label text-label-caps text-forest-green uppercase tracking-widest">{title}</p>
            {subtitle ? <p className="text-secondary text-sm mt-2">{subtitle}</p> : null}
          </div>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}

export default function AdminShell({
  tenant,
  tab,
  onTabChange,
  onSwitchStore,
  onLogout,
  isSuperAdmin = false,
  children,
}: {
  tenant: string;
  tab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onSwitchStore: () => void;
  onLogout: () => void;
  isSuperAdmin?: boolean;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const groups = navGroups(isSuperAdmin);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeLabel =
    groups.flatMap((g) => g.items).find((i) => i.tab === tab)?.labelKey ?? "admin.tab.homepage";

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  function selectTab(next: AdminTab) {
    onTabChange(next);
    setMobileNavOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#f3f3f4] font-body text-body-md text-charcoal flex overflow-x-hidden">
      <aside className="hidden md:flex w-64 lg:w-72 shrink-0 flex-col bg-white border-r border-surface-container-high sticky top-0 h-screen z-30 overflow-hidden">
        <div className="px-5 py-5 border-b border-surface-container-high">
          <Link to="/" className="font-display text-xl tracking-tighter uppercase text-charcoal block">
            INSPO
          </Link>
          <p className="font-label text-label-caps text-muted uppercase mt-1">{t("admin.hub.suite")}</p>
          <span className="inline-block mt-2 font-label text-label-caps uppercase bg-forest-green/10 text-forest-green px-2 py-0.5">
            {tenant}
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-5">
          <AdminNavList groups={groups} tab={tab} onSelect={onTabChange} t={t} />
        </nav>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal aria-label={t("admin.mobileMenu")}>
          <button
            type="button"
            className="absolute inset-0 bg-charcoal/50"
            onClick={() => setMobileNavOpen(false)}
            aria-label={t("admin.closeMenu")}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[min(300px,88vw)] bg-white shadow-xl flex flex-col pt-[env(safe-area-inset-top)]">
            <div className="px-4 py-4 border-b border-surface-container-high flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-lg uppercase text-charcoal truncate">INSPO</p>
                <span className="font-label text-[10px] uppercase bg-forest-green/10 text-forest-green px-2 py-0.5">
                  {tenant}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="w-11 h-11 flex items-center justify-center rounded hover:bg-surface-container-low shrink-0"
                aria-label={t("admin.closeMenu")}
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-5">
              <AdminNavList groups={groups} tab={tab} onSelect={selectTab} t={t} />
            </nav>
            <div className="border-t border-surface-container-high p-4 flex flex-col gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  onSwitchStore();
                }}
                className="w-full min-h-[44px] font-label text-label-caps uppercase text-secondary"
              >
                {t("admin.switchStore")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  onLogout();
                }}
                className="w-full min-h-[44px] font-label text-label-caps uppercase text-secondary"
              >
                {t("admin.logout")}
              </button>
              <Link
                to="/"
                onClick={() => setMobileNavOpen(false)}
                className="w-full min-h-[44px] flex items-center justify-center font-label text-label-caps text-white bg-charcoal uppercase"
              >
                {t("admin.viewStore")}
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex-1 flex flex-col min-w-0 w-0 max-w-[100vw]">
        <header className="shrink-0 bg-white border-b border-surface-container-high z-20">
          <div className="md:hidden px-3 pt-[env(safe-area-inset-top)]">
            <div className="flex items-center gap-2 min-h-14">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded hover:bg-surface-container-low"
                aria-label={t("admin.openMenu")}
              >
                <span className="material-symbols-outlined text-[26px] text-charcoal">menu</span>
              </button>
              <p className="flex-1 min-w-0 font-label text-label-caps uppercase text-charcoal truncate">
                {t(activeLabel)}
              </p>
              <Link
                to="/"
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded bg-charcoal text-white"
                aria-label={t("admin.viewStore")}
              >
                <span className="material-symbols-outlined text-[22px]">storefront</span>
              </Link>
            </div>
          </div>
          <div className="hidden md:flex h-14 px-6 items-center justify-between gap-4">
            <p className="font-label text-label-caps text-muted uppercase truncate">
              {t("admin.contentAdmin")}
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onSwitchStore}
                className="font-label text-label-caps text-secondary hover:text-forest-green uppercase min-h-[44px] px-1"
              >
                {t("admin.switchStore")}
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="font-label text-label-caps text-secondary hover:text-forest-green uppercase min-h-[44px] px-1"
              >
                {t("admin.logout")}
              </button>
              <Link
                to="/"
                className="font-label text-label-caps text-white bg-charcoal hover:bg-forest-green px-3 py-2 uppercase transition-colors min-h-[44px] flex items-center"
              >
                {t("admin.viewStore")}
              </Link>
            </div>
          </div>
        </header>

        <main
          className={`flex-1 overflow-x-auto overflow-y-auto w-full min-w-0 ${
            tab === "products" || tab === "media" || tab === "journal" || tab === "home"
              ? "p-0"
              : "max-w-[1600px] mx-auto px-4 md:px-8 py-6 lg:py-8"
          }`}
        >
          {tab !== "products" && tab !== "media" && tab !== "journal" && tab !== "home" && (
            <AdminPageHeader tab={tab} />
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export { NAV_GROUPS };
