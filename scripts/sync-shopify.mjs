/**
 * Fetches maison-extravaganza.myshopify.com catalog and optionally mirrors images locally.
 * Usage: node scripts/sync-shopify.mjs [--download-images]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE = "https://maison-extravaganza.myshopify.com";
const DOWNLOAD = process.argv.includes("--download-images");
const IMAGES_DIR = path.join(ROOT, "public", "shopify-images");
const OUT_JSON = path.join(ROOT, "src", "data", "storeCatalog.json");
const IMAGE_MAP_JSON = path.join(ROOT, "src", "data", "imageLocalMap.json");

function stripHtml(html) {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchAllProducts() {
  const all = [];
  let page = 1;
  for (;;) {
    const url = `${BASE}/collections/all/products.json?limit=250&page=${page}`;
    const data = await fetchJson(url);
    const batch = data.products || [];
    all.push(...batch);
    if (batch.length < 250) break;
    page += 1;
    console.log(`  products page ${page - 1}: +${batch.length} (total ${all.length})`);
  }
  return all;
}

async function fetchCollectionsMeta() {
  const data = await fetchJson(`${BASE}/collections.json?limit=250`);
  return data.collections || [];
}

/** @returns {Promise<Set<number>>} */
async function fetchCollectionProductIds(handle) {
  const ids = new Set();
  let page = 1;
  for (;;) {
    const url = `${BASE}/collections/${handle}/products.json?limit=250&page=${page}`;
    const data = await fetchJson(url);
    const batch = data.products || [];
    for (const p of batch) ids.add(p.id);
    if (batch.length < 250) break;
    page += 1;
  }
  return ids;
}

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

function sizedImageUrl(src, width = 1200) {
  const u = new URL(src);
  u.searchParams.set("width", String(width));
  return u.toString();
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, buf);
}

async function main() {
  console.log("Fetching cart currency…");
  const cart = await fetchJson(`${BASE}/cart.js`);
  const currency = cart.currency || "USD";

  console.log("Fetching collections metadata…");
  const collectionsMeta = await fetchCollectionsMeta();

  console.log("Fetching collection membership (once per collection)…");
  /** @type {Map<string, Set<number>>} */
  const collectionIdSets = new Map();
  for (const col of collectionsMeta) {
    process.stdout.write(`  ${col.handle}… `);
    const ids = await fetchCollectionProductIds(col.handle);
    collectionIdSets.set(col.handle, ids);
    console.log(`${ids.size} products`);
  }

  const productToCollections = new Map();
  for (const [handle, ids] of collectionIdSets) {
    for (const id of ids) {
      if (!productToCollections.has(id)) productToCollections.set(id, []);
      productToCollections.get(id).push(handle);
    }
  }

  const featuredIds = new Set([
    ...collectionIdSets.get("new-drops") || [],
    ...collectionIdSets.get("frontpage") || [],
  ]);

  console.log("Fetching all products…");
  const rawProducts = await fetchAllProducts();
  console.log(`Total products: ${rawProducts.length}`);

  const byId = new Map(rawProducts.map((p) => [p.id, p]));

  /** @type {Map<string, string>} */
  const collectionHero = new Map();
  for (const col of collectionsMeta) {
    let hero = col.image?.src || "";
    if (!hero) {
      const ids = collectionIdSets.get(col.handle);
      if (ids) {
        for (const pid of ids) {
          const pr = byId.get(pid);
          const src = pr?.images?.[0]?.src;
          if (src) {
            hero = src;
            break;
          }
        }
      }
    }
    collectionHero.set(col.handle, hero);
  }

  const slugCounts = new Map();
  function uniqueSlug(handle) {
    const n = slugCounts.get(handle) || 0;
    slugCounts.set(handle, n + 1);
    return n === 0 ? handle : `${handle}-${n}`;
  }

  const products = [];
  const seenIds = new Set();

  for (const p of rawProducts) {
    if (seenIds.has(p.id)) continue;
    seenIds.add(p.id);

    const variants = p.variants || [];
    const v0 = variants[0];
    const price = v0 ? parseFloat(v0.price) : 0;
    const soldOut = !variants.some((v) => v.available);
    const body = stripHtml(p.body_html || "");
    const shortDescription =
      body.length > 200 ? `${body.slice(0, 197)}…` : body || p.title;

    const collectionIds = productToCollections.get(p.id) || [];
    const images = (p.images || []).map((im) => im.src).filter(Boolean);
    const image = images[0] || "";

    const slug = uniqueSlug(p.handle);

    products.push({
      id: String(p.id),
      slug,
      title: p.title,
      price,
      currency,
      image,
      images: images.length ? images : [image],
      collectionIds,
      shortDescription,
      description: body || p.title,
      soldOut,
      featured: featuredIds.has(p.id),
    });
  }

  const collections = collectionsMeta.map((col) => ({
    id: col.handle,
    slug: col.handle,
    title: col.title,
    description: stripHtml(col.description || ""),
    heroImage:
      collectionHero.get(col.handle) ||
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1400&q=80",
  }));

  /** @type {Record<string, string>} */
  const imageMap = {};

  if (DOWNLOAD) {
    console.log(
      `Downloading images to public/shopify-images/ and building imageLocalMap.json…`
    );
    await fs.promises.mkdir(IMAGES_DIR, { recursive: true });
    let done = 0;
    const total = products.reduce((n, p) => n + p.images.length, 0);

    for (const p of products) {
      let idx = 0;
      for (const src of p.images) {
        idx += 1;
        const ext = extFromUrl(src);
        const file = `${p.slug}_${idx}${ext}`;
        const rel = `/shopify-images/${file}`;
        const dest = path.join(IMAGES_DIR, file);
        try {
          if (!fs.existsSync(dest)) {
            const url = sizedImageUrl(src, 1200);
            await downloadFile(url, dest);
          }
          if (fs.existsSync(dest)) {
            imageMap[src] = rel;
          }
        } catch (e) {
          console.warn(`\n  skip ${file}:`, e.message);
        }
        done += 1;
        if (done % 50 === 0 || done === total) {
          process.stdout.write(`\r  ${done}/${total} images`);
        }
      }
    }

    for (const col of collections) {
      const u = col.heroImage;
      if (!u || imageMap[u]) continue;
      const file = `collection-${col.slug}_hero${extFromUrl(u)}`;
      const rel = `/shopify-images/${file}`;
      const dest = path.join(IMAGES_DIR, file);
      try {
        if (!fs.existsSync(dest)) {
          await downloadFile(sizedImageUrl(u, 1600), dest);
        }
        if (fs.existsSync(dest)) {
          imageMap[u] = rel;
        }
      } catch {
        /* optional */
      }
    }

    await fs.promises.writeFile(
      IMAGE_MAP_JSON,
      JSON.stringify(imageMap, null, 0),
      "utf8"
    );
    console.log(
      `\nDone. Local files in public/shopify-images/; URL map in src/data/imageLocalMap.json (${Object.keys(imageMap).length} entries).`
    );
  }

  const payload = { currency, collections, products };
  await fs.promises.writeFile(OUT_JSON, JSON.stringify(payload, null, 0), "utf8");
  console.log(`Wrote ${OUT_JSON} (${products.length} products, ${collections.length} collections)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
