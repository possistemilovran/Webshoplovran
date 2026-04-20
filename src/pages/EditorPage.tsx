import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  DEFAULT_ABOUT_SLIDESHOW_URLS,
  DEFAULT_SITE_SETTINGS,
  FONT_PRESET_GOOGLE_IDS,
  FONT_PRESET_LOCAL_IDS,
  FONT_PRESET_WINDOWS_IDS,
  FONT_PRESETS,
  deepMergeSite,
  resolveFontStack,
  type AppLocaleCode,
  type SiteSettings,
} from "@/config/siteDefaults";
import {
  refreshArchivedLocaleOverrides,
  useSiteSettings,
} from "@/context/SiteSettingsContext";
import {
  BUNDLED_LOCALE_CODES,
  BUNDLED_LOCALE_LABELS,
} from "@/i18n/bundledLocales";
import { applyLocaleBundlesFromSettings } from "@/i18n/applyLocaleBundles";
import { EditorImagePicker, type EditorMediaEntry } from "@/editor/EditorImagePicker";
import { EditorImageStudio } from "@/editor/EditorImageStudio";
import { EditorLocalePanel } from "@/editor/EditorLocalePanel";
import { EditorOrphanUploadPanel } from "@/editor/EditorOrphanUploadPanel";
import {
  runFullSiteTranslateHealthCheck,
  runSiteTextAutoTranslate,
} from "@/lib/bulkSiteTranslate";
import { publicAssetUrl } from "@/lib/publicUrl";
import { siteSettingsToCssVarsStyle } from "@/lib/themeCssVars";
import { injectGoogleFontLinks } from "@/lib/webFonts";
import {
  buildCatalogMediaEntries,
  fileOnlyMediaEntries,
} from "@/lib/editorCatalogMedia";
import { blobToBase64Payload, processImageFile } from "@/lib/processImageInBrowser";
import { collections, products } from "@/data/catalog";

/**
 * Urednik stranice (ruta `/urednik-stranica`).
 *
 * Dizajn: linearan, bez filtera i brzog skoka unutar forme. Sve je uvijek
 * vidljivo. Sticky gornja traka daje „izlaz na stranicu” (brzi skokovi na
 * glavne rute) i glavni gumb `Ažuriraj stranicu` koji:
 *   1) Normalizira nacrt kroz `deepMergeSite(DEFAULT, draft)` tako da dobiju
 *      se sva nova polja iz verzija defaulta koja još nisu u spremljenom
 *      objektu (legacy localStorage).
 *   2) Prevodi HR → svi jezici (EN/DE/FR/IT/SL/PL/CS) kroz MyMemory. Po
 *      zadanom prepisuje sve (ako u toolbaru isključiš „gaps only”).
 *   3) Sprema u dvije mete — `localStorage` (SiteSettingsContext) i
 *      `public/editor-archived-locale-overrides.json` preko Vite middleware-a.
 *
 * Urednik NE dira artikle, slugove artikala ni kategorije / grupe (one imaju
 * svoj urednik: /urednik-auto).
 */

const APP_LANGS: AppLocaleCode[] = BUNDLED_LOCALE_CODES;

const QUICK_NAV: { label: string; path: string; key: string }[] = [
  { label: "Početna", path: "/", key: "home" },
  { label: "Shop", path: "/shop", key: "shop" },
  { label: "Blog", path: "/blogs/news", key: "blog" },
  { label: "O nama", path: "/pages/about", key: "about" },
  { label: "Kontakt", path: "/pages/contact", key: "contact" },
  { label: "Košarica", path: "/checkout", key: "cart" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="editor-field">
      <span className="editor-field__label">{label}</span>
      {children}
      {hint ? <span className="editor-field__hint">{hint}</span> : null}
    </label>
  );
}

function Section({
  title,
  hint,
  children,
  id,
  wide = true,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  id?: string;
  wide?: boolean;
}) {
  return (
    <section
      id={id}
      className={`editor-card${wide ? " editor-card--wide" : ""}`}
    >
      <h2>{title}</h2>
      {hint ? <p className="editor-hint editor-hint--tight">{hint}</p> : null}
      <div className="editor-card__group">{children}</div>
    </section>
  );
}

const FONT_SAMPLE = "Radionica Lun — AaBbČčĐđŽž";

function FontPresetPicker({
  value,
  onChange,
  groupLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  groupLabel: string;
}) {
  const unknownId = value && !FONT_PRESETS[value] ? value : null;
  const opt = (id: string, source: "google" | "windows" | "local") => {
    const stack = resolveFontStack(id, "");
    const p = FONT_PRESETS[id];
    const srcLabel =
      source === "google"
        ? "Google"
        : source === "windows"
          ? "Windows"
          : "Lokalno";
    return (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={value === id}
        className={`editor-font-picker__opt${
          value === id ? " is-selected" : ""
        }`}
        onClick={() => onChange(id)}
      >
        <span
          className="editor-font-picker__sample"
          style={{ fontFamily: stack }}
          aria-hidden
        >
          {FONT_SAMPLE}
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
        {FONT_PRESET_GOOGLE_IDS.map((id) => opt(id, "google"))}
        <div className="editor-font-picker__group-label" aria-hidden>
          Fontovi sustava (Windows 10)
        </div>
        {FONT_PRESET_WINDOWS_IDS.map((id) => opt(id, "windows"))}
        <div className="editor-font-picker__group-label" aria-hidden>
          Lokalni fontovi (FONTOVI)
        </div>
        {FONT_PRESET_LOCAL_IDS.map((id) => opt(id, "local"))}
      </div>
    </div>
  );
}

function FontPreview({ stack }: { stack: string }) {
  return (
    <p className="editor-font-preview" style={{ fontFamily: stack }}>
      Radionica Lun — AaBbČčĐđŽž 0123456789
    </p>
  );
}

/** Broj ne-praznih stringova u stablu prijevoda (za prikaz pokrivenosti jezika). */
function countNonEmptyStrings(node: unknown): number {
  if (node == null) return 0;
  if (typeof node === "string") return node.trim() === "" ? 0 : 1;
  if (Array.isArray(node))
    return node.reduce<number>((s, x) => s + countNonEmptyStrings(x), 0);
  if (typeof node === "object") {
    let sum = 0;
    for (const v of Object.values(node as Record<string, unknown>)) {
      sum += countNonEmptyStrings(v);
    }
    return sum;
  }
  return 0;
}

type Status =
  | { kind: "idle" }
  | { kind: "busy"; msg: string }
  | { kind: "ok"; msg: string }
  | { kind: "err"; msg: string };

export function EditorPage() {
  const { settings, setSettings, resetSettings, importJson } =
    useSiteSettings();
  const [draft, setDraft] = useState<SiteSettings>(settings);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [importArea, setImportArea] = useState("");
  const [importErr, setImportErr] = useState(false);
  const [mediaLib, setMediaLib] = useState<EditorMediaEntry[]>([]);
  const [aboutSlideUploadBusy, setAboutSlideUploadBusy] = useState<
    number | null
  >(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  /** Učitaj biblioteku slika (dev server čita `public/` mapu, inače statički JSON). */
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

  const aboutSlides = useMemo(
    () =>
      draft.images.aboutSlideshow.length === 12
        ? draft.images.aboutSlideshow
        : [...DEFAULT_ABOUT_SLIDESHOW_URLS],
    [draft.images.aboutSlideshow]
  );

  const replaceAboutSlideUrl = useCallback((slot: number, newUrl: string) => {
    const trimmed = newUrl.trim();
    setDraft((d) => {
      const prev = d.images.aboutSlideshow[slot] ?? "";
      const base =
        d.images.aboutSlideshow.length === 12
          ? [...d.images.aboutSlideshow]
          : [...DEFAULT_ABOUT_SLIDESHOW_URLS];
      base[slot] = trimmed;
      if (import.meta.env.DEV && prev.startsWith("/uploads/") && prev !== trimmed) {
        queueMicrotask(() => {
          void fetch("/__editor__/delete-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: prev }),
          });
        });
      }
      return { ...d, images: { ...d.images, aboutSlideshow: base } };
    });
  }, []);

  const handleAboutSlideFile = useCallback(
    async (slot: number, file: File | null) => {
      if (!file || !import.meta.env.DEV) return;
      const prev = aboutSlides[slot] ?? "";
      setAboutSlideUploadBusy(slot);
      try {
        const out = await processImageFile(file, {
          maxEdge: 1680,
          mime: "image/jpeg",
          quality: 0.85,
        });
        const b64 = await blobToBase64Payload(out.blob);
        const r = await fetch("/__editor__/save-about-slide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slot,
            dataBase64: b64,
            mime: "image/jpeg",
          }),
        });
        const j = (await r.json()) as {
          ok?: boolean;
          path?: string;
          error?: string;
        };
        if (!r.ok || !j.ok || !j.path) {
          throw new Error(j.error ?? "Spremanje slike nije uspjelo.");
        }
        if (prev.startsWith("/uploads/") && prev !== j.path) {
          await fetch("/__editor__/delete-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: prev }),
          });
        }
        setDraft((d) => {
          const arr =
            d.images.aboutSlideshow.length === 12
              ? [...d.images.aboutSlideshow]
              : [...DEFAULT_ABOUT_SLIDESHOW_URLS];
          arr[slot] = j.path!;
          return { ...d, images: { ...d.images, aboutSlideshow: arr } };
        });
        reloadMediaLibrary();
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : "Upload slike nije uspio."
        );
      } finally {
        setAboutSlideUploadBusy(null);
      }
    },
    [aboutSlides, reloadMediaLibrary]
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

  /**
   * Glavna akcija urednika — „Ažuriraj stranicu”:
   *   1) Normalizira nacrt preko `deepMergeSite(DEFAULT, draft)` tako da se
   *      dopune novi ključevi iz aktualne sheme (migracija starog localStoragea).
   *   2) ČISTI sve `localeOverrides` jezike osim HR-a — svaki ručni prijevod se
   *      odbacuje. HR ostaje izvor istine.
   *   3) Preko MyMemory-a prevodi HR → EN/DE/FR/IT/SL/PL/CS u prazna polja
   *      (gapsOnly je bespredmetan kad su sva polja obrisana).
   *   4) Primjenjuje u i18n i sprema u dvije mete: `localStorage`
   *      (SiteSettingsContext) i `public/editor-archived-locale-overrides.json`.
   *
   * Zbog gubitka ručnih prijevoda korisnik dobiva potvrdu prije izvedbe.
   */
  const refreshPage = async () => {
    if (
      !window.confirm(
        "Ažuriraj stranicu će obrisati sve postojeće prijevode (osim HR) i " +
          "ponovno ih generirati preko MyMemory-a. Nastaviti?"
      )
    ) {
      return;
    }
    try {
      const normalized = deepMergeSite(DEFAULT_SITE_SETTINGS, draft);
      const hrOnly = {
        ...normalized,
        localeOverrides: {
          hr: normalized.localeOverrides.hr,
        } as SiteSettings["localeOverrides"],
      };

      setStatus({ kind: "busy", msg: "Brišem stare prijevode…" });
      setDraft(hrOnly);
      applyLocaleBundlesFromSettings(hrOnly.localeOverrides);

      setStatus({ kind: "busy", msg: "Prevodim tekstove…" });
      const translated = await runSiteTextAutoTranslate(
        hrOnly,
        (m) => setStatus({ kind: "busy", msg: m }),
        { gapsOnly: false }
      );
      setDraft(translated);
      applyLocaleBundlesFromSettings(translated.localeOverrides);

      setStatus({ kind: "busy", msg: "Spremam…" });
      setSettings(translated);
      const r = await fetch("/__editor__/save-locale-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: translated.localeOverrides }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      refreshArchivedLocaleOverrides();

      const health = runFullSiteTranslateHealthCheck(translated);
      const missingSummary = health.ok
        ? ""
        : ` — prazna polja: ${Object.entries(health.byLang)
            .filter(([code]) => code !== "hr")
            .map(([code, v]) => `${code.toUpperCase()}: ${v.localeMissing}`)
            .join(", ")}`;
      setStatus({
        kind: "ok",
        msg: health.ok
          ? "Stranica ažurirana i spremljena"
          : `Spremljeno${missingSummary}`,
      });
      window.setTimeout(() => setStatus({ kind: "idle" }), 4000);
    } catch (e) {
      setStatus({
        kind: "err",
        msg: e instanceof Error ? `Greška: ${e.message}` : "Greška",
      });
      window.setTimeout(() => setStatus({ kind: "idle" }), 4500);
    }
  };

  /** Tiho spremi samo trenutni nacrt (bez prijevoda) — za male izmjene slika/boja. */
  const saveOnly = async () => {
    try {
      setStatus({ kind: "busy", msg: "Spremam…" });
      setSettings(draft);
      const r = await fetch("/__editor__/save-locale-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: draft.localeOverrides }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      refreshArchivedLocaleOverrides();
      setStatus({ kind: "ok", msg: "Spremljeno" });
      window.setTimeout(() => setStatus({ kind: "idle" }), 2000);
    } catch (e) {
      setStatus({
        kind: "err",
        msg: e instanceof Error ? `Greška: ${e.message}` : "Greška",
      });
      window.setTimeout(() => setStatus({ kind: "idle" }), 4000);
    }
  };

  const draftTheme = siteSettingsToCssVarsStyle(draft);
  const busy = status.kind === "busy";

  const localeCoverage = useMemo(
    () =>
      APP_LANGS.map((code) => ({
        code,
        label: BUNDLED_LOCALE_LABELS[code] ?? code.toUpperCase(),
        keys: countNonEmptyStrings(draft.localeOverrides[code] ?? {}),
      })),
    [draft.localeOverrides]
  );

  return (
    <div className="editor-page editor-page--v2" style={draftTheme}>
      <header className="editor-topbar">
        <div className="editor-topbar__row editor-topbar__row--main">
          <div className="editor-topbar__title">
            <h1>Urednik stranice</h1>
            <span className="editor-topbar__sub">
              Izgled, tekstovi i prijevodi. Bez artikala i grupa.
            </span>
          </div>
          <div className="editor-topbar__actions">
            <button
              type="button"
              className="editor-btn editor-btn--ghost"
              onClick={saveOnly}
              disabled={busy}
              title="Spremi trenutno stanje nacrta bez prevođenja (za male izmjene boja/slika)."
            >
              Spremi
            </button>
            <button
              type="button"
              className="editor-btn editor-btn--primary editor-btn--big"
              onClick={refreshPage}
              disabled={busy}
              title="Briše sve jezike osim HR i preko MyMemory-a napravi svježe prijevode. Sprema u localStorage + server arhivu."
            >
              {busy ? status.msg : "Ažuriraj stranicu"}
            </button>
            {status.kind === "ok" && (
              <span className="editor-saved" role="status">
                {status.msg}
              </span>
            )}
            {status.kind === "err" && (
              <span
                className="editor-saved editor-saved--err"
                role="status"
              >
                {status.msg}
              </span>
            )}
          </div>
        </div>
        <nav
          className="editor-topbar__row editor-topbar__row--nav"
          aria-label="Brzi skok na stranice"
        >
          <span className="editor-topbar__nav-label">Skok na:</span>
          {QUICK_NAV.map((it) => (
            <Link
              key={it.key}
              to={it.path}
              target="_blank"
              rel="noreferrer"
              className="editor-topbar__navbtn"
            >
              {it.label}
            </Link>
          ))}
          <span className="editor-topbar__nav-sep" aria-hidden>
            |
          </span>
          <Link
            to="/urednik-auto"
            className="editor-topbar__navbtn editor-topbar__navbtn--alt"
          >
            Urednik artikala →
          </Link>
        </nav>
      </header>

      <div className="editor-grid editor-grid--stack">
        {/* 1) JEZICI — pregled pokrivenosti */}
        <Section
          id="jezici"
          title="Jezici stranice"
          hint="Pregled svih jezika i koliko ima upisanih prijevoda. Klik „Ažuriraj stranicu” briše sve jezike osim HR-a i ponovno ih generira preko MyMemory-a."
          wide={false}
        >
          <ul className="editor-lang-grid">
            {localeCoverage.map((l) => (
              <li
                key={l.code}
                className={`editor-lang-chip${
                  l.keys > 0 ? " is-filled" : ""
                }`}
              >
                <span className="editor-lang-chip__code">
                  {l.code.toUpperCase()}
                </span>
                <span className="editor-lang-chip__label">{l.label}</span>
                <span className="editor-lang-chip__count">
                  {l.code === "hr"
                    ? "izvor"
                    : l.keys > 0
                      ? `${l.keys} polja`
                      : "prazno"}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* 2) TEKSTOVI (PRIJEVODI) */}
        <EditorLocalePanel
          draft={draft}
          setDraft={setDraft}
          onPersistSettings={setSettings}
        />

        {/* 3) ZAGLAVLJE */}
        <Section
          id="zaglavlje"
          title="Zaglavlje"
          hint="Boja trake, font izbornika, logo i boje poveznica (uključujući naglasak na stranici)."
        >
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
            <Field label="Poveznice / naglasak">
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
            <Field label="Poveznice (hover)">
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
          <div className="editor-section-block">
            <h3 className="editor-card__group-title">Font izbornika</h3>
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
                  fonts: {
                    ...d.fonts,
                    headerNavFamilyOverride: e.target.value,
                  },
                }))
              }
            />
            <FontPreview
              stack={resolveFontStack(
                draft.fonts.headerNavPresetId,
                draft.fonts.headerNavFamilyOverride
              )}
            />
          </div>
          <div className="editor-section-block">
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
        </Section>

        {/* 4) HERO */}
        <Section
          id="hero"
          title="Hero (naslovnica)"
          hint="Tekstovi heroja (naslov, podnaslov, eyebrow) uređuju se u sekciji Tekstovi. Ovdje: boje, font naslova i pozadinska slika."
        >
          <div className="editor-color-grid editor-color-grid--tight">
            {(
              [
                ["heroTitle", "Naslov"],
                ["heroLede", "Podnaslov"],
                ["eyebrow", "Mali natpis (eyebrow)"],
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
          <div className="editor-section-block">
            <h3 className="editor-card__group-title">
              Font naslova (serif — hero i h2)
            </h3>
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
                  fonts: {
                    ...d.fonts,
                    headingFamilyOverride: e.target.value,
                  },
                }))
              }
            />
            <FontPreview
              stack={resolveFontStack(
                draft.fonts.headingPresetId,
                draft.fonts.headingFamilyOverride
              )}
            />
          </div>
          <div className="editor-section-block">
            <h3 className="editor-card__group-title">Pozadinska slika</h3>
            <EditorImagePicker
              label="Pozadina heroja"
              value={draft.images.heroBackground}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  images: { ...d.images, heroBackground: v },
                }))
              }
              catalogItems={catalogPickerItems}
              library={filePickerItems}
            />
          </div>
        </Section>

        {/* 5) TIJELO */}
        <Section
          id="tijelo"
          title="Tijelo stranice"
          hint="Pozadina, tekstovi u sadržaju i font paragrafa / opisa (ne hero, ne h2)."
        >
          <div className="editor-color-grid editor-color-grid--tight">
            {(
              [
                ["pageBackground", "Pozadina stranice"],
                ["pageMuted", "Prigušena pozadina"],
                ["ink", "Glavni tekst"],
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
          <div className="editor-section-block">
            <h3 className="editor-card__group-title">Font tijela (sans)</h3>
            <FontPresetPicker
              groupLabel="Predložak fonta za tijelo"
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
          </div>
        </Section>

        {/* 6) H2 */}
        <Section
          id="h2"
          title="Naslovi sekcija (h2)"
          hint="Boja h2 naslova blokova. Font je zajednički s Hero karticom."
          wide={false}
        >
          <div className="editor-color-grid editor-color-grid--tight">
            <Field label="Boja h2 naslova">
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
        </Section>

        {/* 7) TRAKA */}
        <Section
          id="traka"
          title="Traka na vrhu (marquee)"
          hint="Tekst same trake piše se u sekciji Tekstovi (Traka obavijesti) po jeziku."
          wide={false}
        >
          <Field label="Prikaži traku">
            <input
              type="checkbox"
              checked={draft.announcement.enabled}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  announcement: {
                    ...d.announcement,
                    enabled: e.target.checked,
                  },
                }))
              }
            />
          </Field>
          <div className="editor-color-grid editor-color-grid--tight">
            <Field label="Boja pozadine">
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
            <Field label="Boja teksta">
              <input
                type="color"
                value={draft.announcement.color}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    announcement: {
                      ...d.announcement,
                      color: e.target.value,
                    },
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
        </Section>

        {/* 8) KOŠARICA */}
        <Section
          id="kosarica"
          title="Košarica"
          hint="Prag (u EUR) za poruku o besplatnoj dostavi."
          wide={false}
        >
          <Field label="Prag za besplatnu dostavu (EUR)">
            <input
              type="number"
              min={0}
              step={1}
              className="editor-input editor-input--narrow"
              value={draft.cart.giftThreshold}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  cart: {
                    ...d.cart,
                    giftThreshold:
                      Number(e.target.value) >= 0
                        ? Number(e.target.value)
                        : 0,
                  },
                }))
              }
            />
          </Field>
        </Section>

        {/* 9) BLOG */}
        <Section
          id="blog"
          title="Blog — vanjska poveznica"
          hint="Ako je URL postavljen, /blogs/news prikazuje gumb koji vodi na tu adresu."
          wide={false}
        >
          <Field label="Natpis gumba">
            <input
              className="editor-input"
              value={draft.blog.externalLinkLabel}
              placeholder="Npr. „Pogledaj blog”"
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  blog: { ...d.blog, externalLinkLabel: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="URL (puna adresa)">
            <input
              className="editor-input"
              value={draft.blog.externalUrl}
              placeholder="https://…"
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  blog: { ...d.blog, externalUrl: e.target.value },
                }))
              }
            />
          </Field>
        </Section>

        {/* 9b) O NAMA — SLIDESHOW */}
        <Section
          id="o-nama-slideshow"
          title="O nama — slideshow (12 slika)"
          hint="Slike ispod naslova na /pages/about. Upload u devu prepisuje datoteku u public/about-slideshow/ (stari format istog slota briše se). Ako je slot pokazivao na /uploads/… i zamijeniš ga, stara upload datoteka se briše."
          wide
        >
          <div className="editor-about-slides">
            {aboutSlides.map((url, slot) => (
              <div key={slot} className="editor-about-slides__slot">
                <h3 className="editor-card__group-title">Slika {slot + 1}</h3>
                <div className="editor-thumb-wrap">
                  {url ? (
                    <img
                      src={publicAssetUrl(url)}
                      alt=""
                      className="editor-thumb"
                    />
                  ) : (
                    <span className="editor-thumb-placeholder">Nema slike</span>
                  )}
                </div>
                {import.meta.env.DEV ? (
                  <label className="editor-about-slides__file">
                    <span className="editor-field__label">
                      Nova slika (sprema u{" "}
                      <code>public/about-slideshow/</code>, prepisuje slot)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={aboutSlideUploadBusy === slot}
                      className="editor-input"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        void handleAboutSlideFile(slot, f);
                      }}
                    />
                    {aboutSlideUploadBusy === slot ? (
                      <span className="editor-hint editor-hint--inline" role="status">
                        Spremanje…
                      </span>
                    ) : null}
                  </label>
                ) : (
                  <p className="editor-hint editor-hint--inline">
                    Upload radi samo u dev serveru (<code>npm run dev</code>).
                    U produkciji postavi putanje ručno ili preuzmi JSON s
                    računala.
                  </p>
                )}
                <EditorImagePicker
                  label="Putanja ili odabir iz biblioteke"
                  value={url}
                  onChange={(v) => replaceAboutSlideUrl(slot, v)}
                  catalogItems={catalogPickerItems}
                  library={filePickerItems}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* 10) SLIKE + STUDIO + ORPHAN */}
        <Section
          id="slike"
          title="Slike, Studio i čišćenje uploada"
          hint="Slika uz „Our story”, skupni upload i obrada te pregled neiskorištenih slika u public/uploads/."
        >
          <div className="editor-section-block">
            <h3 className="editor-card__group-title">
              Slika uz priču (Our story)
            </h3>
            <EditorImagePicker
              label="Slika uz priču"
              value={draft.images.storyImage}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  images: { ...d.images, storyImage: v },
                }))
              }
              catalogItems={catalogPickerItems}
              library={filePickerItems}
            />
          </div>
          <div className="editor-section-block">
            <h3 className="editor-card__group-title">
              Studio, upload i biblioteka
            </h3>
            <div className="editor-hint editor-hint--row">
              <button
                type="button"
                className="editor-btn editor-btn--ghost"
                onClick={() => reloadMediaLibrary()}
              >
                Osvježi biblioteku
              </button>
              <span className="editor-hint--inline">
                Ručno dodane datoteke u <code>public/</code> — u devu klik
                ovdje.
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
          <div className="editor-section-block">
            <h3 className="editor-card__group-title">
              Nekorištene slike u uploads/
            </h3>
            <EditorOrphanUploadPanel
              draft={draft}
              onMediaLibraryRefresh={reloadMediaLibrary}
            />
          </div>
        </Section>

        {/* 11) EXPORT / IMPORT / RESET */}
        <Section
          id="izvoz"
          title="Izvoz / uvoz / reset"
          hint="Preuzmi postavke kao JSON ili učitaj iz backup-a. Reset briše localStorage i server-arhivu prijevoda stranice."
          wide={false}
        >
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
                a.download = "radionica-lun-site-settings.json";
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
            {importErr && <p className="editor-error">JSON nije valjan.</p>}
            <button
              type="button"
              className="editor-btn editor-btn--danger"
              onClick={async () => {
                if (
                  !window.confirm(
                    "Vratiti sve na zadane vrijednosti? Obrisat će se i server-side arhiva prijevoda stranice."
                  )
                ) {
                  return;
                }
                resetSettings();
                setDraft(structuredClone(DEFAULT_SITE_SETTINGS));
                try {
                  await fetch("/__editor__/clear-locale-overrides", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                  });
                  refreshArchivedLocaleOverrides();
                } catch {
                  /* produkcija bez middleware-a: samo localStorage */
                }
              }}
            >
              Reset na zadano
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
