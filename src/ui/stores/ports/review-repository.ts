// WP-02 spec §4.5: review decisions live behind a port. Parts 1-4 ship in-memory only;
// Part 2 adds boundary rules (spec P5). Part 3 adds dispositions (Q3) and work-item
// targets (Q4). Part 6 adds id allocation (Y10), change notifications (Y12) and storage
// diagnostics (Y7), which the durable adapter implements the same way.
import type { EntityId } from '../../../domain/entity-id';

/** Part 6 Y9/Y7, moved here by Polish E1 (L3): a refused review write — nothing was written and
 *  nobody was told. The durable adapter throws it; a screen maps its code to words
 *  (read-models/review-failure.ts) without importing the adapter. */
export type ReviewStoreErrorCode = 'full' | 'unsupported' | 'unrepresentable';

export class ReviewStoreError extends Error {
  readonly code: ReviewStoreErrorCode;

  constructor(code: ReviewStoreErrorCode, message = `review store: ${code}`) {
    super(message);
    this.name = 'ReviewStoreError';
    this.code = code;
  }
}

export type WorkItemStatus = 'investigate' | 'planned' | 'in-progress' | 'verified';

/** Part 3 Q4: a work item's subject. A file targets an entity directly; a package or
 *  module targets it by name, since neither has an EntityId of its own. */
export type WorkTarget =
  | { kind: 'file'; entityId: EntityId }
  | { kind: 'package'; name: string }
  | { kind: 'module'; module: string };

export type WorkIntent = 'refactor' | 'tests' | 'review' | 'pairing' | 'documentation';

/** Part 4 W8: how urgent the reviewer judges the work; a user decision, not evidence. */
export type WorkPriority = 'high' | 'medium' | 'low';
/** Part 4 W8: the three verification checks, in the order the editor lists them. */
export type WorkChecks = readonly [boolean, boolean, boolean];
/** Frozen so the shared tuple can never be mutated at runtime; Vue leaves a frozen
 *  object unproxied when it enters state, which is fine here since nothing needs to
 *  react to changes on it — every write replaces it with a new tuple. */
export const NO_CHECKS: WorkChecks = Object.freeze([false, false, false]);
export const WORK_TITLE_MAX = 160;
export const WORK_NOTES_MAX = 5000;
/** Part 5 E9(b): shared by the store's `addRule` refusal, `RuleEditor`'s rationale
 *  textarea `maxlength`, and the import parser's rule schema, so a reviewer's own
 *  export always re-imports. */
export const RULE_RATIONALE_MAX = 1000;

export interface WorkItem {
  id: string;
  target: WorkTarget;
  intent: WorkIntent;
  title: string;
  status: WorkItemStatus;
  priority: WorkPriority;
  notes: string;
  checks: WorkChecks;
  createdAt: string;
  updatedAt?: string;
}

/** Part 3 Q4: one work item per (target, intent). The kind prefix keeps a package and a
 *  module with the same name apart. */
export function workTargetKey(target: WorkTarget, intent: WorkIntent): string {
  const subject = target.kind === 'file' ? target.entityId : target.kind === 'package' ? target.name : target.module;
  return `${target.kind}:${subject}:${intent}`;
}

/** Part 4 W9: what an edit may change. The target and intent are the item's identity
 *  (Q4), so they never change after creation. */
export interface WorkItemPatch { title?: string; status?: WorkItemStatus; priority?: WorkPriority; notes?: string; checks?: WorkChecks }
/** Part 4 W11: what the editor's create mode may set up front. `addWorkItem` validates
 *  the result with `workItemProblem`, so a new item can never start as an unchecked
 *  `verified`. */
export interface WorkItemInit { priority?: WorkPriority; notes?: string; status?: WorkItemStatus; checks?: WorkChecks }

export function allChecksDone(checks: WorkChecks): boolean {
  return checks[0] && checks[1] && checks[2];
}

/** Controller ruling Part 4 E3: a title cap must never make an existing action silently do
 *  nothing. A generated title (e.g. built from a long package or file name) is clipped
 *  to `WORK_TITLE_MAX` rather than refused; the last character becomes the single-char
 *  ellipsis so the clipped result is still exactly `WORK_TITLE_MAX` long. A title the
 *  user typed is different — `workItemProblem` still refuses that one, so the editor
 *  can explain it instead of silently truncating what they wrote. */
export function clipTitle(title: string): string {
  if (title.length <= WORK_TITLE_MAX) return title;
  return `${title.slice(0, WORK_TITLE_MAX - 1)}…`;
}

/** Part 4 W9: the one validity rule, shared by the store (which refuses) and the editor
 *  (which explains). `verified` needs every check done. */
export function workItemProblem(item: Pick<WorkItem, 'title' | 'notes' | 'status' | 'checks'>): 'title-empty' | 'title-long' | 'notes-long' | 'unverified' | null {
  const title = item.title.trim();
  if (title === '') return 'title-empty';
  if (title.length > WORK_TITLE_MAX) return 'title-long';
  if (item.notes.length > WORK_NOTES_MAX) return 'notes-long';
  if (item.status === 'verified' && !allChecksDone(item.checks)) return 'unverified';
  return null;
}

/** Part 2 P5: an intended boundary, "`from` must not import `to`". Module names are the
 *  read models' module keys (a top-level directory, or '(root)'). */
export interface BoundaryRule {
  id: string;
  from: string;
  to: string;
  rationale: string;
  createdAt: string;
}

/** Part 3 Q3: a reviewer's decision on a finding, kept apart from the generated
 *  finding itself and keyed by its fingerprint. */
export type DispositionStatus = 'acknowledged' | 'dismissed';

export interface FindingDisposition {
  fingerprint: string;
  status: DispositionStatus;
  reason?: string;
  decidedAt: string;
}

export const DISMISS_REASON_MAX = 1000;

/** Part 6 Y10: the two id sequences `allocateId` draws from. */
export type ReviewIdKind = 'workItem' | 'rule';

/** Part 6 Y7: what a durable adapter could not list — records skipped (kept on disk, not
 *  listed) and a record set in a format it does not support. Valid after the first list. */
export interface ReviewStorageDiagnostics { skipped: number; unsupported: boolean }

/** Part 6 Y7: nothing skipped, nothing unsupported — the in-memory adapter's answer, and
 *  what the review store shows before a load (controller ruling Part 6 E10: defined once). */
export const noStorageDiagnostics = (): ReviewStorageDiagnostics => ({ skipped: 0, unsupported: false });

/** Part 6 Y10: `wi-N`, or `AR-` with at least three digits (`AR-007`), as before Part 6. */
export function formatReviewId(kind: ReviewIdKind, n: number): string {
  return kind === 'workItem' ? `wi-${n}` : `AR-${String(n).padStart(3, '0')}`;
}

/** Part 6 Y10: the number in a `wi-N` or `AR-N` id, or null for any other id. At most 15
 *  digits, so a high-water mark built from it is always an exact integer. */
export function reviewIdSuffix(id: string): number | null {
  const digits = /^(?:wi|AR)-(\d{1,15})$/.exec(id)?.[1];
  return digits === undefined ? null : parseInt(digits, 10);
}

/** Part 6 R1: a whole review state, written by `ReviewRepository.replaceAll` in one step (an
 *  import, or nothing for a clear). */
export interface ReviewReplaceState {
  workItems: readonly WorkItem[];
  rules: readonly BoundaryRule[];
  dispositions: readonly FindingDisposition[];
}

export interface ReviewRepository {
  listWorkItems(): Promise<WorkItem[]>;
  saveWorkItem(item: WorkItem): Promise<void>;
  removeWorkItem(id: string): Promise<void>;
  listRules(): Promise<BoundaryRule[]>;
  saveRule(rule: BoundaryRule): Promise<void>;
  removeRule(id: string): Promise<void>;
  listDispositions(): Promise<FindingDisposition[]>;
  saveDisposition(d: FindingDisposition): Promise<void>;
  removeDisposition(fingerprint: string): Promise<void>;
  /** Part 6 R1: replaces every work item, rule and disposition of this codebase with `state`,
   *  atomically: all or nothing, one notification. Raises the high-water marks past the ids
   *  given and never lowers them. */
  replaceAll(state: ReviewReplaceState): Promise<void>;
  /** Part 6 Y10: the next unused id of `kind`, synchronously; never the same id twice. A
   *  high-water mark per kind: every save raises it past the saved id, a removal never lowers
   *  it, and a durable adapter seeds it from storage on its first list — so a caller
   *  allocates only after one list has finished (the review store's `ready`). */
  allocateId(kind: ReviewIdKind): string;
  /** Part 6 Y12: `listener` runs once after every successful write — from any caller — and
   *  before that write's promise resolves; never for a rejected write. Returns the
   *  unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Part 6 Y7: see `ReviewStorageDiagnostics`. */
  diagnostics(): ReviewStorageDiagnostics;
}

/** Tests, the harness and every codebase before the host wires its registry (Part 6 Y11).
 *  Same id allocation and notifications as the durable adapter; listing seeds the high-water
 *  mark too, although here every record already came through a save. Never throws (R9). */
export function createInMemoryReviewRepository(): ReviewRepository {
  const items = new Map<string, WorkItem>();
  const rules = new Map<string, BoundaryRule>();
  const dispositions = new Map<string, FindingDisposition>();
  const high: Record<ReviewIdKind, number> = { workItem: 0, rule: 0 };
  const listeners = new Set<() => void>();
  const raise = (kind: ReviewIdKind, ids: Iterable<string>): void => {
    for (const id of ids) high[kind] = Math.max(high[kind], reviewIdSuffix(id) ?? 0);
  };
  const wrote = (): Promise<void> => {
    // A copy, so a listener that unsubscribes (or subscribes) mid-notification is safe.
    for (const listener of Array.from(listeners)) listener();
    return Promise.resolve();
  };
  return {
    listWorkItems: () => { raise('workItem', items.keys()); return Promise.resolve([...items.values()]); },
    saveWorkItem: (item) => { items.set(item.id, { ...item }); raise('workItem', [item.id]); return wrote(); },
    removeWorkItem: (id) => { items.delete(id); return wrote(); },
    listRules: () => { raise('rule', rules.keys()); return Promise.resolve([...rules.values()]); },
    saveRule: (rule) => { rules.set(rule.id, { ...rule }); raise('rule', [rule.id]); return wrote(); },
    removeRule: (id) => { rules.delete(id); return wrote(); },
    listDispositions: () => Promise.resolve([...dispositions.values()]),
    saveDisposition: (d) => { dispositions.set(d.fingerprint, { ...d }); return wrote(); },
    removeDisposition: (fingerprint) => { dispositions.delete(fingerprint); return wrote(); },
    replaceAll: (state) => {
      items.clear();
      rules.clear();
      dispositions.clear();
      for (const w of state.workItems) items.set(w.id, { ...w });
      for (const r of state.rules) rules.set(r.id, { ...r });
      for (const d of state.dispositions) dispositions.set(d.fingerprint, { ...d });
      raise('workItem', items.keys());
      raise('rule', rules.keys());
      return wrote();
    },
    allocateId: (kind) => { high[kind] += 1; return formatReviewId(kind, high[kind]); },
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    diagnostics: noStorageDiagnostics,
  };
}
