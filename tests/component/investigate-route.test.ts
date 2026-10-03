// WP-04 IN4, IN6: the Investigate route — its route vocabulary, its Act nav entry, the
// empty states it shares with Quality (No snapshot / Not analysed) and the per-leaf
// selection store's gone notice when a re-import drops the selected finding.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import { isRouteId } from '../../src/domain/route-ids';
import { validateCityViewState } from '../../src/domain/validator';
import { defaultCityViewState } from '../../src/host/view-state';
import { NAV_SECTIONS } from '../../src/ui/routes';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { findingFingerprint } from '../../src/ui/read-models/findings';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, snapshotWithOnlyFiles } from '../fixtures/evidence-report';
import { INVESTIGATE_FINDING_GONE } from '../../src/ui/inspector-copy';

const mountApp = () => mount(App, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });

function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 10, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}

describe('Investigate route (WP-04 IN4, IN6)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('is a known route, accepted by the view-state validator', () => {
    expect(isRouteId('investigate')).toBe(true);
    expect(validateCityViewState({ ...defaultCityViewState(), route: 'investigate' }).route).toBe('investigate');
  });

  it('is listed in the Act nav group; its nav button navigates there', async () => {
    expect(NAV_SECTIONS.find((s) => s.group === 'Act')!.routes).toEqual(['investigate', 'workbench', 'report']);
    const w = mountApp();
    const button = w.findAll('.ci-nav__item').find((b) => b.text().includes('Investigate'))!;
    await button.trigger('click');
    expect(useCityStore().route).toBe('investigate');
    expect(w.find('.ci-screen--investigate').exists()).toBe(true);
    w.unmount();
  });

  it('with a snapshot and no report shows Not analysed, and Import goes to Data & scans', async () => {
    withSnapshot();
    useCityStore().navigate('investigate');
    const w = mountApp();
    expect(w.find('.ci-not-analysed').exists()).toBe(true);
    await w.find('.ci-not-analysed__import').trigger('click');
    // Full App is mounted, so navigating to Data & scans mounts SourcesScreen, whose own
    // immediate watcher consumes the import request at once (opens its dialog) — this
    // test only pins that Investigate's Import button asks for the same route Quality's does.
    expect(useCityStore().route).toBe('sources');
    w.unmount();
  });

  it('shows no sample-data badge on Investigate', async () => {
    withSnapshot();
    useCityStore().navigate('investigate');
    const w = mountApp();
    expect(w.find('.ci-topbar__sample').exists()).toBe(false);
    w.unmount();
  });

  it('clears the selection and shows the gone notice when a re-import drops the finding', async () => {
    const snap = withSnapshot();
    attachSyntheticReport(snap);
    const { quality } = useReadModels();
    const files = snap.entities.filter((e) => e.kind === 'file');
    const file0 = files[0]!;
    const file1 = files[1]!;
    const finding = quality.value.findings.find((f) => f.file.id === file0.id && f.kind === 'unused-exports')!;
    const fingerprint = findingFingerprint(file0.id, finding.id);
    useInvestigationStore().open(fingerprint);
    useCityStore().navigate('investigate');
    const w = mountApp();
    attachSyntheticReport(snapshotWithOnlyFiles(snap, [file1.path]));
    await nextTick();
    expect(w.find('.ci-callout').text()).toContain(INVESTIGATE_FINDING_GONE);
    expect(useInvestigationStore().selectedFingerprint).toBeNull();
    w.unmount();
  });

  it('keeps the selection and shows no callout when a re-import still reports the finding', async () => {
    const snap = withSnapshot();
    attachSyntheticReport(snap);
    const { quality } = useReadModels();
    const file0 = snap.entities.filter((e) => e.kind === 'file')[0]!;
    const finding = quality.value.findings.find((f) => f.file.id === file0.id && f.kind === 'unused-exports')!;
    const fingerprint = findingFingerprint(file0.id, finding.id);
    useInvestigationStore().open(fingerprint);
    useCityStore().navigate('investigate');
    const w = mountApp();
    attachSyntheticReport(snap);
    await nextTick();
    expect(w.find('.ci-callout').exists()).toBe(false);
    expect(useInvestigationStore().selectedFingerprint).toBe(fingerprint);
    w.unmount();
  });
});
