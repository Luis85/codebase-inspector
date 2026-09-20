import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * The browser harness: the real view, the real stylesheet and Obsidian's own app.css,
 * in a browser, with no Obsidian. `npm run harness` starts it and prints the URL.
 *
 * What it is NOT: a test. Nothing here asserts what gets drawn, there is no baseline
 * to diff against, and it is deliberately outside `npm run verify`. The check that
 * keeps it alive is `tests/harness/harness.test.ts`, which vitest already runs.
 *
 * It changes nothing about what `npm run build` emits. `vite.config.ts` is untouched
 * and `dist/` must be byte-identical across the whole of wave 0.
 */
const obsidianMock = fileURLToPath(new URL('./tests/mocks/obsidian.ts', import.meta.url));
const pluginStylesheet = fileURLToPath(new URL('./src/ui/styles.css', import.meta.url));

/** Answers the page's `/styles.css` from src/ui/styles.css ON DISK, so what is on
 *  screen is the CSS being edited and never a stale build. */
function pluginStyles() {
  return {
    name: 'ci-plugin-styles',
    configureServer(server) {
      server.middlewares.use('/styles.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css');
        res.end(readFileSync(pluginStylesheet, 'utf8'));
      });
      server.watcher.add(pluginStylesheet);
    },
  };
}

export default defineConfig({
  root: 'tests/harness',
  // The same alias vitest uses. `tests/mocks/obsidian.ts` is the ONE stand-in; a
  // second one here would be a second answer that can disagree with the suite's.
  resolve: { alias: { obsidian: obsidianMock } },
  server: {
    // mount.ts, the fixtures and src/ are all outside `root`.
    fs: { allow: ['..', '../..'] },
  },
  plugins: [vue(), pluginStyles()],
});
