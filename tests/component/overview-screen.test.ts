import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import OverviewScreen from '../../src/ui/screens/OverviewScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useSnapshotJournal } from '../../src/ui/stores/snapshot-journal';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { journalEntryFor } from '../../src/ui/read-models/snapshot-comparison';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport } from '../fixtures/evidence-report';

function withSnapshot(files = 30) {
  const snap = buildSnapshotFixture({ files, directories: 3 });
  useCityStore().setCity(snap, computeLayout(snap));
}

/** Records a first and a second snapshot in the session journal (App.vue's job in the leaf). */
function withTwoSnapshots() {
  for (const snap of [buildSnapshotFixture({ files: 20, directories: 3 }), { ...buildSnapshotFixture({ files: 23, directories: 3 }), snapshotId: 'second' }]) {
    useCityStore().setCity(snap, computeLayout(snap));
    useSnapshotJournal().record(journalEntryFor(snap, fileSummariesFor(snap)));
  }
}

const mountOverview = () => mount(OverviewScreen, { global: { provide: { onSelectCodebase: vi.fn() } } });

describe('OverviewScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('asks for a codebase when there is no snapshot', () => {
    const w = mountOverview();
    expect(w.text()).toContain('No snapshot yet');
    expect(w.find('.ci-overview__select-source').exists()).toBe(true);
  });

  it('selecting a codebase goes to the city first, so its scan states are visible', async () => {
    const store = useCityStore();
    store.navigate('overview');
    const onSelectCodebase = vi.fn();
    const w = mount(OverviewScreen, { global: { provide: { onSelectCodebase } } });
    await w.find('.ci-overview__select-source').trigger('click');
    expect(onSelectCodebase).toHaveBeenCalledTimes(1);
    expect(store.route).toBe('city');
  });

  it('renders the four signal cards, with architecture exceptions unknown without a report', () => {
    withSnapshot();
    const w = mountOverview();
    const cards = w.findAll('.ci-metric-card');
    expect(cards).toHaveLength(4);
    expect(cards[2]!.find('.ci-metric-card__value').text()).toBe('—');
    expect(cards[2]!.find('.ci-provenance--unknown').exists()).toBe(true);
  });

  it('labels sample data at page level', () => {
    withSnapshot();
    expect(mountOverview().find('.ci-callout__badge').text()).toBe('Includes sample data');
  });

  it('opening a hotspot row selects the file and shows File detail without moving the camera', async () => {
    withSnapshot();
    const store = useCityStore();
    store.navigate('overview');
    const w = mountOverview();
    await w.find('.ci-table__row').trigger('click');
    expect(store.selectedEntityId).not.toBeNull();
    expect(store.route).toBe('file');
    expect(store.camera).toBeNull();
  });

  it('an investigation with a file selects it and follows its route', async () => {
    withSnapshot();
    const store = useCityStore();
    const w = mountOverview();
    await w.find('.ci-investigation').trigger('click');
    expect(store.route).toBe('hotspots');
    expect(store.selectedEntityId).not.toBeNull();
  });

  it('an investigation that lands on a file in the city opens the inspector, like a hotspot row', async () => {
    withSnapshot();
    const store = useCityStore();
    const w = mountOverview();
    const toCity = w.findAll('.ci-investigation').find((b) => b.text().startsWith('Inspect'));
    expect(toCity).toBeDefined();
    await toCity!.trigger('click');
    expect(store.route).toBe('city');
    expect(store.selectedEntityId).not.toBeNull();
    expect(store.inspectorOpen).toBe(true);
    expect(store.camera).toBeNull();
  });

  it('lists evidence coverage including unknown sources', () => {
    withSnapshot();
    const text = mountOverview().find('.ci-evidence-coverage').text();
    expect(text).toContain('Import relations');
    expect(text).toContain('Unknown');
  });

  it('fix round 1 #12: the Import relations row itself is unknown without a report, not merely "Unknown" somewhere on the page', () => {
    withSnapshot();
    const w = mountOverview();
    const dts = w.findAll('.ci-evidence-coverage dt');
    const idx = dts.findIndex((dt) => dt.text() === 'Import relations');
    expect(idx).toBeGreaterThanOrEqual(0);
    const dd = w.findAll('.ci-evidence-coverage dd')[idx]!;
    expect(dd.find('.ci-provenance--unknown').exists()).toBe(true);
    expect(dd.find('.ci-provenance--unknown').attributes('title')).toBe('Not analysed');
  });

  it('counts open findings only: a dismissal drops the card by one, matching Code quality\'s Open card (E48 I1)', async () => {
    withSnapshot();
    attachSyntheticReport(useCityStore().snapshot!);
    const { quality } = useReadModels();
    const w = mountOverview();
    const card = (): string => w.findAll('.ci-metric-card')[0]!.find('.ci-metric-card__value').text();
    const before = Number(card());
    await useReviewStore().dismiss(quality.value.findings[0]!.fingerprint, 'Reviewed, intended.', new Date(0));
    await flushPromises();
    expect(Number(card())).toBe(before - 1);
    expect(card()).toBe(String(quality.value.cards[0]!.value.value));
  });

  it('never shows a bare "0 change hotspots" for an empty snapshot (ruling 1)', () => {
    withSnapshot(0);
    const w = mountOverview();
    expect(w.text()).not.toContain('0 change hotspots');
    expect(w.find('.ci-callout__text').text()).toContain('— change hotspots');
  });

  it('with one snapshot in the journal there is no Compare action', () => {
    withSnapshot();
    const snap = useCityStore().snapshot!;
    useSnapshotJournal().record(journalEntryFor(snap, fileSummariesFor(snap)));
    const w = mountOverview();
    expect(w.find('.ci-overview__compare').exists()).toBe(false);
  });

  it('with two snapshots, Compare opens the comparison dialog instead of navigating', async () => {
    withTwoSnapshots();
    const store = useCityStore();
    store.navigate('overview');
    const w = mount(OverviewScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
    await w.find('.ci-overview__compare').trigger('click');
    expect(w.find('.ci-compare-dialog').exists()).toBe(true);
    expect(w.find('.ci-compare-dialog__added').text()).toBe('3');
    expect(store.route).toBe('overview');
    w.unmount();
  });
});
