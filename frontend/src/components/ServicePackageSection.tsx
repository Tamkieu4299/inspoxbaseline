import { Link } from "react-router-dom";

export type ServicePackageFeature = {
  icon?: string;
  title?: string;
};

export type ServicePackageTheme = "baseline-dark" | "light" | "forest" | "minimal";

export type ServicePackageData = {
  theme?: ServicePackageTheme | string;
  kicker?: string;
  est?: string;
  title?: string;
  tagline?: string;
  price?: string;
  price_note?: string;
  includes_label?: string;
  includes?: ServicePackageFeature[];
  guarantees_label?: string;
  guarantees?: ServicePackageFeature[];
  cta_hint?: string;
  cta_label?: string;
  cta_url?: string;
  qr_url?: string;
  footer?: string;
};

type ThemeTokens = {
  article: string;
  headerBorder: string;
  rule: string;
  kicker: string;
  est: string;
  title: string;
  tagline: string;
  accent: string;
  priceNote: string;
  panel: string;
  panelLabel: string;
  icon: string;
  featureText: string;
  ctaPanel: string;
  ctaHint: string;
  ctaBtn: string;
  footer: string;
};

export const SERVICE_PACKAGE_THEMES: Record<ServicePackageTheme, ThemeTokens> = {
  "baseline-dark": {
    article: "bg-charcoal text-inverse-on-surface border-surface-container-highest",
    headerBorder: "border-white/10",
    rule: "bg-white/30",
    kicker: "text-inverse-on-surface/90",
    est: "text-inverse-on-surface/50",
    title: "text-white",
    tagline: "text-inverse-on-surface/85",
    accent: "text-baseline-accent",
    priceNote: "text-inverse-on-surface/60",
    panel: "border-white/15 bg-black/20",
    panelLabel: "text-baseline-accent",
    icon: "text-baseline-accent",
    featureText: "text-inverse-on-surface/90",
    ctaPanel: "border-white/15 bg-black/25",
    ctaHint: "text-inverse-on-surface/80",
    ctaBtn: "bg-baseline-accent text-charcoal hover:brightness-110",
    footer: "text-inverse-on-surface/55 border-white/10",
  },
  light: {
    article: "bg-surface-container-lowest text-on-background border-surface-container-high",
    headerBorder: "border-surface-container-high",
    rule: "bg-surface-container-highest",
    kicker: "text-secondary",
    est: "text-muted",
    title: "text-primary",
    tagline: "text-secondary",
    accent: "text-forest-green",
    priceNote: "text-secondary",
    panel: "border-surface-container-high bg-surface-container-low",
    panelLabel: "text-forest-green",
    icon: "text-forest-green",
    featureText: "text-on-background",
    ctaPanel: "border-surface-container-high bg-surface-container-low",
    ctaHint: "text-secondary",
    ctaBtn: "bg-primary text-on-primary hover:bg-forest-green",
    footer: "text-muted border-surface-container-high",
  },
  forest: {
    article: "bg-forest-green text-white border-forest-green",
    headerBorder: "border-white/20",
    rule: "bg-white/40",
    kicker: "text-white/90",
    est: "text-white/60",
    title: "text-white",
    tagline: "text-white/85",
    accent: "text-white",
    priceNote: "text-white/70",
    panel: "border-white/25 bg-black/15",
    panelLabel: "text-white",
    icon: "text-white",
    featureText: "text-white/90",
    ctaPanel: "border-white/25 bg-black/20",
    ctaHint: "text-white/85",
    ctaBtn: "bg-white text-forest-green hover:bg-surface-container-lowest",
    footer: "text-white/65 border-white/20",
  },
  minimal: {
    article: "bg-background text-on-background border-surface-container-highest",
    headerBorder: "border-surface-container-high",
    rule: "bg-outline-variant",
    kicker: "text-secondary",
    est: "text-muted",
    title: "text-primary",
    tagline: "text-secondary",
    accent: "text-primary",
    priceNote: "text-secondary",
    panel: "border-surface-container-highest bg-transparent",
    panelLabel: "text-primary",
    icon: "text-forest-green",
    featureText: "text-secondary",
    ctaPanel: "border-surface-container-highest bg-transparent",
    ctaHint: "text-secondary",
    ctaBtn: "bg-forest-green text-white hover:bg-inverse-surface",
    footer: "text-muted border-surface-container-high",
  },
};

function resolveTheme(raw?: string): ThemeTokens {
  const key = (raw || "baseline-dark") as ServicePackageTheme;
  return SERVICE_PACKAGE_THEMES[key] ?? SERVICE_PACKAGE_THEMES["baseline-dark"];
}

function FeatureGrid({
  label,
  items,
  theme,
}: {
  label?: string;
  items?: ServicePackageFeature[];
  theme: ThemeTokens;
}) {
  if (!items?.length) return null;
  return (
    <div className={`rounded-lg border p-4 sm:p-5 space-y-3 ${theme.panel}`}>
      {label ? (
        <p className={`font-label text-label-caps text-center tracking-widest ${theme.panelLabel}`}>{label}</p>
      ) : null}
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
        {items.map((f, i) => (
          <li key={i} className="flex flex-col items-center text-center gap-2 px-1">
            <span className={`material-symbols-outlined text-[28px] leading-none ${theme.icon}`} aria-hidden>
              {f.icon || "check_circle"}
            </span>
            <p className={`font-label text-[10px] sm:text-[11px] uppercase leading-snug ${theme.featureText}`}>
              {f.title || ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ServicePackageSection({
  data,
  compact = false,
}: {
  data: ServicePackageData;
  compact?: boolean;
}) {
  const d = data;
  const theme = resolveTheme(d.theme);
  const outer = compact ? "w-full max-w-xl" : "w-full max-w-2xl mx-auto";

  return (
    <article className={`${outer} rounded-xl border shadow-sm overflow-hidden ${theme.article}`}>
      <div className="p-5 sm:p-7 md:p-8 flex flex-col gap-5 sm:gap-6">
        <header className={`text-center space-y-2 border-b pb-5 ${theme.headerBorder}`}>
          {d.kicker ? (
            <>
              <div className={`h-px w-12 mx-auto ${theme.rule}`} aria-hidden />
              <p className={`font-label text-label-caps tracking-[0.25em] pt-1 ${theme.kicker}`}>{d.kicker}</p>
              <div className={`h-px w-12 mx-auto ${theme.rule}`} aria-hidden />
            </>
          ) : null}
          {d.est ? <p className={`font-label text-[10px] uppercase tracking-widest ${theme.est}`}>{d.est}</p> : null}
          {d.title ? (
            <h2 className={`font-headline text-headline-md sm:text-[2rem] uppercase tracking-tight pt-1 ${theme.title}`}>
              {d.title}
            </h2>
          ) : null}
          {d.tagline ? (
            <p className={`font-body text-body-sm sm:text-body-md ${theme.tagline}`}>{d.tagline}</p>
          ) : null}
          {d.price ? (
            <p className={`font-headline text-2xl sm:text-3xl tracking-tight pt-2 ${theme.accent}`}>{d.price}</p>
          ) : null}
          {d.price_note ? (
            <p className={`font-label text-[11px] uppercase tracking-wide ${theme.priceNote}`}>{d.price_note}</p>
          ) : null}
        </header>

        <FeatureGrid label={d.includes_label} items={d.includes} theme={theme} />
        <FeatureGrid label={d.guarantees_label} items={d.guarantees} theme={theme} />

        {d.cta_url ? (
          <div className={`rounded-lg border p-4 flex flex-col sm:flex-row gap-4 sm:items-center ${theme.ctaPanel}`}>
            {d.qr_url ? (
              <img
                src={d.qr_url}
                alt=""
                className="w-[88px] h-[88px] shrink-0 bg-white rounded-md object-contain mx-auto sm:mx-0"
                loading="lazy"
              />
            ) : null}
            <div className="flex-1 text-center sm:text-left space-y-2">
              {d.cta_hint ? (
                <p className={`font-label text-[11px] uppercase tracking-wide leading-snug ${theme.ctaHint}`}>
                  {d.cta_hint}
                </p>
              ) : null}
              <Link
                to={d.cta_url}
                className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md font-label text-label-caps uppercase transition ${theme.ctaBtn}`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  open_in_new
                </span>
                {d.cta_label || "Learn more"}
              </Link>
            </div>
          </div>
        ) : null}

        {d.footer ? (
          <footer
            className={`font-body text-[11px] sm:text-xs italic leading-relaxed whitespace-pre-line border-t pt-4 ${theme.footer}`}
          >
            {d.footer}
          </footer>
        ) : null}
      </div>
    </article>
  );
}