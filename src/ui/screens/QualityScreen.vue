<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { useCsvExport } from '../export/use-csv-export';
import {
  DEFAULT_QUALITY_FILTER, FINDINGS_PAGE, filterFindings, findingsCsv, type QualityFilter, type QualityFinding,
} from '../read-models/findings';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import {
  QUALITY_CSV_FILENAME, QUALITY_EXPORT, QUALITY_EYEBROW, QUALITY_FOOTNOTE, QUALITY_SUBTITLE,
  QUALITY_TABLE_TITLE, QUALITY_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import Icon from '../kit/Icon.vue';
import NoSnapshot from './NoSnapshot.vue';
import FindingFilters from './quality/FindingFilters.vue';
import FindingsTable from './quality/FindingsTable.vue';
import FindingReviewDialog from './quality/FindingReviewDialog.vue';

const store = useCityStore();
const { quality } = useReadModels();
const filter = ref<QualityFilter>({ ...DEFAULT_QUALITY_FILTER });
const shown = ref(FINDINGS_PAGE);
const reviewing = ref<string | null>(null);
const openedIndex = ref(0);
const liveMessage = ref('');
const root = ref<HTMLElement | null>(null);
const exportText = useCsvExport(root, liveMessage);

const rows = computed(() => filterFindings(quality.value.findings, filter.value));
watch(filter, () => { shown.value = FINDINGS_PAGE; });
/** Hotspots F3: a rescan or snapshot switch can drop the filtered module; fall back to all. */
watch(() => quality.value.modules, (modules) => {
  const module = filter.value.module;
  if (module !== null && !modules.some((m) => m.name === module)) filter.value = { ...filter.value, module: null };
});

/** Fix round 1: a rescan can drop the finding under review. Forget it, so the dialog
 *  cannot come back on its own when a later snapshot brings the fingerprint back. */
watch(() => reviewing.value !== null && !quality.value.byFingerprint.has(reviewing.value), (gone) => {
  if (gone) reviewing.value = null;
});

function resetFilters(): void {
  filter.value = { ...DEFAULT_QUALITY_FILTER };
}

/** Remembers which row's Review button opened the dialog, so closing can land near it (closeReview). */
function open(finding: QualityFinding): void {
  const el = root.value;
  const active = el?.ownerDocument.activeElement ?? null;
  const buttons = el ? [...el.querySelectorAll<HTMLElement>('.ci-findings-table__open')] : [];
  const at = active ? buttons.findIndex((b) => b === active) : -1;
  openedIndex.value = at < 0 ? 0 : at;
  reviewing.value = finding.fingerprint;
}

/** The row that opened the dialog may have left the filtered list (an Open finding that
 *  was just acknowledged). CiDialog restores focus to it when it is still there;
 *  otherwise land on the Review button now at the same place, the last one, or the panel —
 *  never the body (Part 2 F7 pattern). */
async function closeReview(): Promise<void> {
  reviewing.value = null;
  await nextTick();
  const el = root.value;
  const active = el?.ownerDocument.activeElement;
  if (!el || (active && el.contains(active))) return;   // CiDialog already restored focus inside the screen
  const buttons = [...el.querySelectorAll<HTMLElement>('.ci-findings-table__open')];
  (buttons[Math.min(openedIndex.value, buttons.length - 1)]
    ?? el.querySelector<HTMLElement>('.ci-findings-table__reset')
    ?? el.querySelector<HTMLElement>('.ci-quality__panel'))?.focus();
}

/** Selection goes through the ONE owner and never moves the camera. */
function openFile(id: EntityId): void {
  reviewing.value = null;
  store.select(id);
  store.navigate('file');
}

/** Every filtered finding, handed to the user through this leaf's own document. */
function exportCsv(): void { exportText(QUALITY_CSV_FILENAME, () => findingsCsv(rows.value, quality.value.evidence)); }
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--quality"
  >
    <PageHeader
      :eyebrow="QUALITY_EYEBROW"
      :title="QUALITY_TITLE"
      :subtitle="QUALITY_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-quality__export"
          :disabled="rows.length === 0"
          @click="exportCsv"
        >
          <Icon name="download" />
          {{ QUALITY_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <p
      class="visually-hidden ci-quality__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else>
      <div class="ci-screen__cards">
        <MetricCard
          v-for="card in quality.cards"
          :key="card.id"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :caption="card.caption"
          :tone="card.tone"
        />
      </div>
      <section
        class="ci-quality__panel"
        tabindex="-1"
      >
        <Panel :title="QUALITY_TABLE_TITLE">
          <FindingFilters
            v-model:filter="filter"
            :modules="quality.modules"
            @reset="resetFilters"
          />
          <FindingsTable
            :rows="rows"
            :limit="shown"
            @open="open"
            @more="shown += FINDINGS_PAGE"
            @reset="resetFilters"
          />
        </Panel>
      </section>
      <p class="ci-note">
        {{ QUALITY_FOOTNOTE }}
      </p>
    </template>
    <FindingReviewDialog
      v-if="reviewing"
      :fingerprint="reviewing"
      @close="closeReview"
      @open-file="openFile"
    />
  </div>
</template>
