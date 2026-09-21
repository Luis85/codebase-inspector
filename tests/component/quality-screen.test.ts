import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(files = 60, directories = 3) {
  const snap = buildSnapshotFixture({ files, directories });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountQ = () => mount(QualityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
/** Fix round 1: a focusable `.ci-shell` around the screen, as App.vue provides, so
 *  CiDialog's real fallback (focus the shell when the opener is gone) runs. */
function mountInShell() {
  const shell = document.body.createDiv({ cls: 'ci-shell' });
  shell.tabIndex = -1;
  const w = mount(QualityScreen, { attachTo: shell, global: { provide: { onSelectCodebase: vi.fn() } } });
  return { w, done: () => { w.unmount(); shell.remove(); } };
}
const inDialog = () => document.activeElement?.closest('.ci-finding-dialog') != null;
const flush = async () => { await Promise.resolve(); await nextTick(); await nextTick(); };

describe('QualityScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('asks for a codebase without a snapshot', () => {
    const w = mountQ();
    expect(w.text()).toContain('No snapshot yet');
    w.unmount();
  });

  it('shows four sample cards and the open findings, 100 at a time', async () => {
    withSnapshot(400, 4);
    const w = mountQ();
    expect(w.findAll('.ci-metric-card')).toHaveLength(4);
    expect(w.findAll('.ci-table__row')).toHaveLength(100);
    await w.find('.ci-findings-table__more').trigger('click');
    expect(w.findAll('.ci-table__row')).toHaveLength(200);
    w.unmount();
  });

  it('filters by module; no match offers a reset that restores the rows', async () => {
    withSnapshot();
    const w = mountQ();
    await w.find('.ci-finding-filters__module').setValue('dir-1');
    const rows = w.findAll('.ci-table__row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.text().includes('dir-1'))).toBe(true);
    await w.find('.ci-finding-filters__query').setValue('no-such-thing');
    expect(w.text()).toContain('No findings match these filters');
    await w.find('.ci-findings-table__reset').trigger('click');
    expect(w.findAll('.ci-table__row').length).toBeGreaterThan(0);
    w.unmount();
  });

  it('acknowledging moves the finding out of the Open list; closing lands focus on a row, never the shell or body', async () => {
    withSnapshot();
    const { w, done } = mountInShell();
    const first = w.findAll('.ci-table__row')[0]!;
    // Finding ids repeat across files (CX-<module>-<n>); the id plus the file names the row.
    const identity = first.text();
    (first.element as HTMLElement).focus();
    await first.trigger('click');
    expect(w.find('.ci-finding-dialog').exists()).toBe(true);
    await w.find('.ci-finding-dialog__acknowledge').trigger('click');
    await flush();
    expect(useReviewStore().dispositions).toHaveLength(1);
    expect(w.find('.ci-finding-dialog__reopen').exists()).toBe(true);
    expect(w.find('.ci-quality__live').text()).toBe('Finding acknowledged. No repository suppression was written.');
    await w.find('.ci-finding-dialog__close').trigger('click');
    await flush();
    const rows = w.findAll('.ci-table__row').map((r) => r.text());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows).not.toContain(identity);
    expect(document.activeElement?.classList.contains('ci-table__row')).toBe(true);
    expect(document.activeElement?.classList.contains('ci-shell')).toBe(false);
    done();
  });

  it('focus stays inside the dialog after Acknowledge, Reopen and a dismissal save or cancel', async () => {
    withSnapshot();
    const { w, done } = mountInShell();
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    const ack = w.find('.ci-finding-dialog__acknowledge');
    (ack.element as HTMLElement).focus();
    await ack.trigger('click');
    await flush();
    expect(w.find('.ci-finding-dialog__reopen').exists()).toBe(true);
    expect(inDialog()).toBe(true);
    await w.find('.ci-finding-dialog__reopen').trigger('click');
    await flush();
    expect(w.find('.ci-finding-dialog__acknowledge').exists()).toBe(true);
    expect(inDialog()).toBe(true);
    await w.find('.ci-finding-dialog__dismiss').trigger('click');
    await flush();
    expect(document.activeElement?.tagName).toBe('TEXTAREA');
    await w.find('.ci-finding-dialog__cancel').trigger('click');
    await flush();
    expect(w.find('.ci-finding-dialog textarea').exists()).toBe(false);
    expect(inDialog()).toBe(true);
    await w.find('.ci-finding-dialog__dismiss').trigger('click');
    await w.find('.ci-finding-dialog textarea').setValue('Kept for the plugin API');
    (w.find('.ci-finding-dialog__save-dismissal').element as HTMLElement).focus();
    await w.find('.ci-finding-dialog form').trigger('submit');
    await flush();
    expect(useReviewStore().dispositions[0]).toMatchObject({ status: 'dismissed' });
    expect(inDialog()).toBe(true);
    done();
  });

  it('a rescan that drops the finding closes the review for good', async () => {
    const snap = buildSnapshotFixture({ files: 60, directories: 3 });
    useCityStore().setCity(snap, computeLayout(snap));
    const w = mountQ();
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    expect(w.find('.ci-finding-dialog').exists()).toBe(true);
    const other = buildSnapshotFixture({ files: 60, directories: 3, repositoryId: 'repo-other' });
    useCityStore().setCity(other, computeLayout(other));
    await flush();
    expect(w.find('.ci-finding-dialog').exists()).toBe(false);
    useCityStore().setCity(snap, computeLayout(snap));
    await flush();
    expect(w.find('.ci-finding-dialog').exists()).toBe(false);
    w.unmount();
  });

  it('F3: a module that disappears on rescan resets the filter to all modules', async () => {
    withSnapshot(60, 3);
    const w = mountQ();
    await w.find('.ci-finding-filters__module').setValue('dir-2');
    const before = w.findAll('.ci-table__row');
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((r) => r.text().includes('dir-2'))).toBe(true);
    withSnapshot(60, 2);
    await flush();
    expect((w.find('.ci-finding-filters__module').element as HTMLSelectElement).value).toBe('');
    const after = w.findAll('.ci-table__row');
    expect(after.length).toBeGreaterThan(0);
    expect(after.some((r) => r.text().includes('dir-0'))).toBe(true);
    w.unmount();
  });

  it('changing a filter shows the first page again', async () => {
    withSnapshot(400, 4);
    const w = mountQ();
    await w.find('.ci-findings-table__more').trigger('click');
    expect(w.findAll('.ci-table__row')).toHaveLength(200);
    await w.find('.ci-finding-filters__status').setValue('all');
    expect(w.findAll('.ci-table__row')).toHaveLength(100);
    w.unmount();
  });

  it('E17: a refused decision announces nothing and shows no error', async () => {
    withSnapshot();
    const w = mountQ();
    const review = useReviewStore();
    const spy = vi.spyOn(review, 'acknowledge').mockResolvedValue(null);
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    await w.find('.ci-finding-dialog__acknowledge').trigger('click');
    await flush();
    expect(spy).toHaveBeenCalledOnce();
    expect(w.find('.ci-quality__live').text()).toBe('');
    expect(w.find('.ci-finding-dialog__error').exists()).toBe(false);
    w.unmount();
  });

  it('a rejected decision shows the failure and announces nothing', async () => {
    withSnapshot();
    const w = mountQ();
    vi.spyOn(useReviewStore(), 'acknowledge').mockRejectedValue(new Error('disk'));
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    await w.find('.ci-finding-dialog__acknowledge').trigger('click');
    await flush();
    expect(w.find('.ci-finding-dialog__error').text()).toBe('Could not save this decision.');
    expect(w.find('.ci-quality__live').text()).toBe('');
    w.unmount();
  });

  it('dismiss requires a reason; with one, the decision and reason are stored', async () => {
    withSnapshot();
    const w = mountQ();
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    await w.find('.ci-finding-dialog__dismiss').trigger('click');
    await w.find('.ci-finding-dialog__save-dismissal').trigger('click');
    await flush();
    expect(w.find('.ci-finding-dialog__error').text()).toBe('Enter a reason before dismissing the finding.');
    expect(useReviewStore().dispositions).toHaveLength(0);
    await w.find('.ci-finding-dialog textarea').setValue('Exported for the plugin API');
    await w.find('.ci-finding-dialog__save-dismissal').trigger('click');
    await flush();
    expect(useReviewStore().dispositions[0]).toMatchObject({ status: 'dismissed', reason: 'Exported for the plugin API' });
    w.unmount();
  });

  it('reopen removes the decision; add work item records a refactor item for the file', async () => {
    withSnapshot();
    const w = mountQ();
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    await w.find('.ci-finding-dialog__acknowledge').trigger('click');
    await flush();
    await w.find('.ci-finding-dialog__reopen').trigger('click');
    await flush();
    expect(useReviewStore().dispositions).toHaveLength(0);
    await w.find('.ci-finding-dialog__work-item').trigger('click');
    await flush();
    expect(useReviewStore().workItemCount).toBe(1);
    w.unmount();
  });

  it('final review I2: Add work item is aria-disabled once pressed, keeps focus and ignores a second press', async () => {
    withSnapshot();
    const { w, done } = mountInShell();
    const spy = vi.spyOn(useReviewStore(), 'addWorkItemForFile');
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    const button = w.find('.ci-finding-dialog__work-item');
    const before = button.text();
    (button.element as HTMLElement).focus();
    await button.trigger('click');
    await flush();
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.attributes('aria-disabled')).toBe('true');
    expect(button.text()).not.toBe(before);
    expect(document.activeElement).toBe(button.element);
    await button.trigger('click');
    await flush();
    expect(spy).toHaveBeenCalledOnce();
    expect(useReviewStore().workItemCount).toBe(1);
    done();
  });

  it('Open file detail selects the file and navigates there', async () => {
    withSnapshot();
    const w = mountQ();
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    await w.find('.ci-finding-dialog__open-file').trigger('click');
    const store = useCityStore();
    expect(store.route).toBe('file');
    expect(store.selectedEntityId).not.toBeNull();
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('exports the filtered findings through the leaf document', async () => {
    withSnapshot();
    const w = mountQ();
    await w.find('.ci-quality__export').trigger('click');
    expect(downloadText).toHaveBeenCalledOnce();
    const [host, name, text] = vi.mocked(downloadText).mock.calls[0]!;
    expect(host.classList.contains('ci-screen--quality')).toBe(true);
    expect(name).toBe('codebase-quality-findings.csv');
    expect(text).toContain('id,path,module,kind,severity,line,line_state,status,reason,provenance');
    w.unmount();
  });

  it('a failed export is announced', async () => {
    withSnapshot();
    vi.mocked(downloadText).mockImplementationOnce(() => { throw new Error('blocked'); });
    const w = mountQ();
    await w.find('.ci-quality__export').trigger('click');
    expect(w.find('.ci-quality__live').text()).toBe('Could not start the download.');
    w.unmount();
  });
});
