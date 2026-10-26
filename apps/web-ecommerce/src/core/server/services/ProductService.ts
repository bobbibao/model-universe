import { uniquePhotosMissing } from './catalog/ProductConditionValidation';
import { parseFilterChoices } from './catalog/ProductFilterInput';
import { rankRelatedProducts } from '../../../shared/product-recommendations';
import type { ProductDetail, ProductSummary } from '../../../shared/types/product';
import PromotionAuditModel from '../database/client/models/PromotionAudit.Model';
import { catalogPricing } from '../../../shared/sale-pricing';
import { UUID_PATTERN } from '../../../shared/slug';
import { FindOptions, Op, Order, QueryTypes, Transaction, UniqueConstraintError, WhereOptions, col, fn, literal } from 'sequelize';
import ProductModel, {
  INVENTORY_STATUSES,
  InventoryStatus,
  SALES_CHANNELS,
  STOREFRONT_VISIBLE,
  SalesChannel,
} from '../database/client/models/Product.Model';
import ProductImageModel from '../database/client/models/ProductImage.Model';
import ProductSourceModel from '../database/client/models/ProductSource.Model';
import CategoryModel from '../database/client/models/Category.Model';
import SupplierModel from '../database/client/models/Supplier.Model';
import DatabaseProvider from '../database/Database.Provider';
import { BaseServiceInterface } from './BaseServiceInterface';
import ReviewService from './ReviewService';
import ProductDiscountService, { toPricing } from './ProductDiscountService';
import FileStorageService, { PUBLIC_UPLOAD_PREFIX } from './FileStorageService';
import { productHasHistory } from './catalog/ProductHistory';
import HttpError from '../../../shared/server/utils/HttpError';
import { asTrimmedString, isHttpUrl, toInteger } from '../../../shared/server/utils/ValidationUtils';
import { ASSEMBLY_STATES } from '../../../shared/gunpla';
import type { ProductConditionType } from '../../../shared/product-conditions';
import ProductConditionService from './ProductConditionService';
import { parseProductPackaging } from '../../../shared/packing/rules';
import mediaManifest from '../../../../docs/model-universe/media-manifest.json';

export interface ProductListQuery {
  partnerId?: number;
  assemblyState?: string | string[];
  scale?: string | string[];
  condition?: string | string[];
  q?: string;
  category?: string;
  categoryId?: number;
  brand?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  channel?: string;
  status?: string;
  sort?: string;
  limit: number;
  offset: number;
}

const MAX_GALLERY_IMAGES = 10;
const MAX_CONDITION_ITEMS = 30;

const PUBLIC_SORTS: Record<string, Order> = {
  newest: [
    ['createdAt', 'DESC'],
    ['id', 'DESC'],
  ],
  price_asc: [['price', 'ASC']],
  price_desc: [['price', 'DESC']],
  name: [['name', 'ASC']],
  best_selling: [['sold', 'DESC']],
  rating: [['rating', 'DESC']],
};

const ADMIN_SORTABLE_COLUMNS = ['id', 'name', 'price', 'stock', 'sold', 'createdAt', 'productionDate'];

// Fields shown on product cards (cost price and supplier stay internal).
const LIST_ATTRIBUTES = [
  'uuid',
  'slug',
  'partnerId',
  'scale', 'modelCode', 'condition', 'assemblyState',
  'id',
  'name',
  'brandName',
  'price',
  'stock',
  // Units sold (kept by orders, reservations and support): real social proof on cards.
  'sold',
  'imageUrl',
  'rating',
  'reviewCount',
  'isFeatured',
  'salesChannel',
  'listPriceVerified',
];

// Staff-only columns: never sent to the storefront (the received date included).
const PRIVATE_ATTRIBUTES = ['importPrice', 'pricingReferenceMemberVnd', 'pricingReferencePreownedVnd', 'pricingIssueCount', 'buybackPriceVnd', 'supplierId', 'isArchived', 'inventoryStatus', 'listingRequestKey', 'listingRequestDigest', 'productionDate', 'parentProductId', 'targetPriceApprovedAt', 'targetPriceApprovedByUserId'];

// What a condition option shares with its main listing: the model itself. Staff edit it on the main listing only.
const IDENTITY_FIELDS = ['name', 'brandName', 'modelCode', 'scale', 'description', 'descriptionEn', 'descriptionVi', 'categoryId', 'supplierId', 'weight', 'dimensions', 'packaging'] as const;
const identityOf = (listing: ProductModel) =>
  Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, listing.get(field)])) as Partial<Record<(typeof IDENTITY_FIELDS)[number], unknown>>;

// Units are shown in the order of their conditions (Admin > Products > Conditions); an unknown one last.
const rankOf = (types: readonly ProductConditionType[]) => (condition: string) => {
  const index = types.findIndex((type) => type.key === condition);
  return index < 0 ? types.length : index;
};
const categoryInclude = { model: CategoryModel, as: 'category', attributes: ['id', 'name', 'slug'] };
const imagesInclude = { model: ProductImageModel, as: 'images', attributes: ['id', 'url', 'sortOrder'] };

const isImageUrl = (url: string) => url.startsWith(`${PUBLIC_UPLOAD_PREFIX}/`) || url.startsWith('/images/catalog/') || isHttpUrl(url);

const galleryUrls = (product: ProductModel): string[] =>
  ((product.get('images') as ProductImageModel[] | undefined) || [])
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => image.url);

const textList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.length <= MAX_CONDITION_ITEMS ? value.map((item) => asTrimmedString(item)).filter(Boolean) : null;

type Row = Record<string, string | number | null>;

export default class ProductService implements BaseServiceInterface<ProductModel> {
  private reviewService = new ReviewService();
  private discountService = new ProductDiscountService();
  private conditions = new ProductConditionService();
  private fileStorageService = new FileStorageService();

  findByPk(id: string | number): Promise<ProductModel | null> {
    return ProductModel.findByPk(id);
  }

  findAll(filter?: FindOptions): Promise<ProductModel[]> {
    return ProductModel.findAll(filter);
  }

  insert(data: Record<string, unknown>): Promise<ProductModel> {
    return this.create(data);
  }

  bulkInsert(): Promise<ProductModel[] | null> {
    throw new Error('Method not implemented.');
  }

  private buildWhere(query: ProductListQuery): WhereOptions {
    const conditions: WhereOptions[] = [];
    // Every word must appear in some searchable column, in any order: "Dynames custom" finds
    // "Gundam Dynames — custom painted display". Hyphens stay inside codes such as "MS-06F".
    const words = asTrimmedString(query.q).split(/[^\p{L}\p{N}-]+/u).filter(Boolean).slice(0, 8);
    for (const word of words) {
      const pattern = `%${word.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push({
        [Op.or]: ['name', 'brandName', 'sku', 'modelCode'].map((column) => ({ [column]: { [Op.iLike]: pattern } })),
      });
    }
    const brands = parseFilterChoices(query.brand);
    if (brands.length) conditions.push({ brandName: { [Op.in]: brands } });
    for (const field of ['scale', 'condition'] as const) {
      const values = parseFilterChoices(query[field]);
      if (values.length) conditions.push({ [field]: { [Op.in]: values } });
    }
    if (query.categoryId) conditions.push({ categoryId: query.categoryId });
    if (query.partnerId !== undefined) conditions.push({ partnerId: query.partnerId });
    if (query.minPrice !== undefined) conditions.push({ price: { [Op.gte]: query.minPrice } });
    if (query.maxPrice !== undefined) conditions.push({ price: { [Op.lte]: query.maxPrice } });
    const assemblies = parseFilterChoices(query.assemblyState);
    if (assemblies.length) {
      if (assemblies.some((value) => !ASSEMBLY_STATES.includes(value as typeof ASSEMBLY_STATES[number]))) throw HttpError.badRequest('Invalid assembly state filter.');
      conditions.push({ assemblyState: { [Op.in]: assemblies } });
    }
    if (query.inStock) conditions.push({ stock: { [Op.gt]: 0 } });
    if (query.featured) conditions.push({ isFeatured: true });
    if (query.channel && SALES_CHANNELS.includes(query.channel as SalesChannel)) {
      conditions.push({ salesChannel: query.channel });
    }
    return { [Op.and]: conditions };
  }

  // The main listings of the units matching a filter: a model is found through any of its conditions (a search for
  // pre-owned kits lists the models that have a pre-owned unit).
  private async matchingListingIds(where: WhereOptions, category?: string): Promise<number[]> {
    const units = await ProductModel.findAll({
      attributes: ['id', 'parentProductId'],
      where,
      include: category ? [{ ...categoryInclude, attributes: [], where: { slug: category }, required: true }] : [],
    });
    return [...new Set(units.map((unit) => unit.parentProductId ?? unit.id))];
  }

  // Each listing with the conditions it is offered in: units, stock and the lowest price the customer pays.
  private async withConditions<T extends { id: number }>(listings: T[], where: WhereOptions = STOREFRONT_VISIBLE) {
    if (listings.length === 0) return [];
    const types = await this.conditions.all();
    const ids = listings.map((listing) => listing.id);
    const units = await this.discountService.withPricing(
      await ProductModel.findAll({
        attributes: ['id', 'parentProductId', 'condition', 'price', 'stock'],
        where: { [Op.and]: [where, { [Op.or]: [{ id: ids }, { parentProductId: ids }] }] },
      }),
    );
    return listings.map((listing) => {
      const group = units.filter((unit) => (unit.parentProductId ?? unit.id) === listing.id);
      const conditions = types.map(({ key: condition }) => {
        const same = group.filter((unit) => unit.condition === condition);
        const available = same.filter((unit) => unit.stock > 0);
        return {
          condition,
          units: same.length,
          stock: same.reduce((sum, unit) => sum + unit.stock, 0),
          minSalePrice: Math.min(...(available.length ? available : same).map((unit) => unit.salePrice)),
        };
      }).filter((summary) => summary.units > 0);
      return { ...listing, conditions, groupStock: group.reduce((sum, unit) => sum + unit.stock, 0) };
    });
  }

  // Storefront listing: one card per model (its main listing); archived or held-back units are never returned.
  // Prices include running discounts.
  async listPublic(query: ProductListQuery) {
    const ids = await this.matchingListingIds({ [Op.and]: [this.buildWhere(query), STOREFRONT_VISIBLE] }, query.category);
    const { rows, count } = await ProductModel.findAndCountAll({
      attributes: LIST_ATTRIBUTES,
      where: { ...STOREFRONT_VISIBLE, id: ids, parentProductId: null },
      include: [categoryInclude],
      order: PUBLIC_SORTS[query.sort || ''] || PUBLIC_SORTS.newest,
      limit: query.limit,
      offset: query.offset,
      distinct: true,
    });
    return { rows: await this.withConditions(await this.discountService.withPricing(rows)), count };
  }

  // Values for the storefront filter bar.
  async getFilterOptions() {
    const brands = await ProductModel.findAll({
      attributes: [[fn('DISTINCT', col('brandName')), 'brandName']],
      where: STOREFRONT_VISIBLE,
      order: [['brandName', 'ASC']],
      raw: true,
    });
    const scales = await ProductModel.findAll({
      attributes: [[fn('DISTINCT', col('scale')), 'scale']],
      where: { ...STOREFRONT_VISIBLE, scale: { [Op.ne]: null } },
      raw: true,
    });
    const prices = (await ProductModel.findOne({
      attributes: [
        [fn('MIN', col('price')), 'min'],
        [fn('MAX', col('price')), 'max'],
      ],
      where: STOREFRONT_VISIBLE,
      raw: true,
    })) as unknown as { min: number | null; max: number | null } | null;
    return {
      brands: brands.map((row) => row.brandName),
      // Largest models first: 1/60, 1/72, 1/100, 1/144.
      scales: scales
        .map((row) => row.scale as string)
        .sort((a, b) => (Number(a.split('/')[1]) || Infinity) - (Number(b.split('/')[1]) || Infinity) || a.localeCompare(b)),
      priceRange: { min: Number(prices?.min || 0), max: Number(prices?.max || 0) },
    };
  }

  // A storefront product by its id, public UUID or SEO slug. A condition option's key opens its main listing with that
  // option selected; `conditionOptions` lists every unit the customer can choose (the main listing first).
  async getPublicById(key: number | string) {
    const where =
      typeof key === 'number' ? { id: key } : UUID_PATTERN.test(key) ? { uuid: key.toLowerCase() } : { slug: key };
    const found = await ProductModel.findOne({ attributes: ['id', 'parentProductId'], where: { ...where, ...STOREFRONT_VISIBLE } });
    const listingId = found?.parentProductId ?? found?.id;
    const product = listingId
      ? await ProductModel.findOne({
          attributes: { exclude: PRIVATE_ATTRIBUTES },
          where: { id: listingId, ...STOREFRONT_VISIBLE },
          include: [categoryInclude, imagesInclude],
        })
      : null;
    if (!found || !product) throw HttpError.notFound('Không tìm thấy sản phẩm.');
    const id = product.id;
    const options = await ProductModel.findAll({
      attributes: { exclude: PRIVATE_ATTRIBUTES },
      where: { parentProductId: id, ...STOREFRONT_VISIBLE },
      include: [imagesInclude],
    });
    const discounts = await this.discountService.getActive([id, ...options.map((option) => option.id)]);
    const unit = (row: ProductModel, isMain: boolean) => ({
      id: row.id,
      uuid: row.uuid,
      slug: row.slug,
      sku: row.sku,
      isMain,
      condition: row.condition,
      conditionNote: row.conditionNote ?? null,
      missingAccessories: row.missingAccessories,
      defects: row.defects,
      includedAccessories: row.includedAccessories,
      boxCondition: row.boxCondition ?? null,
      assemblyState: row.assemblyState,
      imageUrl: row.imageUrl,
      images: galleryUrls(row),
      stock: row.stock,
      price: row.price,
      listPriceVerified: row.listPriceVerified,
      ...toPricing(row.price, discounts.get(row.id)),
    });
    const conditionRank = rankOf(await this.conditions.all());
    const optionUnits = options
      .map((option) => unit(option, false))
      .sort((a, b) => conditionRank(a.condition) - conditionRank(b.condition) || a.salePrice - b.salePrice || a.id - b.id);
    return {
      ...product.get({ plain: true }),
      imageAttributions: mediaManifest.filter(entry => [product.imageUrl, ...galleryUrls(product)].includes(entry.path)).map(entry => ({
        imageUrl: entry.path, creator: entry.creator, source: entry.source, license: entry.license, licenseUrl: entry.licenseUrl,
      })),
      ...toPricing(product.price, discounts.get(id)),
      images: galleryUrls(product),
      ratingDistribution: await this.reviewService.getDistribution(id),
      conditionOptions: [unit(product, true), ...optionUnits],
      selectedOptionId: found.id,
    };
  }

  // A bounded public candidate pool, reranked with current condition prices/stock. No admin fields or user data.
  async getRecommendations(key: number | string) {
    const source = await this.getPublicById(key) as unknown as ProductDetail;
    const availableIds = await this.matchingListingIds({ ...STOREFRONT_VISIBLE, stock: { [Op.gt]: 0 } });
    if (!availableIds.length) return [];
    const sequelize = ProductModel.sequelize!;
    const affinity = [
      source.categoryId ? `CASE WHEN "ProductModel"."categoryId" = ${sequelize.escape(source.categoryId)} THEN 40 ELSE 0 END` : '0',
      source.brandName ? `CASE WHEN "ProductModel"."brandName" = ${sequelize.escape(source.brandName)} THEN 25 ELSE 0 END` : '0',
      source.scale ? `CASE WHEN "ProductModel"."scale" = ${sequelize.escape(source.scale)} THEN 18 ELSE 0 END` : '0',
    ].join(' + ');
    const rows = await ProductModel.findAll({
      attributes: LIST_ATTRIBUTES,
      where: { ...STOREFRONT_VISIBLE, parentProductId: null, [Op.and]: [{ id: availableIds }, { id: { [Op.ne]: source.id } }] },
      include: [categoryInclude],
      order: [[literal(`(${affinity})`), 'DESC'], ['sold', 'DESC'], ['id', 'ASC']],
      limit: 72,
    });
    const candidates = await this.withConditions(await this.discountService.withPricing(rows));
    const active = source.conditionOptions?.filter((unit) => unit.stock > 0) ?? [];
    return rankRelatedProducts({ ...source, salePrice: active.length ? Math.min(...active.map((unit) => unit.salePrice)) : source.salePrice }, candidates as unknown as ProductSummary[]);
  }

  async getReviews(productId: number, limit: number, offset: number) {
    const exists = await ProductModel.count({ where: { id: productId, ...STOREFRONT_VISIBLE } });
    if (!exists) throw HttpError.notFound('Không tìm thấy sản phẩm.');
    return this.reviewService.listByProduct(productId, limit, offset);
  }

  // Admin listing: one row per model (its main listing, filtered by its own status), found through any of its units,
  // with every condition it is stocked in.
  async listAdmin(query: ProductListQuery & { sortKey?: string; sortDirection?: string }) {
    const status: WhereOptions[] = [];
    if (query.status === 'active') status.push({ isArchived: false });
    if (query.status === 'archived') status.push({ isArchived: true });
    if (query.status === 'featured') status.push({ isFeatured: true });
    // Held back by a shop agent inventory adjustment (quarantine, donation, recycling).
    if (query.status === 'held') status.push({ inventoryStatus: { [Op.ne]: 'available' } });
    const ids = await this.matchingListingIds(this.buildWhere(query));
    const column = query.sortKey && ADMIN_SORTABLE_COLUMNS.includes(query.sortKey) ? query.sortKey : 'id';
    const { rows, count } = await ProductModel.findAndCountAll({
      attributes: [...LIST_ATTRIBUTES, 'sku', 'importPrice', 'pricingReferenceMemberVnd', 'isArchived', 'inventoryStatus', 'createdAt', 'updatedAt', 'productionDate'],
      where: { [Op.and]: [...status, { id: ids, parentProductId: null }] },
      include: [categoryInclude],
      order: [[column, query.sortDirection === 'desc' ? 'DESC' : 'ASC']],
      limit: query.limit,
      offset: query.offset,
      distinct: true,
    });
    return { rows: await this.withConditions(await this.discountService.withPricing(rows), { isArchived: false }), count };
  }

  async getAdminById(id: number) {
    const product = await ProductModel.findByPk(id, {
      include: [
        categoryInclude,
        imagesInclude,
        { model: SupplierModel, as: 'supplier', attributes: ['id', 'name', 'contactPhone'] },
        // Catalog provenance (image status, verification, price basis) for staff; null for other products.
        { model: ProductSourceModel, as: 'source', attributes: { exclude: ['id', 'productId', 'createdAt', 'updatedAt'] } },
      ],
    });
    if (!product) throw HttpError.notFound('Không tìm thấy sản phẩm.');
    // The model's units: the main listing and its condition options (archived ones too), whichever one is open.
    const listingId = product.parentProductId ?? product.id;
    const units = await ProductModel.findAll({
      attributes: ['id', 'sku', 'name', 'condition', 'conditionNote', 'missingAccessories', 'defects', 'price', 'pricingReferenceMemberVnd', 'importPrice', 'stock', 'sold', 'imageUrl', 'isArchived', 'inventoryStatus', 'parentProductId'],
      where: { [Op.or]: [{ id: listingId }, { parentProductId: listingId }] },
    });
    const conditionRank = rankOf(await this.conditions.all());
    const ordered = units.sort(
      (a, b) =>
        Number(a.parentProductId !== null) - Number(b.parentProductId !== null) ||
        conditionRank(a.condition) - conditionRank(b.condition) ||
        a.id - b.id,
    );
    const priced = await this.discountService.withPricing(ordered);
    const listing = units.find((unit) => unit.id === listingId);
    return {
      ...product.get({ plain: true }),
      images: galleryUrls(product),
      listing: listing ? { id: listing.id, name: listing.name, sku: listing.sku } : null,
      units: priced.map((unit) => ({ ...unit, isMain: unit.parentProductId === null })),
    };
  }

  // Validates the admin form payload; returns the product columns and the gallery image URLs. The shop's own catalog is
  // priced by formula from a reference member price; a partner seller's listing (`sellerPrice`) keeps the seller's price.
  async validateCatalogInput(data: Record<string, unknown>, currentId?: number, options: { sellerPrice?: boolean } = {}) {
    const errors: string[] = [];
    const name = asTrimmedString(data.name);
    const brandName = asTrimmedString(data.brandName);
    const sku = asTrimmedString(data.sku);
    const imageUrl = asTrimmedString(data.imageUrl);
    const current = currentId ? await ProductModel.findByPk(currentId) : null;
    // The shop's own catalogue (owner rule of 2026-10-26): staff enter only the real selling price S, which counts as
    // approved by the admin who saves it; the web list price R = ROUND(S / 0.9) is the product's price (MEMBER10 takes
    // it back to S) and the buyback price B follows S by the three rates (sale-pricing.ts). Neither is ever typed. A
    // partner seller's listing (`sellerPrice`) keeps its own price.
    let formula: ReturnType<typeof catalogPricing> | undefined;
    const target = options.sellerPrice
      ? undefined
      : (toInteger(data.pricingReferenceMemberVnd) ?? current?.pricingReferenceMemberVnd ?? undefined);
    // A product saved before S existed keeps its price until staff set one.
    const keepsLegacyPrice = !options.sellerPrice && !target && !!current && (data.price == null || toInteger(data.price) === current.price);
    if (!options.sellerPrice && !keepsLegacyPrice) {
      if (!target) throw HttpError.badRequest('Cần giá bán thực S của sản phẩm.');
      try { formula = catalogPricing(target); }
      catch (error) { throw HttpError.badRequest((error as Error).message); }
      if (data.buybackPriceVnd != null && toInteger(data.buybackPriceVnd) !== formula.buybackPriceVnd)
        throw HttpError.badRequest('Giá thu B được tính tự động từ S. Không nhập đè giá thu.');
    }
    const price = options.sellerPrice ? toInteger(data.price) : keepsLegacyPrice ? current?.price : formula?.listPriceVnd;
    // The web price is never typed for the shop's own catalogue: an empty value (null) means "not sent".
    if (!options.sellerPrice && data.price != null && toInteger(data.price) !== price)
      throw HttpError.badRequest('Giá web R = S ÷ 0,9 được tính tự động. Không nhập đè giá bán.');
    // A new or changed S is approved by the admin saving it.
    const targetChanged =
      !!formula && (formula.referenceMemberVnd !== current?.pricingReferenceMemberVnd || !current?.targetPriceApprovedAt);
    // S 2hand (owner request of 2026-10-26): optional, below S, approved with it; an empty value clears it.
    let preowned: number | null | undefined;
    if (!options.sellerPrice && data.pricingReferencePreownedVnd !== undefined) {
      preowned = data.pricingReferencePreownedVnd === null || data.pricingReferencePreownedVnd === '' ? null : toInteger(data.pricingReferencePreownedVnd);
      if (preowned !== null && (!preowned || preowned < 1 || (target && preowned >= target)))
        throw HttpError.badRequest('Giá bán thực S 2hand phải là số nguyên dương và thấp hơn S.');
    }
    const importPrice = toInteger(data.importPrice) ?? 0;
    const stock = toInteger(data.stock) ?? 0;
    const categoryId = toInteger(data.categoryId);
    const supplierId = toInteger(data.supplierId);
    const gunpla: Record<string, unknown> = {};
    for (const field of ['scale', 'modelCode', 'boxCondition', 'conditionNote', 'descriptionEn', 'descriptionVi'] as const) {
      if (data[field] !== undefined) gunpla[field] = asTrimmedString(data[field]) || null;
    }
    if (data.condition !== undefined) {
      if (!(await this.conditions.usable(data.condition, current?.condition)))
        errors.push('Tình trạng sản phẩm không hợp lệ hoặc đã ngừng dùng.');
      gunpla.condition = data.condition;
    }
    if (data.assemblyState !== undefined) {
      if (!ASSEMBLY_STATES.includes(data.assemblyState as typeof ASSEMBLY_STATES[number])) errors.push('Invalid assembly state.');
      gunpla.assemblyState = data.assemblyState;
    }
    for (const field of ['includedAccessories', 'missingAccessories', 'defects'] as const) {
      if (data[field] !== undefined) {
        const list = textList(data[field]);
        if (!list) errors.push(`Invalid ${field}.`);
        else gunpla[field] = list;
      }
    }
    // What makes a unit incomplete or defective is shown to the customer: it must be written down.
    // The rules come from the condition (Admin > Products > Conditions), not its name.
    const conditionType = await this.conditions.get(gunpla.condition ?? current?.condition ?? 'new');
    if (conditionType?.requiresMissingAccessories && !((gunpla.missingAccessories ?? current?.missingAccessories) as string[] | undefined)?.length)
      errors.push(`Liệt kê phụ kiện còn thiếu của sản phẩm "${conditionType.nameVi}".`);
    if (conditionType?.requiresDefects && !((gunpla.defects ?? current?.defects) as string[] | undefined)?.length)
      errors.push(`Mô tả lỗi của sản phẩm "${conditionType.nameVi}".`);
    const images = Array.isArray(data.images) ? data.images.map((url) => asTrimmedString(url)).filter(Boolean) : [];
    // The received date ("Ngày nhập"): the day the product is added unless staff give another one.
    const productionDate = asTrimmedString(data.productionDate)
      ? new Date(asTrimmedString(data.productionDate))
      : (current?.productionDate ?? new Date());
    // Optional: when omitted, an update keeps the current status (a hold is only lifted on purpose).
    const inventoryStatus = data.inventoryStatus === undefined ? undefined : (data.inventoryStatus as InventoryStatus);

    if (!name) errors.push('Tên sản phẩm không được để trống.');
    if (!brandName) errors.push('Thương hiệu không được để trống.');
    if (!sku) errors.push('SKU không được để trống.');
    if (price === undefined || price <= 0) errors.push('Giá bán phải là số nguyên lớn hơn 0.');
    if (importPrice < 0) errors.push('Giá nhập không được âm.');
    if (stock < 0) errors.push('Số lượng tồn kho không được âm.');
    if (!imageUrl || !isImageUrl(imageUrl)) errors.push('Vui lòng chọn ảnh chính cho sản phẩm.');
    if (images.length > MAX_GALLERY_IMAGES) errors.push(`Tối đa ${MAX_GALLERY_IMAGES} ảnh phụ.`);
    if (images.some((url) => !isImageUrl(url))) errors.push('Đường dẫn ảnh phụ không hợp lệ.');
    if (data.condition !== undefined && conditionType?.uniqueUnit && uniquePhotosMissing(stock, imageUrl, images)) {
      errors.push('Each one-of-a-kind collectible requires unique inventory and at least three uploaded actual-item photos.');
    }
    if (isNaN(productionDate.getTime())) errors.push('Ngày nhập không hợp lệ.');
    if (inventoryStatus !== undefined && !INVENTORY_STATUSES.includes(inventoryStatus)) {
      errors.push('Trạng thái kho không hợp lệ.');
    }
    // Optional: categories are not shown to customers.
    if (categoryId && !(await CategoryModel.findByPk(categoryId))) errors.push('Vui lòng chọn danh mục hợp lệ.');
    if (supplierId && !(await SupplierModel.findByPk(supplierId))) errors.push('Nhà cung cấp không hợp lệ.');
    // The packing size for the package optimizer (absent: unchanged; null: use the shop's fallback box).
    const packaging = data.packaging === undefined ? undefined : parseProductPackaging(data.packaging);
    if (packaging?.error) errors.push(packaging.error);
    if (errors.length > 0) throw HttpError.badRequest('Thông tin sản phẩm chưa hợp lệ.', errors);

    const duplicate = await ProductModel.findOne({ where: { sku } });
    if (duplicate && duplicate.id !== currentId) throw HttpError.conflict('SKU đã tồn tại.');

    return {
      values: {
        ...gunpla,
        name,
        brandName,
        sku,
        description: asTrimmedString(data.description) || null,
        price: price as number,
        importPrice,
        ...(formula
          ? {
              pricingReferenceMemberVnd: formula.referenceMemberVnd,
              pricingIssueCount: 0,
              buybackPriceVnd: formula.buybackPriceVnd,
              listPriceVerified: true,
              ...(preowned !== undefined ? { pricingReferencePreownedVnd: preowned } : {}),
              ...(targetChanged ? { targetPriceApprovedAt: new Date(), targetPriceApprovedByUserId: null } : {}),
            }
          : {}),
        stock,
        imageUrl,
        categoryId: categoryId || null,
        supplierId: supplierId || null,
        weight: asTrimmedString(data.weight) || null,
        dimensions: asTrimmedString(data.dimensions) || null,
        ...(packaging ? { packaging: packaging.value } : {}),
        productionDate,
        isFeatured: data.isFeatured === true,
        isArchived: data.isArchived === true,
        ...(inventoryStatus !== undefined ? { inventoryStatus } : {}),
      },
      images,
    };
  }

  private async replaceImages(productId: number, images: string[], transaction: Transaction) {
    await ProductImageModel.destroy({ where: { productId }, transaction });
    await ProductImageModel.bulkCreate(
      images.map((url, sortOrder) => ({ productId, url, sortOrder })),
      { transaction },
    );
  }

  private auditCreate(product: ProductModel, actorUserId: number | undefined, transaction: Transaction) {
    return PromotionAuditModel.create({ actorUserId: actorUserId ?? null, entityType: 'product_pricing', entityId: product.id, action: 'create', newValue: { referenceMemberVnd: product.pricingReferenceMemberVnd, buybackPriceVnd: product.buybackPriceVnd, listPriceVnd: product.price, actualCostVnd: product.importPrice, issues: product.pricingIssueCount } }, { transaction });
  }

  async create(data: Record<string, unknown>, actorUserId?: number) {
    const { values, images } = await this.validateCatalogInput(data);
    try {
      const product = await DatabaseProvider.getInstance().transaction(async (transaction) => {
        const created = await ProductModel.create(values, { transaction });
        await this.auditCreate(created, actorUserId, transaction);
        await this.replaceImages(created.id, images, transaction);
        return created;
      });
      return this.getAdminById(product.id);
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw HttpError.conflict('SKU đã tồn tại.');
      throw error;
    }
  }

  // A free SKU for a new condition option: the listing's SKU, the condition's suffix and a number.
  private async optionSku(listing: ProductModel, condition: string) {
    const suffix = (await this.conditions.get(condition))?.skuSuffix ?? condition.toUpperCase().slice(0, 4);
    for (let number = 1; ; number++) {
      const sku = `${listing.sku}-${suffix}${number}`;
      if (!(await ProductModel.count({ where: { sku } }))) return sku;
    }
  }

  // Adds the model of a shop listing in another condition (a pre-owned, incomplete or defective unit, or a second new
  // batch): its own SKU, price, cost, stock and photos; the model itself (name, brand, code, scale, descriptions, box,
  // category, supplier) comes from the listing. Without photos of its own it shows the listing's.
  async createConditionOption(listingId: number, data: Record<string, unknown>, actorUserId?: number) {
    const listing = await ProductModel.findByPk(listingId, { include: [imagesInclude] });
    if (!listing) throw HttpError.notFound('Model not found.');
    if (listing.partnerId) throw HttpError.conflict('Review partner merchandise through its seller listing workflow.', 'PARTNER_LISTING_REQUIRED');
    if (listing.parentProductId) throw HttpError.badRequest('Thêm tình trạng vào sản phẩm chính, không vào một tình trạng khác.');
    const condition = typeof data.condition === 'string' && data.condition ? data.condition : 'new';
    const ownImage = asTrimmedString(data.imageUrl);
    const { values, images } = await this.validateCatalogInput({
      ...data,
      ...identityOf(listing),
      condition,
      sku: asTrimmedString(data.sku) || (await this.optionSku(listing, condition)),
      imageUrl: ownImage || listing.imageUrl,
      images: ownImage ? data.images : galleryUrls(listing),
      isFeatured: false,
    });
    try {
      const option = await DatabaseProvider.getInstance().transaction(async (transaction) => {
        const created = await ProductModel.create(
          { ...values, ...identityOf(listing), salesChannel: listing.salesChannel, parentProductId: listing.id },
          { transaction },
        );
        await this.auditCreate(created, actorUserId, transaction);
        await this.replaceImages(created.id, images, transaction);
        return created;
      });
      return this.getAdminById(option.id);
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw HttpError.conflict('SKU đã tồn tại.');
      throw error;
    }
  }

  async update(id: number, data: Record<string, unknown>, actorUserId?: number) {
    const target = await ProductModel.findByPk(id);
    if (!target) throw HttpError.notFound('Model not found.');
    // A condition option keeps its listing's model; edits to the model are made on the listing.
    const listing = target.parentProductId ? await ProductModel.findByPk(target.parentProductId) : null;
    const input = listing ? { ...data, ...identityOf(listing) } : data;
    const { values, images } = await this.validateCatalogInput(input, id);
    try {
      await DatabaseProvider.getInstance().transaction(async (transaction) => {
        const product = await ProductModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!product) throw HttpError.notFound('Model not found.');
        if (product.partnerId) throw HttpError.conflict('Review partner merchandise through its seller listing workflow.', 'PARTNER_LISTING_REQUIRED');
        // Omitting condition must not bypass the existing unique-item identity or photo requirements.
        const was = await this.conditions.get(product.condition, transaction);
        const next = await this.conditions.get(data.condition || product.condition, transaction);
        if (was?.uniqueUnit && (data.condition !== undefined && data.condition !== product.condition || values.stock > product.stock))
          throw HttpError.conflict('Retain this unique collectible identity; use its inspected intake or verified return workflow for stock.', 'UNIQUE_ITEM_INTAKE_REQUIRED');
        if (next?.uniqueUnit && uniquePhotosMissing(values.stock, values.imageUrl, images))
          throw HttpError.badRequest('Each one-of-a-kind collectible requires unique inventory and at least three distinct uploaded actual-item photos.');
        if (values.stock !== product.stock && data.expectedStock !== product.stock) throw HttpError.conflict('Available stock changed. Reload before recording an inventory correction.','STOCK_CHANGED');
        const oldPricing = { listPriceVnd: product.price, actualCostVnd: product.importPrice, referenceMemberVnd: product.pricingReferenceMemberVnd, buybackPriceVnd: product.buybackPriceVnd, issues: product.pricingIssueCount };
        if (values.price !== product.price && data.expectedPrice !== product.price)
          throw HttpError.conflict('Giá vừa thay đổi. Vui lòng tải lại trước khi lưu mức giá mới.');
        await product.update(values, { transaction });
        if (oldPricing.listPriceVnd !== product.price || oldPricing.actualCostVnd !== product.importPrice || oldPricing.referenceMemberVnd !== product.pricingReferenceMemberVnd || oldPricing.issues !== product.pricingIssueCount)
          await PromotionAuditModel.create({ actorUserId: actorUserId ?? null, entityType: 'product_pricing', entityId: id, action: 'update', oldValue: oldPricing, newValue: { referenceMemberVnd: product.pricingReferenceMemberVnd, buybackPriceVnd: product.buybackPriceVnd, listPriceVnd: product.price, actualCostVnd: product.importPrice, issues: product.pricingIssueCount } }, { transaction });
        await this.replaceImages(id, images, transaction);
        if (!product.parentProductId) {
          // The listing's options follow its model; a discontinued model takes its options off sale too.
          await ProductModel.update(
            { ...identityOf(product), ...(product.isArchived ? { isArchived: true, isFeatured: false } : {}) },
            { where: { parentProductId: id }, transaction },
          );
        }
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw HttpError.conflict('SKU đã tồn tại.');
      throw error;
    }
    // Retain old media: order snapshots and condition evidence may still reference it.
    return this.getAdminById(id);
  }

  // Products that appear in orders or stock imports are archived instead of deleted (history keeps pointing at them).
  // A listing with condition options on sale is neither: its options are archived or deleted first.
  async remove(id: number): Promise<{ archived: boolean }> {
    let files: string[] = [];
    const archived = await DatabaseProvider.getInstance().transaction(async transaction => {
      const product = await ProductModel.findByPk(id, { transaction, lock:transaction.LOCK.UPDATE });
      if (!product) throw HttpError.notFound('Model not found.');
      if (product.partnerId) throw HttpError.conflict('Retain partner listing history and hide the listing through moderation.', 'PARTNER_LISTING_REQUIRED');
      const options = await ProductModel.count({ where: { parentProductId: id }, transaction });
      if (await ProductModel.count({ where: { parentProductId: id, isArchived: false }, transaction }))
        throw HttpError.conflict('Lưu trữ hoặc xóa các tình trạng khác của sản phẩm này trước.', 'CONDITION_OPTIONS_EXIST');
      if (options > 0 || (await productHasHistory(id, transaction))) { await product.update({isArchived:true,isFeatured:false},{transaction}); return true; }
      const gallery = await ProductImageModel.findAll({where:{productId:id},transaction});
      const listing = product.parentProductId ? await ProductModel.findByPk(product.parentProductId, { include: [imagesInclude], transaction }) : null;
      // An option showing its listing's photos must not delete them.
      const shared = new Set(listing ? [listing.imageUrl, ...galleryUrls(listing)] : []);
      files = [product.imageUrl,...gallery.map(image => image.url)].filter((url) => !shared.has(url));
      await product.destroy({transaction});
      return false;
    });
    if (!archived) await this.fileStorageService.removeFiles(files);
    return {archived};
  }

  // Inventory figures of the shop's own catalogue (partner merchandise and archived products excluded), as in the
  // owner's sheet "Thống kê kho": units on hand, products declared, what the stock cost and what it would sell for.
  // Values are list price R × stock and S (the member price, "Giá bán ra") × stock; neither is revenue.
  async inventoryStats() {
    const query = <T extends Row>(sql: string) => DatabaseProvider.getInstance().query<T>(sql, { type: QueryTypes.SELECT });
    const scope = `FROM product p WHERE p."partnerId" IS NULL AND NOT p."isArchived"`;
    const rank = rankOf(await this.conditions.all());
    const [totals] = await query(`
      SELECT COUNT(*) FILTER (WHERE p."parentProductId" IS NULL) AS listings,
             COUNT(*) FILTER (WHERE p."parentProductId" IS NOT NULL) AS options,
             COUNT(DISTINCT lower(p.name)) AS names,
             COUNT(*) FILTER (WHERE p.stock > 0) AS "unitsInStock",
             COUNT(*) FILTER (WHERE p.stock = 0) AS "unitsOutOfStock",
             COALESCE(SUM(p.stock), 0) AS stock,
             COUNT(DISTINCT p."brandName") AS brands,
             COALESCE(SUM(p."importPrice"::bigint * p.stock), 0) AS "costValue",
             COALESCE(SUM(p.price::bigint * p.stock), 0) AS "listValue",
             COALESCE(SUM(COALESCE(p."pricingReferenceMemberVnd", p.price)::bigint * p.stock), 0) AS "memberValue",
             COUNT(*) FILTER (WHERE p.stock > 0 AND p."importPrice" = 0) AS "missingCost",
             COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM NOW() - COALESCE(p."productionDate", p."createdAt")) / 86400)
               FILTER (WHERE p.stock > 0)), 0) AS "averageDaysInStock"
      ${scope}`);
    const brands = await query(`
      SELECT p."brandName" AS brand,
             COUNT(*) FILTER (WHERE p."parentProductId" IS NULL) AS listings,
             COUNT(*) FILTER (WHERE p.stock > 0) AS "unitsInStock",
             COALESCE(SUM(p.stock), 0) AS stock,
             COALESCE(SUM(p."importPrice"::bigint * p.stock), 0) AS "costValue",
             COALESCE(SUM(COALESCE(p."pricingReferenceMemberVnd", p.price)::bigint * p.stock), 0) AS "memberValue"
      ${scope} GROUP BY 1 ORDER BY 1`);
    const conditions = await query(`
      SELECT p.condition, COUNT(*) AS units, COUNT(*) FILTER (WHERE p.stock > 0) AS "unitsInStock",
             COALESCE(SUM(p.stock), 0) AS stock
      ${scope} GROUP BY 1`);
    const numbers = (row: Row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value]));
    const memberValue = Number(totals.memberValue);
    const costValue = Number(totals.costValue);
    return {
      totals: { ...numbers(totals), marginValue: memberValue - costValue },
      brands: brands.map(numbers),
      conditions: conditions
        .map(numbers)
        .sort((a, b) => rank(a.condition as string) - rank(b.condition as string)),
    };
  }
}
