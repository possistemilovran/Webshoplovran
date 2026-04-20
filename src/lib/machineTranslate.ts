/**
 * Automatski prijevod s hrvatskog na odabrani jezik (Vite proxy).
 * Urednik-ARTIKLI: samo /__translate__/artikli → DeepL Free. Ostalo: /__translate__ (Google → DeepL → LibreTranslate).
 * Isti-origin (Vite dev + preview) izbjegava CORS.
 * Predmemorija u sessionStorage; pri grešci ostaje izvorni tekst.
 *
 * Čisti statički hosting bez proxyja: javni LibreTranslate često blokira CORS —
 * postavi VITE_TRANSLATE_PROXY ili ručne prijevode (productOverrides.translations).
 */
const ENDPOINTS = [
  "https://libretranslate.de/translate",
  "https://libretranslate.com/translate",
];

const MAX_CHUNK = 3200;

function sameText(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

type TranslateScope = "site" | "artikli";

function cacheKey(target: string, text: string, scope: TranslateScope = "site") {
  let h = 0;
  const s = text.slice(0, 400);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const prefix = scope === "artikli" ? "olivo-tr-art:" : "olivo-tr:";
  return `${prefix}${target}:${h}:${text.length}`;
}

/**
 * site: korisnički proxy, /__translate__, javni LibreTranslate.
 * artikli: samo /__translate__/artikli (DeepL Free u Vite proxyju — Urednik-ARTIKLI).
 */
function translateEndpointList(scope: TranslateScope): string[] {
  if (scope === "artikli" && typeof window !== "undefined") {
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
    const path = `${base}/__translate__/artikli`.replace(/\/{2,}/g, "/");
    return [path.startsWith("/") ? path : `/${path}`];
  }
  const out: string[] = [];
  const custom = import.meta.env.VITE_TRANSLATE_PROXY as string | undefined;
  if (custom != null && String(custom).trim() !== "") {
    const c = String(custom).trim();
    if (c.startsWith("http://") || c.startsWith("https://")) {
      out.push(c);
    } else if (typeof window !== "undefined") {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
      out.push(`${base}${c.startsWith("/") ? c : `/${c}`}`);
    }
  }
  if (typeof window !== "undefined") {
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
    const path = `${base}/__translate__`.replace(/\/{2,}/g, "/");
    out.push(path.startsWith("/") ? path : `/${path}`);
  }
  out.push(...ENDPOINTS);
  return out;
}

async function postTranslate(
  body: string,
  url: string
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { translatedText?: string };
    const out = data.translatedText?.trim();
    return out || null;
  } catch {
    return null;
  }
}

async function postTranslateFirstWorking(
  body: string,
  scope: TranslateScope
): Promise<string | null> {
  for (const url of translateEndpointList(scope)) {
    const out = await postTranslate(body, url);
    if (out) return out;
  }
  return null;
}

/** Dugi opisi — LibreTranslate često odbija ili štuca na jednom ogromnom tijelu. */
function splitIntoChunks(s: string, maxLen: number): string[] {
  if (s.length <= maxLen) return [s];
  let breakAt = -1;
  for (const sep of ["\n\n", "\n", ". "]) {
    const idx = s.lastIndexOf(sep, maxLen);
    if (idx >= Math.floor(maxLen * 0.35)) {
      breakAt = idx + sep.length;
      break;
    }
  }
  if (breakAt <= 0) breakAt = maxLen;
  const head = s.slice(0, breakAt);
  const tail = s.slice(breakAt);
  if (tail.length === 0) return [head];
  return [head, ...splitIntoChunks(tail, maxLen)];
}

async function translateOneChunk(
  text: string,
  target: string,
  scope: TranslateScope
): Promise<string> {
  const t = text.trim();
  if (!t) return text;

  const key = cacheKey(target, t, scope);
  try {
    const hit = sessionStorage.getItem(key);
    if (hit != null) {
      /**
       * Ako je ranije kod greške keširan izvorni HR tekst,
       * ne koristimo taj "lažni prijevod" i pokušamo ponovno.
       */
      if (!sameText(hit, t)) return hit;
      sessionStorage.removeItem(key);
    }
  } catch {
    /* private mode */
  }

  const body = JSON.stringify({
    q: t.slice(0, 4500),
    source: "hr",
    target,
    format: "text",
  });

  const out = await postTranslateFirstWorking(body, scope);
  if (out) {
    try {
      sessionStorage.setItem(key, out);
    } catch {
      /* quota */
    }
    return out;
  }
  return text;
}

export type TranslateFromHrOptions = {
  /**
   * Urednik-ARTIKLI: samo DeepL Free preko /__translate__/artikli.
   * Ostatak stranice koristi zadani /__translate__ (Google → DeepL → LibreTranslate).
   */
  artikliEditor?: boolean;
};

export async function translateFromHr(
  text: string,
  targetLang: string,
  options?: TranslateFromHrOptions
): Promise<string> {
  const scope: TranslateScope = options?.artikliEditor ? "artikli" : "site";
  const raw = text;
  const t = raw.trim();
  const target = targetLang.split("-")[0]?.toLowerCase() ?? "hr";
  if (!t || target === "hr") return raw;

  const fullKey = cacheKey(target, raw, scope);
  try {
    const hit = sessionStorage.getItem(fullKey);
    if (hit != null) {
      if (!sameText(hit, raw)) return hit;
      sessionStorage.removeItem(fullKey);
    }
  } catch {
    /* private mode */
  }

  const chunks =
    t.length <= MAX_CHUNK ? [t] : splitIntoChunks(t, MAX_CHUNK);
  const parts = await Promise.all(
    chunks.map((c) => translateOneChunk(c, target, scope))
  );
  const result = parts.join("");

  try {
    /**
     * Ne keširamo HR fallback kao prijevod jer bi blokirao kasniji uspješan prijevod.
     */
    if (!sameText(result, raw)) {
      sessionStorage.setItem(fullKey, result);
    } else {
      sessionStorage.removeItem(fullKey);
    }
  } catch {
    /* quota */
  }
  return result;
}

const VERIFY_SOURCE_HR =
  "Dobro jutro, ovo je probni tekst za prijevod s hrvatskog na engleski.";

/** Čita JSON s Vite proxyja nakon 502 (detail + hint za korisnika). */
async function readSameOriginTranslateFailureHint(
  scope: TranslateScope
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
  const suffix = scope === "artikli" ? "/__translate__/artikli" : "/__translate__";
  const path = `${base}${suffix}`.replace(/\/{2,}/g, "/");
  const url = path.startsWith("/") ? path : `/${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: "Dobar dan.",
        source: "hr",
        target: "en",
        format: "text",
      }),
    });
    if (res.ok) return null;
    const t = await res.text();
    try {
      const j = JSON.parse(t) as { detail?: string; hint?: string };
      const parts = [j.detail, j.hint].filter(Boolean);
      if (parts.length) return parts.join(" — ");
    } catch {
      return t.trim().slice(0, 240) || null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Jednostavna provjera: ako je odgovor i dalje HR, proxy/LibreTranslate ne radi kako treba.
 */
/** Provjera za Urednik-ARTIKLI (samo DeepL Free /__translate__/artikli). */
export async function verifyTranslateProxy(): Promise<{
  ok: boolean;
  message: string;
  translatedPreview?: string;
}> {
  const scope: TranslateScope = "artikli";
  const out = await translateFromHr(VERIFY_SOURCE_HR, "en", { artikliEditor: true });
  if (sameText(out, VERIFY_SOURCE_HR)) {
    const fromProxy = await readSameOriginTranslateFailureHint(scope);
    const base =
      "Prijevod u uredniku artikala ne radi. U .env postavi DEEPL_AUTH_KEY (besplatno na deepl.com/pro-api, api-free), pa ponovo pokreni Vite.";
    return {
      ok: false,
      message: fromProxy ? `${base} (${fromProxy})` : base,
    };
  }
  return {
    ok: true,
    message: "Veza prema usluzi prijevoda radi; probni tekst je preveden.",
    translatedPreview: out.length > 180 ? `${out.slice(0, 180)}…` : out,
  };
}
