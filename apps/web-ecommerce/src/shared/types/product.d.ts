import type { GunplaAttributes, ModelCondition } from '../gunpla';
import type { ProductPackaging } from '../packing/rules';
export type ProductGender = 'male' | 'female' | 'unisex';

export type SalesChannel = 'web' | 'outlet';

export type InventoryStatus = 'available' | 'quarantine' | 'donation_pending' | 'recycle';

// Effective price: `price` is the list price, `salePrice` what the customer pays (after a running discount).
export type ProductPricing = {
  managedSale?: boolean;
  salePrice: number;
  discountPercent: number;
  discountEndsAt: string | null;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  productCount?: number;
};

// The units of one condition a model is offered in (storefront and admin listings): how many listings or options,
// their stock and the lowest price a customer pays among those in stock.
export type ConditionSummary = {
  condition: ModelCondition;
  units: number;
  stock: number;
  minSalePrice: number;
};

// Product card data returned by the storefront listing: one card per model (its main listing).
export type ProductSummary = ProductPricing & GunplaAttributes & {
  partnerId?: number | null;
  id: number;
  // Public identifier and SEO path segment (/san-pham/<slug>).
  uuid?: string;
  slug?: string;
  name: string;
  brandName: string;
  gender: ProductGender;
  price: number;
  stock: number;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  isFeatured: boolean;
  sold?: number;
  salesChannel: SalesChannel;
  category?: Pick<Category, 'id' | 'name' | 'slug'>;
  // Listings only: every condition the model is on sale in, and their stock together.
  conditions?: ConditionSummary[];
  groupStock?: number;
};

// One unit a customer can choose on the product page: the main listing or one of its condition options. Its id is the
// product to put in the cart.
export type ProductConditionOption = ProductPricing & {
  id: number;
  uuid: string;
  slug: string;
  sku: string;
  isMain: boolean;
  condition: ModelCondition;
  conditionNote: string | null;
  missingAccessories: string[];
  defects: string[];
  includedAccessories: string[];
  boxCondition: string | null;
  assemblyState: GunplaAttributes['assemblyState'];
  imageUrl: string;
  images: string[];
  stock: number;
  price: number;
};

export type RatingDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;

export type ProductDetail = ProductSummary & {
  sku: string;
  description?: string | null;
  availableSizes: string[];
  sold: number;
  weight?: string | null;
  dimensions?: string | null;
  categoryId: number | null;
  images: string[];
  imageAttributions?: { imageUrl: string; creator: string; source: string; license: string; licenseUrl: string }[];
  ratingDistribution: RatingDistribution;
  // The main listing first, then its condition options; the unit the page was opened with.
  conditionOptions?: ProductConditionOption[];
  selectedOptionId?: number;
};

export type AdminProductListItem = ProductSummary & {
  sku: string;
  sold: number;
  importPrice: number;
  pricingReferenceMemberVnd?: number | null;
  isArchived: boolean;
  inventoryStatus: InventoryStatus;
  createdAt: string;
  productionDate?: string | null;
};

// One unit of a model in Admin: the main listing or a condition option, with its price, cost and stock.
export type AdminProductUnit = ProductPricing & {
  id: number;
  sku: string;
  name: string;
  isMain: boolean;
  condition: ModelCondition;
  conditionNote?: string | null;
  missingAccessories: string[];
  defects: string[];
  price: number;
  pricingReferenceMemberVnd?: number | null;
  importPrice: number;
  stock: number;
  sold: number;
  imageUrl: string;
  isArchived: boolean;
  inventoryStatus: InventoryStatus;
};

export type AdminProduct = Omit<ProductDetail, 'ratingDistribution' | 'conditionOptions' | 'selectedOptionId' | keyof ProductPricing> & {
  productionDate?: string | null;
  // Set on a condition option: the main listing it belongs to.
  parentProductId?: number | null;
  listing?: { id: number; name: string; sku: string } | null;
  units?: AdminProductUnit[];
  pricingReferenceMemberVnd?: number | null;
  pricingIssueCount?: number;
  buybackPriceVnd?: number | null;
  importPrice: number;
  isArchived: boolean;
  inventoryStatus: InventoryStatus;
  supplierId?: number | null;
  supplier?: Pick<Supplier, 'id' | 'name' | 'contactPhone'> | null;
  packaging?: ProductPackaging | null;
};

export type Review = {
  id: number;
  rating: number;
  title: string;
  content?: string | null;
  location?: string | null;
  createdAt: string;
  author: string;
  authorAvatar?: string | null;
};

export type ProductFilterOptions = {
  brands: string[];
  scales: string[];
  priceRange: { min: number; max: number };
};

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'name' | 'best_selling' | 'rating';

export type ProductQuery = {
  assemblyState?: string;
  scale?: string;
  condition?: string;
  q?: string;
  category?: string;
  gender?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  channel?: SalesChannel | '';
  sort?: ProductSort | '';
  page?: number;
  per_page?: number;
};

export type Supplier = {
  id: number;
  name: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  logo?: string | null;
  isActive: boolean;
  createdAt?: string;
};

// Payload of the admin create/update product endpoints.
export type ProductPayload = GunplaAttributes & {
  pricingReferenceMemberVnd?: number;
  pricingIssueCount?: number;
  buybackPriceVnd?: number | null;
  expectedStock?: number;
  expectedPrice?: number;
  name: string;
  brandName: string;
  sku: string;
  description: string;
  gender: ProductGender;
  categoryId: number | null;
  supplierId: number | null;
  availableSizes: string[];
  price: number;
  importPrice: number;
  stock: number;
  weight: string;
  dimensions: string;
  packaging?: ProductPackaging | null;
  // The received date ("Ngày nhập"), staff only; empty means the day the product is added.
  productionDate: string | null;
  imageUrl: string;
  images: string[];
  isFeatured: boolean;
  isArchived: boolean;
  inventoryStatus: InventoryStatus;
};

// Admin "Thống kê kho": the shop's own catalogue, archived products and partner merchandise excluded.
export type InventoryStats = {
  totals: {
    listings: number;
    options: number;
    names: number;
    unitsInStock: number;
    unitsOutOfStock: number;
    stock: number;
    brands: number;
    costValue: number;
    listValue: number;
    memberValue: number;
    marginValue: number;
    missingCost: number;
    averageDaysInStock: number;
  };
  brands: { brand: string; listings: number; unitsInStock: number; stock: number; costValue: number; memberValue: number }[];
  conditions: { condition: ModelCondition; units: number; unitsInStock: number; stock: number }[];
};

// A new condition option of a listing (Admin): the model comes from the listing.
export type ConditionOptionPayload = Pick<
  ProductPayload,
  | 'condition'
  | 'conditionNote'
  | 'missingAccessories'
  | 'defects'
  | 'includedAccessories'
  | 'boxCondition'
  | 'assemblyState'
  | 'pricingReferenceMemberVnd'
  | 'pricingIssueCount'
  | 'price'
  | 'buybackPriceVnd'
  | 'importPrice'
  | 'stock'
  | 'productionDate'
> &
  // Without photos of its own the option shows the listing's.
  Partial<Pick<ProductPayload, 'imageUrl' | 'images'>> & { sku?: string };
