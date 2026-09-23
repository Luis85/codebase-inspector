<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import type { RouteId } from '../../domain/route-ids';
import { buildSourcesModel } from '../read-models/sources';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { useEvidenceStore } from '../stores/evidence-store';
import { useRunStore } from '../stores/run-store';
import {
  FALLOW_REMOVE, FALLOW_REMOVE_CANCEL, FALLOW_REMOVE_TEXT, FALLOW_REMOVE_TITLE, FALLOW_REMOVED, SOURCES_CALLOUT,
  SOURCES_CALLOUT_TITLE, SOURCES_CHANGE, SOURCES_EYEBROW, SOURCES_PLANNED, SOURCES_PLANNED_TITLE, SOURCES_RESCAN,
  SOURCES_SUBTITLE, SOURCES_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Panel from '../kit/Panel.vue';
import Callout from '../kit/Callout.vue';
import CiDialog from '../kit/Dialog.vue';
import Icon from '../kit/Icon.vue';
import { noop } from '../kit/noop';
import { reannounce } from '../kit/reannounce';
import ScopePanel from './sources/ScopePanel.vue';
import ScanStatusPanel from './sources/ScanStatusPanel.vue';
import ProviderGrid from './sources/ProviderGrid.vue';
import FallowCardDetails from './sources/FallowCardDetails.vue';
import ConnectFallowDialog from './sources/ConnectFallowDialog.vue';

const store = useCityStore();
const runStore = useRunStore();
const evidenceStore = useEvidenceStore();
const { evidence } = useReadModels();
// W2: the host callbacks the UI already injects (NoSnapshot, NavColumn, AppToolbar); the
// host's own modals and consent chain do the work. Part 5 V6: onCancelScan calls the SAME
// CityView.cancelScan the 'cancel-scan' command calls.
const onSelectCodebase = inject<() => void>('onSelectCodebase', noop);
const onScanRequested = inject<() => void>('onScanRequested', noop);
const onCancelScan = inject<() => void>('onCancelScan', noop);
const root = ref<HTMLElement | null>(null);
const liveMessage = ref('');
/** Part 6 Y38 / Y31: the S14 dialog and the Remove confirmation. */
const connecting = ref(false);
const removing = ref(false);

const model = computed(() => buildSourcesModel(store.snapshot, runStore.run, {
  state: evidence.value.state, version: evidence.value.report?.providerVersion ?? null,
}));
const inFlight = computed(() => runStore.run.status === 'running' || runStore.run.status === 'cancelling');

/** Y39: the "Import analysis report" command and Not analysed's Import both land here with
 *  a request. It is consumed once, and the dialog opens a tick later, after the route change
 *  has placed focus (V7), so CiDialog returns focus into this screen. With no snapshot there
 *  is nothing to match a report against, so nothing opens. */
async function openRequested(): Promise<void> {
  await nextTick();
  if (store.snapshot) connecting.value = true;
}
watch(() => evidenceStore.importRequested, (requested) => {
  if (requested && evidenceStore.consumeImportRequest()) void openRequested();
}, { immediate: true });

/** Part 4 E8/E11: a codebase switch closes both dialogs. Nothing is attached or removed,
 *  and nothing is announced: the user did not act. */
watch(() => store.snapshot?.repositoryId, () => { connecting.value = false; removing.value = false; });

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
function openConnect(): void {
  if (store.snapshot) connecting.value = true;
}
/** CiDialog returns focus to its opener. A dialog opened by a request from another screen
 *  has no opener here, so focus lands on the card's Import button, never on <body>. */
async function closeConnect(): Promise<void> {
  connecting.value = false;
  await nextTick();
  const el = root.value;
  const active = el?.ownerDocument.activeElement;
  if (!el || (active && el.contains(active))) return;
  el.querySelector<HTMLElement>('.ci-fallow-card__import')?.focus();
}
/** Y38: the dialog closes, then this screen announces the real outcome (E17). */
function attached(message: string): void {
  void closeConnect();
  void reannounce(liveMessage, message);
}
/** Y31: only a removal that happened is announced (E17). */
function confirmRemove(): void {
  removing.value = false;
  if (evidenceStore.remove()) void reannounce(liveMessage, FALLOW_REMOVED);
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--sources"
  >
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
    <p
      class="visually-hidden ci-sources__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
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
    >
      <template #card-fallow>
        <FallowCardDetails
          :index="evidence"
          :has-snapshot="store.snapshot !== null"
          @import="openConnect"
          @remove="removing = true"
        />
      </template>
    </ProviderGrid>
    <Panel :title="SOURCES_PLANNED_TITLE">
      <p class="ci-note">
        {{ SOURCES_PLANNED }}
      </p>
    </Panel>
    <ConnectFallowDialog
      v-if="connecting"
      @close="closeConnect"
      @done="attached"
    />
    <CiDialog
      v-if="removing"
      :label="FALLOW_REMOVE_TITLE"
      @close="removing = false"
    >
      <div class="ci-fallow-remove">
        <h3>{{ FALLOW_REMOVE_TITLE }}</h3>
        <p>{{ FALLOW_REMOVE_TEXT }}</p>
        <div class="ci-fallow-remove__actions">
          <button
            type="button"
            class="ci-fallow-remove__cancel"
            @click="removing = false"
          >
            {{ FALLOW_REMOVE_CANCEL }}
          </button>
          <button
            type="button"
            class="mod-warning ci-fallow-remove__confirm"
            @click="confirmRemove"
          >
            {{ FALLOW_REMOVE }}
          </button>
        </div>
      </div>
    </CiDialog>
  </div>
</template>
