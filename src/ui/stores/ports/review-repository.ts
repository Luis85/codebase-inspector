// WP-02 spec §4.5: review decisions live behind a port. Parts 1-4 ship in-memory only;
// Part 2 adds boundary rules (spec P5). Part 3 adds dispositions (Q3) and work-item
// targets (Q4).
import type { EntityId } from '../../../domain/entity-id';

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

/** Controller ruling Part 4 E2: a title cap must never make an existing action silently do
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
}

export function createInMemoryReviewRepository(): ReviewRepository {
  const items = new Map<string, WorkItem>();
  const rules = new Map<string, BoundaryRule>();
  const dispositions = new Map<string, FindingDisposition>();
  return {
    listWorkItems: () => Promise.resolve([...items.values()]),
    saveWorkItem: (item) => { items.set(item.id, { ...item }); return Promise.resolve(); },
    removeWorkItem: (id) => { items.delete(id); return Promise.resolve(); },
    listRules: () => Promise.resolve([...rules.values()]),
    saveRule: (rule) => { rules.set(rule.id, { ...rule }); return Promise.resolve(); },
    removeRule: (id) => { rules.delete(id); return Promise.resolve(); },
    listDispositions: () => Promise.resolve([...dispositions.values()]),
    saveDisposition: (d) => { dispositions.set(d.fingerprint, { ...d }); return Promise.resolve(); },
    removeDisposition: (fingerprint) => { dispositions.delete(fingerprint); return Promise.resolve(); },
  };
}
