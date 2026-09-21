<script setup lang="ts">
import { computed, ref } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { moduleNeighbours } from '../read-models/architecture';
import { moduleOf } from '../read-models/file-summaries';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import {
  ARCH_EYEBROW, ARCH_MAP_FOOTNOTE, ARCH_OMITTED_NOTE, ARCH_SUBTITLE, ARCH_TAB_MAP, ARCH_TAB_MATRIX, ARCH_TITLE,
  ARCH_VIEWS_LABEL, ARCH_VIOLATIONS_ONLY,
} from '../inspector-copy';
import type { TabItem } from '../kit/tab-types';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import Tabs from '../kit/Tabs.vue';
import NoSnapshot from './NoSnapshot.vue';
import ModuleMap from './architecture/ModuleMap.vue';
import DependencyMatrix from './architecture/DependencyMatrix.vue';
import ModuleInspector from './architecture/ModuleInspector.vue';

const TABS: readonly TabItem[] = [
  { id: 'map', label: ARCH_TAB_MAP },
  { id: 'matrix', label: ARCH_TAB_MATRIX },
];

const store = useCityStore();
const { architecture, files } = useReadModels();
const tab = ref('map');
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

function selectEdge(edge: { from: string; to: string }): void {
  selectedEdge.value = edge;
  selectedModule.value = edge.from;
}

/** Selection goes through the ONE owner and never moves the camera. */
function openFile(id: EntityId): void {
  store.select(id);
  store.navigate('file');
}
</script>

<template>
  <div class="ci-screen ci-screen--architecture">
    <PageHeader
      :eyebrow="ARCH_EYEBROW"
      :title="ARCH_TITLE"
      :subtitle="ARCH_SUBTITLE"
    />
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else>
      <div class="ci-overview__cards">
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
              @select="selectedModule = $event"
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
          </Tabs>
          <p
            v-if="architecture.omittedModules > 0"
            class="ci-architecture__note"
          >
            {{ ARCH_OMITTED_NOTE(architecture.omittedModules) }}
          </p>
        </Panel>
        <aside class="ci-architecture__inspectors">
          <ModuleInspector
            :module="moduleSummary"
            :incoming="neighbours.incoming"
            :outgoing="neighbours.outgoing"
            @open-file="openFile"
          />
        </aside>
      </div>
    </template>
  </div>
</template>
