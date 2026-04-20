import fs from "node:fs";
import path from "node:path";
import { removeMediaLibraryPaths, UPLOADS_DIR } from "../scripts/mediaLibrarySync.mjs";

const CATALOG_PATH = path.resolve(process.cwd(), "src", "data", "storeCatalog.json");
const IMAGE_MAP_PATH = path.resolve(process.cwd(), "src", "data", "imageLocalMap.json");
const ARCHIVE_OVERRIDES_PATH = path.resolve(
  process.cwd(),
  "public",
  "editor-archived-overrides.json"
);

const UPLOADS_IN_STRING = /\/uploads\/[^\s"'<>)\]}]+/g;

function normalizeWebUploadPath(raw: string): string {
  let p = raw.trim();
  const q = p.indexOf("?");
  if (q !== -1) p = p.slice(0, q);
  const h = p.indexOf("#");
  if (h !== -1) p = p.slice(0, h);
  p = p.replace(/[.,;:)]+$/, "");
  if (!p.startsWith("/uploads/")) return p;
  const suffix = p.slice("/uploads/".length);
  try {
    return `/uploads/${decodeURIComponent(suffix)}`;
  } catch {
    return p;
  }
}

function addUploadPathsFromString(s: string, used: Set<string>): void {
  if (!s || typeof s !== "string") return;
  const matches = s.matchAll(UPLOADS_IN_STRING);
  for (const m of matches) {
    const p = normalizeWebUploadPath(m[0]);
    if (p.startsWith("/uploads/")) used.add(p);
  }
}

function walkJsonStrings(value: unknown, used: Set<string>): void {
  if (typeof value === "string") {
    addUploadPathsFromString(value, used);
    return;
  }
  if (Array.isArray(value)) {
    for (const x of value) walkJsonStrings(x, used);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) walkJsonStrings(v, used);
  }
}

function collectFromProductLike(o: Record<string, unknown>, used: Set<string>): void {
  walkJsonStrings(o, used);
}

function readJsonFile(p: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function collectUsedUploadPaths(settings: unknown): Set<string> {
  const used = new Set<string>();
  walkJsonStrings(settings, used);

  const catalog = readJsonFile(CATALOG_PATH);
  if (catalog && typeof catalog === "object" && catalog !== null) {
    const c = catalog as { products?: unknown[]; collections?: unknown[] };
    if (Array.isArray(c.products)) {
      for (const p of c.products) {
        if (p && typeof p === "object") collectFromProductLike(p as Record<string, unknown>, used);
      }
    }
    if (Array.isArray(c.collections)) {
      for (const col of c.collections) {
        if (col && typeof col === "object") walkJsonStrings(col, used);
      }
    }
  }

  const archive = readJsonFile(ARCHIVE_OVERRIDES_PATH) as {
    overrides?: Record<string, unknown>;
  } | null;
  const ov = archive?.overrides;
  if (ov && typeof ov === "object" && !Array.isArray(ov)) {
    for (const o of Object.values(ov)) {
      if (o && typeof o === "object") collectFromProductLike(o as Record<string, unknown>, used);
    }
  }

  const imgMap = readJsonFile(IMAGE_MAP_PATH);
  if (imgMap && typeof imgMap === "object" && !Array.isArray(imgMap)) {
    for (const k of Object.keys(imgMap)) addUploadPathsFromString(k, used);
    for (const v of Object.values(imgMap)) {
      if (typeof v === "string") addUploadPathsFromString(v, used);
    }
  }

  return used;
}

function listUploadWebPaths(): string[] {
  if (!fs.existsSync(UPLOADS_DIR)) return [];
  const names = fs.readdirSync(UPLOADS_DIR);
  const out: string[] = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const full = path.join(UPLOADS_DIR, name);
    if (!fs.statSync(full).isFile()) continue;
    out.push(`/uploads/${name}`);
  }
  return out.sort();
}

function webPathToSafeAbsFile(webPath: string): string | null {
  if (!webPath.startsWith("/uploads/")) return null;
  const base = path.basename(webPath);
  if (!base || base !== webPath.replace(/^\/uploads\//, "")) return null;
  if (base.includes("..") || base.includes("/") || base.includes("\\")) return null;
  const resolvedDir = path.resolve(UPLOADS_DIR);
  const full = path.resolve(path.join(UPLOADS_DIR, base));
  const rel = path.relative(resolvedDir, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return full;
}

export function scanOrphanUploads(settings: unknown): {
  usedPaths: string[];
  allUploadPaths: string[];
  orphans: string[];
} {
  const used = collectUsedUploadPaths(settings);
  const allUploadPaths = listUploadWebPaths();
  const orphans = allUploadPaths.filter((p) => !used.has(p));
  return {
    usedPaths: [...used].sort(),
    allUploadPaths,
    orphans,
  };
}

export function deleteUploadFilesAndLibraryEntries(webPaths: string[]): {
  deleted: string[];
  failed: { path: string; error: string }[];
} {
  const deleted: string[] = [];
  const failed: { path: string; error: string }[] = [];

  for (const webPath of webPaths) {
    const abs = webPathToSafeAbsFile(webPath);
    if (!abs) {
      failed.push({ path: webPath, error: "Neispravna putanja" });
      continue;
    }
    try {
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs);
      }
      deleted.push(webPath);
    } catch (e) {
      failed.push({
        path: webPath,
        error: e instanceof Error ? e.message : "Greška",
      });
    }
  }

  if (deleted.length > 0) {
    removeMediaLibraryPaths(deleted);
  }

  return { deleted, failed };
}

export type OrphanUploadsRequest = {
  settings?: unknown;
  delete?: boolean;
  paths?: string[];
};

export function handleOrphanUploadsRequest(raw: string): {
  ok: boolean;
  status?: number;
  error?: string;
  body: Record<string, unknown>;
} {
  let parsed: OrphanUploadsRequest;
  try {
    parsed = JSON.parse(raw) as OrphanUploadsRequest;
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Neispravan JSON",
      body: { ok: false, error: "Neispravan JSON" },
    };
  }

  const settings = parsed.settings;
  if (settings === undefined) {
    return {
      ok: false,
      status: 400,
      error: "Nedostaje settings (trenutačni nacrt urednika)",
      body: { ok: false, error: "Nedostaje settings" },
    };
  }

  const { orphans, usedPaths, allUploadPaths } = scanOrphanUploads(settings);
  const orphanSet = new Set(orphans);

  if (!parsed.delete) {
    return {
      ok: true,
      body: {
        ok: true,
        orphans,
        usedCount: usedPaths.length,
        uploadsOnDisk: allUploadPaths.length,
        orphanCount: orphans.length,
      },
    };
  }

  let toDelete = orphans;
  if (Array.isArray(parsed.paths) && parsed.paths.length > 0) {
    toDelete = parsed.paths.map((p) => String(p).trim()).filter((p) => orphanSet.has(p));
    const invalid = parsed.paths
      .map((p) => String(p).trim())
      .filter((p) => p && !orphanSet.has(p));
    if (invalid.length > 0) {
      return {
        ok: false,
        status: 400,
        error: "Neke putanje nisu u skupu nekorištenih ili nisu u uploads/",
        body: {
          ok: false,
          error: "Odabrane putanje moraju biti među nekorištenima (ponovno skenirajte).",
          invalid,
        },
      };
    }
  }

  if (toDelete.length === 0) {
    return {
      ok: true,
      body: {
        ok: true,
        deleted: [],
        failed: [],
        message: "Nema što brisati.",
      },
    };
  }

  const { deleted, failed } = deleteUploadFilesAndLibraryEntries(toDelete);
  return {
    ok: true,
    body: {
      ok: true,
      deleted,
      failed,
      orphanCount: orphans.length,
    },
  };
}
