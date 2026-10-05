import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * The browser harness: the real view, the plugin stylesheets ON DISK and Obsidian's own
 * app.css, in a browser, with no Obsidian. `npm run harness` starts it and prints the URL.
 *
 * What it is NOT: a test. Nothing here asserts what gets drawn, there is no baseline
 * to diff against, and it is deliberately outside `npm run verify`. The check that
 * keeps it alive is `tests/harness/harness.test.ts`, which vitest already runs.
 *
 * It changes nothing about what `npm run build` emits. `vite.config.ts` is untouched
 * and `dist/` must be byte-identical across the whole of wave 0.
 */
const obsidianMock = fileURLToPath(new URL('./tests/mocks/obsidian.ts', import.meta.url));
const pluginStylesheets = [
  'styles.css', 'styles/kit.css', 'styles/shell.css', 'styles/screens.css',
  'styles/screens-explore.css', 'styles/screens-audit.css', 'styles/screens-act.css', 'styles/screens-configure.css',
].map((f) => fileURLToPath(new URL(`./src/ui/${f}`, import.meta.url)));

/** Answers the page's `/styles.css` from src/ui/styles.css ON DISK, so what is on
 *  screen is the CSS being edited and never a stale build. */
function pluginStyles() {
  return {
    name: 'ci-plugin-styles',
    configureServer(server) {
      server.middlewares.use('/styles.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css');
        res.end(pluginStylesheets.filter((f) => existsSync(f)).map((f) => readFileSync(f, 'utf8')).join('\n'));
      });
      for (const f of pluginStylesheets) server.watcher.add(f);
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
