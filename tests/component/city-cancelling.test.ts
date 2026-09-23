// Part 6 Y1: the city's cancelling state, through the real StatusBanner/EmptyState split in
// CityWorkspace. A first scan being cancelled must never bring back the COPY-01 welcome or
// its "Select a codebase" action (rendered only for 'no-source').
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import { computeLayout } from '../../src/domain/layout/layout';
import { initialScanLifecycleState } from '../../src/application/run-state';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useRunStore } from '../../src/ui/stores/run-store';
import { COPY_01 } from '../../src/ui/copy';
import { CANCELLING_BANNER } from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const cancel = (): void => {
  useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'cancelling', runId: 'r1', generation: 1 } });
};

describe('city cancelling state (Part 6 Y1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useCityStore().navigate('city');
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('a first scan being cancelled shows only the banner: the welcome and its action never come back mid-cancel', async () => {
    const w = mount(App);
    expect(w.find('.ci-welcome__action').exists()).toBe(true);
    cancel();
    await nextTick();
    expect(w.get('.ci-status-banner').text()).toBe(CANCELLING_BANNER(false));
    expect(w.find('.ci-welcome__action').exists()).toBe(false);
    expect(w.find('.ci-empty-state').exists()).toBe(false);
    expect(w.text()).not.toContain(COPY_01);
    w.unmount();
  });

  it('over a snapshot, the banner (role="status") says the current snapshot stays available', async () => {
    const snap = buildSnapshotFixture({ files: 4, directories: 1 });
    useCityStore().setCity(snap, computeLayout(snap));
    const w = mount(App);
    cancel();
    await nextTick();
    const banner = w.get('.ci-status-banner');
    expect(banner.text()).toBe(CANCELLING_BANNER(true));
    expect(banner.attributes('role')).toBe('status');
    w.unmount();
  });
});
