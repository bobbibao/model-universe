/* `yarn images:watermark [--force] [--dry-run]`: stamps the shop's mark on every stored photo of a shop product
 * (main photo and gallery under /uploads/products, partner listings excluded), keeping each clean original privately
 * (ProductWatermark.ts). A photo already stamped is skipped, so running it again changes nothing; `--force` redraws
 * the mark from the originals (after the mark changes). External (hotlinked) photos are listed: they cannot be stamped
 * until the shop stores its own copy.
 */
export {}; // a module: its names do not collide with the other scripts in the server build

process.env.SEED_DATA = 'false';
process.env.DROP_TABLES = 'false';
process.env.STRICT_SEED = 'true';

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');
const DatabaseProvider = require('../src/core/server/database/Database.Provider').default;
const FileStorageService = require('../src/core/server/services/FileStorageService').default;
const { watermarkStoredPhoto } = require('../src/core/server/services/media/ProductWatermark');
/* eslint-enable @typescript-eslint/no-var-requires */

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

DatabaseProvider.initialize()
  .then(async () => {
    const rows: { url: string }[] = await DatabaseProvider.getInstance().query(
      `SELECT p."imageUrl" AS url FROM product p WHERE p."partnerId" IS NULL
       UNION SELECT i.url FROM product_image i JOIN product p ON p.id = i."productId" WHERE p."partnerId" IS NULL`,
      { type: QueryTypes.SELECT },
    );
    const local = rows.map((row) => row.url).filter((url) => url?.startsWith('/uploads/products/'));
    const external = rows
      .map((row) => row.url)
      .filter((url) => /^https?:\/\//.test(url ?? '') && !url.includes('placehold.co'));
    const counts = { stamped: 0, kept: 0, missing: 0, failed: 0 };
    for (const url of local) {
      const file = path.join(FileStorageService.getUploadRoot(), url.slice('/uploads/'.length));
      if (!fs.existsSync(file)) {
        counts.missing++;
        continue;
      }
      if (dryRun) continue;
      try {
        counts[(await watermarkStoredPhoto(file, { force })) as 'stamped' | 'kept']++;
      } catch (error) {
        counts.failed++;
        console.warn(`${url}: ${(error as Error).message}`);
      }
    }
    console.log(
      `${dryRun ? '(dry run) ' : ''}${local.length} stored photo(s): ${counts.stamped} stamped, ${counts.kept} already stamped, ${counts.missing} missing, ${counts.failed} failed; ${external.length} hotlinked photo(s) cannot be stamped.`,
    );
    await DatabaseProvider.getInstance().close();
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('watermark failed:', error);
    process.exit(1);
  });
