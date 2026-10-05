// WP-02 regression guard: importing the 'obsidian' stand-in must patch no browser API.
//
// vite.harness.config.ts aliases 'obsidian' to tests/mocks/obsidian.ts in a REAL browser
// (headless Chromium, `npm run harness-shot`). That module used to side-effect-import
// tests/mocks/jsdom-gaps.ts, harmless while nothing on the harness page imported
// 'obsidian' -- until WP-02's kit/Icon.vue imported `setIcon`. From then on the harness
// page ran the jsdom stand-ins against a real browser: `getContext('webgl2')` returned
// null, so CityViewport never got a renderer, and every rect read 1000x700. Every city
// shot timed out in mount.ts's `waitUntilDrawn`. The jsdom gaps now come from the jsdom
// vitest project's `setupFiles`; this pins that the mock itself stays inert.
//
// Node environment on purpose: the globals below are the only "browser" in scope, so
// anything the import writes onto them is visible here, and nothing else can have
// patched them first.
import { afterEach, describe, expect, it, vi } from 'vitest';

class FakeElement { getBoundingClientRect(): string { return 'real-rect'; } }
class FakeCanvas extends FakeElement { getContext(kind: string): string { return `real-${kind}`; } }
class FakeResizeObserver { disconnect(): void {} }
const realMatchMedia = (): string => 'real-matchMedia';

afterEach(() => { vi.unstubAllGlobals(); });

describe('the obsidian mock in a real browser', () => {
  it('leaves canvas, layout and media-query APIs untouched when imported', async () => {
    const fakeWindow = { matchMedia: realMatchMedia, ResizeObserver: FakeResizeObserver };
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('Element', FakeElement);
    vi.stubGlobal('HTMLCanvasElement', FakeCanvas);
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const elementProps = Object.getOwnPropertyNames(FakeElement.prototype).sort();
    const canvasProps = Object.getOwnPropertyNames(FakeCanvas.prototype).sort();

    vi.resetModules();
    await import('../mocks/obsidian');

    const canvas = new FakeCanvas();
    expect(canvas.getContext('webgl2')).toBe('real-webgl2');
    expect(canvas.getBoundingClientRect()).toBe('real-rect');
    expect(Object.getOwnPropertyNames(FakeElement.prototype).sort()).toEqual(elementProps);
    expect(Object.getOwnPropertyNames(FakeCanvas.prototype).sort()).toEqual(canvasProps);
    expect(fakeWindow.matchMedia).toBe(realMatchMedia);
    expect(fakeWindow.ResizeObserver).toBe(FakeResizeObserver);
  });
});
