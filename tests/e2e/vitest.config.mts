import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Deliberately independent of the root jsdom/Obsidian-mock configuration.
export default defineConfig({
  test: {
    name: 'native-obsidian', environment: 'node', globals: false,
    include: ['tests/e2e/**/*.e2e.ts'],
    pool: 'forks', maxWorkers: 1, fileParallelism: false,
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
