import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

interface RevealOnScrollProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms */
  delay?: number;
  /** Skip motion (e.g. hero above the fold) */
  immediate?: boolean;
  /** Remount animation when this value changes (e.g. quiz step id) */
  resetKey?: string | number;
  as?: ElementType;
}

export default function RevealOnScroll({
  children,
  className = "",
  delay = 0,
  immediate = false,
  resetKey,
  as: Tag = "div",
}: RevealOnScrollProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(immediate);

  useEffect(() => {
    if (immediate) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -5% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate, resetKey]);

  const motionClass = visible
    ? "opacity-100 translate-y-0"
    : "opacity-0 translate-y-8 motion-reduce:opacity-100 motion-reduce:translate-y-0";

  return (
    <Tag
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${motionClass} ${className}`}
      style={visible ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
