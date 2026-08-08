import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { TenantAdmin } from "../types";
import { PrimaryButton, TextInput } from "./ui";

export default function TenantPicker({ onSelect }: { onSelect: (slug: string) => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
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
      <li key={tenant.id} className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-body text-body-md text-on-background uppercase truncate">
            {tenant.name}
          </span>
          <code className="font-brand-label text-label-caps text-secondary shrink-0">
            {tenant.slug}
          </code>
          <span
            className={`font-label text-label-caps shrink-0 ${
              tenant.is_active ? "text-forest-green" : "text-error"
            }`}
          >
            {tenant.is_active ? t("admin.tenantActive") : t("admin.tenantDisabled")}
          </span>
        </div>
        <PrimaryButton
          onClick={() => onSelect(tenant.slug)}
          disabled={!tenant.is_active}
        >
          {t("admin.manageTenant")}
        </PrimaryButton>
      </li>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center font-body text-body-md p-6">
      <div className="w-full max-w-2xl bg-white border border-surface-container-highest p-8">
        <h1 className="font-display text-display-lg-mobile text-primary uppercase tracking-tighter mb-2">
          {t("admin.panelTitle")}
        </h1>
        <p className="text-secondary mb-6">{t("admin.selectTenantHint")}</p>

        {notice && <p className="text-forest-green text-sm mb-3">{notice}</p>}
        {error && <p className="text-error text-sm mb-3">{error}</p>}

        {isLoading ? (
          <p className="text-secondary text-sm">{t("admin.loading")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-container-high mb-8">
            {(tenants || []).map(tenantRow)}
          </ul>
        )}

        <h3 className="font-headline text-headline-md text-primary uppercase mb-3">
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
      </div>
    </div>
  );
}
