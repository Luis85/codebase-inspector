// GRC5 (GCO13): axe over the Explore and Audit routes, every state the brief names, each
// mounted in the whole leaf with the harness seed (axe-support.ts) so it renders WITH
// content. The Act and Configure routes are axe-routes-act.test.ts.
import { afterEach, describe, expect, it } from 'vitest';
import { CANCELLING_BANNER, DEPS_LICENSES_TITLE, TESTS_RUNS_TITLE } from '../../src/ui/inspector-copy';
import { RETRY_3D } from '../../src/ui/copy';
import { expectAccessible, expectTabAccessible, inertRenderer, mountLeaf, openTab, settle, sizeCityStage, unmountLeaf } from './axe-support';

describe('axe: the shell, Overview and the code city', () => {
  afterEach(() => { unmountLeaf(); });

  it('Overview, with the inline navigation and the top bar', async () => {
    const { root } = await mountLeaf({ route: 'overview', twoSnapshots: true });
    await expectAccessible(root, '.ci-nav__item[aria-current="page"]');
    await expectAccessible(root, '.ci-screen--overview .ci-metric-card');
  });

  it('the navigation drawer, open in a narrow leaf', async () => {
    const { root } = await mountLeaf({ route: 'overview', leafWidth: 600 });
    root.querySelector<HTMLElement>('.ci-topbar__menu')?.click();
    await settle();
    await expectAccessible(root, '.ci-shell--nav-open .ci-nav__item');
  });

  it('S05: the city at rest, with a live renderer and the camera controls', async () => {
    sizeCityStage();
    const { root } = await mountLeaf({ route: 'city', createCityRenderer: inertRenderer() });
    await expectAccessible(root, '.ci-app .ci-file-list__row');
  });

  it('S07: a file selected, the inspector open', async () => {
    sizeCityStage();
    const { root, store } = await mountLeaf({ route: 'city', createCityRenderer: inertRenderer() });
    store.select(store.layout!.lots[4]!.entityId);
    store.openInspector();
    await settle();
    await expectAccessible(root, '.ci-inspector');
  });

  it('S08: a confirmed search that filters the list, the selection outside it', async () => {
    sizeCityStage();
    const { root, store } = await mountLeaf({ route: 'city', createCityRenderer: inertRenderer() });
    store.select(store.layout!.lots[0]!.entityId);
    store.setQuery('main');
    store.confirmSearch();
    await settle();
    await expectAccessible(root, '.ci-file-list__row');
  });

  it('S09: the top view', async () => {
    sizeCityStage();
    const { root, store } = await mountLeaf({ route: 'city', createCityRenderer: inertRenderer() });
    store.setViewMode('top');
    await settle();
    await expectAccessible(root, '.ci-camera-controls');
  });

  it('S10: a narrow leaf, a file selected, the inspector in its drawer', async () => {
    sizeCityStage();
    const { root, store } = await mountLeaf({ route: 'city', leafWidth: 700, createCityRenderer: inertRenderer() });
    store.select(store.layout!.lots[4]!.entityId);
    store.openInspector();
    await settle();
    await expectAccessible(root, '.ci-inspector');
  });

  it('S11: the list-only fallback', async () => {
    const { root, store } = await mountLeaf({ route: 'city' });
    store.setViewMode('list');
    await settle();
    await expectAccessible(root, '.ci-file-list__row');
  });

  it('S11: WebGL failed, the notice over the list', async () => {
    sizeCityStage();
    const { root } = await mountLeaf({ route: 'city', createCityRenderer: inertRenderer(true) });
    await expectAccessible(root, '.ci-viewport__notice');
  });

  it('S11: the Retry 3D button beside the notice, after an initialization failure', async () => {
    sizeCityStage();
    const { root } = await mountLeaf({ route: 'city', createCityRenderer: inertRenderer(true) });
    // A named, enabled button: the pin that a notice without its retry cannot pass vacuously.
    const retry = root.querySelector<HTMLButtonElement>('button.ci-viewport__retry');
    expect(retry?.textContent).toBe(RETRY_3D);
    await expectAccessible(root, '.ci-viewport__retry');
  });

  it('sizeCityStage leaves no clientWidth or clientHeight override on HTMLElement.prototype once the leaf is unmounted', async () => {
    sizeCityStage();
    await mountLeaf({ route: 'city', createCityRenderer: inertRenderer() });
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')).toBeDefined();
    unmountLeaf();
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')).toBeUndefined();
  });

  it('the cancelling banner over the snapshot', async () => {
    const { root } = await mountLeaf({ route: 'city', run: 'cancelling' });
    const banner = Array.from(root.querySelectorAll('.ci-status-banner[role="status"]')).filter((b) => b.textContent?.trim() === CANCELLING_BANNER(true));
    expect(banner, 'the banner reads the cancelling words over a snapshot').toHaveLength(1);
    await expectAccessible(root, '.ci-status-banner');
  });
});

describe('axe: Architecture and Hotspots', () => {
  afterEach(() => { unmountLeaf(); });

  // Each tab's own content: a selector no other tab renders.
  const ARCHITECTURE: ReadonlyArray<readonly [string, string]> = [
    ['map', '.ci-module-map__node'],
    ['matrix', '.ci-matrix__cell'],
    ['cycles', '.ci-cycle-list__row'],
    ['edges', '.ci-edge-list .ci-table__row'],
    ['rules', '.ci-architecture__fallow'],
  ];
  for (const [tab, content] of ARCHITECTURE) {
    it(`Architecture, the ${tab} tab`, async () => {
      const { root } = await mountLeaf({ route: 'architecture', items: true });
      await openTab(root, tab);
      await expectTabAccessible(root, tab, content);
    });
  }

  it('Hotspots, the scatter and the ranked table', async () => {
    const { root } = await mountLeaf({ route: 'hotspots' });
    await expectAccessible(root, '.ci-scatter__dot');
    await expectAccessible(root, '.ci-table__row');
  });
});

describe('axe: the Audit routes', () => {
  afterEach(() => { unmountLeaf(); });

  it('Code quality, with the findings table', async () => {
    const { root } = await mountLeaf({ route: 'quality' });
    await expectAccessible(root, '.ci-findings-table__open');
  });

  // [tab, content selector, text that element must read]. Results and Licenses have no class of their own in the
  // seeded state (an unknown-evidence state, a table of rows), so their panel title says which tab it is.
  const TESTS: ReadonlyArray<readonly [string, string, string?]> = [
    ['map', '.ci-coverage-map__tile'],
    ['results', '.ci-panel__title', TESTS_RUNS_TITLE],
    ['mutation', '.ci-tests__configure'],
  ];
  for (const [tab, content, text] of TESTS) {
    it(`Test confidence, the ${tab} tab`, async () => {
      const { root } = await mountLeaf({ route: 'tests' });
      await openTab(root, tab);
      await expectTabAccessible(root, tab, content, text);
    });
  }

  const DEPENDENCIES: ReadonlyArray<readonly [string, string, string?]> = [
    ['inventory', '.ci-packages .ci-table__row'],
    ['path', '.ci-dep-path__card'],
    ['licenses', '.ci-panel__title', DEPS_LICENSES_TITLE],
  ];
  for (const [tab, content, text] of DEPENDENCIES) {
    it(`Dependencies, the ${tab} tab`, async () => {
      const { root } = await mountLeaf({ route: 'dependencies' });
      await openTab(root, tab);
      await expectTabAccessible(root, tab, content, text);
    });
  }

  const SECURITY: ReadonlyArray<readonly [string, string]> = [
    ['advisories', '.ci-advisory'],
    ['secrets', '.ci-security__configure'],
    ['policy', '.ci-policy'],
  ];
  for (const [tab, content] of SECURITY) {
    it(`Security, the ${tab} tab`, async () => {
      const { root } = await mountLeaf({ route: 'security' });
      await openTab(root, tab);
      await expectTabAccessible(root, tab, content);
    });
  }

  it('Evolution, with two snapshots in the journal', async () => {
    const { root } = await mountLeaf({ route: 'evolution', twoSnapshots: true });
    await expectAccessible(root, '.ci-evolution__compare');
  });

  it('Ownership', async () => {
    const { root } = await mountLeaf({ route: 'ownership' });
    await expectAccessible(root, '.ci-stewardship__city');
  });
});
