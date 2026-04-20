import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  appendMediaLibraryPath,
  readMediaLibrary,
  syncUploadsFolderToMediaLibrary,
} from "../scripts/mediaLibrarySync.mjs";
import fs from "node:fs";
import path from "node:path";
import { addTranslationsToArchivedOverride } from "./archiveProductTranslations";
import { createCatalogProductFromBody } from "./createCatalogProduct";
import { createCatalogCollectionFromBody } from "./createCatalogCollection";
import {
  deleteCatalogCollectionFromBody,
  upsertCatalogCollectionFromBody,
} from "./collectionCrud";
import { handleOrphanUploadsRequest } from "./orphanUploadCleanup";
import {
  deleteCatalogProductFromBody,
  upsertCatalogProductFromBody,
} from "./productCrud";

const ARCHIVE_OVERRIDES_PATH = path.resolve(
  process.cwd(),
  "public",
  "editor-archived-overrides.json"
);

function readArchiveOverrides(): Record<string, Record<string, unknown>> {
  try {
    const raw = fs.readFileSync(ARCHIVE_OVERRIDES_PATH, "utf8");
    const j = JSON.parse(raw) as { overrides?: Record<string, unknown> };
    if (!j.overrides || typeof j.overrides !== "object" || Array.isArray(j.overrides)) {
      return {};
    }
    return j.overrides as Record<string, Record<string, unknown>>;
  } catch {
    return {};
  }
}

function writeArchiveOverrides(overrides: Record<string, Record<string, unknown>>) {
  fs.mkdirSync(path.dirname(ARCHIVE_OVERRIDES_PATH), { recursive: true });
  fs.writeFileSync(
    ARCHIVE_OVERRIDES_PATH,
    `${JSON.stringify({ version: 1, overrides }, null, 2)}\n`,
    "utf8"
  );
}

/**
 * Arhiva prijevoda stranice (i18n localeOverrides) — server-side stanje koje
 * Urednik-STRANICE sprema kroz `/__editor__/save-locale-overrides`. Svi
 * preglednici čitaju `public/editor-archived-locale-overrides.json` na startu
 * pa su prijevodi dostupni neovisno o korisničkom localStorage-u. Struktura
 * mapira `AppLocaleCode` → i18n resource tree (npr. `{ en: { nav: {...} } }`).
 */
const ARCHIVE_LOCALE_PATH = path.resolve(
  process.cwd(),
  "public",
  "editor-archived-locale-overrides.json"
);

function readArchiveLocaleOverrides(): Record<string, Record<string, unknown>> {
  try {
    const raw = fs.readFileSync(ARCHIVE_LOCALE_PATH, "utf8");
    const j = JSON.parse(raw) as { overrides?: Record<string, unknown> };
    if (!j.overrides || typeof j.overrides !== "object" || Array.isArray(j.overrides)) {
      return {};
    }
    return j.overrides as Record<string, Record<string, unknown>>;
  } catch {
    return {};
  }
}

function writeArchiveLocaleOverrides(
  overrides: Record<string, Record<string, unknown>>
) {
  fs.mkdirSync(path.dirname(ARCHIVE_LOCALE_PATH), { recursive: true });
  fs.writeFileSync(
    ARCHIVE_LOCALE_PATH,
    `${JSON.stringify({ version: 1, overrides }, null, 2)}\n`,
    "utf8"
  );
}

function safeUploadFilename(name: string, fallbackExt: string): string {
  const trimmed = name.trim().slice(0, 120);
  const base =
    trimmed.replace(/[^a-zA-Z0-9._-]/g, "_") || `img-${Date.now()}`;
  const hasExt = /\.[a-zA-Z0-9]{2,5}$/.test(base);
  return hasExt ? base : `${base}${fallbackExt}`;
}

const ABOUT_SLIDES_DIR = path.resolve(
  process.cwd(),
  "public",
  "about-slideshow"
);

function extForAboutMime(m: string | undefined): string {
  if (m === "image/webp") return ".webp";
  if (m === "image/png") return ".png";
  return ".jpg";
}

/**
 * Sprema jednu sliku „O nama” slideshowa u `public/about-slideshow/slide-{N}.*`.
 * Briše sve postojeće varijante istog slota (npr. .png kad dolazi .jpg).
 */
function saveAboutSlideToPublic(
  slot: number,
  dataBase64: string,
  mime: string | undefined
): string {
  if (!Number.isInteger(slot) || slot < 0 || slot > 11) {
    throw new Error("slot mora biti cijeli broj 0–11");
  }
  const b64 = dataBase64.trim();
  if (!b64) throw new Error("Nedostaje dataBase64");
  fs.mkdirSync(ABOUT_SLIDES_DIR, { recursive: true });
  const base = `slide-${slot + 1}`;
  let names: string[];
  try {
    names = fs.readdirSync(ABOUT_SLIDES_DIR);
  } catch {
    names = [];
  }
  for (const name of names) {
    if (name === base || name.startsWith(`${base}.`)) {
      try {
        fs.unlinkSync(path.join(ABOUT_SLIDES_DIR, name));
      } catch {
        /* ignore */
      }
    }
  }
  const ext = extForAboutMime(mime);
  const fname = `${base}${ext}`;
  const buf = Buffer.from(b64, "base64");
  fs.writeFileSync(path.join(ABOUT_SLIDES_DIR, fname), buf);
  return `/about-slideshow/${fname}`;
}

/**
 * data: URL-ovi u image / images[] → datoteke u public/uploads/, putanje u JSON.
 */
function persistDataUrlsInProductOverride(
  slug: string,
  o: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...o };
  const upDir = path.resolve(process.cwd(), "public", "uploads");
  fs.mkdirSync(upDir, { recursive: true });
  const safeSlug = slug.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 72) || "artikl";

  const saveDataUrl = (dataUrl: string, fileSuffix: string): string => {
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
    if (!m) return dataUrl;
    const mime = m[1].toLowerCase();
    const b64 = m[2].replace(/\s/g, "");
    const ext = mime.includes("webp")
      ? ".webp"
      : mime.includes("png")
        ? ".png"
        : ".jpg";
    const name = safeUploadFilename(
      `${safeSlug}-${fileSuffix}-${Date.now()}${ext}`,
      ext
    );
    const buf = Buffer.from(b64, "base64");
    const full = path.join(upDir, name);
    fs.writeFileSync(full, buf);
    const webPath = `/uploads/${name}`;
    appendMediaLibraryPath(webPath, `${name} (arhiva)`);
    return webPath;
  };

  if (typeof out.image === "string" && out.image.startsWith("data:")) {
    out.image = saveDataUrl(out.image, "main");
  }

  if (Array.isArray(out.images)) {
    out.images = out.images.map((u, i) =>
      typeof u === "string" && u.startsWith("data:")
        ? saveDataUrl(u, `g${i + 1}`)
        : u
    );
  }

  if (typeof out.image === "string" && out.image.trim()) {
    const imgs = Array.isArray(out.images)
      ? (out.images as unknown[]).filter((x) => typeof x === "string" && String(x).trim())
      : [];
    if (imgs.length === 0) {
      out.images = [out.image];
    }
  }

  return out;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Samo u `npm run dev`: sprema obrađenu sliku u `public/uploads/`,
 * ažurira `public/media-library.json` i nudi sync rutu za biblioteku u uredniku.
 * Na statičkom hostu nije dostupno — tada koristite preuzimanje ili data URL.
 */
export function editorImageUploadPlugin(): Plugin {
  return {
    name: "editor-image-upload",
    configureServer(server) {
      try {
        syncUploadsFolderToMediaLibrary();
      } catch {
        /* ignore */
      }
      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const pathOnly = (req.url ?? "").split("?")[0] ?? "";

          if (
            pathOnly === "/__editor__/sync-media-library" &&
            req.method === "GET"
          ) {
            try {
              syncUploadsFolderToMediaLibrary();
              const data = readMediaLibrary();
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify(data));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          if (pathOnly === "/__editor__/create-catalog-collection" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const result = createCatalogCollectionFromBody(raw);
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              if (!result.ok) {
                res.statusCode = result.status ?? 500;
                res.end(JSON.stringify({ ok: false, error: result.error ?? "Greška" }));
                return;
              }
              res.end(
                JSON.stringify({
                  ok: true,
                  slug: result.slug,
                  id: result.id,
                  title: result.title,
                })
              );
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          if (pathOnly === "/__editor__/collection-upsert" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const result = upsertCatalogCollectionFromBody(raw);
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              if (!result.ok) {
                res.statusCode = result.status ?? 500;
                res.end(JSON.stringify({ ok: false, error: result.error ?? "Greška" }));
                return;
              }
              res.end(
                JSON.stringify({
                  ok: true,
                  slug: result.slug,
                  id: result.id,
                  title: result.title,
                  created: result.created === true,
                  logPath: "/editor-artikli-log.txt",
                })
              );
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          if (pathOnly === "/__editor__/collection-delete" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const result = deleteCatalogCollectionFromBody(raw);
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              if (!result.ok) {
                res.statusCode = result.status ?? 500;
                res.end(JSON.stringify({ ok: false, error: result.error ?? "Greška" }));
                return;
              }
              res.end(
                JSON.stringify({
                  ok: true,
                  slug: result.slug,
                  productsAffected: result.productsAffected ?? 0,
                  logPath: "/editor-artikli-log.txt",
                })
              );
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          if (pathOnly === "/__editor__/create-catalog-product" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const result = createCatalogProductFromBody(raw);
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              if (!result.ok) {
                res.statusCode = result.status ?? 500;
                res.end(JSON.stringify({ ok: false, error: result.error ?? "Greška" }));
                return;
              }
              res.end(JSON.stringify({ ok: true, slug: result.slug }));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          if (pathOnly === "/__editor__/product-upsert" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const result = upsertCatalogProductFromBody(raw);
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              if (!result.ok) {
                res.statusCode = result.status ?? 500;
                res.end(JSON.stringify({ ok: false, error: result.error ?? "Greška" }));
                return;
              }
              res.end(
                JSON.stringify({
                  ok: true,
                  slug: result.slug,
                  created: result.created === true,
                  logPath: "/editor-artikli-log.txt",
                })
              );
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          if (pathOnly === "/__editor__/product-delete" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const result = deleteCatalogProductFromBody(raw);
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              if (!result.ok) {
                res.statusCode = result.status ?? 500;
                res.end(JSON.stringify({ ok: false, error: result.error ?? "Greška" }));
                return;
              }
              res.end(
                JSON.stringify({
                  ok: true,
                  slug: result.slug,
                  logPath: "/editor-artikli-log.txt",
                })
              );
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          if (pathOnly === "/__editor__/archive-product" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const parsed = JSON.parse(raw) as {
                slug?: string;
                override?: Record<string, unknown>;
              };
              const slug = String(parsed.slug ?? "").trim();
              if (!slug) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Nedostaje slug" }));
                return;
              }
              const ov = parsed.override && typeof parsed.override === "object"
                ? { ...parsed.override }
                : {};
              let normalized = persistDataUrlsInProductOverride(slug, ov);
              try {
                normalized = await addTranslationsToArchivedOverride(normalized);
              } catch {
                /* prijevodi nisu kritični — arhiva ostaje s HR poljima */
              }
              const all = readArchiveOverrides();
              all[slug] = normalized;
              writeArchiveOverrides(all);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, slug }));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          /**
           * Čist zapis nadjačavanja (uključujući prijevode iz Urednik-AUTO) u
           * `editor-archived-overrides.json`. Za razliku od /__editor__/archive-product
           * NE poziva LibreTranslate — koristi prijevode koje je klijent već napravio
           * (MyMemory u /urednik-auto rute). Time `useResolvedProducts` dobije prijevode
           * neovisno o localStorage / pregledniku.
           */
          if (pathOnly === "/__editor__/save-product-override" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const parsed = JSON.parse(raw) as {
                slug?: string;
                override?: Record<string, unknown>;
              };
              const slug = String(parsed.slug ?? "").trim();
              if (!slug) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Nedostaje slug" }));
                return;
              }
              const ov =
                parsed.override && typeof parsed.override === "object"
                  ? { ...parsed.override }
                  : {};
              const normalized = persistDataUrlsInProductOverride(slug, ov);
              const all = readArchiveOverrides();
              all[slug] = normalized;
              writeArchiveOverrides(all);
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: true,
                  slug,
                  langs: Object.keys(
                    (normalized.translations as Record<string, unknown> | undefined) ?? {}
                  ),
                })
              );
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          /**
           * Uklanja nadjačavanje (i prijevode) za dati slug iz
           * `editor-archived-overrides.json`. Koristi se pri brisanju artikla u
           * Urednik-AUTO da ne ostanu zaostali prijevodi.
           */
          if (pathOnly === "/__editor__/delete-product-override" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const parsed = JSON.parse(raw) as { slug?: string };
              const slug = String(parsed.slug ?? "").trim();
              if (!slug) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Nedostaje slug" }));
                return;
              }
              const all = readArchiveOverrides();
              const removed = slug in all;
              delete all[slug];
              writeArchiveOverrides(all);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, slug, removed }));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          /**
           * Sprema cjelokupni `localeOverrides` snapshot Urednik-STRANICE na server
           * u `public/editor-archived-locale-overrides.json`. Frontend sam radi
           * MyMemory prijevode pa server samo zapisuje ono što mu se pošalje.
           * Payload: `{ overrides: { en: {...}, de: {...}, ... } }`.
           */
          if (pathOnly === "/__editor__/save-locale-overrides" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const parsed = JSON.parse(raw) as {
                overrides?: Record<string, unknown>;
              };
              const ov =
                parsed.overrides &&
                typeof parsed.overrides === "object" &&
                !Array.isArray(parsed.overrides)
                  ? (parsed.overrides as Record<string, Record<string, unknown>>)
                  : {};
              writeArchiveLocaleOverrides(ov);
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: true,
                  langs: Object.keys(ov),
                })
              );
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          /**
           * Briše cijelu arhivu lokalnih prijevoda stranice (za reset-gumb).
           */
          if (
            pathOnly === "/__editor__/clear-locale-overrides" &&
            req.method === "POST"
          ) {
            try {
              writeArchiveLocaleOverrides({});
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          if (pathOnly === "/__editor__/save-about-slide" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const parsed = JSON.parse(raw) as {
                slot?: number;
                dataBase64?: string;
                mime?: string;
              };
              const slot =
                typeof parsed.slot === "number"
                  ? parsed.slot
                  : Number.parseInt(String(parsed.slot ?? ""), 10);
              const webPath = saveAboutSlideToPublic(
                slot,
                parsed.dataBase64 ?? "",
                parsed.mime
              );
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, path: webPath }));
            } catch (e) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          /**
           * Brije jednu datoteku u `public/uploads/` (npr. zamjena stare slike u
           * Uredniku-STRANICE). Put mora biti točno `/uploads/ime_datoteke`.
           */
          if (pathOnly === "/__editor__/delete-upload" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const parsed = JSON.parse(raw) as { path?: string };
              const web = typeof parsed.path === "string" ? parsed.path.trim() : "";
              if (!web.startsWith("/uploads/") || web.includes("..")) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    ok: false,
                    error: "Dozvoljene su samo putanje /uploads/…",
                  })
                );
                return;
              }
              const rel = web.slice("/uploads/".length);
              if (!/^[a-zA-Z0-9._-]+$/.test(rel)) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Neispravno ime datoteke" }));
                return;
              }
              const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
              const full = path.resolve(uploadsRoot, rel);
              if (!full.startsWith(uploadsRoot)) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Izvan uploads mape" }));
                return;
              }
              if (fs.existsSync(full)) {
                fs.unlinkSync(full);
              }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          if (pathOnly === "/__editor__/orphan-uploads" && req.method === "POST") {
            try {
              const raw = await readBody(req);
              const result = handleOrphanUploadsRequest(raw);
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              if (!result.ok && result.status) {
                res.statusCode = result.status;
              }
              res.end(JSON.stringify(result.body));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "Greška",
                })
              );
            }
            return;
          }

          if (pathOnly !== "/__editor__/save-image" || req.method !== "POST") {
            next();
            return;
          }
          try {
            const raw = await readBody(req);
            const parsed = JSON.parse(raw) as {
              filename?: string;
              dataBase64?: string;
              mime?: string;
            };
            const b64 = parsed.dataBase64?.trim();
            if (!b64) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Nedostaje dataBase64" }));
              return;
            }
            const ext =
              parsed.mime === "image/webp"
                ? ".webp"
                : parsed.mime === "image/jpeg" || parsed.mime === "image/jpg"
                  ? ".jpg"
                  : ".jpg";
            const filename = safeUploadFilename(
              parsed.filename ?? `upload-${Date.now()}${ext}`,
              ext
            );
            const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads");
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
            const buf = Buffer.from(b64, "base64");
            const full = path.join(UPLOADS_DIR, filename);
            fs.writeFileSync(full, buf);
            const webPath = `/uploads/${filename}`;
            appendMediaLibraryPath(webPath, `${filename} (upload)`);
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: true,
                path: webPath,
              })
            );
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error: e instanceof Error ? e.message : "Greška",
              })
            );
          }
        }
      );
    },
  };
}
