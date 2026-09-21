<!--
  C12 — names the AGE of the retained snapshot currently on screen. Purely
  presentational: it reads `cityStore.snapshot` and renders, and does nothing else —
  in particular, it never starts, refreshes or otherwise authorises a scan (spec
  4.2/4.5: reopening a view and showing its retained in-memory state never
  authorises one). `now` is injectable so tests do not depend on the real clock.
-->
<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { useCityStore } from '../stores/city-store';
import { countDirectoryDistricts } from '../../domain/layout/districts';
import {
  CLAIM_READ_ONLY_ACCESS, CLAIM_SOURCE_UNCHANGED,
  formatAbsoluteTime, formatSnapshotScopeCounts, formatSnapshotScopeRoot,
} from '../copy';

const store = useCityStore();
const now = inject<() => Date>('now', () => new Date());

// Task 8 (spec 4.4's cross-window rule; the codebase's own established pattern —
// see clipboard.ts, container-box.ts, FileSearch.vue's `timerWin`): the absolute
// time is formatted through the VIEW'S OWNING window's own `Intl`, resolved from
// this component's own root element, never a bare `Intl`/`new Date().toLocaleString()`
// against the module's global. `win` is null on the very first render (template refs
// are not assigned until after that pass mounts) and outside a real host that has not
// installed the `.win` extension; formatAbsoluteTime's own output does not actually
// depend on which `Intl` object formats it (the locale tag is fixed, not
// `win.navigator.language`), so this fallback changes no rendered text — it exists
// for the same defensive-by-construction reason every other window-scoped read in
// this codebase does.
// `Window` (lib.dom.d.ts) does not itself declare `Intl` -- it is a plain global
// (`declare var Intl`), not a member of the `Window` interface -- so the cast names
// only the one property this file actually reads off it, the same shape clipboard.ts's
// own `WinBearing` uses for `.win`.
interface WinBearing { win?: { Intl?: typeof Intl } }
const rootEl = ref<HTMLElement | null>(null);
const ownerIntl = computed<typeof Intl>(() => (rootEl.value as unknown as WinBearing | null)?.win?.Intl ?? Intl);

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

// C12: "Absolute time and scope are available in details." Both counts read from
// the SAME LayoutResult CityHeader.vue's own subtitle does (store.layout.lots.length,
// countDirectoryDistricts(store.layout.districts)) — never re-derived, so the header
// and this footer cannot independently get the off-by-one wrong in two different ways
// (see countDirectoryDistricts's own comment in districts.ts).
const scopeCountsText = computed(() => {
  const layout = store.layout;
  if (!layout) return '';
  return formatSnapshotScopeCounts(layout.lots.length, countDirectoryDistricts(layout.districts));
});

const absoluteTimeText = computed(() => {
  const snapshot = store.snapshot;
  if (!snapshot) return '';
  return formatAbsoluteTime(snapshot.providerRun.capturedAt, ownerIntl.value);
});

const scopeRootText = computed(() => {
  const snapshot = store.snapshot;
  if (!snapshot) return '';
  return formatSnapshotScopeRoot(snapshot.scope.rootPath);
});
</script>

<template>
  <!-- Task 9 fix round 1, item 9: not in the microcopy catalogue under any
       COPY id — COPY-16 ("Showing evidence from {absoluteDate}...") is about
       STALE PROVIDER evidence (a WP-02+ concept), not this snapshot's own
       retained age. Authored fresh, factual and brief, matching the
       catalogue's own tone. -->
  <div
    v-if="ageText"
    ref="rootEl"
    class="ci-snapshot-status"
  >
    <p class="ci-snapshot-status__age">
      Snapshot retained from {{ ageText }}.
      <!-- THE TWO FACTUAL CLAIMS (spec 5.2 and 10), shipped by task 12 with the
           evidence that makes them true: docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md,
           section G2 — the boundary matrix, a whole-tree hash diff (content, size AND
           mtime) over a 1,000-file vault WITH THIS PLUGIN INSTALLED showing zero
           differences, and a read-log proof that excluded paths, including the actual
           `vault.configDir`, are never opened. The scope modal makes the same two claims
           BEFORE the read; this is the AFTER — beside the snapshot they are about, which
           is where someone actually wonders what the scan did to their files.

           Inside the outer `v-if="ageText"`, deliberately: a safety claim with no scan
           behind it is a claim about nothing, and this component's own test asserts it
           renders nothing at all without a snapshot. If the G2 record ceases to hold,
           this comes out. -->
      <span class="ci-snapshot-status__claims">
        {{ CLAIM_READ_ONLY_ACCESS }} · {{ CLAIM_SOURCE_UNCHANGED }}
      </span>
    </p>
    <!-- C12: "Absolute time and scope are available in details." A <details>, not a
         second always-visible line — the relative age above is the summary a glance
         needs; this is the evidence someone reaches for deliberately. `<summary>` is
         NOT a `<button>`: it is its own interactive element with its own native
         open/closed semantics (not a click handler this component installs), so
         M113's skinned-button recipe (type selector + explicit :hover rule) does not
         apply to it and tests/unit/host-cascade.test.ts's PLUGIN_SKINNED_BUTTONS sweep
         is deliberately NOT extended for it. Never toggled by `hidden`/`v-show` (this
         whole block only exists via `v-if="ageText"`), so the cascade trap an
         author-origin `display` rule would spring against the browser's own
         `[hidden]` default does not apply here either. -->
    <details class="ci-snapshot-status__details">
      <summary>Snapshot details</summary>
      <p>{{ scopeCountsText }}</p>
      <p>Captured {{ absoluteTimeText }}. {{ scopeRootText }}</p>
    </details>
  </div>
</template>
