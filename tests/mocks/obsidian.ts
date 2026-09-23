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
//
// The jsdom GAPS real Obsidian does not have (matchMedia, getBoundingClientRect,
// canvas contexts) live in ./jsdom-gaps.ts, installed by vitest.config.ts's jsdom
// project `setupFiles` -- NOT imported here. vite.harness.config.ts aliases 'obsidian'
// to THIS file in a real browser too, and once WP-02's kit/Icon.vue imported `setIcon`
// the import used to run there, replacing working browser APIs (webgl2 context -> null,
// every rect -> 1000x700) so the harness city never drew. tests/unit/obsidian-mock-
// scope.test.ts pins that importing this module patches no DOM prototype.

// Ruling M17 (task-5-context.md section 5): node-access.ts reads `Platform.isDesktopApp`
// at MODULE LOAD to decide whether to touch `window.require` at all. Under Vitest's
// 'node' environment there is no `window`, so this must default to `false` — the
// ternary then short-circuits, `window` is never touched, and importing node-access.ts
// (transitively, via node-source-filesystem.ts) cannot crash. A plain mutable object
// (not a getter/const primitive) so a test that specifically wants the `true` branch can
// set `Platform.isDesktopApp = true` before a `vi.resetModules()` + dynamic import of
// node-access.ts (whose `fs`/`fsPromises`/`nodePath` are computed once, at import time).
export const Platform = { isDesktopApp: false, isWin: false, isMacOS: false };

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

// Obsidian's global DOM prototype extensions (getCssPropertyValue, win, doc,
// instanceOf, onWindowMigrated, createEl/createDiv/createSpan/empty/addClass/
// setCssStyles/setCssProps) split out to ./dom-extensions.ts, task 11 fix round 1,
// item 0 (this file was at the tests/** 450-line cap). Re-exported here so every
// existing `from './obsidian'` import keeps resolving; the side effect (installing
// onto the OUTER window) runs on that module's own first import, below.
export { installObsidianDomExtensions, migrationCallbacks } from './dom-extensions';

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

/** WP-02: the real setIcon injects a Lucide SVG. Tests and the harness only need to see
 *  which icon was asked for. */
export function setIcon(el: HTMLElement, iconId: string): void {
  el.dataset.icon = iconId;
}
