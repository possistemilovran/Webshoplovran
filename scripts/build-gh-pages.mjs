import { spawnSync } from "node:child_process";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")?.[1]?.trim();
const fromEnv = process.env.GH_PAGES_BASE?.trim();
const fallbackBase = repoName ? `/${repoName}/` : "/Webshoplovran/";
const rawBase = fromEnv || fallbackBase;
const base = rawBase.startsWith("/") ? rawBase : `/${rawBase}`;
const normalizedBase = base.endsWith("/") ? base : `${base}/`;

const tsc = spawnSync("npx", ["tsc", "--noEmit"], { stdio: "inherit", shell: true });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const vite = spawnSync(
  "npx",
  ["vite", "build", "--base", normalizedBase],
  { stdio: "inherit", shell: true }
);
if (vite.status !== 0) process.exit(vite.status ?? 1);

console.log(`[build:gh-pages] Base path: ${normalizedBase}`);
