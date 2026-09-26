// WP-02 Part 5 (V1–V3): city-view.ts (399/400) and CityWorkspace.vue (386/400) were split so
// later work has room. This keeps at least 40 lines of headroom under the 400-line src cap,
// and pins the extracted modules and the names later tasks build on. The checks read the
// source text rather than importing it, so each one fails on its own before the split.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CAP = 360;

function source(path: string): string {
  const abs = resolve(process.cwd(), path);
  expect(existsSync(abs), `${path} exists`).toBe(true);
  return readFileSync(abs, 'utf8');
}

describe('city line budget (Part 5 V3)', () => {
  it.each(['src/host/city-view.ts', 'src/ui/screens/CityWorkspace.vue'])('%s stays at or under 360 lines', (path) => {
    expect(source(path).split('\n').length).toBeLessThanOrEqual(CAP);
  });

  it('the scan lifecycle lives in city-scan-controller.ts (V1)', () => {
    const text = source('src/host/city-scan-controller.ts');
    expect(text).toMatch(/export class CityScanController\b/);
    expect(text).toMatch(/export function provideScanCallbacks\(/);
    expect(text).toContain("provide('onSelectCodebase'");
    expect(text).toContain("provide('onScanRequested'");
  });

  it('layout publishing lives in layout-publisher.ts (V1)', () => {
    expect(source('src/host/layout-publisher.ts')).toMatch(/export function createLayoutPublisher\(/);
  });

  it('the Escape chain, the floor wiring and the selection notice live in screens/city/ (V2)', () => {
    expect(source('src/ui/screens/city/use-city-escape.ts')).toMatch(/export function useCityEscape\(/);
    expect(source('src/ui/screens/city/use-city-floor.ts')).toMatch(/export function useCityFloor\(/);
    const notice = source('src/ui/screens/city/CitySelectionNotice.vue');
    for (const cls of ['ci-app__selection-notice', 'ci-selection-notice__reveal', 'ci-selection-notice__clear']) {
      expect(notice, cls).toContain(cls);
    }
  });

  it('city-view.ts no longer builds the coordinator or computes a layout itself', () => {
    const view = source('src/host/city-view.ts');
    expect(view).not.toContain('new ScanCoordinator(');
    expect(view).not.toContain('computeLayout(');
  });
});
