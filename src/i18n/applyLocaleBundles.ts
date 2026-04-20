import i18n from "./index";
import type { LocaleBundle } from "@/config/migrateLegacyLocale";
import type { AppLocaleCode } from "@/config/siteDefaults";
import { deepMergeLocale, valueEquals } from "@/lib/localeTree";
import { BUNDLED_LOCALE_CODES, BUNDLED_LOCALES } from "@/i18n/bundledLocales";

/**
 * Spaja ugrađene prijevode s localeOverrides iz postavki i prepisuje i18n resurse.
 */

/**
 * Ključevi koje NE dopuštamo override-ati preko urednika/arhive.
 *
 * `lang.*` su nazivi jezika (npr. „Croatian", „Deutsch") — bundlani JSON-ovi
 * ih već imaju točno. MyMemory strojni prijevod tih izoliranih riječi vraća
 * smeće (npr. „Hrvatski" → „English"), što je radilo duplikate u dropdownu
 * i blokiralo povratak na HR. Zato ih uvijek nosimo iz bundlanog izvora,
 * neovisno o tome što je u arhivi ili localStorage-u.
 */
const PROTECTED_TOP_KEYS = new Set(["lang"]);

function stripProtectedKeys(
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (PROTECTED_TOP_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function stripHrDuplicates(
  patch: unknown,
  hrSource: unknown
): unknown {
  if (patch == null) return undefined;
  if (Array.isArray(patch)) {
    return valueEquals(patch, hrSource) ? undefined : patch;
  }
  if (typeof patch !== "object") {
    return valueEquals(patch, hrSource) ? undefined : patch;
  }
  if (Array.isArray(hrSource) || typeof hrSource !== "object" || hrSource == null) {
    return valueEquals(patch, hrSource) ? undefined : patch;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const pruned = stripHrDuplicates(
      v,
      (hrSource as Record<string, unknown>)[k]
    );
    if (pruned !== undefined) out[k] = pruned;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function applyLocaleBundlesFromSettings(
  overrides: Partial<Record<AppLocaleCode, LocaleBundle>> | undefined
): void {
  const lng = i18n.language as AppLocaleCode;
  const hrOverrideSanitized = stripProtectedKeys(
    (overrides?.hr ?? {}) as Record<string, unknown>
  );
  const hrEffective = deepMergeLocale(
    structuredClone(BUNDLED_LOCALES.hr),
    hrOverrideSanitized
  );
  for (const code of BUNDLED_LOCALE_CODES) {
    const base = structuredClone(BUNDLED_LOCALES[code]);
    const rawPatch = stripProtectedKeys(
      (overrides?.[code] ?? {}) as Record<string, unknown>
    );
    const patch =
      code === "hr"
        ? rawPatch
        : ((stripHrDuplicates(rawPatch, hrEffective) ?? {}) as Record<
            string,
            unknown
          >);
    const merged = deepMergeLocale(base, patch);
    i18n.addResourceBundle(code, "translation", merged, true, true);
  }
  void i18n.changeLanguage(lng);
}
