<!--
  WP-04 IN7-IN13 (IP14, IP16, IP17, IPF6): a bounded, read-only window onto the selected
  finding's anchor file, the stale-location callout, Reload and Open in Obsidian. Every
  line is rendered by interpolation only, inside one <pre> — never v-html, a highlighter or
  a link (IN8). Reads themselves happen only in the store (IP39/IN13); this panel only
  shows the state the screen already read and emits `reload`/`openInObsidian` for the
  screen to act on.

  IPF6: each `.ci-source-preview__line` span ends with a literal "\n" inside the span, no
  `display: block`, and no text node between tags — so the whole <pre> block is written on
  one source line with no incidental whitespace (a `<pre>` keeps source whitespace verbatim,
  unlike every other element). The line number is a separate aria-hidden span nested first,
  so the pre's own textContent, split on "\n", is each line's number immediately followed
  by its (possibly cut) text — the reported line also gets aria-current="true", and its
  PREVIEW_LINE_LABEL is a visually hidden line under the window, never inside the <pre>.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { LocationVerdict } from '../../../application/investigation/stale-location';
import type { PreviewState } from '../../stores/investigation-store';
import type { InvestigationRow } from '../../read-models/investigation';
import { formatAbsoluteTime } from '../../copy';
import {
  PREVIEW_CUT, PREVIEW_LINE_LABEL, PREVIEW_LOADING, PREVIEW_OPEN_IN_OBSIDIAN, PREVIEW_READ_AT, PREVIEW_RELOAD,
  PREVIEW_STALE_LOCATION, PREVIEW_SUBTITLE, PREVIEW_TITLE, PREVIEW_UNAVAILABLE,
} from '../../audit-copy/investigation';
import Panel from '../../kit/Panel.vue';
import Callout from '../../kit/Callout.vue';

const props = defineProps<{ row: InvestigationRow; state: PreviewState; verdict: LocationVerdict | null; notePath: string | null }>();
const emit = defineEmits<{ reload: []; openInObsidian: [] }>();

// IN13/E40: idle (not yet asked for) and loading are both "busy" for Reload's own guard —
// there is no row-selected state this panel renders in that is neither of those nor ready.
const loading = computed(() => props.state.status !== 'ready');
const text = computed(() => (props.state.status === 'ready' && props.state.result.status === 'ok' ? props.state.result.text : null));
const unavailableReason = computed(() => (props.state.status === 'ready' && props.state.result.status === 'unavailable' ? props.state.result.reason : null));
const readAtText = computed(() => (text.value === null ? null : PREVIEW_READ_AT(formatAbsoluteTime(text.value.readAt, Intl))));
const highlightLine = computed(() => (props.verdict !== null && props.verdict.exact ? props.verdict.line : null));
const staleText = computed(() => {
  const v = props.verdict;
  if (v === null || v.exact) return null;
  return PREVIEW_STALE_LOCATION(v.failed, 'cause' in v ? v.cause : null, props.row.line);
});

function guardedReload(): void {
  if (!loading.value) emit('reload');
}
</script>

<template>
  <Panel
    :title="PREVIEW_TITLE"
    :subtitle="PREVIEW_SUBTITLE"
  >
    <template #actions>
      <div class="ci-source-preview__actions">
        <button
          type="button"
          class="ci-source-preview__reload"
          :aria-disabled="loading ? 'true' : undefined"
          @click="guardedReload"
        >
          {{ PREVIEW_RELOAD }}
        </button>
        <button
          v-if="notePath"
          type="button"
          class="ci-source-preview__open-obsidian"
          @click="emit('openInObsidian')"
        >
          {{ PREVIEW_OPEN_IN_OBSIDIAN }}
        </button>
      </div>
    </template>
    <p
      v-if="readAtText"
      class="ci-source-preview__read-at"
    >
      {{ readAtText }}
    </p>
    <p
      v-if="loading"
      class="ci-note ci-source-preview__loading"
    >
      {{ PREVIEW_LOADING }}
    </p>
    <p
      v-else-if="unavailableReason"
      class="ci-note ci-source-preview__unavailable"
    >
      {{ PREVIEW_UNAVAILABLE[unavailableReason] }}
    </p>
    <template v-else-if="text">
      <Callout
        v-if="staleText"
        tone="warning"
        :title="staleText"
      />
      <pre class="ci-source-preview__text"><span
        v-for="line in text.lines"
        :key="line.number"
        class="ci-source-preview__line"
        :aria-current="line.number === highlightLine ? 'true' : undefined"
      ><span
        class="ci-source-preview__number"
        aria-hidden="true"
      >{{ line.number }}</span>{{ line.text }}{{ line.cut ? PREVIEW_CUT : '' }}{{ '\n' }}</span></pre>
      <p
        v-if="highlightLine !== null"
        class="visually-hidden ci-source-preview__line-label"
      >
        {{ PREVIEW_LINE_LABEL(highlightLine) }}
      </p>
    </template>
  </Panel>
</template>
