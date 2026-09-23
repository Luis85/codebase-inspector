// The acceptance suite's per-scenario world: every harness a step can need, built
// lazily, torn down unconditionally. Nothing crosses a scenario boundary.
//
// The UI harness mounts the REAL `App.vue` under a real `.codebase-inspector-root`
// container, with the real components, the real Pinia stores and the real
// `CityViewport` renderer wiring. Steps then click buttons, type into fields and
// dispatch key events; they do not call store actions to stand in for a user
// (task-12-context.md §0).
import { expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
// Side-effect import: installs the win/doc/createEl/onWindowMigrated prototype
// extensions real Obsidian patches on before any plugin loads.
import '../mocks/obsidian';
import { destroyAllPopoutWindows } from '../mocks/window-harness';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import type { ClipboardLike } from '../../src/ui/clipboard';
import type { CameraBookmark, CodebaseSnapshot } from '../../src/domain/model';
import type { LayoutResult } from '../../src/domain/layout/types';
import type { CityRendererEvent, CityRendererPort } from '../../src/visualization/renderer-port';
import type { TempTree } from '../fixtures/temp-tree';

export const STAGE_WIDTH = 800;
export const STAGE_HEIGHT = 600;

/** A 3D bookmark that is plainly NOT a default: every scenario that says "the camera
 *  is positioned away from the default view" installs this one, so "unchanged" is a
 *  statement about a value nothing could have produced by accident. */
export const MOVED_3D_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d',
  position: [37, 21, -13], target: [3, 0, 5], up: [0, 1, 0], zoom: 2.75,
};

export interface RecordingRenderer extends CityRendererPort {
  calls: {
    setLayout: ReturnType<typeof vi.fn>; setColors: ReturnType<typeof vi.fn>;
    setSelection: ReturnType<typeof vi.fn>; setFilter: ReturnType<typeof vi.fn>;
    setCamera: ReturnType<typeof vi.fn>; setCameraMode: ReturnType<typeof vi.fn>;
    nudgeCamera: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn>;
    fit: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>;
  };
}

export function createRecordingRenderer(): RecordingRenderer {
  let camera: CameraBookmark = MOVED_3D_CAMERA;
  const calls = {
    setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(),
    setFilter: vi.fn(), setCamera: vi.fn((c: CameraBookmark) => { camera = c; }),
    setCameraMode: vi.fn(), nudgeCamera: vi.fn(), focus: vi.fn(), fit: vi.fn(),
    dispose: vi.fn(), pause: vi.fn(), resume: vi.fn(),
  };
  return {
    calls,
    setLayout: calls.setLayout, setColors: calls.setColors, setSelection: calls.setSelection,
    setFilter: calls.setFilter, setReported: vi.fn(), setLabels: vi.fn(), setCameraMode: calls.setCameraMode,
    setMotion: vi.fn(), getCamera: () => camera, setCamera: calls.setCamera,
    nudgeCamera: calls.nudgeCamera, focus: calls.focus, fit: calls.fit, resize: vi.fn(),
    pause: calls.pause, resume: calls.resume, dispose: calls.dispose,
    getDiagnostics: () => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0,
      instanceCount: 0, lastFrameMs: 0, contextLost: false,
    }),
    debugLoseContext: vi.fn(),
  };
}

/** How `src/visualization/city-renderer` behaves for the scenario currently running.
 *  wp01.steps.ts mocks that module with a factory that consults this: `useReal` false
 *  (the default) hands out a recording double and remembers the call, `useReal` true
 *  delegates to the genuine production `createCityRenderer`. One seam, so the
 *  "Dispose the real Three.js renderer" scenario can use the real thing while the host
 *  lifecycle scenarios keep a double they can interrogate. */
export interface RendererCall {
  port: RecordingRenderer;
  onEvent: (event: CityRendererEvent) => void;
  mountEl: HTMLElement;
  win: Window;
}

export const rendererControl: { useReal: boolean; calls: RendererCall[] } = { useReal: false, calls: [] };

export interface UiHarness {
  /** Only what a step ever needs: the harness owns the mount, teardown returns it.
   *  Naming the full `VueWrapper` generic here buys nothing and forces an unsafe
   *  assignment at the mount site. */
  wrapper: { unmount(): void };
  container: HTMLElement;
  stage: HTMLElement;
  renderer: RecordingRenderer | null;
  emit(event: CityRendererEvent): void;
  store: ReturnType<typeof useCityStore>;
  snapshot: CodebaseSnapshot;
  layout: LayoutResult;
}

export interface World {
  ui: UiHarness | null;
  trees: TempTree[];
  cleanups: (() => void | Promise<void>)[];
  /** Per-scenario scratch, each field owned by the one scenario that sets it. */
  scratch: Map<string, unknown>;
}

export function makeWorld(): World {
  return { ui: null, trees: [], cleanups: [], scratch: new Map() };
}

export async function teardownWorld(world: World): Promise<void> {
  world.ui?.wrapper.unmount();
  world.ui?.container.remove();
  // Last registered, first undone -- a plain backwards walk rather than `reverse()`
  // (which mutates) or `toReversed()` (not in this project's TS lib target).
  const cleanups = world.cleanups.splice(0);
  for (let i = cleanups.length - 1; i >= 0; i -= 1) await cleanups[i]!();
  await Promise.all(world.trees.splice(0).map((t) => t.cleanup()));
  destroyAllPopoutWindows();
  rendererControl.useReal = false;
  rendererControl.calls.length = 0;
  document.querySelectorAll('.modal-container, .notice-container').forEach((el) => { el.remove(); });
  document.body.innerHTML = '';
}

/** Reads what a step put in scratch, with a loud failure rather than `undefined`
 *  flowing into an assertion that then passes vacuously. */
export function take<T>(world: World, key: string): T {
  const value = world.scratch.get(key);
  expect(value, `scenario step order: nothing has set "${key}" yet`).toBeDefined();
  return value as T;
}

export function put(world: World, key: string, value: unknown): void {
  world.scratch.set(key, value);
}

export function ui(world: World): UiHarness {
  expect(world.ui, 'this step needs a mounted city: put a "Given ... visible in the city" first').not.toBeNull();
  return world.ui!;
}

function installMatchMedia(): () => void {
  const holder = window as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  holder.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  });
  return () => {
    if (previous) Object.defineProperty(window, 'matchMedia', previous);
    else delete holder.matchMedia;
  };
}

function sizeBox(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
  el.getBoundingClientRect = () => ({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
}

export interface MountOptions {
  files?: number;
  directories?: number;
  unavailable?: number;
  snapshot?: CodebaseSnapshot;
  clipboard?: ClipboardLike;
  /** When false the renderer factory is not provided at all, which is exactly what a
   *  view with no WebGL looks like to every component in the tree. */
  withRenderer?: boolean;
}

/** Mounts the real shell. Returns once the renderer (if any) has been constructed and
 *  the store already holds the snapshot, i.e. at the state a user actually finds after
 *  a completed scan. */
export async function mountCity(world: World, options: MountOptions = {}): Promise<UiHarness> {
  world.cleanups.push(installMatchMedia());
  const snapshot = options.snapshot ?? buildSnapshotFixture({
    files: options.files ?? 9, directories: options.directories ?? 3,
    unavailable: options.unavailable ?? 0,
  });
  const layout = computeLayout(snapshot);

  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useCityStore(pinia);
  // "A snapshot arrives" is a HOST event (city-view.ts's own publishLayout), not a user
  // action -- the one place this file drives a store directly, and deliberately so.
  store.setCity(snapshot, layout);
  store.navigate('city'); // a fresh leaf opens on Overview (Task 12); these scenarios are the city's

  const container = document.body.createDiv({ cls: 'codebase-inspector-root' });
  sizeBox(container, 1000, 800);

  let renderer: RecordingRenderer | null = null;
  let onEvent: ((e: CityRendererEvent) => void) | null = null;
  const provide: Record<string | symbol, unknown> = {};
  if (options.withRenderer !== false) {
    provide.createCityRenderer = (_el: HTMLElement, _win: Window, handler: (e: CityRendererEvent) => void) => {
      onEvent = handler;
      renderer = createRecordingRenderer();
      return renderer;
    };
  }
  if (options.clipboard) provide.clipboard = options.clipboard;

  const wrapper = mount(App, { attachTo: container, global: { plugins: [pinia], provide } });
  const stage = wrapper.find<HTMLElement>('[data-ci-role="stage"]').element;
  sizeBox(stage, STAGE_WIDTH, STAGE_HEIGHT);
  await nextTick();
  await nextTick();

  const harness: UiHarness = {
    wrapper, container, stage, snapshot, layout, store,
    get renderer() { return renderer; },
    emit(event: CityRendererEvent) {
      expect(onEvent, 'no renderer was constructed, so it can emit nothing').not.toBeNull();
      onEvent!(event);
    },
  };
  world.ui = harness;
  return harness;
}

export function fileRows(harness: UiHarness): HTMLButtonElement[] {
  return Array.from(harness.container.querySelectorAll<HTMLButtonElement>('button.ci-file-list__row'));
}

export function searchInput(harness: UiHarness): HTMLInputElement {
  const el = harness.container.querySelector<HTMLInputElement>('input.ci-search__input');
  expect(el, 'the search field is not on screen').not.toBeNull();
  return el!;
}

export function buttonNamed(harness: UiHarness, label: string): HTMLButtonElement {
  const el = harness.container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(el, `no control named "${label}" is on screen`).not.toBeNull();
  return el!;
}

/** A real click: the same event a pointer produces, dispatched on the real element,
 *  with focus moved first exactly as a browser does. */
export async function clickReal(el: HTMLElement): Promise<void> {
  el.focus();
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await nextTick();
}

export async function typeQuery(harness: UiHarness, text: string): Promise<void> {
  const input = searchInput(harness);
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  // FileSearch debounces ~150 ms through the injected window's setTimeout; the store
  // is not filtered until it fires, so a scenario that types must wait for it.
  await new Promise((resolve) => window.setTimeout(resolve, 200));
  await nextTick();
}

export function pressKey(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}
