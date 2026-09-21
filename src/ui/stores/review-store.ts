import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { createInMemoryReviewRepository, type ReviewRepository, type WorkItem } from './ports/review-repository';

interface ReviewState {
  workItems: WorkItem[];
  nextId: number;
  repository: ReviewRepository;
  /** Fix round 2 (Important): entity ids with an `addWorkItemForFile` save in flight.
   *  Closes the race the round-1 fix introduced — `hasWorkItemFor` alone only refuses
   *  a SECOND call once the FIRST has finished saving, so two overlapping calls for
   *  the same file (e.g. a double-click before the first save settles) both passed
   *  the guard and both computed the same `wi-${nextId}`. */
  pendingEntityIds: EntityId[];
}

export const useReviewStore = defineStore('review', {
  state: (): ReviewState => ({
    workItems: [],
    nextId: 1,
    repository: markRaw(createInMemoryReviewRepository()),
    pendingEntityIds: [],
  }),
  getters: {
    workItemCount: (state): number => state.workItems.length,
    hasWorkItemFor: (state) => (entityId: EntityId): boolean =>
      state.workItems.some((w) => w.entityId === entityId),
    /** True while a save started by `addWorkItemForFile` for this entity has not yet
     *  settled — UI callers (FileInspector) disable their own "add" control on this,
     *  not just on `hasWorkItemFor`. */
    isPendingFor: (state) => (entityId: EntityId): boolean =>
      state.pendingEntityIds.includes(entityId),
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
    /** One work item per file; a second request for the same file is refused (null),
     *  including a SECOND call that arrives while the FIRST is still saving (fix
     *  round 2 — see `pendingEntityIds`). Persists through the port BEFORE pushing
     *  into `workItems` (fix round 1, Important): a rejecting repository must leave
     *  `workItems` unchanged and the rejection must propagate, rather than the UI
     *  showing an item that was never actually saved.
     *
     *  The id and `nextId` advance are reserved SYNCHRONOUSLY, before the `await`
     *  (fix round 2, Important): two overlapping calls for the same file both read
     *  the guard and computed `wi-${nextId}` before either had actually saved, so
     *  both got the SAME id. Reserving the id up front, and marking the entity
     *  pending up front too (so the second call's guard sees it and refuses),
     *  closes that race. A failed save still leaves a gap in the id sequence
     *  (the reservation isn't rolled back) — an accepted tradeoff for never
     *  reusing an id a caller may already have observed. */
    async addWorkItemForFile(entityId: EntityId, title: string, now: Date): Promise<WorkItem | null> {
      if (this.hasWorkItemFor(entityId) || this.isPendingFor(entityId)) return null;
      const item: WorkItem = { id: `wi-${this.nextId}`, entityId, title, status: 'investigate', createdAt: now.toISOString() };
      this.nextId += 1;
      this.pendingEntityIds.push(entityId);
      try {
        await this.repository.saveWorkItem(item);
        this.workItems.push(item);
        return item;
      } finally {
        this.pendingEntityIds = this.pendingEntityIds.filter((id) => id !== entityId);
      }
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
