import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/data/types";

const STORAGE_KEY = "olivo-demo-cart";

export type CartLine = {
  productId: string;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  add: (product: Product, qty?: number) => void;
  setQty: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function loadLines(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is CartLine =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as CartLine).productId === "string" &&
        typeof (x as CartLine).quantity === "number"
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLines(loadLines());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const add = useCallback((product: Product, qty = 1) => {
    if (product.soldOut) return;
    setLines((prev) => {
      const i = prev.findIndex((l) => l.productId === product.id);
      if (i === -1) return [...prev, { productId: product.id, quantity: qty }];
      const next = [...prev];
      next[i] = { ...next[i], quantity: next[i].quantity + qty };
      return next;
    });
    setOpen(true);
  }, []);

  const setQty = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) {
      setLines((prev) => prev.filter((l) => l.productId !== productId));
      return;
    }
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, quantity } : l
      )
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({ lines, add, setQty, remove, clear, open, setOpen }),
    [lines, add, setQty, remove, clear, open]
  );

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
