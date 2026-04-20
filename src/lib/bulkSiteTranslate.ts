/**
 * Skupno strojno prevođenje: UI tekstovi (localeOverrides), artikli (productOverrides.translations),
 * kolekcije (collectionOverrides.translations) na sve jezike iz BUNDLED_LOCALE_CODES osim hr.
 */
import { collections, products } from "@/data/catalog";
import type {
  SiteSettings,
  AppLocaleCode,
  ProductCopyTranslations,
  CollectionCopyTranslations,
} from "@/config/siteDefaults";
import { mergeProduct, mergeCollection } from "@/config/siteDefaults";
import { translateText, type TranslatableLang } from "@/lib/autoTranslate";

/**
 * Jednoobrazni strojni prijevod HR → ciljni jezik preko MyMemory-a
 * (besplatno, bez proxyja). Iste funkcije koristi i Urednik-ARTIKLI
 * pa se cache (localStorage `mm_tr_cache_v1`) dijeli između svih urednika.
 * Za hr samo vraća ulaz.
 */
async function translateFromHr(
  text: string,
  targetLang: AppLocaleCode
): Promise<string> {
  if (targetLang === "hr") return text;
  return translateText(text, "hr", targetLang as TranslatableLang);
}
import { deepMergeLocale, getAtSeg, setAtSegDeep } from "@/lib/localeTree";
import { BUNDLED_LOCALES, BUNDLED_LOCALE_CODES } from "@/i18n/bundledLocales";
import { EDITOR_I18N_GROUPS } from "@/editor/editorLocaleSchema";

const TARGET_LANGS = BUNDLED_LOCALE_CODES.filter((c) => c !== "hr");

function effectiveHrBundle(draft: SiteSettings): Record<string, unknown> {
  const base = structuredClone(BUNDLED_LOCALES.hr);
  return deepMergeLocale(base, (draft.localeOverrides.hr ?? {}) as Record<string, unknown>);
}

type CategoryField = {
  slug: string;
  path: (string | number)[];
};

function categoryFieldsFromDraft(draft: SiteSettings): CategoryField[] {
  return draft.navigation.shopSubmenu
    .filter((row) => row.slug.trim() !== "")
    .map((row) => ({
      slug: row.slug.trim(),
      path: ["categories", row.slug.trim()],
    }));
}

export type FullSiteTranslateOptions = {
  /**
   * true = ne prepisuje postojeće neprazne prijevode u nacrtu (localeOverrides + product/collection translations).
   */
  gapsOnly?: boolean;
};

function hasNonEmptyValue(v: unknown): boolean {
  return typeof v === "string" && v.trim() !== "";
}

function sameText(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function translationUsable(src: string, translated: string): boolean {
  return translated.trim() !== "" && !sameText(src, translated);
}

async function buildLocaleOverrideForLang(
  hrEff: Record<string, unknown>,
  lang: AppLocaleCode,
  cats: CategoryField[],
  prev: Record<string, unknown> | undefined,
  gapsOnly: boolean
): Promise<Record<string, unknown>> {
  let nextTarget = { ...(prev ?? {}) } as Record<string, unknown>;

  /**
   * Wrapper oko `translateFromHr` koji umjesto bacanja na MyMemory 429/quota
   * greškama vraća prazan string — pozivatelj tu vrijednost smatra
   * „neprevodivom” pa polje ostaje prazno (ili zadrži prethodnu vrijednost).
   * Globalni throttle i retry u `callProvider`-u su već odradili svoje; ovdje
   * samo ne želimo zaustaviti cijelu turu zbog jednog nepouzdanog poziva.
   */
  const translateString = async (s: string) => {
    const t = s.trim();
    if (!t) return "";
    try {
      return await translateFromHr(t, lang);
    } catch (err) {
      console.warn(
        `[bulkSiteTranslate] prijevod „${t.slice(0, 40)}${t.length > 40 ? "…" : ""}” → ${lang} neuspio:`,
        err instanceof Error ? err.message : err
      );
      return "";
    }
  };

  for (const f of EDITOR_I18N_GROUPS.flatMap((g) => g.fields)) {
    if (f.kind === "lines") {
      const src = getAtSeg(hrEff, f.path);
      if (!Array.isArray(src)) continue;
      const existingLines = getAtSeg(nextTarget, f.path);
      const out: string[] = [];
      for (let i = 0; i < src.length; i++) {
        const line = src[i];
        const str = typeof line === "string" ? line : String(line);
        const prevLine =
          Array.isArray(existingLines) && typeof existingLines[i] === "string"
            ? existingLines[i]
            : "";
        if (
          gapsOnly &&
          String(prevLine).trim() !== "" &&
          !sameText(prevLine, str)
        ) {
          out.push(prevLine);
          continue;
        }
        if (!str.trim()) {
          out.push("");
          continue;
        }
        const translated = await translateString(str);
        out.push(translationUsable(str, translated) ? translated : prevLine);
      }
      nextTarget = setAtSegDeep({ ...nextTarget }, f.path, out);
    } else {
      const existing = getAtSeg(nextTarget, f.path);
      const src = getAtSeg(hrEff, f.path);
      if (typeof src !== "string" || !src.trim()) continue;
      if (gapsOnly && hasNonEmptyValue(existing) && !sameText(existing, src)) {
        continue;
      }
      const translated = await translateString(src);
      if (translationUsable(src, translated)) {
        nextTarget = setAtSegDeep({ ...nextTarget }, f.path, translated);
      }
    }
  }

  for (const cat of cats) {
    const existing = getAtSeg(nextTarget, cat.path);
    const src = getAtSeg(hrEff, cat.path);
    if (typeof src !== "string" || !src.trim()) continue;
    if (gapsOnly && hasNonEmptyValue(existing) && !sameText(existing, src)) {
      continue;
    }
    const translated = await translateString(src);
    if (translationUsable(src, translated)) {
      nextTarget = setAtSegDeep({ ...nextTarget }, cat.path, translated);
    }
  }

  for (const f of EDITOR_I18N_GROUPS.flatMap((g) => g.fields)) {
    if (f.kind === "lines") {
      const src = getAtSeg(hrEff, f.path);
      const out = getAtSeg(nextTarget, f.path);
      if (!Array.isArray(src) || !Array.isArray(out)) continue;
      const sameAll = src.every((line, i) =>
        sameText(line, i < out.length ? out[i] : "")
      );
      if (sameAll) {
        nextTarget = setAtSegDeep(nextTarget, f.path, undefined);
      }
      continue;
    }
    const src = getAtSeg(hrEff, f.path);
    const out = getAtSeg(nextTarget, f.path);
    if (typeof src !== "string" || !src.trim()) continue;
    if (sameText(src, out)) {
      nextTarget = setAtSegDeep(nextTarget, f.path, undefined);
    }
  }
  for (const cat of cats) {
    const src = getAtSeg(hrEff, cat.path);
    const out = getAtSeg(nextTarget, cat.path);
    if (typeof src !== "string" || !src.trim()) continue;
    if (sameText(src, out)) {
      nextTarget = setAtSegDeep(nextTarget, cat.path, undefined);
    }
  }

  return nextTarget;
}

/**
 * Strojni prijevod naslova/opisa svih artikala i kolekcija na jedan jezik (iz HR izvora u nacrtu).
 * Za `hr` vraća iste mape bez izmjena.
 */
export async function runCatalogAutoTranslateForLang(
  draft: SiteSettings,
  lang: AppLocaleCode,
  onProgress?: (label: string) => void,
  gapsOnly = false
): Promise<Pick<SiteSettings, "productOverrides" | "collectionOverrides">> {
  if (lang === "hr") {
    return {
      productOverrides: draft.productOverrides,
      collectionOverrides: draft.collectionOverrides,
    };
  }

  const productOverrides = structuredClone(draft.productOverrides);

  for (const p of products) {
    const slug = p.slug;
    onProgress?.(`Artikl ${slug} → ${lang.toUpperCase()}…`);
    const o = productOverrides[slug] ?? null;
    const hrP = mergeProduct(p, o, "hr");
    const tr: Partial<Record<AppLocaleCode, ProductCopyTranslations>> = {
      ...(o?.translations ?? {}),
    };
    const prevSlice = tr[lang] ?? {};
    const slice: ProductCopyTranslations = { ...prevSlice };
    if (hrP.title.trim()) {
      if (
        !(
          gapsOnly &&
          hasNonEmptyValue(prevSlice.title) &&
          !sameText(prevSlice.title, hrP.title)
        )
      ) {
        const translated = await translateFromHr(hrP.title, lang);
        if (translationUsable(hrP.title, translated)) {
          slice.title = translated;
        } else {
          delete slice.title;
        }
      }
    }
    if (hrP.shortDescription.trim()) {
      if (
        !(
          gapsOnly &&
          hasNonEmptyValue(prevSlice.shortDescription) &&
          !sameText(prevSlice.shortDescription, hrP.shortDescription)
        )
      ) {
        const translated = await translateFromHr(
          hrP.shortDescription,
          lang
        );
        if (translationUsable(hrP.shortDescription, translated)) {
          slice.shortDescription = translated;
        } else {
          delete slice.shortDescription;
        }
      }
    }
    if (hrP.description.trim()) {
      if (
        !(
          gapsOnly &&
          hasNonEmptyValue(prevSlice.description) &&
          !sameText(prevSlice.description, hrP.description)
        )
      ) {
        const translated = await translateFromHr(hrP.description, lang);
        if (translationUsable(hrP.description, translated)) {
          slice.description = translated;
        } else {
          delete slice.description;
        }
      }
    }
    tr[lang] = slice;
    productOverrides[slug] = {
      ...(productOverrides[slug] ?? {}),
      translations: tr,
    };
  }

  const collectionOverrides = structuredClone(draft.collectionOverrides);

  for (const c of collections) {
    const slug = c.slug;
    onProgress?.(`Kolekcija ${slug} → ${lang.toUpperCase()}…`);
    const rawOv =
      collectionOverrides[slug] ?? collectionOverrides[c.id] ?? null;
    const hrC = mergeCollection(c, rawOv, "hr");
    const tr: Partial<Record<AppLocaleCode, CollectionCopyTranslations>> = {
      ...(rawOv?.translations ?? {}),
    };
    const prevSlice = tr[lang] ?? {};
    const slice: CollectionCopyTranslations = { ...prevSlice };
    if (hrC.title.trim()) {
      if (
        !(
          gapsOnly &&
          hasNonEmptyValue(prevSlice.title) &&
          !sameText(prevSlice.title, hrC.title)
        )
      ) {
        const translated = await translateFromHr(hrC.title, lang);
        if (translationUsable(hrC.title, translated)) {
          slice.title = translated;
        } else {
          delete slice.title;
        }
      }
    }
    if (hrC.description.trim()) {
      if (
        !(
          gapsOnly &&
          hasNonEmptyValue(prevSlice.description) &&
          !sameText(prevSlice.description, hrC.description)
        )
      ) {
        const translated = await translateFromHr(hrC.description, lang);
        if (translationUsable(hrC.description, translated)) {
          slice.description = translated;
        } else {
          delete slice.description;
        }
      }
    }
    tr[lang] = slice;
    collectionOverrides[slug] = {
      ...(collectionOverrides[slug] ?? {}),
      translations: tr,
    };
  }

  return { productOverrides, collectionOverrides };
}

/**
 * Vraća novi SiteSettings s ažuriranim localeOverrides, productOverrides, collectionOverrides.
 * Ostala polja kopija iz `draft`.
 * @param options.gapsOnly — ne prepisuje polja koja već imaju neprazan prijevod u nacrtu.
 */
/**
 * Prevodi SAMO `localeOverrides` (UI tekstove stranice) — bez artikala i
 * kolekcija. Koristi se u Urednik-STRANICE za brzo auto-prevođenje nakon
 * „Spremi promjene” (klik) ili klika na „Prevedi tekstove”. Artikli i
 * kolekcije se prevode iz Urednik-ARTIKLI kroz `translateText` pa ovdje
 * nema smisla rekati ih.
 */
export async function runSiteTextAutoTranslate(
  draft: SiteSettings,
  onProgress?: (label: string) => void,
  options?: FullSiteTranslateOptions
): Promise<SiteSettings> {
  const gapsOnly = options?.gapsOnly ?? false;
  const hrEff = effectiveHrBundle(draft);
  const cats = categoryFieldsFromDraft(draft);

  const localeOverrides = { ...draft.localeOverrides };

  for (const lang of TARGET_LANGS) {
    onProgress?.(
      gapsOnly
        ? `Tekstovi stranice (praznine) → ${lang.toUpperCase()}…`
        : `Tekstovi stranice → ${lang.toUpperCase()}…`
    );
    const prev = localeOverrides[lang] as Record<string, unknown> | undefined;
    try {
      const next = await buildLocaleOverrideForLang(
        hrEff,
        lang,
        cats,
        prev,
        gapsOnly
      );
      localeOverrides[lang] =
        next as SiteSettings["localeOverrides"][AppLocaleCode];
    } catch (err) {
      // Jedna jezična tura pukla (npr. mrežni reset) — ostali jezici i dalje
      // idu. Parcijalni rezultat iz `next` se neće spremiti, ali postojeći
      // `prev` ostaje netaknut u `localeOverrides[lang]`.
      console.warn(
        `[bulkSiteTranslate] jezik ${lang} preskočen:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return { ...draft, localeOverrides };
}

export async function runFullSiteAutoTranslate(
  draft: SiteSettings,
  onProgress?: (label: string) => void,
  options?: FullSiteTranslateOptions
): Promise<SiteSettings> {
  const gapsOnly = options?.gapsOnly ?? false;
  const hrEff = effectiveHrBundle(draft);
  const cats = categoryFieldsFromDraft(draft);

  const localeOverrides = { ...draft.localeOverrides };

  for (const lang of TARGET_LANGS) {
    onProgress?.(
      gapsOnly
        ? `Tekstovi stranice (praznine) → ${lang.toUpperCase()}…`
        : `Tekstovi stranice → ${lang.toUpperCase()}…`
    );
    const prev = localeOverrides[lang] as Record<string, unknown> | undefined;
    const next = await buildLocaleOverrideForLang(
      hrEff,
      lang,
      cats,
      prev,
      gapsOnly
    );
    localeOverrides[lang] = next as SiteSettings["localeOverrides"][AppLocaleCode];
  }

  let productOverrides = structuredClone(draft.productOverrides);
  let collectionOverrides = structuredClone(draft.collectionOverrides);

  for (const lang of TARGET_LANGS) {
    const part = await runCatalogAutoTranslateForLang(
      { ...draft, productOverrides, collectionOverrides },
      lang,
      onProgress,
      gapsOnly
    );
    productOverrides = part.productOverrides;
    collectionOverrides = part.collectionOverrides;
  }

  return {
    ...draft,
    localeOverrides,
    productOverrides,
    collectionOverrides,
  };
}

export type FullSiteTranslateHealthItem = {
  localeMissing: number;
  productMissing: number;
  collectionMissing: number;
};

export type FullSiteTranslateHealthReport = {
  ok: boolean;
  byLang: Partial<Record<AppLocaleCode, FullSiteTranslateHealthItem>>;
};

/**
 * Provjera nakon "Prevedi sve": jesu li svi traženi tekstovi popunjeni za jezike osim HR.
 * Pravilo: ako je HR izvor popunjen, i ciljni jezik mora imati nepraznu vrijednost.
 */
export function runFullSiteTranslateHealthCheck(
  next: SiteSettings
): FullSiteTranslateHealthReport {
  const hrEff = effectiveHrBundle(next);
  const cats = categoryFieldsFromDraft(next);
  const byLang: Partial<Record<AppLocaleCode, FullSiteTranslateHealthItem>> = {};

  for (const lang of TARGET_LANGS) {
    const langEff = deepMergeLocale(
      structuredClone(BUNDLED_LOCALES[lang]),
      (next.localeOverrides[lang] ?? {}) as Record<string, unknown>
    );
    const item: FullSiteTranslateHealthItem = {
      localeMissing: 0,
      productMissing: 0,
      collectionMissing: 0,
    };

    for (const f of EDITOR_I18N_GROUPS.flatMap((g) => g.fields)) {
      if (f.kind === "lines") {
        const src = getAtSeg(hrEff, f.path);
        const out = getAtSeg(langEff, f.path);
        if (!Array.isArray(src)) continue;
        for (let i = 0; i < src.length; i++) {
          const s = String(src[i] ?? "").trim();
          if (!s) continue;
          const t =
            Array.isArray(out) && out[i] != null ? String(out[i]).trim() : "";
          if (!t || sameText(t, s)) item.localeMissing += 1;
        }
      } else {
        const s = String(getAtSeg(hrEff, f.path) ?? "").trim();
        if (!s) continue;
        const t = String(getAtSeg(langEff, f.path) ?? "").trim();
        if (!t || sameText(t, s)) item.localeMissing += 1;
      }
    }

    for (const cat of cats) {
      const s = String(getAtSeg(hrEff, cat.path) ?? "").trim();
      if (!s) continue;
      const t = String(getAtSeg(langEff, cat.path) ?? "").trim();
      if (!t || sameText(t, s)) item.localeMissing += 1;
    }

    for (const p of products) {
      const o = next.productOverrides[p.slug] ?? next.productOverrides[p.id] ?? null;
      const hrP = mergeProduct(p, o, "hr");
      const trP = mergeProduct(p, o, lang);
      if (hrP.title.trim() && (!trP.title.trim() || sameText(trP.title, hrP.title))) item.productMissing += 1;
      if (
        hrP.shortDescription.trim() &&
        (!trP.shortDescription.trim() || sameText(trP.shortDescription, hrP.shortDescription))
      ) {
        item.productMissing += 1;
      }
      if (hrP.description.trim() && (!trP.description.trim() || sameText(trP.description, hrP.description))) {
        item.productMissing += 1;
      }
    }

    for (const c of collections) {
      const o =
        next.collectionOverrides[c.slug] ?? next.collectionOverrides[c.id] ?? null;
      const hrC = mergeCollection(c, o, "hr");
      const trC = mergeCollection(c, o, lang);
      if (hrC.title.trim() && (!trC.title.trim() || sameText(trC.title, hrC.title))) {
        item.collectionMissing += 1;
      }
      if (
        hrC.description.trim() &&
        (!trC.description.trim() || sameText(trC.description, hrC.description))
      ) {
        item.collectionMissing += 1;
      }
    }

    byLang[lang] = item;
  }

  const ok = Object.values(byLang).every(
    (x) => (x?.localeMissing ?? 0) + (x?.productMissing ?? 0) + (x?.collectionMissing ?? 0) === 0
  );
  return { ok, byLang };
}
