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
import { COPY_02 } from './copy';
import FileSearch from './components/FileSearch.vue';
import CodebaseFileList from './components/CodebaseFileList.vue';
import CityViewport from './components/CityViewport.vue';
import CameraControls from './components/CameraControls.vue';
import FileInspector from './components/FileInspector.vue';
import MetricLegend from './components/MetricLegend.vue';
import SnapshotStatus from './components/SnapshotStatus.vue';
import StatusBanner from './components/StatusBanner.vue';
import EmptyState from './components/EmptyState.vue';
import AnnouncementRegion from './components/AnnouncementRegion.vue';

const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});

provideCityRenderer();
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

// The SAME 820 CSS px container-query threshold styles.css uses (spec 5.2):
// measured on the `.codebase-inspector-root` ancestor when one exists (the real
// host), falling back to this component's own root otherwise (a standalone
// mount, same fallback FileSearch.vue's own focus-containment check already
// uses) — never a bare `window`/viewport measurement, which a CONTAINER query
// does not track.
function narrowContainer(el: HTMLElement): Element {
  return el.closest('.codebase-inspector-root') ?? el;
}
function updateNarrowDrawer(): void {
  const el = rootEl.value;
  if (!el) return;
  narrowDrawer.value = narrowContainer(el).getBoundingClientRect().width < 820;
}

let resizeObserver: ResizeObserver | null = null;
let listenerDoc: Document | null = null;

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

onMounted(() => {
  const el = rootEl.value;
  listenerDoc = (el as unknown as DocBearing | null)?.doc ?? null;
  listenerDoc?.addEventListener('keydown', onGlobalKeydown);
  if (!el) return;
  updateNarrowDrawer();
  const win = (el as unknown as WinBearing).win;
  if (!win) return;
  resizeObserver = new (win as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() => {
    updateNarrowDrawer();
  });
  resizeObserver.observe(narrowContainer(el));
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  listenerDoc?.removeEventListener('keydown', onGlobalKeydown);
  listenerDoc = null;
});

interface CityViewportExposed { stageEl: HTMLElement | null }
const cityViewportRef = ref<CityViewportExposed | null>(null);

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
const viewSurfaceState = computed(() => deriveViewSurfaceState({
  hasSnapshot: store.snapshot !== null,
  runStatus: runStore.run.status,
  runProcessedFiles: runStore.run.status === 'running' ? runStore.run.processedFiles : 0,
  runFailureMessage: runStore.run.status === 'failed' ? runStore.run.message : null,
  totalFileCount: store.snapshot?.entities.filter((e) => e.kind === 'file').length ?? 0,
  matchingIds: store.matchingIds,
  query: store.query,
  partialRead: countPartialRead(store.snapshot),
  rendererUnavailableReason: null,
  rootUnavailable: false,
}));

const rendererHost = computed(() => cityViewportRef.value?.stageEl ?? null);
defineExpose({ rendererHost });
</script>

<template>
  <div
    ref="rootEl"
    class="ci-app"
  >
    <div class="ci-app__toolbar">
      <FileSearch />
      <!-- Task 9 fix round 1, item 3 (Important): list mode is the FALLBACK, not
           the default (spec 5.2), but must stay genuinely reachable both ways —
           `returnFromList()` had no caller at all before this. Always visible,
           never hidden by viewMode itself, or leaving list mode would be
           unreachable again the moment it is entered. -->
      <button
        v-if="store.viewMode !== 'list'"
        type="button"
        aria-label="List view"
        class="ci-app__mode-toggle"
        @click="store.setViewMode('list')"
      >
        List view
      </button>
      <button
        v-else
        type="button"
        aria-label="Return to city view"
        class="ci-app__mode-toggle"
        @click="store.returnFromList()"
      >
        Return to city view
      </button>
      <!-- Task 9 fix round 1, item 7: the Files drawer's OPENER — only meaningful
           below 820px (styles.css hides it above that via the container query),
           but always in the DOM so it is reachable the moment the leaf narrows. -->
      <button
        type="button"
        aria-label="Files"
        class="ci-app__mode-toggle ci-app__drawer-opener"
        @click="openFilesDrawer"
      >
        Files
      </button>
    </div>
    <div class="ci-app__body">
      <!-- Rendered per the container-query layout (styles.css's 820px threshold),
           never per viewMode: the >=820px layout is "list + canvas + inspector"
           together, regardless of which spatial mode the camera is in. Below
           820px it is a drawer instead, gated by `filesDrawerOpen` (item 7) —
           mutually exclusive with the Inspector drawer, never both at once. -->
      <div
        class="ci-app__list-wrapper"
        :class="{ 'ci-app__list-wrapper--open': filesDrawerOpen }"
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
      <div class="ci-app__stage-column">
        <!-- CityViewport itself stays unconditionally mounted, even in list mode:
             city-view.ts (frozen this task, store-wiring only per ruling M66)
             captures `instance.rendererHost` ONCE, at initial mount, and keeps
             using that exact element for the lifetime of the view — v-if'ing this
             element's owner would detach it from the DOM the next time viewMode
             changed, leaving city-view.ts's own renderer pointed at a node no
             longer on screen. CameraControls has no camera to command once
             `viewMode === 'list'` (spec 4.2: "no renderer exists"), so IT is what
             list mode actually hides. -->
        <CityViewport ref="cityViewportRef" />
        <CameraControls v-if="store.viewMode !== 'list'" />
        <MetricLegend />
      </div>
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
