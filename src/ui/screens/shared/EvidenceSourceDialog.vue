<script setup lang="ts">
import { DIALOG_CLOSE, EVIDENCE_DIALOG_READ_ONLY } from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';
import type { EvidenceSourceRow } from './evidence-source';

defineProps<{ title: string; rows: readonly EvidenceSourceRow[] }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <CiDialog
    :label="title"
    @close="emit('close')"
  >
    <div class="ci-evidence-dialog">
      <h3 class="ci-evidence-dialog__title">
        {{ title }}
      </h3>
      <ul class="ci-evidence-dialog__rows">
        <li
          v-for="row in rows"
          :key="row.label"
          class="ci-evidence-dialog__row"
        >
          <span class="ci-evidence-dialog__label">{{ row.label }}</span>
          <ProvenanceBadge :state="row.state" />
          <span class="ci-evidence-dialog__source">{{ row.source }}</span>
        </li>
      </ul>
      <p class="ci-evidence-dialog__note">
        {{ EVIDENCE_DIALOG_READ_ONLY }}
      </p>
      <div class="ci-evidence-dialog__actions">
        <button
          type="button"
          class="mod-cta ci-evidence-dialog__close"
          @click="emit('close')"
        >
          {{ DIALOG_CLOSE }}
        </button>
      </div>
    </div>
  </CiDialog>
</template>
