import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "@/context/CartContext";
import { storeCurrency } from "@/data/catalog";
import { formatMoney } from "@/lib/format";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useResolvedProducts } from "@/hooks/useResolvedCatalog";
import { MaybeTranslated } from "@/components/MaybeTranslated";
import type { Product } from "@/data/types";

export function Checkout() {
  const { t } = useTranslation();
  const { settings } = useSiteSettings();
  const threshold = Number(settings.cart.giftThreshold) || 0;
  const products = useResolvedProducts();
  const { lines, clear } = useCart();
  const [done, setDone] = useState(false);

  const resolved = lines
    .map((line) => {
      const p = products.find((x) => x.id === line.productId);
      return p ? { line, product: p } : null;
    })
    .filter(Boolean) as { line: { quantity: number }; product: Product }[];

  const subtotal = resolved.reduce(
    (sum, { line, product }) => sum + product.price * line.quantity,
    0
  );
  const currency = resolved[0]?.product.currency ?? storeCurrency;
  const giftEligible = subtotal >= threshold;

  if (done) {
    return (
      <div className="page container page--narrow checkout-success">
        <h1>{t("checkout.successTitle")}</h1>
        <p>{t("checkout.successText")}</p>
        <Link to="/shop" className="btn btn--primary">
          {t("checkout.continueButton")}
        </Link>
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="page container page--narrow">
        <h1>{t("checkout.emptyTitle")}</h1>
        <p>{t("checkout.emptyMessage")}</p>
        <Link to="/shop" className="btn btn--primary">
          {t("checkout.browseButton")}
        </Link>
      </div>
    );
  }

  return (
    <div className="page container checkout-page">
      <h1>{t("checkout.pageTitle")}</h1>
      <p className="checkout-page__note">{t("checkout.pageNote")}</p>
      <div className="checkout-page__grid">
        <form
          className="checkout-form"
          onSubmit={(e) => {
            e.preventDefault();
            clear();
            setDone(true);
          }}
        >
          <fieldset>
            <legend>{t("checkout.contactLegend")}</legend>
            <label>
              {t("checkout.emailLabel")}
              <input className="input" type="email" required name="email" />
            </label>
          </fieldset>
          <fieldset>
            <legend>{t("checkout.shippingLegend")}</legend>
            <label>
              {t("checkout.nameLabel")}
              <input className="input" type="text" required name="name" />
            </label>
            <label>
              {t("checkout.addressLabel")}
              <input className="input" type="text" required name="address" />
            </label>
            <div className="checkout-form__row">
              <label>
                {t("checkout.cityLabel")}
                <input className="input" type="text" required name="city" />
              </label>
              <label>
                {t("checkout.zipLabel")}
                <input className="input" type="text" required name="zip" />
              </label>
            </div>
            <label>
              {t("checkout.countryLabel")}
              <input className="input" type="text" required name="country" />
            </label>
          </fieldset>
          <button type="submit" className="btn btn--primary btn--lg btn--block">
            {t("checkout.submitButton")}
          </button>
        </form>
        <aside
          className="checkout-summary"
          aria-label={t("checkout.summaryTitle")}
        >
          <h2>{t("checkout.summaryTitle")}</h2>
          <ul className="checkout-summary__lines">
            {resolved.map(({ line, product }) => (
              <li key={product.id}>
                <span>
                  <MaybeTranslated
                    text={product.title}
                    as="span"
                    skipTranslate={product.skipMachineTranslateTitle}
                  />{" "}
                  × {line.quantity}
                </span>
                <span>
                  {formatMoney(product.price * line.quantity, product.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="checkout-summary__subtotal">
            <span>{t("cart.subtotalLabel")}</span>
            <strong>{formatMoney(subtotal, currency)}</strong>
          </div>
          {giftEligible && (
            <p className="cart-gift cart-gift--yes">
              {t("checkout.giftIncluded")}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
