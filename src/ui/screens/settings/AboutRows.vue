<script setup lang="ts">
import {
  SETTINGS_ABOUT_NEVER, SETTINGS_ABOUT_NEVER_TEXT, SETTINGS_ABOUT_READS, SETTINGS_ABOUT_READS_TEXT, SETTINGS_ABOUT_SAMPLE,
  SETTINGS_ABOUT_SAMPLE_TEXT,
} from '../../inspector-copy';
</script>

<template>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_ABOUT_READS }}</h3>
      <p class="ci-note">
        {{ SETTINGS_ABOUT_READS_TEXT }}
      </p>
    </div>
  </div>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_ABOUT_NEVER }}</h3>
      <p class="ci-note">
        {{ SETTINGS_ABOUT_NEVER_TEXT }}
      </p>
    </div>
  </div>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_ABOUT_SAMPLE }}</h3>
      <p class="ci-note">
        {{ SETTINGS_ABOUT_SAMPLE_TEXT }}
      </p>
    </div>
  </div>
</template>
