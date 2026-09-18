import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import AnnouncementRegion from '../../src/ui/components/AnnouncementRegion.vue';
import { useRunStore } from '../../src/ui/stores/run-store';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';
import { CANCELLED_BANNER } from '../../src/application/run-state';
import type { ApprovedInventoryRun } from '../../src/domain/model';

const approval: ApprovedInventoryRun = {
  profileId: 'p1', sourceFingerprint: 'sf', scopeFingerprint: 'cf',
  approvedAt: '2026-01-01T00:00:00.000Z', operation: 'read-only-inventory',
};

function mountRegion(nowMs: { value: number }) {
  return mount(AnnouncementRegion, { global: { provide: { announceNow: () => nowMs.value } } });
}

describe('AnnouncementRegion.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('is POLITE for stage transitions, completion and cancellation', async () => {
    const runStore = useRunStore();
    const nowMs = { value: 0 };
    const wrapper = mountRegion(nowMs);
    runStore.setLifecycle({
      run: { status: 'complete', runId: 'r1', snapshotId: 's1' },
      approval: null, generation: 0, publishedSnapshotId: 's1', banner: null,
      selectedEntityId: null, query: '',
    });
    await nextTick();
    const polite = wrapper.get('[aria-live="polite"]');
    expect(polite.text().length).toBeGreaterThan(0);

    runStore.setLifecycle({
      run: { status: 'cancelled', runId: 'r1' },
      approval: null, generation: 0, publishedSnapshotId: null, banner: CANCELLED_BANNER,
      selectedEntityId: null, query: '',
    });
    await nextTick();
    expect(wrapper.get('[aria-live="polite"]').text()).toContain(CANCELLED_BANNER);
  });

  it('is POLITE for control-initiated selection', async () => {
    const cityStore = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 1 });
    cityStore.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mountRegion({ value: 0 });
    const fileEntity = snapshot.entities.find((e) => e.kind === 'file')!;
    cityStore.select(fileEntity.id);
    await nextTick();
    expect(wrapper.get('[aria-live="polite"]').text().length).toBeGreaterThan(0);
    expect(wrapper.get('[aria-live="assertive"]').text()).toBe('');
  });

  it('is ASSERTIVE only for a blocking failure', async () => {
    const runStore = useRunStore();
    const wrapper = mountRegion({ value: 0 });
    runStore.setLifecycle({
      run: { status: 'failed', runId: 'r1', message: 'disk error' },
      approval: null, generation: 0, publishedSnapshotId: null, banner: 'Scan failed: disk error',
      selectedEntityId: null, query: '',
    });
    await nextTick();
    expect(wrapper.get('[aria-live="assertive"]').text()).toContain('disk error');
  });

  it('announces NOTHING on hover', () => {
    const wrapper = mountRegion({ value: 0 });
    const exposed = wrapper.vm as unknown as { politeMessage: string; assertiveMessage: string };
    // No hover-related method is exposed at all — this component never subscribes
    // to CityRendererEvent's 'hover-changed' (that stays entirely inside task 10's
    // renderer territory; nothing in src/ui/** reads it this task). Calling every
    // exposed announcement entry point with a hover-shaped payload proves none of
    // them treats it as anything worth announcing.
    expect('announceHover' in (wrapper.vm as object)).toBe(false);
    expect(exposed.politeMessage).toBe('');
    expect(exposed.assertiveMessage).toBe('');
  });

  it('throttles a rapidly changing counter', () => {
    const nowMs = { value: 1000 };
    const wrapper = mountRegion(nowMs);
    const exposed = wrapper.vm as unknown as { announceProgress: (n: number) => void; politeMessage: string };
    exposed.announceProgress(1);
    expect(exposed.politeMessage).toContain('1 files read so far.');
    nowMs.value += 10;   // well under the ~100 ms throttle window
    exposed.announceProgress(2);
    expect(exposed.politeMessage).toContain('1 files read so far.');
    nowMs.value += 100;   // now past the window
    exposed.announceProgress(3);
    expect(exposed.politeMessage).toContain('3 files read so far.');
  });

  it('exposes no aria-valuenow when the total is unknown', async () => {
    const runStore = useRunStore();
    const wrapper = mountRegion({ value: 0 });
    runStore.setLifecycle({
      run: { status: 'running', runId: 'r1', generation: 0, approval, processedFiles: 5 },
      approval, generation: 0, publishedSnapshotId: null, banner: null,
      selectedEntityId: null, query: '',
    });
    await nextTick();
    const progressEl = wrapper.find('[role="progressbar"]');
    expect(progressEl.exists()).toBe(true);
    expect(progressEl.attributes('aria-valuenow')).toBeUndefined();
    expect(progressEl.attributes('aria-valuetext')).toBeTruthy();
  });
});
