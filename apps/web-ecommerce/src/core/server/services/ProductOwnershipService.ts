import { Transaction } from 'sequelize';
import DatabaseProvider from '../database/Database.Provider';
import ProductModel from '../database/client/models/Product.Model';
import PawnContractModel from '../database/client/models/PawnContract.Model';
import PromotionAuditModel from '../database/client/models/PromotionAudit.Model';
import CommerceAccessService from './CommerceAccessService';
import HttpError from '../../../shared/server/utils/HttpError';
export default class ProductOwnershipService {
  static async assertSaleAllowed(id: number, transaction: Transaction) {
    const pawn = await PawnContractModel.findOne({ where: { productId: id }, transaction });
    if (pawn && (pawn.status !== 'disposed' || pawn.governance.disputed || !pawn.governance.titleTransfer))
      throw HttpError.conflict('Tài sản cầm cố/tranh chấp chưa hoàn tất chuyển quyền sở hữu không được đăng bán.');
  }
  async verify(id: number, actorId: number, data: Record<string, unknown>) {
    if (
      data.ownershipVerified !== true ||
      typeof data.reference !== 'string' ||
      data.reference.trim().length < 8 ||
      data.reference.length > 1000
    )
      throw HttpError.badRequest('Xác minh quyền sở hữu và nhập căn cứ kiểm tra.');
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await CommerceAccessService.require(actorId, 'compliance', transaction);
      const row = await ProductModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row || row.partnerId) throw HttpError.notFound();
      await ProductOwnershipService.assertSaleAllowed(id, transaction);
      await row.update({ ownershipVerifiedAt: new Date(), ownershipReference: data.reference }, { transaction });
      await PromotionAuditModel.create(
        {
          actorUserId: actorId,
          entityType: 'product_ownership',
          entityId: id,
          action: 'verified',
          oldValue: null,
          newValue: { reference: data.reference, verifiedAt: row.ownershipVerifiedAt },
        },
        { transaction },
      );
      return { verifiedAt: row.ownershipVerifiedAt };
    });
  }
}
