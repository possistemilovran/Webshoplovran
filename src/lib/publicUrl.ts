/**
 * Apsolutne putanje iz postavki (/brand/...) moraju poštivati Vite `base`
 * (npr. GitHub Pages pod /repo/).
 */
export function publicAssetUrl(url: string): string {
  const u = url.trim();
  if (
    !u ||
    /^https?:\/\//i.test(u) ||
    u.startsWith("data:") ||
    u.startsWith("blob:")
  ) {
    return u;
  }
  const path = u.startsWith("/") ? u : `/${u}`;
  const base = import.meta.env.BASE_URL ?? "/";
  const root = base.endsWith("/") ? base.slice(0, -1) : base;
  if (!root) return path;
  return `${root}${path}`;
}
