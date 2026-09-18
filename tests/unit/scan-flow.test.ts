// Fix round 3, ruling M44 (Critical): a new profile is NEVER exclusion-less. Measured
// root cause of "0 files found" in the real host -- see the fix report for the
// measurement. These are the unit-level checks that a freshly minted profile actually
// carries the defaults; tests/integration/read-log.test.ts adds the real-filesystem
// proof that those defaults actually protect a scan.
import { describe, expect, it, vi } from 'vitest';
import { createDefaultProfile, defaultExclusionsFor, resolveOrCreateProfile } from '../../src/host/scan-flow';
import type { CodebaseProfile } from '../../src/domain/model';
import type { ProfileStore } from '../../src/application/ports/profile-store';

// `save`/`update` are hoisted to their own consts and returned alongside the store, so
// a caller asserts against the CONST (`expect(save)...`), never a member expression
// (`expect(store.save)...`) off a value typed as the real ProfileStore interface --
// the same @typescript-eslint/unbound-method pattern already resolved this way in
// tests/unit/scan-coordinator.test.ts's spyPort().
function makeProfileStoreDouble(initial: CodebaseProfile[] = []): {
  store: ProfileStore; save: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>;
} {
  const profiles = [...initial];
  const save = vi.fn(async (p: CodebaseProfile) => { profiles.push(p); });
  const update = vi.fn(async (id: string, mutate: (current: CodebaseProfile) => CodebaseProfile) => {
    const index = profiles.findIndex((p) => p.profileId === id);
    if (index === -1) return;
    profiles[index] = mutate(profiles[index]!);
  });
  const store: ProfileStore = {
    list: vi.fn(async () => [...profiles]),
    get: vi.fn(async (id: string) => profiles.find((p) => p.profileId === id) ?? null),
    save,
    remove: vi.fn(async () => {}),
    update,
  };
  return { store, save, update };
}

describe('defaultExclusionsFor', () => {
  it('names .git, node_modules, .env and the SUPPLIED vault config directory, never a literal one', () => {
    expect(defaultExclusionsFor('.obsidian')).toEqual(['.git', 'node_modules', '.env', '.obsidian']);
    // A different vault could name its config directory anything -- this function
    // never hardcodes '.obsidian' itself, it only ever echoes back what it was given.
    expect(defaultExclusionsFor('.my-config')).toEqual(['.git', 'node_modules', '.env', '.my-config']);
  });
});

describe('createDefaultProfile', () => {
  it('carries the M44 defaults and a fresh id, never an empty exclusions list', () => {
    const profile = createDefaultProfile('.obsidian');
    expect(profile.exclusions).toEqual(['.git', 'node_modules', '.env', '.obsidian']);
    expect(profile.name).toBe('New profile');
    expect(profile.bindingId).toBeNull();
    expect(profile.profileId.length).toBeGreaterThan(0);
  });

  it('mints a different id on every call', () => {
    const a = createDefaultProfile('.obsidian');
    const b = createDefaultProfile('.obsidian');
    expect(a.profileId).not.toBe(b.profileId);
  });
});

describe('resolveOrCreateProfile', () => {
  it('creates a new profile with the M44 defaults when the store is empty', async () => {
    const { store, save } = makeProfileStoreDouble();
    const profile = await resolveOrCreateProfile(store, null, '.obsidian');
    expect(profile.exclusions).toEqual(['.git', 'node_modules', '.env', '.obsidian']);
    expect(save).toHaveBeenCalledWith(profile);
  });

  it('reuses an existing profile with NON-empty exclusions untouched, a deliberate user choice', async () => {
    const existing: CodebaseProfile = {
      profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['custom'], maxFileBytes: 1_000_000,
    };
    const { store, save, update } = makeProfileStoreDouble([existing]);
    const profile = await resolveOrCreateProfile(store, 'p1', '.obsidian');
    expect(profile).toEqual(existing);
    expect(save).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  // Fix round 4, ruling M44's migration half (Critical): the installed bundle's
  // ACTUAL data.json holds exactly this shape -- a profile persisted before the
  // defaults existed, with exclusions: []. Returning it untouched (round 3's own
  // shape) reproduces the original failure verbatim on every next scan.
  it('migrates an EXISTING profile whose exclusions are empty, and PERSISTS the fix via update()', async () => {
    const existing: CodebaseProfile = {
      profileId: 'p1', name: 'New profile', bindingId: null, exclusions: [], maxFileBytes: 5_000_000,
    };
    const { store, save, update } = makeProfileStoreDouble([existing]);
    const profile = await resolveOrCreateProfile(store, 'p1', '.obsidian');

    expect(profile.exclusions).toEqual(['.git', 'node_modules', '.env', '.obsidian']);
    // Persisted through update() -- never get()+save() (task-6 Critical 1) -- so
    // Settings, the scope modal's prefilled field and the NEXT resolve all see the
    // safe value from now on, not just this one call.
    expect(update).toHaveBeenCalledWith('p1', expect.any(Function));
    expect(save).not.toHaveBeenCalled();
    expect((await store.get('p1'))!.exclusions).toEqual(['.git', 'node_modules', '.env', '.obsidian']);
  });

  it('migrates the FIRST profile too, when none is bound to this view yet', async () => {
    const existing: CodebaseProfile = {
      profileId: 'p1', name: 'New profile', bindingId: null, exclusions: [], maxFileBytes: 5_000_000,
    };
    const { store, update } = makeProfileStoreDouble([existing]);
    const profile = await resolveOrCreateProfile(store, null, '.obsidian');
    expect(profile.exclusions).toEqual(['.git', 'node_modules', '.env', '.obsidian']);
    expect(update).toHaveBeenCalledWith('p1', expect.any(Function));
  });
});
