import { tenantSlug } from "../api";

const VISITOR_PREFIX = "inspo_visitor_";
const SESSION_KEY = "inspo_session";
const FLUSH_INTERVAL_MS = 4000;
const MAX_QUEUE = 24;

export type AnalyticsEventName =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "search";

type QueuedEvent = {
  event: AnalyticsEventName;
  path: string;
  product_slug?: string;
  visitor_key: string;
  session_key: string;
  referrer?: string;
};

let queue: QueuedEvent[] = [];
let flushTimer: number | null = null;

function randomKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `v${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getVisitorKey(): string {
  const tenant = tenantSlug();
  const storageKey = `${VISITOR_PREFIX}${tenant}`;
  try {
    let v = localStorage.getItem(storageKey);
    if (!v || v.length < 8) {
      v = randomKey();
      localStorage.setItem(storageKey, v);
    }
    return v;
  } catch {
    return randomKey();
  }
}

export function getSessionKey(): string {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s || s.length < 8) {
      s = randomKey();
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return randomKey();
  }
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushAnalytics();
  }, FLUSH_INTERVAL_MS);
}

export function enqueueAnalytics(
  event: AnalyticsEventName,
  opts?: { path?: string; productSlug?: string },
) {
  if (typeof window === "undefined") return;
  const path = opts?.path ?? `${window.location.pathname}${window.location.search}`;
  const row: QueuedEvent = {
    event,
    path,
    visitor_key: getVisitorKey(),
    session_key: getSessionKey(),
    referrer: document.referrer || undefined,
  };
  if (opts?.productSlug) row.product_slug = opts.productSlug;
  queue.push(row);
  if (queue.length >= MAX_QUEUE) {
    void flushAnalytics();
    return;
  }
  scheduleFlush();
}

async function flushAnalytics() {
  if (!queue.length) return;
  const batch = queue.splice(0, MAX_QUEUE);
  const API_BASE = import.meta.env.VITE_API_URL || "";
  try {
    await fetch(`${API_BASE}/api/analytics/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant": tenantSlug(),
      },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    queue.unshift(...batch);
  }
}

export function trackPageView(path: string) {
  enqueueAnalytics("page_view", { path });
}

export function trackProductView(slug: string, path?: string) {
  const key = `inspo_pv_${slug}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* sessionStorage unavailable */
  }
  enqueueAnalytics("product_view", { path, productSlug: slug });
}

export function trackAddToCart(slug: string) {
  enqueueAnalytics("add_to_cart", { productSlug: slug });
}

export function trackCheckoutStart() {
  enqueueAnalytics("checkout_start", { path: "/checkout" });
}

export function trackSearch(query: string) {
  enqueueAnalytics("search", { path: `/search?q=${encodeURIComponent(query)}` });
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushAnalytics();
  });
  window.addEventListener("pagehide", () => void flushAnalytics());
}