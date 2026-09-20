// The CityView harness the host lifecycle scenarios share: a real `CityView` (the real
// ItemView, the real Vue mount, the real Pinia stores, the real reconciliation) over
// doubles for only what Obsidian itself provides -- a workspace that records its
// `css-change` subscribers, a vault with a configDir, and an in-memory SnapshotStore
// every view built here shares, exactly as main.ts's own one is shared.
//
// Lives outside steps/ so lifecycle-steps.ts stays inside the tests/** 450-line cap.
import { expect, vi } from 'vitest';
import { nextTick } from 'vue';
import { CityView, CITY_VIEW_TYPE } from '../../src/host/city-view';
import { defaultCityViewState } from '../../src/host/view-state';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { rendererControl } from './world';
import type { World, RendererCall } from './world';
import type { CityViewDeps } from '../../src/host/city-view';
import type { ProfileStore } from '../../src/application/ports/profile-store';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';
import type { CodebaseProfile } from '../../src/domain/model';

export interface ViewHarness {
  deps: CityViewDeps;
  port: SourceFileSystemPort;
  app: { workspace: Record<string, unknown>; vault: Record<string, unknown> };
  plugin: unknown;
  views: CityView[];
  cssChange: (() => void)[];
  open(profileId: string, files: number): Promise<CityView>;
}

function makeProfileStoreDouble(): ProfileStore {
  const profiles: CodebaseProfile[] = [];
  return {
    list: vi.fn(async () => [...profiles]),
    get: vi.fn(async (id: string) => profiles.find((p) => p.profileId === id) ?? null),
    save: vi.fn(async (p: CodebaseProfile) => { profiles.push(p); }),
    remove: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
  };
}

export function sizeStage(view: CityView, width = 1000, height = 700): void {
  const stage = view.contentEl.querySelector<HTMLElement>('[data-ci-role="stage"]');
  expect(stage, 'the view has no stage element').not.toBeNull();
  Object.defineProperty(stage!, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(stage!, 'clientHeight', { value: height, configurable: true });
}

export function makeViewHarness(world: World): ViewHarness {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  const { port } = createFakeSourceFileSystem({ 'src/a.ts': 'export const a = 1;\n' });
  const deps: CityViewDeps = {
    profileStore: makeProfileStoreDouble(), getFilesystem: () => port,
    snapshotStore, clock: createFixedClock(),
  };
  const cssChange: (() => void)[] = [];
  const views: CityView[] = [];
  const app = {
    workspace: {
      on: vi.fn((event: string, cb: () => void) => { if (event === 'css-change') cssChange.push(cb); return {}; }),
      offref: vi.fn(),
      getLeavesOfType: vi.fn((type: string) => (type === CITY_VIEW_TYPE ? views.map((view) => ({ view })) : [])),
      onLayoutReady: vi.fn(),
    },
    vault: { adapter: { read: vi.fn(), list: vi.fn() }, configDir: '.obsidian' },
  };
  const plugin = { app, addCommand: vi.fn(), registerView: vi.fn() };
  const harness: ViewHarness = {
    deps, port, app, plugin, views, cssChange,
    async open(profileId: string, files: number): Promise<CityView> {
      snapshotStore.put({ ...buildSnapshotFixture({ files, directories: 2, repositoryId: profileId }), snapshotId: `snap-${profileId}` });
      const view = new CityView({ width: 1000, height: 700 } as never, plugin as never, deps);
      await view.setState({ ...defaultCityViewState(), profileId, snapshotId: `snap-${profileId}` }, {} as never);
      await view.onOpen();
      sizeStage(view);
      await nextTick();
      await nextTick();
      views.push(view);
      world.cleanups.push(async () => { await view.onClose(); });
      return view;
    },
  };
  return harness;
}

export function rows(view: CityView): HTMLButtonElement[] {
  return Array.from(view.contentEl.querySelectorAll<HTMLButtonElement>('button.ci-file-list__row'));
}

export function callFor(view: CityView): RendererCall {
  const call = rendererControl.calls.find((c) => view.contentEl.contains(c.mountEl));
  expect(call, 'no renderer was constructed for this view').toBeDefined();
  return call!;
}
