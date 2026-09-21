import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import {
  createInMemoryReviewRepository, type BoundaryRule, type ReviewRepository, type WorkItem,
} from './ports/review-repository';

const ruleKey = (from: string, to: string): string => `${from}->${to}`;

function maxSuffix(ids: readonly string[], pattern: RegExp): number {
  let max = 0;
  for (const id of ids) {
    const digits = pattern.exec(id)?.[1];
    if (digits) max = Math.max(max, parseInt(digits, 10));
  }
  return max;
}

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
  rules: BoundaryRule[];
  nextRuleId: number;
  pendingRuleKeys: string[];
}

export const useReviewStore = defineStore('review', {
  state: (): ReviewState => ({
    workItems: [],
    nextId: 1,
    repository: markRaw(createInMemoryReviewRepository()),
    pendingEntityIds: [],
    rules: [],
    nextRuleId: 1,
    pendingRuleKeys: [],
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
    ruleCount: (state): number => state.rules.length,
    hasRule: (state) => (from: string, to: string): boolean =>
      state.rules.some((r) => r.from === from && r.to === to),
  },
  actions: {
    setRepository(repository: ReviewRepository): void {
      this.repository = markRaw(repository);
    },
    /** Part 2 §5: pending-aware. A save still in flight has already reserved an id; the
     *  counters only ever move forward, so load() can never hand that id out again. */
    async load(): Promise<void> {
      const [items, rules] = await Promise.all([this.repository.listWorkItems(), this.repository.listRules()]);
      this.workItems = items;
      this.rules = rules;
      this.nextId = Math.max(this.nextId, maxSuffix(items.map((i) => i.id), /^wi-(\d+)$/) + 1);
      this.nextRuleId = Math.max(this.nextRuleId, maxSuffix(rules.map((r) => r.id), /^AR-(\d+)$/) + 1);
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
        // A load() that ran mid-save may already hold it.
        if (!this.workItems.some((w) => w.id === item.id)) this.workItems.push(item);
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
    /** Part 2 P5. Same reservation and persist-first ordering as `addWorkItemForFile`.
     *  Refuses (null) a self-rule, an empty rationale, an existing pair, and a second call
     *  for a pair whose first save has not settled. */
    async addRule(from: string, to: string, rationale: string, now: Date): Promise<BoundaryRule | null> {
      const key = ruleKey(from, to);
      if (from === to || rationale.trim() === '' || this.hasRule(from, to) || this.pendingRuleKeys.includes(key)) return null;
      const rule: BoundaryRule = {
        id: `AR-${String(this.nextRuleId).padStart(3, '0')}`, from, to, rationale: rationale.trim(), createdAt: now.toISOString(),
      };
      this.nextRuleId += 1;
      this.pendingRuleKeys.push(key);
      try {
        await this.repository.saveRule(rule);
        if (!this.rules.some((r) => r.id === rule.id)) this.rules.push(rule);
        return rule;
      } finally {
        this.pendingRuleKeys = this.pendingRuleKeys.filter((k) => k !== key);
      }
    },
    async removeRule(id: string): Promise<void> {
      await this.repository.removeRule(id);
      this.rules = this.rules.filter((r) => r.id !== id);
    },
  },
});
