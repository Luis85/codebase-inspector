// Minimal runtime stand-in for the 'obsidian' package, used ONLY by vitest (see the
// `resolve.alias` in vitest.config.ts). 'obsidian' ships types only — its package.json
// declares `"main": ""` because the real Obsidian app injects the runtime module when
// a plugin loads; there is nothing to `require('obsidian')` under plain Node/jsdom.
// Production code is unaffected: vite.config.ts externalises 'obsidian' untouched, so
// dist/main.js still does `require('obsidian')` against the real host at install time.
// Type-checking is also unaffected: tsc/vue-tsc resolve 'obsidian' via normal Node
// module resolution against the real, types-only package — never this file.
//
// This provides just enough of Plugin/ItemView, plus the DOM prototype extensions the
// real Obsidian app installs at startup (getCssPropertyValue, win, doc, instanceOf),
// for host tests to construct real CodebaseInspectorPlugin/CityView instances and
// exercise real behaviour.

// Ruling M17 (task-5-context.md section 5): node-access.ts reads `Platform.isDesktopApp`
// at MODULE LOAD to decide whether to touch `window.require` at all. Under Vitest's
// 'node' environment there is no `window`, so this must default to `false` — the
// ternary then short-circuits, `window` is never touched, and importing node-access.ts
// (transitively, via node-source-filesystem.ts) cannot crash. A plain mutable object
// (not a getter/const primitive) so a test that specifically wants the `true` branch can
// set `Platform.isDesktopApp = true` before a `vi.resetModules()` + dynamic import of
// node-access.ts (whose `fs`/`fsPromises`/`nodePath` are computed once, at import time).
export const Platform = { isDesktopApp: false };

export class Plugin {
  app: unknown;
  manifest: unknown;

  constructor(app: unknown, manifest: unknown) {
    this.app = app;
    this.manifest = manifest;
  }

  registerView(_type: string, _factory: (leaf: unknown) => unknown): void {}

  addRibbonIcon(_icon: string, _title: string, _cb: (evt: MouseEvent) => unknown): HTMLElement {
    return document.createElement('div');
  }

  addCommand(command: unknown): unknown {
    return command;
  }

  onUserEnable(): void {}
}

interface LeafDouble {
  width?: number;
  height?: number;
}

export abstract class ItemView {
  leaf: unknown;
  containerEl: HTMLElement;
  contentEl: HTMLElement;
  icon = 'dice';
  navigation = true;
  scope = null;

  constructor(leaf: unknown) {
    this.leaf = leaf;
    const width = (leaf as LeafDouble | undefined)?.width ?? 1000;
    const height = (leaf as LeafDouble | undefined)?.height ?? 700;

    this.containerEl = document.createElement('div');
    this.containerEl.classList.add('workspace-leaf-content');
    const header = document.createElement('div');
    header.classList.add('view-header');
    this.contentEl = document.createElement('div');
    this.contentEl.classList.add('view-content');
    // Mirrors the real host: contentEl is containerEl.children[1] (header is [0]).
    // This is exactly why "mounts on contentEl, not containerEl.children[1]" is a
    // rule worth having — the index happens to work, but the name is the contract.
    this.containerEl.append(header, this.contentEl);

    const rect = {
      width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0,
      toJSON: () => ({}),
    };
    this.containerEl.getBoundingClientRect = () => rect;
    this.contentEl.getBoundingClientRect = () => rect;
  }

  abstract getViewType(): string;
  abstract getDisplayText(): string;
  getIcon(): string { return this.icon; }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
  getState(): Record<string, unknown> { return {}; }
  async setState(_state: unknown, _result: unknown): Promise<void> {}
  getEphemeralState(): Record<string, unknown> { return {}; }
  setEphemeralState(_state: unknown): void {}
  onResize(): void {}
  addAction(): HTMLElement { return document.createElement('div'); }
  onPaneMenu(): void {}
}

// --- Obsidian's global DOM prototype extensions -----------------------------------
// Real Obsidian patches these onto Element/HTMLElement at app startup, ambiently
// declared in obsidian.d.ts's own `declare global` block (active program-wide once any
// file imports real 'obsidian' — which src/main.ts and src/host/city-view.ts do). Only
// the members our code actually reads are provided here; guarded so importing this
// module under a DOM-less (`environment: 'node'`) test file is a safe no-op.
function installDomPolyfills(): void {
  if (typeof HTMLElement === 'undefined') return;
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  if (proto.getCssPropertyValue) return;

  // Single-window tests only (task 3 does not exercise pop-out migration): a plain
  // static reference to the one jsdom window/document is sufficient.
  proto.win = window;
  proto.doc = document;
  proto.getCssPropertyValue = function (this: HTMLElement, token: string): string {
    return this.win.getComputedStyle(this).getPropertyValue(token).trim();
  };
  proto.instanceOf = function (this: unknown, ctor: new () => unknown): boolean {
    return this instanceof ctor;
  };
  proto.onWindowMigrated = (): (() => void) => () => {};
}
installDomPolyfills();

// jsdom implements no ResizeObserver (a long-standing gap). CityView only needs one
// that never throws when constructed/observed/disconnected for these tests — the
// checkpoint's real live-drag-to-sidebar scenario runs inside actual Obsidian, which
// has a real one.
function installResizeObserverStub(): void {
  if (typeof window === 'undefined') return;
  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver !== 'undefined') return;
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}
installResizeObserverStub();

// jsdom's HTMLCanvasElement has no 2D context (the optional `canvas` npm package is
// not installed), so getContext('2d') returns null with a noisy console warning.
// cssColorToSrgbBytes already handles a null context gracefully, but the warning would
// make `npm run verify`'s output non-pristine on every host test. This stub replaces
// getContext entirely with a trivial fake that always resolves to a fixed neutral
// colour — city-view.test.ts never asserts on resolved palette VALUES (that is
// tests/unit/color.test.ts's job, which supplies its own fakeWin and never touches a
// real HTMLCanvasElement), so a fixed, silent stand-in is sufficient here.
function installCanvasStub(): void {
  if (typeof HTMLCanvasElement === 'undefined') return;
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  if (proto.ciCanvasStub) return;
  proto.ciCanvasStub = true;
  proto.getContext = function (kind: string): unknown {
    if (kind !== '2d') return null;
    return {
      fillStyle: '#000000',
      clearRect(): void {},
      fillRect(): void {},
      getImageData: () => ({ data: new Uint8ClampedArray([128, 128, 128, 255]) }),
    };
  };
}
installCanvasStub();
