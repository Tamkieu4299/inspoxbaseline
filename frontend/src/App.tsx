import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import StorefrontShell from "./components/StorefrontShell";
import Home from "./pages/Home";
import Collection from "./pages/Collection";
import CollectionsPage from "./pages/CollectionsPage";
import ProductDetail from "./pages/ProductDetail";
import BrandExperience from "./pages/BrandExperience";
import PageView from "./pages/PageView";
import BlogsPage from "./pages/BlogsPage";
import BlogPostPage from "./pages/BlogPostPage";
import QuizRunner from "./pages/QuizRunner";
import Admin from "./admin/Admin";
import SiteBranding from "./components/SiteBranding";
import { LanguageProvider } from "./i18n";
import { CartProvider } from "./cart/CartContext";
import { StoreCurrencyProvider } from "./useStoreCurrency";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderThankYouPage from "./pages/OrderThankYouPage";
import OrderLookupPage from "./pages/OrderLookupPage";

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
              <StoreCurrencyProvider>
                <CartProvider>
                <StorefrontShell>
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
                    <Route path="/quizzes/:slug" element={<QuizRunner />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/orders/thank-you" element={<OrderThankYouPage />} />
                    <Route path="/orders/track" element={<OrderLookupPage />} />
                    <Route path="*" element={<Home />} />
                  </Routes>
                </StorefrontShell>
                </CartProvider>
              </StoreCurrencyProvider>
            }
          />
        </Routes>
      </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
