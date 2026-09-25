import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// IN43: build, run the native project, then ALWAYS run the gate. Never part of `npm run verify`.
const windows = process.platform === 'win32';
const build = spawnSync(windows ? 'npm.cmd' : 'npm', ['run', 'build'], { stdio: 'inherit', shell: windows });
if (build.status !== 0) process.exit(build.status ?? 1);
await mkdir('reports/native', { recursive: true });
const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const run = spawnSync(process.execPath, [vitest, 'run', '--config', 'tests/e2e/vitest.config.mts'], { stdio: 'inherit' });
try {
  await import('./check-native-results.mjs');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
if (run.status !== 0) process.exitCode = run.status ?? 1;
