// In-memory LocalBindingStore double, mirroring fake-profile-store.ts (ruling M24).
// FAKE_MACHINE_ID plays the role of getOrCreateMachineId(app)'s return value for the
// real adapter: a fixed string this fake always stamps on save() and compares against
// on get(), so the "unavailable on this machine" contract test (which writeRaw()s a
// DIFFERENT machineId directly, bypassing save()'s stamp) exercises the same behaviour
// against both implementations.
import { validateLocalBinding } from '../../src/domain/validator';
import { isRecordWithField } from '../../src/adapters/storage/plugin-data-shape';
import type { LocalBindingStore } from '../../src/application/ports/local-binding-store';
import type { LocalBinding } from '../../src/domain/model';
import type { BindingStoreHarness } from '../contracts/binding-store.contract';

export const FAKE_MACHINE_ID = 'fake-local-machine';

interface Backing { bindings: unknown[] }

class FakeBindingStore implements LocalBindingStore {
  constructor(private readonly backing: Backing) {}

  async get(bindingId: string): Promise<LocalBinding | null> {
    const found = this.backing.bindings.find((entry) => isRecordWithField(entry, 'bindingId', bindingId));
    if (found === undefined) return Promise.resolve(null);
    const binding = validateLocalBinding(found);
    return Promise.resolve(binding.machineId !== FAKE_MACHINE_ID ? null : binding);
  }

  async save(binding: LocalBinding): Promise<void> {
    const stamped = validateLocalBinding({ ...binding, machineId: FAKE_MACHINE_ID });
    this.backing.bindings = this.backing.bindings.filter(
      (entry) => !isRecordWithField(entry, 'bindingId', stamped.bindingId));
    this.backing.bindings.push(stamped);
    return Promise.resolve();
  }

  async clear(bindingId: string): Promise<void> {
    this.backing.bindings = this.backing.bindings.filter((entry) => !isRecordWithField(entry, 'bindingId', bindingId));
    return Promise.resolve();
  }
}

export function createFakeBindingStoreHarness(): BindingStoreHarness {
  const backing: Backing = { bindings: [] };
  return {
    store: new FakeBindingStore(backing),
    writeRaw: (raw) => {
      const shape = raw as { bindings?: unknown[] };
      backing.bindings = Array.isArray(shape.bindings) ? shape.bindings : [];
      return Promise.resolve();
    },
    reopen: () => new FakeBindingStore(backing),
  };
}
