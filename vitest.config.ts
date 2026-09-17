import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  test: {
    // See tests/global-setup.ts: it builds dist/ once before any test file runs,
    // so tests/unit/install-script.test.ts (which copies dist/ without building it)
    // does not depend on running after tests/host/build-output.test.ts's own build.
    globalSetup: ['./tests/global-setup.ts'],
    projects: [
      { test: { name: 'node', environment: 'node',
                include: ['tests/{unit,contracts,integration,host,acceptance,benchmarks}/**/*.test.ts'] } },
      { plugins: [vue()],
        test: { name: 'jsdom', environment: 'jsdom',
                include: ['tests/component/**/*.test.ts'] } },
    ],
  },
});
