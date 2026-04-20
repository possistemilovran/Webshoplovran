import type { Collection, Product } from "@/data/types";
import type { EditorMediaEntry } from "@/editor/EditorImagePicker";

/**
 * Jedinstvene slike iz kataloga (nakon imageLocalMap) za padajući izbornik u uredniku.
 */
export function buildCatalogMediaEntries(
  products: Product[],
  collections: Collection[]
): EditorMediaEntry[] {
  const seen = new Set<string>();
  const out: EditorMediaEntry[] = [];

  const push = (url: string, label: string) => {
    const u = url.trim();
    if (!u || u.startsWith("data:")) return;
    if (seen.has(u)) return;
    seen.add(u);
    out.push({ path: u, label });
  };

  for (const p of products) {
    const titleShort =
      p.title.length > 40 ? `${p.title.slice(0, 40)}…` : p.title;
    if (p.images.length > 0) {
      for (let i = 0; i < p.images.length; i++) {
        const img = p.images[i];
        const n = i + 1;
        const lab =
          p.images.length === 1
            ? `Katalog: ${p.slug} — ${titleShort}`
            : `Katalog: ${p.slug} — ${n}/${p.images.length} · ${titleShort}`;
        push(img, lab);
      }
    } else if (p.image.trim()) {
      push(p.image, `Katalog: ${p.slug} — ${titleShort}`);
    }
  }

  for (const c of collections) {
    const h = c.heroImage.trim();
    if (!h) continue;
    const t =
      c.title.length > 28 ? `${c.title.slice(0, 28)}…` : c.title;
    push(h, `Katalog: kolekcija ${c.slug} — hero · ${t}`);
  }

  return out.sort((a, b) => a.label.localeCompare(b.label, "hr"));
}

/** Datoteke iz JSON-a koje nisu već u katalogu (logo, /uploads/, …). */
export function fileOnlyMediaEntries(
  catalogEntries: EditorMediaEntry[],
  jsonEntries: EditorMediaEntry[]
): EditorMediaEntry[] {
  const catalogPaths = new Set(catalogEntries.map((e) => e.path));
  return jsonEntries.filter((e) => !catalogPaths.has(e.path));
}
