import type { ReactNode } from "react";

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="font-label text-label-caps text-secondary uppercase">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "bg-white border border-surface-container-highest px-3 py-2.5 min-h-[44px] text-base sm:text-sm font-body text-on-background outline-none focus:border-forest-green rounded-sm";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className || ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className || ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className || ""}`} />;
}

export function Checkbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      {...props}
      className={`form-checkbox bg-white border-surface-container-highest text-forest-green focus:ring-forest-green h-4 w-4 ${props.className || ""}`}
    />
  );
}

export function ColorField({
  label,
  value,
  onChange,
  clearLabel = "CLEAR",
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  clearLabel?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label text-label-caps text-secondary uppercase">{label}</span>
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer border border-surface-container-highest bg-white p-1"
        />
        <TextInput
          value={value || ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="flex-1 min-w-[5rem]"
        />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="font-label text-label-caps text-error hover:underline uppercase shrink-0"
        >
          {clearLabel}
        </button>
      </div>
    </label>
  );
}

export function ViInput({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label text-label-caps text-forest-green uppercase">VI · {label}</span>
      <TextInput {...props} />
    </label>
  );
}

export function ViArea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label text-label-caps text-forest-green uppercase">VI · {label}</span>
      <TextArea {...props} />
    </label>
  );
}

const btnBase =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] font-label text-label-caps uppercase transition-colors focus:outline-none rounded-sm";

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`${btnBase} bg-forest-green text-white hover:bg-inverse-surface ${props.className || ""}`}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${btnBase} bg-transparent border border-primary text-primary hover:bg-surface-container-low ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${btnBase} bg-transparent border border-error text-error hover:bg-error hover:text-on-error ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

export function AdminPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-surface-container-highest shadow-sm ${className}`}>{children}</div>
  );
}

export function AdminKpiStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">{children}</div>
  );
}

export function AdminKpiCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneCls = {
    neutral: "text-charcoal",
    success: "text-success",
    warning: "text-warning",
    danger: "text-status-danger",
  }[tone];
  return (
    <div className="bg-white border border-surface-container-highest p-4">
      <p className="font-label text-[10px] text-muted uppercase tracking-[0.12em]">{label}</p>
      <p className={`font-display text-2xl mt-1 tabular-nums ${toneCls}`}>{value}</p>
      {hint ? <p className="text-xs text-muted mt-1">{hint}</p> : null}
    </div>
  );
}

export function AdminModule({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-surface-container-high bg-surface-container-lowest rounded-lg p-4 md:p-5 ${className}`}
    >
      <h4 className="font-label text-label-caps text-charcoal uppercase mb-4 tracking-wider">{title}</h4>
      {children}
    </section>
  );
}

/** Standard width + spacing for list/settings tabs (header comes from AdminShell). */
export function AdminPage({
  children,
  className = "",
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-6 w-full min-w-0 pb-6 ${wide ? "max-w-6xl" : "max-w-4xl"} ${className}`}
    >
      {children}
    </div>
  );
}

/** Fixed save bar when a tab has unsaved draft (Site, Brand, etc.). */
export function AdminStickySaveBar({
  visible,
  saveLabel,
  discardLabel,
  onSave,
  onDiscard,
  saving,
  hint,
}: {
  visible: boolean;
  saveLabel: string;
  discardLabel?: string;
  onSave: () => void;
  onDiscard?: () => void;
  saving?: boolean;
  hint?: string;
}) {
  if (!visible) return null;
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:left-64 lg:left-72 border-t border-surface-container-high bg-white/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-live="polite"
    >
      <p className="font-body text-sm text-secondary sm:max-w-[50%]">{hint}</p>
      <div className="flex flex-wrap gap-2 justify-end shrink-0">
        {onDiscard && discardLabel ? (
          <SecondaryButton type="button" onClick={onDiscard} disabled={saving}>
            {discardLabel}
          </SecondaryButton>
        ) : null}
        <PrimaryButton type="button" onClick={onSave} disabled={saving}>
          {saving ? "…" : saveLabel}
        </PrimaryButton>
      </div>
    </div>
  );
}
