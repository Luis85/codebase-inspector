<!--
  C10 — the file inspector drawer. Shows the RAW measured values (source-unit lines
  and bytes), never the sqrt-scaled scene height layout.ts computed for the same
  file — that scaling exists only to keep the city's skyline readable, and this
  drawer's whole job is to say what is actually true about the file. Offers Focus,
  Copy relative path, (Part 2) Investigate file and (WP-02) Add to refactor plan —
  the last records intent in the review store and never touches the source.

  Closing PRESERVES the selection — only `cityStore.clearSelection()` (never called
  from here) drops it.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { reviewFailureText } from '../read-models/review-failure';
import { useCityRendererHandle } from '../renderer-handle';
import { useInspectorOpener } from '../drawer-focus';
import { useClipboard } from '../clipboard';
import { COPY_27, formatSnapshotScopeRoot, formatUnavailableReason } from '../copy';
import {
  ADD_TO_PLAN_FAILED, ADD_TO_PLAN_LABEL, IN_PLAN_LABEL, INVESTIGATE_FILE_LABEL, WORK_ITEM_TITLE,
} from '../inspector-copy';
import type { Observation } from '../../domain/model';
import CityRelationsPanel from '../screens/city/CityRelationsPanel.vue';

const store = useCityStore();
const review = useReviewStore();
const renderer = useCityRendererHandle();
const inspectorOpener = useInspectorOpener();
const clipboard = useClipboard();

const liveMessage = ref('');
const copyFailed = ref(false);

const selectedEntity = computed(() => (
  store.snapshot?.entities.find((e) => e.id === store.selectedEntityId) ?? null
));

const inPlan = computed(() => (store.selectedEntityId ? review.hasWorkItemFor(store.selectedEntityId) : false));
/** Fix round 2 (Important): the button is disabled while the save is in flight too,
 *  not only once it has settled — otherwise a double-click could fire `addToPlan`
 *  twice before the store's own guard has anything to refuse against. */
const addPending = computed(() => (store.selectedEntityId ? review.isPendingFor(store.selectedEntityId) : false));

/** WP-02: records intent only. Never edits, opens or executes anything in the source.
 *  Fix round 1 (Important): the review store now awaits the repository before
 *  committing local state, so a rejecting repository leaves `inPlan` false rather
 *  than the UI claiming an item was saved that never was — caught here the same way
 *  `copyRelativePath` handles its own port failure, surfaced through the same
 *  polite live region. */
async function addToPlan(): Promise<void> {
  const entity = selectedEntity.value;
  if (!entity) return;
  try {
    await review.addWorkItemForFile(entity.id, WORK_ITEM_TITLE(entity.name), new Date());
  } catch (e) {
    liveMessage.value = reviewFailureText(e, ADD_TO_PLAN_FAILED);
  }
}

function observationFor(metricId: 'physical-lines' | 'byte-size'): Observation | null {
  const entityId = store.selectedEntityId;
  if (!entityId || !store.snapshot) return null;
  return store.snapshot.observations.find(
    (o) => o.entityId === entityId && o.measurement.metricId === metricId,
  ) ?? null;
}

const linesObs = computed(() => observationFor('physical-lines'));
const bytesObs = computed(() => observationFor('byte-size'));

/** Task 9 (F12, C10: "Keep exact raw values and scope"): a line count with no scope
 *  is a number whose denominator the user cannot check. Redacted to a basename, the
 *  same way SnapshotStatus.vue's own scope line is (interactions/04-microcopy.md:
 *  "redact local absolute paths by default") — reusing that formatter rather than a
 *  second copy of the redaction rule, so the two surfaces cannot disagree about what
 *  counts as safe to show. */
const scopeText = computed(() => (
  store.snapshot ? formatSnapshotScopeRoot(store.snapshot.scope.rootPath) : ''
));

function focusSelection(): void {
  if (store.selectedEntityId) renderer.value?.focus(store.selectedEntityId);
}

/** Task 9 fix round 1, item 7: returns focus to whatever opened the inspector
 *  (the row button, via drawer-focus.ts's shared handle) — the brief's own
 *  "a visible close that returns focus to its opener". Closing still preserves
 *  the selection — never `clearSelection()`. */
function close(): void {
  store.closeInspector();
  inspectorOpener.value?.focus();
}

async function copyRelativePath(): Promise<void> {
  const path = selectedEntity.value?.path;
  if (!path) return;
  try {
    await clipboard.writeText(path);
    copyFailed.value = false;
    liveMessage.value = COPY_27;
  } catch {
    copyFailed.value = true;
    liveMessage.value = '';
  }
}
</script>

<template>
  <aside
    v-if="store.inspectorOpen && selectedEntity"
    class="ci-inspector"
    aria-label="File inspector"
  >
    <div class="ci-inspector__header">
      <h3 class="ci-inspector__title">
        {{ selectedEntity.name }}
      </h3>
      <button
        type="button"
        aria-label="Close"
        class="ci-inspector__close"
        @click="close"
      >
        ×
      </button>
    </div>
    <!-- Task 9 (F12, C10, foundations/04): the FULL relative path, wrapped rather
         than ellipsised (foundations/04: "Do not expose crucial content only in an
         ellipsis tooltip" — the title above stays the short basename for the
         header's own layout, this is the whole path as real, selectable,
         accessible text). The existing "Copy relative path" action below is kept
         alongside it — foundations/04 asks for wrapping AND a copy action, not one
         or the other. -->
    <p class="ci-inspector__path">
      {{ selectedEntity.path }}
    </p>
    <!-- C10: "Keep exact raw values and scope." Names the scope the measurements
         below were taken in, so the raw counts have a denominator a reader can
         check. -->
    <p class="ci-inspector__scope">
      {{ scopeText }}
    </p>
    <dl class="ci-inspector__measurements">
      <dt>Physical lines</dt>
      <dd v-if="linesObs?.status === 'measured'">
        {{ linesObs.value }} lines
      </dd>
      <dd v-else>
        {{ formatUnavailableReason(linesObs?.reason ?? 'Not available.') }}
      </dd>
      <dt>Byte size</dt>
      <dd v-if="bytesObs?.status === 'measured'">
        {{ bytesObs.value }} bytes
      </dd>
      <dd v-else>
        {{ formatUnavailableReason(bytesObs?.reason ?? 'Not available.') }}
      </dd>
    </dl>
    <div class="ci-inspector__actions">
      <button
        type="button"
        aria-label="Focus"
        @click="focusSelection"
      >
        Focus
      </button>
      <button
        type="button"
        aria-label="Copy relative path"
        @click="copyRelativePath"
      >
        Copy relative path
      </button>
      <button
        type="button"
        class="ci-inspector__investigate"
        @click="store.navigate('file')"
      >
        {{ INVESTIGATE_FILE_LABEL }}
      </button>
      <button
        type="button"
        class="ci-inspector__plan-button"
        :aria-label="inPlan ? IN_PLAN_LABEL : ADD_TO_PLAN_LABEL"
        :disabled="inPlan || addPending"
        @click="addToPlan"
      >
        {{ inPlan ? IN_PLAN_LABEL : ADD_TO_PLAN_LABEL }}
      </button>
    </div>
    <label
      v-if="copyFailed"
      class="ci-inspector__fallback"
    >
      Select and copy manually:
      <input
        type="text"
        readonly
        :value="selectedEntity.path"
        aria-label="Relative path"
        @focus="($event.target as HTMLInputElement).select()"
      >
    </label>
    <!-- WP-03 N30: the file's evidenced relations and the arcs they draw. -->
    <CityRelationsPanel v-if="selectedEntity.kind === 'file'" />
    <p
      aria-live="polite"
      class="ci-inspector__live"
    >
      {{ liveMessage }}
    </p>
  </aside>
</template>
