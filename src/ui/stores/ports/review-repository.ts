// WP-02 spec §4.5: review decisions live behind a port. Parts 1-4 ship in-memory only;
// Part 2 adds boundary rules (spec P5).
import type { EntityId } from '../../../domain/entity-id';

export type WorkItemStatus = 'investigate' | 'planned' | 'in-progress' | 'verified';

export interface WorkItem {
  id: string;
  entityId: EntityId;
  title: string;
  status: WorkItemStatus;
  createdAt: string;
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

export interface ReviewRepository {
  listWorkItems(): Promise<WorkItem[]>;
  saveWorkItem(item: WorkItem): Promise<void>;
  removeWorkItem(id: string): Promise<void>;
  listRules(): Promise<BoundaryRule[]>;
  saveRule(rule: BoundaryRule): Promise<void>;
  removeRule(id: string): Promise<void>;
}

export function createInMemoryReviewRepository(): ReviewRepository {
  const items = new Map<string, WorkItem>();
  const rules = new Map<string, BoundaryRule>();
  return {
    listWorkItems: () => Promise.resolve([...items.values()]),
    saveWorkItem: (item) => { items.set(item.id, { ...item }); return Promise.resolve(); },
    removeWorkItem: (id) => { items.delete(id); return Promise.resolve(); },
    listRules: () => Promise.resolve([...rules.values()]),
    saveRule: (rule) => { rules.set(rule.id, { ...rule }); return Promise.resolve(); },
    removeRule: (id) => { rules.delete(id); return Promise.resolve(); },
  };
}
