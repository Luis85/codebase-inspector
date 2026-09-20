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
-->
<script setup lang="ts">
import { inject } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useRunStore } from '../stores/run-store';
import { COPY_07 } from '../copy';
import FileSearch from './FileSearch.vue';

defineEmits<{ 'open-files-drawer': [event: MouseEvent] }>();

const store = useCityStore();
const runStore = useRunStore();
// Provided at the app level in city-view.ts exactly like `onSelectCodebase`
// (`() => { void this.startScan(); }` -- the SAME method commands.ts's
// 'scan-codebase' palette entry calls) -- never a direct coordinator call. This
// component holds no reference to ScanCoordinator to call one with; the injected
// callback IS the consent-chain entry point (components emit intents; the
// application validates and performs work).
const onScanRequested = inject<() => void>('onScanRequested', () => {});
</script>

<template>
  <div class="ci-app__toolbar">
    <FileSearch />
    <!-- Unconditional, like every other toolbar control here -- Scan doubles as
         first-scan and refresh (spec 5), so it belongs regardless of whether a
         snapshot exists yet. Disabled while a run is already in flight (runStore
         mirrors the real coordinator, spec 4.1) so the toolbar itself does not
         invite a second concurrent click; the host guard (withScanGuard) still
         holds even if it did. -->
    <button
      type="button"
      class="ci-toolbar__scan"
      :disabled="runStore.run.status === 'running'"
      @click="onScanRequested"
    >
      {{ COPY_07 }}
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
