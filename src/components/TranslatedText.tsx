import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateFromHr } from "@/lib/machineTranslate";
import { resolveUiLang } from "@/i18n/resolveUiLang";
import type { AppLocaleCode } from "@/config/siteDefaults";

type Props = {
  text: string;
  /** HTML element za prikaz */
  as?: keyof JSX.IntrinsicElements;
  className?: string;
};

/**
 * Prijevod dinamičkih tekstova (npr. naslovi artikala iz kataloga).
 * Dok novi prijevod stiže, prikazuje se izvorni tekst — nikad stari prijevod drugog artikla
 * (isti route /products/:slug ne remounta cijelu stranicu).
 */
export function TranslatedText({ text, as: Tag = "span", className }: Props) {
  const { i18n } = useTranslation();
  const target: AppLocaleCode = resolveUiLang(i18n);
  const [translated, setTranslated] = useState<string | null>(null);

  useEffect(() => {
    if (target === "hr") {
      setTranslated(null);
      return;
    }
    setTranslated(null);
    let cancelled = false;
    void translateFromHr(text, target).then((next) => {
      if (!cancelled) setTranslated(next);
    });
    return () => {
      cancelled = true;
    };
  }, [text, target, i18n.language, i18n.resolvedLanguage]);

  const display = target === "hr" ? text : translated ?? text;

  return <Tag className={className}>{display}</Tag>;
}
