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

function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 12, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountD = () => mount(DependenciesScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

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

  it('a package dialog creates one review item keyed by package name', async () => {
    withSnapshot();
    const w = mountD();
    expect(w.findAll('.ci-table__row')[0]!.text()).toContain('@sample/document-parser');
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    const dialog = w.find('.ci-package-dialog');
    expect(dialog.text()).toContain('This is not a real advisory.');
    const reviewButton = w.find('.ci-package-dialog__review');
    (reviewButton.element as HTMLElement).focus();
    await reviewButton.trigger('click');
    await Promise.resolve(); await nextTick();
    const item = useReviewStore().workItems[0]!;
    expect(item.target).toEqual({ kind: 'package', name: '@sample/document-parser' });
    expect(item.intent).toBe('review');
    // E44: disabling the focused review button would drop focus out of the dialog, so it
    // stays enabled and uses aria-disabled instead; focus must stay put.
    expect(w.find('.ci-package-dialog__review').attributes('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(w.find('.ci-package-dialog__review').element);
    // A second click on the now "exists" button must not create a second item.
    await w.find('.ci-package-dialog__review').trigger('click');
    expect(useReviewStore().workItems).toHaveLength(1);
    w.unmount();
  });

  it('shows the path and the licences tabs; export sends the inventory', async () => {
    withSnapshot();
    const w = mountD();
    await w.find('[role="tab"][data-tab-id="path"]').trigger('click');
    expect(w.findAll('.ci-dep-path__step')).toHaveLength(3);
    await w.find('[role="tab"][data-tab-id="licenses"]').trigger('click');
    expect(w.text()).toContain('Needs review');
    await w.find('.ci-dependencies__export').trigger('click');
    expect(vi.mocked(downloadText).mock.calls[0]![1]).toBe('sample-package-inventory.csv');
    w.unmount();
  });
});
