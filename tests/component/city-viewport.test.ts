import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
// Side-effect import: installs the createEl prototype extension real Obsidian
// patches onto HTMLElement (tests/mocks/obsidian.ts), used below to build a canvas
// the same way the real, unmodified createCityRenderer does.
import '../mocks/obsidian';
import CityViewport from '../../src/ui/components/CityViewport.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import type { CityRendererEvent, CreateCityRenderer } from '../../src/visualization/renderer-port';

function makeRendererDouble() {
  return {
    setLayout: vi.fn(async () => {}),
    setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setReported: vi.fn(), setRelations: vi.fn(), setLabels: vi.fn(),
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
  setMotionPreference: (matches: boolean) => void;
} {
  let observedCallback: (() => void) | null = null;
  const observerConstructed = vi.fn();
  const observeSpy = vi.fn();
  const motionListeners = new Set<() => void>();
  const mql = { matches: overrides.matches ?? false,
    addEventListener: (_type: string, fn: () => void) => { motionListeners.add(fn); },
    removeEventListener: (_type: string, fn: () => void) => { motionListeners.delete(fn); } };
  const matchMediaSpy = vi.fn(() => mql);
  const setMotionPreference = (matches: boolean): void => { mql.matches = matches; motionListeners.forEach((fn) => { fn(); }); };
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
  return { win, triggerResize: () => observedCallback?.(), matchMediaSpy, observerConstructed, observeSpy, setMotionPreference };
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

  // Task 9 fix round 1, item 6 (Important): the old code merged the zero-box
  // no-op and the 320px hard floor into ONE early return
  // (`rect.width < 320 || rect.height <= 0`), so a genuine zero-HEIGHT box at a
  // width >= the floor was indistinguishable from the floor case, and the
  // original "no-ops resize on a zero-size box" test above (0x0, which also
  // trips the width clause) gave the height guard no independent coverage at
  // all. This mounts at width 400 (comfortably above 320) with height 0.
  it('no-ops resize on a zero-HEIGHT box at a width >= the 320px floor, independently of the floor', async () => {
    const rendererDouble = makeRendererDouble();
    const factory = vi.fn(() => rendererDouble) as unknown as CreateCityRenderer;
    const { win } = makeFakeWin();
    mountWithFactory(factory, win, { width: 400, height: 0 });
    await nextTick();
    expect(rendererDouble.resize).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  // Task 9 fix round 1, item 6 (Important): once a renderer existed (created at
  // >= 320) and the leaf was dragged narrower, `applySize` used to return
  // BEFORE both the pixel-ratio clamp and `resize()`, and nothing disposed the
  // renderer -- so a live WebGL context survived below the floor, against spec
  // 5.2's "creates no WebGL context at all", with a stale canvas size. Fix round
  // 2, item 1 (ruling M68) made this the ONLY such transition left in the
  // codebase (city-view.ts's own former, analogous `applyWidth` ->
  // `teardownRenderer` transition is gone) -- CityViewport alone owns it.
  it('disposes an existing renderer when the box drops below the 320px floor', async () => {
    const rendererDouble = makeRendererDouble();
    const factory = vi.fn(() => rendererDouble) as unknown as CreateCityRenderer;
    const { win, triggerResize } = makeFakeWin();
    const { wrapper, stage } = mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    expect(factory).toHaveBeenCalledTimes(1);

    setRect(stage, 200, 600);
    triggerResize();
    await nextTick();
    expect(rendererDouble.dispose).toHaveBeenCalledTimes(1);
    const exposed = wrapper.vm as unknown as { cityRendererHandle: unknown };
    expect(exposed.cityRendererHandle).toBeNull();

    // And a later resize back above the floor creates a genuinely NEW renderer,
    // not a reuse of the disposed one.
    const rendererDouble2 = makeRendererDouble();
    vi.mocked(factory).mockReturnValueOnce(rendererDouble2);
    setRect(stage, 800, 600);
    triggerResize();
    await nextTick();
    expect(factory).toHaveBeenCalledTimes(2);
    expect(rendererDouble2.resize).toHaveBeenCalledWith(800, 600, expect.any(Number));
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
    // Deferred Minor 12, fixed here since item 2/6 already touch this file:
    // restores whatever `window.matchMedia` was before (jsdom provides none by
    // default, so that is `undefined` — deleting the property, not merely
    // reassigning it, is what "restore" means here) rather than leaking this
    // spy into every test that runs after this one in the same file/worker.
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', { value: globalSpy, configurable: true, writable: true });
    try {
      mountWithFactory(factory, win, { width: 800, height: 600 });
      await nextTick();
      expect(matchMediaSpy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      expect(globalSpy).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(window, 'matchMedia', original);
      else delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it('passes setMotion("reduced") when prefers-reduced-motion matches', async () => {
    const rendererDouble = makeRendererDouble();
    const factory = vi.fn(() => rendererDouble) as unknown as CreateCityRenderer;
    const { win } = makeFakeWin({ matches: true });
    mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    expect(rendererDouble.setMotion).toHaveBeenCalledWith('reduced');
  });

  // FINAL WAVE, Important 2. The matrix credited a PASSED jsdom half for LIVE OS-level
  // tracking that no double could fire, so deleting the live response left 980 tests green.
  it('follows a LIVE prefers-reduced-motion change, not just the value at construction', async () => {
    const rendererDouble = makeRendererDouble();
    const factory = vi.fn(() => rendererDouble) as unknown as CreateCityRenderer;
    const { win, setMotionPreference } = makeFakeWin({ matches: false });
    mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    expect(rendererDouble.setMotion).toHaveBeenLastCalledWith('standard');
    setMotionPreference(true);
    expect(rendererDouble.setMotion).toHaveBeenLastCalledWith('reduced');
    setMotionPreference(false);
    expect(rendererDouble.setMotion).toHaveBeenLastCalledWith('standard');
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

  // Task 9 fix round 4, item 1 (Important): every OTHER `unavailable` test in
  // this suite fires through a callback CAPTURED during construction and
  // invoked afterwards -- the `context-lost` shape. The only production
  // `initialization-failed` emitter (city-renderer.ts's WebGL-construction
  // `catch`) calls `onEvent` SYNCHRONOUSLY, from inside the factory, before the
  // factory returns. With the notice cleared AFTER the factory call, that
  // notice was set and then wiped one line later, so a real WebGL init failure
  // showed the user a silent, normal-looking empty viewport and COPY-14 never
  // rendered at all.
  it('renders COPY-14 when the factory reports unavailable synchronously, before it returns', async () => {
    const inertPort = makeRendererDouble();
    const factory: CreateCityRenderer = (_mountEl, _win, onEvent) => {
      onEvent({ type: 'unavailable', reason: 'initialization-failed' });
      return inertPort;                  // exactly what createCityRenderer does: emit, then return an inert port
    };
    const { win } = makeFakeWin();
    const { wrapper } = mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();                    // onMounted's deferred measurement -> applySize -> the factory call
    await nextTick();                    // the render that measurement's state change schedules
    expect(wrapper.text()).toContain('The 3D view is unavailable. File inspection still works.');
  });

  // Ruling M80 (task 11 fix round 1, item 2): context loss DISPOSES AND
  // RECONSTRUCTS on its own -- spec 4.2, line 589, verbatim -- rather than sitting
  // on "will rebuild" until whatever next happens to cause a resize (which could be
  // NEVER: the notice this test used to assert PERSISTED is `position: absolute`,
  // so showing it relayouts nothing and generates no ResizeObserver callback at
  // all). This is STRICTER than the old assertion (notice persists indefinitely):
  // it now pins that a rebuild actually happens, with no external trigger, and
  // that the notice does not outlive it.
  it('reconstructs on context loss with no external trigger, and the notice does not persist', async () => {
    let onEventCapture: ((e: CityRendererEvent) => void) | null = null;
    const factory = vi.fn((_mountEl: HTMLElement, _win: Window, onEvent: (e: CityRendererEvent) => void) => {
      onEventCapture = onEvent;
      return makeRendererDouble();
    }) as unknown as CreateCityRenderer;
    const { win } = makeFakeWin();
    const { wrapper } = mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    expect(vi.mocked(factory)).toHaveBeenCalledTimes(1);
    onEventCapture!({ type: 'unavailable', reason: 'context-lost' });
    // No triggerResize(), no external event of any kind -- the ONLY thing that
    // happens between firing the event and these awaits is Vue's own reactive
    // flush, TWICE: once for the notice `nextTick(applySize)` was scheduled
    // against, once for applySize()'s own `unavailableReason.value = null`.
    await nextTick();
    await nextTick();
    expect(vi.mocked(factory)).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toMatch(/rebuild|reconstruct/i);
  });

  // Task 9 fix round 3, item 2 (Important): `handleRendererEvent` used to null
  // out the handle without ever calling `dispose()` -- dormant before ruling
  // M68 (nothing constructed a renderer in production), activated by it. Spec
  // 4.2's own designed path ("On unavailable{context-lost} the view disposes
  // and reconstructs") never actually disposed: no `forceContextLoss()`, no
  // canvas removal, and every earlier renderer leaked once `onBeforeUnmount`
  // only ever disposed the newest one.
  it('disposes the renderer on an unavailable event, not merely drops the reference', async () => {
    const rendererDouble = makeRendererDouble();
    let onEventCapture: ((e: CityRendererEvent) => void) | null = null;
    const factory: CreateCityRenderer = (_mountEl, _win, onEvent) => {
      onEventCapture = onEvent;
      return rendererDouble;
    };
    const { win } = makeFakeWin();
    mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    onEventCapture!({ type: 'unavailable', reason: 'context-lost' });
    await nextTick();
    expect(rendererDouble.dispose).toHaveBeenCalledTimes(1);
  });

  // Ruling M80 (task 11 fix round 1, item 2): self-reconstruction must not leave
  // the component's own sizing machinery stale -- a LATER, genuinely external
  // resize (here, the pre-existing 320px floor round trip) must still reach the
  // NEWLY self-reconstructed renderer, not some half-wired leftover state. This is
  // the distinct half of what the old (pre-M80) "clears the unavailable notice
  // once a new renderer is actually constructed" test covered by manually driving
  // the reconstruction the view now performs on its own.
  it('the self-reconstructed renderer keeps responding to further real resizes', async () => {
    const rendererDouble1 = makeRendererDouble();
    const rendererDouble2 = makeRendererDouble();
    let onEventCapture: ((e: CityRendererEvent) => void) | null = null;
    const factory = vi.fn((_mountEl: HTMLElement, _win: Window, onEvent: (e: CityRendererEvent) => void) => {
      onEventCapture = onEvent;
      return rendererDouble1;
    }) as unknown as CreateCityRenderer;
    const { win, triggerResize } = makeFakeWin();
    const { wrapper, stage } = mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();

    vi.mocked(factory).mockReturnValueOnce(rendererDouble2);
    onEventCapture!({ type: 'unavailable', reason: 'context-lost' });
    await nextTick();   // self-reconstructs to rendererDouble2, no external trigger
    await nextTick();   // the notice's OWN clearing flush, one tick after that
    expect(wrapper.text()).not.toMatch(/rebuild|reconstruct/i);

    // A real, later resize below the floor still reaches the NEW renderer.
    setRect(stage, 300, 600);
    triggerResize();
    await nextTick();
    expect(rendererDouble2.dispose).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('The 3D view is unavailable. File inspection still works.');
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

  // Task 10, finding 6: `city-store.setCamera()` had no production caller, and neither
  // did the canvas-to-HTML selection direction. Both are fed by renderer EVENTS, and
  // this component is the only thing that receives them.
  it('mirrors renderer events into the city store, closing the canvas-to-HTML loop', async () => {
    const rendererDouble = makeRendererDouble();
    let emit: ((e: CityRendererEvent) => void) | null = null;
    const factory = vi.fn((_m: HTMLElement, _w: Window, onEvent: (e: CityRendererEvent) => void) => {
      emit = onEvent;
      return rendererDouble;
    }) as unknown as CreateCityRenderer;
    const { win } = makeFakeWin();
    mountWithFactory(factory, win, { width: 800, height: 600 });
    await nextTick();
    const store = useCityStore();

    const camera = { projection: 'orthographic' as const, mode: '3d' as const,
      position: [1, 2, 3] as [number, number, number], target: [0, 1, 0] as [number, number, number],
      up: [0, 1, 0] as [number, number, number], zoom: 0.5 };
    emit!({ type: 'camera-changed', camera });
    expect(store.camera).toEqual(camera);
    expect(store.previous3dCamera).toEqual(camera);

    emit!({ type: 'entity-picked', entityId: 'repo\0file\0src/a.ts', snapshotId: 's1' });
    expect(store.selectedEntityId).toBe('repo\0file\0src/a.ts');
  });
});
