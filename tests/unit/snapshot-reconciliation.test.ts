// Task 11, step 3. Pure logic — no DOM, no Obsidian — so this lives under the
// 'node' vitest project like every other tests/unit/** file. The single most
// likely silent-wrongness bug in task 11 (task-11-context.md section 6): a
// removed selected file must be REPORTED, never replaced by whatever now sits at
// its old array index. `ScanCoordinator` is imported ONLY to spy on its real
// `start` method (fix round 1, Minor 7's "does not authorise a scan" test) --
// never constructed or driven, so this file still touches no port, no filesystem.
import { describe, expect, it, vi } from 'vitest';
import { reconcileSelection, SELECTION_REMOVED_NOTICE } from '../../src/application/snapshot-reconciliation';
import { ScanCoordinator } from '../../src/application/scan-coordinator';
import { makeEntityId } from '../../src/domain/entity-id';
import type { CameraBookmark, CityViewState, CodeEntity, CodebaseSnapshot } from '../../src/domain/model';

const REPO = 'p1';

function id(path: string): string {
  return makeEntityId(REPO, 'file', path);
}

function fileEntity(path: string): CodeEntity {
  return { id: id(path), repositoryId: REPO, kind: 'file', path, name: path, parentId: null, category: null };
}

function snapshotOf(paths: readonly string[], overrides: Partial<CodebaseSnapshot> = {}): CodebaseSnapshot {
  return {
    snapshotId: 'snap-1',
    schemaVersion: 1,
    repositoryId: REPO,
    providerRun: {
      runId: 'run-1', provider: 'builtin-inventory', origin: 'collected',
      capturedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:01.000Z',
    },
    scope: { rootPath: '/fixture', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false },
    entities: paths.map(fileEntity),
    observations: [],
    fileSetDigest: `digest-${paths.length}`,
    completeness: 'complete',
    warnings: [],
    ...overrides,
  };
}

const CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0], zoom: 1.5,
};

function baseState(overrides: Partial<CityViewState> = {}): CityViewState {
  return {
    profileId: REPO,
    snapshotId: 'snap-0',
    selectedEntityId: null,
    query: 'needle',
    viewMode: '3d',
    camera: CAMERA,
    previous3dCamera: CAMERA,
    inspectorOpen: false,
    ...overrides,
  };
}

describe('per-leaf snapshot reconciliation', () => {
  it('keeps the selection when the file still exists in the next snapshot', () => {
    const state = baseState({ selectedEntityId: id('src/a.ts'), inspectorOpen: true });
    const nextWithA = snapshotOf(['src/a.ts', 'src/b.ts']);
    const r = reconcileSelection(state, nextWithA);
    expect(r.state.selectedEntityId).toBe(id('src/a.ts'));
    expect(r.notice).toBeNull();
    // Unaffected by a positive reconciliation: nothing about "kept" resets it.
    expect(r.state.inspectorOpen).toBe(true);
  });

  it('REPORTS a removed selected file and NEVER replaces it by index', () => {
    const state = baseState({ selectedEntityId: id('src/gone.ts'), inspectorOpen: true });
    // Four files, none named 'gone.ts' — index 3 in the NEXT snapshot's own array is a
    // real, different entity, which is exactly the wrong-by-index answer this guards.
    const nextWithoutGone = snapshotOf(['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts']);
    const r = reconcileSelection(state, nextWithoutGone);
    expect(r.state.selectedEntityId).toBeNull();
    expect(r.notice).toMatch(/no longer in|removed/i);
    expect(r.notice).toBe(SELECTION_REMOVED_NOTICE);
    // The wrong behaviour: silently selecting whatever is now at the old index.
    expect(r.state.selectedEntityId).not.toBe(nextWithoutGone.entities[3]!.id);
    // Reported AND the inspector cannot be left open on nothing (mirrors
    // city-store.ts's own clearSelection()).
    expect(r.state.inspectorOpen).toBe(false);
  });

  it('matches by ENTITY IDENTITY, not by position, when the file set is reordered', () => {
    const state = baseState({ selectedEntityId: id('src/b.ts') });
    // The SAME set, reordered and with an insertion before it — a pure position-based
    // lookup (index 1 in the original order) would now find a completely different file.
    const reordered = snapshotOf(['src/z.ts', 'src/a.ts', 'src/b.ts', 'src/c.ts']);
    const r = reconcileSelection(state, reordered);
    expect(r.state.selectedEntityId).toBe(id('src/b.ts'));
    expect(r.notice).toBeNull();
  });

  it('preserves query, camera and inspector state across reconciliation', () => {
    const state = baseState({ selectedEntityId: id('src/gone.ts'), query: 'kept-query', inspectorOpen: true });
    const next = snapshotOf(['src/only-survivor.ts']);
    const r = reconcileSelection(state, next);
    expect(r.state.query).toBe('kept-query');
    expect(r.state.camera).toBe(CAMERA);
    expect(r.state.previous3dCamera).toBe(CAMERA);
    expect(r.state.viewMode).toBe('3d');
    expect(r.state.profileId).toBe(REPO);
  });

  it('reconciles each leaf INDEPENDENTLY against the same new snapshot', () => {
    const next = snapshotOf(['src/a.ts']);
    const leafKeeping = baseState({ selectedEntityId: id('src/a.ts') });
    const leafLosing = baseState({ selectedEntityId: id('src/gone.ts') });
    const rKeeping = reconcileSelection(leafKeeping, next);
    const rLosing = reconcileSelection(leafLosing, next);
    expect(rKeeping.state.selectedEntityId).toBe(id('src/a.ts'));
    expect(rKeeping.notice).toBeNull();
    expect(rLosing.state.selectedEntityId).toBeNull();
    expect(rLosing.notice).not.toBeNull();
    // Neither call mutated the shared input it was handed.
    expect(leafKeeping.selectedEntityId).toBe(id('src/a.ts'));
    expect(leafLosing.selectedEntityId).toBe(id('src/gone.ts'));
  });

  it('does not authorise a scan when reconciling', () => {
    // Fix round 1, Minor 7: a signature/arity check alone would still pass a
    // future regression that added a real side effect without changing the
    // function's shape. This spies on the REAL ScanCoordinator's own `start` --
    // the one and only thing that ever begins a walk (scan-coordinator.ts's own
    // file comment) -- across several reconciliations, including one that
    // reports a removed selection (the one call site with anything to react to).
    const startSpy = vi.spyOn(ScanCoordinator.prototype, 'start');
    reconcileSelection(baseState({ selectedEntityId: id('src/gone.ts') }), snapshotOf(['src/a.ts']));
    reconcileSelection(baseState({ selectedEntityId: id('src/a.ts') }), snapshotOf(['src/a.ts']));
    reconcileSelection(baseState({ selectedEntityId: null }), snapshotOf([]));
    expect(startSpy).not.toHaveBeenCalled();
    // Confirmed synchronous, not merely "did not await anything" -- a Promise
    // would itself be a smell for something documented as pure and immediate.
    const result = reconcileSelection(baseState(), snapshotOf(['src/a.ts']));
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('is a no-op when there is no selection at all', () => {
    const state = baseState({ selectedEntityId: null });
    const next = snapshotOf(['src/a.ts']);
    const r = reconcileSelection(state, next);
    expect(r).toEqual({ state, notice: null });
  });
});
