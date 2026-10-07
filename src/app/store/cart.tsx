"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { track, trackCart } from "@/lib/shopper-client";

export type CartItem = {
  itemId: string;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  maxAvailable: number;
};

type CartCtx = {
  items: CartItem[];
  /** False until the cart has been read back from localStorage. */
  hydrated: boolean;
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (itemId: string, qty: number) => void;
  remove: (itemId: string) => void;
  clear: () => void;
  /** Replace the cart wholesale — used for the theme → checkout handoff. */
  seed: (items: CartItem[]) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "bb_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify(items));
    // The basket as she left it, for the dashboard's customer page.
    trackCart(
      items.map((i) => ({
        itemId: i.itemId,
        name: i.variantTitle ? i.productName + " - " + i.variantTitle : i.productName,
        imageUrl: i.imageUrl,
        price: i.price,
        quantity: i.quantity,
      })),
    );
  }, [items, hydrated]);

  const add: CartCtx["add"] = (item, qty = 1) => {
    track("add_to_cart", {
      productId: item.itemId,
      productName: item.productName,
      imageUrl: item.imageUrl,
      value: item.price,
      quantity: qty,
    });
    setItems((prev) => {
      const existing = prev.find((i) => i.itemId === item.itemId);
      if (existing) {
        return prev.map((i) =>
          i.itemId === item.itemId
            ? { ...i, quantity: Math.min(i.maxAvailable || 99, i.quantity + qty) }
            : i,
        );
      }
      return [...prev, { ...item, quantity: Math.min(item.maxAvailable || 99, qty) }];
    });
    setOpen(true);
  };

  const setQty: CartCtx["setQty"] = (itemId, qty) =>
    setItems((prev) =>
      prev
        .map((i) => (i.itemId === itemId ? { ...i, quantity: Math.max(0, qty) } : i))
        .filter((i) => i.quantity > 0),
    );

  const remove: CartCtx["remove"] = (itemId) => {
    const gone = items.find((i) => i.itemId === itemId);
    if (gone) {
      track("remove_from_cart", {
        productId: gone.itemId,
        productName: gone.productName,
        imageUrl: gone.imageUrl,
        value: gone.price,
        quantity: gone.quantity,
      });
    }
    setItems((prev) => prev.filter((i) => i.itemId !== itemId));
  };

  const clear = () => setItems([]);

  const seed: CartCtx["seed"] = (next) => setItems(next);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <Ctx.Provider value={{ items, hydrated, count, subtotal, add, setQty, remove, clear, seed, open, setOpen }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
