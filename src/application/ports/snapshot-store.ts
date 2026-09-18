import type { CodebaseSnapshot } from '../../domain/model';

/** Spec 4.5: "SnapshotStore is in-memory for WP-01; durable history is WP-05."
 *  Reopening a view shows retained in-memory state marked with its age, and never
 *  silently authorises a new scan -- `ageOf` exists so a caller can express "this is
 *  N minutes old" without recomputing it from `providerRun.capturedAt` itself, and
 *  without every caller needing its own Clock reference.
 *
 *  `latestFor(profileId)` is "last published wins" for that profile -- there is no
 *  history and no way to list prior snapshots (WP-05's job); a fresh `put()` for a
 *  profile is simply the new answer to "what does this profile currently show." */
export interface SnapshotStore {
  get(id: string): CodebaseSnapshot | null;
  put(s: CodebaseSnapshot): void;
  latestFor(profileId: string): CodebaseSnapshot | null;
  /** Milliseconds elapsed, by the store's own Clock, since `id`'s `providerRun.capturedAt`.
   *  Throws if `id` is not in the store -- a caller asking for the age of a snapshot it
   *  does not already hold (via `get`/`latestFor`) is a programming error, not a
   *  recoverable "unknown age", so this fails loudly rather than returning a sentinel a
   *  caller could mistake for a real duration. */
  ageOf(id: string): number;
}
