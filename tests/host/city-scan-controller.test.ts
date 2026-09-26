// Polish G6 (Part 5 E12): CityScanController on its own, over doubles, not only through CityView.
import { describe, expect, it, vi } from 'vitest';
import type { App as VueApp } from 'vue';
import { CityScanController, provideScanCallbacks } from '../../src/host/city-scan-controller';
import { defaultCityViewState } from '../../src/host/view-state';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { makePluginDouble } from '../fixtures/city-view-doubles';

function controller(): CityScanController {
  return new CityScanController(makePluginDouble() as never, {
    profileStore: createFakeProfileStoreHarness().store, getFilesystem: () => createFakeSourceFileSystem({}).port,
    snapshotStore: new InMemorySnapshotStore(createFixedClock()), clock: createFixedClock(), ...dataPortDeps(),
  }, { viewState: () => defaultCityViewState(), showNotice: vi.fn() });
}

describe('CityScanController (Polish G6)', () => {
  it('is not running before any scan, and both cancels are safe no-ops then', () => {
    const c = controller();
    expect(c.isScanRunning()).toBe(false);
    expect(() => { c.cancelScan(); c.cancelIfRunning(); }).not.toThrow();
    expect(c.isScanRunning()).toBe(false);
  });

  it('provideScanCallbacks provides exactly three callbacks, each reaching the controller once', () => {
    const provided = new Map<string, () => void>();
    const app = { provide: (key: string, value: () => void) => { provided.set(key, value); } } as unknown as VueApp;
    const c = controller();
    const select = vi.spyOn(c, 'selectCodebase').mockResolvedValue(undefined);
    const start = vi.spyOn(c, 'startScan').mockResolvedValue(undefined);
    const cancel = vi.spyOn(c, 'cancelScan');
    provideScanCallbacks(app, c);
    expect(Array.from(provided.keys())).toEqual(['onSelectCodebase', 'onScanRequested', 'onCancelScan']);
    for (const callback of provided.values()) callback();
    expect([select, start, cancel].map((s) => s.mock.calls.length)).toEqual([1, 1, 1]);
  });
});
