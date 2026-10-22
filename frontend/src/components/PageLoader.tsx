import { useEffect, useState } from "react";

interface PageLoaderProps {
  visible: boolean;
  logoUrl?: string | null;
  siteName?: string | null;
}

export default function PageLoader({ visible, logoUrl, siteName }: PageLoaderProps) {
  const [mounted, setMounted] = useState(visible);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setHiding(false);
      return;
    }
    if (!mounted) return;
    setHiding(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setHiding(false);
    }, 450);
    return () => window.clearTimeout(t);
  }, [visible, mounted]);

  if (!mounted) return null;

  const label = siteName || "Loading";

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-surface-container-lowest transition-opacity duration-500 ease-out ${
        hiding ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
      aria-busy={!hiding}
    >
      <div className="flex flex-col items-center gap-6 px-8">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="h-14 sm:h-16 w-auto max-w-[min(280px,70vw)] object-contain motion-safe:animate-loader-logo"
          />
        ) : (
          <span className="font-display text-3xl sm:text-4xl font-extrabold text-primary tracking-tighter motion-safe:animate-loader-logo">
            {label}
          </span>
        )}
        <div className="h-0.5 w-24 bg-surface-container-high overflow-hidden rounded-full">
          <div className="h-full w-1/2 bg-forest-green motion-safe:animate-loader-bar" />
        </div>
      </div>
    </div>
  );
}
