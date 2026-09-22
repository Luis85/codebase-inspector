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

/** Part 5 E18: shared by `clearAll` and `replaceAll` (which `clearAll` now calls, with an
 *  empty replacement) — removes every given item, rule and disposition through `repo`, all
 *  in one `Promise.allSettled` so one rejection never stops the rest from being attempted. */
function removeEverything(
  repo: ReviewRepository, workItems: readonly WorkItem[], rules: readonly BoundaryRule[], dispositions: readonly FindingDisposition[],
): Promise<PromiseSettledResult<void>[]> {
  return Promise.allSettled([
    ...workItems.map((w) => repo.removeWorkItem(w.id)),
    ...rules.map((r) => repo.removeRule(r.id)),
    ...dispositions.map((d) => repo.removeDisposition(d.fingerprint)),
  ]);
}

/** Part 5 V8: one codebase's own repository and id counters. The lists are reloaded from
 *  the repository on every switch; the counters travel with the bucket because a failed
 *  save or a removal leaves a spent id that `load()` cannot see. */
interface ReviewBucket { repository: ReviewRepository; nextId: number; nextRuleId: number }
const newBucket = (): ReviewBucket => ({ repository: markRaw(createInMemoryReviewRepository()), nextId: 1, nextRuleId: 1 });

/** Part 5 V16: a whole review state to replace the bound codebase's with (an import). */
export interface ReviewReplacement {
  workItems: readonly WorkItem[];
  rules: readonly BoundaryRule[];
  dispositions: readonly FindingDisposition[];
}
/** Part 5 E18: what `clearAll` replaces the bound codebase's state with — nothing. */
const EMPTY_REPLACEMENT: ReviewReplacement = { workItems: [], rules: [], dispositions: [] };

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
  /** Part 5 V8: every codebase bound in this leaf, by repository id; `''` is the unbound
   *  bucket used before any snapshot. Raw: nothing renders from it. The pending arrays
   *  above stay global (V9). */
  buckets: Map<string, ReviewBucket>;
  /** The key of the bucket that `repository` and the counters belong to. */
  boundKey: string;
  /** Part 5 E18: true while `replaceAll` (which `clearAll` calls) is running. Set
   *  synchronously before its first `await`, cleared in `finally`: every mutating
   *  action refuses (its own null/false shape) while it is set, and a concurrent
   *  second `clearAll`/`replaceAll` refuses via `hasPendingChanges`. Global like the
   *  pending arrays (V9). */
  bulkBusy: boolean;
}

export const useReviewStore = defineStore('review', {
  state: (): ReviewState => {
    const unbound = newBucket();
    return {
      workItems: [],
      nextId: 1,
      repository: unbound.repository,
      rules: [],
      nextRuleId: 1,
      pendingRuleKeys: [],
      pendingWorkKeys: [],
      pendingItemIds: [],
      dispositions: [],
      pendingFingerprints: [],
      buckets: markRaw(new Map([['', unbound]])),
      boundKey: '',
      bulkBusy: false,
    };
  },
  getters: {
    /** Part 5 E18: any save, update or removal in flight, OR a `clearAll`/`replaceAll`
     *  already running. The gate `clearAll`/`replaceAll` themselves use before starting. */
    hasPendingChanges: (state): boolean =>
      state.bulkBusy || state.pendingWorkKeys.length > 0 || state.pendingItemIds.length > 0
      || state.pendingRuleKeys.length > 0 || state.pendingFingerprints.length > 0,
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
    /** Replaces the bound codebase's repository (tests; WP-05's durable adapter). */
    setRepository(repository: ReviewRepository): void {
      const raw = markRaw(repository);
      this.repository = raw;
      const bucket = this.buckets.get(this.boundKey);
      if (bucket) bucket.repository = raw;
    },
    /** Part 5 V8: one in-memory repository, and its own id counters, per codebase.
     *  Steps (a)–(d) run synchronously, so the previous codebase's items never render for
     *  even one frame; (e) loads the target codebase's own state. Binding the bound id
     *  again is a no-op. Nothing leaves memory (WP-05 adds the durable adapter behind the
     *  same port, keyed the same way). */
    async bindRepository(id: string): Promise<void> {
      if (id === this.boundKey) return;
      const current = this.buckets.get(this.boundKey);
      if (current) {
        current.nextId = this.nextId; // (a)
        current.nextRuleId = this.nextRuleId;
      }
      let target = this.buckets.get(id); // (b)
      if (!target) {
        target = newBucket();
        this.buckets.set(id, target);
      }
      this.boundKey = id; // (c)
      this.repository = target.repository;
      this.nextId = target.nextId;
      this.nextRuleId = target.nextRuleId;
      this.workItems = []; // (d)
      this.rules = [];
      this.dispositions = [];
      await this.load(); // (e)
    },
    /** Part 2 §5: pending-aware. A save still in flight has already reserved an id; the
     *  counters only ever move forward, so load() can never hand that id out again.
     *  Part 5 V9: a load that settles after a codebase switch belongs to the old codebase
     *  and changes nothing. */
    async load(): Promise<void> {
      const repo = this.repository;
      const [items, rules, dispositions] = await Promise.all([
        repo.listWorkItems(), repo.listRules(), repo.listDispositions(),
      ]);
      if (this.repository !== repo) return;
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
      if (this.bulkBusy || this.hasWorkItem(target, intent) || this.pendingWorkKeys.includes(key)) return null;
      // Controller ruling Part 4 E3: clip (never refuse) an over-long GENERATED title, so a
      // long package or file name can never make the calling button silently do
      // nothing. `updateWorkItem` still refuses one via `workItemProblem` — that title
      // came from the user, and the editor can explain the refusal.
      const item: WorkItem = {
        id: `wi-${this.nextId}`, target, intent, title: clipTitle(title.trim()), status: init.status ?? 'investigate',
        priority: init.priority ?? 'medium', notes: init.notes ?? '', checks: init.checks ?? NO_CHECKS, createdAt: now.toISOString(),
      };
      if (workItemProblem(item) !== null) return null;
      const repo = this.repository;
      this.nextId += 1;
      this.pendingWorkKeys.push(key);
      try {
        await repo.saveWorkItem(item);
        // Part 5 V9: saved in its own codebase either way (so the real result is
        // returned), but shown only while that codebase is still bound. A load() that
        // ran mid-save may already hold it.
        if (this.repository === repo && !this.workItems.some((w) => w.id === item.id)) this.workItems.push(item);
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
      if (this.bulkBusy || !current || this.pendingItemIds.includes(id)) return null;
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
      const repo = this.repository;
      this.pendingItemIds.push(id);
      try {
        await repo.saveWorkItem(next);
        // Part 5 V9: another codebase may hold an item with the same id.
        if (this.repository === repo) this.workItems = this.workItems.map((w) => (w.id === id ? next : w));
        return next;
      } finally {
        this.pendingItemIds = this.pendingItemIds.filter((p) => p !== id);
      }
    },
    /** Persist first (a rejecting port leaves the item in place); refused (false) for an
     *  unknown id (so E17 callers never announce a removal that did not happen), and
     *  while an update or removal of the same id is in flight. */
    async removeWorkItem(id: string): Promise<boolean> {
      if (this.bulkBusy || !this.workItems.some((w) => w.id === id) || this.pendingItemIds.includes(id)) return false;
      const repo = this.repository;
      this.pendingItemIds.push(id);
      try {
        await repo.removeWorkItem(id);
        if (this.repository === repo) this.workItems = this.workItems.filter((w) => w.id !== id);
        return true;
      } finally {
        this.pendingItemIds = this.pendingItemIds.filter((p) => p !== id);
      }
    },
    /** Part 4 W14 / Part 5 V16: clears the whole review state — `replaceAll` with
     *  nothing to restore. Same gating (E18), ordering and error handling. */
    clearAll(): Promise<boolean> {
      return this.replaceAll(EMPTY_REPLACEMENT);
    },
    /** Part 5 V16: replaces the whole review state with an imported one (or, via
     *  `clearAll`, with nothing). Removes every current item, rule and decision through
     *  the port, then saves every imported one (persist-first; `allSettled` in both
     *  phases, so one rejection does not stop the rest). The removals finish before the
     *  saves start, so an imported id that a current item already had is saved, not
     *  deleted. Reloads in `finally`, so the lists show exactly what the port holds (the
     *  id counters move past every imported id), then rethrows the first rejection.
     *
     *  Part 5 E18: refused (false), touching nothing, while `hasPendingChanges` is true.
     *  Otherwise `bulkBusy` is set SYNCHRONOUSLY, before the first `await`, so a
     *  mutating action started right after refuses via its own `bulkBusy` check, and a
     *  concurrent second `clearAll`/`replaceAll` refuses via `hasPendingChanges` too —
     *  closing the race where an add started mid-run could reserve an id equal to (and
     *  later overwrite) an imported one. Cleared in `finally` alongside the reload, kept
     *  global (not gated on `this.repository === repo`, unlike the pending arrays, V9)
     *  so it is never left set after a codebase switch mid-run.
     *
     *  Part 5 E20: a codebase switch (`bindRepository`) that lands while this is running
     *  writes `state` to `repo` — the codebase that was bound when the call started,
     *  which is correct and stays. But the codebase now bound is a DIFFERENT one, so this
     *  call did not apply to what is now on screen: it resolves `false` (not `true`), the
     *  same shape a caller already treats as "did not apply", even though nothing here
     *  was actually refused. */
    async replaceAll(state: ReviewReplacement): Promise<boolean> {
      if (this.hasPendingChanges) return false;
      this.bulkBusy = true;
      const repo = this.repository;
      let results: PromiseSettledResult<void>[] = [];
      try {
        const removed = await removeEverything(repo, this.workItems, this.rules, this.dispositions);
        const saved = await Promise.allSettled([
          ...state.workItems.map((w) => repo.saveWorkItem(w)),
          ...state.rules.map((r) => repo.saveRule(r)),
          ...state.dispositions.map((d) => repo.saveDisposition(d)),
        ]);
        results = [...removed, ...saved];
      } finally {
        this.bulkBusy = false;
        if (this.repository === repo) await this.load();
      }
      const rejected = results.find(isRejected);
      if (rejected) throw rejected.reason;
      return this.repository === repo;
    },
    /** Part 2 P5. Same reservation and persist-first ordering as `addWorkItem`.
     *  Refuses (null) a self-rule, an empty rationale, an existing pair, and a second call
     *  for a pair whose first save has not settled. */
    async addRule(from: string, to: string, rationale: string, now: Date): Promise<BoundaryRule | null> {
      const key = ruleKey(from, to);
      if (this.bulkBusy || from === to || rationale.trim() === '' || this.hasRule(from, to) || this.pendingRuleKeys.includes(key)) return null;
      const rule: BoundaryRule = {
        id: `AR-${String(this.nextRuleId).padStart(3, '0')}`, from, to, rationale: rationale.trim(), createdAt: now.toISOString(),
      };
      const repo = this.repository;
      this.nextRuleId += 1;
      this.pendingRuleKeys.push(key);
      try {
        await repo.saveRule(rule);
        if (this.repository === repo && !this.rules.some((r) => r.id === rule.id)) this.rules.push(rule);
        return rule;
      } finally {
        this.pendingRuleKeys = this.pendingRuleKeys.filter((k) => k !== key);
      }
    },
    /** Part 5 E18: a no-op (not a removal) while a bulk operation is running — the
     *  closest this action's void shape has to the null/false refusal every other
     *  mutating action returns. */
    async removeRule(id: string): Promise<void> {
      if (this.bulkBusy) return;
      const repo = this.repository;
      await repo.removeRule(id);
      if (this.repository === repo) this.rules = this.rules.filter((r) => r.id !== id);
    },
    /** Part 3 Q3: a decision is stored apart from the generated finding, keyed by its
     *  fingerprint. Same persist-first ordering and pending guard as work items. */
    async decide(disposition: FindingDisposition): Promise<FindingDisposition | null> {
      const fp = disposition.fingerprint;
      if (this.bulkBusy || this.pendingFingerprints.includes(fp)) return null;
      const repo = this.repository;
      this.pendingFingerprints.push(fp);
      try {
        await repo.saveDisposition(disposition);
        if (this.repository === repo) this.dispositions = [...this.dispositions.filter((d) => d.fingerprint !== fp), disposition];
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
      if (this.bulkBusy || this.pendingFingerprints.includes(fingerprint)) return false;
      const repo = this.repository;
      this.pendingFingerprints.push(fingerprint);
      try {
        await repo.removeDisposition(fingerprint);
        if (this.repository === repo) this.dispositions = this.dispositions.filter((d) => d.fingerprint !== fingerprint);
        return true;
      } finally {
        this.pendingFingerprints = this.pendingFingerprints.filter((f) => f !== fingerprint);
      }
    },
  },
});
