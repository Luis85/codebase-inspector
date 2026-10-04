// GRC5 (GCO13): the whole leaf (App.vue) mounted in jsdom with the harness's own seed
// (tests/harness/seed.ts and fixture.ts: 144 files, the synthetic fallow report through the
// real reader and builder, the scripted fallow analysis, the demo work items and the
// Investigate notes port), so axe checks every screen WITH content, never an empty state
// alone (Plan Review Focus 3). This mirrors tests/harness/mount.ts, minus the real WebGL
// renderer that only a browser has.
import { vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import type { RouteId } from '../../src/domain/route-ids';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useRunStore } from '../../src/ui/stores/run-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useSnapshotJournal } from '../../src/ui/stores/snapshot-journal';
import { journalEntryFor } from '../../src/ui/read-models/snapshot-comparison';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import type { CreateCityRenderer } from '../../src/visualization/renderer-port';
import { createFakeFallowAnalysis, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import {
  HARNESS_BINDING, cancellingLifecycle, completedAnalysisState, demoCollectedReport, demoEvidenceReport,
  demoInvestigation, failedAnalysisState, runningAnalysisState, runningLifecycle, seedDemoItems,
} from '../harness/seed';
import { harnessLayout, harnessSnapshot } from '../harness/fixture';
import { expectNoSeriousViolations, type AxeCaseOptions } from '../support/axe';

export interface LeafOptions {
  route: RouteId;
  /** The synthetic fallow report attached (default true: every screen with content). */
  report?: boolean;
  analysis?: 'running' | 'failed' | 'collected';
  run?: 'running' | 'cancelling';
  items?: boolean;
  investigate?: boolean;
  /** A second snapshot in the journal, so Evolution and the snapshot selector compare. */
  twoSnapshots?: boolean;
  createCityRenderer?: CreateCityRenderer | null;
  /** The leaf's border-box width: wide (inline nav) by default; narrow is S10's drawer layout. */
  leafWidth?: number;
}

export interface Leaf {
  root: HTMLElement;
  analysis: FakeFallowAnalysis;
  store: ReturnType<typeof useCityStore>;
}

let unmountCurrent: (() => void) | null = null;

export async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) { await flushPromises(); await nextTick(); }
}

export async function mountLeaf(options: LeafOptions): Promise<Leaf> {
  setActivePinia(createPinia());
  useEvidenceStore().setRepository(new InMemoryEvidenceStore());
  const analysis = createFakeFallowAnalysis();
  useAnalysisStore().setService(analysis);
  const store = useCityStore();
  const snapshot = harnessSnapshot();
  if (options.twoSnapshots) {
    const first = { ...harnessSnapshot(), snapshotId: 'harness-first' };
    store.setCity(first, harnessLayout());
    useSnapshotJournal().record(journalEntryFor(first, fileSummariesFor(first)));
  }
  store.setCity(snapshot, harnessLayout());
  if (options.twoSnapshots) useSnapshotJournal().record(journalEntryFor(snapshot, fileSummariesFor(snapshot)));
  if (options.run) useRunStore().setLifecycle(options.run === 'running' ? runningLifecycle() : cancellingLifecycle());
  const evidence = useEvidenceStore();
  evidence.bindRepository(snapshot.repositoryId);
  if (options.analysis) {
    analysis.setBinding(snapshot.repositoryId, HARNESS_BINDING);
    if (options.analysis === 'running') analysis.setState(snapshot.repositoryId, runningAnalysisState(snapshot));
    if (options.analysis === 'failed') {
      evidence.attach({ ...demoEvidenceReport(snapshot), staleReason: 'failed-run' });
      analysis.setState(snapshot.repositoryId, failedAnalysisState());
    }
    if (options.analysis === 'collected') {
      evidence.attach(demoCollectedReport(snapshot));
      analysis.setState(snapshot.repositoryId, completedAnalysisState(snapshot));
    }
  } else if (options.report !== false) {
    if (!evidence.attach(demoEvidenceReport(snapshot))) throw new Error('axe leaf: the demo report was refused');
  }
  store.navigate(options.route);

  const root = document.body.createDiv({ cls: 'codebase-inspector-root' });
  const width = options.leafWidth ?? 1280;
  root.getBoundingClientRect = () => ({ width, height: 800, top: 0, left: 0, right: width, bottom: 800, x: 0, y: 0, toJSON: () => ({}) });
  const wrapper = mount(App, {
    attachTo: root,
    global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: options.createCityRenderer ?? null } },
  });
  unmountCurrent = () => { wrapper.unmount(); };
  await settle();
  if (options.items) {
    await useReviewStore().load();
    await seedDemoItems((store.layout?.lots ?? []).slice(0, 3).map((l) => l.entityId));
    await settle();
  }
  if (options.investigate) {
    const { notes, preview, fingerprint } = demoInvestigation(snapshot, 'demo');
    const investigation = useInvestigationStore();
    investigation.setPorts(notes, preview);
    investigation.open(fingerprint);
    await settle();
  }
  return { root, analysis, store };
}

export function unmountLeaf(): void {
  unmountCurrent?.();
  unmountCurrent = null;
  document.body.empty();
  restoreStage?.();
  restoreStage = null;
}

let restoreStage: (() => void) | null = null;

/** `base`, except on the city stage, which reports `size`. */
function stageSized(base: PropertyDescriptor | undefined, size: number): PropertyDescriptor {
  return {
    configurable: true,
    get(this: HTMLElement): number { return this.classList.contains('ci-viewport__stage') ? size : (base?.get?.call(this) as number | undefined) ?? 0; },
  };
}

const none = (): void => {};

/** jsdom has no layout, so the city stage's content box is 0 x 0 and CityViewport never
 *  consults its factory. This gives `.ci-viewport__stage` alone an 800 x 600 box (restored
 *  by unmountLeaf), so the factory runs and the city reaches its live or WebGL-failed state. */
export function sizeCityStage(): void {
  const proto = HTMLElement.prototype;
  const width = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
  const height = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
  Object.defineProperty(proto, 'clientWidth', stageSized(width, 800));
  Object.defineProperty(proto, 'clientHeight', stageSized(height, 600));
  restoreStage = () => {
    if (width) Object.defineProperty(proto, 'clientWidth', width);
    if (height) Object.defineProperty(proto, 'clientHeight', height);
  };
}

/** A renderer that draws nothing (jsdom has no WebGL); `failed` reports what the real
 *  createCityRenderer reports when WebGL construction throws: unavailable, synchronously. */
export function inertRenderer(failed = false): CreateCityRenderer {
  return (_el, _win, onEvent) => {
    if (failed) onEvent({ type: 'unavailable', reason: 'initialization-failed' });
    const camera = { projection: 'orthographic' as const, mode: '3d' as const, position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number], zoom: 1 };
    return {
      setLayout: () => Promise.resolve(), setColors: none, setSelection: none, setFilter: none, setReported: none,
      setRelations: none, setLabels: none, setCameraMode: none, setMotion: none, getCamera: () => camera,
      setCamera: none, nudgeCamera: none, focus: none, fit: none, resize: none, pause: none, resume: none, dispose: none,
      getDiagnostics: () => ({ geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false }),
      debugLoseContext: none,
    };
  };
}

/** Clicks a Tabs.vue tab by its id and lets the panel render. */
export async function openTab(root: ParentNode, id: string): Promise<void> {
  const tab = root.querySelector<HTMLElement>(`[role="tab"][data-tab-id="${id}"]`);
  if (!tab) throw new Error(`axe leaf: no tab ${id}`);
  tab.click();
  await settle();
}

/** Settles until `selector` renders (an async open: a note read, a file parse), or throws. */
export async function waitFor(root: ParentNode, selector: string): Promise<HTMLElement> {
  for (let i = 0; i < 40; i += 1) {
    const found = root.querySelector<HTMLElement>(selector);
    if (found) return found;
    await settle();
  }
  throw new Error(`axe leaf: ${selector} never rendered`);
}

/** Clicks the first element matching `selector`, or throws: a missing trigger is a broken case. */
export async function click(root: ParentNode, selector: string): Promise<void> {
  const target = root.querySelector<HTMLElement>(selector);
  if (!target) throw new Error(`axe leaf: no ${selector} to click`);
  target.click();
  await settle();
}

/** Fails unless the screen rendered real content (never a vacuous pass), then runs axe. */
export async function expectAccessible(root: Element, contentSelector: string, options?: AxeCaseOptions): Promise<void> {
  if (root.querySelector(contentSelector) === null) throw new Error(`axe leaf: ${contentSelector} did not render; axe would pass vacuously`);
  await expectNoSeriousViolations(root, options);
}
