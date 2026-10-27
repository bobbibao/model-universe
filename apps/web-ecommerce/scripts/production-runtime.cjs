/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports -- Runtime supervisor executes before application imports. */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { parseEnv } = require('node:util');
const app = path.resolve(__dirname, '..');
process.env.NODE_ENV = 'production';
require('@next/env').loadEnvConfig(app, false);
const home = process.env.MODEL_UNIVERSE_RUNTIME_DIR || path.join(app, '.runtime');
fs.mkdirSync(home, { recursive: true });
const stateFile = path.join(home, 'state.json');
const stopFile = path.join(home, 'stop');
const lockFile = path.join(home, 'lock');
const readState = () => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return null; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const command = process.argv[2] || 'run';
if (command === 'status') {
  const state = readState();
  console.log(JSON.stringify({ ...state, running: !!state && fs.existsSync(lockFile) && alive(state.pid) }, null, 2));
} else if (command === 'stop') {
  fs.writeFileSync(stopFile, 'stop');
  console.log('Shutdown requested. The supervisor will stop its web server and tunnel.');
} else if (command === 'run') {
  let server, tunnel, agent, stopping = false, ownsLock = false, state = {};
  const output = fs.createWriteStream(path.join(home, 'web.log'), { flags: 'a' });
  const tunnelOutput = fs.createWriteStream(path.join(home, 'tunnel.log'), { flags: 'a' });
  const agentOutput = fs.createWriteStream(path.join(home, 'agent.log'), { flags: 'a' });
  const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    server?.kill();
    tunnel?.kill();
    if (agent && agent.exitCode === null) {
      if (process.platform === 'win32') {
        // A Windows venv Python launcher owns a second Python process; stop the owned tree.
        try { execFileSync('taskkill', ['/PID', String(agent.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); }
        catch { agent.kill(); }
      } else agent.kill();
    }
    if (ownsLock) { fs.rmSync(lockFile, { force: true }); fs.rmSync(stopFile, { force: true }); }
    state = { ...state, stoppedAt: new Date().toISOString() };
    if (ownsLock) save();
    output.end(); tunnelOutput.end(); agentOutput.end();
    process.exitCode = code;
    setTimeout(() => process.exit(code), 1500).unref();
  };
  const fail = (error) => { console.error(error.message); stop(1); };
  (async () => {
    if (fs.existsSync(lockFile)) {
      const pid = Number(fs.readFileSync(lockFile, 'utf8'));
      if (alive(pid)) throw new Error('The production supervisor is already running. Use production:status.');
      fs.rmSync(lockFile);
    }
    fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' }); ownsLock = true;
    state = { pid: process.pid, source: app, port: 6050, phase: 'starting', startedAt: new Date().toISOString() };
    save();
    fs.rmSync(stopFile, { force: true });
    if (!fs.existsSync(path.join(app, 'dist/.next/BUILD_ID')) || !fs.existsSync(path.join(app, 'dist/.next/server.js')))
      throw new Error('Build the production application and Express server first.');
    if (!process.env.DB_NAME || /(_demo|_test)$/.test(process.env.DB_NAME))
      throw new Error('Production requires the existing shop database, never a demo/test database.');
    await new Promise((resolve, reject) => {
      const probe = net.createServer(); probe.once('error', reject);
      probe.listen(6050, '127.0.0.1', () => probe.close(resolve));
    });
    const env = { ...process.env, NODE_ENV: 'production', PORT: '6050', HOST: '127.0.0.1',
      LOGGER: 'CONSOLE', LOG_LEVEL: 'info',
      NEXT_DIST_DIR: '', REAL_COMMERCE: 'true', SEED_DATA: 'false', DROP_TABLES: 'false',
      COOKIE_SECURE: 'true', DISABLE_BACKGROUND_JOBS: 'false', SUPERAI_ORDER_MODE: 'live' };
    if (env.START_AGENT_RUNTIME === 'true') {
      const agentApp = path.resolve(app, '../agent-service');
      for (const name of [env.AGENT_POSTGRES_CONTAINER, env.AGENT_REDIS_CONTAINER].filter(Boolean))
        execFileSync('docker', ['start', name], { windowsHide: true, stdio: 'ignore' });
      const agentEnv = { ...env, ...parseEnv(fs.readFileSync(path.join(agentApp, '.env'), 'utf8')),
        HOST: '127.0.0.1', PORT: '2026', SERVER_URL: 'http://127.0.0.1:2026',
        APP_ENV: 'production', ENV_MODE: 'PRODUCTION', AUTH_TYPE: 'custom', DEBUG: 'false',
        AEGRA_CONFIG: path.join(agentApp, 'aegra.json'), PYTHONPATH: path.join(agentApp, 'src'),
        SHOP_API_TOKEN: env.AGENT_API_TOKEN, AGENT_ACTOR_SECRET: env.AGENT_ACTOR_SECRET,
        SHOP_API_BASE_URL: 'http://127.0.0.1:6050/api/agent/v1', AGENT_SERVER_URL: 'http://127.0.0.1:2026',
        OLLAMA_HOST: 'http://127.0.0.1:11434', REDIS_BROKER_ENABLED: 'true', REDIS_URL: 'redis://127.0.0.1:6379/0',
        LOG_LEVEL: 'INFO' };
      delete agentEnv.DEMO_MEASURE_AFTER_MINUTES; delete agentEnv.FAULT_KILL_AFTER_STEP;
      const python = env.AGENT_PYTHON || path.join(agentApp, '.venv/Scripts/python.exe');
      agent = spawn(python, ['-m', 'uvicorn', 'aegra_api.main:app', '--host', '127.0.0.1', '--port', '2026',
        '--loop', 'aegra_api.utils.event_loop:selector_loop_factory'],
      { cwd: agentApp, env: agentEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      agent.stdout.pipe(agentOutput, { end: false }); agent.stderr.pipe(agentOutput, { end: false });
      agent.on('error', fail);
      agent.on('exit', (code) => { if (!stopping) fail(new Error(`Agent runtime exited (${code}). See agent.log.`)); });
      let healthy = false;
      for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
        try { healthy = (await fetch('http://127.0.0.1:2026/health', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Starting. */ }
        if (healthy) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (stopping) return;
      if (!healthy) throw new Error('Agent startup timed out. See agent.log.');
      env.AGENT_SERVER_URL = 'http://127.0.0.1:2026';
    }
    const named = !!env.TUNNEL_TOKEN;
    if (named && !/^https:\/\//.test(env.SHOP_PUBLIC_URL || '')) throw new Error('A named tunnel requires SHOP_PUBLIC_URL=https://your-domain.');
    let resolveUrl, rejectUrl;
    const urlPromise = new Promise((resolve, reject) => { resolveUrl = resolve; rejectUrl = reject; });
    if (named) resolveUrl(env.SHOP_PUBLIC_URL);
    tunnel = spawn(env.CLOUDFLARED_PATH || 'cloudflared', named
      ? ['tunnel', '--no-autoupdate', 'run']
      : ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:6050'],
    { env, cwd: app, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    tunnel.on('error', rejectUrl);
    let buffer = '';
    const collect = (chunk) => {
      tunnelOutput.write(chunk); buffer = (buffer + chunk.toString()).slice(-8000);
      const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) resolveUrl(match[0]);
    };
    tunnel.stdout.on('data', collect); tunnel.stderr.on('data', collect);
    tunnel.on('exit', (code) => { rejectUrl(new Error(`Tunnel stopped (${code}). See tunnel.log.`)); if (!stopping) fail(new Error('Tunnel disconnected; production runtime stopped. Restart to reconnect.')); });
    const timer = setTimeout(() => rejectUrl(new Error('Tunnel URL timed out. See tunnel.log.')), 60000);
    const url = named ? env.SHOP_PUBLIC_URL : await urlPromise;
    clearTimeout(timer);
    env.SHOP_PUBLIC_URL = url; env.WEBHOOK_PUBLIC_URL = url;
    let commit = 'unknown';
    try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: app, encoding: 'utf8', windowsHide: true }).trim(); } catch { /* Git may be unavailable in a packaged deployment. */ }
    state = { pid: process.pid, tunnelPid: tunnel.pid, agentPid: agent?.pid, phase: 'running', startedAt: state.startedAt, commit,
      source: app, database: env.DB_NAME, port: 6050, localUrl: 'http://localhost:6050', publicUrl: url, temporaryUrl: !named };
    server = spawn(process.execPath, [path.join(app, 'dist/.next/server.js')], { cwd: app, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    state.serverPid = server.pid; save();
    server.stdout.pipe(output, { end: false }); server.stderr.pipe(output, { end: false });
    server.on('error', fail);
    server.on('exit', (code) => { if (!stopping) fail(new Error(`Web server exited (${code}). See web.log.`)); });
    const check = setInterval(() => { if (fs.existsSync(stopFile)) { clearInterval(check); stop(); } }, 1000);
    console.log(`MODEL UNIVERSE: ${url} — local http://localhost:6050; source ${app}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(check); stop(); });
  })().catch(fail);
} else { throw new Error('Use run, status or stop.'); }
