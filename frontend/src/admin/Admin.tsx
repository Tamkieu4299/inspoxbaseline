import { useState } from "react";
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
import SiteTab from "./SiteTab";
import NavTab from "./NavTab";
import TenantPicker from "./TenantPicker";
import { useLanguage } from "../i18n";

type Tab = "products" | "collections" | "media" | "home" | "brand" | "pages" | "categories" | "nav" | "site";

export default function Admin() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tenant, setTenant] = useState<string | null>(adminApi.getTenant());
  const [tab, setTab] = useState<Tab>("home");

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-body text-body-md">
        <div className="bg-white border border-surface-container-highest p-8 w-full max-w-sm">
          <h1 className="font-display text-display-lg-mobile text-primary uppercase tracking-tighter mb-6">
            {t("admin.panelTitle")}
          </h1>
          <label className="flex flex-col gap-1 mb-4">
            <span className="font-label text-label-caps text-secondary uppercase">{t("admin.username")}</span>
            <TextInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-1 mb-4">
            <span className="font-label text-label-caps text-secondary uppercase">{t("admin.password")}</span>
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
          <div className="flex gap-2">
            <PrimaryButton onClick={() => loginMutation.mutate()} disabled={!username || !password}>
              {t("admin.login")}
            </PrimaryButton>
            <Link to="/">
              <SecondaryButton>{t("admin.backToStore")}</SecondaryButton>
            </Link>
          </div>
          <p className="text-secondary text-sm mt-6">
            {t("admin.keyHint")} <code className="bg-surface-container p-1">admin / admin123</code>.{" "}
            {t("admin.keyHint2")}
          </p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return <TenantPicker onSelect={selectTenant} />;
  }

  return (
    <div className="min-h-screen bg-background font-body text-body-md">
      <header className="bg-primary text-on-primary">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-display text-2xl tracking-tighter uppercase">INSPO</Link>
            <span className="font-label text-label-caps opacity-70">{t("admin.contentAdmin")}</span>
            <span className="font-label text-label-caps uppercase bg-on-primary/10 px-2 py-0.5">
              {tenant}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                adminApi.clearTenant();
                setTenant(null);
                queryClient.clear();
              }}
              className="font-label text-label-caps opacity-80 hover:opacity-100 uppercase"
            >
              {t("admin.switchStore")}
            </button>
            <button
              onClick={logout}
              className="font-label text-label-caps opacity-80 hover:opacity-100 uppercase"
            >
              {t("admin.logout")}
            </button>
            <Link to="/" className="font-label text-label-caps opacity-80 hover:opacity-100 uppercase">
              {t("admin.viewStore")}
            </Link>
          </div>
        </div>
      </header>
      <nav className="bg-surface-container-low border-b border-surface-container-high">
        <div className="max-w-[1600px] mx-auto px-6 flex overflow-x-auto">
          {(
            [
              ["home", t("admin.tab.homepage")],
              ["products", t("admin.tab.products")],
              ["collections", t("admin.tab.collections")],
              ["media", t("admin.tab.media")],
              ["brand", t("admin.tab.brand")],
              ["pages", t("admin.tab.pages")],
              ["categories", t("admin.tab.categories")],
              ["nav", t("admin.tab.nav")],
              ["site", t("admin.tab.site")],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`px-4 py-3 font-label text-label-caps uppercase whitespace-nowrap border-b-2 transition-colors ${
                tab === value
                  ? "border-forest-green text-forest-green"
                  : "border-transparent text-secondary hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {tab === "products" && <ProductsTab />}
        {tab === "collections" && <CollectionsTab />}
        {tab === "media" && <MediaLibrary />}
        {tab === "home" && <HomeTab />}
        {tab === "brand" && <BrandTab />}
        {tab === "pages" && <PagesTab />}
        {tab === "site" && <SiteTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "nav" && <NavTab />}
      </main>
    </div>
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
    <div className="bg-white border border-surface-container-highest p-6 max-w-xl">
      <h3 className="font-headline text-headline-md text-primary uppercase mb-4">{t("admin.categories")}</h3>
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
              {c.name}{c.name_vi ? <span className="text-forest-green"> · {c.name_vi}</span> : null}
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
