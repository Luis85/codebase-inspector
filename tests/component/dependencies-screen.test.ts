import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import DependenciesScreen from '../../src/ui/screens/DependenciesScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { PACKAGE_REVIEW_ADDED, PACKAGE_REVIEW_FAILED } from '../../src/ui/inspector-copy';

function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 12, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountD = () => mount(DependenciesScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
const flush = async () => { await Promise.resolve(); await nextTick(); };
const dialogStatus = (w: ReturnType<typeof mountD>) => w.find('[role="dialog"] .ci-dialog__status').text();

describe('DependenciesScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('labels the inventory fictional and says the manifest contents are not read', () => {
    withSnapshot();
    const w = mountD();
    expect(w.text()).toContain('Fictional packages, real review flow.');
    expect(w.text()).toContain('No package.json in this inventory.');
    expect(w.findAll('.ci-table__row')).toHaveLength(10);
    w.unmount();
  });

  it('filters by name and relationship; no match shows the empty state', async () => {
    withSnapshot();
    const w = mountD();
    await w.find('.ci-packages__filter').setValue('transitive');
    expect(w.findAll('.ci-table__row')).toHaveLength(2);
    await w.find('.ci-packages__query').setValue('zzz');
    expect(w.text()).toContain('No packages found');
    w.unmount();
  });

  it('filters by name to exactly one package', async () => {
    withSnapshot();
    const w = mountD();
    await w.find('.ci-packages__query').setValue('geometry');
    const rows = w.findAll('.ci-table__row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text()).toContain('@sample/geometry');
    w.unmount();
  });

  it('a package dialog creates one review item keyed by package name, and the review button never becomes disabled', async () => {
    withSnapshot();
    const review = useReviewStore();
    const addSpy = vi.spyOn(review, 'addWorkItem');
    const w = mountD();
    expect(w.findAll('.ci-table__row')[0]!.text()).toContain('@sample/document-parser');
    await w.findAll('.ci-packages__details')[0]!.trigger('click');
    const dialog = w.find('.ci-package-dialog');
    expect(dialog.text()).toContain('This is not a real advisory.');
    const reviewButton = w.find('.ci-package-dialog__review');
    await reviewButton.trigger('click');
    await flush();
    const item = review.workItems[0]!;
    expect(item.target).toEqual({ kind: 'package', name: '@sample/document-parser' });
    expect(item.intent).toBe('review');
    // E44 (fix round 1): jsdom does not blur a disabled focused control the way a real
    // browser does, so a focus assertion never actually proved `disabled` was avoided.
    // Asserting the attribute is absent does.
    expect(w.find('.ci-package-dialog__review').attributes('disabled')).toBeUndefined();
    expect(w.find('.ci-package-dialog__review').attributes('aria-disabled')).toBe('true');
    // A second click on the now "exists" button must not call the store a second time —
    // proof the guard, not just the store's own duplicate refusal, is doing the blocking.
    await w.find('.ci-package-dialog__review').trigger('click');
    await flush();
    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(review.workItems).toHaveLength(1);
    w.unmount();
  });

  it('announces PACKAGE_REVIEW_ADDED after a successful add', async () => {
    withSnapshot();
    const w = mountD();
    await w.findAll('.ci-packages__details')[0]!.trigger('click');
    await w.find('.ci-package-dialog__review').trigger('click');
    await flush();
    expect(dialogStatus(w)).toBe(PACKAGE_REVIEW_ADDED);
    w.unmount();
  });

  it('a refusal (addWorkItem resolves null) announces nothing', async () => {
    withSnapshot();
    const review = useReviewStore();
    vi.spyOn(review, 'addWorkItem').mockResolvedValue(null);
    const w = mountD();
    await w.findAll('.ci-packages__details')[0]!.trigger('click');
    await w.find('.ci-package-dialog__review').trigger('click');
    await flush();
    expect(dialogStatus(w)).toBe('');
    w.unmount();
  });

  it('a rejected add announces PACKAGE_REVIEW_FAILED', async () => {
    withSnapshot();
    const review = useReviewStore();
    vi.spyOn(review, 'addWorkItem').mockRejectedValue(new Error('boom'));
    const w = mountD();
    await w.findAll('.ci-packages__details')[0]!.trigger('click');
    await w.find('.ci-package-dialog__review').trigger('click');
    await flush();
    const error = w.find('.ci-package-dialog__error');
    expect(error.attributes('role')).toBe('alert');
    expect(error.text()).toBe(PACKAGE_REVIEW_FAILED);
    w.unmount();
  });

  it('Close and Escape close the dialog and return focus to the row\'s Details button', async () => {
    withSnapshot();
    const w = mountD();
    const details = w.findAll('.ci-packages__details')[0]!;

    (details.element as HTMLElement).focus();
    await details.trigger('click');
    expect(w.find('.ci-package-dialog').exists()).toBe(true);
    await w.find('.ci-package-dialog__close').trigger('click');
    await nextTick();
    expect(w.find('.ci-package-dialog').exists()).toBe(false);
    expect(document.activeElement).toBe(details.element);

    (details.element as HTMLElement).focus();
    await details.trigger('click');
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    await nextTick();
    expect(w.find('.ci-package-dialog').exists()).toBe(false);
    expect(document.activeElement).toBe(details.element);
    w.unmount();
  });

  it("the Path tab's Inspect package button opens the dialog", async () => {
    withSnapshot();
    const w = mountD();
    await w.find('[role="tab"][data-tab-id="path"]').trigger('click');
    await w.find('.ci-dep-path__inspect').trigger('click');
    expect(w.find('.ci-package-dialog').exists()).toBe(true);
    w.unmount();
  });

  it('final review m5: each Path Inspect button has its own name, starting with its visible text', async () => {
    withSnapshot();
    const w = mountD();
    await w.find('[role="tab"][data-tab-id="path"]').trigger('click');
    const buttons = w.findAll('.ci-dep-path__inspect');
    expect(buttons).toHaveLength(2);
    const names = buttons.map((b) => b.attributes('aria-label') ?? '');
    for (const [i, b] of buttons.entries()) {
      expect(names[i]!.startsWith(b.text())).toBe(true);
      expect(names[i]).toContain(w.findAll('.ci-dep-path__label code')[i * 2]!.text());
    }
    expect(names[0]).not.toBe(names[1]);
    w.unmount();
  });

  it('shows the unused-package note for a package with no references', async () => {
    withSnapshot();
    const w = mountD();
    // Fixture order (E29): index 6 is @sample/legacy-icons, status 'unused'.
    const row = w.findAll('.ci-table__row')[6]!;
    expect(row.text()).toContain('@sample/legacy-icons');
    await row.find('.ci-packages__details').trigger('click');
    expect(w.find('.ci-package-dialog').text()).toContain('No references in the fixture');
    w.unmount();
  });

  it('shows the metadata note for a package with no advisory and a non-unused status', async () => {
    withSnapshot();
    const w = mountD();
    // Fixture order (E29): index 2 is @sample/ui-kit, status 'current', no advisory.
    const row = w.findAll('.ci-table__row')[2]!;
    expect(row.text()).toContain('@sample/ui-kit');
    await row.find('.ci-packages__details').trigger('click');
    expect(w.find('.ci-package-dialog').text()).toContain('Metadata is illustrative.');
    w.unmount();
  });

  it('shows the path and the licences tabs; export sends the inventory', async () => {
    withSnapshot();
    const w = mountD();
    await w.find('[role="tab"][data-tab-id="path"]').trigger('click');
    expect(w.findAll('.ci-dep-path__step')).toHaveLength(3);
    await w.find('[role="tab"][data-tab-id="licenses"]').trigger('click');
    expect(w.text()).toContain('Needs review');
    expect(w.text()).toContain('Policy compatibility needs a project-specific legal review.');
    await w.find('.ci-dependencies__export').trigger('click');
    expect(vi.mocked(downloadText).mock.calls[0]![1]).toBe('sample-package-inventory.csv');
    w.unmount();
  });

  it('V19: package rows take no focus or click; each Details button is named "Details for <package>", starting with its text', async () => {
    withSnapshot();
    const w = mountD();
    const rows = w.findAll('.ci-table__row');
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.attributes('tabindex') === undefined)).toBe(true);
    await rows[0]!.trigger('click');
    expect(w.find('.ci-package-dialog').exists()).toBe(false);
    const details = w.findAll('.ci-packages__details');
    expect(details).toHaveLength(10);
    expect(details.every((b) => (b.attributes('aria-label') ?? '').startsWith(b.text()))).toBe(true);
    expect(details[0]!.text()).toBe('Details');
    expect(details[0]!.attributes('aria-label')).toBe('Details for @sample/document-parser');
    w.unmount();
  });
});
