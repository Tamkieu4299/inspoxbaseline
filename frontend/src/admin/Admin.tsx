import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { MediaLibrary } from "./MediaLibrary";
import { PrimaryButton, SecondaryButton, TextInput, ViInput } from "./ui";
import ProductsTab from "./ProductsTab";
import CategoriesTab from "./CategoriesTab";
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
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<AdminTab>(() => {
    const fromUrl = searchParams.get("tab");
    const allowed: AdminTab[] = [
      "orders",
      "products",
      "collections",
      "media",
      "home",
      "brand",
      "pages",
      "journal",
      "quizzes",
      "categories",
      "nav",
      "site",
      "users",
    ];
    return allowed.includes(fromUrl as AdminTab) ? (fromUrl as AdminTab) : "home";
  });

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

