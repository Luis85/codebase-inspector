<script setup lang="ts">
import { formatMetric } from '../../evidence';
import type { ModuleEdge, RuleEvaluation } from '../../read-models/architecture';
import { moduleLabel } from '../../read-models/file-summaries';
import {
  BOUNDARY_EDGE_IMPORTS, BOUNDARY_EDGE_NO_RULE, BOUNDARY_EDGE_VIOLATES, BOUNDARY_INSPECTOR_SUBTITLE,
  BOUNDARY_INSPECTOR_TITLE, BOUNDARY_NONE, BOUNDARY_VIOLATING_IMPORTS, RULE_SENTENCE, RULE_STATUS_LABEL,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ evaluation: RuleEvaluation | null; edge: ModuleEdge | null; violating: boolean }>();
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
        <p
          v-if="evaluation.reason"
          class="ci-note"
        >
          {{ evaluation.reason }}
        </p>
      </template>
      <template v-else-if="edge">
        <p class="ci-boundary__flow">
          <code>{{ moduleLabel(edge.from) }}</code> → <code>{{ moduleLabel(edge.to) }}</code>
        </p>
        <p class="ci-boundary__count">
          {{ BOUNDARY_EDGE_IMPORTS(formatMetric(edge.imports)) }}
          <ProvenanceBadge
            v-if="edge.imports.state !== 'collected'"
            :state="edge.imports.state"
            :detail="edge.imports.reason"
          />
        </p>
        <p>{{ violating ? BOUNDARY_EDGE_VIOLATES : BOUNDARY_EDGE_NO_RULE }}</p>
      </template>
      <p
        v-else
        class="ci-boundary__empty"
      >
        {{ BOUNDARY_NONE }}
      </p>
    </Panel>
  </div>
</template>
