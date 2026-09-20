<!--
  C12 — names the AGE of the retained snapshot currently on screen. Purely
  presentational: it reads `cityStore.snapshot` and renders, and does nothing else —
  in particular, it never starts, refreshes or otherwise authorises a scan (spec
  4.2/4.5: reopening a view and showing its retained in-memory state never
  authorises one). `now` is injectable so tests do not depend on the real clock.
-->
<script setup lang="ts">
import { computed, inject } from 'vue';
import { useCityStore } from '../stores/city-store';
import { CLAIM_READ_ONLY_ACCESS, CLAIM_SOURCE_UNCHANGED } from '../copy';

const store = useCityStore();
const now = inject<() => Date>('now', () => new Date());

function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

const ageText = computed(() => {
  const snapshot = store.snapshot;
  if (!snapshot) return null;
  const capturedAt = new Date(snapshot.providerRun.capturedAt).getTime();
  return formatAge(Math.max(0, now().getTime() - capturedAt));
});
</script>

<template>
  <!-- Task 9 fix round 1, item 9: not in the microcopy catalogue under any
       COPY id — COPY-16 ("Showing evidence from {absoluteDate}...") is about
       STALE PROVIDER evidence (a WP-02+ concept), not this snapshot's own
       retained age. Authored fresh, factual and brief, matching the
       catalogue's own tone. -->
  <p
    v-if="ageText"
    class="ci-snapshot-status"
  >
    Snapshot retained from {{ ageText }}.
    <!-- THE TWO FACTUAL CLAIMS (spec 5.2 and 10), shipped by task 12 with the
         evidence that makes them true: docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md,
         section G2 — the boundary matrix, a whole-tree hash diff (content, size AND
         mtime) over a 1,000-file vault WITH THIS PLUGIN INSTALLED showing zero
         differences, and a read-log proof that excluded paths, including the actual
         `vault.configDir`, are never opened. The scope modal makes the same two claims
         BEFORE the read; this is the AFTER — beside the snapshot they are about, which
         is where someone actually wonders what the scan did to their files.

         Inside the `v-if`, deliberately: a safety claim with no scan behind it is a
         claim about nothing, and this component's own test asserts it renders nothing
         at all without a snapshot. If the G2 record ceases to hold, this comes out. -->
    <span class="ci-snapshot-status__claims">
      {{ CLAIM_READ_ONLY_ACCESS }} · {{ CLAIM_SOURCE_UNCHANGED }}
    </span>
  </p>
</template>
