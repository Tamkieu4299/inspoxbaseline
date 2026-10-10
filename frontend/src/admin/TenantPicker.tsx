import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, getAdminProfile } from "../api";
import { useLanguage } from "../i18n";
import type { TenantAdmin } from "../types";
import { AdminAuthFrame } from "./AdminShell";
import { PrimaryButton, TextInput } from "./ui";

export default function TenantPicker({ onSelect }: { onSelect: (slug: string) => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isSuperAdmin = getAdminProfile()?.is_super_admin ?? false;
  const { data: tenants, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: adminApi.getTenants,
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function flash(message: string | null, isError = false) {
    setNotice(isError ? null : message);
    setError(isError ? message : null);
  }

  const createMutation = useMutation({
    mutationFn: () => adminApi.createTenant({ slug, name, admin_password: password || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      setName("");
      setSlug("");
      setPassword("");
      flash(t("admin.tenantCreated"));
    },
    onError: (e: Error) => flash(e.message, true),
  });

  function tenantRow(tenant: TenantAdmin) {
    return (
      <li
        key={tenant.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-surface-container-high last:border-0"
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-body text-body-md text-charcoal uppercase truncate">{tenant.name}</span>
          <code className="font-brand-label text-label-caps text-muted shrink-0">{tenant.slug}</code>
          <span
            className={`font-label text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
              tenant.is_active
                ? "border-success/30 text-success bg-success/5"
                : "border-status-danger/30 text-status-danger bg-status-danger/5"
            }`}
          >
            {tenant.is_active ? t("admin.tenantActive") : t("admin.tenantDisabled")}
          </span>
        </div>
        <PrimaryButton onClick={() => onSelect(tenant.slug)} disabled={!tenant.is_active}>
          {t("admin.manageTenant")}
        </PrimaryButton>
      </li>
    );
  }

  return (
    <AdminAuthFrame wide title={t("admin.panelTitle")} subtitle={t("admin.selectTenantHint")}>
      <h2 className="font-headline text-headline-md text-charcoal uppercase mb-2">{t("admin.tenants")}</h2>
      <p className="text-secondary text-sm mb-6">{t("admin.selectTenantHint")}</p>

      {notice && <p className="text-success text-sm mb-3">{notice}</p>}
      {error && <p className="text-error text-sm mb-3">{error}</p>}

      {isLoading ? (
        <p className="text-secondary text-sm">{t("admin.loading")}</p>
      ) : (
        <ul className="mb-8">{tenants?.map(tenantRow)}</ul>
      )}

      {isSuperAdmin && (
        <>
      <h3 className="font-label text-label-caps text-forest-green uppercase mb-3 tracking-wider">
        {t("admin.tenantCreate")}
      </h3>
      <div className="flex flex-col gap-3">
        <TextInput
          placeholder={t("admin.tenantName")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value));
          }}
        />
        <TextInput
          placeholder={t("admin.tenantSlug")}
          value={slug}
          onChange={(e) => setSlug(slugify(e.target.value))}
        />
        <TextInput
          type="password"
          placeholder={t("admin.tenantOptionalPassword")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div>
          <PrimaryButton onClick={() => createMutation.mutate()} disabled={!name || !slug}>
            {t("admin.tenantCreate")}
          </PrimaryButton>
        </div>
      </div>
        </>
      )}
    </AdminAuthFrame>
  );
}
