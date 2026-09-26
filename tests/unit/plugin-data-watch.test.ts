// WP-04.2 NE9: one plugin-scoped write listener, so a surface that shows a slice (the Settings tab) hears the
// writes it did not make. Over the mock Plugin, built the way plugin-data-shape.test.ts builds it.
import { describe, expect, it } from 'vitest';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { updatePluginDataRecord, watchPluginData, writePluginDataSlice } from '../../src/adapters/storage/plugin-data-shape';

function makePlugin(): ObsidianPlugin {
  return new Plugin({}, {}) as unknown as ObsidianPlugin;
}

describe('watchPluginData (WP-04.2 NE9)', () => {
  it('notifies a watcher after a write to a watched slice settles, never for another slice or an unchanged write', async () => {
    const plugin = makePlugin();
    const heard: string[] = [];
    const stop = watchPluginData(plugin, ['profiles'], () => { heard.push('profiles'); });
    await writePluginDataSlice(plugin, 'reviews', () => ({ a: 1 }));
    await writePluginDataSlice(plugin, 'profiles', () => [{ profileId: 'p' }]);
    await writePluginDataSlice(plugin, 'profiles', (current) => current);   // unchanged: not written, not heard
    await updatePluginDataRecord(plugin, 'profiles', 'profileId', 'p', (r) => ({ ...(r as object), name: 'n' }));
    await updatePluginDataRecord(plugin, 'profiles', 'profileId', 'absent', (r) => r);   // no record: not written, not heard
    stop();
    await writePluginDataSlice(plugin, 'profiles', () => []);
    expect(heard).toEqual(['profiles', 'profiles']);
  });

  it('is heard only once the write has been saved', async () => {
    const plugin = makePlugin();
    const seen: unknown[] = [];
    watchPluginData(plugin, ['bindings'], () => { void plugin.loadData().then((data) => { seen.push(data); }); });
    await writePluginDataSlice(plugin, 'bindings', () => [{ bindingId: 'b' }]);
    await plugin.loadData();
    expect(seen).toEqual([{ bindings: [{ bindingId: 'b' }] }]);
  });

  it('a throwing watcher neither fails the write nor stops the next watcher', async () => {
    const plugin = makePlugin();
    const heard: string[] = [];
    watchPluginData(plugin, ['investigations'], () => { throw new Error('the watcher failed'); });
    watchPluginData(plugin, ['investigations', 'analyzers'], () => { heard.push('second'); });
    await expect(writePluginDataSlice(plugin, 'investigations', () => ({ p: { folder: 'Notes' } }))).resolves.toBeUndefined();
    expect(heard).toEqual(['second']);
    expect(await plugin.loadData()).toEqual({ investigations: { p: { folder: 'Notes' } } });
  });

  it('keeps each plugin\'s watchers to itself', async () => {
    const heard: string[] = [];
    watchPluginData(makePlugin(), ['profiles'], () => { heard.push('other'); });
    await writePluginDataSlice(makePlugin(), 'profiles', () => [{ profileId: 'p' }]);
    expect(heard).toEqual([]);
  });
});
