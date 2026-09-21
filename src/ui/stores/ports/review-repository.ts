// WP-02 spec §4.5: review decisions live behind a port. Parts 1-4 ship in-memory only;
// the backend phase adds plugin-data / Markdown implementations without touching the UI.
import type { EntityId } from '../../../domain/entity-id';

export type WorkItemStatus = 'investigate' | 'planned' | 'in-progress' | 'verified';

export interface WorkItem {
  id: string;
  entityId: EntityId;
  title: string;
  status: WorkItemStatus;
  createdAt: string;
}

export interface ReviewRepository {
  listWorkItems(): Promise<WorkItem[]>;
  saveWorkItem(item: WorkItem): Promise<void>;
  removeWorkItem(id: string): Promise<void>;
}

export function createInMemoryReviewRepository(): ReviewRepository {
  const items = new Map<string, WorkItem>();
  return {
    listWorkItems: () => Promise.resolve([...items.values()]),
    saveWorkItem: (item) => { items.set(item.id, { ...item }); return Promise.resolve(); },
    removeWorkItem: (id) => { items.delete(id); return Promise.resolve(); },
  };
}
