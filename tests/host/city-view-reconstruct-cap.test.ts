// Gap closure Task 4 (GRA2, F14, M80): the context-loss self-heal (CityViewport's
// dispose-and-reconstruct) used to be unbounded, so a GPU that kept losing the context
// rebuilt the renderer forever. The view now caps AUTOMATIC reconstruction at 3; after that
// the leaf shows COPY-14 (the 3D-unavailable notice) and the factory is not called again.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { CityView } from '../../src/host/city-view';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import { makePluginDouble } from '../fixtures/city-view-doubles';
import { COPY_14 } from '../../src/ui/copy';
import type { CameraBookmark, CodebaseSnapshot } from '../../src/domain/model';
import type { CityRendererEvent, CityRendererPort } from '../../src/visualization/renderer-port';
import type { CityViewDeps } from '../../src/host/city-view';

const CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};

let emitters: Array<(e: CityRendererEvent) => void> = [];

function makePort(): CityRendererPort {
  return {
    setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setReported: vi.fn(),
    setRelations: vi.fn(), setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn((): CameraBookmark => CAMERA), setCamera: vi.fn(), nudgeCamera: vi.fn(), focus: vi.fn(), fit: vi.fn(),
    resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
    })),
    debugLoseContext: vi.fn(),
  };
}

vi.mock('../../src/visualization/city-renderer', () => ({
  createCityRenderer: vi.fn((_mountEl: HTMLElement, _win: Window, onEvent: (e: CityRendererEvent) => void) => {
    emitters.push(onEvent);
    return makePort();
  }),
}));
const { createCityRenderer: createRendererSpy } = await import('../../src/visualization/city-renderer');

async function openIn3dWithSnapshot(): Promise<CityView> {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  const snapshot: CodebaseSnapshot = { ...buildSnapshotFixture({ files: 2, repositoryId: 'p1' }), snapshotId: 's1' };
  snapshotStore.put(snapshot);
  const { port } = createFakeSourceFileSystem({});
  const deps: CityViewDeps = {
    profileStore: {
      list: vi.fn(async () => []), get: vi.fn(async () => null), save: vi.fn(async () => {}),
      remove: vi.fn(async () => {}), update: vi.fn(async () => {}),
    },
    getFilesystem: () => port, snapshotStore, clock: createFixedClock(), ...dataPortDeps(),
  };
  const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, deps);
  await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1', viewMode: '3d', route: 'city' }, {} as never);
  await view.onOpen();
  await nextTick();
  return view;
}

describe('CityView: automatic reconstruction is capped (GRA2)', () => {
  beforeEach(() => {
    emitters = [];
    vi.mocked(createRendererSpy).mockClear();
  });

  it('builds the renderer 4 times in all (1 + 3 reconstructions), then shows COPY-14', async () => {
    const view = await openIn3dWithSnapshot();
    expect(createRendererSpy).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 4; i += 1) {
      emitters[emitters.length - 1]!({ type: 'unavailable', reason: 'context-lost' });
      await nextTick();
      await nextTick();
    }
    expect(createRendererSpy).toHaveBeenCalledTimes(4);
    expect(view.contentEl.textContent).toContain(COPY_14);
  });
});
