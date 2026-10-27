import { createHash } from 'crypto';
import { Op } from 'sequelize';
import ProductModel from '../../database/client/models/Product.Model';
import PromotionAuditModel from '../../database/client/models/PromotionAudit.Model';
import CatalogIntakeModel from '../../database/client/models/CatalogIntake.Model';
import OrderItemModel from '../../database/client/models/OrderItem.Model';
import OrderModel from '../../database/client/models/Order.Model';
import ReservationModel from '../../database/client/models/Reservation.Model';
import RestockSubscriptionModel from '../../database/client/models/RestockSubscription.Model';
import DatabaseProvider from '../../database/Database.Provider';
import CatalogTreeService, { familyIdentity, lockCatalog } from './CatalogTreeService';
import { ITEM_TYPES, normalizeSelection, type ItemTypeKey } from '../../../../shared/condition-tree';
import { catalogPricing } from '../../../../shared/sale-pricing';

export interface CatalogMigrationDecision {
  itemTypeKey?: ItemTypeKey;
  conditionNodeKeys?: string[];
  mergeIntoId?: number;
  salePriceVnd?: number;
}
export interface CatalogMigrationDecisions {
  products: Record<string, CatalogMigrationDecision>;
  secondaryReferences: Record<string, { action: 'create' | 'ignore'; approvePrice?: boolean }>;
}
const fingerprint = (row: Record<string, any>) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        row.id,
        row.updatedAt,
        row.stock,
        row.sold,
        row.condition,
        row.modelFamilyId,
        row.combinationKey,
        row.catalogCanonicalId,
        row.pricingReferenceMemberVnd,
        row.pricingReferencePreownedVnd,
        row.missingAccessories,
        row.defects,
      ]),
    )
    .digest('hex');

export default class CatalogMigrationService {
  async report() {
    const products = await ProductModel.findAll({ where: { partnerId: null }, order: [['id', 'ASC']] });
    const rows = products
      .filter((product) => !product.catalogCanonicalId)
      .map((product) => {
        const row = product.get({ plain: true });
        const issues = [];
        if (!ITEM_TYPES.includes(product.condition as ItemTypeKey))
          issues.push('Chọn rõ New/2hand; tình trạng cũ không phải loại hàng.');
        if (
          !product.combinationKey &&
          (product.missingAccessories?.length || product.defects?.length || product.assemblyState !== 'unassembled')
        )
          issues.push('Đối chiếu các tình trạng/lắp ráp cũ sang nhánh cây.');
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          fingerprint: fingerprint(row),
          source: row,
          issues,
        };
      });
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      database: process.env.DB_NAME,
      rows,
      secondaryReferences: rows
        .filter((row) => row.source.pricingReferencePreownedVnd && !row.source.combinationKey)
        .map((row) => ({
          productId: row.id,
          price: row.source.pricingReferencePreownedVnd,
          note: 'S 2hand cũ có thể là giá placeholder. Chọn tạo SKU tham chiếu tồn 0 hoặc bỏ qua; không tự duyệt giá.',
        })),
    };
  }

  async apply(
    report: Awaited<ReturnType<CatalogMigrationService['report']>>,
    decisions: CatalogMigrationDecisions,
    actorUserId: number,
  ) {
    if (report.version !== 1 || report.database !== process.env.DB_NAME)
      throw new Error('Báo cáo không thuộc database hiện tại.');
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await lockCatalog(transaction);
      const tree = new CatalogTreeService(),
        nodes = await tree.nodes(transaction);
      const keyIds = (keys: string[]) =>
        keys.map((key) => {
          const node = nodes.find((item) => item.key === key);
          if (!node) throw new Error(`Nhánh chưa có: ${key}`);
          return node.id;
        });
      const products = await ProductModel.findAll({
        where: { partnerId: null },
        order: [['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (products.filter((product) => !product.catalogCanonicalId).length !== report.rows.length)
        throw new Error('Danh mục đã thay đổi. Tạo lại báo cáo.');
      for (const row of report.rows) {
        const product = products.find((value) => value.id === row.id);
        if (!product || fingerprint(product.get({ plain: true })) !== row.fingerprint)
          throw new Error(`Sản phẩm #${row.id} đã thay đổi. Tạo lại báo cáo.`);
      }
      const planned = [];
      for (const row of report.rows) {
        const product = products.find((value) => value.id === row.id);
        if (!product || fingerprint(product.get({ plain: true })) !== row.fingerprint)
          throw new Error(`Sản phẩm #${row.id} đã thay đổi. Tạo lại báo cáo.`);
        const decision = decisions.products[String(product.id)];
        if (row.issues.length && !decision) throw new Error(`Cần quyết định đối chiếu cho sản phẩm #${product.id}.`);
        const root = products.find((item) => item.id === product.parentProductId) ?? product;
        const type = decision?.itemTypeKey ?? product.itemTypeKey ?? product.condition;
        // A legacy preowned row has the new column's default 'new'; use its explicit legacy condition instead.
        const itemTypeKey = product.combinationKey
          ? type
          : (decision?.itemTypeKey ??
            (ITEM_TYPES.includes(product.condition as ItemTypeKey) ? product.condition : null));
        if (!itemTypeKey || !ITEM_TYPES.includes(itemTypeKey as ItemTypeKey))
          throw new Error(`Chọn loại hàng cho #${product.id}.`);
        const ids = decision?.conditionNodeKeys ? keyIds(decision.conditionNodeKeys) : (product.conditionNodeIds ?? []);
        const normalized = normalizeSelection(ids, nodes, itemTypeKey as ItemTypeKey, product.conditionNodeIds);
        planned.push({ product, decision, root, type: itemTypeKey as ItemTypeKey, ids: normalized });
      }
      // Resolve canonical SKUs first. A duplicate never merges without an explicit reviewed destination.
      for (const plan of planned.filter((item) => !item.decision?.mergeIntoId)) {
        const { product, root, decision, type, ids } = plan;
        const selection = await tree.selection(
          {
            ...root.get({ plain: true }),
            modelFamilyId: root.modelFamilyId ?? product.modelFamilyId,
            itemTypeKey: type,
            conditionNodeIds: ids,
          },
          product,
          transaction,
        );
        const pricing = decision?.salePriceVnd ? catalogPricing(decision.salePriceVnd) : null;
        const before = product.get({ plain: true });
        await product.update(
          {
            ...selection,
            parentProductId: null,
            ...(pricing
              ? {
                  pricingReferenceMemberVnd: pricing.referenceMemberVnd,
                  price: pricing.listPriceVnd,
                  buybackPriceVnd: pricing.buybackPriceVnd,
                  targetPriceApprovedAt: new Date(),
                  targetPriceApprovedByUserId: actorUserId,
                }
              : {}),
          },
          { transaction },
        );
        await tree.remember(ids, 'product', product.id, transaction);
        await PromotionAuditModel.create(
          {
            actorUserId,
            entityType: 'catalog_migration',
            entityId: product.id,
            action: 'map',
            oldValue: before,
            newValue: { ...selection, reportGeneratedAt: report.generatedAt },
          },
          { transaction },
        );
      }
      for (const plan of planned.filter((item) => item.decision?.mergeIntoId)) {
        const { product, decision, type, ids } = plan;
        const target = products.find((item) => item.id === decision!.mergeIntoId);
        if (
          !target ||
          target.id === product.id ||
          !target.combinationKey ||
          target.catalogCanonicalId ||
          target.itemTypeKey !== type ||
          JSON.stringify(target.conditionNodeIds) !== JSON.stringify(ids)
        )
          throw new Error(`Đích gộp #${product.id} không phải cùng tổ hợp đã đối chiếu.`);
        const family = await tree.family(
          { ...plan.root.get({ plain: true }), modelFamilyId: plan.root.modelFamilyId },
          transaction,
        );
        if (target.modelFamilyId !== family.id) throw new Error('Không gộp khác mẫu mô hình.');
        const pending = await OrderItemModel.count({
          where: { productId: product.id },
          include: [
            {
              model: OrderModel,
              as: 'order',
              required: true,
              where: { status: { [Op.notIn]: ['DELIVERED', 'CANCELLED'] } },
            },
          ],
          transaction,
        });
        if (
          pending ||
          (await ReservationModel.count({
            where: { productId: product.id, status: { [Op.notIn]: ['completed', 'cancelled', 'expired', 'refunded'] } },
            transaction,
          })) ||
          (await RestockSubscriptionModel.count({ where: { productId: product.id }, transaction }))
        )
          throw new Error(
            `SKU #${product.id} có đơn/giữ hàng/thông báo tồn đang tham chiếu. Hoàn tất đối chiếu các liên kết trước khi gộp.`,
          );
        const before = product.get({ plain: true });
        if (product.stock) {
          await CatalogIntakeModel.create(
            {
              productId: product.id,
              sourceType: 'migration_out',
              sourceId: String(product.id),
              quantity: -product.stock,
              unitCostVnd: product.importPrice,
              actorUserId,
              snapshot: { targetProductId: target.id, reportGeneratedAt: report.generatedAt },
            },
            { transaction },
          );
          await CatalogIntakeModel.create(
            {
              productId: target.id,
              sourceType: 'migration_in',
              sourceId: String(product.id),
              quantity: product.stock,
              unitCostVnd: product.importPrice,
              actorUserId,
              snapshot: { sourceProductId: product.id, reportGeneratedAt: report.generatedAt },
            },
            { transaction },
          );
          await target.update({ stock: target.stock + product.stock }, { transaction });
        }
        await product.update(
          {
            stock: 0,
            isArchived: true,
            isFeatured: false,
            combinationKey: null,
            catalogCanonicalId: target.id,
            parentProductId: null,
            modelFamilyId: target.modelFamilyId,
            itemTypeKey: type,
            conditionNodeIds: ids,
          },
          { transaction },
        );
        await tree.remember(ids, 'product', product.id, transaction);
        await PromotionAuditModel.create(
          {
            actorUserId,
            entityType: 'catalog_migration',
            entityId: product.id,
            action: 'merge_alias',
            oldValue: before,
            newValue: { canonicalProductId: target.id },
          },
          { transaction },
        );
      }
      for (const reference of report.secondaryReferences) {
        const decision = decisions.secondaryReferences[String(reference.productId)];
        if (!decision) throw new Error(`Quyết định giữ/bỏ S 2hand cũ của #${reference.productId}.`);
        if (decision.action === 'ignore') continue;
        if (decision.action !== 'create') throw new Error('Quyết định S 2hand không hợp lệ.');
        const source = products.find((product) => product.id === reference.productId)!;
        const familySource = source.catalogCanonicalId
          ? products.find((product) => product.id === source.catalogCanonicalId)!
          : source;
        const exists = await ProductModel.findOne({
          where: {
            modelFamilyId: familySource.modelFamilyId,
            itemTypeKey: 'preowned',
            conditionNodeIds: { [Op.eq]: [] },
            catalogCanonicalId: null,
          },
          transaction,
        });
        if (exists) {
          if (exists.pricingReferenceMemberVnd !== reference.price)
            throw new Error(
              `S 2hand cũ #${source.id} xung đột giá SKU #${exists.id}. Quyết định giữ giá tại SKU và bỏ tham chiếu cũ.`,
            );
          continue;
        }
        const selection = await tree.selection(
          { ...familySource.get({ plain: true }), itemTypeKey: 'preowned', conditionNodeIds: [] },
          null,
          transaction,
        );
        const pricing = catalogPricing(reference.price);
        await ProductModel.create(
          {
            ...familyIdentity(familySource.get({ plain: true })),
            ...selection,
            sku: `${source.sku}-LEGACY-2H`,
            imageUrl: source.imageUrl,
            stock: 0,
            sold: 0,
            importPrice: 0,
            isArchived: true,
            listingStatus: 'draft',
            pricingReferenceMemberVnd: reference.price,
            price: pricing.listPriceVnd,
            buybackPriceVnd: pricing.buybackPriceVnd,
            targetPriceApprovedAt: decision.approvePrice ? new Date() : null,
            targetPriceApprovedByUserId: decision.approvePrice ? actorUserId : null,
          },
          { transaction },
        );
      }
      return {
        mapped: planned.filter((item) => !item.decision?.mergeIntoId).length,
        aliases: planned.filter((item) => item.decision?.mergeIntoId).length,
      };
    });
  }
}
