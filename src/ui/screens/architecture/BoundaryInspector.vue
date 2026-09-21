<script setup lang="ts">
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric } from '../../evidence';
import type { ModuleEdge, RuleEvaluation } from '../../read-models/architecture';
import { moduleLabel, type FileSummary } from '../../read-models/file-summaries';
import {
  BOUNDARY_EDGE_IMPORTS, BOUNDARY_EDGE_NO_RULE, BOUNDARY_EDGE_VIOLATES, BOUNDARY_ILLUSTRATIVE, BOUNDARY_INSPECTOR_SUBTITLE,
  BOUNDARY_INSPECTOR_TITLE, BOUNDARY_NONE, BOUNDARY_VIOLATING_IMPORTS, RULE_SENTENCE, RULE_STATUS_LABEL,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{
  evaluation: RuleEvaluation | null; edge: ModuleEdge | null; violating: boolean; illustrative: readonly FileSummary[];
}>();
const emit = defineEmits<{ 'open-file': [id: EntityId] }>();
</script>

<template>
  <div class="ci-boundary">
    <Panel
      :title="BOUNDARY_INSPECTOR_TITLE"
      :subtitle="BOUNDARY_INSPECTOR_SUBTITLE"
    >
      <template v-if="evaluation">
        <p class="ci-boundary__id">
          <code>{{ evaluation.rule.id }}</code>
          <span
            class="ci-rule-status"
            :class="`ci-rule-status--${evaluation.status}`"
          >{{ RULE_STATUS_LABEL[evaluation.status] }}</span>
        </p>
        <p class="ci-boundary__rule">
          {{ RULE_SENTENCE(moduleLabel(evaluation.rule.from), moduleLabel(evaluation.rule.to)) }}
        </p>
        <p class="ci-boundary__rationale">
          {{ evaluation.rule.rationale }}
        </p>
        <p class="ci-boundary__count">
          {{ BOUNDARY_VIOLATING_IMPORTS }}: {{ formatMetric(evaluation.violatingImports) }}
          <ProvenanceBadge
            :state="evaluation.violatingImports.state"
            :detail="evaluation.violatingImports.reason"
          />
        </p>
      </template>
      <template v-else-if="edge">
        <p class="ci-boundary__flow">
          <code>{{ moduleLabel(edge.from) }}</code> → <code>{{ moduleLabel(edge.to) }}</code>
        </p>
        <p class="ci-boundary__count">
          {{ BOUNDARY_EDGE_IMPORTS(formatMetric(edge.imports)) }}
          <ProvenanceBadge state="sample" />
        </p>
        <p>{{ violating ? BOUNDARY_EDGE_VIOLATES : BOUNDARY_EDGE_NO_RULE }}</p>
      </template>
      <p
        v-else
        class="ci-boundary__empty"
      >
        {{ BOUNDARY_NONE }}
      </p>
      <template v-if="illustrative.length">
        <p class="ci-module-inspector__heading">
          {{ BOUNDARY_ILLUSTRATIVE }} <ProvenanceBadge state="sample" />
        </p>
        <ul class="ci-module-inspector__files">
          <li
            v-for="f in illustrative"
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
            </button>
          </li>
        </ul>
      </template>
    </Panel>
  </div>
</template>
