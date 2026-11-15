import { Link } from "react-router-dom";

export type ServicePackageFeature = {
  icon?: string;
  title?: string;
};

export type ServicePackageData = {
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

function FeatureGrid({
  label,
  items,
}: {
  label?: string;
  items?: ServicePackageFeature[];
}) {
  if (!items?.length) return null;
  return (
    <div className="rounded-lg border border-white/15 bg-black/20 p-4 sm:p-5 space-y-3">
      {label ? (
        <p className="font-label text-label-caps text-center text-baseline-accent tracking-widest">{label}</p>
      ) : null}
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
        {items.map((f, i) => (
          <li key={i} className="flex flex-col items-center text-center gap-2 px-1">
            <span className="material-symbols-outlined text-baseline-accent text-[28px] leading-none" aria-hidden>
              {f.icon || "check_circle"}
            </span>
            <p className="font-label text-[10px] sm:text-[11px] uppercase leading-snug text-inverse-on-surface/90">
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
  const outer = compact
    ? "w-full max-w-xl"
    : "w-full max-w-2xl mx-auto";

  return (
    <article
      className={`${outer} rounded-xl border border-surface-container-highest bg-charcoal text-inverse-on-surface shadow-sm overflow-hidden`}
    >
      <div className="p-5 sm:p-7 md:p-8 flex flex-col gap-5 sm:gap-6">
        <header className="text-center space-y-2 border-b border-white/10 pb-5">
          {d.kicker ? (
            <>
              <div className="h-px w-12 bg-white/30 mx-auto" aria-hidden />
              <p className="font-label text-label-caps tracking-[0.25em] text-inverse-on-surface/90 pt-1">{d.kicker}</p>
              <div className="h-px w-12 bg-white/30 mx-auto" aria-hidden />
            </>
          ) : null}
          {d.est ? <p className="font-label text-[10px] uppercase tracking-widest text-inverse-on-surface/50">{d.est}</p> : null}
          {d.title ? (
            <h2 className="font-headline text-headline-md sm:text-[2rem] uppercase tracking-tight text-white pt-1">
              {d.title}
            </h2>
          ) : null}
          {d.tagline ? <p className="font-body text-body-sm sm:text-body-md text-inverse-on-surface/85">{d.tagline}</p> : null}
          {d.price ? (
            <p className="font-headline text-2xl sm:text-3xl text-baseline-accent tracking-tight pt-2">{d.price}</p>
          ) : null}
          {d.price_note ? (
            <p className="font-label text-[11px] uppercase tracking-wide text-inverse-on-surface/60">{d.price_note}</p>
          ) : null}
        </header>

        <FeatureGrid label={d.includes_label} items={d.includes} />
        <FeatureGrid label={d.guarantees_label} items={d.guarantees} />

        {d.cta_url ? (
          <div className="rounded-lg border border-white/15 bg-black/25 p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
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
                <p className="font-label text-[11px] uppercase tracking-wide text-inverse-on-surface/80 leading-snug">
                  {d.cta_hint}
                </p>
              ) : null}
              <Link
                to={d.cta_url}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-baseline-accent text-charcoal font-label text-label-caps uppercase hover:brightness-110 transition"
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
          <footer className="font-body text-[11px] sm:text-xs italic text-inverse-on-surface/55 leading-relaxed whitespace-pre-line border-t border-white/10 pt-4">
            {d.footer}
          </footer>
        ) : null}
      </div>
    </article>
  );
}