import type { ReactNode } from "react";

export const studioInputClass =
  "w-full px-4 py-3 bg-surface-container-low rounded text-on-surface font-body text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary transition-all";

export function StudioModule({
  n,
  title,
  subtitle,
  badge,
  action,
  children,
}: {
  n: string;
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 lg:p-8 shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between pb-2 border-b border-surface-container gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-label text-label-caps shrink-0">
            {n}
          </span>
          <div className="min-w-0">
            <h2 className="font-headline text-headline-md text-primary uppercase tracking-tight">{title}</h2>
            {subtitle ? (
              <p className="font-label text-label-caps text-secondary uppercase mt-0.5 tracking-wider text-xs">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {badge ? (
          <span className="font-label text-label-caps px-2.5 py-1 rounded bg-surface-container-low text-on-surface uppercase text-xs">
            {badge}
          </span>
        ) : null}
        {action}
      </div>
      {children}
    </div>
  );
}

export function StudioToggle({
  label,
  sublabel,
  checked,
  onChange,
}: {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="p-3 rounded bg-surface-container-low flex items-center justify-between gap-3 text-left w-full hover:bg-surface-container transition-colors"
    >
      <div className="flex flex-col">
        <span className="font-label text-label-caps text-[11px] text-primary uppercase font-bold">{label}</span>
        {sublabel ? <span className="font-body text-[11px] text-secondary">{sublabel}</span> : null}
      </div>
      <div
        className={`w-12 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors ${
          checked ? "bg-forest-green justify-end" : "bg-surface-container-highest justify-start"
        }`}
      >
        <div className="w-5 h-5 bg-white rounded-full shadow-sm" />
      </div>
    </button>
  );
}
