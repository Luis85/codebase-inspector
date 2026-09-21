import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import OwnershipScreen from '../../src/ui/screens/OwnershipScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(directories = 4) {
  const snap = buildSnapshotFixture({ files: 40, directories });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountO = () => mount(OwnershipScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('OwnershipScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('states team-level only, and labels teams and concentration as sample', () => {
    withSnapshot();
    const w = mountO();
    expect(w.text()).toContain('Team-level continuity signals only.');
    const meters = w.findAll('.ci-meter');
    expect(meters.length).toBeGreaterThan(0);
    expect(meters.every((m) => (m.attributes('aria-label') ?? '').includes('sample'))).toBe(true);
    expect(w.findAll('.ci-stewardship .ci-table__row')).toHaveLength(4);
    w.unmount();
  });

  it('Show in city searches the module path and navigates, without selecting or moving the camera', async () => {
    withSnapshot();
    const store = useCityStore();
    const w = mountO();
    await w.find('.ci-stewardship__city').trigger('click');
    expect(store.route).toBe('city');
    expect(store.query).toMatch(/^dir-\d\/$/);
    expect(store.selectedEntityId).toBeNull();
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('root files get no Show in city action', () => {
    const snap = buildSnapshotFixture({ files: 6 });
    useCityStore().setCity(snap, computeLayout(snap));
    const w = mountO();
    expect(w.find('.ci-stewardship__city').exists()).toBe(false);
    w.unmount();
  });

  it('a stewardship action creates one module work item with its intent', async () => {
    withSnapshot();
    const w = mountO();
    const review = useReviewStore();
    const spy = vi.spyOn(review, 'addWorkItem');
    const btn = w.find('.ci-steward-action__add');
    await btn.trigger('click');
    await Promise.resolve(); await nextTick();
    const item = review.workItems[0]!;
    expect(item.target.kind).toBe('module');
    expect(item.intent).toBe('pairing');
    // E50 (controller ruling): a focused button is never `disabled` — that drops focus
    // in real browsers — so this is `aria-disabled` plus a guarded handler instead.
    expect(w.find('.ci-steward-action__add').attributes('disabled')).toBeUndefined();
    expect(w.find('.ci-steward-action__add').attributes('aria-disabled')).toBe('true');
    // A second click on the now-added action must not call addWorkItem again.
    await w.find('.ci-steward-action__add').trigger('click');
    await Promise.resolve(); await nextTick();
    expect(spy).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it('announces success once the work item is added (E17)', async () => {
    withSnapshot();
    const w = mountO();
    await w.find('.ci-steward-action__add').trigger('click');
    await Promise.resolve(); await nextTick();
    expect(w.find('[role="status"]').text()).toBe('Work item added.');
    w.unmount();
  });

  it('announces nothing when addWorkItem refuses the request (E17)', async () => {
    withSnapshot();
    const w = mountO();
    const review = useReviewStore();
    vi.spyOn(review, 'addWorkItem').mockResolvedValueOnce(null);
    await w.find('.ci-steward-action__add').trigger('click');
    await Promise.resolve(); await nextTick();
    expect(w.find('[role="status"]').text()).toBe('');
    w.unmount();
  });

  it('announces a failure when addWorkItem rejects (E17)', async () => {
    withSnapshot();
    const w = mountO();
    const review = useReviewStore();
    vi.spyOn(review, 'addWorkItem').mockRejectedValueOnce(new Error('nope'));
    await w.find('.ci-steward-action__add').trigger('click');
    await Promise.resolve(); await nextTick();
    expect(w.find('[role="status"]').text()).toBe('Could not add this work item.');
    w.unmount();
  });

  it('exports the stewardship map', async () => {
    withSnapshot();
    const w = mountO();
    await w.find('.ci-ownership__export').trigger('click');
    expect(vi.mocked(downloadText).mock.calls[0]![1]).toBe('sample-module-stewardship.csv');
    w.unmount();
  });

  it('announces a failure when the export throws', async () => {
    withSnapshot();
    vi.mocked(downloadText).mockImplementationOnce(() => { throw new Error('nope'); });
    const w = mountO();
    await w.find('.ci-ownership__export').trigger('click');
    await nextTick();
    expect(w.find('[role="status"]').text()).toBe('Could not start the download.');
    w.unmount();
  });
});
