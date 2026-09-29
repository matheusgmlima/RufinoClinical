"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { quoteCart } from "@/app/actions/cart";
import { cartItemSchema, normalizeCart, type CartItem, type CartQuote, MAX_LINE_QUANTITY } from "@/lib/cart/schema";

const STORAGE_KEY = "rc-cart-v1";
const EMPTY: CartItem[] = [];

type CartContextValue = {
  items: CartItem[];
  count: number;
  hydrated: boolean;
  add: (variantId: string, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

// External store over localStorage. The browser cart holds only variant ids and quantities;
// prices are never stored client-side.
let snapshot: CartItem[] | null = null;
const listeners = new Set<() => void>();

function readStorage(): CartItem[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(raw)) return EMPTY;
    // Keep every valid line and drop only the malformed ones (unknown fields such as prices are stripped).
    const valid = raw.flatMap((entry) => {
      const parsed = cartItemSchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    });
    return normalizeCart(valid);
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): CartItem[] {
  snapshot ??= readStorage();
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = readStorage();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeCart(next: CartItem[]) {
  snapshot = normalizeCart(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode or storage disabled: the cart still works for this page view.
  }
  listeners.forEach((listener) => listener());
}

const noopSubscribe = () => () => {};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [open, setOpen] = useState(false);

  const add = useCallback(
    (variantId: string, quantity: number) => writeCart([...getSnapshot(), { variantId, quantity }]),
    [],
  );
  const setQuantity = useCallback(
    (variantId: string, quantity: number) =>
      writeCart(
        getSnapshot().map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: Math.max(1, Math.min(MAX_LINE_QUANTITY, quantity)) }
            : item,
        ),
      ),
    [],
  );
  const remove = useCallback(
    (variantId: string) => writeCart(getSnapshot().filter((item) => item.variantId !== variantId)),
    [],
  );

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      hydrated,
      add,
      setQuantity,
      remove,
      open,
      setOpen,
    }),
    [items, hydrated, add, setQuantity, remove, open],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

/**
 * Prices the cart on the server whenever it changes and reconciles the local cart with the
 * result (drops unavailable items, clamps quantities to stock).
 */
export function useCartQuote() {
  const { items, hydrated, remove, setQuantity } = useCart();
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const request = useRef(0);

  useEffect(() => {
    if (!hydrated) return;
    const id = ++request.current;
    startTransition(async () => {
      try {
        const result = await quoteCart(items);
        if (id !== request.current) return;
        setQuote(result);
        setError(false);
        result.unavailable.forEach(remove);
        for (const line of result.lines) {
          const local = items.find((item) => item.variantId === line.variantId);
          if (local && local.quantity !== line.quantity) setQuantity(line.variantId, line.quantity);
        }
      } catch {
        if (id === request.current) setError(true);
      }
    });
  }, [items, hydrated, remove, setQuantity]);

  return { quote, pending: pending || !hydrated, error };
}
