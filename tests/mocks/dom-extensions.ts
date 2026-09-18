// Split out of obsidian.ts, task 11 fix round 1, item 0 (it was at the tests/**
// 450-line cap). Real Obsidian patches these onto Element/HTMLElement at app
// startup, ambiently declared in obsidian.d.ts's own `declare global` block
// (active program-wide once any file imports real 'obsidian' — which
// src/main.ts and src/host/city-view.ts do). Only the members our code actually
// reads are provided here; guarded so importing this module under a DOM-less
// (`environment: 'node'`) test file is a safe no-op.
//
// createEl/createDiv/createSpan/empty (obsidian.d.ts's `Node`/`HTMLElement` global
// augmentation). obsidianmd/prefer-create-el requires plugin source to use these
// instead of document.createElement, so any DOM-building code under test needs a
// real implementation here, not a stub. Module-scoped (not a closure inside
// `installObsidianDomExtensions`): it captures nothing from that function.
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

// Task 11: backs the real per-element `onWindowMigrated` registry below. Exported so
// tests/mocks/window-harness.ts can fire registered callbacks after a genuine
// cross-realm adoptNode (see that file). A WeakMap, not an element property --
// `onWindowMigrated` is Obsidian's own ambient extension, not a field a real
// HTMLElement has.
export const migrationCallbacks = new WeakMap<HTMLElement, Set<() => void>>();
// Per-element `win`/`doc` overrides (the setters below) -- existing tests assign
// `el.win = fakeWin` directly; this keeps that working alongside the getters' new,
// ownerDocument-based default.
const winOverrides = new WeakMap<HTMLElement, Window>();
const docOverrides = new WeakMap<HTMLElement, Document>();

/** Task 11: parameterised over `win` so a separate realm (window-harness.ts's
 *  `createPopoutWindow`, a second real `jsdom` instance) can install the SAME
 *  extensions onto its OWN, otherwise-untouched `HTMLElement.prototype`. */
export function installObsidianDomExtensions(win: Window): void {
  const htmlElementCtor = (win as unknown as { HTMLElement?: typeof HTMLElement }).HTMLElement;
  if (!htmlElementCtor) return;
  const proto = htmlElementCtor.prototype as unknown as Record<string, unknown>;
  if (proto.getCssPropertyValue) return;

  // Task 11 (task-11-context.md section 5): real Obsidian's `win`/`doc` are resolved
  // PER ELEMENT from its current `ownerDocument`, not a fixed value captured once --
  // exactly what makes them correct after a cross-window migration for free (the
  // element's `ownerDocument` changes; nothing needs to update these by hand). The
  // fixed static assignment this replaced could never distinguish "the main window"
  // from "a popped-out one" -- the untestable gap section 5 names. An explicit
  // per-element override (many existing tests do `el.win = fakeWin` directly) still
  // wins, via the setter below -- this is additive, not a breaking change to that
  // long-standing pattern.
  Object.defineProperty(proto, 'win', {
    configurable: true,
    get(this: HTMLElement): Window { return winOverrides.get(this) ?? (this.ownerDocument?.defaultView ?? win); },
    set(this: HTMLElement, value: Window) { winOverrides.set(this, value); },
  });
  Object.defineProperty(proto, 'doc', {
    configurable: true,
    get(this: HTMLElement): Document { return docOverrides.get(this) ?? (this.ownerDocument ?? win.document); },
    set(this: HTMLElement, value: Document) { docOverrides.set(this, value); },
  });

  // Spec 4.4's cross-window globals (obsidian.d.ts:262,267) -- only the OUTER
  // installation owns these; a popout is never "active" by default.
  if (win === window) {
    const globals = globalThis as unknown as Record<string, unknown>;
    globals.activeWindow = window;
    globals.activeDocument = document;
  }

  proto.getCssPropertyValue = function (this: HTMLElement, token: string): string {
    return this.win.getComputedStyle(this).getPropertyValue(token).trim();
  };
  // Task 11: a real cross-realm fallback, not a bare `instanceof` (spec 4.4's own
  // bug) -- checked first for same-window, falling back to `this`'s own window's
  // equivalent constructor only for a genuinely different realm.
  proto.instanceOf = function (this: unknown, ctor: new (...args: never[]) => unknown): boolean {
    if (this instanceof ctor) return true;
    const owner = (this as { ownerDocument?: Document }).ownerDocument;
    const localCtor = (owner?.defaultView as unknown as Record<string, unknown> | undefined)?.[ctor.name];
    return typeof localCtor === 'function' && this instanceof (localCtor as new (...args: never[]) => unknown);
  };
  proto.onWindowMigrated = function (this: HTMLElement, cb: () => void): () => void {
    let set = migrationCallbacks.get(this);
    if (!set) { set = new Set(); migrationCallbacks.set(this, set); }
    const registered = set;
    registered.add(cb);
    return () => { registered.delete(cb); };
  };

  proto.createEl = function (
    this: HTMLElement, tag: string, info?: DomInfo | string, callback?: (el: HTMLElement) => void,
  ): HTMLElement {
    const el = (this.ownerDocument ?? win.document).createElement(tag);
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
  // Obsidian's sanctioned alternative to assigning element.style directly (its own
  // no-static-styles-assignment rule points every caller here); task 10's label overlay
  // positions real DOM text over the canvas through it.
  proto.setCssStyles = function (this: HTMLElement, s: Partial<CSSStyleDeclaration>): void { Object.assign(this.style, s); };
  proto.setCssProps = function (this: HTMLElement, p: Record<string, string>): void {
    for (const [k, v] of Object.entries(p)) this.style.setProperty(k, v);
  };
}
if (typeof window !== 'undefined') installObsidianDomExtensions(window);
