import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ProductCard } from "@/components/ProductCard";
import { MaybeTranslated } from "@/components/MaybeTranslated";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { productIsListedInStorefront } from "@/lib/productListing";
import {
  useCollectionProducts,
  useResolvedCollection,
} from "@/hooks/useResolvedCatalog";
import {
  PRODUCT_GRID_ANCHOR_ID,
  useScrollToProductGrid,
} from "@/hooks/useScrollToProductGrid";
import { publicAssetUrl } from "@/lib/publicUrl";

export function Collection() {
  const { t } = useTranslation();
  useScrollToProductGrid();
  const { slug } = useParams();
  const { settings } = useSiteSettings();
  const collection = useResolvedCollection(slug);
  const items = useCollectionProducts(slug);

  const listedItems = useMemo(() => {
    const ov = settings.productOverrides;
    return items.filter((p) =>
      productIsListedInStorefront(p, ov[p.slug] ?? ov[p.id] ?? null)
    );
  }, [items, settings.productOverrides]);

  if (!collection) {
    return (
      <div className="page container page--narrow">
        <h1>{t("collection.notFoundTitle")}</h1>
        <p>
          <Link to="/shop">{t("collection.notFoundLink")}</Link>
        </p>
      </div>
    );
  }

  const hero = collection.heroImage.trim();

  return (
    <div>
      <div className={`collection-hero${hero ? "" : " collection-hero--no-image"}`}>
        {hero ? (
          <img
            src={publicAssetUrl(hero)}
            alt=""
            className="collection-hero__img"
          />
        ) : null}
        <div className="collection-hero__overlay">
          <div className="container">
            <p className="eyebrow">{t("collection.heroEyebrow")}</p>
            <h1 className="collection-hero__title">
              <MaybeTranslated
                text={collection.title}
                skipTranslate={collection.skipMachineTranslateTitle}
              />
            </h1>
            <p className="collection-hero__desc">
              <MaybeTranslated
                text={collection.description}
                skipTranslate={collection.skipMachineTranslateDescription}
              />
            </p>
          </div>
        </div>
      </div>
      <div className="page container">
        <div className="product-grid" id={PRODUCT_GRID_ANCHOR_ID}>
          {listedItems.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {listedItems.length === 0 && <p>{t("collection.empty")}</p>}
      </div>
    </div>
  );
}
