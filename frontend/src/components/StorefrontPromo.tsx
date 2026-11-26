import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, tenantSlug } from "../api";
import { useLanguage } from "../i18n";
import type { SitePublic } from "../types";
import Icon from "./Icon";
import HomePromoPopup from "./HomePromoPopup";

export function popupSessionKey(site: SitePublic): string {
  const id =
    (site.home_popup_products?.length
      ? site.home_popup_products.map((p) => p.slug).join("|")
      : null) ||
    site.home_popup_image_url;
  return `inspo-home-popup:${tenantSlug()}:${id}`;
}

export function hasStorefrontPromo(site: SitePublic | undefined): boolean {
  if (!site?.home_popup_enabled) return false;
  return Boolean((site.home_popup_products?.length ?? 0) > 0 || site.home_popup_image_url);
}

type ModalProps = {
  site: SitePublic;
  open: boolean;
  onClose: () => void;
  recordSessionOnClose: boolean;
};

function HomePromoModal({ site, open, onClose, recordSessionOnClose }: ModalProps) {
  const { t } = useLanguage();
  const hasPromo = Boolean(site.home_popup_products?.length);
  const hasImage = Boolean(site.home_popup_image_url);

  function dismiss() {
    if (recordSessionOnClose) {
      sessionStorage.setItem(popupSessionKey(site), "1");
    }
    onClose();
  }

  if (!open) return null;

  if (hasPromo) {
    return <HomePromoPopup site={site} onDismiss={dismiss} />;
  }

  if (!hasImage) return null;

  const artwork = (
    <img
      src={site.home_popup_image_url!}
      alt=""
      className="w-full h-auto block rounded-md shadow-2xl ring-1 ring-white/10"
    />
  );
  const link = (site.home_popup_link || "").trim();

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={t("home.popup.aria")}
    >
      <button type="button" className="absolute inset-0 bg-charcoal/75 backdrop-blur-sm" onClick={dismiss} aria-hidden />
      <div className="relative z-10 w-full max-w-2xl sm:max-w-3xl">
        <button
          type="button"
          onClick={dismiss}
          className="absolute -top-2 -right-2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-lg hover:scale-105 transition-transform"
          aria-label={t("home.popup.close")}
        >
          <Icon name="close" className="text-[22px]" />
        </button>
        {link ? (
          <a href={link} className="block" onClick={dismiss}>
            {artwork}
          </a>
        ) : (
          artwork
        )}
      </div>
    </div>
  );
}

/** Auto popup on first home visit + floating badge to reopen on any page. */
export default function StorefrontPromo() {
  const { lang, t } = useLanguage();
  const location = useLocation();
  const { data: site } = useQuery({
    queryKey: ["site", lang],
    queryFn: () => api.getSite(lang),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);
  const [openedByUser, setOpenedByUser] = useState(false);

  const active = hasStorefrontPromo(site);

  useEffect(() => {
    if (!active || !site) return;
    if (location.pathname !== "/") return;
    if (sessionStorage.getItem(popupSessionKey(site))) return;
    setOpenedByUser(false);
    setOpen(true);
  }, [active, site, location.pathname]);

  function openFromFab() {
    setOpenedByUser(true);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  if (!active || !site) return null;

  return (
    <>
      <HomePromoModal site={site} open={open} onClose={closeModal} recordSessionOnClose={!openedByUser} />
      <button
        type="button"
        onClick={openFromFab}
        className="fixed bottom-6 left-4 z-[480] sm:bottom-8 sm:left-6 flex items-center gap-2 pl-2 pr-4 py-2 rounded-full bg-[#0B241E] text-[#D4FF3B] shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all border border-[#D4FF3B]/40 group"
        aria-label={t("home.promo.fabAria")}
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#D4FF3B] text-[#0B241E]">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D4FF3B] opacity-40" />
          <Icon name="local_offer" className="text-[20px] relative" />
        </span>
        <span className="font-headline text-xs sm:text-sm uppercase tracking-wide text-left leading-tight">
          {t("home.promo.badge")}
        </span>
      </button>
    </>
  );
}