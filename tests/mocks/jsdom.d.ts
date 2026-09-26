// Minimal ambient typing for the 'jsdom' package (already a devDependency, for
// vitest's own 'jsdom' test environment) — it ships no types of its own and no
// @types/jsdom is installed. Only the surface tests/mocks/window-harness.ts
// actually touches: constructing an instance and reading its `window`.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: { pretendToBeVisual?: boolean; url?: string });
    readonly window: Window & { close(): void };
  }
}
