import WishlistItemModel from '../database/client/models/WishlistItem.Model';
import ProductModel, { isSellable } from '../database/client/models/Product.Model';
import ProductDiscountService, { toPricing } from './ProductDiscountService';
import HttpError from '../../../shared/server/utils/HttpError';
import { toInteger } from '../../../shared/server/utils/ValidationUtils';

const productInclude = {
  model: ProductModel,
  as: 'product',
  attributes: ['id', 'name', 'brandName', 'price', 'imageUrl', 'stock', 'isArchived', 'inventoryStatus', 'partnerId'],
};

export default class WishlistService {
  private discountService = new ProductDiscountService();

  // Items whose product was archived or held back stay in the list but are flagged as unavailable.
  async list(userId: number) {
    const items = await WishlistItemModel.findAll({
      where: { userId },
      include: [productInclude],
      order: [['createdAt', 'DESC']],
    });
    const discounts = await this.discountService.getActive(items.map((item) => item.productId));
    return items.map((item) => {
      const product = item.get('product') as ProductModel;
      return {
        id: item.id,
        productId: item.productId,
        createdAt: item.createdAt,
        available: isSellable(product),
        product: {
          id: product.id,
          name: product.name,
          brandName: product.brandName,
          price: product.price,
          ...toPricing(product.price, discounts.get(product.id)),
          imageUrl: product.imageUrl,
          stock: product.stock,
        },
      };
    });
  }

  // Adding an item that is already in the list is a no-op.
  async add(userId: number, data: Record<string, unknown>) {
    const productId = toInteger(data.productId);
    const product = productId ? await ProductModel.findByPk(productId) : null;
    if (!product || !isSellable(product)) throw HttpError.notFound('Không tìm thấy sản phẩm.');
    const [item] = await WishlistItemModel.findOrCreate({ where: { userId, productId: product.id } });
    return { id: item.id, productId: item.productId };
  }

  async remove(userId: number, itemId: number): Promise<void> {
    const removed = await WishlistItemModel.destroy({ where: { id: itemId, userId } });
    if (!removed) throw HttpError.notFound('Không tìm thấy sản phẩm trong danh sách yêu thích.');
  }
}
