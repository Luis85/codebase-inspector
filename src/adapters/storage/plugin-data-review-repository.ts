// Part 6 Y5–Y10, Y12, R1: the durable review adapter, behind the same ReviewRepository port
// as the in-memory one (tests/contracts/review-repository.contract.ts runs both). One
// instance per codebase per plugin: review-repository-registry.ts.
// - Y5/Y8: the record set is data.json `reviews[repositoryId]`. Every write is ONE
//   `writePluginDataSlice` (the plugin-wide data lock) and changes only this entry.
// - Y6: records are stored in PATH form (review-record-codec.ts). A record that cannot be
//   stored that way is refused ('unrepresentable') before anything is written.
// - Y7: every read validates each record; an invalid one is skipped and counted, never
//   dropped: a record write upserts or removes BY ID against the raw array and carries every
//   other raw entry over as it is. A set with `v !== 1`, or one that is not an object, is
//   read as empty, and every write to it is refused ('unsupported'): never overwritten.
// - R1: replaceAll is all or nothing — every record encodes, or nothing is written — and
//   replaces the WHOLE set (skipped records too) in one write.
// - Y9: a save or replaceAll that would take the set over 1 MB is refused ('full').
//   Removals never are.
// - Y10: ids come from a mark per kind that only ever rises. It absorbs the stored mark and
//   every raw id (valid or not) on each read and inside each write, and is written with
//   every write, so an id on disk is never handed out again, across leaves or restarts.
// - Y12: subscribers are told after each successful write, before the write resolves.
// Lists re-read data.json on every call (one read shared while it is in flight), so a
// change made outside the plugin shows on the next bind (Y19).
import type { Plugin } from 'obsidian';
import {
  formatReviewId, noStorageDiagnostics, reviewIdSuffix, type ReviewIdKind, type ReviewRepository, type ReviewStorageDiagnostics,
} from '../../ui/stores/ports/review-repository';
import {
  STORED_ID_SUFFIX_MAX, decodeRecords, encodeDisposition, encodeRule, encodeWorkItem, storedFindingKey,
  type DecodedRecords, type StoredRecord,
} from '../../ui/read-models/review-record-codec';
import { REVIEW_SAVE_UNREPRESENTABLE, REVIEW_STORE_FULL, REVIEW_STORE_UNSUPPORTED } from '../../ui/inspector-copy';
import { asUnknownArray, isRecordWithField, readPluginData, writePluginDataSlice } from './plugin-data-shape';

/** Y9: per codebase, as the JSON.stringify length of its record set (the same limit as
 *  the review-state import's IMPORT_MAX_BYTES). */
export const REVIEW_STORE_MAX_BYTES = 1_000_000;

export type ReviewStoreErrorCode = 'full' | 'unsupported' | 'unrepresentable';
const ERROR_TEXT: Readonly<Record<ReviewStoreErrorCode, string>> = {
  full: REVIEW_STORE_FULL, unsupported: REVIEW_STORE_UNSUPPORTED, unrepresentable: REVIEW_SAVE_UNREPRESENTABLE,
};

/** A refused write: nothing was written and nobody was told. The review store's existing
 *  failure paths announce it with their own copy (spec §4). */
export class ReviewStoreError extends Error {
  readonly code: ReviewStoreErrorCode;

  constructor(code: ReviewStoreErrorCode) {
    super(ERROR_TEXT[code]);
    this.name = 'ReviewStoreError';
    this.code = code;
  }
}

/** The port plus the one member the registry's purge uses (Y17). */
export interface PluginDataReviewRepository extends ReviewRepository {
  /** From now on every write rejects ('unsupported'), so a leaf still bound to a removed
   *  profile can never recreate its set. Subscribers are told once, so they reload. */
  retire(): void;
}

type RawSet = Record<string, unknown>;
type ListKey = 'workItems' | 'rules' | 'dispositions';
const LIST_KEYS: readonly ListKey[] = ['workItems', 'rules', 'dispositions'];
const ID_KINDS: readonly ReviewIdKind[] = ['workItem', 'rule'];
const ID_PREFIX: Readonly<Record<ReviewIdKind, string>> = { workItem: 'wi-', rule: 'AR-' };
const ID_LIST: Readonly<Record<ReviewIdKind, ListKey>> = { workItem: 'workItems', rule: 'rules' };
const NOTHING: DecodedRecords = { workItems: [], rules: [], dispositions: [], skipped: 0 };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Y7: this codebase's set, or null when it is read-only. No `reviews` key, or no entry
 *  for this codebase, is an empty set that can be written. */
function recordSetOf(reviews: unknown, repositoryId: string): RawSet | null {
  if (reviews === undefined) return { v: 1 };
  if (!isPlainObject(reviews)) return null;
  const set = Object.prototype.hasOwnProperty.call(reviews, repositoryId) ? reviews[repositoryId] : undefined;
  if (set === undefined) return { v: 1 };
  if (!isPlainObject(set) || set.v !== 1) return null;
  return LIST_KEYS.every((key) => set[key] === undefined || Array.isArray(set[key])) ? set : null;
}

/** Y10: the stored mark for `kind`; 0 when it is absent, not a whole number, or past what a
 *  record can hold (E26: absorbing it would make every later id unrepresentable). */
function storedMark(set: RawSet, kind: ReviewIdKind): number {
  const marks = set.highWater;
  const n = isPlainObject(marks) ? marks[kind] : undefined;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= STORED_ID_SUFFIX_MAX ? n : 0;
}

/** Y10: the highest id suffix in `kind`'s raw list, counting records a read skips. A suffix
 *  past what a record can hold is ignored (E26): no stored record can ever carry that id. */
function highestRawId(set: RawSet, kind: ReviewIdKind): number {
  let max = 0;
  for (const entry of asUnknownArray(set[ID_LIST[kind]])) {
    const id = isPlainObject(entry) ? entry.id : undefined;
    const n = typeof id === 'string' && id.startsWith(ID_PREFIX[kind]) ? reviewIdSuffix(id) : null;
    if (n !== null && n <= STORED_ID_SUFFIX_MAX && n > max) max = n;
  }
  return max;
}

/** Y7: replaces the first raw entry with this id in place and drops any later one with the
 *  same id, or appends. Every other entry, valid or not, is carried over as it is. */
function upsert(list: readonly unknown[], field: string, id: string, record: StoredRecord): unknown[] {
  const at = list.findIndex((entry) => isRecordWithField(entry, field, id));
  if (at < 0) return [...list, record];
  return list.flatMap((entry, index) => (index === at ? [record] : isRecordWithField(entry, field, id) ? [] : [entry]));
}

function without(list: readonly unknown[], field: string, id: string): unknown[] {
  return list.filter((entry) => !isRecordWithField(entry, field, id));
}

/** R1: every record's stored form, or null when any one of them cannot be stored. */
function allStored(records: readonly (StoredRecord | null)[]): StoredRecord[] | null {
  const out: StoredRecord[] = [];
  for (const record of records) {
    if (record === null) return null;
    out.push(record);
  }
  return out;
}

/** Y17: removes one codebase's set under the data lock. A `reviews` value that is not an
 *  object is left as it is: what cannot be read is never overwritten. The write is queued
 *  on the lock synchronously, before this returns (the registry's purge relies on it). */
export function deleteReviewSet(plugin: Plugin, repositoryId: string): Promise<void> {
  return writePluginDataSlice(plugin, 'reviews', (current) => (isPlainObject(current)
    ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== repositoryId))
    : current));
}

export function createPluginDataReviewRepository(plugin: Plugin, repositoryId: string): PluginDataReviewRepository {
  const listeners = new Set<() => void>();
  /** Y10: per kind, the highest suffix handed out or seen on disk. Only ever raised. */
  const marks: Record<ReviewIdKind, number> = { workItem: 0, rule: 0 };
  /** Y10: true once a read or a write has absorbed the stored set into `marks`. */
  let seeded = false;
  let retired = false;
  let lastDiagnostics: ReviewStorageDiagnostics = noStorageDiagnostics();
  /** The set the last write saved; `diagnostics()` counts its skipped records on demand. */
  let lastWritten: RawSet | null = null;
  let reading: Promise<DecodedRecords> | null = null;

  function absorb(set: RawSet): void {
    for (const kind of ID_KINDS) marks[kind] = Math.max(marks[kind], storedMark(set, kind), highestRawId(set, kind));
    seeded = true;
  }

  function decodeRead(reviews: unknown): DecodedRecords {
    lastWritten = null;
    const set = recordSetOf(reviews, repositoryId);
    if (set === null) {
      seeded = true;
      lastDiagnostics = { skipped: 0, unsupported: true };
      return NOTHING;
    }
    absorb(set);
    const decoded = decodeRecords(set, repositoryId);
    lastDiagnostics = { skipped: decoded.skipped, unsupported: false };
    return decoded;
  }

  /** One data.json read, shared by every list call made while it is in flight (the
   *  store's load() lists all three at once). */
  function read(): Promise<DecodedRecords> {
    if (reading) return reading;
    const pending = readPluginData(plugin).then((data) => decodeRead(data.reviews));
    reading = pending;
    const settle = (): void => { if (reading === pending) reading = null; };
    void pending.then(settle, settle);
    return pending;
  }

  function notify(): void {
    // Part 6 E5: a copy, so a listener that unsubscribes (or subscribes) mid-notification is safe.
    for (const listener of Array.from(listeners)) listener();
  }

  /** ONE slice write. `change` returns the lists it replaces. `whole` (replaceAll) starts
   *  from an empty set instead of the stored one, so skipped records and unknown keys go
   *  too; the stored mark is still absorbed first, so it is never lowered. */
  async function write(change: (set: RawSet) => RawSet, bounded: boolean, whole = false): Promise<void> {
    if (retired) throw new ReviewStoreError('unsupported');
    const saved: { set: RawSet | null } = { set: null };
    await writePluginDataSlice(plugin, 'reviews', (current) => {
      const set = recordSetOf(current, repositoryId);
      if (set === null) throw new ReviewStoreError('unsupported');
      absorb(set);
      const merged: RawSet = { workItems: [], rules: [], dispositions: [], ...(whole ? {} : set), v: 1, ...change(set) };
      absorb(merged);
      const previous = !whole && isPlainObject(set.highWater) ? set.highWater : {};
      const next: RawSet = { ...merged, highWater: { ...previous, workItem: marks.workItem, rule: marks.rule } };
      if (bounded && JSON.stringify(next).length > REVIEW_STORE_MAX_BYTES) throw new ReviewStoreError('full');
      saved.set = next;
      return { ...(isPlainObject(current) ? current : {}), [repositoryId]: next };
    });
    reading = null;
    lastWritten = saved.set;
    notify();
  }

  function writeList(key: ListKey, apply: (list: readonly unknown[]) => unknown[], bounded: boolean): Promise<void> {
    return write((set) => ({ [key]: apply(asUnknownArray(set[key])) }), bounded);
  }

  async function save(key: ListKey, record: StoredRecord | null, field: 'id' | 'finding'): Promise<void> {
    const id = record === null ? undefined : record[field];
    if (record === null || typeof id !== 'string') throw new ReviewStoreError('unrepresentable');
    await writeList(key, (list) => upsert(list, field, id, record), true);
  }

  return {
    listWorkItems: async () => (await read()).workItems.slice(),
    listRules: async () => (await read()).rules.slice(),
    listDispositions: async () => (await read()).dispositions.slice(),
    saveWorkItem: (item) => save('workItems', encodeWorkItem(item, repositoryId), 'id'),
    removeWorkItem: (id) => writeList('workItems', (list) => without(list, 'id', id), false),
    saveRule: (rule) => save('rules', encodeRule(rule), 'id'),
    removeRule: (id) => writeList('rules', (list) => without(list, 'id', id), false),
    saveDisposition: (decision) => save('dispositions', encodeDisposition(decision, repositoryId), 'finding'),
    removeDisposition(fingerprint) {
      const key = storedFindingKey(fingerprint, repositoryId);
      // Y6: such a decision was never stored, so nothing on disk can match it. Part 6 E8: the
      // write still runs, unchanged, so it notifies once like every other successful removal
      // (the store's own-write count relies on it) and a read-only set still refuses it.
      return writeList('dispositions', (list) => (key === null ? list.slice() : without(list, 'finding', key)), false);
    },
    async replaceAll(state) {
      const workItems = allStored(state.workItems.map((w) => encodeWorkItem(w, repositoryId)));
      const rules = allStored(state.rules.map((r) => encodeRule(r)));
      const dispositions = allStored(state.dispositions.map((d) => encodeDisposition(d, repositoryId)));
      // R1: all or nothing. One record that cannot be stored refuses the whole replacement.
      if (workItems === null || rules === null || dispositions === null) throw new ReviewStoreError('unrepresentable');
      await write(() => ({ workItems, rules, dispositions }), true, true);
    },
    allocateId(kind) {
      // R9: only this adapter throws here. Seeding from zero could hand out an id already on
      // disk, and saveWorkItem/saveRule are upserts: they cannot tell a new id from an edit,
      // so that save would overwrite a stored record. The review store adds nothing before
      // its first load (`ready`), so this only stops a caller that skips it.
      if (!seeded) throw new Error('allocateId was called before the first read of the stored review state.');
      marks[kind] += 1;
      return formatReviewId(kind, marks[kind]);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    diagnostics() {
      if (lastWritten !== null) {
        lastDiagnostics = { skipped: decodeRecords(lastWritten, repositoryId).skipped, unsupported: false };
        lastWritten = null;
      }
      return { ...lastDiagnostics };
    },
    retire() {
      retired = true;
      reading = null;
      notify();
    },
  };
}
