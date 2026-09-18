// The UI-facing store for "what the user is looking at" (spec 4.1's CityViewState
// shape, plus the transient `snapshot`/`layout`/`matchingIds` a view needs that
// CityViewState itself never persists). Ruling M35 (task-9-context.md §3):
// run-state.ts's `ScanLifecycleState` carries its OWN, inert `selectedEntityId`/
// `query` fields; this store is the one real source of truth for both, and nothing
// here reads or writes that reducer's copies.
//
// Ported invariants from docs/concept/design/wp01-review/validation/model.test.cjs
// (task-9-context.md §10) — see tests/unit/city-store.test.ts for what each action
// is required to hold. Every action here is a plain, synchronous mutation; none of
// them ever mutates the snapshot/layout objects handed to `setCity`.
import { defineStore } from 'pinia';
import type { EntityId } from '../../domain/entity-id';
import type { CameraBookmark, CodebaseSnapshot } from '../../domain/model';
import type { LayoutResult } from '../../domain/layout/types';
import { COPY_30 } from '../copy';

type ViewMode = '3d' | 'top' | 'list';
const VIEW_MODES: readonly ViewMode[] = ['3d', 'top', 'list'];

interface CityStoreState {
  snapshot: CodebaseSnapshot | null;
  layout: LayoutResult | null;
  selectedEntityId: EntityId | null;
  focusedEntityId: EntityId | null;
  query: string;
  matchingIds: ReadonlySet<EntityId> | null;   // null = unfiltered; empty = no matches
  viewMode: ViewMode;
  camera: CameraBookmark | null;
  previous3dCamera: CameraBookmark | null;
  inspectorOpen: boolean;
  lastSpatialMode: '3d' | 'top';
}

function initialState(): CityStoreState {
  return {
    snapshot: null,
    layout: null,
    selectedEntityId: null,
    focusedEntityId: null,
    query: '',
    matchingIds: null,
    // Task 9 fix round 1, item 3 (Important): a SPATIAL default, not 'list' — the
    // eleven WCAG 2.5.7 camera controls only render when viewMode !== 'list', and
    // 'list' was the shipped default with no reachable switch off it, so those
    // controls never appeared in production at all. List stays reachable as the
    // FALLBACK (spec 5.2's "list-first" below the 320px floor), never the default.
    viewMode: '3d',
    camera: null,
    previous3dCamera: null,
    inspectorOpen: false,
    lastSpatialMode: '3d',
  };
}

/** Case-insensitive substring over included file paths only (directories and the
 *  repository entity are never search targets — spec 5.2 describes filtering FILES).
 *  `.toLowerCase()` is sufficient for the fixture's own case (Ü/ü), and preserves
 *  every other non-ASCII character untouched because it is never stripped. */
function computeMatches(snapshot: CodebaseSnapshot, query: string): ReadonlySet<EntityId> {
  const needle = query.toLowerCase();
  const matches = new Set<EntityId>();
  for (const entity of snapshot.entities) {
    if (entity.kind !== 'file') continue;
    if (entity.path.toLowerCase().includes(needle)) matches.add(entity.id);
  }
  return matches;
}

export const useCityStore = defineStore('city-view', {
  state: initialState,
  getters: {
    /** COPY-30, surfaced whenever the current selection exists but is not among the
     *  current matches (task-9-context.md finding, spec 5.2's "keep a filter-hidden
     *  selection selected and explain it"). Never fires while unfiltered. */
    banner(state): string | null {
      if (!state.selectedEntityId || !state.matchingIds) return null;
      return state.matchingIds.has(state.selectedEntityId) ? null : COPY_30;
    },
  },
  actions: {
    /** Loads a freshly scanned/reopened snapshot and its layout together — the two
     *  always change together, so there is exactly one entry point for both rather
     *  than two calls that could disagree about which snapshot a layout came from. */
    setCity(snapshot: CodebaseSnapshot, layout: LayoutResult): void {
      this.snapshot = snapshot;
      this.layout = layout;
    },

    /** Selecting never moves the camera, never touches the query or the match set,
     *  and never rebuilds the layout — it is purely "which entity is the subject of
     *  the inspector now". */
    select(entityId: EntityId): void {
      this.selectedEntityId = entityId;
    },

    /** The only way selection is cleared (spec: "cleared only explicitly"). Neither
     *  an empty-space click, a filtered-out query, nor closing the inspector goes
     *  through here. */
    clearSelection(): void {
      this.selectedEntityId = null;
      this.inspectorOpen = false;
    },

    /** Clicking empty canvas space is a deliberate no-op for selection (spec:
     *  "cleared only explicitly") — named explicitly, rather than left unwired,
     *  so a future change that makes it clear the selection by mistake fails this
     *  store's own test rather than only a component test three layers up. */
    handleBackgroundClick(): void {
      // Intentionally empty.
    },

    /** Roving keyboard focus in the file list is independent of selection — moving
     *  focus must never activate a row (spec: activation is Enter/click only). */
    focusRow(entityId: EntityId | null): void {
      this.focusedEntityId = entityId;
    },

    openInspector(): void {
      if (!this.selectedEntityId) return;   // cannot open without a selection
      this.inspectorOpen = true;
    },

    /** Closing the inspector preserves the selection — only `clearSelection` drops
     *  it. */
    closeInspector(): void {
      this.inspectorOpen = false;
    },

    /** Empty or whitespace-only clears the filter entirely (matchingIds -> null,
     *  "unfiltered"), distinct from a real, zero-length match set (matchingIds -> an
     *  empty Set, "no matches"). Never touches `layout` — matches are applied by the
     *  consumer dimming lots in place, never by rebuilding or reordering them. */
    setQuery(query: string): void {
      this.query = query;
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        this.matchingIds = null;
        return;
      }
      this.matchingIds = this.snapshot ? computeMatches(this.snapshot, trimmed) : new Set();
    },

    /** Selects the first match in a DETERMINISTIC order (sorted by path — never
     *  insertion order, which is not guaranteed stable across a rescan) and never
     *  moves the camera. A no-op when there is no snapshot, no filter, or no match. */
    confirmSearch(): void {
      if (!this.snapshot || !this.matchingIds || this.matchingIds.size === 0) return;
      const files = this.snapshot.entities.filter((e) => e.kind === 'file' && this.matchingIds!.has(e.id));
      const first = [...files].sort((a, b) => a.path.localeCompare(b.path))[0];
      if (first) this.select(first.id);
    },

    /** The bookmark wins (spec 4.2): whatever mode it names becomes the retained 3D
     *  camera whenever that mode IS '3d'. Never otherwise inspects or changes
     *  selection/query — this is what "retains selection and query across Fit"
     *  actually pins, since Fit's result reaches this store through the same
     *  camera-changed -> setCamera path a manual camera drag does. */
    setCamera(camera: CameraBookmark): void {
      this.camera = camera;
      if (camera.mode === '3d') this.previous3dCamera = camera;
    },

    /** Simulates a camera mutation that happens while in top view — e.g. a nudge or
     *  drag the renderer reports back through camera-changed. Deliberately does NOT
     *  touch `previous3dCamera`: top-view operations must never mutate the retained
     *  3D bookmark (spec 4.2's round-trip guarantee). */
    nudgeInTopView(): void {
      if (!this.camera) return;
      this.camera = { ...this.camera, mode: 'top', zoom: this.camera.zoom * 1.1 };
    },

    /** Rejects anything outside the closed '3d' | 'top' | 'list' vocabulary as a
     *  no-op (an "unknown action" must never corrupt state — the ported invariant
     *  behind this store not being a bare, unchecked setter). Switching to '3d' from
     *  a non-'3d' mode restores the EXACT retained bookmark rather than whatever the
     *  live `camera` happened to become while away from it. Switching AWAY from
     *  '3d'/'top' remembers which of the two it was, for `returnFromList`. */
    setViewMode(mode: ViewMode): void {
      if (!VIEW_MODES.includes(mode)) return;
      if (mode === '3d' && this.camera?.mode !== '3d' && this.previous3dCamera) {
        this.camera = this.previous3dCamera;
      }
      if (this.viewMode !== 'list') this.lastSpatialMode = this.viewMode;
      this.viewMode = mode;
    },

    /** Returns from the HTML list to whichever of '3d'/'top' was active before the
     *  list was opened — never unconditionally back to '3d'. */
    returnFromList(): void {
      this.setViewMode(this.lastSpatialMode);
    },
  },
});
