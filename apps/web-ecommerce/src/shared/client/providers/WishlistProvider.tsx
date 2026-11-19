'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import WishlistApi from '@/core/client/api/Wishlist';
import useCustomerActionRefresh from '@/hooks/useCustomerActionRefresh';
import { trackRecommendationEvent } from '@/shared/client/behaviorTracker';
import { showToast } from '@/shared/client/utils/toast';
import type { RecommendationSurface } from '@/shared/smart-recommendations';
import { useCurrentUser } from './CurrentUserProvider';

export type SaveTarget = { id: number; name: string; categoryId?: number | null; priceVnd?: number | null };
type Saved = { itemId: number; productId: number };
type WishlistValue = {
  saved: (productId: number) => boolean;
  busy: (productId: number) => boolean;
  toggle: (product: SaveTarget) => Promise<void>;
};

const Context = createContext<WishlistValue | null>(null);

// Where on the storefront a save happened, for the recommendation signals.
function surfaceOf(path: string): RecommendationSurface {
  if (/^\/(vi|en)?\/?$/.test(path)) return 'home';
  if (/\/(san-pham|shop\/product)\//.test(path)) return 'product_detail';
  if (/\/cart\b/.test(path)) return 'cart';
  if (/\/wishlist\b/.test(path)) return 'wishlist';
  return 'catalog';
}

// The signed-in customer's saved models, loaded once and shared by every heart on the page (product cards, the
// product page), so they agree and a save shows everywhere at once. Saving is optimistic: the heart fills at once and
// goes back if the server refuses. Each save or removal confirms with a toast that opens the saved list; a guest is
// asked to sign in by a toast that opens the sign-in page and comes back here.
export function WishlistProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('wishlistToast');
  const { user } = useCurrentUser();
  const userId = user?.id;
  const [items, setItems] = useState<Saved[]>([]);
  const [pending, setPending] = useState<number[]>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    const rows = await WishlistApi.getWishlist();
    if (rows) setItems(rows.map((row) => ({ itemId: row.id, productId: row.productId })));
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);
  useCustomerActionRefresh('wishlist_add,wishlist_remove', load);

  const toggle = useCallback(
    async (product: SaveTarget) => {
      if (!userId) {
        const path = window.location.pathname.replace(/^\/(vi|en)(?=\/|$)/, '') || '/';
        showToast.info(t('signInHint'), {
          title: t('signInTitle'),
          href: `/auth/signin?redirect=${encodeURIComponent(path + window.location.search)}`,
        });
        return;
      }
      if (pending.includes(product.id)) return;
      const existing = items.find((item) => item.productId === product.id);
      setPending((current) => [...current, product.id]);
      try {
        if (existing) {
          setItems((current) => current.filter((item) => item.productId !== product.id));
          if (await WishlistApi.removeItem(existing.itemId)) {
            showToast(t('removedHint'), { title: t('removedTitle'), href: '/wishlist' });
          } else {
            setItems((current) => [...current, existing]);
          }
          return;
        }
        setItems((current) => [...current, { itemId: -product.id, productId: product.id }]);
        const added = await WishlistApi.addItem(product.id);
        if (!added) {
          setItems((current) => current.filter((item) => item.productId !== product.id));
          return;
        }
        setItems((current) =>
          current.map((item) => (item.productId === product.id ? { itemId: added.id, productId: product.id } : item)),
        );
        showToast.success(t('savedHint', { name: product.name }), { title: t('savedTitle'), href: '/wishlist' });
        trackRecommendationEvent({
          eventType: 'wishlist_add',
          productId: product.id,
          categoryId: product.categoryId ?? null,
          priceVnd: product.priceVnd ?? null,
          surface: surfaceOf(window.location.pathname),
        });
      } finally {
        setPending((current) => current.filter((id) => id !== product.id));
      }
    },
    [items, pending, t, userId],
  );

  const value: WishlistValue = {
    saved: (productId) => items.some((item) => item.productId === productId),
    busy: (productId) => pending.includes(productId),
    toggle,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

// The shared saved list, or null outside the storefront layout (then no heart is shown).
export function useWishlist() {
  return useContext(Context);
}
