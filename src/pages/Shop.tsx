import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ProductCard } from "@/components/ProductCard";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useResolvedProducts } from "@/hooks/useResolvedCatalog";
import { productIsListedInStorefront } from "@/lib/productListing";
import {
  PRODUCT_GRID_ANCHOR_ID,
  useScrollToProductGrid,
} from "@/hooks/useScrollToProductGrid";

export function Shop() {
  const { t } = useTranslation();
  useScrollToProductGrid();
  const [params] = useSearchParams();
  const q = params.get("q")?.trim().toLowerCase() ?? "";
  const { settings } = useSiteSettings();
  const products = useResolvedProducts();

  const listed = useMemo(() => {
    const ov = settings.productOverrides;
    return products.filter((p) =>
      productIsListedInStorefront(p, ov[p.slug] ?? ov[p.id] ?? null)
    );
  }, [products, settings.productOverrides]);

  const filtered = useMemo(() => {
    if (!q) return listed;
    return listed.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q)
    );
  }, [q, listed]);

  const qDisplay = params.get("q")?.trim() ?? "";

  return (
    <div className="page container">
      <header className="page__header">
        <p className="eyebrow">{t("shop.eyebrow")}</p>
        <h1>{t("shop.title")}</h1>
        {q ? (
          <p className="page__lede">
            {t("shop.searchIntro", { query: qDisplay })}{" "}
            {filtered.length}{" "}
            {filtered.length === 1
              ? t("shop.oneResult")
              : t("shop.manyResults")}
            .
          </p>
        ) : (
          <p className="page__lede">{t("shop.ledeDefault")}</p>
        )}
      </header>
      <div className="product-grid" id={PRODUCT_GRID_ANCHOR_ID}>
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
