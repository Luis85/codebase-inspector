// jsdom gaps that real Obsidian does not have. Split out of tests/mocks/obsidian.ts,
// which sits at the tests/** 450-line budget: these installers are environment
// stand-ins (matchMedia, getBoundingClientRect, canvas contexts), not
// emulations of Obsidian's own API, so they are the coherent half to move. Imported for
// its side effects by obsidian.ts, so every existing importer is unaffected.

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
