// CityViewState codec + validation at the boundary. workspace.json is user-editable
// (spec 4.4), so anything coming back through ItemView.setState() is untrusted input —
// exactly like a persisted setting — and goes through the same runtime validator,
// never a cast.
import { validateCityViewState } from '../domain/validator';
import type { CityViewState } from '../domain/model';

export function defaultCityViewState(): CityViewState {
  return {
    profileId: null,
    snapshotId: null,
    selectedEntityId: null,
    query: '',
    viewMode: 'list',
    camera: null,
    previous3dCamera: null,
    inspectorOpen: false,
  };
}

/** Decodes persisted/restored view state through validateCityViewState. A payload
 *  that fails validation (wrong shape, a smuggled key such as rootPath, an
 *  out-of-vocabulary viewMode) is discarded in favour of `fallback` — never partially
 *  applied, and setState never throws out of this. */
export function decodeCityViewState(input: unknown, fallback: CityViewState): CityViewState {
  try {
    return validateCityViewState(input);
  } catch {
    return fallback;
  }
}
