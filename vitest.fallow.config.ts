// Part 7 Z40: the opt-in real-fallow suite ONLY. `npm run test` never collects
// tests/fallow-real/ (vitest.config.ts's includes do not match it), and this config has
// no globalSetup, so it never builds dist/. See scripts/fetch-fallow.mjs.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const obsidianMock = fileURLToPath(new URL('./tests/mocks/obsidian.ts', import.meta.url));

export default defineConfig({
  resolve: { alias: { obsidian: obsidianMock } },
  test: { name: 'fallow-real', environment: 'node', include: ['tests/fallow-real/**/*.test.ts'], testTimeout: 60_000 },
});
