import { effectiveItemType } from '../../../shared/condition-tree';
import { orderConditionOptions } from '../../../shared/product-condition-option';
import CatalogIntakeModel from '../database/client/models/CatalogIntake.Model';
import CatalogTreeService, { familyIdentity, lockCatalog } from './catalog/CatalogTreeService';
import { ancestors, conditionPath } from '../../../shared/condition-tree';
import ModelFamilyModel from '../database/client/models/ModelFamily.Model';
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
import ProductSearchService from './catalog/ProductSearchService';
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
  itemTypeKey?: string | string[];
  conditionNodeIds?: number[];
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
  groupByModel?: boolean;
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
  'modelFamilyId', 'itemTypeKey', 'conditionNodeIds', 'catalogReviewRequired',
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
    const rawSearch = asTrimmedString(query.q);
    if (rawSearch) {
      conditions.push(ProductSearchService.buildSearchConditions(rawSearch));
    }
    const brands = parseFilterChoices(query.brand);
    if (brands.length) conditions.push({ brandName: { [Op.in]: brands } });
    for (const field of ['scale', 'condition'] as const) {
      const values = parseFilterChoices(query[field]);
      if (values.length) conditions.push({ [field]: { [Op.in]: values } });
    }
    const itemTypes = parseFilterChoices(query.itemTypeKey);
    if (itemTypes.some(type => !['new', 'preowned'].includes(type))) throw HttpError.badRequest('Loại hàng không hợp lệ.');
    if (itemTypes.length) conditions.push({ [Op.or]: [
      { modelFamilyId: { [Op.ne]: null }, itemTypeKey: { [Op.in]: itemTypes } },
      { modelFamilyId: null, condition: itemTypes.includes('new') && itemTypes.includes('preowned') ? { [Op.ne]: null } : itemTypes.includes('new') ? 'new' : { [Op.ne]: 'new' } },
    ] });
    if (query.conditionNodeIds?.length) conditions.push({ [Op.or]: query.conditionNodeIds.map(id => ({ conditionNodeIds: { [Op.contains]: [id] } })) });
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
    return units.map(unit => unit.id);
  }

  // Each listing with the conditions it is offered in: units, stock and the lowest price the customer pays.
  private async withConditions<T extends { id: number }>(listings: T[], _where: WhereOptions = STOREFRONT_VISIBLE) {
    if (!listings.length) return [];
    const nodes = await new CatalogTreeService().nodes();
    return listings.map(listing => {
      const row = listing as T & Record<string, any>;
      const ids: number[] = row.conditionNodeIds ?? [];
      return { ...listing, itemTypeKey: effectiveItemType({ modelFamilyId: row.modelFamilyId, itemTypeKey: row.itemTypeKey, condition: row.condition }), conditionLabels: ids.map(id => conditionPath(id, nodes)),
        conditions: [{ condition: row.modelFamilyId ? row.itemTypeKey : row.condition, units: 1, stock: row.stock, minSalePrice: row.salePrice }], groupStock: row.stock };
    });
  }

  // Storefront listing: one card per SKU; archived or held-back units are never returned.
  // Prices include running discounts.
  async listPublic(query: ProductListQuery) {
    if (query.conditionNodeIds?.length) {
      const nodes = await new CatalogTreeService().nodes();
      if (query.conditionNodeIds.some(id => !Number.isSafeInteger(id) || !nodes.some(node => node.id === id))) throw HttpError.badRequest('Bộ lọc tình trạng không hợp lệ.');
      query = { ...query, conditionNodeIds: nodes.filter(node => query.conditionNodeIds!.some(id => node.id === id || ancestors(node.id, nodes).includes(id))).map(node => node.id) };
    }
    const ids = await this.matchingListingIds({ [Op.and]: [this.buildWhere(query), STOREFRONT_VISIBLE] }, query.category);

    const rawSearch = asTrimmedString(query.q);
    if (rawSearch && !query.sort) {
      const allMatching = await ProductModel.findAll({
        attributes: LIST_ATTRIBUTES,
        where: { ...STOREFRONT_VISIBLE, id: ids },
        include: [categoryInclude],
      });
      const ranked = ProductSearchService.rankCandidates(allMatching, rawSearch);
      const count = ranked.length;
      const paged = ranked.slice(query.offset, query.offset + query.limit);
      return { rows: await this.withConditions(await this.discountService.withPricing(paged)), count };
    }

    const { rows, count } = await ProductModel.findAndCountAll({
      attributes: LIST_ATTRIBUTES,
      where: { ...STOREFRONT_VISIBLE, id: ids },
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
  // option selected; every sibling URL returns the same fixed SKU order.
  async getPublicById(key: number | string) {
    const where =
      typeof key === 'number' ? { id: key } : UUID_PATTERN.test(key) ? { uuid: key.toLowerCase() } : { slug: key };
    const found = await ProductModel.findOne({ attributes: ['id', 'parentProductId', 'modelFamilyId', 'catalogCanonicalId'], where });
    const listingId = found?.catalogCanonicalId ?? found?.id;
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
      where: { ...STOREFRONT_VISIBLE, ...(product.modelFamilyId ? { modelFamilyId: product.modelFamilyId, partnerId: product.partnerId, id: { [Op.ne]: id } } : { parentProductId: id }) },
      include: [imagesInclude],
    });
    const discounts = await this.discountService.getActive([id, ...options.map((option) => option.id)]);
    const treeNodes = await new CatalogTreeService().nodes();
    const unit = (row: ProductModel, isMain: boolean) => ({
      id: row.id,
      uuid: row.uuid,
      slug: row.slug,
      sku: row.sku,
      isMain,
      condition: row.modelFamilyId ? row.itemTypeKey : row.condition,
      itemTypeKey: effectiveItemType(row), conditionNodeIds: row.conditionNodeIds,
      conditionLabels: (row.conditionNodeIds ?? []).map(id => conditionPath(id, treeNodes)),
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
    const optionUnits = options.map((option) => unit(option, false));
    return {
      ...product.get({ plain: true }),
      conditionLabels: (product.conditionNodeIds ?? []).map(id => conditionPath(id, treeNodes)),
      imageAttributions: mediaManifest.filter(entry => [product.imageUrl, ...galleryUrls(product)].includes(entry.path)).map(entry => ({
        imageUrl: entry.path, creator: entry.creator, source: entry.source, license: entry.license, licenseUrl: entry.licenseUrl,
      })),
      ...toPricing(product.price, discounts.get(id)),
      images: galleryUrls(product),
      ratingDistribution: await this.reviewService.getDistribution(id),
      conditionOptions: orderConditionOptions([unit(product, true), ...optionUnits]),
      selectedOptionId: product.id,
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
      where: { ...STOREFRONT_VISIBLE, [Op.and]: [{ id: availableIds }, { id: { [Op.ne]: source.id } }] },
      include: [categoryInclude],
      order: [[literal(`(${affinity})`), 'DESC'], ['sold', 'DESC'], ['id', 'ASC']],
      limit: 72,
    });
    const candidates = await this.withConditions(await this.discountService.withPricing(rows));
    const preferred = new Map<string, typeof candidates[number]>();
    for (const candidate of candidates) {
      if (source.modelFamilyId && candidate.modelFamilyId === source.modelFamilyId) continue;
      const key = candidate.modelFamilyId ? `family:${candidate.modelFamilyId}` : `sku:${candidate.id}`;
      const previous = preferred.get(key);
      const distance = (item: typeof candidate) => (item.itemTypeKey === source.itemTypeKey ? 0 : 1000000000) + Math.abs(item.salePrice - source.salePrice);
      if (!previous || distance(candidate) < distance(previous)) preferred.set(key, candidate);
    }
    return rankRelatedProducts(source, [...preferred.values()] as unknown as ProductSummary[]);
  }

  // Public sellable main listings with active discounts and condition summaries for multi-strategy smart recommendations.
  async getSellableCandidatePool(limit = 160): Promise<ProductSummary[]> {
    const availableIds = await this.matchingListingIds({ ...STOREFRONT_VISIBLE, stock: { [Op.gt]: 0 } });
    if (!availableIds.length) return [];
    const rows = await ProductModel.findAll({
      attributes: LIST_ATTRIBUTES,
      where: { ...STOREFRONT_VISIBLE, parentProductId: null, id: availableIds },
      include: [categoryInclude],
      order: [
        ['isFeatured', 'DESC'],
        ['sold', 'DESC'],
        ['rating', 'DESC'],
        ['id', 'ASC'],
      ],
      limit: Math.max(12, Math.min(240, limit)),
    });
    const enriched = await this.withConditions(await this.discountService.withPricing(rows));
    return enriched.map(row => {
      const product = {...row} as Record<string, unknown>;
      for (const key of ['importPrice', 'minPrice', 'pricingReferenceMemberVnd', 'parentProductId']) delete product[key];
      return product;
    }) as unknown as ProductSummary[];
  }

  async getReviews(productId: number, limit: number, offset: number) {
    const exists = await ProductModel.count({ where: { id: productId, ...STOREFRONT_VISIBLE } });
    if (!exists) throw HttpError.notFound('Không tìm thấy sản phẩm.');
    return this.reviewService.listByProduct(productId, limit, offset);
  }

  // Admin listing: one row per model (its main listing, filtered by its own status), found through any of its units,
  // with every condition it is stocked in.
  async listAdmin(query: ProductListQuery & { sortKey?: string; sortDirection?: string }) {
    const status: WhereOptions[] = [{ catalogCanonicalId: null }];
    if (query.status === 'active') status.push({ isArchived: false });
    if (query.status === 'archived') status.push({ isArchived: true });
    if (query.status === 'featured') status.push({ isFeatured: true });
    // Held back by a shop agent inventory adjustment (quarantine, donation, recycling).
    if (query.status === 'held') status.push({ inventoryStatus: { [Op.ne]: 'available' } });
    const ids = await this.matchingListingIds(this.buildWhere(query));
    if (query.groupByModel) {
      const all = await ProductModel.findAll({ attributes: [...LIST_ATTRIBUTES, 'sku', 'importPrice', 'pricingReferenceMemberVnd', 'isArchived', 'inventoryStatus', 'createdAt', 'updatedAt'], where: { [Op.and]: [...status, { id: ids }] }, order: [['id', 'DESC']] });
      const groups = new Map<string, ProductModel[]>();
      for (const product of all) { const key = product.modelFamilyId ? `family:${product.partnerId ?? 'shop'}:${product.modelFamilyId}` : `legacy:${product.id}`; groups.set(key, [...(groups.get(key) ?? []), product]); }
      const paged = [...groups.values()].slice(query.offset, query.offset + query.limit);
      const rows = [];
      for (const group of paged) {
        const units = await this.withConditions(await this.discountService.withPricing(group));
        rows.push({ ...units[0], familyUnits: units });
      }
      return { rows, count: groups.size };
    }
    const column = query.sortKey && ADMIN_SORTABLE_COLUMNS.includes(query.sortKey) ? query.sortKey : 'id';
    const { rows, count } = await ProductModel.findAndCountAll({
      attributes: [...LIST_ATTRIBUTES, 'sku', 'importPrice', 'pricingReferenceMemberVnd', 'isArchived', 'inventoryStatus', 'createdAt', 'updatedAt', 'productionDate'],
      where: { [Op.and]: [...status, { id: ids }] },
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
    const listingId = product.id;
    const units = await ProductModel.findAll({
      attributes: ['id', 'sku', 'name', 'condition', 'conditionNote', 'missingAccessories', 'defects', 'price', 'pricingReferenceMemberVnd', 'importPrice', 'stock', 'sold', 'imageUrl', 'isArchived', 'inventoryStatus', 'parentProductId', 'modelFamilyId', 'itemTypeKey', 'conditionNodeIds'],
      where: product.modelFamilyId ? { modelFamilyId: product.modelFamilyId, partnerId: product.partnerId } : { [Op.or]: [{ id: listingId }, { parentProductId: listingId }] },
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
      itemTypeKey: effectiveItemType(product),
      images: galleryUrls(product),
      identityLocked: !!product.combinationKey && (product.stock > 0 || await productHasHistory(product.id)),
      stockReceipts: await CatalogIntakeModel.findAll({ where: { productId: product.id }, order: [['id', 'DESC']], limit: 30 }),
      listing: listing ? { id: listing.id, name: listing.name, sku: listing.sku } : null,
      units: await this.withConditions(priced.map((unit) => ({ ...unit, isMain: unit.id === id }))),
    };
  }

  // Validates the admin form payload; returns the product columns and the gallery image URLs. The shop's own catalog is
  // priced by formula from a reference member price; a partner seller's listing (`sellerPrice`) keeps the seller's price.
  async validateCatalogInput(data: Record<string, unknown>, currentId?: number, options: { sellerPrice?: boolean } = {}) {
    const errors: string[] = [];
    if (!options.sellerPrice && data.partnerId != null) throw HttpError.badRequest('Quản lý hàng đối tác qua luồng đăng bán của đối tác.');
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
    if (data.pricingReferencePreownedVnd != null && !options.sellerPrice)
      throw HttpError.badRequest('Mỗi sản phẩm chỉ có một giá S. Tạo/chọn sản phẩm 2hand với tổ hợp tương ứng.');
    const importPrice = current?.importPrice ?? toInteger(data.importPrice) ?? 0;
    const stock = toInteger(data.stock) ?? current?.stock ?? 0;
    if (!options.sellerPrice && stock !== (current?.stock ?? 0)) throw HttpError.conflict('Tồn kho thay đổi qua phiếu nhập/điều chỉnh, không nhập trực tiếp trên sản phẩm.', 'STOCK_RECEIPT_REQUIRED');
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
    if (!options.sellerPrice && !data.isArchived && (data.itemTypeKey ?? data.condition ?? current?.itemTypeKey) === 'preowned' && uniquePhotosMissing(stock, imageUrl)) {
      errors.push('Hàng 2hand cần ít nhất một ảnh thật đã tải lên trước khi xuất bản.');
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
        serviceReferenceEnabled: data.serviceReferenceEnabled === undefined ? current?.serviceReferenceEnabled ?? true : data.serviceReferenceEnabled === true,
        isFeatured: data.isFeatured === true,
        isArchived: data.isArchived === true,
        listingStatus: data.isArchived === true ? (current?.listingStatus ?? 'draft') : 'published',
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
    const { values, images } = await this.validateCatalogInput({ ...data, isArchived: true, stock: 0 });
    try {
      const product = await DatabaseProvider.getInstance().transaction(async (transaction) => {
        const selection = await new CatalogTreeService().selection({ ...values, ...data }, null, transaction);
        const created = await ProductModel.create({ ...values, ...selection, stock: 0, isArchived: true, parentProductId: null }, { transaction });
        await new CatalogTreeService().remember(created.conditionNodeIds, 'product', created.id, transaction);
        await this.auditCreate(created, actorUserId, transaction);
        await this.replaceImages(created.id, images, transaction);
        return created;
      });
      return this.getAdminById(product.id);
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw HttpError.conflict('SKU hoặc tổ hợp tình trạng đã tồn tại.', 'COMBINATION_EXISTS');
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
    const condition = String(data.itemTypeKey ?? data.condition ?? 'new');
    const ownImage = asTrimmedString(data.imageUrl);
    const { values, images } = await this.validateCatalogInput({
      ...data,
      ...identityOf(listing),
      condition,
      sku: asTrimmedString(data.sku) || (await this.optionSku(listing, condition)),
      imageUrl: ownImage || listing.imageUrl,
      images: ownImage ? data.images : galleryUrls(listing),
      isFeatured: false, isArchived: true, stock: 0,
    });
    try {
      const option = await DatabaseProvider.getInstance().transaction(async (transaction) => {
        const sourceSelection = listing.modelFamilyId ? { modelFamilyId: listing.modelFamilyId } : await new CatalogTreeService().selection(listing.get({ plain: true }), listing, transaction);
        if (!listing.modelFamilyId) await listing.update(sourceSelection, { transaction });
        const selection = await new CatalogTreeService().selection({ ...values, ...data, ...sourceSelection, itemTypeKey: condition, conditionNodeIds: data.conditionNodeIds ?? [] }, null, transaction);
        const created = await ProductModel.create(
          { ...values, ...identityOf(listing), ...selection, salesChannel: listing.salesChannel, parentProductId: null, stock: 0, isArchived: true },
          { transaction },
        );
        await new CatalogTreeService().remember(created.conditionNodeIds, 'product', created.id, transaction);
        await this.auditCreate(created, actorUserId, transaction);
        await this.replaceImages(created.id, images, transaction);
        return created;
      });
      return this.getAdminById(option.id);
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw HttpError.conflict('SKU hoặc tổ hợp tình trạng đã tồn tại.', 'COMBINATION_EXISTS');
      throw error;
    }
  }

  async update(id: number, data: Record<string, unknown>, actorUserId?: number) {
    const target = await ProductModel.findByPk(id);
    if (!target) throw HttpError.notFound('Model not found.');
    // A condition option keeps its listing's model; edits to the model are made on the listing.
    const listing = null;
    const input = listing ? { ...data, ...identityOf(listing) } : data;
    const { values, images } = await this.validateCatalogInput(input, id);
    try {
      await DatabaseProvider.getInstance().transaction(async (transaction) => {
        await lockCatalog(transaction);
        const product = await ProductModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!product) throw HttpError.notFound('Model not found.');
        if (product.partnerId) throw HttpError.conflict('Review partner merchandise through its seller listing workflow.', 'PARTNER_LISTING_REQUIRED');
        if (product.publicationRequiresIntake && !values.isArchived) throw HttpError.conflict('Xuất bản từ hồ sơ thu/cầm sau khi nhập kho và kiểm hàng.', 'SOURCE_PUBLICATION_REQUIRED');
        const selection = await new CatalogTreeService().selection({ ...values, ...data }, product, transaction);
        const identityChanged = product.combinationKey && selection.combinationKey !== product.combinationKey;
        if (identityChanged && (product.stock > 0 || await productHasHistory(id, transaction)))
          throw HttpError.conflict('Sản phẩm đã có hàng/giao dịch. Tạo tổ hợp khác và dùng chuyển tình trạng để giữ lịch sử.', 'SKU_IDENTITY_LOCKED');
        if (!values.isArchived && selection.itemTypeKey === 'preowned' && uniquePhotosMissing(product.stock, values.imageUrl))
          throw HttpError.badRequest('Hàng 2hand cần ít nhất một ảnh thật đã tải lên trước khi xuất bản.');
        if (values.stock !== product.stock && data.expectedStock !== product.stock) throw HttpError.conflict('Available stock changed. Reload before recording an inventory correction.','STOCK_CHANGED');
        const oldPricing = { listPriceVnd: product.price, actualCostVnd: product.importPrice, referenceMemberVnd: product.pricingReferenceMemberVnd, buybackPriceVnd: product.buybackPriceVnd, issues: product.pricingIssueCount };
        if (values.price !== product.price && data.expectedPrice !== product.price)
          throw HttpError.conflict('Giá vừa thay đổi. Vui lòng tải lại trước khi lưu mức giá mới.');
        await product.update({ ...values, ...selection, stock: product.stock, importPrice: product.importPrice }, { transaction });
        await new CatalogTreeService().remember(product.conditionNodeIds, 'product', id, transaction);
        if (oldPricing.listPriceVnd !== product.price || oldPricing.actualCostVnd !== product.importPrice || oldPricing.referenceMemberVnd !== product.pricingReferenceMemberVnd || oldPricing.issues !== product.pricingIssueCount)
          await PromotionAuditModel.create({ actorUserId: actorUserId ?? null, entityType: 'product_pricing', entityId: id, action: 'update', oldValue: oldPricing, newValue: { referenceMemberVnd: product.pricingReferenceMemberVnd, buybackPriceVnd: product.buybackPriceVnd, listPriceVnd: product.price, actualCostVnd: product.importPrice, issues: product.pricingIssueCount } }, { transaction });
        await this.replaceImages(id, images, transaction);
        const identity = familyIdentity(product.get({ plain: true }));
        await ModelFamilyModel.update({ ...identity, identity }, { where: { id: selection.modelFamilyId }, transaction });
        await ProductModel.update(identity, { where: { modelFamilyId: selection.modelFamilyId, id: { [Op.ne]: id } }, transaction });
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw HttpError.conflict('SKU hoặc tổ hợp tình trạng đã tồn tại.', 'COMBINATION_EXISTS');
      throw error;
    }
    // Retain old media: order snapshots and condition evidence may still reference it.
    return this.getAdminById(id);
  }

  // Archive SKUs to retain their canonical identity, source records and historical URLs.
  async remove(id: number): Promise<{ archived: boolean }> {
    await DatabaseProvider.getInstance().transaction(async transaction => {
      const product = await ProductModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!product) throw HttpError.notFound('Model not found.');
      if (product.partnerId) throw HttpError.conflict('Hide partner listings through moderation.', 'PARTNER_LISTING_REQUIRED');
      await product.update({ isArchived: true, isFeatured: false }, { transaction });
    });
    return { archived: true };
  }

  // Inventory figures of the shop's own catalogue (partner merchandise and archived products excluded), as in the
  // owner's sheet "Thống kê kho": units on hand, products declared, what the stock cost and what it would sell for.
  // Values are list price R × stock and S (the member price, "Giá bán ra") × stock; neither is revenue.
  async inventoryStats() {
    const query = <T extends Row>(sql: string) => DatabaseProvider.getInstance().query<T>(sql, { type: QueryTypes.SELECT });
    const scope = `FROM product p WHERE p."partnerId" IS NULL AND p."catalogCanonicalId" IS NULL AND NOT p."isArchived"`;
    const rank = rankOf(await this.conditions.all());
    const [totals] = await query(`
      SELECT COUNT(DISTINCT COALESCE(p."modelFamilyId"::text, 'legacy-' || p.id::text)) AS listings,
             COUNT(*) - COUNT(DISTINCT COALESCE(p."modelFamilyId"::text, 'legacy-' || p.id::text)) AS options,
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
             COUNT(DISTINCT COALESCE(p."modelFamilyId"::text, 'legacy-' || p.id::text)) AS listings,
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
