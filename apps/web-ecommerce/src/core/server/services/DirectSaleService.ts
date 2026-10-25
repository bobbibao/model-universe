import { createHash } from 'crypto';
import { Op, col, fn, where } from 'sequelize';
import DatabaseProvider from '../database/Database.Provider';
import UserModel from '../database/internal/models/User.Model';
import ProductModel, { STOREFRONT_VISIBLE } from '../database/client/models/Product.Model';
import OrderModel from '../database/client/models/Order.Model';
import OrderItemModel from '../database/client/models/OrderItem.Model';
import OrderPrepaymentModel from '../database/client/models/OrderPrepayment.Model';
import OrderReceipt from '../database/client/models/OrderReceipt.Model';
import CartService from './CartService';
import OrderService from './OrderService';
import MoneyReferenceService from './MoneyReferenceService';
import PricingApprovalService from './PricingApprovalService';
import HttpError from '../../../shared/server/utils/HttpError';
import { asTrimmedString } from '../../../shared/server/utils/ValidationUtils';
import { validateDirectSale } from './direct-sales/validation';

// Assisted sales use the same order, inventory and immutable money ledgers as website purchases.
export default class DirectSaleService {
  async products(q: unknown, rawIds?: unknown) {
    const search = asTrimmedString(q).slice(0, 150);
    const ids = typeof rawIds === 'string' ? rawIds.split(',').map(Number) : [];
    if (ids.length > 100 || ids.some((id) => !Number.isSafeInteger(id) || id < 1))
      throw HttpError.badRequest('Danh sách SKU cần tải lại không hợp lệ.');
    const products = await ProductModel.findAll({
      where: {
        ...STOREFRONT_VISIBLE,
        partnerId: null,
        stock: { [Op.gt]: 0 },
        ...(ids.length ? { id: { [Op.in]: ids } } : {}),
        ...(search
          ? { [Op.or]: [{ name: { [Op.iLike]: `%${search}%` } }, { sku: { [Op.iLike]: `%${search}%` } }] }
          : {}),
      },
      order: [
        ['name', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: ids.length || 30,
    });
    const { lines } = await new CartService().resolveLines(
      products.map((product) => ({ productId: product.id, quantity: 1 })),
    );
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      imageUrl: product.imageUrl,
      condition: product.condition,
      conditionNote: product.conditionNote,
      stock: product.stock,
      salePrice: lines.find((line) => line.productId === product.id)?.product?.salePrice ?? product.price,
    }));
  }

  async customers(q: unknown) {
    const search = asTrimmedString(q).slice(0, 150);
    if (search.length < 2) return [];
    const rows = await UserModel.findAll({
      where: {
        isActive: true,
        role: 'USER',
        [Op.or]: ['email', 'phone', 'firstName', 'lastName'].map((field) => ({
          [field]: { [Op.iLike]: `%${search}%` },
        })),
      },
      attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
      order: [['id', 'ASC']],
      limit: 10,
    });
    return rows.map((user) => ({
      id: user.id,
      name: `${user.lastName} ${user.firstName}`.trim(),
      email: user.email,
      phone: user.phone,
    }));
  }

  async create(actorUserId: number, raw: Record<string, unknown>) {
    const data = validateDirectSale(raw);
    const db = DatabaseProvider.getInstance();
    const key = `${actorUserId}:${data.requestKey}`;
    const digest = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const orders = new OrderService();
    const id = await db.transaction(async (transaction) => {
      const actor = await UserModel.findByPk(actorUserId, { transaction });
      if (!actor?.isActive || actor.role !== 'ADMIN') throw HttpError.forbidden();
      // Serialize retries before money/product locks; the same request can never decrement stock twice.
      await db.query('SELECT pg_advisory_xact_lock(836211, hashtext(:key))', { replacements: { key }, transaction });
      const prior = await OrderModel.findOne({ where: { directSaleKey: key }, transaction });
      if (prior) {
        if (prior.checkoutDigest !== digest) throw HttpError.conflict('Mã yêu cầu đã được dùng cho nội dung đơn khác.');
        return prior.id;
      }
      if (data.customerId) {
        const customer = await UserModel.findByPk(data.customerId, { transaction });
        if (!customer?.isActive || customer.role !== 'USER')
          throw HttpError.badRequest('Khách hàng không còn hoạt động.');
      }
      const paid = data.payment !== 'UNPAID';
      const handover = data.fulfillment === 'HANDOVER';
      const ledger = handover ? 'order_receipt' : 'order_prepayment';
      if (paid) {
        await MoneyReferenceService.lock(data.externalReference, ledger, transaction);
        // Also reject duplicate references within the selected ledger; MoneyReferenceService covers the others.
        const query = { where: where(fn('upper', col('externalReference')), data.externalReference), transaction };
        if (handover ? await OrderReceipt.findOne(query) : await OrderPrepaymentModel.findOne(query))
          throw HttpError.conflict('Mã khoản thu đã được dùng cho đơn khác.');
      }
      const { lines, products } = await new CartService().resolveLines(data.items, { transaction, lock: true });
      if (lines.some((line) => line.status !== 'OK') || [...products.values()].some((product) => product.partnerId))
        throw HttpError.conflict('Hàng không đủ tồn kho hoặc không đủ điều kiện bán trực tiếp. Hãy tải lại danh sách.');
      const costs = await new PricingApprovalService().unitCosts([...products.values()], transaction);
      if (lines.some((line) => !line.product || line.product.salePrice < (costs.get(line.productId) ?? 0)))
        throw HttpError.conflict('Giá bán đang thấp hơn giá vốn được duyệt. Cần kiểm tra lại giá sản phẩm.');
      const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
      if (!Number.isSafeInteger(total) || total < 1 || total > 2_147_483_647)
        throw HttpError.badRequest('Tổng tiền vượt giới hạn hỗ trợ.');
      if (total !== data.expectedTotal)
        throw HttpError.conflict('Giá đã thay đổi. Tải lại hàng và xác nhận tổng tiền mới.', 'PRICE_CHANGED');
      const order = await OrderModel.create(
        {
          userId: data.customerId,
          createdByUserId: actorUserId,
          salesChannel: data.channel,
          directSale: { fulfillment: data.fulfillment, payment: data.payment },
          directSaleKey: key,
          checkoutDigest: digest,
          status: handover ? 'DELIVERED' : 'PROCESSING',
          deliveredAt: handover ? new Date() : null,
          paymentMethod: 'COD',
          paymentStatus: 'PENDING',
          requiresCollectionConfirmation: true,
          paymentSource: data.payment === 'UNPAID' ? 'COD' : data.payment,
          // An advance receipt remains refundable through the existing prepayment workflow if this order is cancelled.
          paymentPlan: !handover && paid ? 'full' : null,
          upfrontDueVnd: !handover && paid ? total : 0,
          subtotal: total,
          discount: 0,
          shippingFee: 0,
          tax: 0,
          total,
          recipientName: data.recipientName,
          phone: data.phone,
          address: data.address,
          city: data.city,
          note: data.note || null,
        },
        { transaction },
      );
      for (const line of lines) {
        const product = products.get(line.productId)!;
        await OrderItemModel.create(
          {
            orderId: order.id,
            productId: product.id,
            productName: product.name,
            imageUrl: product.imageUrl,
            quantity: line.quantity,
            unitPrice: line.product!.salePrice,
            modelSnapshot: {
              sku: product.sku,
              condition: product.condition,
              conditionNote: product.conditionNote,
              assemblyState: product.assemblyState,
              boxCondition: product.boxCondition,
              includedAccessories: product.includedAccessories,
              missingAccessories: product.missingAccessories,
              defects: product.defects,
              partnerId: null,
              shopBenefitEligible: true,
              unitCostVnd: costs.get(product.id),
            },
          },
          { transaction },
        );
        await product.update(
          { stock: product.stock - line.quantity, sold: product.sold + line.quantity },
          { transaction },
        );
      }
      if (paid) {
        const receipt = {
          amountVnd: total,
          externalReference: data.externalReference,
          reason: `${data.payment === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} đã kiểm tra thực nhận; đơn bán trực tiếp.`,
        };
        if (handover) await orders.recordCollection(order, actorUserId, receipt, transaction);
        else {
          await OrderPrepaymentModel.create(
            { orderId: order.id, actorUserId, kind: 'receipt', ...receipt },
            { transaction },
          );
          await order.update(
            { prepaidVnd: total, paymentStatus: 'PAID', requiresCollectionConfirmation: false },
            { transaction },
          );
        }
      }
      return order.id;
    });
    return orders.getAdmin(id);
  }
}
