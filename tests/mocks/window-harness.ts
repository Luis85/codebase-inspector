// Task 11 (task-11-context.md section 5): "cross-window behaviour is currently
// untestable, and this branch knows it... the codebase's stated position is that a
// real cross-window harness belongs to task 11." This is that harness.
//
// A genuinely separate realm -- not a second `document` off the SAME jsdom instance,
// which shares every constructor with the first and so could never make
// `instanceof` fail the way it really does across windows -- is built from a SECOND
// `jsdom` PACKAGE instance (`new JSDOM(...)`), a dependency already in package.json.
// Verified empirically before relying on it: two `JSDOM` instances have DIFFERENT
// `HTMLElement` constructors, and `secondDoc.adoptNode(elementFromFirst)` genuinely
// works (real browsers support exactly this for a same-origin popup, which is why
// `instanceof` fails while DOM operations keep working -- the whole reason Obsidian
// ships `instanceOf`/`onWindowMigrated` at all).
import { JSDOM } from 'jsdom';
import { installObsidianDomExtensions, migrationCallbacks } from './obsidian';

export interface PopoutWindow {
  win: Window;
  doc: Document;
  /** Fires every ResizeObserver constructed against THIS window's own stub. */
  triggerResize(): void;
  destroy(): void;
}

// Fix round 1, Minor 9: `pretendToBeVisual: true` starts a real rAF loop in EVERY
// realm this creates, and before this only one call site in the whole suite ever
// called `destroy()` -- mildly ironic in a leak suite. Tracked here so a test file
// can close every popout it created in one `afterEach`, without each one having to
// remember its own handle.
const liveWindows = new Set<PopoutWindow>();

/** Closes every `PopoutWindow` created (via this module) and not yet destroyed.
 *  Call from an `afterEach` in any file using `createPopoutWindow`. */
export function destroyAllPopoutWindows(): void {
  for (const popout of liveWindows) popout.destroy();
}

/** A real, separate DOM realm standing in for a popped-out Obsidian window. Host
 *  tests mock out `createCityRenderer` (as every city-view*.test.ts already does),
 *  so this needs no WebGL/canvas polyfill -- only what `CityViewport`'s OWN real Vue
 *  code touches directly: `matchMedia` (jsdom implements neither instance) and a
 *  controllable `ResizeObserver` (same gap tests/mocks/obsidian.ts's own stub fills
 *  for the OUTER window). */
export function createPopoutWindow(): PopoutWindow {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const win = dom.window;
  (win as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  });
  const callbacks: (() => void)[] = [];
  class PopoutResizeObserver {
    constructor(cb: () => void) { callbacks.push(cb); }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (win as unknown as { ResizeObserver: unknown }).ResizeObserver = PopoutResizeObserver;
  // The SAME ambient extensions the outer window gets, installed onto THIS realm's
  // own (fresh, unrelated) HTMLElement.prototype -- see installObsidianDomExtensions'
  // own comment for why a second `jsdom` package instance is what makes this matter.
  installObsidianDomExtensions(win);
  const popout: PopoutWindow = {
    win,
    doc: win.document,
    triggerResize: () => { callbacks.forEach((cb) => { cb(); }); },
    destroy: () => { liveWindows.delete(popout); dom.window.close(); },
  };
  liveWindows.add(popout);
  return popout;
}

function fireOne(el: HTMLElement): void {
  migrationCallbacks.get(el)?.forEach((cb) => { cb(); });
  for (const child of Array.from(el.children)) fireOne(child as HTMLElement);
}

/** Fires every `onWindowMigrated` callback registered anywhere in `root`'s own
 *  subtree (`root` included) -- mirrors real Obsidian firing per-element for
 *  whichever elements in a moved subtree actually registered one, never just the
 *  root a caller happened to adopt. Backed by `obsidian.ts`'s own registry, since
 *  that is where `onWindowMigrated` itself registers callbacks. */
export function fireWindowMigrated(root: HTMLElement): void {
  fireOne(root);
}

/** Moves `el` (and, since `adoptNode` moves the whole subtree, everything inside it
 *  -- the entire rendered Vue tree) into `target`'s document, exactly as a real
 *  cross-window drag does: the SAME live nodes, reparented, never rebuilt. Fires
 *  every `onWindowMigrated` callback registered anywhere in the moved subtree
 *  afterwards, once the nodes' `ownerDocument` (and therefore their `.win`/`.doc`,
 *  tests/mocks/obsidian.ts's own getters) already resolve to `target`. */
export function migrateElement(el: HTMLElement, target: PopoutWindow): void {
  const adopted = target.doc.adoptNode(el);
  target.doc.body.appendChild(adopted);
  fireWindowMigrated(adopted);
}

/** jsdom has no real ResizeObserver and tests/mocks/obsidian.ts installs a no-op
 *  stub, so any 320px-floor or resize-driven round trip is unreachable without one a
 *  test can fire. Promoted here (task-11-context.md section 5) from
 *  tests/host/city-view-store-wiring.test.ts, its original home, so a second file
 *  needing it does not copy it -- installed per test and restored, same as before. */
export function installControllableResizeObserver(): { trigger: () => void; restore: () => void } {
  const callbacks: (() => void)[] = [];
  const holder = window as unknown as { ResizeObserver: unknown };
  const previous = holder.ResizeObserver;
  holder.ResizeObserver = class {
    constructor(cb: () => void) { callbacks.push(cb); }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  return {
    trigger: () => { callbacks.forEach((cb) => { cb(); }); },
    restore: () => { holder.ResizeObserver = previous; },
  };
}
