import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const DEFAULT_UPSTREAM = [
  "https://libretranslate.de/translate",
  "https://libretranslate.com/translate",
];

export type TranslateProxyPluginOptions = {
  /**
   * Obavezno za većinu javnih instanci (npr. libretranslate.de sada traži ključ zbog botova).
   * Besplatni ključ: https://portal.libretranslate.com/
   */
  apiKey?: string;
  /** Zarezom odvojeni URL-ovi; inače zadani LibreTranslate javni endpointi. */
  upstreamUrls?: string[];
  /**
   * Google Cloud Translation API (REST v2). Ako je postavljen, prvo se koristi Google;
   * pri neuspjehu slijedi LibreTranslate. Ključ ostaje samo u .env na stroju (ne u pregledniku).
   * Uključi API u Google Cloud konzoli i naplata/free tier prema Googleu.
   */
  googleApiKey?: string;
  /**
   * DeepL API (besplatni plan: https://api-free.deepl.com ). Ključ besplatno na deepl.com/pro-api.
   * Ako nije postavljen DEEPL_API_URL, koristi se free endpoint.
   */
  deeplAuthKey?: string;
  /** Npr. https://api.deepl.com/v2/translate za Pro; inače free. */
  deeplApiUrl?: string;
};

/** Urednik-ARTIKLI: samo DeepL Free, bez Google/Libre. */
function isArtikliTranslatePath(pathOnly: string): boolean {
  const p = pathOnly.split("?")[0] ?? "";
  return p === "/__translate__/artikli" || p.endsWith("/__translate__/artikli");
}

function isMainTranslatePath(pathOnly: string): boolean {
  const p = pathOnly.split("?")[0] ?? "";
  if (isArtikliTranslatePath(p)) return false;
  return p === "/__translate__" || p.endsWith("/__translate__");
}

async function forwardToLibre(
  body: string,
  upstream: string[]
): Promise<{ ok: true; text: string } | { ok: false; detail: string }> {
  let lastDetail = "";
  for (const url of upstream) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "OlivoShop/1.0 (vite-translate-proxy)",
        },
        body,
      });
      const responseText = await r.text();
      if (!r.ok) {
        lastDetail = `${url} → HTTP ${r.status}: ${responseText.slice(0, 280)}`;
        continue;
      }
      return { ok: true, text: responseText };
    } catch (e) {
      lastDetail = `${url} → ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { ok: false, detail: lastDetail || "nema dostupnog upstreama" };
}

/** Isti ulaz/izlaz kao LibreTranslate da klijent ne mora znati za Google. */
async function translateWithGoogle(
  rawLtBody: string,
  googleKey: string
): Promise<{ ok: true; text: string } | { ok: false; detail: string }> {
  let parsed: { q?: unknown; source?: unknown; target?: unknown; format?: unknown };
  try {
    parsed = JSON.parse(rawLtBody) as typeof parsed;
  } catch {
    return { ok: false, detail: "neispravan JSON tijela zahtjeva" };
  }
  const qRaw = parsed.q;
  const q = typeof qRaw === "string" ? qRaw : "";
  if (!q.trim()) {
    return { ok: true, text: JSON.stringify({ translatedText: "" }) };
  }
  const source = String(parsed.source ?? "hr").split("-")[0]?.toLowerCase() ?? "hr";
  const target = String(parsed.target ?? "en").split("-")[0]?.toLowerCase() ?? "en";
  const format = parsed.format === "html" ? "html" : "text";

  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
    googleKey.trim()
  )}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ q, source, target, format }),
    });
    const responseText = await r.text();
    if (!r.ok) {
      return {
        ok: false,
        detail: `Google Cloud Translation → HTTP ${r.status}: ${responseText.slice(0, 400)}`,
      };
    }
    const j = JSON.parse(responseText) as {
      data?: { translations?: Array<{ translatedText?: string }> };
      error?: { message?: string; errors?: Array<{ message?: string }> };
    };
    const apiErr = j.error?.message ?? j.error?.errors?.[0]?.message;
    if (apiErr) {
      return { ok: false, detail: `Google: ${apiErr}` };
    }
    const t = j.data?.translations?.[0]?.translatedText ?? "";
    return { ok: true, text: JSON.stringify({ translatedText: t }) };
  } catch (e) {
    return {
      ok: false,
      detail: `Google: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** ISO → DeepL oznake jezika (v2). */
function toDeepLLang(code: string): string {
  const c = code.split("-")[0]?.toLowerCase() ?? "en";
  const map: Record<string, string> = {
    hr: "HR",
    en: "EN",
    de: "DE",
    fr: "FR",
    it: "IT",
    pl: "PL",
    cs: "CS",
  };
  return map[c] ?? c.toUpperCase().slice(0, 2);
}

/** DeepL v2 JSON API → LibreTranslate-oblik odgovora. */
async function translateWithDeepL(
  rawLtBody: string,
  authKey: string,
  apiUrl: string
): Promise<{ ok: true; text: string } | { ok: false; detail: string }> {
  let parsed: { q?: unknown; source?: unknown; target?: unknown; format?: unknown };
  try {
    parsed = JSON.parse(rawLtBody) as typeof parsed;
  } catch {
    return { ok: false, detail: "neispravan JSON tijela zahtjeva" };
  }
  const qRaw = parsed.q;
  const q = typeof qRaw === "string" ? qRaw : "";
  if (!q.trim()) {
    return { ok: true, text: JSON.stringify({ translatedText: "" }) };
  }
  const source = String(parsed.source ?? "hr");
  const target = String(parsed.target ?? "en");
  const isHtml = parsed.format === "html";

  const url = apiUrl.trim() || "https://api-free.deepl.com/v2/translate";
  const body: Record<string, unknown> = {
    text: [q],
    source_lang: toDeepLLang(source),
    target_lang: toDeepLLang(target),
  };
  if (isHtml) {
    body.tag_handling = "html";
  }

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${authKey.trim()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const responseText = await r.text();
    if (!r.ok) {
      return {
        ok: false,
        detail: `DeepL → HTTP ${r.status}: ${responseText.slice(0, 400)}`,
      };
    }
    const j = JSON.parse(responseText) as {
      translations?: Array<{ text?: string }>;
      message?: string;
    };
    if (j.message && !j.translations?.length) {
      return { ok: false, detail: `DeepL: ${j.message}` };
    }
    const t = j.translations?.[0]?.text ?? "";
    return { ok: true, text: JSON.stringify({ translatedText: t }) };
  } catch (e) {
    return {
      ok: false,
      detail: `DeepL: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

type ConnectNext = () => void;
type ConnectMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: ConnectNext
) => void | Promise<void>;

function mountTranslateProxy(
  middlewares: { use: (fn: ConnectMiddleware) => void },
  opts: TranslateProxyPluginOptions
) {
  const upstream =
    opts.upstreamUrls && opts.upstreamUrls.length > 0
      ? opts.upstreamUrls
      : DEFAULT_UPSTREAM;
  const apiKey = opts.apiKey?.trim() ?? "";
  const googleKey = opts.googleApiKey?.trim() ?? "";
  const deeplKey = opts.deeplAuthKey?.trim() ?? "";
  const deeplUrl =
    opts.deeplApiUrl?.trim() || "https://api-free.deepl.com/v2/translate";

  middlewares.use(async (req, res, next) => {
    const pathOnly = (req.url ?? "").split("?")[0] ?? "";
    if (req.method !== "POST") {
      next();
      return;
    }
    if (!isArtikliTranslatePath(pathOnly) && !isMainTranslatePath(pathOnly)) {
      next();
      return;
    }
    const out = res as ServerResponse;
    try {
      const raw = await readBody(req as IncomingMessage);
      out.setHeader("Content-Type", "application/json; charset=utf-8");

      if (isArtikliTranslatePath(pathOnly)) {
        if (!deeplKey) {
          out.statusCode = 502;
          out.end(
            JSON.stringify({
              error: "deepl_required_for_artikli",
              detail: "Urednik artikala koristi samo DeepL Free.",
              hint: "Postavi DEEPL_AUTH_KEY u .env ( https://www.deepl.com/pro-api ) i ponovo pokreni Vite.",
            })
          );
          return;
        }
        const dOnly = await translateWithDeepL(raw, deeplKey, deeplUrl);
        if (dOnly.ok) {
          out.statusCode = 200;
          out.end(dOnly.text);
          return;
        }
        out.statusCode = 502;
        out.end(
          JSON.stringify({
            error: "translate_upstream_failed",
            detail: dOnly.detail,
            hint: "Provjeri DEEPL_AUTH_KEY i mjesečni limit DeepL Free API-ja.",
          })
        );
        return;
      }

      let bodyStr = raw;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (apiKey && !parsed.api_key) {
          parsed.api_key = apiKey;
          bodyStr = JSON.stringify(parsed);
        }
      } catch {
        /* neispravan JSON — prosljeđuj kao što je */
      }

      const failures: string[] = [];

      if (googleKey) {
        const g = await translateWithGoogle(raw, googleKey);
        if (g.ok) {
          out.statusCode = 200;
          out.end(g.text);
          return;
        }
        failures.push(`Google: ${g.detail}`);
      }

      if (deeplKey) {
        const d = await translateWithDeepL(raw, deeplKey, deeplUrl);
        if (d.ok) {
          out.statusCode = 200;
          out.end(d.text);
          return;
        }
        failures.push(`DeepL: ${d.detail}`);
      }

      const result = await forwardToLibre(bodyStr, upstream);
      if (result.ok) {
        out.statusCode = 200;
        out.end(result.text);
        return;
      }
      failures.push(`LibreTranslate: ${result.detail}`);

      out.statusCode = 502;
      out.end(
        JSON.stringify({
          error: "translate_upstream_failed",
          detail: failures.join(" | "),
          hint:
            "Postavi DEEPL_AUTH_KEY (besplatno na deepl.com/pro-api, endpoint api-free) ili GOOGLE_TRANSLATION_API_KEY ili LIBRETRANSLATE_API_KEY / LIBRETRANSLATE_UPSTREAM.",
        })
      );
    } catch (e) {
      out.setHeader("Content-Type", "application/json; charset=utf-8");
      out.statusCode = 502;
      out.end(
        JSON.stringify({
          error: "translate_proxy_error",
          detail: e instanceof Error ? e.message : String(e),
        })
      );
    }
  });
}

/**
 * Izbjegava CORS: preglednik zove istu origin.
 * `/__translate__/artikli` — samo DeepL (Urednik-ARTIKLI). `/__translate__` — Google → DeepL → LibreTranslate.
 */
export function translateProxyPlugin(
  opts: TranslateProxyPluginOptions = {}
): Plugin {
  return {
    name: "olivo-translate-proxy",
    configureServer(server) {
      mountTranslateProxy(server.middlewares, opts);
    },
    configurePreviewServer(server) {
      mountTranslateProxy(server.middlewares, opts);
    },
  };
}
