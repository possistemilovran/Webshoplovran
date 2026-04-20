export { products, collections, storeCurrency } from "./catalog";
export { reviews } from "./reviews";
export type { Product, Collection } from "./types";

import { collections } from "./catalog";
import { products } from "./catalog";

export function getProductBySlug(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function getCollectionBySlug(slug: string) {
  return collections.find((c) => c.slug === slug);
}

export function getProductsByCollectionSlug(slug: string) {
  const col = getCollectionBySlug(slug);
  if (!col) return [];
  return products.filter((p) => p.collectionIds.includes(col.id));
}
