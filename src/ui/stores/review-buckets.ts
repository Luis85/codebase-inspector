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
  /** Task 2 fix round 1: the ticket of the latest `load()` started, the only one that may
   *  apply what it listed, and how many loads are still in flight. */
  loadTicket: number;
  loading: number;
}

export type ReviewRepositoryFactory = (repositoryId: string) => ReviewRepository;

export interface BucketState {
  buckets: Map<string, ReviewBucket>;
  /** Y11: the host's registry. Null in tests and in the harness, where every bucket is in memory. */
  factory: ReviewRepositoryFactory | null;
  /** Y12: the one live subscription, to the bound bucket's repository. */
  unsubscribe: (() => void) | null;
}

const newBucket = (repository: ReviewRepository, ready: boolean): ReviewBucket =>
  ({ repository: markRaw(repository), ready, ownWrites: 0, loadTicket: 0, loading: 0 });
const inMemoryBucket = (): ReviewBucket => newBucket(createInMemoryReviewRepository(), true);

/** Raw: nothing renders from it. Starts with the unbound `''` bucket. */
export function createBucketState(): BucketState {
  return markRaw({ buckets: new Map([['', inMemoryBucket()]]), factory: null, unsubscribe: null });
}

/** The bucket for `id`, made on first use: from the factory when there is one. The unbound
 *  `''` bucket stays in memory and is never persisted (Y14); `createBucketState` makes it
 *  up front, so the `id !== ''` test below is defence in depth, never reached today. */
export function bucketFor(bs: BucketState, id: string): ReviewBucket {
  const existing = bs.buckets.get(id);
  if (existing) return existing;
  const made = id !== '' && bs.factory ? newBucket(bs.factory(id), false) : inMemoryBucket();
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

/** Polish E4 (L16): an own add or decision, once its write to `repo` has settled. When no load
 *  of the bucket started during the write (`ticket` still current), `upsert` shows it. When one
 *  did, it may reflect another leaf's change, and an upsert could put back what that change
 *  removed, so the stored truth is reloaded instead. Fix round 1: the reload is awaited, so the
 *  caller's key stays reserved until the lists show what was saved (an identical second add is
 *  refused meanwhile). A failed reload sets `loadFailed` (R1, which Settings reports); the
 *  caller still returns what it saved, because the write itself succeeded and reporting a
 *  failure would invite a duplicate retry. Nothing while another codebase is bound (V9).
 *  Not `async`, like ownWrite: it returns the reload for the caller to await, or null, so the
 *  usual upsert path adds no microtask turn before the caller resolves. */
export function settleOwnWrite(
  store: Reloadable, repo: ReviewRepository, bucket: ReviewBucket, ticket: number, upsert: () => void,
): Promise<void> | null {
  if (store.repository !== repo) return null;
  if (bucket.loadTicket !== ticket) return store.load().catch(noop);
  upsert();
  return null;
}

/** Task 2 fix round 1: starts a load of `bucket` and returns its ticket. */
export function beginLoad(bucket: ReviewBucket): number {
  bucket.loading += 1;
  bucket.loadTicket += 1;
  return bucket.loadTicket;
}

/** Ends the load holding `ticket`. True only for the latest load started: an older one
 *  (a reload that listed before a newer write) settles without touching the store. */
export function endLoad(bucket: ReviewBucket, ticket: number): boolean {
  bucket.loading -= 1;
  return ticket === bucket.loadTicket;
}

/** Y12: settles one slot of this store's own-write count, for a notification that came or,
 *  on a failed write, never will. With no slot left, a foreign notification already used it
 *  up (skipped as this store's own), so it reloads to catch that change up; `reload` forces
 *  a reload either way. */
function settleSlot(bucket: ReviewBucket, store: Reloadable, reload = false): void {
  if (bucket.ownWrites > 0) bucket.ownWrites -= 1;
  else reload = true;
  if (reload) reloadIfBound(store, bucket);
}

/** Y12: listens to `bucket`'s repository, dropping the previous subscription, so a store
 *  hears only the codebase it has bound. A notification one of this store's own writes
 *  caused is skipped; any other one (another leaf's write) reloads. */
export function listenTo(bs: BucketState, bucket: ReviewBucket, store: Reloadable): void {
  bs.unsubscribe?.();
  bucket.ownWrites = 0;
  bs.unsubscribe = bucket.repository.subscribe(() => { settleSlot(bucket, store); });
}

/** Y12: the leaf is closing; nothing reloads it any more. */
export function stopListening(bs: BucketState): void {
  bs.unsubscribe?.();
  bs.unsubscribe = null;
}

/** Y12: runs one of this store's own writes. The port notifies once per successful write,
 *  before that write's promise resolves, and never for a rejected one, so a rejection
 *  settles its slot itself (`settleSlot`). Fix round 1: a write that settles while a load
 *  of the bucket is in flight starts one more, since that load may have listed before the
 *  write landed; being the latest, the new load is the one that applies.
 *  Not `async`: it returns the port's own promise and does its bookkeeping on a side branch,
 *  registered first so it runs before the caller resumes. A write therefore adds no extra
 *  microtask turn over awaiting the port directly. */
export function ownWrite(bucket: ReviewBucket, write: () => Promise<void>, store: Reloadable): Promise<void> {
  bucket.ownWrites += 1;
  let written: Promise<void>;
  try {
    written = write();
  } catch (error: unknown) {
    settleSlot(bucket, store); // threw before writing anything, so nothing will notify
    throw error;
  }
  written.then(
    () => { if (bucket.loading > 0) reloadIfBound(store, bucket); },
    () => { settleSlot(bucket, store, bucket.loading > 0); },
  );
  return written;
}

/** Y15 (Part 5 E15): the keys with a save, update or removal in flight in one codebase —
 *  rule pairs, work-item keys (target + intent), work-item ids, and fingerprints. */
export interface ReviewPending { rule: string[]; work: string[]; item: string[]; fingerprint: string[] }
type PendingKind = keyof ReviewPending;
const emptyPending = (): ReviewPending => ({ rule: [], work: [], item: [], fingerprint: [] });
const NONE_PENDING: Readonly<ReviewPending> = Object.freeze(emptyPending());

export const pendingOf = (pending: ReadonlyMap<string, ReviewPending>, key: string): Readonly<ReviewPending> =>
  pending.get(key) ?? NONE_PENDING;

export const anyPending = (p: Readonly<ReviewPending>): boolean =>
  p.rule.length > 0 || p.work.length > 0 || p.item.length > 0 || p.fingerprint.length > 0;

/** Marks `value` in flight in codebase `key`, before the action's first `await` (fix round
 *  2's reservation: an overlapping second call for the same key sees it and refuses). */
export function reserve(pending: Map<string, ReviewPending>, key: string, kind: PendingKind, value: string): void {
  const entry = pending.get(key) ?? emptyPending();
  entry[kind] = [...entry[kind], value];
  pending.set(key, entry);
}

/** A `finally` releases `value` from the codebase it was reserved in, by the key the action
 *  captured — never from whichever codebase is bound by the time it settles. */
export function release(pending: Map<string, ReviewPending>, key: string, kind: PendingKind, value: string): void {
  const entry = pending.get(key);
  if (entry) entry[kind] = entry[kind].filter((v) => v !== value);
}
