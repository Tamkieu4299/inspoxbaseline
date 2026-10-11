import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import type { Media, Product } from "../types";
import ImageCropModal from "./ImageCropModal";
import { MediaPicker } from "./MediaLibrary";
import { ProductEditorForm, type ProductStudioTab } from "./ProductEditorForm";
import { ProductStudioPreview } from "./ProductStudioPreview";
import {
  blankProductDraft,
  liveStatus,
  productToDraft,
  skuFromSlug,
  viCompleteness,
  type ProductDraft,
} from "./productDraft";
import { useLanguage } from "../i18n";
import { formatMoney } from "../money";

function CatalogSelect({
  value,
  onChange,
  children,
  icon = "expand_more",
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  icon?: string;
}) {
  return (
    <div className="relative inline-block text-left">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-surface-container-lowest font-label text-label-caps uppercase text-on-surface px-4 py-2.5 pr-8 rounded cursor-pointer focus:outline-none border-0"
      >
        {children}
      </select>
      <span className="material-symbols-outlined absolute right-2 top-2.5 pointer-events-none text-[16px] text-secondary">
        {icon}
      </span>
    </div>
  );
}

function KpiPill({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: string;
  tone?: "default" | "error";
}) {
  const valueCls = tone === "error" ? "text-error" : "text-primary";
  const iconWrap =
    tone === "error" ? "bg-error-container text-error" : "bg-surface-container text-primary";
  return (
    <div className="bg-surface-container-low p-4 rounded flex items-center justify-between">
      <div className="flex flex-col">
        <span className={`font-label text-label-caps uppercase ${tone === "error" ? "text-error" : "text-secondary"}`}>
          {label}
        </span>
        <span className={`font-headline text-headline-md ${valueCls} mt-1`}>{value}</span>
      </div>
      <div className={`w-10 h-10 rounded-full ${iconWrap} flex items-center justify-center`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
    </div>
  );
}

function StatusBadge({ product }: { product: Product }) {
  const { t } = useLanguage();
  const status = liveStatus(product);
  const map = {
    active: {
      cls: "bg-surface-container text-on-surface",
      dot: "bg-primary",
      label: t("admin.catalog.statusActive"),
    },
    limited: {
      cls: "bg-primary text-on-primary",
      dot: "bg-surface-container-lowest animate-pulse",
      label: t("admin.catalog.statusLimited"),
    },
    scheduled: {
      cls: "bg-surface-container text-secondary",
      dot: "bg-secondary",
      label: t("admin.catalog.statusScheduled"),
    },
    draft: {
      cls: "bg-surface-container-high text-secondary",
      dot: "bg-secondary",
      label: t("admin.catalog.statusDraft"),
    },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-label text-label-caps uppercase ${map.cls}`}>
      <span className={`w-2 h-2 rounded-full ${map.dot}`} />
      {map.label}
    </span>
  );
}

export default function ProductsTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: products, isLoading } = useQuery({ queryKey: ["admin-products"], queryFn: adminApi.getProducts });
  const { data: categories } = useQuery({ queryKey: ["admin-categories"], queryFn: adminApi.getCategories });
  const { data: collections } = useQuery({ queryKey: ["admin-collections"], queryFn: adminApi.getCollections });
  const storeCurrency = "VND";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | "new">();
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [pickImageFor, setPickImageFor] = useState<number | null>(null);
  const [cropTarget, setCropTarget] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [productStudioTab, setProductStudioTab] = useState<ProductStudioTab>("general");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [exportState, setExportState] = useState<"idle" | "busy" | "done">("idle");

  const uploadMutation = useMutation({
    mutationFn: (file: File | Blob) => adminApi.uploadMedia(file),
  });

  const saveMutation = useMutation({
    mutationFn: (d: ProductDraft) => (d.id ? adminApi.updateProduct(d.id, d) : adminApi.createProduct(d)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      closeDrawer();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      closeDrawer();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (p: Product) => adminApi.updateProduct(p.id, { ...productToDraft(p), is_active: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setDraft(null);
    setSelectedId(undefined);
    setSelectedCell(null);
    setPickImageFor(null);
    setCropTarget(null);
    setProductStudioTab("general");
  }

  function openDrawer(next: ProductDraft, id: number | "new") {
    setDraft(next);
    setSelectedId(id);
    setProductStudioTab("general");
    setDrawerOpen(true);
  }

  function setField<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function moveImage(index: number, dir: -1 | 1) {
    setDraft((d) => {
      if (!d) return d;
      const images = [...d.images];
      const target = index + dir;
      if (target < 0 || target >= images.length) return d;
      [images[index], images[target]] = [images[target], images[index]];
      return { ...d, images: images.map((im, i) => ({ ...im, position: i })) };
    });
  }

  const categoryById = useMemo(() => new Map((categories || []).map((c) => [c.id, c])), [categories]);

  function productCategoryIds(p: Product): number[] {
    if (p.categories?.length) return p.categories.map((c) => c.id);
    return p.category_id != null ? [p.category_id] : [];
  }

  function productCategoryLabel(p: Product): string {
    const names =
      p.categories?.map((c) => c.name) ??
      (p.category_id ? [categoryById.get(p.category_id)?.name].filter(Boolean) : []);
    return names.join(", ");
  }
  const collectionById = useMemo(() => new Map((collections || []).map((c) => [c.id, c])), [collections]);

  const kpis = useMemo(() => {
    const list = products || [];
    const active = list.filter((p) => p.is_active).length;
    const heritage = list.filter((p) => p.is_featured || p.badge === "NEW" || p.badge === "NEW ARRIVAL").length;
    const limited = list.filter((p) => p.badge === "LIMITED").length;
    const drafts = list.filter((p) => !p.is_active).length;
    return { active, heritage, limited, drafts, total: list.length };
  }, [products]);

  const filtered = useMemo(() => {
    let list = products || [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const cat = productCategoryLabel(p);
        const sku = skuFromSlug(p.slug);
        return [p.name, p.slug, sku, cat].some((s) => (s || "").toLowerCase().includes(q));
      });
    }
    if (categoryFilter !== "all") {
      const fid = Number(categoryFilter);
      list = list.filter((p) => productCategoryIds(p).includes(fid));
    }
    if (collectionFilter !== "all") {
      list = list.filter((p) => String(p.collection_id ?? "") === collectionFilter);
    }
    if (statusFilter === "active") list = list.filter((p) => p.is_active);
    if (statusFilter === "draft") list = list.filter((p) => !p.is_active);
    if (localeFilter === "vi_full") list = list.filter((p) => viCompleteness(p) === "full");
    if (localeFilter === "vi_missing") list = list.filter((p) => viCompleteness(p) !== "full");
    return list;
  }, [products, search, categoryFilter, collectionFilter, statusFilter, localeFilter, categoryById]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setCollectionFilter("all");
    setLocaleFilter("all");
    setPage(1);
  }

  function toggleCheck(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllPage() {
    const ids = pageItems.map((p) => p.id);
    const allOn = ids.every((id) => checked.has(id));
    setChecked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function exportCsv() {
    setExportState("busy");
    const rows = filtered.map((p) => {
      const cat = productCategoryLabel(p);
      const col = p.collection_id ? collectionById.get(p.collection_id)?.name : "";
      return [skuFromSlug(p.slug), p.name, p.slug, cat, col, p.price, p.is_active ? "active" : "draft", p.badge || ""]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",");
    });
    const header = "sku,name,slug,category,collection,price,status,badge";
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalog-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExportState("done"), 400);
    setTimeout(() => setExportState("idle"), 2200);
  }

  function duplicateProduct(p: Product) {
    const d = productToDraft(p);
    delete d.id;
    d.slug = `${p.slug}-copy`.slice(0, 80);
    d.name = `${p.name} (Copy)`;
    openDrawer(d, "new");
  }

  function productThumb(p: Product): string | null {
    const img = p.images?.find((i) => i.enabled !== false) || p.images?.[0];
    return img?.url || null;
  }

  function tagPills(p: Product): string[] {
    const tags: string[] = [];
    if (p.badge) tags.push(p.badge);
    if (p.is_bestseller) tags.push("BESTSELLER");
    if (p.is_featured) tags.push("FEATURED");
    const colors = (p.colors || []).slice(0, 2).map((c) => (typeof c === "string" ? c : c.name || "")).filter(Boolean);
    return [...tags, ...colors].slice(0, 2);
  }

  return (
    <div className="flex flex-col w-full min-w-0 max-w-full font-body text-body-md text-on-surface bg-surface">
      {/* Command strip */}
      <div className="px-8 pt-8 pb-6 bg-surface-container-lowest">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-label text-label-caps uppercase text-secondary tracking-widest">
                {t("admin.catalog.breadcrumbDivision")}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              <span className="font-label text-label-caps uppercase text-secondary">{t("admin.catalog.breadcrumbManifest")}</span>
            </div>
            <h1 className="font-headline text-headline-lg uppercase tracking-tight text-primary">
              {t("admin.catalog.title")}
            </h1>
            <p className="font-body text-body-sm text-secondary mt-1">
              {t("admin.catalog.pricesInCurrency", { currency: storeCurrency })}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={exportCsv}
              disabled={exportState === "busy"}
              className="px-6 py-3 bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label text-label-caps uppercase flex items-center gap-2 rounded"
            >
              <span className={`material-symbols-outlined text-[18px] ${exportState === "busy" ? "animate-spin" : ""}`}>
                {exportState === "done" ? "check" : exportState === "busy" ? "progress_activity" : "file_download"}
              </span>
              <span>
                {exportState === "done"
                  ? t("admin.catalog.exportDone")
                  : exportState === "busy"
                    ? t("admin.catalog.exportBusy")
                    : t("admin.catalog.exportCsv")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => openDrawer(blankProductDraft(), "new")}
              className="px-8 py-3 bg-primary text-on-primary hover:bg-inverse-surface transition-all font-label text-label-caps uppercase flex items-center gap-2 shadow-sm rounded"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>{t("admin.catalog.createProduct")}</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
          <KpiPill label={t("admin.catalog.kpiActive")} value={kpis.active} icon="inventory_2" />
          <KpiPill label={t("admin.catalog.kpiHeritage")} value={kpis.heritage} icon="workspace_premium" />
          <KpiPill label={t("admin.catalog.kpiLimited")} value={kpis.limited} icon="workspace_premium" />
          <KpiPill label={t("admin.catalog.kpiDrafts")} value={kpis.drafts} icon="drafts" />
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-4 bg-surface-container flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between">
        <div className="flex items-center gap-3 bg-surface-container-lowest px-4 py-2.5 rounded flex-1 max-w-xl border border-surface-container">
          <span className="material-symbols-outlined text-secondary text-[20px]">search</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-transparent font-body text-body-md text-on-surface placeholder:text-secondary focus:outline-none"
            placeholder={t("admin.catalog.searchPlaceholder")}
            type="text"
          />
          <span className="font-label text-label-caps text-secondary bg-surface-container-low px-1.5 py-0.5 rounded hidden sm:inline">
            ⌘K
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CatalogSelect value={categoryFilter} onChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <option value="all">{t("admin.catalog.filterCategoryAll")}</option>
            {(categories || []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </CatalogSelect>
          <CatalogSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <option value="all">{t("admin.catalog.filterStatusAll")}</option>
            <option value="active">{t("admin.catalog.filterStatusActive")}</option>
            <option value="draft">{t("admin.catalog.filterStatusDraft")}</option>
          </CatalogSelect>
          <CatalogSelect value={collectionFilter} onChange={(v) => { setCollectionFilter(v); setPage(1); }}>
            <option value="all">{t("admin.catalog.filterCollectionAll")}</option>
            {(collections || []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </CatalogSelect>
          <CatalogSelect value={localeFilter} onChange={(v) => { setLocaleFilter(v); setPage(1); }} icon="language">
            <option value="all">{t("admin.catalog.filterLocaleAll")}</option>
            <option value="vi_full">{t("admin.catalog.filterLocaleViFull")}</option>
            <option value="vi_missing">{t("admin.catalog.filterLocaleViMissing")}</option>
          </CatalogSelect>
          <button
            type="button"
            onClick={clearFilters}
            className="bg-surface-container-low hover:bg-surface-container-high text-secondary hover:text-on-surface p-2.5 rounded transition-colors flex items-center justify-center"
            title={t("admin.catalog.clearFilters")}
          >
            <span className="material-symbols-outlined text-[20px]">filter_list_off</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="relative overflow-x-auto bg-surface-container-lowest min-h-[240px]">
        {isLoading ? (
          <p className="p-8 text-secondary">{t("admin.loading")}</p>
        ) : (
          <table className="w-full text-left font-body text-body-md border-collapse">
            <thead>
              <tr className="bg-surface-container-low font-label text-label-caps uppercase tracking-wider text-secondary select-none">
                <th className="py-4 px-6 w-12 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                    checked={pageItems.length > 0 && pageItems.every((p) => checked.has(p.id))}
                    onChange={toggleAllPage}
                  />
                </th>
                <th className="py-4 px-4 font-bold">{t("admin.catalog.colProduct")}</th>
                <th className="py-4 px-4 font-bold">{t("admin.catalog.colCategory")}</th>
                <th className="py-4 px-4 font-bold">{t("admin.catalog.colPrice")}</th>
                <th className="py-4 px-4 font-bold">{t("admin.catalog.colCollection")}</th>
                <th className="py-4 px-4 font-bold">{t("admin.catalog.colStatus")}</th>
                <th className="py-4 px-4 font-bold">{t("admin.catalog.colLocale")}</th>
                <th className="py-4 px-6 font-bold text-right">{t("admin.catalog.colActions")}</th>
              </tr>
            </thead>
            <tbody className="text-on-surface">
              {pageItems.map((p) => {
                const catLabel = productCategoryLabel(p);
                const col = p.collection_id ? collectionById.get(p.collection_id) : null;
                const vi = viCompleteness(p);
                const thumb = productThumb(p);
                return (
                  <tr key={p.id} className="hover:bg-surface-container-low/60 transition-colors group">
                    <td className="py-4 px-6 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-primary cursor-pointer"
                        checked={checked.has(p.id)}
                        onChange={() => toggleCheck(p.id)}
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-16 bg-surface-container shrink-0 rounded overflow-hidden relative">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : null}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <button
                            type="button"
                            onClick={() => openDrawer(productToDraft(p), p.id)}
                            className="font-headline text-[18px] text-primary truncate leading-tight text-left hover:underline"
                          >
                            {p.name}
                          </button>
                          <span className="font-label text-label-caps text-secondary uppercase mt-1 tracking-wider">
                            SKU: {skuFromSlug(p.slug)}
                          </span>
                          <span className="font-body text-[12px] text-secondary">
                            {col?.name || t("admin.none")}
                            {p.badge ? ` · ${p.badge}` : ""}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-body text-body-md text-on-surface">{catLabel || "—"}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {tagPills(p).map((tag) => (
                            <span
                              key={tag}
                              className="bg-surface-container font-label text-[10px] uppercase text-secondary px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-body font-bold text-on-surface">
                        {formatMoney(p.price, storeCurrency, "vi-VN")}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-body text-body-md text-on-surface">{col?.name || "—"}</span>
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge product={p} />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`font-label text-[11px] uppercase text-on-surface px-2 py-0.5 rounded inline-block w-fit ${
                            vi === "full" ? "bg-surface-container" : "bg-surface-container-high"
                          }`}
                        >
                          {vi === "full"
                            ? t("admin.catalog.localeFull")
                            : vi === "partial"
                              ? t("admin.catalog.localePartial")
                              : t("admin.catalog.localeViDraft")}
                        </span>
                        <span className="text-[11px] text-secondary font-label">
                          {vi === "full"
                            ? t("admin.catalog.localeSynced")
                            : vi === "partial"
                              ? t("admin.catalog.localePartialHint")
                              : t("admin.catalog.localeViHint")}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openDrawer(productToDraft(p), p.id)}
                          className="w-8 h-8 rounded bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center justify-center transition-colors"
                          title={t("admin.catalog.actionEdit")}
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <Link
                          to={`/products/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-8 h-8 rounded bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center justify-center transition-colors"
                          title={t("admin.catalog.actionPreview")}
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => duplicateProduct(p)}
                          className="w-8 h-8 rounded bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center justify-center transition-colors"
                          title={t("admin.catalog.actionDuplicate")}
                        >
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t("admin.catalog.archiveConfirm"))) archiveMutation.mutate(p);
                          }}
                          className="w-8 h-8 rounded bg-surface-container-low hover:bg-error-container text-on-surface hover:text-error flex items-center justify-center transition-colors"
                          title={t("admin.catalog.actionArchive")}
                        >
                          <span className="material-symbols-outlined text-[18px]">archive</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="p-8 text-secondary text-center">{t("admin.catalog.noResults")}</p>
        )}
      </div>

      {/* Pagination */}
      <div className="px-8 py-5 bg-surface-container-lowest flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-body text-[13px] text-secondary">
            {t("admin.catalog.showing")}{" "}
            <span className="font-bold text-on-surface">
              {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1} - {Math.min(safePage * pageSize, filtered.length)}
            </span>{" "}
            {t("admin.catalog.of")}{" "}
            <span className="font-bold text-on-surface">{filtered.length}</span> {t("admin.catalog.items")}
          </span>
          <div className="h-4 w-px bg-surface-container hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="font-label text-[11px] uppercase text-secondary">{t("admin.catalog.rowsPerPage")}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-surface-container-low text-on-surface font-label text-label-caps px-2 py-1 rounded focus:outline-none"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="w-9 h-9 rounded bg-surface-container-low text-secondary flex items-center justify-center hover:bg-surface-container disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button
            type="button"
            className="w-9 h-9 rounded bg-primary text-on-primary font-bold text-[13px] flex items-center justify-center"
          >
            {safePage}
          </button>
          {totalPages > 1 && safePage < totalPages && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="w-9 h-9 rounded bg-surface-container-low text-on-surface hover:bg-surface-container font-body text-[13px] flex items-center justify-center transition-colors"
            >
              {safePage + 1}
            </button>
          )}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="w-9 h-9 rounded bg-surface-container-low text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Product editor modal */}
      <div
        className={`fixed inset-0 z-[70] bg-primary/45 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 transition-opacity duration-300 ${
          drawerOpen && draft ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!drawerOpen}
        onClick={() => drawerOpen && closeDrawer()}
      >
        <div
          className={`w-full max-w-[1440px] max-h-[min(94vh,980px)] bg-surface shadow-2xl rounded-xl border border-surface-container-high flex flex-col transform transition-all duration-300 ease-out overflow-hidden ${
            drawerOpen && draft ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
          }`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
            {draft && (
              <>
                <div className="shrink-0 bg-surface-container-lowest border-b border-surface-container px-6 lg:px-8 py-6 flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-on-surface-variant">
                      <span className="font-label text-label-caps uppercase tracking-widest text-xs">
                        {t("admin.catalog.studioBreadcrumbSuite")}
                      </span>
                      <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                      <span className="font-label text-label-caps uppercase tracking-widest text-xs">
                        {t("admin.catalog.studioBreadcrumbCatalog")}
                      </span>
                      <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                      <span className="font-label text-label-caps uppercase tracking-widest text-xs text-primary font-bold">
                        {t("admin.catalog.studioBreadcrumbEditor")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={closeDrawer}
                      className="w-10 h-10 rounded hover:bg-surface-container text-on-surface flex items-center justify-center transition-colors shrink-0"
                      aria-label={t("admin.cancel")}
                    >
                      <span className="material-symbols-outlined text-[24px]">close</span>
                    </button>
                  </div>
                  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded bg-primary text-on-primary font-label text-[10px] uppercase tracking-widest">
                          PDP Studio
                        </span>
                        {draft.slug ? (
                          <span className="px-2.5 py-0.5 rounded bg-surface-container font-label text-[10px] uppercase tracking-widest">
                            SKU: {skuFromSlug(draft.slug)}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="font-headline text-2xl lg:text-3xl uppercase text-primary tracking-tight leading-none">
                        {t("admin.catalog.productStudio")}
                      </h2>
                      <p className="font-body text-body-md text-secondary mt-2 max-w-2xl line-clamp-2">
                        {draft.name || t("admin.newProductTitle")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {draft.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t("admin.delete") + "?")) deleteMutation.mutate(draft.id!);
                          }}
                          className="px-4 py-2.5 rounded font-label text-label-caps uppercase text-error hover:bg-error-container/30 transition-colors"
                        >
                          {t("admin.delete")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={closeDrawer}
                        className="px-5 py-2.5 rounded bg-surface-container-low hover:bg-surface-container font-label text-label-caps uppercase tracking-wider"
                      >
                        {t("admin.catalog.discard")}
                      </button>
                      {draft.slug ? (
                        <Link
                          to={`/products/${draft.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-5 py-2.5 rounded bg-surface-container-highest hover:bg-surface-dim font-label text-label-caps uppercase tracking-wider flex items-center gap-1.5"
                        >
                          {t("admin.catalog.previewPdp")}
                          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => saveMutation.mutate(draft)}
                        disabled={!draft.name || !draft.slug || saveMutation.isPending}
                        className="px-6 py-2.5 rounded bg-forest-green hover:bg-[#00331c] text-white font-label text-label-caps uppercase tracking-widest font-bold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        {t("admin.catalog.publishLive")}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pt-1">
                    {(
                      [
                        ["general", t("admin.studio.tabGeneral")],
                        ["media", t("admin.studio.tabMedia")],
                        ["story", t("admin.studio.tabStory")],
                        ["variants", t("admin.studio.tabVariants")],
                      ] as const
                    ).map(([tab, label]) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setProductStudioTab(tab)}
                        className={`px-4 py-2 rounded font-label text-label-caps uppercase tracking-widest whitespace-nowrap transition-colors ${
                          productStudioTab === tab
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 min-h-0 bg-surface">
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start max-w-[1440px] mx-auto">
                    <div className="xl:col-span-7 min-w-0">
                      <ProductEditorForm
                        draft={draft}
                        set={setField}
                        categories={categories}
                        collections={collections}
                        selectedCell={selectedCell}
                        setSelectedCell={setSelectedCell}
                        pickImageFor={pickImageFor}
                        setPickImageFor={setPickImageFor}
                        cropTarget={cropTarget}
                        setCropTarget={setCropTarget}
                        moveImage={moveImage}
                        uploadMutation={uploadMutation}
                        queryClient={queryClient}
                        studioTab={productStudioTab}
                      />
                      {saveMutation.isError && <p className="text-error text-sm mt-4">{String(saveMutation.error)}</p>}
                    </div>
                    <div className="xl:col-span-5 hidden xl:block">
                      <ProductStudioPreview draft={draft} currency={storeCurrency} locale="vi-VN" />
                    </div>
                  </div>
                </div>
              </>
            )}
        </div>
      </div>

      {pickImageFor !== null && draft && (
        <MediaPicker
          onSelect={(m: Media) => {
            const index = pickImageFor;
            const images = [...draft.images];
            if (index < images.length) {
              images[index] = {
                media_id: m.id,
                url: m.url,
                alt: images[index].alt,
                position: index,
                enabled: images[index].enabled,
              };
            } else {
              images.push({ media_id: m.id, url: m.url, alt: "", position: index, enabled: true });
            }
            setField("images", images);
          }}
          onClose={() => setPickImageFor(null)}
        />
      )}
      {cropTarget !== null && draft && (
        <ImageCropModal
          src={draft.images[cropTarget]?.url || ""}
          title="CROP PRODUCT IMAGE"
          onClose={() => setCropTarget(null)}
          onComplete={async (blob) => {
            try {
              const media = await uploadMutation.mutateAsync(blob);
              const images = [...draft.images];
              images[cropTarget] = {
                media_id: media.id,
                url: media.url,
                alt: images[cropTarget]?.alt || "",
                position: cropTarget,
                enabled: images[cropTarget]?.enabled ?? true,
              };
              setField("images", images);
              queryClient.invalidateQueries({ queryKey: ["admin-media"] });
              setCropTarget(null);
            } catch {
              alert(t("admin.cropUploadFailed"));
            }
          }}
        />
      )}
    </div>
  );
}
