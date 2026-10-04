// GRC5 (GCO13): axe over every dialog, failing on serious and critical violations. Each is
// opened the way a user opens it (its screen's own trigger, or the store command the
// toolbar uses) in the whole leaf with the harness seed (axe-support.ts), so it holds real
// content, and axe checks the open dialog itself (the screens behind are axe-routes*.test.ts).
import { afterEach, describe, expect, it } from 'vitest';
import { ARCH_ADD_RULE } from '../../src/ui/inspector-copy';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import { useReportStore } from '../../src/ui/stores/report-store';
import { DEMO_FALLOW_FILE_NAME, demoFallowReportText, demoImportJson, demoRunReview } from '../harness/seed';
import { expectNoSeriousViolations } from '../support/axe';
import { click, expectAccessible, mountLeaf, openTab, settle, unmountLeaf, waitFor } from './axe-support';

const DIALOG = '[role="dialog"]';

/** axe over the open dialog, once its own content (`content`) has rendered inside it. */
async function expectDialogAccessible(root: HTMLElement, content: string): Promise<void> {
  const dialog = await waitFor(root, DIALOG);
  await waitFor(dialog, content);
  await expectAccessible(dialog, content);
}

function pick(input: HTMLInputElement, text: string, name: string): void {
  Object.defineProperty(input, 'files', { value: [new File([text], name, { type: 'application/json' })], configurable: true });
  input.dispatchEvent(new Event('change'));
}

/** A fixture holding one button, named `text` (or unnamed when it is empty). */
function buttonFixture(text: string): HTMLElement {
  const root = document.body.createDiv();
  root.createEl('button', { text, attr: { type: 'button' } });
  return root;
}

describe('the axe helper', () => {
  afterEach(() => { document.body.empty(); });

  it('positive control: an unnamed button fails it, naming the rule and the target', async () => {
    await expect(expectNoSeriousViolations(buttonFixture(''))).rejects.toThrow(/button-name[\s\S]*button/);
  });

  it('negative control: a named button passes it', async () => {
    await expectNoSeriousViolations(buttonFixture('Save'));
  });
});

describe('axe: the Explore and Audit dialogs', () => {
  afterEach(() => { unmountLeaf(); });

  it('RuleEditor', async () => {
    const { root } = await mountLeaf({ route: 'architecture' });
    const add = Array.from(root.querySelectorAll<HTMLButtonElement>('.ci-screen--architecture button')).find((b) => b.textContent?.includes(ARCH_ADD_RULE));
    if (!add) throw new Error('no Add boundary rule button');
    add.click();
    await settle();
    await expectDialogAccessible(root, 'select');
  });

  it('PackageDetailDialog', async () => {
    const { root } = await mountLeaf({ route: 'dependencies' });
    await click(root, '.ci-packages__details');
    await expectDialogAccessible(root, '.ci-package-dialog');
  });

  it('SnapshotComparisonDialog', async () => {
    const { root } = await mountLeaf({ route: 'evolution', twoSnapshots: true });
    await click(root, '.ci-evolution__compare');
    await expectDialogAccessible(root, '.ci-compare-dialog');
  });

  it('PriorityFormulaDialog', async () => {
    const { root } = await mountLeaf({ route: 'hotspots' });
    await click(root, '.ci-hotspots__how');
    await expectDialogAccessible(root, '.ci-formula');
  });

  it('FindingReviewDialog', async () => {
    const { root } = await mountLeaf({ route: 'quality' });
    await click(root, '.ci-findings-table__open');
    await expectDialogAccessible(root, '.ci-finding-dialog__title');
  });

  it('EvidenceSourceDialog, from Test confidence and from Security', async () => {
    const { root, store } = await mountLeaf({ route: 'tests' });
    await click(root, '.ci-tests__evidence');
    await expectDialogAccessible(root, '.ci-evidence-dialog__row');
    store.navigate('security');
    await settle();
    await click(root, '.ci-security__sources');
    await expectDialogAccessible(root, '.ci-evidence-dialog__row');
  });
});

describe('axe: the Act dialogs and the command palette', () => {
  afterEach(() => { unmountLeaf(); });

  it('CreateNoteDialog', async () => {
    const { root } = await mountLeaf({ route: 'investigate', investigate: true });
    await click(root, '.ci-notes-panel__create');
    await expectDialogAccessible(root, 'input');
  });

  it('RefreshNoteDialog', async () => {
    const { root } = await mountLeaf({ route: 'investigate', investigate: true });
    await click(root, '.ci-notes-panel__refresh');
    await expectDialogAccessible(root, 'button');
  });

  it('WorkItemEditor, editing a work item', async () => {
    const { root } = await mountLeaf({ route: 'workbench', items: true });
    await click(root, '.ci-work-card');
    await expectDialogAccessible(root, '.ci-work-editor textarea');
  });

  it('WorkItemEditor, a new work item for the selected file', async () => {
    const { root, store } = await mountLeaf({ route: 'workbench', items: true });
    store.select(store.layout!.lots[5]!.entityId);
    await settle();
    await click(root, '.ci-workbench__new');
    await expectDialogAccessible(root, '.ci-work-editor__intent');
  });

  it('CommandPalette, with a query that matches files', async () => {
    const { root } = await mountLeaf({ route: 'overview' });
    root.querySelector('.ci-shell')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    await settle();
    const input = await waitFor(root, '.ci-palette__input') as HTMLInputElement;
    input.value = 'file';
    input.dispatchEvent(new Event('input'));
    await settle();
    await expectDialogAccessible(root, '.ci-palette__item');
  });
});

describe('axe: the Configure dialogs', () => {
  afterEach(() => { unmountLeaf(); });

  it('ClearReviewDialog', async () => {
    const { root } = await mountLeaf({ route: 'settings', items: true });
    await openTab(root, 'privacy');
    await click(root, '.ci-settings__clear');
    await expectDialogAccessible(root, '.ci-clear-dialog');
  });

  it('ImportReviewDialog, a picked review-state file', async () => {
    const { root, store } = await mountLeaf({ route: 'settings', items: true });
    await openTab(root, 'privacy');
    const firstPath = store.snapshot!.entities.find((e) => e.kind === 'file')!.path;
    pick(await waitFor(root, '.ci-settings__import-file') as HTMLInputElement, demoImportJson(firstPath, useReportStore().sections), 'review-state.json');
    await expectDialogAccessible(root, 'button');
  });

  it('ConnectFallowDialog, step 1: both routes', async () => {
    const { root } = await mountLeaf({ route: 'sources', report: false });
    useEvidenceStore().requestImport();
    await waitFor(root, '.ci-connect-fallow__use-installed');
    await expectDialogAccessible(root, '.ci-connect-fallow__route');
  });

  it('ConnectFallowDialog, the review step of an imported report', async () => {
    const { root, store } = await mountLeaf({ route: 'sources', report: false });
    useEvidenceStore().requestImport();
    pick(await waitFor(root, '.ci-connect-fallow__file') as HTMLInputElement, demoFallowReportText(store.snapshot!), DEMO_FALLOW_FILE_NAME);
    await waitFor(root, '.ci-connect-fallow__attach');
    await expectDialogAccessible(root, '.ci-fallow-facts');
  });

  it('ConnectFallowDialog, the installed route: the trust review', async () => {
    const { root, store, analysis } = await mountLeaf({ route: 'sources', report: false });
    const snapshot = store.snapshot!;
    analysis.next.run = { kind: 'review', review: demoRunReview(snapshot), reason: 'untrusted' };
    useAnalysisStore().requestRun();
    await waitFor(root, '.ci-fallow-installed__trust');
    await expectDialogAccessible(root, '.ci-fallow-review');
  });

  it('FallowRemoveDialog', async () => {
    const { root } = await mountLeaf({ route: 'sources' });
    await click(root, '.ci-fallow-card__remove');
    await expectDialogAccessible(root, '.ci-fallow-remove');
  });
});
