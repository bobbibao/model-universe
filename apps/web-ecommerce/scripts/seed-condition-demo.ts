/* eslint-disable @typescript-eslint/no-require-imports -- Configure the isolated environment before loading application modules. */
import type ProviderType from '../src/core/server/database/Database.Provider';
import type * as DemoTypes from '../src/core/server/database/client/seeders/ConditionDemo';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
// Must be selected explicitly; never inherit DB_NAME from the shop .env.
const demoName = process.argv.find((arg) => arg.startsWith('--database='))?.slice('--database='.length);
if (!demoName || !/^[a-z0-9_]+_condition_demo$/.test(demoName))
  throw new Error('Pass --database=<name>_condition_demo. The shop database is never a default.');
Object.assign(process.env, {
  DB_NAME: demoName,
  SEED_DATA: 'false',
  DROP_TABLES: 'false',
  SMTP_HOST: '',
  ZALO_MODE: 'off',
  ZALO_ZNS_ACCESS_TOKEN: '',
  PAYOS_CLIENT_ID: '',
  PAYOS_API_KEY: '',
  PAYOS_CHECKSUM_KEY: '',
  DISABLE_BACKGROUND_JOBS: 'true',
  SUPERAI_ORDER_MODE: 'simulate',
  SUPERAI_TOKEN: '',
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
  if (!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [demoName])).rowCount)
    await client.query(`CREATE DATABASE "${demoName}"`);
  await client.end();
  const DatabaseProvider = require('../src/core/server/database/Database.Provider').default as typeof ProviderType;
  try {
    await DatabaseProvider.initializeDemoSchema();
    const { seedConditionDemo } =
      require('../src/core/server/database/client/seeders/ConditionDemo') as typeof DemoTypes;
    console.log(JSON.stringify(await seedConditionDemo()));
  } finally {
    await DatabaseProvider.getInstance().close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
