/** Obrada slike u pregledniku: skaliranje (dulja strana), JPEG ili WebP. */

export type ProcessImageOptions = {
  /** Maksimalna dulja strana u px (npr. 1600). */
  maxEdge: number;
  mime: "image/jpeg" | "image/webp";
  quality: number;
};

export type ProcessImageResult = {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob nije uspio"))),
      mime,
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      const done = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Učitavanje slike nije uspjelo"));
      });
      img.src = url;
      await done;
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function processImageFile(
  file: File,
  options: ProcessImageOptions
): Promise<ProcessImageResult> {
  const bitmap = await loadBitmap(file);
  try {
    let w = bitmap.width;
    let h = bitmap.height;
    const edge = Math.max(w, h);
    const scale =
      edge > options.maxEdge ? options.maxEdge / edge : 1;
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D nije dostupan");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await canvasToBlob(
      canvas,
      options.mime,
      options.quality
    );
    const dataUrl = await blobToDataUrl(blob);
    return { blob, dataUrl, width: w, height: h };
  } finally {
    bitmap.close();
  }
}

export function extensionForMime(mime: ProcessImageOptions["mime"]): string {
  return mime === "image/webp" ? ".webp" : ".jpg";
}

export type ProcessedUploadItem = ProcessImageResult & {
  filename: string;
  sourceName: string;
  sourceSize: number;
};

export function blobToBase64Payload(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error ?? new Error("Čitanje bloba"));
    r.readAsDataURL(blob);
  });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function processImagesForUpload(
  files: readonly File[],
  options: ProcessImageOptions,
  namePrefix: string
): Promise<ProcessedUploadItem[]> {
  const safe =
    namePrefix.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "upload";
  const ext = extensionForMime(options.mime);
  const stamp = Date.now();
  const results: ProcessedUploadItem[] = [];
  let n = 0;
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    n += 1;
    const base = file.name
      .replace(/\.[^.]+$/i, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 28);
    const filename = `${safe}-${stamp}-${String(n).padStart(2, "0")}-${base || "img"}${ext}`;
    const out = await processImageFile(file, options);
    results.push({
      ...out,
      filename,
      sourceName: file.name,
      sourceSize: file.size,
    });
  }
  return results;
}
