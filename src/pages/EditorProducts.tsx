import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { SiteSettings } from "@/config/siteDefaults";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { siteSettingsToCssVarsStyle } from "@/lib/themeCssVars";
import { EditorProductsOnly } from "@/editor/EditorProductsOnly";

export function EditorProducts() {
  const { settings, setSettings } = useSiteSettings();
  const [draft, setDraft] = useState<SiteSettings>(settings);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.classList.add("editor-route");
    return () => document.documentElement.classList.remove("editor-route");
  }, []);

  const save = () => {
    setSettings(draft);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  return (
    <div className="editor-page" style={siteSettingsToCssVarsStyle(draft)}>
      <header className="editor-page__head">
        <div>
          <h1 className="editor-page__title">Urednik-ARTIKLI</h1>
          <p className="editor-page__sub">
            Jedan prozor za unos novog artikla, prepravak postojećeg i potpuno brisanje.
          </p>
        </div>
        <div className="editor-page__actions">
          <Link to="/" className="editor-btn editor-btn--ghost">
            ← Natrag na stranicu
          </Link>
          <Link to="/urednik-auto" className="editor-btn editor-btn--ghost">
            Urednik AUTO (besplatni prijevod)
          </Link>
          <button type="button" className="editor-btn editor-btn--primary" onClick={save}>
            Spremi promjene
          </button>
          {savedFlash ? <span className="editor-saved">Spremljeno</span> : null}
        </div>
      </header>
      <div className="editor-grid">
        <EditorProductsOnly
          draft={draft}
          setDraft={setDraft}
          onPersistSettings={setSettings}
        />
      </div>
    </div>
  );
}
