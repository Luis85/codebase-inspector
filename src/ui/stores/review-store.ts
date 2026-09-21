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
      this.nextId = this.workItems.length + 1;
    },
    /** One work item per file; a second request for the same file is refused (null). */
    async addWorkItemForFile(entityId: EntityId, title: string, now: Date): Promise<WorkItem | null> {
      if (this.hasWorkItemFor(entityId)) return null;
      const item: WorkItem = { id: `wi-${this.nextId}`, entityId, title, status: 'investigate', createdAt: now.toISOString() };
      this.nextId += 1;
      this.workItems.push(item);
      await this.repository.saveWorkItem(item);
      return item;
    },
    async removeWorkItem(id: string): Promise<void> {
      this.workItems = this.workItems.filter((w) => w.id !== id);
      await this.repository.removeWorkItem(id);
    },
  },
});
