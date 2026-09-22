<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ModuleSummary } from '../../read-models/architecture';
import { useReviewStore } from '../../stores/review-store';
import { RULE_RATIONALE_MAX } from '../../stores/ports/review-repository';
import { useUniqueId } from '../../unique-id';
import {
  RULE_EDITOR_CANCEL, RULE_EDITOR_DUPLICATE, RULE_EDITOR_FAILED, RULE_EDITOR_FROM, RULE_EDITOR_HINT,
  RULE_EDITOR_RATIONALE, RULE_EDITOR_SAME_MODULE, RULE_EDITOR_SAVE, RULE_EDITOR_TITLE, RULE_EDITOR_TO,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';

const props = defineProps<{ modules: readonly ModuleSummary[]; initialFrom: string | null }>();
const emit = defineEmits<{ close: []; saved: [id: string] }>();
const review = useReviewStore();
const base = useUniqueId('ci-rule');

/** F3: never open on a module that is not among the options (a stale selection). */
const known = props.modules.some((m) => m.name === props.initialFrom);
const from = ref(known && props.initialFrom !== null ? props.initialFrom : props.modules[0]?.name ?? '');
const to = ref(props.modules.find((m) => m.name !== from.value)?.name ?? '');
const rationale = ref('');
const error = ref('');
const saving = ref(false);
/** F4: a refusal describes the pair it was given; changing either module retires it. */
watch([from, to], () => { error.value = ''; });
const invalid = computed(() => from.value === '' || to.value === '' || from.value === to.value || rationale.value.trim() === '');

/** Intent only: the rule is recorded through the review port and evaluated against
 *  sample edges. Nothing in the source is touched. */
async function save(): Promise<void> {
  if (invalid.value || saving.value) return;
  error.value = '';
  if (review.hasRule(from.value, to.value)) { error.value = RULE_EDITOR_DUPLICATE; return; }
  saving.value = true;
  try {
    const rule = await review.addRule(from.value, to.value, rationale.value, new Date());
    if (rule) emit('saved', rule.id); else error.value = RULE_EDITOR_DUPLICATE;
  } catch {
    error.value = RULE_EDITOR_FAILED;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <CiDialog
    :label="RULE_EDITOR_TITLE"
    @close="emit('close')"
  >
    <form
      class="ci-rule-editor"
      @submit.prevent="save"
    >
      <h3 class="ci-rule-editor__title">
        {{ RULE_EDITOR_TITLE }}
      </h3>
      <p class="ci-rule-editor__hint">
        {{ RULE_EDITOR_HINT }}
      </p>
      <label :for="`${base}-from`">{{ RULE_EDITOR_FROM }}</label>
      <select
        :id="`${base}-from`"
        v-model="from"
        class="dropdown"
      >
        <option
          v-for="m in modules"
          :key="m.name"
          :value="m.name"
        >
          {{ m.label }}
        </option>
      </select>
      <label :for="`${base}-to`">{{ RULE_EDITOR_TO }}</label>
      <select
        :id="`${base}-to`"
        v-model="to"
        class="dropdown"
      >
        <option
          v-for="m in modules"
          :key="m.name"
          :value="m.name"
        >
          {{ m.label }}
        </option>
      </select>
      <label :for="`${base}-why`">{{ RULE_EDITOR_RATIONALE }}</label>
      <textarea
        :id="`${base}-why`"
        v-model="rationale"
        rows="3"
        :maxlength="RULE_RATIONALE_MAX"
      />
      <p
        v-if="from !== '' && from === to"
        class="ci-rule-editor__error"
        role="alert"
      >
        {{ RULE_EDITOR_SAME_MODULE }}
      </p>
      <p
        v-else-if="error"
        class="ci-rule-editor__error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="ci-rule-editor__actions">
        <button
          type="button"
          @click="emit('close')"
        >
          {{ RULE_EDITOR_CANCEL }}
        </button>
        <button
          type="submit"
          class="mod-cta"
          :disabled="invalid || saving"
        >
          {{ RULE_EDITOR_SAVE }}
        </button>
      </div>
    </form>
  </CiDialog>
</template>
