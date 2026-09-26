<!--
  WP-04 IN7-IN13 (IP14, IP16, IP17, IPF6): a bounded, read-only window onto the selected
  finding's anchor file, the stale-location callout, Reload and Open in Obsidian. Every
  line is rendered by interpolation only, inside one <pre> — never v-html, a highlighter or
  a link (IN8). Reads themselves happen only in the store (IP39/IN13); this panel only
  shows the state the screen already read and emits `reload`/`openInObsidian` for the
  screen to act on. Fix round 1 (review): `verdict` alone is not enough to say a line is
  IN the window — ruling E19 means a fingerprint can keep the SAME window after a re-run
  moves the finding's line, so `highlightLine` is gated on the number actually being one of
  `text.lines`, never assumed.

  IPF6: each `.ci-source-preview__line` span ends with a literal "\n" inside the span, no
  `display: block`, and no text node between tags — so the whole <pre> block is written on
  one source line with no incidental whitespace (a `<pre>` keeps source whitespace verbatim,
  unlike every other element). The line number is a separate aria-hidden span nested first,
  so the pre's own textContent, split on "\n", is each line's number immediately followed
  by its (possibly cut) text — the reported line also gets aria-current="true"; its
  PREVIEW_LINE_LABEL is a visually hidden paragraph BEFORE the <pre> (fix round 1, Minor 6),
  linked to it by aria-describedby, never inside the <pre> itself.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { LocationVerdict } from '../../../application/investigation/stale-location';
import type { PreviewState } from '../../stores/investigation-store';
import type { InvestigationRow } from '../../read-models/investigation';
import { formatAbsoluteTime } from '../../copy';
import { useUniqueId } from '../../unique-id';
import {
  PREVIEW_CUT, PREVIEW_FILE_EMPTY, PREVIEW_LINE_LABEL, PREVIEW_LOADING, PREVIEW_OPEN_FAILED, PREVIEW_OPEN_IN_OBSIDIAN,
  PREVIEW_READ_AT, PREVIEW_READ_FOR_LINE, PREVIEW_RELOAD, PREVIEW_STALE_LOCATION, PREVIEW_SUBTITLE, PREVIEW_TITLE, PREVIEW_UNAVAILABLE,
} from '../../audit-copy/investigation';
import Panel from '../../kit/Panel.vue';
import Callout from '../../kit/Callout.vue';

const props = defineProps<{
  row: InvestigationRow; state: PreviewState; verdict: LocationVerdict | null; notePath: string | null;
  /** Fix round 1 (review Important 2, E40): the SCREEN owns the async open, and hands this
   *  panel only the busy flag and the last result, so the button's own guard is synchronous. */
  opening: boolean; openFailed: boolean;
}>();
const emit = defineEmits<{ reload: []; openInObsidian: [] }>();

const lineLabelId = useUniqueId('ci-source-preview-line-label');

// Fix round 1 (review Minor 7): only an actual read in flight is "busy" — idle (not yet
// asked for) shows nothing and leaves Reload enabled, since there is no read to guard.
const busy = computed(() => props.state.status === 'loading');
const text = computed(() => (props.state.status === 'ready' && props.state.result.status === 'ok' ? props.state.result.text : null));
const unavailableReason = computed(() => (props.state.status === 'ready' && props.state.result.status === 'unavailable' ? props.state.result.reason : null));
const readAtText = computed(() => (text.value === null ? null : PREVIEW_READ_AT(formatAbsoluteTime(text.value.readAt, Intl))));
/** Fix round 1 (review Important 1, E19): exact alone is not enough — the window may be
 *  the OLD one, read for a line this fingerprint no longer reports (a re-run can move a
 *  finding's line without changing its fingerprint). The number must actually be in the
 *  window that was read. */
const highlightLine = computed(() => {
  const v = props.verdict;
  const t = text.value;
  if (v === null || !v.exact || t === null) return null;
  return t.lines.some((line) => line.number === v.line) ? v.line : null;
});
// Polish (E19): the request this window was read for (state.line) can differ from the
// row's CURRENT reported line after a re-run moves it — IN13 keeps the old window and
// never re-reads on its own, so without this the panel would show it with no explanation.
// Null-safe: only shown once both lines are actually known and they disagree.
const readForOtherLine = computed(() => {
  const s = props.state;
  if (s.status !== 'ready' || s.line === null || props.row.line === null || s.line === props.row.line) return null;
  return s.line;
});
const staleText = computed(() => {
  const v = props.verdict;
  if (v === null || v.exact) return null;
  // Fix round 1 (review Minor 11): "the first 41 lines are shown" is a claim about a
  // window that, over an empty file, does not exist.
  if (v.failed === 'no-line' && text.value !== null && text.value.lineCount === 0) return PREVIEW_FILE_EMPTY;
  return PREVIEW_STALE_LOCATION(v.failed, 'cause' in v ? v.cause : null, props.row.line);
});

function guardedReload(): void {
  if (!busy.value) emit('reload');
}
function guardedOpen(): void {
  if (!props.opening) emit('openInObsidian');
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
          :aria-disabled="busy ? 'true' : undefined"
          @click="guardedReload"
        >
          {{ PREVIEW_RELOAD }}
        </button>
        <button
          v-if="notePath"
          type="button"
          class="ci-source-preview__open-obsidian"
          :aria-disabled="opening ? 'true' : undefined"
          @click="guardedOpen"
        >
          {{ PREVIEW_OPEN_IN_OBSIDIAN }}
        </button>
      </div>
    </template>
    <p
      v-if="openFailed"
      class="ci-source-preview__open-error"
      role="alert"
    >
      {{ PREVIEW_OPEN_FAILED }}
    </p>
    <p
      v-if="readAtText"
      class="ci-source-preview__read-at"
    >
      {{ readAtText }}
    </p>
    <p
      v-if="readForOtherLine !== null"
      class="ci-note ci-source-preview__line-moved"
    >
      {{ PREVIEW_READ_FOR_LINE(readForOtherLine) }}
    </p>
    <p
      v-if="busy"
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
        class="ci-source-preview__stale"
      />
      <p
        v-if="highlightLine !== null"
        :id="lineLabelId"
        class="visually-hidden ci-source-preview__line-label"
      >
        {{ PREVIEW_LINE_LABEL(highlightLine) }}
      </p>
      <pre
        class="ci-source-preview__text"
        tabindex="0"
        :aria-label="PREVIEW_TITLE"
        :aria-describedby="highlightLine !== null ? lineLabelId : undefined"
      ><span
        v-for="line in text.lines"
        :key="line.number"
        class="ci-source-preview__line"
        :aria-current="line.number === highlightLine ? 'true' : undefined"
      ><span
        class="ci-source-preview__number"
        aria-hidden="true"
      >{{ line.number }}</span>{{ line.text }}{{ line.cut ? PREVIEW_CUT : '' }}{{ '\n' }}</span></pre>
    </template>
  </Panel>
</template>
