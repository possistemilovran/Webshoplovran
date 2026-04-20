import fs from "node:fs";
import path from "node:path";

const CATALOG_PATH = path.resolve(process.cwd(), "src", "data", "storeCatalog.json");
const LOG_PATH = path.resolve(process.cwd(), "public", "editor-artikli-log.txt");

type CatalogProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  image: string;
  images: string[];
  collectionIds: string[];
  shortDescription: string;
  description: string;
  soldOut?: boolean;
  featured?: boolean;
  widthCm?: number;
  heightCm?: number;
  diameterCm?: number;
  shape?: string;
};

type StoreCatalog = {
  currency?: string;
  collections?: { id: string; slug: string }[];
  products?: CatalogProduct[];
};

function slugify(input: string): string {
  const nfd = input.normalize("NFD");
  const ascii = nfd.replace(/\p{M}/gu, "");
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function isValidSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length >= 2;
}

function readCatalog(): StoreCatalog {
  return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")) as StoreCatalog;
}

function writeCatalog(catalog: StoreCatalog) {
  fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog)}\n`, "utf8");
}

function appendLog(line: string) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  const stamp = new Date().toISOString();
  fs.appendFileSync(LOG_PATH, `[${stamp}] ${line}\n`, "utf8");
}

function parseNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) return undefined;
  return n;
}

export function upsertCatalogProductFromBody(raw: string): {
  ok: boolean;
  slug?: string;
  created?: boolean;
  error?: string;
  status?: number;
} {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, error: "Neispravan JSON" };
  }

  const mode = String(parsed.mode ?? "create").trim();
  if (mode !== "create" && mode !== "update") {
    return { ok: false, status: 400, error: "Mode mora biti create ili update." };
  }

  const title = String(parsed.title ?? "").trim();
  const slugRaw = String(parsed.slug ?? "").trim();
  const slug = slugify(slugRaw || title);
  if (!isValidSlug(slug)) {
    return { ok: false, status: 400, error: "Slug nije valjan." };
  }

  let catalog: StoreCatalog;
  try {
    catalog = readCatalog();
  } catch {
    return { ok: false, status: 500, error: "Ne mogu učitati storeCatalog.json." };
  }

  const products = Array.isArray(catalog.products) ? [...catalog.products] : [];
  const idx = products.findIndex((p) => p.slug === slug);
  if (mode === "create" && idx >= 0) {
    return { ok: false, status: 409, error: `Slug „${slug}” već postoji.` };
  }
  if (mode === "update" && idx < 0) {
    return { ok: false, status: 404, error: `Slug „${slug}” ne postoji.` };
  }

  const fallbackCurrency =
    typeof catalog.currency === "string" && catalog.currency.trim()
      ? catalog.currency.trim()
      : "EUR";

  const collectionId = String(parsed.collectionId ?? "").trim();
  const collectionIds = Array.isArray(parsed.collectionIds)
    ? (parsed.collectionIds as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : collectionId
      ? [collectionId]
      : [];

  const imageMain = String(parsed.image ?? "").trim();
  const imagesExtra = Array.isArray(parsed.images)
    ? (parsed.images as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  const images = imageMain
    ? [imageMain, ...imagesExtra.filter((u) => u !== imageMain)]
    : imagesExtra;

  const base: CatalogProduct =
    idx >= 0
      ? { ...products[idx] }
      : {
          id: `prod-${slug}-${Date.now()}`,
          slug,
          title: title || slug,
          price: 0,
          currency: fallbackCurrency,
          image: "",
          images: [],
          collectionIds: collectionIds.length > 0 ? collectionIds : [],
          shortDescription: "",
          description: "",
        };

  const next: CatalogProduct = {
    ...base,
    slug,
    title: title || base.title,
    shortDescription: String(parsed.shortDescription ?? base.shortDescription ?? ""),
    description: String(parsed.description ?? base.description ?? ""),
    price: parseNum(parsed.price) ?? base.price,
    currency: String(parsed.currency ?? base.currency ?? fallbackCurrency).trim() || fallbackCurrency,
    soldOut: Boolean(parsed.soldOut),
    featured: Boolean(parsed.featured),
    collectionIds: collectionIds.length > 0 ? collectionIds : base.collectionIds,
    image: images[0] ?? base.image,
    images: images.length > 0 ? images : base.images,
  };
  if (!next.featured) delete next.featured;
  if (!next.soldOut) delete next.soldOut;

  const widthCm = parseNum(parsed.widthCm);
  const heightCm = parseNum(parsed.heightCm);
  const diameterCm = parseNum(parsed.diameterCm);
  const shape = String(parsed.shape ?? "").trim();
  if (widthCm != null) next.widthCm = widthCm;
  else delete next.widthCm;
  if (heightCm != null) next.heightCm = heightCm;
  else delete next.heightCm;
  if (diameterCm != null) next.diameterCm = diameterCm;
  else delete next.diameterCm;
  if (shape) next.shape = shape;
  else delete next.shape;

  if (idx >= 0) products[idx] = next;
  else products.push(next);

  catalog.products = products;
  try {
    writeCatalog(catalog);
    appendLog(
      `${mode === "create" ? "USNIMI" : "PREPRAVI"} slug=${slug} title="${next.title}" images=${next.images.length}`
    );
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : "Zapis nije uspio.",
    };
  }
  return { ok: true, slug, created: mode === "create" };
}

export function deleteCatalogProductFromBody(raw: string): {
  ok: boolean;
  slug?: string;
  error?: string;
  status?: number;
} {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, error: "Neispravan JSON" };
  }
  const slug = String(parsed.slug ?? "").trim();
  if (!slug) {
    return { ok: false, status: 400, error: "Nedostaje slug." };
  }
  let catalog: StoreCatalog;
  try {
    catalog = readCatalog();
  } catch {
    return { ok: false, status: 500, error: "Ne mogu učitati storeCatalog.json." };
  }
  const products = Array.isArray(catalog.products) ? [...catalog.products] : [];
  const next = products.filter((p) => p.slug !== slug);
  if (next.length === products.length) {
    return { ok: false, status: 404, error: `Slug „${slug}” nije pronađen.` };
  }
  catalog.products = next;
  try {
    writeCatalog(catalog);
    appendLog(`BRIŠI slug=${slug}`);
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : "Brisanje nije uspjelo.",
    };
  }
  return { ok: true, slug };
}
