<!--
  C01 — the real shell task 3's welcome stub stood in for. Composes every component
  task 9 ships. Still exposes `rendererHost` (CityViewport's own internal stage div,
  forwarded up through its exposed `stageEl`) for tests that mount `App` directly,
  but task 9 fix round 2, item 1 (ruling M68) ended `city-view.ts`'s own read of it:
  CityViewport is now the SINGLE owner of renderer construction, teardown and
  sizing, reached by `city-view.ts` PROVIDING the real `createCityRenderer` factory
  into this tree instead of calling it directly and reading the result back out.

  Owns the ONE shared renderer-command handle and the ONE shared stage-element
  handle (renderer-handle.ts) at the root of the tree, and the ONE derivation of
  "which view-level state currently applies" (view-surface.ts) driving
  StatusBanner/EmptyState. See task-9-report.md for the two states
  (invalid-directory, read-not-approved) this derivation cannot yet reach.
-->
<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useCityStore } from './stores/city-store';
import { useRunStore } from './stores/run-store';
import { provideCityRenderer, provideCityStageEl } from './renderer-handle';
import { provideInspectorOpener } from './drawer-focus';
import { countPartialRead, deriveViewSurfaceState } from './view-surface';
import { escapeIntent } from './interaction/escape-intent';
import { DRAWER_MAX_INLINE_SIZE, MIN_INLINE_SIZE } from './responsive';
import { contentBoxInlineSize, narrowContainer } from './container-box';
import { COPY_02, COPY_30_CLEAR_LABEL, COPY_30_EXPLANATION, COPY_30_REVEAL_LABEL } from './copy';
import AppToolbar from './components/AppToolbar.vue';
import CodebaseFileList from './components/CodebaseFileList.vue';
import CityStage from './components/CityStage.vue';
import FileInspector from './components/FileInspector.vue';
import SnapshotStatus from './components/SnapshotStatus.vue';
import StatusBanner from './components/StatusBanner.vue';
import EmptyState from './components/EmptyState.vue';
import AnnouncementRegion from './components/AnnouncementRegion.vue';

const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});

// Task 9 (F13): captured, not discarded — the notice's own Reveal control (below)
// issues a renderer command through this SAME shared handle CityViewport writes.
const cityRenderer = provideCityRenderer();
provideCityStageEl();
const inspectorOpenerHandle = provideInspectorOpener();

const store = useCityStore();
const runStore = useRunStore();

// Task 9 fix round 1, item 7 (Important): the <820px layout's Files overlay —
// unlike the Inspector, which already has `store.inspectorOpen` — had no
// state of its own at all, no opener and no close control. Purely a narrow-
// layout UI concern (never persisted, never meaningful at >=820px, where CSS
// ignores it entirely), so it stays local here rather than in the Pinia store.
const filesDrawerOpen = ref(false);
const filesDrawerOpener = ref<HTMLElement | null>(null);

function openFilesDrawer(event: MouseEvent): void {
  filesDrawerOpener.value = event.currentTarget as HTMLElement;
  filesDrawerOpen.value = true;
  store.closeInspector();   // ONE overlay at a time
}
function closeFilesDrawer(): void {
  filesDrawerOpen.value = false;
  filesDrawerOpener.value?.focus();
}

/** Task 9 (F13): notice's "Reveal file" — re-selects (idempotent) and focuses
 *  through the renderer, like FileInspector.vue's own Focus button. Never touches
 *  `store.query`: revealing is not the same action as clearing the search that hid it. */
function revealSelection(): void {
  const id = store.selectedEntityId;
  if (!id) return;
  store.select(id);
  cityRenderer.value?.focus(id);
}
// The other half of "one overlay at a time": opening the inspector (from
// CodebaseFileList's own row activation, or a future canvas pick) closes the
// Files drawer too, without CodebaseFileList needing to know the drawer exists.
watch(() => store.inspectorOpen, (open) => { if (open) filesDrawerOpen.value = false; });

// Task 9 fix round 2, item 2 (Fold): escapeIntent's chain (modal -> help ->
// nonmodal drawer -> query -> selection, ruling M61) was previously reachable
// end to end ONLY through FileSearch.vue's own local `clear-query` handling.
// This shell-level listener reaches the drawer and selection branches too, with
// REAL state — no `modal`/`help` state exists at this level yet (nothing to
// wire), so those two never fire; the rest do.
const rootEl = ref<HTMLElement | null>(null);
const narrowDrawer = ref(false);

interface WinBearing { win?: Window }
interface DocBearing { doc?: Document }

// Phase 2 fix wave, I2 (Important): spec 5.2 says "below a hard floor of 320 CSS px
// inline size the view renders LIST-FIRST and creates no WebGL context at all", and
// only the second half shipped -- CityViewport disposed the renderer, but viewMode
// stayed spatial, so a leaf dragged into a sidebar (spec 5.2: "can be ~150 px")
// showed an empty bordered stage with COPY-14 and no file list at all, since below
// 819 px styles.css hides the list wrapper unless it is open.
//
// This lives HERE, not in CityViewport.applySize, for a structural reason: entering
// list mode UNMOUNTS CityViewport (the `v-if` below), which disconnects the very
// ResizeObserver that would have to notice the leaf widening again -- a one-way
// door. This component's observer is on the leaf container and survives the switch.
//
// `forcedListByFloor` records that WE switched, so widening restores the user's own
// spatial mode (`returnFromList()` -> `lastSpatialMode`) and never drags someone out
// of a list view they chose themselves. `setViewMode` preserves query, selection and
// the camera bookmark, which is exactly what the spec's next sentence requires.
const forcedListByFloor = ref(false);

function updateResponsiveLayout(): void {
  const el = rootEl.value;
  if (!el) return;
  // Ruling M97, reopened: the CONTENT box, which is what `container-type: inline-size`
  // compares -- `getBoundingClientRect()` is the BORDER box and Obsidian's own
  // `.view-content` padding makes the two differ by 24 px. See container-box.ts.
  const width = contentBoxInlineSize(narrowContainer(el));
  narrowDrawer.value = width < DRAWER_MAX_INLINE_SIZE;
  // Re-review round 2 (R1, Important): at or above the threshold the Files overlay
  // STOPS EXISTING -- styles.css makes the list a permanent column and hides the
  // opener -- but nothing reset this flag, so a drawer opened narrow stayed flagged
  // open forever after a pane drag or a pop-out. `filesDrawerOpen` is a
  // narrow-layout-only concern (its own declaration says so), so the width that
  // ends the narrow layout is where it is retired. Assigned directly rather than
  // through `closeFilesDrawer()`: that one focuses the opener, which is exactly the
  // hidden control this must not send focus to.
  if (!narrowDrawer.value) filesDrawerOpen.value = false;
  // A hidden leaf collapses to exactly 0 (spec 4.2's pause/resume invariant, the
  // same case CityViewport's own zero-box guard exists for) -- suspended, not narrow.
  if (width <= 0) return;
  if (width < MIN_INLINE_SIZE) {
    if (store.viewMode === 'list') return;
    forcedListByFloor.value = true;
    store.setViewMode('list');
  } else if (forcedListByFloor.value) {
    forcedListByFloor.value = false;
    store.returnFromList();
  }
}

let resizeObserver: ResizeObserver | null = null;
let listenerDoc: Document | null = null;
let unwireRootMigration: (() => void) | null = null;

/** `event.isComposing` (native, spec-provided) rather than a locally tracked
 *  flag — this listens on `document`, never a specific input, so there is no
 *  single element whose own compositionstart/end this could track instead. */
// Task 9 fix round 3, item 1 (Important): this listener used to act on EVERY
// Escape reaching `document`, regardless of where focus actually was —
// contradicting escape-intent.ts's own stated invariant ("must not disturb
// composition or... a Markdown editor elsewhere in the workspace") and spec
// 5.2, and cross-talking between two open leaves (M9: multiple leaves are a
// first-class capability), since both listen on the SAME document and matched
// on the GLOBAL activeElement. Gated here exactly like FileSearch.vue's own
// `viewRoot.contains(doc.activeElement)` check (its `onGlobalKeydown`, same file
// pattern) — this view resolves an Escape only when IT owns focus.
function onGlobalKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const el = rootEl.value;
  if (!el) return;
  const active = listenerDoc?.activeElement ?? null;
  if (!narrowContainer(el).contains(active)) return;
  const intent = escapeIntent({
    composing: event.isComposing,
    inInspector: store.inspectorOpen,
    // Phase 2 fix wave, I1 (Important): the shell's OWN Files-drawer state, which
    // this listener never passed in -- so with the drawer open the chain fell
    // through to `inCanvas && selected` (true precisely BECAUSE focus is inside the
    // open drawer's list) and Escape destroyed the selection instead of closing the
    // drawer. Spec 5.2 names Files as one of the two nonmodal drawers.
    filesDrawer: filesDrawerOpen.value,
    narrowDrawer: narrowDrawer.value,
    inSearch: Boolean(active?.closest('.ci-search')),
    query: store.query,
    // "canvas/list focus": the spatial selection surfaces a selection can be
    // MADE from (spec 5.2) — the 3D viewport and the HTML list both select the
    // same `store.selectedEntityId`, so Escape clearing it applies to either.
    inCanvas: Boolean(active?.closest('.ci-viewport, .ci-file-list')),
    selected: store.selectedEntityId !== null,
  });
  if (intent === 'close-inspector') {
    store.closeInspector();
    inspectorOpenerHandle.value?.focus();
  } else if (intent === 'close-files-drawer') {
    closeFilesDrawer();          // already returns focus to the opener
  } else if (intent === 'clear-selection') {
    store.clearSelection();
  } else if (intent === 'clear-query') {
    // Reachable only when a leftover query exists while focus is on NEITHER the
    // search field (FileSearch.vue's own local handler already claims that case
    // via `event.defaultPrevented`, above) nor anywhere else this chain checks
    // first — tests/unit/escape-intent.test.ts's own "reachability note" already
    // documents this combination as not reachable from real focus alone.
    store.setQuery('');
  }
}

/** Re-resolves the document the Escape listener is attached to, off `el`'s CURRENT
 *  `.doc` (spec 4.4: the injected Window/Document, never a bare global). Task 11
 *  fix round 1, item 3 (Important): before this, a pop-out's Escape key stayed
 *  bound to the PRE-migration document forever, so `listenerDoc?.activeElement`
 *  read the wrong window and the drawer/inspector could never be closed by
 *  keyboard there. Detaches the previous document's listener first, so migrating
 *  more than once never accumulates one. */
function attachKeydownListener(el: HTMLElement): void {
  listenerDoc?.removeEventListener('keydown', onGlobalKeydown);
  listenerDoc = (el as unknown as DocBearing).doc ?? null;
  listenerDoc?.addEventListener('keydown', onGlobalKeydown);
}

/** Same fix, for the 820px drawer-threshold observer: rebuilt off `el`'s CURRENT
 *  `.win`, never left pointing at the pre-migration window's `ResizeObserver`
 *  constructor (which has no defined behaviour once `el` has moved). */
function attachResizeObserver(el: HTMLElement): void {
  resizeObserver?.disconnect();
  resizeObserver = null;
  const win = (el as unknown as WinBearing).win;
  if (!win) return;
  resizeObserver = new (win as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() => {
    updateResponsiveLayout();
  });
  resizeObserver.observe(narrowContainer(el));
}

onMounted(() => {
  const el = rootEl.value;
  if (!el) return;
  attachKeydownListener(el);
  updateResponsiveLayout();
  attachResizeObserver(el);
  // Task 11 fix round 1, item 3: re-attaches BOTH on migration -- this is the
  // "no wrong-window DOM" clause task 11 itself named as unmet.
  unwireRootMigration = el.onWindowMigrated(() => {
    attachKeydownListener(el);
    updateResponsiveLayout();
    attachResizeObserver(el);
  });
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  listenerDoc?.removeEventListener('keydown', onGlobalKeydown);
  listenerDoc = null;
  unwireRootMigration?.();
  unwireRootMigration = null;
});

// Task 10 (F5): CityStage.vue now owns CityHeader/CityViewport/CameraControls/
// MetricLegend as one extracted unit (see that file's own comment for why), and
// relays CityViewport's own exposed `stageEl` back up through its own
// `defineExpose` — this ref reaches the SAME element `cityViewportRef` used to,
// one hop further away.
interface CityStageExposed { stageEl: HTMLElement | null }
const cityStageRef = ref<CityStageExposed | null>(null);

// Task 9 fix round 1, item 4 (Important): renderer/root unavailability are
// deliberately NEVER wired into this derivation. `view-surface.ts` still SUPPORTS
// 'renderer-unavailable'/'context-lost' as states (StatusBanner/EmptyState's own
// component tests exercise them directly), but feeding the real signal in here
// made it the head of a single-winner priority chain — masking "no source
// selected", scanning, cancelled and every other state behind it, permanently on
// any narrow leaf — a regression against task 3, whose welcome button was
// unconditional. CityViewport already renders its OWN, genuinely non-exclusive
// notice for exactly this signal (COPY-14 / the reconstruct notice), inside the
// viewport pane, alongside whatever else is on screen — picking IT as the one
// owner of that copy is what fixes the double-print too.
// Phase 2c, M8: functions of `store.snapshot` ALONE. Inline in the computed below — which
// also depends on `store.matchingIds`, i.e. on every debounced keystroke — an O(entities)
// filter and an O(entities + observations) scan both re-ran per keystroke while depending
// on nothing that had changed. Split out, they cache on the snapshot.
const totalFileCount = computed(() => store.snapshot?.entities.filter((e) => e.kind === 'file').length ?? 0);
const partialRead = computed(() => countPartialRead(store.snapshot));

const viewSurfaceState = computed(() => deriveViewSurfaceState({
  hasSnapshot: store.snapshot !== null,
  runStatus: runStore.run.status,
  runProcessedFiles: runStore.run.status === 'running' ? runStore.run.processedFiles : 0,
  runFailureMessage: runStore.run.status === 'failed' ? runStore.run.message : null,
  totalFileCount: totalFileCount.value,
  matchingIds: store.matchingIds,
  query: store.query,
  partialRead: partialRead.value,
  rendererUnavailableReason: null,
  rootUnavailable: false,
}));

const rendererHost = computed(() => cityStageRef.value?.stageEl ?? null);
defineExpose({ rendererHost });
</script>

<template>
  <div
    ref="rootEl"
    class="ci-app"
  >
    <!-- Task 5 (F7): the toolbar itself (search, Scan, mode toggle, Files opener) now
         lives in AppToolbar.vue -- extracted, not rewritten, to keep this file under
         the 400-line src/** budget (task-5-brief.md step 4). `openFilesDrawer` stays
         here: it is shell-level state (`filesDrawerOpen`/`filesDrawerOpener`, item 7's
         own one-overlay-at-a-time rule), not the toolbar's own concern. -->
    <AppToolbar @open-files-drawer="openFilesDrawer" />
    <!-- Phase 2c, I4: COPY-30 (spec 5.2: a filter-hidden selection is "EXPLAINED,
         never silently replaced"). NOT routed through viewSurfaceState/StatusBanner
         (a single-winner chain; must coexist with whatever else is showing) and not
         a second live region (AnnouncementRegion owns that). Task 9 (F13): the tail
         used to be unpressable prose ("Reveal file or clear selection.") — now two
         real buttons. A3 fix (whole-branch review, I3): all three pieces —
         COPY_30_EXPLANATION and both button labels — are derived from COPY_30 itself,
         never retyped, so retitling COPY_30 and a button together cannot leave the
         sentence and the control disagreeing. -->
    <div
      v-if="store.banner"
      class="ci-app__selection-notice"
    >
      <p class="ci-app__selection-notice-text">
        {{ COPY_30_EXPLANATION }}
      </p>
      <div class="ci-selection-notice__actions">
        <button
          type="button"
          class="ci-selection-notice__reveal"
          @click="revealSelection"
        >
          {{ COPY_30_REVEAL_LABEL }}
        </button>
        <button
          type="button"
          class="ci-selection-notice__clear"
          @click="store.clearSelection()"
        >
          {{ COPY_30_CLEAR_LABEL }}
        </button>
      </div>
    </div>
    <div class="ci-app__body">
      <!-- Rendered per the container-query layout (styles.css's 820px threshold),
           never per viewMode: the >=820px layout is "list + canvas + inspector"
           together, regardless of which spatial mode the camera is in. Below
           820px it is a drawer instead, gated by `filesDrawerOpen` (item 7) —
           mutually exclusive with the Inspector drawer, never both at once. -->
      <div
        class="ci-app__list-wrapper"
        :class="{ 'ci-app__list-wrapper--open': filesDrawerOpen || store.viewMode === 'list' }"
      >
        <button
          v-if="filesDrawerOpen"
          type="button"
          aria-label="Close files"
          class="ci-app__drawer-close"
          @click="closeFilesDrawer"
        >
          Close
        </button>
        <CodebaseFileList class="ci-app__list" />
      </div>
      <!-- Task 10 (F5): CityHeader, CityViewport (with CameraControls slotted
           inside its own `.ci-viewport`) and MetricLegend now live in CityStage.vue
           -- extracted out of this file, which the brief's own measurement found at
           its 400-line cap with no headroom left for this task's own markup. See
           that file's own comment for the full account, including why
           CameraControls is no longer this column's own direct sibling. -->
      <CityStage ref="cityStageRef" />
      <FileInspector v-if="store.inspectorOpen" />
    </div>
    <div
      v-if="viewSurfaceState.kind === 'no-source'"
      class="ci-app__welcome-action"
    >
      <!-- Class name kept stable from the task-3 welcome shell:
           tests/host/city-view.test.ts (task 8, unmodified this task) selects the
           "Select a codebase" action by this exact selector. -->
      <button
        type="button"
        class="ci-welcome__action"
        @click="onSelectCodebase"
      >
        {{ COPY_02 }}
      </button>
    </div>
    <SnapshotStatus />
    <StatusBanner :state="viewSurfaceState" />
    <EmptyState :state="viewSurfaceState" />
    <AnnouncementRegion />
  </div>
</template>
