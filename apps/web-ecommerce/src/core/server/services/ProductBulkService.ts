import CatalogTreeService, { lockCatalog } from './catalog/CatalogTreeService';
import { productHasHistory } from './catalog/ProductHistory';
import { createHash } from 'crypto';
import DatabaseProvider from '../database/Database.Provider';
import ProductModel from '../database/client/models/Product.Model';
import { uniquePhotosMissing } from './catalog/ProductConditionValidation';
import UserModel from '../database/internal/models/User.Model';
import PromotionAuditModel from '../database/client/models/PromotionAudit.Model';
import HttpError from '../../../shared/server/utils/HttpError';
import type { ProductBulkResult } from '../../../shared/product-bulk';
import { parseProductBulk } from './catalog/ProductBulkInput';

const conflict = () =>
  HttpError.conflict('Products changed or are not eligible. Reload and select them again.', 'BULK_PRODUCT_CHANGED');

export default class ProductBulkService {
  async update(actorUserId: number, input: unknown): Promise<ProductBulkResult> {
    const request = parseProductBulk(input);
    const digest = createHash('sha256')
      .update(JSON.stringify({ items: request.items, changes: request.changes }))
      .digest('hex');
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      // Serializes retries for one actor, including the same key with a different set of rows.
      const actor = await UserModel.findByPk(actorUserId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!actor?.isActive || actor.role !== 'ADMIN') throw HttpError.forbidden();
      const previous = await PromotionAuditModel.findOne({
        where: { actorUserId, entityType: 'product_bulk_request', entityId: actorUserId, action: request.requestKey },
        transaction,
      });
      if (previous) {
        if (previous.newValue?.digest !== digest) throw conflict();
        return previous.newValue.result as ProductBulkResult;
      }
      const { changes } = request;
      await lockCatalog(transaction);
      const ids = request.items.map((item) => item.id);
      const parents = await ProductModel.findAll({
        where: { id: ids },
        order: [['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (parents.length !== ids.length) throw conflict();
      for (const [index, product] of parents.entries()) {
        if (
          product.partnerId ||
          product.catalogReviewRequired ||
          new Date(product.updatedAt).toISOString() !== request.items[index].expectedUpdatedAt
        )
          throw conflict();
        if (
          changes.isFeatured === true &&
          (product.isArchived || product.inventoryStatus !== 'available' || product.listingStatus !== 'published')
        )
          throw conflict();
      }
      let updatedCount = 0;
      for (const product of parents) {
        // Condition belongs to one physical SKU. Never reclassify its other condition options.
        let selection = {};
        if (changes.condition !== undefined || changes.conditionNodeIds !== undefined) {
          const next = await new CatalogTreeService().selection({ ...product.get({ plain: true }), ...changes, itemTypeKey: changes.condition ?? product.itemTypeKey }, product, transaction);
          if (next.combinationKey !== product.combinationKey && (product.stock > 0 || await productHasHistory(product.id, transaction))) throw conflict();
          if (!product.isArchived && next.itemTypeKey === 'preowned' && uniquePhotosMissing(product.stock, product.imageUrl)) throw conflict();
          selection = next;
        }
        const entries = Object.entries({ ...changes, ...selection }).filter(([key, value]) => JSON.stringify(product.get(key)) !== JSON.stringify(value));
        if (!entries.length) continue;
        const before = Object.fromEntries(entries.map(([key]) => [key, product.get(key) ?? null]));
        const patch = Object.fromEntries(entries);
        await product.update(patch, { transaction });
        await PromotionAuditModel.create(
          {
            actorUserId,
            entityType: 'product_catalog',
            entityId: product.id,
            action: 'bulk_update',
            oldValue: before,
            newValue: { ...patch, requestKey: request.requestKey },
          },
          { transaction },
        );
        updatedCount++;
      }
      const result = { selectedCount: ids.length, updatedCount };
      await PromotionAuditModel.create(
        {
          actorUserId,
          entityType: 'product_bulk_request',
          entityId: actorUserId,
          action: request.requestKey,
          oldValue: null,
          newValue: { digest, result },
        },
        { transaction },
      );
      return result;
    });
  }
}
