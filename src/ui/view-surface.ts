// Every view-level state named by spec §7 and task-9-brief.md's own acceptance
// criterion 2 ("every view-level state has a surface"), as one closed union, plus
// the copy each one shows. Kept separate from any one component so StatusBanner.vue
// and EmptyState.vue can each own a disjoint subset of this union without either
// duplicating the copy or exceeding the 400-line src/** budget.
//
// Defect D24 (task-9-context.md §5) resolves the brief's parameterised table two
// ways:
//  - ADDS 'failed-refresh': spec §7 lists it separately from cancellation ("A failed
//    run leaves the previous snapshot intact and labels the failed refresh"), and
//    the brief's own table omitted it.
//  - DROPS 'scanning, known total': WP-01's walk never pre-counts files —
//    InventoryRunState's `running` variant carries only `processedFiles`, no total
//    denominator (src/domain/model.ts) — so a surface for a known-denominator
//    scanning state has no producer anywhere in this codebase. Spec §1 forbids "any
//    rendered-but-disabled control for unimplemented behaviour"; the same principle
//    argues against a surface for an unreachable state. See task-9-report.md for
//    the full accounting.
import { CANCELLED_BANNER } from '../application/run-state';
import {
  COPY_01, COPY_12, COPY_14, COPY_28, COPY_READ_NOT_APPROVED, CONTEXT_LOST_NOTICE,
  formatCopy08, formatCopy11, formatCopy13, formatFailedRefreshNotice,
} from './copy';
import { CANCELLING_BANNER } from './inspector-copy';
import type { CodebaseSnapshot } from '../domain/model';

/** COPY-13's own numerator/denominator (task-9-context.md §5, D25): "measured
 *  numerator/denominator where percentages could be misread." `included` counts
 *  every FILE entity with a physical-lines observation at all (measured or
 *  unavailable — both were included in scope and attempted); `measured` counts
 *  only the ones that actually succeeded. Returns null when the snapshot is
 *  `complete` — there is nothing partial to report. */
export function countPartialRead(snapshot: CodebaseSnapshot | null): { measured: number; included: number } | null {
  if (!snapshot || snapshot.completeness !== 'partial') return null;
  const fileIds = new Set(snapshot.entities.filter((e) => e.kind === 'file').map((e) => e.id));
  let included = 0;
  let measured = 0;
  for (const obs of snapshot.observations) {
    if (obs.measurement.metricId !== 'physical-lines' || !fileIds.has(obs.entityId)) continue;
    included += 1;
    if (obs.status === 'measured') measured += 1;
  }
  return { measured, included };
}

export type ViewSurfaceState =
  | { kind: 'none' }
  | { kind: 'no-source' }
  | { kind: 'invalid-directory'; detail: string }
  | { kind: 'read-not-approved' }
  | { kind: 'empty-scope' }
  | { kind: 'scanning-unknown-total'; processedFiles: number }
  | { kind: 'cancelling'; hasSnapshot: boolean }
  | { kind: 'cancelled' }
  | { kind: 'failed-refresh'; message: string }
  | { kind: 'no-search-matches'; matchingFileCount: number; query: string }
  | { kind: 'partial-read'; measured: number; included: number }
  | { kind: 'root-unavailable' }
  | { kind: 'renderer-unavailable' }
  | { kind: 'context-lost' };

/** The states EmptyState.vue owns: full-pane replacements for when there is nothing
 *  else on screen yet. Everything else is StatusBanner.vue's — a banner overlaid on
 *  existing content. */
const EMPTY_STATE_KINDS = new Set<ViewSurfaceState['kind']>([
  'no-source', 'invalid-directory', 'read-not-approved', 'empty-scope',
]);

export function isEmptyStateSurface(state: ViewSurfaceState): boolean {
  return EMPTY_STATE_KINDS.has(state.kind);
}

export interface ViewSurfaceInputs {
  hasSnapshot: boolean;
  runStatus: 'idle' | 'running' | 'cancelling' | 'cancelled' | 'failed' | 'complete';
  runProcessedFiles: number;
  runFailureMessage: string | null;
  totalFileCount: number;
  matchingIds: ReadonlySet<string> | null;
  query: string;
  partialRead: { measured: number; included: number } | null;
  rendererUnavailableReason: 'unsupported' | 'context-lost' | 'initialization-failed' | null;
  rootUnavailable: boolean;
}

/** The one place "which of the twelve states currently applies" gets decided, so
 *  App.vue's own template stays a thin composition and this priority order is
 *  independently testable (tests/unit/view-surface.test.ts).
 *
 *  Two states this task ships components for but this derivation never selects,
 *  because no signal for either reaches the Vue tree in the current, frozen
 *  architecture — both are pre-scan, modal-only concerns (source-modal.ts /
 *  scope-modal.ts, task 7, unmodified this task) that never publish anything into
 *  CityViewState, InventoryRunState or this store: 'invalid-directory' and
 *  'read-not-approved'. Reported honestly in task-9-report.md rather than wired to
 *  a fabricated signal. */
export function deriveViewSurfaceState(input: ViewSurfaceInputs): ViewSurfaceState {
  if (input.rendererUnavailableReason === 'context-lost') return { kind: 'context-lost' };
  if (input.rendererUnavailableReason) return { kind: 'renderer-unavailable' };
  if (input.rootUnavailable) return { kind: 'root-unavailable' };
  if (input.runStatus === 'running') {
    return { kind: 'scanning-unknown-total', processedFiles: input.runProcessedFiles };
  }
  // Part 6 Y1: running's slot. A banner state (not in EMPTY_STATE_KINDS), so a first scan
  // being cancelled never falls through to 'no-source' and its "Select a codebase" action.
  if (input.runStatus === 'cancelling') return { kind: 'cancelling', hasSnapshot: input.hasSnapshot };
  if (input.runStatus === 'cancelled') return { kind: 'cancelled' };
  if (input.runStatus === 'failed' && input.hasSnapshot) {
    return { kind: 'failed-refresh', message: input.runFailureMessage ?? 'Unknown error.' };
  }
  if (!input.hasSnapshot) return { kind: 'no-source' };
  if (input.totalFileCount === 0) return { kind: 'empty-scope' };
  if (input.matchingIds && input.matchingIds.size === 0) {
    return { kind: 'no-search-matches', matchingFileCount: input.totalFileCount, query: input.query };
  }
  if (input.partialRead) return { kind: 'partial-read', ...input.partialRead };
  return { kind: 'none' };
}

export function surfaceCopy(state: ViewSurfaceState): string | null {
  switch (state.kind) {
    case 'none': return null;
    case 'no-source': return COPY_01;
    // Task 9 fix round 1, item 9: no COPY id covers an invalid-directory STATE
    // (COPY-03/04/05/06 are all the permission modal's own copy, task 7's
    // territory, not a surface for the view itself). Authored fresh, factual
    // and action-oriented per the catalogue's own style guide, naming what
    // went wrong (`state.detail`, supplied by the modal layer) without
    // repeating any of that modal's own strings.
    case 'invalid-directory': return `The selected directory could not be used for this scan. ${state.detail}`;
    case 'read-not-approved': return COPY_READ_NOT_APPROVED;
    case 'empty-scope': return COPY_12;
    case 'scanning-unknown-total': return formatCopy08(state.processedFiles);
    case 'cancelling': return CANCELLING_BANNER(state.hasSnapshot);
    case 'cancelled': return CANCELLED_BANNER;
    case 'failed-refresh': return formatFailedRefreshNotice(state.message);
    case 'no-search-matches': return formatCopy11(state.matchingFileCount, state.query);
    case 'partial-read': return formatCopy13(state.measured, state.included);
    case 'root-unavailable': return COPY_28;
    case 'renderer-unavailable': return COPY_14;
    case 'context-lost': return CONTEXT_LOST_NOTICE;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
