// Gap closure GRA4 (spec §7): the city's root-unavailable state, through the real StatusBanner in
// CityWorkspace. A published snapshot stays readable; with no snapshot there is nothing to keep, so
// the welcome shows instead.
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
import { COPY_28 } from '../../src/ui/copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const unavailable = (): void => {
  useRunStore().setLifecycle({
    ...initialScanLifecycleState(),
    run: { status: 'failed', runId: 'r1', message: 'The source directory is no longer available: /x' },
    banner: 'Scan failed: The source directory is no longer available: /x',
    rootUnavailable: true,
  });
};

describe('city root-unavailable state (GRA4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useCityStore().navigate('city');
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('over a snapshot, the banner is exactly COPY-28 and the file rows stay listed', async () => {
    const snap = buildSnapshotFixture({ files: 4, directories: 1 });
    useCityStore().setCity(snap, computeLayout(snap));
    const w = mount(App);
    unavailable();
    await nextTick();
    const banner = w.get('.ci-status-banner');
    expect(banner.text()).toBe(COPY_28);
    expect(banner.text()).not.toContain('Scan failed');
    expect(w.findAll('.ci-file-list__row').length).toBeGreaterThan(0);
    w.unmount();
  });

  it('control: with no snapshot the welcome shows, not COPY-28', async () => {
    const w = mount(App);
    unavailable();
    await nextTick();
    expect(w.find('.ci-welcome__action').exists()).toBe(true);
    expect(w.text()).not.toContain(COPY_28);
    w.unmount();
  });
});
