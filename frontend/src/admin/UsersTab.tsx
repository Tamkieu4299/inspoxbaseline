import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { AdminUserRecord } from "../types";
import { Checkbox, Field, PrimaryButton, SecondaryButton, TextInput } from "./ui";

export default function UsersTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: adminApi.getAdminUsers });
  const { data: tenants } = useQuery({ queryKey: ["admin-tenants"], queryFn: adminApi.getTenants });

  const [username, setUsername] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [tenantIds, setTenantIds] = useState<number[]>([]);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createAdminUser({
        username: username.trim().toLowerCase(),
        is_super_admin: isSuper,
        tenant_ids: isSuper ? [] : tenantIds,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCreatedPassword(res.generated_password);
      setUsername("");
      setTenantIds([]);
      setIsSuper(false);
    },
  });

  const resetMutation = useMutation({
    mutationFn: (id: number) => adminApi.resetAdminUserPassword(id),
    onSuccess: (res) => setCreatedPassword(res.generated_password),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<AdminUserRecord> }) =>
      adminApi.updateAdminUser(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditId(null);
    },
  });

  function toggleTenant(id: number) {
    setTenantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  if (isLoading) {
    return <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>;
  }

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      <div>
        <h2 className="font-headline text-headline-md text-primary uppercase">{t("admin.usersTitle")}</h2>
        <p className="font-body text-body-md text-secondary mt-1">{t("admin.usersSubtitle")}</p>
      </div>

      {createdPassword && (
        <div className="border border-forest-green bg-surface-container-low p-4 rounded">
          <p className="font-label text-label-caps uppercase text-primary mb-2">{t("admin.generatedPassword")}</p>
          <code className="text-lg select-all break-all">{createdPassword}</code>
          <p className="text-secondary text-sm mt-2">{t("admin.generatedPasswordHint")}</p>
          <SecondaryButton type="button" className="mt-3" onClick={() => setCreatedPassword(null)}>
            {t("admin.dismiss")}
          </SecondaryButton>
        </div>
      )}

      <section className="bg-white border border-surface-container-highest p-6 flex flex-col gap-4">
        <h3 className="font-headline text-headline-sm uppercase">{t("admin.createUser")}</h3>
        <Field label={t("admin.username")}>
          <TextInput
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="jane.ops"
            autoComplete="off"
          />
        </Field>
        <label className="flex items-center gap-2 font-body text-body-md">
          <Checkbox checked={isSuper} onChange={(e) => setIsSuper(e.target.checked)} />
          {t("admin.superAdmin")}
        </label>
        {!isSuper && (
          <div className="flex flex-col gap-2">
            <span className="font-label text-label-caps uppercase text-secondary text-xs">{t("admin.assignTenants")}</span>
            {(tenants || []).map((tn) => (
              <label key={tn.id} className="flex items-center gap-2 font-body text-body-md">
                <Checkbox checked={tenantIds.includes(tn.id)} onChange={() => toggleTenant(tn.id)} />
                {tn.name} <code className="text-xs text-secondary">{tn.slug}</code>
              </label>
            ))}
          </div>
        )}
        <PrimaryButton
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={!username.trim() || createMutation.isPending || (!isSuper && tenantIds.length === 0)}
        >
          {t("admin.createUser")}
        </PrimaryButton>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-headline text-headline-sm uppercase">{t("admin.existingUsers")}</h3>
        {(users || []).map((u) => (
          <div key={u.id} className="border border-surface-container-high p-4 bg-white flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-headline text-headline-md uppercase">{u.username}</span>
              <div className="flex gap-2 flex-wrap">
                {u.is_super_admin && (
                  <span className="font-label text-[10px] uppercase px-2 py-0.5 bg-primary text-on-primary">{t("admin.superAdmin")}</span>
                )}
                {!u.is_active && (
                  <span className="font-label text-[10px] uppercase px-2 py-0.5 border border-error text-error">{t("admin.disabled")}</span>
                )}
              </div>
            </div>
            {!u.is_super_admin && (
              <p className="text-secondary text-sm">
                {t("admin.userTenants")}:{" "}
                {(tenants || [])
                  .filter((tn) => u.tenant_ids.includes(tn.id))
                  .map((tn) => tn.slug)
                  .join(", ") || "—"}
              </p>
            )}
            <div className="flex gap-2 flex-wrap mt-1">
              <SecondaryButton type="button" onClick={() => resetMutation.mutate(u.id)} disabled={resetMutation.isPending}>
                {t("admin.resetPassword")}
              </SecondaryButton>
              <SecondaryButton type="button" onClick={() => setEditId(editId === u.id ? null : u.id)}>
                {t("admin.editAssignments")}
              </SecondaryButton>
            </div>
            {editId === u.id && !u.is_super_admin && (
              <div className="mt-2 pt-2 border-t flex flex-col gap-2">
                {(tenants || []).map((tn) => (
                  <label key={tn.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={u.tenant_ids.includes(tn.id)}
                      onChange={() => {
                        const next = u.tenant_ids.includes(tn.id)
                          ? u.tenant_ids.filter((x) => x !== tn.id)
                          : [...u.tenant_ids, tn.id];
                        if (next.length === 0) return;
                        updateMutation.mutate({ id: u.id, body: { tenant_ids: next } });
                      }}
                    />
                    {tn.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
