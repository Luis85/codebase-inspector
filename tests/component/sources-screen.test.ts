import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useRunStore } from '../../src/ui/stores/run-store';
import { initialScanLifecycleState } from '../../src/application/run-state';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function mountS(onSelectCodebase = vi.fn(), onScanRequested = vi.fn()) {
  return mount(SourcesScreen, { attachTo: document.body, global: { provide: { onSelectCodebase, onScanRequested } } });
}
const withSnapshot = () => {
  const snap = buildSnapshotFixture({ files: 10, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
};

describe('SourcesScreen (Part 4)', () => {
  beforeEach(() => { setActivePinia(createPinia()); useCityStore().navigate('sources'); });

  it('without a snapshot: the scope panel asks for a codebase, the providers still render', () => {
    const w = mountS();
    expect(w.find('.ci-sources__scope').text()).toContain('No snapshot yet');
    expect(w.findAll('.ci-provider')).toHaveLength(8);
    expect(w.find('.ci-provider--inventory .ci-provenance--unknown').exists()).toBe(true);
    expect(w.find('.ci-sources__status').text()).toContain('No scan has run in this leaf yet.');
    w.unmount();
  });

  it('shows the real scope of the snapshot on screen', () => {
    const snap = withSnapshot();
    const w = mountS();
    expect(w.find('.ci-sources__scope').text()).toContain(snap.scope.rootPath);
    expect(w.find('.ci-sources__scope').text()).toContain('Not followed');
    expect(w.find('.ci-provider--inventory .ci-provenance').exists()).toBe(false);
    w.unmount();
  });

  it('Rescan and Change source go to the city first, then call the host', async () => {
    withSnapshot();
    let routeAtCall = '';
    const scan = vi.fn(() => { routeAtCall = useCityStore().route; });
    const select = vi.fn();
    const w = mountS(select, scan);
    await w.find('.ci-sources__rescan').trigger('click');
    expect(scan).toHaveBeenCalledOnce();
    expect(routeAtCall).toBe('city');
    useCityStore().navigate('sources');
    await w.find('.ci-sources__change').trigger('click');
    expect(select).toHaveBeenCalledOnce();
    expect(useCityStore().route).toBe('city');
    w.unmount();
  });

  it('Rescan is aria-disabled while a run is in flight, and the status explains how to cancel', async () => {
    const scan = vi.fn();
    const w = mountS(vi.fn(), scan);
    const approval = { profileId: 'p', sourceFingerprint: 's', scopeFingerprint: 'c', approvedAt: 'a', operation: 'read-only-inventory' as const };
    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'running', runId: 'r', generation: 1, approval, processedFiles: 12 } });
    await nextTick();
    const rescan = w.find('.ci-sources__rescan');
    expect(rescan.attributes('aria-disabled')).toBe('true');
    await rescan.trigger('click');
    expect(scan).not.toHaveBeenCalled();
    expect(w.find('.ci-sources__status').text()).toContain('12 files read so far');
    expect(w.find('.ci-sources__status').text()).toContain('Cancel scan');
    w.unmount();
  });

  it('shows a failed run with its message', async () => {
    const w = mountS();
    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'failed', runId: 'r', message: 'EACCES: permission denied' } });
    await nextTick();
    expect(w.find('.ci-sources__status').text()).toContain('The last scan failed: EACCES: permission denied');
    w.unmount();
  });

  it('a provider’s "used by" button navigates to that screen', async () => {
    withSnapshot();
    const w = mountS();
    await w.find('.ci-provider--secrets .ci-provider__route').trigger('click');
    expect(useCityStore().route).toBe('security');
    w.unmount();
  });
});
