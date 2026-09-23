<script setup lang="ts">
// Part 7 Z30/Z31: the S14 installed-analyzer route, inside the Connect fallow dialog. A path,
// then the review of exactly what will run, then "Trust and run". Checking a path only
// INSPECTS it (a stat and 4 bytes); nothing runs before "Trust and run", and the version
// probe happens only after it. It shares the dialog's busy action (K32), so Cancel, Escape
// and the backdrop stay ignored while a check or a start is in flight (Part 4 E13), and its
// refusals land in the dialog's one role="alert". It never assigns to that action: clearing
// the alert is the dialog's (`clear-error`, PF13). The codebase is checked again around each
// async step (Part 6 E36); a late answer after a switch is dropped, and the route closes
// once the step has settled (PF17a: while busy, the dialog ignores a close).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { CodebaseSnapshot } from '../../../domain/model';
import { useCityStore } from '../../stores/city-store';
import { useAnalysisStore } from '../../stores/analysis-store';
import { useUniqueId } from '../../unique-id';
import type { BusyAction } from '../../kit/use-busy-action';
import { reannounce } from '../../kit/reannounce';
import type { InstalledRouteStart, ReviewResult, RunReview } from '../../read-models/fallow-run';
import {
  FALLOW_CANCEL, FALLOW_CHANGE_PATH, FALLOW_EXE_CHECK, FALLOW_EXE_HINT_POSIX, FALLOW_EXE_HINT_WINDOWS, FALLOW_EXE_LABEL,
  FALLOW_EXE_REFUSED, FALLOW_INSTALL_NOTE, FALLOW_REVIEW_RETRUST, FALLOW_REVIEW_TITLE_RUN, FALLOW_ROUTE_RUN_TITLE,
  FALLOW_RUN_BUSY_HINT, FALLOW_RUN_ERROR, FALLOW_RUN_START_FAILED, FALLOW_TRUST_AND_RUN,
} from '../../inspector-copy';
import FallowRunReview from './FallowRunReview.vue';

const props = defineProps<{ start?: InstalledRouteStart; action: BusyAction }>();
const emit = defineEmits<{ close: []; started: []; 'clear-error': [] }>();
const city = useCityStore();
const analysis = useAnalysisStore();
const pathId = useUniqueId('ci-fallow-exe-path');
const hintId = useUniqueId('ci-fallow-exe-hint');
/** Part 6 E36: the codebase this route was opened for. */
const repositoryId = city.snapshot?.repositoryId ?? '';
const step = ref<'path' | 'review'>('path');
const path = ref('');
const review = shallowRef<RunReview | null>(null);
const retrust = ref(false);
const heading = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
/** fallow.exe unless the service says `fallow` (Polish C1: from the service, not the binding
 *  read), for the path hint and the review's Environment row. */
const windows = computed(() => analysis.executableName !== 'fallow');
const hint = computed(() => (windows.value ? FALLOW_EXE_HINT_WINDOWS : FALLOW_EXE_HINT_POSIX));
let disposed = false;
onBeforeUnmount(() => { disposed = true; });

const bound = (): boolean =>
  repositoryId !== '' && city.snapshot?.repositoryId === repositoryId && analysis.repositoryId === repositoryId;
function drop(): void {
  if (!disposed) emit('close');
}
const refuse = (message: string): Promise<void> => reannounce(props.action.error, message);
/** PF17(c): on the path step a missing file is "no file at that path", not "no longer there". */
function refusalText(result: Extract<ReviewResult, { ok: false }>): string {
  return result.code === 'executable-missing' ? FALLOW_EXE_REFUSED['executable-missing']('') : FALLOW_RUN_ERROR[result.code](result.detail);
}
async function focusOn(target: 'heading' | 'input'): Promise<void> {
  await nextTick();
  if (!disposed) (target === 'heading' ? heading.value : input.value)?.focus();
}
async function showReview(next: RunReview, changed: boolean): Promise<void> {
  review.value = next;
  retrust.value = changed;
  path.value = next.facts.executablePath;
  step.value = 'review';
  await focusOn('heading');
}
function toPathStep(): void {
  step.value = 'path';
  review.value = null;
  void focusOn('input');
}

/** One step under the dialog's busy action; a codebase switch closes the route after it settles.
 *  A rejection lands in the alert and never escapes. Inspection never rejects (every stat or
 *  read error comes back as a refusal, shown as FALLOW_EXE_REFUSED, `unreadable` with its
 *  code included), so a rejection here is the store's data.json read or write: the file is
 *  not blamed, and the start-failure text says nothing ran (PF17b as amended in review). */
async function busyStep(body: () => Promise<void>): Promise<void> {
  if (props.action.busy.value) return;
  if (!bound()) { drop(); return; }
  let switched = false;
  await props.action.run(async () => {
    try {
      await body();
    } catch {
      if (bound()) { await refuse(FALLOW_RUN_START_FAILED); return; }
    }
    switched = !bound();
  }, FALLOW_RUN_START_FAILED);
  if (switched) drop();
}

/** Inspection only: nothing runs and nothing is stored. */
function check(): Promise<void> {
  const snapshot = city.snapshot;
  if (!snapshot) { drop(); return Promise.resolve(); }
  return busyStep(async () => {
    const result = await analysis.review(snapshot, path.value);
    if (!bound() || result === null) return;
    if (!result.ok) { await refuse(refusalText(result)); return; }
    await showReview(result.review, false);
  });
}

/** Z30: `changed-since-review` goes back to a fresh review, saying why. */
async function reviewAgain(snapshot: CodebaseSnapshot, executablePath: string): Promise<void> {
  const result = await analysis.review(snapshot, executablePath);
  if (!bound() || result === null) return;
  if (!result.ok) { toPathStep(); await refuse(refusalText(result)); return; }
  await showReview(result.review, true);
  await refuse(FALLOW_RUN_ERROR['changed-since-review'](''));
}

function trustAndRun(): Promise<void> {
  const snapshot = city.snapshot;
  const reviewed = review.value;
  if (reviewed === null) return Promise.resolve();
  if (!snapshot) { drop(); return Promise.resolve(); }
  return busyStep(async () => {
    const outcome = await analysis.trustAndRun(snapshot, reviewed);
    if (!bound() || outcome === null) return;
    if (outcome.kind === 'started') { emit('started'); return; }
    if (outcome.kind === 'busy') { await refuse(FALLOW_RUN_BUSY_HINT); return; }
    if (outcome.kind !== 'refused') return;
    if (outcome.code === 'changed-since-review') { await reviewAgain(snapshot, reviewed.facts.executablePath); return; }
    await refuse(FALLOW_RUN_ERROR[outcome.code](outcome.detail));
  });
}

function changePath(): void {
  if (props.action.busy.value) return;
  emit('clear-error');
  toPathStep();
}

function cancel(): void {
  if (props.action.busy.value) return;
  emit('close');
}

onMounted(() => {
  const binding = analysis.binding;
  if (binding?.kind === 'bound') path.value = binding.binding.executablePath;
  const start = props.start;
  if (start?.startAt === 'review') { void showReview(start.review, start.reason === 'changed'); return; }
  if (start?.startAt === 'path' || binding?.kind !== 'bound') { void focusOn('heading'); return; }
  void check();
});
</script>

<template>
  <div class="ci-fallow-installed">
    <template v-if="step === 'path' || review === null">
      <h3
        ref="heading"
        tabindex="-1"
      >
        {{ FALLOW_ROUTE_RUN_TITLE }}
      </h3>
      <label
        :for="pathId"
        class="ci-fallow-installed__label"
      >{{ FALLOW_EXE_LABEL }}</label>
      <input
        :id="pathId"
        ref="input"
        v-model="path"
        type="text"
        class="ci-fallow-installed__path"
        spellcheck="false"
        autocomplete="off"
        :aria-describedby="hintId"
        @keydown.enter.prevent="check"
      >
      <p
        :id="hintId"
        class="ci-note"
      >
        {{ hint }} {{ FALLOW_INSTALL_NOTE }}
      </p>
    </template>
    <template v-else>
      <h3
        ref="heading"
        tabindex="-1"
      >
        {{ FALLOW_REVIEW_TITLE_RUN }}
      </h3>
      <p
        v-if="retrust"
        class="ci-fallow-installed__retrust"
      >
        {{ FALLOW_REVIEW_RETRUST }}
      </p>
      <FallowRunReview
        :review="review"
        :windows="windows"
      />
    </template>
    <div class="ci-connect-fallow__actions">
      <button
        type="button"
        class="ci-connect-fallow__cancel"
        :aria-disabled="action.busy.value ? 'true' : undefined"
        @click="cancel"
      >
        {{ FALLOW_CANCEL }}
      </button>
      <button
        v-if="step === 'review' && review !== null"
        type="button"
        class="ci-fallow-installed__change"
        :aria-disabled="action.busy.value ? 'true' : undefined"
        @click="changePath"
      >
        {{ FALLOW_CHANGE_PATH }}
      </button>
      <button
        v-if="step === 'path' || review === null"
        type="button"
        class="mod-cta ci-fallow-installed__check"
        :aria-disabled="action.busy.value ? 'true' : undefined"
        @click="check"
      >
        {{ FALLOW_EXE_CHECK }}
      </button>
      <button
        v-else
        type="button"
        class="mod-cta ci-fallow-installed__trust"
        :aria-disabled="action.busy.value ? 'true' : undefined"
        @click="trustAndRun"
      >
        {{ FALLOW_TRUST_AND_RUN }}
      </button>
    </div>
  </div>
</template>
