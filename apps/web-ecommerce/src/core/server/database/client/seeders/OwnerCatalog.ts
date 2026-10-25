import { parse } from 'csv-parse/sync';
import { ForeignKeyConstraintError, Op, type Transaction } from 'sequelize';
import ProductModel from '../models/Product.Model';
import ProductImageModel from '../models/ProductImage.Model';
import ProductSourceModel from '../models/ProductSource.Model';
import PromotionAuditModel from '../models/PromotionAudit.Model';
import { loadCatalogEntries, toSourceValues, type ProductHistory } from './ModelUniverseCatalog';
import { hash } from './SeedCatalog';
import { productHasHistory } from '../../../services/catalog/ProductHistory';
import { isModelCondition, type AssemblyState, type ModelCondition } from '../../../../../shared/gunpla';
import type { ProductPackaging } from '../../../../../shared/packing/rules';
import { catalogPricing } from '../../../../../shared/sale-pricing';
import { slugify } from '../../../../../shared/slug';
// Imported (not read from disk) so the compiled server carries it too. The owner's workbook "MODEL UNIVERSE - Danh mục
// 6 hãng và phiên bản", tab "Danh mục 6 hãng", exported on 2026-10-25
// (docs/business/source/vi/catalog-6-brands-sheet-2026-10-25.md): the shop's whole own catalogue, one row per model and
// colour version.
import ownerCatalog from './data/owner-catalog.json';

export type OwnerProductType = 'kit' | 'figure';

// One row of the owner's workbook. `key` is the product's `product_source.catalogKey`: the researched catalogue id
// (seeders/data/model-universe-catalog.json) when the row is a model researched before, else `owner-<slug of the name>`.
export interface OwnerCatalogRow {
  key: string;
  name: string;
  manufacturerSku: string | null;
  brand: string;
  productType: OwnerProductType;
  scale: string | null;
  weightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  // B (what the shop pays) and S (the member price, "Giá bán ra"); the list price R follows S by the catalogue formula.
  buyInVnd: number | null;
  memberPriceVnd: number | null;
  stock: number;
  condition: ModelCondition;
  // "Ngày nhập kho", YYYY-MM-DD (Asia/Ho_Chi_Minh).
  receivedOn: string;
}

export const loadOwnerCatalog = (): OwnerCatalogRow[] => ownerCatalog as OwnerCatalogRow[];

const PRODUCT_TYPES: Record<OwnerProductType, { assemblyState: AssemblyState; en: string; vi: string }> = {
  kit: { assemblyState: 'unassembled', en: 'Plastic model kit; assembly required', vi: 'Kit nhựa lắp ráp; cần tự lắp' },
  figure: { assemblyState: 'assembled', en: 'Finished alloy figure', vi: 'Figure hợp kim hoàn thiện' },
};

// The sheet's "Tình trạng" column; an empty cell is a new unit.
const SHEET_CONDITIONS: Record<string, ModelCondition> = {
  '': 'new',
  new: 'new',
  mới: 'new',
  '2hand': 'preowned',
  'thiếu phụ kiện': 'incomplete',
  lỗi: 'defective',
};

const isWhole = (value: unknown, min: number) => Number.isSafeInteger(value) && (value as number) >= min;

export const ownerKey = (name: string) => slugify(`owner ${name}`);

// Fails on the first row that would break the catalogue, before anything is written.
export const assertOwnerCatalogValid = (rows: OwnerCatalogRow[]): void => {
  const keys = new Set<string>();
  const names = new Set<string>();
  for (const row of rows) {
    const label = row.name || row.key;
    if (!row.key || keys.has(row.key)) throw new Error(`Duplicate or missing catalogue key: ${label}`);
    if (!row.name || !row.brand || names.has(`${row.brand}|${row.name}`))
      throw new Error(`Duplicate or missing product name: ${label}`);
    keys.add(row.key);
    names.add(`${row.brand}|${row.name}`);
    if (!PRODUCT_TYPES[row.productType]) throw new Error(`Unknown product type for ${label}`);
    if (!isModelCondition(row.condition)) throw new Error(`Unknown condition for ${label}`);
    for (const field of ['weightGram', 'lengthCm', 'widthCm', 'heightCm'] as const)
      if (!isWhole(row[field], 1)) throw new Error(`Invalid ${field} for ${label}`);
    if (!isWhole(row.stock, 0)) throw new Error(`Invalid stock for ${label}`);
    if (row.buyInVnd !== null && !isWhole(row.buyInVnd, 0)) throw new Error(`Invalid buy-in price for ${label}`);
    if (row.memberPriceVnd === null || !isWhole(row.memberPriceVnd, 1))
      throw new Error(`Invalid selling price for ${label}`);
    catalogPricing(row.memberPriceVnd);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.receivedOn) || Number.isNaN(Date.parse(row.receivedOn)))
      throw new Error(`Invalid received date for ${label}`);
    // A second-hand unit is unique and needs its own photographs: it is added in Admin, never in bulk.
    if (row.condition === 'preowned') throw new Error(`Add the pre-owned unit ${label} through Admin with its photos`);
  }
};

const money = (cell: string): number | null => {
  const digits = cell.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
};

// The researched product type of a row, else the brand's line: Cangdao and MOSHOW make finished alloy figures (Cangdao's
// CD-AS line excepted), Motor Nuclear's MNQ line is finished, everything else is a kit.
const typeOf = (brand: string, code: string | null): OwnerProductType => {
  if (brand === 'Cangdao') return code?.startsWith('CD-AS') ? 'kit' : 'figure';
  if (brand === 'Motor Nuclear') return code?.startsWith('MNQ') ? 'figure' : 'kit';
  return brand === 'MOSHOW' ? 'figure' : 'kit';
};

// The sheet exported as CSV (Google Sheets "Tải xuống > .csv"), read by its header names. Keys are matched to the
// committed catalogue by name (`known`), so a re-export keeps the researched keys; new rows get `owner-<slug>`.
export const parseOwnerCatalogCsv = (csv: string, known: OwnerCatalogRow[] = loadOwnerCatalog()): OwnerCatalogRow[] => {
  const records: Record<string, string>[] = parse(csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv, {
    columns: (header: string[]) => header.map((name) => name.trim()),
    skip_empty_lines: true,
    trim: true,
  });
  const column = (record: Record<string, string>, prefix: string) => {
    const key = Object.keys(record).find((name) => name.startsWith(prefix));
    if (!key) throw new Error(`The CSV has no column "${prefix}"`);
    return record[key] ?? '';
  };
  return records
    .filter((record) => column(record, 'Tên sản phẩm').trim())
    .map((record) => {
      const name = column(record, 'Tên sản phẩm').normalize('NFKC').replace(/\s+/g, ' ').trim();
      const brand = column(record, 'Tên hãng').trim();
      const code = name.includes(' - ') ? name.split(' - ')[0].trim() : null;
      const condition = SHEET_CONDITIONS[column(record, 'Tình trạng').trim().toLowerCase()];
      if (!condition) throw new Error(`Unknown condition "${column(record, 'Tình trạng')}" for ${name}`);
      const [day, month, year] = column(record, 'Ngày nhập kho').split('/').map(Number);
      const kg = Number(column(record, 'Khối lượng').replace(',', '.'));
      const match = known.find((row) => `${row.brand}|${row.name}` === `${brand}|${name}`);
      return {
        key: match?.key ?? ownerKey(name),
        name,
        manufacturerSku: code,
        brand,
        productType: match?.productType ?? typeOf(brand, code),
        scale: column(record, 'Tỉ lệ').trim() || null,
        weightGram: Math.round(kg * 1000),
        lengthCm: Number(column(record, 'Dài')),
        widthCm: Number(column(record, 'Rộng')),
        heightCm: Number(column(record, 'Cao')),
        buyInVnd: money(column(record, 'Giá thu vào')),
        memberPriceVnd: money(column(record, 'Giá bán ra')),
        stock: money(column(record, 'Số lượng')) ?? 0,
        condition,
        receivedOn: year
          ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          : new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10),
      };
    });
};

const receivedAt = (row: OwnerCatalogRow) => new Date(`${row.receivedOn}T00:00:00+07:00`);

const describe = (row: OwnerCatalogRow) => {
  const type = PRODUCT_TYPES[row.productType];
  return {
    en: [
      `${row.brand} ${row.name}.`,
      `${type.en}, ${row.scale ? `${row.scale} scale` : 'non-scale'}.`,
      ...(row.manufacturerSku ? [`Manufacturer code ${row.manufacturerSku}.`] : []),
    ].join(' '),
    vi: [
      `${row.brand} ${row.name}.`,
      `${type.vi}, ${row.scale ? `tỷ lệ ${row.scale}` : 'không theo tỷ lệ'}.`,
      ...(row.manufacturerSku ? [`Mã hãng ${row.manufacturerSku}.`] : []),
    ].join(' '),
  };
};

// The product columns the workbook decides. Images, SKU, featured flag, holds and sales channel stay as staff set them;
// the category is left empty (categories are not shown to customers). The workbook's selling price is the target S
// awaiting approval ("CHỜ DUYỆT"); its column R is empty, so the shop sells at S (owner rule of 2026-10-25).
export const ownerProductValues = (row: OwnerCatalogRow) => {
  const pricing = catalogPricing(row.memberPriceVnd as number);
  const { en, vi } = describe(row);
  const packaging: ProductPackaging = {
    lengthCm: row.lengthCm,
    widthCm: row.widthCm,
    heightCm: row.heightCm,
    weightGram: row.weightGram,
    fragile: true,
    orientation: 'flat',
  };
  return {
    name: row.name,
    brandName: row.brand,
    modelCode: row.manufacturerSku,
    scale: row.scale,
    description: en,
    descriptionEn: en,
    descriptionVi: vi,
    condition: row.condition,
    assemblyState: PRODUCT_TYPES[row.productType].assemblyState,
    packaging,
    weight: `${row.weightGram / 1000} kg`,
    dimensions: `${row.lengthCm} × ${row.widthCm} × ${row.heightCm} cm`,
    price: pricing.referenceMemberVnd,
    listPriceVerified: false,
    importPrice: row.buyInVnd ?? 0,
    pricingReferenceMemberVnd: pricing.referenceMemberVnd,
    pricingIssueCount: 0,
    buybackPriceVnd: pricing.buybackPriceVnd,
    stock: row.stock,
    productionDate: receivedAt(row),
    categoryId: null,
    parentProductId: null,
    isArchived: false,
  };
};

const pricingOf = (product: ProductModel) => ({
  referenceMemberVnd: product.pricingReferenceMemberVnd,
  buybackPriceVnd: product.buybackPriceVnd,
  listPriceVnd: product.price,
  actualCostVnd: product.importPrice,
  issues: product.pricingIssueCount,
});

const placeholderImage = (row: OwnerCatalogRow) =>
  `https://placehold.co/600x600/png?text=${encodeURIComponent(`${row.brand} ${row.manufacturerSku ?? row.name}`)}`;

// Deletes a product inside a savepoint; false (nothing changed) when another table still refers to it.
const destroyed = async (product: ProductModel, transaction: Transaction): Promise<boolean> => {
  try {
    await ProductModel.sequelize!.transaction({ transaction }, (savepoint) =>
      product.destroy({ transaction: savepoint }),
    );
    return true;
  } catch (error) {
    if (error instanceof ForeignKeyConstraintError) return false;
    throw error;
  }
};

export interface OwnerCatalogSyncResult {
  created: number;
  updated: number;
  unchanged: number;
  archived: number;
  deleted: number;
}

// How a development seed differs from the shop: demo stock, so the synthetic history can sell, and the seed-history
// fields (backdated creation, prior sales, a supplier).
export interface OwnerCatalogSeed {
  stock: (row: OwnerCatalogRow) => number;
  history: ProductHistory;
}

// Makes the shop's own catalogue exactly the workbook: every row's product is updated (or created, with the researched
// image when there is one, else a placeholder), and every other shop-owned product is retired: deleted when nothing
// refers to it, else archived (hidden, stock 0), like Admin's delete. Condition options of a kept product are kept.
// Partner listings are never touched. All rows or none; running it again changes nothing.
export const syncOwnerCatalog = async (
  rows: OwnerCatalogRow[],
  transaction: Transaction,
  seed?: OwnerCatalogSeed,
): Promise<OwnerCatalogSyncResult> => {
  assertOwnerCatalogValid(rows);
  const result: OwnerCatalogSyncResult = { created: 0, updated: 0, unchanged: 0, archived: 0, deleted: 0 };
  const research = new Map(loadCatalogEntries().map((entry) => [entry.id, entry]));
  const productIdByKey = new Map(
    (await ProductSourceModel.findAll({ attributes: ['catalogKey', 'productId'], transaction })).map((source) => [
      source.catalogKey,
      source.productId,
    ]),
  );
  const listings = await ProductModel.findAll({
    where: { partnerId: null, parentProductId: null },
    order: [['id', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const byId = new Map(listings.map((product) => [product.id, product]));
  const byName = new Map(listings.map((product) => [`${product.brandName}|${product.name}`, product]));

  const kept = new Set<number>();
  for (const row of rows) {
    const values = ownerProductValues(row);
    const existing = byId.get(productIdByKey.get(row.key) ?? 0) ?? byName.get(`${row.brand}|${row.name}`);
    if (existing && kept.has(existing.id)) throw new Error(`Two catalogue rows match product #${existing.id}`);
    if (existing) {
      const before = pricingOf(existing);
      // An approved real list price R stays; a changed S waits for a new approval.
      const { price, listPriceVerified, ...rest } = values;
      existing.set({
        ...rest,
        ...(existing.listPriceVerified ? {} : { price, listPriceVerified }),
        ...(existing.pricingReferenceMemberVnd !== values.pricingReferenceMemberVnd
          ? { targetPriceApprovedAt: null, targetPriceApprovedByUserId: null }
          : {}),
      });
      if (existing.changed()) {
        await existing.save({ transaction });
        result.updated++;
      } else result.unchanged++;
      if (JSON.stringify(before) !== JSON.stringify(pricingOf(existing)))
        await PromotionAuditModel.create(
          {
            actorUserId: null,
            entityType: 'product_pricing',
            entityId: existing.id,
            action: 'owner_catalog_sync',
            oldValue: before,
            newValue: pricingOf(existing),
          },
          { transaction },
        );
      kept.add(existing.id);
      continue;
    }
    const entry = research.get(row.key);
    const sku = `MU-${row.key.toUpperCase()}`;
    // New products are dated by their receipt (a seed by its synthetic history), so a seed stays deterministic.
    const history = seed?.history(sku) ?? {};
    const createdAt = history.createdAt ?? values.productionDate;
    const product = await ProductModel.create(
      {
        ...values,
        ...(seed ? { stock: seed.stock(row), productionDate: createdAt } : {}),
        ...history,
        sku,
        imageUrl: entry?.image_url ?? placeholderImage(row),
        createdAt,
        updatedAt: createdAt,
      },
      { transaction, silent: true },
    );
    if (entry?.image_alt_url)
      await ProductImageModel.create(
        { productId: product.id, url: entry.image_alt_url, sortOrder: 0 },
        { transaction },
      );
    await ProductSourceModel.create(
      entry
        ? { productId: product.id, ...toSourceValues(entry) }
        : {
            productId: product.id,
            catalogKey: row.key,
            manufacturerSku: row.manufacturerSku,
            productType: row.productType === 'kit' ? 'Kit lắp ráp' : 'Figure hợp kim hoàn thiện',
            imageStatus: 'placeholder',
            verification: 'Bảng danh mục của chủ shop',
            priceSource: 'Bảng danh mục của chủ shop (giá thu vào B, giá bán ra S)',
          },
      { transaction },
    );
    await PromotionAuditModel.create(
      {
        actorUserId: null,
        entityType: 'product_pricing',
        entityId: product.id,
        action: 'owner_catalog_sync',
        oldValue: null,
        newValue: pricingOf(product),
      },
      { transaction },
    );
    kept.add(product.id);
    result.created++;
  }

  // Everything else the shop owns: condition options of a retired listing first, then the listings.
  const retired = await ProductModel.findAll({
    where: {
      partnerId: null,
      [Op.or]: [
        { parentProductId: null, id: { [Op.notIn]: [...kept] } },
        { parentProductId: { [Op.notIn]: [...kept] } },
      ],
    },
    order: [
      ['parentProductId', 'ASC NULLS LAST'],
      ['id', 'ASC'],
    ],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  for (const product of retired) {
    const options = await ProductModel.count({ where: { parentProductId: product.id }, transaction });
    if (
      options === 0 &&
      !(await productHasHistory(product.id, transaction)) &&
      (await destroyed(product, transaction))
    ) {
      result.deleted++;
    } else if (!product.isArchived || product.stock !== 0 || product.isFeatured) {
      await product.update({ isArchived: true, isFeatured: false, stock: 0 }, { transaction });
      result.archived++;
    }
  }
  return result;
};

// Demo stock of a development seed: deterministic, scarce like a collector shop (1 to 8 units).
export const demoStock = (row: OwnerCatalogRow): number => 1 + (hash(row.key) % 8);

// Whether this process seeded the owner's catalogue itself: the catalogue migration then leaves the fresh seed (its demo
// stock and history) as it is.
let seededInThisProcess = false;
export const ownerCatalogSeeded = () => seededInThisProcess;

// The development seed: the owner's catalogue with demo stock and the synthetic history.
export const seedOwnerCatalog = async (history: ProductHistory): Promise<OwnerCatalogSyncResult> => {
  const sequelize = ProductModel.sequelize;
  if (!sequelize) throw new Error('The database is not initialized.');
  const result = await sequelize.transaction((transaction) =>
    syncOwnerCatalog(loadOwnerCatalog(), transaction, { stock: demoStock, history }),
  );
  seededInThisProcess = true;
  return result;
};
