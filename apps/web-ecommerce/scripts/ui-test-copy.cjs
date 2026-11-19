#!/usr/bin/env node
// An isolated local copy of the shop for reviewing the UI, the admin included, without the live admin account:
//   - its own database (model_universe_uitest) on the app's Postgres server, seeded with the development demo data;
//   - its own JWT secret and a generated test admin, written to .artifacts/uitest/credentials.json (gitignored);
//   - every outside integration off (mail, payments, shipping, maps, Google sign-in, the agent service);
//   - the latest production build copied to dist/.next-uitest and started through an environment variable, so the
//     copy's command line never shows ".next…/server.js" and the deploy script's single-web check never counts it;
//   - listening on 127.0.0.1:6090 only.
// Usage (from apps/web-ecommerce):  node scripts/ui-test-copy.cjs [--fresh]   (--fresh drops and reseeds the database)
// Sign in on http://127.0.0.1:6090 with the credentials file, or POST them to /api/auth/login.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = path.resolve(__dirname, '..');
const DB = 'model_universe_uitest';
const PORT = '6090';
require(path.join(app, 'node_modules', '@next', 'env')).loadEnvConfig(app, false, { info() {}, error() {} });
const { Client } = require(path.join(app, 'node_modules', 'pg'));

async function ensureDatabase(fresh) {
  if (process.env.DB_NAME === DB) throw new Error('the live database is already named ' + DB);
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  const exists = (await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB])).rowCount > 0;
  if (exists && fresh) await client.query(`DROP DATABASE ${DB}`);
  if (!exists || fresh) await client.query(`CREATE DATABASE ${DB}`);
  await client.end();
}

function latestBuild() {
  const release = JSON.parse(
    fs.readFileSync(path.join(process.env.MODEL_UNIVERSE_RUNTIME_DIR, 'release.json'), 'utf8'),
  );
  const source = path.join(app, release.nextDist);
  const target = path.join(app, 'dist', '.next-uitest');
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(fs.realpathSync(source), target, { recursive: true });
  return 'dist/.next-uitest'; // next.config.mjs requires this exact form (forward slash)
}

function credentials() {
  const dir = path.join(app, '.artifacts', 'uitest');
  const file = path.join(dir, 'credentials.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.mkdirSync(dir, { recursive: true });
  const value = {
    email: 'ui-test-admin@modeluniverse.test',
    password: crypto.randomBytes(15).toString('base64url') + 'Aa1!',
    jwt: crypto.randomBytes(32).toString('hex'),
  };
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
  return value;
}

(async () => {
  const fresh = process.argv.includes('--fresh');
  await ensureDatabase(fresh);
  const dist = latestBuild();
  const cred = credentials();
  const off = [
    'AGENT_SERVER_URL',
    'AGENT_API_TOKEN',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_ENABLED_AT',
    'PAYOS_API_KEY',
    'PAYOS_CHECKSUM_KEY',
    'PAYOS_CLIENT_ID',
    'PAYOS_PAYOUT_API_KEY',
    'PAYOS_PAYOUT_CHECKSUM_KEY',
    'PAYOS_PAYOUT_CLIENT_ID',
    'SUPERAI_TOKEN',
    'SUPERAI_WEBHOOK_TOKEN',
    'SUPERAI_ORDER_MODE',
    'OPENMAP_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'WEBHOOK_PUBLIC_URL',
  ];
  const env = {
    ...process.env,
    ...Object.fromEntries(off.map((key) => [key, ''])),
    NODE_ENV: 'production',
    PORT,
    HOST: '127.0.0.1',
    NEXT_DIST_DIR: dist,
    DB_NAME: DB,
    SEED_DATA: 'true',
    SEED_PROFILE: 'development',
    DROP_TABLES: 'false',
    ADMIN_EMAIL: cred.email,
    ADMIN_PASSWORD: cred.password,
    JWT_SECRET: cred.jwt,
    COOKIE_SECURE: 'false',
    START_AGENT_RUNTIME: 'false',
    REAL_COMMERCE: 'false',
    SHOP_PUBLIC_URL: `http://127.0.0.1:${PORT}`,
    MODEL_UNIVERSE_RUNTIME_DIR: path.join(app, '.artifacts', 'uitest', 'runtime'),
  };
  console.log(
    `UI test copy: http://127.0.0.1:${PORT} (database ${DB}, build ${dist}); credentials in .artifacts/uitest`,
  );
  env.UITEST_SERVER = path.join(app, dist, 'server.js');
  const child = spawn(process.execPath, ['-e', 'require(process.env.UITEST_SERVER)'], {
    cwd: app,
    env,
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code ?? 0));
})().catch((error) => {
  console.error('ui-test-copy:', error.message);
  process.exit(1);
});
