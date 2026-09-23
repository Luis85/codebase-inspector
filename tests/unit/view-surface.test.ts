import { describe, expect, it } from 'vitest';
import {
  countPartialRead, deriveViewSurfaceState, isEmptyStateSurface, surfaceCopy,
} from '../../src/ui/view-surface';
import type { ViewSurfaceInputs } from '../../src/ui/view-surface';
import { CANCELLED_BANNER } from '../../src/application/run-state';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';

function baseInputs(overrides: Partial<ViewSurfaceInputs> = {}): ViewSurfaceInputs {
  return {
    hasSnapshot: true,
    runStatus: 'idle',
    runProcessedFiles: 0,
    runFailureMessage: null,
    totalFileCount: 3,
    matchingIds: null,
    query: '',
    partialRead: null,
    rendererUnavailableReason: null,
    rootUnavailable: false,
    ...overrides,
  };
}

// Not in task-9-brief.md's own required test list, but view-surface.ts is new
// production code (the pure derivation StatusBanner.vue/EmptyState.vue's own
// component tests build on) — TDD applies to it the same as any other new module.
describe('surfaceCopy', () => {
  it('returns null for "none"', () => {
    expect(surfaceCopy({ kind: 'none' })).toBeNull();
  });

  it('returns COPY-01 verbatim for "no-source"', () => {
    expect(surfaceCopy({ kind: 'no-source' })).toBe('Understand your codebase. Start with its structure.');
  });

  it('returns COPY-12 verbatim for "empty-scope"', () => {
    expect(surfaceCopy({ kind: 'empty-scope' }))
      .toBe('No files are included in this scope. Review the selected directory and exclusions.');
  });

  it('formats COPY-08 for "scanning-unknown-total"', () => {
    expect(surfaceCopy({ kind: 'scanning-unknown-total', processedFiles: 42 }))
      .toBe('Reading included files. 42 files read so far.');
  });

  it('reuses run-state.ts’s own CANCELLED_BANNER for "cancelled"', () => {
    expect(surfaceCopy({ kind: 'cancelled' })).toBe(CANCELLED_BANNER);
  });

  it('Part 6 Y1: "cancelling" says the snapshot stays only when there is one', () => {
    expect(surfaceCopy({ kind: 'cancelling', hasSnapshot: true })).toBe('Cancelling the scan… The current snapshot stays available.');
    expect(surfaceCopy({ kind: 'cancelling', hasSnapshot: false })).toBe('Cancelling the scan…');
  });

  it('names the previous snapshot as unchanged for "failed-refresh"', () => {
    const copy = surfaceCopy({ kind: 'failed-refresh', message: 'disk error' });
    expect(copy).toContain('disk error');
    expect(copy).toContain('previous snapshot is unchanged');
  });

  it('formats COPY-11 with curly quotes for "no-search-matches"', () => {
    expect(surfaceCopy({ kind: 'no-search-matches', matchingFileCount: 12, query: 'abc' }))
      .toBe('No matching files. The snapshot still contains 12 files. No paths match “abc”.');
  });

  it('formats COPY-13 for "partial-read"', () => {
    expect(surfaceCopy({ kind: 'partial-read', measured: 8, included: 10 }))
      .toBe('Some files could not be read. Measurements cover 8 of 10 included files.');
  });

  it('returns COPY-28 verbatim for "root-unavailable"', () => {
    expect(surfaceCopy({ kind: 'root-unavailable' }))
      .toBe('The saved source directory is unavailable on this machine. The stored snapshot can still be inspected.');
  });

  it('returns COPY-14 verbatim for "renderer-unavailable"', () => {
    expect(surfaceCopy({ kind: 'renderer-unavailable' }))
      .toBe('The 3D view is unavailable. File inspection still works.');
  });

  it('names reconstruction, distinct from COPY-14, for "context-lost"', () => {
    expect(surfaceCopy({ kind: 'context-lost' })).toMatch(/rebuild|reconstruct/i);
  });
});

describe('deriveViewSurfaceState', () => {
  it('prefers context-lost over every other signal', () => {
    const state = deriveViewSurfaceState(baseInputs({
      rendererUnavailableReason: 'context-lost', runStatus: 'running', rootUnavailable: true,
    }));
    expect(state.kind).toBe('context-lost');
  });

  it('prefers renderer-unavailable over root-unavailable and a running scan', () => {
    const state = deriveViewSurfaceState(baseInputs({
      rendererUnavailableReason: 'unsupported', rootUnavailable: true, runStatus: 'running',
    }));
    expect(state.kind).toBe('renderer-unavailable');
  });

  it('prefers root-unavailable over a running scan', () => {
    const state = deriveViewSurfaceState(baseInputs({ rootUnavailable: true, runStatus: 'running' }));
    expect(state.kind).toBe('root-unavailable');
  });

  it('surfaces a running scan as scanning-unknown-total, carrying the count', () => {
    const state = deriveViewSurfaceState(baseInputs({ runStatus: 'running', runProcessedFiles: 9 }));
    expect(state).toEqual({ kind: 'scanning-unknown-total', processedFiles: 9 });
  });

  it('surfaces cancelled', () => {
    expect(deriveViewSurfaceState(baseInputs({ runStatus: 'cancelled' })).kind).toBe('cancelled');
  });

  // Part 6 Y1: cancelling takes running's slot — after the renderer and root checks, before
  // cancelled and everything snapshot-derived — and carries whether a snapshot exists.
  it('surfaces a cancelling scan over a snapshot, and over none without falling through to no-source', () => {
    expect(deriveViewSurfaceState(baseInputs({ runStatus: 'cancelling' }))).toEqual({ kind: 'cancelling', hasSnapshot: true });
    expect(deriveViewSurfaceState(baseInputs({ runStatus: 'cancelling', hasSnapshot: false, totalFileCount: 0 })))
      .toEqual({ kind: 'cancelling', hasSnapshot: false });
  });

  it('cancelling outranks empty-scope, a zero-match filter and a partial read, but not root-unavailable', () => {
    expect(deriveViewSurfaceState(baseInputs({
      runStatus: 'cancelling', totalFileCount: 0, matchingIds: new Set(), query: 'zz', partialRead: { measured: 1, included: 2 },
    })).kind).toBe('cancelling');
    expect(deriveViewSurfaceState(baseInputs({ runStatus: 'cancelling', rootUnavailable: true })).kind).toBe('root-unavailable');
  });

  it('surfaces a failed run as failed-refresh ONLY when a previous snapshot exists', () => {
    const withSnapshot = deriveViewSurfaceState(baseInputs({
      runStatus: 'failed', runFailureMessage: 'disk error', hasSnapshot: true,
    }));
    expect(withSnapshot).toEqual({ kind: 'failed-refresh', message: 'disk error' });

    const withoutSnapshot = deriveViewSurfaceState(baseInputs({
      runStatus: 'failed', runFailureMessage: 'disk error', hasSnapshot: false,
    }));
    expect(withoutSnapshot.kind).toBe('no-source');
  });

  it('surfaces no-source when there is no snapshot at all', () => {
    expect(deriveViewSurfaceState(baseInputs({ hasSnapshot: false })).kind).toBe('no-source');
  });

  it('surfaces empty-scope when the snapshot has zero files', () => {
    expect(deriveViewSurfaceState(baseInputs({ totalFileCount: 0 })).kind).toBe('empty-scope');
  });

  it('surfaces no-search-matches when the filter is a real, empty result set', () => {
    const state = deriveViewSurfaceState(baseInputs({ matchingIds: new Set(), query: 'zz' }));
    expect(state).toEqual({ kind: 'no-search-matches', matchingFileCount: 3, query: 'zz' });
  });

  it('does not treat an unfiltered (null) match set as no-search-matches', () => {
    expect(deriveViewSurfaceState(baseInputs({ matchingIds: null })).kind).toBe('none');
  });

  it('surfaces partial-read only once every higher-priority state is absent', () => {
    const state = deriveViewSurfaceState(baseInputs({ partialRead: { measured: 4, included: 5 } }));
    expect(state).toEqual({ kind: 'partial-read', measured: 4, included: 5 });
  });

  // Phase 2 fix wave, M5: swapping the `no-search-matches` and `partial-read`
  // branches left the suite green -- no test set BOTH, so the one thing this module
  // exists to own, the priority chain, was unpinned at its last link. A live search
  // is what the user is looking at right now; the read-completeness note is about the
  // snapshot, and waits.
  it('M5: a zero-match filter outranks a partial read when both apply', () => {
    const state = deriveViewSurfaceState(baseInputs({
      matchingIds: new Set(), query: 'zz', partialRead: { measured: 4, included: 5 },
    }));
    expect(state).toEqual({ kind: 'no-search-matches', matchingFileCount: 3, query: 'zz' });
  });

  it('is "none" when nothing applies', () => {
    expect(deriveViewSurfaceState(baseInputs()).kind).toBe('none');
  });
});

describe('countPartialRead', () => {
  it('returns null for a complete snapshot', () => {
    const snapshot = buildSnapshotFixture({ files: 3, completeness: 'complete' });
    expect(countPartialRead(snapshot)).toBeNull();
  });

  it('counts measured vs. included FILE observations only, for a partial snapshot', () => {
    // 1 measured-zero + 1 unavailable + 1 ordinary-measured = 3 files, all
    // "included" (a physical-lines observation exists for each); 2 measured
    // (measured-zero counts as measured — status is 'measured', value 0).
    const snapshot = buildSnapshotFixture({
      files: 3, measuredZero: 1, unavailable: 1, completeness: 'partial',
    });
    expect(countPartialRead(snapshot)).toEqual({ measured: 2, included: 3 });
  });
});

describe('isEmptyStateSurface', () => {
  it('classifies the four full-pane states as EmptyState-owned', () => {
    expect(isEmptyStateSurface({ kind: 'no-source' })).toBe(true);
    expect(isEmptyStateSurface({ kind: 'invalid-directory', detail: 'x' })).toBe(true);
    expect(isEmptyStateSurface({ kind: 'read-not-approved' })).toBe(true);
    expect(isEmptyStateSurface({ kind: 'empty-scope' })).toBe(true);
  });

  it('classifies everything else as StatusBanner-owned', () => {
    expect(isEmptyStateSurface({ kind: 'cancelled' })).toBe(false);
    expect(isEmptyStateSurface({ kind: 'cancelling', hasSnapshot: false })).toBe(false);
    expect(isEmptyStateSurface({ kind: 'context-lost' })).toBe(false);
  });
});
