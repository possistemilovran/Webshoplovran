import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";
import { collections, products } from "@/data/catalog";
import { type AppLocaleCode, type SiteSettings, mergeProduct } from "@/config/siteDefaults";
import { BUNDLED_LOCALE_CODES } from "@/i18n/bundledLocales";
import { translateFromHr, verifyTranslateProxy } from "@/lib/machineTranslate";
import { suggestNextKomadSlugForCollection } from "@/lib/suggestKomadProductSlug";

type Props = {
  draft: SiteSettings;
  setDraft: Dispatch<SetStateAction<SiteSettings>>;
  onPersistSettings: (next: SiteSettings) => void;
};

type Mode = "create" | "edit" | "delete";
type CopyFields = { title: string; shortDescription: string; description: string };

const TARGET_LANGS = BUNDLED_LOCALE_CODES.filter((x) => x !== "hr");

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const out = String(r.result ?? "");
      const comma = out.indexOf(",");
      resolve(comma >= 0 ? out.slice(comma + 1) : out);
    };
    r.onerror = () => reject(new Error("Čitanje datoteke nije uspjelo."));
    r.readAsDataURL(file);
  });
}

function sameText(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

function emptyLangMap(): Record<AppLocaleCode, CopyFields> {
  const out = {} as Record<AppLocaleCode, CopyFields>;
  for (const code of TARGET_LANGS) {
    out[code] = { title: "", shortDescription: "", description: "" };
  }
  return out;
}

export function EditorProductsOnly({ draft, setDraft, onPersistSettings }: Props) {
  const [mode, setMode] = useState<Mode>("create");
  const [slug, setSlug] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [mainImage, setMainImage] = useState("");
  const [extraImages, setExtraImages] = useState<string[]>(["", "", "", ""]);
  const [translations, setTranslations] = useState<Record<AppLocaleCode, CopyFields>>(
    emptyLangMap()
  );
  const [busy, setBusy] = useState(false);
  const [autoFillBusy, setAutoFillBusy] = useState(false);
  const [translateVerifyBusy, setTranslateVerifyBusy] = useState(false);
  const [translateVerify, setTranslateVerify] = useState<{
    ok: boolean;
    message: string;
    preview?: string;
  } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [logPath, setLogPath] = useState<string>("/editor-artikli-log.txt");

  const productOptions = useMemo(
    () => [...products.map((p) => p.slug), ...Object.keys(draft.productOverrides)].sort(),
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
  }, [
    mode,
    collectionId,
    draft.productOverrides,
    draft.productCollectionAssignments,
  ]);

  const uploadToProject = async (file: File): Promise<string> => {
    const b64 = await fileToBase64(file);
    const ext = file.type.includes("png") ? ".png" : file.type.includes("webp") ? ".webp" : ".jpg";
    const body = {
      filename: `${slug || "artikl"}-${Date.now()}${ext}`,
      dataBase64: b64,
      mime: file.type || "image/jpeg",
    };
    const r = await fetch("/__editor__/save-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await r.json()) as { ok?: boolean; path?: string; error?: string };
    if (!r.ok || !j.ok || !j.path) {
      throw new Error(j.error ?? "Upload slike nije uspio.");
    }
    return j.path;
  };

  useEffect(() => {
    if (mode === "create") return;
    const base = products.find((p) => p.slug === slug);
    const ov = draft.productOverrides[slug] ?? null;
    if (!base && !ov) return;
    const merged = base ? mergeProduct(base, ov, "hr") : null;
    const firstCollection = merged?.collectionIds?.[0] ?? base?.collectionIds?.[0] ?? "";
    setCollectionId(firstCollection);
    setTitle(merged?.title ?? String(ov?.title ?? ""));
    setShortDescription(merged?.shortDescription ?? String(ov?.shortDescription ?? ""));
    setDescription(merged?.description ?? String(ov?.description ?? ""));
    setPrice(String(merged?.price ?? ov?.price ?? ""));
    const imgs =
      merged?.images?.length ? merged.images : merged?.image ? [merged.image] : [];
    setMainImage(imgs[0] ?? "");
    setExtraImages([imgs[1] ?? "", imgs[2] ?? "", imgs[3] ?? "", imgs[4] ?? ""]);
    const tr = emptyLangMap();
    for (const lang of TARGET_LANGS) {
      tr[lang] = {
        title: String(ov?.translations?.[lang]?.title ?? ""),
        shortDescription: String(ov?.translations?.[lang]?.shortDescription ?? ""),
        description: String(ov?.translations?.[lang]?.description ?? ""),
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
    setInfo("Uploadam sliku...");
    try {
      const path = await uploadToProject(file);
      if (target === "main") setMainImage(path);
      else setExtraImages((prev) => prev.map((x, i) => (i === target ? path : x)));
      setInfo(`Spremljena slika: ${path}`);
    } catch (e2) {
      setInfo(e2 instanceof Error ? e2.message : "Upload nije uspio.");
    } finally {
      setBusy(false);
    }
  };

  const persistDraftForSlug = (
    savedSlug: string,
    translatedMap: Record<AppLocaleCode, CopyFields>
  ) => {
    const gallery = [mainImage, ...extraImages].map((x) => x.trim()).filter(Boolean);
    setDraft((d) => {
      const prev = d.productOverrides[savedSlug] ?? {};
      const next = {
        ...prev,
        title: title.trim(),
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        price: Number(price || 0),
        image: gallery[0] ?? "",
        images: gallery,
        translations: {
          ...(prev.translations ?? {}),
          ...Object.fromEntries(TARGET_LANGS.map((lang) => [lang, translatedMap[lang]])),
        },
      };
      const newDraft = {
        ...d,
        productOverrides: { ...d.productOverrides, [savedSlug]: next },
      };
      onPersistSettings(newDraft);
      return newDraft;
    });
  };

  const buildAutoTranslations = async (): Promise<{
    map: Record<AppLocaleCode, CopyFields>;
    failedLangs: string[];
  }> => {
    const hr = {
      title: title.trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
    };
    const out = { ...translations };
    const failed = new Set<string>();
    for (const lang of TARGET_LANGS) {
      const prev = out[lang] ?? { title: "", shortDescription: "", description: "" };
      const next: CopyFields = { ...prev };

      if (hr.title) {
        if (!prev.title.trim()) {
          const t = await translateFromHr(hr.title, lang, { artikliEditor: true });
          if (!sameText(t, hr.title)) next.title = t;
          else failed.add(lang.toUpperCase());
        }
      }
      if (hr.shortDescription) {
        if (!prev.shortDescription.trim()) {
          const t = await translateFromHr(hr.shortDescription, lang, { artikliEditor: true });
          if (!sameText(t, hr.shortDescription)) next.shortDescription = t;
          else failed.add(lang.toUpperCase());
        }
      }
      if (hr.description) {
        if (!prev.description.trim()) {
          const t = await translateFromHr(hr.description, lang, { artikliEditor: true });
          if (!sameText(t, hr.description)) next.description = t;
          else failed.add(lang.toUpperCase());
        }
      }
      out[lang] = next;
    }
    return { map: out, failedLangs: [...failed] };
  };

  const fillEmptyTranslationFields = async () => {
    setAutoFillBusy(true);
    setInfo("Popunjavam prazna jezična polja...");
    try {
      const { map: translatedMap, failedLangs } = await buildAutoTranslations();
      setTranslations(translatedMap);
      setInfo(
        failedLangs.length > 0
          ? `Djelomično popunjeno. Ovi jezici nisu prevedeni (vraćen HR): ${failedLangs.join(
              ", "
            )}. Provjeri DEEPL_AUTH_KEY i proxy /__translate__/artikli.`
          : "Prazna jezična polja su popunjena. Sada klikni USNIMI ili PREPRAVI."
      );
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "Automatsko popunjavanje nije uspjelo.");
    } finally {
      setAutoFillBusy(false);
    }
  };

  const runTranslateProxyCheck = async () => {
    setTranslateVerifyBusy(true);
    setTranslateVerify(null);
    try {
      const r = await verifyTranslateProxy();
      setTranslateVerify({
        ok: r.ok,
        message: r.message,
        preview: r.translatedPreview,
      });
    } catch (e) {
      setTranslateVerify({
        ok: false,
        message: e instanceof Error ? e.message : "Provjera nije uspjela.",
      });
    } finally {
      setTranslateVerifyBusy(false);
    }
  };

  const clearAllTranslationFields = () => {
    if (
      !window.confirm(
        "Obrisati sav prijevodni tekst za sve jezike osim hrvatskog? HR naslov, kratki opis i opis ostaju u poljima iznad."
      )
    )
      return;
    setTranslations(emptyLangMap());
    setInfo(
      "Jezična polja prijevoda su obrisana u obrascu. Za trajno uklanjanje s portala klikni PREPRAVI (ili USNIMI)."
    );
  };

  const saveOrUpdate = async () => {
    if (!slug.trim()) {
      setInfo("Unesite slug artikla.");
      return;
    }
    setBusy(true);
    setInfo(null);
    try {
      setInfo("Auto-prevodim artikl na sve jezike...");
      const { map: translatedMap, failedLangs } = await buildAutoTranslations();
      setTranslations(translatedMap);

      const payload = {
        mode: mode === "create" ? "create" : "update",
        slug: slug.trim(),
        title: title.trim(),
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        price: Number(price || 0),
        collectionId: collectionId.trim(),
        image: mainImage.trim(),
        images: extraImages.map((x) => x.trim()).filter(Boolean),
      };
      const r = await fetch("/__editor__/product-upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; slug?: string; logPath?: string };
      if (!r.ok || !j.ok || !j.slug) throw new Error(j.error ?? "Spremanje nije uspjelo.");
      if (j.logPath) setLogPath(j.logPath);
      setTranslations(translatedMap);
      persistDraftForSlug(j.slug, translatedMap);
      setInfo(
        `${mode === "create" ? "USNIMI" : "PREPRAVI"} uspješno za "${j.slug}" (auto-prijevod uključen).${
          failedLangs.length > 0
            ? ` Neprevedeni jezici (vraćen HR): ${failedLangs.join(", ")}.`
            : ""
        } Log: ${j.logPath ?? logPath}`
      );
      window.setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "Akcija nije uspjela.");
    } finally {
      setBusy(false);
    }
  };

  const deleteProduct = async () => {
    if (!slug.trim()) {
      setInfo("Odaberite slug za brisanje.");
      return;
    }
    if (!window.confirm(`Obrisati artikl "${slug}"?`)) return;
    setBusy(true);
    try {
      const r = await fetch("/__editor__/product-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim() }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; logPath?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Brisanje nije uspjelo.");
      if (j.logPath) setLogPath(j.logPath);
      setDraft((d) => {
        const nextOv = { ...d.productOverrides };
        delete nextOv[slug.trim()];
        const nextAssign = { ...d.productCollectionAssignments };
        delete nextAssign[slug.trim()];
        const newDraft = {
          ...d,
          productOverrides: nextOv,
          productCollectionAssignments: nextAssign,
        };
        onPersistSettings(newDraft);
        return newDraft;
      });
      setInfo(`BRIŠI uspješno za "${slug}". Log: ${j.logPath ?? logPath}`);
      window.setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "Brisanje nije uspjelo.");
    } finally {
      setBusy(false);
    }
  };

  const actionLabel = mode === "create" ? "USNIMI" : mode === "edit" ? "PREPRAVI" : "BRIŠI";

  return (
    <section className="editor-card editor-card--wide">
      <h2>Urednik-ARTIKLI</h2>
      <div className="editor-products-tabs">
        <button type="button" className={`editor-btn ${mode === "create" ? "editor-btn--primary" : "editor-btn--ghost"}`} onClick={() => setMode("create")}>Novi artikl</button>
        <button type="button" className={`editor-btn ${mode === "edit" ? "editor-btn--primary" : "editor-btn--ghost"}`} onClick={() => setMode("edit")}>Edit postojećeg</button>
        <button type="button" className={`editor-btn ${mode === "delete" ? "editor-btn--danger" : "editor-btn--ghost"}`} onClick={() => setMode("delete")}>Potpuno brisanje</button>
      </div>

      <div className="editor-card__group">
        <label className="editor-field">
          <span className="editor-field__label">Slug artikla</span>
          <input className="editor-input" list="products-only-slugs" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <datalist id="products-only-slugs">
            {productOptions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>
        {mode !== "delete" && (
          <>
            <label className="editor-field"><span className="editor-field__label">Kolekcija</span>
              <select className="editor-input" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
                <option value="">— odaberi kolekciju —</option>
                {collections.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.slug})</option>)}
              </select>
            </label>
            <input className="editor-input" placeholder="Naslov" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="editor-textarea" rows={2} placeholder="Kratki opis" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
            <textarea className="editor-textarea" rows={4} placeholder="Opis" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input className="editor-input editor-input--narrow" type="number" min={0} step={0.01} placeholder="Cijena" value={price} onChange={(e) => setPrice(e.target.value)} />
            <div className="editor-products-drop-grid">
              <div className="editor-products-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => void onDropImage(e, "main")}>
                <strong>Glavna slika</strong>
                <span>Povuci iz HDD mišem ovdje</span>
                <code>{mainImage || "nema slike"}</code>
              </div>
              {extraImages.map((img, i) => (
                <div key={i} className="editor-products-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => void onDropImage(e, i)}>
                  <strong>Pomoćna slika {i + 1}</strong>
                  <span>Povuci iz HDD mišem ovdje</span>
                  <code>{img || "nema slike"}</code>
                </div>
              ))}
            </div>
            <h3 className="editor-card__group-title">Prijevodi samo za ovaj artikl</h3>
            <p className="editor-hint editor-hint--inline editor-hint--tight">
              Klik na gumb ispod popunjava samo prazna polja prijevoda (postojeći tekst ostaje).
            </p>
            <p className="editor-hint editor-hint--inline editor-hint--tight">
              Strojni prijevod u ovom uređivaču ide isključivo preko{" "}
              <strong>DeepL Free</strong> (<code>/__translate__/artikli</code>). U <code>.env</code> postavi{" "}
              <code>DEEPL_AUTH_KEY</code> (
              <a href="https://www.deepl.com/pro-api" target="_blank" rel="noreferrer">
                deepl.com/pro-api
              </a>
              ). Za Pro plan opcionalno <code>DEEPL_API_URL=https://api.deepl.com/v2/translate</code>. Ostatak stranice i
              drugi uređivači i dalje koriste <code>/__translate__</code> (Google / DeepL / LibreTranslate).
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="button"
                className="editor-btn editor-btn--ghost"
                disabled={busy || autoFillBusy}
                onClick={() => void fillEmptyTranslationFields()}
              >
                {autoFillBusy ? "Popunjavam prijevode..." : "Popuni prazna jezična polja"}
              </button>
              <button
                type="button"
                className="editor-btn editor-btn--ghost"
                disabled={busy || autoFillBusy || translateVerifyBusy}
                onClick={() => void runTranslateProxyCheck()}
              >
                {translateVerifyBusy ? "Provjeravam proxy…" : "Provjeri proxy za prijevod"}
              </button>
              <button
                type="button"
                className="editor-btn editor-btn--danger"
                disabled={busy || autoFillBusy}
                onClick={clearAllTranslationFields}
              >
                OBRIŠI SVA JEZIČNA POLJA
              </button>
            </div>
            {translateVerify ? (
              <div
                className={translateVerify.ok ? "editor-info-ok" : "editor-info-warn"}
                role="status"
              >
                <p style={{ margin: 0 }}>{translateVerify.message}</p>
                {translateVerify.preview ? (
                  <p className="editor-translate-log__line" style={{ margin: "0.35rem 0 0" }}>
                    {translateVerify.preview}
                  </p>
                ) : null}
              </div>
            ) : null}
            {TARGET_LANGS.map((lang) => (
              <div key={lang} className="editor-card__group">
                <h4 className="editor-card__group-title">{lang.toUpperCase()}</h4>
                <input className="editor-input" placeholder={`Naslov ${lang.toUpperCase()}`} value={translations[lang].title} onChange={(e) => setTranslations((p) => ({ ...p, [lang]: { ...p[lang], title: e.target.value } }))} />
                <textarea className="editor-textarea" rows={2} placeholder={`Kratki opis ${lang.toUpperCase()}`} value={translations[lang].shortDescription} onChange={(e) => setTranslations((p) => ({ ...p, [lang]: { ...p[lang], shortDescription: e.target.value } }))} />
                <textarea className="editor-textarea" rows={3} placeholder={`Opis ${lang.toUpperCase()}`} value={translations[lang].description} onChange={(e) => setTranslations((p) => ({ ...p, [lang]: { ...p[lang], description: e.target.value } }))} />
              </div>
            ))}
          </>
        )}
      </div>

      {info ? <p className="editor-info-ok">{info}</p> : null}
      <p className="editor-hint">Tijek rada se zapisuje u tekstualni fajl: <code>{logPath}</code></p>

      <div className="editor-products-footer-action">
        <button
          type="button"
          className={`editor-btn ${mode === "delete" ? "editor-btn--danger" : "editor-btn--primary"}`}
          disabled={busy || autoFillBusy}
          onClick={() => void (mode === "delete" ? deleteProduct() : saveOrUpdate())}
        >
          {busy ? "Obrada..." : actionLabel}
        </button>
      </div>
    </section>
  );
}
