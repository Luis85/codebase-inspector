import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import {
  createInMemoryReviewRepository, workTargetKey, workItemProblem, clipTitle, NO_CHECKS, DISMISS_REASON_MAX,
  type BoundaryRule, type FindingDisposition, type ReviewRepository, type WorkIntent, type WorkItem, type WorkItemInit,
  type WorkItemPatch, type WorkTarget,
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

function isRejected(result: PromiseSettledResult<unknown>): result is PromiseRejectedResult {
  return result.status === 'rejected';
}

interface ReviewState {
  workItems: WorkItem[];
  nextId: number;
  repository: ReviewRepository;
  rules: BoundaryRule[];
  nextRuleId: number;
  pendingRuleKeys: string[];
  /** Fix round 2 (Important): work-item keys (target + intent) with a `addWorkItem`
   *  save in flight. Closes the race the round-1 fix introduced — `hasWorkItem` alone
   *  only refuses a SECOND call once the FIRST has finished saving, so two overlapping
   *  calls for the same target+intent (e.g. a double-click before the first save
   *  settles) both passed the guard and both computed the same `wi-${nextId}`. */
  pendingWorkKeys: string[];
  /** Part 4 W9: work-item ids with an update or removal in flight. */
  pendingItemIds: string[];
  /** Part 3 Q3: decisions on findings, kept apart from the findings themselves. */
  dispositions: FindingDisposition[];
  /** Fingerprints with a `decide` (acknowledge/dismiss) or `reopen` in flight — same
   *  reservation pattern as `pendingWorkKeys`. */
  pendingFingerprints: string[];
}

export const useReviewStore = defineStore('review', {
  state: (): ReviewState => ({
    workItems: [],
    nextId: 1,
    repository: markRaw(createInMemoryReviewRepository()),
    rules: [],
    nextRuleId: 1,
    pendingRuleKeys: [],
    pendingWorkKeys: [],
    pendingItemIds: [],
    dispositions: [],
    pendingFingerprints: [],
  }),
  getters: {
    workItemCount: (state): number => state.workItems.length,
    /** Part 4 W13: the nav badge counts what is still to do. */
    openWorkItemCount: (state): number => state.workItems.filter((w) => w.status !== 'verified').length,
    isItemPending: (state) => (id: string): boolean => state.pendingItemIds.includes(id),
    hasWorkItem: (state) => (target: WorkTarget, intent: WorkIntent): boolean =>
      state.workItems.some((w) => workTargetKey(w.target, w.intent) === workTargetKey(target, intent)),
    isPending: (state) => (target: WorkTarget, intent: WorkIntent): boolean =>
      state.pendingWorkKeys.includes(workTargetKey(target, intent)),
    /** Unchanged meaning since Part 1: this file already has a REFACTOR item. */
    hasWorkItemFor: (state) => (entityId: EntityId): boolean =>
      state.workItems.some((w) => w.intent === 'refactor' && w.target.kind === 'file' && w.target.entityId === entityId),
    isPendingFor: (state) => (entityId: EntityId): boolean =>
      state.pendingWorkKeys.includes(workTargetKey({ kind: 'file', entityId }, 'refactor')),
    workItemsForFile: (state) => (entityId: EntityId): WorkItem[] =>
      state.workItems.filter((w) => w.target.kind === 'file' && w.target.entityId === entityId),
    ruleCount: (state): number => state.rules.length,
    hasRule: (state) => (from: string, to: string): boolean =>
      state.rules.some((r) => r.from === from && r.to === to),
    dispositionFor: (state) => (fingerprint: string): FindingDisposition | undefined =>
      state.dispositions.find((d) => d.fingerprint === fingerprint),
    isDispositionPending: (state) => (fingerprint: string): boolean => state.pendingFingerprints.includes(fingerprint),
  },
  actions: {
    setRepository(repository: ReviewRepository): void {
      this.repository = markRaw(repository);
    },
    /** Part 2 §5: pending-aware. A save still in flight has already reserved an id; the
     *  counters only ever move forward, so load() can never hand that id out again. */
    async load(): Promise<void> {
      const [items, rules, dispositions] = await Promise.all([
        this.repository.listWorkItems(), this.repository.listRules(), this.repository.listDispositions(),
      ]);
      this.workItems = items;
      this.rules = rules;
      this.dispositions = dispositions;
      this.nextId = Math.max(this.nextId, maxSuffix(items.map((i) => i.id), /^wi-(\d+)$/) + 1);
      this.nextRuleId = Math.max(this.nextRuleId, maxSuffix(rules.map((r) => r.id), /^AR-(\d+)$/) + 1);
    },
    /** One work item per (target, intent); a second request for the same pair is
     *  refused (null), including a SECOND call that arrives while the FIRST is still
     *  saving (fix round 2 — see `pendingWorkKeys`). Persists through the port BEFORE
     *  pushing into `workItems` (fix round 1, Important): a rejecting repository must
     *  leave `workItems` unchanged and the rejection must propagate, rather than the UI
     *  showing an item that was never actually saved.
     *
     *  The id and `nextId` advance are reserved SYNCHRONOUSLY, before the `await`
     *  (fix round 2, Important): two overlapping calls for the same target+intent both
     *  read the guard and computed `wi-${nextId}` before either had actually saved, so
     *  both got the SAME id. Reserving the id up front, and marking the key pending up
     *  front too (so the second call's guard sees it and refuses), closes that race. A
     *  failed save still leaves a gap in the id sequence (the reservation isn't rolled
     *  back) — an accepted tradeoff for never reusing an id a caller may already have
     *  observed. */
    async addWorkItem(target: WorkTarget, intent: WorkIntent, title: string, now: Date, init: WorkItemInit = {}): Promise<WorkItem | null> {
      const key = workTargetKey(target, intent);
      if (this.hasWorkItem(target, intent) || this.pendingWorkKeys.includes(key)) return null;
      // Controller ruling E2: clip (never refuse) an over-long GENERATED title, so a
      // long package or file name can never make the calling button silently do
      // nothing. `updateWorkItem` still refuses one via `workItemProblem` — that title
      // came from the user, and the editor can explain the refusal.
      const item: WorkItem = {
        id: `wi-${this.nextId}`, target, intent, title: clipTitle(title.trim()), status: init.status ?? 'investigate',
        priority: init.priority ?? 'medium', notes: init.notes ?? '', checks: init.checks ?? NO_CHECKS, createdAt: now.toISOString(),
      };
      if (workItemProblem(item) !== null) return null;
      this.nextId += 1;
      this.pendingWorkKeys.push(key);
      try {
        await this.repository.saveWorkItem(item);
        // A load() that ran mid-save may already hold it.
        if (!this.workItems.some((w) => w.id === item.id)) this.workItems.push(item);
        return item;
      } finally {
        this.pendingWorkKeys = this.pendingWorkKeys.filter((k) => k !== key);
      }
    },
    addWorkItemForFile(entityId: EntityId, title: string, now: Date): Promise<WorkItem | null> {
      return this.addWorkItem({ kind: 'file', entityId }, 'refactor', title, now);
    },
    /** Part 4 W9: same persist-first ordering and pending reservation as `addWorkItem`,
     *  keyed by id. Refuses (null) an unknown id, a pending id, and any edit that
     *  `workItemProblem` rejects — `verified` needs all three checks, here as well as in
     *  the editor. */
    async updateWorkItem(id: string, patch: WorkItemPatch, now: Date): Promise<WorkItem | null> {
      const current = this.workItems.find((w) => w.id === id);
      if (!current || this.pendingItemIds.includes(id)) return null;
      // Copies only the five patch fields, and only when present: `{ ...current,
      // ...patch }` would accept any wider object at runtime (a full WorkItem passed as
      // a patch could overwrite id/target/intent/createdAt), and an explicit `undefined`
      // in a field the caller did pass would clobber a required field instead of
      // leaving it alone. The target and intent (the item's identity, Q4) can then
      // never change through this path.
      const next: WorkItem = { ...current, updatedAt: now.toISOString() };
      if (patch.title !== undefined) next.title = patch.title.trim();
      if (patch.status !== undefined) next.status = patch.status;
      if (patch.priority !== undefined) next.priority = patch.priority;
      if (patch.notes !== undefined) next.notes = patch.notes;
      if (patch.checks !== undefined) next.checks = patch.checks;
      if (workItemProblem(next) !== null) return null;
      this.pendingItemIds.push(id);
      try {
        await this.repository.saveWorkItem(next);
        this.workItems = this.workItems.map((w) => (w.id === id ? next : w));
        return next;
      } finally {
        this.pendingItemIds = this.pendingItemIds.filter((p) => p !== id);
      }
    },
    /** Persist first (a rejecting port leaves the item in place); refused (false) for an
     *  unknown id (so E17 callers never announce a removal that did not happen), and
     *  while an update or removal of the same id is in flight. */
    async removeWorkItem(id: string): Promise<boolean> {
      if (!this.workItems.some((w) => w.id === id) || this.pendingItemIds.includes(id)) return false;
      this.pendingItemIds.push(id);
      try {
        await this.repository.removeWorkItem(id);
        this.workItems = this.workItems.filter((w) => w.id !== id);
        return true;
      } finally {
        this.pendingItemIds = this.pendingItemIds.filter((p) => p !== id);
      }
    },
    /** Part 4 W14: removes every work item, rule and disposition through the port with
     *  `Promise.allSettled`, so one rejection does not stop the rest from being
     *  attempted; reloads from the port in a `finally` so local state always matches
     *  what it still holds afterwards, even after a partial failure; then rethrows the
     *  first rejection (if any), after the reload, so the caller still sees it. */
    async clearAll(): Promise<void> {
      let results: PromiseSettledResult<void>[] = [];
      try {
        results = await Promise.allSettled([
          ...this.workItems.map((w) => this.repository.removeWorkItem(w.id)),
          ...this.rules.map((r) => this.repository.removeRule(r.id)),
          ...this.dispositions.map((d) => this.repository.removeDisposition(d.fingerprint)),
        ]);
      } finally {
        await this.load();
      }
      const rejected = results.find(isRejected);
      if (rejected) throw rejected.reason;
    },
    /** Part 2 P5. Same reservation and persist-first ordering as `addWorkItem`.
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
    /** Part 3 Q3: a decision is stored apart from the generated finding, keyed by its
     *  fingerprint. Same persist-first ordering and pending guard as work items. */
    async decide(disposition: FindingDisposition): Promise<FindingDisposition | null> {
      const fp = disposition.fingerprint;
      if (this.pendingFingerprints.includes(fp)) return null;
      this.pendingFingerprints.push(fp);
      try {
        await this.repository.saveDisposition(disposition);
        this.dispositions = [...this.dispositions.filter((d) => d.fingerprint !== fp), disposition];
        return disposition;
      } finally {
        this.pendingFingerprints = this.pendingFingerprints.filter((f) => f !== fp);
      }
    },
    acknowledge(fingerprint: string, now: Date): Promise<FindingDisposition | null> {
      return this.decide({ fingerprint, status: 'acknowledged', decidedAt: now.toISOString() });
    },
    dismiss(fingerprint: string, reason: string, now: Date): Promise<FindingDisposition | null> {
      const trimmed = reason.trim();
      if (trimmed === '' || trimmed.length > DISMISS_REASON_MAX) return Promise.resolve(null);
      return this.decide({ fingerprint, status: 'dismissed', reason: trimmed, decidedAt: now.toISOString() });
    },
    /** Reopening deletes the decision: a finding without one is open. Pending-aware
     *  like `decide` (E18): a fingerprint with a save already in flight is refused
     *  (false) rather than racing it. Persists before mutating (E32): a rejecting port
     *  leaves the disposition in place and the rejection propagates. */
    async reopen(fingerprint: string): Promise<boolean> {
      if (this.pendingFingerprints.includes(fingerprint)) return false;
      this.pendingFingerprints.push(fingerprint);
      try {
        await this.repository.removeDisposition(fingerprint);
        this.dispositions = this.dispositions.filter((d) => d.fingerprint !== fingerprint);
        return true;
      } finally {
        this.pendingFingerprints = this.pendingFingerprints.filter((f) => f !== fingerprint);
      }
    },
  },
});
