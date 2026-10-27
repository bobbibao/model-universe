import { BeforeValidate, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Op, type Transaction } from 'sequelize';
import { slugify } from '../../../../../shared/slug';
import CategoryModel from './Category.Model';
import SupplierModel from './Supplier.Model';
import { seedProductData } from '../seeders/Product.Seeder';
import type { ModelCondition, AssemblyState } from '../../../../../shared/gunpla';
import type { ProductPackaging } from '../../../../../shared/packing/rules';

// Set by the shop agent's inventory adjustments. Anything but `available` is hidden from the storefront.
export type InventoryStatus = 'available' | 'quarantine' | 'donation_pending' | 'recycle';
export type SalesChannel = 'web' | 'outlet';

export const INVENTORY_STATUSES: InventoryStatus[] = ['available', 'quarantine', 'donation_pending', 'recycle'];
export const SALES_CHANNELS: SalesChannel[] = ['web', 'outlet'];

// Storefront visibility, shared by every public query: not discontinued and not held back by an adjustment.
export const STOREFRONT_VISIBLE = { isArchived: false, inventoryStatus: 'available', listingStatus: 'published', catalogCanonicalId: null } as const;

export const isSellable = (product: Pick<ProductModel, 'isArchived' | 'inventoryStatus'> & Partial<Pick<ProductModel,'partnerId'|'listingStatus'|'catalogCanonicalId'>>): boolean =>
  !product.catalogCanonicalId && !product.isArchived && product.inventoryStatus === 'available' && (product.listingStatus === 'published' || (!product.partnerId && product.listingStatus === undefined));

@Table({
  tableName: 'product',
  indexes: [
    { name: 'product_family_lookup', fields: ['modelFamilyId', 'partnerId'] },
    { name: 'product_condition_nodes_gin', using: 'gin', fields: ['conditionNodeIds'] },
  ],
})
export default class ProductModel extends Model {
  @Column(DataType.INTEGER)
  partnerId!: number | null;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'published' })
  listingStatus!: 'draft' | 'review' | 'rejected' | 'approved' | 'published' | 'hidden';

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  listingVersion!: number;

  @Column(DataType.STRING) listingRequestKey!: string | null;
  @Column(DataType.STRING) listingRequestDigest!: string | null;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) dispatchDays!: number;
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  // The product's public identifier (links, sharing, structured data): random, so it reveals nothing about the catalog
  // size or order. The integer id stays the internal key (order lines, carts, the agent's analytics).
  @Column({ type: DataType.UUID, allowNull: false, unique: true, defaultValue: DataType.UUIDV4 })
  uuid!: string;

  // The SEO path segment (/san-pham/<slug>), from the name without accents; set once and kept when the name changes,
  // so links never break.
  @Column({ type: DataType.STRING(120), allowNull: false, unique: true })
  slug!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name!: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  sku!: string;

  @Column(DataType.TEXT)
  description?: string;

  @Column({ type: DataType.STRING, allowNull: false })
  brandName!: string;

  @Column(DataType.STRING)
  scale?: string;

  @Column(DataType.STRING)
  modelCode?: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'new' })
  condition!: ModelCondition;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'unassembled' })
  assemblyState!: AssemblyState;

  @Column({ type: DataType.INTEGER, allowNull: true })
  conditionPercent!: number | null;

  @Column(DataType.STRING)
  boxCondition?: string;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  includedAccessories!: string[];

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  defects!: string[];

  // What this unit lacks (condition `incomplete`) and a free note on its condition, shown to customers.
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  missingAccessories!: string[];

  @Column(DataType.TEXT)
  conditionNote?: string | null;

  // A condition option of another product (its main listing, one level deep): the same model in another condition
  // with its own SKU, price, cost, stock and photos. The storefront lists the main listing once and offers its options
  // on the product page; carts, orders and stock work on each row as on any product. Null for a main listing.
  @Column(DataType.INTEGER)
  parentProductId!: number | null;

  @Column({ type: DataType.INTEGER, references: { model: 'model_family', key: 'id' }, onDelete: 'RESTRICT' })
  modelFamilyId!: number | null;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'new' })
  itemTypeKey!: 'new' | 'preowned';

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  conditionNodeIds!: number[];

  // Null only for legacy rows awaiting an explicit migration decision. Does not include price or notes.
  @Column({ type: DataType.STRING(150), unique: true })
  combinationKey!: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  catalogReviewRequired!: boolean;

  @Column({ type: DataType.INTEGER, references: { model: 'product', key: 'id' }, onDelete: 'RESTRICT' })
  catalogCanonicalId!: number | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  serviceReferenceEnabled!: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  publicationRequiresIntake!: boolean;

  @Column(DataType.TEXT)
  descriptionEn?: string;

  @Column(DataType.TEXT)
  descriptionVi?: string;

  // Prices are whole VND amounts.
  @Column({ type: DataType.INTEGER, allowNull: false })
  price!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  importPrice!: number;

  // S: the shop's target selling price (owner rule of 2026-10-25), approved by an admin (`targetPriceApprovedAt`).
  @Column(DataType.INTEGER) pricingReferenceMemberVnd!: number | null;
  @Column(DataType.DATE) targetPriceApprovedAt!: Date | null;
  // Legacy secondary price retained for migration/reconciliation only. Each canonical SKU now has one S.
  @Column(DataType.INTEGER) pricingReferencePreownedVnd!: number | null;
  @Column(DataType.INTEGER) targetPriceApprovedByUserId!: number | null;
  // Legacy verification flag retained for existing orders. Canonical SKU pricing derives R from its own approved S.
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  listPriceVerified!: boolean;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) pricingIssueCount!: number;
  @Column(DataType.INTEGER) buybackPriceVnd!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  stock!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  sold!: number;

  @Column({ type: DataType.STRING, allowNull: false })
  imageUrl!: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  isFeatured!: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  isArchived!: boolean;

  @Column({ type: DataType.ENUM(...INVENTORY_STATUSES), allowNull: false, defaultValue: 'available' })
  inventoryStatus!: InventoryStatus;

  // Outlet products are still sold on the storefront, with an "Outlet" badge and their own filter.
  @Column({ type: DataType.ENUM(...SALES_CHANNELS), allowNull: false, defaultValue: 'web' })
  salesChannel!: SalesChannel;

  // The date the stock was received ("Ngày nhập"; the column keeps its historical name). Staff only, never sent to the
  // storefront; defaults to the day the product is added.
  @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
  productionDate?: Date;

  // Average review rating, kept in sync by the review logic.
  @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
  rating!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  reviewCount!: number;

  @Column(DataType.STRING)
  weight?: string;

  @Column(DataType.STRING)
  dimensions?: string;

  // The retail box as shipped, for the package optimizer (null: the shop's fallback box is used).
  @Column(DataType.JSONB)
  packaging?: ProductPackaging | null;

  // Optional: the owner's catalogue leaves products uncategorized (categories are not shown to customers).
  @ForeignKey(() => CategoryModel)
  @Column(DataType.INTEGER)
  categoryId!: number | null;

  @ForeignKey(() => SupplierModel)
  @Column(DataType.INTEGER)
  supplierId?: number;

  // A unique slug from the name; a name already used gets a short part of the uuid.
  @BeforeValidate
  static async assignSlug(product: ProductModel, options: { transaction?: Transaction | null }) {
    if (product.slug) return;
    const base = slugify(product.name || '') || 'mo-hinh';
    const taken = await ProductModel.count({
      where: { slug: base, ...(product.id ? { id: { [Op.ne]: product.id } } : {}) },
      ...(options?.transaction ? { transaction: options.transaction } : {}),
    });
    if (!product.uuid) product.uuid = crypto.randomUUID();
    product.slug = taken ? `${base.slice(0, 110)}-${product.uuid.slice(0, 6)}` : base;
  }

  public static async seedData(): Promise<void> {
    await seedProductData();
  }
}
