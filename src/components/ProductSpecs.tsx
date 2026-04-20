import { useTranslation } from "react-i18next";
import type { Product } from "@/data/types";
import { formatCmWithInches } from "@/lib/productDimensions";
import { TranslatedText } from "@/components/TranslatedText";

type Props = {
  product: Product;
  className?: string;
};

export function ProductSpecs({ product, className = "" }: Props) {
  const { t } = useTranslation();
  const rows: {
    key: string;
    label: string;
    value: string;
    translateValue?: boolean;
  }[] = [];

  if (product.widthCm != null && product.widthCm > 0) {
    rows.push({
      key: "w",
      label: t("product.specWidth"),
      value: formatCmWithInches(product.widthCm),
    });
  }
  if (product.heightCm != null && product.heightCm > 0) {
    rows.push({
      key: "h",
      label: t("product.specHeight"),
      value: formatCmWithInches(product.heightCm),
    });
  }
  if (product.diameterCm != null && product.diameterCm > 0) {
    rows.push({
      key: "d",
      label: t("product.specDiameter"),
      value: formatCmWithInches(product.diameterCm),
    });
  }
  const shape = product.shape?.trim();
  if (shape) {
    rows.push({
      key: "s",
      label: t("product.specShape"),
      value: shape,
      // Ako je oblik već spremljen preveden u overrides (skip flag), ne
      // prevodimo ga runtime — izbjegavamo ovisnost o /__translate__ proxyju.
      translateValue: !product.skipMachineTranslateShape,
    });
  }

  if (rows.length === 0) return null;

  return (
    <dl className={`product-specs ${className}`.trim()}>
      {rows.map(({ key, label, value, translateValue }) => (
        <div key={key} className="product-specs__row">
          <dt className="product-specs__term">{label}</dt>
          <dd className="product-specs__value">
            {translateValue ? (
              <TranslatedText text={value} />
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
