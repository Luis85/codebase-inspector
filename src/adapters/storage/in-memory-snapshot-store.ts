// The WP-01 SnapshotStore (spec 4.5): plain in-memory maps, no persistence across an
// Obsidian restart. Durable history is WP-05 -- this file is deliberately as small as
// that scope allows.
import type { Clock } from '../../application/ports/clock';
import type { SnapshotStore } from '../../application/ports/snapshot-store';
import type { CodebaseSnapshot } from '../../domain/model';

export class InMemorySnapshotStore implements SnapshotStore {
  private readonly byId = new Map<string, CodebaseSnapshot>();
  private readonly latestIdByProfile = new Map<string, string>();

  constructor(private readonly clock: Clock) {}

  get(id: string): CodebaseSnapshot | null {
    return this.byId.get(id) ?? null;
  }

  /** "Last put wins" for the profile -- callers only ever put a snapshot once it has
   *  passed validation and won the atomic-swap identity check (scan-coordinator.ts), so
   *  there is no reordering concern here: puts already arrive in the order they were
   *  authorised to publish. Keyed by `repositoryId`, reusing inventory-collector.ts's
   *  explicit WP-01 assumption that `repositoryId === profileId` (one profile per bound
   *  codebase root) -- the same line that assumption would need to revisit also affects
   *  this key. */
  put(s: CodebaseSnapshot): void {
    this.byId.set(s.snapshotId, s);
    this.latestIdByProfile.set(s.repositoryId, s.snapshotId);
  }

  latestFor(profileId: string): CodebaseSnapshot | null {
    const id = this.latestIdByProfile.get(profileId);
    return id === undefined ? null : this.get(id);
  }

  ageOf(id: string): number {
    const snapshot = this.byId.get(id);
    if (!snapshot) throw new Error(`ageOf: no snapshot in the store with id "${id}"`);
    return this.clock.now().getTime() - new Date(snapshot.providerRun.capturedAt).getTime();
  }
}
