import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

// 'obsidian' ships types only (package.json's "main" is "" — the real Obsidian app
// injects the runtime when a plugin loads; there is nothing to require() under plain
// Node/jsdom). This alias substitutes a small hand-written stand-in — see
// tests/mocks/obsidian.ts — so host tests can construct real Plugin/ItemView
// subclasses. It exists ONLY for vitest: vite.config.ts (the production build) still
// externalises the real 'obsidian' import untouched, and tsc/vue-tsc type-check
// against the real, types-only package regardless of this alias.
const obsidianMock = fileURLToPath(new URL('./tests/mocks/obsidian.ts', import.meta.url));

// tests/host/** files that need a real DOM (mounting Vue, measuring contentEl, a
// real ItemView/CityView subtree) rather than the 'node' project's plain Node
// environment. city-view.test.ts and city-view-store-wiring.test.ts (task 9 fix
// round 1) started this list; task 11 adds three more for exactly the same reason —
// multi-leaf, window-migration and lifecycle-leaks all construct real CityView
// instances and measure/observe their DOM.
const JSDOM_HOST_TESTS = [
  'tests/host/city-view*.test.ts',
  'tests/host/multi-leaf.test.ts',
  'tests/host/window-migration.test.ts',
  'tests/host/lifecycle-leaks.test.ts',
];

export default defineConfig({
  test: {
    // See tests/global-setup.ts: it builds dist/ once before any test file runs,
    // so tests/unit/install-script.test.ts (which copies dist/ without building it)
    // does not depend on running after tests/host/build-output.test.ts's own build.
    globalSetup: ['./tests/global-setup.ts'],
    projects: [
      // vue() is needed here too (not just in the jsdom project below): main.ts ->
      // city-view.ts statically imports ui/App.vue, and tests/host/plugin-onload.test.ts
      // (node environment) transitively imports main.ts. The SFC transform itself
      // needs no DOM — only actually mounting the app does, which onload never does.
      { resolve: { alias: { obsidian: obsidianMock } },
        plugins: [vue()],
        test: { name: 'node', environment: 'node',
                include: ['tests/{unit,contracts,integration,host,acceptance,benchmarks}/**/*.test.ts'],
                exclude: JSDOM_HOST_TESTS } },
      { resolve: { alias: { obsidian: obsidianMock } },
        plugins: [vue()],
        test: { name: 'jsdom', environment: 'jsdom',
                include: ['tests/component/**/*.test.ts', ...JSDOM_HOST_TESTS] } },
    ],
  },
});
