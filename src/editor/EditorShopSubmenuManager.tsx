import { useEffect, useState } from "react";

export type ShopSubmenuRow = { slug: string; label: string };

type Props = {
  rows: ShopSubmenuRow[];
  collectionSlugOptions: string[];
  /** ID za `<datalist>` (mora biti jedinstven na stranici). */
  datalistId?: string;
  onChange: (next: ShopSubmenuRow[]) => void;
};

function rowSummary(row: ShopSubmenuRow, index: number): string {
  const t = row.label.trim() || row.slug.trim() || `Stavka ${index + 1}`;
  const s = row.slug.trim();
  const left = t.length > 56 ? `${t.slice(0, 54)}…` : t;
  return s ? `${left} — ${s.length > 28 ? `${s.slice(0, 26)}…` : s}` : left;
}

export function EditorShopSubmenuManager({
  rows,
  collectionSlugOptions,
  datalistId = "editor-shop-submenu-collection-slugs",
  onChange,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    rows.length > 0 ? 0 : -1
  );

  useEffect(() => {
    setSelectedIndex((cur) => {
      if (rows.length === 0) return -1;
      if (cur < 0) return 0;
      if (cur >= rows.length) return rows.length - 1;
      return cur;
    });
  }, [rows.length]);

  const addRow = () => {
    const next = [...rows, { slug: "", label: "" }];
    onChange(next);
    setSelectedIndex(next.length - 1);
  };

  const deleteSelected = () => {
    if (selectedIndex < 0 || selectedIndex >= rows.length) return;
    const next = rows.filter((_, i) => i !== selectedIndex);
    onChange(next);
    setSelectedIndex((prev) => {
      if (next.length === 0) return -1;
      if (prev >= next.length) return next.length - 1;
      return prev;
    });
  };

  const moveBy = (delta: number) => {
    const i = selectedIndex;
    if (i < 0 || i >= rows.length) return;
    const j = i + delta;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setSelectedIndex(j);
  };

  const updateField = (idx: number, field: keyof ShopSubmenuRow, value: string) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    onChange(next);
  };

  const selectControlValue =
    rows.length === 0 ? "" : selectedIndex >= 0 ? String(selectedIndex) : "";

  const selectedRow =
    selectedIndex >= 0 && selectedIndex < rows.length
      ? rows[selectedIndex]
      : null;

  return (
    <div className="editor-submenu-dropdown">
      <label className="editor-field editor-submenu-dropdown__pick">
        <span className="editor-field__label">Stavka padajućeg izbornika (Trgovina)</span>
        <select
          className="editor-input"
          aria-label="Odabir stavke izbornika za uređivanje ili dodavanje"
          value={rows.length === 0 ? "" : selectControlValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__add__") {
              addRow();
              return;
            }
            if (v === "") return;
            setSelectedIndex(Number(v));
          }}
        >
          {rows.length === 0 ? (
            <option value="">— Nema stavki — dodajte prvu ispod</option>
          ) : null}
          <option value="__add__">+ Dodaj novu stavku</option>
          {rows.map((row, idx) => (
            <option key={`submenu-opt-${idx}`} value={idx}>
              {rowSummary(row, idx)}
            </option>
          ))}
        </select>
      </label>

      {selectedRow != null && selectedIndex >= 0 ? (
        <div className="editor-submenu-dropdown__panel">
          <p className="editor-hint editor-hint--inline editor-hint--tight">
            Uređujete stavku <strong>{selectedIndex + 1}</strong> od {rows.length}. Redoslijed
            određuje red u padajućem izborniku u zaglavlju.
          </p>
          <div className="editor-submenu-dropdown__fields">
            <label className="editor-field">
              <span className="editor-field__label">Slug kolekcije (URL)</span>
              <input
                className="editor-input"
                placeholder="npr. kuhace"
                value={selectedRow.slug}
                onChange={(e) =>
                  updateField(selectedIndex, "slug", e.target.value)
                }
                list={datalistId}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <label className="editor-field">
              <span className="editor-field__label">
                Hrvatski natpis (fallback u izborniku)
              </span>
              <input
                className="editor-input"
                placeholder="npr. Kuhače"
                value={selectedRow.label}
                onChange={(e) =>
                  updateField(selectedIndex, "label", e.target.value)
                }
                autoComplete="off"
              />
            </label>
          </div>
          <div className="editor-submenu-dropdown__actions">
            <button
              type="button"
              className="editor-btn editor-btn--ghost"
              disabled={selectedIndex <= 0}
              onClick={() => moveBy(-1)}
              title="Premjesti gore u izborniku"
            >
              ↑ Gore
            </button>
            <button
              type="button"
              className="editor-btn editor-btn--ghost"
              disabled={selectedIndex < 0 || selectedIndex >= rows.length - 1}
              onClick={() => moveBy(1)}
              title="Premjesti dolje u izborniku"
            >
              ↓ Dolje
            </button>
            <button
              type="button"
              className="editor-btn editor-btn--ghost"
              onClick={deleteSelected}
            >
              Obriši ovu stavku
            </button>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="editor-submenu-dropdown__panel">
          <button
            type="button"
            className="editor-btn editor-btn--primary"
            onClick={addRow}
          >
            Dodaj prvu stavku
          </button>
        </div>
      ) : null}

      <datalist id={datalistId}>
        {collectionSlugOptions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
