// Part 5 V32 (Part 4 E2): the finding dialog's status region is cleared to '' the moment a
// decision starts, and only then set to that decision's outcome — so a stale success never
// sits in role="status" while the next decision is in flight, and a repeat re-announces.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport } from '../fixtures/evidence-report';
import { FINDING_ACKNOWLEDGED, FINDING_REOPENED } from '../../src/ui/inspector-copy';

describe('Finding dialog status (Part 5 V32, Part 4 E2)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('is "" while a decision is in flight, between the previous outcome and the new one', async () => {
    const snap = buildSnapshotFixture({ files: 60, directories: 3 });
    useCityStore().setCity(snap, computeLayout(snap));
    attachSyntheticReport(snap);
    const review = useReviewStore();
    const inner = createInMemoryReviewRepository();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    review.setRepository({ ...inner, removeDisposition: (fp) => gate.then(() => inner.removeDisposition(fp)) });
    const w = mount(QualityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
    const status = () => w.find('[role="dialog"] .ci-dialog__status').text();
    await w.findAll('.ci-findings-table__open')[0]!.trigger('click');
    await w.find('.ci-finding-dialog__acknowledge').trigger('click');
    await flushPromises();
    expect(status()).toBe(FINDING_ACKNOWLEDGED);
    await w.find('.ci-finding-dialog__reopen').trigger('click');
    await nextTick();
    expect(review.dispositions, 'the reopen is still in flight').toHaveLength(1);
    expect(status()).toBe('');
    release?.();
    await flushPromises();
    expect(status()).toBe(FINDING_REOPENED);
    w.unmount();
  });
});
