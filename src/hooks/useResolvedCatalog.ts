import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  collections as rawCollections,
  products as rawProducts,
} from "@/data/catalog";
import {
  combineArchivedWithLocalProductOverride,
  mergeCollection,
  mergeProduct,
  type ProductOverride,
} from "@/config/siteDefaults";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { resolveUiLang } from "@/i18n/resolveUiLang";
import { publicAssetUrl } from "@/lib/publicUrl";
import type { Product } from "@/data/types";

const ARCHIVED_OVERRIDES_CHANGED = "olivo-archived-overrides-changed";

/** Lokalne putanje (/uploads/…) moraju poštivati Vite `import.meta.env.BASE_URL`. */
function withResolvedProductMedia(p: Product): Product {
  const image = publicAssetUrl(p.image);
  const images =
    p.images.length > 0 ? p.images.map((u) => publicAssetUrl(u)) : [];
  return { ...p, image, images };
}

const collectionIdSet = new Set(rawCollections.map((c) => c.id));

export function useResolvedProducts() {
  const { settings } = useSiteSettings();
  const { i18n } = useTranslation();
  const displayLang = resolveUiLang(i18n);
  const overrides = settings.productOverrides;
  const assignments = settings.productCollectionAssignments ?? {};

  const [archivedOverrides, setArchivedOverrides] = useState<
    Record<string, ProductOverride>
  >({});

  useEffect(() => {
    const load = () => {
      fetch(`${publicAssetUrl("/editor-archived-overrides.json")}?t=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { overrides?: unknown } | null) => {
          if (
            j &&
            j.overrides &&
            typeof j.overrides === "object" &&
            !Array.isArray(j.overrides)
          ) {
            setArchivedOverrides(j.overrides as Record<string, ProductOverride>);
          }
        })
        .catch(() => setArchivedOverrides({}));
    };
    load();
    const onRefresh = () => load();
    window.addEventListener(ARCHIVED_OVERRIDES_CHANGED, onRefresh);
    return () => window.removeEventListener(ARCHIVED_OVERRIDES_CHANGED, onRefresh);
  }, []);

  return useMemo(
    () =>
      rawProducts.map((p) => {
        const archived = archivedOverrides[p.slug] ?? null;
        const local = overrides[p.slug] ?? overrides[p.id] ?? null;
        const combined = combineArchivedWithLocalProductOverride(
          archived,
          local
        );
        let merged = mergeProduct(p, combined, displayLang);
        const extraCol = assignments[p.slug];
        if (
          extraCol &&
          collectionIdSet.has(extraCol) &&
          !merged.collectionIds.includes(extraCol)
        ) {
          merged = {
            ...merged,
            collectionIds: [...merged.collectionIds, extraCol],
          };
        }
        return withResolvedProductMedia(merged);
      }),
    [overrides, assignments, archivedOverrides, displayLang]
  );
}

export function refreshArchivedProductOverrides(): void {
  window.dispatchEvent(new Event(ARCHIVED_OVERRIDES_CHANGED));
}

export function useResolvedCollections() {
  const { settings } = useSiteSettings();
  const { i18n } = useTranslation();
  const displayLang = resolveUiLang(i18n);
  const overrides = settings.collectionOverrides;

  return useMemo(
    () =>
      rawCollections.map((c) =>
        mergeCollection(
          c,
          overrides[c.slug] ?? overrides[c.id] ?? null,
          displayLang
        )
      ),
    [overrides, displayLang]
  );
}

export function useResolvedProduct(slug: string | undefined) {
  const list = useResolvedProducts();
  return useMemo(
    () => (slug ? list.find((p) => p.slug === slug) : undefined),
    [list, slug]
  );
}

export function useResolvedCollection(slug: string | undefined) {
  const list = useResolvedCollections();
  return useMemo(
    () => (slug ? list.find((c) => c.slug === slug) : undefined),
    [list, slug]
  );
}

export function useCollectionProducts(collectionSlug: string | undefined) {
  const products = useResolvedProducts();
  const col = useResolvedCollection(collectionSlug);

  return useMemo(() => {
    if (!col) return [];
    return products.filter((p) => p.collectionIds.includes(col.id));
  }, [products, col]);
}
