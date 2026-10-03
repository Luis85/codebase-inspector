import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { awaitQuietMachine, sampleCpuPercent } from './native-load-gate.mjs';

// IN43: build, run the native project, then ALWAYS run the gate. Never part of `npm run verify`.
// GRD1/GRD4: every run owns a directory (evidence, breadcrumbs, Node reports) and starts only on a quiet machine.
// On Windows npm is a .cmd, which Node 24 spawns only through a shell; one command string (no args array)
// keeps that free of DEP0190's unescaped-arguments warning.
const runDir = path.resolve('reports/native/runs', `${new Date().toISOString().replace(/[:.]/gu, '-')}-${process.env.OBSIDIAN_VERSION ?? 'baseline'}`);
await mkdir(runDir, { recursive: true });
// Node does not create --report-directory (tests/e2e/vitest.config.mts); without it a fatal report is silently lost.
await mkdir(path.join(runDir, 'node-reports'), { recursive: true });
process.env.NATIVE_RUN_DIR = runDir;
const THRESHOLD = 50;
const gate = await awaitQuietMachine({
  sample: async () => {
    const load = await sampleCpuPercent(10_000);
    console.log(`Native load gate: machine at ${load}% CPU (threshold ${THRESHOLD}%).`);
    return load;
  },
  threshold: THRESHOLD, maxWaitMs: 15 * 60_000, pollMs: 30_000,
});
await writeFile(path.join(runDir, 'load-gate.json'), `${JSON.stringify({ load: gate.load, waitedMs: gate.waitedMs, ok: gate.ok }, null, 2)}\n`);
if (!gate.ok) {
  console.error(`Native run refused: the machine stayed at ${gate.load}% CPU (threshold ${THRESHOLD}%) for 15 minutes.`);
  process.exit(3);
}
const build = process.platform === 'win32'
  ? spawnSync('npm run build', { stdio: 'inherit', shell: true })
  : spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
await mkdir('reports/native', { recursive: true });
// A run that crashes before writing its report must never be verified against an older one.
await rm('reports/native/vitest-results.json', { force: true });
const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const run = spawnSync(process.execPath, [vitest, 'run', '--config', 'tests/e2e/vitest.config.mts'], { stdio: 'inherit' });
// The run directory keeps its own copy of the reports; the gate below still reads the top-level one.
for (const report of ['vitest-results.json', 'junit.xml']) {
  await copyFile(path.join('reports/native', report), path.join(runDir, report)).catch(() => undefined);
}
try {
  await import('./check-native-results.mjs');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
if (run.status !== 0) process.exitCode = run.status ?? 1;
