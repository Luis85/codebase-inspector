// WP-04 Task 8 (IN18, IN19, IP27): the durable data.json `investigations` slice. read()
// decodes the shape-checked entry -- a missing entry, a non-object slice, a non-object
// entry, a non-string folder, an over-long folder and an inherited key all resolve as
// null (IN19: the caller's own default applies instead of a malformed value). write()/
// purge() touch only their own profile's entry -- profiles, bindings, reviews and
// analyzers are carried over verbatim -- and Polish E7's same-reference rule means
// writing the value already stored, or purging an entry that is not there, saves nothing.
import { describe, expect, it, vi } from 'vitest';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { createPluginDataInvestigationStore } from '../../src/adapters/storage/plugin-data-investigation-store';
import { NOTE_FOLDER_MAX } from '../../src/application/investigation/note-path';

const newPlugin = (): ObsidianPlugin => new Plugin({}, {}) as unknown as ObsidianPlugin;

describe('the durable investigation folder store: read (IN19)', () => {
  it('reads the stored folder for a valid entry', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ investigations: { p1: { folder: 'Notes' } } });
    expect(await createPluginDataInvestigationStore(plugin).read('p1')).toBe('Notes');
  });

  it('is null for a missing entry', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ investigations: { p1: { folder: 'Notes' } } });
    expect(await createPluginDataInvestigationStore(plugin).read('p2')).toBeNull();
  });

  it('is null for a non-object slice', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ investigations: 'not an object' });
    expect(await createPluginDataInvestigationStore(plugin).read('p1')).toBeNull();
  });

  it('is null for a non-object entry ({ p1: "Notes" })', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ investigations: { p1: 'Notes' } });
    expect(await createPluginDataInvestigationStore(plugin).read('p1')).toBeNull();
  });

  it('is null when folder is not a string ({ p1: { folder: 7 } })', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ investigations: { p1: { folder: 7 } } });
    expect(await createPluginDataInvestigationStore(plugin).read('p1')).toBeNull();
  });

  it('is null for an over-long folder', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ investigations: { p1: { folder: 'x'.repeat(NOTE_FOLDER_MAX + 1) } } });
    expect(await createPluginDataInvestigationStore(plugin).read('p1')).toBeNull();
  });

  it('never resolves an inherited key (toString) as a stored entry', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ investigations: {} });
    expect(await createPluginDataInvestigationStore(plugin).read('toString')).toBeNull();
  });
});

describe('the durable investigation folder store: write and purge (Polish E7)', () => {
  it('writing the value already stored saves nothing', async () => {
    const plugin = newPlugin();
    const store = createPluginDataInvestigationStore(plugin);
    await store.write('p1', 'Notes');
    const save = vi.spyOn(plugin, 'saveData');
    await store.write('p1', 'Notes');
    expect(save).not.toHaveBeenCalled();
  });

  it('purging a missing entry saves nothing', async () => {
    const plugin = newPlugin();
    const store = createPluginDataInvestigationStore(plugin);
    const save = vi.spyOn(plugin, 'saveData');
    await store.purge('p1');
    expect(save).not.toHaveBeenCalled();
  });

  it('write and purge keep other profiles’ entries', async () => {
    const plugin = newPlugin();
    const store = createPluginDataInvestigationStore(plugin);
    await store.write('p1', 'Notes/One');
    await store.write('p2', 'Notes/Two');
    await store.purge('p1');
    expect(await store.read('p1')).toBeNull();
    expect(await store.read('p2')).toBe('Notes/Two');
  });

  it('writes only its own key: profiles, bindings, reviews and analyzers are carried over verbatim', async () => {
    const plugin = newPlugin();
    const others = {
      profiles: [{ profileId: 'p1' }], bindings: [{ bindingId: 'b1' }],
      reviews: { p1: { v: 1 } }, analyzers: { p1: { v: 1 } },
    };
    await plugin.saveData(others);
    await createPluginDataInvestigationStore(plugin).write('p1', 'Notes');
    expect(await plugin.loadData()).toMatchObject(others);
  });

  it('survives a restart: a new store on the same data.json reads the record', async () => {
    const plugin = newPlugin();
    await createPluginDataInvestigationStore(plugin).write('p1', 'Notes/Alpha');
    expect(await createPluginDataInvestigationStore(plugin).read('p1')).toBe('Notes/Alpha');
  });
});
