const { spawnSync } = require('child_process');
const path = require('path');

const worktreeApp = 'C:/Users/ACER/.gemini/antigravity/worktrees/0b914c65-7392-4466-a685-a7b3bfe70f07/subagent-Feat-Smart-Recommendations-Worktree-research-c2ec6080/apps/web-ecommerce';

process.env.NODE_ENV = 'production';
process.env.NEXT_DIST_DIR = 'dist/.next-rec6060';

console.log('1. Building Next.js into dist/.next-rec6060...');
const nextBin = path.join(worktreeApp, 'node_modules/next/dist/bin/next');
const buildRes = spawnSync(process.execPath, [nextBin, 'build', '--no-lint'], {
  cwd: worktreeApp,
  env: { ...process.env, NEXT_DIST_DIR: 'dist/.next-rec6060', NODE_ENV: 'production' },
  stdio: 'inherit',
});

if (buildRes.status !== 0) {
  console.error('Next build failed with status', buildRes.status);
  process.exit(1);
}

console.log('2. Compiling server TypeScript into dist/.next-rec6060...');
const tscBin = path.join(worktreeApp, 'node_modules/typescript/bin/tsc');
const tscRes = spawnSync(process.execPath, [tscBin, '--project', 'tsconfig.server.json', '--outDir', 'dist/.next-rec6060'], {
  cwd: worktreeApp,
  env: { ...process.env, NEXT_DIST_DIR: 'dist/.next-rec6060', NODE_ENV: 'production' },
  stdio: 'inherit',
});

if (tscRes.status !== 0) {
  console.error('TSC failed with status', tscRes.status);
  process.exit(1);
}

console.log('Build completed successfully!');

