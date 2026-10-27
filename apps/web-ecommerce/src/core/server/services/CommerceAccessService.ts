import type { Transaction } from 'sequelize';
import UserModel from '../database/internal/models/User.Model';
import CommercePolicyModel from '../database/client/models/CommercePolicy.Model';
import DatabaseProvider from '../database/Database.Provider';
import HttpError from '../../../shared/server/utils/HttpError';

export default class CommerceAccessService {
  static owner(user: UserModel) {
    return !!process.env.ADMIN_EMAIL && user.email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase();
  }
  static async require(userId: number, scope: 'finance' | 'compliance', transaction?: Transaction) {
    const user = await UserModel.findByPk(userId, { transaction });
    if (!user?.isActive || user.role !== 'ADMIN' || (!this.owner(user) && !(user.commerceScopes || []).includes(scope)))
      throw HttpError.forbidden(`Requires ${scope} authorization.`);
    return user;
  }
  static async list(actorId: number) {
    const actor = await UserModel.findByPk(actorId);
    if (!actor?.isActive || actor.role !== 'ADMIN') throw HttpError.forbidden();
    return {
      canAssign: this.owner(actor),
      staff: await UserModel.findAll({
        where: { role: 'ADMIN' },
        attributes: ['id', 'email', 'firstName', 'lastName', 'commerceScopes', 'isActive'],
      }),
    };
  }
  static async assign(actorId: number, targetId: number, scopes: unknown, reason: unknown) {
    if (
      !Array.isArray(scopes) ||
      scopes.some((scope) => !['finance', 'compliance'].includes(scope)) ||
      typeof reason !== 'string' ||
      !reason.trim()
    )
      throw HttpError.badRequest('Choose explicit scopes and record the authorization reason.');
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      const owner = await UserModel.findByPk(actorId, { transaction });
      if (!owner?.isActive || owner.role !== 'ADMIN' || !this.owner(owner)) throw HttpError.forbidden();
      const target = await UserModel.findByPk(targetId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!target || target.role !== 'ADMIN') throw HttpError.badRequest('Choose an existing administrator.');
      const name = `staff_access:${targetId}`;
      const previous = await CommercePolicyModel.findOne({
        where: { name },
        order: [['version', 'DESC']],
        transaction,
      });
      await CommercePolicyModel.create(
        {
          name,
          version: (previous?.version || 0) + 1,
          settings: { scopes: [...new Set(scopes)], previousScopes: target.commerceScopes },
          approvedByUserId: actorId,
          reason,
        },
        { transaction },
      );
      await target.update({ commerceScopes: [...new Set(scopes)] }, { transaction });
    });
  }
}
