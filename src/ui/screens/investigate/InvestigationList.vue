<!--
  WP-04 IP18: the finding list follows CodebaseFileList.vue's model — native row buttons
  in a <ul>, one roving tab stop via useRovingIndex, arrows move focus and never select,
  Enter or click selects, aria-current on the selected row (never role="listbox"). Rows
  page by FINDINGS_PAGE (100) with Show more.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { InvestigationRow } from '../../read-models/investigation';
import { FINDINGS_PAGE, severityTone } from '../../read-models/findings';
import { useRovingIndex } from '../../kit/use-roving-index';
import { FINDING_KIND_LABEL, FINDING_LINE_TEXT, FINDING_STATUS_LABEL, SEVERITY_TEXT, SHOW_MORE } from '../../inspector-copy';
import { INVESTIGATE_LIST_LABEL, INVESTIGATE_NOTES_CHIP } from '../../audit-copy/investigation';

const props = defineProps<{ rows: readonly InvestigationRow[]; limit: number; selected: string | null }>();
const emit = defineEmits<{ select: [fingerprint: string]; more: [] }>();

const shownRows = computed(() => props.rows.slice(0, props.limit));
const list = ref<HTMLElement | null>(null);

const { active, onKeydown, setActive } = useRovingIndex({
  count: () => shownRows.value.length,
  selectedIndex: () => shownRows.value.findIndex((r) => r.fingerprint === props.selected),
  focusAt: (i) => list.value?.querySelectorAll<HTMLElement>('.ci-investigate-row')[i]?.focus(),
  activate: (i) => {
    const row = shownRows.value[i];
    if (row) emit('select', row.fingerprint);
  },
});

function onRow(i: number): void {
  setActive(i);
  const row = shownRows.value[i];
  if (row) emit('select', row.fingerprint);
}
</script>

<template>
  <div class="ci-investigate-list-wrap">
    <ul
      ref="list"
      class="ci-investigate-list"
      :aria-label="INVESTIGATE_LIST_LABEL"
      @keydown="onKeydown"
    >
      <li
        v-for="(row, i) in shownRows"
        :key="row.fingerprint"
      >
        <button
          type="button"
          class="ci-investigate-row"
          :class="{ 'ci-investigate-row--selected': row.fingerprint === selected }"
          :data-fingerprint="row.fingerprint"
          :tabindex="i === active ? 0 : -1"
          :aria-current="row.fingerprint === selected ? 'true' : undefined"
          @click="onRow(i)"
        >
          <span
            class="ci-severity"
            :class="`ci-severity--${severityTone(row.severity)}`"
          >{{ SEVERITY_TEXT(row.severity) }}</span>
          <span class="ci-investigate-row__kind">{{ FINDING_KIND_LABEL[row.kind] }}</span>
          <span class="ci-investigate-row__title">{{ row.title }}</span>
          <span class="ci-investigate-row__location">{{ row.anchorPath }} · {{ FINDING_LINE_TEXT(row.line, row.endLine) }}</span>
          <span
            class="ci-chip"
            :class="`ci-chip--status-${row.status}`"
          >{{ FINDING_STATUS_LABEL[row.status] }}</span>
          <span
            v-if="row.notes.length > 0"
            class="ci-investigate-row__notes"
          >{{ INVESTIGATE_NOTES_CHIP(row.notes.length) }}</span>
        </button>
      </li>
    </ul>
    <div
      v-if="rows.length > limit"
      class="ci-investigate-list__footer"
    >
      <button
        type="button"
        class="ci-investigate-list__more"
        @click="emit('more')"
      >
        {{ SHOW_MORE(Math.min(FINDINGS_PAGE, rows.length - limit)) }}
      </button>
    </div>
  </div>
</template>
