<!--
  WP-02 — the inspector shell (spec §4.1). Owns navigation, the top bar and the content
  outlet. The city composition that used to live here is screens/CityWorkspace.vue,
  unchanged. Still exposes `rendererHost` (null off the city route) for tests that mount
  App directly.
-->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { RouteId } from '../domain/route-ids';
import { DRAWER_MAX_INLINE_SIZE } from './responsive';
import { NO_CODEBASE_LABEL } from './inspector-copy';
import { rootFolderLabel } from './read-models/root-label';
import { useCityStore } from './stores/city-store';
import { usePreferencesStore } from './stores/preferences-store';
import { useReportStore } from './stores/report-store';
import { useLeafWidth } from './shell/use-leaf-width';
import { provideLeafLayout } from './shell/leaf-layout';
import { useJournalFeed } from './shell/use-journal-feed';
import NavColumn from './shell/NavColumn.vue';
import TopBar from './shell/TopBar.vue';
import SnapshotSelector from './shell/SnapshotSelector.vue';
import CommandPalette from './shell/CommandPalette.vue';
import CityScreen from './screens/CityScreen.vue';
import OverviewScreen from './screens/OverviewScreen.vue';
import ArchitectureScreen from './screens/ArchitectureScreen.vue';
import HotspotsScreen from './screens/HotspotsScreen.vue';
import FileDetailScreen from './screens/FileDetailScreen.vue';
import QualityScreen from './screens/QualityScreen.vue';
import TestsScreen from './screens/TestsScreen.vue';
import DependenciesScreen from './screens/DependenciesScreen.vue';
import SecurityScreen from './screens/SecurityScreen.vue';
import EvolutionScreen from './screens/EvolutionScreen.vue';
import OwnershipScreen from './screens/OwnershipScreen.vue';
import WorkbenchScreen from './screens/WorkbenchScreen.vue';
import ReportScreen from './screens/ReportScreen.vue';
import SourcesScreen from './screens/SourcesScreen.vue';
import SettingsScreen from './screens/SettingsScreen.vue';

const store = useCityStore();
const preferences = usePreferencesStore();
const report = useReportStore();
useJournalFeed();

/** Controller ruling Part 4 E11 (amends Part 4 E8): the report store is bound to the current codebase
 *  here, at the shell level, regardless of which screen is open — a reviewer note or
 *  section choice must never survive onto a different codebase, even if Report was never
 *  the screen open while it was scanned in. Binding on the snapshot's own repository id
 *  (not just "a snapshot exists") clears a stale note/section choice the moment a
 *  different codebase is scanned into this leaf; re-binding the same repository is a
 *  no-op (report-store.ts's own guard). */
watch(() => store.snapshot?.repositoryId, (id) => { if (id) report.bindRepository(id); }, { immediate: true });
const rootEl = ref<HTMLElement | null>(null);
const leafWidth = useLeafWidth(rootEl);
/** Inline nav only when the leaf is measurably wide. 0 (hidden leaf, jsdom) keeps the
 *  drawer layout, so the city gets the whole leaf — exactly WP-01's behaviour. */
const navInline = computed(() => leafWidth.value >= DRAWER_MAX_INLINE_SIZE);
/** Part 5 V4/V5: this leaf's ONE measurement, shared with the city floor and the camera controls. */
provideLeafLayout(leafWidth, navInline);
const navOpen = ref(false);
const paletteOpen = ref(false);
let navOpener: HTMLElement | null = null;
/** Only a genuine drawer (narrow leaf, open) makes the content behind it `inert`; the
 *  inline nav shares the layout with the content, so it is never inert. */
const drawerOpen = computed(() => navOpen.value && !navInline.value);

// Controller ruling (Task 7 review, carried into Task 8): a drawer left open in a
// narrow leaf must not reappear once the leaf widens past 820px and back — inline
// nav has its own column, so `navOpen` no longer means anything once it is showing.
watch(navInline, (inline) => { if (inline) navOpen.value = false; });

const workspaceLabel = computed(() => {
  const root = store.snapshot?.scope.rootPath;
  return root ? rootFolderLabel(root) : NO_CODEBASE_LABEL;
});

function openNav(event?: Event): void {
  navOpener = (event?.currentTarget as HTMLElement | undefined) ?? rootEl.value?.querySelector<HTMLElement>('.ci-topbar__menu') ?? null;
  navOpen.value = true;
  void nextTick(() => rootEl.value?.querySelector<HTMLElement>('.ci-nav__item')?.focus());
}
function closeNav(): void {
  if (!navOpen.value) return;
  navOpen.value = false;
  // The opener lives behind the drawer; while it is `inert` a real browser refuses it
  // focus. Clear the state that drives `inert` first, then focus once that has patched
  // into the DOM (nextTick), so focus lands on an element that can actually take it.
  void nextTick(() => navOpener?.focus());
}
function navigate(route: RouteId): void {
  store.navigate(route);
  if (navOpen.value) closeNav();
}

/** Ctrl/Cmd+K while focus is anywhere inside THIS leaf (the listener sits on the shell
 *  root, never the document — two open leaves must not both react). */
function onShellKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    paletteOpen.value = true;
  }
}

interface CityScreenExposed { rendererHost: HTMLElement | null }
const cityScreen = ref<CityScreenExposed | null>(null);
const rendererHost = computed(() => cityScreen.value?.rendererHost ?? null);
defineExpose({ rendererHost });
</script>

<template>
  <div
    ref="rootEl"
    class="ci-shell"
    tabindex="-1"
    :class="{ 'ci-shell--nav-inline': navInline, 'ci-shell--nav-open': drawerOpen, 'ci-shell--compact': preferences.density === 'compact' }"
    @keydown="onShellKeydown"
  >
    <NavColumn
      :drawer="!navInline"
      :workspace-label="workspaceLabel"
      @navigate="navigate"
      @close="closeNav"
    />
    <div
      v-if="drawerOpen"
      class="ci-shell__scrim"
      aria-hidden="true"
      @click="closeNav"
    />
    <TopBar
      :workspace-label="workspaceLabel"
      :inert="drawerOpen || undefined"
      @open-nav="openNav()"
      @open-palette="paletteOpen = true"
    >
      <template #snapshot>
        <SnapshotSelector />
      </template>
    </TopBar>
    <main
      class="ci-shell__content"
      :inert="drawerOpen || undefined"
    >
      <CityScreen
        v-if="store.route === 'city'"
        ref="cityScreen"
      />
      <OverviewScreen v-else-if="store.route === 'overview'" />
      <ArchitectureScreen v-else-if="store.route === 'architecture'" />
      <HotspotsScreen v-else-if="store.route === 'hotspots'" />
      <FileDetailScreen v-else-if="store.route === 'file'" />
      <QualityScreen v-else-if="store.route === 'quality'" />
      <TestsScreen v-else-if="store.route === 'tests'" />
      <DependenciesScreen v-else-if="store.route === 'dependencies'" />
      <SecurityScreen v-else-if="store.route === 'security'" />
      <EvolutionScreen v-else-if="store.route === 'evolution'" />
      <OwnershipScreen v-else-if="store.route === 'ownership'" />
      <WorkbenchScreen v-else-if="store.route === 'workbench'" />
      <ReportScreen v-else-if="store.route === 'report'" />
      <SourcesScreen v-else-if="store.route === 'sources'" />
      <SettingsScreen v-else-if="store.route === 'settings'" />
    </main>
    <CommandPalette
      v-if="paletteOpen"
      @close="paletteOpen = false"
    />
  </div>
</template>
