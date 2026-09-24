import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import CityScreen from '../../src/ui/screens/CityScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useSnapshotJournal } from '../../src/ui/stores/snapshot-journal';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { journalEntryFor } from '../../src/ui/read-models/snapshot-comparison';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { RELATIONS_PATHS, attachRelationsReport, snapshotWithPaths } from '../fixtures/evidence-report';
import { FALLOW_NOT_ANALYSED, NO_VALUE } from '../../src/ui/inspector-copy';

// Hoisted to module scope (oxlint's consistent-function-scoping): captures nothing
// from the describe block.
function mountCity(attachTo?: HTMLElement) {
  return mount(CityScreen, { ...(attachTo ? { attachTo } : {}), global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });
}
function recordCurrent() {
  const snap = useCityStore().snapshot!;
  useSnapshotJournal().record(journalEntryFor(snap, fileSummariesFor(snap)));
}

describe('CityScreen', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const snap = buildSnapshotFixture({ files: 12 });
    useCityStore().setCity(snap, computeLayout(snap));
  });

  it('frames the unchanged city composition with a page header', () => {
    const w = mountCity();
    expect(w.find('h2').text()).toBe('Code city');
    expect(w.find('.ci-app').exists()).toBe(true);
  });

  it('shows three summary cards; cycles reads unknown, with the reason, never a bare 0', () => {
    const w = mountCity();
    const cards = w.findAll('.ci-city-summary__card');
    expect(cards).toHaveLength(3);
    const cycles = cards[1]!;
    expect(cycles.find('.ci-city-summary__value').text()).toBe(NO_VALUE);
    expect(cycles.find('.ci-provenance--unknown').exists()).toBe(true);
    expect(cycles.find('.ci-city-summary__caption').text()).toBe(FALLOW_NOT_ANALYSED);
  });

  it('with a relations report attached, the cycles card reads the recorded import-cycle count', () => {
    const snap = snapshotWithPaths(RELATIONS_PATHS, 'repo-city-summary-cycles');
    useCityStore().setCity(snap, computeLayout(snap));
    attachRelationsReport(snap);
    const w = mountCity();
    const cycles = w.findAll('.ci-city-summary__card')[1]!;
    expect(cycles.find('.ci-city-summary__value').text()).toBe('2');
    expect(cycles.find('.ci-provenance--unknown').exists()).toBe(false);
  });

  it('a summary card navigates to its screen', async () => {
    const w = mountCity();
    await w.findAll('.ci-city-summary__card')[0]!.trigger('click');
    expect(useCityStore().route).toBe('hotspots');
  });

  it('"View inventory" switches the city to its list view', async () => {
    const w = mountCity();
    await w.find('.ci-city-screen__inventory').trigger('click');
    expect(useCityStore().viewMode).toBe('list');
  });

  it('with one snapshot in the journal there is no Compare action', () => {
    recordCurrent();
    const w = mountCity();
    expect(w.find('.ci-city-screen__compare').exists()).toBe(false);
    w.unmount();
  });

  it('with two snapshots, Compare opens the comparison dialog', async () => {
    recordCurrent();
    const next = { ...buildSnapshotFixture({ files: 15 }), snapshotId: 'second' };
    useCityStore().setCity(next, computeLayout(next));
    recordCurrent();
    const w = mountCity(document.body);
    await w.find('.ci-city-screen__compare').trigger('click');
    expect(w.find('.ci-compare-dialog').exists()).toBe(true);
    expect(w.find('.ci-compare-dialog__added').text()).toBe('3');
    w.unmount();
  });
});
