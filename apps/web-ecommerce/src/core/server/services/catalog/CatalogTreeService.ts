import { createHash } from 'crypto';
import { Op, type Transaction } from 'sequelize';
import DatabaseProvider from '../../database/Database.Provider';
import ConditionNodeModel from '../../database/client/models/ConditionNode.Model';
import ConditionUsageModel from '../../database/client/models/ConditionUsage.Model';
import ModelFamilyModel from '../../database/client/models/ModelFamily.Model';
import ProductModel from '../../database/client/models/Product.Model';
import BuybackRequestModel from '../../database/client/models/BuybackRequest.Model';
import PawnContractModel from '../../database/client/models/PawnContract.Model';
import PromotionAuditModel from '../../database/client/models/PromotionAudit.Model';
import HttpError from '../../../../shared/server/utils/HttpError';
import {
  ancestors,
  conditionPath,
  normalizeSelection,
  ITEM_TYPES,
  type ConditionNode,
  type ItemTypeKey,
  type ConditionCaseSnapshot,
} from '../../../../shared/condition-tree';
import { CONDITION_TREE_DEFAULTS } from '../../../../shared/condition-tree-defaults';

export const FAMILY_FIELDS = [
  'name',
  'brandName',
  'modelCode',
  'scale',
  'description',
  'descriptionEn',
  'descriptionVi',
  'categoryId',
  'weight',
  'dimensions',
  'packaging',
] as const;
export const familyIdentity = (product: Record<string, any>) =>
  Object.fromEntries(FAMILY_FIELDS.map((key) => [key, product[key] ?? null]));
export const combinationKey = (
  familyId: number,
  type: ItemTypeKey,
  ids: readonly number[],
  partnerId?: number | null,
) =>
  `${partnerId ? `partner-${partnerId}` : 'shop'}:${familyId}:${type}:${createHash('sha256')
    .update(JSON.stringify([...new Set(ids)].sort((a, b) => a - b)))
    .digest('hex')}`;
// Serializes definition/identity mutations, not checkout or inventory. Prevents remove-vs-assign races.
export const lockCatalog = (transaction: Transaction) =>
  DatabaseProvider.getInstance().query('SELECT pg_advisory_xact_lock(20261027, 54)', { transaction });

export default class CatalogTreeService {
  async remember(ids: readonly number[], entityType: string, entityId: number, transaction: Transaction) {
    for (const nodeId of ids)
      await ConditionUsageModel.findOrCreate({ where: { nodeId, entityType, entityId }, transaction });
  }
  async nodes(transaction?: Transaction): Promise<ConditionNode[]> {
    return (
      await ConditionNodeModel.findAll({
        order: [
          ['sortOrder', 'ASC'],
          ['id', 'ASC'],
        ],
        transaction,
      })
    ).map((row) => row.get({ plain: true }) as ConditionNode);
  }
  async seed(transaction?: Transaction) {
    for (const [key, parentKey, nameVi, nameEn, selectable, selectionMode] of CONDITION_TREE_DEFAULTS) {
      const parent = parentKey ? await ConditionNodeModel.findOne({ where: { key: parentKey }, transaction }) : null;
      await ConditionNodeModel.findOrCreate({
        where: { key },
        defaults: {
          key,
          parentId: parent?.id ?? null,
          nameVi,
          nameEn,
          selectable,
          selectionMode: selectionMode ?? 'multiple',
          sortOrder: CONDITION_TREE_DEFAULTS.findIndex((row) => row[0] === key) * 10,
        },
        transaction,
      });
    }
  }
  async list() {
    const [nodes, products] = await Promise.all([
      this.nodes(),
      ProductModel.findAll({ attributes: ['conditionNodeIds'] }),
    ]);
    return nodes.map((node) => ({
      ...node,
      productCount: products.filter((product) =>
        (product.conditionNodeIds ?? []).some((id) => id === node.id || ancestors(id, nodes).includes(node.id)),
      ).length,
    }));
  }
  async save(actorUserId: number, data: Record<string, unknown>, id?: number) {
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await lockCatalog(transaction);
      const nodes = await this.nodes(transaction);
      const current = id ? await ConditionNodeModel.findByPk(id, { transaction }) : null;
      if (id && !current) throw HttpError.notFound('Không tìm thấy nhánh tình trạng.');
      if (current && data.expectedVersion !== current.version)
        throw HttpError.conflict('Nhánh vừa thay đổi. Vui lòng tải lại.', 'CONDITION_CHANGED');
      const before = current?.get({ plain: true }) ?? null;
      const parentId =
        data.parentId === undefined
          ? (current?.parentId ?? null)
          : data.parentId === null || data.parentId === ''
            ? null
            : Number(data.parentId);
      if (
        parentId !== null &&
        (!nodes.some((node) => node.id === parentId) ||
          parentId === id ||
          (id && ancestors(parentId, nodes).includes(id)))
      )
        throw HttpError.badRequest('Nhánh cha không hợp lệ hoặc tạo vòng lặp.');
      const label = (key: string) => String(data[key] ?? current?.get(key) ?? '').trim();
      const nameVi = label('nameVi'),
        nameEn = label('nameEn') || nameVi;
      const itemTypes = data.itemTypes ?? current?.itemTypes ?? ['preowned'];
      if (
        !nameVi ||
        nameVi.length > 120 ||
        nameEn.length > 120 ||
        !Array.isArray(itemTypes) ||
        !itemTypes.length ||
        itemTypes.some((type) => !ITEM_TYPES.includes(type))
      )
        throw HttpError.badRequest('Tên và loại hàng áp dụng không hợp lệ.');
      const selectable = data.selectable === undefined ? (current?.selectable ?? false) : data.selectable === true;
      const selectionMode = data.selectionMode ?? current?.selectionMode ?? 'multiple';
      const sortOrder = Number(data.sortOrder ?? current?.sortOrder ?? nodes.length * 10);
      if (
        !['single', 'multiple'].includes(String(selectionMode)) ||
        !Number.isSafeInteger(sortOrder) ||
        sortOrder < -2147483648 ||
        sortOrder > 2147483647
      )
        throw HttpError.badRequest('Quy tắc chọn hoặc thứ tự không hợp lệ.');
      const key =
        current?.key ??
        String(
          data.key ??
            `custom-${createHash('sha256').update(`${nameVi}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16)}`,
        );
      if (!/^[a-z][a-z0-9-]{1,99}$/.test(key)) throw HttpError.badRequest('Mã nhánh không hợp lệ.');
      const values = {
        key,
        parentId,
        nameVi,
        nameEn,
        description: label('description').slice(0, 2000) || null,
        selectable,
        selectionMode: selectionMode as 'single' | 'multiple',
        sortOrder,
        itemTypes,
        isActive: data.isActive === undefined ? (current?.isActive ?? true) : data.isActive === true,
        version: (current?.version ?? -1) + 1,
      };
      if (current) {
        // A move may not silently invalidate an existing combination or broaden a used group into a selectable item.
        const after = nodes.map((node) => (node.id === id ? ({ ...node, ...values } as ConditionNode) : node));
        const branchIds = nodes
          .filter((node) => node.id === id || ancestors(node.id, nodes).includes(id!))
          .map((node) => node.id);
        const products = await ProductModel.findAll({
          attributes: ['conditionNodeIds', 'itemTypeKey'],
          where: { [Op.or]: branchIds.map((nodeId) => ({ conditionNodeIds: { [Op.contains]: [nodeId] } })) },
          transaction,
        });
        for (const product of products) {
          const selected = product.conditionNodeIds ?? [];
          if (!selected.some((nodeId) => nodeId === id || ancestors(nodeId, nodes).includes(id!))) continue;
          if (data.confirmImpact !== true && (parentId !== current.parentId || values.isActive !== current.isActive))
            throw HttpError.conflict(
              'Xác nhận ảnh hưởng trước khi di chuyển/ngừng dùng nhánh.',
              'CONDITION_IMPACT_CONFIRMATION',
            );
          try {
            const normalized = normalizeSelection(selected, after, product.itemTypeKey, selected);
            if (JSON.stringify(normalized) !== JSON.stringify(selected)) throw new Error('Tổ hợp sẽ thay đổi.');
          } catch {
            throw HttpError.conflict(
              'Thay đổi này làm tổ hợp đang dùng không hợp lệ. Tạo nhánh mới thay thế.',
              'CONDITION_IN_USE',
            );
          }
        }
        await current.update(values, { transaction });
      }
      const row = current ?? (await ConditionNodeModel.create(values, { transaction }));
      await PromotionAuditModel.create(
        {
          actorUserId,
          entityType: 'condition_tree',
          entityId: row.id,
          action: current ? 'update' : 'create',
          oldValue: before,
          newValue: row.get({ plain: true }),
        },
        { transaction },
      );
      return row.get({ plain: true });
    });
  }
  async remove(actorUserId: number, id: number, expectedVersion: unknown) {
    return DatabaseProvider.getInstance().transaction(async (transaction) => {
      await lockCatalog(transaction);
      const node = await ConditionNodeModel.findByPk(id, { transaction });
      if (!node) throw HttpError.notFound('Không tìm thấy nhánh.');
      if (node.version !== expectedVersion) throw HttpError.conflict('Nhánh vừa thay đổi. Vui lòng tải lại.');
      if (await ConditionNodeModel.count({ where: { parentId: id }, transaction }))
        throw HttpError.conflict('Di chuyển hoặc ngừng dùng các nhánh con trước.');
      const where = { conditionNodeIds: { [Op.contains]: [id] } };
      const used = await ProductModel.count({ where, transaction });
      const services = [
        ...(await BuybackRequestModel.findAll({ attributes: ['conditionCase'], transaction })),
        ...(await PawnContractModel.findAll({ attributes: ['conditionCase'], transaction })),
      ];
      if (
        used ||
        (await ConditionUsageModel.count({ where: { nodeId: id }, transaction })) ||
        services.some((row) => row.conditionCase?.conditionNodeIds.includes(id))
      )
        throw HttpError.conflict('Nhánh đã có lịch sử: hãy ngừng dùng thay vì xóa.');
      await PromotionAuditModel.create(
        {
          actorUserId,
          entityType: 'condition_tree',
          entityId: id,
          action: 'delete',
          oldValue: node.get({ plain: true }),
        },
        { transaction },
      );
      await node.destroy({ transaction });
      return { deleted: true };
    });
  }
  async family(values: Record<string, any>, transaction: Transaction) {
    if (values.modelFamilyId) {
      if (!Number.isSafeInteger(values.modelFamilyId) || values.modelFamilyId < 1)
        throw HttpError.badRequest('Mã mẫu mô hình không hợp lệ.');
      const family = await ModelFamilyModel.findByPk(values.modelFamilyId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!family || (family.partnerId ?? null) !== (values.partnerId ?? null))
        throw HttpError.badRequest('Mẫu mô hình không hợp lệ.');
      return family;
    }
    const normalize = (value: unknown) =>
      String(value ?? '')
        .trim()
        .toLocaleLowerCase()
        .replace(/\s+/g, ' ');
    const identityKey = createHash('sha256')
      .update(
        JSON.stringify([
          values.partnerId ?? null,
          normalize(values.brandName),
          normalize(values.modelCode),
          normalize(values.name),
          normalize(values.scale),
        ]),
      )
      .digest('hex');
    const [family] = await ModelFamilyModel.findOrCreate({
      where: { identityKey },
      defaults: {
        identityKey,
        name: values.name,
        brandName: values.brandName,
        modelCode: values.modelCode ?? null,
        scale: values.scale ?? null,
        identity: familyIdentity(values),
        partnerId: values.partnerId ?? null,
      },
      transaction,
    });
    return family;
  }
  async selection(data: Record<string, any>, current: ProductModel | null, transaction: Transaction) {
    await lockCatalog(transaction);
    const type =
      data.itemTypeKey ?? (ITEM_TYPES.includes(data.condition) ? data.condition : (current?.itemTypeKey ?? 'new'));
    const nodes = await this.nodes(transaction);
    let ids: number[];
    try {
      ids = normalizeSelection(
        data.conditionNodeIds ?? current?.conditionNodeIds ?? [],
        nodes,
        type,
        current && current.itemTypeKey === type ? current.conditionNodeIds : [],
      );
    } catch (error) {
      throw HttpError.badRequest((error as Error).message);
    }
    const family = await this.family({ ...(current?.get({ plain: true }) ?? {}), ...data }, transaction);
    const key = combinationKey(family.id, type, ids, data.partnerId ?? current?.partnerId);
    const existing = await ProductModel.findOne({ where: { combinationKey: key }, transaction });
    if (existing && existing.id !== current?.id)
      throw new HttpError(
        409,
        `Tổ hợp đã có ở sản phẩm #${existing.id}. Dùng “Nhập thêm hàng”.`,
        undefined,
        'COMBINATION_EXISTS',
        { existingProductId: String(existing.id) },
      );
    return {
      modelFamilyId: family.id as number,
      itemTypeKey: type as ItemTypeKey,
      condition: type as ItemTypeKey,
      conditionNodeIds: ids,
      combinationKey: key,
      catalogReviewRequired: false,
    };
  }
  async snapshot(data: Record<string, any>, transaction?: Transaction): Promise<ConditionCaseSnapshot> {
    const nodes = await this.nodes(transaction);
    const type = data.itemTypeKey ?? data.referenceCondition ?? 'new';
    let ids: number[];
    try {
      ids = normalizeSelection(data.conditionNodeIds ?? [], nodes, type);
    } catch (error) {
      throw HttpError.badRequest((error as Error).message);
    }
    const reference = data.referenceProductId
      ? await ProductModel.findByPk(Number(data.referenceProductId), { transaction })
      : null;
    const familyId = data.modelFamilyId ?? reference?.modelFamilyId ?? null;
    if (
      familyId !== null &&
      (!Number.isSafeInteger(familyId) ||
        !(await ModelFamilyModel.findOne({ where: { id: familyId, partnerId: null }, transaction })))
    )
      throw HttpError.badRequest('Mẫu mô hình không hợp lệ.');
    const otherCondition = String(data.otherCondition ?? '').trim();
    if (otherCondition.length > 2000) throw HttpError.badRequest('Mô tả tình trạng khác tối đa 2000 ký tự.');
    const product =
      familyId && !otherCondition
        ? await ProductModel.findOne({
            where: {
              combinationKey: combinationKey(familyId, type, ids),
              partnerId: null,
              catalogReviewRequired: false,
            },
            transaction,
          })
        : null;
    const approved =
      product?.targetPriceApprovedAt &&
      product.serviceReferenceEnabled &&
      product.inventoryStatus === 'available' &&
      !!product.pricingReferenceMemberVnd;
    return {
      modelFamilyId: familyId,
      itemTypeKey: type,
      conditionNodeIds: ids,
      labels: ids.map((id) => conditionPath(id, nodes)),
      otherCondition,
      productId: product?.id ?? null,
      salePriceVnd: approved ? product!.pricingReferenceMemberVnd : null,
      approvedAt: approved ? product!.targetPriceApprovedAt!.toISOString() : null,
      capturedAt: new Date().toISOString(),
    };
  }
}
