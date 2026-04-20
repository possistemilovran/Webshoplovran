import type { AppLocaleCode } from "@/config/siteDefaults";
import { BUNDLED_LOCALE_CODES } from "@/i18n/bundledLocales";

/** Isti jezik koji koristi TranslatedText i mergeProduct (artikli / katalog). */
export function resolveUiLang(i18n: {
  language: string;
  resolvedLanguage?: string;
}): AppLocaleCode {
  const raw =
    (i18n.resolvedLanguage ?? i18n.language ?? "hr").split("-")[0]?.toLowerCase() ??
    "hr";
  return BUNDLED_LOCALE_CODES.includes(raw as AppLocaleCode)
    ? (raw as AppLocaleCode)
    : "hr";
}
