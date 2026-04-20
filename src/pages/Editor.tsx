import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { flushSync } from "react-dom";
import {
  DEFAULT_SITE_SETTINGS,
  FONT_PRESET_GOOGLE_IDS,
  FONT_PRESET_LOCAL_IDS,
  FONT_PRESET_WINDOWS_IDS,
  FONT_PRESETS,
  resolveFontStack,
  type SiteSettings,
} from "@/config/siteDefaults";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { EditorAdvanced } from "@/pages/EditorAdvanced";
import { EditorImagePicker, type EditorMediaEntry } from "@/editor/EditorImagePicker";
import { EditorImageStudio } from "@/editor/EditorImageStudio";
import { EditorLocalePanel } from "@/editor/EditorLocalePanel";
import { EditorOrphanUploadPanel } from "@/editor/EditorOrphanUploadPanel";
import { publicAssetUrl } from "@/lib/publicUrl";
import { siteSettingsToCssVarsStyle } from "@/lib/themeCssVars";
import { injectGoogleFontLinks } from "@/lib/webFonts";
import { matchesEditorSectionQuery } from "@/lib/editorSearch";
import { EDITOR_QUICK_JUMPS } from "@/lib/editorQuickJumps";
import {
  buildCatalogMediaEntries,
  fileOnlyMediaEntries,
} from "@/lib/editorCatalogMedia";
import { collections, products } from "@/data/catalog";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="editor-field">
      <span className="editor-field__label">{label}</span>
      {children}
    </div>
  );
}

const FONT_PICKER_SAMPLE = "Olivo Unikat — AaBbČčĐđŽž";

function FontPresetPicker({
  value,
  onChange,
  groupLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  groupLabel: string;
}) {
  const unknownId =
    value && !FONT_PRESETS[value] ? value : null;

  const renderOption = (
    id: string,
    source: "google" | "windows" | "local"
  ) => {
    const stack = resolveFontStack(id, "");
    const p = FONT_PRESETS[id];
    const srcLabel =
      source === "google" ? "Google" : source === "windows" ? "Windows" : "Lokalno";
    return (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={value === id}
        className={`editor-font-picker__opt${value === id ? " is-selected" : ""}`}
        onClick={() => onChange(id)}
      >
        <span
          className="editor-font-picker__sample"
          style={{ fontFamily: stack }}
          aria-hidden
        >
          {FONT_PICKER_SAMPLE}
        </span>
        <span className="editor-font-picker__row">
          <span className="editor-font-picker__name">{p.label}</span>
          <span className="editor-font-picker__src">{srcLabel}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="editor-font-picker-wrap">
      {unknownId ? (
        <div role="status" className="editor-font-picker__warn">
          Spremljen je nepoznat predložak <code>{unknownId}</code>. Odaberi font
          ispod.
        </div>
      ) : null}
      <div
        className="editor-font-picker"
        role="radiogroup"
        aria-label={groupLabel}
      >
      <div className="editor-font-picker__group-label" aria-hidden>
        Google Fonts
      </div>
      {FONT_PRESET_GOOGLE_IDS.map((id) => renderOption(id, "google"))}
      <div className="editor-font-picker__group-label" aria-hidden>
        Fontovi sustava (Windows 10)
      </div>
      {FONT_PRESET_WINDOWS_IDS.map((id) => renderOption(id, "windows"))}
      <div className="editor-font-picker__group-label" aria-hidden>
        Lokalni fontovi (FONTOVI)
      </div>
      {FONT_PRESET_LOCAL_IDS.map((id) => renderOption(id, "local"))}
      </div>
    </div>
  );
}

function FontPreview({ stack }: { stack: string }) {
  return (
    <p className="editor-font-preview" style={{ fontFamily: stack }}>
      Olivo Unikat — AaBbČčĐđŽž 0123456789
    </p>
  );
}

export function Editor() {
  const { settings, setSettings, resetSettings, importJson } =
    useSiteSettings();
  const [draft, setDraft] = useState<SiteSettings>(settings);
  const [savedFlash, setSavedFlash] = useState(false);
  const [importArea, setImportArea] = useState("");
  const [importErr, setImportErr] = useState(false);
  const [mediaLib, setMediaLib] = useState<EditorMediaEntry[]>([]);
  const [editorSearchQuery, setEditorSearchQuery] = useState("");
  const [editorTextSearchQuery, setEditorTextSearchQuery] = useState("");
  const [editorTextSearchJumpSignal, setEditorTextSearchJumpSignal] = useState(0);

  const requestTextSearchJump = () => {
    setEditorTextSearchJumpSignal((n) => n + 1);
  };

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const reloadMediaLibrary = useCallback(() => {
    const apply = (data: { images?: EditorMediaEntry[] }) => {
      setMediaLib(Array.isArray(data.images) ? data.images : []);
    };
    if (import.meta.env.DEV) {
      fetch("/__editor__/sync-media-library")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(apply)
        .catch(() =>
          fetch(`${publicAssetUrl("/media-library.json")}?t=${Date.now()}`)
            .then((r) => (r.ok ? r.json() : { images: [] }))
            .then(apply)
        );
    } else {
      fetch(`${publicAssetUrl("/media-library.json")}?t=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : { images: [] }))
        .then(apply)
        .catch(() => setMediaLib([]));
    }
  }, []);

  useEffect(() => {
    reloadMediaLibrary();
  }, [reloadMediaLibrary]);

  const catalogPickerItems = useMemo(
    () => buildCatalogMediaEntries(products, collections),
    []
  );
  const filePickerItems = useMemo(
    () => fileOnlyMediaEntries(catalogPickerItems, mediaLib),
    [catalogPickerItems, mediaLib]
  );

  useEffect(() => {
    injectGoogleFontLinks(draft.fonts, "editor");
    return () => {
      document
        .querySelectorAll('link[data-olivo-gf^="ed-"]')
        .forEach((n) => n.remove());
    };
  }, [draft.fonts]);

  useEffect(() => {
    document.documentElement.classList.add("editor-route");
    return () => document.documentElement.classList.remove("editor-route");
  }, []);

  const save = () => {
    setSettings(draft);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  const draftTheme = siteSettingsToCssVarsStyle(draft);

  const jumpToSection = useCallback((query: string) => {
    const q = query.trim().toLowerCase();
    if (q === "uredi artikl") {
      flushSync(() => {
        setEditorSearchQuery(query);
      });
      document
        .getElementById("editor-uredi-postojeci-artikl")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setEditorSearchQuery(query);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return (
    <div className="editor-page" style={draftTheme}>
      <nav
        className="editor-quick-nav"
        aria-label="Brzi skok po dijelovima urednika"
      >
        <span className="editor-quick-nav__label">Brzi skok</span>
        <div className="editor-quick-nav__btns">
          {EDITOR_QUICK_JUMPS.map(({ label, query }) => {
            const active = editorSearchQuery.trim() === query.trim();
            return (
              <button
                key={label}
                type="button"
                className={`editor-quick-nav__btn${active ? " is-active" : ""}${
                  label === "BRIŠI SLIKE"
                    ? " editor-quick-nav__btn--delete"
                    : ""
                }`}
                onClick={() => jumpToSection(query)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="editor-page__search-row editor-page__search-row--dual">
        <div className="editor-page__search-field">
          <label className="editor-page__search-label" htmlFor="editor-section-search">
            Sekcije urednika
          </label>
          <input
            id="editor-section-search"
            type="search"
            className="editor-page__search"
            placeholder="Npr. artikl, izbornik, kolekcija, prijevod, font…"
            value={editorSearchQuery}
            onChange={(e) => setEditorSearchQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="editor-page__search-field">
          <label className="editor-page__search-label" htmlFor="editor-text-search">
            Tekstovi (prijevodi)
          </label>
          <div className="editor-page__search-input-with-btn">
            <input
              id="editor-text-search"
              type="search"
              className="editor-page__search editor-page__search--no-leading-icon"
              placeholder="Upiši traženi tekst ili ključ, zatim Enter ili povećalo…"
              value={editorTextSearchQuery}
              onChange={(e) => setEditorTextSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  requestTextSearchJump();
                }
              }}
              autoComplete="off"
            />
            <button
              type="button"
              className="editor-page__search-jump"
              aria-label="Idi na polje s tekstom i stavi ga u fokus"
              title="Idi na polje i uredi"
              onMouseDown={(e) => e.preventDefault()}
              onClick={requestTextSearchJump}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <header className="editor-page__head">
        <div>
          <h1 className="editor-page__title">Uređivač stranice</h1>
          <p className="editor-page__sub">
            Postavke se spremaju u preglednik (localStorage). Ispod: <strong>artikli i trgovina</strong>,{" "}
            <strong>tekstovi po jezicima</strong>, zatim izgled po područjima (traka, tijelo, zaglavlje,
            hero, sekcije, studio/priča). Spremanje je u zaglavlju.
          </p>
        </div>
        <div className="editor-page__actions">
          <Link to="/" className="editor-btn editor-btn--ghost">
            ← Natrag na stranicu
          </Link>
          <button type="button" className="editor-btn editor-btn--primary" onClick={save}>
            Spremi promjene
          </button>
          {savedFlash && (
            <span className="editor-saved" role="status">
              Spremljeno
            </span>
          )}
        </div>
      </header>

      <div className="editor-grid">
        <EditorAdvanced
          draft={draft}
          setDraft={setDraft}
          searchQuery={editorSearchQuery}
          catalogPickerItems={catalogPickerItems}
          filePickerItems={filePickerItems}
          onMediaLibraryRefresh={reloadMediaLibrary}
          onPersistSettings={setSettings}
        />

        <EditorLocalePanel
          draft={draft}
          setDraft={setDraft}
          onPersistSettings={setSettings}
          searchQuery={editorSearchQuery}
          textSearchQuery={editorTextSearchQuery}
          textSearchJumpSignal={editorTextSearchJumpSignal}
        />

        {matchesEditorSectionQuery(
          editorSearchQuery,
          "traka marquee obavijest vrh animacija trajanje banner"
        ) && (
        <section className="editor-card">
          <h2>Traka na vrhu (marquee) — izgled</h2>
          <p className="editor-hint">
            Tekst segmenta u odjeljku „Tekstovi stranica” → Traka obavijesti (po jeziku).
          </p>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Prikaz</h3>
            <Field label="Prikaži traku">
              <input
                type="checkbox"
                checked={draft.announcement.enabled}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    announcement: { ...d.announcement, enabled: e.target.checked },
                  }))
                }
              />
            </Field>
          </div>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Boje trake i trajanje animacije</h3>
            <div className="editor-color-grid editor-color-grid--tight">
              <Field label="Boja pozadine trake">
                <input
                  type="color"
                  value={draft.announcement.background}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      announcement: {
                        ...d.announcement,
                        background: e.target.value,
                      },
                    }))
                  }
                />
              </Field>
              <Field label="Boja teksta trake">
                <input
                  type="color"
                  value={draft.announcement.color}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      announcement: { ...d.announcement, color: e.target.value },
                    }))
                  }
                />
              </Field>
              <Field label="Trajanje kruga (s)">
                <input
                  type="number"
                  min={8}
                  max={120}
                  className="editor-input editor-input--narrow"
                  value={draft.announcement.durationSec}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      announcement: {
                        ...d.announcement,
                        durationSec: Number(e.target.value) || 32,
                      },
                    }))
                  }
                />
              </Field>
            </div>
          </div>
        </section>
        )}

        {matchesEditorSectionQuery(
          editorSearchQuery,
          "tijelo stranice pozadina gradijent body tekst glavni sekundarni obrubi linije font fontovi tipografija sans općenito muted ink page boje google windows lokalno"
        ) && (
        <section className="editor-card editor-card--wide">
          <h2>Tijelo stranice</h2>
          <p className="editor-hint editor-hint--tight">
            Pozadina, tekstovi u sadržaju i font za paragrafe / opis (ne zaglavlje niti veliki naslovi).
          </p>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Boje</h3>
            <div className="editor-color-grid editor-color-grid--tight">
              {(
                [
                  [
                    "pageBackground",
                    "Pozadina stranice (gradijent od ove boje)",
                  ],
                  ["pageMuted", "Prigušena pozadina (sekcije, kartice)"],
                  ["ink", "Glavni tekst tijela"],
                  ["inkMuted", "Sekundarni tekst"],
                  ["line", "Linije i obrubi"],
                ] as const
              ).map(([key, lab]) => (
                <Field key={key} label={lab}>
                  <input
                    type="color"
                    value={draft.colors[key]}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        colors: { ...d.colors, [key]: e.target.value },
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
          </div>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Font tijela (sans)</h3>
            <p className="editor-hint editor-hint--tight">
              Google / Windows / lokalno u <code>public/fonts/site/</code>.
            </p>
            <Field label="Predložak i vlastiti font-family">
              <FontPresetPicker
                groupLabel="Predložak fonta za tijelo stranice"
                value={draft.fonts.bodyPresetId}
                onChange={(id) =>
                  setDraft((d) => ({
                    ...d,
                    fonts: { ...d.fonts, bodyPresetId: id },
                  }))
                }
              />
              <input
                className="editor-input"
                placeholder="Vlastiti font-family (opcionalno)"
                value={draft.fonts.bodyFamilyOverride}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    fonts: { ...d.fonts, bodyFamilyOverride: e.target.value },
                  }))
                }
              />
              <FontPreview
                stack={resolveFontStack(
                  draft.fonts.bodyPresetId,
                  draft.fonts.bodyFamilyOverride
                )}
              />
            </Field>
          </div>
        </section>
        )}

        {matchesEditorSectionQuery(
          editorSearchQuery,
          "zaglavlje header logo izbornik navigacija poveznica naglasak hover font fontovi tipografija menu accent google windows lokalno"
        ) && (
        <section className="editor-card editor-card--wide">
          <h2>Zaglavlje</h2>
          <p className="editor-hint editor-hint--tight">
            Pozadina trake, logo, font izbornika i boje poveznica (uključujući naglasak diljem stranice).
          </p>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Boje</h3>
            <div className="editor-color-grid editor-color-grid--tight">
              <Field label="Pozadina zaglavlja">
                <input
                  type="color"
                  value={draft.colors.headerBackground}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      colors: { ...d.colors, headerBackground: e.target.value },
                    }))
                  }
                />
              </Field>
              <Field label="Poveznice / naglasak (izbornik i naglasci)">
                <input
                  type="color"
                  value={draft.colors.accent}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      colors: { ...d.colors, accent: e.target.value },
                    }))
                  }
                />
              </Field>
              <Field label="Poveznice pri lebdenju (hover)">
                <input
                  type="color"
                  value={draft.colors.accentHover}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      colors: { ...d.colors, accentHover: e.target.value },
                    }))
                  }
                />
              </Field>
            </div>
          </div>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Font izbornika</h3>
            <Field label="Predložak i vlastiti font-family">
              <FontPresetPicker
                groupLabel="Predložak fonta za zaglavlje"
                value={draft.fonts.headerNavPresetId}
                onChange={(id) =>
                  setDraft((d) => ({
                    ...d,
                    fonts: { ...d.fonts, headerNavPresetId: id },
                  }))
                }
              />
              <input
                className="editor-input"
                placeholder="Vlastiti font-family (opcionalno)"
                value={draft.fonts.headerNavFamilyOverride}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    fonts: { ...d.fonts, headerNavFamilyOverride: e.target.value },
                  }))
                }
              />
              <FontPreview
                stack={resolveFontStack(
                  draft.fonts.headerNavPresetId,
                  draft.fonts.headerNavFamilyOverride
                )}
              />
            </Field>
          </div>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Logo</h3>
            <EditorImagePicker
              label="Logo u zaglavlju"
              value={draft.images.logo}
              onChange={(v) =>
                setDraft((d) => ({ ...d, images: { ...d.images, logo: v } }))
              }
              catalogItems={catalogPickerItems}
              library={filePickerItems}
            />
          </div>
        </section>
        )}

        {matchesEditorSectionQuery(
          editorSearchQuery,
          "hero naslovnica naslov heroja podnaslov eyebrow pozadina slika font fontovi tipografija serif naslovi veliki glavni banner google windows lokalno"
        ) && (
        <section className="editor-card editor-card--wide">
          <h2>Hero (naslovnica)</h2>
          <p className="editor-hint editor-hint--tight">
            Veliki naslov, podnaslov, mali natpisi iznad (eyebrow), boje tih tekstova, font za naslove (isti se koristi i za naslove sekcija h2) i pozadinska slika heroja.
          </p>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Boje tekstova</h3>
            <div className="editor-color-grid editor-color-grid--tight">
              {(
                [
                  ["heroTitle", "Naslov heroja"],
                  ["heroLede", "Podnaslov heroja"],
                  ["eyebrow", "Mali naslovi (eyebrow)"],
                ] as const
              ).map(([key, lab]) => (
                <Field key={key} label={lab}>
                  <input
                    type="color"
                    value={draft.textColors[key]}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        textColors: { ...d.textColors, [key]: e.target.value },
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
          </div>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Font naslova (serif / hero i h2)</h3>
            <Field label="Predložak i vlastiti font-family">
              <FontPresetPicker
                groupLabel="Predložak fonta za naslove"
                value={draft.fonts.headingPresetId}
                onChange={(id) =>
                  setDraft((d) => ({
                    ...d,
                    fonts: { ...d.fonts, headingPresetId: id },
                  }))
                }
              />
              <input
                className="editor-input"
                placeholder="Vlastiti font-family (opcionalno)"
                value={draft.fonts.headingFamilyOverride}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    fonts: { ...d.fonts, headingFamilyOverride: e.target.value },
                  }))
                }
              />
              <FontPreview
                stack={resolveFontStack(
                  draft.fonts.headingPresetId,
                  draft.fonts.headingFamilyOverride
                )}
              />
            </Field>
          </div>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Pozadinska slika</h3>
            <EditorImagePicker
              label="Pozadina heroja"
              value={draft.images.heroBackground}
              onChange={(v) =>
                setDraft((d) => ({ ...d, images: { ...d.images, heroBackground: v } }))
              }
              catalogItems={catalogPickerItems}
              library={filePickerItems}
            />
          </div>
        </section>
        )}

        {matchesEditorSectionQuery(
          editorSearchQuery,
          "sekcija sekcije h2 naslov blok section heading podnaslovi kolekcije home"
        ) && (
        <section className="editor-card">
          <h2>Naslovi sekcija (h2)</h2>
          <p className="editor-hint editor-hint--tight">
            Boja naslova blokova ispod heroja. Tip slova je isti kao u kartici „Hero (naslovnica)”.
          </p>
          <div className="editor-card__group">
            <div className="editor-color-grid editor-color-grid--tight">
              <Field label="Naslovi sekcija (h2)">
                <input
                  type="color"
                  value={draft.textColors.sectionHeading}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      textColors: {
                        ...d.textColors,
                        sectionHeading: e.target.value,
                      },
                    }))
                  }
                />
              </Field>
            </div>
          </div>
        </section>
        )}

        {matchesEditorSectionQuery(
          editorSearchQuery,
          "slike priča story our slika media biblioteka jpeg png studio upload preuzmi skupno batch optimizacija alat nekorišten siroče orphan čišćenje briši obriši uploads smeće briši slike brisanje slika"
        ) && (
        <section className="editor-card editor-card--wide">
          <h2>Studio i slika priče</h2>
          <p className="editor-hint editor-hint--tight">
            Alat za obradu i upload u <code>public/uploads/</code>. Logo i hero su u karticama Zaglavlje /
            Hero. Ovdje slika uz blok „Our story” i skupni upload.
          </p>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Studio, upload i biblioteka</h3>
            <p className="editor-hint editor-hint--tight">
              <strong>Katalog trgovine</strong> + <strong>Logo i vlastiti uploadi</strong> (
              <code>media-library.json</code>). U devu Studio dodaje stavke; „Osvježi” ponovno učitava listu.
            </p>
            <div className="editor-hint editor-hint--row">
              <button
                type="button"
                className="editor-btn editor-btn--ghost"
                onClick={() => reloadMediaLibrary()}
              >
                Osvježi biblioteku
              </button>
              <span className="editor-hint--inline">
                Ručno dodane datoteke u <code>public/</code> — u devu klik ovdje.
              </span>
            </div>
            <EditorImageStudio
              showSingle={false}
              showBatch
              suggestBaseName="site"
              onApplyUrl={() => {}}
              onAfterDevUpload={() => reloadMediaLibrary()}
            />
          </div>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Slika uz priču (Our story)</h3>
            <EditorImagePicker
              label="Slika uz priču (Our story)"
              value={draft.images.storyImage}
              onChange={(v) =>
                setDraft((d) => ({ ...d, images: { ...d.images, storyImage: v } }))
              }
              catalogItems={catalogPickerItems}
              library={filePickerItems}
            />
          </div>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">
              Nekorištene slike u uploads/
            </h3>
            <EditorOrphanUploadPanel
              draft={draft}
              onMediaLibraryRefresh={reloadMediaLibrary}
            />
          </div>
        </section>
        )}

        {matchesEditorSectionQuery(
          editorSearchQuery,
          "izvoz uvoz json reset preuzmi import export postavke spremanje"
        ) && (
        <section className="editor-card">
          <h2>Izvoz / uvoz / reset</h2>
          <div className="editor-card__group">
          <div className="editor-stack">
            <button
              type="button"
              className="editor-btn editor-btn--ghost"
              onClick={() => {
                const blob = new Blob([JSON.stringify(draft, null, 2)], {
                  type: "application/json",
                });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "olivo-site-settings.json";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Preuzmi JSON postavki
            </button>
            <textarea
              className="editor-textarea"
              rows={6}
              placeholder="Zalijepi JSON za uvoz…"
              value={importArea}
              onChange={(e) => {
                setImportArea(e.target.value);
                setImportErr(false);
              }}
            />
            <button
              type="button"
              className="editor-btn editor-btn--ghost"
              onClick={() => {
                if (importJson(importArea)) {
                  setImportArea("");
                  setImportErr(false);
                } else {
                  setImportErr(true);
                }
              }}
            >
              Uvezi JSON
            </button>
            {importErr && (
              <p className="editor-error">JSON nije valjan.</p>
            )}
            <button
              type="button"
              className="editor-btn editor-btn--danger"
              onClick={() => {
                if (
                  window.confirm(
                    "Vratiti sve na zadane vrijednosti? Preglednik će spremiti reset."
                  )
                ) {
                  resetSettings();
                  setDraft(structuredClone(DEFAULT_SITE_SETTINGS));
                }
              }}
            >
              Reset na zadano
            </button>
          </div>
          </div>
        </section>
        )}
      </div>
    </div>
  );
}
