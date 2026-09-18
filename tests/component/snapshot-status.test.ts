import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SnapshotStatus from '../../src/ui/components/SnapshotStatus.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';

function twelveMinutesLater(): Date {
  return new Date('2026-01-01T00:12:00.000Z');
}

describe('SnapshotStatus.vue (C12)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('marks a retained snapshot with its AGE', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 2 });   // capturedAt fixed at 2026-01-01T00:00:00Z
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mount(SnapshotStatus, { global: { provide: { now: twelveMinutesLater } } });
    expect(wrapper.text()).toContain('12 minutes ago');
  });

  it('renders nothing when there is no retained snapshot', () => {
    const wrapper = mount(SnapshotStatus);
    expect(wrapper.text()).toBe('');
  });

  it('never silently authorises a new scan on reopen', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const startScan = vi.fn();
    // Even if a caller injects a scan trigger under this exact key, mounting (or
    // "reopening") this purely presentational component must never invoke it —
    // spec 4.2/4.4: restoring/showing a retained snapshot never authorises a scan.
    mount(SnapshotStatus, { global: { provide: { startScan } } });
    expect(startScan).not.toHaveBeenCalled();
  });
});
