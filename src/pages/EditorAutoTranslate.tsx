import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import { Link } from "react-router-dom";
import { collections, products } from "@/data/catalog";
import {
  type AppLocaleCode,
  type SiteSettings,
  mergeCollection,
  mergeProduct,
} from "@/config/siteDefaults";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { siteSettingsToCssVarsStyle } from "@/lib/themeCssVars";
import { translateText, type TranslatableLang } from "@/lib/autoTranslate";
import { SUPPORTED_LANGS } from "@/i18n";
import { suggestNextKomadSlugForCollection } from "@/lib/suggestKomadProductSlug";

/**
 * NOVI UREDNIK — s ugrađenim automatskim prijevodom preko MyMemory (besplatno).
 * ----------------------------------------------------------------------------
 * Razlika od starog urednika:
 *  - NE zahtijeva DeepL API ključ ni env varijable.
 *  - Koristi istu `translateText` funkciju kao auto-prevoditelj na glavnoj
 *    stranici — keš u `localStorage` dijeli se pa se isti tekst nikad ne
 *    prevodi dvaput.
 *  - "Auto-prevedi pri spremanju" je default UKLJUČENO; svaki novi ili
 *    prepravljeni artikl / kolekcija dobivaju prijevode u svim jezicima
 *    sustava (en, de, fr, it, sl, cs, pl) u trenutku spremanja.
 *
 * Dvije sekcije u istom prozoru:
 *  1) UNOS / PREPRAVAK / BRISANJE ARTIKALA
 *  2) UNOS / PREPRAVAK / BRISANJE KOLEKCIJA (ispod artikala)
 *
 * Ruta: /urednik-auto
 */

type Mode = "create" | "edit" | "delete";

const TARGET_LANGS = SUPPORTED_LANGS.filter(
  (c) => c !== "hr"
) as TranslatableLang[];

/* ─────────────────────────────────────────────────────────────────
 * Pomoćne funkcije — zajedničke za obje sekcije
 * ───────────────────────────────────────────────────────────────── */

function sameText(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

async function fileToBase64NoPrefix(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const full = String(r.result ?? "");
      const comma = full.indexOf(",");
      resolve(comma >= 0 ? full.slice(comma + 1) : full);
    };
    r.onerror = () => reject(new Error("Čitanje datoteke nije uspjelo."));
    r.readAsDataURL(file);
  });
}

async function uploadImageToServer(
  file: File,
  slugPrefix: string
): Promise<string> {
  const b64 = await fileToBase64NoPrefix(file);
  const ext = file.type.includes("png")
    ? ".png"
    : file.type.includes("webp")
      ? ".webp"
      : ".jpg";
  const filename = `${slugPrefix || "slika"}-${Date.now()}${ext}`;
  const r = await fetch("/__editor__/save-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename,
      dataBase64: b64,
      mime: file.type || "image/jpeg",
    }),
  });
  const j = (await r.json()) as { ok?: boolean; path?: string; error?: string };
  if (!r.ok || !j.ok || !j.path) {
    throw new Error(j.error ?? "Upload slike nije uspio.");
  }
  return j.path;
}

/**
 * Prevodi set polja na sve TARGET_LANGS (paralelno, s progressom).
 * Koristi `translateText` iz lib/autoTranslate.ts (MyMemory + localStorage keš).
 */
async function runBuildTranslations<F extends string>(args: {
  fields: F[];
  hrSource: Record<F, string>;
  current: Record<AppLocaleCode, Record<F, string>>;
  overwrite: boolean;
  onProgress: (done: number, total: number) => void;
}): Promise<{
  map: Record<AppLocaleCode, Record<F, string>>;
  failed: string[];
  translatedCount: number;
  totalRequested: number;
}> {
  const { fields, hrSource, current, overwrite, onProgress } = args;
  const out = { ...current } as Record<AppLocaleCode, Record<F, string>>;
  const failed = new Set<string>();
  const tasks: { lang: AppLocaleCode; field: F; hr: string }[] = [];

  for (const lang of TARGET_LANGS) {
    const lc = lang as AppLocaleCode;
    const prev = out[lc] ?? ({} as Record<F, string>);
    const nextCopy = { ...prev };
    for (const f of fields) {
      const hr = (hrSource[f] ?? "").trim();
      if (!hr) continue;
      const existing = (prev[f] ?? "").trim();
      if (existing && !overwrite) continue;
      tasks.push({ lang: lc, field: f, hr });
    }
    out[lc] = nextCopy;
  }

  const total = tasks.length;
  onProgress(0, total);

  const CONCURRENCY = 3;
  let idx = 0;
  let done = 0;
  let translatedCount = 0;

  async function worker() {
    while (idx < tasks.length) {
      const my = idx++;
      const { lang, field, hr } = tasks[my];
      try {
        const tr = await translateText(hr, "hr", lang as TranslatableLang);
        if (tr && !sameText(tr, hr)) {
          out[lang] = { ...out[lang], [field]: tr };
          translatedCount++;
        } else {
          failed.add(lang.toUpperCase());
        }
      } catch {
        failed.add(lang.toUpperCase());
      }
      done++;
      onProgress(done, total);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tasks.length || 1) }, () =>
      worker()
    )
  );

  return {
    map: out,
    failed: [...failed],
    translatedCount,
    totalRequested: total,
  };
}

/* ═════════════════════════════════════════════════════════════════
 * GLAVNA KOMPONENTA — prikazuje obje sekcije (artikli + kolekcije)
 * ═════════════════════════════════════════════════════════════════ */

export function EditorAutoTranslate() {
  const { settings, setSettings } = useSiteSettings();
  const [draft, setDraft] = useState<SiteSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.classList.add("editor-route");
    return () => document.documentElement.classList.remove("editor-route");
  }, []);

  return (
    <div
      className="editor-page editor-page--auto"
      style={siteSettingsToCssVarsStyle(draft)}
    >
      <header className="editor-page__head">
        <div>
          <h1 className="editor-page__title">
            Urednik artikala i kolekcija — AUTO PRIJEVOD
          </h1>
          <p className="editor-page__sub">
            Novi urednik s ugrađenim <strong>besplatnim</strong> automatskim prevoditeljem
            (MyMemory). Svaki novi ili prepravljeni artikl i svaka kolekcija se pri
            spremanju automatski prevode na svih 7 jezika. Bez servera trećih strana,
            bez API ključeva, keš u pregledniku.
          </p>
        </div>
        <div className="editor-page__actions">
          <Link to="/" className="editor-btn editor-btn--ghost">
            ← Natrag na stranicu
          </Link>
          <Link to="/editor" className="editor-btn editor-btn--ghost">
            Stari urednik
          </Link>
        </div>
      </header>

      <div className="editor-grid">
        <ProductEditorSection
          draft={draft}
          setDraft={setDraft}
          onPersistSettings={setSettings}
        />
        <CollectionEditorSection
          draft={draft}
          setDraft={setDraft}
          onPersistSettings={setSettings}
        />
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
 * SEKCIJA 1 — ARTIKLI
 * ═════════════════════════════════════════════════════════════════ */

type ProductCopyFields = {
  title: string;
  shortDescription: string;
  description: string;
  shape: string;
};

function emptyProductLangMap(): Record<AppLocaleCode, ProductCopyFields> {
  const out = {} as Record<AppLocaleCode, ProductCopyFields>;
  for (const code of TARGET_LANGS) {
    out[code as AppLocaleCode] = {
      title: "",
      shortDescription: "",
      description: "",
      shape: "",
    };
  }
  return out;
}

type SectionProps = {
  draft: SiteSettings;
  setDraft: React.Dispatch<React.SetStateAction<SiteSettings>>;
  onPersistSettings: (next: SiteSettings) => void;
};

function ProductEditorSection({
  draft,
  setDraft,
  onPersistSettings,
}: SectionProps) {
  const [mode, setMode] = useState<Mode>("create");
  const [slug, setSlug] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [diameterCm, setDiameterCm] = useState("");
  const [shape, setShape] = useState("");
  const [soldOut, setSoldOut] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [mainImage, setMainImage] = useState("");
  const [extraImages, setExtraImages] = useState<string[]>(["", "", "", ""]);
  const [translations, setTranslations] = useState<
    Record<AppLocaleCode, ProductCopyFields>
  >(emptyProductLangMap());

  const [autoTranslate, setAutoTranslate] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [info, setInfo] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const productOptions = useMemo(
    () =>
      [
        ...products.map((p) => p.slug),
        ...Object.keys(draft.productOverrides),
      ].sort(),
    [draft.productOverrides]
  );

  useEffect(() => {
    if (mode !== "create") return;
    const cid = collectionId.trim();
    if (!cid) return;
    const col = collections.find((c) => c.id === cid);
    if (!col) return;
    const extra = [
      ...Object.keys(draft.productOverrides),
      ...Object.keys(draft.productCollectionAssignments),
    ];
    const { slug: suggestedSlug } = suggestNextKomadSlugForCollection(
      col.slug,
      products,
      extra
    );
    setSlug(suggestedSlug);
  }, [mode, collectionId, draft.productOverrides, draft.productCollectionAssignments]);

  useEffect(() => {
    if (mode === "create" || !slug.trim()) return;
    const base = products.find((p) => p.slug === slug);
    const ov = draft.productOverrides[slug] ?? null;
    if (!base && !ov) return;
    const merged = base ? mergeProduct(base, ov, "hr") : null;
    setCollectionId(merged?.collectionIds?.[0] ?? base?.collectionIds?.[0] ?? "");
    setTitle(merged?.title ?? String(ov?.title ?? ""));
    setShortDescription(
      merged?.shortDescription ?? String(ov?.shortDescription ?? "")
    );
    setDescription(merged?.description ?? String(ov?.description ?? ""));
    setPrice(String(merged?.price ?? ov?.price ?? ""));
    const w =
      (merged as { widthCm?: number } | null)?.widthCm ??
      (ov as { widthCm?: number } | null)?.widthCm;
    const h =
      (merged as { heightCm?: number } | null)?.heightCm ??
      (ov as { heightCm?: number } | null)?.heightCm;
    const d =
      (merged as { diameterCm?: number } | null)?.diameterCm ??
      (ov as { diameterCm?: number } | null)?.diameterCm;
    const sh =
      (merged as { shape?: string } | null)?.shape ??
      (ov as { shape?: string } | null)?.shape ??
      "";
    setWidthCm(w != null ? String(w) : "");
    setHeightCm(h != null ? String(h) : "");
    setDiameterCm(d != null ? String(d) : "");
    setShape(sh);
    setSoldOut(
      Boolean(
        (merged as { soldOut?: boolean } | null)?.soldOut ??
          (ov as { soldOut?: boolean } | null)?.soldOut
      )
    );
    setFeatured(
      Boolean(
        (merged as { featured?: boolean } | null)?.featured ??
          (ov as { featured?: boolean } | null)?.featured
      )
    );
    const imgs = merged?.images?.length
      ? merged.images
      : merged?.image
        ? [merged.image]
        : [];
    setMainImage(imgs[0] ?? "");
    setExtraImages([imgs[1] ?? "", imgs[2] ?? "", imgs[3] ?? "", imgs[4] ?? ""]);
    const tr = emptyProductLangMap();
    for (const lang of TARGET_LANGS) {
      tr[lang as AppLocaleCode] = {
        title: String(ov?.translations?.[lang as AppLocaleCode]?.title ?? ""),
        shortDescription: String(
          ov?.translations?.[lang as AppLocaleCode]?.shortDescription ?? ""
        ),
        description: String(
          ov?.translations?.[lang as AppLocaleCode]?.description ?? ""
        ),
        shape: String(
          ov?.translations?.[lang as AppLocaleCode]?.shape ?? ""
        ),
      };
    }
    setTranslations(tr);
  }, [mode, slug, draft.productOverrides]);

  const onDropImage = async (
    e: DragEvent<HTMLDivElement>,
    target: "main" | number
  ) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setBusy(true);
    setInfo("Uploadam sliku…");
    try {
      const path = await uploadImageToServer(file, slug || "artikl");
      if (target === "main") setMainImage(path);
      else setExtraImages((prev) => prev.map((x, i) => (i === target ? path : x)));
      setInfo(`Spremljena slika: ${path}`);
    } catch (err) {
      setInfo(err instanceof Error ? err.message : "Upload nije uspio.");
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setSlug("");
    setCollectionId("");
    setTitle("");
    setShortDescription("");
    setDescription("");
    setPrice("");
    setWidthCm("");
    setHeightCm("");
    setDiameterCm("");
    setShape("");
    setSoldOut(false);
    setFeatured(false);
    setMainImage("");
    setExtraImages(["", "", "", ""]);
    setTranslations(emptyProductLangMap());
  };

  const runTranslate = useCallback(
    async (hr: ProductCopyFields) => {
      const res = await runBuildTranslations({
        fields: ["title", "shortDescription", "description", "shape"] as const,
        hrSource: hr,
        current: translations,
        overwrite: overwriteExisting,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setTranslations(res.map);
      return res;
    },
    [translations, overwriteExisting]
  );

  /**
   * Sprema prijevode (i collection-assignment) na dva mjesta:
   *   1) `localStorage` preko SiteSettingsContext-a (brz UI refresh, isti tab).
   *   2) `public/editor-archived-overrides.json` preko Vite middleware-a
   *      (`/__editor__/save-product-override`). To je ključno — `useResolvedProducts`
   *      čita točno taj JSON pri otvaranju stranice, pa prijevodi postaju dostupni
   *      i u drugim preglednicima / nakon čišćenja localStorage.
   */
  const persistOverridesAndTranslations = async (
    savedSlug: string,
    trMap: Record<AppLocaleCode, ProductCopyFields>,
    colId: string
  ): Promise<void> => {
    const translations = Object.fromEntries(
      TARGET_LANGS.map((lang) => [lang, trMap[lang as AppLocaleCode]])
    );
    setDraft((d) => {
      const prev = d.productOverrides[savedSlug] ?? {};
      const next = {
        ...prev,
        translations: {
          ...(prev.translations ?? {}),
          ...translations,
        },
      };
      const assignments = { ...d.productCollectionAssignments };
      if (colId.trim()) assignments[savedSlug] = colId.trim();
      const newDraft = {
        ...d,
        productOverrides: { ...d.productOverrides, [savedSlug]: next },
        productCollectionAssignments: assignments,
      };
      onPersistSettings(newDraft);
      return newDraft;
    });

    try {
      await fetch("/__editor__/save-product-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: savedSlug,
          override: { translations },
        }),
      });
    } catch {
      /* offline / produkcija: localStorage je i dalje zapisan */
    }
  };

  const saveOrUpdate = async () => {
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) {
      setInfo("Unesite slug artikla.");
      return;
    }
    if (!title.trim()) {
      setInfo("Unesite naslov na hrvatskom (polje za HR je obavezno).");
      return;
    }
    setBusy(true);
    setWarnings([]);
    setInfo(null);
    try {
      const hr: ProductCopyFields = {
        title: title.trim(),
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        shape: shape.trim(),
      };
      let trMap = translations;
      const msgs: string[] = [];
      if (autoTranslate) {
        setInfo("Prevodim HR tekst na sve jezike (MyMemory, besplatno)…");
        const res = await runTranslate(hr);
        trMap = res.map;
        if (res.failed.length) {
          msgs.push(
            `Neprevedeni jezici (ostavljeni prazni / nastavak HR): ${res.failed.join(", ")}.`
          );
        }
        msgs.push(`Prevedeno ${res.translatedCount}/${res.totalRequested} polja (naslov, kratki opis, opis, oblik).`);
      } else {
        msgs.push(
          "Auto-prijevod isključen — spremljen samo HR + ručno uneseni prijevodi."
        );
      }

      const numOrUndef = (v: string) => {
        const t = v.trim();
        if (!t) return undefined;
        const n = Number(t);
        return Number.isFinite(n) && n >= 0 ? n : undefined;
      };
      const payload = {
        mode: mode === "create" ? "create" : "update",
        slug: trimmedSlug,
        title: hr.title,
        shortDescription: hr.shortDescription,
        description: hr.description,
        price: Number(price || 0),
        collectionId: collectionId.trim(),
        image: mainImage.trim(),
        images: [mainImage, ...extraImages].map((x) => x.trim()).filter(Boolean),
        widthCm: numOrUndef(widthCm),
        heightCm: numOrUndef(heightCm),
        diameterCm: numOrUndef(diameterCm),
        shape: shape.trim(),
        soldOut,
        featured,
      };
      setInfo((prev) =>
        prev ? `${prev} Zapisujem u storeCatalog.json…` : "Zapisujem artikl…"
      );
      const r = await fetch("/__editor__/product-upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        slug?: string;
        created?: boolean;
        logPath?: string;
      };
      if (!r.ok || !j.ok || !j.slug) {
        throw new Error(
          j.error ??
            "Spremanje u storeCatalog.json nije uspjelo. Uvjeri se da pokrećeš dev-server preko 'otvori-urednik-auto.bat'."
        );
      }
      await persistOverridesAndTranslations(j.slug, trMap, collectionId);
      setWarnings(msgs);
      setInfo(
        `Uspješno ${j.created ? "spremljen novi" : "prepravljen"} artikl "${j.slug}". Log: ${j.logPath ?? "/editor-artikli-log.txt"}`
      );
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2200);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "Spremanje nije uspjelo.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setProgress(null), 1200);
    }
  };

  const deleteProduct = async () => {
    const s = slug.trim();
    if (!s) {
      setInfo("Odaberi slug artikla za brisanje.");
      return;
    }
    if (!window.confirm(`Obrisati artikl "${s}" (iz kataloga i localStorage)?`)) return;
    setBusy(true);
    try {
      try {
        await fetch("/__editor__/delete-product-override", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: s }),
        });
      } catch {
        /* best-effort — ako middleware ne radi, nastavi s uklanjanjem iz kataloga */
      }
      const r = await fetch("/__editor__/product-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: s }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        logPath?: string;
      };
      if (!r.ok || !j.ok) {
        setInfo(
          j.error ??
            "Brisanje iz kataloga nije uspjelo — brišem samo lokalne override-e."
        );
      }
      setDraft((d) => {
        const nextOv = { ...d.productOverrides };
        delete nextOv[s];
        const nextAssign = { ...d.productCollectionAssignments };
        delete nextAssign[s];
        const newDraft = {
          ...d,
          productOverrides: nextOv,
          productCollectionAssignments: nextAssign,
        };
        onPersistSettings(newDraft);
        return newDraft;
      });
      if (r.ok && j.ok) setInfo(`Obrisan artikl "${s}".`);
      resetForm();
      window.setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "Brisanje nije uspjelo.");
    } finally {
      setBusy(false);
    }
  };

  const runManualTranslate = async () => {
    if (!title.trim()) {
      setInfo("Unesi HR naslov prije prevođenja.");
      return;
    }
    setBusy(true);
    setWarnings([]);
    try {
      const res = await runTranslate({
        title: title.trim(),
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        shape: shape.trim(),
      });
      const msgs = [`Prevedeno ${res.translatedCount}/${res.totalRequested} polja (naslov, kratki opis, opis, oblik).`];
      if (res.failed.length) msgs.push(`Neuspjeli jezici: ${res.failed.join(", ")}.`);
      setWarnings(msgs);
      setInfo("Prijevodi osvježeni (još nije spremljeno — klikni „Spremi”).");
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "Prijevod nije uspio.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setProgress(null), 1200);
    }
  };

  const actionLabel =
    mode === "create"
      ? "Spremi novi artikl"
      : mode === "edit"
        ? "Spremi promjene"
        : "Obriši artikl";

  return (
    <section className="editor-card editor-card--wide">
      <h2>1) Artikli</h2>

      <div className="editor-products-tabs" role="tablist">
        <button
          type="button"
          className={`editor-btn ${mode === "create" ? "editor-btn--primary" : "editor-btn--ghost"}`}
          onClick={() => {
            setMode("create");
            resetForm();
          }}
          role="tab"
          aria-selected={mode === "create"}
        >
          Novi artikl
        </button>
        <button
          type="button"
          className={`editor-btn ${mode === "edit" ? "editor-btn--primary" : "editor-btn--ghost"}`}
          onClick={() => setMode("edit")}
          role="tab"
          aria-selected={mode === "edit"}
        >
          Prepravi postojeći
        </button>
        <button
          type="button"
          className={`editor-btn ${mode === "delete" ? "editor-btn--danger" : "editor-btn--ghost"}`}
          onClick={() => setMode("delete")}
          role="tab"
          aria-selected={mode === "delete"}
        >
          Obriši
        </button>
      </div>

      <fieldset className="auto-editor__toggles">
        <legend>Automatski prijevod</legend>
        <label className="auto-editor__toggle">
          <input
            type="checkbox"
            checked={autoTranslate}
            onChange={(e) => setAutoTranslate(e.target.checked)}
          />
          <span>
            <strong>Auto-prevedi pri spremanju</strong> — prevede HR naslov, opis i oblik na EN, DE, FR, IT, SL, CS, PL.
          </span>
        </label>
        <label className="auto-editor__toggle">
          <input
            type="checkbox"
            checked={overwriteExisting}
            onChange={(e) => setOverwriteExisting(e.target.checked)}
            disabled={!autoTranslate}
          />
          <span>
            Prepiši i već popunjena polja (inače: ostavi ručno upisana polja netaknutima).
          </span>
        </label>
      </fieldset>

      <div className="editor-card__group">
        <label className="editor-field">
          <span className="editor-field__label">Slug artikla</span>
          <input
            className="editor-input"
            list="auto-editor-slugs"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="npr. kuhace-komad-1"
          />
          <datalist id="auto-editor-slugs">
            {productOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        {mode !== "delete" && (
          <>
            <label className="editor-field">
              <span className="editor-field__label">Kolekcija</span>
              <select
                className="editor-input"
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
              >
                <option value="">— odaberi kolekciju —</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.slug})
                  </option>
                ))}
              </select>
              {collections.length === 0 ? (
                <span className="auto-editor__hint">
                  Još nemaš nijednu kolekciju — otvori sekciju „2) Kolekcije” ispod i
                  kreiraj barem jednu prije unosa artikala.
                </span>
              ) : null}
            </label>

            <label className="editor-field">
              <span className="editor-field__label">Naslov (HR)</span>
              <input
                className="editor-input"
                placeholder="npr. Zdjela od maslinovog drveta"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className="editor-field">
              <span className="editor-field__label">Kratki opis (HR)</span>
              <textarea
                className="editor-textarea"
                rows={2}
                placeholder="Kratka prodajna poruka (bit će prevedena)"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
              />
            </label>

            <label className="editor-field">
              <span className="editor-field__label">Opis (HR)</span>
              <textarea
                className="editor-textarea"
                rows={5}
                placeholder="Detaljan opis artikla (dimenzije, priča, upotreba…)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <label className="editor-field">
              <span className="editor-field__label">Cijena (€)</span>
              <input
                className="editor-input editor-input--narrow"
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>

            <fieldset className="auto-editor__dims">
              <legend>Dimenzije i oblik (neobavezno)</legend>
              <div className="auto-editor__dims-grid">
                <label className="editor-field">
                  <span className="editor-field__label">Širina (cm)</span>
                  <input
                    className="editor-input editor-input--narrow"
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="npr. 24"
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value)}
                  />
                </label>
                <label className="editor-field">
                  <span className="editor-field__label">Visina (cm)</span>
                  <input
                    className="editor-input editor-input--narrow"
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="npr. 6"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                  />
                </label>
                <label className="editor-field">
                  <span className="editor-field__label">Promjer ⌀ (cm)</span>
                  <input
                    className="editor-input editor-input--narrow"
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="npr. 18"
                    value={diameterCm}
                    onChange={(e) => setDiameterCm(e.target.value)}
                  />
                </label>
                <label className="editor-field">
                  <span className="editor-field__label">Oblik</span>
                  <input
                    className="editor-input"
                    placeholder="okrugao / ovalan / kvadratni…"
                    value={shape}
                    onChange={(e) => setShape(e.target.value)}
                  />
                </label>
              </div>
              <p className="auto-editor__hint">
                Ostavi prazno ono što se ne odnosi na artikl. Polja s vrijednošću 0 se
                ne prikazuju na kartici.
              </p>
            </fieldset>

            <fieldset className="auto-editor__flags">
              <legend>Status artikla</legend>
              <label className="auto-editor__toggle">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                />
                <span>
                  <strong>Istaknut</strong> — artikl se prikazuje na naslovnoj.
                </span>
              </label>
              <label className="auto-editor__toggle">
                <input
                  type="checkbox"
                  checked={soldOut}
                  onChange={(e) => setSoldOut(e.target.checked)}
                />
                <span>
                  <strong>Rasprodano</strong> — onemogući dodavanje u košaricu.
                </span>
              </label>
            </fieldset>

            <div className="editor-products-drop-grid">
              <div
                className="editor-products-drop"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => void onDropImage(e, "main")}
              >
                <strong>Glavna slika</strong>
                <span>Povuci iz Explorera ili Finder-a</span>
                <code>{mainImage || "nema slike"}</code>
              </div>
              {extraImages.map((img, i) => (
                <div
                  key={i}
                  className="editor-products-drop"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => void onDropImage(e, i)}
                >
                  <strong>Pomoćna slika {i + 1}</strong>
                  <span>Povuci iz Explorera ili Finder-a</span>
                  <code>{img || "nema slike"}</code>
                </div>
              ))}
            </div>

            <div className="auto-editor__actions">
              <button
                type="button"
                className="editor-btn editor-btn--ghost"
                disabled={busy}
                onClick={() => void runManualTranslate()}
              >
                {busy && progress
                  ? `Prevodim ${progress.done}/${progress.total}…`
                  : "Preveči sada (bez spremanja)"}
              </button>
              <span className="auto-editor__hint">
                Prijevodi se keširaju u pregledniku — isti tekst se ne prevodi više puta.
              </span>
            </div>

            <details className="auto-editor__lang-panel">
              <summary>
                Pogledaj / uredi prijevode ({TARGET_LANGS.length} jezika)
              </summary>
              {TARGET_LANGS.map((lang) => (
                <div key={lang} className="editor-card__group">
                  <h4 className="editor-card__group-title">{lang.toUpperCase()}</h4>
                  <label className="editor-field">
                    <span className="editor-field__label">Naslov</span>
                    <input
                      className="editor-input"
                      value={translations[lang as AppLocaleCode].title}
                      onChange={(e) =>
                        setTranslations((p) => ({
                          ...p,
                          [lang]: {
                            ...p[lang as AppLocaleCode],
                            title: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="editor-field">
                    <span className="editor-field__label">Kratki opis</span>
                    <textarea
                      className="editor-textarea"
                      rows={2}
                      value={translations[lang as AppLocaleCode].shortDescription}
                      onChange={(e) =>
                        setTranslations((p) => ({
                          ...p,
                          [lang]: {
                            ...p[lang as AppLocaleCode],
                            shortDescription: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="editor-field">
                    <span className="editor-field__label">Opis</span>
                    <textarea
                      className="editor-textarea"
                      rows={3}
                      value={translations[lang as AppLocaleCode].description}
                      onChange={(e) =>
                        setTranslations((p) => ({
                          ...p,
                          [lang]: {
                            ...p[lang as AppLocaleCode],
                            description: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="editor-field">
                    <span className="editor-field__label">Oblik</span>
                    <input
                      className="editor-input"
                      value={translations[lang as AppLocaleCode].shape}
                      onChange={(e) =>
                        setTranslations((p) => ({
                          ...p,
                          [lang]: {
                            ...p[lang as AppLocaleCode],
                            shape: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              ))}
            </details>
          </>
        )}
      </div>

      {progress ? (
        <div
          className="auto-editor__progress"
          role="progressbar"
          aria-valuenow={progress.done}
          aria-valuemin={0}
          aria-valuemax={progress.total}
        >
          <div
            className="auto-editor__progress-bar"
            style={{
              width: `${
                progress.total === 0
                  ? 100
                  : Math.round((progress.done / progress.total) * 100)
              }%`,
            }}
          />
          <span className="auto-editor__progress-label">
            {progress.total === 0
              ? "Nema stavki za prijevod"
              : `${progress.done}/${progress.total} prevedeno`}
          </span>
        </div>
      ) : null}

      {info ? <p className="editor-info-ok">{info}</p> : null}
      {warnings.length > 0 ? (
        <ul className="auto-editor__warnings">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
      {savedFlash ? <span className="editor-saved">Spremljeno</span> : null}

      <div className="editor-products-footer-action">
        <button
          type="button"
          className={`editor-btn ${mode === "delete" ? "editor-btn--danger" : "editor-btn--primary"}`}
          disabled={busy}
          onClick={() => void (mode === "delete" ? deleteProduct() : saveOrUpdate())}
        >
          {busy ? "Obrada…" : actionLabel}
        </button>
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════
 * SEKCIJA 2 — KOLEKCIJE
 * ═════════════════════════════════════════════════════════════════ */

type CollectionCopyFields = { title: string; description: string };

function emptyCollectionLangMap(): Record<AppLocaleCode, CollectionCopyFields> {
  const out = {} as Record<AppLocaleCode, CollectionCopyFields>;
  for (const code of TARGET_LANGS) {
    out[code as AppLocaleCode] = { title: "", description: "" };
  }
  return out;
}

function CollectionEditorSection({
  draft,
  setDraft,
  onPersistSettings,
}: SectionProps) {
  const [mode, setMode] = useState<Mode>("create");
  const [slug, setSlug] = useState("");
  const [prevSlug, setPrevSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [translations, setTranslations] = useState<
    Record<AppLocaleCode, CollectionCopyFields>
  >(emptyCollectionLangMap());

  const [autoTranslate, setAutoTranslate] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [info, setInfo] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);

  const slugOptions = useMemo(
    () => collections.map((c) => c.slug).sort(),
    []
  );

  useEffect(() => {
    if (mode === "create" || !slug.trim()) return;
    const base = collections.find((c) => c.slug === slug);
    const ov = draft.collectionOverrides[slug] ?? null;
    if (!base && !ov) return;
    const merged = base ? mergeCollection(base, ov, "hr") : null;
    setTitle(merged?.title ?? String(ov?.title ?? ""));
    setDescription(merged?.description ?? String(ov?.description ?? ""));
    setHeroImage(merged?.heroImage ?? String(ov?.heroImage ?? ""));
    setPrevSlug(slug.trim());
    const tr = emptyCollectionLangMap();
    for (const lang of TARGET_LANGS) {
      tr[lang as AppLocaleCode] = {
        title: String(ov?.translations?.[lang as AppLocaleCode]?.title ?? ""),
        description: String(
          ov?.translations?.[lang as AppLocaleCode]?.description ?? ""
        ),
      };
    }
    setTranslations(tr);
  }, [mode, slug, draft.collectionOverrides]);

  const resetForm = () => {
    setSlug("");
    setPrevSlug("");
    setTitle("");
    setDescription("");
    setHeroImage("");
    setTranslations(emptyCollectionLangMap());
  };

  const runTranslate = useCallback(
    async (hr: CollectionCopyFields) => {
      const res = await runBuildTranslations({
        fields: ["title", "description"] as const,
        hrSource: hr,
        current: translations,
        overwrite: overwriteExisting,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setTranslations(res.map);
      return res;
    },
    [translations, overwriteExisting]
  );

  const onDropHero = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setBusy(true);
    setInfo("Uploadam hero sliku…");
    try {
      const path = await uploadImageToServer(file, `kolekcija-${slug || "x"}`);
      setHeroImage(path);
      setInfo(`Spremljena hero slika: ${path}`);
    } catch (err) {
      setInfo(err instanceof Error ? err.message : "Upload nije uspio.");
    } finally {
      setBusy(false);
    }
  };

  const persistCollectionOverride = (
    savedSlug: string,
    trMap: Record<AppLocaleCode, CollectionCopyFields>
  ) => {
    setDraft((d) => {
      const nextOv = { ...d.collectionOverrides };
      if (prevSlug && prevSlug !== savedSlug) delete nextOv[prevSlug];
      const prev = nextOv[savedSlug] ?? {};
      nextOv[savedSlug] = {
        ...prev,
        translations: {
          ...(prev.translations ?? {}),
          ...Object.fromEntries(
            TARGET_LANGS.map((lang) => [lang, trMap[lang as AppLocaleCode]])
          ),
        },
      };
      const newDraft = { ...d, collectionOverrides: nextOv };
      onPersistSettings(newDraft);
      return newDraft;
    });
  };

  const saveOrUpdate = async () => {
    const trimmedSlug = slug.trim();
    if (!trimmedSlug && !title.trim()) {
      setInfo("Unesite naslov ili slug kolekcije.");
      return;
    }
    if (!title.trim() && mode === "create") {
      setInfo("Unesite naslov kolekcije na hrvatskom.");
      return;
    }
    setBusy(true);
    setWarnings([]);
    setInfo(null);
    try {
      const hr: CollectionCopyFields = {
        title: title.trim(),
        description: description.trim(),
      };
      let trMap = translations;
      const msgs: string[] = [];
      if (autoTranslate) {
        setInfo("Prevodim HR tekst kolekcije (MyMemory, besplatno)…");
        const res = await runTranslate(hr);
        trMap = res.map;
        if (res.failed.length) {
          msgs.push(`Neprevedeni jezici: ${res.failed.join(", ")}.`);
        }
        msgs.push(`Prevedeno ${res.translatedCount}/${res.totalRequested} polja.`);
      }

      const payload = {
        mode: mode === "create" ? "create" : "update",
        slug: trimmedSlug || title.trim(),
        title: hr.title,
        description: hr.description,
        heroImage: heroImage.trim(),
        prevSlug: mode === "edit" ? prevSlug || trimmedSlug : undefined,
      };
      setInfo((prev) =>
        prev
          ? `${prev} Zapisujem kolekciju u storeCatalog.json…`
          : "Zapisujem kolekciju…"
      );
      const r = await fetch("/__editor__/collection-upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        slug?: string;
        id?: string;
        title?: string;
        created?: boolean;
      };
      if (!r.ok || !j.ok || !j.slug) {
        throw new Error(
          j.error ??
            "Spremanje kolekcije nije uspjelo. Pokreni dev-server preko 'otvori-urednik-auto.bat'."
        );
      }
      persistCollectionOverride(j.slug, trMap);
      setWarnings(msgs);
      setInfo(
        `Uspješno ${j.created ? "spremljena nova" : "prepravljena"} kolekcija "${j.title}" (${j.slug}).`
      );
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2200);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "Spremanje nije uspjelo.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setProgress(null), 1200);
    }
  };

  const deleteCollection = async () => {
    const s = slug.trim();
    if (!s) {
      setInfo("Odaberi slug kolekcije za brisanje.");
      return;
    }
    if (
      !window.confirm(
        `Obrisati kolekciju "${s}"? Artikli iz te kolekcije se ne brišu, samo im se odveže veza.`
      )
    )
      return;
    setBusy(true);
    try {
      const r = await fetch("/__editor__/collection-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: s }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        productsAffected?: number;
      };
      if (!r.ok || !j.ok) {
        throw new Error(j.error ?? "Brisanje kolekcije nije uspjelo.");
      }
      setDraft((d) => {
        const nextOv = { ...d.collectionOverrides };
        delete nextOv[s];
        const newDraft = { ...d, collectionOverrides: nextOv };
        onPersistSettings(newDraft);
        return newDraft;
      });
      setInfo(
        `Obrisana kolekcija "${s}". Odvezano artikala: ${j.productsAffected ?? 0}.`
      );
      resetForm();
      window.setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "Brisanje nije uspjelo.");
    } finally {
      setBusy(false);
    }
  };

  const runManualTranslate = async () => {
    if (!title.trim()) {
      setInfo("Unesi HR naslov kolekcije prije prevođenja.");
      return;
    }
    setBusy(true);
    setWarnings([]);
    try {
      const res = await runTranslate({
        title: title.trim(),
        description: description.trim(),
      });
      const msgs = [`Prevedeno ${res.translatedCount}/${res.totalRequested} polja.`];
      if (res.failed.length) msgs.push(`Neuspjeli jezici: ${res.failed.join(", ")}.`);
      setWarnings(msgs);
      setInfo("Prijevodi kolekcije osvježeni (još nije spremljeno — klikni „Spremi”).");
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "Prijevod nije uspio.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setProgress(null), 1200);
    }
  };

  const actionLabel =
    mode === "create"
      ? "Spremi novu kolekciju"
      : mode === "edit"
        ? "Spremi promjene kolekcije"
        : "Obriši kolekciju";

  return (
    <section className="editor-card editor-card--wide">
      <h2>2) Kolekcije</h2>

      <div className="editor-products-tabs" role="tablist">
        <button
          type="button"
          className={`editor-btn ${mode === "create" ? "editor-btn--primary" : "editor-btn--ghost"}`}
          onClick={() => {
            setMode("create");
            resetForm();
          }}
          role="tab"
          aria-selected={mode === "create"}
        >
          Nova kolekcija
        </button>
        <button
          type="button"
          className={`editor-btn ${mode === "edit" ? "editor-btn--primary" : "editor-btn--ghost"}`}
          onClick={() => setMode("edit")}
          role="tab"
          aria-selected={mode === "edit"}
        >
          Prepravi postojeću
        </button>
        <button
          type="button"
          className={`editor-btn ${mode === "delete" ? "editor-btn--danger" : "editor-btn--ghost"}`}
          onClick={() => setMode("delete")}
          role="tab"
          aria-selected={mode === "delete"}
        >
          Obriši
        </button>
      </div>

      <fieldset className="auto-editor__toggles">
        <legend>Automatski prijevod kolekcije</legend>
        <label className="auto-editor__toggle">
          <input
            type="checkbox"
            checked={autoTranslate}
            onChange={(e) => setAutoTranslate(e.target.checked)}
          />
          <span>
            <strong>Auto-prevedi pri spremanju</strong> — prevede naslov i opis kolekcije na 7 jezika.
          </span>
        </label>
        <label className="auto-editor__toggle">
          <input
            type="checkbox"
            checked={overwriteExisting}
            onChange={(e) => setOverwriteExisting(e.target.checked)}
            disabled={!autoTranslate}
          />
          <span>Prepiši i već popunjena polja prijevoda.</span>
        </label>
      </fieldset>

      <div className="editor-card__group">
        <label className="editor-field">
          <span className="editor-field__label">
            Slug kolekcije {mode === "create" ? "(auto iz naslova ako ostaviš prazno)" : ""}
          </span>
          <input
            className="editor-input"
            list="auto-editor-collection-slugs"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="npr. daske"
          />
          <datalist id="auto-editor-collection-slugs">
            {slugOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        {mode !== "delete" && (
          <>
            <label className="editor-field">
              <span className="editor-field__label">Naslov kolekcije (HR)</span>
              <input
                className="editor-input"
                placeholder="npr. Daske za rezanje"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className="editor-field">
              <span className="editor-field__label">Opis kolekcije (HR)</span>
              <textarea
                className="editor-textarea"
                rows={4}
                placeholder="Tekst koji se prikazuje iznad artikala na stranici kolekcije"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="editor-products-drop-grid editor-products-drop-grid--single">
              <div
                className="editor-products-drop"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => void onDropHero(e)}
              >
                <strong>Hero slika kolekcije</strong>
                <span>Povuci sliku iz Explorera</span>
                <code>{heroImage || "nema slike"}</code>
              </div>
            </div>

            <div className="auto-editor__actions">
              <button
                type="button"
                className="editor-btn editor-btn--ghost"
                disabled={busy}
                onClick={() => void runManualTranslate()}
              >
                {busy && progress
                  ? `Prevodim ${progress.done}/${progress.total}…`
                  : "Preveči sada (bez spremanja)"}
              </button>
              <span className="auto-editor__hint">
                Kolekcije imaju samo naslov i opis (2 polja po jeziku).
              </span>
            </div>

            <details className="auto-editor__lang-panel">
              <summary>
                Pogledaj / uredi prijevode ({TARGET_LANGS.length} jezika)
              </summary>
              {TARGET_LANGS.map((lang) => (
                <div key={lang} className="editor-card__group">
                  <h4 className="editor-card__group-title">{lang.toUpperCase()}</h4>
                  <label className="editor-field">
                    <span className="editor-field__label">Naslov</span>
                    <input
                      className="editor-input"
                      value={translations[lang as AppLocaleCode].title}
                      onChange={(e) =>
                        setTranslations((p) => ({
                          ...p,
                          [lang]: {
                            ...p[lang as AppLocaleCode],
                            title: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="editor-field">
                    <span className="editor-field__label">Opis</span>
                    <textarea
                      className="editor-textarea"
                      rows={3}
                      value={translations[lang as AppLocaleCode].description}
                      onChange={(e) =>
                        setTranslations((p) => ({
                          ...p,
                          [lang]: {
                            ...p[lang as AppLocaleCode],
                            description: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              ))}
            </details>
          </>
        )}
      </div>

      {progress ? (
        <div
          className="auto-editor__progress"
          role="progressbar"
          aria-valuenow={progress.done}
          aria-valuemin={0}
          aria-valuemax={progress.total}
        >
          <div
            className="auto-editor__progress-bar"
            style={{
              width: `${
                progress.total === 0
                  ? 100
                  : Math.round((progress.done / progress.total) * 100)
              }%`,
            }}
          />
          <span className="auto-editor__progress-label">
            {progress.total === 0
              ? "Nema stavki za prijevod"
              : `${progress.done}/${progress.total} prevedeno`}
          </span>
        </div>
      ) : null}

      {info ? <p className="editor-info-ok">{info}</p> : null}
      {warnings.length > 0 ? (
        <ul className="auto-editor__warnings">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
      {savedFlash ? <span className="editor-saved">Spremljeno</span> : null}

      <div className="editor-products-footer-action">
        <button
          type="button"
          className={`editor-btn ${mode === "delete" ? "editor-btn--danger" : "editor-btn--primary"}`}
          disabled={busy}
          onClick={() =>
            void (mode === "delete" ? deleteCollection() : saveOrUpdate())
          }
        >
          {busy ? "Obrada…" : actionLabel}
        </button>
      </div>
    </section>
  );
}
