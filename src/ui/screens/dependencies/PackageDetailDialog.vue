<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SamplePackage } from '../../fixtures/sample-packages';
import { formatMetric, sample } from '../../evidence';
import { reviewFailureText } from '../../read-models/review-failure';
import { useReviewStore } from '../../stores/review-store';
import type { WorkTarget } from '../../stores/ports/review-repository';
import {
  DEPS_COL_LICENSE, DEPS_LICENSE_UNRESOLVED, DEPS_RELATIONSHIP_LABEL, DEPS_STATUS_LABEL, NO_VALUE, PACKAGE_ADVISORY_UNKNOWN,
  PACKAGE_CLOSE, PACKAGE_CREATE_REVIEW, PACKAGE_DEMO_BADGE, PACKAGE_DIALOG_SUBTITLE, PACKAGE_IN_REVIEW,
  PACKAGE_INSTALLED, PACKAGE_METADATA_NOTE, PACKAGE_REFERENCES, PACKAGE_REVIEW_ADDED, PACKAGE_REVIEW_FAILED,
  PACKAGE_REVIEW_TITLE, PACKAGE_TARGET, PACKAGE_UNUSED_NOTE,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';
import Callout from '../../kit/Callout.vue';

const props = defineProps<{ pkg: SamplePackage }>();
const emit = defineEmits<{ close: [] }>();
const review = useReviewStore();
const status = ref('');
const error = ref('');

const target = computed<WorkTarget>(() => ({ kind: 'package', name: props.pkg.name }));
const exists = computed(() => review.hasWorkItem(target.value, 'review'));
const pending = computed(() => review.isPending(target.value, 'review'));
const blocked = computed(() => exists.value || pending.value);

/** E44: the button never becomes `disabled` — disabling the focused control would drop
 *  focus out of the dialog — so a blocked press is ignored here instead. The outcome is
 *  announced INSIDE the dialog (E55), same reasoning as FindingReviewDialog. */
async function createReview(): Promise<void> {
  if (blocked.value) return;
  error.value = '';
  try {
    const item = await review.addWorkItem(
      target.value, 'review', PACKAGE_REVIEW_TITLE(props.pkg.name, props.pkg.advisory?.id ?? null), new Date(),
    );
    if (item) status.value = PACKAGE_REVIEW_ADDED;
  } catch (e) {
    error.value = reviewFailureText(e, PACKAGE_REVIEW_FAILED);
  }
}
</script>

<template>
  <CiDialog
    :label="pkg.name"
    :status="status"
    @close="emit('close')"
  >
    <div class="ci-package-dialog">
      <h3 class="ci-package-dialog__title">
        {{ pkg.name }}
      </h3>
      <p class="ci-package-dialog__subtitle">
        {{ PACKAGE_DIALOG_SUBTITLE }}
      </p>
      <p class="ci-package-dialog__chips">
        <span
          class="ci-chip"
          :class="`ci-chip--dep-${pkg.status}`"
        >{{ DEPS_STATUS_LABEL[pkg.status] }}</span>
        <span class="ci-chip">{{ DEPS_RELATIONSHIP_LABEL[pkg.relationship] }}</span>
        <span class="ci-chip ci-chip--sample">{{ PACKAGE_DEMO_BADGE }}</span>
      </p>
      <dl class="ci-package-dialog__meta">
        <dt>{{ PACKAGE_INSTALLED }}</dt>
        <dd><code>{{ pkg.version }}</code></dd>
        <dt>{{ PACKAGE_TARGET }}</dt>
        <dd>{{ pkg.target ?? NO_VALUE }}</dd>
        <dt>{{ DEPS_COL_LICENSE }}</dt>
        <dd>{{ pkg.license ?? DEPS_LICENSE_UNRESOLVED }}</dd>
        <dt>{{ PACKAGE_REFERENCES }}</dt>
        <dd>{{ formatMetric(sample(pkg.references)) }}</dd>
      </dl>
      <Callout
        v-if="pkg.advisory"
        tone="warning"
        :title="pkg.advisory.id"
      >
        {{ pkg.advisory.summary }} {{ PACKAGE_ADVISORY_UNKNOWN }}
      </Callout>
      <p
        v-else-if="pkg.status === 'unused'"
        class="ci-note"
      >
        {{ PACKAGE_UNUSED_NOTE }}
      </p>
      <p
        v-else
        class="ci-note"
      >
        {{ PACKAGE_METADATA_NOTE }}
      </p>
      <div class="ci-package-dialog__actions">
        <button
          type="button"
          class="ci-package-dialog__review"
          :aria-disabled="blocked"
          @click="createReview"
        >
          {{ exists ? PACKAGE_IN_REVIEW : PACKAGE_CREATE_REVIEW }}
        </button>
        <button
          type="button"
          class="ci-package-dialog__close"
          @click="emit('close')"
        >
          {{ PACKAGE_CLOSE }}
        </button>
      </div>
      <p
        v-if="error"
        class="ci-package-dialog__error"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
  </CiDialog>
</template>
