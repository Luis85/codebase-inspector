// Fix round 1, Critical 1: writePluginDataSlice's read-modify-write against the whole
// data.json document had no locking, so two calls fired without an await between them
// (exactly what two near-simultaneous settings-tab events produce) could interleave and
// silently lose one side's write. These tests reproduce both named failure modes
// directly against the lock primitives, independent of any store or UI wiring.
import { describe, expect, it } from 'vitest';
import { Plugin } from '../mocks/obsidian';
import { asUnknownArray, readPluginData, updatePluginDataRecord, writePluginDataSlice } from '../../src/adapters/storage/plugin-data-shape';
import type { Plugin as ObsidianPlugin } from 'obsidian';

function makePlugin(): ObsidianPlugin {
  return new Plugin({}, {}) as unknown as ObsidianPlugin;
}

describe('plugin-data-shape locking', () => {
  it('does not lose either write when two writePluginDataSlice calls for DIFFERENT keys race', async () => {
    const plugin = makePlugin();
    // Fired without an await between them -- this is what the reviewer's
    // reproduction #1 did (profileStore.save(...) and bindingStore.save(...) with no
    // await between them), and is exactly what two near-simultaneous settings-tab
    // events produce in practice.
    const a = writePluginDataSlice(plugin, 'profiles', () => [{ profileId: 'p1' }]);
    const b = writePluginDataSlice(plugin, 'bindings', () => [{ bindingId: 'b1' }]);
    await Promise.all([a, b]);

    const data = await readPluginData(plugin);
    expect(data.profiles).toEqual([{ profileId: 'p1' }]);
    expect(data.bindings).toEqual([{ bindingId: 'b1' }]);
  });

  it('does not lose either write when two writePluginDataSlice calls for the SAME key race', async () => {
    const plugin = makePlugin();
    const a = writePluginDataSlice(plugin, 'profiles', (current) =>
      [...asUnknownArray(current), { profileId: 'a' }]);
    const b = writePluginDataSlice(plugin, 'profiles', (current) =>
      [...asUnknownArray(current), { profileId: 'b' }]);
    await Promise.all([a, b]);

    const data = await readPluginData(plugin);
    const ids = (data.profiles as { profileId: string }[]).map((p) => p.profileId).sort();
    // Not vacuous: an unlocked read-modify-write drops one of these two entries,
    // because both writes read the SAME empty starting array before either commits.
    expect(ids).toEqual(['a', 'b']);
  });

  it('updatePluginDataRecord applies both mutations when two calls race on the SAME record', async () => {
    // Mirrors the reviewer's reproduction #2 exactly: settings-tab.ts's old
    // updateProfile() did get() -> mutate -> save() from OUTSIDE any lock, so a second
    // call's save() could silently overwrite a first call's edit with a stale full
    // snapshot taken before the first call's write landed.
    const plugin = makePlugin();
    await writePluginDataSlice(plugin, 'profiles', () => [{ profileId: 'p1', name: 'Original', exclusions: [] }]);

    const rename = updatePluginDataRecord(plugin, 'profiles', 'profileId', 'p1',
      (current) => ({ ...(current as object), name: 'Renamed' }));
    const editExclusions = updatePluginDataRecord(plugin, 'profiles', 'profileId', 'p1',
      (current) => ({ ...(current as object), exclusions: ['dist'] }));
    await Promise.all([rename, editExclusions]);

    const data = await readPluginData(plugin);
    const profile = (data.profiles as { name: string; exclusions: string[] }[])[0]!;
    // Not vacuous: without the lock, whichever call's save() lands second wins with ITS
    // OWN stale read of the record, discarding the other call's field entirely -- this
    // asserts BOTH fields survive, not just "the record still exists".
    expect(profile.name).toBe('Renamed');
    expect(profile.exclusions).toEqual(['dist']);
  });

  it('updatePluginDataRecord returns false and changes nothing for an unknown id', async () => {
    const plugin = makePlugin();
    await writePluginDataSlice(plugin, 'profiles', () => [{ profileId: 'p1' }]);
    const applied = await updatePluginDataRecord(plugin, 'profiles', 'profileId', 'missing', () => ({}));
    expect(applied).toBe(false);
    const data = await readPluginData(plugin);
    expect(data.profiles).toEqual([{ profileId: 'p1' }]);
  });

  it('one rejecting operation does not jam the queue for later, unrelated operations', async () => {
    const plugin = makePlugin();
    const failing = writePluginDataSlice(plugin, 'profiles', () => { throw new Error('boom'); });
    await expect(failing).rejects.toThrow('boom');
    // If a rejection permanently poisoned the shared chain, this would hang or reject too.
    await writePluginDataSlice(plugin, 'profiles', () => [{ profileId: 'after-failure' }]);
    const data = await readPluginData(plugin);
    expect(data.profiles).toEqual([{ profileId: 'after-failure' }]);
  });
});
