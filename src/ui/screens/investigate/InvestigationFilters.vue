<!--
  WP-04 IN2/IP19: free-text query, Type, Rule (new to this screen), Severity, Status
  (default all) and Note. Quality's Module filter is not carried. Follows
  FindingFilters.vue's own shape, so the two filter bars read and behave alike.
-->
<script setup lang="ts">
import type { InvestigationFilter } from '../../read-models/investigation';
import { useUniqueId } from '../../unique-id';
import {
  FINDING_KIND_LABEL, FINDING_STATUS_LABEL, QUALITY_ALL_KINDS, QUALITY_ALL_SEVERITIES, QUALITY_ALL_STATUSES,
  QUALITY_FILTER_KIND, QUALITY_FILTER_QUERY, QUALITY_FILTER_SEVERITY, QUALITY_FILTER_STATUS, QUALITY_RESET, RULE_TEXT, SEVERITY_TEXT,
} from '../../inspector-copy';
import {
  INVESTIGATE_ALL_RULES, INVESTIGATE_FILTER_NOTE, INVESTIGATE_FILTER_RULE, INVESTIGATE_NOTE_ALL, INVESTIGATE_NOTE_WITH,
  INVESTIGATE_NOTE_WITHOUT,
} from '../../audit-copy/investigation';
import Icon from '../../kit/Icon.vue';

defineProps<{ rules: readonly string[]; severities: readonly string[] }>();
const filter = defineModel<InvestigationFilter>('filter', { required: true });
const emit = defineEmits<{ reset: [] }>();
const base = useUniqueId('ci-investigate-filters');

/** Always a NEW object, so the parent's (shallow) watch on the filter sees every change. */
function set<K extends keyof InvestigationFilter>(key: K, value: InvestigationFilter[K]): void {
  filter.value = { ...filter.value, [key]: value };
}
</script>

<template>
  <div class="ci-investigate-filters">
    <input
      class="ci-investigate-filters__query"
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
      class="dropdown ci-investigate-filters__kind"
      :value="filter.kind"
      @change="set('kind', (($event.target as HTMLSelectElement).value || null) as InvestigationFilter['kind'])"
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
      :for="`${base}-rule`"
    >{{ INVESTIGATE_FILTER_RULE }}</label>
    <select
      :id="`${base}-rule`"
      class="dropdown ci-investigate-filters__rule"
      :value="filter.rule"
      @change="set('rule', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">
        {{ INVESTIGATE_ALL_RULES }}
      </option>
      <option
        v-for="rule in rules"
        :key="rule"
        :value="rule"
      >
        {{ RULE_TEXT(rule) }}
      </option>
    </select>
    <label
      class="visually-hidden"
      :for="`${base}-severity`"
    >{{ QUALITY_FILTER_SEVERITY }}</label>
    <select
      :id="`${base}-severity`"
      class="dropdown ci-investigate-filters__severity"
      :value="filter.severity"
      @change="set('severity', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">
        {{ QUALITY_ALL_SEVERITIES }}
      </option>
      <option
        v-for="severity in severities"
        :key="severity"
        :value="severity"
      >
        {{ SEVERITY_TEXT(severity) }}
      </option>
    </select>
    <label
      class="visually-hidden"
      :for="`${base}-status`"
    >{{ QUALITY_FILTER_STATUS }}</label>
    <select
      :id="`${base}-status`"
      class="dropdown ci-investigate-filters__status"
      :value="filter.status"
      @change="set('status', ($event.target as HTMLSelectElement).value as InvestigationFilter['status'])"
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
    <label
      class="visually-hidden"
      :for="`${base}-note`"
    >{{ INVESTIGATE_FILTER_NOTE }}</label>
    <select
      :id="`${base}-note`"
      class="dropdown ci-investigate-filters__note"
      :value="filter.note"
      @change="set('note', ($event.target as HTMLSelectElement).value as InvestigationFilter['note'])"
    >
      <option value="all">
        {{ INVESTIGATE_NOTE_ALL }}
      </option>
      <option value="with-note">
        {{ INVESTIGATE_NOTE_WITH }}
      </option>
      <option value="without-note">
        {{ INVESTIGATE_NOTE_WITHOUT }}
      </option>
    </select>
    <button
      type="button"
      class="ci-investigate-filters__reset"
      @click="emit('reset')"
    >
      <Icon name="rotate-ccw" />
      {{ QUALITY_RESET }}
    </button>
  </div>
</template>
