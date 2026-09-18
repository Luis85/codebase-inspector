// The scan wiring itself (spec 7, task-8 brief step 4). ScanCoordinator is the ONLY
// thing that starts a walk: every filesystem-touching call in this file goes through
// the injected SourceFileSystemPort, never a second path to Node.
import { collectInventory, CancellationError } from './inventory-collector';
import { isApprovalValid } from './approval';
import { validateSnapshot } from '../domain/validator';
import {
  identityOf, initialScanLifecycleState, mayPublish, reduce,
} from './run-state';
import type { RunAction, RunIdentity, ScanLifecycleState } from './run-state';
import type { AnalysisScope, ApprovedInventoryRun, CodebaseSnapshot, InventoryRunState } from '../domain/model';
import type { SourceFileSystemPort, WalkEntry } from './ports/source-filesystem-port';
import type { CancellationToken } from './ports/cancellation-token';
import type { Clock } from './ports/clock';
import type { SnapshotStore } from './ports/snapshot-store';

const READING_FILES = 'Reading included files.';

/** Every InventoryRunState variant except 'idle' carries a runId. Used instead of an
 *  `as` cast wherever this file needs to compare "is this still MY run" against a state
 *  that might, by the time it is inspected, be idle. */
function runIdOfState(run: InventoryRunState): string | null {
  return run.status === 'idle' ? null : run.runId;
}

/** COPY-08, verbatim (docs/concept/design/interactions/04-microcopy.md): a plain count,
 *  never a percentage, never an ETA. Exported so the one host-facing Notice/announcement
 *  that actually renders progress (city-view.ts) and this file's own tests format the
 *  identical string, rather than two copies of the same literal risking drift. */
export function formatProgressMessage(processedFiles: number): string {
  return `${READING_FILES} ${processedFiles} files read so far.`;
}

/** The production `CancellationToken` factory -- task 2 shipped only the interface
 *  (src/application/ports/cancellation-token.ts); nothing under `src/` constructed a
 *  real one before this task, since collectInventory's own tests inject
 *  tests/fixtures/cancellation-token.ts's double directly. Lives here rather than in a
 *  new file: it is small, generic plumbing whose only real caller is
 *  ScanCoordinatorDeps.createCancellationToken. */
export function createCancellationToken(): { token: CancellationToken; cancel: () => void } {
  let cancelled = false;
  const listeners = new Set<() => void>();
  const token: CancellationToken = {
    get cancelled() { return cancelled; },
    throwIfCancelled(): void {
      if (cancelled) throw new Error('The operation was cancelled.');
    },
    onCancelled(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  return {
    token,
    cancel(): void {
      if (cancelled) return;
      cancelled = true;
      for (const listener of listeners) listener();
    },
  };
}

export interface ScanCoordinatorDeps {
  port: SourceFileSystemPort;
  store: SnapshotStore;
  clock: Clock;
  createCancellationToken: () => { token: CancellationToken; cancel: () => void };
}

export class ScanCoordinator {
  private lifecycle: ScanLifecycleState = initialScanLifecycleState();
  private readonly listeners = new Set<(state: ScanLifecycleState) => void>();
  private readonly cancelFns = new Map<string, () => void>();
  private nextGeneration = 0;

  /** TEST-ONLY seam: when set, replaces collectInventory entirely so a test can hand the
   *  coordinator an already-built (possibly invalid) CodebaseSnapshot without waiting on
   *  real I/O -- this is what exercises the COORDINATOR's own validate-before-publish
   *  step (obligation 4) in isolation from collectInventory's own internal validation.
   *  Never set in production. Fix round 1, Minor 4: this is deliberately the ONLY
   *  test-only override this class exposes -- a separate `ScanCoordinatorDeps.collect`
   *  existed alongside this in the original round, unused by any caller in `src/` or
   *  `tests/`, and was removed rather than kept as a second, redundant seam. */
  onProduce: (() => Promise<CodebaseSnapshot> | CodebaseSnapshot) | undefined;

  constructor(private readonly deps: ScanCoordinatorDeps) {}

  /** The frozen §4.1 shape only -- see `getLifecycle()` for banner/publishedSnapshotId/
   *  approval, which are task-8-owned (ruling M35), not part of this contract. */
  get state(): InventoryRunState {
    return this.lifecycle.run;
  }

  getLifecycle(): ScanLifecycleState {
    return this.lifecycle;
  }

  subscribe(listener: (state: ScanLifecycleState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** No-ops unless `runId` is the run CURRENTLY running -- a stale or unknown runId
   *  (the run already finished, or never existed) has nothing to cancel. */
  cancel(runId: string): void {
    if (this.lifecycle.run.status !== 'running' || this.lifecycle.run.runId !== runId) return;
    this.dispatch({ type: 'CANCEL_REQUESTED' });
    this.cancelFns.get(runId)?.();
  }

  async start(approval: ApprovedInventoryRun | null, scope: AnalysisScope): Promise<void> {
    // Obligation 1: validated BEFORE any filesystem access -- nothing above this line,
    // and nothing in either guard below, touches `this.deps.port`.
    if (!approval) throw new Error('No approval was granted for this scan.');
    if (!isApprovalValid(approval, scope.rootPath, scope)) {
      throw new Error('Approval is invalid for this root and scope.');
    }

    // Obligation 2: mint {runId, generation} and enter running.
    const runId = crypto.randomUUID();
    const generation = this.nextGeneration;
    this.nextGeneration += 1;
    this.dispatch({ type: 'SCAN_STARTED', approval, runId, generation });
    // A duplicate start (a DIFFERENT run already running/cancelling) is a no-op in the
    // reducer -- detected here because the dispatch above then did not actually take
    // effect for OUR runId. This deliberately does NOT require status === 'running':
    // `dispatch` calls subscribers synchronously and re-entrantly, so a subscriber that
    // reacts to seeing 'running' by calling `cancel(runId)` immediately (a realistic,
    // supported pattern -- see tests/integration/scan-lifecycle.test.ts) can already
    // have advanced OUR OWN run to 'cancelling' by the time control returns here. That
    // is not a stale/duplicate start; it is a real cancellation this function must still
    // see through to a COLLECTOR_STOPPED confirmation, not abandon mid-flight.
    if (runIdOfState(this.lifecycle.run) !== runId) return;

    const { token, cancel } = this.deps.createCancellationToken();
    this.cancelFns.set(runId, cancel);
    // Catches up exactly that re-entrant-cancel case: CANCEL_REQUESTED reached the state
    // machine before this token existed, so `cancel(runId)`'s own `cancelFns.get(...)`
    // call above found nothing to invoke. Flip the real token now so collectInventory's
    // cooperative checks still see a genuinely cancelled run.
    if (this.wasCancelled(runId)) cancel();

    try {
      // "Root moved or unavailable" (spec 7) fails cleanly HERE, before a walk is ever
      // attempted, and never substitutes a fallback root -- it simply fails.
      const rootStat = await this.deps.port.stat(scope.rootPath);
      if (!rootStat.exists || !rootStat.isDirectory) {
        this.finishFailed(runId, `The source directory is no longer available: ${scope.rootPath}`);
        return;
      }

      // Obligation 3: drives collectInventory with a CancellationToken, through a port
      // wrapper that turns each file read into a plain-count PROGRESS notification.
      const trackedPort = this.progressTrackingPort(runId);
      const raw = this.onProduce
        ? await this.onProduce()
        : await collectInventory(trackedPort, scope, approval, token, this.deps.clock);

      if (this.wasCancelled(runId)) { this.finishCancelled(runId); return; }

      // Obligation 4, part 1: validates the snapshot BEFORE publishing it, regardless of
      // whether it came from the real collector (which already validates internally --
      // this is deliberate defence in depth) or from `onProduce` (which does not).
      const snapshot = validateSnapshot(raw);

      const resultIdentity: RunIdentity = {
        profileId: approval.profileId, sourceFingerprint: approval.sourceFingerprint,
        scopeFingerprint: approval.scopeFingerprint, runId, generation,
      };
      const currentIdentity = identityOf(this.lifecycle);
      // Fix round 1, Minor 7: within ONE ScanCoordinator instance this check cannot
      // actually fail today. SCAN_STARTED no-ops while running/cancelling (run-state.ts),
      // and COLLECTOR_STOPPED/SCAN_COMPLETED/SCAN_FAILED are dispatched only by the
      // `start()` call that owns `runId` -- so by the time execution reaches this line,
      // `this.lifecycle.run` is always this exact run, with this exact identity. The
      // full five-component tuple IS genuinely enforced (spec 7) -- but at the REDUCER
      // level (see run-state.test.ts's "never lets an OLD run overwrite a NEWER run"),
      // not because this particular call site is reachable with a mismatch. A future
      // design where more than one coordinator (or one shared per-plugin coordinator
      // across several leaves, task 11's territory) can race for the SAME profile is
      // exactly where this stops being redundant -- do not read its current
      // unreachability as evidence the check is unnecessary. The same applies to
      // `identityOf`'s own throw (run-state.ts): unreachable today for the identical
      // reason, and if it ever DID throw here, the outer catch maps it to SCAN_FAILED,
      // which the reducer no-ops for a run no longer 'running' -- leaving that run stuck
      // rather than recovering. Worth revisiting the moment either becomes reachable.
      if (!mayPublish(resultIdentity, currentIdentity, this.lifecycle.run)) {
        // Refused by identity -- a newer run superseded this one, or the profile/scope
        // changed underneath it. Discard silently; the state machine already reflects
        // whatever DID happen (a newer SCAN_STARTED, most likely).
        return;
      }

      // Obligation 4, part 2: the ATOMIC SWAP. `store.put` and the single SCAN_COMPLETED
      // dispatch below have no `await` between them -- nothing in this file yields to
      // the event loop between the two -- so no subscriber notification can ever
      // observe the store holding anything other than the previous snapshot or this new
      // one. See the report for how this was verified.
      this.deps.store.put(snapshot);
      this.dispatch({ type: 'SCAN_COMPLETED', runId, snapshotId: snapshot.snapshotId });
    } catch (e) {
      // Ruling M37: a cancelled collectInventory REJECTS with CancellationError. That is
      // not a failure -- map it (and the defensive case where cancellation was
      // requested but the collector resolved anyway) to COLLECTOR_STOPPED, never
      // SCAN_FAILED, and by error TYPE, never by matching a message string.
      if (e instanceof CancellationError || this.wasCancelled(runId)) {
        this.finishCancelled(runId);
        return;
      }
      this.finishFailed(runId, e instanceof Error ? e.message : String(e));
    } finally {
      this.cancelFns.delete(runId);
    }
  }

  private wasCancelled(runId: string): boolean {
    return this.lifecycle.run.status === 'cancelling' && this.lifecycle.run.runId === runId;
  }

  private finishCancelled(runId: string): void {
    this.dispatch({ type: 'COLLECTOR_STOPPED', runId });
  }

  private finishFailed(runId: string, message: string): void {
    this.dispatch({ type: 'SCAN_FAILED', runId, message });
  }

  private dispatch(action: RunAction): void {
    this.lifecycle = reduce(this.lifecycle, action);
    for (const listener of this.listeners) listener(this.lifecycle);
  }

  /** Wraps `walk` only. Fix round 3, ruling M45: the walk itself now does the only read
   *  a kept file gets (collectInventory no longer calls `readText()` a second time per
   *  file — see inventory-collector.ts), so counting readText calls would count zero
   *  forever. Counts each `kind: 'file'` entry the walk yields instead — exactly one per
   *  KEPT file (spec 5.2's "Reading included files"; excluded or skipped entries never
   *  reach this count), so this is still exactly "files read so far", never a fabricated
   *  percentage (there is no total here to divide by). */
  private progressTrackingPort(runId: string): SourceFileSystemPort {
    const port = this.deps.port;
    let processed = 0;
    return {
      ...port,
      walk: (root, opts, token) => {
        const dispatch = (n: number): void => { this.dispatch({ type: 'PROGRESS', runId, processedFiles: n }); };
        async function* wrapped(): AsyncGenerator<WalkEntry> {
          for await (const entry of port.walk(root, opts, token)) {
            if (entry.kind === 'file') {
              processed += 1;
              dispatch(processed);
            }
            yield entry;
          }
        }
        return wrapped();
      },
    };
  }
}
