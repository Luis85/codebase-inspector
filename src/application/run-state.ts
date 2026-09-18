// The run-lifecycle reducer (spec 7, spec 4.1). Ported invariants, not ported code, from
// docs/concept/design/wp01-review/validation/model.test.cjs (task-8-context.md section 8) --
// the eight highest-value run-lifecycle invariants; the rest land in task 9.
//
// Ruling M35: `ScanLifecycleState` is a TASK-8-OWNED type, distinct from `CityViewState`
// (spec 4.1, frozen). It happens to share two field NAMES with CityViewState
// (`selectedEntityId`, `query`) because both describe "what the user is looking at", but
// it is not CityViewState, must never be persisted as one, cast to one, or used to
// extend one. The clearest proof they differ: this type carries `approval`, an
// ApprovedInventoryRun -- i.e. scan AUTHORISATION -- and spec 4.4 is explicit that
// `CityView.getState()` "returns identifiers and presentation state only -- never a
// snapshot, never a resolved absolute path, never scan authorisation." Task 9's Pinia
// store owns the UI-facing state and should read `selectedEntityId`/`query` FROM this
// reducer's output (or keep its own copy synchronised from it), not invent a second,
// independent source of truth for the same two fields.
import type { EntityId } from '../domain/entity-id';
import type { ApprovedInventoryRun, InventoryRunState } from '../domain/model';

/** The full run-identity tuple (spec 7). A result may publish only if every component
 *  still matches, cancellation has not invalidated it, and validation succeeds. */
export interface RunIdentity {
  profileId: string;
  sourceFingerprint: string;
  scopeFingerprint: string;
  runId: string;
  generation: number;
}

export const CANCELLED_BANNER = 'Scan cancelled. The incomplete result was discarded.';

/** Ruling M35: the reducer's own state. `run` is the frozen `InventoryRunState` (spec
 *  4.1) embedded verbatim -- never widened, never given a new variant. `approval` and
 *  `generation` are retained HERE, alongside `run`, because the frozen shape
 *  deliberately drops them once a run leaves `running`/`cancelling` (`cancelled`,
 *  `failed` and `complete` carry neither `approval` nor `generation` -- see spec 4.1's
 *  union) -- yet `identityOf` below, and the renderer's `setLayout({generation, signal})`
 *  job token (spec 4.2) after a publish, both need them to survive past that point. This
 *  is NOT "RunIdentity stored in parallel" (ruling M34's own target): it is the run's
 *  own authorisation and generation counter, kept one layer up because the frozen union
 *  itself has nowhere left to put them once the run is no longer active. */
export interface ScanLifecycleState {
  run: InventoryRunState;
  approval: ApprovedInventoryRun | null;
  generation: number;
  publishedSnapshotId: string | null;
  banner: string | null;
  selectedEntityId: EntityId | null;
  query: string;
}

export function initialScanLifecycleState(): ScanLifecycleState {
  return {
    run: { status: 'idle' },
    approval: null,
    generation: 0,
    publishedSnapshotId: null,
    banner: null,
    selectedEntityId: null,
    query: '',
  };
}

export type RunAction =
  | { type: 'SCAN_STARTED'; approval: ApprovedInventoryRun; runId: string; generation: number }
  | { type: 'PROGRESS'; runId: string; processedFiles: number }
  | { type: 'CANCEL_REQUESTED' }
  | { type: 'COLLECTOR_STOPPED'; runId: string }
  | { type: 'SCAN_COMPLETED'; runId: string; snapshotId: string }
  | { type: 'SCAN_FAILED'; runId: string; message: string };

/** Ruling M34: derives a `RunIdentity` from `state.approval` (profileId,
 *  sourceFingerprint, scopeFingerprint) and from the run itself (runId, generation) --
 *  never a second, stored-in-parallel copy. Only defined while a run is `running` or
 *  `cancelling` (the two variants that carry `generation`); throws otherwise, because an
 *  identity for a run that is not active or was never approved is not a smaller answer,
 *  it is a wrong one. */
export function identityOf(state: ScanLifecycleState): RunIdentity {
  if (state.run.status !== 'running' && state.run.status !== 'cancelling') {
    throw new Error(`identityOf: no run identity while status is '${state.run.status}'`);
  }
  if (!state.approval) {
    throw new Error('identityOf: no approval recorded for the active run');
  }
  return {
    profileId: state.approval.profileId,
    sourceFingerprint: state.approval.sourceFingerprint,
    scopeFingerprint: state.approval.scopeFingerprint,
    runId: state.run.runId,
    generation: state.generation,
  };
}

/** Spec 7: "A result may publish only if every identity still matches, cancellation has
 *  not invalidated it, and validation succeeds." Validation is the caller's job
 *  (scan-coordinator.ts calls `validateSnapshot` separately); this function is the
 *  identity-and-cancellation half. `state` here is deliberately the raw
 *  `InventoryRunState`, not the wrapping `ScanLifecycleState` -- the one piece of extra
 *  information this function needs beyond the two identities is "has cancellation
 *  already forbidden publication", and `status` is where that lives. */
export function mayPublish(identity: RunIdentity, current: RunIdentity, state: InventoryRunState): boolean {
  if (state.status !== 'running') return false;   // cancelling forbids publication IMMEDIATELY
  return identity.profileId === current.profileId
    && identity.sourceFingerprint === current.sourceFingerprint
    && identity.scopeFingerprint === current.scopeFingerprint
    && identity.runId === current.runId
    && identity.generation === current.generation;
}

/** Labels a failed refresh (spec 7) without pretending to know whether this was a first
 *  scan or a refresh -- the caller (scan-coordinator.ts / the host) already knows which
 *  copy applies from whether a previous snapshot existed, and can prefix this further;
 *  the reducer's own job is only to carry the underlying reason without dropping it. */
function failureBanner(message: string): string {
  return `Scan failed: ${message}`;
}

export function reduce(state: ScanLifecycleState, action: RunAction): ScanLifecycleState {
  switch (action.type) {
    case 'SCAN_STARTED': {
      // A run already in flight (running or being cancelled) ignores a duplicate start
      // as a no-op -- same reference back, so a caller can cheaply tell nothing changed.
      if (state.run.status === 'running' || state.run.status === 'cancelling') return state;
      return {
        ...state,
        run: {
          status: 'running', runId: action.runId, generation: action.generation,
          approval: action.approval, processedFiles: 0,
        },
        approval: action.approval,
        generation: action.generation,
        banner: null,
      };
    }

    case 'PROGRESS': {
      if (state.run.status !== 'running' || state.run.runId !== action.runId) return state;
      return { ...state, run: { ...state.run, processedFiles: action.processedFiles } };
    }

    case 'CANCEL_REQUESTED': {
      if (state.run.status !== 'running') return state;   // nothing running to cancel
      return { ...state, run: { status: 'cancelling', runId: state.run.runId, generation: state.run.generation } };
    }

    case 'COLLECTOR_STOPPED': {
      // cancelling -> cancelled ONLY on the collector's own confirmation (spec 7) --
      // never assumed merely because CANCEL_REQUESTED was dispatched.
      if (state.run.status !== 'cancelling' || state.run.runId !== action.runId) return state;
      return { ...state, run: { status: 'cancelled', runId: action.runId }, banner: CANCELLED_BANNER };
    }

    case 'SCAN_COMPLETED': {
      // Publishes NOTHING unless this is still the run currently tracked as running --
      // this is the reducer-level half of "an old run cannot overwrite a newer run" and
      // "a late completion after cancel is ignored" (cancelling/cancelled are not
      // 'running', so both are refused here without needing mayPublish at all).
      if (state.run.status !== 'running' || state.run.runId !== action.runId) return state;
      return {
        ...state,
        run: { status: 'complete', runId: action.runId, snapshotId: action.snapshotId },
        publishedSnapshotId: action.snapshotId,
        banner: null,
        // selectedEntityId/query are untouched by the spread above: inspection context
        // survives a republish (spec 6's highest-value invariant list).
      };
    }

    case 'SCAN_FAILED': {
      if (state.run.status !== 'running' || state.run.runId !== action.runId) return state;
      return {
        ...state,
        run: { status: 'failed', runId: action.runId, message: action.message },
        // publishedSnapshotId is UNCHANGED -- a failed run leaves the previous snapshot
        // intact (spec 7).
        banner: failureBanner(action.message),
      };
    }

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
