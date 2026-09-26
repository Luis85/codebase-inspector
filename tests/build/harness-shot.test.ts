import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHOTS } from '../../scripts/harness-shot.mjs';

const source = readFileSync('scripts/chromium.mjs', 'utf8');

// oxlint(unicorn/consistent-function-scoping): captures nothing from the it() below.
const shotQuery = (id: string) => new URLSearchParams(SHOTS.find((shot) => shot.id === id)?.query ?? '');

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

  it('captures the Part 5 states: the editor in both schemes, a running scan, the import dialog (V29, V30)', () => {
    for (const theme of ['dark', 'light']) {
      const q = shotQuery(`wp02-workbench-editor-${theme}`);
      expect(q.get('theme')).toBe(theme);
      expect(q.get('items')).toBe('demo');
      expect(q.get('edit')).toBe('first');
    }
    expect(shotQuery('wp02-sources-running-dark').get('run')).toBe('running');
    expect(shotQuery('wp02-city-running-dark').get('run')).toBe('running');
    expect(shotQuery('wp02-settings-import-dark').get('import')).toBe('demo');
    expect(shotQuery('wp02-settings-import-dark').get('tab')).toBe('privacy');
  });

  it('captures the Part 6 states: cancelling, the fallow card, the S14 review step, real findings, the lens', () => {
    expect(shotQuery('wp02-city-cancelling-dark').get('run')).toBe('cancelling');
    for (const id of ['wp02-sources-fallow-dark', 'wp02-quality-fallow-dark', 'wp02-city-lens-dark', 'wp02-city-lens-light']) {
      expect(shotQuery(id).get('report'), id).toBe('demo');
    }
    expect(shotQuery('wp02-sources-fallow-dark').get('route')).toBe('sources');
    expect(shotQuery('wp02-quality-fallow-dark').get('route')).toBe('quality');
    expect(shotQuery('wp02-connect-fallow-review-dark').get('route')).toBe('sources');
    expect(shotQuery('wp02-connect-fallow-review-dark').get('fallow')).toBe('review');
    for (const theme of ['dark', 'light']) {
      const q = shotQuery(`wp02-city-lens-${theme}`);
      expect(q.get('theme')).toBe(theme);
      expect(q.get('route')).toBe('city');
      expect(q.get('lens')).toBe('findings');
    }
  });

  it('captures the Part 7 states: both routes, the installed review in both themes, and running, failed and collected', () => {
    expect(shotQuery('wp02-connect-fallow-routes-dark').get('fallow')).toBe('routes');
    for (const theme of ['dark', 'light']) {
      const q = shotQuery(`wp02-connect-fallow-installed-${theme}`);
      expect(q.get('fallow')).toBe('installed');
      expect(q.get('theme')).toBe(theme);
    }
    for (const state of ['running', 'failed', 'collected']) {
      const q = shotQuery(`wp02-sources-fallow-${state}-dark`);
      expect(q.get('analysis'), state).toBe(state);
      expect(q.get('route')).toBe('sources');
    }
    for (const id of ['wp02-connect-fallow-routes-dark', 'wp02-connect-fallow-installed-dark', 'wp02-connect-fallow-installed-light']) {
      expect(shotQuery(id).get('route'), id).toBe('sources');
    }
  });

  // WP-03 N38 (JF21): the city Relations section and its arcs, a highlighted cycle, and
  // the Architecture screen's Cycles/Edges/Rules tabs, all fed by the synthetic report's
  // fixed relation section (Task 14).
  it('captures the WP-03 states: the city Relations section, a highlighted cycle, and the Architecture Cycles/Edges/Rules tabs', () => {
    for (const theme of ['dark', 'light']) {
      const q = shotQuery(`wp03-city-relations-${theme}`);
      expect(q.get('screen'), theme).toBe('s07');
      expect(q.get('theme'), theme).toBe(theme);
      expect(q.get('report'), theme).toBe('demo');
      expect(q.get('select'), theme).not.toBeNull();
    }
    const cycleShot = shotQuery('wp03-city-cycle-dark');
    expect(cycleShot.get('screen')).toBe('s07');
    expect(cycleShot.get('report')).toBe('demo');
    expect(cycleShot.get('relations')).toBe('cycle');
    // Every Relations capture selects the SAME file — the one the demo report's relation
    // evidence is actually anchored on (Task 14's own execution ruling).
    const anchor = shotQuery('wp03-city-relations-dark').get('select');
    for (const id of ['wp03-city-relations-light', 'wp03-city-cycle-dark']) {
      expect(shotQuery(id).get('select'), id).toBe(anchor);
    }
    for (const tab of ['cycles', 'edges', 'rules']) {
      const q = shotQuery(`wp03-architecture-${tab}-dark`);
      expect(q.get('route'), tab).toBe('architecture');
      expect(q.get('report'), tab).toBe('demo');
      expect(q.get('tab'), tab).toBe(tab);
    }
    // Checked directly against the live harness: the Relations section's own "Cycles
    // through this file" and its Highlight cycle button sit past the 800px fold at the
    // standard viewport (the button's own bottom edge is ~883px) — a shot at VIEWPORT
    // would crop them out.
    for (const id of ['wp03-city-relations-dark', 'wp03-city-relations-light', 'wp03-city-cycle-dark']) {
      const shot = SHOTS.find((s) => s.id === id);
      expect(shot?.viewport?.width, id).toBe(1280);
      expect(shot?.viewport?.height ?? 0, id).toBeGreaterThanOrEqual(1050);
    }
  });

  // WP-03 N38 execution ruling: the Architecture screen now builds its graph only from
  // real relation evidence (an earlier WP-03 task deleted the sample-edges fixture), so
  // these three no longer show anything without report=demo — re-framed, same ids.
  it('re-frames the WP-02 Architecture captures with report=demo, now that sample edges are gone', () => {
    for (const id of ['wp02-architecture-dark', 'wp02-architecture-light', 'wp02-architecture-narrow-dark']) {
      expect(shotQuery(id).get('report'), id).toBe('demo');
      expect(shotQuery(id).get('route'), id).toBe('architecture');
    }
  });

  // Z42 fix round 1: FallowRunPanel and FallowRunBanner render below the fallow card's own
  // actions (FallowCardDetails.vue), which itself sits below the 800px fold at VIEWPORT — a
  // screenshot at the standard height never shows them, defeating the point of a capture that
  // exists specifically to show the run states. `fullPage` cannot fix this (the app shell fixes
  // `body`/`html` at the viewport height and scrolls internally, mirroring Obsidian's own fixed
  // leaf), so the fix is a taller `viewport`, checked directly to clear even the tallest of the
  // four (`failed`, with its log excerpt) with room to spare.
  it('gives the fallow card a tall enough viewport that the run panel and banner are never cropped out', () => {
    for (const id of ['wp02-sources-fallow-dark', 'wp02-sources-fallow-running-dark', 'wp02-sources-fallow-failed-dark', 'wp02-sources-fallow-collected-dark']) {
      const shot = SHOTS.find((s) => s.id === id);
      expect(shot?.viewport?.width, id).toBe(1280);
      expect(shot?.viewport?.height ?? 0, id).toBeGreaterThanOrEqual(2000);
    }
  });

  // WP-04 Task 17 (IN40): the Investigate screen, in both schemes, narrow, stale and the
  // create dialog — screen=s05 (IP36), the tall viewport checked directly against the live
  // harness (the detail column runs past the standard fold).
  it('captures the WP-04 Investigate states: both schemes, narrow, stale and the create dialog', () => {
    for (const theme of ['dark', 'light']) {
      const q = shotQuery(`wp04-investigate-${theme}`);
      expect(q.get('screen'), theme).toBe('s05');
      expect(q.get('theme'), theme).toBe(theme);
      expect(q.get('route'), theme).toBe('investigate');
      expect(q.get('report'), theme).toBe('demo');
      expect(q.get('investigate'), theme).toBe('demo');
    }
    const narrow = shotQuery('wp04-investigate-narrow-dark');
    expect(narrow.get('width')).toBe('700');
    expect(narrow.get('investigate')).toBe('demo');
    expect(shotQuery('wp04-investigate-stale-dark').get('investigate')).toBe('stale');
    expect(shotQuery('wp04-investigate-create-dialog-dark').get('investigate')).toBe('create');
    for (const id of ['wp04-investigate-stale-dark', 'wp04-investigate-create-dialog-dark']) {
      expect(shotQuery(id).get('route'), id).toBe('investigate');
      expect(shotQuery(id).get('report'), id).toBe('demo');
    }
    const narrowShot = SHOTS.find((s) => s.id === 'wp04-investigate-narrow-dark');
    expect(narrowShot?.viewport).toEqual({ width: 760, height: 1600 });
    for (const id of ['wp04-investigate-dark', 'wp04-investigate-light', 'wp04-investigate-stale-dark', 'wp04-investigate-create-dialog-dark']) {
      const shot = SHOTS.find((s) => s.id === id);
      expect(shot?.viewport, id).toEqual({ width: 1280, height: 1400 });
    }
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
