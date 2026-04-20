import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Product } from "@/data/types";
import { formatMoney } from "@/lib/format";
import { productImageSrc } from "@/lib/imagePlaceholder";
import { useCart } from "@/context/CartContext";
import { MaybeTranslated } from "@/components/MaybeTranslated";
import { ProductSpecs } from "@/components/ProductSpecs";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { t } = useTranslation();

  return (
    <article className="product-card">
      <Link to={`/products/${product.slug}`} className="product-card__media">
        <img
          src={productImageSrc(product.image)}
          alt=""
          loading="lazy"
          width={600}
          height={750}
        />
        {product.soldOut && (
          <span className="product-card__badge">{t("product.soldOut")}</span>
        )}
      </Link>
      <div className="product-card__body">
        <Link to={`/products/${product.slug}`} className="product-card__title">
          <MaybeTranslated
            text={product.title}
            skipTranslate={product.skipMachineTranslateTitle}
          />
        </Link>
        {product.shortDescription.trim() !== "" ? (
          <p className="product-card__lede">
            <MaybeTranslated
              text={product.shortDescription}
              skipTranslate={product.skipMachineTranslateShort}
            />
          </p>
        ) : null}
        <ProductSpecs product={product} className="product-card__specs" />
        <p className="product-card__price">
          {formatMoney(product.price, product.currency)}
        </p>
        {!product.soldOut ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => add(product, 1)}
          >
            {t("product.addToCart")}
          </button>
        ) : (
          <span className="product-card__muted">
            {t("product.soldOutShort")}
          </span>
        )}
      </div>
    </article>
  );
}
