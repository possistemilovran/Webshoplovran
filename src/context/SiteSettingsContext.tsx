import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_SITE_SETTINGS,
  STORAGE_KEY,
  deepMergeSite,
  hydrateSiteFromDisk,
  type AppLocaleCode,
  type SiteSettings,
} from "@/config/siteDefaults";
import type { LocaleBundle } from "@/config/migrateLegacyLocale";
import { applyLocaleBundlesFromSettings } from "@/i18n/applyLocaleBundles";
import { deepMergeLocale } from "@/lib/localeTree";
import { publicAssetUrl } from "@/lib/publicUrl";
import { siteSettingsToCssVarsStyle } from "@/lib/themeCssVars";
import { injectGoogleFontLinks } from "@/lib/webFonts";

/**
 * Nadogradnja s arhivom koju je Urednik-STRANICE zapisao u
 * `public/editor-archived-locale-overrides.json`. Kad postoji, taj server JSON
 * je autoritativan (commitamo ga u git i deployamo). `localStorage` ostaje
 * samo korisnikov lokalni draft u trenutnoj kartici; primjenjuje se poviše
 * arhive tako da radne izmjene odmah žive u UI-u.
 */
const ARCHIVED_LOCALE_CHANGED = "olivo-archived-locale-changed";
export const ARCHIVED_LOCALE_URL = "/editor-archived-locale-overrides.json";

function mergeArchivedAndLocalLocales(
  archived: Partial<Record<AppLocaleCode, LocaleBundle>>,
  local: Partial<Record<AppLocaleCode, LocaleBundle>>
): Partial<Record<AppLocaleCode, LocaleBundle>> {
  const out: Partial<Record<AppLocaleCode, LocaleBundle>> = {};
  const keys = new Set([
    ...(Object.keys(archived) as AppLocaleCode[]),
    ...(Object.keys(local) as AppLocaleCode[]),
  ]);
  for (const k of keys) {
    const a = (archived[k] ?? {}) as Record<string, unknown>;
    const l = (local[k] ?? {}) as Record<string, unknown>;
    out[k] = deepMergeLocale(a, l) as LocaleBundle;
  }
  return out;
}

export function refreshArchivedLocaleOverrides(): void {
  window.dispatchEvent(new Event(ARCHIVED_LOCALE_CHANGED));
}

type SiteSettingsContextValue = {
  settings: SiteSettings;
  setSettings: (next: SiteSettings) => void;
  patchSettings: (partial: Partial<SiteSettings>) => void;
  resetSettings: () => void;
  exportJson: () => string;
  importJson: (json: string) => boolean;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(
  null
);

function loadStored(): SiteSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SITE_SETTINGS);
    const parsed = JSON.parse(raw) as unknown;
    return hydrateSiteFromDisk(parsed);
  } catch {
    return structuredClone(DEFAULT_SITE_SETTINGS);
  }
}

function applyCssVariables(s: SiteSettings) {
  const root = document.documentElement;
  const vars = siteSettingsToCssVarsStyle(s);
  for (const [key, val] of Object.entries(vars)) {
    if (typeof val === "string") root.style.setProperty(key, val);
  }
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<SiteSettings>(loadStored);
  const [archivedLocales, setArchivedLocales] = useState<
    Partial<Record<AppLocaleCode, LocaleBundle>>
  >({});

  const mergedLocales = useMemo(
    () => mergeArchivedAndLocalLocales(archivedLocales, settings.localeOverrides),
    [archivedLocales, settings.localeOverrides]
  );

  useEffect(() => {
    const load = () => {
      fetch(`${publicAssetUrl(ARCHIVED_LOCALE_URL)}?t=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { overrides?: unknown } | null) => {
          if (
            j &&
            j.overrides &&
            typeof j.overrides === "object" &&
            !Array.isArray(j.overrides)
          ) {
            setArchivedLocales(
              j.overrides as Partial<Record<AppLocaleCode, LocaleBundle>>
            );
          } else {
            setArchivedLocales({});
          }
        })
        .catch(() => setArchivedLocales({}));
    };
    load();
    const onRefresh = () => load();
    window.addEventListener(ARCHIVED_LOCALE_CHANGED, onRefresh);
    return () =>
      window.removeEventListener(ARCHIVED_LOCALE_CHANGED, onRefresh);
  }, []);

  useLayoutEffect(() => {
    applyLocaleBundlesFromSettings(mergedLocales);
  }, [mergedLocales]);

  useEffect(() => {
    applyCssVariables(settings);
    injectGoogleFontLinks(settings.fonts, "app");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn(
        "[Olivo] Spremanje postavki u localStorage nije uspjelo (npr. pun memorijski prostor). Prijevodi i ostale promjene neće ostati nakon osvježavanja.",
        e
      );
    }
  }, [settings]);

  const setSettings = useCallback((next: SiteSettings) => {
    setSettingsState(deepMergeSite(DEFAULT_SITE_SETTINGS, next));
  }, []);

  const patchSettings = useCallback((partial: Partial<SiteSettings>) => {
    setSettingsState((prev) => deepMergeSite(prev, partial));
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState(structuredClone(DEFAULT_SITE_SETTINGS));
  }, []);

  const exportJson = useCallback(() => JSON.stringify(settings, null, 2), [settings]);

  const importJson = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as unknown;
      setSettingsState(hydrateSiteFromDisk(parsed));
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      patchSettings,
      resetSettings,
      exportJson,
      importJson,
    }),
    [settings, setSettings, patchSettings, resetSettings, exportJson, importJson]
  );

  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) {
    throw new Error("useSiteSettings must be used within SiteSettingsProvider");
  }
  return ctx;
}
