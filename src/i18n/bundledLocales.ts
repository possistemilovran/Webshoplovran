import hr from "@/locales/hr.json";
import en from "@/locales/en.json";
import de from "@/locales/de.json";
import fr from "@/locales/fr.json";
import it from "@/locales/it.json";
import sl from "@/locales/sl.json";
import pl from "@/locales/pl.json";
import cs from "@/locales/cs.json";
import type { AppLocaleCode } from "@/config/siteDefaults";

export const BUNDLED_LOCALES: Record<AppLocaleCode, Record<string, unknown>> = {
  hr: hr as Record<string, unknown>,
  en: en as Record<string, unknown>,
  de: de as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
  it: it as Record<string, unknown>,
  sl: sl as Record<string, unknown>,
  pl: pl as Record<string, unknown>,
  cs: cs as Record<string, unknown>,
};

export const BUNDLED_LOCALE_CODES: AppLocaleCode[] = [
  "hr",
  "en",
  "de",
  "fr",
  "it",
  "sl",
  "pl",
  "cs",
];

/** Čitljiva imena jezika za urednik (fallback: uppercase koda). */
export const BUNDLED_LOCALE_LABELS: Record<AppLocaleCode, string> = {
  hr: "Hrvatski",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  sl: "Slovenščina",
  pl: "Polski",
  cs: "Čeština",
};
