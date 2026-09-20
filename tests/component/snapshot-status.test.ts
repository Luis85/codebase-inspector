import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SnapshotStatus from '../../src/ui/components/SnapshotStatus.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useRunStore } from '../../src/ui/stores/run-store';
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

  // Task 9 fix round 1, item 8 (fold): this test used to `provide` a `startScan`
  // key SnapshotStatus.vue never injects at all, then assert it was not
  // called — nothing could ever call it, so nothing could ever fail. Made
  // real: asserts against the run store's own OBSERVABLE state instead. If a
  // future change ever gave this "purely presentational" component a real
  // scan-triggering path (a `runStore.setLifecycle` call, directly or through
  // some other store action), `run.status` would move off 'idle' right here.
  it('never silently authorises a new scan on reopen', () => {
    const store = useCityStore();
    const runStore = useRunStore();
    const snapshot = buildSnapshotFixture({ files: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    mount(SnapshotStatus);
    // Mounting (or "reopening") this component must never authorise a scan —
    // spec 4.2/4.4: restoring/showing a retained snapshot never starts one.
    expect(runStore.run.status).toBe('idle');
  });

  // Task 12: the two factual claims ship with the G2 evidence that makes them true
  // (docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md). The scope modal makes
  // them BEFORE the read; this line makes them AFTER it, beside the snapshot they are
  // about -- which is where a user actually wonders what the scan did to their files.
  it('states "Read-only source access" and "Source remains unchanged." beside a retained snapshot', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mount(SnapshotStatus, { global: { provide: { now: twelveMinutesLater } } });
    expect(wrapper.text()).toContain('Read-only source access');
    expect(wrapper.text()).toContain('Source remains unchanged.');
  });

  it('claims nothing when there is no snapshot to claim it about', () => {
    // A safety claim with no scan behind it is a claim about nothing. This component
    // already renders nothing without a snapshot; the claims must not be the exception
    // that makes it render anyway.
    const wrapper = mount(SnapshotStatus);
    expect(wrapper.text()).toBe('');
  });
});
