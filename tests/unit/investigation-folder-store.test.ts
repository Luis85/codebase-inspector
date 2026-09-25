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

  // Fix round 1, item 1: pins the CODE-POINT bound (PF-C12), which 'x'.repeat(201) above
  // does not -- an ASCII 'x'.repeat(201) fails a UTF-16-length `.max(200)` too, so that
  // case alone cannot tell it apart from a bound that counts UTF-16 code units. Each
  // U+1F600 is ONE code point but TWO UTF-16 code units, so exactly NOTE_FOLDER_MAX of
  // them is 200 code points (must be accepted) but 400 UTF-16 units (a `.max(200)` on
  // code units would wrongly refuse it).
  it('accepts exactly NOTE_FOLDER_MAX code points, even as UTF-16 surrogate pairs (PF-C12)', async () => {
    const plugin = newPlugin();
    const astral = String.fromCodePoint(0x1F600).repeat(NOTE_FOLDER_MAX);
    await plugin.saveData({ investigations: { p1: { folder: astral } } });
    expect(await createPluginDataInvestigationStore(plugin).read('p1')).toBe(astral);
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

  // Fix round 1, item 2: the read test above (toString) passes even with an `in`-based
  // own-key check, because a non-object (the inherited `toString` FUNCTION) still fails
  // the zod shape check and decodes to null either way -- it cannot tell `hasOwnProperty`
  // from `in`. purge()'s early return, by contrast, only short-circuits (and so skips the
  // save) when ownEntry() truly returns undefined; `'toString' in {}` is true, so an
  // `in`-based check would treat this as "found" and go on to write a save-worthy
  // replacement object, where `hasOwnProperty` correctly finds nothing to purge.
  it('purging the inherited key toString saves nothing', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ investigations: {} });
    const store = createPluginDataInvestigationStore(plugin);
    const save = vi.spyOn(plugin, 'saveData');
    await store.purge('toString');
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
