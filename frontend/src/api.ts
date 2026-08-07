import type {
  BlogPost,
  BrandData,
  Category,
  Collection,
  EditorialItem,
  HomeContentAdmin,
  HomeData,
  Media,
  Page,
  PageNav,
  Product,
  SitePublic,
  SiteSettings,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "";

const langQ = (lang?: string) => (lang ? `lang=${encodeURIComponent(lang)}` : "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getHome: (lang?: string) => request<HomeData>(`/api/home?${langQ(lang)}`),
  getCollections: (lang?: string) => request<Collection[]>(`/api/collections?${langQ(lang)}`),
  getCollection: (slug: string, lang?: string) =>
    request<Collection>(`/api/collections/${slug}?${langQ(lang)}`),
  getProducts: (params?: Record<string, string | undefined>) => {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, v as string])).toString()}` : "";
    return request<Product[]>(`/api/products${qs}`);
  },
  getProduct: (slug: string, lang?: string) =>
    request<Product>(`/api/products/${slug}?${langQ(lang)}`),
  getCategories: (lang?: string) => request<Category[]>(`/api/categories?${langQ(lang)}`),
  getBrand: (lang?: string) => request<BrandData>(`/api/brand?${langQ(lang)}`),
  getMedia: () => request<Media[]>("/api/media"),
  getPages: (lang?: string) => request<PageNav[]>(`/api/pages?${langQ(lang)}`),
  getPage: (slug: string, lang?: string) => request<Page>(`/api/pages/${slug}?${langQ(lang)}`),
  getBlogPosts: (lang?: string) => request<BlogPost[]>(`/api/blog-posts?${langQ(lang)}`),
  getBlogPost: (slug: string, lang?: string) =>
    request<BlogPost>(`/api/blog-posts/${slug}?${langQ(lang)}`),
  getSite: () => request<SitePublic>("/api/site"),
};

const adminKey = () => sessionStorage.getItem("inspo_admin_key") || "";

function adminHeaders(key?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Admin-Key": key || adminKey(),
  };
}

export const adminApi = {
  setKey(key: string) {
    sessionStorage.setItem("inspo_admin_key", key);
  },
  getKey: adminKey,
  testKey: (key: string) =>
    request<Collection[]>(`/api/admin/collections`, { headers: adminHeaders(key) }),

  getCollections: () => request<Collection[]>(`/api/admin/collections`, { headers: adminHeaders() }),
  createCollection: (body: unknown) =>
    request<Collection>(`/api/admin/collections`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
  updateCollection: (id: number, body: unknown) =>
    request<Collection>(`/api/admin/collections/${id}`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
  deleteCollection: (id: number) =>
    request(`/api/admin/collections/${id}`, { method: "DELETE", headers: adminHeaders() }),

  getProducts: () => request<Product[]>(`/api/admin/products`, { headers: adminHeaders() }),
  createProduct: (body: unknown) =>
    request<Product>(`/api/admin/products`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
  updateProduct: (id: number, body: unknown) =>
    request<Product>(`/api/admin/products/${id}`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
  deleteProduct: (id: number) =>
    request(`/api/admin/products/${id}`, { method: "DELETE", headers: adminHeaders() }),

  getCategories: () => request<Category[]>(`/api/admin/categories`, { headers: adminHeaders() }),
  createCategory: (body: unknown) =>
    request<Category>(`/api/admin/categories`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
  deleteCategory: (id: number) =>
    request(`/api/admin/categories/${id}`, { method: "DELETE", headers: adminHeaders() }),

  getMedia: () => request<Media[]>(`/api/admin/media`, { headers: adminHeaders() }),
  uploadMedia: async (file: File | Blob, name?: string) => {
    const form = new FormData();
    const uploadFile =
      file instanceof File ? file : new File([file], name || "image.jpg", { type: file.type || "image/jpeg" });
    form.append("file", uploadFile);
    const res = await fetch(`${API_BASE}/api/admin/media/upload`, {
      method: "POST",
      headers: { "X-Admin-Key": adminKey() },
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  replaceMedia: async (id: number, file: File | Blob) => {
    const form = new FormData();
    const uploadFile =
      file instanceof File ? file : new File([file], "crop.jpg", { type: file.type || "image/jpeg" });
    form.append("file", uploadFile);
    const res = await fetch(`${API_BASE}/api/admin/media/${id}`, {
      method: "PUT",
      headers: { "X-Admin-Key": adminKey() },
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  deleteMedia: (id: number) =>
    request(`/api/admin/media/${id}`, { method: "DELETE", headers: adminHeaders() }),

  getHome: () => request<HomeContentAdmin>(`/api/admin/home`, { headers: adminHeaders() }),
  updateHome: (body: unknown) =>
    request<HomeContentAdmin>(`/api/admin/home`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),

  getEditorial: () => request<EditorialItem[]>(`/api/admin/editorial`, { headers: adminHeaders() }),
  createEditorial: (body: unknown) =>
    request<EditorialItem>(`/api/admin/editorial`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
  updateEditorial: (id: number, body: unknown) =>
    request<EditorialItem>(`/api/admin/editorial/${id}`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
  deleteEditorial: (id: number) =>
    request(`/api/admin/editorial/${id}`, { method: "DELETE", headers: adminHeaders() }),

  getPages: () => request<Page[]>(`/api/admin/pages`, { headers: adminHeaders() }),
  createPage: (body: unknown) =>
    request<Page>(`/api/admin/pages`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
  updatePage: (id: number, body: unknown) =>
    request<Page>(`/api/admin/pages/${id}`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
  deletePage: (id: number) =>
    request(`/api/admin/pages/${id}`, { method: "DELETE", headers: adminHeaders() }),

  getBlogPosts: () => request<BlogPost[]>(`/api/admin/blog-posts`, { headers: adminHeaders() }),
  createBlogPost: (body: unknown) =>
    request<BlogPost>(`/api/admin/blog-posts`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
  updateBlogPost: (id: number, body: unknown) =>
    request<BlogPost>(`/api/admin/blog-posts/${id}`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
  deleteBlogPost: (id: number) =>
    request(`/api/admin/blog-posts/${id}`, { method: "DELETE", headers: adminHeaders() }),

  getSite: () => request<SiteSettings>(`/api/admin/site`, { headers: adminHeaders() }),
  updateSite: (body: unknown) =>
    request<SiteSettings>(`/api/admin/site`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }),
};
