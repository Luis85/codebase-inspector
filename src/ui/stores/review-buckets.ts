// Part 6 Y13 (the 400/400 rule, Part 5 E25): the review store's per-codebase bookkeeping,
// split out of review-store.ts and used only by it:
//  - Part 5 V8's buckets: one repository per codebase bound in this leaf, `''` while unbound;
//  - the repository factory (Y11) and the one live subscription with its own-write count (Y12);
//  - the keys in flight, per codebase (Y15).
import { markRaw } from 'vue';
import { noop } from '../kit/noop';
import { createInMemoryReviewRepository, type ReviewReplaceState, type ReviewRepository } from './ports/review-repository';

/** Part 5 E18 / Part 6 R1: what `clearAll` replaces the bound codebase's state with — nothing. */
export const EMPTY_REPLACEMENT: ReviewReplaceState = { workItems: [], rules: [], dispositions: [] };

export const ruleKey = (from: string, to: string): string => `${from}->${to}`;

/** One codebase's repository (Part 5 V8). The id counters a bucket used to carry are the
 *  repository's own high-water mark now (Y10): it survives a removal, a failed save and,
 *  for the durable adapter, a restart. */
export interface ReviewBucket {
  repository: ReviewRepository;
  /** Y10: a load has finished, so the repository has seeded its high-water mark. A bucket
   *  made from a fresh in-memory repository starts ready: there is nothing to seed. */
  ready: boolean;
  /** Y12: notifications still to come from this store's own writes to `repository`. */
  ownWrites: number;
}

export type ReviewRepositoryFactory = (repositoryId: string) => ReviewRepository;

export interface BucketState {
  buckets: Map<string, ReviewBucket>;
  /** Y11: the host's registry. Null in tests and in the harness, where every bucket is in memory. */
  factory: ReviewRepositoryFactory | null;
  /** Y12: the one live subscription, to the bound bucket's repository. */
  unsubscribe: (() => void) | null;
}

const inMemoryBucket = (): ReviewBucket => ({ repository: markRaw(createInMemoryReviewRepository()), ready: true, ownWrites: 0 });

/** Raw: nothing renders from it. Starts with the unbound `''` bucket. */
export function createBucketState(): BucketState {
  return markRaw({ buckets: new Map([['', inMemoryBucket()]]), factory: null, unsubscribe: null });
}

/** The bucket for `id`, made on first use: from the factory when there is one, except the
 *  unbound `''` bucket, which stays in memory and is never persisted (Y14). */
export function bucketFor(bs: BucketState, id: string): ReviewBucket {
  const existing = bs.buckets.get(id);
  if (existing) return existing;
  const made: ReviewBucket = id !== '' && bs.factory
    ? { repository: markRaw(bs.factory(id)), ready: false, ownWrites: 0 }
    : inMemoryBucket();
  bs.buckets.set(id, made);
  return made;
}

/** What the subscription needs from the store. */
interface Reloadable { readonly repository: ReviewRepository; load(): Promise<void> }

/** Y12: reloads the store, but only while `bucket` is still the bound one. A failed reload
 *  keeps the lists as they are (nobody asked for it, so nothing is announced, E17); the
 *  next bind loads again. */
function reloadIfBound(store: Reloadable, bucket: ReviewBucket): void {
  if (store.repository === bucket.repository) void store.load().catch(noop);
}

/** Y12: listens to `bucket`'s repository, dropping the previous subscription, so a store
 *  hears only the codebase it has bound. A notification one of this store's own writes
 *  caused is skipped; any other one (another leaf's write) reloads. */
export function listenTo(bs: BucketState, bucket: ReviewBucket, store: Reloadable): void {
  bs.unsubscribe?.();
  bucket.ownWrites = 0;
  bs.unsubscribe = bucket.repository.subscribe(() => {
    if (bucket.ownWrites > 0) bucket.ownWrites -= 1;
    else reloadIfBound(store, bucket);
  });
}

/** Y12: the leaf is closing; nothing reloads it any more. */
export function stopListening(bs: BucketState): void {
  bs.unsubscribe?.();
  bs.unsubscribe = null;
}

/** Y12: runs one of this store's own writes. The port notifies once per successful write,
 *  before that write's promise resolves, and never for a rejected one. So a rejection gives
 *  its expected notification back; if a foreign notification already used it up (and was
 *  skipped as this store's own), it reloads instead, to catch that change up.
 *  Returns the port's own promise and gives the slot back on a side branch, registered
 *  first, so it runs before the caller resumes, and a write costs the caller no extra
 *  microtask turn over awaiting the port directly (component tests count those turns). */
export function ownWrite(bucket: ReviewBucket, write: () => Promise<void>, store: Reloadable): Promise<void> {
  bucket.ownWrites += 1;
  let written: Promise<void>;
  try {
    written = write();
  } catch (error: unknown) {
    bucket.ownWrites -= 1; // threw before writing anything, so nothing will notify
    throw error;
  }
  written.catch(() => {
    if (bucket.ownWrites > 0) bucket.ownWrites -= 1;
    else reloadIfBound(store, bucket);
  });
  return written;
}

/** Y15 (Part 5 E15): the keys with a save, update or removal in flight in one codebase —
 *  rule pairs, work-item keys (target + intent), work-item ids, and fingerprints. */
export interface ReviewPending { rule: string[]; work: string[]; item: string[]; fingerprint: string[] }
type PendingKind = keyof ReviewPending;
const NONE_PENDING: Readonly<ReviewPending> = Object.freeze({ rule: [], work: [], item: [], fingerprint: [] });

export const pendingOf = (pending: ReadonlyMap<string, ReviewPending>, key: string): Readonly<ReviewPending> =>
  pending.get(key) ?? NONE_PENDING;

export const anyPending = (p: Readonly<ReviewPending>): boolean =>
  p.rule.length > 0 || p.work.length > 0 || p.item.length > 0 || p.fingerprint.length > 0;

/** Marks `value` in flight in codebase `key`, before the action's first `await` (fix round
 *  2's reservation: an overlapping second call for the same key sees it and refuses). */
export function reserve(pending: Map<string, ReviewPending>, key: string, kind: PendingKind, value: string): void {
  const entry = pending.get(key) ?? { rule: [], work: [], item: [], fingerprint: [] };
  entry[kind] = [...entry[kind], value];
  pending.set(key, entry);
}

/** A `finally` releases `value` from the codebase it was reserved in, by the key the action
 *  captured — never from whichever codebase is bound by the time it settles. */
export function release(pending: Map<string, ReviewPending>, key: string, kind: PendingKind, value: string): void {
  const entry = pending.get(key);
  if (entry) entry[kind] = entry[kind].filter((v) => v !== value);
}
