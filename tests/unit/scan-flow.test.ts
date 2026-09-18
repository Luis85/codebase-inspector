// Fix round 3, ruling M44 (Critical): a new profile is NEVER exclusion-less. Measured
// root cause of "0 files found" in the real host -- see the fix report for the
// measurement. These are the unit-level checks that a freshly minted profile actually
// carries the defaults; tests/integration/read-log.test.ts adds the real-filesystem
// proof that those defaults actually protect a scan.
import { describe, expect, it, vi } from 'vitest';
import { createDefaultProfile, defaultExclusionsFor, resolveOrCreateProfile } from '../../src/host/scan-flow';
import type { CodebaseProfile } from '../../src/domain/model';
import type { ProfileStore } from '../../src/application/ports/profile-store';

// `save` is hoisted to its own const and returned alongside the store, so a caller
// asserts against the CONST (`expect(save)...`), never a member expression
// (`expect(store.save)...`) off a value typed as the real ProfileStore interface --
// the same @typescript-eslint/unbound-method pattern already resolved this way in
// tests/unit/scan-coordinator.test.ts's spyPort().
function makeProfileStoreDouble(initial: CodebaseProfile[] = []): { store: ProfileStore; save: ReturnType<typeof vi.fn> } {
  const profiles = [...initial];
  const save = vi.fn(async (p: CodebaseProfile) => { profiles.push(p); });
  const store: ProfileStore = {
    list: vi.fn(async () => [...profiles]),
    get: vi.fn(async (id: string) => profiles.find((p) => p.profileId === id) ?? null),
    save,
    remove: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
  };
  return { store, save };
}

describe('defaultExclusionsFor', () => {
  it('names .git, node_modules and the SUPPLIED vault config directory, never a literal one', () => {
    expect(defaultExclusionsFor('.obsidian')).toEqual(['.git', 'node_modules', '.obsidian']);
    // A different vault could name its config directory anything -- this function
    // never hardcodes '.obsidian' itself, it only ever echoes back what it was given.
    expect(defaultExclusionsFor('.my-config')).toEqual(['.git', 'node_modules', '.my-config']);
  });
});

describe('createDefaultProfile', () => {
  it('carries the M44 defaults and a fresh id, never an empty exclusions list', () => {
    const profile = createDefaultProfile('.obsidian');
    expect(profile.exclusions).toEqual(['.git', 'node_modules', '.obsidian']);
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
    expect(profile.exclusions).toEqual(['.git', 'node_modules', '.obsidian']);
    expect(save).toHaveBeenCalledWith(profile);
  });

  it('reuses an existing profile (with WHATEVER exclusions it already has) rather than overwriting it', async () => {
    const existing: CodebaseProfile = {
      profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['custom'], maxFileBytes: 1_000_000,
    };
    const { store, save } = makeProfileStoreDouble([existing]);
    const profile = await resolveOrCreateProfile(store, 'p1', '.obsidian');
    expect(profile).toEqual(existing);
    expect(save).not.toHaveBeenCalled();
  });
});
