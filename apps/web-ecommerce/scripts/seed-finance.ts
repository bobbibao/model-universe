/* eslint-disable @typescript-eslint/no-require-imports -- Environment must be isolated before loading database models. */
import { loadEnvConfig } from '@next/env';
import type Provider from '../src/core/server/database/Database.Provider';
import type * as Fixture from '../src/core/server/database/client/seeders/FinanceFixture';
loadEnvConfig(process.cwd(), false);
const database = process.argv.find((arg) => arg.startsWith('--database='))?.slice(11);
if (!database || !/^model_universe_finance_[a-z0-9_]+_test$/.test(database) || database === process.env.DB_NAME)
  throw new Error('Pass --database=model_universe_finance_<name>_test; never the current shop database.');
Object.assign(process.env, {
  DB_NAME: database,
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
  const { Client } = await import('pg');
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  if (!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount)
    await client.query(`CREATE DATABASE "${database}"`);
  await client.end();
  const DB = require('../src/core/server/database/Database.Provider').default as typeof Provider;
  try {
    await DB.initializeDemoSchema();
    const { seedFinanceFixture } =
      require('../src/core/server/database/client/seeders/FinanceFixture') as typeof Fixture;
    console.log(JSON.stringify(await seedFinanceFixture(), null, 2));
  } finally {
    await DB.getInstance().close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
