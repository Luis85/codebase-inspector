<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCsvExport } from '../export/use-csv-export';
import { filterPackages, packagesCsv, type PackageFilter } from '../read-models/dependencies';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import type { SamplePackage } from '../fixtures/sample-packages';
import {
  DEPS_CALLOUT, DEPS_CALLOUT_TITLE, DEPS_EXPORT, DEPS_EYEBROW, DEPS_CSV_FILENAME, DEPS_FOOTNOTE, DEPS_LICENSES_SUBTITLE,
  DEPS_LICENSES_TITLE, DEPS_MANIFESTS_NONE, DEPS_MANIFESTS_NOTE, DEPS_MANIFESTS_TITLE, DEPS_PATH_SUBTITLE,
  DEPS_PATH_TITLE, DEPS_SUBTITLE, DEPS_TAB_INVENTORY, DEPS_TAB_LICENSES, DEPS_TAB_PATH, DEPS_TABS_LABEL, DEPS_TITLE,
  SAMPLE_BADGE_DETAIL,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Callout from '../kit/Callout.vue';
import Panel from '../kit/Panel.vue';
import Tabs from '../kit/Tabs.vue';
import Icon from '../kit/Icon.vue';
import type { TabItem } from '../kit/tab-types';
import NoSnapshot from './NoSnapshot.vue';
import PackageTable from './dependencies/PackageTable.vue';
import DependencyPath from './dependencies/DependencyPath.vue';
import LicenseTable from './dependencies/LicenseTable.vue';
import PackageDetailDialog from './dependencies/PackageDetailDialog.vue';

const TABS: readonly TabItem[] = [
  { id: 'inventory', label: DEPS_TAB_INVENTORY },
  { id: 'path', label: DEPS_TAB_PATH },
  { id: 'licenses', label: DEPS_TAB_LICENSES },
];

const store = useCityStore();
const { dependencies } = useReadModels();
const tab = ref('inventory');
const query = ref('');
const filter = ref<PackageFilter>('all');
const inspecting = ref<SamplePackage | null>(null);
const liveMessage = ref('');
const root = ref<HTMLElement | null>(null);
const exportText = useCsvExport(root, liveMessage);

const filtered = computed(() => (dependencies.value ? filterPackages(dependencies.value.packages, query.value, filter.value) : []));

function inspect(pkg: SamplePackage): void {
  inspecting.value = pkg;
}

function exportCsv(): void { exportText(DEPS_CSV_FILENAME, () => packagesCsv(filtered.value)); }
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--dependencies"
  >
    <PageHeader
      :eyebrow="DEPS_EYEBROW"
      :title="DEPS_TITLE"
      :subtitle="DEPS_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-dependencies__export"
          :disabled="filtered.length === 0"
          @click="exportCsv"
        >
          <Icon name="download" />
          {{ DEPS_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <p
      class="visually-hidden ci-dependencies__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <NoSnapshot v-if="!store.snapshot || !dependencies" />
    <template v-else>
      <Callout
        :title="DEPS_CALLOUT_TITLE"
        :badge="SAMPLE_BADGE_DETAIL"
      >
        {{ DEPS_CALLOUT }}
      </Callout>
      <div class="ci-manifests">
        <h3 class="ci-manifests__title">
          {{ DEPS_MANIFESTS_TITLE }}
        </h3>
        <template v-if="dependencies.manifests.length > 0">
          <ul class="ci-manifests__list">
            <li
              v-for="m in dependencies.manifests"
              :key="m.id"
            >
              <code>{{ m.path }}</code>
            </li>
          </ul>
          <p class="ci-note">
            {{ DEPS_MANIFESTS_NOTE }}
          </p>
        </template>
        <p
          v-else
          class="ci-note"
        >
          {{ DEPS_MANIFESTS_NONE }}
        </p>
      </div>
      <div class="ci-screen__cards">
        <MetricCard
          v-for="card in dependencies.cards"
          :key="card.id"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :caption="card.caption"
          :tone="card.tone"
        />
      </div>
      <Tabs
        v-model="tab"
        :tabs="TABS"
        :label="DEPS_TABS_LABEL"
      >
        <PackageTable
          v-if="tab === 'inventory'"
          v-model:query="query"
          v-model:filter="filter"
          :rows="filtered"
          @inspect="inspect"
        />
        <Panel
          v-else-if="tab === 'path'"
          :title="DEPS_PATH_TITLE"
          :subtitle="DEPS_PATH_SUBTITLE"
        >
          <DependencyPath
            :root-label="dependencies.rootLabel"
            :path="dependencies.path"
            @inspect="inspect"
          />
        </Panel>
        <Panel
          v-else
          :title="DEPS_LICENSES_TITLE"
          :subtitle="DEPS_LICENSES_SUBTITLE"
        >
          <LicenseTable :rows="dependencies.licenses" />
        </Panel>
      </Tabs>
      <p class="ci-note">
        {{ DEPS_FOOTNOTE }}
      </p>
    </template>
    <PackageDetailDialog
      v-if="inspecting"
      :pkg="inspecting"
      @close="inspecting = null"
      @announce="liveMessage = $event"
    />
  </div>
</template>
