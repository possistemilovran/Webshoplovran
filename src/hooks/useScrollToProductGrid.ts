import { useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Hash u URL-u kad se dolazi s izbornika — skrol na prvi red artikala. */
export const PRODUCT_GRID_ANCHOR_ID = "artikli";

export function productGridHash() {
  return `#${PRODUCT_GRID_ANCHOR_ID}`;
}

export function useScrollToProductGrid() {
  const location = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    if (location.hash.slice(1) !== PRODUCT_GRID_ANCHOR_ID) return;

    const t = window.setTimeout(() => {
      document.getElementById(PRODUCT_GRID_ANCHOR_ID)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      navigate(
        { pathname: location.pathname, search: location.search, hash: "" },
        { replace: true }
      );
    }, 0);

    return () => clearTimeout(t);
  }, [location.hash, location.pathname, location.search, navigate]);
}
