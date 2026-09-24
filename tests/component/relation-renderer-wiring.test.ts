// WP-03 Task 12 (N28, N30, N31): CityStage's useRelationRenderer sends the city Relations
// section's arcs to the renderer through setRelations — exactly the listed rows, or the
// highlighted cycle's hops, or null when Show arcs is off — re-sends them to a rebuilt
// renderer, never sends null to a fresh one, and in list mode (no renderer, M75) the
// section still lists the rows.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, shallowRef, type ShallowRef } from 'vue';
import '../mocks/obsidian';
import CityStage from '../../src/ui/components/CityStage.vue';
import FileInspector from '../../src/ui/components/FileInspector.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useRelationsStore } from '../../src/ui/stores/relations-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CameraBookmark, CodebaseSnapshot } from '../../src/domain/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';
import { snapshotWithPaths } from '../fixtures/evidence-report';
import { RELATIONS_PATHS, attachRelationsReport } from '../fixtures/relations-report';

const CAMERA: CameraBookmark = { projection: 'orthographic', mode: '3d', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1 };

function makeRenderer() {
  return {
    setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setReported: vi.fn(),
    setRelations: vi.fn<CityRendererPort['setRelations']>(), setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn((): CameraBookmark => CAMERA), setCamera: vi.fn(), nudgeCamera: vi.fn(), focus: vi.fn(), fit: vi.fn(),
    resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({ geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false })),
    debugLoseContext: vi.fn(),
  } satisfies CityRendererPort;
}

let snap: CodebaseSnapshot;
const id = (path: string): string => snap.entities.find((e) => e.kind === 'file' && e.path === path)!.id;
const wrappers: { unmount(): void }[] = [];
function mountStage(handle: ShallowRef<CityRendererPort | null>) {
  const provide = { clipboard: { writeText: vi.fn(async () => {}) }, [CITY_RENDERER_KEY as symbol]: handle };
  const stage = mount(CityStage, { global: { provide } });
  const inspector = mount(FileInspector, { global: { provide } });
  wrappers.push(stage, inspector);
  return { stage, inspector };
}
const neighbourhoodArcs = () => [
  { from: id('core/a.ts'), to: id('core/b.ts'), role: 'outgoing' }, { from: id('core/c.ts'), to: id('core/a.ts'), role: 'incoming' },
];
const cycleArcs = () => [
  { from: id('core/a.ts'), to: id('core/b.ts'), role: 'cycle' }, { from: id('core/b.ts'), to: id('core/c.ts'), role: 'cycle' },
  { from: id('core/c.ts'), to: id('core/a.ts'), role: 'cycle' },
];
async function selectA(): Promise<void> {
  const city = useCityStore();
  city.select(id('core/a.ts'));
  city.openInspector();
  await nextTick();
}

beforeEach(() => {
  setActivePinia(createPinia());
  snap = snapshotWithPaths(RELATIONS_PATHS, `repo-relation-wiring-${Math.random()}`);
  useCityStore().setCity(snap, computeLayout(snap));
  attachRelationsReport(snap);
});
afterEach(() => { wrappers.splice(0).forEach((w) => { w.unmount(); }); });

describe('useRelationRenderer (N30, N31)', () => {
  it('sends the selected file\'s arcs, the highlighted cycle\'s hops, and null when Show arcs is unticked', async () => {
    const renderer = makeRenderer();
    mountStage(shallowRef<CityRendererPort | null>(renderer));
    await selectA();
    expect(renderer.setRelations).toHaveBeenLastCalledWith(neighbourhoodArcs());
    const core = useReadModels().relations.value.cycles.find((c) => c.pathText.startsWith('core/a.ts'))!;
    useRelationsStore().highlightCycle(core.findingId);
    await nextTick();
    expect(renderer.setRelations).toHaveBeenLastCalledWith(cycleArcs());
    useRelationsStore().setShowArcs(false);
    await nextTick();
    expect(renderer.setRelations).toHaveBeenLastCalledWith(null);
    expect(renderer.setCamera).not.toHaveBeenCalled();
    expect(renderer.focus).not.toHaveBeenCalled();
  });

  it('a new renderer in the handle (a context-loss rebuild) receives the current arcs again', async () => {
    const handle = shallowRef<CityRendererPort | null>(makeRenderer());
    mountStage(handle);
    await selectA();
    const rebuilt = makeRenderer();
    handle.value = rebuilt;
    await nextTick();
    expect(rebuilt.setRelations).toHaveBeenCalledTimes(1);
    expect(rebuilt.setRelations).toHaveBeenLastCalledWith(neighbourhoodArcs());
  });

  it('a fresh renderer is never sent null as a command', async () => {
    const first = makeRenderer();
    const handle = shallowRef<CityRendererPort | null>(first);
    mountStage(handle);
    await nextTick();
    expect(first.setRelations).not.toHaveBeenCalled();         // no selection: arcs are null
    useRelationsStore().setShowArcs(false);
    await selectA();
    const rebuilt = makeRenderer();
    handle.value = rebuilt;
    await nextTick();
    expect(first.setRelations).not.toHaveBeenCalled();
    expect(rebuilt.setRelations).not.toHaveBeenCalled();
  });

  it('in list mode no renderer exists and the section still lists the rows; leaving it sends the arcs', async () => {
    const city = useCityStore();
    city.setViewMode('list');
    const handle = shallowRef<CityRendererPort | null>(null);
    const { stage, inspector } = mountStage(handle);
    await selectA();
    expect(stage.find('.ci-viewport').exists()).toBe(false);
    expect(inspector.findAll('.ci-city-relations__row .ci-city-relations__path').map((p) => p.text())).toEqual(['core/b.ts · line 1 in core/a.ts', 'core/c.ts:1']);
    city.setViewMode('3d');
    const renderer = makeRenderer();
    handle.value = renderer;
    await nextTick();
    expect(stage.find('.ci-viewport').exists()).toBe(true);
    expect(renderer.setRelations).toHaveBeenLastCalledWith(neighbourhoodArcs());
  });
});
