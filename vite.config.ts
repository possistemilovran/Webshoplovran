import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { editorImageUploadPlugin } from "./vite-plugins/editorImageUpload";
import { translateProxyPlugin } from "./vite-plugins/translateProxy";

/**
 * `pokreni_urednik v2.bat` postavi OLIVO_OPEN_EDITOR=1 i pokreće
 * `node node_modules/vite/bin/vite.js --port 5173 --strictPort` — Vite otvara /editor.
 * (CMD + `npm run dev -- --open …` često krivo parsira `/`.)
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devOpen: boolean | string =
    process.env.OLIVO_OPEN_EDITOR === "1" ? "/editor" : false;

  const upstreamRaw = env.LIBRETRANSLATE_UPSTREAM?.trim();
  const upstreamUrls = upstreamRaw
    ? upstreamRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  return {
    plugins: [
      react(),
      translateProxyPlugin({
        apiKey: env.LIBRETRANSLATE_API_KEY,
        upstreamUrls,
        googleApiKey: env.GOOGLE_TRANSLATION_API_KEY,
        deeplAuthKey: env.DEEPL_AUTH_KEY || env.DEEPL_API_KEY,
        deeplApiUrl: env.DEEPL_API_URL,
      }),
      editorImageUploadPlugin(),
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    server: {
      port: 5173,
      /** Ako je 5173 zauzet, Vite bira sljedeći slobodan (preglednik dobije točan URL). */
      strictPort: false,
      open: devOpen,
    },
  };
});
