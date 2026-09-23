// Part 6 Y11/R2: a real CityView hands its review store the plugin's registry before mount,
// so App's first bind builds the codebase's repository through it, and on close detaches
// the store, so the plugin-level repository stops calling into a dead leaf. Routed to the
// jsdom project by vitest.config.ts's `tests/host/city-view*.test.ts`.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { CityView } from '../../src/host/city-view';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import { createInMemoryReviewRepository, type ReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { makePluginDouble } from '../fixtures/city-view-doubles';
import type { CameraBookmark, CodebaseSnapshot } from '../../src/domain/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';
import type { CityViewDeps } from '../../src/host/city-view';
import type { ProfileStore } from '../../src/application/ports/profile-store';

const DUMMY_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};
const inertPort: CityRendererPort = {
  setLayout: vi.fn(() => Promise.resolve()), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setReported: vi.fn(),
  setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
  getCamera: vi.fn((): CameraBookmark => DUMMY_CAMERA), setCamera: vi.fn(), nudgeCamera: vi.fn(),
  focus: vi.fn(), fit: vi.fn(), resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
  getDiagnostics: vi.fn(() => ({
    geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
  })),
  debugLoseContext: vi.fn(),
};
vi.mock('../../src/visualization/city-renderer', () => ({ createCityRenderer: vi.fn(() => inertPort) }));

function publishedSnapshot(): CodebaseSnapshot {
  return {
    ...buildSnapshotFixture({ files: 1, repositoryId: 'p1' }),
    snapshotId: 's1',
    scope: { rootPath: '/fake-root', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false as const },
  };
}

const profileStore: ProfileStore = {
  list: vi.fn(() => Promise.resolve([])), get: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve()), remove: vi.fn(() => Promise.resolve()), update: vi.fn(() => Promise.resolve()),
};

describe('CityView data ports (Part 6 Y11, R2)', () => {
  it('binds the review store through reviewRepositoryFor, and detaches it on close', async () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    const repo: ReviewRepository = { ...createInMemoryReviewRepository(), subscribe };
    const reviewRepositoryFor = vi.fn(() => repo);
    const snapshotStore = new InMemorySnapshotStore(createFixedClock());
    snapshotStore.put(publishedSnapshot());
    const deps: CityViewDeps = {
      ...dataPortDeps(), profileStore, getFilesystem: () => createFakeSourceFileSystem({}).port, snapshotStore,
      clock: createFixedClock(), reviewRepositoryFor,
    };
    const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, deps);
    await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1', route: 'city' }, {} as never);
    await view.onOpen();
    await flushPromises();
    expect(reviewRepositoryFor).toHaveBeenCalledWith('p1');
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
    await view.onClose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
