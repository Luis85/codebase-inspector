<script setup lang="ts">
// Part 7 Z31: exactly what will run, as text. Every path is in a <code>; the arguments are one
// <code> per argv item, so nothing is re-quoted; the side effects come before "Trust and
// run" (which the route renders after this). The version is checked only after trusting.
import { computed } from 'vue';
import { formatAbsoluteTime } from '../../copy';
import { formatBytes } from '../../read-models/sources';
import { FALLOW_TESTED_VERSIONS, type RunReview } from '../../read-models/fallow-run';
import {
  FALLOW_FORMAT_LABEL, FALLOW_REVIEW_EFFECTS, FALLOW_REVIEW_EFFECTS_TITLE, FALLOW_REVIEW_ENV, FALLOW_REVIEW_INSIDE_ROOT,
  FALLOW_REVIEW_LIMIT, FALLOW_REVIEW_ROW_ARGS, FALLOW_REVIEW_ROW_CWD, FALLOW_REVIEW_ROW_ENV, FALLOW_REVIEW_ROW_EXECUTABLE,
  FALLOW_REVIEW_ROW_FOLDER, FALLOW_REVIEW_ROW_FORMAT, FALLOW_REVIEW_ROW_LIMIT, FALLOW_REVIEW_ROW_MODIFIED, FALLOW_REVIEW_ROW_SIZE,
  FALLOW_REVIEW_ROW_VERSION, FALLOW_REVIEW_VERSION_KNOWN, FALLOW_REVIEW_VERSION_PENDING,
} from '../../inspector-copy';

const props = defineProps<{ review: RunReview }>();
const modified = computed(() => formatAbsoluteTime(new Date(props.review.facts.mtimeMs).toISOString(), Intl));
const realDiffers = computed(() => props.review.facts.realPath !== props.review.facts.executablePath);
const version = computed(() => {
  const v = props.review.trustedVersion;
  return v === null ? FALLOW_REVIEW_VERSION_PENDING : FALLOW_REVIEW_VERSION_KNOWN(v, FALLOW_TESTED_VERSIONS.includes(v));
});
</script>

<template>
  <div class="ci-fallow-review">
    <dl class="ci-fallow-review__facts">
      <dt>{{ FALLOW_REVIEW_ROW_EXECUTABLE }}</dt>
      <dd class="ci-fallow-review__executable">
        <code>{{ review.facts.executablePath }}</code>
        <template v-if="realDiffers">
          → <code>{{ review.facts.realPath }}</code>
        </template>
      </dd>
      <dt>{{ FALLOW_REVIEW_ROW_SIZE }}</dt>
      <dd>{{ formatBytes(review.facts.size) }}</dd>
      <dt>{{ FALLOW_REVIEW_ROW_MODIFIED }}</dt>
      <dd>{{ modified }}</dd>
      <dt>{{ FALLOW_REVIEW_ROW_FORMAT }}</dt>
      <dd>{{ FALLOW_FORMAT_LABEL[review.facts.format] }}</dd>
      <dt>{{ FALLOW_REVIEW_ROW_FOLDER }}</dt>
      <dd class="ci-fallow-review__root">
        <code>{{ review.rootPath }}</code>
      </dd>
      <dt>{{ FALLOW_REVIEW_ROW_CWD }}</dt>
      <dd class="ci-fallow-review__cwd">
        <code>{{ review.rootPath }}</code>
      </dd>
      <dt>{{ FALLOW_REVIEW_ROW_ARGS }}</dt>
      <dd>
        <ol class="ci-fallow-review__argv">
          <li
            v-for="(arg, i) in review.args"
            :key="i"
          >
            <code>{{ arg }}</code>
          </li>
        </ol>
      </dd>
      <dt>{{ FALLOW_REVIEW_ROW_ENV }}</dt>
      <dd>{{ FALLOW_REVIEW_ENV }}</dd>
      <dt>{{ FALLOW_REVIEW_ROW_LIMIT }}</dt>
      <dd>{{ FALLOW_REVIEW_LIMIT(review.timeoutSeconds) }}</dd>
      <dt>{{ FALLOW_REVIEW_ROW_VERSION }}</dt>
      <dd>{{ version }}</dd>
    </dl>
    <h4>{{ FALLOW_REVIEW_EFFECTS_TITLE }}</h4>
    <ul class="ci-fallow-review__effects">
      <li
        v-for="line in FALLOW_REVIEW_EFFECTS"
        :key="line"
      >
        {{ line }}
      </li>
    </ul>
    <p
      v-if="review.facts.insideRoot"
      class="ci-fallow-review__inside"
    >
      {{ FALLOW_REVIEW_INSIDE_ROOT }}
    </p>
  </div>
</template>
