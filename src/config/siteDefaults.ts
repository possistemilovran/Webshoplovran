import type { Collection, Product } from "@/data/types";
import { deepMergeLocale } from "@/lib/localeTree";
import { legacyDiskToHrOverrides, type LocaleBundle } from "./migrateLegacyLocale";

export type FontPreset = {
  label: string;
  /** Google Fonts API parametar; prazno = samo lokalno / sustav. */
  google: string;
  stack: string;
};

/** Google Fonts — isto kao na javnoj stranici. */
export const GOOGLE_FONT_PRESETS: Record<string, FontPreset> = {
  outfit: {
    label: "Outfit",
    google: "Outfit:wght@300;400;500;600",
    stack: '"Outfit",system-ui,sans-serif',
  },
  cormorant: {
    label: "Cormorant Garamond (Google)",
    google: "Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400",
    stack: '"Cormorant Garamond",Georgia,serif',
  },
  archivo: {
    label: "Archivo Narrow",
    google: "Archivo+Narrow:wght@400;500;600;700",
    stack: '"Archivo Narrow",Helvetica,Arial,sans-serif',
  },
  playfair: {
    label: "Playfair Display",
    google: "Playfair+Display:wght@400;600;700",
    stack: '"Playfair Display",Georgia,serif',
  },
  lora: {
    label: "Lora",
    google: "Lora:wght@400;500;600;700",
    stack: '"Lora",Georgia,serif',
  },
  inter: {
    label: "Inter",
    google: "Inter:wght@400;500;600",
    stack: '"Inter",system-ui,sans-serif',
  },
  dmSans: {
    label: "DM Sans",
    google: "DM+Sans:wght@400;500;600;700",
    stack: '"DM Sans",system-ui,sans-serif',
  },
  system: {
    label: "System (bez Google fonta)",
    google: "",
    stack: "system-ui,-apple-system,BlinkMacSystemFont,sans-serif",
  },
};

/**
 * Fontovi koji dolaze s Windowsom 10 (i tipično Office paketom) — nema @font-face
 * u projektu; preglednik koristi instalirani sustav. Na drugim OS-ima vrijede zamjene.
 */
export const WINDOWS_10_FONT_PRESETS: Record<string, FontPreset> = {
  winSegoeUI: {
    label: "Windows — Segoe UI",
    google: "",
    stack: '"Segoe UI","Segoe UI Symbol","Segoe UI Emoji",system-ui,sans-serif',
  },
  winSegoeUIVariable: {
    label: "Windows — Segoe UI Variable (10/11)",
    google: "",
    stack: '"Segoe UI Variable","Segoe UI",system-ui,sans-serif',
  },
  winCalibri: {
    label: "Windows — Calibri",
    google: "",
    stack: 'Calibri,"Segoe UI",sans-serif',
  },
  winCambria: {
    label: "Windows — Cambria",
    google: "",
    stack: 'Cambria,Georgia,serif',
  },
  winCandara: {
    label: "Windows — Candara",
    google: "",
    stack: 'Candara,"Segoe UI",sans-serif',
  },
  winConstantia: {
    label: "Windows — Constantia",
    google: "",
    stack: "Constantia,Georgia,serif",
  },
  winCorbel: {
    label: "Windows — Corbel",
    google: "",
    stack: 'Corbel,"Segoe UI",sans-serif',
  },
  winVerdana: {
    label: "Windows — Verdana",
    google: "",
    stack: "Verdana,Geneva,sans-serif",
  },
  winGeorgia: {
    label: "Windows — Georgia",
    google: "",
    stack: "Georgia,Times,serif",
  },
  winConsolas: {
    label: "Windows — Consolas (mono)",
    google: "",
    stack: 'Consolas,"Courier New",monospace',
  },
  winTrebuchet: {
    label: "Windows — Trebuchet MS",
    google: "",
    stack: '"Trebuchet MS",Helvetica,sans-serif',
  },
};

/**
 * Lokalni fontovi u public/fonts/site/ (kopija iz FONTOVI/). Za nove datoteke
 * kopiraj ih u tu mapu i dodaj @font-face + unos ovdje.
 */
export const LOCAL_PROJECT_FONT_PRESETS: Record<string, FontPreset> = {
  localCormorantGaramond: {
    label: "Cormorant Garamond (lokalno)",
    google: "",
    stack: 'OlivoLocalCormorantGaramond,"Cormorant Garamond",Georgia,serif',
  },
  localSpectral: {
    label: "Spectral (lokalno)",
    google: "",
    stack: 'OlivoLocalSpectral,"Spectral",Georgia,serif',
  },
  localBitter: {
    label: "Bitter (lokalno)",
    google: "",
    stack: 'OlivoLocalBitter,"Bitter",Georgia,serif',
  },
  localDosis: {
    label: "Dosis (lokalno)",
    google: "",
    stack: 'OlivoLocalDosis,"Dosis",system-ui,sans-serif',
  },
  localComfortaa: {
    label: "Comfortaa (lokalno)",
    google: "",
    stack: 'OlivoLocalComfortaa,"Comfortaa",system-ui,sans-serif',
  },
  localAndika: {
    label: "Andika (lokalno)",
    google: "",
    stack: 'OlivoLocalAndika,"Andika",system-ui,sans-serif',
  },
  localSansation: {
    label: "Sansation (lokalno)",
    google: "",
    stack: 'OlivoLocalSansation,"Sansation",system-ui,sans-serif',
  },
  localCrimson: {
    label: "Crimson (lokalno)",
    google: "",
    stack: 'OlivoLocalCrimson,"Crimson Text",Georgia,serif',
  },
  localUnna: {
    label: "Unna (lokalno)",
    google: "",
    stack: 'OlivoLocalUnna,Unna,Georgia,serif',
  },
  localJosefinSans: {
    label: "Josefin Sans (lokalno)",
    google: "",
    stack: 'OlivoLocalJosefinSans,"Josefin Sans",system-ui,sans-serif',
  },
  localEczar: {
    label: "Eczar (lokalno)",
    google: "",
    stack: 'OlivoLocalEczar,Eczar,Georgia,serif',
  },
  localCaudex: {
    label: "Caudex (lokalno)",
    google: "",
    stack: 'OlivoLocalCaudex,Caudex,Georgia,serif',
  },
  localOranienbaum: {
    label: "Oranienbaum (lokalno)",
    google: "",
    stack: 'OlivoLocalOranienbaum,Oranienbaum,Georgia,serif',
  },
  localMagra: {
    label: "Magra (lokalno)",
    google: "",
    stack: 'OlivoLocalMagra,Magra,system-ui,sans-serif',
  },
  localCaveat: {
    label: "Caveat (lokalno, bold)",
    google: "",
    stack: 'OlivoLocalCaveat,"Caveat",cursive,system-ui,sans-serif',
  },
  localEtchas: {
    label: "Etchas (lokalno)",
    google: "",
    stack: 'OlivoLocalEtchas,Etchas,Georgia,serif',
  },
  localFaitoRough: {
    label: "Faito Rough (lokalno)",
    google: "",
    stack: 'OlivoLocalFaitoRough,"Faito Rough",fantasy,serif',
  },
  localFoglihtenNo03: {
    label: "Foglihten No.03 (lokalno)",
    google: "",
    stack: 'OlivoLocalFoglihtenNo03,"Foglihten No 03",Georgia,serif',
  },
  localGreatVibes: {
    label: "Great Vibes (lokalno)",
    google: "",
    stack: 'OlivoLocalGreatVibes,"Great Vibes",cursive,serif',
  },
  localHopia: {
    label: "Hopia (lokalno)",
    google: "",
    stack: 'OlivoLocalHopia,Hopia,system-ui,sans-serif',
  },
  localImperiya: {
    label: "Imperiya (lokalno)",
    google: "",
    stack: 'OlivoLocalImperiya,Imperiya,Georgia,serif',
  },
  localItalianno: {
    label: "Italianno (lokalno)",
    google: "",
    stack: 'OlivoLocalItalianno,Italianno,cursive,serif',
  },
  localKalam: {
    label: "Kalam Light (lokalno)",
    google: "",
    stack: 'OlivoLocalKalam,"Kalam",system-ui,sans-serif',
  },
  localKaushanScript: {
    label: "Kaushan Script (lokalno)",
    google: "",
    stack: 'OlivoLocalKaushanScript,"Kaushan Script",cursive,serif',
  },
  localOstrichSans: {
    label: "Ostrich Sans Heavy (lokalno)",
    google: "",
    stack: 'OlivoLocalOstrichSans,"Ostrich Sans",Impact,system-ui,sans-serif',
  },
  localRostheroid: {
    label: "Rostheroid (lokalno)",
    google: "",
    stack: 'OlivoLocalRostheroid,Rostheroid,system-ui,sans-serif',
  },
  localTillana: {
    label: "Tillana Medium (lokalno)",
    google: "",
    stack: 'OlivoLocalTillana,Tillana,Georgia,serif',
  },
};

export const FONT_PRESET_GOOGLE_IDS = Object.keys(GOOGLE_FONT_PRESETS);
export const FONT_PRESET_WINDOWS_IDS = Object.keys(WINDOWS_10_FONT_PRESETS);
export const FONT_PRESET_LOCAL_IDS = Object.keys(LOCAL_PROJECT_FONT_PRESETS);

export const FONT_PRESETS: Record<string, FontPreset> = {
  ...GOOGLE_FONT_PRESETS,
  ...WINDOWS_10_FONT_PRESETS,
  ...LOCAL_PROJECT_FONT_PRESETS,
};

export type AppLocaleCode =
  | "hr"
  | "en"
  | "de"
  | "fr"
  | "it"
  | "sl"
  | "pl"
  | "cs";

/** Prijevodi naslova/opisa artikla iz arhive (ključ = kod jezika, ne hr). */
export type ProductCopyTranslations = {
  title?: string;
  shortDescription?: string;
  description?: string;
  /** Prevedeni oblik (slobodan tekst). Ako je set, <ProductSpecs> koristi
   *  direktno ovaj tekst bez runtime strojnog prijevoda. */
  shape?: string;
};

export type ProductOverride = {
  title?: string;
  shortDescription?: string;
  description?: string;
  price?: number;
  /** Glavna slika (kartica, prva u galeriji ako nema images). */
  image?: string;
  /** Galerija na stranici proizvoda; prva stavka = glavna slika. */
  images?: string[];
  /** Ne prikazuj u trgovini / kolekcijama / naslovnici (npr. nije za prodaju). */
  hideFromShop?: boolean;
  widthCm?: number;
  heightCm?: number;
  diameterCm?: number;
  shape?: string;
  /** Iz arhive: strojno generirani prijevodi HR tekstova. */
  translations?: Partial<Record<AppLocaleCode, ProductCopyTranslations>>;
};

/** Prijevodi naslova/opisa kolekcije (ključ = kod jezika, ne hr). */
export type CollectionCopyTranslations = {
  title?: string;
  description?: string;
};

export type CollectionOverride = {
  title?: string;
  description?: string;
  heroImage?: string;
  translations?: Partial<Record<AppLocaleCode, CollectionCopyTranslations>>;
};

export const DEFAULT_SHOP_SUBMENU: { slug: string; label: string }[] = [
  { slug: "stolne-lampe", label: "Stolne lampe" },
  { slug: "zdjele-za-voce", label: "Zdjele za voće" },
  { slug: "zdjelice-srednje", label: "Zdjelice srednje" },
  { slug: "zdjelice-male", label: "Zdjelice male" },
  { slug: "daske", label: "Daske" },
  { slug: "kuhace", label: "Kuhače" },
  { slug: "kuhinjski-pribor", label: "Kuhinjski pribor" },
  { slug: "kutijice", label: "Kutijice" },
  { slug: "svijecnjaci", label: "Svijećnjaci" },
  { slug: "stalci-za-case", label: "Stalci za čaše" },
  { slug: "satovi", label: "Satovi" },
  {
    slug: "pladnjevi-posluzavnici",
    label: "Pladnjevi i poslužavnici",
  },
  {
    slug: "ostalo-maslinovo",
    label: "Ostali unikatni predmeti od maslinovog drveta",
  },
];

export type { LocaleBundle };

/** Zadane putanje slideshowa na stranici „O nama” (`public/about-slideshow/`). */
export const DEFAULT_ABOUT_SLIDESHOW_URLS: readonly string[] = Array.from(
  { length: 12 },
  (_, i) => `/about-slideshow/slide-${i + 1}.png`
);

export const ABOUT_SLIDESHOW_COUNT = 12 as const;

export type SiteSettings = {
  announcement: {
    enabled: boolean;
    background: string;
    color: string;
    durationSec: number;
  };
  colors: {
    pageBackground: string;
    pageMuted: string;
    headerBackground: string;
    ink: string;
    inkMuted: string;
    accent: string;
    accentHover: string;
    line: string;
  };
  fonts: {
    headingPresetId: string;
    bodyPresetId: string;
    headerNavPresetId: string;
    headingFamilyOverride: string;
    bodyFamilyOverride: string;
    headerNavFamilyOverride: string;
  };
  textColors: {
    heroTitle: string;
    heroLede: string;
    eyebrow: string;
    sectionHeading: string;
  };
  images: {
    heroBackground: string;
    storyImage: string;
    logo: string;
    /** 12 URL-ova za slideshow ispod naslova „O nama” (red + nasumična šestorka). */
    aboutSlideshow: string[];
  };
  navigation: {
    shopSubmenu: { slug: string; label: string }[];
  };
  cart: {
    giftThreshold: number;
  };
  blog: {
    externalLinkLabel: string;
    externalUrl: string;
  };
  /** Nadjačavanja i18n JSON-a po jeziku (spaja se s ugrađenim prijevodima). */
  localeOverrides: Partial<Record<AppLocaleCode, LocaleBundle>>;
  productOverrides: Record<string, ProductOverride>;
  collectionOverrides: Record<string, CollectionOverride>;
  /**
   * Dodatna pripadnost kolekciji: slug artikla → id kolekcije iz kataloga.
   * Artikl ostaje u svojim JSON kolekcijama, ali se dodatno prikazuje u odabranoj grupi.
   */
  productCollectionAssignments: Record<string, string>;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  announcement: {
    enabled: true,
    background: "#2e2014",
    color: "#f3ece0",
    durationSec: 36,
  },
  colors: {
    pageBackground: "#f3ece0",
    pageMuted: "#e8dcc3",
    headerBackground: "#f3ece0",
    ink: "#4a3320",
    inkMuted: "#7a5330",
    accent: "#6b7d3a",
    accentHover: "#3f4a22",
    line: "#a87a4a",
  },
  fonts: {
    headingPresetId: "cormorant",
    bodyPresetId: "outfit",
    headerNavPresetId: "archivo",
    headingFamilyOverride: "",
    bodyFamilyOverride: "",
    headerNavFamilyOverride: "",
  },
  textColors: {
    heroTitle: "#4a3320",
    heroLede: "#7a5330",
    eyebrow: "#6b7d3a",
    sectionHeading: "#4a3320",
  },
  images: {
    heroBackground: "/brand/lun-hero.jpg",
    storyImage: "/brand/lun-story.jpg",
    logo: "/brand/logo-primjer7.png",
    aboutSlideshow: [...DEFAULT_ABOUT_SLIDESHOW_URLS],
  },
  navigation: {
    shopSubmenu: DEFAULT_SHOP_SUBMENU.map((x) => ({ ...x })),
  },
  cart: {
    giftThreshold: 150,
  },
  blog: {
    externalLinkLabel: "",
    externalUrl: "",
  },
  localeOverrides: {},
  productOverrides: {},
  collectionOverrides: {},
  productCollectionAssignments: {},
};

function asRecord(x: unknown): Record<string, unknown> | null {
  return x !== null && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : null;
}

/** Stari zadani logo (Unsplash iz predloška) — u localStorage ga zamjenjujemo ugrađenim. */
const LEGACY_TEMPLATE_LOGO_SUBSTRINGS = [
  "images.unsplash.com/photo-1604719312566-8912e9227c6e",
];

function resolveStoredLogoUrl(
  fromDisk: unknown,
  fallback: string
): string {
  if (typeof fromDisk !== "string" || !fromDisk.trim()) return fallback;
  const s = fromDisk.trim();
  if (LEGACY_TEMPLATE_LOGO_SUBSTRINGS.some((sub) => s.includes(sub))) {
    return fallback;
  }
  /* SVG logo uklonjen iz public/brand — stari localStorage još pokazuje na 404. */
  if (s === "/brand/logo-handmade-olive.svg") {
    return fallback;
  }
  return s;
}

/** Učitava postavke s diska (localStorage / uvoz), uključujući migraciju starog formata. */
export function hydrateSiteFromDisk(raw: unknown): SiteSettings {
  const disk = asRecord(raw) ?? {};
  const b = DEFAULT_SITE_SETTINGS;

  const legacyHr = legacyDiskToHrOverrides(disk);
  const userOv = asRecord(disk.localeOverrides) ?? {};
  const userHr = asRecord(userOv.hr) ?? {};
  const hrCombined = deepMergeLocale(legacyHr, userHr) as LocaleBundle;
  const localeOverrides: Partial<Record<AppLocaleCode, LocaleBundle>> = {};
  for (const code of Object.keys(userOv)) {
    if (code === "hr") continue;
    const v = userOv[code];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      localeOverrides[code as AppLocaleCode] = v as LocaleBundle;
    }
  }
  if (Object.keys(hrCombined).length > 0) localeOverrides.hr = hrCombined;

  const ann = asRecord(disk.announcement);
  const announcement: SiteSettings["announcement"] = {
    enabled: typeof ann?.enabled === "boolean" ? ann.enabled : b.announcement.enabled,
    background:
      typeof ann?.background === "string" ? ann.background : b.announcement.background,
    color: typeof ann?.color === "string" ? ann.color : b.announcement.color,
    durationSec:
      typeof ann?.durationSec === "number" && !Number.isNaN(ann.durationSec)
        ? ann.durationSec
        : b.announcement.durationSec,
  };

  const colors = { ...b.colors, ...asRecord(disk.colors) };
  const fonts = { ...b.fonts, ...asRecord(disk.fonts) };
  const textColors = { ...b.textColors, ...asRecord(disk.textColors) };
  const diskImages = asRecord(disk.images) ?? {};
  const rawSlides = diskImages.aboutSlideshow;
  const aboutSlideshow =
    Array.isArray(rawSlides) && rawSlides.length === 12
      ? (DEFAULT_ABOUT_SLIDESHOW_URLS as readonly string[]).map((def, i) => {
          const x = rawSlides[i];
          return typeof x === "string" && x.trim() !== "" ? x.trim() : def;
        })
      : [...DEFAULT_ABOUT_SLIDESHOW_URLS];
  const images = {
    ...b.images,
    ...diskImages,
    logo: resolveStoredLogoUrl(diskImages.logo, b.images.logo),
    aboutSlideshow,
  };

  const nav = asRecord(disk.navigation);
  const submenuRaw = nav?.shopSubmenu;
  const shopSubmenu = Array.isArray(submenuRaw)
    ? (submenuRaw as { slug?: string; label?: string }[])
        .filter((r) => r && typeof r.slug === "string")
        .map((r) => ({ slug: r.slug!, label: typeof r.label === "string" ? r.label : "" }))
    : b.navigation.shopSubmenu;

  const cartDisk = asRecord(disk.cart);
  const giftThreshold =
    typeof cartDisk?.giftThreshold === "number" && !Number.isNaN(cartDisk.giftThreshold)
      ? cartDisk.giftThreshold
      : b.cart.giftThreshold;

  const blogDisk = asRecord(disk.blog);
  const blog: SiteSettings["blog"] = {
    externalLinkLabel:
      typeof blogDisk?.externalLinkLabel === "string"
        ? blogDisk.externalLinkLabel
        : b.blog.externalLinkLabel,
    externalUrl:
      typeof blogDisk?.externalUrl === "string" ? blogDisk.externalUrl : b.blog.externalUrl,
  };

  const productOverrides = {
    ...b.productOverrides,
    ...(asRecord(disk.productOverrides) as SiteSettings["productOverrides"]),
  };
  const collectionOverrides = {
    ...b.collectionOverrides,
    ...(asRecord(disk.collectionOverrides) as SiteSettings["collectionOverrides"]),
  };

  const assignDisk = asRecord(disk.productCollectionAssignments);
  const productCollectionAssignments: Record<string, string> = {
    ...b.productCollectionAssignments,
  };
  if (assignDisk) {
    for (const [k, v] of Object.entries(assignDisk)) {
      if (typeof k === "string" && k.trim() && typeof v === "string" && v.trim()) {
        productCollectionAssignments[k.trim()] = v.trim();
      }
    }
  }

  return {
    announcement,
    colors: colors as SiteSettings["colors"],
    fonts: fonts as SiteSettings["fonts"],
    textColors: textColors as SiteSettings["textColors"],
    images: images as SiteSettings["images"],
    navigation: { shopSubmenu },
    cart: { giftThreshold },
    blog,
    localeOverrides,
    productOverrides,
    collectionOverrides,
    productCollectionAssignments,
  };
}

export const STORAGE_KEY = "radionica-lun-settings-v2-clean";

/**
 * Spaja arhivu (statički JSON) i lokalni nacrt (localStorage).
 * Ako se HR u nacrtu razlikuje od arhive, uklanjaju se samo naslijeđeni prijevodi iz arhive
 * kad u nacrtu nema vlastitih prijevoda — inače bi se obrisali i ručno/spremljeni prijevodi
 * (npr. EN nakon „Spremi promjene”).
 */
export function combineArchivedWithLocalProductOverride(
  archived: ProductOverride | null | undefined,
  local: ProductOverride | null | undefined
): ProductOverride | null {
  if (!archived && !local) return null;
  const a = { ...(archived ?? {}) } as ProductOverride;
  const l = { ...(local ?? {}) } as ProductOverride;
  const out: ProductOverride = { ...a, ...l };
  if (archived && local && hrProductOverrideDiffersFromArchived(l, a)) {
    const localTr = l.translations;
    const hasLocalTranslations =
      localTr != null &&
      typeof localTr === "object" &&
      !Array.isArray(localTr) &&
      Object.keys(localTr).length > 0;
    if (!hasLocalTranslations) {
      delete out.translations;
    }
  }
  return out;
}

function hrProductOverrideDiffersFromArchived(
  local: ProductOverride,
  archived: ProductOverride
): boolean {
  const diff = (x: unknown, y: unknown) =>
    String(x ?? "").trim() !== String(y ?? "").trim();
  if (local.title != null && diff(local.title, archived.title)) return true;
  if (
    local.shortDescription != null &&
    diff(local.shortDescription, archived.shortDescription)
  ) {
    return true;
  }
  if (local.description != null && diff(local.description, archived.description)) {
    return true;
  }
  return false;
}

function sameTrimmedText(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function stripProductTranslateFlags(p: Product): Product {
  const next = { ...p };
  delete next.skipMachineTranslateTitle;
  delete next.skipMachineTranslateShort;
  delete next.skipMachineTranslateDescription;
  delete next.skipMachineTranslateShape;
  return next;
}

export function mergeProduct(
  base: Product,
  o?: ProductOverride | null,
  displayLang?: string
): Product {
  if (!o) return stripProductTranslateFlags({ ...base });
  const lang = ((displayLang ?? "hr").split("-")[0] ?? "hr") as AppLocaleCode;
  const next = stripProductTranslateFlags({ ...base });

  const pickCopy = (
    field: "title" | "shortDescription" | "description",
    skipField:
      | "skipMachineTranslateTitle"
      | "skipMachineTranslateShort"
      | "skipMachineTranslateDescription"
  ) => {
    const fromTr =
      lang !== "hr" ? o.translations?.[lang]?.[field] : undefined;
    const hr = o[field];
    const hrSource = hr ?? base[field];
    const fromTrUsable =
      fromTr != null &&
      String(fromTr).trim() !== "" &&
      !(lang !== "hr" && sameTrimmedText(fromTr, hrSource));
    if (fromTrUsable) {
      next[field] = String(fromTr).trim();
      next[skipField] = true;
      return;
    }
    if (hr != null && String(hr).trim() !== "") {
      next[field] = String(hr).trim();
      next[skipField] = lang === "hr";
      return;
    }
    next[skipField] = lang === "hr";
  };

  pickCopy("title", "skipMachineTranslateTitle");
  pickCopy("shortDescription", "skipMachineTranslateShort");
  pickCopy("description", "skipMachineTranslateDescription");
  if (
    o.price != null &&
    !Number.isNaN(Number(o.price)) &&
    Number(o.price) >= 0
  ) {
    next.price = Number(o.price);
  }
  const galleryOverride =
    o.images != null && Array.isArray(o.images)
      ? o.images.map((s) => String(s).trim()).filter(Boolean)
      : null;
  if (galleryOverride != null && galleryOverride.length > 0) {
    next.images = galleryOverride;
    next.image = galleryOverride[0];
  } else if (o.image != null && String(o.image).trim() !== "") {
    const im = String(o.image).trim();
    next.image = im;
    next.images = [im];
  }
  if (o.widthCm !== undefined) {
    const w = Number(o.widthCm);
    if (!Number.isNaN(w) && w >= 0) next.widthCm = w;
  }
  if (o.heightCm !== undefined) {
    const h = Number(o.heightCm);
    if (!Number.isNaN(h) && h >= 0) next.heightCm = h;
  }
  if (o.diameterCm !== undefined) {
    const d = Number(o.diameterCm);
    if (!Number.isNaN(d) && d >= 0) next.diameterCm = d;
  }
  if (o.shape !== undefined) {
    const s = String(o.shape).trim();
    if (s) next.shape = s;
    else delete next.shape;
  }
  // Prevedeni oblik (npr. "round" za EN) ima prednost nad HR vrijednošću kad
  // prikazujemo stranicu na stranom jeziku. Flag javlja ProductSpecs da ne
  // poziva runtime strojni prijevod.
  if (lang !== "hr") {
    const trShape = o.translations?.[lang]?.shape;
    if (trShape != null) {
      const ts = String(trShape).trim();
      const hrSource = next.shape ?? "";
      if (ts && !sameTrimmedText(ts, hrSource)) {
        next.shape = ts;
        next.skipMachineTranslateShape = true;
      }
    }
  } else {
    next.skipMachineTranslateShape = true;
  }
  return next;
}

function stripCollectionTranslateFlags(c: Collection): Collection {
  const n = { ...c };
  delete n.skipMachineTranslateTitle;
  delete n.skipMachineTranslateDescription;
  return n;
}

export function mergeCollection(
  base: Collection,
  o?: CollectionOverride | null,
  displayLang?: string
): Collection {
  if (!o) return stripCollectionTranslateFlags({ ...base });
  const lang = ((displayLang ?? "hr").split("-")[0] ?? "hr") as AppLocaleCode;
  const next = stripCollectionTranslateFlags({ ...base });

  const pickTitle = () => {
    const fromTr =
      lang !== "hr" ? o.translations?.[lang]?.title : undefined;
    const hrSource = o.title ?? base.title;
    const fromTrUsable =
      fromTr != null &&
      String(fromTr).trim() !== "" &&
      !(lang !== "hr" && sameTrimmedText(fromTr, hrSource));
    if (fromTrUsable) {
      next.title = String(fromTr).trim();
      next.skipMachineTranslateTitle = true;
      return;
    }
    const hr = o.title;
    if (hr != null && String(hr).trim() !== "") {
      next.title = String(hr).trim();
      next.skipMachineTranslateTitle = lang === "hr";
      return;
    }
    next.skipMachineTranslateTitle = lang === "hr";
  };

  const pickDescription = () => {
    const fromTr =
      lang !== "hr" ? o.translations?.[lang]?.description : undefined;
    const hrSource = o.description ?? base.description;
    const fromTrUsable =
      fromTr != null &&
      String(fromTr).trim() !== "" &&
      !(lang !== "hr" && sameTrimmedText(fromTr, hrSource));
    if (fromTrUsable) {
      next.description = String(fromTr).trim();
      next.skipMachineTranslateDescription = true;
      return;
    }
    if (o.description !== undefined) {
      next.description = String(o.description);
      next.skipMachineTranslateDescription = lang === "hr";
      return;
    }
    next.skipMachineTranslateDescription = lang === "hr";
  };

  pickTitle();
  pickDescription();
  if (o.heroImage != null && String(o.heroImage).trim() !== "") {
    next.heroImage = String(o.heroImage).trim();
  }
  return next;
}

export function resolveFontStack(
  presetId: string,
  override: string
): string {
  const t = override.trim();
  if (t) return t;
  return FONT_PRESETS[presetId]?.stack ?? FONT_PRESETS.system.stack;
}

function mergeLocaleOverrideMaps(
  a: Partial<Record<AppLocaleCode, LocaleBundle>>,
  b: Partial<Record<AppLocaleCode, LocaleBundle>> | undefined
): Partial<Record<AppLocaleCode, LocaleBundle>> {
  if (!b) return { ...a };
  const out: Partial<Record<AppLocaleCode, LocaleBundle>> = { ...a };
  for (const code of Object.keys(b) as AppLocaleCode[]) {
    const p = b[code];
    if (!p || typeof p !== "object") continue;
    const prev = out[code] ?? {};
    out[code] = deepMergeLocale(prev, p as Record<string, unknown>) as LocaleBundle;
  }
  return out;
}

export function deepMergeSite(
  base: SiteSettings,
  patch: Partial<SiteSettings> | null | undefined
): SiteSettings {
  if (!patch) return structuredClone(base);
  return {
    announcement: { ...base.announcement, ...(patch.announcement ?? {}) },
    colors: { ...base.colors, ...(patch.colors ?? {}) },
    fonts: { ...base.fonts, ...(patch.fonts ?? {}) },
    textColors: { ...base.textColors, ...(patch.textColors ?? {}) },
    images: { ...base.images, ...(patch.images ?? {}) },
    navigation: {
      ...base.navigation,
      ...(patch.navigation ?? {}),
      shopSubmenu:
        patch.navigation?.shopSubmenu ?? base.navigation.shopSubmenu,
    },
    cart: { ...base.cart, ...(patch.cart ?? {}) },
    blog: { ...base.blog, ...(patch.blog ?? {}) },
    localeOverrides: mergeLocaleOverrideMaps(
      base.localeOverrides ?? {},
      patch.localeOverrides
    ),
    productOverrides: {
      ...base.productOverrides,
      ...(patch.productOverrides ?? {}),
    },
    collectionOverrides: {
      ...base.collectionOverrides,
      ...(patch.collectionOverrides ?? {}),
    },
    productCollectionAssignments: {
      ...base.productCollectionAssignments,
      ...(patch.productCollectionAssignments ?? {}),
    },
  };
}
