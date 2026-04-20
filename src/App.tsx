import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

/** Na GitHub Pages projekt je pod /RepoName/ — mora se podudarati s `vite build --base=`. */
function routerBasename(): string | undefined {
  const raw = import.meta.env.BASE_URL;
  if (raw === "/") return undefined;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}
import { CartProvider } from "@/context/CartContext";
import { SiteSettingsProvider } from "@/context/SiteSettingsContext";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Shop } from "@/pages/Shop";
import { Collection } from "@/pages/Collection";
import { Product } from "@/pages/Product";
import { About } from "@/pages/About";
import { Checkout } from "@/pages/Checkout";
import { NotFound } from "@/pages/NotFound";
import { Contact } from "@/pages/Contact";
import { Blog } from "@/pages/Blog";
import { EditorProducts } from "@/pages/EditorProducts";
import { EditorAutoTranslate } from "@/pages/EditorAutoTranslate";
import { EditorPage } from "@/pages/EditorPage";

export default function App() {
  return (
    <BrowserRouter basename={routerBasename()}>
      <SiteSettingsProvider>
        <CartProvider>
          <Routes>
            <Route path="editor" element={<EditorProducts />} />
            <Route path="urednik-auto" element={<EditorAutoTranslate />} />
            <Route path="urednik-stranica" element={<EditorPage />} />
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="shop" element={<Shop />} />
              <Route path="collections/:slug" element={<Collection />} />
              <Route path="products/:slug" element={<Product />} />
              <Route path="pages/about" element={<About />} />
              <Route path="pages/contact" element={<Contact />} />
              <Route path="blogs/news" element={<Blog />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
          </Routes>
        </CartProvider>
      </SiteSettingsProvider>
    </BrowserRouter>
  );
}
