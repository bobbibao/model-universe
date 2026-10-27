/* eslint-disable @typescript-eslint/no-require-imports -- Set the isolated environment before loading Next.js in a child process. */
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const app = path.resolve(__dirname, '..');
require('@next/env').loadEnvConfig(app);

const database = process.argv.find((arg) => arg.startsWith('--database='))?.slice('--database='.length);
const port = process.argv.find((arg) => arg.startsWith('--port='))?.slice('--port='.length) ?? '6080';
if (!database || !/^[a-z0-9_]+_condition_demo$/.test(database))
  throw new Error('Pass --database=<name>_condition_demo. The shop database is never a default.');
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
  throw new Error('Choose an unused port between 1024 and 65535.');
const server = path.join(app, 'dist/.next/server.js');
if (!fs.existsSync(server) || !fs.existsSync(path.join(app, 'dist/.next/BUILD_ID')))
  throw new Error('Build the application first: yarn build.');

// Next.js restores its initial environment during preparation. Supply isolation before importing it.
const env = {
  ...process.env,
  NODE_ENV: 'production',
  DB_NAME: database,
  PORT: port,
  NEXT_DIST_DIR: '',
  SEED_DATA: 'false',
  DROP_TABLES: 'false',
  DISABLE_BACKGROUND_JOBS: 'true',
  SMTP_HOST: '',
  ZALO_MODE: 'off',
  ZALO_ZNS_ACCESS_TOKEN: '',
  PAYOS_CLIENT_ID: '',
  PAYOS_API_KEY: '',
  PAYOS_CHECKSUM_KEY: '',
  SUPERAI_ORDER_MODE: 'simulate',
  SUPERAI_TOKEN: '',
};
const child = spawn(process.execPath, [server], { cwd: app, env, stdio: 'inherit', windowsHide: true });
console.log(`Condition demo: http://localhost:${port}/vi — database ${database}; background jobs disabled.`);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
