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
import { computed, inject, ref } from 'vue';
import type { Ref } from 'vue';
import { useCityStore } from './stores/city-store';
import { useRunStore } from './stores/run-store';
import { provideCityRenderer, provideCityStageEl } from './renderer-handle';
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

const rendererAvailable = inject<Ref<boolean>>('rendererAvailable', () => ref(true), true);
const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});

provideCityRenderer();
provideCityStageEl();

const store = useCityStore();
const runStore = useRunStore();

type RendererUnavailableReason = 'unsupported' | 'context-lost' | 'initialization-failed' | null;
interface CityViewportExposed { stageEl: HTMLElement | null; unavailableReason: RendererUnavailableReason }
const cityViewportRef = ref<CityViewportExposed | null>(null);

const viewSurfaceState = computed(() => deriveViewSurfaceState({
  hasSnapshot: store.snapshot !== null,
  runStatus: runStore.run.status,
  runProcessedFiles: runStore.run.status === 'running' ? runStore.run.processedFiles : 0,
  runFailureMessage: runStore.run.status === 'failed' ? runStore.run.message : null,
  totalFileCount: store.snapshot?.entities.filter((e) => e.kind === 'file').length ?? 0,
  matchingIds: store.matchingIds,
  query: store.query,
  partialRead: countPartialRead(store.snapshot),
  rendererUnavailableReason: cityViewportRef.value?.unavailableReason
    ?? (rendererAvailable.value ? null : 'unsupported'),
  rootUnavailable: false,
}));

const rendererHost = computed(() => cityViewportRef.value?.stageEl ?? null);
defineExpose({ rendererHost });
</script>

<template>
  <div class="ci-app">
    <div class="ci-app__toolbar">
      <FileSearch />
    </div>
    <div class="ci-app__body">
      <CodebaseFileList
        v-if="store.viewMode === 'list'"
        class="ci-app__list"
      />
      <div class="ci-app__stage-column">
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
