import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';

// Both forms, so a transitive dependency referencing either is not bundled.
const nodeBuiltins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

const CODEMIRROR = ['@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands',
  '@codemirror/language', '@codemirror/lint', '@codemirror/search', '@codemirror/state',
  '@codemirror/text', '@codemirror/view'];
const LEZER = ['@lezer/common', '@lezer/highlight', '@lezer/lr'];

export default defineConfig({
  plugins: [vue()],
  // Guards the r186 CommonJS deprecation: never let the bundler resolve the `require`
  // condition, which would pull build/three.cjs — a process.emitWarning stub.
  resolve: { conditions: ['import', 'module', 'browser', 'default'] },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    target: 'es2020',              // known Electron host, not the open web
    emptyOutDir: true,             // safe: outDir is dist/
    cssCodeSplit: false,
    cssMinify: false,
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),   // never process.cwd()
    lib: {
      entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      formats: ['cjs'],            // Obsidian loads CommonJS only
    },
    rollupOptions: {
      external: ['obsidian', 'electron', ...CODEMIRROR, ...LEZER, ...nodeBuiltins],
      output: {
        exports: 'named',            // exports.default = Plugin with the __esModule marker
        codeSplitting: false,        // one installable file; chunks would require() files that never ship
                                      // (replaces the deprecated inlineDynamicImports on this Vite line)
        entryFileNames: 'main.js',
        assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'styles.css' : '[name][extname]'),
      },
    },
  },
});
