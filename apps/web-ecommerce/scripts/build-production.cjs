/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const sourceApp = path.resolve(__dirname, '..');
let app = sourceApp;
process.env.NODE_ENV = 'production';
require('@next/env').loadEnvConfig(sourceApp, false);
const git = (...args) => execFileSync('git', args, { cwd: sourceApp, encoding: 'utf8', windowsHide: true }).trim();
const commit = git('rev-parse', 'HEAD');
const home = process.env.MODEL_UNIVERSE_RUNTIME_DIR || path.join(sourceApp, '.runtime');
const committedSnapshot = !!git('status', '--porcelain', '--untracked-files=no');
if (committedSnapshot) {
  // Build only the committed revision; leave another editor's pending changes untouched.
  const staging = path.join(home, 'build-sources', `${commit.slice(0, 7)}-${Date.now()}`);
  fs.mkdirSync(staging, { recursive: true });
  const archive = path.join(staging, 'source.tar');
  execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, commit, 'apps/web-ecommerce'], { cwd: sourceApp, windowsHide: true });
  execFileSync('tar', ['-xf', archive, '-C', staging], { windowsHide: true });
  app = path.join(staging, 'apps/web-ecommerce');
  fs.symlinkSync(path.join(sourceApp, 'node_modules'), path.join(app, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  console.log(`Building committed snapshot ${commit.slice(0, 7)}; pending source changes are preserved.`);
}
const unchanged = () => {
  if (committedSnapshot) return;
  if (git('rev-parse', 'HEAD') !== commit || git('status', '--porcelain', '--untracked-files=no'))
    throw new Error('Source changed during the build. Commit the reviewed changes and rebuild before publishing.');
};
unchanged();
for (const args of [
  ['node_modules/next/dist/bin/next', 'build', '--no-lint'],
  ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.server.json'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: app, env: { ...process.env, NEXT_DIST_DIR: '' }, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
unchanged();
const name = `${commit.slice(0, 7)}-${Date.now()}`;
const releases = path.join(home, 'releases');
const release = path.join(releases, name);
const build = path.join(app, 'dist/.next');
for (const file of ['BUILD_ID', 'server.js'])
  if (!fs.existsSync(path.join(build, file))) throw new Error(`Incomplete build: ${file}`);
fs.mkdirSync(releases, { recursive: true });
const inventory = (directory) => {
  const files = [];
  const walk = (relative = '') => {
    for (const item of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const file = path.join(relative, item.name);
      if (!relative && item.name === 'cache') continue;
      if (item.isDirectory()) walk(file);
      else { const stat = fs.statSync(path.join(directory, file)); files.push([file, stat.size, stat.mtimeMs]); }
    }
  };
  walk(); return JSON.stringify(files.sort((a, b) => a[0].localeCompare(b[0])));
};
const before = inventory(build);
fs.cpSync(build, release, { recursive: true, force: false, errorOnExist: true,
  filter: source => path.relative(build, source).split(path.sep)[0] !== 'cache' });
if (inventory(build) !== before) throw new Error('Build output changed while copying. The active release was preserved.');
// Resolve every static relative import in the compiled backend without executing application code.
const verify = directory => {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) verify(file);
    else if (item.name.endsWith('.js')) {
      const resolve = createRequire(file).resolve;
      for (const match of fs.readFileSync(file, 'utf8').matchAll(/require\(["'](\.[^"']+)["']\)/g)) resolve(match[1]);
    }
  }
};
verify(path.join(release, 'src'));
unchanged();
const nextDist = `dist/.next-live-${name}`;
fs.symlinkSync(release, path.join(sourceApp, nextDist), process.platform === 'win32' ? 'junction' : 'dir');
const manifest = { commit: commit.slice(0, 7), nextDist, buildId: fs.readFileSync(path.join(release, 'BUILD_ID'), 'utf8').trim(), publishedAt: new Date().toISOString() };
fs.writeFileSync(path.join(home, 'release.pending.json'), JSON.stringify(manifest, null, 2));
fs.renameSync(path.join(home, 'release.pending.json'), path.join(home, 'release.json'));
console.log(`Published isolated production build: ${manifest.commit}. Restart the runtime to activate it.`);
