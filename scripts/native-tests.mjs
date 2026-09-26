import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// IN43: build, run the native project, then ALWAYS run the gate. Never part of `npm run verify`.
// On Windows npm is a .cmd, which Node 24 spawns only through a shell; one command string (no args array)
// keeps that free of DEP0190's unescaped-arguments warning.
const build = process.platform === 'win32'
  ? spawnSync('npm run build', { stdio: 'inherit', shell: true })
  : spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
await mkdir('reports/native', { recursive: true });
// A run that crashes before writing its report must never be verified against an older one.
await rm('reports/native/vitest-results.json', { force: true });
const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const run = spawnSync(process.execPath, [vitest, 'run', '--config', 'tests/e2e/vitest.config.mts'], { stdio: 'inherit' });
try {
  await import('./check-native-results.mjs');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
if (run.status !== 0) process.exitCode = run.status ?? 1;
