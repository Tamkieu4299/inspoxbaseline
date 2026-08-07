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
  "bg-white border border-surface-container-highest px-3 py-2 font-body text-body-md text-on-background outline-none focus:border-forest-green";

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
  "inline-flex items-center justify-center gap-2 px-4 py-2 font-label text-label-caps uppercase transition-colors focus:outline-none";

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
