// Polish C-5a-M2 (Task 5b, "review-save failures in words"): before the bound codebase's review
// state is read, the store refuses every decision (Polish E3) and every add (Y10). The finding
// dialog says so and blocks its decision controls (aria-disabled plus a guard, E40), instead of
// a press that silently does nothing and a dismissal form that stays open without a word.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository, type WorkItem } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport } from '../fixtures/evidence-report';
import { FINDING_ACKNOWLEDGED, FINDING_REVIEW_LOADING, REVIEW_STORE_READ_FAILED } from '../../src/ui/inspector-copy';

const ignore = (): void => undefined;

/** Binds `c1` with its first read held until `release`, or rejected with `fail`. */
function bindHeld(fail = false) {
  const snap = buildSnapshotFixture({ files: 60, directories: 3 });
  useCityStore().setCity(snap, computeLayout(snap));
  attachSyntheticReport(snap);
  const repo = createInMemoryReviewRepository();
  let release: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const listWorkItems = (): Promise<WorkItem[]> => (fail ? Promise.reject(new Error('read failed')) : gate.then(() => repo.listWorkItems()));
  const review = useReviewStore();
  review.setRepositoryFactory(() => ({ ...repo, listWorkItems }));
  void review.bindRepository('c1').catch(ignore);
  const w = mount(QualityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
  return { w, review, release: () => { release?.(); } };
}
const hint = (w: ReturnType<typeof bindHeld>['w']) => w.find('.ci-finding-dialog__not-ready');
/** What the dialog announces: its status region, and every non-empty alert inside it. */
const announced = (w: ReturnType<typeof bindHeld>['w']) => ({
  status: w.find('[role="dialog"] .ci-dialog__status').text(),
  alerts: w.findAll('[role="dialog"] [role="alert"]').map((a) => a.text()).filter((t) => t !== ''),
});

describe('Finding dialog before the review state is read (Polish C-5a-M2)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('blocks Acknowledge and Add to plan with a hint while loading, then works once the read lands', async () => {
    const { w, review, release } = bindHeld();
    await w.findAll('.ci-findings-table__open')[0]!.trigger('click');
    const toggle = w.find('.ci-finding-dialog__acknowledge');
    expect(review.ready).toBe(false);
    expect(toggle.attributes('aria-disabled')).toBe('true');
    expect(toggle.attributes('disabled')).toBeUndefined();
    expect(w.find('.ci-finding-dialog__work-item').attributes('aria-disabled')).toBe('true');
    expect(hint(w).text()).toBe(FINDING_REVIEW_LOADING);
    expect(toggle.attributes('aria-describedby')).toBe(hint(w).attributes('id'));
    await toggle.trigger('click');
    await w.find('.ci-finding-dialog__work-item').trigger('click');
    await flushPromises();
    expect(review.dispositions).toEqual([]);
    expect(review.workItems).toEqual([]);
    expect(announced(w), '5b fix round: a blocked press announces nothing').toEqual({ status: '', alerts: [] });
    release();
    await flushPromises();
    expect(review.ready).toBe(true);
    expect(hint(w).exists()).toBe(false);
    expect(toggle.attributes('aria-disabled')).toBe('false');
    expect(toggle.attributes('aria-describedby')).toBeUndefined();
    await toggle.trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"] .ci-dialog__status').text()).toBe(FINDING_ACKNOWLEDGED);
    w.unmount();
  });

  it('blocks Save on the dismissal form while loading, so the form is never left open without a word', async () => {
    const { w, review } = bindHeld();
    await w.findAll('.ci-findings-table__open')[0]!.trigger('click');
    await w.find('.ci-finding-dialog__dismiss').trigger('click');
    await w.find('.ci-finding-dialog__dismissal textarea').setValue('Generated code');
    const save = w.find('.ci-finding-dialog__save-dismissal');
    expect(save.attributes('aria-disabled')).toBe('true');
    expect(save.attributes('aria-describedby')).toBe(hint(w).attributes('id'));
    await w.find('.ci-finding-dialog__dismissal').trigger('submit');
    await flushPromises();
    expect(review.dispositions).toEqual([]);
    expect(announced(w), '5b fix round: a blocked press announces nothing').toEqual({ status: '', alerts: [] });
    expect(hint(w).text()).toBe(FINDING_REVIEW_LOADING);
    w.unmount();
  });

  it('after a failed read, the hint says the saved state could not be read', async () => {
    const { w, review } = bindHeld(true);
    await flushPromises();
    expect(review.loadFailed).toBe(true);
    await w.findAll('.ci-findings-table__open')[0]!.trigger('click');
    expect(w.find('.ci-finding-dialog__acknowledge').attributes('aria-disabled')).toBe('true');
    expect(hint(w).text()).toBe(REVIEW_STORE_READ_FAILED);
    w.unmount();
  });
});
