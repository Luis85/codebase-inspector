import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import AnnouncementRegion from '../../src/ui/components/AnnouncementRegion.vue';
import { useRunStore } from '../../src/ui/stores/run-store';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';
import { CANCELLED_BANNER, initialScanLifecycleState } from '../../src/application/run-state';
import { CANCELLING_BANNER } from '../../src/ui/inspector-copy';
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

  // Phase 2 fix wave, M16: the two `?? 'Scan cancelled.'` / `?? 'Scan failed.'`
  // fallbacks were dead -- run-state.ts sets a banner on BOTH terminal transitions
  // and run-store copies it verbatim, so no reducer path reaches here with a null
  // banner -- and they were invented microcopy with no COPY id behind it. Silence is
  // the honest behaviour if that invariant ever breaks; a fabricated string is not.
  it('M16: announces nothing, rather than invented copy, when a terminal transition carries no banner', async () => {
    const runStore = useRunStore();
    const wrapper = mountRegion({ value: 0 });

    runStore.setLifecycle({
      run: { status: 'cancelled', runId: 'r1' },
      approval: null, generation: 0, publishedSnapshotId: null, banner: null,
      selectedEntityId: null, query: '',
    });
    await nextTick();
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('');

    runStore.setLifecycle({
      run: { status: 'failed', runId: 'r2', message: 'disk error' },
      approval: null, generation: 0, publishedSnapshotId: null, banner: null,
      selectedEntityId: null, query: '',
    });
    await nextTick();
    expect(wrapper.get('[aria-live="assertive"]').text()).toBe('');
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

  // Task 9 fix round 1, item 8 (fold): DELETED, not fixed in place. This
  // asserted that a method named 'announceHover' — never declared anywhere,
  // never mentioned by any other test — is absent from the exposed instance.
  // That is true by construction and could never fail; nobody could
  // accidentally add a same-named method by coincidence, and checking `'x' in
  // obj` for an `x` this file itself invented is not a regression guard.
  // The REAL invariant ("hover never reaches this component") already has no
  // observable signal to assert against: AnnouncementRegion only watches
  // `runStore.run` and `cityStore.selectedEntityId` (both read directly in
  // this file's own tests above); CityRendererEvent's 'hover-changed' stays
  // entirely inside task 10's renderer territory and reaches neither store
  // this task. Per this item's own "make it assert something that can fail,
  // or delete it and say why", deleted.

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

  // Part 6 Y2: the move into cancelling is a real, user-requested outcome (E17): announced
  // once per run, in the banner's own words; a new run's cancel is heard again even while the
  // region still holds the same text (reannounce, Part 5 V22).
  it('announces the move into cancelling once per run, in the banner\'s words (Part 6 Y2)', async () => {
    const snapshot = buildSnapshotFixture({ files: 1 });
    useCityStore().setCity(snapshot, computeLayout(snapshot));
    const runStore = useRunStore();
    const wrapper = mountRegion({ value: 0 });
    const exposed = wrapper.vm as unknown as { announcePolite: (m: string) => void };
    const polite = wrapper.get('[aria-live="polite"]');
    const cancelling = (runId: string): void => {
      runStore.setLifecycle({ ...initialScanLifecycleState(), run: { status: 'cancelling', runId, generation: 1 } });
    };
    cancelling('r1');
    await flushPromises();
    expect(polite.text()).toBe(CANCELLING_BANNER(true));

    exposed.announcePolite('Something else.');
    cancelling('r1');
    await flushPromises();
    expect(polite.text(), 'the same run again is not a new outcome').toBe('Something else.');

    exposed.announcePolite(CANCELLING_BANNER(true));
    await nextTick();
    const seen: string[] = [];
    const observer = new MutationObserver(() => { seen.push((polite.element.textContent ?? '').trim()); });
    observer.observe(polite.element, { childList: true, characterData: true, subtree: true });
    cancelling('r2');
    await flushPromises();
    observer.disconnect();
    expect(seen).toContain('');
    expect(polite.text()).toBe(CANCELLING_BANNER(true));
  });

  it('with no snapshot, announces the first-scan wording (Part 6 Y2)', async () => {
    const wrapper = mountRegion({ value: 0 });
    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'cancelling', runId: 'r1', generation: 1 } });
    await flushPromises();
    expect(wrapper.get('[aria-live="polite"]').text()).toBe(CANCELLING_BANNER(false));
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
