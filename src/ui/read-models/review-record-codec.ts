// Part 6 Y6/Y7: one review record ⇄ its stored form, for the durable adapter
// (src/adapters/storage/plugin-data-review-repository.ts). The stored form is the Part 5 v2
// export's PATH form: never a raw entity id, a NUL byte or the repository id.
// - out: the export's own converters (review-state.ts), which use the strict parseEntityId;
// - in: the import's own record schemas and converters (review-state-import.ts), which
//   build entity ids with makeEntityId.
// Every encoded record is checked with the schema a read uses, so whatever is written is
// read back. A record of another codebase, or of an entity that is not a file, cannot be
// stored: its path would read back as a file of THIS codebase.
import type { z } from 'zod';
import { parseEntityId } from '../../domain/entity-id';
import { workTargetKey, type BoundaryRule, type FindingDisposition, type WorkItem } from '../stores/ports/review-repository';
import { exportedDisposition, exportedRule, exportedWorkItem, findingRef } from './review-state';
import { DISPOSITION, RULE, WORK_ITEM, toDisposition, toRule, toWorkItem } from './review-state-import';

/** One record as stored in data.json: plain JSON. */
export type StoredRecord = Record<string, unknown>;
/** A read of one record set. `skipped` counts the entries it could not use (Y7). */
export interface DecodedRecords { workItems: WorkItem[]; rules: BoundaryRule[]; dispositions: FindingDisposition[]; skipped: number }

/** True for a FILE entity id of this codebase, by the strict parse. */
function ownFile(entityId: string, repositoryId: string): boolean {
  try {
    const parsed = parseEntityId(entityId);
    return parsed.repositoryId === repositoryId && parsed.kind === 'file';
  } catch {
    return false;
  }
}

const readable = (schema: z.ZodType, record: StoredRecord | null): StoredRecord | null =>
  record !== null && schema.safeParse(record).success ? record : null;

/** Y6: the stored form, or null when it cannot be stored (the save is refused). */
export function encodeWorkItem(item: WorkItem, repositoryId: string): StoredRecord | null {
  if (item.target.kind === 'file' && !ownFile(item.target.entityId, repositoryId)) return null;
  return readable(WORK_ITEM, exportedWorkItem(item));
}

export function encodeRule(rule: BoundaryRule): StoredRecord | null {
  return readable(RULE, exportedRule(rule));
}

/** Y6: a decision's stored key (`<path>#<findingId>`), or null for a fingerprint that is
 *  not a finding on a file of this codebase. A removal looks records up by it. */
export function storedFindingKey(fingerprint: string, repositoryId: string): string | null {
  const at = fingerprint.lastIndexOf('#');
  return at >= 0 && ownFile(fingerprint.slice(0, at), repositoryId) ? findingRef(fingerprint) : null;
}

export function encodeDisposition(decision: FindingDisposition, repositoryId: string): StoredRecord | null {
  if (storedFindingKey(decision.fingerprint, repositoryId) === null) return null;
  return readable(DISPOSITION, exportedDisposition(decision));
}

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? (value as unknown[]) : []);

/** Y7: validates each entry. One that fails, or that repeats a key an earlier entry
 *  already has, is skipped and counted. Nothing here removes anything from disk. */
function decodeList<S, T>(
  entries: readonly unknown[], schema: z.ZodType<S>, convert: (stored: S) => T | null, keys: (record: T) => readonly string[],
): { records: T[]; skipped: number } {
  const seen = new Set<string>();
  const records: T[] = [];
  let skipped = 0;
  for (const entry of entries) {
    const parsed = schema.safeParse(entry);
    const record = parsed.success ? convert(parsed.data) : null;
    const recordKeys = record === null ? [] : keys(record);
    if (record === null || recordKeys.some((k) => seen.has(k))) {
      skipped += 1;
      continue;
    }
    for (const k of recordKeys) seen.add(k);
    records.push(record);
  }
  return { records, skipped };
}

/** Y7: one codebase's record set in the store's shapes, file paths as entity ids of
 *  `repositoryId`. Anything that is not a set reads as empty. */
export function decodeRecords(raw: unknown, repositoryId: string): DecodedRecords {
  const set: Record<string, unknown> = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const workItems = decodeList(listOf(set.workItems), WORK_ITEM, (w) => toWorkItem(w, repositoryId),
    (w) => [`id:${w.id}`, `key:${workTargetKey(w.target, w.intent)}`]);
  const rules = decodeList(listOf(set.rules), RULE, (r) => toRule(r), (r) => [`id:${r.id}`, `pair:${JSON.stringify([r.from, r.to])}`]);
  const dispositions = decodeList(listOf(set.dispositions), DISPOSITION, (d) => toDisposition(d, repositoryId), (d) => [d.fingerprint]);
  return {
    workItems: workItems.records, rules: rules.records, dispositions: dispositions.records,
    skipped: workItems.skipped + rules.skipped + dispositions.skipped,
  };
}
