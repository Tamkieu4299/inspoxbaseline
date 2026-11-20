import type { ReactNode } from "react";

/** Blinking red “on air” indicator for live auction sessions. */
export function AuctionLiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative flex h-2.5 w-2.5 shrink-0 ${className}`} aria-hidden>
      <span className="motion-safe:animate-auction-live-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600 motion-safe:animate-auction-live-dot" />
    </span>
  );
}

type AuctionLiveBadgeProps = {
  label: string;
  size?: "sm" | "md";
  className?: string;
};

export function AuctionLiveBadge({ label, size = "md", className = "" }: AuctionLiveBadgeProps) {
  const text = size === "sm" ? "text-[10px] tracking-wider" : "text-xs tracking-widest";
  return (
    <span
      className={`auction-live-badge inline-flex items-center gap-2 border border-red-500/40 bg-red-50/90 px-2.5 py-1 text-red-700 font-label text-label-caps uppercase motion-safe:animate-auction-live-shimmer-bg ${text} ${className}`}
    >
      <AuctionLiveDot />
      <span>{label}</span>
    </span>
  );
}

export function AuctionLiveCardGlow({
  active = true,
  className = "",
  children,
}: {
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${active ? "motion-safe:animate-auction-live-border" : ""} ${className}`}>{children}</div>
  );
}