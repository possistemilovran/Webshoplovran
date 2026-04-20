/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Apsolutni URL ili putanja (npr. /api/translate) za POST proxy prema LibreTranslate u produkciji. */
  readonly VITE_TRANSLATE_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
