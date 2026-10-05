// Gap closure GCP6. Three.js sets `window.__THREE__ = REVISION` as it evaluates and warns
// "Multiple instances of Three.js being imported" when the marker is already set, so a
// plugin reload in the same session printed that warning for a bundle that had in fact
// been unloaded. releaseThreeMarker clears OUR marker on unload, and only ours.
import { REVISION } from 'three';
import { describe, expect, it } from 'vitest';
import { releaseThreeMarker } from '../../src/visualization/three-marker';

describe('releaseThreeMarker', () => {
  it('deletes the marker when it holds this bundle\'s revision', () => {
    const target: { __THREE__?: unknown } = { __THREE__: REVISION };
    releaseThreeMarker(target);
    expect('__THREE__' in target).toBe(false);
  });

  it('keeps a marker written by a foreign Three.js revision', () => {
    const foreign = String(Number(REVISION) - 1);   // a different revision, derived so an upgrade cannot make it the same
    const target: { __THREE__?: unknown } = { __THREE__: foreign };
    releaseThreeMarker(target);
    expect(target.__THREE__).toBe(foreign);
  });

  it('is a no-op when no marker is set', () => {
    const target: { __THREE__?: unknown } = {};
    releaseThreeMarker(target);
    expect(target).toEqual({});
  });

  it('is idempotent', () => {
    const target: { __THREE__?: unknown } = { __THREE__: REVISION };
    releaseThreeMarker(target);
    releaseThreeMarker(target);
    expect('__THREE__' in target).toBe(false);
  });
});
