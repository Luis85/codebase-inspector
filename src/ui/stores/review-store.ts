// WP-02 spec §4.5: the bound codebase's work items, boundary rules and finding decisions,
// persisted through the ReviewRepository port before local state changes. Part 6 Y13: the
// per-codebase bookkeeping (buckets, subscription, pending keys) is in review-buckets.ts.
import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import {
  workTargetKey, workItemProblem, clipTitle, noStorageDiagnostics, NO_CHECKS, DISMISS_REASON_MAX, RULE_RATIONALE_MAX,
  type BoundaryRule, type FindingDisposition, type ReviewReplaceState, type ReviewRepository, type ReviewStorageDiagnostics,
  type WorkIntent, type WorkItem, type WorkItemInit, type WorkItemPatch, type WorkTarget,
} from './ports/review-repository';
import {
  EMPTY_REPLACEMENT, anyPending, beginLoad, bucketFor, createBucketState, endLoad, listenTo, ownWrite, pendingOf, release,
  reserve, ruleKey, stopListening, type BucketState, type ReviewPending, type ReviewRepositoryFactory,
} from './review-buckets';

interface ReviewState {
  workItems: WorkItem[];
  repository: ReviewRepository;
  rules: BoundaryRule[];
  /** Part 3 Q3: decisions on findings, kept apart from the findings themselves. */
  dispositions: FindingDisposition[];
  /** Part 6 Y15 (Part 5 E15): the keys with a save, update or removal in flight, per codebase
   *  (repository id). A key is reserved before the action's first `await`, so an overlapping
   *  second call for it refuses instead of racing it (fix round 2). The getters read the
   *  bound codebase's entry only. */
  pending: Map<string, ReviewPending>;
  /** Part 5 V8 / Part 6 Y13: the buckets, the repository factory and the subscription. Raw. */
  bucketState: BucketState;
  /** The key of the bucket `repository` belongs to; `''` while unbound. */
  boundKey: string;
  /** Part 6 Y10: the bound bucket has finished a load, so its repository has seeded its id
   *  high-water mark. Adds refuse (null, announcing nothing) until then. */
  ready: boolean;
  /** Part 6 R1: the last load of the bound codebase rejected (a durable read failed). Cleared
   *  by the next successful load, and on every bind. */
  loadFailed: boolean;
  /** Part 6 Y7: the bound repository's diagnostics, mirrored after each load. */
  storageDiagnostics: ReviewStorageDiagnostics;
  /** Part 5 E18: true while `replaceAll` (which `clearAll` calls) is running. Set before its
   *  first `await` and cleared in `finally`; every mutating action refuses while it is set.
   *  Global per store (Part 5 E18–E20), unlike the pending keys. */
  bulkBusy: boolean;
}

export const useReviewStore = defineStore('review', {
  state: (): ReviewState => {
    const bucketState = createBucketState();
    return {
      workItems: [],
      repository: bucketFor(bucketState, '').repository,
      rules: [],
      dispositions: [],
      pending: new Map(),
      bucketState,
      boundKey: '',
      ready: true,
      loadFailed: false,
      storageDiagnostics: noStorageDiagnostics(),
      bulkBusy: false,
    };
  },
  getters: {
    /** Part 5 E18: any save, update or removal in flight in the bound codebase, OR a
     *  `clearAll`/`replaceAll` already running. The gate those two use before starting. */
    hasPendingChanges: (state): boolean => state.bulkBusy || anyPending(pendingOf(state.pending, state.boundKey)),
    workItemCount: (state): number => state.workItems.length,
    /** Part 4 W13: the nav badge counts what is still to do. */
    openWorkItemCount: (state): number => state.workItems.filter((w) => w.status !== 'verified').length,
    isItemPending: (state) => (id: string): boolean => pendingOf(state.pending, state.boundKey).item.includes(id),
    hasWorkItem: (state) => (target: WorkTarget, intent: WorkIntent): boolean =>
      state.workItems.some((w) => workTargetKey(w.target, w.intent) === workTargetKey(target, intent)),
    isPending: (state) => (target: WorkTarget, intent: WorkIntent): boolean =>
      pendingOf(state.pending, state.boundKey).work.includes(workTargetKey(target, intent)),
    /** Unchanged meaning since Part 1: this file already has a REFACTOR item. */
    hasWorkItemFor: (state) => (entityId: EntityId): boolean =>
      state.workItems.some((w) => w.intent === 'refactor' && w.target.kind === 'file' && w.target.entityId === entityId),
    isPendingFor: (state) => (entityId: EntityId): boolean =>
      pendingOf(state.pending, state.boundKey).work.includes(workTargetKey({ kind: 'file', entityId }, 'refactor')),
    workItemsForFile: (state) => (entityId: EntityId): WorkItem[] =>
      state.workItems.filter((w) => w.target.kind === 'file' && w.target.entityId === entityId),
    ruleCount: (state): number => state.rules.length,
    hasRule: (state) => (from: string, to: string): boolean =>
      state.rules.some((r) => r.from === from && r.to === to),
    dispositionFor: (state) => (fingerprint: string): FindingDisposition | undefined =>
      state.dispositions.find((d) => d.fingerprint === fingerprint),
    isDispositionPending: (state) => (fingerprint: string): boolean =>
      pendingOf(state.pending, state.boundKey).fingerprint.includes(fingerprint),
  },
  actions: {
    /** Replaces the bound codebase's repository (tests). The bucket keeps its `ready` flag;
     *  the store listens to the new repository instead (Y12). */
    setRepository(repository: ReviewRepository): void {
      const bucket = bucketFor(this.bucketState, this.boundKey);
      bucket.repository = markRaw(repository);
      this.repository = bucket.repository;
      listenTo(this.bucketState, bucket, this);
    },
    /** Part 6 Y11: where each codebase's repository comes from (the host's registry). Used for
     *  every codebase bound from now on; the unbound `''` bucket stays in memory (Y14). */
    setRepositoryFactory(factory: ReviewRepositoryFactory): void {
      this.bucketState.factory = factory;
    },
    /** Part 5 V8: one repository per codebase. Steps (a)–(d) run synchronously, so the
     *  previous codebase's items never render for even one frame; (e) loads the target's own
     *  state. Binding the bound id again is a no-op. */
    async bindRepository(id: string): Promise<void> {
      if (id === this.boundKey) return;
      const target = bucketFor(this.bucketState, id); // (a) made on first use (Y11)
      this.boundKey = id; // (b)
      this.repository = target.repository;
      // E48 (I2): a codebase bound again is not ready until ITS reload lands, even if it was
      // loaded before: the lists are empty until then. The unbound `''` bucket keeps its own.
      this.ready = id === '' ? target.ready : false;
      listenTo(this.bucketState, target, this); // (c) Y12: only the bound codebase is heard
      this.workItems = []; // (d)
      this.rules = [];
      this.dispositions = [];
      this.storageDiagnostics = noStorageDiagnostics();
      this.loadFailed = false;
      await this.load(); // (e)
    },
    /** Part 6 Y12: stops listening to the bound repository. The host calls it when the leaf
     *  closes, so a closed leaf is never reloaded by another leaf's write. */
    detach(): void {
      stopListening(this.bucketState);
    },
    /** Part 5 V9: a load that settles after a codebase switch belongs to the old codebase and
     *  changes nothing. Task 2 fix round 1: nor does one that a newer load of the same bucket
     *  has overtaken (`endLoad`). Part 6 Y10: a finished load makes the bucket ready. R1: a
     *  rejected list sets `loadFailed` (only if it is the latest, still bound) and the
     *  rejection always propagates to its caller. */
    async load(): Promise<void> {
      const repo = this.repository;
      const bucket = bucketFor(this.bucketState, this.boundKey);
      const ticket = beginLoad(bucket);
      let lists: [WorkItem[], BoundaryRule[], FindingDisposition[]];
      try {
        lists = await Promise.all([repo.listWorkItems(), repo.listRules(), repo.listDispositions()]);
      } catch (error: unknown) {
        if (endLoad(bucket, ticket) && this.repository === repo) this.loadFailed = true;
        throw error;
      }
      if (!endLoad(bucket, ticket) || this.repository !== repo) return;
      const [items, rules, dispositions] = lists;
      this.workItems = items;
      this.rules = rules;
      this.dispositions = dispositions;
      this.storageDiagnostics = { ...repo.diagnostics() };
      bucket.ready = true;
      this.ready = true;
      this.loadFailed = false;
    },
    /** One work item per (target, intent); a second request for the same pair is refused
     *  (null), even while the first is still saving (fix round 2). Persists BEFORE pushing
     *  into `workItems` (fix round 1): a rejection leaves it unchanged and propagates.
     *  Part 6 Y10: the id comes from the port's `allocateId`, only once every guard has
     *  passed, so a refused call never spends one; a failed save leaves a gap. */
    async addWorkItem(target: WorkTarget, intent: WorkIntent, title: string, now: Date, init: WorkItemInit = {}): Promise<WorkItem | null> {
      const key = workTargetKey(target, intent);
      const codebase = this.boundKey;
      if (!this.ready || this.bulkBusy || this.hasWorkItem(target, intent) || this.isPending(target, intent)) return null;
      // Controller ruling Part 4 E3: clip (never refuse) an over-long GENERATED title, so a
      // long package or file name can never make the calling button silently do nothing.
      // `updateWorkItem` still refuses one via `workItemProblem`: that title came from the user.
      const fields: Omit<WorkItem, 'id'> = {
        target, intent, title: clipTitle(title.trim()), status: init.status ?? 'investigate',
        priority: init.priority ?? 'medium', notes: init.notes ?? '', checks: init.checks ?? NO_CHECKS, createdAt: now.toISOString(),
      };
      if (workItemProblem(fields) !== null) return null;
      const repo = this.repository;
      const item: WorkItem = { id: repo.allocateId('workItem'), ...fields };
      reserve(this.pending, codebase, 'work', key);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.saveWorkItem(item), this);
        // Part 5 V9: saved in its own codebase either way (so the real result is returned),
        // but shown only while that codebase is still bound. A load() that ran mid-save may
        // already hold it.
        if (this.repository === repo && !this.workItems.some((w) => w.id === item.id)) this.workItems.push(item);
        return item;
      } finally {
        release(this.pending, codebase, 'work', key);
      }
    },
    addWorkItemForFile(entityId: EntityId, title: string, now: Date): Promise<WorkItem | null> {
      return this.addWorkItem({ kind: 'file', entityId }, 'refactor', title, now);
    },
    /** Part 4 W9: same persist-first ordering and pending reservation as `addWorkItem`, keyed
     *  by id. Refuses (null) an unknown id, a pending id, and any edit `workItemProblem`
     *  rejects. Copies only the five patch fields, and only when present, so the target and
     *  intent (the item's identity, Q4) never change through this path. */
    async updateWorkItem(id: string, patch: WorkItemPatch, now: Date): Promise<WorkItem | null> {
      const current = this.workItems.find((w) => w.id === id);
      const codebase = this.boundKey;
      if (this.bulkBusy || !current || this.isItemPending(id)) return null;
      const next: WorkItem = { ...current, updatedAt: now.toISOString() };
      if (patch.title !== undefined) next.title = patch.title.trim();
      if (patch.status !== undefined) next.status = patch.status;
      if (patch.priority !== undefined) next.priority = patch.priority;
      if (patch.notes !== undefined) next.notes = patch.notes;
      if (patch.checks !== undefined) next.checks = patch.checks;
      if (workItemProblem(next) !== null) return null;
      const repo = this.repository;
      reserve(this.pending, codebase, 'item', id);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.saveWorkItem(next), this);
        // Part 5 V9: another codebase may hold an item with the same id.
        if (this.repository === repo) this.workItems = this.workItems.map((w) => (w.id === id ? next : w));
        return next;
      } finally {
        release(this.pending, codebase, 'item', id);
      }
    },
    /** Persist first (a rejecting port leaves the item in place); refused (false) for an
     *  unknown id (so E17 callers never announce a removal that did not happen), and while an
     *  update or removal of the same id is in flight. */
    async removeWorkItem(id: string): Promise<boolean> {
      const codebase = this.boundKey;
      if (this.bulkBusy || !this.workItems.some((w) => w.id === id) || this.isItemPending(id)) return false;
      const repo = this.repository;
      reserve(this.pending, codebase, 'item', id);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.removeWorkItem(id), this);
        if (this.repository === repo) this.workItems = this.workItems.filter((w) => w.id !== id);
        return true;
      } finally {
        release(this.pending, codebase, 'item', id);
      }
    },
    /** Part 4 W14 / Part 5 V16: `replaceAll` with empty arrays (R1). Same gating and errors. */
    clearAll(): Promise<boolean> {
      return this.replaceAll(EMPTY_REPLACEMENT);
    },
    /** Part 5 V16 / Part 6 R1: replaces the bound codebase's whole review state (an import, or
     *  nothing via `clearAll`) with ONE port `replaceAll`, all or nothing, persisted first.
     *  Reloads in `finally`, so the lists show what the port holds. Refused (false), touching
     *  nothing, while unbound (Y14), before the bound state is read or after its read failed
     *  (E29: empty lists then only mean nothing was read), or while `hasPendingChanges`
     *  (Part 5 E18). `bulkBusy` clears in a NESTED `finally`, once the reload has settled
     *  (fix round 3, minor 1), even
     *  when it rejects (Y16). A rejection is rethrown while the same codebase is bound; after
     *  a switch mid-run (Part 5 E20) the call resolves `false` and never rethrows. */
    async replaceAll(state: ReviewReplaceState): Promise<boolean> {
      if (this.boundKey === '' || !this.ready || this.loadFailed || this.hasPendingChanges) return false;
      this.bulkBusy = true;
      const repo = this.repository;
      try {
        await ownWrite(bucketFor(this.bucketState, this.boundKey), () => repo.replaceAll(state), this);
      } catch (error: unknown) {
        if (this.repository === repo) throw error;
        return false;
      } finally {
        try {
          if (this.repository === repo) await this.load();
        } finally {
          this.bulkBusy = false;
        }
      }
      return this.repository === repo;
    },
    /** Part 2 P5. Same reservation and persist-first ordering as `addWorkItem`, and the id
     *  comes from the port the same way (Y10). Refuses (null) a self-rule, an empty rationale,
     *  one over `RULE_RATIONALE_MAX` after trimming (Part 5 E9(b)), an existing pair, and a
     *  second call for a pair whose first save has not settled. */
    async addRule(from: string, to: string, rationale: string, now: Date): Promise<BoundaryRule | null> {
      const key = ruleKey(from, to);
      const codebase = this.boundKey;
      const trimmed = rationale.trim();
      if (!this.ready || this.bulkBusy || from === to || trimmed === '' || trimmed.length > RULE_RATIONALE_MAX
        || this.hasRule(from, to) || pendingOf(this.pending, codebase).rule.includes(key)) return null;
      const repo = this.repository;
      const rule: BoundaryRule = { id: repo.allocateId('rule'), from, to, rationale: trimmed, createdAt: now.toISOString() };
      reserve(this.pending, codebase, 'rule', key);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.saveRule(rule), this);
        if (this.repository === repo && !this.rules.some((r) => r.id === rule.id)) this.rules.push(rule);
        return rule;
      } finally {
        release(this.pending, codebase, 'rule', key);
      }
    },
    /** Part 5 E18: a no-op (not a removal) while a bulk operation is running. */
    async removeRule(id: string): Promise<void> {
      if (this.bulkBusy) return;
      const repo = this.repository;
      await ownWrite(bucketFor(this.bucketState, this.boundKey), () => repo.removeRule(id), this);
      if (this.repository === repo) this.rules = this.rules.filter((r) => r.id !== id);
    },
    /** Part 3 Q3: a decision is stored apart from the generated finding, keyed by its
     *  fingerprint. Same persist-first ordering and pending guard as work items. */
    async decide(disposition: FindingDisposition): Promise<FindingDisposition | null> {
      const fp = disposition.fingerprint;
      const codebase = this.boundKey;
      if (this.bulkBusy || this.isDispositionPending(fp)) return null;
      const repo = this.repository;
      reserve(this.pending, codebase, 'fingerprint', fp);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.saveDisposition(disposition), this);
        if (this.repository === repo) this.dispositions = [...this.dispositions.filter((d) => d.fingerprint !== fp), disposition];
        return disposition;
      } finally {
        release(this.pending, codebase, 'fingerprint', fp);
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
    /** Reopening deletes the decision: a finding without one is open. Pending-aware like
     *  `decide`; persists before mutating (E32), so a rejecting port leaves it in place. */
    async reopen(fingerprint: string): Promise<boolean> {
      const codebase = this.boundKey;
      if (this.bulkBusy || this.isDispositionPending(fingerprint)) return false;
      const repo = this.repository;
      reserve(this.pending, codebase, 'fingerprint', fingerprint);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.removeDisposition(fingerprint), this);
        if (this.repository === repo) this.dispositions = this.dispositions.filter((d) => d.fingerprint !== fingerprint);
        return true;
      } finally {
        release(this.pending, codebase, 'fingerprint', fingerprint);
      }
    },
  },
});
