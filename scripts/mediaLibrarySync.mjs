/**
 * Zajedničko ažuriranje public/media-library.json i public/uploads/.
 * Koristi vite plugin (dev) i npm run sync:media-library (CI / ručno).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
export const MEDIA_LIB = path.join(ROOT, "public", "media-library.json");
export const UPLOADS_DIR = path.join(ROOT, "public", "uploads");
const IMG_EXT = /\.(jpe?g|png|gif|webp|svg|avif)$/i;

export function readMediaLibrary() {
  try {
    const raw = fs.readFileSync(MEDIA_LIB, "utf8");
    const j = JSON.parse(raw);
    if (!Array.isArray(j.images)) return { images: [] };
    const images = [];
    for (const item of j.images) {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof item.path === "string" &&
        typeof item.label === "string"
      ) {
        images.push({ path: item.path, label: item.label });
      }
    }
    return { images };
  } catch {
    return { images: [] };
  }
}

export function writeMediaLibrary(data) {
  const byPath = new Map();
  for (const e of data.images) {
    byPath.set(e.path, e);
  }
  const sorted = [...byPath.values()].sort((a, b) =>
    a.path.localeCompare(b.path)
  );
  fs.writeFileSync(
    MEDIA_LIB,
    `${JSON.stringify({ images: sorted }, null, 2)}\n`,
    "utf8"
  );
}

export function appendMediaLibraryPath(webPath, label) {
  const data = readMediaLibrary();
  if (data.images.some((e) => e.path === webPath)) return;
  const base = webPath.split("/").pop() ?? webPath;
  data.images.push({ path: webPath, label: label ?? `${base} (upload)` });
  writeMediaLibrary(data);
}

/** Uklanja stavke iz biblioteke (npr. nakon brisanja datoteke u uploads/). */
export function removeMediaLibraryPaths(pathsToRemove) {
  const removeSet = new Set(
    Array.isArray(pathsToRemove) ? pathsToRemove.map(String) : []
  );
  if (removeSet.size === 0) return;
  const data = readMediaLibrary();
  const next = data.images.filter((e) => !removeSet.has(e.path));
  if (next.length !== data.images.length) writeMediaLibrary({ images: next });
}

export function syncUploadsFolderToMediaLibrary() {
  if (!fs.existsSync(UPLOADS_DIR)) return;
  const files = fs.readdirSync(UPLOADS_DIR);
  let changed = false;
  const data = readMediaLibrary();
  for (const name of files) {
    if (name.startsWith(".") || !IMG_EXT.test(name)) continue;
    const webPath = `/uploads/${name}`;
    if (!data.images.some((e) => e.path === webPath)) {
      data.images.push({ path: webPath, label: `${name} (upload)` });
      changed = true;
    }
  }
  if (changed) writeMediaLibrary(data);
}
