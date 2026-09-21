<script setup lang="ts">
// Part 3 Q9: compares two snapshots from this session's journal. Every value here is
// collected from the inventory, so nothing carries a sample badge. Opens from Evolution,
// Overview and City.
import { computed, ref } from 'vue';
import { formatMetric, hasValue } from '../../evidence';
import { compareSnapshots, type JournalEntry } from '../../read-models/snapshot-comparison';
import { dateLabels } from '../../read-models/overview';
import { useCityStore } from '../../stores/city-store';
import { useSnapshotJournal } from '../../stores/snapshot-journal';
import { useUniqueId } from '../../unique-id';
import {
  COMPARE_ADDED, COMPARE_BASE_LABEL, COMPARE_CLOSE, COMPARE_COL_AFTER, COMPARE_COL_BEFORE, COMPARE_COL_CHANGE,
  COMPARE_COL_MODULE, COMPARE_COL_SIGNAL, COMPARE_ENTRY, COMPARE_FILES, COMPARE_LINES, COMPARE_MODULES_CAPTION,
  COMPARE_MODULES_NONE, COMPARE_NEEDS_TWO, COMPARE_REMOVED, COMPARE_SUBTITLE, COMPARE_TITLE, NO_VALUE, SIGNED,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';

const props = defineProps<{ initialBaseId?: string }>();
const emit = defineEmits<{ close: [] }>();

const store = useCityStore();
const journal = useSnapshotJournal();
const selectId = useUniqueId('ci-compare-base');

const at = computed(() => journal.entries.findIndex((e) => e.snapshotId === store.snapshot?.snapshotId));
const current = computed<JournalEntry | undefined>(() => (at.value >= 0 ? journal.entries[at.value] : undefined));
/** The entries before the current one, newest first (a loop: `toReversed` is past ES2020). */
const earlier = computed(() => {
  const out: JournalEntry[] = [];
  for (let i = at.value - 1; i >= 0; i -= 1) out.push(journal.entries[i]!);
  return out;
});

const baseId = ref(props.initialBaseId ?? earlier.value[0]?.snapshotId ?? '');
const comparison = computed(() => {
  const base = earlier.value.find((e) => e.snapshotId === baseId.value);
  return base && current.value ? compareSnapshots(base, current.value) : null;
});
const changedModules = computed(() => comparison.value?.modules.filter((m) => m.changed) ?? []);
const linesChange = computed(() => {
  const d = comparison.value?.linesDelta;
  return d && hasValue(d) ? SIGNED(d.value) : NO_VALUE;
});

const dateLabel = (entry: JournalEntry): string => dateLabels(entry.capturedAt, 1, 0)[0] ?? '';
</script>

<template>
  <CiDialog
    :label="COMPARE_TITLE"
    @close="emit('close')"
  >
    <div class="ci-compare-dialog">
      <h3 class="ci-compare-dialog__title">
        {{ COMPARE_TITLE }}
      </h3>
      <p class="ci-compare-dialog__subtitle">
        {{ COMPARE_SUBTITLE }}
      </p>
      <p
        v-if="earlier.length === 0"
        class="ci-hotspots__note"
      >
        {{ COMPARE_NEEDS_TWO }}
      </p>
      <template v-else>
        <label
          class="visually-hidden"
          :for="selectId"
        >{{ COMPARE_BASE_LABEL }}</label>
        <select
          :id="selectId"
          v-model="baseId"
          class="dropdown ci-compare-dialog__base"
        >
          <option
            v-for="e in earlier"
            :key="e.snapshotId"
            :value="e.snapshotId"
          >
            {{ COMPARE_ENTRY(dateLabel(e), e.snapshotId) }}
          </option>
        </select>
      </template>
      <template v-if="comparison">
        <table class="ci-table ci-compare-dialog__summary">
          <thead>
            <tr>
              <th scope="col">
                {{ COMPARE_COL_SIGNAL }}
              </th>
              <th
                scope="col"
                class="ci-table__num"
              >
                {{ COMPARE_COL_BEFORE }}
              </th>
              <th
                scope="col"
                class="ci-table__num"
              >
                {{ COMPARE_COL_AFTER }}
              </th>
              <th
                scope="col"
                class="ci-table__num"
              >
                {{ COMPARE_COL_CHANGE }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                {{ COMPARE_FILES }}
              </th>
              <td class="ci-table__num">
                {{ comparison.base.files.toLocaleString('en-US') }}
              </td>
              <td class="ci-table__num">
                {{ comparison.current.files.toLocaleString('en-US') }}
              </td>
              <td class="ci-table__num">
                {{ SIGNED(comparison.filesDelta) }}
              </td>
            </tr>
            <tr>
              <th scope="row">
                {{ COMPARE_LINES }}
              </th>
              <td class="ci-table__num">
                {{ formatMetric(comparison.base.lines) }}
              </td>
              <td class="ci-table__num">
                {{ formatMetric(comparison.current.lines) }}
              </td>
              <td class="ci-table__num">
                {{ linesChange }}
              </td>
            </tr>
            <tr>
              <th scope="row">
                {{ COMPARE_ADDED }}
              </th>
              <td />
              <td />
              <td class="ci-table__num ci-compare-dialog__added">
                {{ comparison.added.toLocaleString('en-US') }}
              </td>
            </tr>
            <tr>
              <th scope="row">
                {{ COMPARE_REMOVED }}
              </th>
              <td />
              <td />
              <td class="ci-table__num ci-compare-dialog__removed">
                {{ comparison.removed.toLocaleString('en-US') }}
              </td>
            </tr>
          </tbody>
        </table>
        <table
          v-if="changedModules.length > 0"
          class="ci-table ci-compare-dialog__modules"
        >
          <caption class="ci-compare-dialog__caption">
            {{ COMPARE_MODULES_CAPTION }}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                {{ COMPARE_COL_MODULE }}
              </th>
              <th
                scope="col"
                class="ci-table__num"
              >
                {{ COMPARE_FILES }}
              </th>
              <th
                scope="col"
                class="ci-table__num"
              >
                {{ COMPARE_LINES }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in changedModules"
              :key="m.module"
              class="ci-compare-dialog__module"
            >
              <th scope="row">
                {{ m.label }}
              </th>
              <td class="ci-table__num">
                {{ m.filesBefore }} → {{ m.filesAfter }}
              </td>
              <!-- E33: a module absent on one side has unknown lines, shown as "—", never 0. -->
              <td class="ci-table__num ci-compare-dialog__lines">
                {{ formatMetric(m.linesBefore) }} → {{ formatMetric(m.linesAfter) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-else
          class="ci-hotspots__note"
        >
          {{ COMPARE_MODULES_NONE }}
        </p>
      </template>
      <div class="ci-compare-dialog__actions">
        <button
          type="button"
          class="ci-compare-dialog__close"
          @click="emit('close')"
        >
          {{ COMPARE_CLOSE }}
        </button>
      </div>
    </div>
  </CiDialog>
</template>
