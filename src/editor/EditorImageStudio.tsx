import { useCallback, useId, useRef, useState } from "react";
import {
  blobToBase64Payload,
  extensionForMime,
  processImageFile,
  processImagesForUpload,
  triggerBlobDownload,
  type ProcessImageOptions,
  type ProcessedUploadItem,
} from "@/lib/processImageInBrowser";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

type Props = {
  suggestBaseName?: string;
  onApplyUrl: (url: string) => void;
  onAppendGalleryLine?: (url: string) => void;
  /**
   * Nakon uspješnog uploada u projekt (samo dev).
   * `paths` su web putanje npr. /uploads/ime.jpg
   */
  onAfterDevUpload?: (detail?: { paths: string[] }) => void;
  /** Jedna slika: odabir, pregled, umetanje u polje. */
  showSingle?: boolean;
  /** Više slika: tablica, preuzmi sve / upload sve (dev). */
  showBatch?: boolean;
};

export function EditorImageStudio({
  suggestBaseName = "slika",
  onApplyUrl,
  onAppendGalleryLine,
  onAfterDevUpload,
  showSingle = true,
  showBatch = true,
}: Props) {
  const inputId = useId();
  const batchInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const batchFileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [sourceBytes, setSourceBytes] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [outBytes, setOutBytes] = useState<number | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [maxEdge, setMaxEdge] = useState(1600);
  const [quality, setQuality] = useState(0.85);
  const [mime, setMime] = useState<ProcessImageOptions["mime"]>("image/jpeg");
  const [lastDataUrl, setLastDataUrl] = useState<string | null>(null);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const [batchItems, setBatchItems] = useState<ProcessedUploadItem[]>([]);
  const [busyBatch, setBusyBatch] = useState(false);
  const [batchErr, setBatchErr] = useState<string | null>(null);
  const [batchSavedNote, setBatchSavedNote] = useState<string | null>(null);

  const opts = (): ProcessImageOptions => ({ maxEdge, mime, quality });

  const runProcess = useCallback(
    async (file: File) => {
      setErr(null);
      setSavedPath(null);
      setSourceName(file.name);
      setSourceBytes(file.size);
      setBusy(true);
      setPreview(null);
      setLastDataUrl(null);
      setLastBlob(null);
      setLastFile(file);
      try {
        const out = await processImageFile(file, opts());
        setPreview(out.dataUrl);
        setLastDataUrl(out.dataUrl);
        setLastBlob(out.blob);
        setOutBytes(out.blob.size);
        setDims({ w: out.width, h: out.height });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Obrada nije uspjela.");
        setPreview(null);
        setDims(null);
        setOutBytes(null);
        setLastBlob(null);
      } finally {
        setBusy(false);
      }
    },
    [maxEdge, mime, quality]
  );

  const onPickFile = (f: File | null) => {
    if (!f || !f.type.startsWith("image/")) {
      setErr("Odaberite sliku (JPEG, PNG, WebP…).");
      return;
    }
    void runProcess(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    onPickFile(f ?? null);
  };

  const slugPart =
    suggestBaseName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48) || "img";
  const outFilename = `${slugPart}-${Date.now()}${extensionForMime(mime)}`;

  const saveSingleToProject = async () => {
    if (!lastBlob || !import.meta.env.DEV) return;
    setErr(null);
    setSavedPath(null);
    try {
      const b64 = await blobToBase64Payload(lastBlob);
      const r = await fetch("/__editor__/save-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: outFilename,
          dataBase64: b64,
          mime,
        }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        path?: string;
        error?: string;
      };
      if (!r.ok || !j.ok || !j.path) {
        throw new Error(j.error ?? "Spremanje nije uspjelo.");
      }
      setSavedPath(j.path);
      onApplyUrl(j.path);
      onAfterDevUpload?.({ paths: [j.path] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Spremanje nije uspjelo.");
    }
  };

  const downloadSingleToDisk = () => {
    if (!lastBlob) return;
    triggerBlobDownload(lastBlob, outFilename);
  };

  const applyDataUrl = () => {
    if (!lastDataUrl) return;
    onApplyUrl(lastDataUrl);
  };

  const appendGallery = () => {
    if (!lastDataUrl || !onAppendGalleryLine) return;
    onAppendGalleryLine(lastDataUrl);
  };

  const runBatch = async (files: FileList | null) => {
    if (!files?.length) return;
    setBatchErr(null);
    setBatchSavedNote(null);
    setBusyBatch(true);
    setBatchItems([]);
    try {
      const list = await processImagesForUpload(
        Array.from(files),
        opts(),
        suggestBaseName
      );
      if (list.length === 0) {
        setBatchErr("Nijedna slikovna datoteka nije odabrana.");
      }
      setBatchItems(list);
    } catch (e) {
      setBatchErr(e instanceof Error ? e.message : "Skupna obrada nije uspjela.");
    } finally {
      setBusyBatch(false);
    }
  };

  const downloadBatchItem = (item: ProcessedUploadItem) => {
    triggerBlobDownload(item.blob, item.filename);
  };

  const downloadBatchAll = async () => {
    for (const item of batchItems) {
      triggerBlobDownload(item.blob, item.filename);
      await sleep(280);
    }
  };

  const uploadBatchToProject = async () => {
    if (!import.meta.env.DEV || batchItems.length === 0) return;
    setBatchErr(null);
    setBatchSavedNote(null);
    const paths: string[] = [];
    try {
      for (const item of batchItems) {
        const b64 = await blobToBase64Payload(item.blob);
        const r = await fetch("/__editor__/save-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: item.filename,
            dataBase64: b64,
            mime,
          }),
        });
        const j = (await r.json()) as {
          ok?: boolean;
          path?: string;
          error?: string;
        };
        if (!r.ok || !j.ok || !j.path) {
          throw new Error(j.error ?? `Neuspjelo: ${item.filename}`);
        }
        paths.push(j.path);
        await sleep(120);
      }
      setBatchSavedNote(paths.join(", "));
      if (paths[0]) onApplyUrl(paths[0]);
      onAfterDevUpload?.({ paths });
    } catch (e) {
      setBatchErr(e instanceof Error ? e.message : "Upload nije uspio.");
    }
  };

  const isDev = import.meta.env.DEV;
  const largeDataUrl = (outBytes ?? 0) > 450 * 1024;
  const showSharedControls = showSingle || showBatch;

  return (
    <div className="editor-image-studio">
      <h4 className="editor-image-studio__title">Studio slike</h4>
      <p className="editor-hint editor-image-studio__hint">
        Optimizacija u pregledniku: smanjenje dulje strane, JPEG ili WebP, bez EXIF-a.{" "}
        <strong>Preuzmi na disk</strong> sprema obrađeni blob u mapu preuzimanja.{" "}
        <strong>Upload u projekt</strong> radi samo uz <code>npm run dev</code> (zapis u{" "}
        <code>public/uploads/</code>). Na produkciji kopirajte preuzete datoteke u{" "}
        <code>public/uploads/</code> i u postavkama koristite <code>/uploads/…</code>.
      </p>

      {showSharedControls && (
        <div className="editor-image-studio__controls">
          <label className="editor-image-studio__ctl">
            <span>Dulja strana max.</span>
            <select
              className="editor-input editor-input--narrow"
              value={maxEdge}
              onChange={(e) => setMaxEdge(Number(e.target.value))}
            >
              <option value={960}>960 px</option>
              <option value={1200}>1200 px</option>
              <option value={1600}>1600 px</option>
              <option value={1920}>1920 px</option>
            </select>
          </label>
          <label className="editor-image-studio__ctl">
            <span>Format</span>
            <select
              className="editor-input editor-input--narrow"
              value={mime}
              onChange={(e) =>
                setMime(e.target.value as ProcessImageOptions["mime"])
              }
            >
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WebP</option>
            </select>
          </label>
          <label className="editor-image-studio__ctl">
            <span>Kvaliteta {Math.round(quality * 100)}%</span>
            <input
              type="range"
              min={0.65}
              max={0.95}
              step={0.05}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
            />
          </label>
        </div>
      )}

      {showSingle && (
        <>
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/*"
            className="editor-image-studio__file"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
          <div
            className={`editor-image-studio__drop${dragOver ? " is-dragover" : ""}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
            }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {busy ? "Obrađujem…" : "Jedna slika — povuci ovdje ili klikni"}
          </div>
          <div className="editor-image-studio__controls editor-image-studio__controls--tight">
            <button
              type="button"
              className="editor-btn editor-btn--ghost"
              disabled={!sourceName || busy}
              onClick={() => fileRef.current?.click()}
            >
              Drugi izvor
            </button>
            <button
              type="button"
              className="editor-btn editor-btn--ghost"
              disabled={!lastFile || busy}
              onClick={() => lastFile && void runProcess(lastFile)}
            >
              Ponovo obradi
            </button>
          </div>
        </>
      )}

      {err && <p className="editor-error">{err}</p>}

      {showSingle && sourceName && (
        <p className="editor-hint editor-image-studio__meta">
          Izvor: {sourceName}
          {sourceBytes != null ? ` · ${formatBytes(sourceBytes)}` : null}
          {dims ? ` → ${dims.w}×${dims.h}px` : null}
          {outBytes != null ? ` · izlaz ${formatBytes(outBytes)}` : null}
        </p>
      )}

      {showSingle && preview && (
        <div className="editor-image-studio__preview">
          <img src={preview} alt="Pregled obrađene slike" />
        </div>
      )}

      {showSingle && preview && lastBlob && (
        <div className="editor-image-studio__actions">
          <button
            type="button"
            className="editor-btn editor-btn--primary"
            onClick={downloadSingleToDisk}
          >
            Preuzmi na disk (HDD)
          </button>
          {isDev && (
            <button
              type="button"
              className="editor-btn editor-btn--primary"
              onClick={() => void saveSingleToProject()}
            >
              Upload u public/uploads
            </button>
          )}
          <button
            type="button"
            className="editor-btn editor-btn--ghost"
            onClick={applyDataUrl}
          >
            Umetni u polje (data URL)
          </button>
          {onAppendGalleryLine ? (
            <button
              type="button"
              className="editor-btn editor-btn--ghost"
              onClick={appendGallery}
            >
              Stavi u prvo slobodno polje (glavna + 4 dodatne)
            </button>
          ) : null}
        </div>
      )}

      {showSingle && savedPath && (
        <p className="editor-hint editor-image-studio__saved">
          Upload: <code>{savedPath}</code> — putanja je umetnuta u polje.
        </p>
      )}

      {showSingle && largeDataUrl && (
        <p className="editor-hint">
          Velika datoteka za JSON/localStorage — koristite preuzimanje ili upload u{" "}
          <code>public/uploads/</code>.
        </p>
      )}

      {showBatch && (
        <div className="editor-image-studio__batch">
          <h5 className="editor-image-studio__batch-title">Skupno (više slika)</h5>
          <p className="editor-hint">
            Odaberite više datoteka, obradite, zatim preuzmite sve ili (dev) uploadajte u{" "}
            <code>public/uploads/</code>.
          </p>
          <input
            ref={batchFileRef}
            id={batchInputId}
            type="file"
            accept="image/*"
            multiple
            className="editor-image-studio__file"
            onChange={(e) => void runBatch(e.target.files)}
          />
          <div className="editor-image-studio__actions">
            <button
              type="button"
              className="editor-btn editor-btn--ghost"
              disabled={busyBatch}
              onClick={() => batchFileRef.current?.click()}
            >
              Odaberi više slika
            </button>
            <button
              type="button"
              className="editor-btn editor-btn--ghost"
              disabled={busyBatch || batchItems.length === 0}
              onClick={() => void downloadBatchAll()}
            >
              Preuzmi sve na disk
            </button>
            {isDev && (
              <button
                type="button"
                className="editor-btn editor-btn--ghost"
                disabled={busyBatch || batchItems.length === 0}
                onClick={() => void uploadBatchToProject()}
              >
                Upload sve u projekt
              </button>
            )}
          </div>
          {busyBatch && <p className="editor-hint">Obrađujem skupinu…</p>}
          {batchErr && <p className="editor-error">{batchErr}</p>}
          {batchSavedNote && (
            <p className="editor-hint">
              Upload u projekt: <code>{batchSavedNote}</code>
              {showSingle ? " — prva putanja umetnuta u polje iznad." : "."}
            </p>
          )}
          {batchItems.length > 0 && (
            <table className="editor-image-studio__table">
              <thead>
                <tr>
                  <th>Izvor</th>
                  <th>Veličina</th>
                  <th>Izlaz</th>
                  <th>Ime datoteke</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {batchItems.map((item) => (
                  <tr key={item.filename}>
                    <td>{item.sourceName}</td>
                    <td>
                      {formatBytes(item.sourceSize)} → {item.width}×{item.height}
                    </td>
                    <td>{formatBytes(item.blob.size)}</td>
                    <td>
                      <code className="editor-image-studio__code">{item.filename}</code>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="editor-btn editor-btn--ghost"
                        onClick={() => downloadBatchItem(item)}
                      >
                        Preuzmi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
