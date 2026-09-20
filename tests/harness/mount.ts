import { createApp, nextTick, shallowRef } from 'vue';
import { createPinia } from 'pinia';
import App from '../../src/ui/App.vue';
import { createCityRenderer } from '../../src/visualization/city-renderer';
import {
  CITY_RENDERER_KEY, LAYOUT_GENERATION_KEY, createLayoutGenerationSource,
} from '../../src/ui/renderer-handle';
import { readPalette } from '../../src/host/theme-bridge';
import { useCityStore } from '../../src/ui/stores/city-store';
import { harnessLayout, harnessSnapshot } from './fixture';
import { HARNESS_THEME_EVENT } from './theme';
import type { CityRendererPort } from '../../src/visualization/renderer-port';

export type ScreenId = 's05' | 's06' | 's07' | 's08' | 's09' | 's10' | 's11';

export interface HarnessOptions {
  screen: ScreenId;
}

export async function mountHarness(root: HTMLElement, options: HarnessOptions): Promise<void> {
  root.classList.add('codebase-inspector-root');

  // Same gap city-view.ts already carries an identical line for (src/host/city-view.ts,
  // near its own `createApp(RootComponent)`): typescript-eslint's type-aware linting
  // resolves a cross-file .vue import as an untyped/error module — it has no Vue SFC
  // language-service plugin, unlike vue-tsc, which DOES type-check this correctly (see
  // `npm run typecheck`). Real behaviour is unaffected; this is a lint-tooling gap, not
  // an unsafe value.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- see comment above: vue-tsc, not eslint's type-aware linting, is the accurate check here
  const app = createApp(App);
  app.use(createPinia());

  const handle = shallowRef<CityRendererPort | null>(null);
  app.provide(CITY_RENDERER_KEY, handle);
  app.provide(LAYOUT_GENERATION_KEY, createLayoutGenerationSource());
  // S11 is the WebGL-unavailable screen, and the honest way to reach it is to supply
  // no factory at all — CityViewport's `inject('createCityRenderer', null)` default is
  // exactly the "no renderer available" path. Faking it with a throwing factory would
  // photograph error recovery instead of the fallback.
  if (options.screen !== 's11') app.provide('createCityRenderer', createCityRenderer);

  app.mount(root);

  const store = useCityStore();
  store.setCity(harnessSnapshot(), harnessLayout());

  applyScreenState(store, options.screen);

  // The renderer re-reads its palette on Obsidian's `css-change`; here, on ours.
  window.addEventListener(HARNESS_THEME_EVENT, () => {
    handle.value?.setColors(readPalette(root));
  });

  await waitUntilDrawn(root, options.screen);
  document.body.dataset.ciHarnessReady = 'true';
}

function applyScreenState(store: ReturnType<typeof useCityStore>, screen: ScreenId): void {
  const firstFile = store.layout?.lots[0]?.entityId ?? null;
  switch (screen) {
    case 's07':
      if (firstFile) { store.select(firstFile); store.openInspector(); }
      break;
    case 's08':
      // A query that matches some files and not the selected one, which is what puts
      // COPY-30's "outside these filters" notice on screen — one of the two surfaces
      // Task 9 turns into real controls.
      if (firstFile) store.select(firstFile);
      store.setQuery('main');
      store.confirmSearch();
      break;
    case 's09':
      store.setViewMode('top');
      break;
    case 's11':
      store.setViewMode('list');
      break;
    default:
      break;                                   // s05, s06 and s10 are the resting state
  }
}

// `waitUntilDrawn` is what makes a capture trustworthy. Waiting for the canvas element
// to exist is not waiting for the city to draw — that is the mistake the source harness
// records paying for.
async function waitUntilDrawn(root: HTMLElement, screen: ScreenId): Promise<void> {
  await nextTick();
  if (screen === 's11') {
    // No canvas by design. The fallback list IS the drawn state.
    await until(() => root.querySelector('.ci-file-list__row') !== null);
    return;
  }
  await until(() => {
    const canvas = root.querySelector('canvas');
    // A canvas with a zero-sized drawing buffer has not drawn; a canvas sized to the
    // stage has. This is the difference between photographing the city and
    // photographing an empty box that will contain one shortly.
    return canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0;
  });
  // One more frame after the buffer exists, so what is photographed is a drawn frame
  // rather than a cleared one.
  await new Promise<void>((resolve) => { window.requestAnimationFrame(() => { window.requestAnimationFrame(() => resolve()); }); });
}

async function until(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('the harness never reached its drawn state; a capture would photograph a loading frame');
    await new Promise((resolve) => window.setTimeout(resolve, 16));
  }
}
