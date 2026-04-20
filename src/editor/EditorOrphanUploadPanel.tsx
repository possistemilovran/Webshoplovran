import { useCallback, useState } from "react";
import type { SiteSettings } from "@/config/siteDefaults";

type Props = {
  draft: SiteSettings;
  onMediaLibraryRefresh?: () => void;
};

type ScanResponse = {
  ok?: boolean;
  error?: string;
  orphans?: string[];
  usedCount?: number;
  uploadsOnDisk?: number;
  orphanCount?: number;
};

type DeleteResponse = {
  ok?: boolean;
  error?: string;
  invalid?: string[];
  deleted?: string[];
  failed?: { path: string; error: string }[];
  message?: string;
};

export function EditorOrphanUploadPanel({ draft, onMediaLibraryRefresh }: Props) {
  const [orphans, setOrphans] = useState<string[]>([]);
  const [scanMeta, setScanMeta] = useState<{
    usedCount: number;
    uploadsOnDisk: number;
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setMessage(null);
    setLoading(true);
    try {
      const r = await fetch("/__editor__/orphan-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: draft, delete: false }),
      });
      const j = (await r.json()) as ScanResponse;
      if (!r.ok || !j.ok) {
        throw new Error(j.error ?? "Skeniranje nije uspjelo.");
      }
      const list = Array.isArray(j.orphans) ? j.orphans : [];
      setOrphans(list);
      setSelected(new Set(list));
      setScanMeta({
        usedCount: j.usedCount ?? 0,
        uploadsOnDisk: j.uploadsOnDisk ?? 0,
      });
      setMessage(
        list.length === 0
          ? "Nema nekorištenih datoteka u uploads/ prema trenutačnom nacrtu i katalogu."
          : `Pronađeno ${list.length} nekorištenih datoteka (od ${j.uploadsOnDisk ?? 0} u mapi).`
      );
    } catch (e) {
      setOrphans([]);
      setScanMeta(null);
      setSelected(new Set());
      setMessage(e instanceof Error ? e.message : "Skeniranje nije uspjelo.");
    } finally {
      setLoading(false);
    }
  }, [draft]);

  const toggle = (p: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(orphans));
  const selectNone = () => setSelected(new Set());

  const runDelete = async (paths: string[]) => {
    if (paths.length === 0) {
      setMessage("Nema odabranih datoteka.");
      return;
    }
    setMessage(null);
    setLoading(true);
    try {
      const r = await fetch("/__editor__/orphan-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: draft,
          delete: true,
          paths,
        }),
      });
      const j = (await r.json()) as DeleteResponse;
      if (!r.ok || !j.ok) {
        throw new Error(j.error ?? "Brisanje nije uspjelo.");
      }
      const deleted = j.deleted ?? [];
      const failed = j.failed ?? [];
      const parts: string[] = [];
      if (deleted.length > 0) {
        parts.push(`Obrisano: ${deleted.length}.`);
      }
      if (failed.length > 0) {
        parts.push(
          `Neuspjelo: ${failed.map((f) => `${f.path} (${f.error})`).join("; ")}`
        );
      }
      if (j.message && deleted.length === 0 && failed.length === 0) {
        parts.push(j.message);
      }
      setMessage(parts.join(" ") || "Gotovo.");
      onMediaLibraryRefresh?.();
      setOrphans((prev) => prev.filter((p) => !deleted.includes(p)));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of deleted) next.delete(p);
        return next;
      });
      setScanMeta((m) =>
        m
          ? {
              ...m,
              uploadsOnDisk: Math.max(0, m.uploadsOnDisk - deleted.length),
            }
          : null
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Brisanje nije uspjelo.");
    } finally {
      setLoading(false);
    }
  };

  const dev = import.meta.env.DEV;

  return (
    <div className="editor-orphan-uploads">
      <p className="editor-hint editor-hint--tight">
        Pronalazi datoteke u <code>public/uploads/</code> koje se ne pojavljuju u{" "}
        <strong>trenutačnom nacrtu</strong> (zaglavlje, hero, priča, nadjačavanja, prijevodi), u{" "}
        <code>storeCatalog.json</code>, <code>editor-archived-overrides.json</code> ni u{" "}
        <code>imageLocalMap.json</code>. Prije brisanja spremite promjene u uredniku ako treba.
      </p>
      {!dev ? (
        <p className="editor-hint">
          Dostupno samo uz <code>npm run dev</code> (brisanje na disku).
        </p>
      ) : (
        <>
          <div className="editor-orphan-uploads__actions">
            <button
              type="button"
              className="editor-btn editor-btn--primary"
              disabled={loading}
              onClick={() => void scan()}
            >
              {loading ? "Radim…" : "Skeniraj nekorištene slike"}
            </button>
            {scanMeta != null ? (
              <span className="editor-hint editor-hint--inline">
                Referencirano putanja /uploads/: {scanMeta.usedCount} · datoteka u mapi:{" "}
                {scanMeta.uploadsOnDisk}
              </span>
            ) : null}
          </div>
          {orphans.length > 0 ? (
            <>
              <div className="editor-orphan-uploads__toolbar">
                <button
                  type="button"
                  className="editor-btn editor-btn--ghost"
                  disabled={loading}
                  onClick={selectAll}
                >
                  Odaberi sve
                </button>
                <button
                  type="button"
                  className="editor-btn editor-btn--ghost"
                  disabled={loading}
                  onClick={selectNone}
                >
                  Poništi odabir
                </button>
                <button
                  type="button"
                  className="editor-btn editor-btn--ghost"
                  disabled={loading || selected.size === 0}
                  onClick={() => void runDelete([...selected])}
                >
                  Obriši odabrane
                </button>
                <button
                  type="button"
                  className="editor-btn editor-btn--primary editor-btn--archive"
                  disabled={loading}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Obrisati svih ${orphans.length} nekorištenih datoteka u uploads/? Ovo se ne može poništiti.`
                      )
                    ) {
                      return;
                    }
                    void runDelete(orphans);
                  }}
                >
                  Obriši sve nekorištene
                </button>
              </div>
              <ul className="editor-orphan-uploads__list">
                {orphans.map((p) => (
                  <li key={p}>
                    <label className="editor-orphan-uploads__row">
                      <input
                        type="checkbox"
                        checked={selected.has(p)}
                        onChange={() => toggle(p)}
                      />
                      <code>{p}</code>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
      {message ? (
        <p className="editor-info-ok" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
