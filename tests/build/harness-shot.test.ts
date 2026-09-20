import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHOTS } from '../../scripts/harness-shot.mjs';

const source = readFileSync('scripts/chromium.mjs', 'utf8');

describe('harness-shot SHOTS', () => {
  it('covers every one of the seven city screens', () => {
    const screens = new Set(SHOTS.map((shot) => new URLSearchParams(shot.query).get('screen')));
    // [...screens] already copies out of the Set, so a plain (mutating) .sort() is safe
    // here and needs no lib target newer than this project's own tsconfig already sets.
    expect([...screens].sort()).toEqual(['s05', 's06', 's07', 's08', 's09', 's10', 's11']);
  });

  it('gives every shot a unique id, because the id is the filename', () => {
    const ids = SHOTS.map((shot) => shot.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('captures the default city in both schemes', () => {
    // S06 is the light screen, but the point of a scheme pair is the SAME screen in
    // both — a light-theme regression in S05's composition is invisible otherwise.
    const s05 = SHOTS.filter((shot) => new URLSearchParams(shot.query).get('screen') === 's05');
    const themes = new Set(s05.map((shot) => new URLSearchParams(shot.query).get('theme')));
    expect(themes).toEqual(new Set(['dark', 'light']));
  });

  // The next two tests replace the brief's original assumption that `?screen=s11` is
  // S11's only capture. docs/concept/design/screens/s11-fallback.md gives S11 TWO entry
  // paths — "WebGL failed, was lost without recovery, or the user selected list-only
  // inspection" — and `?screen=s11` (mount.ts's `applyScreenState`) reaches only the
  // list-only one. A shot labelled `s11-fallback` that showed only that path would
  // mislead a reader into thinking the OTHER path (an actual WebGL failure) had also
  // been seen.

  it('names the list-only S11 shots for the path they actually show', () => {
    const ids = SHOTS.map((shot) => shot.id);
    expect(ids).toContain('s11-list-dark');
    expect(ids).toContain('s11-list-light');
    // Not the brief's original, now-misleading name.
    expect(ids.some((id) => id.startsWith('s11-fallback'))).toBe(false);
  });

  it('adds a dedicated capture of the OTHER S11 path — a genuine WebGL failure', () => {
    const failureShots = SHOTS.filter((shot) => shot.webglDisabled === true);
    expect(failureShots).toHaveLength(1);
    const [failureShot] = failureShots;
    if (!failureShot) throw new Error('unreachable: length asserted above');
    // Reached honestly: the resting screen (s05/s06/s10 per mount.ts), not list mode —
    // loading `?screen=s11` would exercise `store.setViewMode('list')` instead of ever
    // asking the renderer for a WebGL2 context.
    expect(new URLSearchParams(failureShot.query).get('screen')).not.toBe('s11');
  });
});

describe('chromium resolution', () => {
  it('asks playwright-core where the browser is rather than mirroring its layout', () => {
    // A hand-mirrored per-platform table broke on Windows in the project this pattern
    // came from, when Playwright renamed every build directory. The rule is that no
    // browser-layout literal is written down here.
    expect(source).toContain('executablePath');
    expect(source).not.toMatch(/chromium[-_]\d+/);
    expect(source).not.toContain('chrome-win');
    expect(source).not.toContain('chrome-linux');
    expect(source).not.toContain('chrome-mac');
  });
});
