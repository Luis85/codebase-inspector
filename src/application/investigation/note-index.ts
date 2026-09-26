// WP-04 IN33/IN36 (IP13, IP4): the pure note-index reducer over frontmatter. A note is ours
// when its `type` is NOTE_TYPE; the index groups linked notes by the portable
// `<source_path>#<finding_id>` fingerprint (IP4), per codebase. The reducer is incremental —
// `changed`, `renamed` and `deleted` update one entry, `reset` rebuilds from the whole vault
// (IPF18: the metadata cache's `resolved` event stays the repair path that drives `reset`) —
// and returns the SAME map when nothing changed, so a listener built on it fires only for real
// changes.
import { isPlainObject } from '../../domain/plain-data';
import { NOTE_TYPE } from './note-model';

export interface NoteLink {
  readonly path: string;
  readonly codebaseId: string;
  readonly fingerprint: string;
  readonly findingId: string;
  readonly sourcePath: string;
  readonly snapshotId: string;
  readonly status: string | null;
}

// IPF1: module-private — a caller only ever holds a NoteRecords map or a built NoteIndex, and
// no other src module names this shape.
type NoteRecord =
  | { readonly kind: 'linked'; readonly link: NoteLink }
  | { readonly kind: 'malformed'; readonly path: string; readonly codebaseId: string };

export type NoteRecords = ReadonlyMap<string, NoteRecord>;

export type NoteEvent =
  | { readonly kind: 'reset'; readonly files: readonly { readonly path: string; readonly frontmatter: unknown }[] }
  | { readonly kind: 'changed'; readonly path: string; readonly frontmatter: unknown }
  | { readonly kind: 'renamed'; readonly oldPath: string; readonly path: string; readonly frontmatter: unknown }
  | { readonly kind: 'deleted'; readonly path: string };

// IP13: every value is read through this one guard.
const text = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 2048 ? v : null);

/** IN33 (IP13, IPF19): links a well-formed note. `type` must equal NOTE_TYPE and `codebase_id`
 *  must pass `text`, else the note is not ours (null: it cannot be attributed to any codebase).
 *  Any of `finding_fingerprint`, `finding_id`, `source_path` or `snapshot_id` failing `text`
 *  makes the note malformed, still counted for its codebase — a hand-edited note can hold a
 *  number, a list or `null` where `stringifyYaml` would have written a string. `status` is
 *  `text(status)` or null when absent or not a string (IP38). */
export function readNoteFrontmatter(path: string, frontmatter: unknown): NoteRecord | null {
  if (!isPlainObject(frontmatter) || frontmatter.type !== NOTE_TYPE) return null;
  const codebaseId = text(frontmatter.codebase_id);
  if (codebaseId === null) return null;
  const fingerprint = text(frontmatter.finding_fingerprint);
  const findingId = text(frontmatter.finding_id);
  const sourcePath = text(frontmatter.source_path);
  const snapshotId = text(frontmatter.snapshot_id);
  if (fingerprint === null || findingId === null || sourcePath === null || snapshotId === null) {
    return { kind: 'malformed', path, codebaseId };
  }
  return { kind: 'linked', link: { path, codebaseId, fingerprint, findingId, sourcePath, snapshotId, status: text(frontmatter.status) } };
}

function same(a: NoteRecord | undefined, b: NoteRecord): boolean {
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

function put(records: NoteRecords, path: string, record: NoteRecord | null): NoteRecords {
  const had = records.get(path);
  if (record === null ? had === undefined : same(had, record)) return records;
  const next = new Map(records);
  if (record === null) next.delete(path); else next.set(path, record);
  return next;
}

/** IN33/IP13: `changed`, `renamed` and `deleted` update one entry; `reset` rebuilds from every
 *  file (the `resolved` repair path, IPF18). Returns the SAME map when nothing changed, so a
 *  listener built on this reducer fires only for real changes. */
export function applyNoteEvent(records: NoteRecords, event: NoteEvent): NoteRecords {
  switch (event.kind) {
    case 'reset': {
      const next = new Map<string, NoteRecord>();
      for (const f of event.files) { const r = readNoteFrontmatter(f.path, f.frontmatter); if (r) next.set(f.path, r); }
      const unchanged = next.size === records.size && Array.from(next).every(([p, r]) => same(records.get(p), r));
      return unchanged ? records : next;
    }
    case 'changed': return put(records, event.path, readNoteFrontmatter(event.path, event.frontmatter));
    case 'renamed': return put(put(records, event.oldPath, null), event.path, readNoteFrontmatter(event.path, event.frontmatter));
    case 'deleted': return put(records, event.path, null);
    default: { const never: never = event; throw new Error(`unhandled note event: ${JSON.stringify(never)}`); }
  }
}

export interface NoteIndex { readonly byFingerprint: ReadonlyMap<string, readonly NoteLink[]>; readonly malformed: number }

export const EMPTY_NOTE_INDEX: NoteIndex = { byFingerprint: new Map(), malformed: 0 };

// J3: code-unit order, never localeCompare.
function byPath(a: NoteLink, b: NoteLink): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

/** IN33/IN36: groups this codebase's linked notes by fingerprint (several notes for one
 *  finding are all listed, by path), and counts this codebase's malformed notes. */
export function noteIndexFor(records: NoteRecords, codebaseId: string): NoteIndex {
  const byFingerprint = new Map<string, NoteLink[]>();
  let malformed = 0;
  for (const record of records.values()) {
    if (record.kind === 'malformed') {
      if (record.codebaseId === codebaseId) malformed += 1;
      continue;
    }
    if (record.link.codebaseId !== codebaseId) continue;
    const list = byFingerprint.get(record.link.fingerprint);
    if (list) list.push(record.link); else byFingerprint.set(record.link.fingerprint, [record.link]);
  }
  for (const list of byFingerprint.values()) list.sort(byPath);
  return { byFingerprint, malformed };
}
