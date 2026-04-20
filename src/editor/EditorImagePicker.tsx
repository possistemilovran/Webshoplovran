import { useMemo, useState } from "react";
import { publicAssetUrl } from "@/lib/publicUrl";

export type EditorMediaEntry = { path: string; label: string };

function matchesFilter(entry: EditorMediaEntry, q: string): boolean {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  return (
    entry.label.toLowerCase().includes(s) ||
    entry.path.toLowerCase().includes(s)
  );
}

export function EditorImagePicker({
  label,
  value,
  onChange,
  library,
  catalogItems,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Logo, uploadi i ostalo iz media-library.json */
  library: EditorMediaEntry[];
  /** Slike iz kataloga (artikli, kolekcije) — zasebna skupina u izborniku */
  catalogItems?: EditorMediaEntry[];
}) {
  const [filter, setFilter] = useState("");

  const catFiltered = useMemo(
    () => (catalogItems ?? []).filter((e) => matchesFilter(e, filter)),
    [catalogItems, filter]
  );
  const libFiltered = useMemo(
    () => library.filter((e) => matchesFilter(e, filter)),
    [library, filter]
  );

  const hasGroups = (catalogItems?.length ?? 0) > 0;

  return (
    <div className="editor-field">
      <span className="editor-field__label">{label}</span>
      <div className="editor-image-pick">
        {(hasGroups || library.length > 8) && (
          <input
            type="search"
            className="editor-input editor-input--filter"
            placeholder="Filtriraj biblioteku (slug, naziv datoteke…)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={`Filtriraj: ${label}`}
          />
        )}
        <select
          className="editor-input"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
        >
          <option value="">
            {hasGroups
              ? "— odaberi sliku (katalog ili vlastiti upload) —"
              : "— odaberi iz biblioteke (public) —"}
          </option>
          {hasGroups && catFiltered.length > 0 && (
            <optgroup label="Katalog trgovine (postojeće slike artikala)">
              {catFiltered.map((m) => (
                <option key={m.path} value={m.path}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          )}
          {hasGroups && libFiltered.length > 0 && (
            <optgroup label="Logo i vlastiti uploadi (/uploads/, …)">
              {libFiltered.map((m) => (
                <option key={m.path} value={m.path}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          )}
          {!hasGroups &&
            libFiltered.map((m) => (
              <option key={m.path} value={m.path}>
                {m.label}
              </option>
            ))}
        </select>
        {filter.trim() && catFiltered.length === 0 && libFiltered.length === 0 && (
          <p className="editor-hint editor-hint--inline" role="status">
            Nema rezultata za „{filter.trim()}”. Pokušajte dio imena datoteke ili slug artikla.
          </p>
        )}
        <input
          className="editor-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/putanja.jpg ili puni URL"
        />
        <div className="editor-thumb-wrap">
          {value ? (
            <img src={publicAssetUrl(value)} alt="" className="editor-thumb" />
          ) : (
            <span className="editor-thumb-placeholder">Nema pregleda</span>
          )}
        </div>
      </div>
    </div>
  );
}
