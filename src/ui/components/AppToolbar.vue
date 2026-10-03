<!--
  Task 5 (F7): toolbar zone 1, lifted out of App.vue purely to keep App.vue under the
  400-line src/** budget (task-5-brief.md step 4) -- nothing about the toolbar's own
  behaviour differs from what used to be inline there. Owns FileSearch, the new Scan
  control (COPY_07, S05 zone 1's "Profile/search/scan toolbar" -- COPY_07 used to reach
  a user only from inside the scope modal it opens), the spatial/list mode toggle, and
  the narrow-layout Files drawer opener.

  The Files opener emits the raw MouseEvent rather than a bare notification, so
  App.vue's own `openFilesDrawer(event)` keeps reading `event.currentTarget` exactly as
  it always did when the button lived inline -- moving the button must not change whose
  element focus returns to when the drawer closes.

  Part 5 V6: and Cancel scan (COPY_09, the command's own name), right after Scan.
-->
<script setup lang="ts">
import { computed, inject } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useRunStore } from '../stores/run-store';
import { COPY_07, COPY_09 } from '../copy';
import { noop } from '../kit/noop';
import FileSearch from './FileSearch.vue';
import { useLensView } from '../read-models/use-lens-view';
import { LENS_IDS, useLensStore, type LensId } from '../stores/lens-store';
import { useUniqueId } from '../unique-id';
import { LENS_LABEL, LENS_OPTION_CATEGORY, LENS_OPTION_FINDINGS } from '../inspector-copy';

/** Part 6 Y40: the findings-lens control. Rendered only while the codebase ON SCREEN has
 *  evidence (`v-if`), so it is never a disabled control. E18: gated on useLensView's index,
 *  the one derivation the legend, heading, list column and renderer use, never on the raw
 *  evidence store, which can still hold the previous codebase's report mid-switch. The lens
 *  store resets itself to 'category' when the evidence goes away or the codebase changes. */
const { evidence } = useLensView();
const lensStore = useLensStore();
const lensSelectId = useUniqueId('ci-toolbar-lens');
const LENS_OPTION_LABELS: Readonly<Record<LensId, string>> = {
  category: LENS_OPTION_CATEGORY, findings: LENS_OPTION_FINDINGS,
};
const lens = computed<LensId>({
  get: () => lensStore.lens,
  set: (next) => { lensStore.setLens(next); },
});

defineEmits<{ 'open-files-drawer': [event: MouseEvent] }>();

const store = useCityStore();
const runStore = useRunStore();
// Provided at the app level in city-view.ts exactly like `onSelectCodebase`
// (`() => { void this.startScan(); }` -- the SAME method commands.ts's
// 'scan-codebase' palette entry calls) -- never a direct coordinator call. This
// component holds no reference to ScanCoordinator to call one with; the injected
// callback IS the consent-chain entry point (components emit intents; the
// application validates and performs work).
const onScanRequested = inject<() => void>('onScanRequested', noop);
// Part 5 V6: provided by city-scan-controller.ts's provideScanCallbacks, calling the SAME
// CityView.cancelScan the 'cancel-scan' command calls. Never a direct coordinator call.
const onCancelScan = inject<() => void>('onCancelScan', noop);
/** Only a RUNNING scan can be cancelled (a cancelling one already is). Read from runStore
 *  at press time, so the guard never lags a render. */
const cancellable = computed(() => runStore.run.status === 'running');
/** E40/E44/E50: the button stays focusable while blocked, so the handler refuses the press.
 *  Announces nothing itself (E17): AnnouncementRegion announces the run's real outcome. */
function cancelScan(): void {
  if (!cancellable.value) return;
  onCancelScan();
}
/** Part 6 Y3 (T29): Scan is blocked while a run is running or cancelling: aria-disabled plus
 *  this guarded handler, never native `disabled`, so a focused Scan keeps focus (E40/E44/E50).
 *  A refused press announces nothing (E17); the host's withScanGuard still refuses on its own. */
const scannable = computed(() => runStore.run.status !== 'running' && runStore.run.status !== 'cancelling');
function requestScan(): void {
  if (!scannable.value) return;
  onScanRequested();
}
</script>

<template>
  <div class="ci-app__toolbar">
    <FileSearch />
    <!-- Part 6 Y40: the findings lens. Only while this codebase has evidence (never a
         disabled control); the visible label is the select's accessible name. -->
    <span
      v-if="evidence.state !== 'none'"
      class="ci-toolbar__lens-field"
    >
      <label
        class="ci-toolbar__lens-label"
        :for="lensSelectId"
      >{{ LENS_LABEL }}</label>
      <select
        :id="lensSelectId"
        v-model="lens"
        class="dropdown ci-toolbar__lens"
      >
        <option
          v-for="id in LENS_IDS"
          :key="id"
          :value="id"
        >
          {{ LENS_OPTION_LABELS[id] }}
        </option>
      </select>
    </span>
    <!-- Unconditional, like every other toolbar control here -- Scan doubles as
         first-scan and refresh (spec 5), so it belongs regardless of whether a
         snapshot exists yet. Part 6 Y3: aria-disabled while a run is running or
         cancelling (runStore mirrors the real coordinator, spec 4.1), with the
         guarded handler above; the host guard (withScanGuard) still holds. -->
    <button
      type="button"
      class="ci-toolbar__scan"
      :aria-disabled="scannable ? undefined : 'true'"
      @click="requestScan"
    >
      {{ COPY_07 }}
    </button>
    <!-- Part 5 V6: always rendered, so a focused Cancel keeps focus when the run ends (the
         toolbar never unmounts); aria-disabled unless a run is running, with the guarded
         handler above. Pressing it does not navigate. -->
    <button
      type="button"
      class="ci-toolbar__cancel"
      :aria-disabled="cancellable ? undefined : 'true'"
      @click="cancelScan"
    >
      {{ COPY_09 }}
    </button>
    <!-- Task 9 fix round 1, item 3 (Important): list mode is the FALLBACK, not
         the default (spec 5.2), but must stay genuinely reachable both ways --
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
    <!-- Task 9 fix round 1, item 7: the Files drawer's OPENER -- only meaningful
         below 820px (styles.css hides it above that via the container query),
         but always in the DOM so it is reachable the moment the leaf narrows. -->
    <button
      type="button"
      aria-label="Files"
      class="ci-app__mode-toggle ci-app__drawer-opener"
      @click="$emit('open-files-drawer', $event)"
    >
      Files
    </button>
  </div>
</template>
