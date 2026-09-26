// WP-04.2 spec §5 rows 3–4 (NE13, NE12): the city leaf in the real host's themes, and across an app restart.
// Scenario 3: a scanned city is recoloured by Obsidian's own `css-change` (probe d, NPF5) with no rebuild. Probe e
// (NPF6): the canvas element's WebDriver screenshot is at DPR 2 and its pixel (2,2) is the renderer's clear colour,
// the resolved `--ci-surface`. A switch to the current theme fires no `css-change`, so the themes always alternate.
// Scenario 4: a city leaf on Quality comes back on Quality after `reloadObsidian()` (NPF4), with no scan and no
// modal, and the no-snapshot state (the snapshot store is in memory, WP-01 §4.5); workspace.json holds no absolute
// path (WP-01 §4.4), in either of the vault's two spellings (NPF9: 8.3 and `realpathSync.native`'s long form).
// IPF20: nothing here matches Obsidian's own UI text; nav labels come from ROUTE_META (WP-04.2 E6).
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { ROUTE_META } from '../../src/ui/routes';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';
import { commandAvailable, setTheme } from './host-probes';
import { CITY_VIEW_TYPE, type NativeBrowser } from './session';
import { copyProject } from './workspace-files';

type Rgb = [number, number, number];
/** A mark set on the canvas element before the first switch: a rebuilt canvas would not carry it. */
const MARK = 'data-ci-e2e-canvas';
/** NE13: a background pixel matches its theme's surface within this much per sRGB channel. */
const TOLERANCE = 3;
/** NE13's positive control: the two themes' surfaces differ by more than this in some channel. */
const THEMES_APART = 24;

const distance = (a: readonly number[], b: readonly number[]): number => Math.max(...[0, 1, 2].map((i) => Math.abs((a[i] ?? 0) - (b[i] ?? 0))));

/** The city leaf's own `getState()` (Obsidian's View API), as workspace.json would get it. */
const leafState = (browser: NativeBrowser): Promise<Record<string, unknown>> => browser.executeObsidian(({ app }, type) => {
  const leaf = app.workspace.getLeavesOfType(type)[0];
  if (!leaf) throw new Error('no city leaf');
  return leaf.view.getState();
}, CITY_VIEW_TYPE);

/** How many canvases the city leaf holds, and how many of them carry MARK. */
const canvases = (browser: NativeBrowser): Promise<{ all: number; marked: number }> => browser.executeObsidian(({ app }, type, mark) => {
  const el = app.workspace.getLeavesOfType(type)[0]?.view.containerEl;
  return { all: el?.querySelectorAll('canvas').length ?? 0, marked: el?.querySelectorAll(`canvas[${mark}]`).length ?? 0 };
}, CITY_VIEW_TYPE, MARK);

/** The first layout node whose view state names the city type: that view state's own `state`, or null. */
function cityLeafIn(node: unknown): Record<string, unknown> | null {
  if (typeof node !== 'object' || node === null) return null;
  const viewState = (node as { state?: { type?: unknown; state?: unknown } }).state;
  if (viewState?.type === CITY_VIEW_TYPE) return (viewState.state ?? {}) as Record<string, unknown>;
  for (const child of Object.values(node)) {
    const found = cityLeafIn(child);
    if (found) return found;
  }
  return null;
}

/** The city leaf's saved state in `workspace.json` (the leaf whose view state names the city type), or null. */
async function savedCityState(browser: NativeBrowser): Promise<Record<string, unknown> | null> {
  const configDir = await browser.getObsidianPage().getConfigDir();
  const text = await browser.executeObsidian(async ({ app }, path) =>
    (await app.vault.adapter.exists(path)) ? app.vault.adapter.read(path) : null, `${configDir}/workspace.json`);
  return text === null ? null : cityLeafIn(JSON.parse(text));
}

/** Every path spelling in `paths` that `value` (serialised) holds, compared case-insensitively. */
const pathsIn = (value: unknown, paths: string[]): string[] => {
  const text = JSON.stringify(value).toLowerCase();
  return paths.filter((path) => text.includes(JSON.stringify(path).slice(1, -1).toLowerCase()) || text.includes(path.toLowerCase()));
};

describe('the city leaf in the real Obsidian host (WP-04.2 NE12, NE13)', () => {
  test('draws the city in dark and light themes and recolours on css-change without rebuilding', async ({ native: { browser, page, inspector, directory } }) => {
    copyProject(page.getVaultPath(), 'code');
    await inspector.openCity();
    await inspector.scanFolder('code');
    await inspector.navigate(ROUTE_META.city.title);
    await expect.poll(() => inspector.screen('city').isDisplayed()).toBe(true);
    await expect.poll(async () => (await canvases(browser)).all).toBe(1);
    // A selection to keep: the first file of the snapshot, through the leaf's own city store (selecting never moves
    // the camera, city-store.ts). The camera is the renderer's own auto-fit, mirrored through camera-changed.
    const selected = await browser.executeObsidian(({ app }, type): string => {
      type Store = { snapshot: { entities: { id: string; kind: string }[] } | null; select(id: string): void };
      const view = app.workspace.getLeavesOfType(type)[0]?.view as unknown as { cityStore?: Store } | undefined;
      const store = view?.cityStore;
      const file = store?.snapshot?.entities.find((entity) => entity.kind === 'file');
      if (!store || !file) throw new Error('the city leaf holds no file');
      store.select(file.id);
      return file.id;
    }, CITY_VIEW_TYPE);
    await expect.poll(async () => (await leafState(browser)).selectedEntityId).toBe(selected);
    await expect.poll(async () => (await leafState(browser)).camera).not.toBeNull();
    const { camera } = await leafState(browser);
    const canvasId = await inspector.root().$('canvas').elementId;
    await browser.executeObsidian(({ app }, type, mark) => {
      app.workspace.getLeavesOfType(type)[0]?.view.containerEl.querySelector('canvas')?.setAttribute(mark, '1');
    }, CITY_VIEW_TYPE, MARK);

    // Positive control, first (probe d): the two themes' surfaces are far enough apart for the pixel to tell them apart.
    const surface: Record<'dark' | 'light', Rgb> = { dark: await inspector.resolvedColor('--ci-surface'), light: [0, 0, 0] };
    await setTheme(browser, 'light');
    surface.light = await inspector.resolvedColor('--ci-surface');
    expect(distance(surface.dark, surface.light)).toBeGreaterThan(THEMES_APART);

    const observed: { theme: string; resolved: Rgb; pixel: number[]; size: number[]; elementId: string }[] = [];
    for (const [step, theme] of (['dark', 'light', 'dark'] as const).entries()) {
      await setTheme(browser, theme);
      const resolved = await inspector.resolvedColor('--ci-surface');
      expect(resolved).toEqual(surface[theme]);
      const file = join(directory, `canvas-${step}-${theme}.png`);
      await expect.poll(async () => distance((await inspector.canvasShot(file)).pixel(2, 2), resolved)).toBeLessThanOrEqual(TOLERANCE);
      const shot = await inspector.canvasShot(file);
      const elementId = await inspector.root().$('canvas').elementId;
      observed.push({ theme, resolved, pixel: shot.pixel(2, 2), size: [shot.width, shot.height], elementId });
      // Unchanged by the switch: the same canvas element (no rebuild, no second renderer), camera and selection.
      expect(elementId).toBe(canvasId);
      expect(await canvases(browser)).toEqual({ all: 1, marked: 1 });
      const state = await leafState(browser);
      expect(state.camera).toEqual(camera);
      expect(state.selectedEntityId).toBe(selected);
    }
    await writeEvidence(directory, 'theme', { surface, selected, camera, elementId: canvasId, observed });
  });

  test("restores the city leaf's route after an app restart without scanning", async ({ native: { browser, page, inspector, directory } }) => {
    const vault = page.getVaultPath();
    const paths = [vault, realpathSync.native(vault)];
    copyProject(vault, 'code');
    await inspector.openCity();
    // A scanned leaf, so its state names a profile and a snapshot a restore could be tempted to rescan.
    await inspector.scanFolder('code');
    await inspector.navigate(ROUTE_META.quality.title);
    await expect.poll(() => inspector.screen('quality').isDisplayed()).toBe(true);
    await expect.poll(async () => (await leafState(browser)).route).toBe('quality');
    // Obsidian's own layout save, forced now rather than on its debounce (probe c: it lands within ms).
    const forced = await browser.executeObsidian(async ({ app }): Promise<boolean> => {
      const save = (app.workspace as unknown as { requestSaveLayout?: (() => void) & { run?: () => unknown } }).requestSaveLayout;
      if (typeof save?.run !== 'function') return false;
      save();
      await save.run();
      return true;
    });
    await expect.poll(async () => (await savedCityState(browser))?.route).toBe('quality');
    const saved = await savedCityState(browser);
    // Positive control: the same check finds a vault path, in either spelling, in a state that holds one.
    expect(pathsIn({ rootPath: paths[1] }, paths)).toEqual([paths[1]]);
    expect(pathsIn(saved, paths)).toEqual([]);

    // A mark on the running app's window: a real restart starts a window without it.
    const marked = (): Promise<boolean> => browser.executeObsidian(() => 'ciBeforeRestart' in window);
    await browser.executeObsidian(() => { Object.assign(window, { ciBeforeRestart: true }); });
    expect(await marked()).toBe(true);
    await browser.reloadObsidian();
    expect(await marked()).toBe(false);
    await browser.executeObsidian(async ({ app }, type) => {
      const leaf = app.workspace.getLeavesOfType(type)[0];
      if (!leaf) throw new Error('the city leaf did not survive the restart');
      await app.workspace.revealLeaf(leaf);
    }, CITY_VIEW_TYPE);
    await expect.poll(() => inspector.screen('quality').isDisplayed()).toBe(true);
    await inspector.activateCity();
    const after = {
      leaves: await browser.executeObsidian(({ app }, type) => app.workspace.getLeavesOfType(type).length, CITY_VIEW_TYPE),
      state: await leafState(browser),
      noSnapshot: await inspector.screen('quality').$('.ci-no-snapshot').isExisting(),
      modals: await browser.$$('.modal-container').length,
      scanning: await commandAvailable(browser, 'cancel-scan'),
    };
    await writeEvidence(directory, 'restore', { paths, forced, saved, after });
    expect(after).toMatchObject({ leaves: 1, state: { route: 'quality' }, noSnapshot: true, modals: 0, scanning: false });
  }, 300_000);
});
