// Phase 2 fix wave, M4: `decodeCityViewState`'s `ok` flag was untested. Mutation Q12
// (returning `ok: true` for an invalid payload) left the suite green -- yet the flag's
// entire purpose is to stop a fallback being mistaken for a genuine restore, which is
// what `city-view.ts` gates `stateWasRestored`, and therefore all of
// `seedStoreFromState`, on. workspace.json is user-editable (spec 4.4), so this is a
// boundary over untrusted input, not an internal convenience.
import { describe, expect, it } from 'vitest';
import { decodeCityViewState, defaultCityViewState } from '../../src/host/view-state';

describe('decodeCityViewState', () => {
  it('M4: reports ok:false and hands back the fallback UNCHANGED for an invalid payload', () => {
    const fallback = { ...defaultCityViewState(), query: 'kept' };
    const decoded = decodeCityViewState({ viewMode: 'nonsense' }, fallback);

    expect(decoded.ok).toBe(false);
    expect(decoded.state).toBe(fallback);        // reference-identical: nothing partial
  });

  it('M4: reports ok:true only for a payload that genuinely validated', () => {
    const restored = { ...defaultCityViewState(), query: 'src', viewMode: 'top' as const };
    const decoded = decodeCityViewState(restored, defaultCityViewState());

    expect(decoded.ok).toBe(true);
    expect(decoded.state.query).toBe('src');
    expect(decoded.state.viewMode).toBe('top');
  });

  it('M4: a smuggled key is a rejection, never a partial application', () => {
    const fallback = defaultCityViewState();
    const decoded = decodeCityViewState({ ...fallback, rootPath: '/etc/passwd' }, fallback);

    expect(decoded.ok).toBe(false);
    expect(decoded.state).toBe(fallback);
    expect(decoded.state).not.toHaveProperty('rootPath');
  });

  it('never throws out of a decode, whatever the payload is', () => {
    const fallback = defaultCityViewState();
    for (const payload of [null, undefined, 42, 'string', [], { viewMode: 3 }]) {
      expect(() => decodeCityViewState(payload, fallback)).not.toThrow();
      expect(decodeCityViewState(payload, fallback).ok).toBe(false);
    }
  });
});
