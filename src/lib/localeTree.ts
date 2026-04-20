/** Duboko spajanje običnih objekata; nizovi stringova zamjenjuju se; nizovi objekata spajaju se po indeksu. */
export function deepMergeLocale(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    const bv = out[key];
    if (
      pv != null &&
      typeof pv === "object" &&
      !Array.isArray(pv) &&
      bv != null &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      out[key] = deepMergeLocale(bv as Record<string, unknown>, pv as Record<string, unknown>);
    } else if (Array.isArray(pv) && Array.isArray(bv)) {
      const firstP = pv[0];
      const mergeObjectArrays =
        firstP != null &&
        typeof firstP === "object" &&
        !Array.isArray(firstP) &&
        (bv.length === 0 ||
          (bv[0] != null && typeof bv[0] === "object" && !Array.isArray(bv[0])));
      if (mergeObjectArrays) {
        const len = Math.max(bv.length, pv.length);
        const arr: unknown[] = [];
        for (let i = 0; i < len; i++) {
          const bi = bv[i];
          const pi = pv[i];
          if (pi === undefined) arr[i] = bi;
          else if (
            bi != null &&
            typeof bi === "object" &&
            !Array.isArray(bi) &&
            typeof pi === "object" &&
            !Array.isArray(pi)
          ) {
            arr[i] = deepMergeLocale(
              bi as Record<string, unknown>,
              pi as Record<string, unknown>
            );
          } else arr[i] = pi;
        }
        out[key] = arr;
      } else {
        out[key] = pv;
      }
    } else if (pv !== undefined) {
      out[key] = pv;
    }
  }
  return out;
}

export function getAt(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

export function setAt(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown
): Record<string, unknown> {
  if (path.length === 0) return obj;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    return { ...obj, [head]: value };
  }
  const child = obj[head];
  const nextChild =
    child != null && typeof child === "object" && !Array.isArray(child)
      ? (child as Record<string, unknown>)
      : {};
  return { ...obj, [head]: setAt(nextChild, rest, value) };
}

export function deletePath(
  obj: Record<string, unknown>,
  path: string[]
): Record<string, unknown> {
  if (path.length === 0) return obj;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    const { [head]: _, ...restObj } = obj;
    return restObj;
  }
  const child = obj[head];
  if (child == null || typeof child !== "object" || Array.isArray(child)) return obj;
  const inner = deletePath(child as Record<string, unknown>, rest);
  if (Object.keys(inner).length === 0) {
    const { [head]: __, ...restObj } = obj;
    return restObj;
  }
  return { ...obj, [head]: inner };
}

function stableStringify(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return `[${x.map(stableStringify).join(",")}]`;
  const o = x as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",")}}`;
}

export function valueEquals(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

export function getAtSeg(obj: unknown, path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const seg of path) {
    if (cur == null) return undefined;
    if (typeof seg === "number") {
      if (!Array.isArray(cur) || seg < 0 || seg >= cur.length) return undefined;
      cur = (cur as unknown[])[seg];
    } else {
      if (typeof cur !== "object" || Array.isArray(cur)) return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
  }
  return cur;
}

/** Postavlja vrijednost u stablu (korijen mora biti objekt). */
export function setAtSegInRoot(
  root: Record<string, unknown>,
  path: (string | number)[],
  value: unknown
): Record<string, unknown> {
  if (path.length === 0) return root;
  const [head, ...rest] = path;
  if (typeof head === "string") {
    if (rest.length === 0) return { ...root, [head]: value };
    const child = root[head];
    const nextChild =
      child != null && typeof child === "object" && !Array.isArray(child)
        ? (child as Record<string, unknown>)
        : {};
    return { ...root, [head]: setAtSegInRoot(nextChild, rest, value) };
  }
  return root;
}

/** Postavlja u nizu na indeksu (npr. reviews.0.quote). */
export function setAtSegDeep(
  root: Record<string, unknown>,
  path: (string | number)[],
  value: unknown
): Record<string, unknown> {
  if (path.length === 0) return root;
  const [head, ...rest] = path;

  if (typeof head === "string") {
    if (rest.length === 0) return { ...root, [head]: value };
    const child = root[head];
    if (typeof rest[0] === "number") {
      const arr = Array.isArray(child) ? [...child] : [];
      const idx = rest[0] as number;
      while (arr.length <= idx) arr.push({});
      const el = arr[idx];
      const objEl =
        el != null && typeof el === "object" && !Array.isArray(el)
          ? { ...(el as Record<string, unknown>) }
          : {};
      arr[idx] =
        rest.length === 1
          ? value
          : setAtSegDeep(objEl, rest.slice(1), value);
      return { ...root, [head]: arr };
    }
    const nextChild =
      child != null && typeof child === "object" && !Array.isArray(child)
        ? (child as Record<string, unknown>)
        : {};
    return { ...root, [head]: setAtSegDeep(nextChild, rest, value) };
  }
  return root;
}
