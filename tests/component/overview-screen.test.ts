import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import OverviewScreen from '../../src/ui/screens/OverviewScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(files = 30) {
  const snap = buildSnapshotFixture({ files, directories: 3 });
  useCityStore().setCity(snap, computeLayout(snap));
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

  it('renders the four signal cards, with architecture labelled sample', () => {
    withSnapshot();
    const w = mountOverview();
    const cards = w.findAll('.ci-metric-card');
    expect(cards).toHaveLength(4);
    expect(cards[2]!.find('.ci-metric-card__value').text()).toMatch(/^\d+$/);
    expect(cards[2]!.find('.ci-provenance--sample').exists()).toBe(true);
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
    expect(text).toContain('Import graph');
    expect(text).toContain('Unknown');
  });

  it('never shows a bare "0 change hotspots" for an empty snapshot (ruling 1)', () => {
    withSnapshot(0);
    const w = mountOverview();
    expect(w.text()).not.toContain('0 change hotspots');
    expect(w.find('.ci-callout__text').text()).toContain('— change hotspots');
  });
});
