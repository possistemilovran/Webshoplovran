import type { Collection, Product } from "./types";
import raw from "./storeCatalog.json";
import imageMap from "./imageLocalMap.json";

function resolveMediaUrl(url: string): string {
  if (!url) return url;
  const entry = (imageMap as Record<string, string>)[url];
  return entry ?? url;
}

function mapProduct(p: Product): Product {
  return {
    ...p,
    image: resolveMediaUrl(p.image),
    images: p.images.map(resolveMediaUrl),
  };
}

function mapCollection(c: Collection): Collection {
  return {
    ...c,
    heroImage: resolveMediaUrl(c.heroImage),
  };
}

export const storeCurrency = raw.currency as string;
export const products = (raw.products as Product[]).map(mapProduct);
export const collections = (raw.collections as Collection[]).map(
  mapCollection
);
