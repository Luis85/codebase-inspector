// The dev-only fixture path (task-3-brief.md step 12): a small, hand-authored
// LayoutResult for visually sanity-checking the instanced-box render pipeline while
// implementing src/visualization/city-renderer.ts. Task 4 has not built the real
// layout functions yet (scale.ts/districts.ts/layout.ts), so this cannot be derived
// from buildSnapshotFixture — it is a LayoutResult, not a CodebaseSnapshot, written by
// hand to the spec 4.3 shape.
//
// Never shipped: src/visualization/city-renderer.ts only reaches this file behind an
// `import.meta.env.DEV` branch. Vite always replaces that with the compile-time
// constant `false` in a production build, so Rollup's dead-code elimination strips the
// whole branch — including this import — from dist/main.js. It is not a rendered
// control: nothing in the UI references or toggles it.
//
// Fix wave item 2 (M3): moved here from tests/fixtures/. It used to be the codebase's
// ONE src -> tests import edge, and per I1 it demonstrably reached dist/main.js, because
// the test harness built with NODE_ENV=test and `import.meta.env.DEV` was therefore
// true. Two independent things now hold it down: eslint.config.mjs forbids src/** from
// importing tests/** at all (static AND dynamic), and scripts/assert-bundle.mjs fails
// any build whose dist/main.js still contains this file's marker. Neither depends on a
// reader remembering the claim in the paragraph above.
import type { LayoutResult } from '../domain/layout/types';
import { CATEGORY_IDS } from '../domain/classify';
import { makeEntityId } from '../domain/entity-id';

const REPO = 'dev-fixture-repo';
const DIR = makeEntityId(REPO, 'directory', 'src');

export function devFixtureLayout(): LayoutResult {
  const lots = CATEGORY_IDS.map((category, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    return {
      entityId: makeEntityId(REPO, 'file', `src/file-${category}.ts`),
      directoryId: DIR,
      center: [col * 3, 0.5, row * 3] as [number, number, number],
      dimensions: [2, 1, 2] as [number, number, number],
      colorKey: category,
      metricState: 'measured' as const,
    };
  });

  return {
    snapshotId: 'dev-fixture-snapshot',
    layoutVersion: '1',
    lots,
    districts: [{
      directoryId: DIR,
      parentId: null,
      name: 'src',
      depth: 0,
      center: [6, 0, 3],
      extent: [15, 9],
      labelAnchor: [6, 1, 3],
      aggregated: false,
    }],
    bounds: { min: [-1, 0, -1], max: [13, 1, 7] },
    scale: { metricId: 'physical-lines', name: 'Physical lines', cap: 1000, unit: 'lines', clampedCount: 0 },
  };
}
