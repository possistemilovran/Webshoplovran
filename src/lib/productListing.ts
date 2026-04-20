import type { Product } from "@/data/types";
import type { ProductOverride } from "@/config/siteDefaults";
import { EMPTY_PRODUCT_IMAGE } from "@/lib/imagePlaceholder";

function isRealProductImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (u === EMPTY_PRODUCT_IMAGE) return false;
  return true;
}

/**
 * Prikaz u mreži trgovine, kolekcije, naslovnici i stranica artikla.
 * Isključuje: eksplicitno sakrivanje, rasprodano, prazne / placeholder slike.
 */
export function productIsListedInStorefront(
  product: Product,
  override?: ProductOverride | null
): boolean {
  if (override?.hideFromShop === true) return false;
  if (product.soldOut) return false;
  if (isRealProductImageUrl(product.image)) return true;
  return product.images.some((u) => isRealProductImageUrl(u));
}
