// GRC5 (GCO13): axe over the Explore and Audit routes, every state the brief names, each
// mounted in the whole leaf with the harness seed (axe-support.ts) so it renders WITH
// content. The Act and Configure routes are axe-routes-act.test.ts.
import { afterEach, describe, it } from 'vitest';
import { expectAccessible, inertRenderer, mountLeaf, openTab, settle, sizeCityStage, unmountLeaf } from './axe-support';

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

  it('the cancelling banner over the snapshot', async () => {
    const { root } = await mountLeaf({ route: 'city', run: 'cancelling' });
    await expectAccessible(root, '.ci-app');
  });
});

describe('axe: Architecture and Hotspots', () => {
  afterEach(() => { unmountLeaf(); });

  for (const tab of ['map', 'matrix', 'cycles', 'edges', 'rules']) {
    it(`Architecture, the ${tab} tab`, async () => {
      const { root } = await mountLeaf({ route: 'architecture', items: true });
      await openTab(root, tab);
      await expectAccessible(root, `[role="tab"][data-tab-id="${tab}"][aria-selected="true"]`);
      await expectAccessible(root, '.ci-screen--architecture [role="tabpanel"] *');
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

  for (const tab of ['map', 'results', 'mutation']) {
    it(`Test confidence, the ${tab} tab`, async () => {
      const { root } = await mountLeaf({ route: 'tests' });
      await openTab(root, tab);
      await expectAccessible(root, '.ci-screen--tests [role="tabpanel"] *');
    });
  }

  for (const tab of ['inventory', 'path', 'licenses']) {
    it(`Dependencies, the ${tab} tab`, async () => {
      const { root } = await mountLeaf({ route: 'dependencies' });
      await openTab(root, tab);
      await expectAccessible(root, '.ci-screen--dependencies [role="tabpanel"] *');
    });
  }

  for (const tab of ['advisories', 'secrets', 'policy']) {
    it(`Security, the ${tab} tab`, async () => {
      const { root } = await mountLeaf({ route: 'security' });
      await openTab(root, tab);
      await expectAccessible(root, '.ci-screen--security [role="tabpanel"] *');
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
