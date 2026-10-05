// The shared suite every ProfileStore implementation must pass, so a fake and the
// plugin.loadData()/saveData()-backed store cannot drift (ruling M24, mirroring
// tests/contracts/source-filesystem-port.contract.ts's pattern from task 5).
//
// `writeRaw` bypasses the store's own validated save() path entirely, writing exactly
// what a hand-edited data.json would contain — the ONLY way to get a structurally
// invalid record into the backing store at all, since save() itself validates before
// persisting (see "rejects a profile whose maxFileBytes is not a positive integer"
// below, which exercises save()'s own guard, not writeRaw).
// `reopen` constructs a FRESH store instance bound to the SAME backing data, simulating
// a plugin reload: a store that cached anything outside its backing storage would fail
// "persists across a store reconstruction" below.
import { describe, expect, it } from 'vitest';
import type { ProfileStore } from '../../src/application/ports/profile-store';
import type { CodebaseProfile } from '../../src/domain/model';

export interface ProfileStoreHarness {
  store: ProfileStore;
  writeRaw: (raw: unknown) => Promise<void>;
  reopen: () => ProfileStore;
}

function makeProfile(overrides: Partial<CodebaseProfile> = {}): CodebaseProfile {
  return {
    profileId: 'p1', name: 'My codebase', bindingId: null,
    exclusions: ['node_modules'], maxFileBytes: 1_000_000,
    ...overrides,
  };
}

export function runProfileStoreContract(name: string, make: () => Promise<ProfileStoreHarness>): void {
  describe(`ProfileStore contract: ${name}`, () => {
    it('round-trips a saved profile', async () => {
      const { store } = await make();
      const profile = makeProfile();
      await store.save(profile);
      expect(await store.get(profile.profileId)).toEqual(profile);
      expect(await store.list()).toEqual([profile]);
    });

    it('persists across a store reconstruction', async () => {
      const { store, reopen } = await make();
      const profile = makeProfile({ profileId: 'p2' });
      await store.save(profile);
      const reconstructed = reopen();
      expect(await reconstructed.get('p2')).toEqual(profile);
    });

    it('VALIDATES persisted data on read, because data.json is untrusted input', async () => {
      // A hand-edited data.json with an unknown key must be rejected with a reason,
      // not cast (spec 4.1). Only writeRaw can construct this: save() itself validates.
      const { store, writeRaw } = await make();
      await writeRaw({ profiles: [{ ...makeProfile({ profileId: 'corrupt-1' }), rootPath: 'C:\\smuggled' }] });
      await expect(store.get('corrupt-1')).rejects.toThrow();
    });

    // Ruling M62 (breakage round, item 1): `*.log` is a structurally valid relative
    // path that WP-01's walker cannot honour -- a CAPABILITY limit, refused at the two
    // input surfaces, never at this boundary. The fix wave put it in the persisted-
    // record schema instead, so a data.json carrying one (invited by the exclusions
    // field's own former "or pattern" label) made list() throw on the first such record
    // and the settings tab render an EMPTY profile list with the reason lost. Every
    // stored profile must still LOAD.
    it('loads a stored profile carrying a glob exclusion rather than refusing the whole list (M62)', async () => {
      const { store, writeRaw } = await make();
      const globbed = makeProfile({ profileId: 'globbed', exclusions: ['*.log'] });
      await writeRaw({ profiles: [makeProfile({ profileId: 'plain' }), globbed] });
      expect(await store.list()).toEqual([makeProfile({ profileId: 'plain' }), globbed]);
      expect(await store.get('globbed')).toEqual(globbed);
    });

    it('rejects a profile whose maxFileBytes is not a positive integer', async () => {
      const { store } = await make();
      for (const bad of [0, -1, 1.5, Number.NaN]) {
        await expect(store.save(makeProfile({ maxFileBytes: bad })), String(bad)).rejects.toThrow();
      }
    });

    it('returns null rather than throwing for an unknown id', async () => {
      const { store } = await make();
      expect(await store.get('does-not-exist')).toBeNull();
    });

    it('removes a profile without disturbing its siblings', async () => {
      const { store } = await make();
      const a = makeProfile({ profileId: 'a' });
      const b = makeProfile({ profileId: 'b' });
      await store.save(a);
      await store.save(b);
      await store.remove('a');
      expect(await store.get('a')).toBeNull();
      expect(await store.get('b')).toEqual(b);
      expect((await store.list()).map((p) => p.profileId)).toEqual(['b']);
    });

    it('update() applies mutate to the stored profile and persists the result', async () => {
      const { store } = await make();
      await store.save(makeProfile({ profileId: 'p1', name: 'Original' }));
      await store.update('p1', (p) => ({ ...p, name: 'Renamed' }));
      expect((await store.get('p1'))!.name).toBe('Renamed');
    });

    it('update() does nothing for an unknown id', async () => {
      const { store } = await make();
      await store.update('does-not-exist', (p) => ({ ...p, name: 'x' }));
      expect(await store.get('does-not-exist')).toBeNull();
    });

    // Fix round 1, Critical 1's second reproduction: settings-tab.ts's old
    // updateProfile() did get() -> mutate -> save() from OUTSIDE any lock, so firing
    // two of them without an await between them (exactly what two near-simultaneous
    // settings-tab events produce) let the second call's save() silently discard the
    // first call's edit, because it saved a full profile object built from a stale
    // read. update() must not have this hole: both edits below must survive.
    it('does not lose either edit when two update() calls race on the SAME profile', async () => {
      const { store } = await make();
      await store.save(makeProfile({ profileId: 'p1', name: 'Original', exclusions: [] }));
      const rename = store.update('p1', (p) => ({ ...p, name: 'Renamed' }));
      const editExclusions = store.update('p1', (p) => ({ ...p, exclusions: ['dist'] }));
      await Promise.all([rename, editExclusions]);
      const profile = (await store.get('p1'))!;
      expect(profile.name).toBe('Renamed');
      expect(profile.exclusions).toEqual(['dist']);
    });
  });
}
