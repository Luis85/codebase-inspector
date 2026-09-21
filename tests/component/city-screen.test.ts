import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CityScreen from '../../src/ui/screens/CityScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

// Hoisted to module scope (oxlint's consistent-function-scoping): captures nothing
// from the describe block.
function mountCity() {
  return mount(CityScreen, { global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });
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

  it('shows three summary cards; cycles is unknown, never 0', () => {
    const w = mountCity();
    const cards = w.findAll('.ci-city-summary__card');
    expect(cards).toHaveLength(3);
    expect(cards[1]!.find('.ci-city-summary__value').text()).toBe('—');
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
});
