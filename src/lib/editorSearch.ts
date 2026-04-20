/** Filtriranje sekcija urednika po jednostavnom podstringu (bez dijakritike normalizacije). */
export function matchesEditorSectionQuery(
  query: string,
  keywords: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return keywords.toLowerCase().includes(q);
}

/** Tražilica tekstova: oznaka polja, hint, putanja (npr. nav.home) ili trenutna vrijednost. */
export function matchesEditorTextFieldQuery(
  query: string,
  parts: {
    label: string;
    hint?: string;
    path?: string;
    value?: string;
  }
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const blob = [parts.label, parts.hint ?? "", parts.path ?? "", parts.value ?? ""]
    .join("\n")
    .toLowerCase();
  return blob.includes(q);
}
