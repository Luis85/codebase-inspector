import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import OwnershipScreen from '../../src/ui/screens/OwnershipScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CameraBookmark } from '../../src/domain/model';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(directories = 4) {
  const snap = buildSnapshotFixture({ files: 40, directories });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountO = () => mount(OwnershipScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('OwnershipScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('states team-level only, and labels the meters and every row as sample', () => {
    withSnapshot();
    const w = mountO();
    expect(w.text()).toContain('Team-level continuity signals only.');
    // Final review m7: the Knowledge-distribution panel carries the prototype's subtitle.
    expect(w.text()).toContain('Sample share of changes attributed to the largest contributing group.');
    const meters = w.findAll('.ci-meter');
    expect(meters.length).toBeGreaterThan(0);
    expect(meters.every((m) => (m.attributes('aria-label') ?? '').includes('sample'))).toBe(true);
    // E14: the meter list's own aria-label says this is sample, not just each bar's.
    expect(w.find('.ci-meters').attributes('aria-label')).toBe('Sample knowledge concentration by module');
    const rows = w.findAll('.ci-stewardship .ci-table__row');
    expect(rows).toHaveLength(4);
    // Every row's team, concentration AND review-candidates cell carries a sample
    // ProvenanceBadge (final review m3: candidates derive from sample priority).
    expect(rows.every((r) => r.findAll('.ci-provenance--sample').length === 3)).toBe(true);
    w.unmount();
  });

  it('Show in city searches the module path and navigates, without selecting or moving the camera', async () => {
    withSnapshot();
    const store = useCityStore();
    const fileId = store.snapshot!.entities.find((e) => e.kind === 'file')!.id;
    store.select(fileId);
    const camera: CameraBookmark = {
      projection: 'orthographic', mode: '3d', position: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0], zoom: 1.5,
    };
    store.setCamera(camera);
    const w = mountO();
    await w.find('.ci-stewardship__city').trigger('click');
    expect(store.route).toBe('city');
    expect(store.query).toMatch(/^dir-\d\/$/);
    // Show in city must not disturb a PRE-EXISTING selection or camera bookmark.
    expect(store.selectedEntityId).toBe(fileId);
    expect(store.camera).toEqual(camera);
    w.unmount();
  });

  it('the Show-in-city accessible name starts with its own visible text (WCAG 2.5.3)', () => {
    withSnapshot();
    const w = mountO();
    const btn = w.find('.ci-stewardship__city');
    const label = btn.attributes('aria-label') ?? '';
    expect(label.startsWith(btn.text())).toBe(true);
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
    expect(btn.find('.ci-icon').attributes('data-icon')).toBe('plus');
    await btn.trigger('click');
    await flushPromises();
    const item = review.workItems[0]!;
    expect(item.target.kind).toBe('module');
    expect(item.intent).toBe('pairing');
    // E50 (controller ruling): a focused button is never `disabled` — that drops focus
    // in real browsers — so this is `aria-disabled` plus a guarded handler instead.
    expect(w.find('.ci-steward-action__add').attributes('disabled')).toBeUndefined();
    expect(w.find('.ci-steward-action__add').attributes('aria-disabled')).toBe('true');
    expect(w.find('.ci-steward-action__add .ci-icon').attributes('data-icon')).toBe('check');
    // A second click on the now-added action must not call addWorkItem again.
    await w.find('.ci-steward-action__add').trigger('click');
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it('a save still in flight is not triggered twice (the pending branch)', async () => {
    withSnapshot();
    const w = mountO();
    const review = useReviewStore();
    const spy = vi.spyOn(review, 'addWorkItem');
    // Holds the FIRST call's repository save open, so `pendingWorkKeys` stays set.
    vi.spyOn(review.repository, 'saveWorkItem').mockReturnValue(new Promise(() => {}));
    const btn = w.find('.ci-steward-action__add');
    await btn.trigger('click');
    await btn.trigger('click');
    expect(spy).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it('announces success once the work item is added (E17)', async () => {
    withSnapshot();
    const w = mountO();
    await w.find('.ci-steward-action__add').trigger('click');
    await flushPromises();
    expect(w.find('[role="status"]').text()).toBe('Work item added.');
    w.unmount();
  });

  it('announces nothing when addWorkItem refuses the request (E17)', async () => {
    withSnapshot();
    const w = mountO();
    const review = useReviewStore();
    vi.spyOn(review, 'addWorkItem').mockResolvedValueOnce(null);
    await w.find('.ci-steward-action__add').trigger('click');
    await flushPromises();
    expect(w.find('[role="status"]').text()).toBe('');
    w.unmount();
  });

  it('announces a failure when addWorkItem rejects (E17)', async () => {
    withSnapshot();
    const w = mountO();
    const review = useReviewStore();
    vi.spyOn(review, 'addWorkItem').mockRejectedValueOnce(new Error('nope'));
    await w.find('.ci-steward-action__add').trigger('click');
    await flushPromises();
    expect(w.find('[role="status"]').text()).toBe('Could not add this work item.');
    w.unmount();
  });

  it('exports the stewardship map, including team_state alongside every metric', async () => {
    withSnapshot();
    const w = mountO();
    await w.find('.ci-ownership__export').trigger('click');
    const call = vi.mocked(downloadText).mock.calls[0]!;
    expect(call[1]).toBe('sample-module-stewardship.csv');
    expect(call[2]).toContain('team_state');
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
