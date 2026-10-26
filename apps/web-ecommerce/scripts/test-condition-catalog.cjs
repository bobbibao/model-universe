/* eslint-disable @typescript-eslint/no-require-imports -- Configure the isolated environment before loading application modules. */
const { spawn } = require('node:child_process');
require('@next/env').loadEnvConfig(process.cwd());
const { Client } = require('pg');
const suites = process.argv.slice(2);
if (suites.some((file) => !/^tests\/db\/[a-z0-9-]+\.test\.ts$/.test(file)))
  throw new Error('Pass test files under tests/db only.');
const explicitDatabase = !!process.env.TEST_DB_NAME;
const name = process.env.TEST_DB_NAME || `model_universe_condition_${Date.now()}_test`;
if (!/^[a-z0-9_]+_test$/.test(name)) throw new Error('Use a disposable *_test database.');
(async () => {
  const config = {
    host: process.env.TEST_DB_HOST || process.env.DB_HOST,
    port: Number(process.env.TEST_DB_PORT || process.env.DB_PORT),
    user: process.env.TEST_DB_USERNAME || process.env.DB_USERNAME,
    password: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD,
  };
  const client = new Client({ ...config, database: 'postgres' });
  await client.connect();
  if (!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount)
    await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
  console.log(`Using isolated test database: ${name}`);
  const child = spawn(
    process.execPath,
    [
      'node_modules/jest/bin/jest.js',
      '--selectProjects',
      'db',
      '--runInBand',
      '--runTestsByPath',
      ...(suites.length ? suites : ['tests/db/condition-tree.test.ts']),
    ],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        LOG_LEVEL: 'error',
        TEST_DB_NAME: name,
        TEST_DB_HOST: config.host,
        TEST_DB_PORT: String(config.port),
        TEST_DB_USERNAME: config.user,
        TEST_DB_PASSWORD: config.password,
      },
    },
  );
  child.on('exit', async (code) => {
    if (!explicitDatabase && code === 0) {
      const cleanup = new Client({ ...config, database: 'postgres' });
      try {
        await cleanup.connect();
        await cleanup.query(`DROP DATABASE "${name}"`);
      } catch {
        console.log(`Test database retained: ${name}`);
      } finally {
        await cleanup.end();
      }
    }
    process.exitCode = code ?? 1;
  });
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
