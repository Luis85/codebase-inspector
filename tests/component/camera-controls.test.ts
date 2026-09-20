import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
// Side-effect import: installs the createDiv prototype extension real Obsidian
// patches onto HTMLElement (tests/mocks/obsidian.ts) — needed here since this test
// builds a standalone stage element outside any mounted component.
import '../mocks/obsidian';
import CameraControls from '../../src/ui/components/CameraControls.vue';
import { CITY_RENDERER_KEY, CITY_STAGE_KEY } from '../../src/ui/renderer-handle';
import { useCityStore } from '../../src/ui/stores/city-store';

// Resolved from the working directory (the repo root, always run with the
// UPPERCASE drive letter — see task-9-context.md §7), not `import.meta.url`: under
// the jsdom vitest project, `import.meta.url` is not a real `file:` URL.
const CAMERA_CONTROLS_SOURCE_PATH = resolve(process.cwd(), 'src/ui/components/CameraControls.vue');

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

const LABELS = ['Zoom in', 'Zoom out', 'Rotate left', 'Rotate right',
  'Pan up', 'Pan down', 'Pan left', 'Pan right', 'Fit', 'Top', 'Focus'];

function mountControls(rendererDouble: ReturnType<typeof makeRendererDouble>, stageEl: HTMLElement) {
  return mount(CameraControls, {
    global: {
      provide: {
        [CITY_RENDERER_KEY as symbol]: { value: rendererDouble },
        [CITY_STAGE_KEY as symbol]: { value: stageEl },
      },
    },
    attachTo: document.body,
  });
}

function byLabel(wrapper: ReturnType<typeof mountControls>, label: string) {
  return wrapper.find(`[aria-label="${label}"]`);
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
    expect(wrapper.findAll('button'),
      'a control exists that LABELS does not name — add it here and to the matrix')
      .toHaveLength(LABELS.length);
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
