// scripts/pinia-saveas-pure.mjs is plain JS (no type-aware linting inside scripts/, like
// the other files here), but vite.config.ts and tests/build/pinia-saveas-pure.test.ts import
// it as a module. This sibling declaration gives that import a real type instead of an
// implicit `any`.
import type { Plugin } from 'vite';

/** Marks pinia's `saveAs` initialiser PURE so its dead FileSaver XHR island tree-shakes. */
export declare function piniaSaveAsPure(): Plugin;
