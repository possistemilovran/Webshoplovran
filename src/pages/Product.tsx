import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { MaybeTranslated } from "@/components/MaybeTranslated";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import {
  useResolvedCollections,
  useResolvedProduct,
} from "@/hooks/useResolvedCatalog";
import { EMPTY_PRODUCT_IMAGE } from "@/lib/imagePlaceholder";
import { productIsListedInStorefront } from "@/lib/productListing";
import { ProductSpecs } from "@/components/ProductSpecs";

export function Product() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const { settings } = useSiteSettings();
  const product = useResolvedProduct(slug);
  const collections = useResolvedCollections();
  const productOverride = slug
    ? settings.productOverrides[slug] ?? null
    : null;
  const { add } = useCart();
  const [imgIndex, setImgIndex] = useState(0);

  const gallery = useMemo(() => {
    if (!product) return [];
    const fromList = product.images.map((s) => s.trim()).filter(Boolean);
    if (fromList.length > 0) return fromList;
    const main = product.image.trim();
    return main ? [main] : [EMPTY_PRODUCT_IMAGE];
  }, [product]);

  if (
    !product ||
    !productIsListedInStorefront(product, productOverride)
  ) {
    return (
      <div className="page container page--narrow">
        <h1>{t("product.notFoundTitle")}</h1>
        <p>
          <Link to="/shop">{t("product.notFoundLink")}</Link>
        </p>
      </div>
    );
  }

  const cols = collections.filter((c) => product.collectionIds.includes(c.id));

  return (
    <div className="page container product-page">
      <div className="product-page__grid">
        <div className="product-page__gallery">
          <div className="product-page__hero-visual">
            <div className="product-page__main-img">
              <img
                src={gallery[imgIndex]}
                alt=""
                width={800}
                height={1000}
              />
            </div>
            <aside
              className="product-page__slug-rail"
              aria-label={t("product.slugAria", { slug: product.slug })}
            >
              <span className="product-page__slug-mono" aria-hidden="true">
                {product.slug}
              </span>
            </aside>
          </div>
          {gallery.length > 1 && (
            <div className="product-page__thumbs">
              {gallery.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  className={i === imgIndex ? "is-active" : ""}
                  onClick={() => setImgIndex(i)}
                  aria-label={t("product.imageThumb", { n: i + 1 })}
                >
                  <img src={src} alt="" width={80} height={100} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-page__detail">
          <p className="eyebrow product-page__collections">
            {cols.length > 0
              ? cols.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 ? " · " : null}
                    <Link to={`/collections/${c.slug}`}>
                      <MaybeTranslated
                        text={c.title}
                        skipTranslate={c.skipMachineTranslateTitle}
                      />
                    </Link>
                  </span>
                ))
              : t("product.collectionsFallback")}
          </p>
          <h1 className="product-page__title">
            <MaybeTranslated
              text={product.title}
              skipTranslate={product.skipMachineTranslateTitle}
            />
          </h1>
          <p className="product-page__price">
            {formatMoney(product.price, product.currency)}
          </p>
          {product.soldOut ? (
            <p className="product-page__soldout">{t("product.soldOut")}</p>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => add(product, 1)}
            >
              {t("product.addToCart")}
            </button>
          )}
          <div className="prose">
            {product.shortDescription.trim() !== "" ? (
              <p className="product-page__short">
                <MaybeTranslated
                  text={product.shortDescription}
                  skipTranslate={product.skipMachineTranslateShort}
                />
              </p>
            ) : null}
            <ProductSpecs product={product} className="product-page__specs" />
            <p>
              <MaybeTranslated
                text={product.description}
                skipTranslate={product.skipMachineTranslateDescription}
              />
            </p>
          </div>
          <ul className="product-page__facts">
            <li>{t("product.fact1")}</li>
            <li>{t("product.fact2")}</li>
            <li>{t("product.fact3")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
