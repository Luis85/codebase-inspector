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

export interface WorkItem {
  id: string;
  target: WorkTarget;
  intent: WorkIntent;
  title: string;
  status: WorkItemStatus;
  createdAt: string;
}

/** Part 3 Q4: one work item per (target, intent). The kind prefix keeps a package and a
 *  module with the same name apart. */
export function workTargetKey(target: WorkTarget, intent: WorkIntent): string {
  const subject = target.kind === 'file' ? target.entityId : target.kind === 'package' ? target.name : target.module;
  return `${target.kind}:${subject}:${intent}`;
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
