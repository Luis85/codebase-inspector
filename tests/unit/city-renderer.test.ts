import { describe, expect, it, vi } from 'vitest';

// createCityRenderer's happy path needs a real WebGL2 context, which no environment
// available to this test suite provides (verified directly against jsdom while
// implementing task 3: constructing a real THREE.WebGLRenderer against a jsdom canvas
// throws synchronously — jsdom has no WebGL backend at all). Mocking only
// WebGLRenderer (everything else in 'three' — Scene, cameras, lights, InstancedMesh —
// is real, since none of it needs an actual GPU context) is what lets this test reach
// the REAL (non-inert) port object, which is what fix 2 (task-3-report.md, review
// round 1, finding 2) needs covered: debugLoseContext() must never throw, including
// when the underlying context is already gone.
class FakeWebGLRenderer {
  info = { memory: { geometries: 0, textures: 0 }, programs: [], render: { calls: 0 } };
  setClearColor = vi.fn();
  setPixelRatio = vi.fn();
  setSize = vi.fn();
  render = vi.fn();
  dispose = vi.fn();
  forceContextLoss = vi.fn();
  getContext = vi.fn(() => {
    throw new Error('context is gone');
  });
}

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

// Task 10 expanded what construction actually touches, so these doubles grew with it —
// every `it` body below is unchanged. The renderer now (a) pre-checks WebGL2 with
// getContext('webgl2') before constructing THREE.WebGLRenderer, so that a platform
// without it reports `unavailable{unsupported}` instead of the `initialization-failed`
// task 3 reported for every failure alike, and (b) appends a DOM label overlay beside
// the canvas, built with the mount element's own createDiv.
function fakeElement(): HTMLCanvasElement {
  return {
    style: {},
    className: '',
    hidden: false,
    setAttribute: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    appendChild: vi.fn(),
    remove: vi.fn(),
    // Obsidian's own ambient HTMLElement extensions, which the real app installs long
    // before a plugin loads: the renderer styles its canvas through setCssStyles (its
    // own no-static-styles-assignment rule) and the label overlay builds its DOM with
    // createDiv, in the mount element's own document.
    setCssStyles: vi.fn(),
    createDiv: vi.fn(() => fakeElement()),
    getContext: vi.fn(() => ({ getExtension: () => null })),
  } as unknown as HTMLCanvasElement;
}

function fakeWin(): Window {
  return {
    document: {
      createElement: vi.fn(() => fakeElement()),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      hidden: false,
    },
    requestAnimationFrame: vi.fn(() => 1),
    cancelAnimationFrame: vi.fn(),
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    localStorage: { getItem: vi.fn(() => null) },
  } as unknown as Window;
}

describe('createCityRenderer', () => {
  it('reaches the real (non-inert) port when WebGL construction succeeds', async () => {
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const onEvent = vi.fn();
    const mountEl = fakeElement() as unknown as HTMLElement;
    createCityRenderer(mountEl, fakeWin(), onEvent);
    // The port never throws (spec 4.2): no unavailable event on a successful build.
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('debugLoseContext() never throws, even when the underlying context is already gone', async () => {
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const onEvent = vi.fn();
    const mountEl = fakeElement() as unknown as HTMLElement;
    const port = createCityRenderer(mountEl, fakeWin(), onEvent);

    // FakeWebGLRenderer.getContext() throws unconditionally (as it would for a
    // renderer whose context has already been lost or disposed) — this is exactly
    // review finding 2: debugLoseContext() called `.getContext().getExtension(...)`
    // with no guard.
    expect(() => { port.debugLoseContext(); }).not.toThrow();
  });

  it('dispose() never throws', async () => {
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const mountEl = fakeElement() as unknown as HTMLElement;
    const port = createCityRenderer(mountEl, fakeWin(), vi.fn());
    expect(() => { port.dispose(); }).not.toThrow();
  });
});
