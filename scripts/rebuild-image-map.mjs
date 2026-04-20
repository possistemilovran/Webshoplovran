/**
 * Builds src/data/imageLocalMap.json from files in public/shopify-images/
 * and URLs in storeCatalog.json (no network).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CATALOG = path.join(ROOT, "src", "data", "storeCatalog.json");
const IMAGES_DIR = path.join(ROOT, "public", "shopify-images");
const OUT_MAP = path.join(ROOT, "src", "data", "imageLocalMap.json");

function extFromUrl(src) {
  try {
    const u = new URL(src);
    const base = path.basename(u.pathname);
    const m = base.match(/\.(jpe?g|png|gif|webp)$/i);
    return m ? `.${m[1].toLowerCase()}` : ".jpg";
  } catch {
    return ".jpg";
  }
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const map = {};

for (const p of catalog.products) {
  let idx = 0;
  for (const src of p.images) {
    idx += 1;
    const file = `${p.slug}_${idx}${extFromUrl(src)}`;
    const dest = path.join(IMAGES_DIR, file);
    if (fs.existsSync(dest)) {
      map[src] = `/shopify-images/${file}`;
    }
  }
}

for (const col of catalog.collections) {
  const u = col.heroImage;
  if (!u) continue;
  const file = `collection-${col.slug}_hero${extFromUrl(u)}`;
  const dest = path.join(IMAGES_DIR, file);
  if (fs.existsSync(dest)) {
    map[u] = `/shopify-images/${file}`;
  }
}

fs.writeFileSync(OUT_MAP, JSON.stringify(map, null, 0), "utf8");
console.log(`Wrote ${OUT_MAP} (${Object.keys(map).length} entries)`);
