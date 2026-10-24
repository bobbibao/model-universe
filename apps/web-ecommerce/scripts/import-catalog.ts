/* `yarn catalog:import [sheet.csv] [--dry-run]`: make the shop's own catalogue exactly the owner's workbook
 * "MODEL UNIVERSE - Danh mục 6 hãng và phiên bản" (tab "Danh mục 6 hãng") on an existing database, without dropping
 * anything.
 *
 * Applies the pending migrations first (like `yarn db:migrate`; migration 2026-10-25-45 already applies the committed
 * export seeders/data/owner-catalog.json), then syncs the catalogue in one transaction (OwnerCatalog.ts): every row's
 * product is updated or created, every other shop-owned product is retired (deleted when nothing refers to it, else
 * archived). With a CSV exported from Google Sheets the rows come from that file (the image column is ignored);
 * `--dry-run` reports what would change and rolls back.
 */
export {}; // a module: its names do not collide with the other scripts in the server build

process.env.SEED_DATA = 'false';
process.env.DROP_TABLES = 'false';
process.env.STRICT_SEED = 'true';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { readFileSync } = require('fs');
// Imported after the environment is set: the provider reads it when it initializes.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DatabaseProvider = require('../src/core/server/database/Database.Provider').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  loadOwnerCatalog,
  parseOwnerCatalogCsv,
  syncOwnerCatalog,
} = require('../src/core/server/database/client/seeders/OwnerCatalog');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const csvPath = args.find((arg) => !arg.startsWith('--'));
const DRY_RUN = new Error('dry run');

DatabaseProvider.initialize()
  .then(async () => {
    const rows = csvPath ? parseOwnerCatalogCsv(readFileSync(csvPath, 'utf8')) : loadOwnerCatalog();
    let result: unknown;
    try {
      await DatabaseProvider.getInstance().transaction(async (transaction: unknown) => {
        result = await syncOwnerCatalog(rows, transaction);
        if (dryRun) throw DRY_RUN;
      });
    } catch (error) {
      if (error !== DRY_RUN) throw error;
    }
    await DatabaseProvider.getInstance().close();
    console.log(`owner catalogue${dryRun ? ' (dry run, nothing written)' : ''}: ${rows.length} rows`, result);
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('catalogue sync failed:', error);
    process.exit(1);
  });
