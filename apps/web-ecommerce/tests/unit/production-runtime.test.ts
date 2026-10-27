import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

// Exercise the supervisor without starting processes, opening ports or touching shop data.
function harness(tunnelAlive = true) {
  const app = path.resolve(__dirname, '../..');
  const home = path.join(app, '.runtime-test');
  const files = new Map<string, string>([
    [path.join(home, 'release.json'), JSON.stringify({ commit: 'abc123', nextDist: 'dist/.next-live-abc123-1' })],
    [path.join(home, 'tunnel-state.json'), JSON.stringify({ pid: 500, publicUrl: 'https://same.trycloudflare.com', temporaryUrl: true })],
  ]);
  const children: Array<EventEmitter & { pid: number; kill: jest.Mock }> = [];
  const errors: string[] = [];
  let tick: (() => void) | undefined;
  const stream = { end() {}, write() {} };
  const spawn = jest.fn(() => {
    const child = Object.assign(new EventEmitter(), {
      pid: 1000 + children.length, stdout: { pipe() {} }, stderr: { pipe() {} },
      kill: jest.fn(() => { queueMicrotask(() => child.emit('exit', 0)); return true; }),
    });
    children.push(child);
    return child;
  });
  const context = {
    __dirname: path.join(app, 'scripts'),
    process: {
      pid: 100, platform: 'linux', execPath: 'node', argv: ['node', 'runtime', 'run'],
      env: { MODEL_UNIVERSE_RUNTIME_DIR: home, DB_NAME: 'shop' }, on() {}, exit() {},
      kill(pid: number) { if (pid === 500 && tunnelAlive) return; throw new Error('No such process'); },
    },
    require(name: string) {
      if (name === '@next/env') return { loadEnvConfig() {} };
      if (name === 'node:fs') return {
        mkdirSync() {}, createWriteStream: () => stream,
        existsSync: (file: string) => files.has(file) || /(?:BUILD_ID|server\.js)$/.test(file),
        readFileSync(file: string) { if (!files.has(file)) throw new Error('ENOENT'); return files.get(file); },
        writeFileSync: (file: string, value: string) => files.set(file, value),
        rmSync: (file: string) => files.delete(file),
      };
      if (name === 'node:net') return { createServer: () => ({ once() {}, listen(_port: number, _host: string, cb: () => void) { cb(); }, close(cb: () => void) { cb(); } }) };
      if (name === 'node:child_process') return { spawn };
      if (name === 'node:path') return path;
      if (name === 'node:util') return { parseEnv: () => ({}) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    console: { log() {}, error: (message: string) => errors.push(message) },
    fetch: async () => ({ ok: true }), AbortSignal,
    setTimeout, clearTimeout,
    setInterval(callback: () => void) { tick = callback; return 1; },
    clearInterval() { tick = undefined; },
  };
  vm.runInNewContext(fs.readFileSync(path.join(app, 'scripts/production-runtime.cjs'), 'utf8'), context);
  return {
    files, home, spawn, children, errors,
    tick: () => tick?.(),
    state: () => JSON.parse(files.get(path.join(home, 'state.json'))!),
  };
}

const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

describe('production tunnel lifecycle', () => {
  it('restarts only the web process while preserving the tunnel URL and PID', async () => {
    const runtime = harness(); await settle();
    const before = runtime.state();
    expect(before.phase).toBe('running');
    runtime.files.set(path.join(runtime.home, 'restart-web'), 'restart');
    runtime.tick(); await settle();
    const after = runtime.state();
    expect(after.phase).toBe('running');
    expect(after.serverPid).not.toBe(before.serverPid);
    expect(after.publicUrl).toBe(before.publicUrl);
    expect(after.tunnelPid).toBe(500);
    expect(runtime.children[0].kill).toHaveBeenCalledTimes(1);
    expect(runtime.spawn).toHaveBeenCalledTimes(2);
    expect(runtime.errors).toEqual([]);
  });

  it('stops the web without spawning or terminating a replacement tunnel', async () => {
    const runtime = harness(); await settle();
    runtime.files.set(path.join(runtime.home, 'stop'), 'stop');
    runtime.tick(); await settle();
    expect(runtime.children[0].kill).toHaveBeenCalledTimes(1);
    expect(runtime.spawn).toHaveBeenCalledTimes(1);
    expect(runtime.files.has(path.join(runtime.home, 'tunnel-state.json'))).toBe(true);
    expect(runtime.state().tunnelPid).toBe(500);
  });

  it('refuses to silently replace a dead Quick Tunnel with a different URL', async () => {
    const runtime = harness(false); await settle();
    expect(runtime.spawn).not.toHaveBeenCalled();
    expect(runtime.errors.join()).toContain('cannot be reclaimed');
    expect(runtime.state().stoppedAt).toBeDefined();
  });
});
