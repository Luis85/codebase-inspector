// Gap closure GRA8 (GCO6, §4.1 amended): CityViewState carries the codebase's display name
// (`name?`). workspace.json is user-editable, so the name goes through the same boundary
// decode as `route`: an unusable name is dropped on its own, never the camera, selection and
// query persisted beside it, and never the whole state.
import { describe, expect, it } from 'vitest';
import { decodeCityViewState, defaultCityViewState } from '../../src/host/view-state';
import { pickUiState, seedStoreFromState, type ViewStateSyncTarget } from '../../src/host/view-state-sync';
import type { CityViewState } from '../../src/domain/model';

const FALLBACK: CityViewState = { ...defaultCityViewState(), query: 'fallback' };
const BASE: CityViewState = { ...defaultCityViewState(), profileId: 'p1', query: 'needle', viewMode: 'top' };

describe('CityViewState.name at the decode boundary (GRA8)', () => {
  it('keeps a plain name', () => {
    const decoded = decodeCityViewState({ ...BASE, name: 'My repo' }, FALLBACK);
    expect(decoded.ok).toBe(true);
    expect(decoded.state.name).toBe('My repo');
    expect(decoded.state.query).toBe('needle');
  });

  it('drops a 201-character name and keeps the rest', () => {
    const decoded = decodeCityViewState({ ...BASE, name: 'x'.repeat(201) }, FALLBACK);
    expect(decoded.ok).toBe(true);
    expect(decoded.state.name).toBeUndefined();
    expect(decoded.state.query).toBe('needle');
    expect(decoded.state.viewMode).toBe('top');
  });

  it('keeps a 200-character name', () => {
    expect(decodeCityViewState({ ...BASE, name: 'x'.repeat(200) }, FALLBACK).state.name).toHaveLength(200);
  });

  it('drops a non-string name and keeps the rest', () => {
    const decoded = decodeCityViewState({ ...BASE, name: 42 }, FALLBACK);
    expect(decoded.ok).toBe(true);
    expect(decoded.state.name).toBeUndefined();
    expect(decoded.state.query).toBe('needle');
  });

  it('leaves a state with no name unchanged', () => {
    const decoded = decodeCityViewState(BASE, FALLBACK);
    expect(decoded.ok).toBe(true);
    expect(decoded.state).toEqual(BASE);
    expect('name' in decoded.state).toBe(false);
  });
});

function makeTarget(): ViewStateSyncTarget {
  let name: string | undefined;
  return {
    get selectedEntityId() { return null; },
    get query() { return ''; },
    get viewMode() { return '3d' as const; },
    get camera() { return null; },
    get previous3dCamera() { return null; },
    get inspectorOpen() { return false; },
    get route() { return 'city' as const; },
    get name() { return name; },
    select: () => {},
    setQuery: () => {},
    setCamera: () => {},
    setViewMode: () => {},
    openInspector: () => {},
    navigate: () => {},
    setName: (next: string | undefined) => { name = next; },
  };
}

describe('the name round trip through pickUiState and seedStoreFromState (GRA8)', () => {
  it('seeds the store from the persisted name and reads it back', () => {
    const store = makeTarget();
    seedStoreFromState(store, { ...BASE, name: 'My repo' });
    expect(store.name).toBe('My repo');
    expect(pickUiState(store).name).toBe('My repo');
  });

  it('seeds undefined for a state with no name', () => {
    const store = makeTarget();
    store.setName('Stale');
    seedStoreFromState(store, BASE);
    expect(store.name).toBeUndefined();
  });
});
