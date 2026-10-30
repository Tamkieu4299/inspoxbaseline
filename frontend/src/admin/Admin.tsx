import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { MediaLibrary } from "./MediaLibrary";
import { PrimaryButton, SecondaryButton, TextInput, ViInput } from "./ui";
import ProductsTab from "./ProductsTab";
import CollectionsTab from "./CollectionsTab";
import HomeTab from "./HomeTab";
import BrandTab from "./BrandTab";
import PagesTab from "./PagesTab";
import JournalTab from "./JournalTab";
import SiteTab from "./SiteTab";
import OrdersTab from "./OrdersTab";
import UsersTab from "./UsersTab";
import { getAdminProfile } from "../api";
import NavTab from "./NavTab";
import QuizzesTab from "./QuizzesTab";
import TenantPicker from "./TenantPicker";
import AdminShell, { AdminAuthFrame, type AdminTab } from "./AdminShell";
import { useLanguage } from "../i18n";

export default function Admin() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(() => (adminApi.getToken() ? null : false));
  const [tenant, setTenant] = useState<string | null>(
    () => sessionStorage.getItem("inspo_admin_tenant") || null,
  );
  const [tab, setTab] = useState<AdminTab>("home");

  useEffect(() => {
    const token = adminApi.getToken();
    if (!token) {
      setAuthed(false);
      return;
    }
    let cancelled = false;
    adminApi
      .testAuth()
      .then(() => {
        if (!cancelled) setAuthed(true);
      })
      .catch(() => {
        if (!cancelled) {
          adminApi.clearToken();
          setAuthed(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await adminApi.login(username, password);
      adminApi.setToken(res.access_token);
      return res;
    },
    onSuccess: () => {
      adminApi.clearTenant();
      setTenant(null);
      setAuthed(true);
      setPassword("");
    },
    onError: () => setAuthed(false),
  });

  function selectTenant(slug: string) {
    adminApi.setTenant(slug);
    setTenant(slug);
    queryClient.clear();
    setTab("home");
  }

  function logout() {
    adminApi.clearToken();
    adminApi.clearTenant();
    setAuthed(false);
    setTenant(null);
    queryClient.clear();
  }

  if (!authed) {
    if (authed === null) {
      return (
        <AdminAuthFrame title={t("admin.panelTitle")} subtitle={t("admin.hub.loginSubtitle")}>
          <p className="font-label text-label-caps text-muted uppercase">{t("admin.loading")}</p>
        </AdminAuthFrame>
      );
    }
    return (
      <AdminAuthFrame title={t("admin.panelTitle")} subtitle={t("admin.hub.loginSubtitle")}>
        <h2 className="font-headline text-headline-md text-charcoal uppercase mb-6 lg:hidden">{t("admin.login")}</h2>
        <label className="flex flex-col gap-1 mb-4">
          <span className="font-label text-label-caps text-muted uppercase">{t("admin.username")}</span>
          <TextInput
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            autoComplete="username"
          />
        </label>
        <label className="flex flex-col gap-1 mb-4">
          <span className="font-label text-label-caps text-muted uppercase">{t("admin.password")}</span>
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === "Enter" && username && password) loginMutation.mutate();
            }}
          />
        </label>
        {authed === false && <p className="text-error text-sm mb-3">{t("admin.invalidCredentials")}</p>}
        <div className="flex gap-2 flex-wrap">
          <PrimaryButton onClick={() => loginMutation.mutate()} disabled={!username || !password}>
            {t("admin.login")}
          </PrimaryButton>
          <Link to="/">
            <SecondaryButton>{t("admin.backToStore")}</SecondaryButton>
          </Link>
        </div>
        <p className="text-secondary text-sm mt-6">
          {t("admin.keyHint")} <code className="bg-surface-container px-1 py-0.5 text-xs">admin / admin123</code>.{" "}
          {t("admin.keyHint2")}
        </p>
      </AdminAuthFrame>
    );
  }

  if (!tenant) {
    return <TenantPicker onSelect={selectTenant} />;
  }

  const profile = getAdminProfile();
  const isSuperAdmin = profile?.is_super_admin ?? false;

  return (
    <AdminShell
      tenant={tenant}
      tab={tab}
      onTabChange={setTab}
      isSuperAdmin={isSuperAdmin}
      onSwitchStore={() => {
        adminApi.clearTenant();
        setTenant(null);
        queryClient.clear();
      }}
      onLogout={logout}
    >
      {tab === "products" && <ProductsTab />}
      {tab === "collections" && <CollectionsTab />}
      {tab === "media" && <MediaLibrary hubLayout />}
      {tab === "journal" && <JournalTab />}
      {tab === "home" && <HomeTab />}
      {tab === "brand" && <BrandTab />}
      {tab === "pages" && <PagesTab />}
      {tab === "quizzes" && <QuizzesTab />}
      {tab === "site" && <SiteTab />}
      {tab === "orders" && <OrdersTab />}
      {tab === "users" && isSuperAdmin && <UsersTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "nav" && <NavTab />}
    </AdminShell>
  );
}

function CategoriesTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: categories } = useQuery({ queryKey: ["admin-categories"], queryFn: adminApi.getCategories });
  const [name, setName] = useState("");
  const [nameVi, setNameVi] = useState("");
  const [slug, setSlug] = useState("");

  const createMutation = useMutation({
    mutationFn: adminApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setName("");
      setNameVi("");
      setSlug("");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });

  return (
    <div className="bg-white border border-surface-container-highest p-6 max-w-xl shadow-sm">
      <h3 className="font-headline text-headline-md text-charcoal uppercase mb-4">{t("admin.categories")}</h3>
      <div className="flex gap-2 mb-3 flex-wrap">
        <TextInput placeholder={t("admin.categoryName")} value={name} onChange={(e) => setName(e.target.value)} />
        <ViInput
          label={t("admin.categoryName")}
          placeholder="Tên tiếng Việt"
          value={nameVi}
          onChange={(e) => setNameVi(e.target.value)}
        />
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        <TextInput
          placeholder={t("admin.categorySlug")}
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
        />
        <PrimaryButton
          onClick={() => createMutation.mutate({ name, name_vi: nameVi || null, slug })}
          disabled={!name || !slug}
        >
          {t("admin.add")}
        </PrimaryButton>
      </div>
      <ul className="flex flex-col divide-y divide-surface-container-high">
        {(categories || []).map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2">
            <span className="font-body text-body-md text-on-background uppercase">
              {c.name}
              {c.name_vi ? <span className="text-forest-green"> · {c.name_vi}</span> : null}
            </span>
            <span className="flex items-center gap-3">
              <code className="font-brand-label text-label-caps text-secondary">{c.slug}</code>
              <button
                onClick={() => deleteMutation.mutate(c.id)}
                className="font-label text-label-caps text-error hover:underline uppercase"
              >
                {t("admin.delete")}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
