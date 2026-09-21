import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { createInMemoryReviewRepository, type ReviewRepository, type WorkItem } from './ports/review-repository';

interface ReviewState {
  workItems: WorkItem[];
  nextId: number;
  repository: ReviewRepository;
}

export const useReviewStore = defineStore('review', {
  state: (): ReviewState => ({
    workItems: [],
    nextId: 1,
    repository: markRaw(createInMemoryReviewRepository()),
  }),
  getters: {
    workItemCount: (state): number => state.workItems.length,
    hasWorkItemFor: (state) => (entityId: EntityId): boolean =>
      state.workItems.some((w) => w.entityId === entityId),
  },
  actions: {
    setRepository(repository: ReviewRepository): void {
      this.repository = markRaw(repository);
    },
    async load(): Promise<void> {
      this.workItems = await this.repository.listWorkItems();
      let maxId = 0;
      for (const item of this.workItems) {
        const match = item.id.match(/^wi-(\d+)$/);
        if (match?.[1]) {
          const num = parseInt(match[1], 10);
          if (num > maxId) maxId = num;
        }
      }
      this.nextId = maxId + 1;
    },
    /** One work item per file; a second request for the same file is refused (null).
     *  Persists through the port BEFORE touching local state (fix round 1, Important):
     *  a rejecting repository must leave `workItems`/`nextId` unchanged and the
     *  rejection must propagate, rather than the UI showing an item that was never
     *  actually saved. */
    async addWorkItemForFile(entityId: EntityId, title: string, now: Date): Promise<WorkItem | null> {
      if (this.hasWorkItemFor(entityId)) return null;
      const item: WorkItem = { id: `wi-${this.nextId}`, entityId, title, status: 'investigate', createdAt: now.toISOString() };
      await this.repository.saveWorkItem(item);
      this.nextId += 1;
      this.workItems.push(item);
      return item;
    },
    /** Same ordering rule as `addWorkItemForFile`: the port is awaited first, so a
     *  rejecting repository leaves the work item in local state instead of quietly
     *  dropping it from the UI while it still exists in storage. */
    async removeWorkItem(id: string): Promise<void> {
      await this.repository.removeWorkItem(id);
      this.workItems = this.workItems.filter((w) => w.id !== id);
    },
  },
});
