// Shared doubles for the two task-10 renderer suites (tests/component/
// renderer-contract.test.ts and renderer-disposal.test.ts). The `three` module double
// itself cannot live here — vi.mock is hoisted per test FILE — but everything around it
// can, which is what keeps both files inside the 450-line budget.
import { vi } from 'vitest';
import type { LayoutResult } from '../../src/domain/layout/types';
import type { CityPalette } from '../../src/visualization/renderer-port';
import { CATEGORY_IDS } from '../../src/domain/classify';

export const WIDTH = 800;
export const HEIGHT = 600;

/** The two-character \0 escape, never a raw NUL byte: a raw one makes the file binary
 *  to git and kills diff, blame and line-level merge (ruling M55/D26). */
export const ID = (path: string): string => `repo\0file\0${path}`;
const DIR = 'repo\0directory\0src';

export function layoutOf(snapshotId: string, count: number): LayoutResult {
  return {
    snapshotId, layoutVersion: '1',
    lots: Array.from({ length: count }, (_, i) => ({
      entityId: ID(`src/f${i}.ts`), directoryId: DIR,
      center: [i * 3, 1, 0] as [number, number, number],
      dimensions: [2, 2, 2] as [number, number, number],
      colorKey: CATEGORY_IDS[0], metricState: 'measured' as const,
    })),
    districts: [{
      directoryId: DIR, parentId: null, name: 'src', depth: 0,
      center: [0, 0, 0], extent: [40, 20], labelAnchor: [0, 0.2, 0], aggregated: false,
    }],
    bounds: { min: [-10, 0, -10], max: [10, 2, 10] },
    scale: { metricId: 'physical-lines', name: 'Physical lines', cap: 1000, unit: 'lines', clampedCount: 0 },
  };
}

/** One measured lot and one whose metric is unavailable, so the two channels that can
 *  carry a colour to the marker mesh (its material, and its per-instance colour) can be
 *  told apart by their PRODUCT. */
export function layoutWithUnavailable(): LayoutResult {
  const base = layoutOf('mixed', 2);
  return {
    ...base,
    lots: [base.lots[0]!, { ...base.lots[1]!, metricState: 'unavailable' as const }],
  };
}

/** Phase 2 fix wave, I7: two districts, the second anchored far outside the fitted
 *  view (bounds stay the base fixture's), so LABEL CULLING is observable -- one label
 *  on screen, one off it. */
export function layoutWithTwoDistricts(): LayoutResult {
  const base = layoutOf('two-districts', 2);
  return {
    ...base,
    districts: [
      { ...base.districts[0]!, name: 'src' },
      {
        directoryId: 'repo\0directory\0tests', parentId: null, name: 'tests', depth: 0,
        center: [5000, 0, 0], extent: [40, 20], labelAnchor: [5000, 0.2, 0], aggregated: false,
      },
    ],
  };
}

export function paletteFixture(background = '#1e1e1e'): CityPalette {
  const categories = Object.fromEntries(CATEGORY_IDS.map((id) => [id, '#4c8bf5'])) as CityPalette['categories'];
  return {
    background, districtSurface: '#2a2a2a', districtBorder: '#3a3a3a',
    labelText: '#dddddd', selection: '#ffb020', unavailable: '#808080', categories,
  };
}

/** jsdom's canvas resolves no context at all, so the renderer's own WebGL2 pre-check
 *  would (correctly) report `unavailable{unsupported}` before any of these suites got
 *  going. Reached through an index rather than a method reference so that swapping it
 *  is not an unbound-method hazard. */
export function stubGetContext(result: 'ok' | 'null' | 'throw'): void {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn((type: string) => {
    if (result === 'throw') throw new Error('no context');
    if (result === 'null' || type !== 'webgl2') return null;
    return { getExtension: () => null };
  });
}

export function captureGetContext(): () => void {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  const original = proto.getContext;
  return () => { proto.getContext = original; };
}

export interface WinDouble {
  win: Window;
  runFrames: () => void;
  cancelSpy: ReturnType<typeof vi.fn>;
  resizeObserver: ReturnType<typeof vi.fn>;
}

/** A window whose rAF queues rather than runs, so "nothing draws after the scene
 *  settles" is a statement a test can actually make. `window.setTimeout`, not a bare
 *  one, for the same pop-out reason the production code has (obsidianmd's own rule). */
export function makeWinDouble(): WinDouble {
  const frames: (() => void)[] = [];
  const cancelSpy = vi.fn();
  const resizeObserver = vi.fn();
  const win = {
    document,
    requestAnimationFrame: (cb: () => void) => { frames.push(cb); return frames.length; },
    cancelAnimationFrame: cancelSpy,
    setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
    clearTimeout: (handle: number) => { window.clearTimeout(handle); },
    ResizeObserver: resizeObserver,
    devicePixelRatio: 1,
    localStorage: { getItem: () => null },
  } as unknown as Window;
  return {
    win, cancelSpy, resizeObserver,
    runFrames: () => { frames.splice(0, frames.length).forEach((f) => { f(); }); },
  };
}
