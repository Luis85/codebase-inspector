// Runs the shared ProfileStore contract against BOTH an in-memory fake AND the real
// plugin.loadData()/saveData()-backed store (ruling M24), so a change to one cannot
// silently drift from the other.
import { runProfileStoreContract } from '../contracts/profile-store.contract';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { PluginDataProfileStore } from '../../src/adapters/storage/plugin-data-profile-store';
import { Plugin } from '../mocks/obsidian';
import type { ProfileStoreHarness } from '../contracts/profile-store.contract';
import type { Plugin as ObsidianPlugin } from 'obsidian';

runProfileStoreContract('fake (in-memory)', () => Promise.resolve(createFakeProfileStoreHarness()));

function makeRealHarness(): ProfileStoreHarness {
  // One cast at the boundary, matching tests/host/plugin-onload.test.ts's established
  // idiom: the mock Plugin implements only loadData/saveData and the members task 6
  // needs, not the full real Obsidian Plugin interface.
  const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
  return {
    store: new PluginDataProfileStore(plugin),
    writeRaw: (raw) => plugin.saveData(raw),
    reopen: () => new PluginDataProfileStore(plugin),
  };
}

runProfileStoreContract('plugin.loadData()/saveData() (real store)', () => Promise.resolve(makeRealHarness()));
