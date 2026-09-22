// Part 5 V13–V16: Settings › Privacy & storage › Import review state.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import SettingsScreen from '../../src/ui/screens/SettingsScreen.vue';
import WorkbenchScreen from '../../src/ui/screens/WorkbenchScreen.vue';
import ImportReviewDialog from '../../src/ui/screens/settings/ImportReviewDialog.vue';
import type { ImportCandidate } from '../../src/ui/screens/settings/import-candidate';
import { makeEntityId } from '../../src/domain/entity-id';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { repositoryDigest, reviewStateJson, reviewStateSource, type ReviewStateSource } from '../../src/ui/read-models/review-state';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReportStore } from '../../src/ui/stores/report-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { NO_CHECKS, createInMemoryReviewRepository, type WorkItem } from '../../src/ui/stores/ports/review-repository';
import {
  IMPORT_BUSY, IMPORT_CONFIRM_TEXT, IMPORT_ERROR, IMPORT_FAILED, IMPORT_ORIGIN, IMPORT_STALE, IMPORTED, SETTINGS_IMPORT_HINT,
  SETTINGS_IMPORT_OPEN,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const NOW = new Date('2026-09-22T10:00:00.000Z');
// oxlint consistent-function-scoping: a no-arg closure that captures nothing is hoisted.
const noop = (): void => {};
const provide = { onSelectCodebase: vi.fn() };
const mountS = () => mount(SettingsScreen, { attachTo: document.body, global: { provide } });

function withSnapshot(): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 6, directories: 1, repositoryId: 'repo-a' });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}

/** A review-state file for `snap`: one item, one rule, one decision and a note. */
function stateText(snap: CodebaseSnapshot, title = 'Split the parser', source: ReviewStateSource | null = reviewStateSource(snap)): string {
  const path = snap.entities.find((e) => e.kind === 'file')!.path;
  const fileId = makeEntityId(snap.repositoryId, 'file', path);
  return reviewStateJson({
    workItems: [{ id: 'wi-7', target: { kind: 'file', entityId: fileId }, intent: 'refactor', title, status: 'planned', priority: 'high', notes: '', checks: NO_CHECKS, createdAt: NOW.toISOString() }],
    rules: [{ id: 'AR-004', from: 'dir-0', to: 'dir-1', rationale: 'Layering', createdAt: NOW.toISOString() }],
    dispositions: [{ fingerprint: `${fileId}#CX-a-1`, status: 'acknowledged', decidedAt: NOW.toISOString() }],
    report: { sections: { summary: true, architecture: false, hotspots: true, security: true, plan: true }, note: 'Imported note.' },
    exportedAt: NOW,
    source,
  });
}

/** What a real pick does: `files` is set on the template's own input, then `change` fires. */
async function pick(w: VueWrapper, text: string): Promise<void> {
  const input = w.find('.ci-settings__import-file');
  Object.defineProperty(input.element, 'files', { value: [new File([text], 'x.json', { type: 'application/json' })], configurable: true });
  await input.trigger('change');
  await flushPromises();
}

/** Part 5 E19a: a file whose `.text()` does not resolve until `release()` is called, so a
 *  test can change the codebase on screen while the pick is still being read. */
function slowFile(text: string): { file: File; release: () => void } {
  let release: () => void = noop;
  const gate = new Promise<void>((r) => { release = r; });
  const file = new File([text], 'x.json', { type: 'application/json' });
  const read = file.text.bind(file);
  file.text = async () => { await gate; return read(); };
  return { file, release };
}

/** Picks a slow file and returns the release function, without waiting for the read
 *  (`readReviewStateFile`'s `file.text()`) to settle. */
async function pickSlow(w: VueWrapper, text: string): Promise<() => void> {
  const { file, release } = slowFile(text);
  const input = w.find('.ci-settings__import-file');
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
  return release;
}

async function openPrivacy(): Promise<VueWrapper> {
  const w = mountS();
  await w.find('[role="tab"][data-tab-id="privacy"]').trigger('click');
  return w;
}

describe('Import review state (Part 5 V13–V16)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('is aria-disabled, described by its visible hint, while no codebase is on screen; the file input lives in the template', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const w = await openPrivacy();
    const button = w.find('.ci-settings__import');
    expect(button.text()).toBe(SETTINGS_IMPORT_OPEN);
    expect(button.attributes('aria-disabled')).toBe('true');
    const hint = w.find('.ci-settings__import-hint');
    expect(hint.text()).toBe(SETTINGS_IMPORT_HINT);
    expect(button.attributes('aria-describedby')).toBe(hint.attributes('id'));
    await button.trigger('click');
    expect(click).not.toHaveBeenCalled();
    w.unmount();

    withSnapshot();
    const w2 = await openPrivacy();
    const ready = w2.find('.ci-settings__import');
    expect(ready.attributes('aria-disabled')).toBeUndefined();
    expect(ready.attributes('aria-describedby')).toBeUndefined();
    expect(w2.find('.ci-settings__import-hint').exists()).toBe(false);
    const input = w2.find('.ci-settings__import-file');
    expect(input.attributes()).toMatchObject({ type: 'file', accept: '.json,application/json', tabindex: '-1', 'aria-hidden': 'true' });
    await ready.trigger('click');
    expect(click).toHaveBeenCalledTimes(1);
    w2.unmount();
    click.mockRestore();
  });

  it('refuses a broken file with one alert, and a new pick replaces the message', async () => {
    const snap = withSnapshot();
    const w = await openPrivacy();
    await pick(w, '{');
    const alert = w.find('.ci-settings__import-error');
    expect(alert.attributes('role')).toBe('alert');
    expect(alert.text()).toBe(IMPORT_ERROR['not-json'](''));
    const bad = JSON.parse(stateText(snap)) as { workItems: { title: string }[] };
    bad.workItems[0]!.title = '   ';
    await pick(w, JSON.stringify(bad));
    expect(w.findAll('.ci-settings__import-error')).toHaveLength(1);
    expect(w.find('.ci-settings__import-error').text()).toBe(IMPORT_ERROR.invalid('workItems.0.title'));
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    w.unmount();
  });

  it('refuses a file from another codebase and names its folder', async () => {
    const snap = withSnapshot();
    const w = await openPrivacy();
    await pick(w, stateText(snap, 'x', { folder: 'other-app', repository: repositoryDigest('repo-b') }));
    expect(w.find('.ci-settings__import-error').text()).toBe(IMPORT_ERROR['other-codebase']('other-app'));
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    w.unmount();
  });

  it('opens the dialog with the counts and origin for a valid file; Cancel changes nothing', async () => {
    const snap = withSnapshot();
    const w = await openPrivacy();
    await pick(w, stateText(snap));
    expect(w.find('.ci-settings__import-error').exists()).toBe(false);
    expect(w.find('.ci-import-dialog__counts').text()).toBe(IMPORT_CONFIRM_TEXT(1, 1, 1, true));
    expect(w.find('.ci-import-dialog__origin').text()).toBe(IMPORT_ORIGIN('root'));
    await w.find('.ci-import-dialog__cancel').trigger('click');
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    expect(useReviewStore().workItems).toEqual([]);
    w.unmount();
  });

  it('Replace swaps the state in, closes the dialog and re-announces the outcome in the Settings live region', async () => {
    const snap = withSnapshot();
    const review = useReviewStore();
    // Part 5 E20: report.restore only applies for the bound codebase (mirrors
    // bindRepository's own guard). In the real app, App.vue's shell-level watcher binds
    // this before Settings is ever reachable; this test mounts SettingsScreen alone, so
    // it does the same binding App.vue would have done.
    useReportStore().bindRepository(snap.repositoryId);
    await review.addWorkItem({ kind: 'package', name: 'old' }, 'review', 'Old item', NOW);
    const w = await openPrivacy();
    await pick(w, stateText(snap));
    await w.find('.ci-import-dialog__confirm').trigger('click');
    await flushPromises();
    expect(review.workItems.map((i) => [i.id, i.title])).toEqual([['wi-7', 'Split the parser']]);
    expect(review.rules.map((r) => r.id)).toEqual(['AR-004']);
    expect(review.dispositions).toHaveLength(1);
    expect(useReportStore().note).toBe('Imported note.');
    expect(useReportStore().sections.architecture).toBe(false);
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    const message = IMPORTED(1, 1, 1);
    expect(w.find('.ci-settings__live').text()).toBe(message);

    // The same outcome again is heard again: the region passes through '' first.
    const live = w.find('.ci-settings__live').element;
    const seen: string[] = [];
    const observer = new MutationObserver(() => { seen.push((live.textContent ?? '').trim()); });
    observer.observe(live, { childList: true, characterData: true, subtree: true });
    await pick(w, stateText(snap));
    await w.find('.ci-import-dialog__confirm').trigger('click');
    await flushPromises();
    observer.disconnect();
    expect(seen).toContain('');
    expect(seen[seen.length - 1]).toBe(message);
    w.unmount();
  });

  it('ignores Cancel, Escape and a second Replace while the replacement is in flight (Part 4 E13)', async () => {
    const snap = withSnapshot();
    const review = useReviewStore();
    const repo = createInMemoryReviewRepository();
    let release: () => void = noop;
    const gate = new Promise<void>((r) => { release = r; });
    const save = vi.fn(async (item: WorkItem) => { await gate; await repo.saveWorkItem(item); });
    review.setRepository({ ...repo, saveWorkItem: save });
    const w = await openPrivacy();
    await pick(w, stateText(snap));
    await w.find('.ci-import-dialog__confirm').trigger('click');
    expect(w.find('.ci-import-dialog__confirm').attributes('aria-disabled')).toBe('true');
    expect(w.find('.ci-import-dialog__cancel').attributes('aria-disabled')).toBe('true');
    await w.find('.ci-import-dialog__cancel').trigger('click');
    await w.find('.ci-import-dialog').trigger('keydown', { key: 'Escape' });
    await w.find('.ci-import-dialog__confirm').trigger('click');
    expect(w.find('.ci-import-dialog').exists()).toBe(true);
    release();
    await flushPromises();
    expect(save).toHaveBeenCalledTimes(1);
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    w.unmount();
  });

  it('a rejection keeps the dialog open with IMPORT_FAILED and announces nothing; a refusal shows IMPORT_BUSY', async () => {
    const snap = withSnapshot();
    const review = useReviewStore();
    const repo = createInMemoryReviewRepository();
    review.setRepository({ ...repo, saveRule: () => Promise.reject(new Error('disk')) });
    const w = await openPrivacy();
    await pick(w, stateText(snap));
    await w.find('.ci-import-dialog__confirm').trigger('click');
    await flushPromises();
    expect(w.find('.ci-import-dialog').exists()).toBe(true);
    expect(w.find('.ci-import-dialog__error').attributes('role')).toBe('alert');
    expect(w.find('.ci-import-dialog__error').text()).toBe(IMPORT_FAILED);
    expect(w.find('.ci-settings__live').text()).toBe('');
    expect(useReportStore().note).toBe('');

    review.setRepository({ ...repo, saveWorkItem: () => new Promise<void>(() => {}) });
    void review.addWorkItem({ kind: 'package', name: 'slow' }, 'review', 'Slow', NOW);
    await w.find('.ci-import-dialog__confirm').trigger('click');
    await flushPromises();
    expect(w.find('.ci-import-dialog__error').text()).toBe(IMPORT_BUSY);
    expect(w.find('.ci-import-dialog').exists()).toBe(true);
    w.unmount();
  });

  it('renders an imported HTML-looking title as literal text in the Workbench (V15)', async () => {
    const snap = withSnapshot();
    const title = '<img src=x onerror=alert(1)>';
    const w = await openPrivacy();
    await pick(w, stateText(snap, title));
    await w.find('.ci-import-dialog__confirm').trigger('click');
    await flushPromises();
    w.unmount();
    const wb = mount(WorkbenchScreen, { attachTo: document.body, global: { provide } });
    expect(wb.find('.ci-work-card__title').text()).toBe(title);
    expect(wb.find('img').exists()).toBe(false);
    expect(wb.html()).toContain('&lt;img');
    wb.unmount();
  });

  // Part 5 E19: a codebase switch (a scan/approval completing) between pick and confirm,
  // or while the file is still being read, must never write one codebase's ids into
  // another's bucket (Part 4 E8/E11).
  it('drops a parsed file silently if the codebase on screen changed while it was still being read (E19a)', async () => {
    const snap = withSnapshot();
    const review = useReviewStore();
    const w = await openPrivacy();
    const release = await pickSlow(w, stateText(snap));
    const other = buildSnapshotFixture({ files: 3, directories: 1, repositoryId: 'repo-other' });
    useCityStore().setCity(other, computeLayout(other));
    release();
    await flushPromises();
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    expect(w.find('.ci-settings__import-error').exists()).toBe(false);
    expect(review.workItems).toEqual([]);
    expect(w.find('.ci-settings__live').text()).toBe('');
    w.unmount();
  });

  it('closes the import dialog silently when the codebase on screen changes while it is open; nothing is applied (E19b)', async () => {
    const snap = withSnapshot();
    const review = useReviewStore();
    const w = await openPrivacy();
    await pick(w, stateText(snap));
    expect(w.find('.ci-import-dialog').exists()).toBe(true);
    const other = buildSnapshotFixture({ files: 3, directories: 1, repositoryId: 'repo-other' });
    useCityStore().setCity(other, computeLayout(other));
    await flushPromises();
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    expect(review.workItems).toEqual([]);
    expect(w.find('.ci-settings__live').text()).toBe('');
    w.unmount();
  });

  it('ImportReviewDialog.confirm refuses with IMPORT_STALE, applying nothing, when its candidate no longer matches the codebase on screen (E19c defence in depth)', async () => {
    const snap = withSnapshot();
    const review = useReviewStore();
    const path = snap.entities.find((e) => e.kind === 'file')!.path;
    const candidate: ImportCandidate = {
      repositoryId: 'repo-other',
      state: {
        workItems: [{
          id: 'wi-9', target: { kind: 'file', entityId: makeEntityId('repo-other', 'file', path) }, intent: 'refactor',
          title: 'Stale', status: 'planned', priority: 'high', notes: '', checks: NO_CHECKS, createdAt: NOW.toISOString(),
        }],
        rules: [], dispositions: [],
        report: { sections: { summary: true, architecture: true, hotspots: true, security: true, plan: true }, note: '' },
        origin: { folder: 'other-app' },
      },
    };
    const w = mount(ImportReviewDialog, { attachTo: document.body, props: { candidate } });
    await w.find('.ci-import-dialog__confirm').trigger('click');
    await flushPromises();
    expect(w.find('.ci-import-dialog__error').text()).toBe(IMPORT_STALE);
    expect(review.workItems).toEqual([]);
    w.unmount();
  });

  // Part 5 E20: a codebase switch that lands WHILE replaceAll is running (not just
  // between pick and confirm, E19) must not restore the report onto, or announce success
  // for, the codebase that ends up on screen.
  it('applies nothing and announces nothing when the codebase on screen switches while replaceAll is still gated (E20)', async () => {
    const snap = withSnapshot();
    const review = useReviewStore();
    const report = useReportStore();
    await review.bindRepository('repo-a');
    report.bindRepository('repo-a');
    const repoA = review.repository;
    let release: () => void = noop;
    const gate = new Promise<void>((r) => { release = r; });
    review.setRepository({ ...repoA, saveWorkItem: async (item: WorkItem) => { await gate; await repoA.saveWorkItem(item); } });
    const w = await openPrivacy();
    await pick(w, stateText(snap));
    await w.find('.ci-import-dialog__confirm').trigger('click');

    const other = buildSnapshotFixture({ files: 3, directories: 1, repositoryId: 'repo-b' });
    useCityStore().setCity(other, computeLayout(other));
    await review.bindRepository('repo-b');
    report.bindRepository('repo-b');
    report.applyNote('Existing note for repo-b.');
    release();
    await flushPromises();

    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    expect(report.note).toBe('Existing note for repo-b.');
    expect(review.workItems).toEqual([]);
    expect(w.find('.ci-settings__live').text()).toBe('');
    w.unmount();
  });
});
