import { Op, QueryTypes, Transaction, type WhereOptions } from 'sequelize';
import DatabaseProvider from '../database/Database.Provider';
import ProductModel from '../database/client/models/Product.Model';
import ProductCostProfileModel, {
  profileUnitCostVnd,
  type PricingRecordStatus,
} from '../database/client/models/ProductCostProfile.Model';
import ProductPriceApprovalModel from '../database/client/models/ProductPriceApproval.Model';
import PromotionAuditModel from '../database/client/models/PromotionAudit.Model';
import UserModel from '../database/internal/models/User.Model';
import HttpError from '../../../shared/server/utils/HttpError';
import type { VoucherPolicy } from '../../../shared/voucher-stack';
import CommercePolicyService from './CommercePolicyService';

// The price and cost data the v6.2 profit guard reads (docs/business/pricing-voucher-specification.md, decision V3).
// R: the published product price, unless an approved price record exists and differs from it; under the policy
// `pricingApproval: 'required'` only a price that matches an approved record counts. A product still sold at its
// target price S (owner rule of 2026-10-25: `listPriceVerified` false, no real R approved yet) has no R at all. C: the approved cost profile
// (with the latest receipt price when that is higher than its buy-in) or, without one, the receipt price
// `importPrice`. A price or cost the guard cannot trust blocks every code (MISSING_DATA).
export interface EffectivePricing {
  costVnd: number;
  priceApproved: boolean;
}

export type PricingRecordKind = 'price' | 'cost';
// `listPriceVerified` may be left unloaded by a caller; then only the approved records decide.
type PricedProduct = Pick<ProductModel, 'id' | 'price' | 'importPrice' | 'partnerId'> &
  Partial<Pick<ProductModel, 'listPriceVerified'>>;

const COST_FIELDS = [
  'buyInVnd',
  'repairVnd',
  'packagingVnd',
  'handlingVnd',
  'shippingSubsidyVnd',
  'fixedFeeVnd',
  'expectedReturnVnd',
] as const;
const COST_LABELS: Record<(typeof COST_FIELDS)[number], string> = {
  buyInVnd: 'Giá nhập/thu',
  repairVnd: 'Sửa chữa',
  packagingVnd: 'Đóng gói',
  handlingVnd: 'Xử lý',
  shippingSubsidyVnd: 'Phí ship shop chịu',
  fixedFeeVnd: 'Phí cố định',
  expectedReturnVnd: 'Chi phí đổi trả dự kiến',
};

const wholeVnd = (value: unknown, label: string, min = 0) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > 2_000_000_000)
    throw HttpError.badRequest(`${label}: nhập số tiền VND nguyên, tối thiểu ${min}.`);
  return value;
};
const text = (value: unknown, label: string, max = 1000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw HttpError.badRequest(`${label}: bắt buộc, tối đa ${max} ký tự.`);
  return value.trim();
};

export default class PricingApprovalService {
  private policies = new CommercePolicyService();

  // Everything the guard needs for these products: the approved voucher policy (and its version, for the order
  // snapshot) and their effective price and cost.
  async context(products: Iterable<PricedProduct>, transaction?: Transaction) {
    const { policy, version } = await this.policies.voucherPolicy(transaction);
    return { policy, policyVersion: version, pricing: await this.effective([...products], policy, transaction) };
  }

  // Approved records of these products, for the guard.
  async effective(
    products: readonly PricedProduct[],
    policy: Pick<VoucherPolicy, 'pricingApproval'>,
    transaction?: Transaction,
  ): Promise<Map<number, EffectivePricing>> {
    const ids = [...new Set(products.filter((product) => !product.partnerId).map((product) => product.id))];
    const where = { productId: { [Op.in]: ids }, status: 'APPROVED' };
    const [costs, prices] = ids.length
      ? await Promise.all([
          ProductCostProfileModel.findAll({ where, transaction }),
          ProductPriceApprovalModel.findAll({ where, transaction }),
        ])
      : [[], []];
    const costOf = new Map(costs.map((row) => [row.productId, row]));
    const priceOf = new Map(prices.map((row) => [row.productId, row]));
    return new Map(
      products.map((product) => {
        const profile = costOf.get(product.id),
          approved = priceOf.get(product.id);
        const receipt = product.importPrice ?? 0;
        return [
          product.id,
          {
            costVnd: profile ? profileUnitCostVnd(profile, receipt) : receipt,
            priceApproved: product.partnerId
              ? true
              : product.listPriceVerified === false
                ? false
                : approved
                ? approved.listPriceVnd === product.price
                : policy.pricingApproval === 'recorded',
          },
        ];
      }),
    );
  }

  // The unit cost C of these products (the approved cost profile, else the receipt price), for the direct-sale floor.
  async unitCosts(
    products: readonly PricedProduct[],
    transaction?: Transaction,
  ) {
    const effective = await this.effective(products, { pricingApproval: 'recorded' }, transaction);
    return new Map([...effective].map(([id, value]) => [id, value.costVnd]));
  }

  // Products with their approved and proposed records (newest first) for the admin page, with the counts staff scan
  // first. `filter`: 'pending' (a draft awaits a second admin), 'mismatch' (the price changed after approval),
  // 'unapproved' (no approved real list price R yet: the shop sells at S), 'target' (S awaits approval).
  async list(query: { q?: unknown; filter?: unknown; limit?: unknown; offset?: unknown } = {}) {
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    const filter = ['pending', 'mismatch', 'unapproved', 'target'].includes(String(query.filter))
      ? String(query.filter)
      : 'all';
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
    const offset = Math.max(0, Number(query.offset) || 0);
    const db = DatabaseProvider.getInstance();
    const ids = async (sql: string) =>
      ((await db.query(sql, { type: QueryTypes.SELECT })) as { id: number }[]).map((row) => row.id);
    const [pendingIds, mismatchIds, approvedIds] = await Promise.all([
      ids(`SELECT DISTINCT "productId" AS id FROM product_price_approval WHERE status = 'DRAFT'
           UNION SELECT DISTINCT "productId" FROM product_cost_profile WHERE status = 'DRAFT'`),
      ids(`SELECT a."productId" AS id FROM product_price_approval a JOIN product p ON p.id = a."productId"
            WHERE a.status = 'APPROVED' AND a."listPriceVnd" <> p.price`),
      ids(`SELECT "productId" AS id FROM product_price_approval WHERE status = 'APPROVED'`),
    ]);
    const where: WhereOptions = {
      partnerId: null,
      isArchived: false,
      ...(q ? { [Op.or]: [{ name: { [Op.iLike]: `%${q}%` } }, { sku: { [Op.iLike]: `%${q}%` } }] } : {}),
      ...(filter === 'pending' ? { id: { [Op.in]: pendingIds } } : {}),
      ...(filter === 'mismatch' ? { id: { [Op.in]: mismatchIds } } : {}),
      ...(filter === 'unapproved'
        ? { [Op.or]: [{ listPriceVerified: false }, { id: { [Op.notIn]: approvedIds.length ? approvedIds : [0] } }] }
        : {}),
      ...(filter === 'target' ? { targetPriceApprovedAt: null } : {}),
    };
    const shop = { partnerId: null, isArchived: false };
    const [{ rows: products, count }, activeCount, targetPending, soldAtTarget] = await Promise.all([
      ProductModel.findAndCountAll({
        where,
        attributes: [
          'id',
          'sku',
          'name',
          'imageUrl',
          'price',
          'importPrice',
          'pricingReferenceMemberVnd',
          'buybackPriceVnd',
          'targetPriceApprovedAt',
          'listPriceVerified',
          'partnerId',
        ],
        order: [['id', 'ASC']],
        limit,
        offset,
      }),
      ProductModel.count({ where: shop }),
      ProductModel.count({ where: { ...shop, targetPriceApprovedAt: null } }),
      ProductModel.count({ where: { ...shop, listPriceVerified: false } }),
    ]);
    const productIds = products.map((product) => product.id);
    const [costs, prices] = await Promise.all([
      ProductCostProfileModel.findAll({ where: { productId: { [Op.in]: productIds } }, order: [['version', 'DESC']] }),
      ProductPriceApprovalModel.findAll({ where: { productId: { [Op.in]: productIds } }, order: [['version', 'DESC']] }),
    ]);
    const effective = await this.effective(products, { pricingApproval: 'recorded' });
    return {
      summary: {
        products: activeCount,
        pending: pendingIds.length,
        mismatch: mismatchIds.length,
        approved: approvedIds.length,
        targetPending,
        soldAtTarget,
      },
      count,
      rows: products.map((product) => {
        const priceRecords = prices.filter((row) => row.productId === product.id);
        const approvedPrice = priceRecords.find((row) => row.status === 'APPROVED') ?? null;
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          imageUrl: product.imageUrl,
          priceVnd: product.price,
          receiptCostVnd: product.importPrice,
          referenceMemberVnd: product.pricingReferenceMemberVnd,
          buybackPriceVnd: product.buybackPriceVnd,
          targetPriceApprovedAt: product.targetPriceApprovedAt,
          listPriceVerified: product.listPriceVerified,
          unitCostVnd: effective.get(product.id)!.costVnd,
          // The product's current price differs from its approved R: codes are blocked until it is approved again.
          priceMismatch: product.listPriceVerified && !!approvedPrice && approvedPrice.listPriceVnd !== product.price,
          prices: priceRecords.slice(0, 5),
          costs: costs.filter((row) => row.productId === product.id).slice(0, 5),
        };
      }),
    };
  }

  private async admin(userId: number, transaction: Transaction) {
    const user = await UserModel.findByPk(userId, { transaction });
    if (!user?.isActive || user.role !== 'ADMIN') throw HttpError.forbidden();
  }

  private async product(productId: unknown, transaction: Transaction) {
    const product = await ProductModel.findByPk(Number(productId) || 0, { transaction, lock: transaction.LOCK.UPDATE });
    if (!product) throw HttpError.notFound('Không tìm thấy sản phẩm.');
    if (product.partnerId) throw HttpError.conflict('Hàng đối tác được định giá qua tin đăng của người bán.');
    return product;
  }

  private nextVersion(model: typeof ProductCostProfileModel | typeof ProductPriceApprovalModel, productId: number, transaction: Transaction) {
    return (model as typeof ProductCostProfileModel)
      .max('version', { where: { productId }, transaction })
      .then((max) => (Number(max) || 0) + 1);
  }

  // Approve the target selling price S (owner rule of 2026-10-25): B17 = 17% × S is offered for buy-backs only once S
  // is approved. One admin, audited; a changed S clears the approval (ProductService, the owner catalogue sync).
  async approveTarget(productId: unknown, actorUserId: number) {
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await this.admin(actorUserId, transaction);
      const product = await this.product(productId, transaction);
      if (!product.pricingReferenceMemberVnd) throw HttpError.conflict('Sản phẩm chưa có giá bán mục tiêu S.', 'NO_TARGET_PRICE');
      if (product.targetPriceApprovedAt) return product;
      await product.update({ targetPriceApprovedAt: new Date(), targetPriceApprovedByUserId: actorUserId }, { transaction });
      await this.audit(
        'product_pricing',
        product.id,
        'approve_target',
        actorUserId,
        null,
        { referenceMemberVnd: product.pricingReferenceMemberVnd, buybackPriceVnd: product.buybackPriceVnd },
        transaction,
      );
      return product;
    });
  }

  // A DRAFT real list price R with the proof that it is really published (a listing, an invoice). R is entered, never
  // derived from S; once a second admin approves it, it becomes the price charged.
  async proposePrice(actorUserId: number, data: Record<string, unknown>) {
    const proof = text(data.proof, 'Nơi công bố giá'),
      reason = text(data.reason, 'Lý do');
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await this.admin(actorUserId, transaction);
      const product = await this.product(data.productId, transaction);
      const listPriceVnd = wholeVnd(data.listPriceVnd, 'Giá niêm yết', 1);
      const row = await ProductPriceApprovalModel.create(
        {
          productId: product.id,
          version: await this.nextVersion(ProductPriceApprovalModel, product.id, transaction),
          listPriceVnd,
          referenceMemberVnd: product.pricingReferenceMemberVnd ?? null,
          proof,
          reason,
          proposedByUserId: actorUserId,
        },
        { transaction },
      );
      await this.audit('price_approval', row.id, 'propose', actorUserId, null, row.get({ plain: true }), transaction);
      return row;
    });
  }

  // A DRAFT cost profile.
  async proposeCost(actorUserId: number, data: Record<string, unknown>) {
    const reason = text(data.reason, 'Lý do');
    const values = Object.fromEntries(
      COST_FIELDS.map((field) => [field, wholeVnd(data[field] ?? 0, COST_LABELS[field], field === 'buyInVnd' ? 1 : 0)]),
    ) as Record<(typeof COST_FIELDS)[number], number>;
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await this.admin(actorUserId, transaction);
      const product = await this.product(data.productId, transaction);
      const row = await ProductCostProfileModel.create(
        {
          productId: product.id,
          version: await this.nextVersion(ProductCostProfileModel, product.id, transaction),
          ...values,
          reason,
          proposedByUserId: actorUserId,
        },
        { transaction },
      );
      await this.audit('cost_profile', row.id, 'propose', actorUserId, null, row.get({ plain: true }), transaction);
      return row;
    });
  }

  private model(kind: PricingRecordKind) {
    if (kind === 'price') return ProductPriceApprovalModel as unknown as typeof ProductCostProfileModel;
    if (kind === 'cost') return ProductCostProfileModel;
    throw HttpError.badRequest('Loại hồ sơ giá không hợp lệ.');
  }

  // Approve a DRAFT: a second admin, never the proposer (v6.2 SRS: separate approver). The product's earlier approved
  // record is retired in the same transaction, so at most one is approved.
  async approve(kind: PricingRecordKind, id: number, actorUserId: number) {
    const model = this.model(kind);
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await this.admin(actorUserId, transaction);
      const row = await model.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw HttpError.notFound('Không tìm thấy hồ sơ giá.');
      if (row.status !== 'DRAFT') throw HttpError.conflict('Chỉ duyệt được bản nháp.');
      if (row.proposedByUserId === actorUserId)
        throw HttpError.conflict('Cần một quản trị viên khác duyệt đề xuất của bạn.', 'SEPARATE_APPROVER');
      const product = await this.product(row.productId, transaction);
      const now = new Date();
      if (kind === 'price') {
        // The approved real list price R becomes the price charged (it replaces S or an earlier R).
        const listPriceVnd = (row as unknown as ProductPriceApprovalModel).listPriceVnd;
        const oldValue = { listPriceVnd: product.price, listPriceVerified: product.listPriceVerified };
        await product.update({ price: listPriceVnd, listPriceVerified: true }, { transaction });
        await this.audit('product_pricing', product.id, 'approve_list_price', actorUserId, oldValue, { listPriceVnd, listPriceVerified: true }, transaction);
      }
      await model.update(
        { status: 'RETIRED' as PricingRecordStatus, retiredByUserId: actorUserId, retiredAt: now },
        { where: { productId: row.productId, status: 'APPROVED' }, transaction },
      );
      const before = row.get({ plain: true });
      await row.update({ status: 'APPROVED', approvedByUserId: actorUserId, approvedAt: now }, { transaction });
      await this.audit(kind === 'price' ? 'price_approval' : 'cost_profile', row.id, 'approve', actorUserId, before, row.get({ plain: true }), transaction);
      return row;
    });
  }

  // Withdraw a draft. An approved record is only ever replaced by approving a newer draft (a second admin): retiring it
  // directly could fall back to a lower cost or unblock a changed price without that second look.
  async retire(kind: PricingRecordKind, id: number, actorUserId: number) {
    const model = this.model(kind);
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await this.admin(actorUserId, transaction);
      const row = await model.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw HttpError.notFound('Không tìm thấy hồ sơ giá.');
      if (row.status === 'RETIRED') return row;
      if (row.status !== 'DRAFT')
        throw HttpError.conflict('Bản đã duyệt chỉ được thay bằng cách duyệt một bản đề xuất mới hơn.', 'APPROVED_RECORD');
      const before = row.get({ plain: true });
      await row.update({ status: 'RETIRED', retiredByUserId: actorUserId, retiredAt: new Date() }, { transaction });
      await this.audit(kind === 'price' ? 'price_approval' : 'cost_profile', row.id, 'retire', actorUserId, before, row.get({ plain: true }), transaction);
      return row;
    });
  }

  private audit(
    entityType: string,
    entityId: number,
    action: string,
    actorUserId: number,
    oldValue: Record<string, unknown> | null,
    newValue: Record<string, unknown>,
    transaction: Transaction,
  ) {
    return PromotionAuditModel.create({ actorUserId, entityType, entityId, action, oldValue, newValue }, { transaction });
  }
}
