<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { downloadText } from '../export/download';
import { TABLE_PAGE, buildHotspotsModel, hotspotsCsv } from '../read-models/hotspots';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { useUniqueId } from '../unique-id';
import {
  HOTSPOTS_ALL_MODULES, HOTSPOTS_CSV_FILENAME, HOTSPOTS_EXPORT, HOTSPOTS_EYEBROW, HOTSPOTS_HOW_PRIORITY,
  HOTSPOTS_MODULE_FILTER, HOTSPOTS_OPEN_DETAIL, HOTSPOTS_SCATTER_FOOTNOTE, HOTSPOTS_SCATTER_SUBTITLE,
  HOTSPOTS_SCATTER_TITLE, HOTSPOTS_SELECTED, HOTSPOTS_SHORTLIST_SUBTITLE, HOTSPOTS_SHORTLIST_TITLE, HOTSPOTS_SHOWING,
  HOTSPOTS_SUBTITLE, HOTSPOTS_TABLE_SUBTITLE, HOTSPOTS_TABLE_TITLE, HOTSPOTS_TITLE, HOTSPOTS_UNPLOTTABLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Panel from '../kit/Panel.vue';
import Icon from '../kit/Icon.vue';
import NoSnapshot from './NoSnapshot.vue';
import HotspotScatter from './hotspots/HotspotScatter.vue';
import PriorityList from './hotspots/PriorityList.vue';
import HotspotTable from './hotspots/HotspotTable.vue';
import PriorityFormulaDialog from './hotspots/PriorityFormulaDialog.vue';

const store = useCityStore();
const { files } = useReadModels();
const moduleFilter = ref<string | null>(null);
const query = ref('');
const shown = ref(TABLE_PAGE);
const formulaOpen = ref(false);
const root = ref<HTMLElement | null>(null);
const moduleSelectId = useUniqueId('ci-hotspots-module');

const model = computed(() => buildHotspotsModel(files.value, { module: moduleFilter.value, query: query.value }));
const selected = computed(() => model.value.rows.find((f) => f.id === store.selectedEntityId) ?? null);
watch([moduleFilter, query], () => { shown.value = TABLE_PAGE; });
/** F3: a rescan or snapshot switch can drop the filtered module; fall back to all. */
watch(() => model.value.modules, (modules) => {
  if (moduleFilter.value !== null && !modules.some((m) => m.name === moduleFilter.value)) moduleFilter.value = null;
});

/** Selection goes through the ONE owner and never moves the camera. */
function openFile(id: EntityId): void {
  store.select(id);
  store.navigate('file');
}

/** P8: every filtered row, handed to the user through this leaf's own document. */
function exportCsv(): void {
  if (root.value) downloadText(root.value, HOTSPOTS_CSV_FILENAME, hotspotsCsv(model.value.rows));
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--hotspots"
  >
    <PageHeader
      :eyebrow="HOTSPOTS_EYEBROW"
      :title="HOTSPOTS_TITLE"
      :subtitle="HOTSPOTS_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-hotspots__how"
          @click="formulaOpen = true"
        >
          <Icon name="info" />
          {{ HOTSPOTS_HOW_PRIORITY }}
        </button>
        <button
          type="button"
          class="ci-hotspots__export"
          :disabled="model.rows.length === 0"
          @click="exportCsv"
        >
          <Icon name="download" />
          {{ HOTSPOTS_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else>
      <div class="ci-hotspots__grid">
        <Panel
          :title="HOTSPOTS_SCATTER_TITLE"
          :subtitle="HOTSPOTS_SCATTER_SUBTITLE"
          :footnote="HOTSPOTS_SCATTER_FOOTNOTE"
        >
          <template #actions>
            <label
              class="visually-hidden"
              :for="moduleSelectId"
            >{{ HOTSPOTS_MODULE_FILTER }}</label>
            <select
              :id="moduleSelectId"
              v-model="moduleFilter"
              class="dropdown ci-hotspots__module"
            >
              <option :value="null">
                {{ HOTSPOTS_ALL_MODULES }}
              </option>
              <option
                v-for="m in model.modules"
                :key="m.name"
                :value="m.name"
              >
                {{ m.label }}
              </option>
            </select>
          </template>
          <HotspotScatter
            :model="model"
            :selected-id="store.selectedEntityId"
            @select="store.select($event)"
          />
          <p
            v-if="model.plottable > model.points.length"
            class="ci-note"
          >
            {{ HOTSPOTS_SHOWING(model.points.length, model.plottable) }}
          </p>
          <p
            v-if="model.unplottable > 0"
            class="ci-note"
          >
            {{ HOTSPOTS_UNPLOTTABLE(model.unplottable) }}
          </p>
          <div class="ci-selected-strip">
            <!-- F7: the live region exists before its text changes, so the change is announced. -->
            <span role="status">{{ selected ? HOTSPOTS_SELECTED(selected.name) : '' }}</span>
            <button
              v-if="selected"
              type="button"
              @click="openFile(selected.id)"
            >
              {{ HOTSPOTS_OPEN_DETAIL }}
            </button>
          </div>
        </Panel>
        <Panel
          :title="HOTSPOTS_SHORTLIST_TITLE"
          :subtitle="HOTSPOTS_SHORTLIST_SUBTITLE"
        >
          <PriorityList
            :files="model.shortlist"
            @open="openFile"
          />
        </Panel>
      </div>
      <Panel
        :title="HOTSPOTS_TABLE_TITLE"
        :subtitle="HOTSPOTS_TABLE_SUBTITLE(model.rows.length)"
      >
        <HotspotTable
          v-model:query="query"
          :rows="model.rows"
          :limit="shown"
          @open="openFile"
          @more="shown += TABLE_PAGE"
        />
      </Panel>
    </template>
    <PriorityFormulaDialog
      v-if="formulaOpen"
      @close="formulaOpen = false"
    />
  </div>
</template>
