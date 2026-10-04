// GRC5 (GCO13): axe over the Act and Configure routes and File detail, every state the
// brief names, each in the whole leaf with the harness seed (axe-support.ts), so each
// renders WITH content. ConnectFallowDialog's three steps (routes, review, installed) are
// in axe-dialogs.test.ts, beside the other dialogs.
import { afterEach, describe, it } from 'vitest';
import { demoRelationsAnchorPath, openFailureLog } from '../harness/seed';
import { harnessSnapshot } from '../harness/fixture';
import { expectAccessible, mountLeaf, openTab, settle, unmountLeaf } from './axe-support';

describe('axe: the Act routes', () => {
  afterEach(() => { unmountLeaf(); });

  it('Investigate, a finding open with its evidence, a linked note and the orphan list', async () => {
    const { root } = await mountLeaf({ route: 'investigate', investigate: true });
    await expectAccessible(root, '.ci-investigate-row');
    await expectAccessible(root, '.ci-notes-panel__item');
  });

  it('Investigate without a report: the import prompt', async () => {
    const { root } = await mountLeaf({ route: 'investigate', report: false });
    await expectAccessible(root, '.ci-screen--investigate');
  });

  it('Refactor workbench, the board with three work items', async () => {
    const { root } = await mountLeaf({ route: 'workbench', items: true });
    await expectAccessible(root, '.ci-work-card');
  });

  it('Refactor workbench, the list view', async () => {
    const { root } = await mountLeaf({ route: 'workbench', items: true });
    root.querySelector<HTMLElement>('.ci-workbench__view--list')?.click();
    await settle();
    await expectAccessible(root, '.ci-screen--workbench .ci-table__row');
  });

  it('Audit report, with work items', async () => {
    const { root } = await mountLeaf({ route: 'report', items: true });
    await expectAccessible(root, '.ci-report-paper__section-title');
  });
});

describe('axe: Data & scans', () => {
  afterEach(() => { unmountLeaf(); });

  it('an imported report: the fallow card with its facts', async () => {
    const { root } = await mountLeaf({ route: 'sources' });
    await expectAccessible(root, '.ci-fallow-facts');
  });

  it('analysis running', async () => {
    const { root } = await mountLeaf({ route: 'sources', analysis: 'running' });
    await expectAccessible(root, '.ci-fallow-run');
  });

  it('analysis failed, the error output open', async () => {
    const { root } = await mountLeaf({ route: 'sources', analysis: 'failed' });
    openFailureLog(root);
    await settle();
    await expectAccessible(root, 'details.ci-fallow-run__log[open]');
  });

  it('analysis collected', async () => {
    const { root } = await mountLeaf({ route: 'sources', analysis: 'collected' });
    await expectAccessible(root, '.ci-fallow-facts');
  });

  for (const run of ['running', 'cancelling'] as const) {
    it(`a scan ${run}`, async () => {
      const { root } = await mountLeaf({ route: 'sources', run });
      await expectAccessible(root, '.ci-sources__status');
    });
  }
});

describe('axe: Settings and File detail', () => {
  afterEach(() => { unmountLeaf(); });

  for (const tab of ['appearance', 'analysis', 'accessibility', 'privacy', 'about']) {
    it(`Settings, the ${tab} tab`, async () => {
      const { root } = await mountLeaf({ route: 'settings', items: true });
      await openTab(root, tab);
      await expectAccessible(root, `[role="tab"][data-tab-id="${tab}"][aria-selected="true"]`);
      await expectAccessible(root, '.ci-screen--settings [role="tabpanel"] *');
    });
  }

  it('File detail, a file with findings, relations and a work item', async () => {
    const path = demoRelationsAnchorPath(harnessSnapshot());
    const { root, store } = await mountLeaf({ route: 'city', items: true });
    const id = store.snapshot!.entities.find((e) => e.kind === 'file' && e.path === path)!.id;
    store.select(id);
    store.navigate('file');
    await settle();
    await expectAccessible(root, '.ci-file-finding__review');
  });
});
