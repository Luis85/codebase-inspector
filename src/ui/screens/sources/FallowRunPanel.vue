<script setup lang="ts">
// Part 7 Z32/Z33: the run half of the fallow card: the C16 banner, the executable, its trust
// and its time limit, and Run / Cancel analysis / Choose or Change executable… / Forget
// executable. The panel reports presses; SourcesScreen (use-fallow-run.ts) acts on them.
// Blocked controls stay focusable (aria-disabled plus a guarded handler, E40).
// An unread or unreadable binding (the store's `null`) reads as "No executable chosen": there
// is no spinner to hang, and Run still asks the service, which reads the record itself.
import { computed, nextTick, ref, watch } from 'vue';
import { useAnalysisStore } from '../../stores/analysis-store';
import { useUniqueId } from '../../unique-id';
import {
  FALLOW_TESTED_VERSIONS, fallowRunBannerOf, refusalBanner, type FallowRunBanner as Banner, type FallowRunErrorCode,
} from '../../read-models/fallow-run';
import {
  FALLOW_EXE_CHANGE, FALLOW_EXE_CHOOSE, FALLOW_EXE_FORGET, FALLOW_EXE_INVALID, FALLOW_EXE_NONE, FALLOW_EXE_OTHER_DEVICE,
  FALLOW_EXE_UNSUPPORTED, FALLOW_LIMIT_VALUE, FALLOW_ROW_EXECUTABLE, FALLOW_ROW_LIMIT, FALLOW_ROW_TRUST, FALLOW_RUN_ACTION,
  FALLOW_RUN_CANCEL, FALLOW_RUN_HINT, FALLOW_TRUST_VALUE,
} from '../../inspector-copy';
import FallowRunBanner from './FallowRunBanner.vue';

const props = defineProps<{
  hasSnapshot: boolean; hasEvidence: boolean; busyHintId: string;
  /** The current report carries `staleReason: 'failed-run'` (the banner's "kept", final review). */
  evidenceMarkedFailed: boolean;
  refusal: { code: FallowRunErrorCode; detail: string } | null;
  /** A Run or a Forget that threw (use-fallow-run.ts); '' when there is none. */
  failure: string;
}>();
const emit = defineEmits<{ run: []; cancel: []; choose: []; forget: [] }>();
const analysis = useAnalysisStore();
const runHintId = useUniqueId('ci-fallow-run-hint');

const banner = computed((): Banner | null => {
  if (!analysis.active && props.failure !== '') {
    return { tone: 'warning', icon: 'alert-triangle', text: props.failure, reason: null, kept: false, log: null };
  }
  return props.refusal !== null && !analysis.active
    ? refusalBanner(props.refusal.code, props.refusal.detail)
    : fallowRunBannerOf(analysis.run, props.hasEvidence, props.evidenceMarkedFailed);
});
const bound = computed(() => (analysis.binding?.kind === 'bound' ? analysis.binding.binding : null));
const executableText = computed(() => {
  const read = analysis.binding;
  if (read === null || read.kind === 'none') return FALLOW_EXE_NONE;
  if (read.kind === 'other-machine') return FALLOW_EXE_OTHER_DEVICE;
  if (read.kind === 'invalid') return FALLOW_EXE_INVALID;
  if (read.kind === 'unsupported') return FALLOW_EXE_UNSUPPORTED;
  return read.binding.executablePath;
});
const trustText = computed(() => {
  const b = bound.value;
  if (b === null) return null;
  const version = b.trust?.version ?? null;
  return FALLOW_TRUST_VALUE(version, version !== null && FALLOW_TESTED_VERSIONS.includes(version));
});
const canForget = computed(() => analysis.binding !== null && analysis.binding.kind !== 'none' && analysis.binding.kind !== 'unsupported');
const forgetButton = ref<HTMLButtonElement | null>(null);
const chooseButton = ref<HTMLButtonElement | null>(null);
/** Final review: a Forget that succeeds unmounts the focused Forget button. This watcher runs
 *  before that render (flush 'pre'), sees the focus still on it, and moves it to "Choose
 *  executable…", which stays mounted, instead of letting it fall to <body>. */
watch(canForget, async (now) => {
  const el = forgetButton.value;
  if (now || el === null || el.ownerDocument.activeElement !== el) return;
  await nextTick();
  chooseButton.value?.focus();
});
const chooseBlocked = computed(() => analysis.active || !props.hasSnapshot);
/** E40: ONE element for Run and Cancel analysis, so the focus stays on it when the run starts,
 *  ends or goes to cancelling under it (two v-if branches would swap in a new <button>).
 *  While cancelling it stays Cancel analysis, blocked (aria-disabled plus the guard below). */
const primary = computed(() => {
  if (analysis.active) {
    const blocked = !analysis.cancellable;
    return { label: FALLOW_RUN_CANCEL, className: 'ci-fallow-run__cancel', blocked, describedBy: blocked ? props.busyHintId : undefined };
  }
  const blocked = !props.hasSnapshot;
  return { label: FALLOW_RUN_ACTION, className: 'mod-cta ci-fallow-run__run', blocked, describedBy: blocked ? runHintId : undefined };
});

function pressPrimary(): void {
  if (analysis.cancellable) { emit('cancel'); return; }
  if (!props.hasSnapshot || analysis.active) return;
  emit('run');
}
function choose(): void {
  if (chooseBlocked.value) return;
  emit('choose');
}
function forget(): void {
  if (analysis.active) return;
  emit('forget');
}
</script>

<template>
  <div class="ci-fallow-run">
    <FallowRunBanner
      v-if="banner"
      :banner="banner"
    />
    <dl class="ci-fallow-run__facts">
      <dt>{{ FALLOW_ROW_EXECUTABLE }}</dt>
      <dd>
        <code v-if="bound">{{ executableText }}</code>
        <template v-else>
          {{ executableText }}
        </template>
      </dd>
      <template v-if="trustText">
        <dt>{{ FALLOW_ROW_TRUST }}</dt>
        <dd>{{ trustText }}</dd>
      </template>
      <template v-if="bound">
        <dt>{{ FALLOW_ROW_LIMIT }}</dt>
        <dd>{{ FALLOW_LIMIT_VALUE(bound.timeoutSeconds) }}</dd>
      </template>
    </dl>
    <p
      v-if="!hasSnapshot"
      :id="runHintId"
      class="ci-note ci-fallow-run__hint"
    >
      {{ FALLOW_RUN_HINT }}
    </p>
    <div class="ci-fallow-run__actions">
      <button
        type="button"
        :class="primary.className"
        :aria-disabled="primary.blocked ? 'true' : undefined"
        :aria-describedby="primary.describedBy"
        @click="pressPrimary"
      >
        {{ primary.label }}
      </button>
      <button
        ref="chooseButton"
        type="button"
        class="ci-fallow-run__choose"
        :aria-disabled="chooseBlocked ? 'true' : undefined"
        :aria-describedby="!hasSnapshot ? runHintId : analysis.active ? busyHintId : undefined"
        @click="choose"
      >
        {{ bound ? FALLOW_EXE_CHANGE : FALLOW_EXE_CHOOSE }}
      </button>
      <button
        v-if="canForget"
        ref="forgetButton"
        type="button"
        class="ci-fallow-run__forget"
        :aria-disabled="analysis.active ? 'true' : undefined"
        :aria-describedby="analysis.active ? busyHintId : undefined"
        @click="forget"
      >
        {{ FALLOW_EXE_FORGET }}
      </button>
    </div>
  </div>
</template>
