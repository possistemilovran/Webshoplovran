import { FONT_PRESETS, type SiteSettings } from "@/config/siteDefaults";

/**
 * Ubacuje Google Fonts linkove. `scope` odvoji urednički pregled od produkcijskog
 * da se cleanup ne međusobno briše.
 */
export function injectGoogleFontLinks(
  fonts: SiteSettings["fonts"],
  scope: "app" | "editor"
): void {
  const attrPrefix = scope === "app" ? "app" : "ed";
  document
    .querySelectorAll(`link[data-olivo-gf^="${attrPrefix}-"]`)
    .forEach((el) => el.remove());

  const params = new Set<string>();
  const add = (presetId: string) => {
    const g = FONT_PRESETS[presetId]?.google;
    if (g) params.add(g);
  };
  add(fonts.headingPresetId);
  add(fonts.bodyPresetId);
  add(fonts.headerNavPresetId);

  let i = 0;
  for (const p of params) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${p}&display=swap`;
    link.setAttribute("data-olivo-gf", `${attrPrefix}-${i++}`);
    document.head.appendChild(link);
  }
}
