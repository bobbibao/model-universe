/* eslint-disable @typescript-eslint/no-require-imports -- Configure the explicitly selected database before loading application models. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadEnvConfig } from '@next/env';
import type Provider from '../src/core/server/database/Database.Provider';
import type * as Fixture from '../src/core/server/database/client/seeders/FinanceFixture';
loadEnvConfig(process.cwd(), false);
if (!process.argv.includes('--current-development-database') || !process.env.DB_NAME)
  throw new Error(
    'Explicit --current-development-database is required. This command adds marked development data to the configured database.',
  );
const database = process.env.DB_NAME;
Object.assign(process.env, {
  FINANCE_ALLOW_CURRENT_DEVELOPMENT: 'true',
  SEED_DATA: 'false',
  DROP_TABLES: 'false',
  REAL_COMMERCE: 'false',
  DISABLE_BACKGROUND_JOBS: 'true',
  SMTP_HOST: '',
  PAYOS_CLIENT_ID: '',
  PAYOS_API_KEY: '',
  PAYOS_CHECKSUM_KEY: '',
  SUPERAI_TOKEN: '',
  SUPERAI_ORDER_MODE: 'simulate',
  ZALO_MODE: 'off',
  ZALO_ZNS_ACCESS_TOKEN: '',
  LOG_LEVEL: 'error',
});
async function main() {
  const home = process.env.MODEL_UNIVERSE_RUNTIME_DIR || path.resolve('.runtime');
  fs.mkdirSync(path.join(home, 'backups'), { recursive: true });
  const stamp = Date.now(),
    backup = path.join(home, 'backups', `before-finance-development-${stamp}.dump`);
  const dump =
    process.env.PG_DUMP_PATH ||
    (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe' : 'pg_dump');
  execFileSync(
    dump,
    [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--host',
      process.env.DB_HOST!,
      '--port',
      process.env.DB_PORT!,
      '--username',
      process.env.DB_USERNAME!,
      '--file',
      backup,
      database,
    ],
    { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }, windowsHide: true, stdio: 'pipe' },
  );
  const { Client } = await import('pg');
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database,
  });
  await client.connect();
  const before = (
    await client.query(
      'SELECT id,uuid,sku,slug,price,"importPrice","pricingReferenceMemberVnd",stock,sold,"itemTypeKey","conditionNodeIds" FROM product ORDER BY id',
    )
  ).rows;
  fs.writeFileSync(path.join(home, `finance-development-products-before-${stamp}.json`), JSON.stringify(before));
  await client.end();
  const DB = require('../src/core/server/database/Database.Provider').default as typeof Provider;
  try {
    await DB.initialize();
    const { seedFinanceDevelopment } =
      require('../src/core/server/database/client/seeders/FinanceFixture') as typeof Fixture;
    const manifest = await seedFinanceDevelopment(database);
    const { QueryTypes } = await import('sequelize');
    const after = await DB.getInstance().query(
      'SELECT id,uuid,sku,slug,price,"importPrice","pricingReferenceMemberVnd",stock,sold,"itemTypeKey","conditionNodeIds" FROM product ORDER BY id',
      { type: QueryTypes.SELECT },
    );
    const originals = after.filter((row) => before.some((original) => original.id === (row as { id: number }).id));
    if (JSON.stringify(originals) !== JSON.stringify(before))
      throw new Error('Original catalog verification failed. Inspect the backup before continuing.');
    const result = { database, backup, originalProductsPreserved: before.length, manifest };
    fs.writeFileSync(path.join(home, 'finance-development-seed-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await DB.getInstance().close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
