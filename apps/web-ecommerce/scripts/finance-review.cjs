/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- Isolate development fixtures before the server loads. */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { randomBytes } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const app = path.resolve(__dirname, '..');
process.env.NODE_ENV = 'production';
require('@next/env').loadEnvConfig(app, false);
const home = process.env.MODEL_UNIVERSE_RUNTIME_DIR || path.join(app, '.runtime');
const stateFile = path.join(home, 'finance-review.json');
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const read = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  if (process.argv.includes('stop')) {
    const state = read(stateFile);
    if (!state || !alive(state.pid)) {
      console.log('No finance review server is running.');
      return;
    }
    if (process.platform !== 'win32')
      throw new Error('This local review launcher currently supports the Windows shop host.');
    const commandLine = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${Number(state.pid)}').CommandLine`,
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    if (!commandLine.replaceAll('\\', '/').includes(state.serverPath.replaceAll('\\', '/')))
      throw new Error('Process ownership changed. Refusing to stop another application.');
    process.kill(state.pid);
    fs.rmSync(stateFile, { force: true });
    console.log('Finance review stopped. Run yarn start:production to restore the shop database.');
    return;
  }
  const database = process.argv.find((a) => a.startsWith('--database='))?.slice(11);
  if (!database || !/^model_universe_finance_[a-z0-9_]+_test$/.test(database) || database === process.env.DB_NAME)
    throw new Error('Select an explicit finance development *_test database, never the shop database.');
  const current = read(stateFile);
  if (current && alive(current.pid)) throw new Error('Finance review is already running. Stop it first.');
  const { Client } = require('pg');
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database,
  });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT manifest FROM finance_fixture_manifest WHERE key=$1', [
      'finance-linked-fixture-v1',
    ]);
    if (!rows.length) throw new Error('Seed the finance development database before starting review.');
  } finally {
    await client.end();
  }
  const release = read(path.join(home, 'release.json'));
  if (!release || !fs.existsSync(path.join(app, release.nextDist, 'src/core/server/services/FinanceService.js')))
    throw new Error('Build the finance production source first with yarn build:production.');
  const production = read(path.join(home, 'state.json'));
  if (production && alive(production.pid)) {
    execFileSync(process.execPath, ['scripts/production-runtime.cjs', 'stop'], { cwd: app, windowsHide: true });
    for (let i = 0; i < 30 && alive(production.pid); i++) await delay(1000);
    if (alive(production.pid)) throw new Error('Production did not stop; review was not started.');
  }
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(6050, '127.0.0.1', () => probe.close(resolve));
  });
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    JWT_SECRET: randomBytes(48).toString('hex'),
    AGENT_APPROVAL_SECRET: randomBytes(48).toString('hex'),
    DB_NAME: database,
    NEXT_DIST_DIR: release.nextDist,
    REAL_COMMERCE: 'false',
    SEED_DATA: 'false',
    DROP_TABLES: 'false',
    DISABLE_BACKGROUND_JOBS: 'true',
    START_AGENT_RUNTIME: 'false',
    PORT: '6050',
    HOST: '127.0.0.1',
    COOKIE_SECURE: 'true',
    SHOP_PUBLIC_URL: 'http://localhost:6050',
    WEBHOOK_PUBLIC_URL: 'http://localhost:6050',
    PAYOS_CLIENT_ID: '',
    PAYOS_API_KEY: '',
    PAYOS_CHECKSUM_KEY: '',
    SUPERAI_TOKEN: '',
    SUPERAI_ORDER_MODE: 'simulate',
    SMTP_HOST: '',
    ZALO_MODE: 'off',
    ZALO_ZNS_ACCESS_TOKEN: '',
    AGENT_API_TOKEN: '',
    AGENT_ACTOR_SECRET: '',
    AGENT_SERVER_URL: '',
  };
  const output = fs.openSync(path.join(home, 'finance-review.log'), 'a');
  const serverPath = path.join(app, release.nextDist, 'server.js');
  let child;
  try {
    child = spawn(process.execPath, [serverPath], {
      env,
      cwd: app,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', output, output],
    });
  } finally {
    fs.closeSync(output);
  }
  child.on('error', (error) => console.error(error.message));
  child.unref();
  fs.writeFileSync(
    stateFile,
    JSON.stringify(
      {
        pid: child.pid,
        source: app,
        serverPath,
        database,
        commit: release.commit,
        port: 6050,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    'Finance development review starting at http://localhost:6050/vi/admin/finance. Shop data is unchanged; no public tunnel or live payment/shipping credentials are enabled.',
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
