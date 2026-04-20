import fs from "node:fs";
import path from "node:path";

const CATALOG_PATH = path.resolve(process.cwd(), "src", "data", "storeCatalog.json");
const LOG_PATH = path.resolve(process.cwd(), "public", "editor-artikli-log.txt");

type CatalogCollection = {
  id: string;
  slug: string;
  title: string;
  description: string;
  heroImage: string;
};

type CatalogProduct = {
  slug: string;
  collectionIds?: string[];
};

type StoreCatalog = {
  currency?: string;
  collections?: CatalogCollection[];
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

/**
 * Upsert (create ili update) kolekcije u `src/data/storeCatalog.json`.
 * Body: { mode: "create"|"update", slug?, title, description?, heroImage?, prevSlug? }
 *  - Ako je mode="update" i `prevSlug` se razlikuje od `slug`, preimenuje i
 *    propagira novi slug u `collectionIds` svih produkata u istom katalogu.
 */
export function upsertCatalogCollectionFromBody(raw: string): {
  ok: boolean;
  slug?: string;
  id?: string;
  title?: string;
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

  const titleRaw = String(parsed.title ?? "").trim();
  const slugManualRaw = String(parsed.slug ?? "").trim();
  const slug = slugify(slugManualRaw || titleRaw);
  const prevSlug = String(parsed.prevSlug ?? "").trim();

  if (!isValidSlug(slug)) {
    return {
      ok: false,
      status: 400,
      error:
        "Slug mora imati barem 2 znaka (slova/brojevi/crtice). Upišite naslov kolekcije ili slug ručno.",
    };
  }

  let catalog: StoreCatalog;
  try {
    catalog = readCatalog();
  } catch {
    return { ok: false, status: 500, error: "Ne mogu učitati storeCatalog.json." };
  }

  const cols = Array.isArray(catalog.collections) ? [...catalog.collections] : [];

  const findBySlug = (s: string) => cols.findIndex((c) => c.slug === s);

  let targetIdx = -1;
  if (mode === "update") {
    const searchSlug = prevSlug || slug;
    targetIdx = findBySlug(searchSlug);
    if (targetIdx < 0) {
      return { ok: false, status: 404, error: `Kolekcija „${searchSlug}” ne postoji.` };
    }
  }

  if (mode === "create" && findBySlug(slug) >= 0) {
    return { ok: false, status: 409, error: `Slug kolekcije „${slug}” već postoji.` };
  }
  if (mode === "update" && slug !== (prevSlug || cols[targetIdx].slug)) {
    if (findBySlug(slug) >= 0) {
      return {
        ok: false,
        status: 409,
        error: `Slug „${slug}” već koristi druga kolekcija — odaberi drugi.`,
      };
    }
  }

  const titleFallback =
    titleRaw ||
    (mode === "update" ? cols[targetIdx].title : "") ||
    slug
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") ||
    slug;

  const descRaw = String(
    parsed.description ?? (mode === "update" ? cols[targetIdx].description : "") ?? ""
  ).trim();
  const heroImage = String(
    parsed.heroImage ?? (mode === "update" ? cols[targetIdx].heroImage : "") ?? ""
  ).trim();

  if (mode === "create") {
    let id = `col-${slug}`;
    if (cols.some((c) => c.id === id)) {
      id = `col-${slug}-${Date.now()}`;
    }
    const newCol: CatalogCollection = {
      id,
      slug,
      title: titleFallback,
      description: descRaw,
      heroImage,
    };
    cols.push(newCol);
    catalog.collections = cols;
    try {
      writeCatalog(catalog);
      appendLog(`KREIRAJ-KOLEKCIJU slug=${slug} id=${id} title="${newCol.title}"`);
    } catch (e) {
      return {
        ok: false,
        status: 500,
        error: e instanceof Error ? e.message : "Zapis kataloga nije uspio.",
      };
    }
    return { ok: true, slug, id, title: newCol.title, created: true };
  }

  const oldCol = cols[targetIdx];
  const oldId = oldCol.id;
  const newId = slug !== oldCol.slug ? `col-${slug}` : oldId;
  const updated: CatalogCollection = {
    id: newId,
    slug,
    title: titleFallback,
    description: descRaw,
    heroImage,
  };
  cols[targetIdx] = updated;
  catalog.collections = cols;

  if (oldId !== newId && Array.isArray(catalog.products)) {
    catalog.products = (catalog.products as CatalogProduct[]).map((p) => {
      if (!Array.isArray(p.collectionIds)) return p;
      if (!p.collectionIds.includes(oldId)) return p;
      return {
        ...p,
        collectionIds: p.collectionIds.map((cid) => (cid === oldId ? newId : cid)),
      };
    });
  }

  try {
    writeCatalog(catalog);
    appendLog(
      `PREPRAVI-KOLEKCIJU slug=${slug}${
        prevSlug && prevSlug !== slug ? ` (prije=${prevSlug})` : ""
      } title="${updated.title}"`
    );
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : "Zapis kataloga nije uspio.",
    };
  }
  return { ok: true, slug, id: newId, title: updated.title, created: false };
}

export function deleteCatalogCollectionFromBody(raw: string): {
  ok: boolean;
  slug?: string;
  error?: string;
  status?: number;
  productsAffected?: number;
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

  const cols = Array.isArray(catalog.collections) ? [...catalog.collections] : [];
  const idx = cols.findIndex((c) => c.slug === slug);
  if (idx < 0) {
    return { ok: false, status: 404, error: `Kolekcija „${slug}” ne postoji.` };
  }
  const removed = cols[idx];
  const nextCols = cols.filter((_, i) => i !== idx);
  catalog.collections = nextCols;

  let productsAffected = 0;
  if (Array.isArray(catalog.products)) {
    catalog.products = (catalog.products as CatalogProduct[]).map((p) => {
      if (!Array.isArray(p.collectionIds)) return p;
      if (!p.collectionIds.includes(removed.id)) return p;
      productsAffected++;
      return {
        ...p,
        collectionIds: p.collectionIds.filter((cid) => cid !== removed.id),
      };
    });
  }

  try {
    writeCatalog(catalog);
    appendLog(
      `BRIŠI-KOLEKCIJU slug=${slug} id=${removed.id} (odvezano ${productsAffected} art.)`
    );
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : "Brisanje nije uspjelo.",
    };
  }

  return { ok: true, slug, productsAffected };
}
