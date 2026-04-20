import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { SiteSettings, AppLocaleCode } from "@/config/siteDefaults";
import { deepMergeLocale, getAtSeg, setAtSegDeep } from "@/lib/localeTree";
import { BUNDLED_LOCALES, BUNDLED_LOCALE_CODES } from "@/i18n/bundledLocales";
import { EDITOR_I18N_GROUPS, type EditorI18nField } from "@/editor/editorLocaleSchema";
import { applyLocaleBundlesFromSettings } from "@/i18n/applyLocaleBundles";
import {
  runFullSiteAutoTranslate,
  runFullSiteTranslateHealthCheck,
} from "@/lib/bulkSiteTranslate";
import {
  matchesEditorSectionQuery,
  matchesEditorTextFieldQuery,
} from "@/lib/editorSearch";

function Field({
  label,
  children,
  hint,
  i18nPath,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  /** Za tražilicu teksta (poklapanje putanje ključa). */
  i18nPath?: string;
}) {
  return (
    <label
      className="editor-field"
      {...(i18nPath != null && i18nPath !== ""
        ? { "data-editor-i18n-path": i18nPath }
        : {})}
    >
      <span className="editor-field__label">{label}</span>
      {hint ? <span className="editor-hint editor-hint--inline">{hint}</span> : null}
      {children}
    </label>
  );
}

function effectiveBundle(
  lang: AppLocaleCode,
  overrides: SiteSettings["localeOverrides"]
): Record<string, unknown> {
  const base = structuredClone(BUNDLED_LOCALES[lang]);
  return deepMergeLocale(base, (overrides?.[lang] ?? {}) as Record<string, unknown>);
}

function readTextField(
  eff: Record<string, unknown>,
  f: EditorI18nField
): string {
  if (f.kind === "lines") {
    const raw = getAtSeg(eff, f.path);
    if (Array.isArray(raw)) return raw.map((x) => String(x)).join("\n");
    return "";
  }
  const v = getAtSeg(eff, f.path);
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

type Props = {
  draft: SiteSettings;
  setDraft: Dispatch<SetStateAction<SiteSettings>>;
  /** Nakon „Prevedi sve” automatski sprema u postavke (localStorage + trgovina). */
  onPersistSettings?: (next: SiteSettings) => void;
  /** Prazno = prikaži uvijek; inače filtriraj sekciju po ključnim riječima. */
  searchQuery?: string;
  /** Filtriraj polja prijevoda po oznaci, putanji ili sadržaju. */
  textSearchQuery?: string;
  /** Svako povećanje pokreće skrol + fokus na prvo podudarno polje (gumb / Enter u uredniku). */
  textSearchJumpSignal?: number;
};

const LOCALE_PANEL_KEYWORDS =
  "tekstovi stranica jezici prijevod libretranslate autoprijevod i18n locale hrvatski english deutsch français kategorije izbornik natpisi navigacija footer home shop kontakt blog košarica traka obavijesti sve jezike artikli kolekcije skupno prevedi sve tijek";

function pushLogLine(
  setLog: Dispatch<SetStateAction<string[]>>,
  line: string
) {
  const stamp = new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  setLog((prev) => [...prev.slice(-120), `[${stamp}] ${line}`]);
}

export function EditorLocalePanel({
  draft,
  setDraft,
  onPersistSettings,
  searchQuery = "",
  textSearchQuery = "",
  textSearchJumpSignal = 0,
}: Props) {
  const [activeLang, setActiveLang] = useState<AppLocaleCode>("hr");
  const [transErr, setTransErr] = useState<string | null>(null);
  const [translateAllBusy, setTranslateAllBusy] = useState(false);
  const [translateLog, setTranslateLog] = useState<string[]>([]);
  const translateLogEndRef = useRef<HTMLDivElement>(null);
  /** Polja na koja je skok (povećalo/Enter) ostaju vidljiva i kad vrijednost više ne sadrži upit — inače bi filter uklonio čvor i uništio fokus. */
  const [textSearchPinnedPaths, setTextSearchPinnedPaths] = useState(
    () => new Set<string>()
  );

  useEffect(() => {
    translateLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [translateLog]);

  useEffect(() => {
    setTextSearchPinnedPaths(new Set());
  }, [textSearchQuery]);

  const eff = useMemo(
    () => effectiveBundle(activeLang, draft.localeOverrides),
    [activeLang, draft.localeOverrides]
  );

  const setOverridePath = useCallback(
    (path: (string | number)[], value: unknown) => {
      setDraft((d) => {
        const prev = (d.localeOverrides[activeLang] ?? {}) as Record<string, unknown>;
        const nextOv = setAtSegDeep({ ...prev }, path, value);
        return {
          ...d,
          localeOverrides: { ...d.localeOverrides, [activeLang]: nextOv },
        };
      });
    },
    [activeLang, setDraft]
  );

  const onChangeField = (f: EditorI18nField, text: string) => {
    if (f.kind === "lines") {
      const lines = text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      setOverridePath(f.path, lines);
      return;
    }
    setOverridePath(f.path, text);
  };

  const categoryFields = useMemo(() => {
    return draft.navigation.shopSubmenu
      .filter((row) => row.slug.trim() !== "")
      .map((row) => ({
        slug: row.slug.trim(),
        label: row.label,
        path: ["categories", row.slug.trim()] as (string | number)[],
      }));
  }, [draft.navigation.shopSubmenu]);

  const filteredCategoryFields = useMemo(() => {
    const q = textSearchQuery.trim();
    if (!q) return categoryFields;
    return categoryFields.filter((cat) => {
      const pathKey = `categories.${cat.slug}`.toLowerCase();
      if (textSearchPinnedPaths.has(pathKey)) return true;
      const v = readTextField(eff, {
        kind: "text",
        path: cat.path,
        label: "",
      });
      return (
        matchesEditorTextFieldQuery(textSearchQuery, {
          label: `Kategorija „${cat.slug}”`,
          path: `categories.${cat.slug}`,
          value: v,
        }) || cat.label.toLowerCase().includes(q.toLowerCase())
      );
    });
  }, [categoryFields, eff, textSearchQuery, textSearchPinnedPaths]);

  useEffect(() => {
    if (textSearchJumpSignal === 0) return;
    const q = textSearchQuery.trim();
    if (!q) return;
    if (!matchesEditorSectionQuery(searchQuery, LOCALE_PANEL_KEYWORDS)) return;

    const timer = window.setTimeout(() => {
      const root = document.getElementById("editor-locale-panel");
      if (!root) return;
      const nodes = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        ".editor-locale-block textarea, .editor-locale-block input.editor-input"
      );
      if (nodes.length === 0) return;

      const ql = q.toLowerCase();
      let control: HTMLInputElement | HTMLTextAreaElement | null = null;
      for (const el of nodes) {
        const val = el.value.toLowerCase();
        const fieldRoot = el.closest(".editor-field");
        const label =
          fieldRoot?.querySelector(".editor-field__label")?.textContent ?? "";
        const hint =
          fieldRoot?.querySelector(".editor-hint--inline")?.textContent ?? "";
        const path =
          fieldRoot?.getAttribute("data-editor-i18n-path")?.toLowerCase() ?? "";
        const blob = `${val}\n${label}\n${hint}\n${path}`.toLowerCase();
        if (blob.includes(ql)) {
          control = el;
          break;
        }
      }
      if (!control) control = nodes[0];

      const jumpFieldRoot = control.closest(".editor-field");
      const jumpPath = jumpFieldRoot?.getAttribute("data-editor-i18n-path")?.trim();
      if (jumpPath) {
        const key = jumpPath.toLowerCase();
        setTextSearchPinnedPaths((prev) => {
          if (prev.has(key)) return prev;
          return new Set([...prev, key]);
        });
      }

      control.scrollIntoView({ behavior: "smooth", block: "center" });
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          control?.focus({ preventScroll: true });
        });
      });
    }, 50);

    return () => window.clearTimeout(timer);
    // Samo signal pokreće skrol; textSearchQuery/searchQuery čitamo iz zatvaranja pri kliku/Enter.
  }, [textSearchJumpSignal]);

  const runTranslateAll = async () => {
    setTranslateAllBusy(true);
    setTransErr(null);
    setTranslateLog([]);
    pushLogLine(
      setTranslateLog,
      "Početak: EN, DE, FR, IT, PL, CS — samo prazna polja u nacrtu (postojeći prijevodi ostaju)."
    );
    try {
      const next = await runFullSiteAutoTranslate(
        draft,
        (m) => pushLogLine(setTranslateLog, m),
        { gapsOnly: true }
      );
      setDraft(next);
      applyLocaleBundlesFromSettings(next.localeOverrides);
      onPersistSettings?.(next);
      const report = runFullSiteTranslateHealthCheck(next);
      for (const code of BUNDLED_LOCALE_CODES) {
        if (code === "hr") continue;
        const row = report.byLang[code];
        if (!row) continue;
        pushLogLine(
          setTranslateLog,
          `${code.toUpperCase()} provjera — locale: ${row.localeMissing}, artikli: ${row.productMissing}, kolekcije: ${row.collectionMissing}`
        );
      }
      if (!report.ok) {
        pushLogLine(
          setTranslateLog,
          "Napomena: ako brojevi ostanu > 0, prevoditelj vjerojatno vraća HR tekst (proxy/LibreTranslate nedostupan)."
        );
      }
      pushLogLine(
        setTranslateLog,
        report.ok
          ? onPersistSettings
            ? "Gotovo — postavke spremljene (trgovina + localStorage), health check: OK."
            : "Gotovo — nacrt ažuriran; kliknite „Spremi promjene” u zaglavlju. Health check: OK."
          : "Gotovo uz upozorenje: health check našao je nedostajuća polja (vidi retke iznad)."
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Prijevod nije uspio.";
      setTransErr(msg);
      pushLogLine(setTranslateLog, `Greška: ${msg}`);
    } finally {
      setTranslateAllBusy(false);
    }
  };

  if (!matchesEditorSectionQuery(searchQuery, LOCALE_PANEL_KEYWORDS)) {
    return null;
  }

  const fieldHint = (f: EditorI18nField) =>
    f.kind === "lines" ? f.hint : (f as { hint?: string }).hint;

  const visibleFieldsForGroup = (group: (typeof EDITOR_I18N_GROUPS)[number]) => {
    const q = textSearchQuery.trim();
    if (!q) return group.fields;
    const ql = q.toLowerCase();
    const groupHit =
      group.title.toLowerCase().includes(ql) ||
      (group.hint?.toLowerCase().includes(ql) ?? false);
    if (groupHit) return group.fields;
    return group.fields.filter((f) => {
      const pathKey = f.path.join(".").toLowerCase();
      if (textSearchPinnedPaths.has(pathKey)) return true;
      return matchesEditorTextFieldQuery(textSearchQuery, {
        label: f.label,
        hint: fieldHint(f),
        path: f.path.join("."),
        value: readTextField(eff, f),
      });
    });
  };

  return (
    <section
      id="editor-locale-panel"
      className="editor-card editor-card--wide"
    >
      <h2>Tekstovi stranica po jezicima</h2>
      <p className="editor-hint">
        Ovdje su isti ključevi koje trgovina koristi (početna, trgovina, blog, o nama, kontakt, košarica,
        checkout, artikli u UI-ju, kategorije…). Hrvatski je izvor; jedan gumb ispunjava{" "}
        <strong>sve jezike u izborniku</strong> (EN, DE, FR, IT, PL, CS) te{" "}
        <strong>naslove i opise svih artikala i kolekcija</strong>, ali{" "}
        <strong>samo gdje u nacrtu još nema prijevoda</strong> — ručno uneseno ostaje. Nakon završetka
        postavke se automatski spremaju (isto kao „Spremi promjene”). Potreban je LibreTranslate (npr.{" "}
        <code>/__translate__</code> u devu ili <code>VITE_TRANSLATE_PROXY</code>). Prag poklona je u
        odjeljku „Košarica — prag”.
      </p>

      <div className="editor-card__group">
        <h3 className="editor-card__group-title">Prevedi sve</h3>
        <div className="editor-lang-bar">
          <label className="editor-field editor-field--inline">
            <span className="editor-field__label">Jezik uređivanja (ručno)</span>
            <select
              className="editor-input editor-input--lang"
              value={activeLang}
              disabled={translateAllBusy}
              onChange={(e) => setActiveLang(e.target.value as AppLocaleCode)}
            >
              {BUNDLED_LOCALE_CODES.map((code) => (
                <option key={code} value={code}>
                  {code.toUpperCase()} —{" "}
                  {String(getAtSeg(BUNDLED_LOCALES[code], ["lang", code]) ?? code)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="editor-btn editor-btn--primary"
            disabled={translateAllBusy}
            onClick={() => void runTranslateAll()}
          >
            {translateAllBusy
              ? "Prevodim sve jezike… (pričekajte do kraja)"
              : "Prevedi sve — stranica + artikli + kolekcije (svi jezici)"}
          </button>
        </div>
        {translateLog.length > 0 ? (
          <div
            className="editor-translate-log"
            role="log"
            aria-label="Tijek prijevoda"
            aria-live="polite"
          >
            {translateLog.map((line, i) => (
              <div key={`${i}-${line.slice(0, 24)}`} className="editor-translate-log__line">
                {line}
              </div>
            ))}
            <div ref={translateLogEndRef} />
          </div>
        ) : null}
        {transErr ? <p className="editor-error">{transErr}</p> : null}
      </div>

      {filteredCategoryFields.length > 0 && (
        <div className="editor-locale-block editor-card__group">
          <h3 className="editor-card__group-title">Kategorije u izborniku (slug → natpis)</h3>
          <p className="editor-hint">
            Slug mora ostati kao u URL-u. Natpis se prikazuje kad nema ključa u prijevodima — ili kao
            nadjačavanje ovdje.
          </p>
          <div className="editor-text-grid">
            {filteredCategoryFields.map((cat) => (
              <Field
                key={cat.slug}
                label={`Kategorija „${cat.slug}”`}
                i18nPath={`categories.${cat.slug}`}
              >
                <input
                  className="editor-input"
                  value={readTextField(eff, {
                    kind: "text",
                    path: cat.path,
                    label: "",
                  })}
                  onChange={(e) => setOverridePath(cat.path, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </div>
      )}

      {EDITOR_I18N_GROUPS.map((group) => {
        const fields = visibleFieldsForGroup(group);
        if (textSearchQuery.trim() && fields.length === 0) return null;
        return (
        <div key={group.id} className="editor-locale-block editor-card__group">
          <h3 className="editor-card__group-title">{group.title}</h3>
          {group.hint ? <p className="editor-hint">{group.hint}</p> : null}
          <div className="editor-text-grid">
            {fields.map((f, idx) => (
              <Field
                key={`${group.id}-${idx}-${f.path.join(".")}`}
                label={f.label}
                hint={fieldHint(f)}
                i18nPath={f.path.join(".")}
              >
                {f.kind === "lines" ? (
                  <textarea
                    className="editor-textarea"
                    rows={5}
                    value={readTextField(eff, f)}
                    onChange={(e) => onChangeField(f, e.target.value)}
                  />
                ) : f.multiline ? (
                  <textarea
                    className="editor-textarea"
                    rows={3}
                    value={readTextField(eff, f)}
                    onChange={(e) => onChangeField(f, e.target.value)}
                  />
                ) : (
                  <input
                    className="editor-input"
                    value={readTextField(eff, f)}
                    onChange={(e) => onChangeField(f, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>
        </div>
        );
      })}
    </section>
  );
}
