import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, ref } from 'vue';
// Side-effect import: installs the createDiv prototype extension real Obsidian
// patches onto HTMLElement (tests/mocks/obsidian.ts) — needed here since this test
// builds a standalone stage element outside any mounted component.
import '../mocks/obsidian';
import CameraControls from '../../src/ui/components/CameraControls.vue';
import { CITY_RENDERER_KEY, CITY_STAGE_KEY } from '../../src/ui/renderer-handle';
import { useCityStore } from '../../src/ui/stores/city-store';
import { LEAF_LAYOUT_KEY, type LeafLayout } from '../../src/ui/shell/leaf-layout';

// Resolved from the working directory (the repo root, always run with the
// UPPERCASE drive letter — see task-9-context.md §7), not `import.meta.url`: under
// the jsdom vitest project, `import.meta.url` is not a real `file:` URL.
const CAMERA_CONTROLS_SOURCE_PATH = resolve(process.cwd(), 'src/ui/components/CameraControls.vue');

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

const LABELS = ['Zoom in', 'Zoom out', 'Rotate left', 'Rotate right',
  'Pan up', 'Pan down', 'Pan left', 'Pan right', 'Fit', 'Top', 'Focus'];

function mountControls(
  rendererDouble: ReturnType<typeof makeRendererDouble>,
  stageEl: HTMLElement,
  props: { stepsCollapsed?: boolean } = {},
  leafLayout?: LeafLayout,
) {
  return mount(CameraControls, {
    props,
    global: {
      provide: {
        [CITY_RENDERER_KEY as symbol]: { value: rendererDouble },
        [CITY_STAGE_KEY as symbol]: { value: stageEl },
        ...(leafLayout ? { [LEAF_LAYOUT_KEY as symbol]: leafLayout } : {}),
      },
    },
    attachTo: document.body,
  });
}

/** Task 10: a real `.codebase-inspector-root` ancestor with a controllable rect --
 *  `contentBoxInlineSize`/`narrowContainer` (container-box.ts) climb to this exact
 *  class, the same one App.vue's own `narrowDrawer` measures, so the disclosure's
 *  auto-default is pinned against the SAME leaf-width signal rather than a second,
 *  invented one. Returns the STAGE element `mountControls` expects, nested inside
 *  the root so `.closest('.codebase-inspector-root')` finds it. */
function stageInRoot(width: number): HTMLElement {
  const root = document.body.createDiv({ cls: 'codebase-inspector-root' });
  root.getBoundingClientRect = () => ({
    width, height: 700, top: 0, left: 0, right: width, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
  });
  return root.createDiv();
}

function byLabel(wrapper: ReturnType<typeof mountControls>, label: string) {
  return wrapper.find(`[aria-label="${label}"]`);
}

/** What App's provideLeafLayout provides; a test advances the tick by hand. Captures
 *  nothing (oxlint consistent-function-scoping), so it lives at module scope. */
function layoutDouble(): { layout: LeafLayout; tick: () => void } {
  const layoutTick = ref(0);
  return { layout: { layoutTick }, tick: () => { layoutTick.value += 1; } };
}
function resizeLeaf(stage: HTMLElement, width: number): void {
  stage.closest<HTMLElement>('.codebase-inspector-root')!.getBoundingClientRect = () => ({
    width, height: 700, top: 0, left: 0, right: width, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
  });
}

describe('CameraControls.vue (C09) — WCAG 2.5.7', () => {
  let stageEl: HTMLElement;
  let rendererDouble: ReturnType<typeof makeRendererDouble>;

  beforeEach(() => {
    setActivePinia(createPinia());
    stageEl = document.body.createDiv();
    rendererDouble = makeRendererDouble();
  });

  it('offers a SINGLE-POINTER route for every dragging gesture', () => {
    const wrapper = mountControls(rendererDouble, stageEl);
    for (const label of LABELS) {
      expect(byLabel(wrapper, label).exists(), label).toBe(true);
      expect(byLabel(wrapper, label).element.tagName, label).toBe('BUTTON');
    }
    // EXHAUSTIVENESS, not merely presence. The accessibility matrix cites this test for
    // the figure "11 controls"; a presence loop alone proves the eleven named controls
    // exist and says nothing about a twelfth shipping unnamed, so the matrix's claim was
    // wider than the test. WCAG 2.5.7 is about EVERY dragging gesture having a
    // single-pointer route — a control this list does not know about is exactly the case
    // that has not been thought through.
    //
    // Task 10 (F5): now LABELS.length + 1 — the disclosure toggle (`.ci-camera-controls__more`)
    // is a real, deliberate twelfth control, not an unnoticed regression; it is asserted
    // by name below rather than folded into LABELS, since it is not itself a camera
    // gesture WCAG 2.5.7 requires a single-pointer route for.
    expect(wrapper.findAll('button'),
      'a control exists that neither LABELS nor the disclosure toggle names — add it here and to the matrix')
      .toHaveLength(LABELS.length + 1);
    expect(wrapper.find('.ci-camera-controls__more').exists()).toBe(true);
  });

  // Task 10 (F5): eleven buttons in a full-width row below the stage wrapped to two
  // rows in a narrow leaf and ate the height the city needs — the fix overlays a
  // compact group on the canvas itself instead. Anchored against `.ci-viewport`
  // (superseding ruling: `.ci-app__stage-column`'s own bottom-right corner sits over
  // MetricLegend, not the canvas, once Task 7's header and Task 8's legend are both
  // in that column) — CityStage.vue is what makes CameraControls a DOM descendant of
  // it; this test only pins the class this component itself is responsible for.
  it('sits over the stage rather than taking a row beneath it', () => {
    const wrapper = mountControls(rendererDouble, stageEl);
    expect(wrapper.find('.ci-camera-controls').classes()).toContain('ci-camera-controls--overlay');
  });

  // foundations/04: a keyboard-only alternative alone is NOT sufficient for the
  // single-pointer requirement — the pan and rotate STEPS (named for
  // BUTTON_ROTATE_STEP/BUTTON_PAN_STEP, the increments this file already defines,
  // unlike BUTTON_ZOOM_FACTOR) are themselves that alternative, so hiding them behind
  // a disclosure must never remove them — every one must still be reachable by
  // pointer in a few clicks. `stepsCollapsed: true` is the explicit test seam
  // (component doc comment): jsdom has no layout engine, so this is how a narrow
  // leaf's own INITIAL state is exercised without faking a real ResizeObserver round
  // trip for a number (819px) this component does not itself decide alone.
  it('keeps every action reachable when the step controls are collapsed', () => {
    const wrapper = mountControls(rendererDouble, stageEl, { stepsCollapsed: true });
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(false);
    expect(wrapper.findAll('button').length).toBe(6);   // five primaries + the disclosure
    return wrapper.find('.ci-camera-controls__more').trigger('click').then(() => {
      expect(wrapper.findAll('button').length).toBe(12);   // eleven actions plus the disclosure
      for (const label of LABELS) expect(byLabel(wrapper, label).exists(), label).toBe(true);
    });
  });

  // Task 10: the auto-default this component computes for itself when no test override
  // is given — `contentBoxInlineSize(narrowContainer(...))`, the SAME leaf-width
  // measurement App.vue's own `narrowDrawer` takes, against the SAME 820px number
  // (DRAWER_MAX_INLINE_SIZE) — one definition of "narrow" for the whole shell, not a
  // second one invented here. A width of exactly 0 (jsdom's own default, and a
  // leaf paused behind a sibling tab) is deliberately read as "not yet measurable",
  // never as "narrow" — see this file's own applyStepsDefault comment.
  it('defaults the steps OPEN at or above the 820px leaf threshold', () => {
    const stage = stageInRoot(900);
    const wrapper = mountControls(rendererDouble, stage);
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(true);
    expect(wrapper.findAll('button').length).toBe(12);
  });

  it('defaults the steps COLLAPSED below the 820px leaf threshold', () => {
    const stage = stageInRoot(600);
    const wrapper = mountControls(rendererDouble, stage);
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(false);
    expect(wrapper.findAll('button').length).toBe(6);
  });

  it('drives nudgeCamera with the spec step increments', async () => {
    const wrapper = mountControls(rendererDouble, stageEl);
    await byLabel(wrapper, 'Rotate left').trigger('click');
    expect(rendererDouble.nudgeCamera).toHaveBeenCalledWith({ orbit: [-Math.PI / 8, 0] });
    await byLabel(wrapper, 'Zoom in').trigger('click');
    expect(rendererDouble.nudgeCamera).toHaveBeenCalledWith({ zoomFactor: 1.2 });
    await byLabel(wrapper, 'Pan left').trigger('click');
    expect(rendererDouble.nudgeCamera).toHaveBeenCalledWith({ pan: [-30, 0] });
  });

  it('Fit, Top and Focus drive the renderer directly, not nudgeCamera', async () => {
    const wrapper = mountControls(rendererDouble, stageEl);
    await byLabel(wrapper, 'Fit').trigger('click');
    expect(rendererDouble.fit).toHaveBeenCalled();
    await byLabel(wrapper, 'Top').trigger('click');
    expect(rendererDouble.setCameraMode).toHaveBeenCalledWith('top');
    await byLabel(wrapper, 'Focus').trigger('click');
    // No selection yet in this test's store — focus() is only meaningful with one;
    // see the dedicated "Focus" behaviour covered by FileInspector's own test.
  });

  // Phase 2 fix wave, C1 (Critical): `Top` used to be a ONE-WAY DOOR. Nothing in
  // `src/` ever called `setCameraMode('3d')`, so once a user pressed Top the oblique
  // view was gone for that leaf — permanently, across restarts, because `viewMode` is
  // persisted into CityViewState. The store and the rig both implemented the round
  // trip correctly and completely; neither had a production caller. This test drives
  // the BUTTON, twice, which is the thing the store-level test below cannot prove.
  it('C1: Top is a TOGGLE — a second press returns the camera to 3D', async () => {
    const wrapper = mountControls(rendererDouble, stageEl);
    const store = useCityStore();
    const topButton = byLabel(wrapper, 'Top');

    await topButton.trigger('click');
    expect(rendererDouble.setCameraMode).toHaveBeenNthCalledWith(1, 'top');
    expect(store.viewMode).toBe('top');
    expect(topButton.attributes('aria-pressed')).toBe('true');
    expect(topButton.attributes('aria-label')).toBe('Return to 3D view');

    await topButton.trigger('click');
    expect(rendererDouble.setCameraMode).toHaveBeenNthCalledWith(2, '3d');
    expect(store.viewMode).toBe('3d');
    expect(topButton.attributes('aria-pressed')).toBe('false');
    expect(topButton.attributes('aria-label')).toBe('Top');
  });

  it('C1: the T key routes through the SAME toggle as the button', () => {
    mountControls(rendererDouble, stageEl);
    const store = useCityStore();
    stageEl.focus();
    stageEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', bubbles: true }));
    expect(rendererDouble.setCameraMode).toHaveBeenNthCalledWith(1, 'top');
    expect(store.viewMode).toBe('top');
    stageEl.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
    expect(rendererDouble.setCameraMode).toHaveBeenNthCalledWith(2, '3d');
    expect(store.viewMode).toBe('3d');
  });

  it('uses the KEYBOARD increments for key presses, only while the canvas has focus', async () => {
    mountControls(rendererDouble, stageEl);
    stageEl.focus();
    stageEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(rendererDouble.nudgeCamera).toHaveBeenCalledWith({ orbit: [-0.12, 0] });
    stageEl.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    expect(rendererDouble.nudgeCamera).toHaveBeenCalledWith({ zoomFactor: 1.15 });
  });

  it('honours F, T, +/-, arrows, Shift-arrows and Enter ONLY when the canvas itself has focus', () => {
    mountControls(rendererDouble, stageEl);
    const elsewhere = document.body.createDiv();
    elsewhere.tabIndex = 0;
    elsewhere.focus();
    elsewhere.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(rendererDouble.nudgeCamera).not.toHaveBeenCalled();

    stageEl.focus();
    stageEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', bubbles: true }));
    expect(rendererDouble.fit).toHaveBeenCalled();
  });

  it('ignores Ctrl/Meta/Alt combinations and composing input', () => {
    mountControls(rendererDouble, stageEl);
    stageEl.focus();
    stageEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, bubbles: true }));
    expect(rendererDouble.fit).not.toHaveBeenCalled();
    stageEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, isComposing: true }));
    expect(rendererDouble.nudgeCamera).not.toHaveBeenCalled();
  });

  it('registers no host-wide default bindings (commands exist; hotkeys do not)', () => {
    // commands.ts (task 3/8, unmodified) already registers open-city/scan-codebase/
    // cancel-scan with no hotkeys of their own. This component's own key handling is
    // a plain `addEventListener('keydown', ...)` on the stage element, never a
    // `plugin.addCommand({ hotkeys: [...] })` — proven directly against the source
    // rather than against a runtime double, since nothing this component does could
    // call `addCommand` without importing 'obsidian' in the first place.
    const source = readFileSync(CAMERA_CONTROLS_SOURCE_PATH, 'utf8');
    expect(source).not.toContain("from 'obsidian'");
    expect(source).not.toContain('addCommand');
    expect(source).not.toContain('hotkeys');
  });
});

// Part 5 V5 (Part 2 deferral): the steps default was computed once, at mount. It now follows
// the shell's ONE leaf measurement (leaf-layout.ts's layoutTick) until the user toggles.
describe('CameraControls re-measures on every leaf layout change (Part 5 V5)', () => {
  let rendererDouble: ReturnType<typeof makeRendererDouble>;
  beforeEach(() => { setActivePinia(createPinia()); rendererDouble = makeRendererDouble(); });

  it('collapses the steps when the leaf narrows across 820 px, and reopens them when it widens', async () => {
    const stage = stageInRoot(900);
    const { layout, tick } = layoutDouble();
    const wrapper = mountControls(rendererDouble, stage, {}, layout);
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(true);

    resizeLeaf(stage, 600);
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(false);

    resizeLeaf(stage, 900);
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(true);
  });

  it('never overrides the user once they have toggled the steps themselves', async () => {
    const stage = stageInRoot(900);
    const { layout, tick } = layoutDouble();
    const wrapper = mountControls(rendererDouble, stage, {}, layout);
    resizeLeaf(stage, 600);
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(false);

    await wrapper.find('.ci-camera-controls__more').trigger('click');   // the user opens them
    resizeLeaf(stage, 500);
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(true);

    await wrapper.find('.ci-camera-controls__more').trigger('click');   // …and closes them
    resizeLeaf(stage, 1000);
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(false);
  });

  // Controller ruling Part 5 E13 (Important, a11y — WCAG 2.4.3): a layoutTick re-apply
  // used to collapse the steps group unconditionally, even while a keyboard user's focus
  // was ON one of the six step buttons — dropping focus to <body> with no visible cause.
  // Expanding is always safe (nothing is removed); only a COLLAPSE can steal focus, so
  // only a collapse is deferred until focus has moved elsewhere.
  it('never collapses the steps out from under a step button the user is focused on (Part 5 E13)', async () => {
    const stage = stageInRoot(900);
    const { layout, tick } = layoutDouble();
    const wrapper = mountControls(rendererDouble, stage, {}, layout);
    const rotateLeft = byLabel(wrapper, 'Rotate left').element as HTMLElement;
    rotateLeft.focus();
    expect(document.activeElement).toBe(rotateLeft);

    // The leaf narrows while focus is still on the step button: the collapse must wait.
    resizeLeaf(stage, 600);
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(true);
    expect(document.activeElement).toBe(rotateLeft);

    // Focus moves elsewhere (a primary-row button, outside the steps group); the next
    // tick is then free to apply the narrow default.
    (byLabel(wrapper, 'Fit').element as HTMLElement).focus();
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(false);
  });
});

// Task 10: the overlay must not swallow a pointer aimed at a building UNDER it —
// picking raycasts file lots only, and jsdom cannot render the real stacking/hit-
// testing that would otherwise catch this, so the two declarations that prevent it
// are pinned directly against the stylesheet, the same way
// tests/component/stage-height.test.ts already reads styles.css "because the
// stylesheet is where they are actually decided".
describe('the overlay does not intercept a pointer aimed at a building (styles.css)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/ui/styles.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  function topLevelRule(selector: string): string {
    const needle = `:where(.codebase-inspector-root) ${selector} {`;
    const start = css.indexOf(needle);
    expect(start, `${selector} is not declared at the top level of styles.css`).toBeGreaterThan(-1);
    return css.slice(start + needle.length, css.indexOf('}', start));
  }

  it('the container refuses every pointer', () => {
    expect(topLevelRule('.ci-camera-controls--overlay')).toMatch(/(?<![-\w])pointer-events:\s*none\s*(?:;|$)/);
  });

  it('every button opts back in', () => {
    expect(topLevelRule('.ci-camera-controls button')).toMatch(/(?<![-\w])pointer-events:\s*auto\s*(?:;|$)/);
  });
});
