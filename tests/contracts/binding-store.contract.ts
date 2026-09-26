// Mirrors profile-store.contract.ts (ruling M24). See that file's header for what
// `writeRaw` and `reopen` are for.
import { describe, expect, it } from 'vitest';
import type { LocalBindingStore } from '../../src/application/ports/local-binding-store';
import type { LocalBinding } from '../../src/domain/model';

export interface BindingStoreHarness {
  store: LocalBindingStore;
  writeRaw: (raw: unknown) => Promise<void>;
  reopen: () => LocalBindingStore;
}

function makeBinding(overrides: Partial<LocalBinding> = {}): LocalBinding {
  return { bindingId: 'b1', label: 'My project', rootPath: 'C:\\Projects\\x', machineId: 'irrelevant', ...overrides };
}

export function runBindingStoreContract(name: string, make: () => Promise<BindingStoreHarness>): void {
  describe(`LocalBindingStore contract: ${name}`, () => {
    it('round-trips a saved binding', async () => {
      const { store } = await make();
      await store.save(makeBinding());
      const found = await store.get('b1');
      expect(found).not.toBeNull();
      expect(found!.bindingId).toBe('b1');
      expect(found!.rootPath).toBe('C:\\Projects\\x');
    });

    it('persists across a store reconstruction', async () => {
      const { store, reopen } = await make();
      await store.save(makeBinding({ bindingId: 'b2' }));
      const reconstructed = reopen();
      const found = await reconstructed.get('b2');
      expect(found).not.toBeNull();
      expect(found!.bindingId).toBe('b2');
    });

    it('VALIDATES persisted data on read, because data.json is untrusted input', async () => {
      const { store, writeRaw } = await make();
      await writeRaw({ bindings: [{ bindingId: 'corrupt-1', label: 'x', rootPath: '', machineId: 'm' }] });
      await expect(store.get('corrupt-1')).rejects.toThrow();
    });

    it('rejects a binding whose rootPath is not a non-empty string', async () => {
      const { store } = await make();
      await expect(store.save(makeBinding({ rootPath: '' }))).rejects.toThrow();
    });

    it('returns null rather than throwing for an unknown id', async () => {
      const { store } = await make();
      expect(await store.get('does-not-exist')).toBeNull();
    });

    it('clears a binding without disturbing its siblings', async () => {
      const { store } = await make();
      await store.save(makeBinding({ bindingId: 'a' }));
      await store.save(makeBinding({ bindingId: 'b' }));
      await store.clear('a');
      expect(await store.get('a')).toBeNull();
      expect(await store.get('b')).not.toBeNull();
    });

    it('returns null when the binding exists but its root is unavailable on this machine', async () => {
      // COPY-28: "The saved source directory is unavailable on this machine. The
      // stored snapshot can still be inspected." save() always stamps the CURRENT
      // machine's id (never trusting a caller-supplied one — see report), so the only
      // way to construct a binding recorded on ANOTHER machine is writeRaw, exactly
      // like a data.json copied in by Obsidian Sync from a different machine.
      const { store, writeRaw } = await make();
      await writeRaw({ bindings: [{ bindingId: 'foreign-1', label: 'x', rootPath: 'C:\\elsewhere', machineId: 'some-other-machine' }] });
      expect(await store.get('foreign-1')).toBeNull();
    });

    // Fix round 1, Minor 5: a prior version of this suite had a test named "never
    // persists a resolved absolute path into anything getState() touches" that only
    // re-exercised validateCityViewState's existing .strict() rejection of a smuggled
    // rootPath -- coverage task 2 already has (tests/unit/validator.test.ts). No code
    // path in this store threads LocalBinding.rootPath into CityViewState, so no change
    // to THIS code could ever have made that test fail; it was deleted rather than kept
    // under a name promising a guarantee it did not check. LocalBindingStore's actual
    // job -- never smuggling more than bindingId/label/rootPath/machineId through its
    // own interface -- is covered structurally by every other test in this suite
    // round-tripping through the real, `.strict()`-validated LocalBinding shape.
  });
}
