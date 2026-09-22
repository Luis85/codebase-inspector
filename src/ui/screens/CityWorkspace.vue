<!--
  C01 — the city composition (WP-02: moved out of App.vue, which is now the inspector shell).
  Behaviour unchanged. Still exposes `rendererHost` (CityViewport's own internal stage div,
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

  Part 5 (V2): the Escape chain (city/use-city-escape.ts), the 320 px floor and 820 px
  drawer wiring (city/use-city-floor.ts) and the COPY-30 notice
  (city/CitySelectionNotice.vue) live beside this file, moved without behaviour change.
-->
<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useRunStore } from '../stores/run-store';
import { provideCityRenderer, provideCityStageEl } from '../renderer-handle';
import { provideInspectorOpener } from '../drawer-focus';
import { countPartialRead, deriveViewSurfaceState } from '../view-surface';
import { COPY_02 } from '../copy';
import AppToolbar from '../components/AppToolbar.vue';
import CodebaseFileList from '../components/CodebaseFileList.vue';
import CityStage from '../components/CityStage.vue';
import FileInspector from '../components/FileInspector.vue';
import SnapshotStatus from '../components/SnapshotStatus.vue';
import StatusBanner from '../components/StatusBanner.vue';
import EmptyState from '../components/EmptyState.vue';
import AnnouncementRegion from '../components/AnnouncementRegion.vue';
import CitySelectionNotice from './city/CitySelectionNotice.vue';
import { useCityEscape } from './city/use-city-escape';
import { useCityFloor } from './city/use-city-floor';

const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});

// Task 9 (F13): the ONE shared renderer handle CityViewport writes (reused from the app
// level when city-view.ts provided it, ruling M68). CitySelectionNotice's Reveal control
// issues its renderer command through it.
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

const rootEl = ref<HTMLElement | null>(null);
// Phase 2 fix wave I2 and R1: the 320 px list-first floor and the 820 px drawer threshold.
const { narrowDrawer } = useCityFloor(rootEl, store, filesDrawerOpen);
// Task 9 fix rounds 2 and 3, task 11 fix round 1 item 3: the leaf-scoped Escape chain.
useCityEscape({
  rootEl, store, inspectorOpener: inspectorOpenerHandle, filesDrawerOpen, narrowDrawer, closeFilesDrawer,
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
    <!-- Phase 2c, I4 / Task 9 (F13): COPY-30, a filter-hidden selection explained with two
         real buttons. See city/CitySelectionNotice.vue (Part 5 V2). -->
    <CitySelectionNotice />
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
