import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import hr from "@/locales/hr.json";
import en from "@/locales/en.json";
import de from "@/locales/de.json";
import fr from "@/locales/fr.json";
import it from "@/locales/it.json";
import pl from "@/locales/pl.json";
import cs from "@/locales/cs.json";
import sl from "@/locales/sl.json";

export const SUPPORTED_LANGS = [
  "hr",
  "en",
  "de",
  "it",
  "fr",
  "sl",
  "cs",
  "pl",
] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

const resources = {
  hr: { translation: hr },
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
  it: { translation: it },
  pl: { translation: pl },
  cs: { translation: cs },
  sl: { translation: sl },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: "hr",
  fallbackLng: "hr",
  interpolation: { escapeValue: false },
  /**
   * Bez ovoga komponente ne re-renderaju nakon applyLocaleBundlesFromSettings():
   * i18n.addResourceBundle emitira "added" na storeu, a ne "languageChanged".
   */
  react: {
    bindI18nStore: "added removed",
  },
});

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

document.documentElement.lang = i18n.language;

export default i18n;
