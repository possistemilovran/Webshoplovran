/** Helpers to build lighter/darker shades from a hex color (editor color picker). */

function normalizeHex(hex: string): string | null {
  const t = hex.trim();
  if (!t.startsWith("#")) return null;
  let h = t.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return null;
  return h.toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function clamp255(x: number) {
  return Math.round(Math.max(0, Math.min(255, x)));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => clamp255(x).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** t=0 → original, t=1 → white */
export function mixWithWhite(hex: string, t: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const u = Math.max(0, Math.min(1, t));
  return rgbToHex(
    rgb.r + (255 - rgb.r) * u,
    rgb.g + (255 - rgb.g) * u,
    rgb.b + (255 - rgb.b) * u
  );
}

/** t=0 → original, t=1 → black */
export function mixWithBlack(hex: string, t: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const u = Math.max(0, Math.min(1, t));
  return rgbToHex(rgb.r * (1 - u), rgb.g * (1 - u), rgb.b * (1 - u));
}

/**
 * Vertikalni gradijent pozadine: od svijetlije prema tamnijoj iste nijanse.
 * Omjeri su namješteni da ostane blago, čitljivo.
 */
export function pageBackgroundGradient(hex: string): {
  light: string;
  dark: string;
} {
  const base = hexToRgb(hex) ? hex : "#f7f5f0";
  return {
    light: mixWithWhite(base, 0.4),
    dark: mixWithBlack(base, 0.2),
  };
}
