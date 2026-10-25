import { faker } from '@faker-js/faker/locale/en';
import Logger from '../../../../../shared/server/utils/logger';
import { failIfStrict } from './Seeder';
import { daysAgo, historyDays } from './SeedClock';
import { productTier } from './SeedCatalog';
import SupplierModel from '../models/Supplier.Model';
// Imported (not read from disk) so the compiled server (dist/, the e2e seed) carries it too.
import seedProducts from './data/products.json';
import type { GunplaAttributes } from '../../../../../shared/gunpla';
import { seedOwnerCatalog } from './OwnerCatalog';

// The former synthetic Gunpla demo listings (seeders/data/products.json): no longer seeded, the shop's catalogue is the
// owner's workbook. Kept for their reviews and media provenance.
export interface SeedReview {
  location: string;
  rating: number;
  date: string;
  title: string;
  content: string;
}

export interface SeedProduct extends GunplaAttributes {
  sku: string;
  name: string;
  brandName: string;
  category: string;
  stock: number;
  priceVnd: number;
  productionDate: string;
  imageUrl: string;
  additionalImageUrls: string[];
  reviews: SeedReview[];
}

const CATALOG_AGE_EXTRA_DAYS = 60; // the catalog is older than the sales history
const NEW_ARRIVAL_MAX_DAYS = 12;

export const loadSeedProducts = (): SeedProduct[] => seedProducts as SeedProduct[];

// The development shop: the owner's catalogue (OwnerCatalog.ts) with demo stock and a synthetic history: new arrivals
// were added in the last two weeks, the rest of the catalog predates the sales history.
export const seedProductData = async (): Promise<void> => {
  try {
    const supplierIds = (await SupplierModel.findAll({ where: { isActive: true } })).map((supplier) => supplier.id);
    const { created } = await seedOwnerCatalog((sku) => ({
      createdAt:
        productTier(sku) === 'new'
          ? daysAgo(faker.number.int({ min: 2, max: NEW_ARRIVAL_MAX_DAYS }))
          : daysAgo(historyDays() + CATALOG_AGE_EXTRA_DAYS),
      sold: faker.number.int({ min: 0, max: 150 }),
      supplierId: supplierIds.length > 0 ? faker.helpers.arrayElement(supplierIds) : null,
    }));
    Logger.INFO(`${created} products of the owner's catalogue seeded.`);
  } catch (error) {
    Logger.ERROR('Error seeding the product table:', error);
    failIfStrict(error);
  }
};
