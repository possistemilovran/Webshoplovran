import fs from "node:fs";
import path from "node:path";

const CATALOG_PATH = path.resolve(process.cwd(), "src", "data", "storeCatalog.json");

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

type CatalogCollection = {
  id: string;
  slug: string;
  title: string;
  description: string;
  heroImage: string;
};

type StoreCatalog = {
  currency?: string;
  collections?: CatalogCollection[];
  products?: unknown[];
};

export function createCatalogCollectionFromBody(raw: string): {
  ok: boolean;
  slug?: string;
  id?: string;
  title?: string;
  error?: string;
  status?: number;
} {
  let parsed: {
    slug?: string;
    title?: string;
    description?: string;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return { ok: false, status: 400, error: "Neispravan JSON" };
  }

  const titleRaw = String(parsed.title ?? "").trim();
  const slugManual = String(parsed.slug ?? "").trim();
  const descRaw = String(parsed.description ?? "").trim();
  const slug = slugManual ? slugify(slugManual) : slugify(titleRaw);

  if (!slug || !isValidSlug(slug)) {
    return {
      ok: false,
      status: 400,
      error:
        "Slug mora imati barem 2 znaka (slova/brojevi/crtice). Upišite naslov kolekcije ili slug ručno.",
    };
  }

  let catalog: StoreCatalog;
  try {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")) as StoreCatalog;
  } catch {
    return { ok: false, status: 500, error: "Ne mogu pročitati storeCatalog.json" };
  }

  const cols = Array.isArray(catalog.collections) ? [...catalog.collections] : [];

  if (cols.some((c) => c.slug === slug)) {
    return { ok: false, status: 409, error: `Slug kolekcije „${slug}” već postoji.` };
  }

  const title =
    titleRaw ||
    slug
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") ||
    slug;

  let id = `col-${slug}`;
  if (cols.some((c) => c.id === id)) {
    id = `col-${slug}-${Date.now()}`;
  }

  const newCol: CatalogCollection = {
    id,
    slug,
    title,
    description: descRaw,
    heroImage: "",
  };

  cols.push(newCol);
  catalog.collections = cols;

  try {
    fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog)}\n`, "utf8");
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : "Zapis kataloga nije uspio",
    };
  }

  return { ok: true, slug, id, title };
}
