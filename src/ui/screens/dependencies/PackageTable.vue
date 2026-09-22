<script setup lang="ts">
import { formatMetric } from '../../evidence';
import type { PackageFilter, PackageRow } from '../../read-models/dependencies';
import {
  DEPS_COL_INSTALLED, DEPS_COL_LICENSE, DEPS_COL_PACKAGE, DEPS_COL_RELATIONSHIP, DEPS_COL_STATUS, DEPS_COUNT,
  DEPS_FILTER_LABEL, DEPS_FILTER_LABELS, DEPS_FILTER_QUERY, DEPS_LICENSE_UNRESOLVED, DEPS_NO_MATCH, DEPS_NO_MATCH_TITLE,
  DEPS_RELATIONSHIP_LABEL, DEPS_REFERENCES, DEPS_STATUS_LABEL, DEPS_TABLE_CAPTION,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';
import type { SamplePackage } from '../../fixtures/sample-packages';
import { useUniqueId } from '../../unique-id';

defineProps<{ rows: readonly PackageRow[] }>();
const emit = defineEmits<{ inspect: [pkg: SamplePackage] }>();
const query = defineModel<string>('query', { required: true });
const filter = defineModel<PackageFilter>('filter', { required: true });
const filterId = useUniqueId('ci-packages-filter');

const columns: readonly TableColumn<PackageRow>[] = [
  { key: 'package', label: DEPS_COL_PACKAGE },
  { key: 'installed', label: DEPS_COL_INSTALLED },
  { key: 'relationship', label: DEPS_COL_RELATIONSHIP },
  { key: 'license', label: DEPS_COL_LICENSE },
  { key: 'status', label: DEPS_COL_STATUS },
];
</script>

<template>
  <div class="ci-packages">
    <div class="ci-packages__toolbar">
      <input
        v-model="query"
        type="search"
        class="ci-packages__query"
        :placeholder="DEPS_FILTER_QUERY"
        :aria-label="DEPS_FILTER_QUERY"
      >
      <label
        class="visually-hidden"
        :for="filterId"
      >{{ DEPS_FILTER_LABEL }}</label>
      <select
        :id="filterId"
        v-model="filter"
        class="dropdown ci-packages__filter"
      >
        <option
          v-for="(label, key) in DEPS_FILTER_LABELS"
          :key="key"
          :value="key"
        >
          {{ label }}
        </option>
      </select>
    </div>
    <p
      v-if="rows.length === 0"
      class="ci-empty"
    >
      <span class="ci-empty__title">{{ DEPS_NO_MATCH_TITLE }}</span>
      <span class="ci-note">{{ DEPS_NO_MATCH }}</span>
    </p>
    <template v-else>
      <EvidenceTable
        :columns="columns"
        :rows="rows"
        :row-key="(r) => r.pkg.name"
        :caption="DEPS_TABLE_CAPTION"
        @activate="emit('inspect', $event.pkg)"
      >
        <template #cell-package="{ row }">
          <code>{{ row.pkg.name }}</code>
          <span class="ci-note">{{ DEPS_REFERENCES(formatMetric(row.references)) }}</span>
          <ProvenanceBadge state="sample" />
        </template>
        <template #cell-installed="{ row }">
          <code>{{ row.pkg.version }}</code>
        </template>
        <template #cell-relationship="{ row }">
          {{ DEPS_RELATIONSHIP_LABEL[row.pkg.relationship] }}
        </template>
        <template #cell-license="{ row }">
          {{ row.pkg.license ?? DEPS_LICENSE_UNRESOLVED }}
        </template>
        <template #cell-status="{ row }">
          <span
            class="ci-chip"
            :class="`ci-chip--dep-${row.pkg.status}`"
          >{{ DEPS_STATUS_LABEL[row.pkg.status] }}</span>
        </template>
      </EvidenceTable>
      <p class="ci-note">
        {{ DEPS_COUNT(rows.length) }}
      </p>
    </template>
  </div>
</template>
