import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");

const requiredPaths = [
  "index.html",
  "media-library.json",
  "brand/logo-primjer7.png",
  "brand/lun-hero.jpg",
  "brand/lun-story.jpg",
];

const missing = requiredPaths.filter((rel) => !existsSync(resolve(dist, rel)));
if (missing.length > 0) {
  console.error("[smoke] Missing dist files:");
  for (const rel of missing) console.error(` - ${rel}`);
  process.exit(1);
}

const mediaLibraryPath = resolve(dist, "media-library.json");
const mediaLibraryRaw = readFileSync(mediaLibraryPath, "utf8");
const mediaLibrary = JSON.parse(mediaLibraryRaw);
const images = Array.isArray(mediaLibrary.images) ? mediaLibrary.images : [];
const hasNewLogo = images.some((item) => item?.path === "/brand/logo-primjer7.png");
if (!hasNewLogo) {
  console.error("[smoke] media-library.json does not include /brand/logo-primjer7.png");
  process.exit(1);
}

const indexHtml = readFileSync(resolve(dist, "index.html"), "utf8");
const hasBaseScript = indexHtml.includes('type="module"');
if (!hasBaseScript) {
  console.error("[smoke] dist/index.html looks invalid (missing module script).");
  process.exit(1);
}

console.log("[smoke] OK: dist build artifact looks healthy.");
