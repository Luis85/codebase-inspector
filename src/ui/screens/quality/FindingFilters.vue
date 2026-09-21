<script setup lang="ts">
import type { QualityFilter } from '../../read-models/findings';
import { useUniqueId } from '../../unique-id';
import {
  FINDING_KIND_LABEL, FINDING_STATUS_LABEL, QUALITY_ALL_KINDS, QUALITY_ALL_MODULES, QUALITY_ALL_SEVERITIES,
  QUALITY_ALL_STATUSES, QUALITY_FILTER_KIND, QUALITY_FILTER_MODULE, QUALITY_FILTER_QUERY, QUALITY_FILTER_SEVERITY,
  QUALITY_FILTER_STATUS, QUALITY_RESET, SEVERITY_LABEL,
} from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';

defineProps<{ modules: readonly { name: string; label: string }[] }>();
const filter = defineModel<QualityFilter>('filter', { required: true });
const emit = defineEmits<{ reset: [] }>();
const base = useUniqueId('ci-finding-filters');

/** Always a NEW object, so the parent's (shallow) watch on the filter sees every change. */
function set<K extends keyof QualityFilter>(key: K, value: QualityFilter[K]): void {
  filter.value = { ...filter.value, [key]: value };
}
</script>

<template>
  <div class="ci-finding-filters">
    <input
      class="ci-finding-filters__query"
      type="search"
      :value="filter.query"
      :placeholder="QUALITY_FILTER_QUERY"
      :aria-label="QUALITY_FILTER_QUERY"
      @input="set('query', ($event.target as HTMLInputElement).value)"
    >
    <label
      class="visually-hidden"
      :for="`${base}-kind`"
    >{{ QUALITY_FILTER_KIND }}</label>
    <select
      :id="`${base}-kind`"
      class="dropdown ci-finding-filters__kind"
      :value="filter.kind"
      @change="set('kind', (($event.target as HTMLSelectElement).value || null) as QualityFilter['kind'])"
    >
      <option value="">
        {{ QUALITY_ALL_KINDS }}
      </option>
      <option
        v-for="(label, kind) in FINDING_KIND_LABEL"
        :key="kind"
        :value="kind"
      >
        {{ label }}
      </option>
    </select>
    <label
      class="visually-hidden"
      :for="`${base}-severity`"
    >{{ QUALITY_FILTER_SEVERITY }}</label>
    <select
      :id="`${base}-severity`"
      class="dropdown ci-finding-filters__severity"
      :value="filter.severity"
      @change="set('severity', (($event.target as HTMLSelectElement).value || null) as QualityFilter['severity'])"
    >
      <option value="">
        {{ QUALITY_ALL_SEVERITIES }}
      </option>
      <option
        v-for="(label, severity) in SEVERITY_LABEL"
        :key="severity"
        :value="severity"
      >
        {{ label }}
      </option>
    </select>
    <label
      class="visually-hidden"
      :for="`${base}-module`"
    >{{ QUALITY_FILTER_MODULE }}</label>
    <select
      :id="`${base}-module`"
      class="dropdown ci-finding-filters__module"
      :value="filter.module"
      @change="set('module', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">
        {{ QUALITY_ALL_MODULES }}
      </option>
      <option
        v-for="m in modules"
        :key="m.name"
        :value="m.name"
      >
        {{ m.label }}
      </option>
    </select>
    <label
      class="visually-hidden"
      :for="`${base}-status`"
    >{{ QUALITY_FILTER_STATUS }}</label>
    <select
      :id="`${base}-status`"
      class="dropdown ci-finding-filters__status"
      :value="filter.status"
      @change="set('status', ($event.target as HTMLSelectElement).value as QualityFilter['status'])"
    >
      <option value="all">
        {{ QUALITY_ALL_STATUSES }}
      </option>
      <option
        v-for="(label, status) in FINDING_STATUS_LABEL"
        :key="status"
        :value="status"
      >
        {{ label }}
      </option>
    </select>
    <button
      type="button"
      class="ci-finding-filters__reset"
      @click="emit('reset')"
    >
      <Icon name="rotate-ccw" />
      {{ QUALITY_RESET }}
    </button>
  </div>
</template>
