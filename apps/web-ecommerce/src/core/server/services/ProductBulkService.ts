import { createHash } from 'crypto';
import DatabaseProvider from '../database/Database.Provider';
import ProductModel from '../database/client/models/Product.Model';
import ProductImageModel from '../database/client/models/ProductImage.Model';
import ProductConditionTypeModel from '../database/client/models/ProductConditionType.Model';
import ProductConditionService from './ProductConditionService';
import { uniquePhotosMissing } from './catalog/ProductConditionValidation';
import UserModel from '../database/internal/models/User.Model';
import PromotionAuditModel from '../database/client/models/PromotionAudit.Model';
import HttpError from '../../../shared/server/utils/HttpError';
import type { ProductBulkIssue, ProductBulkResult } from '../../../shared/product-bulk';
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
      let types: Awaited<ReturnType<ProductConditionService['all']>> = [];
      if (changes.condition !== undefined) {
        await ProductConditionTypeModel.findAll({
          attributes: ['id'],
          order: [['id', 'ASC']],
          transaction,
          lock: transaction.LOCK.SHARE,
        });
        types = await new ProductConditionService().all(transaction);
      }
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
          product.parentProductId ||
          new Date(product.updatedAt).toISOString() !== request.items[index].expectedUpdatedAt
        )
          throw conflict();
        if (
          changes.isFeatured === true &&
          (product.isArchived || product.inventoryStatus !== 'available' || product.listingStatus !== 'published')
        )
          throw conflict();
      }
      if (changes.condition !== undefined) {
        const images = await ProductImageModel.findAll({ where: { productId: ids }, transaction });
        const next = types.find((type) => type.key === changes.condition);
        const issues: ProductBulkIssue[] = [];
        for (const product of parents) {
          const was = types.find((type) => type.key === product.condition);
          if (!next || (!next.isActive && next.key !== product.condition)) {
            issues.push({ id: product.id, reason: 'retired' });
            continue;
          }
          if (was?.uniqueUnit && product.condition !== next.key)
            issues.push({ id: product.id, reason: 'uniqueIdentity' });
          if (
            next.uniqueUnit &&
            uniquePhotosMissing(
              product.stock,
              product.imageUrl,
              images.filter((image) => image.productId === product.id).map((image) => image.url),
            )
          )
            issues.push({ id: product.id, reason: 'photos' });
          if (next.requiresMissingAccessories && !product.missingAccessories?.length)
            issues.push({ id: product.id, reason: 'missingAccessories' });
          if (next.requiresDefects && !product.defects?.length) issues.push({ id: product.id, reason: 'defects' });
        }
        if (issues.length)
          throw new HttpError(409, 'Condition requirements are not met.', undefined, 'BULK_PRODUCT_CONDITION_INVALID', {
            blockedProducts: JSON.stringify(issues),
          });
      }
      let updatedCount = 0;
      for (const product of parents) {
        // Condition belongs to one physical SKU. Never reclassify its other condition options.
        const entries = Object.entries(changes).filter(([key, value]) => product.get(key) !== value);
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
