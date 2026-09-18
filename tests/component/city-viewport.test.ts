import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
// Side-effect import: installs the createEl prototype extension real Obsidian
// patches onto HTMLElement (tests/mocks/obsidian.ts), used below to build a canvas
// the same way the real, unmodified createCityRenderer does.
import '../mocks/obsidian';
import CityViewport from '../../src/ui/components/CityViewport.vue';
import type { CityRendererEvent, CreateCityRenderer } from '../../src/visualization/renderer-port';

function makeRendererDouble() {
  return {
    setLayout: vi.fn(async () => {}),
    setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setLabels: vi.fn(),
    setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn(() => ({ projection: 'orthographic' as const, mode: '3d' as const, position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number], zoom: 1 })),
    setCamera: vi.fn(), nudgeCamera: vi.fn(), focus: vi.fn(), fit: vi.fn(), resize: vi.fn(),
    pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({ geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false })),
    debugLoseContext: vi.fn(),
  };
}

/** A fake window whose ResizeObserver fires synchronously (once, on `observe`) and
 *  whose matchMedia is a spy-able double distinct from jsdom's real global — proving
 *  production code reads THIS one, never a bare `window`. `observerConstructed` and
 *  `observeSpy` (task 9 fix round 1, item 2) let a test assert the observer was
 *  actually built and actually `observe`d the stage element — `triggerResize()`
 *  alone proves nothing if nothing ever installed it in the first place. */
function makeFakeWin(overrides: { matches?: boolean } = {}): {
  win: Window; triggerResize: () => void; matchMediaSpy: ReturnType<typeof vi.fn>;
  observerConstructed: ReturnType<typeof vi.fn>; observeSpy: ReturnType<typeof vi.fn>;
} {
  let observedCallback: (() => void) | null = null;
  const observerConstructed = vi.fn();
  const observeSpy = vi.fn();
  const matchMediaSpy = vi.fn(() => ({
    matches: overrides.matches ?? false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  class FakeResizeObserver {
    constructor(cb: () => void) { observedCallback = cb; observerConstructed(cb); }
    observe(el: Element): void { observeSpy(el); }
    unobserve(): void {}
    disconnect(): void {}
  }
  const win = {
    ResizeObserver: FakeResizeObserver,
    matchMedia: matchMediaSpy,
    devicePixelRatio: 1,
  } as unknown as Window;
  return { win, triggerResize: () => observedCallback?.(), matchMediaSpy, observerConstructed, observeSpy };
}

function setRect(stage: HTMLElement, width: number, height: number): void {
  stage.getBoundingClientRect = () => ({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
}

function mountWithFactory(factory: CreateCityRenderer, win: Window, rect: { width: number; height: number }) {
  const wrapper = mount(CityViewport, {
    global: { provide: { createCityRenderer: factory } },
  });
  const stage = wrapper.get('[data-ci-role="stage"]').element as HTMLElement;
  (stage as unknown as { win: Window }).win = win;
  setRect(stage, rect.width, rect.height);
  return { wrapper, stage };
}

describe('CityViewport.vue (C08)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // Task 9 fix round 1, item 2 (Critical): `applySize()` used to be called
  // directly, right after `resizeObserver.observe(el)`, in the SAME onMounted
  // callback — every assertion here was satisfied by that direct call alone, and
  // `triggerResize()` was decorative (it re-ran `applySize()` against the SAME,
  // unchanged rect, so a second `resize` call with IDENTICAL arguments proved
  // nothing an already-passing first call did not). Fixed two ways: assert the
  // observer was actually CONSTRUCTED and actually `observe`d the stage element,
  // and change the rect BETWEEN calls so the second `resize` call is genuinely
  // distinguishable from the first.
  it('OWNS SIZING: it installs the ResizeObserver, not the renderer', async () => {
    const rendererDouble = makeRendererDouble();
    const factory = vi.fn(() => rendererDouble) as unknown as CreateCityRenderer;
    const { win, triggerResize, observerConstructed, observeSpy } = makeFakeWin();
    const { stage } = mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    expect(observerConstructed).toHaveBeenCalledTimes(1);
    expect(observeSpy).toHaveBeenCalledWith(stage);
    expect(rendererDouble.resize).toHaveBeenCalledWith(800, 600, expect.any(Number));

    setRect(stage, 640, 480);
    triggerResize();
    await nextTick();
    expect(rendererDouble.resize).toHaveBeenCalledWith(640, 480, expect.any(Number));
  });

  it('clamps the pixel ratio to 2 on EVERY resize', async () => {
    const rendererDouble = makeRendererDouble();
    const factory = vi.fn(() => rendererDouble) as unknown as CreateCityRenderer;
    const { win, triggerResize } = makeFakeWin();
    (win as unknown as { devicePixelRatio: number }).devicePixelRatio = 4;
    const { stage } = mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    expect(rendererDouble.resize).toHaveBeenCalledWith(800, 600, 2);

    setRect(stage, 640, 480);
    triggerResize();
    await nextTick();
    expect(rendererDouble.resize).toHaveBeenCalledWith(640, 480, 2);
  });

  it('no-ops resize on a zero-size box', async () => {
    const rendererDouble = makeRendererDouble();
    const factory = vi.fn(() => rendererDouble) as unknown as CreateCityRenderer;
    const { win } = makeFakeWin();
    mountWithFactory(factory, win, { width: 0, height: 0 });
    await nextTick();
    expect(rendererDouble.resize).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  it('never calls fit() as a side effect of resize', async () => {
    const rendererDouble = makeRendererDouble();
    const factory = vi.fn(() => rendererDouble) as unknown as CreateCityRenderer;
    const { win, triggerResize } = makeFakeWin();
    const { stage } = mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    setRect(stage, 640, 480);
    triggerResize();
    await nextTick();
    expect(rendererDouble.fit).not.toHaveBeenCalled();
  });

  it('creates NO renderer below the 320 CSS px hard floor', async () => {
    const rendererDouble = makeRendererDouble();
    const factory = vi.fn(() => rendererDouble) as unknown as CreateCityRenderer;
    const { win } = makeFakeWin();
    mountWithFactory(factory, win, { width: 200, height: 600 });
    await nextTick();
    expect(factory).not.toHaveBeenCalled();
  });

  it('is ONE named focusable region with a help description, not thousands of buttons', () => {
    const factory = vi.fn(() => makeRendererDouble()) as unknown as CreateCityRenderer;
    const { win } = makeFakeWin();
    const { wrapper, stage } = mountWithFactory(factory, win, { width: 800, height: 600 });
    expect(stage.tabIndex).toBe(0);
    expect(stage.getAttribute('aria-label')).toBeTruthy();
    expect(stage.getAttribute('aria-describedby')).toBeTruthy();
    // Exactly one tabbable descendant anywhere in this component's own output —
    // the stage itself, never one-per-lot.
    expect(wrapper.findAll('[tabindex="0"]')).toHaveLength(1);
  });

  it('marks the canvas aria-hidden and never tabbable', async () => {
    // Simulates what the real createCityRenderer (task 3, unchanged this task) does:
    // append its own canvas, already aria-hidden, into the given mountEl.
    const factory: CreateCityRenderer = (mountEl) => {
      mountEl.createEl('canvas', { attr: { 'aria-hidden': 'true' } });
      return makeRendererDouble();
    };
    const { win } = makeFakeWin();
    const { wrapper } = mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    const canvas = wrapper.get('canvas');
    expect(canvas.attributes('aria-hidden')).toBe('true');
    expect(canvas.attributes('tabindex')).toBeUndefined();
  });

  it('reads matchMedia from containerEl.win, never a bare window', async () => {
    const factory = vi.fn(() => makeRendererDouble()) as unknown as CreateCityRenderer;
    const { win, matchMediaSpy } = makeFakeWin();
    const globalSpy = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(window, 'matchMedia', { value: globalSpy, configurable: true, writable: true });
    mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    expect(matchMediaSpy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(globalSpy).not.toHaveBeenCalled();
  });

  it('passes setMotion("reduced") when prefers-reduced-motion matches', async () => {
    const rendererDouble = makeRendererDouble();
    const factory = vi.fn(() => rendererDouble) as unknown as CreateCityRenderer;
    const { win } = makeFakeWin({ matches: true });
    mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    expect(rendererDouble.setMotion).toHaveBeenCalledWith('reduced');
  });

  it('renders COPY-14 when the renderer reports unavailable', async () => {
    let onEventCapture: ((e: CityRendererEvent) => void) | null = null;
    const factory: CreateCityRenderer = (_mountEl, _win, onEvent) => {
      onEventCapture = onEvent;
      return makeRendererDouble();
    };
    const { win } = makeFakeWin();
    const { wrapper } = mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    onEventCapture!({ type: 'unavailable', reason: 'unsupported' });
    await nextTick();
    expect(wrapper.text()).toContain('The 3D view is unavailable. File inspection still works.');
  });

  it('renders a reconstruct notice, distinct from COPY-14, on context loss', async () => {
    let onEventCapture: ((e: CityRendererEvent) => void) | null = null;
    const factory: CreateCityRenderer = (_mountEl, _win, onEvent) => {
      onEventCapture = onEvent;
      return makeRendererDouble();
    };
    const { win } = makeFakeWin();
    const { wrapper } = mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    onEventCapture!({ type: 'unavailable', reason: 'context-lost' });
    await nextTick();
    expect(wrapper.text()).toMatch(/rebuild|reconstruct/i);
  });

  it('is passive (mounts, exposes a bare host, never constructs anything) when no factory is injected', () => {
    // This is the state App.vue uses today, unchanged by this task: CityView
    // (unmodified) still constructs the real renderer itself against the exposed
    // host element, exactly as it did before task 9.
    const wrapper = mount(CityViewport);
    const stage = wrapper.get('[data-ci-role="stage"]').element as HTMLElement;
    expect(stage).toBeInstanceOf(HTMLElement);
    expect(stage.childElementCount).toBe(0);
  });

  it('populates the shared renderer handle so a sibling can command it', async () => {
    const rendererDouble = makeRendererDouble();
    const factory = vi.fn(() => rendererDouble) as unknown as CreateCityRenderer;
    const { win } = makeFakeWin();
    const wrapper = mount(CityViewport, {
      global: { provide: { createCityRenderer: factory } },
    });
    const stage = wrapper.get('[data-ci-role="stage"]').element as HTMLElement;
    (stage as unknown as { win: Window }).win = win;
    stage.getBoundingClientRect = () => ({
      width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}),
    });
    await nextTick();
    const exposed = wrapper.vm as unknown as { cityRendererHandle: unknown };
    expect(exposed.cityRendererHandle).toBe(rendererDouble);
  });
});
