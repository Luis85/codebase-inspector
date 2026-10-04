// Gap closure GRA8 fix round: the toolbar's codebase name is the PROFILE's current name whichever order
// Obsidian delivers setState and onOpen in (spec 11's open question), and a later setState never blanks it.
// onOpen runs while the state's profileId may still be null, so setState must refresh too. Routed to jsdom
// by vitest.config.ts's `tests/host/city-view*.test.ts`.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { Pinia } from 'pinia';
import { CityView } from '../../src/host/city-view';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { writePluginDataSlice } from '../../src/adapters/storage/plugin-data-shape';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { defaultCityViewState } from '../../src/host/view-state';
import { makePluginDouble } from '../fixtures/city-view-doubles';
import { useCityStore } from '../../src/ui/stores/city-store';
import type { CityViewDeps } from '../../src/host/city-view';
import type { CityViewState } from '../../src/domain/model';

vi.mock('../../src/visualization/city-renderer', () => ({ createCityRenderer: vi.fn(() => null) }));

const PERSISTED: CityViewState = { ...defaultCityViewState(), profileId: 'p1', name: 'Old name' };

async function build() {
  const harness = createFakeProfileStoreHarness();
  await harness.store.save({ profileId: 'p1', name: 'Current name', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 });
  const get = vi.spyOn(harness.store, 'get');
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  const port = createFakeSourceFileSystem({ 'a.ts': 'x' }).port;
  const deps: CityViewDeps = { profileStore: harness.store, getFilesystem: () => port, snapshotStore, clock: createFixedClock(), ...dataPortDeps() };
  const data: Record<string, unknown> = {};
  const plugin = { ...makePluginDouble(), loadData: vi.fn(async () => data), saveData: vi.fn(async (next: Record<string, unknown>) => { Object.assign(data, next); }) };
  const { view, nameOf } = openLeaf(plugin, deps);
  return { view, plugin, get, nameOf, harness, deps };
}

/** One more leaf on the same plugin data and the same profile store (a second pane). */
function openLeaf(plugin: ReturnType<typeof makePluginDouble>, deps: CityViewDeps) {
  const view = new CityView({ width: 1000 } as never, plugin as never, deps);
  const nameOf = (): string | undefined => useCityStore((view as unknown as { pinia: Pinia }).pinia).name;
  return { view, nameOf };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i += 1) { await Promise.resolve(); await nextTick(); }
}

describe('the codebase name resolves in either setState/onOpen order (GRA8)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('(a) setState before onOpen: the profile\'s current name beats the persisted one', async () => {
    const { view, nameOf } = await build();
    await view.setState(PERSISTED, {} as never);
    await view.onOpen();
    await settle();
    expect(nameOf()).toBe('Current name');
    await view.onClose();
  });

  it('(b) onOpen before setState: the same result', async () => {
    const { view, nameOf } = await build();
    await view.onOpen();
    await settle();
    await view.setState(PERSISTED, {} as never);
    await settle();
    expect(nameOf()).toBe('Current name');
    await view.onClose();
  });

  it('(c) a later setState without a name brings the resolved name back', async () => {
    const { view, nameOf } = await build();
    await view.onOpen();
    await view.setState(PERSISTED, {} as never);
    await settle();
    expect(nameOf()).toBe('Current name');
    await view.setState({ ...defaultCityViewState(), profileId: 'p1' }, {} as never);
    await settle();
    expect(nameOf()).toBe('Current name');
    await view.onClose();
  });

  it('(d) onClose drops the watcher: a later profiles write reads nothing', async () => {
    const { view, plugin, get } = await build();
    await view.setState(PERSISTED, {} as never);
    await view.onOpen();
    await settle();
    await writePluginDataSlice(plugin as never, 'profiles', () => [{ profileId: 'p1' }]);
    await settle();
    const whileOpen = get.mock.calls.length;
    expect(whileOpen).toBeGreaterThan(1);   // the watcher is live while the leaf is open
    await view.onClose();
    await writePluginDataSlice(plugin as never, 'profiles', () => [{ profileId: 'p1' }, { profileId: 'p2' }]);
    await settle();
    expect(get.mock.calls.length).toBe(whileOpen);
  });

  // Final review RF4: the name belongs to the PROFILE, so two leaves on one profile both follow a
  // rename made elsewhere (Settings writes the profiles slice); each leaf holds its own watcher.
  it('(e) two leaves on the same profile both show a rename', async () => {
    const first = await build();
    const second = openLeaf(first.plugin, first.deps);
    await first.view.setState(PERSISTED, {} as never);
    await first.view.onOpen();
    await second.view.setState(PERSISTED, {} as never);
    await second.view.onOpen();
    await settle();
    expect(first.nameOf()).toBe('Current name');
    expect(second.nameOf()).toBe('Current name');
    await first.harness.store.save({ profileId: 'p1', name: 'Renamed', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 });
    await writePluginDataSlice(first.plugin as never, 'profiles', () => [{ profileId: 'p1' }]);
    await settle();
    expect(first.nameOf()).toBe('Renamed');
    expect(second.nameOf()).toBe('Renamed');
    await first.view.onClose();
    await second.view.onClose();
  });
});
