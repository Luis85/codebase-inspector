<script setup lang="ts">
import { ref } from 'vue';
import { useCsvExport } from '../export/use-csv-export';
import { advisoriesCsv } from '../read-models/security';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import type { SamplePackage } from '../fixtures/sample-packages';
import {
  CONFIGURE_EVIDENCE, EVIDENCE_SOURCE_NONE, EVIDENCE_SOURCE_SAMPLE, POLICY_ROWS, POLICY_SUBTITLE,
  POLICY_TITLE, SECRETS_EMPTY, SECRETS_EMPTY_TITLE, SECRETS_SUBTITLE, SECRETS_TITLE, SECURITY_ADVISORIES_SUBTITLE,
  SECURITY_ADVISORIES_TITLE, SECURITY_CHECKLIST, SECURITY_CHECKLIST_SUBTITLE, SECURITY_CHECKLIST_TITLE,
  SECURITY_CSV_FILENAME, SECURITY_EXPORT, SECURITY_EYEBROW, SECURITY_SOURCE_LABELS, SECURITY_SOURCES,
  SECURITY_SOURCES_TITLE, SECURITY_SUBTITLE, SECURITY_TAB_ADVISORIES, SECURITY_TAB_POLICY, SECURITY_TAB_SECRETS,
  SECURITY_TABS_LABEL, SECURITY_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import Tabs from '../kit/Tabs.vue';
import Icon from '../kit/Icon.vue';
import type { TabItem } from '../kit/tab-types';
import NoSnapshot from './NoSnapshot.vue';
import AdvisoryList from './security/AdvisoryList.vue';
import ReviewChecklist from './security/ReviewChecklist.vue';
import PackageDetailDialog from './dependencies/PackageDetailDialog.vue';
import UnknownEvidenceState from './shared/UnknownEvidenceState.vue';
import EvidenceSourceDialog from './shared/EvidenceSourceDialog.vue';
import type { EvidenceSourceRow } from './shared/evidence-source';

const TABS: readonly TabItem[] = [
  { id: 'advisories', label: SECURITY_TAB_ADVISORIES },
  { id: 'secrets', label: SECURITY_TAB_SECRETS },
  { id: 'policy', label: SECURITY_TAB_POLICY },
];

// Q7: secret scanning and runtime exploitability have no provider — both rows are unknown.
const EVIDENCE_ROWS: readonly EvidenceSourceRow[] = [
  { label: SECURITY_SOURCE_LABELS.advisories, state: 'sample', source: EVIDENCE_SOURCE_SAMPLE },
  { label: SECURITY_SOURCE_LABELS.secrets, state: 'unknown', source: EVIDENCE_SOURCE_NONE },
  { label: SECURITY_SOURCE_LABELS.runtime, state: 'unknown', source: EVIDENCE_SOURCE_NONE },
];

const store = useCityStore();
const { security } = useReadModels();
const tab = ref('advisories');
const sourcesOpen = ref(false);
const inspecting = ref<SamplePackage | null>(null);
const liveMessage = ref('');
const root = ref<HTMLElement | null>(null);
// Fix round 1 (Important 1): owned here, not inside ReviewChecklist, which sits behind a
// `v-if` tab and would otherwise be torn down (and its progress lost) on every tab switch.
const checklist = ref<boolean[]>(SECURITY_CHECKLIST.map(() => false));
const exportText = useCsvExport(root, liveMessage);

function inspect(pkg: SamplePackage): void {
  inspecting.value = pkg;
}

function exportCsv(): void { exportText(SECURITY_CSV_FILENAME, () => advisoriesCsv(security.value.advisories)); }
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--security"
  >
    <PageHeader
      :eyebrow="SECURITY_EYEBROW"
      :title="SECURITY_TITLE"
      :subtitle="SECURITY_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-security__sources"
          @click="sourcesOpen = true"
        >
          <Icon name="database" />
          {{ SECURITY_SOURCES }}
        </button>
        <button
          type="button"
          class="ci-security__export"
          :disabled="!store.snapshot || security.advisories.length === 0"
          @click="exportCsv"
        >
          <Icon name="download" />
          {{ SECURITY_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <p
      class="visually-hidden ci-security__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else>
      <div class="ci-screen__cards">
        <MetricCard
          v-for="card in security.cards"
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
        :label="SECURITY_TABS_LABEL"
      >
        <div
          v-if="tab === 'advisories'"
          class="ci-screen__grid"
        >
          <Panel
            :title="SECURITY_ADVISORIES_TITLE"
            :subtitle="SECURITY_ADVISORIES_SUBTITLE"
          >
            <AdvisoryList
              :advisories="security.advisories"
              @inspect="inspect"
            />
          </Panel>
          <Panel
            :title="SECURITY_CHECKLIST_TITLE"
            :subtitle="SECURITY_CHECKLIST_SUBTITLE"
          >
            <ReviewChecklist v-model="checklist" />
          </Panel>
        </div>
        <Panel
          v-else-if="tab === 'secrets'"
          :title="SECRETS_TITLE"
          :subtitle="SECRETS_SUBTITLE"
        >
          <UnknownEvidenceState
            icon="lock"
            :title="SECRETS_EMPTY_TITLE"
            :body="SECRETS_EMPTY"
          >
            <button
              type="button"
              class="ci-security__configure"
              @click="store.navigate('sources')"
            >
              {{ CONFIGURE_EVIDENCE }}
            </button>
          </UnknownEvidenceState>
        </Panel>
        <Panel
          v-else
          :title="POLICY_TITLE"
          :subtitle="POLICY_SUBTITLE"
        >
          <table class="ci-policy">
            <tbody>
              <tr
                v-for="row in POLICY_ROWS"
                :key="row.rule"
              >
                <th scope="row">
                  {{ row.rule }}
                </th>
                <td>{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
        </Panel>
      </Tabs>
    </template>
    <PackageDetailDialog
      v-if="inspecting"
      :pkg="inspecting"
      @close="inspecting = null"
    />
    <EvidenceSourceDialog
      v-if="sourcesOpen"
      :title="SECURITY_SOURCES_TITLE"
      :rows="EVIDENCE_ROWS"
      @close="sourcesOpen = false"
    />
  </div>
</template>
