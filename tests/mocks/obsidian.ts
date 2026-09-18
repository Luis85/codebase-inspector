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
export const Platform = { isDesktopApp: false, isWin: false };

export class Plugin {
  app: unknown;
  manifest: unknown;
  // Faithful in-memory data.json double (ruling M24, task-6-context.md section 4):
  // loadData() returns null until the first saveData(), exactly like a fresh install
  // with no data.json yet, and saveData() actually round-trips through JSON
  // (JSON.parse(JSON.stringify(...))) rather than keeping a live object reference, so a
  // caller mutating its own copy after saving cannot silently corrupt the "persisted"
  // value — the same guarantee a real JSON file on disk gives for free.
  #data: unknown = null;

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

  addSettingTab(_tab: unknown): void {}

  onUserEnable(): void {}

  loadData(): Promise<unknown> {
    return Promise.resolve(this.#data === null ? null : JSON.parse(JSON.stringify(this.#data)));
  }

  saveData(data: unknown): Promise<void> {
    this.#data = JSON.parse(JSON.stringify(data));
    return Promise.resolve();
  }
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

// Task 6: PluginSettingTab. Deliberately minimal — this double does NOT attempt to
// interpret a SettingDefinitionItem[] tree into DOM the way real Obsidian's 1.13+
// declarative renderer does: that renderer ships no runtime anywhere in this dependency
// tree to fake faithfully against (see
// docs/superpowers/notes/2026-09-17-setting-definitions-verification.md, "What this
// means for task 6"). Tests call getSettingDefinitions() directly and invoke the
// returned definitions' own render/action/onDelete callbacks by hand — this class only
// needs to exist and hold app/plugin/containerEl for that to work.
export abstract class PluginSettingTab {
  app: unknown;
  plugin: unknown;
  containerEl: HTMLElement;

  constructor(app: unknown, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    // tests/host/plugin-onload.test.ts constructs a real CodebaseInspectorPlugin under
    // the 'node' vitest project (no `document`) to exercise onload() cheaply; this class
    // is not asked for any real DOM there (getSettingDefinitions() returns plain data),
    // so containerEl only needs to exist, not to be a real element, when there is no DOM.
    this.containerEl = typeof document === 'undefined' ? ({} as HTMLElement) : document.createElement('div');
  }

  getSettingDefinitions(): unknown[] { return []; }
  // A real no-op: this class does not attempt to fake Obsidian's declarative renderer
  // (see the file-level comment above this class), so there is no re-render for
  // update() to trigger here. Present only so production code calling it at runtime
  // (settings-tab.ts, after every mutation) does not throw under test.
  update(): void {}
  hide(): void {}
}

// The long-stable (since 0.9.7), well-documented imperative Setting API — unrelated to
// the 1.13+ declarative renderer above. A SettingDefinitionRender callback receives a
// real Setting instance (obsidian.d.ts:6284), so this is what our own render()
// functions build DOM through; faithfully reproducing this decade-old, simple API is
// low-risk, unlike the declarative renderer.
export class Setting {
  settingEl: HTMLElement;
  infoEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.settingEl = containerEl.createDiv({ cls: 'setting-item' });
    this.infoEl = this.settingEl.createDiv({ cls: 'setting-item-info' });
    this.nameEl = this.infoEl.createDiv({ cls: 'setting-item-name' });
    this.descEl = this.infoEl.createDiv({ cls: 'setting-item-description' });
    this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
  }

  setName(name: string): this { this.nameEl.textContent = name; return this; }
  setDesc(desc: string): this { this.descEl.textContent = desc; return this; }
  setClass(cls: string): this { this.settingEl.addClass(cls); return this; }

  addButton(cb: (component: ButtonComponent) => unknown): this {
    cb(new ButtonComponent(this.controlEl));
    return this;
  }
}

export class ButtonComponent {
  buttonEl: HTMLButtonElement;

  constructor(containerEl: HTMLElement) {
    this.buttonEl = containerEl.createEl('button', { attr: { type: 'button' } });
  }

  setButtonText(text: string): this { this.buttonEl.textContent = text; return this; }
  setCta(): this { this.buttonEl.addClass('mod-cta'); return this; }
  setWarning(): this { this.buttonEl.addClass('mod-warning'); return this; }
  setTooltip(tooltip: string): this { this.buttonEl.title = tooltip; return this; }
  setDisabled(disabled: boolean): this { this.buttonEl.disabled = disabled; return this; }
  onClick(callback: (evt: MouseEvent) => unknown): this {
    this.buttonEl.addEventListener('click', (evt) => { void callback(evt); });
    return this;
  }
}

// Task 7: the desktop DataAdapter, resolved behind an `instanceof FileSystemAdapter`
// check (obsidianmd/prefer-instanceof; spec 4.4) -- never a cast, because mobile
// supplies a CapacitorAdapter instead (below). A real, minimal double: the entire
// surface source-modal.ts depends on is `getBasePath()`.
export class FileSystemAdapter {
  constructor(private readonly basePath: string) {}
  getBasePath(): string { return this.basePath; }
}

// Task 7: mobile's adapter (spec 4.4). Deliberately NOT a subclass of
// FileSystemAdapter and deliberately without a getBasePath() that returns anything
// usable, so a test asserting the instanceof branch is SKIPPED for this adapter is a
// genuine negative case -- not one a permissive double would pass vacuously.
export class CapacitorAdapter {
  getBasePath(): never {
    throw new Error('CapacitorAdapter has no getBasePath — mobile has no filesystem root.');
  }
}

// Real Modal.open()/close() attach/detach the modal from the document and drive
// onOpen()/onClose() — the part this plugin's ClearBindingModal actually depends on.
export class Modal {
  app: unknown;
  containerEl: HTMLElement;
  modalEl: HTMLElement;
  titleEl: HTMLElement;
  contentEl: HTMLElement;
  shouldRestoreSelection = true;
  /** Fix round 2, Item 1: undocumented in obsidian.d.ts but REAL -- confirmed against
   *  the shipped 1.12.4 obsidian.asar's own `Modal.prototype.open`, which reads:
   *  `this.shouldRestoreSelection ? this.selection = <captured DOM selection
   *  descriptor> : this.selection = null` immediately before calling `this.onOpen()`.
   *  A Modal subclass with its OWN field also named `selection` (scope-modal.ts had
   *  exactly this) has that field silently overwritten before its own onOpen() ever
   *  runs -- this is what crashed checkpoint #2's very first real scan
   *  ("Cannot read properties of undefined (reading 'profileId')"). Modelling it here
   *  is what makes the hazard reproducible under test at all: without this line, no
   *  test at any level could have caught the real crash, because nothing in this file
   *  previously touched `this.selection`. */
  selection: unknown = null;

  constructor(app: unknown) {
    this.app = app;
    this.containerEl = document.createElement('div');
    this.containerEl.classList.add('modal-container');
    this.modalEl = this.containerEl.createDiv({ cls: 'modal' });
    this.titleEl = this.modalEl.createDiv({ cls: 'modal-title' });
    this.contentEl = this.modalEl.createDiv({ cls: 'modal-content' });
  }

  open(): void {
    document.body.appendChild(this.containerEl);
    // Mirrors the real Modal.prototype.open() exactly: (re-)assigned immediately
    // before onOpen(), never after.
    this.selection = this.shouldRestoreSelection ? { win: null, range: null, focusEl: null } : null;
    void this.onOpen();
  }

  close(): void {
    this.containerEl.remove();
    this.onClose();
  }

  onOpen(): void | Promise<void> {}
  onClose(): void {}
  setTitle(title: string): this { this.titleEl.textContent = title; return this; }
  setContent(content: string): this { this.contentEl.textContent = content; return this; }
}

// Fix round 1, Important 2: settings-tab.ts's reconnect() shows a real Notice instead
// of doing nothing at all. Real Notice appends a `.notice` element to the document
// (inside a notice container) and auto-dismisses after `duration`; this double skips
// the auto-dismiss timer (tests assert presence right after the click, never a delay)
// but genuinely appends real, queryable DOM with the message text, which is the one
// thing a test here needs to tell "a notice appeared" from "nothing happened".
export class Notice {
  containerEl: HTMLElement;
  messageEl: HTMLElement;
  noticeEl: HTMLElement;

  constructor(message: string, _duration?: number) {
    this.containerEl = document.body.createDiv({ cls: 'notice-container' });
    this.messageEl = this.containerEl.createDiv({ cls: 'notice' });
    this.noticeEl = this.messageEl;
    this.messageEl.textContent = message;
  }

  setMessage(message: string): this { this.messageEl.textContent = message; return this; }
  hide(): void { this.containerEl.remove(); }
}

// createEl/createDiv/createSpan/empty (obsidian.d.ts's `Node`/`HTMLElement` global
// augmentation). obsidianmd/prefer-create-el requires plugin source to use these
// instead of document.createElement, so any DOM-building code under test needs a real
// implementation here, not a stub — task 6 is the first task with DOM-building
// settings-tab/modal code, hence the first to need it. Module-scoped (not a closure
// inside installDomPolyfills): it captures nothing from that function.
interface DomInfo {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, string | number | boolean | null>;
  title?: string;
}
function applyDomInfo(el: HTMLElement, info?: DomInfo | string): void {
  if (info === undefined) return;
  if (typeof info === 'string') { el.textContent = info; return; }
  if (info.cls) el.className = Array.isArray(info.cls) ? info.cls.join(' ') : info.cls;
  if (info.text !== undefined) el.textContent = info.text;
  if (info.title !== undefined) el.title = info.title;
  if (info.attr) {
    for (const [key, value] of Object.entries(info.attr)) {
      if (value !== null) el.setAttribute(key, String(value));
    }
  }
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

  // Spec 4.4's cross-window globals, which real Obsidian declares ambiently
  // (obsidian.d.ts:262,267) and points at the popped-out window whenever one is focused.
  // This double is still single-window, so they point at the one jsdom window -- enough
  // for a test to substitute a stand-in and prove production code READS the cross-window
  // global rather than a bare `document` (fix wave item 5, I4). A real cross-window
  // harness belongs to task 11, which owns pop-out migration.
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.activeWindow = window;
  globals.activeDocument = document;

  proto.getCssPropertyValue = function (this: HTMLElement, token: string): string {
    return this.win.getComputedStyle(this).getPropertyValue(token).trim();
  };
  proto.instanceOf = function (this: unknown, ctor: new () => unknown): boolean {
    return this instanceof ctor;
  };
  proto.onWindowMigrated = (): (() => void) => () => {};

  proto.createEl = function (
    this: HTMLElement, tag: string, info?: DomInfo | string, callback?: (el: HTMLElement) => void,
  ): HTMLElement {
    const el = document.createElement(tag);
    applyDomInfo(el, info);
    this.appendChild(el);
    callback?.(el);
    return el;
  };
  proto.createDiv = function (this: HTMLElement, info?: DomInfo | string, callback?: (el: HTMLDivElement) => void): HTMLDivElement {
    return this.createEl('div', info, callback);
  };
  proto.createSpan = function (this: HTMLElement, info?: DomInfo | string, callback?: (el: HTMLSpanElement) => void): HTMLSpanElement {
    return this.createEl('span', info, callback);
  };
  proto.empty = function (this: HTMLElement): void {
    while (this.firstChild) this.removeChild(this.firstChild);
  };
  proto.addClass = function (this: HTMLElement, ...classes: string[]): void {
    this.classList.add(...classes);
  };
}
installDomPolyfills();

/** Test-only: points the cross-window `activeDocument` global at a stand-in and returns
 *  the undo. Lives in this file, not in the test that uses it, because this is where
 *  Obsidian's own ambient cross-window globals are installed — and because writing
 *  through `globalThis` belongs in the one file whose `no-global-this` scoping already
 *  says so, rather than assigning a read-only global directly from a test. */
export function setActiveDocument(doc: Document): () => void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = globals.activeDocument;
  globals.activeDocument = doc;
  return () => { globals.activeDocument = previous; };
}

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

// jsdom implements no `window.matchMedia` either (same gap class as above; fix
// round 2/M68 makes `applyMotionPreference` run on every real mount now). Fixed, silent, non-reduced.
function installMatchMediaStub(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'undefined') return;
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  });
}
installMatchMediaStub();

// jsdom does no real layout: every element's `getBoundingClientRect()` returns all
// zeros by default (a third instance of the same gap). Fix round 2/M68: CityViewport
// measures its OWN nested stage element, not `contentEl` (stubbed per-instance
// above, no longer reached) -- a generous 1000x700 default avoids racing a POST-HOC
// per-element override against construction's own microtask timing (hit empirically
// in city-view-store-wiring.test.ts). A narrow-stage test uses `vi.spyOn` instead.
function installBoundingRectDefault(): void {
  if (typeof Element === 'undefined') return;
  const proto = Element.prototype as unknown as { ciRectStub?: boolean };
  if (proto.ciRectStub) return;
  // Fix round 3, item 4 (fold): non-enumerable, unlike a plain assignment --
  // this guard flag must not show up in a `for...in` over any element.
  Object.defineProperty(proto, 'ciRectStub', { value: true, enumerable: false });
  Element.prototype.getBoundingClientRect = () => ({ width: 1000, height: 700, top: 0, left: 0, right: 1000, bottom: 700, x: 0, y: 0, toJSON: () => ({}) });
}
installBoundingRectDefault();

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
