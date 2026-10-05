// Gap closure GRB1 (Y19, GCO7): a data.json changed outside the plugin is heard by every watcher once,
// whatever slices it watches, with notifyWritten's isolation, and the notification writes nothing.
import { describe, expect, it, vi } from 'vitest';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { notifyExternalChange, watchPluginData } from '../../src/adapters/storage/plugin-data-shape';

function makePlugin(): ObsidianPlugin {
  return new Plugin({}, {}) as unknown as ObsidianPlugin;
}

describe('notifyExternalChange (GRB1)', () => {
  it('calls every watcher once, whatever its keys', () => {
    const plugin = makePlugin();
    const heard: string[] = [];
    watchPluginData(plugin, ['profiles'], () => { heard.push('profiles'); });
    watchPluginData(plugin, ['reviews'], () => { heard.push('reviews'); });
    watchPluginData(plugin, ['bindings', 'analyzers', 'investigations'], () => { heard.push('three'); });
    notifyExternalChange(plugin);
    expect(heard).toEqual(['profiles', 'reviews', 'three']);
  });

  it('isolates a throwing watcher: the next one is still called', () => {
    const plugin = makePlugin();
    const heard: string[] = [];
    watchPluginData(plugin, ['profiles'], () => { throw new Error('the watcher failed'); });
    watchPluginData(plugin, ['investigations'], () => { heard.push('second'); });
    expect(() => { notifyExternalChange(plugin); }).not.toThrow();
    expect(heard).toEqual(['second']);
  });

  it('never writes: saveData and loadData are not called', () => {
    const plugin = makePlugin();
    const save = vi.spyOn(plugin, 'saveData');
    const load = vi.spyOn(plugin, 'loadData');
    watchPluginData(plugin, ['profiles'], () => undefined);
    notifyExternalChange(plugin);
    expect(save).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it('skips an unwatched watcher and keeps each plugin\'s watchers to itself', () => {
    const plugin = makePlugin();
    const heard: string[] = [];
    const stop = watchPluginData(plugin, ['profiles'], () => { heard.push('stopped'); });
    watchPluginData(makePlugin(), ['profiles'], () => { heard.push('other plugin'); });
    stop();
    notifyExternalChange(plugin);
    notifyExternalChange(makePlugin());
    expect(heard).toEqual([]);
  });
});
