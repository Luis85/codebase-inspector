<script setup lang="ts">
import { computed } from 'vue';
import type { RunView } from '../../read-models/sources';
import {
  SOURCES_CANCEL_HINT, SOURCES_RUN_CANCELLED, SOURCES_RUN_CANCELLING, SOURCES_RUN_COMPLETE, SOURCES_RUN_FAILED, SOURCES_RUN_IDLE,
  SOURCES_RUN_RUNNING, SOURCES_STATUS_SUBTITLE, SOURCES_STATUS_TITLE,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Icon from '../../kit/Icon.vue';

const props = defineProps<{ run: RunView }>();

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
const inFlight = computed(() => props.run.kind === 'running' || props.run.kind === 'cancelling');
</script>

<template>
  <div class="ci-sources__status">
    <Panel
      :title="SOURCES_STATUS_TITLE"
      :subtitle="SOURCES_STATUS_SUBTITLE"
    >
      <p
        class="ci-sources__run"
        :class="`ci-sources__run--${view.tone}`"
      >
        <Icon :name="view.icon" />
        <span>
          {{ view.text }}
        </span>
      </p>
      <p
        v-if="inFlight"
        class="ci-note"
      >
        {{ SOURCES_CANCEL_HINT }}
      </p>
    </Panel>
  </div>
</template>
