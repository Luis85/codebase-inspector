// In-memory ProfileStore double for the contract suite (ruling M24) and for
// tests/component/settings-tab.test.ts. Genuinely validates on every read/write —
// exactly like the real plugin.loadData()-backed store — so it cannot make a
// contract-suite assertion pass vacuously by skipping the boundary under test.
import { validateCodebaseProfile } from '../../src/domain/validator';
import { isRecordWithField } from '../../src/adapters/storage/plugin-data-shape';
import type { ProfileStore } from '../../src/application/ports/profile-store';
import type { CodebaseProfile } from '../../src/domain/model';
import type { ProfileStoreHarness } from '../contracts/profile-store.contract';

interface Backing { profiles: unknown[] }

class FakeProfileStore implements ProfileStore {
  constructor(private readonly backing: Backing) {}

  async list(): Promise<readonly CodebaseProfile[]> {
    return Promise.resolve(this.backing.profiles.map((entry) => validateCodebaseProfile(entry)));
  }

  async get(id: string): Promise<CodebaseProfile | null> {
    const found = this.backing.profiles.find((entry) => isRecordWithField(entry, 'profileId', id));
    return Promise.resolve(found === undefined ? null : validateCodebaseProfile(found));
  }

  async save(profile: CodebaseProfile): Promise<void> {
    const validated = validateCodebaseProfile(profile);
    this.backing.profiles = this.backing.profiles.filter(
      (entry) => !isRecordWithField(entry, 'profileId', validated.profileId));
    this.backing.profiles.push(validated);
    return Promise.resolve();
  }

  async remove(id: string): Promise<void> {
    this.backing.profiles = this.backing.profiles.filter((entry) => !isRecordWithField(entry, 'profileId', id));
    return Promise.resolve();
  }
}

export function createFakeProfileStoreHarness(): ProfileStoreHarness {
  const backing: Backing = { profiles: [] };
  return {
    store: new FakeProfileStore(backing),
    writeRaw: (raw) => {
      const shape = raw as { profiles?: unknown[] };
      backing.profiles = Array.isArray(shape.profiles) ? shape.profiles : [];
      return Promise.resolve();
    },
    reopen: () => new FakeProfileStore(backing),
  };
}
