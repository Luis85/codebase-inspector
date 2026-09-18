<!--
  The polite/assertive screen-reader announcement region (spec 5.2). POLITE for
  stage transitions, completion, cancellation and control-initiated selection;
  ASSERTIVE ONLY for a blocking failure (a failed scan) — never for hover, which
  this component does not subscribe to at all (that stays inside task 10's renderer
  territory; CityRendererEvent's 'hover-changed' reaches nothing in src/ui/** this
  task). Progress announcements throttle to at most one per ~100 ms (the same
  window scan-coordinator.ts already throttles PROGRESS dispatch to — ruling M50 —
  so this is a second, independent throttle on how OFTEN this region re-announces
  the same rapidly changing count, not a relaxation of that rule) and never expose
  `aria-valuenow`: WP-01's running state carries a count, never a total to divide by.
-->
<script setup lang="ts">
import { inject, ref, watch } from 'vue';
import { useRunStore } from '../stores/run-store';
import { useCityStore } from '../stores/city-store';
import { ANNOUNCE_SCAN_COMPLETE, formatAnnounceSelected, formatCopy08 } from '../copy';

const THROTTLE_MS = 100;

const runStore = useRunStore();
const cityStore = useCityStore();
const now = inject<() => number>('announceNow', () => Date.now());

const politeMessage = ref('');
const assertiveMessage = ref('');
let lastProgressAnnouncedAt: number | null = null;

function announcePolite(message: string): void { politeMessage.value = message; }
function announceAssertive(message: string): void { assertiveMessage.value = message; }

function announceProgress(processedFiles: number): void {
  const nowMs = now();
  if (lastProgressAnnouncedAt !== null && nowMs - lastProgressAnnouncedAt < THROTTLE_MS) return;
  lastProgressAnnouncedAt = nowMs;
  announcePolite(formatCopy08(processedFiles));
}

// Default ('pre') flush, deliberately NOT 'sync': `runStore.setLifecycle` assigns
// `run` and `banner` as two separate statements, so a synchronously-flushed watch
// on `run` alone would fire BETWEEN them and read the previous `banner`. The
// default flush batches until the microtask queue drains, by which point the whole
// action has finished — a real timing defect this avoided, not a style choice.
watch(() => runStore.run, (run) => {
  if (run.status === 'running') announceProgress(run.processedFiles);
  else if (run.status === 'complete') announcePolite(ANNOUNCE_SCAN_COMPLETE);
  else if (run.status === 'cancelled') announcePolite(runStore.banner ?? 'Scan cancelled.');
  else if (run.status === 'failed') announceAssertive(runStore.banner ?? 'Scan failed.');
}, { deep: true });

watch(() => cityStore.selectedEntityId, (entityId) => {
  if (!entityId) return;
  const entity = cityStore.snapshot?.entities.find((e) => e.id === entityId);
  if (entity) announcePolite(formatAnnounceSelected(entity.name));
});

defineExpose({ announceProgress, announcePolite, announceAssertive, politeMessage, assertiveMessage });
</script>

<template>
  <div class="ci-announce visually-hidden">
    <p
      aria-live="polite"
      role="status"
    >
      {{ politeMessage }}
    </p>
    <p
      aria-live="assertive"
      role="alert"
    >
      {{ assertiveMessage }}
    </p>
    <div
      v-if="runStore.run.status === 'running'"
      role="progressbar"
      aria-label="Scan progress"
      :aria-valuetext="`${runStore.run.processedFiles} files read so far`"
    />
  </div>
</template>
