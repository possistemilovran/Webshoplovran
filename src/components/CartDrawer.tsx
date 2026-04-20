import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "@/context/CartContext";
import { storeCurrency } from "@/data/catalog";
import { formatMoney } from "@/lib/format";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useResolvedProducts } from "@/hooks/useResolvedCatalog";
import { MaybeTranslated } from "@/components/MaybeTranslated";
import { productImageSrc } from "@/lib/imagePlaceholder";
import type { Product } from "@/data/types";

export function CartDrawer() {
  const { t } = useTranslation();
  const { settings } = useSiteSettings();
  const threshold = Number(settings.cart.giftThreshold) || 0;
  const products = useResolvedProducts();
  const { lines, open, setOpen, setQty, remove, clear } = useCart();

  const resolved = lines
    .map((line) => {
      const p = products.find((x) => x.id === line.productId);
      return p ? { line, product: p } : null;
    })
    .filter(Boolean) as { line: { productId: string; quantity: number }; product: Product }[];

  const subtotal = resolved.reduce(
    (sum, { line, product }) => sum + product.price * line.quantity,
    0
  );
  const currency = resolved[0]?.product.currency ?? storeCurrency;
  const giftEligible = subtotal >= threshold;
  const amountStr = formatMoney(threshold, storeCurrency);
  const giftYes = t("cart.giftEligible", { gift: t("cart.giftTitle") });
  const giftNo = t("cart.giftBelow", { amount: amountStr });

  return (
    <>
      <div
        className={`cart-backdrop ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`cart-drawer ${open ? "is-open" : ""}`}
        aria-label={t("cart.drawerTitle")}
        aria-hidden={!open}
      >
        <div className="cart-drawer__head">
          <h2 className="cart-drawer__title">{t("cart.drawerTitle")}</h2>
          <button
            type="button"
            className="cart-drawer__close"
            onClick={() => setOpen(false)}
            aria-label={t("cart.closeCartAria")}
          >
            ✕
          </button>
        </div>

        {resolved.length === 0 ? (
          <p className="cart-drawer__empty">{t("cart.emptyMessage")}</p>
        ) : (
          <ul className="cart-lines">
            {resolved.map(({ line, product }) => (
              <li key={product.id} className="cart-line">
                <img src={productImageSrc(product.image)} alt="" width={72} height={90} />
                <div className="cart-line__info">
                  <Link
                    to={`/products/${product.slug}`}
                    onClick={() => setOpen(false)}
                  >
                    <MaybeTranslated
                      text={product.title}
                      skipTranslate={product.skipMachineTranslateTitle}
                    />
                  </Link>
                  <p className="cart-line__price">
                    {formatMoney(product.price, product.currency)}{" "}
                    {t("cart.eachSuffix")}
                  </p>
                  <div className="cart-line__qty">
                    <button
                      type="button"
                      aria-label={t("cart.decreaseQtyAria")}
                      onClick={() => setQty(product.id, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      aria-label={t("cart.increaseQtyAria")}
                      onClick={() => setQty(product.id, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="cart-line__remove"
                  onClick={() => remove(product.id)}
                  aria-label={`${t("cart.removeButton")} ${product.title}`}
                >
                  {t("cart.removeButton")}
                </button>
              </li>
            ))}
          </ul>
        )}

        {resolved.length > 0 && (
          <div className="cart-drawer__footer">
            <div className="cart-subtotal">
              <span>{t("cart.subtotalLabel")}</span>
              <strong>{formatMoney(subtotal, currency)}</strong>
            </div>
            {giftEligible ? (
              <p className="cart-gift cart-gift--yes">{giftYes}</p>
            ) : (
              <p className="cart-gift">{giftNo}</p>
            )}
            <div className="cart-drawer__actions">
              <Link
                to="/checkout"
                className="btn btn--primary btn--block"
                onClick={() => setOpen(false)}
              >
                {t("cart.checkoutButton")}
              </Link>
              <button type="button" className="btn btn--ghost" onClick={clear}>
                {t("cart.clearButton")}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
