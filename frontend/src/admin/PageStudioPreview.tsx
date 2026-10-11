import { useState } from "react";
import { Link } from "react-router-dom";
import type { Media, Page } from "../types";
import { useLanguage } from "../i18n";

export function PageStudioPreview({
  draft,
  mediaById,
}: {
  draft: Partial<Page>;
  mediaById: Map<number, Media>;
}) {
  const { t } = useLanguage();
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const hero = draft.hero_image_id ? mediaById.get(draft.hero_image_id) : null;
  const blockCount = draft.blocks?.length ?? 0;
  const slug = draft.slug?.trim();

  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col gap-4 sticky top-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          <span className="font-label text-label-caps uppercase text-primary font-bold tracking-wider text-xs">
            {t("admin.pagesStudio.liveViewport")}
          </span>
        </div>
        <div className="flex items-center bg-surface-container-low rounded p-0.5">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={`px-2 py-1 rounded font-label text-[11px] uppercase tracking-wider flex items-center ${
              viewport === "desktop" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-secondary hover:text-primary"
            }`}
            aria-pressed={viewport === "desktop"}
          >
            <span className="material-symbols-outlined text-[14px]">desktop_windows</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={`px-2 py-1 rounded font-label text-[11px] uppercase tracking-wider flex items-center ${
              viewport === "mobile" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-secondary hover:text-primary"
            }`}
            aria-pressed={viewport === "mobile"}
          >
            <span className="material-symbols-outlined text-[14px]">smartphone</span>
          </button>
        </div>
      </div>

      <div
        className={`mx-auto w-full bg-surface rounded-xl overflow-hidden shadow-lg border border-surface-container transition-all ${
          viewport === "mobile" ? "max-w-[320px]" : "max-w-full"
        }`}
      >
        <div className="relative h-36 bg-surface-container overflow-hidden">
          {hero?.url ? (
            <img src={hero.url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-secondary text-xs">{t("admin.heroImage")}</div>
          )}
          {draft.gradient !== false ? (
            <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/20 to-transparent" />
          ) : null}
          <div className="absolute bottom-3 left-3 right-3">
            <h3
              className="font-headline text-sm uppercase text-on-primary leading-tight line-clamp-2"
              style={draft.hero_text_color ? { color: draft.hero_text_color } : undefined}
            >
              {draft.title || t("admin.newPageTitle")}
            </h3>
            {draft.subtitle ? (
              <p className="font-body text-[10px] text-on-primary/80 line-clamp-2 mt-1">{draft.subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="p-4 flex flex-col gap-2 text-xs">
          <span className="font-label uppercase text-secondary tracking-wider">
            {t("admin.pagesStudio.blockCount", { count: blockCount })}
          </span>
          <span className="font-mono text-secondary truncate">{slug ? `/pages/${slug}` : "—"}</span>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {draft.is_active ? (
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#004225] font-label text-[9px] uppercase font-bold">
                {t("admin.active")}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-label text-[9px] uppercase">
                {t("admin.pageOff")}
              </span>
            )}
            {draft.show_in_nav ? (
              <span className="px-2 py-0.5 rounded bg-surface-container font-label text-[9px] uppercase text-on-surface">
                {t("admin.showInNav")}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {slug ? (
        <Link
          to={`/pages/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="w-full text-center px-4 py-2.5 rounded bg-surface-container-low hover:bg-surface-container font-label text-label-caps uppercase tracking-wider text-sm flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
          {t("admin.pagesStudio.openStorefront")}
        </Link>
      ) : null}
    </div>
  );
}
