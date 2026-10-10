import { useMemo, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { Media } from "../types";
import ImageCropModal from "./ImageCropModal";
import { DangerButton, PrimaryButton, SecondaryButton } from "./ui";

export function useMedia() {
  return useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });
}

type AssetTab = "all" | "campaign" | "pdp" | "video" | "lookbook";
type ViewMode = "grid" | "list";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function extLabel(filename: string, contentType: string): string {
  if (filename.toLowerCase().endsWith(".webp")) return "WebP";
  if (contentType.includes("png")) return "PNG";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "JPEG";
  return "IMG";
}

function assetCategory(m: Media): AssetTab {
  const f = m.filename.toLowerCase();
  if (f.includes("video") || m.content_type.startsWith("video/")) return "video";
  if (f.startsWith("z812") || f.includes("eden") || f.includes("dress")) return "pdp";
  if (f.includes("journal") || f.includes("lookbook") || f.includes("editorial")) return "lookbook";
  if (f.includes("hero") || f.includes("campaign") || f.includes("grass")) return "campaign";
  return "pdp";
}

function UploadButton({ onDone, label }: { onDone: (m: Media) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; preview: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (file: File | Blob) => adminApi.uploadMedia(file),
    onSuccess: (media) => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      onDone(media);
    },
  });

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        multiple
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setPendingFile({ file, preview: URL.createObjectURL(file) });
          e.target.value = "";
        }}
      />
      <PrimaryButton
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="uppercase font-label text-label-caps px-8 py-4 flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
        {uploading ? t("admin.uploading") : label || t("admin.assets.bulkUpload")}
      </PrimaryButton>
      {pendingFile && (
        <ImageCropModal
          src={pendingFile.preview}
          title={t("admin.editUpload")}
          onClose={() => {
            URL.revokeObjectURL(pendingFile.preview);
            setPendingFile(null);
          }}
          onComplete={async (blob) => {
            URL.revokeObjectURL(pendingFile.preview);
            setPendingFile(null);
            setUploading(true);
            await mutation.mutateAsync(blob, { onSettled: () => setUploading(false) });
          }}
        />
      )}
    </>
  );
}

function DigitalAssetStudio({ media }: { media: Media[] }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AssetTab>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Media | null>(null);
  const [cropTarget, setCropTarget] = useState<Media | null>(null);
  const [altEn, setAltEn] = useState("");
  const [altVi, setAltVi] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const pageSize = 12;

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      setSelected(null);
    },
  });
  const replaceMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: Blob }) => adminApi.replaceMedia(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-media"] }),
  });

  const tabCounts = useMemo(() => {
    const c = { all: media.length, campaign: 0, pdp: 0, video: 0, lookbook: 0 };
    for (const m of media) c[assetCategory(m)] += 1;
    return c;
  }, [media]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return media.filter((m) => {
      if (tab !== "all" && assetCategory(m) !== tab) return false;
      if (q && !m.filename.toLowerCase().includes(q) && !m.url.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [media, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalBytes = media.reduce((s, m) => s + (m.size || 0), 0);
  const storagePct = Math.min(99, Math.round((totalBytes / (5 * 1024 ** 4)) * 1000) / 10 || 1);

  function selectAsset(m: Media) {
    setSelected(m);
    setAltEn(m.filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    setAltVi("");
  }

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  return (
    <div className="flex flex-col w-full">
      <section className="px-6 lg:px-8 py-8 bg-white border-b border-surface-container-high">
        <div className="max-w-[1440px] mx-auto flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-label text-label-caps uppercase text-secondary tracking-widest">
                  {t("admin.assets.eyebrow")}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="font-label text-label-caps uppercase text-on-surface">{t("admin.assets.division")}</span>
              </div>
              <h1 className="font-headline text-3xl lg:text-4xl uppercase text-primary tracking-tight">
                {t("admin.assets.title")}
              </h1>
              <p className="font-body text-body-md text-secondary mt-2 max-w-2xl">{t("admin.assets.subtitle")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="bg-surface-container-low px-5 py-3 rounded flex flex-col min-w-[210px]">
                <div className="flex justify-between items-center text-secondary font-label text-label-caps uppercase mb-2 text-xs">
                  <span>{t("admin.assets.storage")}</span>
                  <span className="text-primary font-bold">{storagePct}%</span>
                </div>
                <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${Math.max(4, storagePct)}%` }} />
                </div>
                <span className="font-label text-label-caps text-primary tracking-tight mt-2 uppercase text-xs">
                  {formatBytes(totalBytes)} / 5 TB {t("admin.assets.inUse")}
                </span>
              </div>
              <SecondaryButton
                type="button"
                className="uppercase font-label text-label-caps px-6 py-4 flex items-center gap-2"
                onClick={() => showToast(t("admin.assets.purgeToast"))}
              >
                <span className="material-symbols-outlined text-[18px]">cached</span>
                {t("admin.assets.purgeCdn")}
              </SecondaryButton>
              <UploadButton onDone={(m) => selectAsset(m)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: t("admin.assets.kpiHit"), value: "99.88%" },
              { label: t("admin.assets.kpiEdge"), value: "14.2 ms" },
              { label: t("admin.assets.kpiYield"), value: "-74.6%" },
              { label: t("admin.assets.kpiSync"), value: t("admin.kpi.synced") },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-surface-container-low p-4 rounded flex items-center justify-between">
                <div>
                  <span className="font-label text-label-caps uppercase text-secondary block text-xs">{kpi.label}</span>
                  <span className="font-headline text-xl text-primary">{kpi.value}</span>
                </div>
                {kpi.label === t("admin.assets.kpiSync") ? (
                  <span className="material-symbols-outlined text-primary text-[28px]">verified</span>
                ) : (
                  <svg className="w-16 h-8 text-primary" fill="none" viewBox="0 0 64 32" aria-hidden>
                    <path d="M0 24L12 20L24 22L36 12L48 15L64 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 lg:px-8 py-4 bg-surface sticky top-14 z-20 border-b border-surface-container shadow-sm">
        <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(
              [
                ["all", t("admin.assets.tabAll"), tabCounts.all],
                ["campaign", t("admin.assets.tabCampaign"), tabCounts.campaign],
                ["pdp", t("admin.assets.tabPdp"), tabCounts.pdp],
                ["video", t("admin.assets.tabVideo"), tabCounts.video],
                ["lookbook", t("admin.assets.tabLookbook"), tabCounts.lookbook],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  setPage(1);
                }}
                className={`px-4 py-2.5 rounded font-label text-label-caps uppercase whitespace-nowrap transition-all ${
                  tab === key ? "bg-primary text-on-primary" : "text-secondary hover:bg-surface-container-low"
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded min-w-[240px]">
              <span className="material-symbols-outlined text-[18px] text-secondary">filter_alt</span>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("admin.assets.filterPlaceholder")}
                className="bg-transparent text-sm w-full focus:outline-none"
              />
            </div>
            <div className="flex items-center bg-surface-container-low p-1 rounded">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`w-8 h-8 rounded flex items-center justify-center ${
                  view === "grid" ? "bg-white text-primary shadow-sm" : "text-secondary"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`w-8 h-8 rounded flex items-center justify-center ${
                  view === "list" ? "bg-white text-primary shadow-sm" : "text-secondary"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">view_list</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 lg:px-8 py-8 max-w-[1440px] mx-auto w-full">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <div className="xl:col-span-8 flex flex-col gap-6">
            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">layers</span>
                <span className="font-label text-label-caps uppercase text-on-surface text-xs">
                  {filtered.length
                    ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} / ${filtered.length} ${t("admin.assets.assetsLabel")}`
                    : `0 ${t("admin.assets.assetsLabel")}`}
                </span>
              </div>
            </div>

            {deleteMutation.isError && (
              <p className="text-error text-sm">
                {t("admin.deleteFailed")}{" "}
                {deleteMutation.error instanceof Error ? deleteMutation.error.message : String(deleteMutation.error)}
              </p>
            )}

            {view === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pageItems.map((m) => (
                  <AssetCard
                    key={m.id}
                    media={m}
                    selected={selected?.id === m.id}
                    onSelect={() => selectAsset(m)}
                    onCopy={() => {
                      void navigator.clipboard.writeText(m.url);
                      showToast(t("admin.assets.urlCopied"));
                    }}
                    onCrop={() => setCropTarget(m)}
                    onDelete={() => deleteMutation.mutate(m.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {pageItems.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectAsset(m)}
                    className={`flex items-center gap-4 p-3 rounded bg-white border text-left ${
                      selected?.id === m.id ? "border-primary" : "border-surface-container-high"
                    }`}
                  >
                    <img src={m.url} alt="" className="w-16 h-16 object-cover rounded" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{m.filename}</p>
                      <p className="text-xs text-secondary uppercase">{formatBytes(m.size)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {pageItems.length === 0 && (
              <p className="text-secondary text-center py-12">{t("admin.noMedia")}</p>
            )}

            <div className="flex items-center justify-between pt-4">
              <span className="font-label text-label-caps uppercase text-secondary text-xs">
                {t("admin.assets.page")} {page} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <SecondaryButton type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t("admin.assets.prev")}
                </SecondaryButton>
                <SecondaryButton type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  {t("admin.assets.next")}
                </SecondaryButton>
              </div>
            </div>
          </div>

          <aside className="xl:col-span-4 sticky top-36 bg-white rounded p-6 shadow-sm border border-surface-container-high flex flex-col gap-5">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="font-label text-label-caps uppercase text-primary text-xs">
                  {t("admin.assets.inspector")}
                </span>
              </div>
              {selected ? (
                <span className="font-label text-label-caps text-secondary uppercase bg-surface-container-low px-2 py-0.5 rounded text-[10px]">
                  ID-{selected.id}
                </span>
              ) : null}
            </div>

            {!selected ? (
              <p className="text-secondary text-sm py-8 text-center">{t("admin.assets.selectAsset")}</p>
            ) : (
              <>
                <div className="relative w-full aspect-[16/10] bg-surface-container-low rounded overflow-hidden">
                  <img src={selected.url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur px-3 py-2 rounded flex justify-between items-center text-xs">
                    <span className="font-bold truncate max-w-[200px]">{selected.filename}</span>
                    <span className="text-secondary uppercase">{formatBytes(selected.size)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full bg-primary text-on-primary py-2.5 rounded font-label text-label-caps uppercase text-xs flex items-center justify-center gap-2"
                  onClick={() => {
                    void navigator.clipboard.writeText(selected.url);
                    showToast(t("admin.assets.urlCopied"));
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  {t("admin.assets.copyCdn")}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container-low p-3 rounded">
                    <span className="font-label text-[10px] text-secondary uppercase block">{t("admin.assets.format")}</span>
                    <span className="font-headline text-lg text-primary">{extLabel(selected.filename, selected.content_type)}</span>
                  </div>
                  <div className="bg-surface-container-low p-3 rounded">
                    <span className="font-label text-[10px] text-secondary uppercase block">{t("admin.assets.fileSize")}</span>
                    <span className="font-bold text-sm">{formatBytes(selected.size)}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.assets.altEn")}</span>
                  <textarea
                    value={altEn}
                    onChange={(e) => setAltEn(e.target.value)}
                    rows={2}
                    className="w-full bg-surface-container-low text-xs p-2.5 rounded resize-none focus:outline-none"
                  />
                  <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.assets.altVi")}</span>
                  <textarea
                    value={altVi}
                    onChange={(e) => setAltVi(e.target.value)}
                    rows={2}
                    className="w-full bg-surface-container-low text-xs p-2.5 rounded resize-none focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <SecondaryButton type="button" className="flex-1 uppercase text-xs" onClick={() => setCropTarget(selected)}>
                    {t("admin.assets.replaceSource")}
                  </SecondaryButton>
                  <PrimaryButton
                    type="button"
                    className="flex-1 uppercase text-xs"
                    onClick={() => showToast(t("admin.assets.metaSaved"))}
                  >
                    {t("admin.assets.saveMeta")}
                  </PrimaryButton>
                </div>
                <DangerButton type="button" className="w-full uppercase text-xs" onClick={() => deleteMutation.mutate(selected.id)}>
                  {t("admin.delete")}
                </DangerButton>
              </>
            )}
          </aside>
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-8 right-8 bg-primary text-on-primary px-6 py-4 rounded shadow-xl font-label text-label-caps uppercase flex items-center gap-3 z-50">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          {toast}
        </div>
      ) : null}

      {cropTarget && (
        <ImageCropModal
          src={cropTarget.url}
          title={t("admin.editImageInPlace")}
          onClose={() => setCropTarget(null)}
          onComplete={async (blob) => {
            await replaceMutation.mutateAsync({ id: cropTarget.id, file: blob });
            setCropTarget(null);
          }}
        />
      )}
    </div>
  );
}

function AssetCard({
  media: m,
  selected,
  onSelect,
  onCopy,
  onCrop,
  onDelete,
}: {
  media: Media;
  selected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onCrop: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`group bg-white rounded overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col cursor-pointer border ${
        selected ? "border-primary ring-1 ring-primary" : "border-transparent"
      }`}
    >
      <div className="relative w-full aspect-[4/3] bg-surface-container overflow-hidden">
        <img src={m.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        <div className="absolute top-3 left-3 bg-primary text-on-primary font-label text-[10px] tracking-widest px-2 py-1 rounded uppercase">
          {extLabel(m.filename, m.content_type)}
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-body font-bold text-on-surface truncate text-sm">{m.filename}</h3>
            <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded text-secondary uppercase font-label">
              {extLabel(m.filename, m.content_type)}
            </span>
          </div>
          <p className="font-label text-label-caps text-secondary uppercase mt-1 text-[10px]">{formatBytes(m.size)}</p>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <IconBtn title="Copy" icon="link" onClick={(e) => (e.stopPropagation(), onCopy())} />
            <IconBtn title="Crop" icon="crop" onClick={(e) => (e.stopPropagation(), onCrop())} />
          </div>
          <IconBtn title="Delete" icon="delete" danger onClick={(e) => (e.stopPropagation(), onDelete())} />
        </div>
      </div>
    </article>
  );
}

function IconBtn({
  icon,
  title,
  danger,
  onClick,
}: {
  icon: string;
  title: string;
  danger?: boolean;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
        danger ? "hover:bg-error-container hover:text-error text-secondary" : "hover:bg-surface-container-high text-secondary hover:text-primary"
      }`}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
    </button>
  );
}

export function MediaLibrary({
  onSelect,
  hubLayout = false,
}: {
  onSelect?: (m: Media) => void;
  hubLayout?: boolean;
}) {
  const { data: media, isLoading } = useMedia();
  const { t } = useLanguage();

  if (isLoading) return <p className="font-body text-body-md text-secondary">{t("admin.loadingMedia")}</p>;

  const list = media || [];

  if (hubLayout) {
    return <DigitalAssetStudio media={list} />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between bg-white border border-surface-container-highest p-4 shadow-sm">
        <h3 className="font-headline text-headline-md text-primary uppercase">{t("admin.mediaLibrary")}</h3>
        <UploadButton onDone={(m) => onSelect?.(m)} label={t("admin.uploadImage")} />
      </div>
      {list.length === 0 && <p className="font-body text-body-md text-secondary">{t("admin.noMedia")}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {list.map((m) => (
          <div key={m.id} className="group relative border border-surface-container-highest bg-white p-2 flex flex-col">
            <img src={m.url} alt={m.filename} className="w-full h-32 object-cover mb-2" loading="lazy" />
            <p className="font-body text-body-md text-secondary text-xs truncate">{m.filename}</p>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(m)}
                className="font-label text-label-caps text-forest-green hover:underline uppercase mt-1"
              >
                {t("admin.selectShort")}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MediaPicker({
  onSelect,
  onClose,
}: {
  onSelect: (m: Media) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-picker-title"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-6xl max-h-[min(92vh,960px)] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-surface-container-high"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-surface-container-high shrink-0">
          <h3 id="media-picker-title" className="font-headline text-headline-md text-primary uppercase">
            {t("admin.selectMedia")}
          </h3>
          <SecondaryButton onClick={onClose}>{t("admin.close")}</SecondaryButton>
        </div>
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <MediaLibrary
            onSelect={(m) => {
              onSelect(m);
              onClose();
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Media | null;
  onChange: (m: Media | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-1">
      <span className="font-label text-label-caps text-secondary uppercase">{label}</span>
      {value ? (
        <div className="flex items-center gap-3 border border-surface-container-highest bg-white p-2">
          <img src={value.url} alt={value.filename} className="w-16 h-16 object-cover" />
          <div className="flex flex-col gap-1">
            <span className="font-body text-body-md text-on-background text-xs truncate max-w-[200px]">{value.filename}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="font-label text-label-caps text-forest-green hover:underline uppercase"
              >
                {t("admin.change")}
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="font-label text-label-caps text-error hover:underline uppercase"
              >
                {t("admin.clear")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <SecondaryButton onClick={() => setOpen(true)}>{t("admin.chooseImage")}</SecondaryButton>
      )}
      {open && <MediaPicker onSelect={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}
