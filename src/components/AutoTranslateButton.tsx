import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import i18n, { SUPPORTED_LANGS, type AppLang } from "@/i18n";

/**
 * Plutajući language switcher u donjem lijevom kutu.
 *
 * Povijesno je ovdje bio poziv prema MyMemory-u („translateTree”) koji bi
 * svaki put kad korisnik izabere jezik prevodio cijeli `hrBundle`. To je bio
 * presporo (posebno s rate-limitom) i stvaralo je race condition — dok je
 * prijevod trajao, `HR ↺` je bio `disabled`, a nakon završetka bi `await
 * i18n.changeLanguage(target)` „preglasao” bilo koji korisnikov ručni
 * povratak na HR kroz drugi picker.
 *
 * Sad se oslanjamo na to da Urednik-STRANICE persistira sve prijevode u
 * `public/editor-archived-locale-overrides.json`. SiteSettingsContext na
 * startu spoji arhivu s localStorage overrides-ima i kroz
 * `applyLocaleBundlesFromSettings` registrira bundle za SVAKI jezik u i18n
 * (vidi `i18n/applyLocaleBundles.ts`). Widget zato samo prebaci jezik —
 * nema mrežnog poziva, nema busy stanja, `HR ↺` je uvijek klikabilan.
 */
export function AutoTranslateButton() {
  const { t, i18n: i18nHook } = useTranslation();

  const currentLang = (i18nHook.resolvedLanguage ?? i18nHook.language ?? "hr") as AppLang;
  const isHr = currentLang === "hr";

  const goTo = useCallback((code: AppLang) => {
    void i18n.changeLanguage(code);
  }, []);

  return (
    <div
      className="auto-translate"
      role="group"
      aria-label={t("autoTranslate.label")}
    >
      {!isHr ? (
        <button
          type="button"
          className="auto-translate__back"
          onClick={() => goTo("hr")}
          title={t("autoTranslate.disable")}
        >
          HR ↺
        </button>
      ) : null}
      <select
        className="auto-translate__select"
        aria-label={t("autoTranslate.label")}
        value={currentLang}
        onChange={(e) => {
          const code = e.target.value as AppLang;
          if (!code) return;
          goTo(code);
        }}
      >
        {SUPPORTED_LANGS.map((code) => (
          <option key={code} value={code}>
            {t(`lang.${code}`)}
          </option>
        ))}
      </select>
      <span
        className="auto-translate__provider"
        title={t("autoTranslate.providerMyMemory")}
      >
        {t("autoTranslate.providerMyMemory")}
      </span>
    </div>
  );
}
