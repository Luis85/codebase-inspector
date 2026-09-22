<script setup lang="ts">
import { computed, inject } from 'vue';
import type { RouteId } from '../../domain/route-ids';
import { buildSourcesModel } from '../read-models/sources';
import { useCityStore } from '../stores/city-store';
import { useRunStore } from '../stores/run-store';
import {
  SOURCES_CALLOUT, SOURCES_CALLOUT_TITLE, SOURCES_CHANGE, SOURCES_EYEBROW, SOURCES_PLANNED, SOURCES_PLANNED_TITLE,
  SOURCES_RESCAN, SOURCES_SUBTITLE, SOURCES_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Panel from '../kit/Panel.vue';
import Callout from '../kit/Callout.vue';
import Icon from '../kit/Icon.vue';
import ScopePanel from './sources/ScopePanel.vue';
import ScanStatusPanel from './sources/ScanStatusPanel.vue';
import ProviderGrid from './sources/ProviderGrid.vue';

/** consistent-function-scoping: a no-op default that captures nothing, hoisted once
 *  rather than a fresh arrow allocated on every inject() call. */
const noop = (): void => {};

const store = useCityStore();
const runStore = useRunStore();
// W2: the host callbacks the UI already injects (NoSnapshot, NavColumn, AppToolbar); the
// host's own modals and consent chain do the work. Part 5 V6: onCancelScan calls the SAME
// CityView.cancelScan the 'cancel-scan' command calls.
const onSelectCodebase = inject<() => void>('onSelectCodebase', noop);
const onScanRequested = inject<() => void>('onScanRequested', noop);
const onCancelScan = inject<() => void>('onCancelScan', noop);

const model = computed(() => buildSourcesModel(store.snapshot, runStore.run));
const inFlight = computed(() => runStore.run.status === 'running' || runStore.run.status === 'cancelling');

/** W3 (A8, P14): scan states live on the city route, so go there before the host starts. */
function changeSource(): void {
  store.navigate('city');
  onSelectCodebase();
}
function rescan(): void {
  if (inFlight.value) return;
  store.navigate('city');
  onScanRequested();
}
/** Part 5 V6: guarded on the store itself (not the panel's props, which lag one render), so
 *  an aria-disabled press does nothing. Stays on this screen: the run line announces the
 *  outcome (role="status"). */
function cancelScan(): void {
  if (runStore.run.status !== 'running') return;
  onCancelScan();
}
function open(route: RouteId): void {
  store.navigate(route);
}
</script>

<template>
  <div class="ci-screen ci-screen--sources">
    <PageHeader
      :eyebrow="SOURCES_EYEBROW"
      :title="SOURCES_TITLE"
      :subtitle="SOURCES_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-sources__change"
          @click="changeSource"
        >
          <Icon name="folder" />
          {{ SOURCES_CHANGE }}
        </button>
        <button
          type="button"
          class="mod-cta ci-sources__rescan"
          :aria-disabled="inFlight ? 'true' : undefined"
          @click="rescan"
        >
          <Icon name="refresh-cw" />
          {{ SOURCES_RESCAN }}
        </button>
      </template>
    </PageHeader>
    <Callout :title="SOURCES_CALLOUT_TITLE">
      {{ SOURCES_CALLOUT }}
    </Callout>
    <div class="ci-screen__grid">
      <ScopePanel :rows="model.scope" />
      <ScanStatusPanel
        :run="model.run"
        @cancel="cancelScan"
      />
    </div>
    <ProviderGrid
      :providers="model.providers"
      @open="open"
    />
    <Panel :title="SOURCES_PLANNED_TITLE">
      <p class="ci-note">
        {{ SOURCES_PLANNED }}
      </p>
    </Panel>
  </div>
</template>
