import type { Transaction } from 'sequelize';
import ProductConditionTypeModel from '../database/client/models/ProductConditionType.Model';
import ProductModel from '../database/client/models/Product.Model';
import UserModel from '../database/internal/models/User.Model';
import HttpError from '../../../shared/server/utils/HttpError';
import {
  BUILT_IN_CONDITIONS,
  CONDITION_KEY_PATTERN,
  SKU_SUFFIX_PATTERN,
  type ProductConditionType,
} from '../../../shared/product-conditions';
import { slugify } from '../../../shared/slug';

const RULE_FIELDS = ['uniqueUnit', 'requiresMissingAccessories', 'requiresDefects'] as const;
const CACHE_MS = 30_000;
let cache: { at: number; list: ProductConditionType[] } | null = null;

const plain = (row: ProductConditionTypeModel): ProductConditionType => ({
  key: row.key,
  nameVi: row.nameVi,
  nameEn: row.nameEn,
  descriptionVi: row.descriptionVi,
  descriptionEn: row.descriptionEn,
  skuSuffix: row.skuSuffix,
  sortOrder: row.sortOrder,
  isActive: row.isActive,
  isSystem: row.isSystem,
  uniqueUnit: row.uniqueUnit,
  requiresMissingAccessories: row.requiresMissingAccessories,
  requiresDefects: row.requiresDefects,
});

const text = (value: unknown, label: string, max: number, required = true) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (required && !trimmed) throw HttpError.badRequest(`${label}: bắt buộc.`);
  if (trimmed.length > max) throw HttpError.badRequest(`${label}: tối đa ${max} ký tự.`);
  return trimmed || null;
};

// The conditions a unit can be sold in (src/shared/product-conditions.ts). Read often (every product save and listing),
// so the list is cached for a few seconds and dropped on every change.
export default class ProductConditionService {
  // Every condition, in display order (inactive ones too: existing units keep theirs).
  async all(transaction?: Transaction): Promise<ProductConditionType[]> {
    if (cache && Date.now() - cache.at < CACHE_MS && !transaction) return cache.list;
    const rows = await ProductConditionTypeModel.findAll({
      order: [
        ['sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
      transaction,
    });
    // Before the table exists (an old database mid-migration) the built-in rules still apply.
    const list = rows.length ? rows.map(plain) : BUILT_IN_CONDITIONS;
    if (!transaction) cache = { at: Date.now(), list };
    return list;
  }

  async active() {
    return (await this.all()).filter((type) => type.isActive);
  }

  async get(key: unknown, transaction?: Transaction) {
    return (await this.all(transaction)).find((type) => type.key === key) ?? null;
  }

  // The condition a unit may be saved in: an active one, or the one it already has (a condition retired later stays on
  // the units that have it).
  async usable(key: unknown, current?: string | null) {
    const type = await this.get(key);
    return type && (type.isActive || type.key === current) ? type : null;
  }

  // For Admin: every condition with the number of products in it.
  async list() {
    const [types, counts] = await Promise.all([
      this.all(),
      ProductModel.count({ group: ['condition'], attributes: ['condition'] }) as unknown as Promise<
        { condition: string; count: number }[]
      >,
    ]);
    const used = new Map(counts.map((row) => [row.condition, Number(row.count)]));
    return types.map((type) => ({ ...type, productCount: used.get(type.key) ?? 0 }));
  }

  private async admin(userId: number) {
    const user = await UserModel.findByPk(userId);
    if (!user?.isActive || user.role !== 'ADMIN') throw HttpError.forbidden();
  }

  private values(data: Record<string, unknown>) {
    const values: Partial<ProductConditionType> = {};
    if (data.nameVi !== undefined) values.nameVi = text(data.nameVi, 'Tên tiếng Việt', 80)!;
    if (data.nameEn !== undefined) values.nameEn = text(data.nameEn, 'Tên tiếng Anh', 80)!;
    if (data.descriptionVi !== undefined)
      values.descriptionVi = text(data.descriptionVi, 'Mô tả tiếng Việt', 500, false);
    if (data.descriptionEn !== undefined)
      values.descriptionEn = text(data.descriptionEn, 'Mô tả tiếng Anh', 500, false);
    if (data.skuSuffix !== undefined) {
      const suffix = String(data.skuSuffix).trim().toUpperCase();
      if (!SKU_SUFFIX_PATTERN.test(suffix)) throw HttpError.badRequest('Hậu tố SKU: 1–8 chữ in hoa hoặc số.');
      values.skuSuffix = suffix;
    }
    if (data.sortOrder !== undefined) {
      const order = Number(data.sortOrder);
      if (!Number.isSafeInteger(order) || order < 0 || order > 10_000)
        throw HttpError.badRequest('Thứ tự: số nguyên 0–10000.');
      values.sortOrder = order;
    }
    if (data.isActive !== undefined) values.isActive = data.isActive === true;
    for (const field of RULE_FIELDS) if (data[field] !== undefined) values[field] = data[field] === true;
    return values;
  }

  async create(actorUserId: number, data: Record<string, unknown>) {
    await this.admin(actorUserId);
    const values = this.values({ isActive: true, ...data });
    if (!values.nameVi || !values.nameEn) throw HttpError.badRequest('Cần tên tiếng Việt và tiếng Anh.');
    const key = typeof data.key === 'string' && data.key.trim() ? data.key.trim() : slugify(values.nameEn).slice(0, 40);
    if (!CONDITION_KEY_PATTERN.test(key))
      throw HttpError.badRequest('Mã tình trạng: 2–40 ký tự a-z, 0-9 hoặc "-", bắt đầu bằng chữ.');
    if (await ProductConditionTypeModel.findOne({ where: { key } }))
      throw HttpError.conflict('Mã tình trạng này đã có.', 'CONDITION_EXISTS');
    const all = await this.all();
    const row = await ProductConditionTypeModel.create({
      key,
      skuSuffix:
        values.skuSuffix ??
        key
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 4)
          .toUpperCase(),
      sortOrder: values.sortOrder ?? Math.max(0, ...all.map((type) => type.sortOrder)) + 10,
      ...values,
      isSystem: false,
      createdByUserId: actorUserId,
    });
    cache = null;
    return plain(row);
  }

  // Names, descriptions, SKU suffix, order and availability of any condition; the rules of an added one only. A
  // built-in condition keeps its rules, and "new" stays available.
  async update(actorUserId: number, key: string, data: Record<string, unknown>) {
    await this.admin(actorUserId);
    const row = await ProductConditionTypeModel.findOne({ where: { key } });
    if (!row) throw HttpError.notFound('Không tìm thấy tình trạng.');
    const values = this.values(data);
    if (row.isSystem && RULE_FIELDS.some((field) => values[field] !== undefined && values[field] !== row[field]))
      throw HttpError.conflict('Không đổi quy tắc của tình trạng có sẵn.', 'SYSTEM_CONDITION');
    if (row.key === 'new' && values.isActive === false)
      throw HttpError.conflict('Tình trạng "Mới" luôn được dùng.', 'SYSTEM_CONDITION');
    await row.update(values);
    cache = null;
    return plain(row);
  }

  // Removes an added condition no product has; one in use is retired instead (isActive false).
  async remove(actorUserId: number, key: string) {
    await this.admin(actorUserId);
    const row = await ProductConditionTypeModel.findOne({ where: { key } });
    if (!row) throw HttpError.notFound('Không tìm thấy tình trạng.');
    if (row.isSystem) throw HttpError.conflict('Không xoá tình trạng có sẵn.', 'SYSTEM_CONDITION');
    if (await ProductModel.count({ where: { condition: key } }))
      throw HttpError.conflict('Tình trạng đang có sản phẩm: hãy ngừng dùng thay vì xoá.', 'CONDITION_IN_USE');
    await row.destroy();
    cache = null;
    return { key };
  }
}

// For tests: forget the cached list.
export const resetConditionCache = () => {
  cache = null;
};
