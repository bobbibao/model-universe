'use client';

import Api from './Api';
import { WISHLIST_API } from './endpoint';
import type { WishlistItem } from '@/shared/types/cart';

export default class WishlistApi {
  static async getWishlist(): Promise<WishlistItem[] | undefined> {
    try {
      const response = await Api.get(WISHLIST_API.GET_WISHLIST);
      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  // `quiet`: the caller shows its own confirmation (the storefront hearts), not the server's message.
  static async addItem(productId: number, quiet = false): Promise<Pick<WishlistItem, 'id' | 'productId'> | undefined> {
    try {
      const response = await Api.post(WISHLIST_API.ADD_ITEM, { productId }, { quiet });
      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  static async removeItem(itemId: number, quiet = false): Promise<boolean> {
    try {
      await Api.delete(WISHLIST_API.REMOVE_ITEM(itemId), { quiet });
      return true;
    } catch (error) {
      return false;
    }
  }
}
