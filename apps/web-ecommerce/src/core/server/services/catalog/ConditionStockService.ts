import { Op } from 'sequelize';
import DatabaseProvider from '../../database/Database.Provider';
import ProductModel from '../../database/client/models/Product.Model';
import CatalogIntakeModel from '../../database/client/models/CatalogIntake.Model';
import UserModel from '../../database/internal/models/User.Model';
import HttpError from '../../../../shared/server/utils/HttpError';

export default class ConditionStockService {
  async transfer(actorUserId: number, fromId: number, data: Record<string, any>) {
    const { targetProductId, quantity, requestKey } = data;
    const reason = String(data.reason ?? '').trim();
    if (
      !Number.isSafeInteger(targetProductId) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      targetProductId === fromId ||
      !/^[a-f0-9-]{36}$/i.test(String(requestKey)) ||
      !reason ||
      reason.length > 2000
    )
      throw HttpError.badRequest('Chọn sản phẩm đích, số lượng nguyên dương và lý do.');
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      const actor = await UserModel.findByPk(actorUserId, { transaction });
      if (!actor?.isActive || actor.role !== 'ADMIN') throw HttpError.forbidden();
      const products = await ProductModel.findAll({
        where: { id: { [Op.in]: [fromId, targetProductId] } },
        order: [['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const from = products.find((product) => product.id === fromId),
        to = products.find((product) => product.id === targetProductId);
      if (
        !from ||
        !to ||
        from.partnerId ||
        to.partnerId ||
        !from.modelFamilyId ||
        from.modelFamilyId !== to.modelFamilyId ||
        !from.combinationKey ||
        !to.combinationKey ||
        from.catalogReviewRequired ||
        to.catalogReviewRequired
      )
        throw HttpError.conflict('Chọn hai tổ hợp đã đối chiếu của cùng một mẫu thuộc shop.');
      const previous = await CatalogIntakeModel.findOne({
        where: { sourceType: 'condition_transfer_out', sourceId: requestKey },
        transaction,
      });
      if (previous) {
        if (
          previous.productId !== fromId ||
          previous.quantity !== -quantity ||
          previous.actorUserId !== actorUserId ||
          previous.snapshot.targetProductId !== targetProductId ||
          previous.snapshot.reason !== reason
        )
          throw HttpError.conflict('Mã thao tác đã dùng cho lần chuyển khác.');
        return { transferred: quantity, replayed: true };
      }
      if (from.stock < quantity || from.inventoryStatus !== 'available' || to.inventoryStatus !== 'available')
        throw HttpError.conflict('Không đủ tồn sẵn bán hoặc hàng đang bị giữ.');
      const snapshot = {
        fromProductId: fromId,
        targetProductId,
        reason,
        fromConditions: from.conditionNodeIds,
        toConditions: to.conditionNodeIds,
      };
      await CatalogIntakeModel.create(
        {
          productId: fromId,
          sourceType: 'condition_transfer_out',
          sourceId: requestKey,
          quantity: -quantity,
          unitCostVnd: from.importPrice,
          actorUserId,
          snapshot,
        },
        { transaction },
      );
      await CatalogIntakeModel.create(
        {
          productId: targetProductId,
          sourceType: 'condition_transfer_in',
          sourceId: requestKey,
          quantity,
          unitCostVnd: from.importPrice,
          actorUserId,
          snapshot,
        },
        { transaction },
      );
      await from.update({ stock: from.stock - quantity }, { transaction });
      await to.update({ stock: to.stock + quantity, importPrice: from.importPrice }, { transaction });
      return { transferred: quantity, replayed: false };
    });
  }
}
