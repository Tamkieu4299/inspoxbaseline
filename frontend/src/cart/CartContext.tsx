import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { tenantSlug } from "../api";

export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  color?: string | null;
  size?: string | null;
  imageUrl?: string | null;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  addLine: (line: Omit<CartLine, "quantity"> & { quantity?: number }) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  lineKey: (line: Pick<CartLine, "productId" | "color" | "size">) => string;
};

const CartContext = createContext<CartContextValue | null>(null);

function storageKey() {
  return `inspo-cart:${tenantSlug()}`;
}

export function lineKey(line: Pick<CartLine, "productId" | "color" | "size">) {
  return `${line.productId}:${line.color || ""}:${line.size || ""}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey(), JSON.stringify(lines));
  }, [lines]);

  const addLine = useCallback((incoming: Omit<CartLine, "quantity"> & { quantity?: number }) => {
    const qty = Math.min(99, Math.max(1, incoming.quantity ?? 1));
    setLines((prev) => {
      const key = lineKey(incoming);
      const idx = prev.findIndex((l) => lineKey(l) === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.min(99, next[idx].quantity + qty) };
        return next;
      }
      return [...prev, { ...incoming, quantity: qty }];
    });
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) => {
      if (quantity < 1) return prev.filter((l) => lineKey(l) !== key);
      return prev.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.min(99, quantity) } : l));
    });
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => lineKey(l) !== key));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const count = useMemo(() => lines.reduce((n, l) => n + l.quantity, 0), [lines]);
  const subtotal = useMemo(() => lines.reduce((n, l) => n + l.price * l.quantity, 0), [lines]);

  const value = useMemo(
    () => ({
      lines,
      count,
      subtotal,
      addLine,
      updateQuantity,
      removeLine,
      clearCart,
      lineKey,
    }),
    [lines, count, subtotal, addLine, updateQuantity, removeLine, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart requires CartProvider");
  return ctx;
}
