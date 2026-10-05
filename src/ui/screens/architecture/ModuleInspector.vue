<script setup lang="ts">
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric, hasValue, type MetricValue } from '../../evidence';
import type { ModuleSummary } from '../../read-models/architecture';
import { moduleLabel } from '../../read-models/file-summaries';
import {
  ARCH_FACT_FILES, ARCH_FACT_IMPORTED_BY, ARCH_FACT_IMPORTS, ARCH_FACT_LINES, ARCH_MODULE_INSPECTOR_TITLE,
  ARCH_MODULE_NONE, ARCH_NONE, ARCH_TOP_FILES, PRIORITY_SCALE_SUFFIX, RELATIONS_SCOPE_SHORT,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

/** `incoming`/`outgoing` are the module's EVIDENCED neighbours (N20); `evidence` is the
 *  relation value, whose state labels both lists — without a report they read "—", never
 *  an empty "none"; with one, RELATIONS_SCOPE_SHORT states their scope (N5). */
const props = defineProps<{ module: ModuleSummary | null; incoming: readonly string[]; outgoing: readonly string[]; evidence: MetricValue }>();
const emit = defineEmits<{ 'open-file': [id: EntityId] }>();

function neighbourText(names: readonly string[]): string {
  if (!hasValue(props.evidence)) return formatMetric(props.evidence);
  return names.map(moduleLabel).join(', ') || ARCH_NONE;
}
</script>

<template>
  <div class="ci-module-inspector">
    <Panel
      :title="ARCH_MODULE_INSPECTOR_TITLE"
      :subtitle="module ? module.label : ARCH_MODULE_NONE"
    >
      <template v-if="module">
        <dl class="ci-facts">
          <dt>{{ ARCH_FACT_FILES }}</dt>
          <dd>{{ module.fileCount }}</dd>
          <dt>{{ ARCH_FACT_LINES }}</dt>
          <dd>
            {{ formatMetric(module.lines) }}
            <ProvenanceBadge
              v-if="module.lines.state !== 'collected'"
              :state="module.lines.state"
              :detail="module.lines.reason"
            />
          </dd>
          <dt>
            {{ ARCH_FACT_IMPORTS }} <ProvenanceBadge
              :state="evidence.state"
              :detail="evidence.reason"
            />
          </dt>
          <dd>{{ neighbourText(outgoing) }}</dd>
          <dt>
            {{ ARCH_FACT_IMPORTED_BY }} <ProvenanceBadge
              :state="evidence.state"
              :detail="evidence.reason"
            />
          </dt>
          <dd>{{ neighbourText(incoming) }}</dd>
        </dl>
        <p
          v-if="hasValue(evidence)"
          class="ci-note ci-module-inspector__scope"
        >
          {{ RELATIONS_SCOPE_SHORT }}
        </p>
        <p class="ci-module-inspector__heading">
          {{ ARCH_TOP_FILES }}
        </p>
        <ul class="ci-module-inspector__files">
          <li
            v-for="f in module.topFiles"
            :key="f.id"
          >
            <button
              type="button"
              class="ci-module-inspector__file"
              @click="emit('open-file', f.id)"
            >
              <span class="ci-file-cell">
                <span class="ci-file-cell__name">{{ f.name }}</span>
                <span class="ci-file-cell__path">{{ f.path }}</span>
              </span>
              <span class="ci-priority">{{ formatMetric(f.priority) }}{{ PRIORITY_SCALE_SUFFIX }}</span>
            </button>
          </li>
        </ul>
      </template>
    </Panel>
  </div>
</template>
