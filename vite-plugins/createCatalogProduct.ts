import fs from "node:fs";
import path from "node:path";

const CATALOG_PATH = path.resolve(process.cwd(), "src", "data", "storeCatalog.json");

/** Isto kao `EMPTY_PRODUCT_IMAGE` u `imagePlaceholder.ts` (placeholder u katalogu). */
const EMPTY_PRODUCT_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='750'%3E%3Crect fill='%23e8e4dc' width='100%25' height='100%25'/%3E%3C/svg%3E";

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

type StoreCatalog = {
  currency?: string;
  collections?: { id: string; slug: string }[];
  products?: Record<string, unknown>[];
};

export function createCatalogProductFromBody(raw: string): {
  ok: boolean;
  slug?: string;
  error?: string;
  status?: number;
} {
  let parsed: {
    collectionId?: string;
    slug?: string;
    title?: string;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return { ok: false, status: 400, error: "Neispravan JSON" };
  }

  const collectionId = String(parsed.collectionId ?? "").trim();
  const titleRaw = String(parsed.title ?? "").trim();
  const slugManual = String(parsed.slug ?? "").trim();
  const slug = slugManual ? slugify(slugManual) : slugify(titleRaw);

  if (!collectionId) {
    return { ok: false, status: 400, error: "Odaberite grupu (kolekciju) iz padajućeg izbornika." };
  }
  if (!slug || !isValidSlug(slug)) {
    return {
      ok: false,
      status: 400,
      error:
        "Slug mora imati barem 2 znaka (slova/brojevi/crtice). Upišite naslov ili slug ručno.",
    };
  }

  let catalog: StoreCatalog;
  try {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")) as StoreCatalog;
  } catch {
    return { ok: false, status: 500, error: "Ne mogu pročitati storeCatalog.json" };
  }

  const cols = Array.isArray(catalog.collections) ? catalog.collections : [];
  const col = cols.find((c) => c.id === collectionId);
  if (!col) {
    return { ok: false, status: 400, error: "Nepoznata kolekcija (provjerite ID)." };
  }

  const products = Array.isArray(catalog.products) ? [...catalog.products] : [];
  if (products.some((p) => typeof p === "object" && p && String((p as { slug?: string }).slug) === slug)) {
    return { ok: false, status: 409, error: `Slug „${slug}” već postoji u katalogu.` };
  }

  const title =
    titleRaw ||
    slug
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") ||
    slug;

  let id = `prod-${slug}`;
  if (products.some((p) => typeof p === "object" && p && String((p as { id?: string }).id) === id)) {
    id = `prod-${slug}-${Date.now()}`;
  }

  const currency = typeof catalog.currency === "string" && catalog.currency.trim()
    ? catalog.currency.trim()
    : "EUR";

  const newProduct = {
    id,
    slug,
    title,
    price: 0,
    currency,
    image: EMPTY_PRODUCT_IMAGE,
    images: [EMPTY_PRODUCT_IMAGE],
    collectionIds: [collectionId],
    shortDescription: "",
    description: "",
  };

  products.push(newProduct);
  catalog.products = products;

  try {
    fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog)}\n`, "utf8");
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : "Zapis kataloga nije uspio",
    };
  }

  return { ok: true, slug };
}
