import fs from 'fs/promises';
import path from 'path';
import type { Transaction } from 'sequelize';
import ProductModel from '../database/client/models/Product.Model';
import CatalogIntakeModel from '../database/client/models/CatalogIntake.Model';
import HttpError from '../../../shared/server/utils/HttpError';
import FileStorageService from './FileStorageService';

// Source workflows verify ownership, settlement and their own inspection/QC before calling this.
export async function activateOwnedCollectibleDraft(productId: number, modelCode: string, acquisitionCostVnd: number, transaction: Transaction,
  { publish = false, sourceType, sourceId, actorUserId }: { publish?: boolean; sourceType: 'buyback' | 'pawn'; sourceId: number; actorUserId: number }) {
  const product = await ProductModel.findByPk(productId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!product || product.partnerId || product.modelCode !== modelCode || product.catalogReviewRequired || product.inventoryStatus !== 'available')
    throw HttpError.conflict('Chọn SKU của đúng mẫu/tổ hợp đã duyệt để nhập hàng.');
  const previous = await CatalogIntakeModel.findOne({ where: { sourceType, sourceId: String(sourceId) }, transaction });
  if (previous) {
    if (previous.productId !== productId) throw HttpError.conflict('Nguồn hàng đã nhập vào một SKU khác.');
    return product;
  }
  if (!product.imageUrl.startsWith('/uploads/')) throw HttpError.badRequest('SKU cần ảnh đại diện thật đã tải lên.');
  const root = FileStorageService.getUploadRoot();
  const filename = path.resolve(root, product.imageUrl.slice('/uploads/'.length));
  if (!filename.startsWith(path.resolve(root) + path.sep)) throw HttpError.badRequest('Đường dẫn ảnh không hợp lệ.');
  try { await fs.access(filename); } catch { throw HttpError.badRequest('Không tìm thấy ảnh thật của SKU.'); }
  await CatalogIntakeModel.create({ productId, sourceType, sourceId: String(sourceId), quantity: 1, unitCostVnd: acquisitionCostVnd, actorUserId,
    snapshot: { modelFamilyId: product.modelFamilyId, itemTypeKey: product.itemTypeKey, conditionNodeIds: product.conditionNodeIds, sku: product.sku } }, { transaction });
  await product.update({ stock: product.stock + 1, importPrice: acquisitionCostVnd, ...(publish ? { isArchived: false } : {}) }, { transaction });
  return product;
}
