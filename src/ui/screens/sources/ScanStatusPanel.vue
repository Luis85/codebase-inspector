<script setup lang="ts">
import { computed } from 'vue';
import type { RunView } from '../../read-models/sources';
import {
  SOURCES_RUN_CANCELLED, SOURCES_RUN_CANCELLING, SOURCES_RUN_COMPLETE, SOURCES_RUN_FAILED, SOURCES_RUN_IDLE,
  SOURCES_RUN_RUNNING, SOURCES_STATUS_SUBTITLE, SOURCES_STATUS_TITLE,
} from '../../inspector-copy';
import { COPY_09 } from '../../copy';
import Panel from '../../kit/Panel.vue';
import Icon from '../../kit/Icon.vue';

const props = defineProps<{ run: RunView }>();
/** Part 5 V6: the screen owns the host callback and the guard; this only reports the press. */
defineEmits<{ cancel: [] }>();

/** W3: the real run state, mirrored from the host; nothing here is simulated. */
const view = computed<{ icon: string; text: string; tone: 'muted' | 'warning' | 'success' }>(() => {
  const r = props.run;
  switch (r.kind) {
    case 'running': return { icon: 'loader', text: SOURCES_RUN_RUNNING(r.processed), tone: 'muted' };
    case 'cancelling': return { icon: 'loader', text: SOURCES_RUN_CANCELLING, tone: 'muted' };
    case 'cancelled': return { icon: 'circle-slash', text: SOURCES_RUN_CANCELLED, tone: 'warning' };
    case 'failed': return { icon: 'alert-triangle', text: SOURCES_RUN_FAILED(r.message), tone: 'warning' };
    case 'complete': return { icon: 'check', text: SOURCES_RUN_COMPLETE, tone: 'success' };
    default: return { icon: 'clock', text: SOURCES_RUN_IDLE, tone: 'muted' };
  }
});
/** V6: only a RUNNING scan can be cancelled (a cancelling one already is). */
const cancellable = computed(() => props.run.kind === 'running');
</script>

<template>
  <div class="ci-sources__status">
    <Panel
      :title="SOURCES_STATUS_TITLE"
      :subtitle="SOURCES_STATUS_SUBTITLE"
    >
      <!-- Part 5 V6: a status region, so "cancelling" and "cancelled" are announced here. -->
      <p
        class="ci-sources__run"
        :class="`ci-sources__run--${view.tone}`"
        role="status"
      >
        <Icon :name="view.icon" />
        <span>
          {{ view.text }}
        </span>
      </p>
      <!-- Part 5 V6: replaces the command-palette hint. Always rendered; aria-disabled unless
           a run is running (E40/E44/E50), and SourcesScreen's handler refuses the press then
           too. It announces nothing itself (E17) and does not navigate. -->
      <button
        type="button"
        class="ci-sources__cancel"
        :aria-disabled="cancellable ? undefined : 'true'"
        @click="$emit('cancel')"
      >
        {{ COPY_09 }}
      </button>
    </Panel>
  </div>
</template>
