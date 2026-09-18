<!--
  C01 — the real shell task 3's welcome stub stood in for. Composes every component
  task 9 ships. Exposes `rendererHost` UNCHANGED (an HTMLElement, not a ref-wrapped
  one) because `city-view.ts` (unmodified this task — its own header comment says
  "this file's own responsibilities do not change") reads
  `instance.rendererHost` exactly once, right after `vueApp.mount(...)` returns, and
  passes it straight into `createCityRenderer`. That element is now
  CityViewport's own internal stage div, forwarded up through its exposed `stageEl`.

  Owns the ONE shared renderer-command handle and the ONE shared stage-element
  handle (renderer-handle.ts) at the root of the tree, and the ONE derivation of
  "which view-level state currently applies" (view-surface.ts) driving
  StatusBanner/EmptyState. See task-9-report.md for the two states
  (invalid-directory, read-not-approved) this derivation cannot yet reach, and for
  why CityViewport stays passive under today's unmodified CityView wiring.
-->
<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useCityStore } from './stores/city-store';
import { useRunStore } from './stores/run-store';
import { provideCityRenderer, provideCityStageEl } from './renderer-handle';
import { provideInspectorOpener } from './drawer-focus';
import { countPartialRead, deriveViewSurfaceState } from './view-surface';
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

// `rendererAvailable` is no longer read here (item 4) — CityViewport injects it
// directly itself; App.vue's own derivation must never see it (see below).
const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});

provideCityRenderer();
provideCityStageEl();
provideInspectorOpener();

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

interface CityViewportExposed { stageEl: HTMLElement | null }
const cityViewportRef = ref<CityViewportExposed | null>(null);

// Task 9 fix round 1, item 4 (Important): renderer/root unavailability are
// deliberately NEVER wired into this derivation. `view-surface.ts` still SUPPORTS
// 'renderer-unavailable'/'context-lost' as states (StatusBanner/EmptyState's own
// component tests exercise them directly), but feeding the real signal in here
// made it the head of a single-winner priority chain — masking "no source
// selected", scanning, cancelled and every other state behind it. Since
// `rendererAvailable` starts `false` in city-view.ts and only flips true after
// the first size measurement (and stays false forever below the 320px floor),
// that meant the welcome action was hidden before the first measurement and
// permanently on any narrow leaf — a regression against task 3, whose welcome
// button was unconditional. CityViewport already renders its OWN, genuinely
// non-exclusive notice for exactly this signal (COPY-14 / the reconstruct
// notice), inside the viewport pane, alongside whatever else is on screen —
// picking IT as the one owner of that copy is what fixes the double-print too.
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
  <div class="ci-app">
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
