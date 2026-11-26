import { useEffect, useState } from "react";
import { tenantSlug } from "../api";
import { useLanguage } from "../i18n";
import type { SitePublic } from "../types";
import Icon from "./Icon";
import HomePromoPopup from "./HomePromoPopup";

function popupSessionKey(site: SitePublic): string {
  const id =
    (site.home_popup_products?.length
      ? site.home_popup_products.map((p) => p.slug).join("|")
      : null) ||
  site.home_popup_image_url;
  return `inspo-home-popup:${tenantSlug()}:${id}`;
}

type Props = {
  site: SitePublic | undefined;
};

/** Promotional modal — once per browser session on the homepage only. */
export default function HomeWelcomePopup({ site }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const hasPromo = Boolean(site?.home_popup_enabled && site?.home_popup_products?.length);
  const hasImage = Boolean(site?.home_popup_enabled && site?.home_popup_image_url);

  useEffect(() => {
    if (!site?.home_popup_enabled) return;
    if (!hasPromo && !hasImage) return;
    if (sessionStorage.getItem(popupSessionKey(site))) return;
    setOpen(true);
  }, [site, hasPromo, hasImage]);

  function dismiss() {
    if (site) {
      sessionStorage.setItem(popupSessionKey(site), "1");
    }
    setOpen(false);
  }

  if (!open || !site) return null;

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
      className="fixed inset-0 z-[85] flex items-center justify-center px-4 py-8 home-promo-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t("home.popup.aria")}
    >
      <button
        type="button"
        className="absolute inset-0 bg-charcoal/75 backdrop-blur-sm home-promo-fade-in"
        onClick={dismiss}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-2xl sm:max-w-3xl home-promo-panel">
        <button
          type="button"
          onClick={dismiss}
          className="absolute -top-2 -right-2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-lg hover:scale-105 transition-transform"
          aria-label={t("home.popup.close")}
        >
          <Icon name="close" className="text-[22px]" />
        </button>
        {link ? (
          <a href={link} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={dismiss}>
            {artwork}
          </a>
        ) : (
          artwork
        )}
      </div>
      <style>{`
        @keyframes home-promo-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes home-promo-panel-in {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .home-promo-fade-in { animation: home-promo-fade-in 0.35s ease-out both; }
        .home-promo-panel { animation: home-promo-panel-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>
    </div>
  );
}