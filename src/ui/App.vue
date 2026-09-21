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
import { useCityStore } from './stores/city-store';
import { useLeafWidth } from './shell/use-leaf-width';
import NavColumn from './shell/NavColumn.vue';
import TopBar from './shell/TopBar.vue';
import SnapshotSelector from './shell/SnapshotSelector.vue';
import CommandPalette from './shell/CommandPalette.vue';
import CityScreen from './screens/CityScreen.vue';
import OverviewScreen from './screens/OverviewScreen.vue';
import ArchitectureScreen from './screens/ArchitectureScreen.vue';
import HotspotsScreen from './screens/HotspotsScreen.vue';
import FileDetailScreen from './screens/FileDetailScreen.vue';
import PlaceholderScreen from './screens/PlaceholderScreen.vue';

const store = useCityStore();
const rootEl = ref<HTMLElement | null>(null);
const leafWidth = useLeafWidth(rootEl);
/** Inline nav only when the leaf is measurably wide. 0 (hidden leaf, jsdom) keeps the
 *  drawer layout, so the city gets the whole leaf — exactly WP-01's behaviour. */
const navInline = computed(() => leafWidth.value >= DRAWER_MAX_INLINE_SIZE);
const navOpen = ref(false);
const paletteOpen = ref(false);
let navOpener: HTMLElement | null = null;

// Controller ruling (Task 7 review, carried into Task 8): a drawer left open in a
// narrow leaf must not reappear once the leaf widens past 820px and back — inline
// nav has its own column, so `navOpen` no longer means anything once it is showing.
watch(navInline, (inline) => { if (inline) navOpen.value = false; });

const workspaceLabel = computed(() => {
  const root = store.snapshot?.scope.rootPath;
  if (!root) return NO_CODEBASE_LABEL;
  const normalized = root.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.slice(normalized.lastIndexOf('/') + 1) || normalized;
});

function openNav(event?: Event): void {
  navOpener = (event?.currentTarget as HTMLElement | undefined) ?? rootEl.value?.querySelector<HTMLElement>('.ci-topbar__menu') ?? null;
  navOpen.value = true;
  void nextTick(() => rootEl.value?.querySelector<HTMLElement>('.ci-nav__item')?.focus());
}
function closeNav(): void {
  if (!navOpen.value) return;
  navOpen.value = false;
  navOpener?.focus();
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
    :class="{ 'ci-shell--nav-inline': navInline, 'ci-shell--nav-open': navOpen && !navInline }"
    @keydown="onShellKeydown"
  >
    <NavColumn
      :drawer="!navInline"
      :workspace-label="workspaceLabel"
      @navigate="navigate"
      @close="closeNav"
    />
    <div
      v-if="navOpen && !navInline"
      class="ci-shell__scrim"
      aria-hidden="true"
      @click="closeNav"
    />
    <TopBar
      :workspace-label="workspaceLabel"
      @open-nav="openNav()"
      @open-palette="paletteOpen = true"
    >
      <template #snapshot>
        <SnapshotSelector />
      </template>
    </TopBar>
    <main class="ci-shell__content">
      <CityScreen
        v-if="store.route === 'city'"
        ref="cityScreen"
      />
      <OverviewScreen v-else-if="store.route === 'overview'" />
      <ArchitectureScreen v-else-if="store.route === 'architecture'" />
      <HotspotsScreen v-else-if="store.route === 'hotspots'" />
      <FileDetailScreen v-else-if="store.route === 'file'" />
      <PlaceholderScreen
        v-else
        :route="store.route"
      />
    </main>
    <CommandPalette
      v-if="paletteOpen"
      @close="paletteOpen = false"
    />
  </div>
</template>
