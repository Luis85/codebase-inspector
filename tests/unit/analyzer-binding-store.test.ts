// Part 7 Z1–Z3: the durable plugin-data store and the in-memory double both pass the one
// contract; the durable one also keeps every other data.json key and survives a restart.
import { describe, expect, it } from 'vitest';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { createPluginDataAnalyzerStore } from '../../src/adapters/storage/plugin-data-analyzer-store';
import { CONTRACT_MACHINE, runAnalyzerBindingStoreContract } from '../contracts/analyzer-binding-store.contract';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';

const newPlugin = (): ObsidianPlugin => new Plugin({}, {}) as unknown as ObsidianPlugin;

runAnalyzerBindingStoreContract('plugin-data', async (initial) => {
  const plugin = newPlugin();
  if (initial !== undefined) await plugin.saveData({ analyzers: initial });
  const store = createPluginDataAnalyzerStore(plugin, CONTRACT_MACHINE);
  return { store, slice: async () => ((await plugin.loadData()) as { analyzers?: unknown } | null)?.analyzers };
});

runAnalyzerBindingStoreContract('in-memory', (initial) => {
  const store = createInMemoryAnalyzerStore(CONTRACT_MACHINE, initial);
  return Promise.resolve({ store, slice: () => Promise.resolve(store.slice()) });
});

describe('the durable analyzer store (Z1, Z3)', () => {
  it('writes only its own key: profiles, bindings and reviews are carried over verbatim', async () => {
    const plugin = newPlugin();
    const others = { profiles: [{ profileId: 'p1' }], bindings: [{ bindingId: 'b1' }], reviews: { p1: { v: 1 } } };
    await plugin.saveData(others);
    await createPluginDataAnalyzerStore(plugin, 'm').bind('p1', 'C:\\Tools\\fallow\\fallow.exe');
    expect(await plugin.loadData()).toMatchObject(others);
  });

  it('survives a restart: a new store on the same data.json reads the record', async () => {
    const plugin = newPlugin();
    await createPluginDataAnalyzerStore(plugin, 'm').bind('p1', 'C:\\Tools\\fallow\\fallow.exe');
    expect(await createPluginDataAnalyzerStore(plugin, 'm').read('p1')).toMatchObject({ kind: 'bound' });
  });

  it('never caches: a change made outside the store shows on the next read (Z3)', async () => {
    const plugin = newPlugin();
    const store = createPluginDataAnalyzerStore(plugin, 'm');
    await store.bind('p1', 'C:\\Tools\\fallow\\fallow.exe');
    await plugin.saveData({});
    expect(await store.read('p1')).toEqual({ kind: 'none' });
  });

  it('serialises two concurrent writes under the one data lock', async () => {
    const plugin = newPlugin();
    const store = createPluginDataAnalyzerStore(plugin, 'm');
    await Promise.all([store.bind('p1', 'C:\\a\\fallow.exe'), store.bind('p2', 'C:\\b\\fallow.exe')]);
    expect(Object.keys(((await plugin.loadData()) as { analyzers: Record<string, unknown> }).analyzers).sort()).toEqual(['p1', 'p2']);
  });
});
