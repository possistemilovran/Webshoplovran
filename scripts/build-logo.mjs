/**
 * Logo s transparentnom pozadinom:
 * 1) @imgly/background-removal-node (neuralni matting — bolje od jednostavnog praga)
 * 2) Jimp fallback (uzorak pozadine iz kuteva, bez native Sharpa u ovom skriptu)
 *
 * Ulaz: public/brand/logo-source.png ili LOGO_SOURCE=apsolutna_putanja
 * Izlaz: public/brand/logo-handmade-olive.png
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Jimp } from "jimp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "public/brand/logo-handmade-olive.png");
const defaultSrc = join(root, "public/brand/logo-source.png");

function resolveInput() {
  const env = process.env.LOGO_SOURCE?.trim();
  if (env && existsSync(env)) return env;
  if (existsSync(defaultSrc)) return defaultSrc;
  return null;
}

/** Fallback bez neuralne mreže — pozadina = medijan kuteva, udaljenost + kroma. */
async function removeBackgroundJimp(inputBuffer) {
  const img = await Jimp.read(inputBuffer);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const cropR = Math.min(80, Math.round(w * 0.075));
  const cropB = Math.min(80, Math.round(h * 0.075));
  img.crop({ x: 0, y: 0, w: w - cropR, h: h - cropB });

  const { data, width, height } = img.bitmap;
  const sw = 10;
  const samples = [];
  function sampleCorner(x0, y0) {
    for (let dy = 0; dy < sw; dy++) {
      for (let dx = 0; dx < sw; dx++) {
        const x = Math.min(width - 1, x0 + dx);
        const y = Math.min(height - 1, y0 + dy);
        const i = (y * width + x) * 4;
        samples.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }
  sampleCorner(0, 0);
  sampleCorner(width - sw, 0);
  sampleCorner(0, height - sw);
  sampleCorner(width - sw, height - sw);

  const n = samples.length;
  const bgR = samples.reduce((s, p) => s + p[0], 0) / n;
  const bgG = samples.reduce((s, p) => s + p[1], 0) / n;
  const bgB = samples.reduce((s, p) => s + p[2], 0) / n;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const dr = r - bgR;
      const dg = g - bgG;
      const db = b - bgB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const chroma = maxc - minc;

      let a = data[i + 3];
      if (dist < 28 && chroma < 38) {
        a = 0;
      } else if (dist < 58 && chroma < 50) {
        const t = (dist - 28) / 30;
        a = Math.floor(a * Math.min(1, Math.max(0, t)));
      }
      data[i + 3] = a;
    }
  }

  img.autocrop({ tolerance: 0.12, cropOnlyFrames: false });
  return img;
}

async function main() {
  mkdirSync(join(root, "public/brand"), { recursive: true });
  const inputPath = resolveInput();
  if (!inputPath) {
    console.error(
      "Nedostaje ulazna slika.\n" +
        "  Stavite vašu PNG sliku u: public/brand/logo-source.png\n" +
        "  ili: set LOGO_SOURCE=C:\\put\\do\\slike.png\n" +
        "Zatim: npm run logo:build"
    );
    process.exit(1);
  }

  const inputBuffer = readFileSync(inputPath);
  let outImg;

  try {
    console.log("Neuralno uklanjanje pozadine (IMG.LY)…");
    const { removeBackground } = await import("@imgly/background-removal-node");
    const blob = await removeBackground(inputBuffer, {
      model: "medium",
      output: { format: "image/png" },
    });
    const ab = await blob.arrayBuffer();
    outImg = await Jimp.read(Buffer.from(ab));
  } catch (e) {
    console.warn("IMG.LY nije uspio, Jimp fallback:", e?.message ?? e);
    outImg = await removeBackgroundJimp(inputBuffer);
  }

  outImg.autocrop({ tolerance: 0.1 });
  await outImg.write(outPath);
  console.log("Spremljeno:", outPath);
}

await main();
