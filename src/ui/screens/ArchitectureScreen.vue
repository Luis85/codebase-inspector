<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { edgeKey, moduleNeighbours } from '../read-models/architecture';
import { moduleOf } from '../read-models/file-summaries';
import { reviewFailureText } from '../read-models/review-failure';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import {
  ARCH_ADD_RULE, ARCH_EYEBROW, ARCH_MAP_FOOTNOTE, ARCH_OMITTED_NOTE, ARCH_SUBTITLE, ARCH_TAB_MAP, ARCH_TAB_MATRIX,
  ARCH_TAB_RULES, ARCH_TITLE, ARCH_VIEWS_LABEL, ARCH_VIOLATIONS_ONLY, RULE_REMOVE_FAILED,
} from '../inspector-copy';
import type { TabItem } from '../kit/tab-types';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import Tabs from '../kit/Tabs.vue';
import Icon from '../kit/Icon.vue';
import NoSnapshot from './NoSnapshot.vue';
import ModuleMap from './architecture/ModuleMap.vue';
import DependencyMatrix from './architecture/DependencyMatrix.vue';
import ModuleInspector from './architecture/ModuleInspector.vue';
import BoundaryRuleTable from './architecture/BoundaryRuleTable.vue';
import BoundaryInspector from './architecture/BoundaryInspector.vue';
import RuleEditor from './architecture/RuleEditor.vue';

const TABS: readonly TabItem[] = [
  { id: 'map', label: ARCH_TAB_MAP },
  { id: 'matrix', label: ARCH_TAB_MATRIX },
  { id: 'rules', label: ARCH_TAB_RULES },
];

const store = useCityStore();
const review = useReviewStore();
const { architecture, files } = useReadModels();
const tab = ref('map');
const root = ref<HTMLElement | null>(null);
const violationsOnly = ref(false);

/** P12: open on the selected file's module when it is in the graph. Derived once from the
 *  shared selection, so there is no new cross-screen state. */
function initialModule(): string | null {
  const names = architecture.value.modules.map((m) => m.name);
  const file = files.value.find((f) => f.id === store.selectedEntityId);
  const own = file ? moduleOf(file.path) : null;
  return own !== null && names.includes(own) ? own : names[0] ?? null;
}

const selectedModule = ref<string | null>(initialModule());
const selectedEdge = ref<{ from: string; to: string } | null>(null);
const moduleSummary = computed(() => architecture.value.modules.find((m) => m.name === selectedModule.value) ?? null);
const neighbours = computed(() => (selectedModule.value
  ? moduleNeighbours(architecture.value, selectedModule.value) : { incoming: [], outgoing: [] }));

const selectedRuleId = ref<string | null>(null);
const editorOpen = ref(false);
const liveMessage = ref('');
const selectedRule = computed(() => architecture.value.rules.find((r) => r.rule.id === selectedRuleId.value) ?? null);
const selectedEdgeModel = computed(() => {
  const s = selectedEdge.value;
  return s ? architecture.value.edges.find((e) => e.from === s.from && e.to === s.to) ?? null : null;
});
const edgeViolates = computed(() => {
  const e = selectedEdgeModel.value;
  return e ? architecture.value.violatingEdgeKeys.has(edgeKey(e.from, e.to)) : false;
});
watch(() => architecture.value.rules, (rules) => {
  if (selectedRuleId.value && !rules.some((r) => r.rule.id === selectedRuleId.value)) selectedRuleId.value = null;
});
/** F3: a rescan or snapshot switch can drop the selected module; re-derive it so the
 *  inspector and the rule editor never hold a module the graph no longer has. */
watch(() => architecture.value.modules, (modules) => {
  if (!modules.some((m) => m.name === selectedModule.value)) selectedModule.value = initialModule();
});

function selectModule(name: string): void {
  selectedModule.value = name;
  selectedEdge.value = null;
  selectedRuleId.value = null;
}

function selectEdge(edge: { from: string; to: string }): void {
  selectedEdge.value = edge;
  selectedRuleId.value = null;
  selectedModule.value = edge.from;
}
function selectRule(id: string): void {
  selectedRuleId.value = id;
  selectedEdge.value = null;
  const from = architecture.value.rules.find((r) => r.rule.id === id)?.rule.from;
  if (from !== undefined && architecture.value.modules.some((m) => m.name === from)) selectedModule.value = from;
}
function onSaved(id: string): void {
  editorOpen.value = false;
  tab.value = 'rules';
  selectRule(id);
}
async function removeRule(id: string): Promise<void> {
  try {
    await review.removeRule(id);
  } catch (e) {
    liveMessage.value = reviewFailureText(e, RULE_REMOVE_FAILED);
    return;
  }
  // F7: the removed row took focus with it; land on the empty state's add button, or the
  // rules panel, never on the body.
  await nextTick();
  const el = root.value;
  (el?.querySelector<HTMLElement>('.ci-rule-table__empty button') ?? el?.querySelector<HTMLElement>('[role="tabpanel"]'))?.focus();
}

/** Selection goes through the ONE owner and never moves the camera. */
function openFile(id: EntityId): void {
  store.select(id);
  store.navigate('file');
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--architecture"
  >
    <PageHeader
      :eyebrow="ARCH_EYEBROW"
      :title="ARCH_TITLE"
      :subtitle="ARCH_SUBTITLE"
    >
      <template #actions>
        <button
          v-if="store.snapshot"
          type="button"
          :disabled="architecture.modules.length < 2"
          @click="editorOpen = true"
        >
          <Icon name="plus" />
          {{ ARCH_ADD_RULE }}
        </button>
      </template>
    </PageHeader>
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else>
      <div class="ci-screen__cards">
        <MetricCard
          v-for="card in architecture.cards"
          :key="card.id"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :caption="card.caption"
          :tone="card.tone"
        />
      </div>
      <div class="ci-architecture__grid">
        <Panel :footnote="ARCH_MAP_FOOTNOTE">
          <Tabs
            v-model="tab"
            :tabs="TABS"
            :label="ARCH_VIEWS_LABEL"
          >
            <template #toolbar>
              <label class="ci-architecture__toggle">
                <input
                  v-model="violationsOnly"
                  type="checkbox"
                >
                {{ ARCH_VIOLATIONS_ONLY }}
              </label>
            </template>
            <ModuleMap
              v-if="tab === 'map'"
              :modules="architecture.modules"
              :edges="architecture.edges"
              :violating="architecture.violatingEdgeKeys"
              :violations-only="violationsOnly"
              :selected="selectedModule"
              @select="selectModule"
            />
            <DependencyMatrix
              v-else-if="tab === 'matrix'"
              :modules="architecture.modules"
              :matrix="architecture.matrix"
              :violating="architecture.violatingEdgeKeys"
              :violations-only="violationsOnly"
              :selected-edge="selectedEdge"
              @select-edge="selectEdge"
            />
            <BoundaryRuleTable
              v-else
              :rules="architecture.rules"
              @select="selectRule"
              @remove="removeRule"
              @add="editorOpen = true"
            />
          </Tabs>
          <p
            v-if="architecture.omittedModules > 0"
            class="ci-architecture__note"
          >
            {{ ARCH_OMITTED_NOTE(architecture.omittedModules) }}
          </p>
        </Panel>
        <aside class="ci-architecture__inspectors">
          <BoundaryInspector
            :evaluation="selectedRule"
            :edge="selectedEdgeModel"
            :violating="edgeViolates"
          />
          <ModuleInspector
            :module="moduleSummary"
            :incoming="neighbours.incoming"
            :outgoing="neighbours.outgoing"
            @open-file="openFile"
          />
        </aside>
      </div>
    </template>
    <p
      class="visually-hidden"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <RuleEditor
      v-if="editorOpen"
      :modules="architecture.modules"
      :initial-from="selectedModule"
      @close="editorOpen = false"
      @saved="onSaved"
    />
  </div>
</template>
