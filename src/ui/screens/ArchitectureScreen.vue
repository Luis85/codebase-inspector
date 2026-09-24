<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { relationValue } from '../read-models/relations';
import { reviewFailureText } from '../read-models/review-failure';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { useEvidenceStore } from '../stores/evidence-store';
import { useRelationsStore } from '../stores/relations-store';
import { useReviewStore } from '../stores/review-store';
import {
  ARCH_ADD_RULE, ARCH_CYCLE_INSPECTOR_TITLE, ARCH_EYEBROW, ARCH_MAP_FOOTNOTE, ARCH_OMITTED_NOTE, ARCH_SUBTITLE,
  ARCH_TAB_CYCLES, ARCH_TAB_EDGES, ARCH_TAB_MAP, ARCH_TAB_MATRIX, ARCH_TAB_RULES, ARCH_TITLE, ARCH_VIEWS_LABEL,
  ARCH_VIOLATIONS_ONLY, CYCLE_KIND_LABEL, RULE_REMOVE_FAILED,
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
import CycleList from './architecture/CycleList.vue';
import CycleMembers from './architecture/CycleMembers.vue';
import EdgeList from './architecture/EdgeList.vue';
import ModuleInspector from './architecture/ModuleInspector.vue';
import BoundaryRuleTable from './architecture/BoundaryRuleTable.vue';
import FallowBoundaryTable from './architecture/FallowBoundaryTable.vue';
import BoundaryInspector from './architecture/BoundaryInspector.vue';
import RuleEditor from './architecture/RuleEditor.vue';
import { useArchitectureSelection } from './architecture/use-architecture-selection';

/** N21: Map, Matrix, Cycles, Edges, Rules, in that order. */
const TABS: readonly TabItem[] = [
  { id: 'map', label: ARCH_TAB_MAP },
  { id: 'matrix', label: ARCH_TAB_MATRIX },
  { id: 'cycles', label: ARCH_TAB_CYCLES },
  { id: 'edges', label: ARCH_TAB_EDGES },
  { id: 'rules', label: ARCH_TAB_RULES },
];

const store = useCityStore();
const review = useReviewStore();
const evidence = useEvidenceStore();
const relationsStore = useRelationsStore();
const { architecture, files } = useReadModels();
const tab = ref('map');
const root = ref<HTMLElement | null>(null);
const violationsOnly = ref(false);
const editorOpen = ref(false);
const liveMessage = ref('');
const {
  selectedModule, selectedEdge, selectedCycleId, moduleSummary, neighbours, selectedRule, selectedEdgeModel, edgeViolates,
  selectedCycle, highlightedModules, selectModule, selectEdge, selectRule, selectCycle,
} = useArchitectureSelection(architecture, files);
/** N20: the relation evidence state — the Map's and the module inspector's badge. */
const relationEvidence = computed(() => relationValue(architecture.value.relations, architecture.value.relations.edges.length));

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
/** N15: Quality opens its review dialog on this finding when it mounts. */
function reviewFinding(fingerprint: string): void {
  evidence.requestFindingReview(fingerprint);
  store.navigate('quality');
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
              :cycle-modules="highlightedModules"
              :evidence="relationEvidence"
              :not-analysed="architecture.notAnalysed"
              :omitted-edges="architecture.omittedEdges"
              @select="selectModule"
            />
            <DependencyMatrix
              v-else-if="tab === 'matrix'"
              :modules="architecture.modules"
              :matrix="architecture.matrix"
              :violating="architecture.violatingEdgeKeys"
              :violations-only="violationsOnly"
              :selected-edge="selectedEdge"
              :not-analysed="architecture.notAnalysed"
              @select-edge="selectEdge"
            />
            <CycleList
              v-else-if="tab === 'cycles'"
              :cycles="architecture.relations.cycles"
              :not-analysed="architecture.notAnalysed"
              :selected-id="selectedCycleId"
              @select="selectCycle"
              @review="reviewFinding"
              @show-in-city="relationsStore.showCycleInCity"
            />
            <EdgeList
              v-else-if="tab === 'edges'"
              :relations="architecture.relations"
              :not-analysed="architecture.notAnalysed"
              :selected-module="selectedModule"
              :violating="architecture.violatingEdgeKeys"
              :violations-only="violationsOnly"
              @open-file="openFile"
            />
            <template v-else>
              <BoundaryRuleTable
                :rules="architecture.rules"
                @select="selectRule"
                @remove="removeRule"
                @add="editorOpen = true"
              />
              <FallowBoundaryTable
                :relations="architecture.relations"
                @review="reviewFinding"
              />
            </template>
          </Tabs>
          <p
            v-if="architecture.omittedModules > 0"
            class="ci-architecture__note"
          >
            {{ ARCH_OMITTED_NOTE(architecture.omittedModules) }}
          </p>
        </Panel>
        <aside class="ci-architecture__inspectors">
          <Panel
            v-if="selectedCycle"
            :title="ARCH_CYCLE_INSPECTOR_TITLE"
            :subtitle="CYCLE_KIND_LABEL[selectedCycle.kind]"
          >
            <p
              v-if="selectedCycle.pathText !== ''"
              class="ci-architecture__cycle-path"
            >
              <code>{{ selectedCycle.pathText }}</code>
            </p>
            <CycleMembers
              v-if="selectedCycle.pathText === '' || !selectedCycle.matched"
              :cycle="selectedCycle"
            />
          </Panel>
          <BoundaryInspector
            :evaluation="selectedRule"
            :edge="selectedEdgeModel"
            :violating="edgeViolates"
          />
          <ModuleInspector
            :module="moduleSummary"
            :incoming="neighbours.incoming"
            :outgoing="neighbours.outgoing"
            :evidence="relationEvidence"
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
