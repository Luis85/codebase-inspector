<script setup lang="ts">
import { computed, inject, nextTick, ref, shallowRef, watch } from 'vue';
import type { RouteId } from '../../domain/route-ids';
import { buildSourcesModel } from '../read-models/sources';
import { useReadModels } from '../read-models/use-read-models';
import type { InstalledRouteStart } from '../read-models/fallow-run';
import { useCityStore } from '../stores/city-store';
import { useEvidenceStore } from '../stores/evidence-store';
import { useRunStore } from '../stores/run-store';
import { useAnalysisStore } from '../stores/analysis-store';
import {
  FALLOW_REMOVED, SOURCES_CALLOUT, SOURCES_CALLOUT_TITLE, SOURCES_CHANGE, SOURCES_EYEBROW, SOURCES_RESCAN,
  SOURCES_SUBTITLE, SOURCES_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Callout from '../kit/Callout.vue';
import Icon from '../kit/Icon.vue';
import { noop } from '../kit/noop';
import { reannounce } from '../kit/reannounce';
import ScopePanel from './sources/ScopePanel.vue';
import ScanStatusPanel from './sources/ScanStatusPanel.vue';
import ProviderGrid from './sources/ProviderGrid.vue';
import FallowCardDetails from './sources/FallowCardDetails.vue';
import ConnectFallowDialog from './sources/ConnectFallowDialog.vue';
import FallowRemoveDialog from './sources/FallowRemoveDialog.vue';
import { useFallowRun } from './sources/use-fallow-run';

const store = useCityStore();
const runStore = useRunStore();
const evidenceStore = useEvidenceStore();
const { evidence, relations } = useReadModels();
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
/** Part 7 Z29/Z32: the dialog's first route, and the installed route's starting point. Each
 *  opening gets a new key, so a request that lands while the dialog is open (the command)
 *  replaces it with the newer request's route instead of being lost (as M3's rule). */
const connectRoute = ref<'choose' | 'installed'>('choose');
const installedStart = shallowRef<InstalledRouteStart | undefined>(undefined);
const connectKey = ref(0);
const analysisStore = useAnalysisStore();

const model = computed(() => buildSourcesModel(store.snapshot, runStore.run, {
  state: evidence.value.state, version: evidence.value.report?.providerVersion ?? null,
  origin: evidence.value.report?.collected === undefined ? 'imported' : 'collected',
}, relations.value));
const inFlight = computed(() => runStore.run.status === 'running' || runStore.run.status === 'cancelling');

/** Y39: the "Import analysis report" command and Not analysed's Import both land here with
 *  a request. It is consumed once, and the dialog opens a tick later, after the route change
 *  has placed focus (V7), so CiDialog returns focus into this screen. With no snapshot there
 *  is nothing to match a report against, so nothing opens. */
async function openRequested(): Promise<void> {
  await nextTick();
  if (store.snapshot) startConnect();
}
/** Polish C10 (L23, amended in the 3a review): while the dialog's step is in flight, a newer
 *  request waits, the newest one winning. It is applied once the step settles cleanly, and
 *  dropped if the step ended with a refusal (E13: the outcome is never lost), closed the
 *  dialog, or the codebase changed. A remount mid-step would discard the step. The dialog
 *  reports its busy action synchronously, so plain variables suffice. */
let dialogBusy = false;
let deferred: (() => void) | null = null;
function whenDialogIdle(apply: () => void): void {
  if (connecting.value && dialogBusy) { deferred = apply; return; }
  apply();
}
function onDialogBusy(now: boolean, failed: boolean): void {
  dialogBusy = now;
  const next = deferred;
  if (now || next === null) return;
  deferred = null;
  if (!failed && connecting.value) next();
}
watch(connecting, (shown) => { if (!shown) { dialogBusy = false; deferred = null; } }, { flush: 'sync' });
/** Fix round 1 (M3): the dialogs never stack. The newer request wins and closes the Remove
 *  confirmation (removing nothing), then S14 opens. */
function startConnect(): void {
  whenDialogIdle(() => {
    removing.value = false;
    connectRoute.value = 'choose';
    installedStart.value = undefined;
    connectKey.value += 1;
    connecting.value = true;
  });
}
/** Part 7 Z32/Z35: the installed route, at its path step or its review. */
function openInstalled(start: InstalledRouteStart): void {
  whenDialogIdle(() => {
    removing.value = false;
    connectRoute.value = 'installed';
    installedStart.value = start;
    connectKey.value += 1;
    connecting.value = true;
  });
}
const { refusal: runRefusal, failure: runFailure, run: runAnalysis, cancel: cancelAnalysis, forget: forgetExecutable } =
  useFallowRun(openInstalled, (message) => { void reannounce(liveMessage, message); });
function chooseExecutable(): void {
  if (store.snapshot && !analysisStore.active) openInstalled({ startAt: 'path' });
}
/** Polish C4: a run the command started, with no dialog opened, leaves focus on the run's own
 *  button (Cancel analysis), never on a control the run has just blocked (Import). */
async function runFromCommand(): Promise<void> {
  await runAnalysis();
  if (connecting.value) return;
  await nextTick();
  root.value?.querySelector<HTMLElement>('.ci-fallow-run__cancel, .ci-fallow-run__run')?.focus();
}
/** Z35: the `run-fallow-analysis` command lands here with a request, consumed once. */
watch(() => analysisStore.runRequested, (requested) => {
  if (requested && analysisStore.consumeRunRequest()) void nextTick().then(runFromCommand);
}, { immediate: true });
watch(() => evidenceStore.importRequested, (requested) => {
  if (requested && evidenceStore.consumeImportRequest()) void openRequested();
}, { immediate: true });

/** Part 4 E8/E11: a codebase switch closes both dialogs. Nothing is attached or removed,
 *  and nothing is announced: the user did not act. */
watch(() => store.snapshot?.repositoryId, () => { connecting.value = false; removing.value = false; deferred = null; });

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
  if (store.snapshot) startConnect();
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
  // Part 7 Z29: a started run announces nothing here; its end is announced once (use-fallow-run.ts).
  if (message !== '') void reannounce(liveMessage, message);
}
/** Fix round 1 (M2): the codebase the Remove confirmation was opened for. */
let removeFor = '';
function openRemove(): void {
  removeFor = evidenceStore.repositoryId;
  removing.value = true;
}
/** Y31: only a removal that happened is announced (E17). M2: a confirmation that outlived a
 *  codebase switch (the click can land before the switch watcher runs) removes nothing. */
function confirmRemove(): void {
  removing.value = false;
  if (removeFor === '' || evidenceStore.repositoryId !== removeFor || store.snapshot?.repositoryId !== removeFor) return;
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
          :refusal="runRefusal"
          :failure="runFailure"
          @import="openConnect"
          @remove="openRemove"
          @run="runAnalysis"
          @cancel="cancelAnalysis"
          @choose="chooseExecutable"
          @forget="forgetExecutable"
        />
      </template>
    </ProviderGrid>
    <ConnectFallowDialog
      v-if="connecting"
      :key="connectKey"
      :initial-route="connectRoute"
      :installed="installedStart"
      @close="closeConnect"
      @done="attached"
      @busy="onDialogBusy"
    />
    <FallowRemoveDialog
      v-if="removing"
      @close="removing = false"
      @confirm="confirmRemove"
    />
  </div>
</template>
