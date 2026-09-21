<script setup lang="ts">
import { ref, watch } from 'vue';
import { useClipboard } from '../../clipboard';
import { COPY_27 } from '../../copy';
import { formatMetric, hasValue } from '../../evidence';
import type { FileDetailModel } from '../../read-models/file-detail';
import {
  FILE_COPY_FAILED, FILE_COPY_PATH, FILE_FACT_BYTES, FILE_FACT_CATEGORY, FILE_FACT_LINES, FILE_FACT_MODULE, FILE_FACT_PATH,
  FILE_SOURCE_PREVIEW_LATER, FILE_SOURCE_SUBTITLE, FILE_SOURCE_TITLE,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Icon from '../../kit/Icon.vue';

/** P9: metadata only. Nothing here reads file content or touches the source port. */
const props = defineProps<{ detail: FileDetailModel }>();
const clipboard = useClipboard();
const message = ref('');
watch(() => props.detail.file.id, () => { message.value = ''; });

async function copyPath(): Promise<void> {
  try {
    await clipboard.writeText(props.detail.file.path);
    message.value = COPY_27;
  } catch {
    message.value = FILE_COPY_FAILED;
  }
}
</script>

<template>
  <Panel
    :title="FILE_SOURCE_TITLE"
    :subtitle="FILE_SOURCE_SUBTITLE"
  >
    <template #actions>
      <button
        type="button"
        class="ci-source-context__copy"
        @click="copyPath"
      >
        <Icon name="copy" />
        {{ FILE_COPY_PATH }}
      </button>
    </template>
    <dl class="ci-facts ci-source-context">
      <dt>{{ FILE_FACT_PATH }}</dt>
      <dd><code>{{ detail.file.path }}</code></dd>
      <dt>{{ FILE_FACT_MODULE }}</dt>
      <dd>{{ detail.moduleLabel }}</dd>
      <dt>{{ FILE_FACT_CATEGORY }}</dt>
      <dd>{{ detail.category ?? '—' }}</dd>
      <dt>{{ FILE_FACT_LINES }}</dt>
      <dd>
        {{ formatMetric(detail.file.lines) }}
        <span
          v-if="!hasValue(detail.file.lines)"
          class="ci-source-context__reason"
        >{{ detail.file.lines.reason }}</span>
      </dd>
      <dt>{{ FILE_FACT_BYTES }}</dt>
      <dd>{{ formatMetric(detail.bytes) }}</dd>
    </dl>
    <p class="ci-source-context__note">
      {{ FILE_SOURCE_PREVIEW_LATER }}
    </p>
    <p
      class="ci-source-context__message"
      role="status"
    >
      {{ message }}
    </p>
  </Panel>
</template>
