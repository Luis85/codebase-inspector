// Mirrors profile-store.test.ts (ruling M24).
import { runBindingStoreContract } from '../contracts/binding-store.contract';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { PluginDataBindingStore, getOrCreateMachineId } from '../../src/adapters/storage/plugin-data-binding-store';
import { Plugin } from '../mocks/obsidian';
import type { BindingStoreHarness } from '../contracts/binding-store.contract';
import type { App, Plugin as ObsidianPlugin } from 'obsidian';

runBindingStoreContract('fake (in-memory)', () => Promise.resolve(createFakeBindingStoreHarness()));

// A minimal App double: just enough of loadLocalStorage/saveLocalStorage for
// getOrCreateMachineId to compute and persist a stable per-"machine" value, faithful to
// the real, decade-stable localStorage-backed API (obsidian.d.ts since 1.8.7).
function makeFakeApp(): App {
  const store = new Map<string, unknown>();
  return {
    loadLocalStorage: (key: string) => (store.has(key) ? store.get(key) : null),
    saveLocalStorage: (key: string, data: unknown) => {
      if (data === null) store.delete(key); else store.set(key, data);
    },
  } as unknown as App;
}

function makeRealHarness(): BindingStoreHarness {
  // One cast at the boundary, matching tests/host/plugin-onload.test.ts's established
  // idiom -- see profile-store.test.ts's identical comment.
  const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
  const machineId = getOrCreateMachineId(makeFakeApp());
  return {
    store: new PluginDataBindingStore(plugin, machineId),
    writeRaw: (raw) => plugin.saveData(raw),
    reopen: () => new PluginDataBindingStore(plugin, machineId),
  };
}

runBindingStoreContract('plugin.loadData()/saveData() (real store)', () => Promise.resolve(makeRealHarness()));
