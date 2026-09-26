# WP-02 Part 1 — Inspector UI shell and foundation: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing codebase city in the prototype's workspace shell (navigation, top bar, command palette), establish the shared UI kit, evidence value type, sample-signal provider and read models, and ship the Overview screen on top of them.

**Architecture:** The Obsidian leaf keeps mounting `src/ui/App.vue`; App becomes the shell and routes between screens held in the leaf's own Pinia `city-view` store (so the route persists through the existing view-state sync with zero changes to `city-view.ts`). Today's App content moves unchanged into `screens/CityWorkspace.vue`. Screens read only pure read-model builders that merge the real `CodebaseSnapshot` with deterministic sample signals, each value wrapped in a `MetricValue` that carries its evidence state.

**Tech Stack:** Vue 3.5 (`<script setup lang="ts">`), Pinia 4 (option stores), TypeScript 6 (`noUncheckedIndexedAccess`), zod 4, Vitest 5 + @vue/test-utils + jsdom, Obsidian `setIcon`, plain CSS with `--ci-*` tokens.

**Spec:** `docs/superpowers/specs/2026-09-21-inspector-ui-shell-design.md` (read §9 "Amendments from planning" first — it overrides earlier sections where they conflict).

## Global Constraints

- `src/**/*.{ts,vue}` files: max **400** lines (eslint `max-lines`). `tests/**/*.ts`: max **450**. `src/host/city-view.ts` is at 399 — **do not add lines to it**.
- No bare `window`, `document`, `setTimeout`, `ResizeObserver`, `matchMedia`, `getComputedStyle`, `localStorage` etc. in `src/ui/**` or `src/visualization/**` (eslint `no-restricted-globals`). Use `el.ownerDocument`, `el.win`, `nextTick`.
- `src/domain/**` imports nothing from vue/pinia/obsidian/ui.
- No Vue `<style>` blocks: all CSS is plain CSS under `:where(.codebase-inspector-root)`, BEM `ci-*` class names, colours only through `--ci-*` tokens. Never redefine `--background-*`, `--text-*`, `--interactive-*`.
- New user-facing strings go in `src/ui/inspector-copy.ts`, never in `src/ui/copy.ts` (that file is bound to the WP-01 microcopy catalogue by `tests/contracts/microcopy.test.ts`).
- Absent evidence is never rendered as `0`: it is a `MetricValue` with `state: 'unknown'` and a `reason`.
- Selection never moves the camera; search never re-lays-out the city (existing `city-store` invariants — do not change `select`, `setQuery`, `setCamera`).
- Every task ends with `npm run typecheck && npm run lint:fast && npx vitest run <touched tests>` green; the final task runs `npm run verify`.
- Commit after each task. Messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/domain/route-ids.ts` | create | closed route vocabulary `ROUTE_IDS`, `RouteId`, `DEFAULT_ROUTE` |
| `src/domain/model.ts` | modify | `CityViewState.route?: RouteId` |
| `src/domain/validator.ts` | modify | schema accepts optional route; bad route degrades to `undefined` |
| `src/ui/stores/city-store.ts` | modify | `route` state + `navigate()` |
| `src/host/view-state-sync.ts` | modify | route in `pickUiState` / `seedStoreFromState` |
| `src/ui/evidence.ts` | create | `EvidenceState`, `MetricValue`, constructors, formatting |
| `src/ui/fixtures/seeded-random.ts` | create | FNV-1a + mulberry32 |
| `src/ui/fixtures/sample-signals.ts` | create | deterministic per-file sample signals, sample trends |
| `src/ui/read-models/file-summaries.ts` | create | `FileSummary`, `priorityScore`, `fileSummariesFor` (memoized) |
| `src/ui/read-models/overview.ts` | create | `buildOverviewModel` |
| `src/ui/read-models/city-summary.ts` | create | `buildCitySummary` |
| `src/ui/read-models/use-read-models.ts` | create | composable exposing computed read models |
| `src/ui/stores/ports/review-repository.ts` | create | `WorkItem`, `ReviewRepository`, in-memory impl |
| `src/ui/stores/review-store.ts` | create | work items over the port |
| `src/ui/inspector-copy.ts` | create | WP-02 strings |
| `src/ui/routes.ts` | create | `ROUTE_META` (title, group, icon, goal, part) and nav groups |
| `src/ui/kit/*.vue` | create | Icon, ProvenanceBadge, Callout, PageHeader, Panel, MetricCard, Sparkline, LineChart, EvidenceTable, Dialog |
| `src/ui/styles/shell.css`, `kit.css`, `screens.css` | create | new CSS, imported from `src/main.ts` |
| `src/ui/App.vue` | rewrite | the shell (nav, top bar, content outlet, palette) |
| `src/ui/screens/CityWorkspace.vue` | create (git mv of old App.vue) | today's city composition, unchanged behaviour |
| `src/ui/screens/CityScreen.vue` | create | PageHeader + CityWorkspace + summary cards |
| `src/ui/screens/OverviewScreen.vue` (+ `overview/*.vue`) | create | Overview |
| `src/ui/screens/PlaceholderScreen.vue` | create | unbuilt routes |
| `src/ui/shell/NavColumn.vue`, `TopBar.vue`, `SnapshotSelector.vue`, `CommandPalette.vue`, `use-leaf-width.ts` | create | shell parts |
| `src/ui/container-box.ts` | modify | `cityInlineSize()` subtracts an inline nav column |
| `src/ui/components/CameraControls.vue` | modify | use `cityInlineSize()` |
| `src/ui/components/FileInspector.vue` | modify | "Add to refactor plan" |
| `src/main.ts` | modify | import new CSS |
| `tests/mocks/obsidian.ts` | modify | `setIcon` stub |
| `vite.harness.config.ts`, `tests/harness/page.ts`, `tests/harness/mount.ts`, `scripts/harness-shot.mjs` | modify | route-aware harness + shots |

---

### Task 1: Route vocabulary persisted in the leaf's view state

**Files:**
- Create: `src/domain/route-ids.ts`
- Modify: `src/domain/model.ts` (`CityViewState`), `src/domain/validator.ts:223-232`, `src/ui/stores/city-store.ts`, `src/host/view-state-sync.ts`
- Test: `tests/unit/route-state.test.ts` (new)

**Interfaces:**
- Produces: `ROUTE_IDS`, `type RouteId`, `DEFAULT_ROUTE` (`'city'`) from `src/domain/route-ids.ts`; `cityStore.route: RouteId`; `cityStore.navigate(route: RouteId): void`; `CityViewState.route?: RouteId`.

- [ ] **Step 1: Write the failing test** — `tests/unit/route-state.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ROUTE_IDS, DEFAULT_ROUTE, type RouteId } from '../../src/domain/route-ids';
import { validateCityViewState } from '../../src/domain/validator';
import { defaultCityViewState } from '../../src/host/view-state';
import { pickUiState, seedStoreFromState } from '../../src/host/view-state-sync';
import { useCityStore } from '../../src/ui/stores/city-store';

describe('route vocabulary', () => {
  it('lists all 15 prototype routes and defaults to the city', () => {
    expect(ROUTE_IDS).toHaveLength(15);
    expect(DEFAULT_ROUTE).toBe('city');
  });
});

describe('view-state route validation', () => {
  it('accepts a payload without a route (pre-WP-02 workspace.json)', () => {
    expect(validateCityViewState(defaultCityViewState()).route).toBeUndefined();
  });
  it('keeps a known route', () => {
    expect(validateCityViewState({ ...defaultCityViewState(), route: 'overview' }).route).toBe('overview');
  });
  it('drops an unknown route WITHOUT discarding the rest of the payload', () => {
    const decoded = validateCityViewState({ ...defaultCityViewState(), query: 'kept', route: 'nope' });
    expect(decoded.route).toBeUndefined();
    expect(decoded.query).toBe('kept');
  });
});

describe('city-store navigation', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  it('starts on the default route', () => {
    expect(useCityStore().route).toBe('city');
  });
  it('navigates to a known route and ignores an unknown one', () => {
    const store = useCityStore();
    store.navigate('overview');
    expect(store.route).toBe('overview');
    store.navigate('bogus' as RouteId);
    expect(store.route).toBe('overview');
  });
  it('navigating never touches selection, query or camera', () => {
    const store = useCityStore();
    store.select('e1');
    store.setQuery('abc');
    store.navigate('overview');
    expect(store.selectedEntityId).toBe('e1');
    expect(store.query).toBe('abc');
    expect(store.camera).toBeNull();
  });
});

describe('view-state sync carries the route', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  it('pickUiState reads the live route', () => {
    const store = useCityStore();
    store.navigate('overview');
    expect(pickUiState(store).route).toBe('overview');
  });
  it('seedStoreFromState restores a route, and the default when none was persisted', () => {
    const store = useCityStore();
    seedStoreFromState(store, { ...defaultCityViewState(), route: 'overview' });
    expect(store.route).toBe('overview');
    seedStoreFromState(store, defaultCityViewState());
    expect(store.route).toBe('city');
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module .../route-ids`)

Run: `npx vitest run tests/unit/route-state.test.ts`

- [ ] **Step 3: Implement**

`src/domain/route-ids.ts`:

```ts
// WP-02: the closed vocabulary of inspector screens (docs/concept/prototype/screen-map.json).
// Lives in the domain only because CityViewState persists it; it carries no UI meaning here.
export const ROUTE_IDS = [
  'overview', 'city', 'architecture', 'hotspots',
  'quality', 'tests', 'dependencies', 'security', 'evolution', 'ownership',
  'workbench', 'report', 'sources', 'settings', 'file',
] as const;

export type RouteId = (typeof ROUTE_IDS)[number];

/** A fresh leaf opens on the city, as WP-01 always did and as the prototype does. */
export const DEFAULT_ROUTE: RouteId = 'city';

export function isRouteId(value: unknown): value is RouteId {
  return typeof value === 'string' && (ROUTE_IDS as readonly string[]).includes(value);
}
```

`src/domain/model.ts` — add the import and the field (last field of `CityViewState`):

```ts
import type { RouteId } from './route-ids';
// ...inside CityViewState, after inspectorOpen:
  /** WP-02: the inspector screen this leaf shows. Optional so pre-WP-02 view state still validates. */
  route?: RouteId;
```

`src/domain/validator.ts` — import `ROUTE_IDS` from `./route-ids` and add to `cityViewStateSchema` (before `.strict()`):

```ts
  // WP-02: an out-of-vocabulary route degrades to "no route" instead of discarding the
  // camera, selection and query persisted alongside it.
  route: z.enum(ROUTE_IDS).optional().catch(undefined),
```

`src/ui/stores/city-store.ts`:
- `import { DEFAULT_ROUTE, isRouteId, type RouteId } from '../../domain/route-ids';`
- add `route: RouteId;` to `CityStoreState`, `route: DEFAULT_ROUTE,` to `initialState()`
- add the action:

```ts
    /** WP-02: switches the inspector screen. Unknown ids are a no-op, like setViewMode.
     *  Never touches selection, query, camera or layout — screens share all of them. */
    navigate(route: RouteId): void {
      if (!isRouteId(route)) return;
      this.route = route;
    },
```

`src/host/view-state-sync.ts`:
- `import { DEFAULT_ROUTE, type RouteId } from '../domain/route-ids';`
- add `readonly route: RouteId;` and `navigate(route: RouteId): void;` to `ViewStateSyncTarget`
- add `'route'` to the `UiSlice` Pick list and `route: store.route,` to `pickUiState`'s return
- append to `seedStoreFromState`: `store.navigate(state.route ?? DEFAULT_ROUTE);`

If `tests/unit/view-state-sync.test.ts` builds a hand-written `ViewStateSyncTarget` double, add `route: 'city'` and `navigate: vi.fn()` to it (do not weaken any assertion).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/unit/route-state.test.ts tests/unit/view-state-sync.test.ts tests/unit/view-state.test.ts tests/unit/validator.test.ts tests/unit/city-store.test.ts && npm run typecheck`

Then run `npx vitest run tests/host tests/acceptance`. `getState()` now also carries `route: 'city'` (the view-state watch mirrors `pickUiState`, which includes the route). Where a test asserts the EXACT shape of `getState()` or of persisted view state, add `route: 'city'` to the expected object — that is the new, intended shape. Do not change any other expectation.

- [ ] **Step 5: Commit**

```bash
git add src/domain/route-ids.ts src/domain/model.ts src/domain/validator.ts src/ui/stores/city-store.ts src/host/view-state-sync.ts tests/unit/route-state.test.ts tests/unit/view-state-sync.test.ts
git commit -m "feat(ui): persist the inspector route in the leaf's view state"
```

---

### Task 2: Evidence value type and deterministic sample signals

**Files:**
- Create: `src/ui/evidence.ts`, `src/ui/fixtures/seeded-random.ts`, `src/ui/fixtures/sample-signals.ts`
- Test: `tests/unit/evidence.test.ts`, `tests/unit/sample-signals.test.ts`

**Interfaces:**
- Produces:
  - `type EvidenceState = 'collected'|'sample'|'unknown'|'stale'|'partial'|'failed'|'excluded'`
  - `interface MetricValue<T = number> { state; value?: T; provenance: { source: string; detail?: string }; reason?: string }`
  - `collected(value, source, detail?)`, `sample(value, detail?)`, `unknown(reason, source?)`, `hasValue(m)`, `formatMetric(m, unit?)`, `EVIDENCE_LABELS: Record<EvidenceState, string>`
  - `fnv1a(text: string): number`, `mulberry32(seed: number): () => number`
  - `interface FileSignals { complexity; commits90d; branchesTotal; branchesCovered; findings; highFindings; unusedExports; directDependents }` (all numbers)
  - `sampleFileSignals(entityId: EntityId): FileSignals`
  - `sampleTrend(seedKey: string, endValue: number, points: number, maxStep: number): number[]`

- [ ] **Step 1: Write the failing tests**

`tests/unit/evidence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { collected, formatMetric, hasValue, sample, unknown } from '../../src/ui/evidence';

describe('MetricValue constructors', () => {
  it('collected carries value and source', () => {
    expect(collected(12, 'inventory')).toEqual({ state: 'collected', value: 12, provenance: { source: 'inventory' } });
  });
  it('sample is always provenance "sample"', () => {
    expect(sample(3).provenance.source).toBe('sample');
    expect(sample(3).state).toBe('sample');
  });
  it('unknown has no value and requires a reason', () => {
    const m = unknown('Import graph not collected yet');
    expect(m.value).toBeUndefined();
    expect(m.reason).toBe('Import graph not collected yet');
    expect(hasValue(m)).toBe(false);
  });
});

describe('formatMetric', () => {
  it('renders an unknown as an em dash, never 0', () => {
    expect(formatMetric(unknown('x'))).toBe('—');
  });
  it('groups thousands and appends a unit', () => {
    expect(formatMetric(collected(1248, 'inventory'))).toBe('1,248');
    expect(formatMetric(sample(68), '%')).toBe('68%');
  });
});
```

`tests/unit/sample-signals.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fnv1a, mulberry32 } from '../../src/ui/fixtures/seeded-random';
import { sampleFileSignals, sampleTrend } from '../../src/ui/fixtures/sample-signals';

describe('seeded random', () => {
  it('fnv1a is stable', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
  });
  it('mulberry32 yields [0,1) deterministically', () => {
    const a = mulberry32(42); const b = mulberry32(42);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    for (const x of xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
});

describe('sampleFileSignals', () => {
  it('is deterministic per entity id', () => {
    expect(sampleFileSignals('r\0file\0a.ts')).toEqual(sampleFileSignals('r\0file\0a.ts'));
  });
  it('stays inside the prototype ranges for 500 ids', () => {
    for (let i = 0; i < 500; i += 1) {
      const s = sampleFileSignals(`r\0file\0f-${i}.ts`);
      expect(s.complexity).toBeGreaterThanOrEqual(3);
      expect(s.complexity).toBeLessThanOrEqual(45);
      expect(s.commits90d).toBeGreaterThanOrEqual(1);
      expect(s.commits90d).toBeLessThanOrEqual(43);
      expect(s.branchesTotal).toBeGreaterThanOrEqual(20);
      expect(s.branchesCovered).toBeLessThanOrEqual(s.branchesTotal);
      expect(s.highFindings).toBeLessThanOrEqual(s.findings);
    }
  });
});

describe('sampleTrend', () => {
  it('ends exactly at the current value and has the requested length', () => {
    const t = sampleTrend('snap-1', 68, 7, 4);
    expect(t).toHaveLength(7);
    expect(t[6]).toBe(68);
  });
  it('is deterministic and clamped to [0, 100]', () => {
    expect(sampleTrend('k', 99, 7, 10)).toEqual(sampleTrend('k', 99, 7, 10));
    for (const v of sampleTrend('k', 99, 7, 10)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (modules missing)

Run: `npx vitest run tests/unit/evidence.test.ts tests/unit/sample-signals.test.ts`

- [ ] **Step 3: Implement**

`src/ui/evidence.ts`:

```ts
// WP-02 spec §3.2: every displayed signal carries its evidence state, so a missing value
// can never be rendered as a measured zero and sample data is always labelled.
export type EvidenceState = 'collected' | 'sample' | 'unknown' | 'stale' | 'partial' | 'failed' | 'excluded';

export interface Provenance { source: string; detail?: string }

export interface MetricValue<T = number> {
  state: EvidenceState;
  value?: T;
  provenance: Provenance;
  /** Why there is no value (required in practice for unknown/failed/excluded). */
  reason?: string;
}

export const EVIDENCE_LABELS: Readonly<Record<EvidenceState, string>> = {
  collected: 'Collected', sample: 'Sample', unknown: 'Unknown', stale: 'Stale',
  partial: 'Partial', failed: 'Failed', excluded: 'Excluded',
};

function provenance(source: string, detail?: string): Provenance {
  return detail === undefined ? { source } : { source, detail };
}

export function collected<T>(value: T, source: string, detail?: string): MetricValue<T> {
  return { state: 'collected', value, provenance: provenance(source, detail) };
}

export function sample<T>(value: T, detail?: string): MetricValue<T> {
  return { state: 'sample', value, provenance: provenance('sample', detail) };
}

export function unknown<T = number>(reason: string, source = 'none'): MetricValue<T> {
  return { state: 'unknown', provenance: { source }, reason };
}

export function hasValue<T>(m: MetricValue<T>): m is MetricValue<T> & { value: T } {
  return m.value !== undefined;
}

/** Fixed en-US grouping (the same fixed-locale rule copy.ts's time formatter follows). */
export function formatMetric(m: MetricValue, unit = ''): string {
  if (!hasValue(m)) return '—';
  return `${m.value.toLocaleString('en-US')}${unit}`;
}
```

`src/ui/fixtures/seeded-random.ts`:

```ts
// Deterministic pseudo-randomness for SAMPLE data only. Never used for anything measured.
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`src/ui/fixtures/sample-signals.ts`:

```ts
// WP-02 spec §4.4: sample signals for the metrics no provider collects yet. Ranges follow
// docs/concept/prototype/src/data.js so screens look like the prototype. Seeded from the
// entity id, so a file keeps the same sample values across rescans and snapshots.
import type { EntityId } from '../../domain/entity-id';
import { fnv1a, mulberry32 } from './seeded-random';

export interface FileSignals {
  complexity: number;        // max cognitive complexity of any function
  commits90d: number;
  branchesTotal: number;
  branchesCovered: number;
  findings: number;
  highFindings: number;
  unusedExports: number;
  directDependents: number;
}

export function sampleFileSignals(entityId: EntityId): FileSignals {
  const r = mulberry32(fnv1a(entityId));
  const complexity = 3 + Math.floor(r() ** 2 * 43);
  const commits90d = 1 + Math.floor(r() ** 1.5 * 43);
  const branchesTotal = 20 + Math.floor(r() * 160);
  const branchesCovered = Math.round(branchesTotal * (0.4 + r() * 0.59));
  const directDependents = 1 + Math.floor(r() * 18);
  const unusedExports = r() > 0.75 ? 1 + Math.floor(r() * 4) : 0;
  const highFindings = complexity >= 30 ? 1 : 0;
  const findings = Math.floor(r() * 4) + highFindings;
  return { complexity, commits90d, branchesTotal, branchesCovered, findings, highFindings, unusedExports, directDependents };
}

/** A sample history that ENDS at the real current value, walking backwards by at most
 *  `maxStep` per point, clamped to [0, 100]. */
export function sampleTrend(seedKey: string, endValue: number, points: number, maxStep: number): number[] {
  const r = mulberry32(fnv1a(seedKey));
  const values = [endValue];
  for (let i = 1; i < points; i += 1) {
    const prev = values[0] ?? endValue;
    const next = Math.min(100, Math.max(0, Math.round(prev - (r() * 2 - 0.8) * maxStep)));
    values.unshift(next);
  }
  return values;
}
```

- [ ] **Step 4: Run — expect PASS**; then `npm run typecheck && npm run lint:fast`

- [ ] **Step 5: Commit**

```bash
git add src/ui/evidence.ts src/ui/fixtures tests/unit/evidence.test.ts tests/unit/sample-signals.test.ts
git commit -m "feat(ui): evidence value type and deterministic sample signals"
```

---

### Task 3: Read models — file summaries, Overview, City summary

**Files:**
- Create: `src/ui/read-models/file-summaries.ts`, `src/ui/read-models/overview.ts`, `src/ui/read-models/city-summary.ts`, `src/ui/read-models/use-read-models.ts`
- Test: `tests/unit/read-models.test.ts`

**Interfaces:**
- Consumes: Task 2's `MetricValue`, `collected`, `sample`, `unknown`, `hasValue`, `sampleFileSignals`, `sampleTrend`; Task 1's `RouteId`.
- Produces:
  - `interface FileSummary { id: EntityId; name: string; path: string; module: string; lines: MetricValue; complexity: MetricValue; commits90d: MetricValue; branchesCovered: MetricValue; branchesTotal: MetricValue; branchCoverage: MetricValue; findings: MetricValue; highFindings: MetricValue; unusedExports: MetricValue; directDependents: MetricValue; priority: MetricValue }`
  - `moduleOf(path: string): string`, `priorityScore(complexity: number, commits90d: number, coveredRatio: number): number`, `fileSummariesFor(snapshot: CodebaseSnapshot): readonly FileSummary[]` (memoized per snapshot object)
  - `HOTSPOT_THRESHOLD = 65`, `HIGH_COMPLEXITY = 30`
  - `interface OverviewCard { id: 'findings'|'coverage'|'architecture'|'hotspots'; label: string; icon: string; value: MetricValue; unit: string; caption: string; trend: readonly number[] | null; tone: 'warning'|'success'|'danger'|'accent' }`
  - `interface TrendSeries { id: 'coverage'|'high-complexity'; label: string; points: readonly { label: string; value: number }[] }`
  - `interface Investigation { id: string; icon: string; title: string; detail: string; route: RouteId; entityId: EntityId | null }`
  - `interface EvidenceCoverageRow { id: string; label: string; state: EvidenceState; source: string }`
  - `interface OverviewModel { fileCount: number; cards: readonly OverviewCard[]; series: readonly TrendSeries[]; investigations: readonly Investigation[]; hotspots: readonly FileSummary[]; coverage: readonly EvidenceCoverageRow[]; usesSample: boolean }`
  - `buildOverviewModel(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): OverviewModel`
  - `interface CitySummaryCard { id: 'hotspots'|'cycles'|'unused'; title: string; caption: string; value: MetricValue; route: RouteId }`
  - `buildCitySummary(files: readonly FileSummary[]): readonly CitySummaryCard[]`
  - `useReadModels(): { files: ComputedRef<readonly FileSummary[]>; overview: ComputedRef<OverviewModel | null>; citySummary: ComputedRef<readonly CitySummaryCard[]> }`

- [ ] **Step 1: Write the failing test** — `tests/unit/read-models.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor, moduleOf, priorityScore } from '../../src/ui/read-models/file-summaries';
import { buildOverviewModel, HOTSPOT_THRESHOLD } from '../../src/ui/read-models/overview';
import { buildCitySummary } from '../../src/ui/read-models/city-summary';

describe('file summaries', () => {
  it('derives the module from the first path segment', () => {
    expect(moduleOf('src/domain/a.ts')).toBe('src');
    expect(moduleOf('a.ts')).toBe('(root)');
  });

  it('uses the handoff priority heuristic, capped at 100', () => {
    expect(priorityScore(48, 44, 0)).toBe(100);
    expect(priorityScore(0, 0, 1)).toBe(0);
    expect(priorityScore(24, 22, 0.5)).toBe(50);
  });

  it('marks real line counts collected and everything else sample', () => {
    const snap = buildSnapshotFixture({ files: 3 });
    const [first] = fileSummariesFor(snap);
    expect(first?.lines.state).toBe('collected');
    expect(first?.lines.provenance.source).toBe('inventory');
    expect(first?.complexity.state).toBe('sample');
    expect(first?.priority.state).toBe('sample');
  });

  it('keeps an unavailable line count unknown with its reason — never 0', () => {
    const snap = buildSnapshotFixture({ files: 2, unavailable: 1 });
    const unknownLines = fileSummariesFor(snap).find((f) => f.lines.state === 'unknown');
    expect(unknownLines?.lines.value).toBeUndefined();
    expect(unknownLines?.lines.reason).toBeTruthy();
  });

  it('returns only files and memoizes per snapshot object', () => {
    const snap = buildSnapshotFixture({ files: 4, directories: 2 });
    expect(fileSummariesFor(snap)).toHaveLength(4);
    expect(fileSummariesFor(snap)).toBe(fileSummariesFor(snap));
  });
});

describe('overview model', () => {
  const snap = buildSnapshotFixture({ files: 40, directories: 3 });
  const files = fileSummariesFor(snap);
  const model = buildOverviewModel(snap, files);

  it('has the four prototype cards and no composite score', () => {
    expect(model.cards.map((c) => c.id)).toEqual(['findings', 'coverage', 'architecture', 'hotspots']);
  });

  it('reports architecture as unknown, not zero', () => {
    const arch = model.cards.find((c) => c.id === 'architecture');
    expect(arch?.value.state).toBe('unknown');
    expect(arch?.value.value).toBeUndefined();
  });

  it('counts hotspots at or above the threshold', () => {
    const expected = files.filter((f) => (f.priority.value ?? 0) >= HOTSPOT_THRESHOLD).length;
    expect(model.cards.find((c) => c.id === 'hotspots')?.value.value).toBe(expected);
  });

  it('lists at most five hotspots, highest priority first', () => {
    expect(model.hotspots.length).toBeLessThanOrEqual(5);
    const ps = model.hotspots.map((h) => h.priority.value ?? 0);
    expect([...ps].sort((a, b) => b - a)).toEqual(ps);
  });

  it('ends the coverage series at the coverage card value', () => {
    const coverage = model.series.find((s) => s.id === 'coverage');
    expect(coverage?.points).toHaveLength(7);
    expect(coverage?.points.at(-1)?.value).toBe(model.cards.find((c) => c.id === 'coverage')?.value.value);
  });

  it('declares inventory collected and import graph unknown in evidence coverage', () => {
    expect(model.coverage.find((r) => r.id === 'inventory')?.state).toBe('collected');
    expect(model.coverage.find((r) => r.id === 'imports')?.state).toBe('unknown');
    expect(model.usesSample).toBe(true);
  });

  it('marks inventory partial for a partial snapshot', () => {
    const partial = buildSnapshotFixture({ files: 3, completeness: 'partial' });
    const m = buildOverviewModel(partial, fileSummariesFor(partial));
    expect(m.coverage.find((r) => r.id === 'inventory')?.state).toBe('partial');
  });

  it('produces three investigations with targets', () => {
    expect(model.investigations).toHaveLength(3);
    expect(model.investigations[0]?.entityId).toBeTruthy();
  });

  it('handles an empty snapshot without throwing', () => {
    const empty = buildSnapshotFixture({ files: 0 });
    const m = buildOverviewModel(empty, fileSummariesFor(empty));
    expect(m.fileCount).toBe(0);
    expect(m.investigations).toHaveLength(0);
    expect(m.cards.find((c) => c.id === 'coverage')?.value.state).toBe('unknown');
  });
});

describe('city summary', () => {
  it('has hotspots, cycles (unknown) and unused exports', () => {
    const snap = buildSnapshotFixture({ files: 20 });
    const cards = buildCitySummary(fileSummariesFor(snap));
    expect(cards.map((c) => c.id)).toEqual(['hotspots', 'cycles', 'unused']);
    expect(cards[1]?.value.state).toBe('unknown');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/read-models.test.ts`

- [ ] **Step 3: Implement**

`src/ui/read-models/file-summaries.ts`:

```ts
// WP-02 spec §4.4: the one per-file read model every screen shares. Real inventory values
// are `collected`; everything a provider does not yet collect comes from the sample
// provider and says so.
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot, Observation } from '../../domain/model';
import { collected, sample, unknown, type MetricValue } from '../evidence';
import { sampleFileSignals } from '../fixtures/sample-signals';

export interface FileSummary {
  id: EntityId;
  name: string;
  path: string;
  module: string;
  lines: MetricValue;
  complexity: MetricValue;
  commits90d: MetricValue;
  branchesCovered: MetricValue;
  branchesTotal: MetricValue;
  branchCoverage: MetricValue;   // percent
  findings: MetricValue;
  highFindings: MetricValue;
  unusedExports: MetricValue;
  directDependents: MetricValue;
  priority: MetricValue;
}

export function moduleOf(path: string): string {
  const slash = path.indexOf('/');
  return slash > 0 ? path.slice(0, slash) : '(root)';
}

/** The prototype's transparent SAMPLE heuristic (IMPLEMENTATION-HANDOFF.md). Not a defect
 *  probability, maintainability index or benchmark. */
export function priorityScore(complexity: number, commits90d: number, coveredRatio: number): number {
  return Math.min(100, Math.round(100 * (0.42 * complexity / 48 + 0.35 * commits90d / 44 + 0.23 * (1 - coveredRatio))));
}

function linesValue(obs: Observation | undefined): MetricValue {
  if (!obs) return unknown('Not measured in this scan.', 'inventory');
  if (obs.status === 'measured' && obs.value !== null) return collected(obs.value, 'inventory');
  return unknown(obs.reason ?? 'Not measured in this scan.', 'inventory');
}

function build(snapshot: CodebaseSnapshot): readonly FileSummary[] {
  const lineObs = new Map<EntityId, Observation>();
  for (const o of snapshot.observations) {
    if (o.measurement.metricId === 'physical-lines') lineObs.set(o.entityId, o);
  }
  return snapshot.entities.filter((e) => e.kind === 'file').map((e) => {
    const s = sampleFileSignals(e.id);
    const ratio = s.branchesCovered / s.branchesTotal;
    return {
      id: e.id, name: e.name, path: e.path, module: moduleOf(e.path),
      lines: linesValue(lineObs.get(e.id)),
      complexity: sample(s.complexity),
      commits90d: sample(s.commits90d),
      branchesCovered: sample(s.branchesCovered),
      branchesTotal: sample(s.branchesTotal),
      branchCoverage: sample(Math.round(ratio * 100)),
      findings: sample(s.findings),
      highFindings: sample(s.highFindings),
      unusedExports: sample(s.unusedExports),
      directDependents: sample(s.directDependents),
      priority: sample(priorityScore(s.complexity, s.commits90d, ratio), 'sample heuristic'),
    };
  });
}

const cache = new WeakMap<CodebaseSnapshot, readonly FileSummary[]>();

/** Memoized per snapshot OBJECT: snapshots are immutable (city-store never mutates one). */
export function fileSummariesFor(snapshot: CodebaseSnapshot): readonly FileSummary[] {
  let hit = cache.get(snapshot);
  if (!hit) { hit = build(snapshot); cache.set(snapshot, hit); }
  return hit;
}
```

`src/ui/read-models/overview.ts`:

```ts
// WP-02 spec §4.3: the Overview screen's read model. No composite health score.
import type { CodebaseSnapshot } from '../../domain/model';
import type { EntityId } from '../../domain/entity-id';
import type { RouteId } from '../../domain/route-ids';
import { sample, unknown, type EvidenceState, type MetricValue } from '../evidence';
import { sampleTrend } from '../fixtures/sample-signals';
import type { FileSummary } from './file-summaries';

export const HOTSPOT_THRESHOLD = 65;
export const HIGH_COMPLEXITY = 30;
const TREND_POINTS = 7;
const TREND_SPACING_DAYS = 14;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export interface OverviewCard {
  id: 'findings' | 'coverage' | 'architecture' | 'hotspots';
  label: string; icon: string; value: MetricValue; unit: string; caption: string;
  trend: readonly number[] | null;
  tone: 'warning' | 'success' | 'danger' | 'accent';
}
export interface TrendSeries { id: 'coverage' | 'high-complexity'; label: string; points: readonly { label: string; value: number }[] }
export interface Investigation { id: string; icon: string; title: string; detail: string; route: RouteId; entityId: EntityId | null }
export interface EvidenceCoverageRow { id: string; label: string; state: EvidenceState; source: string }
export interface OverviewModel {
  fileCount: number;
  cards: readonly OverviewCard[];
  series: readonly TrendSeries[];
  investigations: readonly Investigation[];
  hotspots: readonly FileSummary[];
  coverage: readonly EvidenceCoverageRow[];
  usesSample: boolean;
}

const num = (m: MetricValue): number => m.value ?? 0;
const byPriority = (a: FileSummary, b: FileSummary): number =>
  num(b.priority) - num(a.priority) || a.path.localeCompare(b.path);

function trendLabels(capturedAt: string): string[] {
  const end = new Date(capturedAt).getTime();
  return Array.from({ length: TREND_POINTS }, (_, i) => {
    const d = new Date(end - (TREND_POINTS - 1 - i) * TREND_SPACING_DAYS * 86_400_000);
    return `${MONTHS[d.getUTCMonth()] ?? ''} ${String(d.getUTCDate()).padStart(2, '0')}`;
  });
}

function investigations(files: readonly FileSummary[]): Investigation[] {
  if (files.length === 0) return [];
  const top = [...files].sort(byPriority)[0]!;
  const modules = new Map<string, { covered: number; total: number; count: number }>();
  for (const f of files) {
    const m = modules.get(f.module) ?? { covered: 0, total: 0, count: 0 };
    m.covered += num(f.branchesCovered); m.total += num(f.branchesTotal); m.count += 1;
    modules.set(f.module, m);
  }
  const [weakName, weak] = [...modules.entries()]
    .sort(([an, a], [bn, b]) => a.covered / a.total - b.covered / b.total || an.localeCompare(bn))[0]!;
  const largest = [...files].filter((f) => f.lines.value !== undefined)
    .sort((a, b) => num(b.lines) - num(a.lines) || a.path.localeCompare(b.path))[0] ?? top;
  return [
    { id: 'top-hotspot', icon: 'flame', route: 'hotspots', entityId: top.id,
      title: `Review ${top.name}`,
      detail: `Complexity ${num(top.complexity)} · ${num(top.commits90d)} commits in 90 days · ${num(top.branchCoverage)}% branch coverage.` },
    { id: 'weak-module', icon: 'flask-conical', route: 'tests', entityId: null,
      title: `Protect the ${weakName} module`,
      detail: `${Math.round((weak.covered / weak.total) * 100)}% branch coverage across ${weak.count} files.` },
    { id: 'largest-file', icon: 'building-2', route: 'city', entityId: largest.id,
      title: `Inspect ${largest.name}`,
      detail: largest.lines.value !== undefined
        ? `${num(largest.lines).toLocaleString('en-US')} lines — the largest file in this scan.`
        : 'Line count unavailable for this file.' },
  ];
}

export function buildOverviewModel(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): OverviewModel {
  const covered = files.reduce((n, f) => n + num(f.branchesCovered), 0);
  const total = files.reduce((n, f) => n + num(f.branchesTotal), 0);
  const findings = files.reduce((n, f) => n + num(f.findings), 0);
  const high = files.reduce((n, f) => n + num(f.highFindings), 0);
  const hotspotCount = files.filter((f) => num(f.priority) >= HOTSPOT_THRESHOLD).length;
  const highComplexity = files.filter((f) => num(f.complexity) >= HIGH_COMPLEXITY).length;
  const coveragePct = total > 0 ? Math.round((covered / total) * 100) : null;

  const labels = trendLabels(snapshot.providerRun.capturedAt);
  const coverageTrend = coveragePct === null ? null : sampleTrend(`${snapshot.snapshotId}:coverage`, coveragePct, TREND_POINTS, 4);
  const complexityTrend = sampleTrend(`${snapshot.snapshotId}:complexity`, Math.min(100, highComplexity), TREND_POINTS, 3);
  const toPoints = (values: readonly number[]) => values.map((value, i) => ({ label: labels[i] ?? '', value }));

  const cards: OverviewCard[] = [
    { id: 'findings', label: 'Open quality findings', icon: 'code', unit: '', tone: 'warning', trend: null,
      value: files.length ? sample(findings) : unknown('No files in this scan.'),
      caption: `${high} high-priority findings · sample rules` },
    { id: 'coverage', label: 'Branch coverage', icon: 'flask-conical', unit: '%', tone: 'success', trend: coverageTrend,
      value: coveragePct === null ? unknown('No files in this scan.') : sample(coveragePct),
      caption: `${covered.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} instrumented branches` },
    { id: 'architecture', label: 'Architecture exceptions', icon: 'network', unit: '', tone: 'danger', trend: null,
      value: unknown('Import graph not collected yet.'),
      caption: 'Forbidden imports · cycles' },
    { id: 'hotspots', label: 'Change hotspots', icon: 'flame', unit: '', tone: 'accent', trend: null,
      value: files.length ? sample(hotspotCount) : unknown('No files in this scan.'),
      caption: `Priority ≥ ${HOTSPOT_THRESHOLD} · last 90 days` },
  ];

  const series: TrendSeries[] = [
    ...(coverageTrend ? [{ id: 'coverage' as const, label: 'Branch coverage (%)', points: toPoints(coverageTrend) }] : []),
    { id: 'high-complexity', label: 'High-complexity files (count)', points: toPoints(complexityTrend) },
  ];

  const coverage: EvidenceCoverageRow[] = [
    { id: 'inventory', label: 'File inventory', state: snapshot.completeness === 'partial' ? 'partial' : 'collected', source: 'Built-in scan' },
    { id: 'static', label: 'Static signals', state: 'sample', source: 'Sample provider' },
    { id: 'history', label: 'Git history', state: 'sample', source: 'Sample provider' },
    { id: 'coverage', label: 'Test coverage', state: 'sample', source: 'Sample provider' },
    { id: 'imports', label: 'Import graph', state: 'unknown', source: 'Not collected' },
    { id: 'mutation', label: 'Mutation testing', state: 'unknown', source: 'Not collected' },
    { id: 'runtime', label: 'Runtime evidence', state: 'unknown', source: 'Not collected' },
  ];

  return {
    fileCount: files.length,
    cards,
    series,
    investigations: investigations(files),
    hotspots: [...files].sort(byPriority).slice(0, 5),
    coverage,
    usesSample: cards.some((c) => c.value.state === 'sample'),
  };
}
```

`src/ui/read-models/city-summary.ts`:

```ts
import type { RouteId } from '../../domain/route-ids';
import { sample, unknown, type MetricValue } from '../evidence';
import type { FileSummary } from './file-summaries';
import { HOTSPOT_THRESHOLD } from './overview';

export interface CitySummaryCard { id: 'hotspots' | 'cycles' | 'unused'; title: string; caption: string; value: MetricValue; route: RouteId }

export function buildCitySummary(files: readonly FileSummary[]): readonly CitySummaryCard[] {
  const hotspots = files.filter((f) => (f.priority.value ?? 0) >= HOTSPOT_THRESHOLD).length;
  const unused = files.reduce((n, f) => n + (f.unusedExports.value ?? 0), 0);
  const empty = files.length === 0;
  return [
    { id: 'hotspots', title: 'Change hotspots', caption: 'Complexity × change × coverage gap', route: 'hotspots',
      value: empty ? unknown('No files in this scan.') : sample(hotspots) },
    { id: 'cycles', title: 'Architectural cycles', caption: 'Inspect module boundaries', route: 'architecture',
      value: unknown('Import graph not collected yet.') },
    { id: 'unused', title: 'Potentially unused exports', caption: 'Verify entry points before deletion', route: 'quality',
      value: empty ? unknown('No files in this scan.') : sample(unused) },
  ];
}
```

`src/ui/read-models/use-read-models.ts`:

```ts
import { computed } from 'vue';
import { useCityStore } from '../stores/city-store';
import { fileSummariesFor } from './file-summaries';
import { buildOverviewModel } from './overview';
import { buildCitySummary } from './city-summary';

/** Screens read models through here only (spec §3.2 rule 1). */
export function useReadModels() {
  const store = useCityStore();
  const files = computed(() => (store.snapshot ? fileSummariesFor(store.snapshot) : []));
  const overview = computed(() => (store.snapshot ? buildOverviewModel(store.snapshot, files.value) : null));
  const citySummary = computed(() => buildCitySummary(files.value));
  return { files, overview, citySummary };
}
```

- [ ] **Step 4: Run — expect PASS.** If `priorityScore(24, 22, 0.5)` is off by one due to rounding, recompute by hand (0.42·0.5 + 0.35·0.5 + 0.23·0.5 = 0.5 → 50) — the formula, not the test, is wrong. Then `npm run typecheck && npm run lint:fast`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-models tests/unit/read-models.test.ts
git commit -m "feat(ui): file, overview and city-summary read models over real inventory + sample signals"
```

---

### Task 4: Review store behind a persistence port

**Files:**
- Create: `src/ui/stores/ports/review-repository.ts`, `src/ui/stores/review-store.ts`
- Test: `tests/unit/review-store.test.ts`

**Interfaces:**
- Produces:
  - `type WorkItemStatus = 'investigate' | 'planned' | 'in-progress' | 'verified'`
  - `interface WorkItem { id: string; entityId: EntityId; title: string; status: WorkItemStatus; createdAt: string }`
  - `interface ReviewRepository { listWorkItems(): Promise<WorkItem[]>; saveWorkItem(item: WorkItem): Promise<void>; removeWorkItem(id: string): Promise<void> }`
  - `createInMemoryReviewRepository(): ReviewRepository`
  - `useReviewStore()` with state `workItems: WorkItem[]`, getters `workItemCount: number`, `hasWorkItemFor: (id: EntityId) => boolean`, actions `setRepository(repo)`, `load(): Promise<void>`, `addWorkItemForFile(entityId, title, now: Date): Promise<WorkItem | null>`, `removeWorkItem(id): Promise<void>`

Dispositions and rules join this port in Parts 3/4 (YAGNI now).

- [ ] **Step 1: Write the failing test** — `tests/unit/review-store.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-21T10:00:00.000Z');

describe('review store', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('adds one work item per file and persists it through the port', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const item = await store.addWorkItemForFile('e1', 'Investigate a.ts', NOW);
    expect(item?.status).toBe('investigate');
    expect(item?.createdAt).toBe(NOW.toISOString());
    expect(store.workItemCount).toBe(1);
    expect(store.hasWorkItemFor('e1')).toBe(true);
    expect(await repo.listWorkItems()).toHaveLength(1);
  });

  it('refuses a duplicate for the same file', async () => {
    const store = useReviewStore();
    await store.addWorkItemForFile('e1', 'x', NOW);
    expect(await store.addWorkItemForFile('e1', 'y', NOW)).toBeNull();
    expect(store.workItemCount).toBe(1);
  });

  it('loads what the repository already holds, and removes through it', async () => {
    const repo = createInMemoryReviewRepository();
    await repo.saveWorkItem({ id: 'w1', entityId: 'e9', title: 't', status: 'planned', createdAt: NOW.toISOString() });
    const store = useReviewStore();
    store.setRepository(repo);
    await store.load();
    expect(store.hasWorkItemFor('e9')).toBe(true);
    await store.removeWorkItem('w1');
    expect(store.workItemCount).toBe(0);
    expect(await repo.listWorkItems()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/ui/stores/ports/review-repository.ts`:

```ts
// WP-02 spec §4.5: review decisions live behind a port. Parts 1-4 ship in-memory only;
// the backend phase adds plugin-data / Markdown implementations without touching the UI.
import type { EntityId } from '../../../domain/entity-id';

export type WorkItemStatus = 'investigate' | 'planned' | 'in-progress' | 'verified';

export interface WorkItem {
  id: string;
  entityId: EntityId;
  title: string;
  status: WorkItemStatus;
  createdAt: string;
}

export interface ReviewRepository {
  listWorkItems(): Promise<WorkItem[]>;
  saveWorkItem(item: WorkItem): Promise<void>;
  removeWorkItem(id: string): Promise<void>;
}

export function createInMemoryReviewRepository(): ReviewRepository {
  const items = new Map<string, WorkItem>();
  return {
    listWorkItems: () => Promise.resolve([...items.values()]),
    saveWorkItem: (item) => { items.set(item.id, { ...item }); return Promise.resolve(); },
    removeWorkItem: (id) => { items.delete(id); return Promise.resolve(); },
  };
}
```

`src/ui/stores/review-store.ts`:

```ts
import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { createInMemoryReviewRepository, type ReviewRepository, type WorkItem } from './ports/review-repository';

interface ReviewState {
  workItems: WorkItem[];
  nextId: number;
  repository: ReviewRepository;
}

export const useReviewStore = defineStore('review', {
  state: (): ReviewState => ({
    workItems: [],
    nextId: 1,
    repository: markRaw(createInMemoryReviewRepository()),
  }),
  getters: {
    workItemCount: (state): number => state.workItems.length,
    hasWorkItemFor: (state) => (entityId: EntityId): boolean =>
      state.workItems.some((w) => w.entityId === entityId),
  },
  actions: {
    setRepository(repository: ReviewRepository): void {
      this.repository = markRaw(repository);
    },
    async load(): Promise<void> {
      this.workItems = await this.repository.listWorkItems();
      this.nextId = this.workItems.length + 1;
    },
    /** One work item per file; a second request for the same file is refused (null). */
    async addWorkItemForFile(entityId: EntityId, title: string, now: Date): Promise<WorkItem | null> {
      if (this.hasWorkItemFor(entityId)) return null;
      const item: WorkItem = { id: `wi-${this.nextId}`, entityId, title, status: 'investigate', createdAt: now.toISOString() };
      this.nextId += 1;
      this.workItems.push(item);
      await this.repository.saveWorkItem(item);
      return item;
    },
    async removeWorkItem(id: string): Promise<void> {
      this.workItems = this.workItems.filter((w) => w.id !== id);
      await this.repository.removeWorkItem(id);
    },
  },
});
```

- [ ] **Step 4: Run — expect PASS**; `npm run typecheck && npm run lint:fast`

- [ ] **Step 5: Commit**

```bash
git add src/ui/stores/ports src/ui/stores/review-store.ts tests/unit/review-store.test.ts
git commit -m "feat(ui): review store with an in-memory ReviewRepository port"
```

---

### Task 5: Tokens, copy, route metadata and the display kit (Icon, ProvenanceBadge, Callout, PageHeader, Panel, MetricCard, Sparkline)

**Files:**
- Create: `src/ui/inspector-copy.ts`, `src/ui/routes.ts`, `src/ui/styles/kit.css`, `src/ui/kit/Icon.vue`, `src/ui/kit/ProvenanceBadge.vue`, `src/ui/kit/Callout.vue`, `src/ui/kit/PageHeader.vue`, `src/ui/kit/Panel.vue`, `src/ui/kit/MetricCard.vue`, `src/ui/kit/Sparkline.vue`
- Modify: `tests/mocks/obsidian.ts` (add `setIcon`), `src/main.ts` (import CSS), `vite.harness.config.ts` (serve all stylesheets)
- Test: `tests/component/kit-display.test.ts`

**Interfaces:**
- Consumes: Task 2 `MetricValue`, `EvidenceState`, `EVIDENCE_LABELS`, `formatMetric`, `hasValue`; Task 1 `RouteId`.
- Produces:
  - `ROUTE_META: Readonly<Record<RouteId, RouteMeta>>`, `interface RouteMeta { id; title; group: 'Explore'|'Audit'|'Act'|'Configure'|'Cross-cutting'; icon: string; goal: string; part: 1|2|3|4 }`, `NAV_SECTIONS: readonly { group: string; routes: readonly RouteId[] }[]`, `NAV_FOOTER: readonly RouteId[]`
  - Components and props:
    - `Icon` `{ name: string }`
    - `ProvenanceBadge` `{ state: EvidenceState; detail?: string }`
    - `Callout` `{ tone?: 'info'|'warning'; title: string; badge?: string }` + default slot
    - `PageHeader` `{ eyebrow: string; title: string; subtitle?: string }` + `actions` slot
    - `Panel` `{ title?: string; subtitle?: string; footnote?: string }` + default and `actions` slots
    - `MetricCard` `{ label: string; icon: string; value: MetricValue; unit?: string; caption?: string; trend?: readonly number[] | null; tone?: 'warning'|'success'|'danger'|'accent' }`
    - `Sparkline` `{ values: readonly number[]; label: string }`

- [ ] **Step 1: Add the `setIcon` stub to the Obsidian mock** (append near the other exports in `tests/mocks/obsidian.ts`):

```ts
/** WP-02: the real setIcon injects a Lucide SVG. Tests and the harness only need to see
 *  which icon was asked for. */
export function setIcon(el: HTMLElement, iconId: string): void {
  el.dataset.icon = iconId;
}
```

- [ ] **Step 2: Write the failing test** — `tests/component/kit-display.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Icon from '../../src/ui/kit/Icon.vue';
import ProvenanceBadge from '../../src/ui/kit/ProvenanceBadge.vue';
import MetricCard from '../../src/ui/kit/MetricCard.vue';
import PageHeader from '../../src/ui/kit/PageHeader.vue';
import Sparkline from '../../src/ui/kit/Sparkline.vue';
import { collected, sample, unknown } from '../../src/ui/evidence';
import { ROUTE_IDS } from '../../src/domain/route-ids';
import { NAV_FOOTER, NAV_SECTIONS, ROUTE_META } from '../../src/ui/routes';

describe('route metadata', () => {
  it('describes every route', () => {
    for (const id of ROUTE_IDS) expect(ROUTE_META[id].title.length).toBeGreaterThan(0);
  });
  it('navigation lists every route except the cross-cutting file detail', () => {
    const listed = [...NAV_SECTIONS.flatMap((s) => s.routes), ...NAV_FOOTER];
    expect(new Set(listed)).toEqual(new Set(ROUTE_IDS.filter((id) => id !== 'file')));
  });
});

describe('Icon', () => {
  it('asks Obsidian for the named icon and is hidden from assistive tech', () => {
    const w = mount(Icon, { props: { name: 'flame' } });
    expect(w.element.getAttribute('data-icon')).toBe('flame');
    expect(w.element.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('ProvenanceBadge', () => {
  it('labels a sample', () => {
    expect(mount(ProvenanceBadge, { props: { state: 'sample' } }).text()).toBe('Sample');
  });
});

describe('MetricCard', () => {
  it('shows a collected value without a provenance badge', () => {
    const w = mount(MetricCard, { props: { label: 'Lines', icon: 'file', value: collected(1248, 'inventory') } });
    expect(w.text()).toContain('1,248');
    expect(w.find('.ci-provenance').exists()).toBe(false);
  });
  it('labels a sample value', () => {
    const w = mount(MetricCard, { props: { label: 'Coverage', icon: 'x', value: sample(68), unit: '%' } });
    expect(w.text()).toContain('68%');
    expect(w.find('.ci-provenance').text()).toBe('Sample');
  });
  it('renders unknown as a dash with its reason — never 0', () => {
    const w = mount(MetricCard, { props: { label: 'Arch', icon: 'x', value: unknown('Import graph not collected yet.') } });
    expect(w.find('.ci-metric-card__value').text()).toBe('—');
    expect(w.text()).toContain('Import graph not collected yet.');
    expect(w.find('.ci-metric-card__value').text()).not.toContain('0');
  });
  it('renders a sparkline only when a trend is given', () => {
    expect(mount(MetricCard, { props: { label: 'a', icon: 'x', value: sample(1) } }).find('svg').exists()).toBe(false);
    expect(mount(MetricCard, { props: { label: 'a', icon: 'x', value: sample(1), trend: [1, 2, 3] } }).find('svg').exists()).toBe(true);
  });
});

describe('PageHeader', () => {
  it('renders eyebrow, a level-2 title and the actions slot', () => {
    const w = mount(PageHeader, { props: { eyebrow: 'Explore / Code city', title: 'Code city' }, slots: { actions: '<button>Go</button>' } });
    expect(w.find('h2').text()).toBe('Code city');
    expect(w.text()).toContain('Explore / Code city');
    expect(w.find('button').text()).toBe('Go');
  });
});

describe('Sparkline', () => {
  it('draws one point per value and carries an accessible label', () => {
    const w = mount(Sparkline, { props: { values: [1, 5, 3], label: 'Coverage trend' } });
    expect(w.find('polyline').attributes('points')?.split(' ')).toHaveLength(3);
    expect(w.find('svg').attributes('aria-label')).toBe('Coverage trend');
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npx vitest run tests/component/kit-display.test.ts`

- [ ] **Step 4: Implement**

`src/ui/inspector-copy.ts`:

```ts
// WP-02 user-facing strings. Sourced from docs/concept/prototype (screen-map.json and the
// screen specification), NOT from the WP-01 microcopy catalogue — which is why they live
// here and not in copy.ts (bound to that catalogue by tests/contracts/microcopy.test.ts).
export const SAMPLE_DATA_NOTICE = 'Includes sample data';
export const SAMPLE_DATA_DETAIL = 'Values marked Sample are illustrative, not measured from this codebase.';
export const PLACEHOLDER_ARRIVES = (part: number): string => `This screen arrives in Part ${part} of the inspector UI.`;
export const OVERVIEW_EYEBROW = 'Workspace / Overview';
export const OVERVIEW_TITLE = 'A clearer picture of your codebase.';
export const OVERVIEW_SUBTITLE = 'Understand the signals. Follow the evidence. Improve what matters.';
export const OVERVIEW_VERDICT_TITLE = 'A review is recommended, not a verdict.';
export const OVERVIEW_NO_SNAPSHOT = 'No snapshot yet. Select a codebase and run a scan to see its overview.';
export const CITY_EYEBROW = 'Explore / Code city';
export const CITY_TITLE = 'Code city';
export const CITY_SUBTITLE = 'Find the places worth investigating. Every building is a file.';
export const NO_CODEBASE_LABEL = 'No codebase selected';
export const SEARCH_TRIGGER_LABEL = 'Search anything…';
export const COMMAND_PALETTE_LABEL = 'Command palette';
export const COMMAND_PALETTE_PLACEHOLDER = 'Go to a screen or file…';
export const COMMAND_PALETTE_EMPTY = 'No matching screens or files.';
export const ADD_TO_PLAN_LABEL = 'Add to refactor plan';
export const IN_PLAN_LABEL = 'In refactor plan';
export const OPEN_NAVIGATION_LABEL = 'Open navigation';
export const CLOSE_NAVIGATION_LABEL = 'Close navigation';
export const SNAPSHOT_LABEL = 'Snapshot';
```

`src/ui/routes.ts` (goals verbatim from `docs/concept/prototype/screen-map.json`):

```ts
import type { RouteId } from '../domain/route-ids';

export interface RouteMeta {
  id: RouteId;
  title: string;
  group: 'Explore' | 'Audit' | 'Act' | 'Configure' | 'Cross-cutting';
  icon: string;          // Lucide id for Obsidian's setIcon
  goal: string;          // screen-map.json "goal"
  part: 1 | 2 | 3 | 4;   // which WP-02 part delivers it
}

export const ROUTE_META: Readonly<Record<RouteId, RouteMeta>> = {
  overview: { id: 'overview', title: 'Overview', group: 'Explore', icon: 'layout-grid', part: 1, goal: 'Understand independent health signals and decide where to inspect next.' },
  city: { id: 'city', title: 'Code city', group: 'Explore', icon: 'building-2', part: 1, goal: 'Build a spatial mental model and select the next file to investigate.' },
  architecture: { id: 'architecture', title: 'Architecture', group: 'Explore', icon: 'network', part: 2, goal: 'Compare observed dependencies with explicitly intended boundaries.' },
  hotspots: { id: 'hotspots', title: 'Hotspots', group: 'Explore', icon: 'flame', part: 2, goal: 'Prioritize investigation using transparent raw measurements.' },
  quality: { id: 'quality', title: 'Code quality', group: 'Audit', icon: 'code', part: 3, goal: 'Triage static findings with evidence, location, and a recorded disposition.' },
  tests: { id: 'tests', title: 'Test confidence', group: 'Audit', icon: 'flask-conical', part: 3, goal: 'Assess where tested execution is missing and keep assertion strength distinct from coverage.' },
  dependencies: { id: 'dependencies', title: 'Dependencies', group: 'Audit', icon: 'package', part: 3, goal: 'Inspect external package inventory separately from internal module architecture.' },
  security: { id: 'security', title: 'Security', group: 'Audit', icon: 'shield', part: 3, goal: 'Review possible issues without presenting an unverified exploitability verdict.' },
  evolution: { id: 'evolution', title: 'Evolution', group: 'Audit', icon: 'trending-up', part: 3, goal: 'Understand trends and change relationships rather than judging one snapshot.' },
  ownership: { id: 'ownership', title: 'Ownership', group: 'Audit', icon: 'users', part: 3, goal: 'Plan continuity and knowledge sharing at module/team level.' },
  workbench: { id: 'workbench', title: 'Refactor workbench', group: 'Act', icon: 'wrench', part: 4, goal: 'Convert evidence into scoped, verifiable improvement work.' },
  report: { id: 'report', title: 'Audit report', group: 'Act', icon: 'file-text', part: 4, goal: 'Communicate scope, evidence, limitations and proposed work clearly.' },
  sources: { id: 'sources', title: 'Data & scans', group: 'Configure', icon: 'database', part: 4, goal: 'Make source scope and provider provenance explicit before interpretation.' },
  settings: { id: 'settings', title: 'Settings', group: 'Configure', icon: 'settings', part: 4, goal: 'Adjust real preview preferences while keeping production policies explicit.' },
  file: { id: 'file', title: 'File detail', group: 'Cross-cutting', icon: 'file-code', part: 2, goal: 'Follow a selected file from metrics to source context, evidence and planned changes.' },
};

export const NAV_SECTIONS: readonly { group: string; routes: readonly RouteId[] }[] = [
  { group: 'Explore', routes: ['overview', 'city', 'architecture', 'hotspots'] },
  { group: 'Audit', routes: ['quality', 'tests', 'dependencies', 'security', 'evolution', 'ownership'] },
  { group: 'Act', routes: ['workbench', 'report'] },
];

export const NAV_FOOTER: readonly RouteId[] = ['sources', 'settings'];
```

`src/ui/kit/Icon.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { setIcon } from 'obsidian';

const props = defineProps<{ name: string }>();
const el = ref<HTMLElement | null>(null);

function paint(): void {
  if (el.value) setIcon(el.value, props.name);
}
onMounted(paint);
watch(() => props.name, paint);
</script>

<template>
  <span
    ref="el"
    class="ci-icon"
    aria-hidden="true"
  />
</template>
```

`src/ui/kit/ProvenanceBadge.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { EVIDENCE_LABELS, type EvidenceState } from '../evidence';

const props = defineProps<{ state: EvidenceState; detail?: string }>();
const label = computed(() => EVIDENCE_LABELS[props.state]);
</script>

<template>
  <span
    class="ci-provenance"
    :class="`ci-provenance--${state}`"
    :title="detail"
  >{{ label }}</span>
</template>
```

`src/ui/kit/Callout.vue`:

```vue
<script setup lang="ts">
import Icon from './Icon.vue';

withDefaults(defineProps<{ tone?: 'info' | 'warning'; title: string; badge?: string }>(), { tone: 'info', badge: undefined });
</script>

<template>
  <div
    class="ci-callout"
    :class="`ci-callout--${tone}`"
    role="note"
  >
    <Icon :name="tone === 'warning' ? 'alert-triangle' : 'info'" />
    <div class="ci-callout__body">
      <p class="ci-callout__title">
        {{ title }}
      </p>
      <p class="ci-callout__text">
        <slot />
      </p>
    </div>
    <span
      v-if="badge"
      class="ci-callout__badge"
    >{{ badge }}</span>
  </div>
</template>
```

`src/ui/kit/PageHeader.vue`:

```vue
<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; subtitle?: string }>();
</script>

<template>
  <header class="ci-page-header">
    <div class="ci-page-header__text">
      <p class="ci-page-header__eyebrow">
        {{ eyebrow }}
      </p>
      <h2 class="ci-page-header__title">
        {{ title }}
      </h2>
      <p
        v-if="subtitle"
        class="ci-page-header__subtitle"
      >
        {{ subtitle }}
      </p>
    </div>
    <div class="ci-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>
```

`src/ui/kit/Panel.vue`:

```vue
<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string; footnote?: string }>();
</script>

<template>
  <section class="ci-panel">
    <header
      v-if="title || $slots.actions"
      class="ci-panel__header"
    >
      <div>
        <h3
          v-if="title"
          class="ci-panel__title"
        >
          {{ title }}
        </h3>
        <p
          v-if="subtitle"
          class="ci-panel__subtitle"
        >
          {{ subtitle }}
        </p>
      </div>
      <slot name="actions" />
    </header>
    <div class="ci-panel__body">
      <slot />
    </div>
    <p
      v-if="footnote"
      class="ci-panel__footnote"
    >
      {{ footnote }}
    </p>
  </section>
</template>
```

`src/ui/kit/Sparkline.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ values: readonly number[]; label: string }>();
const W = 80;
const H = 28;

const points = computed(() => {
  const vs = props.values;
  if (vs.length === 0) return '';
  const min = Math.min(...vs);
  const span = Math.max(1, Math.max(...vs) - min);
  const step = vs.length > 1 ? W / (vs.length - 1) : 0;
  return vs.map((v, i) => `${(i * step).toFixed(1)},${(H - 2 - ((v - min) / span) * (H - 4)).toFixed(1)}`).join(' ');
});
</script>

<template>
  <svg
    class="ci-sparkline"
    :viewBox="`0 0 ${W} ${H}`"
    role="img"
    :aria-label="label"
    preserveAspectRatio="none"
  >
    <polyline
      :points="points"
      fill="none"
    />
  </svg>
</template>
```

`src/ui/kit/MetricCard.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { formatMetric, hasValue, type MetricValue } from '../evidence';
import Icon from './Icon.vue';
import ProvenanceBadge from './ProvenanceBadge.vue';
import Sparkline from './Sparkline.vue';

const props = withDefaults(defineProps<{
  label: string; icon: string; value: MetricValue; unit?: string; caption?: string;
  trend?: readonly number[] | null; tone?: 'warning' | 'success' | 'danger' | 'accent';
}>(), { unit: '', caption: undefined, trend: null, tone: 'accent' });

const shown = computed(() => formatMetric(props.value));
const known = computed(() => hasValue(props.value));
</script>

<template>
  <article
    class="ci-metric-card"
    :class="`ci-metric-card--${tone}`"
  >
    <header class="ci-metric-card__label">
      <Icon :name="icon" />
      <span>{{ label }}</span>
      <ProvenanceBadge
        v-if="value.state !== 'collected'"
        :state="value.state"
        :detail="value.provenance.detail"
      />
    </header>
    <div class="ci-metric-card__row">
      <p class="ci-metric-card__value">
        {{ shown }}<span
          v-if="known && unit"
          class="ci-metric-card__unit"
        >{{ unit }}</span>
      </p>
      <Sparkline
        v-if="trend && trend.length > 1"
        :values="trend"
        :label="`${label} trend`"
      />
    </div>
    <p
      v-if="!known && value.reason"
      class="ci-metric-card__reason"
    >
      {{ value.reason }}
    </p>
    <p
      v-else-if="caption"
      class="ci-metric-card__caption"
    >
      {{ caption }}
    </p>
  </article>
</template>
```

Note the test `'68%'`: `.text()` of the card concatenates value and unit spans, so `68%` appears. For unknown values the unit is suppressed.

`src/ui/styles/kit.css` — token extension plus kit styles:

```css
/* WP-02 token extension. Same bridge rules as styles.css: alias Obsidian variables, never
   redefine them. Data-viz tones are the only plugin-owned colours. */
:where(.codebase-inspector-root) {
  --ci-tone-accent: var(--interactive-accent);
  --ci-tone-success: var(--color-green, #5fb98a);
  --ci-tone-warning: var(--color-orange, #d99a5b);
  --ci-tone-danger: var(--color-red, #d9707a);
  --ci-sample: var(--color-yellow, #c9a44a);
  --ci-font-mono: var(--font-monospace);
  --ci-text-faint: var(--text-faint);
  --ci-radius-card: 8px;
  --ci-nav-width: 220px;
}
:where(.codebase-inspector-root) .ci-icon { display: inline-flex; width: 16px; height: 16px; color: currentColor; }
:where(.codebase-inspector-root) .ci-icon svg { width: 16px; height: 16px; }

:where(.codebase-inspector-root) .ci-provenance {
  display: inline-flex; align-items: center; padding: 1px var(--ci-space-2);
  border-radius: var(--ci-radius-small); border: 1px solid currentColor;
  font-size: var(--font-ui-smaller); text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--ci-text-muted);
}
:where(.codebase-inspector-root) .ci-provenance--sample { color: var(--ci-sample); }
:where(.codebase-inspector-root) .ci-provenance--stale,
:where(.codebase-inspector-root) .ci-provenance--partial { color: var(--ci-warning); }
:where(.codebase-inspector-root) .ci-provenance--failed { color: var(--ci-error); }

:where(.codebase-inspector-root) .ci-callout {
  display: flex; align-items: flex-start; gap: var(--ci-space-3);
  padding: var(--ci-space-4); border: 1px solid var(--ci-border);
  border-radius: var(--ci-radius-card); background: var(--ci-panel);
}
:where(.codebase-inspector-root) .ci-callout--warning { border-color: var(--ci-warning); }
:where(.codebase-inspector-root) .ci-callout__body { flex: 1 1 auto; }
:where(.codebase-inspector-root) .ci-callout__title { margin: 0; font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-callout__text { margin: var(--ci-space-1) 0 0; color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-callout__badge {
  align-self: center; padding: 2px var(--ci-space-2); border-radius: var(--ci-radius-small);
  border: 1px solid var(--ci-sample); color: var(--ci-sample);
  font-size: var(--font-ui-smaller); text-transform: uppercase; letter-spacing: 0.06em;
}

:where(.codebase-inspector-root) .ci-page-header {
  display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--ci-space-4);
}
:where(.codebase-inspector-root) .ci-page-header__eyebrow {
  margin: 0; font-size: var(--font-ui-smaller); letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--ci-action); font-weight: var(--font-semibold);
}
:where(.codebase-inspector-root) .ci-page-header__title { margin: var(--ci-space-2) 0 0; font-size: 1.6em; }
:where(.codebase-inspector-root) .ci-page-header__subtitle { margin: var(--ci-space-2) 0 0; color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-page-header__actions { display: flex; gap: var(--ci-space-2); }

:where(.codebase-inspector-root) .ci-panel {
  display: flex; flex-direction: column; min-width: 0;
  border: 1px solid var(--ci-border); border-radius: var(--ci-radius-card); background: var(--ci-panel);
}
:where(.codebase-inspector-root) .ci-panel__header {
  display: flex; justify-content: space-between; align-items: flex-start; gap: var(--ci-space-3);
  padding: var(--ci-space-4); border-bottom: 1px solid var(--ci-border);
}
:where(.codebase-inspector-root) .ci-panel__title { margin: 0; font-size: 1.05em; }
:where(.codebase-inspector-root) .ci-panel__subtitle { margin: var(--ci-space-1) 0 0; color: var(--ci-text-muted); font-size: var(--font-ui-small); }
:where(.codebase-inspector-root) .ci-panel__body { padding: var(--ci-space-4); min-width: 0; }
:where(.codebase-inspector-root) .ci-panel__footnote {
  margin: 0; padding: var(--ci-space-3) var(--ci-space-4); border-top: 1px solid var(--ci-border);
  color: var(--ci-text-faint); font-size: var(--font-ui-smaller);
}

:where(.codebase-inspector-root) .ci-metric-card {
  display: flex; flex-direction: column; gap: var(--ci-space-2); min-width: 0;
  padding: var(--ci-space-4); border: 1px solid var(--ci-border);
  border-radius: var(--ci-radius-card); background: var(--ci-panel);
  --ci-card-tone: var(--ci-tone-accent);
}
:where(.codebase-inspector-root) .ci-metric-card--success { --ci-card-tone: var(--ci-tone-success); }
:where(.codebase-inspector-root) .ci-metric-card--warning { --ci-card-tone: var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-metric-card--danger { --ci-card-tone: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-metric-card__label { display: flex; align-items: center; gap: var(--ci-space-2); color: var(--ci-text-muted); font-size: var(--font-ui-small); }
:where(.codebase-inspector-root) .ci-metric-card__row { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--ci-space-3); }
:where(.codebase-inspector-root) .ci-metric-card__value { margin: 0; font-size: 2em; font-weight: var(--font-semibold); color: var(--ci-card-tone); }
:where(.codebase-inspector-root) .ci-metric-card__unit { font-size: 0.5em; color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-metric-card__caption,
:where(.codebase-inspector-root) .ci-metric-card__reason { margin: 0; color: var(--ci-text-faint); font-size: var(--font-ui-smaller); }
:where(.codebase-inspector-root) .ci-sparkline { width: 80px; height: 28px; stroke: var(--ci-card-tone, var(--ci-tone-accent)); stroke-width: 1.5; }
```

`src/main.ts` — after the existing `import './ui/styles.css';` add:

```ts
import './ui/styles/kit.css';
```

(Tasks 6, 7 and 9 add `shell.css` and `screens.css` the same way; the build still emits one `styles.css` because `cssCodeSplit: false`.)

`vite.harness.config.ts` — replace the single-file `pluginStylesheet` with the ordered list, served concatenated:

```ts
const pluginStylesheets = ['styles.css', 'styles/kit.css', 'styles/shell.css', 'styles/screens.css']
  .map((f) => fileURLToPath(new URL(`./src/ui/${f}`, import.meta.url)));
// in configureServer:
        res.end(pluginStylesheets.filter((f) => existsSync(f)).map((f) => readFileSync(f, 'utf8')).join('\n'));
// and:
      for (const f of pluginStylesheets) server.watcher.add(f);
```

(import `existsSync` from `node:fs` alongside `readFileSync`; `existsSync` lets this land before `shell.css`/`screens.css` exist.) Update the doc comment's "src/ui/styles.css ON DISK" to "the plugin stylesheets ON DISK".

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run tests/component/kit-display.test.ts tests/harness/harness.test.ts && npm run typecheck && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add src/ui/inspector-copy.ts src/ui/routes.ts src/ui/kit src/ui/styles/kit.css src/main.ts tests/mocks/obsidian.ts vite.harness.config.ts tests/component/kit-display.test.ts
git commit -m "feat(ui): route metadata, token extension and the display kit"
```

---

### Task 6: Interactive kit — EvidenceTable, LineChart, Dialog

**Files:**
- Create: `src/ui/kit/EvidenceTable.vue`, `src/ui/kit/LineChart.vue`, `src/ui/kit/Dialog.vue`
- Modify: `src/ui/styles/kit.css` (append)
- Test: `tests/component/kit-interactive.test.ts`

**Interfaces:**
- Produces:
  - `EvidenceTable` (generic `T`): props `{ columns: readonly TableColumn<T>[]; rows: readonly T[]; rowKey: (row: T) => string; caption: string; initialSort?: { key: string; dir: 'asc'|'desc' } }`, emits `activate(row: T)`, scoped slot `cell-<key>` with `{ row }`. `interface TableColumn<T> { key: string; label: string; numeric?: boolean; sortValue?: (row: T) => number | string | null }` exported from `src/ui/kit/table-types.ts`.
  - `LineChart`: props `{ series: readonly { id: string; label: string; points: readonly { label: string; value: number }[] }[]; label: string }`.
  - `Dialog`: props `{ label: string }`, emits `close`; mounted = open (parent uses `v-if`). Traps Tab, closes on Escape (calls `preventDefault` + `stopPropagation` so the city's document-level Escape chain ignores it), restores focus to the previously focused element on unmount.

- [ ] **Step 1: Write the failing test** — `tests/component/kit-interactive.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import EvidenceTable from '../../src/ui/kit/EvidenceTable.vue';
import LineChart from '../../src/ui/kit/LineChart.vue';
import Dialog from '../../src/ui/kit/Dialog.vue';

interface Row { id: string; name: string; n: number | null }
const rows: Row[] = [{ id: 'a', name: 'Alpha', n: 2 }, { id: 'b', name: 'Beta', n: 9 }, { id: 'c', name: 'Gamma', n: null }];
const columns = [
  { key: 'name', label: 'File', sortValue: (r: Row) => r.name },
  { key: 'n', label: 'Count', numeric: true, sortValue: (r: Row) => r.n },
];

function mountTable() {
  return mount(EvidenceTable, {
    props: { columns, rows, rowKey: (r: Row) => r.id, caption: 'Files', initialSort: { key: 'n', dir: 'desc' as const } },
    slots: { 'cell-name': ({ row }: { row: Row }) => h('b', row.name), 'cell-n': ({ row }: { row: Row }) => String(row.n ?? '—') },
  });
}

describe('EvidenceTable', () => {
  it('applies the initial sort, unknowns last', () => {
    expect(mountTable().findAll('tbody tr').map((r) => r.text())).toEqual(['Beta9', 'Alpha2', 'Gamma—']);
  });
  it('toggles sort direction from the header button and reports aria-sort', async () => {
    const w = mountTable();
    const th = w.findAll('th')[1]!;
    await th.find('button').trigger('click');
    expect(th.attributes('aria-sort')).toBe('ascending');
    expect(w.findAll('tbody tr').map((r) => r.text())[0]).toBe('Alpha2');
  });
  it('activates a row on click and on Enter', async () => {
    const w = mountTable();
    await w.findAll('tbody tr')[0]!.trigger('click');
    await w.findAll('tbody tr')[1]!.trigger('keydown', { key: 'Enter' });
    expect(w.emitted('activate')?.map((e) => (e[0] as Row).id)).toEqual(['b', 'a']);
  });
  it('rows are keyboard focusable', () => {
    expect(mountTable().find('tbody tr').attributes('tabindex')).toBe('0');
  });
});

describe('LineChart', () => {
  it('draws one path per series and a data-table fallback', () => {
    const w = mount(LineChart, { props: { label: 'Signals', series: [
      { id: 'a', label: 'A', points: [{ label: 'Jun 01', value: 10 }, { label: 'Jun 15', value: 20 }] },
      { id: 'b', label: 'B', points: [{ label: 'Jun 01', value: 5 }, { label: 'Jun 15', value: 7 }] },
    ] } });
    expect(w.findAll('path.ci-line-chart__line')).toHaveLength(2);
    expect(w.find('table.visually-hidden').text()).toContain('Jun 15');
  });
});

describe('Dialog', () => {
  const Host = defineComponent({
    components: { Dialog },
    setup() { const open = ref(false); return { open }; },
    template: `<div><button class="opener" @click="open = true">Open</button>
      <Dialog v-if="open" label="Palette" @close="open = false"><input class="first"><button class="last">x</button></Dialog></div>`,
  });

  it('focuses the first control, closes on Escape without letting it bubble, and restores focus', async () => {
    const w = mount(Host, { attachTo: document.body });
    const opener = w.find('.opener');
    (opener.element as HTMLElement).focus();
    await opener.trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.first').element);
    let bubbled = false;
    document.addEventListener('keydown', () => { bubbled = true; }, { once: true });
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(bubbled).toBe(false);
    expect(document.activeElement).toBe(opener.element);
    w.unmount();
  });

  it('wraps Tab from the last control to the first', async () => {
    const w = mount(Host, { attachTo: document.body });
    await w.find('.opener').trigger('click');
    (w.find('.last').element as HTMLElement).focus();
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(w.find('.first').element);
    w.unmount();
  });
});
```

(Tests may use `document` — the `no-restricted-globals` rule covers `src/ui` only.)

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/ui/kit/table-types.ts`:

```ts
export interface TableColumn<T> {
  key: string;
  label: string;
  numeric?: boolean;
  /** null sorts last in either direction (unknown is never "smallest"). */
  sortValue?: (row: T) => number | string | null;
}
```

`src/ui/kit/EvidenceTable.vue`:

```vue
<script setup lang="ts" generic="T">
import { computed, ref } from 'vue';
import type { TableColumn } from './table-types';

const props = defineProps<{
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  caption: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}>();
const emit = defineEmits<{ activate: [row: T] }>();

const sortKey = ref<string | null>(props.initialSort?.key ?? null);
const sortDir = ref<'asc' | 'desc'>(props.initialSort?.dir ?? 'asc');

const sorted = computed(() => {
  const col = props.columns.find((c) => c.key === sortKey.value);
  if (!col?.sortValue) return props.rows;
  const get = col.sortValue;
  const sign = sortDir.value === 'asc' ? 1 : -1;
  return [...props.rows].sort((a, b) => {
    const va = get(a); const vb = get(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign;
    return String(va).localeCompare(String(vb)) * sign;
  });
});

function toggleSort(key: string): void {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'asc'; }
}

function ariaSort(key: string): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none';
  return sortDir.value === 'asc' ? 'ascending' : 'descending';
}

function onKey(event: KeyboardEvent, row: T): void {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); emit('activate', row); }
}
</script>

<template>
  <table class="ci-table">
    <caption class="visually-hidden">
      {{ caption }}
    </caption>
    <thead>
      <tr>
        <th
          v-for="col in columns"
          :key="col.key"
          scope="col"
          :aria-sort="ariaSort(col.key)"
          :class="{ 'ci-table__num': col.numeric }"
        >
          <button
            v-if="col.sortValue"
            type="button"
            class="ci-table__sort"
            @click="toggleSort(col.key)"
          >
            {{ col.label }}
          </button>
          <span v-else>{{ col.label }}</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in sorted"
        :key="rowKey(row)"
        tabindex="0"
        class="ci-table__row"
        @click="emit('activate', row)"
        @keydown="onKey($event, row)"
      >
        <td
          v-for="col in columns"
          :key="col.key"
          :class="{ 'ci-table__num': col.numeric }"
        >
          <slot
            :name="`cell-${col.key}`"
            :row="row"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>
```

`src/ui/kit/LineChart.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';

interface Point { label: string; value: number }
interface Series { id: string; label: string; points: readonly Point[] }
const props = defineProps<{ series: readonly Series[]; label: string }>();

const W = 600; const H = 200; const PAD_L = 32; const PAD_B = 22; const PAD_T = 8;
const TICKS = [0, 25, 50, 75, 100];

const yMax = computed(() => Math.max(100, ...props.series.flatMap((s) => s.points.map((p) => p.value))));
const labels = computed(() => props.series[0]?.points.map((p) => p.label) ?? []);
const x = (i: number, n: number): number => PAD_L + (n > 1 ? (i * (W - PAD_L - 8)) / (n - 1) : 0);
const y = (v: number): number => PAD_T + (H - PAD_T - PAD_B) * (1 - v / yMax.value);

const paths = computed(() => props.series.map((s, si) => ({
  id: s.id, index: si,
  d: s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i, s.points.length).toFixed(1)},${y(p.value).toFixed(1)}`).join(' '),
})));
</script>

<template>
  <figure class="ci-line-chart">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="label"
    >
      <g class="ci-line-chart__grid">
        <g
          v-for="t in TICKS"
          :key="t"
        >
          <line
            :x1="PAD_L"
            :x2="W - 8"
            :y1="y(t * yMax / 100)"
            :y2="y(t * yMax / 100)"
          />
          <text
            :x="PAD_L - 6"
            :y="y(t * yMax / 100) + 4"
            text-anchor="end"
          >{{ Math.round(t * yMax / 100) }}</text>
        </g>
        <text
          v-for="(l, i) in labels"
          :key="l + i"
          :x="x(i, labels.length)"
          :y="H - 4"
          text-anchor="middle"
        >{{ l }}</text>
      </g>
      <path
        v-for="p in paths"
        :key="p.id"
        class="ci-line-chart__line"
        :class="`ci-line-chart__line--${p.index}`"
        :d="p.d"
        fill="none"
      />
    </svg>
    <figcaption class="ci-line-chart__legend">
      <span
        v-for="(s, i) in series"
        :key="s.id"
        class="ci-line-chart__key"
        :class="`ci-line-chart__key--${i}`"
      >{{ s.label }}</span>
    </figcaption>
    <table class="visually-hidden">
      <caption>{{ label }}</caption>
      <thead>
        <tr>
          <th scope="col">
            Date
          </th>
          <th
            v-for="s in series"
            :key="s.id"
            scope="col"
          >
            {{ s.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(l, i) in labels"
          :key="l + i"
        >
          <th scope="row">
            {{ l }}
          </th>
          <td
            v-for="s in series"
            :key="s.id"
          >
            {{ s.points[i]?.value ?? '—' }}
          </td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
```

`src/ui/kit/Dialog.vue`:

```vue
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

defineProps<{ label: string }>();
const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);
let returnFocus: HTMLElement | null = null;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function focusables(): HTMLElement[] {
  return panel.value ? [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
}

onMounted(async () => {
  const active = panel.value?.ownerDocument.activeElement;
  returnFocus = active instanceof HTMLElement ? active : null;
  await nextTick();
  focusables()[0]?.focus();
});

onBeforeUnmount(() => { returnFocus?.focus(); });

/** Escape is claimed here (preventDefault + stopPropagation) so the city's document-level
 *  escape chain (CityWorkspace.vue) never also resolves it — spec 5.2's "one layer per press". */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    emit('close');
    return;
  }
  if (event.key !== 'Tab') return;
  const items = focusables();
  const first = items[0]; const last = items[items.length - 1];
  if (!first || !last) return;
  const active = panel.value?.ownerDocument.activeElement;
  if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
}
</script>

<template>
  <div
    class="ci-dialog__backdrop"
    @click.self="emit('close')"
  >
    <div
      ref="panel"
      class="ci-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="label"
      @keydown="onKeydown"
    >
      <slot />
    </div>
  </div>
</template>
```

Append to `src/ui/styles/kit.css`:

```css
:where(.codebase-inspector-root) .ci-table { width: 100%; border-collapse: collapse; font-size: var(--font-ui-small); }
:where(.codebase-inspector-root) .ci-table th {
  text-align: left; padding: var(--ci-space-2) var(--ci-space-3); color: var(--ci-text-muted);
  font-size: var(--font-ui-smaller); letter-spacing: 0.08em; text-transform: uppercase;
  border-bottom: 1px solid var(--ci-border);
}
:where(.codebase-inspector-root) .ci-table td { padding: var(--ci-space-3); border-bottom: 1px solid var(--ci-border); }
:where(.codebase-inspector-root) .ci-table__num { text-align: right; font-variant-numeric: tabular-nums; }
:where(.codebase-inspector-root) button.ci-table__sort {
  all: unset; cursor: pointer; font: inherit; color: inherit; letter-spacing: inherit; text-transform: inherit;
}
:where(.codebase-inspector-root) .ci-table__row { cursor: pointer; }
:where(.codebase-inspector-root) .ci-table__row:hover,
:where(.codebase-inspector-root) .ci-table__row:focus-visible { background: var(--ci-raised); }

:where(.codebase-inspector-root) .ci-line-chart { margin: 0; }
:where(.codebase-inspector-root) .ci-line-chart svg { width: 100%; height: auto; }
:where(.codebase-inspector-root) .ci-line-chart__grid line { stroke: var(--ci-border); stroke-dasharray: 3 4; }
:where(.codebase-inspector-root) .ci-line-chart__grid text { fill: var(--ci-text-faint); font-size: 11px; }
:where(.codebase-inspector-root) .ci-line-chart__line { stroke-width: 2; }
:where(.codebase-inspector-root) .ci-line-chart__line--0 { stroke: var(--ci-tone-success); }
:where(.codebase-inspector-root) .ci-line-chart__line--1 { stroke: var(--ci-tone-accent); }
:where(.codebase-inspector-root) .ci-line-chart__legend { display: flex; gap: var(--ci-space-4); color: var(--ci-text-muted); font-size: var(--font-ui-smaller); }
:where(.codebase-inspector-root) .ci-line-chart__key::before {
  content: ''; display: inline-block; width: 10px; height: 6px; margin-right: var(--ci-space-1); border-radius: 2px;
}
:where(.codebase-inspector-root) .ci-line-chart__key--0::before { background: var(--ci-tone-success); }
:where(.codebase-inspector-root) .ci-line-chart__key--1::before { background: var(--ci-tone-accent); }

:where(.codebase-inspector-root) .ci-dialog__backdrop {
  position: absolute; inset: 0; z-index: 40; display: flex; justify-content: center; align-items: flex-start;
  padding-top: 12vh; background: var(--background-modifier-cover);
}
:where(.codebase-inspector-root) .ci-dialog {
  width: min(560px, calc(100% - 32px)); max-height: 70%; overflow: auto;
  border: 1px solid var(--ci-border); border-radius: var(--ci-radius-modal);
  background: var(--ci-surface); box-shadow: var(--shadow-l);
}
```

- [ ] **Step 4: Run — expect PASS**; `npm run typecheck && npm run lint` (the `generic="T"` SFC must typecheck under vue-tsc).

- [ ] **Step 5: Commit**

```bash
git add src/ui/kit src/ui/styles/kit.css tests/component/kit-interactive.test.ts
git commit -m "feat(ui): EvidenceTable, LineChart and focus-trapping Dialog"
```

---

### Task 7: The workspace shell (App becomes the shell; the city moves into a screen)

This is the riskiest task: 16 test files mount `App.vue`. The default route is `city`, so the city must still render inside the shell exactly as before.

**Files:**
- Move: `src/ui/App.vue` → `src/ui/screens/CityWorkspace.vue` (`git mv`, then the edits below)
- Create: `src/ui/App.vue` (the shell), `src/ui/screens/CityScreen.vue`, `src/ui/screens/PlaceholderScreen.vue`, `src/ui/shell/NavColumn.vue`, `src/ui/shell/TopBar.vue`, `src/ui/shell/use-leaf-width.ts`, `src/ui/styles/shell.css`, `src/ui/styles/screens.css`
- Modify: `src/ui/container-box.ts`, `src/ui/components/CameraControls.vue:63`, `src/main.ts`, `tests/harness/mount.ts` (only if its import path breaks — it imports `App.vue`, which still exists)
- Test: `tests/component/workspace-shell.test.ts`

**Interfaces:**
- Consumes: Task 1 (`store.route`, `store.navigate`), Task 5 (`ROUTE_META`, `NAV_SECTIONS`, `NAV_FOOTER`, `Icon`, `PageHeader`, copy), Task 4 (`useReviewStore().workItemCount`), Task 3 (`useReadModels`).
- Produces:
  - `App.vue` still `defineExpose({ rendererHost })` (null when not on the city route).
  - `cityInlineSize(el: HTMLElement): number` in `container-box.ts`.
  - `useLeafWidth(rootEl: Ref<HTMLElement | null>): Ref<number>` in `src/ui/shell/use-leaf-width.ts`.
  - Shell DOM contract: `.ci-shell` (root), `.ci-shell--nav-inline` (wide), `.ci-shell--nav-open` (narrow drawer open), `.ci-shell__nav`, `.ci-shell__topbar`, `.ci-shell__content`.
  - `NavColumn` props `{ drawer: boolean; workspaceLabel: string }`, emits `navigate(route: RouteId)` and `close()`; `TopBar` emits `open-nav()` and `open-palette()` and has a `snapshot` slot.

- [ ] **Step 1: Move the city composition**

```bash
git mv src/ui/App.vue src/ui/screens/CityWorkspace.vue
```

In `src/ui/screens/CityWorkspace.vue`:
- Fix every relative import: `'./stores/…'` → `'../stores/…'`, `'./components/…'` → `'../components/…'`, `'./renderer-handle'` → `'../renderer-handle'`, `'./drawer-focus'`, `'./view-surface'`, `'./interaction/escape-intent'`, `'./responsive'`, `'./container-box'`, `'./copy'` likewise.
- Replace `contentBoxInlineSize(narrowContainer(el))` in `updateResponsiveLayout` with `cityInlineSize(el)` (import it from `'../container-box'`; drop `contentBoxInlineSize` from that import if now unused).
- Change the header comment's first line from `C01 — the real shell…` to `C01 — the city composition (WP-02: moved out of App.vue, which is now the inspector shell). Behaviour unchanged.` Leave everything else, including `defineExpose({ rendererHost })`, as is.

- [ ] **Step 2: Subtract an inline nav column from the city's measured width**

Append to `src/ui/container-box.ts`:

```ts
/** WP-02: the inline size the CITY actually gets. The leaf measurement above is still the
 *  one CSS container queries on the leaf compare against, but once the inspector shell
 *  shows its navigation column inline (`.ci-shell--nav-inline`) the city's own content box
 *  (`.ci-shell__content`, itself a size container in shell.css) is narrower by that
 *  column. Subtracting it keeps the JS threshold decisions (drawer at 820 px, list-first
 *  floor at 320 px) in step with the container queries evaluated on `.ci-shell__content`.
 *  Outside the shell, or with the nav collapsed into a drawer, this equals the leaf size. */
export function cityInlineSize(el: HTMLElement): number {
  const leaf = narrowContainer(el);
  const nav = leaf.querySelector<HTMLElement>('.ci-shell--nav-inline > .ci-shell__nav');
  return contentBoxInlineSize(leaf) - (nav ? nav.getBoundingClientRect().width : 0);
}
```

In `src/ui/components/CameraControls.vue` line 63 replace `contentBoxInlineSize(narrowContainer(el))` with `cityInlineSize(el)` and fix its import.

- [ ] **Step 3: Write the failing shell test** — `tests/component/workspace-shell.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { cityInlineSize } from '../../src/ui/container-box';

function mountShell() {
  return mount(App, {
    attachTo: document.body,
    global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } },
  });
}

describe('workspace shell', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('opens on the city, rendered inside the shell content area', () => {
    const w = mountShell();
    expect(w.find('.ci-shell__content .ci-app').exists()).toBe(true);
    w.unmount();
  });

  it('lists every navigable route and marks the current one', () => {
    const w = mountShell();
    const items = w.findAll('.ci-nav__item');
    expect(items).toHaveLength(14);
    expect(w.find('.ci-nav__item[aria-current="page"]').text()).toContain('Code city');
    w.unmount();
  });

  it('navigates to a placeholder screen and back, unmounting the city', async () => {
    const w = mountShell();
    await w.findAll('.ci-nav__item').find((b) => b.text().includes('Security'))!.trigger('click');
    expect(useCityStore().route).toBe('security');
    expect(w.find('.ci-app').exists()).toBe(false);
    expect(w.text()).toContain('arrives in Part 3');
    await w.findAll('.ci-nav__item').find((b) => b.text().includes('Code city'))!.trigger('click');
    expect(w.find('.ci-app').exists()).toBe(true);
    w.unmount();
  });

  it('shows the breadcrumb for the current route', async () => {
    const w = mountShell();
    useCityStore().navigate('overview');
    await nextTick();
    expect(w.find('.ci-topbar__crumbs').text()).toContain('Overview');
    w.unmount();
  });

  it('opens the narrow navigation drawer and closes it with Escape, restoring focus', async () => {
    const w = mountShell();
    const menu = w.find('.ci-topbar__menu');
    (menu.element as HTMLElement).focus();
    await menu.trigger('click');
    expect(w.find('.ci-shell').classes()).toContain('ci-shell--nav-open');
    await w.find('.ci-shell__nav').trigger('keydown', { key: 'Escape' });
    expect(w.find('.ci-shell').classes()).not.toContain('ci-shell--nav-open');
    expect(document.activeElement).toBe(menu.element);
    w.unmount();
  });

  it('city width excludes an inline nav column', () => {
    const leaf = document.createElement('div');
    leaf.className = 'codebase-inspector-root';
    leaf.innerHTML = '<div class="ci-shell ci-shell--nav-inline"><nav class="ci-shell__nav"></nav><div class="ci-shell__content"><div class="probe"></div></div></div>';
    leaf.getBoundingClientRect = () => ({ width: 1200 } as DOMRect);
    (leaf.querySelector('.ci-shell__nav') as HTMLElement).getBoundingClientRect = () => ({ width: 220 } as DOMRect);
    expect(cityInlineSize(leaf.querySelector('.probe') as HTMLElement)).toBe(980);
  });
});
```

- [ ] **Step 4: Run — expect FAIL**

Run: `npx vitest run tests/component/workspace-shell.test.ts`

- [ ] **Step 5: Implement the shell**

`src/ui/shell/use-leaf-width.ts` — the same window-correct ResizeObserver pattern `CityWorkspace.vue` uses (re-attached on pop-out migration):

```ts
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { contentBoxInlineSize, narrowContainer } from '../container-box';

interface WinBearing { win?: Window }

/** The leaf's content-box inline size, tracked through the element's OWN window (spec 4.4)
 *  and re-attached after a pop-out migration. 0 while hidden or before layout. */
export function useLeafWidth(rootEl: Ref<HTMLElement | null>): Ref<number> {
  const width = ref(0);
  let observer: ResizeObserver | null = null;
  let unwire: (() => void) | null = null;

  function measure(el: HTMLElement): void { width.value = contentBoxInlineSize(narrowContainer(el)); }

  function attach(el: HTMLElement): void {
    observer?.disconnect();
    observer = null;
    measure(el);
    const win = (el as unknown as WinBearing).win;
    if (!win) return;
    observer = new (win as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() => { measure(el); });
    observer.observe(narrowContainer(el));
  }

  onMounted(() => {
    const el = rootEl.value;
    if (!el) return;
    attach(el);
    unwire = el.onWindowMigrated?.(() => { attach(el); }) ?? null;
  });
  onBeforeUnmount(() => { observer?.disconnect(); observer = null; unwire?.(); unwire = null; });
  return width;
}
```

(If `onWindowMigrated` is typed as always present on `HTMLElement` in this codebase, drop the `?.` and `?? null` exactly as `CityWorkspace.vue` does.)

`src/ui/shell/NavColumn.vue`:

```vue
<script setup lang="ts">
import { computed, inject } from 'vue';
import type { RouteId } from '../../domain/route-ids';
import { NAV_FOOTER, NAV_SECTIONS, ROUTE_META } from '../routes';
import { CLOSE_NAVIGATION_LABEL } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { useReadModels } from '../read-models/use-read-models';
import Icon from '../kit/Icon.vue';

defineProps<{ drawer: boolean; workspaceLabel: string }>();
const emit = defineEmits<{ navigate: [route: RouteId]; close: [] }>();

const store = useCityStore();
const review = useReviewStore();
const { overview } = useReadModels();
const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});

const badges = computed<Partial<Record<RouteId, number>>>(() => ({
  quality: overview.value?.cards.find((c) => c.id === 'findings')?.value.value,
  workbench: review.workItemCount || undefined,
}));

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  emit('close');
}
</script>

<template>
  <nav
    class="ci-shell__nav ci-nav"
    aria-label="Codebase Inspector"
    @keydown="onKeydown"
  >
    <div class="ci-nav__head">
      <button
        type="button"
        class="ci-nav__workspace"
        @click="onSelectCodebase"
      >
        <Icon name="folder-git-2" />
        <span>{{ workspaceLabel }}</span>
      </button>
      <button
        v-if="drawer"
        type="button"
        class="ci-nav__close"
        :aria-label="CLOSE_NAVIGATION_LABEL"
        @click="emit('close')"
      >
        <Icon name="x" />
      </button>
    </div>
    <div
      v-for="section in NAV_SECTIONS"
      :key="section.group"
      class="ci-nav__section"
    >
      <p class="ci-nav__group">
        {{ section.group }}
      </p>
      <button
        v-for="id in section.routes"
        :key="id"
        type="button"
        class="ci-nav__item"
        :aria-current="store.route === id ? 'page' : undefined"
        @click="emit('navigate', id)"
      >
        <Icon :name="ROUTE_META[id].icon" />
        <span class="ci-nav__label">{{ ROUTE_META[id].title }}</span>
        <span
          v-if="badges[id] !== undefined"
          class="ci-nav__badge"
        >{{ badges[id] }}</span>
      </button>
    </div>
    <div class="ci-nav__footer">
      <button
        v-for="id in NAV_FOOTER"
        :key="id"
        type="button"
        class="ci-nav__item"
        :aria-current="store.route === id ? 'page' : undefined"
        @click="emit('navigate', id)"
      >
        <Icon :name="ROUTE_META[id].icon" />
        <span class="ci-nav__label">{{ ROUTE_META[id].title }}</span>
      </button>
    </div>
  </nav>
</template>
```

`src/ui/shell/TopBar.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { ROUTE_META } from '../routes';
import { OPEN_NAVIGATION_LABEL, SEARCH_TRIGGER_LABEL } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';
import Icon from '../kit/Icon.vue';

defineProps<{ workspaceLabel: string }>();
const emit = defineEmits<{ 'open-nav': []; 'open-palette': [] }>();
const store = useCityStore();
const title = computed(() => ROUTE_META[store.route].title);
</script>

<template>
  <header class="ci-shell__topbar ci-topbar">
    <button
      type="button"
      class="ci-topbar__menu"
      :aria-label="OPEN_NAVIGATION_LABEL"
      @click="emit('open-nav')"
    >
      <Icon name="menu" />
    </button>
    <nav
      class="ci-topbar__crumbs"
      aria-label="Breadcrumb"
    >
      <span>Workspace</span>
      <span aria-hidden="true">/</span>
      <span>{{ workspaceLabel }}</span>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{{ title }}</span>
    </nav>
    <button
      type="button"
      class="ci-topbar__search"
      @click="emit('open-palette')"
    >
      <Icon name="search" />
      <span>{{ SEARCH_TRIGGER_LABEL }}</span>
      <kbd>Ctrl K</kbd>
    </button>
    <slot name="snapshot" />
  </header>
</template>
```

`src/ui/screens/PlaceholderScreen.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { RouteId } from '../../domain/route-ids';
import { ROUTE_META } from '../routes';
import { PLACEHOLDER_ARRIVES } from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Callout from '../kit/Callout.vue';

const props = defineProps<{ route: RouteId }>();
const meta = computed(() => ROUTE_META[props.route]);
</script>

<template>
  <div class="ci-screen ci-screen--placeholder">
    <PageHeader
      :eyebrow="`${meta.group} / ${meta.title}`"
      :title="meta.title"
      :subtitle="meta.goal"
    />
    <Callout :title="PLACEHOLDER_ARRIVES(meta.part)">
      {{ meta.goal }}
    </Callout>
  </div>
</template>
```

Because the test searches for the lowercase text, `PLACEHOLDER_ARRIVES(3)` renders `This screen arrives in Part 3 of the inspector UI.` — the test's `'arrives in Part 3'` substring matches.

`src/ui/screens/CityScreen.vue` (Task 10 adds the header and cards; for now a pass-through that forwards `rendererHost`):

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import CityWorkspace from './CityWorkspace.vue';

interface WorkspaceExposed { rendererHost: HTMLElement | null }
const workspace = ref<WorkspaceExposed | null>(null);
const rendererHost = computed(() => workspace.value?.rendererHost ?? null);
defineExpose({ rendererHost });
</script>

<template>
  <div class="ci-screen ci-screen--city">
    <CityWorkspace ref="workspace" />
  </div>
</template>
```

`src/ui/App.vue` (the shell). The command palette and snapshot selector slot in during Task 8; the Overview during Task 9.

```vue
<!--
  WP-02 — the inspector shell (spec §4.1). Owns navigation, the top bar and the content
  outlet. The city composition that used to live here is screens/CityWorkspace.vue,
  unchanged. Still exposes `rendererHost` (null off the city route) for tests that mount
  App directly.
-->
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { RouteId } from '../domain/route-ids';
import { DRAWER_MAX_INLINE_SIZE } from './responsive';
import { NO_CODEBASE_LABEL } from './inspector-copy';
import { useCityStore } from './stores/city-store';
import { useLeafWidth } from './shell/use-leaf-width';
import NavColumn from './shell/NavColumn.vue';
import TopBar from './shell/TopBar.vue';
import CityScreen from './screens/CityScreen.vue';
import PlaceholderScreen from './screens/PlaceholderScreen.vue';

const store = useCityStore();
const rootEl = ref<HTMLElement | null>(null);
const leafWidth = useLeafWidth(rootEl);
/** Inline nav only when the leaf is measurably wide. 0 (hidden leaf, jsdom) keeps the
 *  drawer layout, so the city gets the whole leaf — exactly WP-01's behaviour. */
const navInline = computed(() => leafWidth.value >= DRAWER_MAX_INLINE_SIZE);
const navOpen = ref(false);
let navOpener: HTMLElement | null = null;

const workspaceLabel = computed(() => {
  const root = store.snapshot?.scope.rootPath;
  if (!root) return NO_CODEBASE_LABEL;
  const normalized = root.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.slice(normalized.lastIndexOf('/') + 1) || normalized;
});

function openNav(event?: Event): void {
  navOpener = (event?.currentTarget as HTMLElement | undefined) ?? rootEl.value?.querySelector<HTMLElement>('.ci-topbar__menu') ?? null;
  navOpen.value = true;
  void nextTick(() => rootEl.value?.querySelector<HTMLElement>('.ci-nav__item')?.focus());
}
function closeNav(): void {
  if (!navOpen.value) return;
  navOpen.value = false;
  navOpener?.focus();
}
function navigate(route: RouteId): void {
  store.navigate(route);
  if (navOpen.value) closeNav();
}

interface CityScreenExposed { rendererHost: HTMLElement | null }
const cityScreen = ref<CityScreenExposed | null>(null);
const rendererHost = computed(() => cityScreen.value?.rendererHost ?? null);
defineExpose({ rendererHost });
</script>

<template>
  <div
    ref="rootEl"
    class="ci-shell"
    :class="{ 'ci-shell--nav-inline': navInline, 'ci-shell--nav-open': navOpen && !navInline }"
  >
    <NavColumn
      :drawer="!navInline"
      :workspace-label="workspaceLabel"
      @navigate="navigate"
      @close="closeNav"
    />
    <TopBar
      :workspace-label="workspaceLabel"
      @open-nav="openNav()"
      @open-palette="() => {}"
    />
    <main class="ci-shell__content">
      <CityScreen
        v-if="store.route === 'city'"
        ref="cityScreen"
      />
      <PlaceholderScreen
        v-else
        :route="store.route"
      />
    </main>
  </div>
</template>
```

The test calls `menu.trigger('click')` after focusing it; `openNav()` receives no event from `@open-nav="openNav()"`, so it falls back to querying `.ci-topbar__menu` — that is why the fallback exists.

`src/ui/styles/shell.css`:

```css
/* WP-02 shell. The leaf root stays the size container WP-01 declared; the content area is
   ALSO a size container, so the city's existing unnamed @container rules (styles.css)
   resolve against the space the city really has once the nav column is inline. */
:where(.codebase-inspector-root) .ci-shell {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
}
:where(.codebase-inspector-root) .ci-shell--nav-inline { grid-template-columns: var(--ci-nav-width) minmax(0, 1fr); }
:where(.codebase-inspector-root) .ci-shell__nav { display: none; }
:where(.codebase-inspector-root) .ci-shell--nav-inline .ci-shell__nav { display: flex; grid-row: 1 / span 2; }
:where(.codebase-inspector-root) .ci-shell--nav-open .ci-shell__nav {
  display: flex; position: absolute; inset: 0 auto 0 0; z-index: 30;
  width: min(280px, 85%); box-shadow: var(--shadow-l);
}
:where(.codebase-inspector-root) .ci-shell__topbar { grid-column: -2 / -1; }
:where(.codebase-inspector-root) .ci-shell__content {
  grid-column: -2 / -1; min-height: 0; min-width: 0; overflow: auto;
  container-type: inline-size;
}

:where(.codebase-inspector-root) .ci-nav {
  flex-direction: column; gap: var(--ci-space-1); min-height: 0; overflow-y: auto;
  padding: var(--ci-space-3); border-right: 1px solid var(--ci-border); background: var(--ci-panel);
}
:where(.codebase-inspector-root) .ci-nav__head { display: flex; align-items: center; gap: var(--ci-space-2); padding-bottom: var(--ci-space-3); border-bottom: 1px solid var(--ci-border); }
:where(.codebase-inspector-root) .ci-nav__section { display: flex; flex-direction: column; gap: 2px; margin-top: var(--ci-space-3); }
:where(.codebase-inspector-root) .ci-nav__group {
  margin: 0 0 var(--ci-space-1); padding-inline: var(--ci-space-2);
  font-size: var(--font-ui-smaller); letter-spacing: 0.14em; text-transform: uppercase; color: var(--ci-text-faint);
}
:where(.codebase-inspector-root) .ci-nav__footer { margin-top: auto; display: flex; flex-direction: column; gap: 2px; padding-top: var(--ci-space-3); }
:where(.codebase-inspector-root) button.ci-nav__item,
:where(.codebase-inspector-root) button.ci-nav__workspace {
  display: flex; align-items: center; gap: var(--ci-space-2); width: 100%;
  min-height: var(--ci-control-min); padding: 0 var(--ci-space-2);
  border: none; border-radius: var(--ci-radius-control); background: transparent; box-shadow: none;
  color: var(--ci-text-muted); cursor: pointer; text-align: left; justify-content: flex-start;
}
:where(.codebase-inspector-root) button.ci-nav__workspace { color: var(--ci-text); font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) button.ci-nav__item:hover { background: var(--ci-raised); color: var(--ci-text); }
:where(.codebase-inspector-root) button.ci-nav__item[aria-current="page"] { background: var(--ci-raised); color: var(--ci-action); }
:where(.codebase-inspector-root) .ci-nav__label { flex: 1 1 auto; }
:where(.codebase-inspector-root) .ci-nav__badge {
  padding: 0 var(--ci-space-2); border-radius: var(--ci-radius-small);
  background: var(--ci-surface); color: var(--ci-text-muted); font-size: var(--font-ui-smaller);
}

:where(.codebase-inspector-root) .ci-topbar {
  display: flex; align-items: center; gap: var(--ci-space-3);
  padding: var(--ci-space-2) var(--ci-space-4); border-bottom: 1px solid var(--ci-border);
}
:where(.codebase-inspector-root) .ci-shell--nav-inline button.ci-topbar__menu { display: none; }
:where(.codebase-inspector-root) .ci-topbar__crumbs { display: flex; gap: var(--ci-space-2); flex: 1 1 auto; min-width: 0; color: var(--ci-text-muted); font-size: var(--font-ui-small); white-space: nowrap; overflow: hidden; }
:where(.codebase-inspector-root) .ci-topbar__crumbs [aria-current="page"] { color: var(--ci-text); }
:where(.codebase-inspector-root) button.ci-topbar__search {
  display: flex; align-items: center; gap: var(--ci-space-2); min-height: var(--ci-control-min);
  padding: 0 var(--ci-space-3); border: 1px solid var(--ci-border); border-radius: var(--ci-radius-control);
  background: var(--ci-surface); box-shadow: none; color: var(--ci-text-muted); cursor: pointer;
}
:where(.codebase-inspector-root) .ci-topbar__search kbd { font-size: var(--font-ui-smaller); }
```

`src/ui/styles/screens.css`:

```css
/* WP-02 screens. The city screen is a flex column so its PageHeader/cards (Task 10) and
   the unchanged `.ci-app` share the content height; `.ci-app`'s own `height: 100%`
   (styles.css, pinned by stage-height.test.ts) is overridden only inside this screen. */
:where(.codebase-inspector-root) .ci-screen {
  display: flex; flex-direction: column; gap: var(--ci-space-5);
  padding: var(--ci-space-6); box-sizing: border-box; min-width: 0;
}
:where(.codebase-inspector-root) .ci-screen--city { height: 100%; padding: 0; gap: 0; }
:where(.codebase-inspector-root) .ci-screen--city > .ci-app { flex: 1 1 0; min-height: 0; height: auto; }
```

`src/main.ts` — add `import './ui/styles/shell.css';` and `import './ui/styles/screens.css';` after `kit.css`.

- [ ] **Step 6: Run the new test, then the whole suite**

Run: `npx vitest run tests/component/workspace-shell.test.ts` → PASS.
Run: `npm run test`.

Existing tests that mount `App` now see the shell around the city. Fix any failure by **scoping the query to the city** (e.g. `wrapper.find('.ci-app')` / `.ci-app` descendants) — never by deleting or loosening an assertion. Expected categories:
- a text assertion such as `not.toMatch(/…/)` or an exact `wrapper.text()` now also sees nav/top-bar text → scope it to `.ci-app`.
- a test counting `button` elements across the whole wrapper → scope to `.ci-app`.
- a test that stubs the leaf root's `getBoundingClientRect` to a WIDE value (≥ 820) now also makes the nav inline; in jsdom the nav's own rect is 0 wide, so `cityInlineSize` equals the leaf width and city behaviour is unchanged. If a test nevertheless fails because of the inline nav, stub `.ci-shell__nav`'s rect to `{ width: 0 }` in that test, with a one-line comment explaining why.
If a failure is not in these categories, stop and report it rather than changing behaviour.

Also run `npx vitest run tests/unit/layout-budget.test.ts tests/component/stage-height.test.ts` explicitly — both must pass unchanged.

- [ ] **Step 7: Lint, typecheck, build**

Run: `npm run typecheck && npm run lint && npm run build` — `dist/` must still contain exactly `main.js, manifest.json, styles.css`, and `dist/styles.css` must contain `.ci-shell`.

- [ ] **Step 8: Commit**

```bash
git add -A src/ui src/main.ts tests
git commit -m "feat(ui): inspector shell with navigation; city composition moves into CityWorkspace"
```

---

### Task 8: Snapshot selector and command palette

**Files:**
- Create: `src/ui/shell/SnapshotSelector.vue`, `src/ui/shell/CommandPalette.vue`
- Modify: `src/ui/App.vue` (wire both, Ctrl/Cmd+K), `src/ui/styles/shell.css` (append)
- Test: `tests/component/command-palette.test.ts`

**Interfaces:**
- Consumes: Task 6 `Dialog`; Task 5 `ROUTE_META`, copy; Task 3 `useReadModels().files`; Task 1 `navigate`.
- Produces:
  - `SnapshotSelector` (no props): a labelled `<select>` listing the current snapshot as `Latest · <Mon DD>`; disabled when there is no snapshot.
  - `CommandPalette` (no props) emits `close`. Items: every route (`kind: 'route'`) and up to 20 matching files (`kind: 'file'`). Activating a route → `store.navigate(id)`; a file → `store.select(id)`, `store.navigate('city')`, `store.openInspector()`; then emits `close`.
  - `paletteItems(query: string, files: readonly { id: string; path: string; name: string }[]): PaletteItem[]` exported from `src/ui/shell/palette-items.ts` with `interface PaletteItem { key: string; kind: 'route' | 'file'; label: string; detail: string; target: string }`.

- [ ] **Step 1: Write the failing test** — `tests/component/command-palette.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import App from '../../src/ui/App.vue';
import CommandPalette from '../../src/ui/shell/CommandPalette.vue';
import { paletteItems } from '../../src/ui/shell/palette-items';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const files = [
  { id: 'f1', path: 'src/domain/cost-engine.ts', name: 'cost-engine.ts' },
  { id: 'f2', path: 'src/ui/App.vue', name: 'App.vue' },
];

describe('paletteItems', () => {
  it('lists every route when the query is empty', () => {
    expect(paletteItems('', files).filter((i) => i.kind === 'route')).toHaveLength(15);
  });
  it('matches routes and file paths case-insensitively', () => {
    const items = paletteItems('COST', files);
    expect(items.map((i) => i.target)).toEqual(['f1']);
    expect(paletteItems('secur', files).map((i) => i.target)).toEqual(['security']);
  });
});

describe('CommandPalette', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const snap = buildSnapshotFixture({ files: 3 });
    useCityStore().setCity(snap, computeLayout(snap));
  });

  it('navigates to a route with arrow keys + Enter and closes', async () => {
    const w = mount(CommandPalette, { attachTo: document.body });
    const input = w.find('input');
    await input.setValue('overview');
    await input.trigger('keydown', { key: 'Enter' });
    expect(useCityStore().route).toBe('overview');
    expect(w.emitted('close')).toHaveLength(1);
    w.unmount();
  });

  it('opening a file selects it, shows the city and opens the inspector — without touching the camera', async () => {
    const store = useCityStore();
    store.navigate('overview');
    const w = mount(CommandPalette, { attachTo: document.body });
    await w.find('input').setValue('file-1');
    await w.find('input').trigger('keydown', { key: 'Enter' });
    expect(store.selectedEntityId).toContain('file-1.ts');
    expect(store.route).toBe('city');
    expect(store.inspectorOpen).toBe(true);
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('shows an empty state for no matches', async () => {
    const w = mount(CommandPalette, { attachTo: document.body });
    await w.find('input').setValue('zzzz-nothing');
    expect(w.text()).toContain('No matching screens or files.');
    w.unmount();
  });
});

describe('shell wiring', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  it('Ctrl+K inside the leaf opens the palette; Escape closes it', async () => {
    const w = mount(App, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });
    await w.find('.ci-shell').trigger('keydown', { key: 'k', ctrlKey: true });
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    await nextTick();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });
  it('shows the snapshot selector disabled when there is no snapshot', () => {
    const w = mount(App, { global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });
    expect(w.find('.ci-snapshot-selector select').attributes('disabled')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/ui/shell/palette-items.ts`:

```ts
import { ROUTE_IDS } from '../../domain/route-ids';
import { ROUTE_META } from '../routes';

export interface PaletteItem { key: string; kind: 'route' | 'file'; label: string; detail: string; target: string }
export interface PaletteFile { id: string; path: string; name: string }

const MAX_FILES = 20;

export function paletteItems(query: string, files: readonly PaletteFile[]): PaletteItem[] {
  const q = query.trim().toLowerCase();
  const routes = ROUTE_IDS
    .filter((id) => !q || ROUTE_META[id].title.toLowerCase().includes(q))
    .map((id): PaletteItem => ({ key: `route:${id}`, kind: 'route', label: ROUTE_META[id].title, detail: ROUTE_META[id].group, target: id }));
  const matched = q
    ? files.filter((f) => f.path.toLowerCase().includes(q)).slice(0, MAX_FILES)
        .map((f): PaletteItem => ({ key: `file:${f.id}`, kind: 'file', label: f.name, detail: f.path, target: f.id }))
    : [];
  return [...routes, ...matched];
}
```

`src/ui/shell/CommandPalette.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { isRouteId } from '../../domain/route-ids';
import { COMMAND_PALETTE_EMPTY, COMMAND_PALETTE_LABEL, COMMAND_PALETTE_PLACEHOLDER } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';
import { useReadModels } from '../read-models/use-read-models';
import Dialog from '../kit/Dialog.vue';
import Icon from '../kit/Icon.vue';
import { paletteItems, type PaletteItem } from './palette-items';

const emit = defineEmits<{ close: [] }>();
const store = useCityStore();
const { files } = useReadModels();
const query = ref('');
const active = ref(0);
const items = computed(() => paletteItems(query.value, files.value));
watch(query, () => { active.value = 0; });

function run(item: PaletteItem | undefined): void {
  if (!item) return;
  if (item.kind === 'route' && isRouteId(item.target)) {
    store.navigate(item.target);
  } else if (item.kind === 'file') {
    store.select(item.target);
    store.navigate('city');
    store.openInspector();
  }
  emit('close');
}

function onKeydown(event: KeyboardEvent): void {
  const n = items.value.length;
  if (event.key === 'ArrowDown' && n) { event.preventDefault(); active.value = (active.value + 1) % n; }
  else if (event.key === 'ArrowUp' && n) { event.preventDefault(); active.value = (active.value - 1 + n) % n; }
  else if (event.key === 'Enter') { event.preventDefault(); run(items.value[active.value]); }
}
</script>

<template>
  <Dialog
    :label="COMMAND_PALETTE_LABEL"
    @close="emit('close')"
  >
    <div class="ci-palette">
      <input
        v-model="query"
        type="text"
        class="ci-palette__input"
        role="combobox"
        aria-expanded="true"
        aria-controls="ci-palette-list"
        :aria-activedescendant="items[active] ? `ci-palette-${active}` : undefined"
        :placeholder="COMMAND_PALETTE_PLACEHOLDER"
        :aria-label="COMMAND_PALETTE_LABEL"
        @keydown="onKeydown"
      >
      <ul
        id="ci-palette-list"
        class="ci-palette__list"
        role="listbox"
      >
        <li
          v-for="(item, i) in items"
          :id="`ci-palette-${i}`"
          :key="item.key"
          role="option"
          class="ci-palette__item"
          :aria-selected="i === active"
          @click="run(item)"
        >
          <Icon :name="item.kind === 'route' ? 'arrow-right' : 'file-code'" />
          <span class="ci-palette__label">{{ item.label }}</span>
          <span class="ci-palette__detail">{{ item.detail }}</span>
        </li>
      </ul>
      <p
        v-if="items.length === 0"
        class="ci-palette__empty"
      >
        {{ COMMAND_PALETTE_EMPTY }}
      </p>
    </div>
  </Dialog>
</template>
```

`src/ui/shell/SnapshotSelector.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { SNAPSHOT_LABEL } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const store = useCityStore();

/** Part 1 lists only the snapshot on screen: snapshot history arrives with the backend
 *  phase (spec §9 A4). The control already exists so the layout and focus order are final. */
const label = computed(() => {
  const s = store.snapshot;
  if (!s) return 'No snapshot';
  const d = new Date(s.providerRun.capturedAt);
  return `Latest · ${MONTHS[d.getUTCMonth()] ?? ''} ${d.getUTCDate()}`;
});
</script>

<template>
  <label class="ci-snapshot-selector">
    <span class="visually-hidden">{{ SNAPSHOT_LABEL }}</span>
    <select
      :disabled="!store.snapshot"
      :value="store.snapshot?.snapshotId ?? ''"
    >
      <option :value="store.snapshot?.snapshotId ?? ''">{{ label }}</option>
    </select>
  </label>
</template>
```

`src/ui/App.vue` changes:
- imports: `SnapshotSelector`, `CommandPalette`.
- state: `const paletteOpen = ref(false);`
- handler on the root div: `@keydown="onShellKeydown"`:

```ts
/** Ctrl/Cmd+K while focus is anywhere inside THIS leaf (the listener sits on the shell
 *  root, never the document — two open leaves must not both react). */
function onShellKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    paletteOpen.value = true;
  }
}
```

- TopBar: `@open-palette="paletteOpen = true"` and inside it `<template #snapshot><SnapshotSelector /></template>`.
- after `</main>`: `<CommandPalette v-if="paletteOpen" @close="paletteOpen = false" />`

Append to `src/ui/styles/shell.css`:

```css
:where(.codebase-inspector-root) .ci-snapshot-selector select { min-height: var(--ci-control-min); }
:where(.codebase-inspector-root) .ci-palette { display: flex; flex-direction: column; }
:where(.codebase-inspector-root) .ci-palette__input { margin: var(--ci-space-3); width: calc(100% - 2 * var(--ci-space-3)); }
:where(.codebase-inspector-root) .ci-palette__list { list-style: none; margin: 0; padding: 0 0 var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-palette__item {
  display: flex; align-items: center; gap: var(--ci-space-2); padding: var(--ci-space-2) var(--ci-space-4); cursor: pointer;
}
:where(.codebase-inspector-root) .ci-palette__item[aria-selected="true"] { background: var(--ci-raised); }
:where(.codebase-inspector-root) .ci-palette__detail { margin-left: auto; color: var(--ci-text-faint); font-size: var(--font-ui-smaller); }
:where(.codebase-inspector-root) .ci-palette__empty { margin: 0; padding: var(--ci-space-4); color: var(--ci-text-muted); }
```

- [ ] **Step 4: Run — expect PASS**; then `npm run test` (full) and `npm run typecheck && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add src/ui/shell src/ui/App.vue src/ui/styles/shell.css tests/component/command-palette.test.ts
git commit -m "feat(ui): command palette (Ctrl/Cmd+K) and snapshot selector in the top bar"
```

---

### Task 9: Overview screen

**Files:**
- Create: `src/ui/screens/OverviewScreen.vue`, `src/ui/screens/overview/InvestigationList.vue`, `src/ui/screens/overview/EvidenceCoveragePanel.vue`
- Modify: `src/ui/App.vue` (route `overview` → `OverviewScreen`), `src/ui/styles/screens.css` (append)
- Test: `tests/component/overview-screen.test.ts`

**Interfaces:**
- Consumes: Task 3 `useReadModels().overview` (`OverviewModel`), Task 5/6 kit, Task 1 `navigate`, copy.
- Produces: `OverviewScreen` (no props). `InvestigationList` props `{ items: readonly Investigation[] }`, emits `open(item: Investigation)`. `EvidenceCoveragePanel` props `{ rows: readonly EvidenceCoverageRow[] }`.

- [ ] **Step 1: Write the failing test** — `tests/component/overview-screen.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import OverviewScreen from '../../src/ui/screens/OverviewScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(files = 30) {
  const snap = buildSnapshotFixture({ files, directories: 3 });
  useCityStore().setCity(snap, computeLayout(snap));
}

const mountOverview = () => mount(OverviewScreen, { global: { provide: { onSelectCodebase: vi.fn() } } });

describe('OverviewScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('asks for a codebase when there is no snapshot', () => {
    const w = mountOverview();
    expect(w.text()).toContain('No snapshot yet');
    expect(w.find('.ci-overview__select-source').exists()).toBe(true);
  });

  it('renders the four signal cards, with architecture unknown rather than 0', () => {
    withSnapshot();
    const w = mountOverview();
    const cards = w.findAll('.ci-metric-card');
    expect(cards).toHaveLength(4);
    expect(cards[2]!.find('.ci-metric-card__value').text()).toBe('—');
  });

  it('labels sample data at page level', () => {
    withSnapshot();
    expect(mountOverview().find('.ci-callout__badge').text()).toBe('Includes sample data');
  });

  it('opening a hotspot row selects the file and shows the city without moving the camera', async () => {
    withSnapshot();
    const store = useCityStore();
    store.navigate('overview');
    const w = mountOverview();
    await w.find('.ci-table__row').trigger('click');
    expect(store.selectedEntityId).not.toBeNull();
    expect(store.route).toBe('city');
    expect(store.camera).toBeNull();
  });

  it('an investigation with a file selects it and follows its route', async () => {
    withSnapshot();
    const store = useCityStore();
    const w = mountOverview();
    await w.find('.ci-investigation').trigger('click');
    expect(store.route).toBe('hotspots');
    expect(store.selectedEntityId).not.toBeNull();
  });

  it('lists evidence coverage including unknown sources', () => {
    withSnapshot();
    const text = mountOverview().find('.ci-evidence-coverage').text();
    expect(text).toContain('Import graph');
    expect(text).toContain('Unknown');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/ui/screens/overview/InvestigationList.vue`:

```vue
<script setup lang="ts">
import type { Investigation } from '../../read-models/overview';
import Icon from '../../kit/Icon.vue';

defineProps<{ items: readonly Investigation[] }>();
const emit = defineEmits<{ open: [item: Investigation] }>();
</script>

<template>
  <ul class="ci-investigations">
    <li
      v-for="item in items"
      :key="item.id"
    >
      <button
        type="button"
        class="ci-investigation"
        @click="emit('open', item)"
      >
        <Icon :name="item.icon" />
        <span class="ci-investigation__text">
          <span class="ci-investigation__title">{{ item.title }}</span>
          <span class="ci-investigation__detail">{{ item.detail }}</span>
        </span>
        <Icon name="chevron-right" />
      </button>
    </li>
  </ul>
</template>
```

`src/ui/screens/overview/EvidenceCoveragePanel.vue`:

```vue
<script setup lang="ts">
import type { EvidenceCoverageRow } from '../../read-models/overview';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ rows: readonly EvidenceCoverageRow[] }>();
</script>

<template>
  <dl class="ci-evidence-coverage">
    <template
      v-for="row in rows"
      :key="row.id"
    >
      <dt>{{ row.label }}</dt>
      <dd>
        <span
          class="ci-evidence-coverage__bar"
          :class="`ci-evidence-coverage__bar--${row.state}`"
        />
        <ProvenanceBadge
          :state="row.state"
          :detail="row.source"
        />
      </dd>
    </template>
  </dl>
</template>
```

`src/ui/screens/OverviewScreen.vue`:

```vue
<script setup lang="ts">
import { inject } from 'vue';
import type { FileSummary } from '../read-models/file-summaries';
import type { Investigation } from '../read-models/overview';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { formatMetric } from '../evidence';
import {
  OVERVIEW_EYEBROW, OVERVIEW_NO_SNAPSHOT, OVERVIEW_SUBTITLE, OVERVIEW_TITLE,
  OVERVIEW_VERDICT_TITLE, SAMPLE_DATA_DETAIL, SAMPLE_DATA_NOTICE,
} from '../inspector-copy';
import { COPY_02 } from '../copy';
import PageHeader from '../kit/PageHeader.vue';
import Callout from '../kit/Callout.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import LineChart from '../kit/LineChart.vue';
import EvidenceTable from '../kit/EvidenceTable.vue';
import type { TableColumn } from '../kit/table-types';
import InvestigationList from './overview/InvestigationList.vue';
import EvidenceCoveragePanel from './overview/EvidenceCoveragePanel.vue';

const store = useCityStore();
const { overview } = useReadModels();
const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});

const columns: readonly TableColumn<FileSummary>[] = [
  { key: 'file', label: 'File', sortValue: (r) => r.path },
  { key: 'complexity', label: 'Complexity', numeric: true, sortValue: (r) => r.complexity.value ?? null },
  { key: 'commits', label: 'Commits / 90d', numeric: true, sortValue: (r) => r.commits90d.value ?? null },
  { key: 'priority', label: 'Priority', numeric: true, sortValue: (r) => r.priority.value ?? null },
];

/** Selecting from any screen goes through the ONE selection owner and never moves the
 *  camera (city-store invariant); showing the city is a separate, explicit navigation. */
function openFile(row: FileSummary): void {
  store.select(row.id);
  store.navigate('city');
  store.openInspector();
}

function openInvestigation(item: Investigation): void {
  if (item.entityId) store.select(item.entityId);
  store.navigate(item.route);
}
</script>

<template>
  <div class="ci-screen ci-screen--overview">
    <PageHeader
      :eyebrow="OVERVIEW_EYEBROW"
      :title="OVERVIEW_TITLE"
      :subtitle="OVERVIEW_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          @click="store.navigate('evolution')"
        >
          Compare
        </button>
        <button
          type="button"
          @click="store.navigate('report')"
        >
          Audit report
        </button>
      </template>
    </PageHeader>

    <div
      v-if="!overview"
      class="ci-overview__empty"
    >
      <p>{{ OVERVIEW_NO_SNAPSHOT }}</p>
      <button
        type="button"
        class="mod-cta ci-overview__select-source"
        @click="onSelectCodebase"
      >
        {{ COPY_02 }}
      </button>
    </div>

    <template v-else>
      <Callout
        :title="OVERVIEW_VERDICT_TITLE"
        :badge="overview.usesSample ? SAMPLE_DATA_NOTICE : undefined"
      >
        {{ overview.cards[3]?.value.value ?? 0 }} change hotspots deserve investigation across {{ overview.fileCount }} files.
        {{ overview.usesSample ? SAMPLE_DATA_DETAIL : '' }}
      </Callout>

      <div class="ci-overview__cards">
        <MetricCard
          v-for="card in overview.cards"
          :key="card.id"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :unit="card.unit"
          :caption="card.caption"
          :trend="card.trend"
          :tone="card.tone"
        />
      </div>

      <div class="ci-overview__grid">
        <Panel
          title="Signals over time"
          subtitle="Compare independent signals, not one opaque health score."
          footnote="Sample trend · branch coverage and file count use different units."
        >
          <template #actions>
            <button
              type="button"
              @click="store.navigate('evolution')"
            >
              View evolution
            </button>
          </template>
          <LineChart
            label="Signals over time"
            :series="overview.series"
          />
        </Panel>
        <Panel
          title="Start investigating"
          subtitle="Three evidence-backed review paths."
        >
          <InvestigationList
            :items="overview.investigations"
            @open="openInvestigation"
          />
        </Panel>
        <Panel
          title="Where change meets complexity"
          subtitle="Priority is a transparent investigation heuristic."
        >
          <template #actions>
            <button
              type="button"
              @click="store.navigate('hotspots')"
            >
              All hotspots
            </button>
          </template>
          <EvidenceTable
            :columns="columns"
            :rows="overview.hotspots"
            :row-key="(r) => r.id"
            caption="Top change hotspots"
            :initial-sort="{ key: 'priority', dir: 'desc' }"
            @activate="openFile"
          >
            <template #cell-file="{ row }">
              <span class="ci-file-cell">
                <span class="ci-file-cell__name">{{ row.name }}</span>
                <span class="ci-file-cell__path">{{ row.path }}</span>
              </span>
            </template>
            <template #cell-complexity="{ row }">
              {{ formatMetric(row.complexity) }}
            </template>
            <template #cell-commits="{ row }">
              {{ formatMetric(row.commits90d) }}
            </template>
            <template #cell-priority="{ row }">
              <span class="ci-priority">{{ formatMetric(row.priority) }} / 100</span>
            </template>
          </EvidenceTable>
        </Panel>
        <Panel
          title="Evidence coverage"
          subtitle="Know what this inspector does — and does not — show."
        >
          <template #actions>
            <button
              type="button"
              @click="store.navigate('sources')"
            >
              Data sources
            </button>
          </template>
          <EvidenceCoveragePanel :rows="overview.coverage" />
        </Panel>
      </div>
    </template>
  </div>
</template>
```

(The four inline button labels and panel titles are prototype-verbatim; if the reviewer prefers, move them into `inspector-copy.ts` — keep the text identical.)

`src/ui/App.vue`: import `OverviewScreen` and add `<OverviewScreen v-else-if="store.route === 'overview'" />` between the city and placeholder branches.

Append to `src/ui/styles/screens.css`:

```css
:where(.codebase-inspector-root) .ci-overview__cards { display: grid; gap: var(--ci-space-4); grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
:where(.codebase-inspector-root) .ci-overview__grid { display: grid; gap: var(--ci-space-4); grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); }
@container (max-width: 900px) {
  :where(.codebase-inspector-root) .ci-overview__grid { grid-template-columns: minmax(0, 1fr); }
}
:where(.codebase-inspector-root) .ci-overview__empty { display: flex; flex-direction: column; align-items: flex-start; gap: var(--ci-space-3); color: var(--ci-text-muted); }

:where(.codebase-inspector-root) .ci-investigations { list-style: none; margin: calc(-1 * var(--ci-space-4)); padding: 0; }
:where(.codebase-inspector-root) .ci-investigations li + li { border-top: 1px solid var(--ci-border); }
:where(.codebase-inspector-root) button.ci-investigation {
  display: flex; align-items: flex-start; gap: var(--ci-space-3); width: 100%; height: auto;
  padding: var(--ci-space-4); border: none; border-radius: 0; background: transparent; box-shadow: none;
  color: var(--ci-text); text-align: left; cursor: pointer;
}
:where(.codebase-inspector-root) button.ci-investigation:hover { background: var(--ci-raised); }
:where(.codebase-inspector-root) .ci-investigation__text { display: flex; flex-direction: column; gap: var(--ci-space-1); flex: 1 1 auto; white-space: normal; }
:where(.codebase-inspector-root) .ci-investigation__title { font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-investigation__detail { color: var(--ci-text-muted); font-size: var(--font-ui-small); }

:where(.codebase-inspector-root) .ci-evidence-coverage { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--ci-space-3) var(--ci-space-4); margin: 0; }
:where(.codebase-inspector-root) .ci-evidence-coverage dt { color: var(--ci-text); }
:where(.codebase-inspector-root) .ci-evidence-coverage dd { display: flex; align-items: center; gap: var(--ci-space-3); margin: 0; }
:where(.codebase-inspector-root) .ci-evidence-coverage__bar { flex: 1 1 auto; height: 6px; border-radius: 3px; background: var(--ci-border); }
:where(.codebase-inspector-root) .ci-evidence-coverage__bar--collected { background: var(--ci-tone-success); }
:where(.codebase-inspector-root) .ci-evidence-coverage__bar--partial { background: var(--ci-warning); }
:where(.codebase-inspector-root) .ci-evidence-coverage__bar--sample { background: var(--ci-sample); opacity: 0.7; }

:where(.codebase-inspector-root) .ci-file-cell { display: flex; flex-direction: column; }
:where(.codebase-inspector-root) .ci-file-cell__name { font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-file-cell__path { color: var(--ci-text-faint); font-family: var(--ci-font-mono); font-size: var(--font-ui-smaller); }
:where(.codebase-inspector-root) .ci-priority {
  padding: 2px var(--ci-space-2); border-radius: var(--ci-radius-small);
  color: var(--ci-tone-danger); background: var(--background-modifier-error);
}
```

- [ ] **Step 4: Run — expect PASS**; `npm run typecheck && npm run lint && npx vitest run tests/component`

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens src/ui/App.vue src/ui/styles/screens.css tests/component/overview-screen.test.ts
git commit -m "feat(ui): Overview screen on real inventory with labelled sample signals"
```

---

### Task 10: City screen frame, summary cards and "Add to refactor plan"

**Files:**
- Modify: `src/ui/screens/CityScreen.vue`, `src/ui/components/FileInspector.vue`, `src/ui/styles/screens.css` (append)
- Create: `src/ui/screens/city/CitySummaryCards.vue`
- Test: `tests/component/city-screen.test.ts`; extend `tests/component/file-inspector.test.ts` (one new `it`)

**Interfaces:**
- Consumes: Task 3 `useReadModels().citySummary` (`CitySummaryCard[]`), Task 4 `useReviewStore`, Task 5 `PageHeader`, copy.
- Produces: `CitySummaryCards` (no props) emitting nothing — cards navigate via the store.

- [ ] **Step 1: Write the failing tests**

`tests/component/city-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CityScreen from '../../src/ui/screens/CityScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

describe('CityScreen', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const snap = buildSnapshotFixture({ files: 12 });
    useCityStore().setCity(snap, computeLayout(snap));
  });

  const mountCity = () => mount(CityScreen, { global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });

  it('frames the unchanged city composition with a page header', () => {
    const w = mountCity();
    expect(w.find('h2').text()).toBe('Code city');
    expect(w.find('.ci-app').exists()).toBe(true);
  });

  it('shows three summary cards; cycles is unknown, never 0', () => {
    const w = mountCity();
    const cards = w.findAll('.ci-city-summary__card');
    expect(cards).toHaveLength(3);
    expect(cards[1]!.find('.ci-city-summary__value').text()).toBe('—');
  });

  it('a summary card navigates to its screen', async () => {
    const w = mountCity();
    await w.findAll('.ci-city-summary__card')[0]!.trigger('click');
    expect(useCityStore().route).toBe('hotspots');
  });

  it('"View inventory" switches the city to its list view', async () => {
    const w = mountCity();
    await w.find('.ci-city-screen__inventory').trigger('click');
    expect(useCityStore().viewMode).toBe('list');
  });
});
```

Add to `tests/component/file-inspector.test.ts` inside its `describe` (imports: `useReviewStore` from `'../../src/ui/stores/review-store'`):

```ts
  it('adds the selected file to the refactor plan once', async () => {
    const { target } = openWithFile();
    const wrapper = mountInspector();
    const add = wrapper.find('[aria-label="Add to refactor plan"]');
    await add.trigger('click');
    await nextTick();
    expect(useReviewStore().hasWorkItemFor(target.id)).toBe(true);
    expect(wrapper.find('[aria-label="Add to refactor plan"]').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('In refactor plan');
  });
```

(`tests/component/file-inspector.test.ts` must stay ≤ 450 lines; if adding this pushes it over, put the test in `tests/component/file-inspector-plan.test.ts` with a copy of the file's `makeRendererDouble`/`openWithFile`/`mountInspector` helpers instead.)

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

`src/ui/screens/city/CitySummaryCards.vue`:

```vue
<script setup lang="ts">
import { formatMetric } from '../../evidence';
import { useReadModels } from '../../read-models/use-read-models';
import { useCityStore } from '../../stores/city-store';
import Icon from '../../kit/Icon.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

const store = useCityStore();
const { citySummary } = useReadModels();
</script>

<template>
  <div class="ci-city-summary">
    <button
      v-for="card in citySummary"
      :key="card.id"
      type="button"
      class="ci-city-summary__card"
      @click="store.navigate(card.route)"
    >
      <span class="ci-city-summary__value">{{ formatMetric(card.value) }}</span>
      <span class="ci-city-summary__text">
        <span class="ci-city-summary__title">{{ card.title }}
          <ProvenanceBadge
            v-if="card.value.state !== 'collected'"
            :state="card.value.state"
          />
        </span>
        <span class="ci-city-summary__caption">{{ card.value.reason ?? card.caption }}</span>
      </span>
      <Icon name="arrow-right" />
    </button>
  </div>
</template>
```

`src/ui/screens/CityScreen.vue` (replace the Task 7 pass-through):

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { CITY_EYEBROW, CITY_SUBTITLE, CITY_TITLE } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';
import PageHeader from '../kit/PageHeader.vue';
import Icon from '../kit/Icon.vue';
import CityWorkspace from './CityWorkspace.vue';
import CitySummaryCards from './city/CitySummaryCards.vue';

const store = useCityStore();
interface WorkspaceExposed { rendererHost: HTMLElement | null }
const workspace = ref<WorkspaceExposed | null>(null);
const rendererHost = computed(() => workspace.value?.rendererHost ?? null);
defineExpose({ rendererHost });
</script>

<template>
  <div class="ci-screen ci-screen--city">
    <div class="ci-city-screen__header">
      <PageHeader
        :eyebrow="CITY_EYEBROW"
        :title="CITY_TITLE"
        :subtitle="CITY_SUBTITLE"
      >
        <template #actions>
          <button
            type="button"
            class="ci-city-screen__inventory"
            @click="store.setViewMode('list')"
          >
            <Icon name="list" />
            View inventory
          </button>
        </template>
      </PageHeader>
    </div>
    <CityWorkspace ref="workspace" />
    <CitySummaryCards v-if="store.snapshot" />
  </div>
</template>
```

"Compare snapshots" from the prototype header is omitted until snapshot history exists (spec §9 A4).

`src/ui/components/FileInspector.vue`:
- imports: `useReviewStore` from `'../stores/review-store'`; `ADD_TO_PLAN_LABEL, IN_PLAN_LABEL` from `'../inspector-copy'`.
- script:

```ts
const review = useReviewStore();
const inPlan = computed(() => (store.selectedEntityId ? review.hasWorkItemFor(store.selectedEntityId) : false));

/** WP-02: records intent only. Never edits, opens or executes anything in the source. */
async function addToPlan(): Promise<void> {
  const entity = selectedEntity.value;
  if (!entity) return;
  await review.addWorkItemForFile(entity.id, `Investigate ${entity.name}`, new Date());
}
```

- template, as a third button inside `.ci-inspector__actions`:

```vue
      <button
        type="button"
        :aria-label="ADD_TO_PLAN_LABEL"
        :disabled="inPlan"
        @click="addToPlan"
      >
        {{ inPlan ? IN_PLAN_LABEL : ADD_TO_PLAN_LABEL }}
      </button>
```

- update the header comment's "Offers exactly two actions … Focus and Copy relative path." to "Offers Focus, Copy relative path and (WP-02) Add to refactor plan — the last records intent in the review store and never touches the source."

Append to `src/ui/styles/screens.css`:

```css
:where(.codebase-inspector-root) .ci-city-screen__header { padding: var(--ci-space-5) var(--ci-space-6) 0; }
:where(.codebase-inspector-root) .ci-city-summary {
  display: grid; gap: var(--ci-space-3); grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  padding: 0 var(--ci-space-4) var(--ci-space-4);
}
:where(.codebase-inspector-root) button.ci-city-summary__card {
  display: flex; align-items: center; gap: var(--ci-space-3); height: auto;
  padding: var(--ci-space-4); border: 1px solid var(--ci-border); border-radius: var(--ci-radius-card);
  background: var(--ci-panel); box-shadow: none; color: var(--ci-text); text-align: left; cursor: pointer;
}
:where(.codebase-inspector-root) button.ci-city-summary__card:hover { background: var(--ci-raised); }
:where(.codebase-inspector-root) .ci-city-summary__value { font-size: 1.5em; font-weight: var(--font-semibold); color: var(--ci-action); }
:where(.codebase-inspector-root) .ci-city-summary__text { display: flex; flex-direction: column; flex: 1 1 auto; white-space: normal; }
:where(.codebase-inspector-root) .ci-city-summary__title { display: flex; gap: var(--ci-space-2); align-items: center; font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-city-summary__caption { color: var(--ci-text-muted); font-size: var(--font-ui-smaller); }
```

- [ ] **Step 4: Run — expect PASS**; then full `npm run test`, `npm run typecheck && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens src/ui/components/FileInspector.vue src/ui/styles/screens.css tests/component/city-screen.test.ts tests/component/file-inspector*.test.ts
git commit -m "feat(ui): city screen frame with summary cards; add a file to the refactor plan"
```

---

### Task 11: Route-aware harness shots and final verification

**Files:**
- Modify: `tests/harness/page.ts`, `tests/harness/mount.ts`, `scripts/harness-shot.mjs`
- Test: `tests/harness/harness.test.ts` must still pass; `tests/build/harness-shot.test.ts` must still pass.

**Interfaces:**
- Consumes: Task 1 `isRouteId`, `navigate`.
- Produces: `?route=<RouteId>` harness parameter; `HarnessOptions.route?: RouteId`.

- [ ] **Step 1: Harness accepts a route**

`tests/harness/page.ts`: add to the header comment `//   ?route=<id>        which inspector screen (default: city)`, then:

```ts
import { isRouteId } from '../../src/domain/route-ids';
// ...
const askedRoute = params.get('route');
const route = isRouteId(askedRoute) ? askedRoute : 'city';
// ...
void mountHarness(leaf, { screen, route });
```

`tests/harness/mount.ts`:
- `import type { RouteId } from '../../src/domain/route-ids';`
- `export interface HarnessOptions { screen: ScreenId; route?: RouteId }`
- after `applyScreenState(store, options.screen);` add:

```ts
  const route = options.route ?? 'city';
  store.navigate(route);
  if (route !== 'city') {
    // Only the city route creates a renderer; every other screen is plain DOM and is
    // drawn once Vue has flushed.
    await nextTick();
    document.body.dataset.ciHarnessReady = 'true';
    return;
  }
```

(the existing theme listener and `waitUntilDrawn` stay after this early return, for the city).

`scripts/harness-shot.mjs` — append to `SHOTS` (before the closing `]`):

```js
  // WP-02 Part 1: the shell around the city, and the Overview, for side-by-side review
  // against docs/concept/prototype/screenshots/{city,overview}-{dark,light}.png.
  { id: 'wp02-city-dark', query: '?screen=s05&theme=dark&route=city' },
  { id: 'wp02-overview-dark', query: '?screen=s05&theme=dark&route=overview' },
  { id: 'wp02-overview-light', query: '?screen=s05&theme=light&route=overview' },
  { id: 'wp02-overview-narrow-dark', query: '?screen=s10&theme=dark&route=overview&width=700', viewport: { width: 760, height: 900 } },
```

If `tests/build/harness-shot.test.ts` pins the `SHOTS` count or ids, extend its expectation with these four ids.

- [ ] **Step 2: Run the harness checks**

Run: `npx vitest run tests/harness tests/build/harness-shot.test.ts`

- [ ] **Step 3: Capture and look**

Run: `npm run harness-shot` — then open `harness-shots/wp02-*.png` next to `docs/concept/prototype/screenshots/overview-dark.png` and `city-dark.png`. Check: nav column present and grouped; breadcrumb; Overview cards/panels laid out in two columns at 1280 px and one column in the narrow shot; the city still fills its stage with its summary cards below. Icons are blank in the harness (the Obsidian mock's `setIcon` draws nothing) — expected. Record anything visibly broken and fix it before continuing.

- [ ] **Step 4: Full verification**

Run: `npm run verify` — expected exit 0 (typecheck, oxlint, eslint, all tests, build + bundle assertion).

- [ ] **Step 5: Commit**

```bash
git add tests/harness scripts/harness-shot.mjs tests/build/harness-shot.test.ts
git commit -m "test(harness): route-aware harness and WP-02 shell/overview captures"
```

---

## Self-review notes

- **Spec coverage:** §4.1 shell → Tasks 7-8; §4.2 kit → Tasks 5-6; §4.3 Overview → Task 9, City → Task 10; §4.4 read models/sample → Tasks 2-3; §4.5 stores/ports → Tasks 1, 4; §4.6 view state → Task 1; §6 states → MetricValue rendering (Tasks 5, 9, 10), Overview no-snapshot state (Task 9), city states unchanged (Task 7); §7 testing → every task + Task 11. Deviations are recorded in the spec's §9.
- **Types used across tasks:** `MetricValue`, `FileSummary`, `OverviewModel`, `CitySummaryCard`, `RouteId`, `WorkItem`, `TableColumn<T>`, `PaletteItem` are each defined once (Tasks 1-8) and consumed with the same names.
