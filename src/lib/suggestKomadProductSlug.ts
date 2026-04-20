import type { Product } from "@/data/types";

/**
 * Prvi slobodni slug u uzorku `{collectionSlug}-komad-{broj}`.
 * Popunjava i rupe (npr. ako postoje 1,2,4 predlaže 3).
 */
export function suggestNextKomadSlugForCollection(
  collectionSlug: string,
  catalogProducts: Product[],
  additionalSlugs: readonly string[]
): { slug: string; nextIndex: number } {
  const slug = collectionSlug.trim();
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}-komad-(\\d+)$`);
  const used = new Set<number>();
  const seen = new Set<string>();
  for (const p of catalogProducts) seen.add(p.slug);
  for (const s of additionalSlugs) seen.add(s);
  for (const s of seen) {
    const m = s.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > 0) used.add(n);
    }
  }
  let nextIndex = 1;
  while (used.has(nextIndex)) nextIndex += 1;
  return { slug: `${slug}-komad-${nextIndex}`, nextIndex };
}
