/** URL-slug za artikl: mala slova, crtice, bez posebnih znakova. */
export function slugifyProductSlug(input: string): string {
  const nfd = input.normalize("NFD");
  const ascii = nfd.replace(/\p{M}/gu, "");
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}
