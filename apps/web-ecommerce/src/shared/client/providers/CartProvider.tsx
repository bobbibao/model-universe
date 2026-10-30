'use client';

import { useTranslations } from 'next-intl';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '@/shared/client/utils/toast';
import useLocalStorage from '@/hooks/useLocalStorage';
import CartApi from '@/core/client/api/Cart';
import type { CartItem, CartLine, CartQuote } from '@/shared/types/cart';

const CART_STORAGE_KEY = 'cart';
const QUOTE_DEBOUNCE_MS = 250;

export type CartProduct = {
  id: number;
  name: string;
  imageUrl: string;
  price: number;
  // Price after a running discount, when the caller knows it (display snapshot only; the quote is authoritative).
  salePrice?: number;
  brandName: string;
  stock: number;
};

// A cart item with its server-side check (undefined until the first quote arrives).
export type CartEntry = { item: CartItem; line?: CartLine };

interface CartContextValue {
  entries: CartEntry[];
  count: number;
  subtotal: number;
  hasIssues: boolean;
  quoting: boolean;
  addItem: (product: CartProduct, quantity: number) => boolean;
  updateQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  removeUnavailable: () => void;
  clearCart: () => void;
  refreshQuote: () => Promise<CartQuote | undefined>;
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const t = useTranslations('checkout');
  const [storedItems, setStoredItems] = useLocalStorage<CartItem[]>(CART_STORAGE_KEY, []);
  // One line per product (a cart saved before sizes were dropped may hold several lines of a product: they merge).
  const items = useMemo(() => {
    const merged = new Map<number, CartItem>();
    for (const item of Array.isArray(storedItems) ? storedItems : []) {
      const existing = merged.get(item.productId);
      merged.set(item.productId, {
        productId: item.productId,
        quantity: (existing?.quantity ?? 0) + item.quantity,
        name: item.name,
        imageUrl: item.imageUrl,
        price: item.price,
        brandName: item.brandName,
      });
    }
    return [...merged.values()];
  }, [storedItems]);
  // Multiple assistant action cards can resolve their product lookups in the same render.
  // Keep each mutation based on the latest cart instead of an older render's snapshot.
  const latestItems = useRef(items);
  latestItems.current = items;
  const saveItems = (next: CartItem[]) => {
    latestItems.current = next;
    setStoredItems(next);
  };
  const [quote, setQuote] = useState<CartQuote>();
  const [quoting, setQuoting] = useState(false);
  const requestId = useRef(0);

  const refreshQuote = useCallback(async () => {
    const current = ++requestId.current;
    if (items.length === 0) {
      setQuote({ lines: [], subtotal: 0, itemCount: 0, hasIssues: false });
      return undefined;
    }
    setQuoting(true);
    const result = await CartApi.getQuote(
      items.map(({ productId, quantity }) => ({ productId, quantity })),
    );
    // Ignore answers to outdated requests.
    if (current !== requestId.current) return result;
    if (result) setQuote(result);
    setQuoting(false);
    return result;
  }, [items]);

  useEffect(() => {
    const timer = setTimeout(refreshQuote, QUOTE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [refreshQuote]);

  const entries = useMemo(() => {
    const lines = new Map((quote?.lines || []).map((line) => [line.productId, line]));
    return items.map((item) => ({ item, line: lines.get(item.productId) }));
  }, [items, quote]);

  const addItem = (product: CartProduct, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return false;
    const items = latestItems.current;
    const inCart = items.find((item) => item.productId === product.id)?.quantity ?? 0;
    if (inCart + quantity > product.stock) {
      showToast.error(
        product.stock > inCart
          ? t('addMaximum',{count:product.stock-inCart})
          : t('stockLimit'),
      );
      return false;
    }
    const existing = items.find((item) => item.productId === product.id);
    const snapshot = {
      name: product.name,
      imageUrl: product.imageUrl,
      price: product.salePrice ?? product.price,
      brandName: product.brandName,
    };
    saveItems(
      existing
        ? items.map((item) => (item === existing ? { ...item, ...snapshot, quantity: item.quantity + quantity } : item))
        : [...items, { productId: product.id, quantity, ...snapshot }],
    );
    showToast.success(t('addedToBag'), {
      href: '/cart',
    });
    return true;
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    saveItems(latestItems.current.map((item) => (item.productId === productId ? { ...item, quantity } : item)));
  };

  const removeItem = (productId: number) =>
    saveItems(latestItems.current.filter((item) => item.productId !== productId));

  // Drops lines whose product was deleted, archived or sold out.
  const removeUnavailable = () => {
    const unavailable = new Set(
      entries
        .filter(({ line }) => line && ['UNAVAILABLE', 'OUT_OF_STOCK'].includes(line.status))
        .map(({ item }) => item.productId),
    );
    saveItems(latestItems.current.filter((item) => !unavailable.has(item.productId)));
  };

  const clearCart = () => saveItems([]);

  const value: CartContextValue = {
    entries,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: quote?.subtotal ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    hasIssues: !!quote?.hasIssues,
    quoting,
    addItem,
    updateQuantity,
    removeItem,
    removeUnavailable,
    clearCart,
    refreshQuote,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
};
