import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Collection from "./pages/Collection";
import CollectionsPage from "./pages/CollectionsPage";
import ProductDetail from "./pages/ProductDetail";
import BrandExperience from "./pages/BrandExperience";
import PageView from "./pages/PageView";
import BlogsPage from "./pages/BlogsPage";
import BlogPostPage from "./pages/BlogPostPage";
import Admin from "./admin/Admin";
import SiteBranding from "./components/SiteBranding";
import { LanguageProvider } from "./i18n";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <SiteBranding />
      <BrowserRouter>
        <Routes>
          <Route path="/admin/*" element={<Admin />} />
          <Route
            path="*"
            element={
              <div className="bg-surface-container-lowest text-on-surface font-body text-body-md antialiased overflow-x-hidden selection:bg-forest-green selection:text-white min-h-screen flex flex-col">
                <Navbar />
                <div className="flex-grow flex flex-col">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/collections" element={<CollectionsPage />} />
                    <Route path="/collections/:slug" element={<Collection />} />
                    <Route path="/products" element={<Collection />} />
                    <Route path="/products/:slug" element={<ProductDetail />} />
                    <Route path="/brand" element={<BrandExperience />} />
                    <Route path="/pages/:slug" element={<PageView />} />
                    <Route path="/blogs" element={<BlogsPage />} />
                    <Route path="/blogs/:slug" element={<BlogPostPage />} />
                    <Route path="*" element={<Home />} />
                  </Routes>
                </div>
                <Footer />
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
