import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ROUTE_IDS, DEFAULT_ROUTE, type RouteId } from '../../src/domain/route-ids';
import { validateCityViewState } from '../../src/domain/validator';
import { defaultCityViewState } from '../../src/host/view-state';
import { pickUiState, seedStoreFromState } from '../../src/host/view-state-sync';
import { useCityStore } from '../../src/ui/stores/city-store';

describe('route vocabulary', () => {
  it('lists all 15 prototype routes and defaults to Overview', () => {
    expect(ROUTE_IDS).toHaveLength(15);
    expect(DEFAULT_ROUTE).toBe('overview');
  });
});

describe('view-state route validation', () => {
  it('accepts a payload without a route (pre-WP-02 workspace.json)', () => {
    expect(validateCityViewState(defaultCityViewState()).route).toBeUndefined();
  });
  it('keeps a known route', () => {
    expect(validateCityViewState({ ...defaultCityViewState(), route: 'overview' }).route).toBe('overview');
  });
  it('drops an unknown route WITHOUT discarding the rest of the payload', () => {
    const decoded = validateCityViewState({ ...defaultCityViewState(), query: 'kept', route: 'nope' });
    expect(decoded.route).toBeUndefined();
    expect(decoded.query).toBe('kept');
  });
});

describe('city-store navigation', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  it('starts on the default route', () => {
    expect(useCityStore().route).toBe('overview');
  });
  it('navigates to a known route and ignores an unknown one', () => {
    const store = useCityStore();
    store.navigate('overview');
    expect(store.route).toBe('overview');
    store.navigate('bogus' as RouteId);
    expect(store.route).toBe('overview');
  });
  it('navigating never touches selection, query or camera', () => {
    const store = useCityStore();
    store.select('e1');
    store.setQuery('abc');
    store.navigate('overview');
    expect(store.selectedEntityId).toBe('e1');
    expect(store.query).toBe('abc');
    expect(store.camera).toBeNull();
  });
});

describe('view-state sync carries the route', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  it('pickUiState reads the live route', () => {
    const store = useCityStore();
    store.navigate('overview');
    expect(pickUiState(store).route).toBe('overview');
  });
  it('seedStoreFromState restores a route, and the default when none was persisted', () => {
    const store = useCityStore();
    seedStoreFromState(store, { ...defaultCityViewState(), route: 'city' });
    expect(store.route).toBe('city');
    seedStoreFromState(store, defaultCityViewState());
    expect(store.route).toBe('overview');
  });
  it('an unknown persisted route decodes, then seeds, to Overview through the one existing fallback', () => {
    const store = useCityStore();
    store.navigate('city');
    seedStoreFromState(store, validateCityViewState({ ...defaultCityViewState(), route: 'nope' }));
    expect(store.route).toBe('overview');
  });
});
