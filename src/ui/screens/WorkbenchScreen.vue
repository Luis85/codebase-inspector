<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { MARKDOWN_MIME, useCsvExport } from '../export/use-csv-export';
import type { FileSummary } from '../read-models/file-summaries';
import { useReadModels } from '../read-models/use-read-models';
import { rootFolderLabel } from '../read-models/root-label';
import { buildWorkbenchModel, filesById, planMarkdown } from '../read-models/work-items';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { useUniqueId } from '../unique-id';
import {
  NO_CODEBASE_LABEL, WORKBENCH_EMPTY, WORKBENCH_EMPTY_TITLE, WORKBENCH_EXPORT, WORKBENCH_EYEBROW, WORKBENCH_FILTER,
  WORKBENCH_FILTER_LABEL, WORKBENCH_FOOTNOTE, WORKBENCH_MD_FILENAME, WORKBENCH_NEW, WORKBENCH_NEW_FOR, WORKBENCH_NEW_HINT,
  WORKBENCH_NO_MATCH, WORKBENCH_SUBTITLE, WORKBENCH_TITLE, WORKBENCH_VIEW_BOARD, WORKBENCH_VIEW_LABEL, WORKBENCH_VIEW_LIST,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Icon from '../kit/Icon.vue';
import WorkBoard from './workbench/WorkBoard.vue';
import WorkList from './workbench/WorkList.vue';
import WorkItemEditor from './workbench/WorkItemEditor.vue';

const store = useCityStore();
const review = useReviewStore();
const { files } = useReadModels();
const root = ref<HTMLElement | null>(null);
const liveMessage = ref('');
const query = ref('');
const view = ref<'board' | 'list'>('board');
const editing = ref<string | null>(null);
/** Fix round 1 (Important): pinned at the moment "New work item" is pressed, rather than
 *  read live off `selectedEntityId`. Without this, a selection change while the create
 *  editor is open (the selection disappears, or the palette selects a non-file) would
 *  either leave `creating` stuck true with nothing to edit (a later file selection then
 *  pops a blank editor) or silently retarget the save away from the file the title still
 *  names. */
const creatingFor = ref<FileSummary | null>(null);
const hintId = useUniqueId('ci-workbench-new-hint');

const model = computed(() => buildWorkbenchModel(review.workItems, files.value, query.value));
/** W11: New work item plans work for the selected FILE only. */
const selectedFile = computed(() => (store.selectedEntityId ? filesById(files.value).get(store.selectedEntityId) ?? null : null));
const editorOpen = computed(() => editing.value !== null || creatingFor.value !== null);
const sourceLabel = computed(() => (store.snapshot ? rootFolderLabel(store.snapshot.scope.rootPath) : NO_CODEBASE_LABEL));
const exportText = useCsvExport(root, liveMessage);

function exportPlan(): void {
  exportText(WORKBENCH_MD_FILENAME, () => planMarkdown(model.value.rows, sourceLabel.value), MARKDOWN_MIME);
}
function openNew(): void {
  if (!selectedFile.value) return;
  creatingFor.value = selectedFile.value;
}
/** CiDialog returns focus to its opener when it still exists; a deleted card is gone, so
 *  focus lands on the filter instead of the shell (Part 2 F7 pattern).
 *  E17-style repeat: liveMessage is cleared THEN set after a tick, so a second, identical
 *  outcome (e.g. "wi-1 updated." twice) is announced again rather than kept as unchanged text. */
async function closeEditor(message?: string): Promise<void> {
  editing.value = null;
  creatingFor.value = null;
  if (message) {
    liveMessage.value = '';
    await nextTick();
    liveMessage.value = message;
  }
  await nextTick();
  const el = root.value;
  const active = el?.ownerDocument.activeElement;
  if (el && !(active && el.contains(active))) el.querySelector<HTMLElement>('.ci-workbench__filter')?.focus();
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--workbench"
  >
    <PageHeader
      :eyebrow="WORKBENCH_EYEBROW"
      :title="WORKBENCH_TITLE"
      :subtitle="WORKBENCH_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-workbench__export"
          :disabled="model.rows.length === 0"
          @click="exportPlan"
        >
          <Icon name="download" />
          {{ WORKBENCH_EXPORT }}
        </button>
        <button
          type="button"
          class="mod-cta ci-workbench__new"
          :aria-disabled="selectedFile ? undefined : 'true'"
          :aria-describedby="hintId"
          @click="openNew"
        >
          <Icon name="plus" />
          {{ WORKBENCH_NEW }}
        </button>
      </template>
    </PageHeader>
    <p
      :id="hintId"
      class="ci-note ci-workbench__new-hint"
    >
      {{ selectedFile ? WORKBENCH_NEW_FOR(selectedFile.name) : WORKBENCH_NEW_HINT }}
    </p>
    <p
      class="visually-hidden ci-workbench__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <div class="ci-screen__cards">
      <MetricCard
        v-for="c in model.cards"
        :key="c.id"
        :label="c.label"
        :icon="c.icon"
        :value="c.value"
        :caption="c.caption"
        :tone="c.tone"
      />
    </div>
    <div class="ci-workbench__toolbar">
      <input
        v-model="query"
        type="search"
        class="ci-workbench__filter"
        :placeholder="WORKBENCH_FILTER"
        :aria-label="WORKBENCH_FILTER_LABEL"
      >
      <div
        class="ci-workbench__views"
        role="group"
        :aria-label="WORKBENCH_VIEW_LABEL"
      >
        <button
          type="button"
          class="ci-workbench__view ci-workbench__view--board"
          :aria-pressed="view === 'board'"
          @click="view = 'board'"
        >
          {{ WORKBENCH_VIEW_BOARD }}
        </button>
        <button
          type="button"
          class="ci-workbench__view ci-workbench__view--list"
          :aria-pressed="view === 'list'"
          @click="view = 'list'"
        >
          {{ WORKBENCH_VIEW_LIST }}
        </button>
      </div>
    </div>
    <div
      v-if="model.total === 0"
      class="ci-empty ci-workbench__empty"
    >
      <p class="ci-empty__title">
        {{ WORKBENCH_EMPTY_TITLE }}
      </p>
      <p>{{ WORKBENCH_EMPTY }}</p>
    </div>
    <p
      v-else-if="model.rows.length === 0"
      class="ci-note ci-workbench__no-match"
    >
      {{ WORKBENCH_NO_MATCH }}
    </p>
    <WorkBoard
      v-else-if="view === 'board'"
      :columns="model.columns"
      @open="editing = $event"
    />
    <WorkList
      v-else
      :rows="model.rows"
      @open="editing = $event"
    />
    <p class="ci-note">
      {{ WORKBENCH_FOOTNOTE }}
    </p>
    <WorkItemEditor
      v-if="editorOpen"
      :item-id="editing"
      :new-file="editing === null ? creatingFor : null"
      @close="closeEditor()"
      @done="closeEditor($event)"
    />
  </div>
</template>
