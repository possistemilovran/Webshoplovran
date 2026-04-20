/**
 * Pri arhivi artikla: HR naslov/opisi → LibreTranslate na sve jezike trgovine (bez HR).
 * Radi samo na Node strani (Vite middleware), bez CORS-a.
 */
const UPSTREAM = [
  "https://libretranslate.de/translate",
  "https://libretranslate.com/translate",
] as const;

const TARGET_LANGS = ["en", "de", "fr", "it", "pl", "cs"] as const;

async function translateHrToServer(
  text: string,
  target: string
): Promise<string> {
  const t = text.trim();
  if (!t || target === "hr") return text;
  const body = JSON.stringify({
    q: t.slice(0, 4500),
    source: "hr",
    target,
    format: "text",
  });
  for (const url of UPSTREAM) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!r.ok) continue;
      const data = (await r.json()) as { translatedText?: string };
      const out = data.translatedText?.trim();
      if (out) return out;
    } catch {
      continue;
    }
  }
  return t;
}

type CopyPack = {
  title?: string;
  shortDescription?: string;
  description?: string;
};

/**
 * Na temelju HR polja u nadjačavanju gradi `translations` za en, de, fr, it, pl, cs.
 */
export async function addTranslationsToArchivedOverride(
  ov: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const out = { ...ov };
  const title = String(out.title ?? "").trim();
  const shortDescription = String(out.shortDescription ?? "").trim();
  const description = String(out.description ?? "").trim();

  const translations: Record<string, CopyPack> = {};

  await Promise.all(
    TARGET_LANGS.map(async (lang) => {
      const pack: CopyPack = {};
      if (title) pack.title = await translateHrToServer(title, lang);
      if (shortDescription) {
        pack.shortDescription = await translateHrToServer(
          shortDescription,
          lang
        );
      }
      if (description) {
        pack.description = await translateHrToServer(description, lang);
      }
      if (Object.keys(pack).length > 0) translations[lang] = pack;
    })
  );

  out.translations = translations;
  return out;
}
