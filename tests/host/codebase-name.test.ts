// Gap closure GRA8 (GCO6): the codebase name shown in the toolbar is resolved from the profile
// store, refreshed when the profiles slice is written, and never lets a slow earlier read
// overwrite a later one. A profile that cannot be found leaves the name that is already shown.
import { describe, expect, it } from 'vitest';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { wireCodebaseName } from '../../src/host/codebase-name';
import { writePluginDataSlice } from '../../src/adapters/storage/plugin-data-shape';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import type { ProfileStore } from '../../src/application/ports/profile-store';
import type { CodebaseProfile } from '../../src/domain/model';

function profile(profileId: string, name: string): CodebaseProfile {
  return { profileId, name, bindingId: null, exclusions: [], maxFileBytes: 1_000_000 };
}

function makePlugin(): ObsidianPlugin {
  return new Plugin({}, {}) as unknown as ObsidianPlugin;
}

function setup(profileId: string | null = 'p1') {
  const plugin = makePlugin();
  const { store } = createFakeProfileStoreHarness();
  const names: (string | undefined)[] = [];
  const wired = wireCodebaseName({
    plugin, profileStore: store, profileId: () => profileId, setName: (n) => { names.push(n); },
  });
  return { plugin, store, names, wired };
}

/** Lets the (async) read and its continuation settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe('wireCodebaseName (GRA8)', () => {
  it('refresh() sets the profile name', async () => {
    const { store, names, wired } = setup();
    await store.save(profile('p1', 'My repo'));
    wired.refresh();
    await settle();
    expect(names).toEqual(['My repo']);
    wired.dispose();
  });

  it('a profiles change (a rename) updates it', async () => {
    const { plugin, store, names, wired } = setup();
    await store.save(profile('p1', 'My repo'));
    wired.refresh();
    await settle();
    await store.save(profile('p1', 'Renamed'));
    await writePluginDataSlice(plugin, 'profiles', () => [{ profileId: 'p1' }]);
    await settle();
    expect(names).toEqual(['My repo', 'Renamed']);
    wired.dispose();
  });

  it('two overlapping refreshes apply the later result, never the earlier one', async () => {
    const plugin = makePlugin();
    const releases: ((p: CodebaseProfile | null) => void)[] = [];
    const slow: ProfileStore = {
      list: () => Promise.resolve([]),
      get: () => new Promise((resolve) => { releases.push(resolve); }),
      save: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      update: () => Promise.resolve(),
    };
    const names: (string | undefined)[] = [];
    const wired = wireCodebaseName({ plugin, profileStore: slow, profileId: () => 'p1', setName: (n) => { names.push(n); } });
    wired.refresh();
    wired.refresh();
    expect(releases).toHaveLength(2);
    releases[1]!(profile('p1', 'Later'));
    await settle();
    releases[0]!(profile('p1', 'Earlier'));
    await settle();
    expect(names).toEqual(['Later']);
    wired.dispose();
  });

  it('a missing profile leaves the current name', async () => {
    const { names, wired } = setup('absent');
    wired.refresh();
    await settle();
    expect(names).toEqual([]);
    wired.dispose();
  });

  it('no profile id yet leaves the current name and reads nothing', async () => {
    const { names, wired } = setup(null);
    wired.refresh();
    await settle();
    expect(names).toEqual([]);
    wired.dispose();
  });

  it('dispose() unsubscribes', async () => {
    const { plugin, store, names, wired } = setup();
    await store.save(profile('p1', 'My repo'));
    wired.dispose();
    await writePluginDataSlice(plugin, 'profiles', () => [{ profileId: 'p1' }]);
    await settle();
    expect(names).toEqual([]);
  });
});
