import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Node does not create --report-directory, and a fatal report into a missing folder is silently lost.
const reportDirectory = path.join(process.env.NATIVE_RUN_DIR ?? path.resolve('reports/native'), 'node-reports');
mkdirSync(reportDirectory, { recursive: true });

// Deliberately independent of the root jsdom/Obsidian-mock configuration.
export default defineConfig({
  test: {
    name: 'native-obsidian', environment: 'node', globals: false,
    include: ['tests/e2e/**/*.e2e.ts'],
    pool: 'forks', maxWorkers: 1, fileParallelism: false,
    // GRD1: a worker that dies by an uncatchable fatal leaves a Node diagnostic report in the run's folder.
    execArgv: ['--report-on-fatalerror', '--report-uncaught-exception', `--report-directory=${reportDirectory}`],
    // GCO25: each worker evaluates this; it only acts when NATIVE_PROCDUMP is set.
    setupFiles: ['tests/e2e/procdump-setup.ts'],
    sequence: { concurrent: false }, isolate: true, retry: 0,
    testTimeout: 120_000, hookTimeout: 180_000,
    expect: { poll: { timeout: 10_000, interval: 100 } },
    reporters: ['default', 'json', 'junit'],
    outputFile: {
      json: path.resolve('reports/native/vitest-results.json'),
      junit: path.resolve('reports/native/junit.xml'),
    },
    coverage: { enabled: false },
    passWithNoTests: false,
  },
});
