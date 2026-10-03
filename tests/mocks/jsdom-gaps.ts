// jsdom gaps that real Obsidian does not have. Split out of tests/mocks/obsidian.ts,
// which sits at the tests/** 450-line budget: these installers are environment
// stand-ins (matchMedia, getBoundingClientRect, canvas contexts), not
// emulations of Obsidian's own API, so they are the coherent half to move. Installed for
// EVERY jsdom test file by vitest.config.ts's jsdom-project `setupFiles`; never imported
// by obsidian.ts, which the browser harness also loads (see that file's header).

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
// in city-view-store-wiring.test.ts).
//
// Phase 2 fix wave, M11 (PREREQUISITE for the 320 px responsive work): the flat
// 1000x700 default was UNCONDITIONAL, so a rect set on an ANCESTOR -- which is the
// only rect a test can set BEFORE Vue creates the descendant that gets measured --
// reached nothing. `makeLeafDouble(200)` (which sets contentEl's own rect, via
// tests/mocks/obsidian.ts's View constructor) therefore MEANT "narrow" and MEASURED
// 1000 px at the stage, and `App.vue`'s `narrowDrawer` was false in every test that
// did not reach inside the component tree afterwards. A future test written as
// `makeLeafDouble(200)` would have passed for the wrong reason.
//
// So the default now INHERITS: an element with no rect of its own reports the rect
// of its nearest ancestor that has one (a plain own-property assignment, which is
// what every test in this tree already uses and which shadows this prototype method
// for that element regardless), falling back to 1000x700 when no ancestor has one.
// That is layout-inaccurate in general and deliberately so: it makes "this leaf is
// 200 px wide" expressible from outside the component tree, which is exactly the
// thing spec 5.2's floor and drawer thresholds are measured against. It changes
// nothing for the existing suite, where every host test's contentEl already carries
// the 1000x700 default and every component test overrides the measured element
// itself.
const DEFAULT_RECT_WIDTH = 1000;
const DEFAULT_RECT_HEIGHT = 700;

function rectOf(width: number, height: number): DOMRect {
  return { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) };
}

function installBoundingRectDefault(): void {
  if (typeof Element === 'undefined') return;
  const proto = Element.prototype as unknown as { ciRectStub?: boolean };
  if (proto.ciRectStub) return;
  // Fix round 3, item 4 (fold): non-enumerable, unlike a plain assignment --
  // this guard flag must not show up in a `for...in` over any element.
  Object.defineProperty(proto, 'ciRectStub', { value: true, enumerable: false });
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    // The WP-02 shell nav has no layout in jsdom; App-mounting WP-01 tests must see the
    // city at full leaf width, as before (container-box.ts `cityInlineSize` subtracts it).
    if (this.classList.contains('ci-shell__nav')) return rectOf(0, 0);
    for (let el: Element | null = this.parentElement; el; el = el.parentElement) {
      if (Object.prototype.hasOwnProperty.call(el, 'getBoundingClientRect')) return el.getBoundingClientRect();
    }
    return rectOf(DEFAULT_RECT_WIDTH, DEFAULT_RECT_HEIGHT);
  };
}
installBoundingRectDefault();

// Checkpoint #3 defect 1: the SAME gap, one layer down. jsdom computes no layout, so
// `clientWidth`/`clientHeight` are hard 0 on every element -- which, now that
// `CityViewport.applySize()` measures the CONTENT box (the border box is what caused the
// unbounded canvas growth; see the component's own comment), would make every element in
// the suite look like a hidden, 0x0 leaf.
//
// The stand-in defers to the rect stub above, which is what every test in this tree
// already sets. That is exact rather than approximate: jsdom applies no borders and no
// padding, so in this environment the border box and the content box genuinely ARE the
// same rectangle. A test that needs them to DIFFER -- which is the only way the defect is
// expressible under Node -- defines its own `clientWidth`/`clientHeight` on the element,
// and that own property shadows this prototype accessor exactly as an own
// `getBoundingClientRect` shadows the one above. `Math.floor` because the real properties
// are integers while a rect is fractional.
function installClientBoxDefault(): void {
  if (typeof Element === 'undefined') return;
  const proto = Element.prototype as unknown as { ciClientBoxStub?: boolean };
  if (proto.ciClientBoxStub) return;
  Object.defineProperty(proto, 'ciClientBoxStub', { value: true, enumerable: false });
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get(this: Element): number { return Math.floor(this.getBoundingClientRect().width); },
  });
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get(this: Element): number { return Math.floor(this.getBoundingClientRect().height); },
  });
}
installClientBoxDefault();

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
