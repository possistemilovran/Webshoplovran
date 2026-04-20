/**
 * Neutralan SVG placeholder kad artikl nema slike (nema vanjskih zahtjeva).
 * Koristi se nakon brisanja URL-ova iz kataloga.
 */
export const EMPTY_PRODUCT_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='750'%3E%3Crect fill='%23e8e4dc' width='100%25' height='100%25'/%3E%3C/svg%3E";

export function productImageSrc(url: string | undefined | null): string {
  const u = url?.trim() ?? "";
  return u ? u : EMPTY_PRODUCT_IMAGE;
}
