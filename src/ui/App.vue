<!--
  WP-02 — the inspector shell (spec §4.1). Owns navigation, the top bar and the content
  outlet. The city composition that used to live here is screens/CityWorkspace.vue,
  unchanged. Still exposes `rendererHost` (null off the city route) for tests that mount
  App directly.
-->
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { RouteId } from '../domain/route-ids';
import { DRAWER_MAX_INLINE_SIZE } from './responsive';
import { NO_CODEBASE_LABEL } from './inspector-copy';
import { useCityStore } from './stores/city-store';
import { useLeafWidth } from './shell/use-leaf-width';
import NavColumn from './shell/NavColumn.vue';
import TopBar from './shell/TopBar.vue';
import CityScreen from './screens/CityScreen.vue';
import PlaceholderScreen from './screens/PlaceholderScreen.vue';

const store = useCityStore();
const rootEl = ref<HTMLElement | null>(null);
const leafWidth = useLeafWidth(rootEl);
/** Inline nav only when the leaf is measurably wide. 0 (hidden leaf, jsdom) keeps the
 *  drawer layout, so the city gets the whole leaf — exactly WP-01's behaviour. */
const navInline = computed(() => leafWidth.value >= DRAWER_MAX_INLINE_SIZE);
const navOpen = ref(false);
let navOpener: HTMLElement | null = null;

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

interface CityScreenExposed { rendererHost: HTMLElement | null }
const cityScreen = ref<CityScreenExposed | null>(null);
const rendererHost = computed(() => cityScreen.value?.rendererHost ?? null);
defineExpose({ rendererHost });
</script>

<template>
  <div
    ref="rootEl"
    class="ci-shell"
    :class="{ 'ci-shell--nav-inline': navInline, 'ci-shell--nav-open': navOpen && !navInline }"
  >
    <NavColumn
      :drawer="!navInline"
      :workspace-label="workspaceLabel"
      @navigate="navigate"
      @close="closeNav"
    />
    <TopBar
      :workspace-label="workspaceLabel"
      @open-nav="openNav()"
      @open-palette="() => {}"
    />
    <main class="ci-shell__content">
      <CityScreen
        v-if="store.route === 'city'"
        ref="cityScreen"
      />
      <PlaceholderScreen
        v-else
        :route="store.route"
      />
    </main>
  </div>
</template>
