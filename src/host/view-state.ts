// CityViewState codec + validation at the boundary. workspace.json is user-editable
// (spec 4.4), so anything coming back through ItemView.setState() is untrusted input —
// exactly like a persisted setting — and goes through the same runtime validator,
// never a cast.
import { validateCityViewState } from '../domain/validator';
import type { CityViewState } from '../domain/model';

/** Task 11 fix round 1, item 1: `viewMode` is `'3d'`, matching city-store.ts's own
 *  initial state exactly, not `'list'` -- the two defaults were already required to
 *  agree in spirit (task 9 fix round 1, item 3's ruling: "a SPATIAL default, not
 *  'list' ... list stays reachable as the FALLBACK, never the default") but the
 *  disagreement was harmless before this task, because nothing ever seeded a fresh
 *  view's own default INTO the store. Now that `city-view.ts` does exactly that on
 *  a genuine restore, a mismatched default here would silently force list mode
 *  (hiding CityViewport entirely) the first time it was ever applied. */
export function defaultCityViewState(): CityViewState {
  return {
    profileId: null,
    snapshotId: null,
    selectedEntityId: null,
    query: '',
    viewMode: '3d',
    camera: null,
    previous3dCamera: null,
    inspectorOpen: false,
  };
}

export interface DecodedCityViewState {
  state: CityViewState;
  /** True only when `input` genuinely validated — task 11 fix round 1, item 1:
   *  the caller uses this to decide whether there is anything real to seed the
   *  live UI store from. A rejected payload's `state` is `fallback` unchanged, and
   *  that fallback must never be mistaken for a genuine restore (e.g. re-seeding
   *  the store with a fresh view's own already-correct defaults). */
  ok: boolean;
}

/** Decodes persisted/restored view state through validateCityViewState. A payload
 *  that fails validation (wrong shape, a smuggled key such as rootPath, an
 *  out-of-vocabulary viewMode) is discarded in favour of `fallback` — never partially
 *  applied, and setState never throws out of this. */
export function decodeCityViewState(input: unknown, fallback: CityViewState): DecodedCityViewState {
  try {
    return { state: validateCityViewState(input), ok: true };
  } catch {
    return { state: fallback, ok: false };
  }
}
