/**
 * Automatski prevoditelj pomoću MyMemory Translate API
 * ------------------------------------------------------
 * Služba: https://mymemory.translated.net/doc/spec.php
 * Besplatna razina: do ~5 000 riječi dnevno po IP-u (bez registracije).
 * Bez API ključa; za više od toga registriraj se i dodaj e-mail u query.
 *
 * Arhitektura (client-side):
 *  - `translateText(text, source, target)` → Promise<string>
 *  - Svaki prijevod keširan u `localStorage` (`mm_tr_cache_v1`) kako bi se
 *    isti tekstovi prevodili samo jednom.
 *  - Podržane ciljne jezične oznake:  en de fr it sl cs pl  (izvor: hr).
 *  - MyMemory prihvaća ISO 639-1 oznake i `hr|sl`, `hr|en` itd.
 *
 * Za svako drugo rješenje (npr. DeepL, Google) samo zamijeni `callProvider`.
 */

export type TranslatableLang =
  | "hr"
  | "en"
  | "de"
  | "fr"
  | "it"
  | "pl"
  | "cs"
  | "sl";

type CacheMap = Record<string, string>;

const CACHE_KEY = "mm_tr_cache_v1";
const MAX_CHARS_PER_REQUEST = 480;

function readCache(): CacheMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as CacheMap) : {};
  } catch {
    return {};
  }
}

function writeCache(map: CacheMap): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    /* localStorage pun — ignoriraj */
  }
}

function cacheKey(source: string, target: string, text: string): string {
  return `${source}|${target}|${text}`;
}

/**
 * Globalna pauza između uzastopnih poziva MyMemory-a.
 *
 * Besplatna razina ima kratkoročan per-IP rate limit — brzi burstovi vraćaju
 * HTTP 429. Uveden je minimalni razmak između poziva (~180 ms) i
 * exponential backoff na 429. Kad server pošalje `Retry-After`, poštujemo ga.
 */
const MIN_GAP_MS = 180;
const MAX_RETRIES = 5;
let lastCallAt = 0;
let gate: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Serijalizira sve API pozive kroz `gate` i osigurava MIN_GAP_MS razmak
 * između uzastopnih zahtjeva, neovisno o tome koliko paralelnih workera
 * poziva `callProvider`.
 */
async function throttle(): Promise<void> {
  const next = gate.then(async () => {
    const elapsed = Date.now() - lastCallAt;
    if (elapsed < MIN_GAP_MS) await sleep(MIN_GAP_MS - elapsed);
    lastCallAt = Date.now();
  });
  gate = next.catch(() => undefined);
  await next;
}

function isQuotaMessage(details: string | undefined): boolean {
  if (!details) return false;
  const s = details.toUpperCase();
  return (
    s.includes("USED ALL AVAILABLE FREE TRANSLATIONS") ||
    s.includes("DAILY LIMIT") ||
    s.includes("QUOTA")
  );
}

/**
 * Poziva MyMemory HTTP API i vraća prevedeni tekst, ili bacanje greške.
 *
 * MyMemory često vrati HTTP 200 s `responseStatus` u body-ju (429, 403, …).
 * Obje varijante (HTTP 429 i body 429) tretiramo jednako — retry s backoffom.
 * `Retry-After` zaglavlje se poštuje ako je prisutno.
 */
async function callProvider(
  text: string,
  source: TranslatableLang,
  target: TranslatableLang,
  attempt = 0
): Promise<string> {
  await throttle();
  const url =
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
    `&langpair=${source}|${target}`;
  const res = await fetch(url);

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(
        "MyMemory: previše zahtjeva (HTTP 429). Pričekaj minutu pa pokušaj ponovno, " +
          "ili si iscrpio dnevni limit (~5 000 riječi po IP-u)."
      );
    }
    const retryAfterHdr = res.headers.get("Retry-After");
    const retryAfterSec = retryAfterHdr
      ? Number.parseInt(retryAfterHdr, 10)
      : NaN;
    const wait =
      Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? Math.min(30_000, retryAfterSec * 1000)
        : Math.min(20_000, 800 * 2 ** attempt);
    await sleep(wait);
    return callProvider(text, source, target, attempt + 1);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number | string;
    responseDetails?: string;
  };

  const statusNum =
    typeof data.responseStatus === "string"
      ? Number.parseInt(data.responseStatus, 10)
      : data.responseStatus ?? 200;

  if (statusNum === 429 || isQuotaMessage(data.responseDetails)) {
    if (isQuotaMessage(data.responseDetails)) {
      throw new Error(
        `MyMemory: dnevni limit iskorišten — ${data.responseDetails}. ` +
          "Pokušaj sutra ili dodaj e-mail za proširenu kvotu."
      );
    }
    if (attempt >= MAX_RETRIES) {
      throw new Error(
        "MyMemory: previše zahtjeva. Pričekaj malo pa pokušaj ponovno."
      );
    }
    await sleep(Math.min(15_000, 900 * 2 ** attempt));
    return callProvider(text, source, target, attempt + 1);
  }

  if (statusNum && statusNum !== 200) {
    throw new Error(
      `MyMemory ${statusNum}: ${data.responseDetails ?? ""}`
    );
  }

  const translated = data.responseData?.translatedText ?? "";
  return translated.trim() || text;
}

/**
 * Glavno sučelje — prevede jedan string s izvora na cilj. Ako je target === source
 * vraća izvorni tekst.
 * Duge stringove dijeli na dijelove (~480 znakova) da stane u besplatan limit.
 */
export async function translateText(
  text: string,
  source: TranslatableLang,
  target: TranslatableLang
): Promise<string> {
  const raw = text.trim();
  if (!raw) return text;
  if (source === target) return text;

  const cache = readCache();
  const k = cacheKey(source, target, raw);
  if (cache[k]) return cache[k];

  if (raw.length <= MAX_CHARS_PER_REQUEST) {
    const out = await callProvider(raw, source, target);
    cache[k] = out;
    writeCache(cache);
    return out;
  }

  const chunks = splitIntoChunks(raw, MAX_CHARS_PER_REQUEST);
  const translated: string[] = [];
  for (const c of chunks) {
    translated.push(await callProvider(c, source, target));
  }
  const full = translated.join(" ");
  cache[k] = full;
  writeCache(cache);
  return full;
}

/**
 * Dijeli tekst na dijelove maksimalne duljine, ali po mogućnosti na rečenici.
 */
function splitIntoChunks(text: string, maxLen: number): string[] {
  const out: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf(". ", maxLen);
    if (cut < maxLen * 0.6) cut = remaining.lastIndexOf(" ", maxLen);
    if (cut <= 0) cut = maxLen;
    out.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) out.push(remaining);
  return out;
}

/**
 * Prevede sve vrijednosti stabla (JSON-like) rekurzivno.
 * Ključevi i numeričke/logičke vrijednosti ostaju nepromijenjeni.
 */
export async function translateTree(
  tree: unknown,
  source: TranslatableLang,
  target: TranslatableLang,
  onProgress?: (done: number, total: number) => void
): Promise<unknown> {
  if (source === target) return tree;

  // 1) Skupi jedinstvene stringove iz stabla.
  const unique = new Set<string>();
  collectStrings(tree, unique);
  const items = Array.from(unique);
  const total = items.length;

  // 2) Paralelno prevedi sve (s blagom konkurencijom).
  //
  //    Pazi: MyMemory besplatna razina penalizira burstove — globalni
  //    `throttle()` u `callProvider`-u ionako serijalizira pozive pa je
  //    više workera bespotrebno. CONCURRENCY=2 je još uvijek koristan
  //    kad jedan worker čeka backoff (drugi može napredovati).
  const translations = new Map<string, string>();
  const CONCURRENCY = 2;
  let done = 0;
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const myIdx = idx++;
      const src = items[myIdx];
      try {
        const tr = await translateText(src, source, target);
        translations.set(src, tr);
      } catch {
        translations.set(src, src);
      }
      done++;
      onProgress?.(done, total);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // 3) Ponovno izgradi stablo sa zamijenjenim stringovima.
  return rebuildTree(tree, translations);
}

const TRIVIAL_STRING = /^[\s\d.,:;!?%\-_/*+=|()[\]{}@#$€£¥§°•·—–…"'`]+$/;

function shouldSkipString(s: string): boolean {
  const t = s.trim();
  if (t.length < 2) return true;
  if (/^\s*\{\{[^}]+\}\}\s*$/.test(t)) return true;
  if (TRIVIAL_STRING.test(t)) return true;
  return false;
}

function collectStrings(input: unknown, out: Set<string>): void {
  if (typeof input === "string") {
    if (!shouldSkipString(input)) out.add(input);
    return;
  }
  if (Array.isArray(input)) {
    for (const x of input) collectStrings(x, out);
    return;
  }
  if (input && typeof input === "object") {
    for (const v of Object.values(input as Record<string, unknown>)) {
      collectStrings(v, out);
    }
  }
}

function rebuildTree(input: unknown, map: Map<string, string>): unknown {
  if (typeof input === "string") {
    if (shouldSkipString(input)) return input;
    return map.get(input) ?? input;
  }
  if (Array.isArray(input)) {
    return input.map((x) => rebuildTree(x, map));
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = rebuildTree(v, map);
    }
    return out;
  }
  return input;
}
