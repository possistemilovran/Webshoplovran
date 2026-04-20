import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { collections, products } from "@/data/catalog";
import { mergeProduct, type SiteSettings } from "@/config/siteDefaults";
import { EditorImagePicker, type EditorMediaEntry } from "@/editor/EditorImagePicker";
import { EditorImageStudio } from "@/editor/EditorImageStudio";
import { EditorShopSubmenuManager } from "@/editor/EditorShopSubmenuManager";
import { matchesEditorSectionQuery } from "@/lib/editorSearch";
import { refreshArchivedProductOverrides } from "@/hooks/useResolvedCatalog";
import { slugifyProductSlug } from "@/lib/slugifyProduct";
import { suggestNextKomadSlugForCollection } from "@/lib/suggestKomadProductSlug";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="editor-field">
      <span className="editor-field__label">{label}</span>
      {children}
    </label>
  );
}

type Props = {
  draft: SiteSettings;
  setDraft: Dispatch<SetStateAction<SiteSettings>>;
  searchQuery?: string;
  /** Slike iz kataloga (Shopify / lokalno) za padajući izbornik */
  catalogPickerItems?: EditorMediaEntry[];
  /** Logo, uploadi i ostalo iz media-library.json (bez duplikata iz kataloga) */
  filePickerItems?: EditorMediaEntry[];
  onMediaLibraryRefresh?: () => void;
  /** Odmah spremi cijeli nacrt u localStorage (npr. nakon arhive da se ukloni nadjačavanje). */
  onPersistSettings?: (next: SiteSettings) => void;
};

type ProductImageSlots = {
  main: string;
  extra1: string;
  extra2: string;
  extra3: string;
  extra4: string;
};

const emptyProductImages = (): ProductImageSlots => ({
  main: "",
  extra1: "",
  extra2: "",
  extra3: "",
  extra4: "",
});

function parseCmField(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t.replace(",", "."));
  if (Number.isNaN(n) || n < 0) return undefined;
  return n;
}

type ProductOv = SiteSettings["productOverrides"][string];

function assignDimensionsToOverride(
  o: ProductOv,
  width: string,
  height: string,
  diameter: string,
  shape: string
) {
  const w = parseCmField(width);
  if (w !== undefined) o.widthCm = w;
  else delete o.widthCm;
  const h = parseCmField(height);
  if (h !== undefined) o.heightCm = h;
  else delete o.heightCm;
  const d = parseCmField(diameter);
  if (d !== undefined) o.diameterCm = d;
  else delete o.diameterCm;
  const s = shape.trim();
  if (s) o.shape = s;
  else delete o.shape;
}

export function EditorAdvanced({
  draft,
  setDraft,
  searchQuery = "",
  catalogPickerItems = [],
  filePickerItems = [],
  onMediaLibraryRefresh,
  onPersistSettings,
}: Props) {
  const slugOptions = useMemo(() => products.map((p) => p.slug).sort(), []);
  const collSlugs = useMemo(() => collections.map((c) => c.slug).sort(), []);

  /** Grupe iz padajućeg izbornika trgovine → kolekcija u katalogu (ili sve kolekcije ako izbornik nije popunjen). */
  const submenuCollectionChoices = useMemo(() => {
    const rows = draft.navigation.shopSubmenu;
    const out: { collectionId: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const slug = row.slug?.trim();
      if (!slug) continue;
      const col = collections.find((c) => c.slug === slug);
      if (!col) continue;
      if (seen.has(col.id)) continue;
      seen.add(col.id);
      const label = row.label?.trim() || col.title;
      out.push({ collectionId: col.id, label: `${label} (${col.slug})` });
    }
    if (out.length === 0) {
      return collections.map((c) => ({
        collectionId: c.id,
        label: `${c.title} (${c.slug})`,
      }));
    }
    return out;
  }, [draft.navigation.shopSubmenu]);

  const slugInputRef = useRef<HTMLInputElement>(null);
  const slugSelectRef = useRef<HTMLSelectElement>(null);

  const [poSlug, setPoSlug] = useState("");
  const [poTitle, setPoTitle] = useState("");
  const [poShort, setPoShort] = useState("");
  const [poDesc, setPoDesc] = useState("");
  const [poPrice, setPoPrice] = useState("");
  const [poHideFromShop, setPoHideFromShop] = useState(false);
  const [poWidthCm, setPoWidthCm] = useState("");
  const [poHeightCm, setPoHeightCm] = useState("");
  const [poDiameterCm, setPoDiameterCm] = useState("");
  const [poShape, setPoShape] = useState("");
  const [poImages, setPoImages] = useState<ProductImageSlots>(emptyProductImages);

  const [assignSlug, setAssignSlug] = useState("");
  const [assignCollectionId, setAssignCollectionId] = useState("");

  const [coSlug, setCoSlug] = useState("");
  const [coTitle, setCoTitle] = useState("");
  const [coDesc, setCoDesc] = useState("");
  const [coHero, setCoHero] = useState("");

  /** Poruke uz nadjačavanje proizvoda (reset / primijeni / studio). */
  const [productOverrideInfo, setProductOverrideInfo] = useState<string | null>(
    null
  );

  const [collectionUploadInfo, setCollectionUploadInfo] = useState<
    string | null
  >(null);

  const [archivingSlug, setArchivingSlug] = useState(false);

  const [newProductCollectionId, setNewProductCollectionId] = useState("");
  const [newProductTitle, setNewProductTitle] = useState("");
  const [newProductSlugManual, setNewProductSlugManual] = useState("");
  const [creatingCatalogProduct, setCreatingCatalogProduct] = useState(false);

  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [newCollectionSlugManual, setNewCollectionSlugManual] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [newCollectionAddToSubmenu, setNewCollectionAddToSubmenu] =
    useState(true);
  const [creatingCatalogCollection, setCreatingCatalogCollection] =
    useState(false);

  useEffect(() => {
    const cid = newProductCollectionId.trim();
    if (!cid) return;
    const col = collections.find((c) => c.id === cid);
    if (!col) return;
    const overrideSlugs = Object.keys(draft.productOverrides);
    const assignSlugs = Object.keys(draft.productCollectionAssignments);
    const extraSlugs = [...new Set([...overrideSlugs, ...assignSlugs])];
    const { slug: suggestedSlug, nextIndex } = suggestNextKomadSlugForCollection(
      col.slug,
      products,
      extraSlugs
    );
    setNewProductSlugManual(suggestedSlug);
    setNewProductTitle((prev) => {
      if (prev.trim()) return prev;
      return `${col.title} komad ${nextIndex}`;
    });
  }, [newProductCollectionId]);

  useEffect(() => {
    if (!productOverrideInfo) return;
    const id = window.setTimeout(() => setProductOverrideInfo(null), 7000);
    return () => window.clearTimeout(id);
  }, [productOverrideInfo]);

  useEffect(() => {
    if (!collectionUploadInfo) return;
    const id = window.setTimeout(() => setCollectionUploadInfo(null), 7000);
    return () => window.clearTimeout(id);
  }, [collectionUploadInfo]);

  const productSlugKey = poSlug.trim();
  const productOverrideForSlug = productSlugKey
    ? draft.productOverrides[productSlugKey]
    : undefined;

  const filteredProductSlugs = useMemo(() => {
    const p = productSlugKey.toLowerCase();
    if (!p) return slugOptions;
    return slugOptions.filter((s) => s.toLowerCase().startsWith(p));
  }, [slugOptions, productSlugKey]);

  const slugSelectValue = slugOptions.includes(productSlugKey)
    ? productSlugKey
    : "";

  /** Kad se promijeni slug (ili nacrt nadjačavanja za taj slug), forma prikazuje spoj kataloga i nacrta (HR). */
  useEffect(() => {
    if (!productSlugKey) {
      setPoImages(emptyProductImages());
      setPoHideFromShop(false);
      setPoTitle("");
      setPoShort("");
      setPoDesc("");
      setPoPrice("");
      setPoWidthCm("");
      setPoHeightCm("");
      setPoDiameterCm("");
      setPoShape("");
      return;
    }

    const base = products.find((p) => p.slug === productSlugKey);
    const o = productOverrideForSlug;

    if (!base) {
      setPoHideFromShop(Boolean(o?.hideFromShop));
      setPoTitle(o?.title != null ? String(o.title) : "");
      setPoShort(
        o?.shortDescription != null ? String(o.shortDescription) : ""
      );
      setPoDesc(o?.description != null ? String(o.description) : "");
      const op = o?.price;
      setPoPrice(
        op != null &&
          !Number.isNaN(Number(op)) &&
          Number(op) >= 0
          ? String(op)
          : ""
      );
      const imgs =
        o?.images != null && Array.isArray(o.images) && o.images.length > 0
          ? o.images.map((s) => String(s).trim()).filter(Boolean)
          : o?.image != null && String(o.image).trim() !== ""
            ? [String(o.image).trim()]
            : [];
      setPoImages({
        main: imgs[0] ?? "",
        extra1: imgs[1] ?? "",
        extra2: imgs[2] ?? "",
        extra3: imgs[3] ?? "",
        extra4: imgs[4] ?? "",
      });
      const w = o?.widthCm;
      setPoWidthCm(
        w != null && !Number.isNaN(Number(w)) && Number(w) > 0
          ? String(w)
          : ""
      );
      const h = o?.heightCm;
      setPoHeightCm(
        h != null && !Number.isNaN(Number(h)) && Number(h) > 0
          ? String(h)
          : ""
      );
      const d = o?.diameterCm;
      setPoDiameterCm(
        d != null && !Number.isNaN(Number(d)) && Number(d) > 0
          ? String(d)
          : ""
      );
      setPoShape(o?.shape != null ? String(o.shape).trim() : "");
      return;
    }

    const m = mergeProduct(base, o ?? null, "hr");
    setPoHideFromShop(Boolean(o?.hideFromShop));
    setPoTitle(m.title ?? "");
    setPoShort(m.shortDescription ?? "");
    setPoDesc(m.description ?? "");
    const mp = m.price;
    setPoPrice(
      mp != null && !Number.isNaN(Number(mp)) && Number(mp) >= 0
        ? String(mp)
        : ""
    );

    const imgs =
      m.images != null && m.images.length > 0
        ? m.images.map((s) => String(s).trim()).filter(Boolean)
        : m.image != null && String(m.image).trim() !== ""
          ? [String(m.image).trim()]
          : [];
    setPoImages({
      main: imgs[0] ?? "",
      extra1: imgs[1] ?? "",
      extra2: imgs[2] ?? "",
      extra3: imgs[3] ?? "",
      extra4: imgs[4] ?? "",
    });

    setPoWidthCm(
      m.widthCm != null && m.widthCm > 0 ? String(m.widthCm) : ""
    );
    setPoHeightCm(
      m.heightCm != null && m.heightCm > 0 ? String(m.heightCm) : ""
    );
    setPoDiameterCm(
      m.diameterCm != null && m.diameterCm > 0 ? String(m.diameterCm) : ""
    );
    setPoShape(m.shape?.trim() ?? "");
  }, [productSlugKey, productOverrideForSlug]);

  const setPoImageSlot = (key: keyof ProductImageSlots, value: string) => {
    setPoImages((p) => ({ ...p, [key]: value }));
  };

  const pushStudioUrlToNextSlot = (u: string) => {
    setPoImages((p) => {
      if (!p.main.trim()) return { ...p, main: u };
      if (!p.extra1.trim()) return { ...p, extra1: u };
      if (!p.extra2.trim()) return { ...p, extra2: u };
      if (!p.extra3.trim()) return { ...p, extra3: u };
      return { ...p, extra4: u };
    });
  };

  const buildCurrentOverridePayload = (): Record<string, unknown> => {
    const main = poImages.main.trim();
    const extras = [
      poImages.extra1,
      poImages.extra2,
      poImages.extra3,
      poImages.extra4,
    ]
      .map((s) => s.trim())
      .filter(Boolean);
    const galleryLines = main ? [main, ...extras] : extras;
    const o: Record<string, unknown> = {};
    if (poTitle.trim()) o.title = poTitle.trim();
    if (poShort.trim()) o.shortDescription = poShort.trim();
    if (poDesc.trim()) o.description = poDesc.trim();
    if (poPrice.trim() !== "" && !Number.isNaN(Number(poPrice))) {
      o.price = Number(poPrice);
    }
    if (galleryLines.length > 0) {
      o.images = galleryLines;
      o.image = galleryLines[0];
    }
    if (poHideFromShop) o.hideFromShop = true;
    const cw = parseCmField(poWidthCm);
    if (cw !== undefined) o.widthCm = cw;
    const ch = parseCmField(poHeightCm);
    if (ch !== undefined) o.heightCm = ch;
    const cd = parseCmField(poDiameterCm);
    if (cd !== undefined) o.diameterCm = cd;
    const sh = poShape.trim();
    if (sh) o.shape = sh;
    return o;
  };

  const archiveProductSlug = async () => {
    const slug = poSlug.trim();
    if (!slug) {
      setProductOverrideInfo("Upišite slug prije arhiviranja.");
      return;
    }
    const payload = buildCurrentOverridePayload();
    if (Object.keys(payload).length === 0) {
      setProductOverrideInfo(
        "Nema što arhivirati — unesite barem naslov, opis, cijenu, sliku ili mjere (širina / visina / promjer / oblik)."
      );
      return;
    }

    if (import.meta.env.DEV) {
      setArchivingSlug(true);
      try {
        const r = await fetch("/__editor__/archive-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, override: payload }),
        });
        const j = (await r.json()) as { ok?: boolean; error?: string };
        if (!r.ok || !j.ok) {
          throw new Error(j.error ?? "Arhiva nije uspjela.");
        }
        const nextOv = { ...draft.productOverrides };
        delete nextOv[slug];
        const newDraft = { ...draft, productOverrides: nextOv };
        setDraft(newDraft);
        onPersistSettings?.(newDraft);
        setPoSlug("");
        setPoTitle("");
        setPoShort("");
        setPoDesc("");
        setPoPrice("");
        setPoHideFromShop(false);
        setPoWidthCm("");
        setPoHeightCm("");
        setPoDiameterCm("");
        setPoShape("");
        setPoImages(emptyProductImages());
        onMediaLibraryRefresh?.();
        refreshArchivedProductOverrides();
        setProductOverrideInfo(
          `Arhiva „${slug}” zapisana u public/editor-archived-overrides.json; data URL slike su u public/uploads/. Forma je očišćena za sljedeći artikl.`
        );
      } catch (e) {
        setProductOverrideInfo(
          e instanceof Error ? e.message : "Arhiviranje nije uspjelo."
        );
      } finally {
        setArchivingSlug(false);
      }
    } else {
      const bundle = { version: 1, overrides: { [slug]: payload } };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `arhiva-artikl-${slug}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setProductOverrideInfo(
        "Preuzeli ste JSON snippeta. U produkciji ga spojite u public/editor-archived-overrides.json ili koristite npm run dev za zapis na disk."
      );
    }
  };

  const newProductSlugPreview = useMemo(() => {
    const manual = newProductSlugManual.trim();
    const from = manual
      ? slugifyProductSlug(manual)
      : slugifyProductSlug(newProductTitle);
    return from || "";
  }, [newProductSlugManual, newProductTitle]);

  const createNewCatalogProduct = async () => {
    if (!newProductCollectionId.trim()) {
      setProductOverrideInfo("Odaberite grupu u padajućem izborniku trgovine.");
      return;
    }
    if (!newProductSlugPreview || newProductSlugPreview.length < 2) {
      setProductOverrideInfo(
        "Upišite naslov artikla ili slug (barem 2 znaka u konačnom slug-u)."
      );
      return;
    }
    if (!import.meta.env.DEV) {
      setProductOverrideInfo(
        "Dodavanje artikla u storeCatalog.json radi samo uz npm run dev. Pokrenite dev poslužitelj i pokušajte ponovno."
      );
      return;
    }
    setCreatingCatalogProduct(true);
    try {
      const r = await fetch("/__editor__/create-catalog-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId: newProductCollectionId.trim(),
          title: newProductTitle.trim(),
          slug: newProductSlugManual.trim() || undefined,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; slug?: string };
      if (!r.ok || !j.ok) {
        throw new Error(j.error ?? "Kreiranje artikla nije uspjelo.");
      }
      setProductOverrideInfo(
        `Artikl „${j.slug ?? newProductSlugPreview}” dodan u src/data/storeCatalog.json. Stranica se osvježava…`
      );
      window.setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch (e) {
      setCreatingCatalogProduct(false);
      setProductOverrideInfo(
        e instanceof Error ? e.message : "Kreiranje artikla nije uspjelo."
      );
    }
  };

  const newCollectionSlugPreview = useMemo(() => {
    const manual = newCollectionSlugManual.trim();
    const from = manual
      ? slugifyProductSlug(manual)
      : slugifyProductSlug(newCollectionTitle);
    return from || "";
  }, [newCollectionSlugManual, newCollectionTitle]);

  const createNewCatalogCollection = async () => {
    if (!newCollectionSlugPreview || newCollectionSlugPreview.length < 2) {
      setCollectionUploadInfo(
        "Upišite naslov kolekcije ili slug (barem 2 znaka u konačnom slug-u)."
      );
      return;
    }
    if (!import.meta.env.DEV) {
      setCollectionUploadInfo(
        "Dodavanje kolekcije u storeCatalog.json radi samo uz npm run dev."
      );
      return;
    }
    setCreatingCatalogCollection(true);
    try {
      const r = await fetch("/__editor__/create-catalog-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newCollectionTitle.trim(),
          slug: newCollectionSlugManual.trim() || undefined,
          description: newCollectionDesc.trim(),
        }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        slug?: string;
        title?: string;
      };
      if (!r.ok || !j.ok) {
        throw new Error(j.error ?? "Kreiranje kolekcije nije uspjelo.");
      }
      const createdSlug = String(j.slug ?? newCollectionSlugPreview).trim();
      const createdTitle =
        String(j.title ?? "").trim() ||
        newCollectionTitle.trim() ||
        createdSlug;

      let nextDraft = draft;
      if (newCollectionAddToSubmenu && createdSlug) {
        const submenu = draft.navigation.shopSubmenu;
        const exists = submenu.some(
          (row) => row.slug.trim() === createdSlug
        );
        if (!exists) {
          nextDraft = {
            ...draft,
            navigation: {
              ...draft.navigation,
              shopSubmenu: [
                ...submenu,
                { slug: createdSlug, label: createdTitle },
              ],
            },
          };
          setDraft(nextDraft);
          onPersistSettings?.(nextDraft);
        }
      }

      setCollectionUploadInfo(
        `Kolekcija „${createdTitle}” (${createdSlug}) zapisana u src/data/storeCatalog.json.${
          newCollectionAddToSubmenu
            ? " Dodana je stavka u padajući izbornik (nacrt spremljen)."
            : ""
        } Stranica se osvježava…`
      );
      window.setTimeout(() => {
        window.location.reload();
      }, 450);
    } catch (e) {
      setCreatingCatalogCollection(false);
      setCollectionUploadInfo(
        e instanceof Error ? e.message : "Kreiranje kolekcije nije uspjelo."
      );
    }
  };

  const applyProductOverride = () => {
    const slug = poSlug.trim();
    if (!slug) return;
    const main = poImages.main.trim();
    const extras = [
      poImages.extra1,
      poImages.extra2,
      poImages.extra3,
      poImages.extra4,
    ]
      .map((s) => s.trim())
      .filter(Boolean);
    const galleryLines = main ? [main, ...extras] : extras;
    const hadImages = galleryLines.length > 0;

    setDraft((d) => {
      const prev = d.productOverrides[slug] ?? {};
      const o: SiteSettings["productOverrides"][string] = { ...prev };
      if (poTitle.trim()) o.title = poTitle.trim();
      if (poShort.trim()) o.shortDescription = poShort.trim();
      if (poDesc.trim()) o.description = poDesc.trim();
      if (poPrice.trim() !== "" && !Number.isNaN(Number(poPrice))) {
        o.price = Number(poPrice);
      }
      if (galleryLines.length > 0) {
        o.images = galleryLines;
        o.image = galleryLines[0];
      } else {
        delete o.images;
        delete o.image;
      }
      if (poHideFromShop) {
        o.hideFromShop = true;
      } else {
        delete o.hideFromShop;
      }
      assignDimensionsToOverride(o, poWidthCm, poHeightCm, poDiameterCm, poShape);
      return {
        ...d,
        productOverrides: { ...d.productOverrides, [slug]: o },
      };
    });

    if (hadImages) {
      setProductOverrideInfo(
        `Slike za artikl „${slug}” primijenjene u trgovinu (nadjačavanje). Spremite promjene u zaglavlju urednika da ostane trajno.`
      );
    } else if (poHideFromShop) {
      setProductOverrideInfo(
        `Artikl „${slug}” označen kao skriven u trgovini (ili ostaje skriven bez pravih slika). Spremite promjene u zaglavlju.`
      );
    } else {
      setProductOverrideInfo(
        `Postavke za „${slug}” ažurirane (bez slika u nadjačavanju). Spremite promjene u zaglavlju ako treba.`
      );
    }
  };

  const resetProductImagesForSlug = () => {
    const slug = poSlug.trim();
    if (!slug) {
      setProductOverrideInfo("Upišite slug proizvoda prije reseta slika.");
      return;
    }
    const hadStoredImages =
      Boolean(productOverrideForSlug?.image?.trim()) ||
      (productOverrideForSlug?.images?.length ?? 0) > 0;

    setDraft((d) => {
      const prev = d.productOverrides[slug];
      if (!prev) {
        return d;
      }
      const o = { ...prev };
      delete o.image;
      delete o.images;
      const hasOther =
        (o.title != null && String(o.title).trim() !== "") ||
        (o.shortDescription != null &&
          String(o.shortDescription).trim() !== "") ||
        (o.description != null && String(o.description).trim() !== "") ||
        (o.price != null &&
          !Number.isNaN(Number(o.price)) &&
          Number(o.price) >= 0) ||
        o.hideFromShop === true ||
        (o.widthCm !== undefined && !Number.isNaN(Number(o.widthCm))) ||
        (o.heightCm !== undefined && !Number.isNaN(Number(o.heightCm))) ||
        (o.diameterCm !== undefined && !Number.isNaN(Number(o.diameterCm))) ||
        (o.shape != null && String(o.shape).trim() !== "");
      if (!hasOther) {
        const next = { ...d.productOverrides };
        delete next[slug];
        return { ...d, productOverrides: next };
      }
      return {
        ...d,
        productOverrides: { ...d.productOverrides, [slug]: o },
      };
    });
    setPoImages(emptyProductImages());

    if (hadStoredImages) {
      setProductOverrideInfo(
        `Slike za artikl „${slug}” uspješno uklonjene iz nadjačavanja. U trgovini će se koristiti prazne slike iz kataloga dok ne dodate nove. Spremite promjene u zaglavlju.`
      );
    } else {
      setProductOverrideInfo(
        `Za „${slug}” nije bilo spremljenih slika u nadjačavanju — polja su očišćena.`
      );
    }
  };

  const onProductImageUrlFromStudio = (url: string) => {
    setPoImageSlot("main", url);
    const slug = poSlug.trim();
    if (!slug) {
      setProductOverrideInfo(
        "Slika je umetnuta u glavno polje. Upišite slug i kliknite „Primijeni na slug”, zatim „Spremi promjene”."
      );
      return;
    }
    if (url.startsWith("/uploads/")) {
      setProductOverrideInfo(
        `Slika za „${slug}” zapisana u projekt (${url}). Kliknite „Primijeni na slug”, zatim „Spremi promjene” u zaglavlju.`
      );
    } else if (url.startsWith("data:")) {
      setProductOverrideInfo(
        `Slika za „${slug}” umetnuta kao data URL u polje. Kliknite „Primijeni na slug” i razmislite o uploadu u /uploads/ ako je datoteka velika.`
      );
    } else {
      setProductOverrideInfo(
        `Putanja slike za „${slug}” postavljena u polje. Kliknite „Primijeni na slug”, zatim „Spremi promjene”.`
      );
    }
  };

  const removeProductOverride = (slug: string) => {
    setDraft((d) => {
      const next = { ...d.productOverrides };
      delete next[slug];
      return { ...d, productOverrides: next };
    });
  };

  const applyCollectionOverride = () => {
    const slug = coSlug.trim();
    if (!slug) return;
    setDraft((d) => {
      const prev = d.collectionOverrides[slug] ?? {};
      const o: SiteSettings["collectionOverrides"][string] = { ...prev };
      if (coTitle.trim()) o.title = coTitle.trim();
      if (coDesc.trim()) o.description = coDesc.trim();
      if (coHero.trim()) o.heroImage = coHero.trim();
      return {
        ...d,
        collectionOverrides: { ...d.collectionOverrides, [slug]: o },
      };
    });
  };

  const removeCollectionOverride = (slug: string) => {
    setDraft((d) => {
      const next = { ...d.collectionOverrides };
      delete next[slug];
      return { ...d, collectionOverrides: next };
    });
  };

  const nav = draft.navigation;
  const cart = draft.cart;
  const blog = draft.blog;

  const q = searchQuery;

  return (
    <>
      {matchesEditorSectionQuery(
        q,
        "nadjačavanje proizvoda naslov opis cijena slug katalog product override artikl slika slike galerija fotografija studio obrada kompresija resize upload sakrij trgovina vidljivost rasprodano hide arhiva arhiviraj workspace radni prostor širina visina promjer oblik mjere cm inch dimenzije novi kreiraj dodaj katalog izbornik grupa kolekcija uredi postojeći prepravka uredi artikl"
      ) && (
      <section className="editor-card editor-card--wide">
        <h2>Radni prostor artikla — slug, tekstovi i slike</h2>
        <p className="editor-hint">
          Jedan vertikalni tok: prvo <strong>slug</strong>, zatim <strong>tekstovi</strong>, zatim{" "}
          <strong>slike</strong>. <strong>Primijeni na slug</strong> sprema u nacrt (localStorage nakon
          „Spremi promjene”). <strong>Arhiviraj slug</strong> (samo uz <code>npm run dev</code>) zapisuje
          tekstove i slike u <code>public/editor-archived-overrides.json</code> i{" "}
          <code>public/uploads/</code> (data URL se pretvara u datoteke), briše ovaj artikl iz nacrta i
          čisti formu za sljedeći unos zaredom. Arhiva se učitava u trgovinu prije lokalnog nacrta.
          Artikli bez pravih slika / rasprodani / sakriveni ne prikazuju se u mreži.
        </p>
        <div className="editor-product-workspace">
          <div
            className="editor-card__group"
            id="editor-uredi-postojeci-artikl"
          >
            <h3 className="editor-card__group-title">Uredi postojeći artikl</h3>
            <p className="editor-hint editor-hint--inline">
              Upišite ili odaberite <strong>točan slug</strong> — polja ispod pune se iz{" "}
              <strong>kataloga</strong> i vašeg <strong>nacrta</strong> (nadjačavanje). Zatim prilagodite
              tekstove, mjere i slike te kliknite <strong>Primijeni na slug</strong>.
            </p>
            <h4 className="editor-card__group-title">Slug artikla</h4>
          <div className="editor-slug-pick">
            <label className="editor-slug-pick__field">
              <span className="editor-field__label">Slug proizvoda (unos sužava popis)</span>
              <input
                ref={slugInputRef}
                className="editor-input"
                placeholder="Npr. ku… pa Tab ili ↓ za padajući popis"
                value={poSlug}
                onChange={(e) => setPoSlug(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    slugSelectRef.current?.focus();
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="editor-slug-pick__field">
              <span className="editor-field__label visually-hidden">
                Odabir slug-a iz suženog popisa (Tab s polja iznad)
              </span>
              <select
                ref={slugSelectRef}
                className="editor-input editor-slug-pick__select"
                aria-label="Slugovi artikala koji počinju s unesenim tekstom"
                value={slugSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setPoSlug(v);
                  slugInputRef.current?.focus();
                }}
                onKeyDown={(e) => {
                  const el = slugSelectRef.current;
                  if (!el) return;
                  if (e.key === "ArrowUp" && el.selectedIndex <= 0) {
                    e.preventDefault();
                    slugInputRef.current?.focus();
                  }
                  if (e.key === "Escape") {
                    slugInputRef.current?.focus();
                  }
                }}
              >
                <option value="">
                  {filteredProductSlugs.length === 0
                    ? "— nema slugova s tim početkom —"
                    : "— odaberi točan slug —"}
                </option>
                {filteredProductSlugs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="editor-hint editor-hint--inline editor-slug-pick__hint">
            Upisom prvih slova ostaju samo slugovi s tim <strong>prefiksom</strong>.{" "}
            <kbd>Tab</kbd> ili <kbd>↓</kbd> prebacuje fokus na padajući popis;{" "}
            <kbd>↑</kbd> s vrha popisa vraća u polje za unos.
          </p>
          </div>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Tekstovi i vidljivost</h3>
          <input
            className="editor-input"
            placeholder="Novi naslov (opc.)"
            value={poTitle}
            onChange={(e) => setPoTitle(e.target.value)}
          />
          <textarea
            className="editor-textarea"
            placeholder="Kratki opis (opc.)"
            rows={2}
            value={poShort}
            onChange={(e) => setPoShort(e.target.value)}
          />
          <p className="editor-hint editor-hint--inline">
            Mjere u <strong>cm</strong> — na stranici se uz broj prikazuje i preračun u inčima. Vrijednost{" "}
            <strong>0</strong> sakriva taj parametar. Prazno polje u nadjačavanju znači „koristi vrijednost iz
            kataloga” (ako u JSON katalogu postoji).
          </p>
          <div className="editor-product-dimensions">
            <Field label="Širina (cm)">
              <input
                className="editor-input editor-input--narrow"
                type="text"
                inputMode="decimal"
                placeholder="npr. 12"
                value={poWidthCm}
                onChange={(e) => setPoWidthCm(e.target.value)}
              />
            </Field>
            <Field label="Visina (cm)">
              <input
                className="editor-input editor-input--narrow"
                type="text"
                inputMode="decimal"
                placeholder="npr. 8"
                value={poHeightCm}
                onChange={(e) => setPoHeightCm(e.target.value)}
              />
            </Field>
            <Field label="Promjer ⌀ (cm)">
              <input
                className="editor-input editor-input--narrow"
                type="text"
                inputMode="decimal"
                placeholder="npr. 10"
                value={poDiameterCm}
                onChange={(e) => setPoDiameterCm(e.target.value)}
              />
            </Field>
            <Field label="Oblik (tekst)">
              <input
                className="editor-input"
                placeholder="npr. okruglo, ovalno…"
                value={poShape}
                onChange={(e) => setPoShape(e.target.value)}
              />
            </Field>
          </div>
          <textarea
            className="editor-textarea"
            placeholder="Dugi opis (opc.)"
            rows={3}
            value={poDesc}
            onChange={(e) => setPoDesc(e.target.value)}
          />
          <input
            className="editor-input editor-input--narrow"
            type="number"
            min={0}
            step={0.01}
            placeholder="Cijena (opc.)"
            value={poPrice}
            onChange={(e) => setPoPrice(e.target.value)}
          />
          <Field label="Sakrij artikl u trgovini (nije za javni prikaz)">
            <input
              type="checkbox"
              checked={poHideFromShop}
              onChange={(e) => setPoHideFromShop(e.target.checked)}
            />
          </Field>
          </div>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Slike (Studio + biblioteka)</h3>
          <EditorImageStudio
            suggestBaseName={poSlug.trim() || "proizvod"}
            onApplyUrl={onProductImageUrlFromStudio}
            onAfterDevUpload={(detail) => {
              onMediaLibraryRefresh?.();
              const paths = detail?.paths ?? [];
              if (paths.length === 0) return;
              const joined = paths.join(", ");
              if (paths.length === 1) {
                setProductOverrideInfo(
                  `Uspješno ste uploadali sliku (${joined}). Pojavit će se u grupi „Logo i vlastiti uploadi” u padajućem izborniku; glavno polje je postavljeno. Kliknite „Primijeni na slug”, zatim „Spremi promjene” u zaglavlju.`
                );
              } else {
                setProductOverrideInfo(
                  `Uspješno ste uploadali ${paths.length} slika: ${joined}. Pojavit će se u izborniku ispod. Prva je u glavnom polju. Kliknite „Primijeni na slug” i „Spremi promjene”.`
                );
              }
            }}
            onAppendGalleryLine={(u) => {
              pushStudioUrlToNextSlot(u);
              const s = poSlug.trim();
              setProductOverrideInfo(
                s
                  ? `Slika dodana u prvo slobodno polje za „${s}”. Kliknite „Primijeni na slug”.`
                  : "Slika dodana u polje. Upišite slug i kliknite „Primijeni na slug”."
              );
            }}
          />
          <EditorImagePicker
            label="1. Glavna slika (kartica + prva u galeriji)"
            value={poImages.main}
            onChange={(v) => setPoImageSlot("main", v)}
            catalogItems={catalogPickerItems}
            library={filePickerItems}
          />
          <div className="editor-product-extras">
            <span className="editor-field__label editor-product-extras__title">
              2.–5. Dodatne slike u galeriji (opcionalno, do četiri)
            </span>
            <div className="editor-product-extras__grid">
              <EditorImagePicker
                label="Dodatna 1"
                value={poImages.extra1}
                onChange={(v) => setPoImageSlot("extra1", v)}
                catalogItems={catalogPickerItems}
                library={filePickerItems}
              />
              <EditorImagePicker
                label="Dodatna 2"
                value={poImages.extra2}
                onChange={(v) => setPoImageSlot("extra2", v)}
                catalogItems={catalogPickerItems}
                library={filePickerItems}
              />
              <EditorImagePicker
                label="Dodatna 3"
                value={poImages.extra3}
                onChange={(v) => setPoImageSlot("extra3", v)}
                catalogItems={catalogPickerItems}
                library={filePickerItems}
              />
              <EditorImagePicker
                label="Dodatna 4"
                value={poImages.extra4}
                onChange={(v) => setPoImageSlot("extra4", v)}
                catalogItems={catalogPickerItems}
                library={filePickerItems}
              />
            </div>
          </div>
          </div>
          <div className="editor-product-workspace__sticky-actions">
          <button
            type="button"
            className="editor-btn editor-btn--primary"
            onClick={applyProductOverride}
          >
            Primijeni na slug
          </button>
          <button
            type="button"
            className="editor-btn editor-btn--ghost"
            disabled={!poSlug.trim()}
            onClick={resetProductImagesForSlug}
          >
            Reset slika za ovaj artikl
          </button>
          <button
            type="button"
            className="editor-btn editor-btn--primary editor-btn--archive"
            disabled={!poSlug.trim() || archivingSlug}
            onClick={() => void archiveProductSlug()}
            title={
              import.meta.env.DEV
                ? "Zapis na disk u public/ i čišćenje forme"
                : "Preuzimanje JSON snippeta"
            }
          >
            {archivingSlug ? "Arhiviram…" : "Arhiviraj slug (disk + nova forma)"}
          </button>
          </div>
          <div className="editor-card__group">
            <h3 className="editor-card__group-title">Novi artikl u katalogu</h3>
            <p className="editor-hint editor-hint--inline">
              Odaberite <strong>grupu</strong> — slug i (prazan) naslov automatski se postave u uzorku{" "}
              <code>slug-kolekcije-komad-broj</code> (npr. <code>kuhace-komad-16</code> ako već postoje{" "}
              <code>kuhace-komad-1</code> … <code>kuhace-komad-15</code> u katalogu ili nacrtu). Broj
              računa se iz postojećih slugova s tim prefiksom (i ključeva nadjačavanja / dodjela). Naslov i
              slug možete ručno promijeniti.{" "}
              <strong>Kreiraj u katalogu</strong> (samo <code>npm run dev</code>) dopisuje{" "}
              <code>src/data/storeCatalog.json</code>; stranica se osvježava. Prije toga po želji{" "}
              <strong>Spremi promjene</strong> u zaglavlju.
            </p>
            <Field label="Grupa (padajući izbornik trgovine → kolekcija)">
              <select
                className="editor-input"
                aria-label="Kolekcija za novi artikl"
                value={newProductCollectionId}
                onChange={(e) => setNewProductCollectionId(e.target.value)}
              >
                <option value="">— odaberite grupu —</option>
                {submenuCollectionChoices.map((c) => (
                  <option key={c.collectionId} value={c.collectionId}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <input
              className="editor-input"
              placeholder="Naslov (npr. Kuhače komad 16 — puni se kad je prazan nakon odabira grupe)"
              value={newProductTitle}
              onChange={(e) => setNewProductTitle(e.target.value)}
              autoComplete="off"
            />
            <input
              className="editor-input"
              placeholder="Slug (npr. kuhace-komad-16 — automatski nakon grupe; možete ručno)"
              value={newProductSlugManual}
              onChange={(e) => setNewProductSlugManual(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            <p className="editor-hint editor-hint--inline editor-hint--tight">
              Konačni slug: <code>{newProductSlugPreview || "—"}</code>
            </p>
            <button
              type="button"
              className="editor-btn editor-btn--primary"
              disabled={
                creatingCatalogProduct ||
                !newProductCollectionId.trim() ||
                !newProductSlugPreview
              }
              onClick={() => void createNewCatalogProduct()}
            >
              {creatingCatalogProduct ? "Kreiram…" : "Kreiraj u katalogu i osvježi"}
            </button>
          </div>
        </div>
        {productOverrideInfo ? (
          <p className="editor-info-ok" role="status">
            {productOverrideInfo}
          </p>
        ) : null}
        <div className="editor-card__group">
        <h3 className="editor-card__group-title">Aktivna nadjačavanja</h3>
        <ul className="editor-override-list">
          {Object.keys(draft.productOverrides).length === 0 && (
            <li>Nema spremljenih nadjačavanja.</li>
          )}
          {Object.entries(draft.productOverrides).map(([slug, o]) => (
            <li key={slug}>
              <strong>{slug}</strong>
              {o.title != null && o.title !== "" && (
                <span> · naslov: {o.title.slice(0, 40)}…</span>
              )}
              {o.price != null && <span> · cijena: {o.price}</span>}
              {o.image != null && o.image !== "" && (
                <span> · slika: {o.image.slice(0, 36)}…</span>
              )}
              {o.images != null && o.images.length > 0 && (
                <span> · galerija: {o.images.length} slika</span>
              )}
              {o.hideFromShop === true && (
                <span> · sakriven u trgovini</span>
              )}
              {o.widthCm != null &&
                !Number.isNaN(Number(o.widthCm)) &&
                Number(o.widthCm) > 0 && (
                <span> · širina {o.widthCm} cm</span>
              )}
              {o.heightCm != null &&
                !Number.isNaN(Number(o.heightCm)) &&
                Number(o.heightCm) > 0 && (
                <span> · visina {o.heightCm} cm</span>
              )}
              {o.diameterCm != null &&
                !Number.isNaN(Number(o.diameterCm)) &&
                Number(o.diameterCm) > 0 && (
                <span> · ⌀ {o.diameterCm} cm</span>
              )}
              {o.shape != null && String(o.shape).trim() !== "" && (
                <span> · oblik: {String(o.shape).trim().slice(0, 24)}</span>
              )}
              <button
                type="button"
                className="editor-btn editor-btn--ghost"
                onClick={() => removeProductOverride(slug)}
              >
                Obriši
              </button>
            </li>
          ))}
        </ul>
        </div>
      </section>
      )}

      {matchesEditorSectionQuery(
        q,
        "struktura trgovine izbornik shop padajući navigacija submenu slug kolekcije kategorije url meni"
      ) && (
      <section className="editor-card editor-card--wide">
        <h2>Struktura trgovine (padajući izbornik)</h2>
        <div className="editor-card__group">
        <p className="editor-hint editor-hint--tight">
          Natpisi kategorija za sve jezike u „Tekstovi stranica” (<code>categories.&lt;slug&gt;</code>).
          Ovdje slugovi i redoslijed — moraju odgovarati kolekcijama u URL-u.
        </p>
        <h3 className="editor-card__group-title">Podkategorije (padajući izbornik)</h3>
        <EditorShopSubmenuManager
          rows={nav.shopSubmenu}
          collectionSlugOptions={collSlugs}
          datalistId="editor-shop-submenu-collection-slugs"
          onChange={(next) =>
            setDraft((d) => ({
              ...d,
              navigation: { ...d.navigation, shopSubmenu: next },
            }))
          }
        />
        </div>
      </section>
      )}

      {matchesEditorSectionQuery(
        q,
        "dodatna grupa kolekcija slug pripadnost artikl dodijeli assignment podkategorija kategorija"
      ) && (
      <section className="editor-card editor-card--wide">
        <h2>Slug artikla u dodatnu grupu (kolekciju)</h2>
        <div className="editor-card__group">
        <p className="editor-hint editor-hint--tight">
          <strong>Kolekcija</strong> + <strong>slug artikla</strong> iz kataloga (
          <code>storeCatalog.json</code>). Novi artikl prvo u katalog.
        </p>
        <div className="editor-override-form">
          <input
            className="editor-input"
            placeholder="slug artikla (npr. kuhace-komad-1)"
            value={assignSlug}
            onChange={(e) => setAssignSlug(e.target.value)}
            list="assign-product-slugs-datalist"
          />
          <datalist id="assign-product-slugs-datalist">
            {slugOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <select
            className="editor-input"
            aria-label="Kolekcija (grupa)"
            value={assignCollectionId}
            onChange={(e) => setAssignCollectionId(e.target.value)}
          >
            <option value="">— odaberi kolekciju (grupu) —</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.slug})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="editor-btn editor-btn--primary"
            onClick={() => {
              const s = assignSlug.trim();
              const cid = assignCollectionId.trim();
              if (!s || !cid) {
                setProductOverrideInfo(
                  "Upišite slug artikla i odaberite kolekciju u padajućem izborniku."
                );
                return;
              }
              setDraft((d) => ({
                ...d,
                productCollectionAssignments: {
                  ...d.productCollectionAssignments,
                  [s]: cid,
                },
              }));
              const col = collections.find((c) => c.id === cid);
              setProductOverrideInfo(
                `Slug „${s}” dodan u kolekciju „${col?.title ?? cid}” (${col?.slug ?? ""}). Spremite promjene u zaglavlju.`
              );
            }}
          >
            Dodijeli u grupu
          </button>
        </div>
        </div>
        <div className="editor-card__group">
        <h3 className="editor-card__group-title">Aktivna dodatna pripadnost</h3>
        <ul className="editor-override-list">
          {Object.keys(draft.productCollectionAssignments).length === 0 && (
            <li>Nema dodatnih dodjela slug → kolekcija.</li>
          )}
          {Object.entries(draft.productCollectionAssignments).map(
            ([slugKey, colId]) => {
              const col = collections.find((c) => c.id === colId);
              return (
                <li key={slugKey}>
                  <strong>{slugKey}</strong>
                  <span>
                    {" "}
                    → {col ? `${col.title} (${col.slug})` : colId}
                  </span>
                  <button
                    type="button"
                    className="editor-btn editor-btn--ghost"
                    onClick={() =>
                      setDraft((d) => {
                        const next = { ...d.productCollectionAssignments };
                        delete next[slugKey];
                        return {
                          ...d,
                          productCollectionAssignments: next,
                        };
                      })
                    }
                  >
                    Ukloni
                  </button>
                </li>
              );
            }
          )}
        </ul>
        </div>
      </section>
      )}

      {matchesEditorSectionQuery(
        q,
        "nadjačavanje kolekcija kolekcija collection hero opis slug kategorija slika slike biblioteka nova kreiraj dodaj katalog store novu grupu"
      ) && (
      <section className="editor-card editor-card--wide">
        <h2>Nadjačavanje kolekcija</h2>
        <div className="editor-card__group">
          <h3 className="editor-card__group-title">Nova kolekcija u katalogu</h3>
          <p className="editor-hint editor-hint--inline">
            Zapis u <code>src/data/storeCatalog.json</code> — samo uz{" "}
            <code>npm run dev</code>. Nakon kreiranja možete dodati hero i tekstove
            u odjeljcima ispod (nadjačavanje) ili u „Tekstovi stranica” za prijevode
            (<code>categories.&lt;slug&gt;</code>).
          </p>
          <input
            className="editor-input"
            placeholder="Naslov kolekcije (npr. Stolne lampe)"
            value={newCollectionTitle}
            onChange={(e) => setNewCollectionTitle(e.target.value)}
            autoComplete="off"
          />
          <input
            className="editor-input"
            placeholder="Slug u URL-u (opcionalno; npr. stolne-lampe)"
            value={newCollectionSlugManual}
            onChange={(e) => setNewCollectionSlugManual(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <textarea
            className="editor-textarea"
            placeholder="Kratki opis kolekcije (opcionalno, u katalogu)"
            rows={2}
            value={newCollectionDesc}
            onChange={(e) => setNewCollectionDesc(e.target.value)}
          />
          <p className="editor-hint editor-hint--inline editor-hint--tight">
            Konačni slug: <code>{newCollectionSlugPreview || "—"}</code>
          </p>
          <Field label="Dodaj stavku u padajući izbornik trgovine (nacrt)">
            <input
              type="checkbox"
              checked={newCollectionAddToSubmenu}
              onChange={(e) => setNewCollectionAddToSubmenu(e.target.checked)}
            />
          </Field>
          <button
            type="button"
            className="editor-btn editor-btn--primary"
            disabled={
              creatingCatalogCollection || !newCollectionSlugPreview
            }
            onClick={() => void createNewCatalogCollection()}
          >
            {creatingCatalogCollection
              ? "Kreiram…"
              : "Kreiraj kolekciju u katalogu i osvježi"}
          </button>
        </div>
        <div className="editor-card__group">
          <h3 className="editor-card__group-title">Slug, naslov i opis</h3>
          <div className="editor-override-form">
            <input
              className="editor-input"
              placeholder="slug kolekcije"
              value={coSlug}
              onChange={(e) => setCoSlug(e.target.value)}
              list="collection-slugs-list-2"
            />
            <datalist id="collection-slugs-list-2">
              {collSlugs.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <input
              className="editor-input"
              placeholder="Naslov (opc.)"
              value={coTitle}
              onChange={(e) => setCoTitle(e.target.value)}
            />
            <textarea
              className="editor-textarea"
              placeholder="Opis (opc.)"
              rows={2}
              value={coDesc}
              onChange={(e) => setCoDesc(e.target.value)}
            />
          </div>
        </div>
        <div className="editor-card__group">
          <h3 className="editor-card__group-title">Hero slika (Studio + biblioteka)</h3>
          <div className="editor-override-form">
            <EditorImageStudio
              suggestBaseName={coSlug.trim() || "kolekcija"}
              onApplyUrl={setCoHero}
              onAfterDevUpload={(detail) => {
                onMediaLibraryRefresh?.();
                const paths = detail?.paths ?? [];
                if (paths.length === 0) return;
                setCollectionUploadInfo(
                  `Uspješno ste uploadali: ${paths.join(", ")}. Odaberite sliku u padajućem izborniku (vlastiti uploadi) ili je već u polju. Zatim „Primijeni na kolekciju”.`
                );
              }}
            />
            <EditorImagePicker
              label="Hero slika kolekcije"
              value={coHero}
              onChange={setCoHero}
              catalogItems={catalogPickerItems}
              library={filePickerItems}
            />
            <button
              type="button"
              className="editor-btn editor-btn--primary"
              onClick={applyCollectionOverride}
            >
              Primijeni na kolekciju
            </button>
          </div>
        </div>
        {collectionUploadInfo ? (
          <p className="editor-info-ok" role="status">
            {collectionUploadInfo}
          </p>
        ) : null}
        <div className="editor-card__group">
        <h3 className="editor-card__group-title">Aktivna nadjačavanja</h3>
        <ul className="editor-override-list">
          {Object.keys(draft.collectionOverrides).length === 0 && (
            <li>Nema nadjačavanja kolekcija.</li>
          )}
          {Object.keys(draft.collectionOverrides).map((slug) => (
            <li key={slug}>
              <strong>{slug}</strong>
              <button
                type="button"
                className="editor-btn editor-btn--ghost"
                onClick={() => removeCollectionOverride(slug)}
              >
                Obriši
              </button>
            </li>
          ))}
        </ul>
        </div>
      </section>
      )}

      {matchesEditorSectionQuery(
        q,
        "košarica kosarica poklon prag cart gift threshold iznos"
      ) && (
      <section className="editor-card">
        <h2>Košarica — prag za poklon</h2>
        <Field label="Prag (iznos u valuti trgovine, npr. 150)">
          <input
            type="number"
            min={0}
            className="editor-input editor-input--narrow"
            value={cart.giftThreshold}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                cart: {
                  ...d.cart,
                  giftThreshold: Number(e.target.value) || 0,
                },
              }))
            }
          />
        </Field>
        <p className="editor-hint">
          Poruke o poklonu i ostali tekstovi košarice u odjeljku „Košarica” unutar prijevoda.
        </p>
      </section>
      )}

      {matchesEditorSectionQuery(
        q,
        "blog vanjska poveznica url link eksterni external"
      ) && (
      <section className="editor-card">
        <h2>Blog — vanjska poveznica</h2>
        <p className="editor-hint">
          Naslov i uvod blog stranice u „Tekstovi stranica”. Ovdje samo opcionalna vanjska poveznica.
        </p>
        <Field label="Tekst poveznice">
          <input
            className="editor-input"
            value={blog.externalLinkLabel}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                blog: { ...d.blog, externalLinkLabel: e.target.value },
              }))
            }
          />
        </Field>
        <Field label="URL (https://…)">
          <input
            className="editor-input"
            value={blog.externalUrl}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                blog: { ...d.blog, externalUrl: e.target.value },
              }))
            }
          />
        </Field>
      </section>
      )}
    </>
  );
}
