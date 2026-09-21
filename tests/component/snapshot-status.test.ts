import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SnapshotStatus from '../../src/ui/components/SnapshotStatus.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useRunStore } from '../../src/ui/stores/run-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';
import { CLAIM_READ_ONLY_ACCESS, CLAIM_SOURCE_UNCHANGED } from '../../src/ui/copy';
import type { CodebaseSnapshot } from '../../src/domain/model';

function twelveMinutesLater(): Date {
  return new Date('2026-01-01T00:12:00.000Z');
}

/** buildSnapshotFixture always captures at a fixed instant (2026-01-01T00:00:00Z);
 *  the absolute-time test below needs a DIFFERENT one to tell "formatted the real
 *  value" apart from "happened to match the fixture default". */
function withCapturedAt(snapshot: CodebaseSnapshot, capturedAt: string): CodebaseSnapshot {
  return { ...snapshot, providerRun: { ...snapshot.providerRun, capturedAt } };
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
    expect(wrapper.text()).toContain(CLAIM_READ_ONLY_ACCESS);
    expect(wrapper.text()).toContain(CLAIM_SOURCE_UNCHANGED);
  });

  it('claims nothing when there is no snapshot to claim it about', () => {
    // A safety claim with no scan behind it is a claim about nothing. This component
    // already renders nothing without a snapshot; the claims must not be the exception
    // that makes it render anyway.
    const wrapper = mount(SnapshotStatus);
    expect(wrapper.text()).toBe('');
  });

  // C12: "Absolute time and scope are available in details." A relative age alone
  // ("12 minutes ago") is unusable as evidence once the view has been closed and
  // reopened later. The literal 'Sep' (not 'Sept') pins that this is NOT the host
  // machine's own default-locale formatting (this sandbox's own default locale
  // renders September as "17.09.2026" or "17 Sept 2026", never "17 Sep 2026") —
  // a bare `toLocaleString()` would make this test locale-dependent and therefore
  // unable to fail portably; the implementation must use a fixed, unambiguous format.
  it('makes the absolute observation time available, not only a relative age', () => {
    const store = useCityStore();
    const snapshot = withCapturedAt(buildSnapshotFixture({ files: 2 }), '2026-09-17T13:00:00.000Z');
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mount(SnapshotStatus, { global: { provide: { now: twelveMinutesLater } } });
    expect(wrapper.find('.ci-snapshot-status__details').text()).toContain('17 Sep 2026');
  });

  it('states how much is included and how it is divided', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 144, directories: 6 });
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mount(SnapshotStatus, { global: { provide: { now: twelveMinutesLater } } });
    // Full-string, not `toContain('6 directory districts')`: 'district' is a
    // substring of 'districts', and this footer intentionally does NOT reuse
    // CityHeader's "directory districts" wording (see districts.ts's own
    // countDirectoryDistricts comment) — it must still be the SAME count.
    expect(wrapper.text()).toContain('144 included files');
    expect(wrapper.text()).toContain('6 districts');
  });

  it('names the scope root without leaking the full local absolute path', () => {
    // interactions/04-microcopy.md: "redact local absolute paths by default." The
    // fixture's scope.rootPath is '/fixture/root' — an absolute path a real user's
    // machine would make personally identifying (their home directory, username,
    // etc.), which must never appear verbatim.
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mount(SnapshotStatus, { global: { provide: { now: twelveMinutesLater } } });
    const details = wrapper.find('.ci-snapshot-status__details').text();
    expect(details).toContain('root');
    expect(details).not.toContain('/fixture/root');
  });
});
