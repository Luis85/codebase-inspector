import { describe, expect, it, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';
import { makeEntityId } from '../../src/domain/entity-id';
import { classify } from '../../src/domain/classify';
import type { CameraBookmark, CodeEntity, CodebaseSnapshot } from '../../src/domain/model';

/** A minimal, valid snapshot with one precomposed-accented file path
 *  ('tests/überblick.ts'), built by hand rather than reused from
 *  tests/fixtures/snapshot-builder.ts's own `unicodeFixture()`: that fixture
 *  deliberately uses a NFD (combining-mark) 'á'/'ó' — a genuine, separate Unicode
 *  normalization concern this task's search does not claim to solve. This fixture
 *  keeps the case-insensitive-substring test isolated to what spec 5.2 actually
 *  asks for: a non-ASCII character surviving `.toLowerCase()` unstripped. */
function accentedPathFixture(): CodebaseSnapshot {
  const repositoryId = 'repo-accented';
  const repositoryEntity: CodeEntity = {
    id: makeEntityId(repositoryId, 'repository', ''),
    repositoryId, kind: 'repository', path: '', name: repositoryId,
    parentId: null, category: null,
  };
  const path = 'tests/überblick.ts';
  const fileEntity: CodeEntity = {
    id: makeEntityId(repositoryId, 'file', path),
    repositoryId, kind: 'file', path, name: 'überblick.ts',
    parentId: repositoryEntity.id, category: classify(path),
  };
  return {
    snapshotId: 'snapshot-accented', schemaVersion: 1, repositoryId,
    providerRun: {
      runId: 'run-accented', provider: 'builtin-inventory', origin: 'collected',
      capturedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:01.000Z',
    },
    scope: { rootPath: '/fixture/accented', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false },
    entities: [repositoryEntity, fileEntity],
    observations: [],
    fileSetDigest: 'fixture-digest-accented',
    completeness: 'complete',
    warnings: [],
  };
}

// Ported invariants (not the implementation) from
// docs/concept/design/wp01-review/validation/model.test.cjs, task-9-context.md §10.
// task-9-brief.md's own header says "the remaining 23 land here", step 3 says
// "the other 17 of the 31"; the code block below has 24 `it()` blocks (defect D23 —
// three self-contradictions, none of them 17 or 23). The code block governs: every
// test below is one of the brief's own `it()` blocks, body written out from its
// one-line description because the brief left the body as `/* ... */`.
describe('useCityStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const snapshot = buildSnapshotFixture({ files: 5, directories: 1 });
  const layout = computeLayout(snapshot);
  const fileId = (i: number): string => snapshot.entities.filter((e) => e.kind === 'file')[i]!.id;

  const bookmark3d: CameraBookmark = {
    projection: 'orthographic', mode: '3d',
    position: [20, 20, 20], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
  };

  describe('selection', () => {
    it('does not move the camera', () => {
      const store = useCityStore();
      store.setCamera(bookmark3d);
      const before = store.camera;
      store.select(fileId(0));
      expect(store.camera).toBe(before);
      expect(store.camera).toEqual(bookmark3d);
    });

    it('preserves the query', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.setQuery('file-1');
      store.select(fileId(0));
      expect(store.query).toBe('file-1');
    });

    it('does not change the search', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.setQuery('file-1');
      const before = store.matchingIds;
      store.select(fileId(0));
      expect(store.matchingIds).toBe(before);
    });

    it('does not rebuild layout', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      const before = store.layout;
      store.select(fileId(0));
      expect(store.layout).toBe(before);
    });

    it('opens the inspector', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.select(fileId(0));
      store.openInspector();
      expect(store.inspectorOpen).toBe(true);
    });

    it('cannot open the inspector without a selection', () => {
      const store = useCityStore();
      store.openInspector();
      expect(store.inspectorOpen).toBe(false);
    });

    it('survives closing the inspector', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.select(fileId(0));
      store.openInspector();
      store.closeInspector();
      expect(store.inspectorOpen).toBe(false);
      expect(store.selectedEntityId).toBe(fileId(0));
    });

    it('is cleared only explicitly', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.select(fileId(0));
      store.handleBackgroundClick();
      store.setQuery('anything');
      store.openInspector();
      store.closeInspector();
      expect(store.selectedEntityId).toBe(fileId(0));
      store.clearSelection();
      expect(store.selectedEntityId).toBeNull();
    });

    it('is a no-op on empty-space click', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.select(fileId(0));
      store.handleBackgroundClick();
      expect(store.selectedEntityId).toBe(fileId(0));
    });

    it('is NOT changed by moving keyboard focus in the list', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.select(fileId(0));
      store.focusRow(fileId(1));
      expect(store.selectedEntityId).toBe(fileId(0));
      expect(store.focusedEntityId).toBe(fileId(1));
    });
  });

  describe('search', () => {
    it('is case-insensitive substring over included file paths', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.setQuery('FILE-1');
      expect(store.matchingIds).toEqual(new Set([fileId(1)]));
    });

    it('preserves non-ASCII characters', () => {
      const store = useCityStore();
      const accented = accentedPathFixture();
      store.setCity(accented, computeLayout(accented));
      // 'ÜBER' matches 'tests/überblick.ts' — the search must fold Ü/ü's case
      // without stripping either the accent or any other non-ASCII character.
      store.setQuery('ÜBER');
      const fileEntity = accented.entities.find((e) => e.kind === 'file')!;
      expect(store.matchingIds).toEqual(new Set([fileEntity.id]));
    });

    it('matches everything on an empty or whitespace-only query', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.setQuery('   ');
      expect(store.matchingIds).toBeNull();
    });

    it('DIMS non-matches in place — never hides, relocates or relayouts', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      const before = store.layout;
      store.setQuery('nothing-matches');
      expect(store.layout).toBe(before);              // reference-identical
      expect(store.matchingIds!.size).toBe(0);        // empty set, not null
    });

    it('distinguishes an empty result set from an unfiltered one', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.setQuery('nothing-matches');
      expect(store.matchingIds).not.toBeNull();
      expect(store.matchingIds!.size).toBe(0);
      // setFilter(null) = unfiltered; setFilter(empty set) = no matches.
      store.setQuery('');
      expect(store.matchingIds).toBeNull();
    });

    it('keeps a filter-hidden selection SELECTED and explains it', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.select(fileId(0));
      store.setQuery('no-match-for-this-one');
      expect(store.selectedEntityId).toBe(fileId(0));
      expect(store.banner).toContain('The selected file is outside these filters.');
    });

    it('selects the first match on Enter in deterministic order WITHOUT moving the camera', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.setCamera(bookmark3d);
      store.setQuery('file-');
      const before = store.camera;
      store.confirmSearch();
      const files = snapshot.entities.filter((e) => e.kind === 'file');
      const expectedFirst = [...files].sort((a, b) => a.path.localeCompare(b.path))[0]!;
      expect(store.selectedEntityId).toBe(expectedFirst.id);
      expect(store.camera).toBe(before);
    });

    it('is a no-op on Enter with no matches', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.setQuery('nothing-matches');
      store.confirmSearch();
      expect(store.selectedEntityId).toBeNull();
    });
  });

  describe('camera and view mode', () => {
    it('restores the EXACT 3D camera on a top-view round trip', () => {
      const store = useCityStore();
      store.setCamera(bookmark3d);
      store.setViewMode('top');
      store.nudgeInTopView();
      store.setViewMode('3d');
      expect(store.camera).toEqual(bookmark3d);    // top-view operations never mutate it
    });

    // Phase 2 fix wave, C1: the assertion the test above only APPEARS to make. That
    // one names '3d' itself, which no production caller ever did; this one derives the
    // next mode the way CameraControls.top() now does, so it pins the SECOND press of
    // the toggle specifically — including that `previous3dCamera`, which spec 4.1 calls
    // load-bearing, is what comes back rather than whatever `camera` became while away.
    // Reachability from the UI is proven by camera-controls.test.ts, not here.
    it('C1: a SECOND Top press restores previous3dCamera, not the live top camera', () => {
      const store = useCityStore();
      store.setCamera(bookmark3d);
      const pressTop = (): void => { store.setViewMode(store.viewMode === 'top' ? '3d' : 'top'); };

      pressTop();
      expect(store.viewMode).toBe('top');
      store.nudgeInTopView();
      expect(store.camera).not.toEqual(bookmark3d);   // the LIVE camera has moved

      pressTop();
      expect(store.viewMode).toBe('3d');
      expect(store.camera).toEqual(bookmark3d);
      expect(store.previous3dCamera).toEqual(bookmark3d);
    });

    it('retains selection and query across Fit', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.select(fileId(0));
      store.setQuery('file');
      // "Fit" recomputes the camera and reports it back through the same setCamera
      // path camera-changed events use — it must not, as a side effect, disturb
      // selection or query.
      store.setCamera({ ...bookmark3d, zoom: 2 });
      expect(store.selectedEntityId).toBe(fileId(0));
      expect(store.query).toBe('file');
    });

    it('retains selection when switching to the HTML list', () => {
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.select(fileId(0));
      store.setQuery('file');
      store.setViewMode('list');
      expect(store.selectedEntityId).toBe(fileId(0));
      expect(store.query).toBe('file');
    });

    it('returns to the previous top mode from the HTML list', () => {
      const store = useCityStore();
      store.setViewMode('top');
      store.setViewMode('list');
      store.returnFromList();
      expect(store.viewMode).toBe('top');
    });
  });

  describe('immutability', () => {
    it('leaves inputs unmutated across every transition', () => {
      const store = useCityStore();
      const snapshotBefore = JSON.stringify(snapshot);
      const layoutBefore = JSON.stringify(layout);
      store.setCity(snapshot, layout);
      store.select(fileId(0));
      store.setQuery('file');
      store.openInspector();
      store.closeInspector();
      store.setCamera(bookmark3d);
      store.setViewMode('top');
      store.nudgeInTopView();
      store.setViewMode('3d');
      store.confirmSearch();
      store.clearSelection();
      store.handleBackgroundClick();
      store.focusRow(fileId(1));
      store.returnFromList();
      expect(JSON.stringify(snapshot)).toBe(snapshotBefore);
      expect(JSON.stringify(layout)).toBe(layoutBefore);
    });

    it('preserves state identity for an unknown action', () => {
      const store = useCityStore();
      store.setViewMode('top');
      const before = store.viewMode;
      // @ts-expect-error -- deliberately outside the '3d' | 'top' | 'list' vocabulary
      store.setViewMode('bogus');
      expect(store.viewMode).toBe(before);
    });
  });
});
