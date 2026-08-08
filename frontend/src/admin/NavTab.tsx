import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { NavItem } from "../types";
import { Checkbox, DangerButton, PrimaryButton, SecondaryButton, Select } from "./ui";

function navTypeKey(type: NavItem["type"]): string {
  switch (type) {
    case "home":
      return "admin.navTypeHome";
    case "collections":
      return "admin.navTypeCollections";
    case "new_arrivals":
      return "admin.navTypeNewArrivals";
    case "brand":
      return "admin.navTypeBrand";
    case "categories":
      return "admin.navTypeCategories";
    case "page":
      return "admin.navTypePage";
  }
}

const STATIC_TYPES: NavItem["type"][] = ["home", "new_arrivals", "collections", "categories", "brand"];

export default function NavTab() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { data: site, isLoading } = useQuery({ queryKey: ["admin-site"], queryFn: adminApi.getSite });
  const { data: pages } = useQuery({ queryKey: ["admin-pages"], queryFn: adminApi.getPages });

  const [draft, setDraft] = useState<NavItem[] | null>(null);
  const [pageToAdd, setPageToAdd] = useState("");

  const items = draft ?? site?.nav_items ?? [];

  const saveMutation = useMutation({
    mutationFn: (nav: NavItem[]) =>
      adminApi.updateSite({ ...site, nav_items: nav }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-site"] });
      queryClient.invalidateQueries({ queryKey: ["site"] });
      setDraft(null);
    },
  });

  function labelOf(item: NavItem): string {
    if (item.type === "page") {
      const page = pages?.find((p) => p.slug === item.ref);
      return page ? page.nav_label || page.title : item.ref || "?";
    }
    return t(navTypeKey(item.type));
  }

  function update(index: number, patch: Partial<NavItem>) {
    setDraft((d) => {
      const next = [...(d ?? site?.nav_items ?? [])];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function move(index: number, dir: -1 | 1) {
    setDraft((d) => {
      const next = [...(d ?? site?.nav_items ?? [])];
      const target = index + dir;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index: number) {
    setDraft((d) => (d ?? site?.nav_items ?? []).filter((_, i) => i !== index));
  }

  function addStatic(type: NavItem["type"]) {
    setDraft((d) => [...(d ?? site?.nav_items ?? []), { type, enabled: true }]);
  }

  function addPage() {
    if (!pageToAdd) return;
    const exists = (draft ?? site?.nav_items ?? []).some(
      (i) => i.type === "page" && i.ref === pageToAdd
    );
    if (exists) {
      setPageToAdd("");
      return;
    }
    setDraft((d) => [...(d ?? site?.nav_items ?? []), { type: "page", ref: pageToAdd, enabled: true }]);
    setPageToAdd("");
  }

  const addablePages = (pages || []).filter(
    (p) => !(draft ?? site?.nav_items ?? []).some((i) => i.type === "page" && i.ref === p.slug)
  );

  if (isLoading || !site) {
    return <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>;
  }

  return (
    <div className="bg-white border border-surface-container-highest p-6 flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h3 className="font-headline text-headline-md text-primary uppercase">{t("admin.tab.nav")}</h3>
        <PrimaryButton onClick={() => saveMutation.mutate(items)} disabled={!draft}>
          {t("admin.save")}
        </PrimaryButton>
      </div>

      <p className="font-body text-body-md text-secondary">{t("admin.navHint")}</p>

      {items.length === 0 && <p className="font-body text-body-md text-secondary">{t("admin.navEmpty")}</p>}

      <div className="flex flex-col gap-2">
        {items.map((item, index) => {
          return (
            <div
              key={`${item.type}:${item.ref ?? index}`}
              className="flex items-center gap-3 border border-surface-container-highest p-3"
            >
              <Checkbox
                checked={item.enabled}
                onChange={(e) => update(index, { enabled: e.target.checked })}
              />
              <span className="font-label text-label-caps text-secondary uppercase w-24 shrink-0">
                {item.enabled ? t("admin.navEnabled") : "—"}
              </span>
              <span className="flex-1 min-w-0">
                <span className="font-body text-body-md text-on-background uppercase block truncate">
                  {labelOf(item)}
                </span>
                <span className="font-label text-label-caps text-secondary uppercase">
                  {t(navTypeKey(item.type))}
                  {item.type === "page" && item.ref ? ` · ${item.ref}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <SecondaryButton onClick={() => move(index, -1)} disabled={index === 0}>
                  ↑
                </SecondaryButton>
                <SecondaryButton onClick={() => move(index, 1)} disabled={index === items.length - 1}>
                  ↓
                </SecondaryButton>
                <DangerButton onClick={() => remove(index)}>✕</DangerButton>
              </span>
            </div>
          );
        })}
      </div>

      <div className="border border-surface-container-highest p-4 flex flex-col gap-3">
        <span className="font-label text-label-caps text-secondary uppercase">{t("admin.navAdd")}</span>
        <div className="flex flex-wrap gap-2">
          {STATIC_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => addStatic(type)}
              className="border border-surface-container-highest px-3 py-1.5 font-label text-label-caps text-primary hover:border-forest-green hover:text-forest-green transition-colors uppercase"
            >
              {t(
                type === "home"
                  ? "admin.navAddHome"
                  : type === "collections"
                    ? "admin.navAddCollections"
                    : type === "new_arrivals"
                      ? "admin.navAddNewArrivals"
                      : type === "brand"
                        ? "admin.navAddBrand"
                        : "admin.navAddCategories"
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select value={pageToAdd} onChange={(e) => setPageToAdd(e.target.value)} className="flex-1">
            <option value="">{t("admin.navSelectPage")}</option>
            {addablePages.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.nav_label || p.title} ({p.slug})
              </option>
            ))}
          </Select>
          <SecondaryButton onClick={addPage} disabled={!pageToAdd}>
            {t("admin.navAddPage")}
          </SecondaryButton>
        </div>
      </div>

      {saveMutation.isError && <p className="text-error text-sm">{String(saveMutation.error)}</p>}
      {saveMutation.isSuccess && !draft && <p className="text-forest-green text-sm">{t("admin.navSaved")}</p>}
    </div>
  );
}
