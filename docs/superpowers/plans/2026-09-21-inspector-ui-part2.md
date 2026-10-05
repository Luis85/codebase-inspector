# WP-02 Part 2 — Architecture, Hotspots, File detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Architecture, Hotspots and File-detail placeholders with working screens built from the prototype. Along the way, land the Part 1 deferrals A11–A13 and five deferred minors.

**Architecture:** This builds on Part 1's shell unchanged:
- Screens read read models only (`src/ui/read-models/`).
- Every value is a `MetricValue`.
- `city-store` owns selection and route.
- Review decisions go through `ReviewRepository`.

New sample providers live in `src/ui/fixtures/`, and new pure builders sit next to the existing ones. Aggregates become evidence-aware (A13) before any new screen uses them.

**Tech Stack:** TypeScript, Vue 3.5 (`<script setup>`, `defineModel`), Pinia 4, Vitest 5 + @vue/test-utils (jsdom), plain CSS under `:where(.codebase-inspector-root)`, hand-rolled SVG. There is no chart library.

**Spec:** `docs/superpowers/specs/2026-09-21-inspector-ui-part2-design.md` (decisions P1–P13). It sits on top of `docs/superpowers/specs/2026-09-21-inspector-ui-shell-design.md`, whose §9 amendments A1–A13 are binding.

**Branch:** `feat/wp-02-part2` (from `feat/wp-01-codebase-city` at e0440c1). **Not stacked:** at the end, Part 2 lands on the existing PR #1 (`feat/wp-01-codebase-city`). The integration step is the user's choice.

## Global Constraints

**Size**
- `src/**/*.{ts,vue}` max **400** lines. `tests/**/*.ts` max **450** lines.
- `src/host/city-view.ts` is at 399/400: **add nothing to it**.
- `src/ui/screens/CityWorkspace.vue` is at ~386: **do not grow it**.

**Browser globals**
- No bare `window`, `document`, `setTimeout`, `ResizeObserver`, `matchMedia`, `getComputedStyle`, `localStorage` in `src/ui/**` (eslint `no-restricted-globals`).
- Use `el.ownerDocument`, `el.ownerDocument.defaultView`, `nextTick`.
- Never `x instanceof HTMLElement`; always `x.instanceOf(HTMLElement)`, because pop-out windows are separate realms.
- Listeners go on the leaf/shell root or on component elements, **never the document**. Two leaves must not cross-talk.
- Element ids must be unique across leaves: use `useUniqueId()` from `src/ui/unique-id.ts` (Task 6), which is `useId()` plus a module counter.

**Evidence**
- Absent evidence is never rendered or exported as `0`. It is a `MetricValue` with `state: 'unknown'` and a `reason`.
- No composite health score.
- Sample values are always labelled (`ProvenanceBadge` / `isSampleBacked`).
- Module edges are **sample** `source-import` edges and are labelled as such. City arcs are never dependency claims.
- `city-store` invariants are unchanged: `select` never moves the camera; do not modify `select`, `setQuery`, `setCamera`.

**Copy and CSS**
- Every new visible string goes in `src/ui/inspector-copy.ts`, **never** `src/ui/copy.ts` (bound to the WP-01 microcopy catalogue). Existing `copy.ts` exports such as `COPY_02` and `COPY_27` may be *imported*.
- CSS lives only in `src/ui/styles/{kit,shell,screens}.css`, under `:where(.codebase-inspector-root)`, with BEM `ci-*` classes and colours only through `--ci-*` tokens (reading Obsidian `var(--…)` is fine; never redefine `--background-*`, `--text-*`, `--interactive-*`).
- Every `var(--font-ui-*)` carries an em fallback: `smaller → 0.8em`, `small → 0.9em`, `medium → 1em`, `large → 1.15em`.
- **Never edit `src/ui/styles.css`** (tests parse it). No Vue `<style>` blocks.
- Import the kit dialog as `CiDialog` (`import CiDialog from '../kit/Dialog.vue'`). The eslint rule `vue/no-reserved-component-names` rejects `Dialog`.

**Test infrastructure**
- jsdom stubs load through vitest `setupFiles`, **not** the obsidian mock. Component tests that open a `CiDialog` also `import '../mocks/obsidian'` (for `instanceOf`), as `kit-interactive.test.ts` does.
- The harness (`npm run harness` / `npm run harness-shot`, real Chromium) must keep drawing the city. `tests/unit/obsidian-mock-scope.test.ts` guards this.
- Edit files only with the Edit/Write tools. **Never `sed -i`**: it rewrites CRLF files on Windows.

**Gates and commits**
- Per-task gate: `npm run typecheck && npm run lint:fast && npx vitest run <the task's test files>`. Run eslint too: `npx eslint <touched files> --max-warnings 0`.
- **The WP-01 evidence-note counts are updated ONCE, in Task 11.** Before that, `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` are expected to fail on file counts. Do not run the full suite per task, and do not "fix" those two tests.
- `tests/unit/install-script.test.ts` fails in any worktree without `.obsidian/`. This is environmental: report it and do not fix it.
- Commit after each task. Every message ends with a blank line and `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

**Process**
- Implementers never spawn subagents. They report back: files changed, test output, any deviation from this plan, and why.
- The controller records every ruling in `docs/superpowers/notes/2026-09-21-wp02-part2-ledger.md`.

## File map

| File | Status | Task | Responsibility |
|---|---|---|---|
| `src/ui/evidence.ts` | modify | 1 | `aggregate`, `sumEvidence`, `countEvidence`, `ratioEvidence`, `isSampleBacked` |
| `src/ui/read-models/file-summaries.ts` | modify | 1 | `priorityEvidence`, `byPriority`, `ROOT_MODULE`, `moduleLabel` |
| `src/ui/read-models/overview.ts` | modify | 1, 3 | evidence-aware aggregates; `trendLabels`/`TREND_POINTS` exported; cycles input |
| `src/ui/read-models/city-summary.ts` | modify | 1, 3 | evidence-aware; cycles input |
| `src/ui/stores/ports/review-repository.ts` | modify | 2 | `BoundaryRule`, rule methods |
| `src/ui/stores/review-store.ts` | modify | 2 | rules, `addRule`/`removeRule`, pending-aware `load` |
| `src/ui/fixtures/sample-module-edges.ts` | create | 3 | seeded sample module edges |
| `src/ui/read-models/architecture.ts` | create | 3 | modules, graph, SCC, rule evaluation, matrix, cards |
| `src/ui/read-models/use-read-models.ts` | modify | 3, 5 | exposes `architecture`, `fileDetail`, `filesUseSample` |
| `src/ui/read-models/hotspots.ts` | create | 4 | filtered rows, plotted points, shortlist, CSV |
| `src/ui/export/download.ts` | create | 4 | `downloadText` through the leaf's document |
| `src/ui/kit/EvidenceTable.vue` | modify | 4 | optional `limit` prop |
| `src/ui/fixtures/sample-findings.ts` | create | 5 | seeded sample findings per file |
| `src/ui/read-models/file-detail.ts` | create | 5 | File-detail model |
| `src/ui/unique-id.ts` | create | 6 | cross-leaf unique ids |
| `src/ui/kit/Tabs.vue`, `src/ui/kit/tab-types.ts` | create | 6 | roving-tabindex tablist |
| `src/ui/screens/NoSnapshot.vue` | create | 6 | shared "no snapshot" state |
| `src/ui/screens/ArchitectureScreen.vue` | create | 6, 7 | Architecture screen |
| `src/ui/screens/architecture/{map-layout.ts,ModuleMap.vue,DependencyMatrix.vue,ModuleInspector.vue}` | create | 6 | map, matrix, module inspector |
| `src/ui/screens/architecture/{BoundaryRuleTable.vue,RuleEditor.vue,BoundaryInspector.vue}` | create | 7 | rules UI |
| `src/ui/screens/HotspotsScreen.vue` + `hotspots/{HotspotScatter,PriorityList,HotspotTable,PriorityFormulaDialog}.vue` | create | 8 | Hotspots |
| `src/ui/screens/FileDetailScreen.vue` + `file/{FileHeader,SourceContextPanel,FileFindingsPanel,FileWorkItemsPanel}.vue` | create | 9 | File detail |
| `src/ui/components/FileInspector.vue`, `src/ui/shell/CommandPalette.vue`, `src/ui/screens/OverviewScreen.vue` | modify | 9 | paths into File detail |
| `src/ui/App.vue` | modify | 6, 8, 9, 10 | route outlet, drawer scrim |
| `src/ui/shell/use-route-provenance.ts` | create | 10 | A11 flag per route |
| `src/ui/shell/TopBar.vue`, `NavColumn.vue` | modify | 10 | A11 badge, copy, A12 focus wrap |
| `src/ui/inspector-copy.ts` | modify | 1–10 | strings |
| `src/ui/styles/{kit,shell,screens}.css` | modify | 6–10 | styles |
| `tests/harness/{page.ts,mount.ts}`, `scripts/harness-shot.mjs` | modify | 11 | `?select=`, new shots |
| `docs/superpowers/notes/2026-09-17-wp01-{gate-evidence,implementation-report}.md` | modify | 11 | derived counts |

---

### Task 1: Evidence-aware aggregation (A13) and the root-module label

**Files:**
- Modify: `src/ui/evidence.ts`, `src/ui/read-models/file-summaries.ts`, `src/ui/read-models/overview.ts`, `src/ui/read-models/city-summary.ts`, `src/ui/inspector-copy.ts`
- Test: `tests/unit/evidence.test.ts`, `tests/unit/read-models.test.ts`

**Interfaces:**
- Produces (evidence.ts):
  - `aggregate<T>(inputs: readonly MetricValue[], compute: (present: readonly number[]) => T, emptyReason?: string): MetricValue<T>`
  - `sumEvidence(inputs, emptyReason?)`
  - `countEvidence(inputs, predicate: (v: number) => boolean, emptyReason?)`
  - `ratioEvidence(numerator: MetricValue, denominator: MetricValue, scale = 100): MetricValue`
  - `isSampleBacked(m: MetricValue<unknown>): boolean`
- Produces (file-summaries.ts):
  - `ROOT_MODULE = '(root)'`
  - `moduleLabel(module: string): string`
  - `byPriority(a: FileSummary, b: FileSummary): number` (unknown priority sorts last)
  - `priorityEvidence(complexity, commits90d, covered, total): MetricValue`
- Produces (overview.ts): exported `TREND_POINTS`, `trendLabels(capturedAt: string): string[]`, and `buildOverviewModel(snapshot, files, cycles?: MetricValue)`
- Produces (city-summary.ts): `buildCitySummary(files, cycles?: MetricValue)`
- Produces (copy): `NO_FILES_REASON`, `IMPORT_GRAPH_UNKNOWN_REASON`, `PRIORITY_UNKNOWN_REASON`, `ROOT_FILES_LABEL`, `PROTECT_MODULE_TITLE`, `OVERVIEW_ARCH_CAPTION`

- [ ] **Step 1: Write the failing tests.** Append to `tests/unit/evidence.test.ts`, and extend its first import line to `import { collected, countEvidence, formatMetric, hasValue, isSampleBacked, ratioEvidence, sample, sumEvidence, unknown, type MetricValue } from '../../src/ui/evidence';`:

```ts
describe('evidence-aware aggregation (A13)', () => {
  const stale = (v: number): MetricValue => ({ state: 'stale', value: v, provenance: { source: 'sample' } });
  const partial = (v: number): MetricValue => ({ state: 'partial', value: v, provenance: { source: 'sample' }, reason: '1 of 2 inputs missing.' });

  it('no inputs is unknown with the caller\'s reason', () => {
    const m = sumEvidence([], 'No files in this scan.');
    expect(m.state).toBe('unknown');
    expect(m.value).toBeUndefined();
    expect(m.reason).toBe('No files in this scan.');
  });
  it('all collected stays collected and keeps the shared source', () => {
    expect(sumEvidence([collected(2, 'inventory'), collected(3, 'inventory')]))
      .toEqual({ state: 'collected', value: 5, provenance: { source: 'inventory' } });
  });
  it('takes the weakest state when every input has a value', () => {
    expect(sumEvidence([collected(1, 'inventory'), sample(2)]).state).toBe('sample');
    expect(sumEvidence([sample(1), stale(2)]).state).toBe('stale');
    expect(sumEvidence([stale(1), partial(2)]).state).toBe('partial');
  });
  it('is partial over the present inputs when some lack a value — a missing input is never 0', () => {
    expect(sumEvidence([sample(4), unknown('x'), sample(6)]))
      .toMatchObject({ state: 'partial', value: 10, reason: '1 of 3 inputs missing.' });
  });
  it('is unknown, keeping the first reason, when no input has a value', () => {
    const m = sumEvidence([unknown('not measured'), unknown('y')]);
    expect(m.state).toBe('unknown');
    expect(m.value).toBeUndefined();
    expect(m.reason).toBe('not measured');
  });
  it('collapses mixed sources to "aggregate"', () => {
    expect(sumEvidence([collected(1, 'inventory'), sample(1)]).provenance.source).toBe('aggregate');
  });
  it('counts only values passing the predicate', () => {
    expect(countEvidence([sample(10), sample(70), sample(90)], (v) => v >= 65).value).toBe(2);
  });
  it('ratio needs both sides and a non-zero denominator', () => {
    expect(ratioEvidence(sample(1), sample(4)).value).toBe(25);
    expect(ratioEvidence(sample(1), unknown('no total')).reason).toBe('no total');
    expect(ratioEvidence(sample(0), sample(0)).state).toBe('unknown');
    expect(ratioEvidence(partial(1), sample(2))).toMatchObject({ state: 'partial', value: 50, reason: '1 of 2 inputs missing.' });
  });
  it('recognises sample-backed values by state or by provenance', () => {
    expect(isSampleBacked(sample(1))).toBe(true);
    expect(isSampleBacked(partial(1))).toBe(true);
    expect(isSampleBacked(collected(1, 'inventory'))).toBe(false);
  });
});
```

In `tests/unit/read-models.test.ts`, change the imports to:

```ts
import { unknown, sample } from '../../src/ui/evidence';
import { fileSummariesFor, moduleLabel, moduleOf, priorityEvidence, priorityScore } from '../../src/ui/read-models/file-summaries';
```

Add to `describe('file summaries')`:

```ts
  it('labels the root module "Root files"', () => {
    expect(moduleLabel('(root)')).toBe('Root files');
    expect(moduleLabel('src')).toBe('src');
  });

  it('makes priority unknown when any input lacks a value (A13)', () => {
    expect(priorityEvidence(sample(10), unknown('x'), sample(1), sample(2)).state).toBe('unknown');
    expect(priorityEvidence(sample(24), sample(22), sample(1), sample(2)))
      .toMatchObject({ state: 'sample', value: 50, provenance: { source: 'sample', detail: 'sample heuristic' } });
  });
```

Add to `describe('overview model')`:

```ts
  it('never names the "(root)" module in investigation copy', () => {
    const rootOnly = buildSnapshotFixture({ files: 6 });
    expect(buildOverviewModel(rootOnly, fileSummariesFor(rootOnly)).investigations[1]?.title).toBe('Protect the root files');
  });

  it('makes branch coverage partial, not a smaller whole, when a file lacks coverage (A13)', () => {
    const s = buildSnapshotFixture({ files: 4 });
    const withGap = fileSummariesFor(s).map((f, i) => (i === 0
      ? { ...f, branchesCovered: unknown('no report'), branchesTotal: unknown('no report') } : f));
    expect(buildOverviewModel(s, withGap).cards.find((c) => c.id === 'coverage')?.value.state).toBe('partial');
  });

  it('uses the cycles value it is given for the architecture card', () => {
    const arch = buildOverviewModel(snap, files, sample(2)).cards.find((c) => c.id === 'architecture');
    expect(arch?.value).toMatchObject({ state: 'sample', value: 2 });
  });
```

In the existing test `'tones each series by what it is, not by its position'`, the empty snapshot now has **no** series, because the high-complexity count is unknown without files. Change its last assertion to `expect(m.series).toEqual([]);`.

- [ ] **Step 2: Run the tests and confirm they fail.**
Run: `npx vitest run tests/unit/evidence.test.ts tests/unit/read-models.test.ts`
Expected: FAIL (`sumEvidence` is not exported, `moduleLabel` is not exported, …).

- [ ] **Step 3: Add the copy.** Append to `src/ui/inspector-copy.ts`:

```ts
/** Part 2 §4 (A13): reasons that used to be inline literals in the read models. */
export const NO_FILES_REASON = 'No files in this scan.';
export const IMPORT_GRAPH_UNKNOWN_REASON = 'Import graph not collected yet.';
export const PRIORITY_UNKNOWN_REASON = 'Priority needs complexity, commits and branch coverage.';
/** Part 2 P1: files at the root form one module, never shown as "(root)". */
export const ROOT_FILES_LABEL = 'Root files';
export const PROTECT_MODULE_TITLE = (label: string, isRoot: boolean): string =>
  (isRoot ? 'Protect the root files' : `Protect the ${label} module`);
export const OVERVIEW_ARCH_CAPTION = 'Cyclic module groups · sample edges';
```

- [ ] **Step 4: Implement the aggregation helpers.** Append to `src/ui/evidence.ts`:

```ts
/** States that carry a value, strongest first. An aggregate takes the WEAKEST state
 *  among its inputs (Part 2 §4, A13): partial > stale > sample > collected. */
const WITH_VALUE: readonly EvidenceState[] = ['collected', 'sample', 'stale', 'partial'];

function weakest(states: readonly EvidenceState[]): EvidenceState {
  return states.reduce<EvidenceState>((w, s) => (WITH_VALUE.indexOf(s) > WITH_VALUE.indexOf(w) ? s : w), 'collected');
}

function sharedSource(inputs: readonly MetricValue<unknown>[]): string {
  const first = inputs[0]?.provenance.source ?? 'aggregate';
  return inputs.every((m) => m.provenance.source === first) ? first : 'aggregate';
}

type Present = MetricValue & { value: number };

/** Spec §9 A13: one value computed from many. No inputs, or no input with a value, is
 *  `unknown`. Some inputs without a value is `partial`: the value covers only the present
 *  inputs, and the reason says how many are missing. A missing input is never counted
 *  as 0. */
export function aggregate<T>(
  inputs: readonly MetricValue[], compute: (present: readonly number[]) => T,
  emptyReason = 'Nothing to aggregate.',
): MetricValue<T> {
  if (inputs.length === 0) return unknown<T>(emptyReason);
  const present = inputs.filter((m): m is Present => hasValue(m));
  if (present.length === 0) return unknown<T>(inputs[0]?.reason ?? 'No input has a value.');
  const value = compute(present.map((m) => m.value));
  const provenance = { source: sharedSource(present) };
  if (present.length < inputs.length) {
    return { state: 'partial', value, provenance, reason: `${inputs.length - present.length} of ${inputs.length} inputs missing.` };
  }
  return { state: weakest(present.map((m) => m.state)), value, provenance };
}

export function sumEvidence(inputs: readonly MetricValue[], emptyReason?: string): MetricValue {
  return aggregate(inputs, (vs) => vs.reduce((a, b) => a + b, 0), emptyReason);
}

export function countEvidence(inputs: readonly MetricValue[], predicate: (value: number) => boolean, emptyReason?: string): MetricValue {
  return aggregate(inputs, (vs) => vs.filter(predicate).length, emptyReason);
}

/** Rounded `numerator / denominator × scale`. Both sides must have a value, and a zero
 *  denominator is unknown, never a 0 %. */
export function ratioEvidence(numerator: MetricValue, denominator: MetricValue, scale = 100): MetricValue {
  if (!hasValue(numerator)) return unknown(numerator.reason ?? 'Numerator unavailable.');
  if (!hasValue(denominator)) return unknown(denominator.reason ?? 'Denominator unavailable.');
  if (denominator.value === 0) return unknown('Nothing to divide by.');
  const reason = [numerator, denominator].find((m) => m.state === 'partial')?.reason;
  const result: MetricValue = {
    state: weakest([numerator.state, denominator.state]),
    value: Math.round((numerator.value / denominator.value) * scale),
    provenance: { source: sharedSource([numerator, denominator]) },
  };
  return reason === undefined ? result : { ...result, reason };
}

/** True when a value rests on sample data, even when aggregation made it partial. */
export function isSampleBacked(m: MetricValue<unknown>): boolean {
  return m.state === 'sample' || m.provenance.source === 'sample';
}
```

- [ ] **Step 5: file-summaries.ts.** Change the evidence import to `import { aggregate, collected, hasValue, sample, unknown, type MetricValue } from '../evidence';` and add `import { PRIORITY_UNKNOWN_REASON, ROOT_FILES_LABEL } from '../inspector-copy';`. Replace `moduleOf` with the block below, and add the new functions after `priorityScore`:

```ts
export const ROOT_MODULE = '(root)';

export function moduleOf(path: string): string {
  const slash = path.indexOf('/');
  return slash > 0 ? path.slice(0, slash) : ROOT_MODULE;
}

/** Part 2 P1: what a module is called on screen. */
export function moduleLabel(module: string): string {
  return module === ROOT_MODULE ? ROOT_FILES_LABEL : module;
}
```

```ts
/** A13: the heuristic only when every input has a value; otherwise unknown, never a
 *  score computed from a stand-in 0. */
export function priorityEvidence(complexity: MetricValue, commits90d: MetricValue, covered: MetricValue, total: MetricValue): MetricValue {
  if (!hasValue(complexity) || !hasValue(commits90d) || !hasValue(covered) || !hasValue(total) || total.value === 0) {
    return unknown(PRIORITY_UNKNOWN_REASON);
  }
  const score = priorityScore(complexity.value, commits90d.value, covered.value / total.value);
  const m = aggregate([complexity, commits90d, covered, total], () => score);
  return { ...m, provenance: { ...m.provenance, detail: 'sample heuristic' } };
}

/** Sort order only, never displayed: highest priority first, unknown last, then path. */
const rank = (m: MetricValue): number => m.value ?? -Infinity;
export function byPriority(a: FileSummary, b: FileSummary): number {
  return rank(b.priority) - rank(a.priority) || a.path.localeCompare(b.path);
}
```

In `build`, replace the `priority:` line with:

```ts
      priority: priorityEvidence(sample(s.complexity), sample(s.commits90d), sample(s.branchesCovered), sample(s.branchesTotal)),
```

Also delete the now-unused `const ratio` line, and change `branchCoverage` to `sample(Math.round((s.branchesCovered / s.branchesTotal) * 100))`.

- [ ] **Step 6: Rewrite overview.ts's aggregates.** Replace the top of the file down to the end of `buildOverviewModel` with this code. `OverviewCard`, `TrendSeries`, `Investigation`, `EvidenceCoverageRow` and `OverviewModel` stay exactly as they are:

```ts
// WP-02 spec §4.3: the Overview screen's read model. No composite health score.
// Part 2 §4 (A13): every aggregate goes through evidence.ts, so a missing input makes the
// result partial or unknown — never a silent 0.
import type { CodebaseSnapshot } from '../../domain/model';
import type { EntityId } from '../../domain/entity-id';
import type { RouteId } from '../../domain/route-ids';
import {
  countEvidence, formatMetric, hasValue, isSampleBacked, ratioEvidence, sumEvidence, unknown,
  type EvidenceState, type MetricValue,
} from '../evidence';
import { sampleTrend } from '../fixtures/sample-signals';
import { IMPORT_GRAPH_UNKNOWN_REASON, NO_FILES_REASON, OVERVIEW_ARCH_CAPTION, PROTECT_MODULE_TITLE } from '../inspector-copy';
import { byPriority, moduleLabel, ROOT_MODULE, type FileSummary } from './file-summaries';

export const HOTSPOT_THRESHOLD = 65;
export const HIGH_COMPLEXITY = 30;
export const TREND_POINTS = 7;
const TREND_SPACING_DAYS = 14;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
```

Keep the interface declarations here unchanged, then continue:

```ts
export function trendLabels(capturedAt: string): string[] {
  const end = new Date(capturedAt).getTime();
  return Array.from({ length: TREND_POINTS }, (_, i) => {
    const d = new Date(end - (TREND_POINTS - 1 - i) * TREND_SPACING_DAYS * 86_400_000);
    return `${MONTHS[d.getUTCMonth()] ?? ''} ${String(d.getUTCDate()).padStart(2, '0')}`;
  });
}

function moduleCoverage(files: readonly FileSummary[]): { name: string; count: number; pct: MetricValue }[] {
  const groups = new Map<string, FileSummary[]>();
  for (const f of files) {
    const g = groups.get(f.module);
    if (g) g.push(f); else groups.set(f.module, [f]);
  }
  return [...groups.entries()].map(([name, fs]) => ({
    name, count: fs.length,
    pct: ratioEvidence(sumEvidence(fs.map((f) => f.branchesCovered)), sumEvidence(fs.map((f) => f.branchesTotal))),
  }));
}

function investigations(files: readonly FileSummary[]): Investigation[] {
  if (files.length === 0) return [];
  const top = [...files].sort(byPriority)[0]!;
  const weak = moduleCoverage(files)
    .sort((a, b) => (a.pct.value ?? Infinity) - (b.pct.value ?? Infinity) || a.name.localeCompare(b.name))[0]!;
  const largest = files.filter((f) => hasValue(f.lines))
    .sort((a, b) => (b.lines.value ?? 0) - (a.lines.value ?? 0) || a.path.localeCompare(b.path))[0] ?? top;
  return [
    { id: 'top-hotspot', icon: 'flame', route: 'hotspots', entityId: top.id,
      title: `Review ${top.name}`,
      detail: `Complexity ${formatMetric(top.complexity)} · ${formatMetric(top.commits90d)} commits in 90 days · ${formatMetric(top.branchCoverage, '%')} branch coverage.` },
    { id: 'weak-module', icon: 'flask-conical', route: 'tests', entityId: null,
      title: PROTECT_MODULE_TITLE(moduleLabel(weak.name), weak.name === ROOT_MODULE),
      detail: `${formatMetric(weak.pct, '%')} branch coverage across ${weak.count} files.` },
    { id: 'largest-file', icon: 'building-2', route: 'city', entityId: largest.id,
      title: `Inspect ${largest.name}`,
      detail: hasValue(largest.lines)
        ? `${formatMetric(largest.lines)} lines — the largest file in this scan.`
        : 'Line count unavailable for this file.' },
  ];
}

export function buildOverviewModel(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[],
  cycles: MetricValue = unknown(IMPORT_GRAPH_UNKNOWN_REASON),
): OverviewModel {
  const covered = sumEvidence(files.map((f) => f.branchesCovered), NO_FILES_REASON);
  const total = sumEvidence(files.map((f) => f.branchesTotal), NO_FILES_REASON);
  const coverage = files.length ? ratioEvidence(covered, total) : unknown(NO_FILES_REASON);
  const findings = sumEvidence(files.map((f) => f.findings), NO_FILES_REASON);
  const high = sumEvidence(files.map((f) => f.highFindings), NO_FILES_REASON);
  const hotspots = countEvidence(files.map((f) => f.priority), (v) => v >= HOTSPOT_THRESHOLD, NO_FILES_REASON);
  const highComplexity = countEvidence(files.map((f) => f.complexity), (v) => v >= HIGH_COMPLEXITY, NO_FILES_REASON);

  const labels = trendLabels(snapshot.providerRun.capturedAt);
  const coverageTrend = hasValue(coverage) ? sampleTrend(`${snapshot.snapshotId}:coverage`, coverage.value, TREND_POINTS, 4) : null;
  const complexityTrend = hasValue(highComplexity)
    ? sampleTrend(`${snapshot.snapshotId}:complexity`, highComplexity.value, TREND_POINTS, 3, Infinity) : null;
  const toPoints = (values: readonly number[]) => values.map((value, i) => ({ label: labels[i] ?? '', value }));

  const cards: OverviewCard[] = [
    { id: 'findings', label: 'Open quality findings', icon: 'code', unit: '', tone: 'warning', trend: null,
      value: findings, caption: `${formatMetric(high)} high-priority findings · sample rules` },
    { id: 'coverage', label: 'Branch coverage', icon: 'flask-conical', unit: '%', tone: 'success', trend: coverageTrend,
      value: coverage, caption: `${formatMetric(covered)} / ${formatMetric(total)} instrumented branches` },
    { id: 'architecture', label: 'Architecture exceptions', icon: 'network', unit: '', tone: 'danger', trend: null,
      value: cycles, caption: OVERVIEW_ARCH_CAPTION },
    { id: 'hotspots', label: 'Change hotspots', icon: 'flame', unit: '', tone: 'accent', trend: null,
      value: hotspots, caption: `Priority ≥ ${HOTSPOT_THRESHOLD} · last 90 days` },
  ];

  const series: TrendSeries[] = [
    ...(coverageTrend ? [{ id: 'coverage' as const, label: 'Branch coverage (%)', tone: 'success' as const, points: toPoints(coverageTrend) }] : []),
    ...(complexityTrend ? [{ id: 'high-complexity' as const, label: 'High-complexity files (count)', tone: 'accent' as const, points: toPoints(complexityTrend) }] : []),
  ];

  const importsSampled = cycles.state !== 'unknown';
  const coverageRows: EvidenceCoverageRow[] = [
    { id: 'inventory', label: 'File inventory', state: snapshot.completeness === 'partial' ? 'partial' : 'collected', source: 'Built-in scan' },
    { id: 'static', label: 'Static signals', state: 'sample', source: 'Sample provider' },
    { id: 'history', label: 'Git history', state: 'sample', source: 'Sample provider' },
    { id: 'coverage', label: 'Test coverage', state: 'sample', source: 'Sample provider' },
    { id: 'imports', label: 'Import graph', state: importsSampled ? 'sample' : 'unknown', source: importsSampled ? 'Sample provider' : 'Not collected' },
    { id: 'mutation', label: 'Mutation testing', state: 'unknown', source: 'Not collected' },
    { id: 'runtime', label: 'Runtime evidence', state: 'unknown', source: 'Not collected' },
  ];

  return {
    fileCount: files.length,
    cards,
    series,
    investigations: investigations(files),
    hotspots: [...files].sort(byPriority).slice(0, 5),
    coverage: coverageRows,
    usesSample: cards.some((c) => isSampleBacked(c.value)),
  };
}
```

Remove the old `num`/`byPriority` constants from overview.ts. Keep the `EvidenceState` type import if `EvidenceCoverageRow` still uses it.

- [ ] **Step 7: city-summary.ts.** Replace the whole file:

```ts
import type { RouteId } from '../../domain/route-ids';
import { countEvidence, sumEvidence, unknown, type MetricValue } from '../evidence';
import { IMPORT_GRAPH_UNKNOWN_REASON, NO_FILES_REASON } from '../inspector-copy';
import type { FileSummary } from './file-summaries';
import { HOTSPOT_THRESHOLD } from './overview';

export interface CitySummaryCard { id: 'hotspots' | 'cycles' | 'unused'; title: string; caption: string; value: MetricValue; route: RouteId }

export function buildCitySummary(
  files: readonly FileSummary[], cycles: MetricValue = unknown(IMPORT_GRAPH_UNKNOWN_REASON),
): readonly CitySummaryCard[] {
  return [
    { id: 'hotspots', title: 'Change hotspots', caption: 'Complexity × change × coverage gap', route: 'hotspots',
      value: countEvidence(files.map((f) => f.priority), (v) => v >= HOTSPOT_THRESHOLD, NO_FILES_REASON) },
    { id: 'cycles', title: 'Architectural cycles', caption: 'Inspect module boundaries', route: 'architecture', value: cycles },
    { id: 'unused', title: 'Potentially unused exports', caption: 'Verify entry points before deletion', route: 'quality',
      value: sumEvidence(files.map((f) => f.unusedExports), NO_FILES_REASON) },
  ];
}
```

- [ ] **Step 8: Run the tests and confirm they pass.**
Run: `npx vitest run tests/unit/evidence.test.ts tests/unit/read-models.test.ts tests/component/overview-screen.test.ts tests/component/city-screen.test.ts`
Expected: PASS. If an Overview/City component assertion depended on removed wording, update only that assertion, and report it.

- [ ] **Step 9: Gate and commit.**
Run: `npm run typecheck && npm run lint:fast && npx eslint src/ui/evidence.ts src/ui/read-models src/ui/inspector-copy.ts --max-warnings 0`

```bash
git add src/ui/evidence.ts src/ui/read-models src/ui/inspector-copy.ts tests/unit/evidence.test.ts tests/unit/read-models.test.ts
git commit -m "feat(ui): evidence-aware aggregates (A13) and the root-module label

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Boundary rules behind the review port, and a pending-aware load

**Files:**
- Modify: `src/ui/stores/ports/review-repository.ts`, `src/ui/stores/review-store.ts`
- Test: `tests/unit/review-store.test.ts`

**Interfaces:**
- Produces:
  - `interface BoundaryRule { id: string; from: string; to: string; rationale: string; createdAt: string }` (module keys as in `FileSummary.module`)
  - `ReviewRepository.listRules(): Promise<BoundaryRule[]>`, `saveRule(rule): Promise<void>`, `removeRule(id): Promise<void>`
  - Store state `rules: BoundaryRule[]`; getters `ruleCount`, `hasRule(from, to): boolean`
  - `addRule(from, to, rationale, now: Date): Promise<BoundaryRule | null>` assigns `AR-001`, `AR-002`, … and returns `null` for a self-rule, an empty rationale, a duplicate, or an in-flight duplicate
  - `removeRule(id): Promise<void>`

- [ ] **Step 1: Write the failing tests.** Append inside `describe('review store')` in `tests/unit/review-store.test.ts`. Also add `import type { ReviewRepository, WorkItem } from '../../src/ui/stores/ports/review-repository';`:

```ts
  it('adds boundary rules with sequential AR ids, persisted through the port', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const a = await store.addRule('domain', 'storage', 'Keep domain pure', NOW);
    const b = await store.addRule('ui', 'storage', 'Go through the port', NOW);
    expect([a?.id, b?.id]).toEqual(['AR-001', 'AR-002']);
    expect(a).toMatchObject({ from: 'domain', to: 'storage', rationale: 'Keep domain pure', createdAt: NOW.toISOString() });
    expect(store.ruleCount).toBe(2);
    expect(await repo.listRules()).toHaveLength(2);
  });

  it('refuses a self-rule, an empty rationale and a duplicate pair', async () => {
    const store = useReviewStore();
    expect(await store.addRule('a', 'a', 'x', NOW)).toBeNull();
    expect(await store.addRule('a', 'b', '   ', NOW)).toBeNull();
    await store.addRule('a', 'b', 'x', NOW);
    expect(await store.addRule('a', 'b', 'again', NOW)).toBeNull();
    expect(store.hasRule('a', 'b')).toBe(true);
    expect(store.hasRule('b', 'a')).toBe(false);
    expect(store.ruleCount).toBe(1);
  });

  it('refuses an overlapping add for the same pair while the first save is in flight', async () => {
    let release: () => void = () => {};
    const base = createInMemoryReviewRepository();
    const slow: ReviewRepository = { ...base, saveRule: (r) => new Promise((res) => { release = () => { void base.saveRule(r).then(res); }; }) };
    const store = useReviewStore();
    store.setRepository(slow);
    const first = store.addRule('a', 'b', 'x', NOW);
    expect(await store.addRule('a', 'b', 'x', NOW)).toBeNull();
    release();
    expect((await first)?.id).toBe('AR-001');
  });

  it('removes a rule through the port', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const rule = await store.addRule('a', 'b', 'x', NOW);
    await store.removeRule(rule!.id);
    expect(store.ruleCount).toBe(0);
    expect(await repo.listRules()).toHaveLength(0);
  });

  it('load never moves nextId below a reservation an in-flight add already holds', async () => {
    let release: () => void = () => {};
    const base = createInMemoryReviewRepository();
    const slow: ReviewRepository = {
      ...base,
      saveWorkItem: (item: WorkItem) => new Promise((res) => { release = () => { void base.saveWorkItem(item).then(res); }; }),
    };
    const store = useReviewStore();
    store.setRepository(slow);
    const pending = store.addWorkItemForFile('e1', 't', NOW);   // reserves wi-1
    await store.load();                                          // lists nothing yet
    release();
    await pending;
    store.setRepository(base);
    expect((await store.addWorkItemForFile('e2', 't', NOW))?.id).toBe('wi-2');
    expect(store.workItems.filter((w) => w.id === 'wi-1')).toHaveLength(1);
  });

  it('loads rules and continues their numbering', async () => {
    const repo = createInMemoryReviewRepository();
    await repo.saveRule({ id: 'AR-007', from: 'a', to: 'b', rationale: 'x', createdAt: NOW.toISOString() });
    const store = useReviewStore();
    store.setRepository(repo);
    await store.load();
    expect(store.hasRule('a', 'b')).toBe(true);
    expect((await store.addRule('b', 'c', 'y', NOW))?.id).toBe('AR-008');
  });
```

- [ ] **Step 2: Run and confirm it fails.** `npx vitest run tests/unit/review-store.test.ts` → FAIL (`addRule` is not a function).

- [ ] **Step 3: Extend the port.** In `review-repository.ts`, update the header comment's last sentence to say "Part 2 adds boundary rules (spec P5)", then add:

```ts
/** Part 2 P5: an intended boundary, "`from` must not import `to`". Module names are the
 *  read models' module keys (a top-level directory, or '(root)'). */
export interface BoundaryRule {
  id: string;
  from: string;
  to: string;
  rationale: string;
  createdAt: string;
}
```

Add `listRules(): Promise<BoundaryRule[]>; saveRule(rule: BoundaryRule): Promise<void>; removeRule(id: string): Promise<void>;` to `ReviewRepository`, and to the in-memory implementation:

```ts
export function createInMemoryReviewRepository(): ReviewRepository {
  const items = new Map<string, WorkItem>();
  const rules = new Map<string, BoundaryRule>();
  return {
    listWorkItems: () => Promise.resolve([...items.values()]),
    saveWorkItem: (item) => { items.set(item.id, { ...item }); return Promise.resolve(); },
    removeWorkItem: (id) => { items.delete(id); return Promise.resolve(); },
    listRules: () => Promise.resolve([...rules.values()]),
    saveRule: (rule) => { rules.set(rule.id, { ...rule }); return Promise.resolve(); },
    removeRule: (id) => { rules.delete(id); return Promise.resolve(); },
  };
}
```

- [ ] **Step 4: Extend the store.** In `review-store.ts`:
- Import `BoundaryRule`.
- Add `rules: BoundaryRule[]; nextRuleId: number; pendingRuleKeys: string[];` to the state interface, initialised to `[]`, `1`, `[]`.
- Add the getters and actions below.
- Replace `load()`.
- In `addWorkItemForFile`, change `this.workItems.push(item);` to `if (!this.workItems.some((w) => w.id === item.id)) this.workItems.push(item);`. A `load()` that ran mid-save may already hold it.

Module-level helpers (above `defineStore`):

```ts
const ruleKey = (from: string, to: string): string => `${from}->${to}`;

function maxSuffix(ids: readonly string[], pattern: RegExp): number {
  let max = 0;
  for (const id of ids) {
    const digits = pattern.exec(id)?.[1];
    if (digits) max = Math.max(max, parseInt(digits, 10));
  }
  return max;
}
```

Getters:

```ts
    ruleCount: (state): number => state.rules.length,
    hasRule: (state) => (from: string, to: string): boolean =>
      state.rules.some((r) => r.from === from && r.to === to),
```

Actions:

```ts
    /** Part 2 §5: pending-aware. A save still in flight has already reserved an id; the
     *  counters only ever move forward, so load() can never hand that id out again. */
    async load(): Promise<void> {
      const [items, rules] = await Promise.all([this.repository.listWorkItems(), this.repository.listRules()]);
      this.workItems = items;
      this.rules = rules;
      this.nextId = Math.max(this.nextId, maxSuffix(items.map((i) => i.id), /^wi-(\d+)$/) + 1);
      this.nextRuleId = Math.max(this.nextRuleId, maxSuffix(rules.map((r) => r.id), /^AR-(\d+)$/) + 1);
    },
    /** Part 2 P5. Same reservation and persist-first ordering as `addWorkItemForFile`.
     *  Refuses (null) a self-rule, an empty rationale, an existing pair, and a second call
     *  for a pair whose first save has not settled. */
    async addRule(from: string, to: string, rationale: string, now: Date): Promise<BoundaryRule | null> {
      const key = ruleKey(from, to);
      if (from === to || rationale.trim() === '' || this.hasRule(from, to) || this.pendingRuleKeys.includes(key)) return null;
      const rule: BoundaryRule = {
        id: `AR-${String(this.nextRuleId).padStart(3, '0')}`, from, to, rationale: rationale.trim(), createdAt: now.toISOString(),
      };
      this.nextRuleId += 1;
      this.pendingRuleKeys.push(key);
      try {
        await this.repository.saveRule(rule);
        if (!this.rules.some((r) => r.id === rule.id)) this.rules.push(rule);
        return rule;
      } finally {
        this.pendingRuleKeys = this.pendingRuleKeys.filter((k) => k !== key);
      }
    },
    async removeRule(id: string): Promise<void> {
      await this.repository.removeRule(id);
      this.rules = this.rules.filter((r) => r.id !== id);
    },
```

- [ ] **Step 5: Run and confirm it passes.** `npx vitest run tests/unit/review-store.test.ts tests/component/file-inspector.test.ts tests/component/nav-column.test.ts` → PASS. Any test double that implements `ReviewRepository` by hand must gain the three rule methods: `grep -rn "ReviewRepository" tests` and fix each one.

- [ ] **Step 6: Gate and commit.**
Run: `npm run typecheck && npm run lint:fast && npx eslint src/ui/stores --max-warnings 0`

```bash
git add src/ui/stores tests
git commit -m "feat(ui): boundary rules behind the review port; pending-aware load

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Architecture read model over sample module edges

**Files:**
- Create: `src/ui/fixtures/sample-module-edges.ts`, `src/ui/read-models/architecture.ts`
- Modify: `src/ui/read-models/use-read-models.ts`, `src/ui/inspector-copy.ts`, `tests/component/overview-screen.test.ts` (one assertion)
- Test: `tests/unit/architecture-model.test.ts`

**Interfaces:**
- Consumes: `sumEvidence`, `isSampleBacked` (Task 1); `byPriority`, `moduleLabel` (Task 1); `BoundaryRule` (Task 2)
- Produces:
  - `sampleModuleEdges(modules: readonly string[]): { from: string; to: string; imports: number }[]`
  - `MAX_GRAPH_MODULES = 12`
  - `ModuleSummary { name; label; fileCount; lines: MetricValue; topFiles: readonly FileSummary[] }`
  - `ModuleEdge { from; to; meaning: 'source-import'; imports: MetricValue }`
  - `ArchitectureGraph { allModules; modules; omittedModules; edges; cycles: readonly (readonly string[])[] }`
  - `RuleStatus = 'passing' | 'violation' | 'not-evaluated'`
  - `RuleEvaluation { rule: BoundaryRule; status: RuleStatus; violatingImports: MetricValue }`
  - `MatrixCell { from; to; edge: ModuleEdge | null }`
  - `ArchitectureCard { id: 'modules'|'edges'|'cycles'|'violations'; label; icon; value; caption; tone: 'accent'|'danger'|'warning' }`
  - `ArchitectureModel extends ArchitectureGraph { matrix; rules: readonly RuleEvaluation[]; violatingEdgeKeys: ReadonlySet<string>; cards; usesSample }`
  - Functions: `edgeKey(from, to)`, `buildModules(files)`, `cyclicComponents(nodes, edges)`, `buildArchitectureGraph(files)`, `architectureGraphFor(files)` (memoized per array), `cyclesValue(graph)`, `evaluateRules(rules, graph)`, `buildArchitectureModel(graph, rules)`, `moduleNeighbours(graph, name): { incoming: string[]; outgoing: string[] }`
  - `useReadModels()` gains `architecture: ComputedRef<ArchitectureModel>` and feeds cycles into `overview` and `citySummary`

- [ ] **Step 1: Write the failing test.** Create `tests/unit/architecture-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { sampleModuleEdges } from '../../src/ui/fixtures/sample-module-edges';
import {
  MAX_GRAPH_MODULES, architectureGraphFor, buildArchitectureGraph, buildArchitectureModel, buildModules,
  cyclesValue, cyclicComponents, evaluateRules, moduleNeighbours,
} from '../../src/ui/read-models/architecture';
import type { BoundaryRule } from '../../src/ui/stores/ports/review-repository';

const rule = (from: string, to: string, id = 'AR-001'): BoundaryRule => ({ id, from, to, rationale: 'r', createdAt: '2026-09-21T00:00:00.000Z' });
const graphOf = (files: number, directories: number) => buildArchitectureGraph(fileSummariesFor(buildSnapshotFixture({ files, directories })));

describe('sample module edges (P3)', () => {
  const names = ['app', 'domain', 'storage', 'ui', 'shared'];
  it('is deterministic and never has self-edges or foreign modules', () => {
    const edges = sampleModuleEdges(names);
    expect(sampleModuleEdges([...names].reverse())).toEqual(edges);
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(e.from).not.toBe(e.to);
      expect(names).toContain(e.from);
      expect(names).toContain(e.to);
      expect(e.imports).toBeGreaterThanOrEqual(1);
    }
  });
  it('keeps an existing pair\'s edge when another module is added', () => {
    const before = sampleModuleEdges(names);
    const after = sampleModuleEdges([...names, 'zeta']);
    for (const e of before) expect(after).toContainEqual(e);
  });
});

describe('cyclic components (P6)', () => {
  it('finds two- and three-module cycles and ignores acyclic parts', () => {
    const e = (from: string, to: string) => ({ from, to });
    expect(cyclicComponents(['a', 'b', 'c'], [e('a', 'b'), e('b', 'a'), e('b', 'c')])).toEqual([['a', 'b']]);
    expect(cyclicComponents(['a', 'b', 'c'], [e('a', 'b'), e('b', 'c'), e('c', 'a')])).toEqual([['a', 'b', 'c']]);
    expect(cyclicComponents(['a', 'b', 'c'], [e('a', 'b'), e('b', 'c')])).toEqual([]);
  });
});

describe('modules', () => {
  it('groups by top-level directory, largest first, and labels the root', () => {
    const snap = buildSnapshotFixture({ files: 7, directories: 2 });
    const mods = buildModules(fileSummariesFor(snap));
    expect(mods.map((m) => [m.name, m.fileCount])).toEqual([['dir-0', 4], ['dir-1', 3]]);
    expect(mods[0]?.lines.state).toBe('collected');
    const root = buildModules(fileSummariesFor(buildSnapshotFixture({ files: 2 })));
    expect(root[0]?.label).toBe('Root files');
  });
  it('makes module lines partial when one file\'s lines are unknown', () => {
    const snap = buildSnapshotFixture({ files: 4, directories: 1, unavailable: 1 });
    expect(buildModules(fileSummariesFor(snap))[0]?.lines.state).toBe('partial');
  });
  it('caps the graph at the 12 largest modules and counts the rest (P2)', () => {
    const g = graphOf(45, 15);
    expect(g.modules).toHaveLength(MAX_GRAPH_MODULES);
    expect(g.omittedModules).toBe(3);
    for (const e of g.edges) expect(g.modules.map((m) => m.name)).toContain(e.to);
  });
  it('labels every edge as a sample source-import edge (P4)', () => {
    for (const e of graphOf(40, 6).edges) {
      expect(e.meaning).toBe('source-import');
      expect(e.imports.state).toBe('sample');
    }
  });
  it('memoizes the graph per files array', () => {
    const files = fileSummariesFor(buildSnapshotFixture({ files: 10, directories: 2 }));
    expect(architectureGraphFor(files)).toBe(architectureGraphFor(files));
  });
});

describe('rules and model', () => {
  const g = graphOf(60, 6);
  const edge = g.edges[0]!;
  const names = g.modules.map((m) => m.name);
  const free = names.flatMap((a) => names.map((b) => [a, b] as const))
    .find(([a, b]) => a !== b && !g.edges.some((e) => e.from === a && e.to === b))!;

  it('evaluates violation, passing and not-evaluated', () => {
    const [v, p, n] = evaluateRules([rule(edge.from, edge.to), rule(free[0], free[1], 'AR-002'), rule('nope', edge.to, 'AR-003')], g);
    expect(v).toMatchObject({ status: 'violation', violatingImports: { state: 'sample', value: edge.imports.value } });
    expect(p).toMatchObject({ status: 'passing', violatingImports: { state: 'sample', value: 0 } });
    expect(n?.status).toBe('not-evaluated');
    expect(n?.violatingImports.state).toBe('unknown');
  });
  it('reports violations as unknown until a rule exists, then as sample', () => {
    const none = buildArchitectureModel(g, []);
    expect(none.cards.find((c) => c.id === 'violations')?.value.state).toBe('unknown');
    const one = buildArchitectureModel(g, [rule(edge.from, edge.to)]);
    expect(one.cards.find((c) => c.id === 'violations')?.value).toMatchObject({ state: 'sample', value: edge.imports.value });
    expect(one.violatingEdgeKeys.has(`${edge.from}->${edge.to}`)).toBe(true);
  });
  it('has collected modules, sample edges and cycles, and an n×n matrix', () => {
    const m = buildArchitectureModel(g, []);
    expect(m.cards.map((c) => [c.id, c.value.state])).toEqual([['modules', 'collected'], ['edges', 'sample'], ['cycles', 'sample'], ['violations', 'unknown']]);
    expect(m.matrix).toHaveLength(names.length);
    expect(m.matrix[0]).toHaveLength(names.length);
    const cell = m.matrix[names.indexOf(edge.from)]?.[names.indexOf(edge.to)];
    expect(cell?.edge).toEqual(edge);
    expect(m.usesSample).toBe(true);
  });
  it('lists neighbours by direction', () => {
    const n = moduleNeighbours(g, edge.from);
    expect(n.outgoing).toContain(edge.to);
    expect(moduleNeighbours(g, edge.to).incoming).toContain(edge.from);
  });
  it('cycles are unknown for an empty scan', () => {
    expect(cyclesValue(graphOf(0, 0)).state).toBe('unknown');
    expect(cyclesValue(g).state).toBe('sample');
  });
});
```

- [ ] **Step 2: Run and confirm it fails.** `npx vitest run tests/unit/architecture-model.test.ts` → FAIL (modules not found).

- [ ] **Step 3: Sample edge generator.** Create `src/ui/fixtures/sample-module-edges.ts`:

```ts
// Part 2 P3/P4: SAMPLE module import edges. No import graph is collected yet, so the
// Architecture screen draws these, labelled "sample edges, not observed imports". Each
// module gets a seeded "layer"; an edge down the layers is likely and one back up is rare,
// which gives a plausible graph with the occasional cycle. Every decision is seeded from
// the pair's own names, so adding a module never changes an existing pair's edge.
import { fnv1a, mulberry32 } from './seeded-random';

export interface SampleModuleEdge { from: string; to: string; imports: number }

const DOWN_LAYERS = 0.45;
const UP_LAYERS = 0.08;
const MAX_IMPORTS = 40;

export function sampleModuleEdges(modules: readonly string[]): SampleModuleEdge[] {
  const layer = (name: string): number => fnv1a(`layer:${name}`);
  const ordered = [...new Set(modules)].sort((a, b) => layer(a) - layer(b) || a.localeCompare(b));
  const edges: SampleModuleEdge[] = [];
  ordered.forEach((from, i) => {
    ordered.forEach((to, j) => {
      if (i === j) return;
      const r = mulberry32(fnv1a(`edge:${from}->${to}`));
      if (r() < (i < j ? DOWN_LAYERS : UP_LAYERS)) edges.push({ from, to, imports: 1 + Math.floor(r() * MAX_IMPORTS) });
    });
  });
  return edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}
```

- [ ] **Step 4: Copy.** Append to `inspector-copy.ts`:

```ts
/** Part 2 §2.1: Architecture cards and read-model reasons. */
export const ARCH_CARD_MODULES = 'Modules';
export const ARCH_CARD_EDGES = 'Sample module edges';
export const ARCH_CARD_CYCLES = 'Cyclic components';
export const ARCH_CARD_VIOLATIONS = 'Boundary violations';
export const ARCH_MODULES_OMITTED_CAPTION = (shown: number): string => `The ${shown} largest are shown in the graph`;
export const ARCH_EDGES_CAPTION = (imports: string): string => `${imports} import statements · sample edges`;
export const ARCH_NO_CYCLES_CAPTION = 'No cyclic module groups';
export const ARCH_NO_RULES_REASON = 'No boundary rules defined.';
export const ARCH_VIOLATIONS_CAPTION = (failing: number): string => `${failing} failing rule(s) · sample graph`;
export const RULE_NOT_EVALUATED_REASON = 'A module in this rule is not in the sample graph.';
```

- [ ] **Step 5: The read model.** Create `src/ui/read-models/architecture.ts`:

```ts
// Part 2 §2.1/§3: the Architecture screen's read model. Modules come from the real
// inventory. Edges are SAMPLE (P3) and state what they mean (P4). Cycles (Tarjan) and rule
// verdicts are real algorithms run over those sample edges, so they are sample too.
import { collected, formatMetric, isSampleBacked, sample, sumEvidence, unknown, type MetricValue } from '../evidence';
import { sampleModuleEdges } from '../fixtures/sample-module-edges';
import type { BoundaryRule } from '../stores/ports/review-repository';
import {
  ARCH_CARD_CYCLES, ARCH_CARD_EDGES, ARCH_CARD_MODULES, ARCH_CARD_VIOLATIONS, ARCH_EDGES_CAPTION,
  ARCH_MODULES_OMITTED_CAPTION, ARCH_NO_CYCLES_CAPTION, ARCH_NO_RULES_REASON, ARCH_VIOLATIONS_CAPTION,
  NO_FILES_REASON, RULE_NOT_EVALUATED_REASON,
} from '../inspector-copy';
import { byPriority, moduleLabel, type FileSummary } from './file-summaries';

export const MAX_GRAPH_MODULES = 12;
const TOP_FILES = 5;
const EDGE_DETAIL = 'sample import edges';

export interface ModuleSummary { name: string; label: string; fileCount: number; lines: MetricValue; topFiles: readonly FileSummary[] }
export interface ModuleEdge { from: string; to: string; meaning: 'source-import'; imports: MetricValue }
export interface ArchitectureGraph {
  allModules: readonly ModuleSummary[];
  modules: readonly ModuleSummary[];
  omittedModules: number;
  edges: readonly ModuleEdge[];
  cycles: readonly (readonly string[])[];
}
export type RuleStatus = 'passing' | 'violation' | 'not-evaluated';
export interface RuleEvaluation { rule: BoundaryRule; status: RuleStatus; violatingImports: MetricValue }
export interface MatrixCell { from: string; to: string; edge: ModuleEdge | null }
export interface ArchitectureCard {
  id: 'modules' | 'edges' | 'cycles' | 'violations'; label: string; icon: string;
  value: MetricValue; caption: string; tone: 'accent' | 'danger' | 'warning';
}
export interface ArchitectureModel extends ArchitectureGraph {
  matrix: readonly (readonly MatrixCell[])[];
  rules: readonly RuleEvaluation[];
  violatingEdgeKeys: ReadonlySet<string>;
  cards: readonly ArchitectureCard[];
  usesSample: boolean;
}

export const edgeKey = (from: string, to: string): string => `${from}->${to}`;

export function buildModules(files: readonly FileSummary[]): ModuleSummary[] {
  const groups = new Map<string, FileSummary[]>();
  for (const f of files) {
    const g = groups.get(f.module);
    if (g) g.push(f); else groups.set(f.module, [f]);
  }
  return [...groups.entries()]
    .map(([name, fs]) => ({
      name, label: moduleLabel(name), fileCount: fs.length,
      lines: sumEvidence(fs.map((f) => f.lines)),
      topFiles: [...fs].sort(byPriority).slice(0, TOP_FILES),
    }))
    .sort((a, b) => b.fileCount - a.fileCount || a.name.localeCompare(b.name));
}

/** Tarjan's strongly connected components, keeping only those with MORE than one module.
 *  Members and components are in name order. */
export function cyclicComponents(nodes: readonly string[], edges: readonly { from: string; to: string }[]): string[][] {
  const adjacency = new Map(nodes.map((n) => [n, [] as string[]]));
  for (const e of edges) adjacency.get(e.from)?.push(e.to);
  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const out: string[][] = [];
  const visit = (v: string): void => {
    index.set(v, counter); low.set(v, counter); counter += 1;
    stack.push(v); onStack.add(v);
    for (const w of adjacency.get(v) ?? []) {
      if (!adjacency.has(w)) continue;
      if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) !== index.get(v)) return;
    const component: string[] = [];
    for (;;) {
      const w = stack.pop();
      if (w === undefined) break;
      onStack.delete(w);
      component.push(w);
      if (w === v) break;
    }
    if (component.length > 1) out.push(component.sort());
  };
  for (const n of nodes) if (!index.has(n)) visit(n);
  return out.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));
}

export function buildArchitectureGraph(files: readonly FileSummary[]): ArchitectureGraph {
  const allModules = buildModules(files);
  const modules = allModules.slice(0, MAX_GRAPH_MODULES);
  const names = modules.map((m) => m.name);
  const edges: ModuleEdge[] = sampleModuleEdges(names).map((e) => ({
    from: e.from, to: e.to, meaning: 'source-import', imports: sample(e.imports, EDGE_DETAIL),
  }));
  return { allModules, modules, omittedModules: allModules.length - modules.length, edges, cycles: cyclicComponents(names, edges) };
}

const graphCache = new WeakMap<readonly FileSummary[], ArchitectureGraph>();

/** Memoized per files ARRAY: `fileSummariesFor` already returns one array per snapshot. */
export function architectureGraphFor(files: readonly FileSummary[]): ArchitectureGraph {
  let hit = graphCache.get(files);
  if (!hit) { hit = buildArchitectureGraph(files); graphCache.set(files, hit); }
  return hit;
}

export function cyclesValue(graph: ArchitectureGraph): MetricValue {
  return graph.modules.length === 0 ? unknown(NO_FILES_REASON) : sample(graph.cycles.length, EDGE_DETAIL);
}

export function evaluateRules(rules: readonly BoundaryRule[], graph: ArchitectureGraph): RuleEvaluation[] {
  const inGraph = new Set(graph.modules.map((m) => m.name));
  return rules.map((rule): RuleEvaluation => {
    if (!inGraph.has(rule.from) || !inGraph.has(rule.to)) {
      return { rule, status: 'not-evaluated', violatingImports: unknown(RULE_NOT_EVALUATED_REASON) };
    }
    const edge = graph.edges.find((e) => e.from === rule.from && e.to === rule.to);
    return edge
      ? { rule, status: 'violation', violatingImports: edge.imports }
      : { rule, status: 'passing', violatingImports: sample(0, EDGE_DETAIL) };
  });
}

export function moduleNeighbours(graph: ArchitectureGraph, name: string): { incoming: string[]; outgoing: string[] } {
  return {
    incoming: graph.edges.filter((e) => e.to === name).map((e) => e.from),
    outgoing: graph.edges.filter((e) => e.from === name).map((e) => e.to),
  };
}

export function buildArchitectureModel(graph: ArchitectureGraph, rules: readonly BoundaryRule[]): ArchitectureModel {
  const evaluations = evaluateRules(rules, graph);
  const violating = evaluations.filter((e) => e.status === 'violation');
  const byKey = new Map(graph.edges.map((e) => [edgeKey(e.from, e.to), e]));
  const matrix = graph.modules.map((row) => graph.modules.map((col): MatrixCell => ({
    from: row.name, to: col.name, edge: byKey.get(edgeKey(row.name, col.name)) ?? null,
  })));
  const empty = graph.modules.length === 0;
  const cards: ArchitectureCard[] = [
    { id: 'modules', label: ARCH_CARD_MODULES, icon: 'boxes', tone: 'accent',
      value: collected(graph.allModules.length, 'inventory'),
      caption: graph.omittedModules > 0 ? ARCH_MODULES_OMITTED_CAPTION(MAX_GRAPH_MODULES) : graph.modules.slice(0, 4).map((m) => m.label).join(' · ') },
    { id: 'edges', label: ARCH_CARD_EDGES, icon: 'link', tone: 'accent',
      value: empty ? unknown(NO_FILES_REASON) : sample(graph.edges.length, EDGE_DETAIL),
      caption: ARCH_EDGES_CAPTION(formatMetric(sumEvidence(graph.edges.map((e) => e.imports)))) },
    { id: 'cycles', label: ARCH_CARD_CYCLES, icon: 'refresh-cw', tone: 'danger', value: cyclesValue(graph),
      caption: graph.cycles.length ? graph.cycles.map((c) => c.map(moduleLabel).join(' ↔ ')).join('; ') : ARCH_NO_CYCLES_CAPTION },
    { id: 'violations', label: ARCH_CARD_VIOLATIONS, icon: 'alert-triangle', tone: 'warning',
      value: rules.length === 0 ? unknown(ARCH_NO_RULES_REASON) : sumEvidence(evaluations.map((e) => e.violatingImports)),
      caption: ARCH_VIOLATIONS_CAPTION(violating.length) },
  ];
  return {
    ...graph, matrix, rules: evaluations,
    violatingEdgeKeys: new Set(violating.map((e) => edgeKey(e.rule.from, e.rule.to))),
    cards, usesSample: cards.some((c) => isSampleBacked(c.value)),
  };
}
```

- [ ] **Step 6: Wire it into `useReadModels`.** Replace `src/ui/read-models/use-read-models.ts`:

```ts
import { computed } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { fileSummariesFor, type FileSummary } from './file-summaries';
import { buildOverviewModel } from './overview';
import { buildCitySummary } from './city-summary';
import { architectureGraphFor, buildArchitectureModel, cyclesValue } from './architecture';

/** One stable empty array, so the per-array memo (architectureGraphFor) still hits. */
const NO_FILES: readonly FileSummary[] = [];

/** Screens read models through here only (spec §3.2 rule 1). */
export function useReadModels() {
  const store = useCityStore();
  const review = useReviewStore();
  const files = computed(() => (store.snapshot ? fileSummariesFor(store.snapshot) : NO_FILES));
  const graph = computed(() => architectureGraphFor(files.value));
  const cycles = computed(() => cyclesValue(graph.value));
  const overview = computed(() => (store.snapshot ? buildOverviewModel(store.snapshot, files.value, cycles.value) : null));
  const citySummary = computed(() => buildCitySummary(files.value, cycles.value));
  const architecture = computed(() => buildArchitectureModel(graph.value, review.rules));
  return { files, overview, citySummary, architecture };
}
```

- [ ] **Step 7: Update the component tests that pinned "architecture unknown".** In `tests/component/overview-screen.test.ts`, the test `'renders the four signal cards, with architecture unknown rather than 0'` now receives sample cycles. Rename it to `'renders the four signal cards, with architecture labelled sample'` and replace its last assertion with:

```ts
    expect(cards[2]!.find('.ci-metric-card__value').text()).toMatch(/^\d+$/);
    expect(cards[2]!.find('.ci-provenance--sample').exists()).toBe(true);
```

Run `npx vitest run tests/component/city-screen.test.ts tests/component/nav-column.test.ts`. If any assertion pinned the cycles card as unknown, change it to sample in the same way, and report it.

- [ ] **Step 8: Run the tests and confirm they pass.** `npx vitest run tests/unit/architecture-model.test.ts tests/unit/read-models.test.ts tests/component/overview-screen.test.ts tests/component/city-screen.test.ts` → PASS.

- [ ] **Step 9: Gate and commit.** `npm run typecheck && npm run lint:fast && npx eslint src/ui/read-models src/ui/fixtures src/ui/inspector-copy.ts --max-warnings 0`

```bash
git add src/ui tests
git commit -m "feat(ui): architecture read model over labelled sample module edges

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Hotspots read model, CSV export and the download helper

**Files:**
- Create: `src/ui/read-models/hotspots.ts`, `src/ui/export/download.ts`
- Modify: `src/ui/kit/EvidenceTable.vue` (optional `limit`)
- Test: `tests/unit/hotspots-model.test.ts`, `tests/component/download.test.ts`, `tests/component/kit-interactive.test.ts` (one test)

**Interfaces:**
- Consumes: `byPriority`, `moduleLabel` (Task 1); `HIGH_COMPLEXITY` (overview.ts)
- Produces:
  - Constants: `MAX_PLOTTED = 400`, `TABLE_PAGE = 100`, `SHORTLIST_SIZE = 5`, `CHURN_THRESHOLD = 22`
  - Types:
    - `CoverageBand = 'low'|'mid'|'high'|'unknown'`
    - `HotspotFilter { module: string | null; query: string }`
    - `HotspotPoint { file: FileSummary; x: number; y: number; lines: number | null; band: CoverageBand }`
    - `HotspotsModel { modules: readonly {name; label}[]; rows; points; plottable: number; unplottable: number; shortlist; xMax; yMax; linesMax; usesSample }`
  - Functions: `coverageBand(m)`, `buildHotspotsModel(files, filter)`, `hotspotsCsv(rows): string`
  - `downloadText(host: HTMLElement, filename: string, text: string, mime?: string): void`
  - EvidenceTable prop `limit?: number`: sorts ALL rows, then shows the first `limit`

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/hotspots-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { MAX_PLOTTED, buildHotspotsModel, coverageBand, hotspotsCsv } from '../../src/ui/read-models/hotspots';
import { sample, unknown } from '../../src/ui/evidence';

const ALL = { module: null, query: '' };
const filesOf = (files: number, directories = 3) => fileSummariesFor(buildSnapshotFixture({ files, directories }));

describe('hotspots model', () => {
  it('filters by module and by path, highest priority first', () => {
    const files = filesOf(60);
    const m = buildHotspotsModel(files, { module: 'dir-1', query: '' });
    expect(m.rows.every((f) => f.module === 'dir-1')).toBe(true);
    const ps = m.rows.map((f) => f.priority.value ?? -1);
    expect([...ps].sort((a, b) => b - a)).toEqual(ps);
    expect(buildHotspotsModel(files, { module: null, query: 'FILE-1.TS' }).rows.map((f) => f.name)).toEqual(['file-1.ts']);
    expect(m.modules.map((x) => x.name)).toEqual(['dir-0', 'dir-1', 'dir-2']);
  });
  it('plots at most MAX_PLOTTED files and counts the rest (P7)', () => {
    const m = buildHotspotsModel(filesOf(500), ALL);
    expect(m.points).toHaveLength(MAX_PLOTTED);
    expect(m.plottable).toBe(500);
    expect(m.points[0]?.file.id).toBe(m.rows[0]?.id);
  });
  it('never plots a file without complexity or commits, and never as 0', () => {
    const files = filesOf(5).map((f, i): FileSummary => (i === 0 ? { ...f, complexity: unknown('no analyzer') } : f));
    const m = buildHotspotsModel(files, ALL);
    expect(m.points).toHaveLength(4);
    expect(m.unplottable).toBe(1);
  });
  it('keeps unknown lines as null, for a ring', () => {
    const files = fileSummariesFor(buildSnapshotFixture({ files: 3, unavailable: 1 }));
    expect(buildHotspotsModel(files, ALL).points.some((p) => p.lines === null)).toBe(true);
  });
  it('bands coverage, unknown included', () => {
    expect([sample(10), sample(60), sample(80), unknown('x')].map(coverageBand)).toEqual(['low', 'mid', 'high', 'unknown']);
  });
  it('shortlists at most five files with a known priority', () => {
    const files = filesOf(20).map((f, i): FileSummary => (i < 18 ? { ...f, priority: unknown('x') } : f));
    expect(buildHotspotsModel(files, ALL).shortlist).toHaveLength(2);
    expect(buildHotspotsModel(filesOf(20), ALL).shortlist).toHaveLength(5);
  });
});

describe('hotspots CSV (P8)', () => {
  it('has a header, one CRLF line per row, and a state column per metric', () => {
    const rows = filesOf(3);
    const lines = hotspotsCsv(rows).split('\r\n');
    expect(lines[0]).toBe('path,module,priority,priority_state,complexity,complexity_state,commits_90d,commits_90d_state,branch_coverage_pct,branch_coverage_pct_state,lines,lines_state');
    expect(lines).toHaveLength(rows.length + 2);   // header + rows + trailing empty
    expect(lines.at(-1)).toBe('');
  });
  it('exports an unknown value as an empty cell with its state — never 0', () => {
    const [f] = filesOf(1);
    const csv = hotspotsCsv([{ ...f!, complexity: unknown('no analyzer') }]);
    expect(csv.split('\r\n')[1]).toContain(',,unknown,');
  });
  it('guards formula injection and quotes separators', () => {
    const [f] = filesOf(1);
    const line = hotspotsCsv([{ ...f!, path: '=HYPERLINK("x"),a.ts', module: '+cmd' }]).split('\r\n')[1];
    expect(line?.startsWith('"\'=HYPERLINK(""x""),a.ts",\'+cmd,')).toBe(true);
  });
});
```

Create `tests/component/download.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from '../../src/ui/export/download';

describe('downloadText (P8)', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('clicks a transient download anchor in the host\'s own document and revokes the URL later', () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const blobs: Blob[] = [];
    const create = vi.fn((b: Blob) => { blobs.push(b); return 'blob:ci-test'; });
    const revoke = vi.fn();
    Object.assign(window.URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });

    downloadText(host, 'codebase-hotspots.csv', 'a,b\r\n');

    expect(clicked[0]?.download).toBe('codebase-hotspots.csv');
    expect(clicked[0]?.getAttribute('href')).toBe('blob:ci-test');
    expect(blobs[0]?.type).toBe('text/csv;charset=utf-8');
    expect(host.querySelector('a')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:ci-test');
    host.remove();
  });
});
```

Add to `tests/component/kit-interactive.test.ts`, inside the EvidenceTable describe. Mount like `mountTable()` does but with `limit: 1` added to the props type and the props:

```ts
  it('limit sorts the WHOLE set, then shows only the first rows', () => {
    const w = mount(EvidenceTable as unknown as new () => { $props: {
      columns: TableColumn<Row>[]; rows: Row[]; rowKey: (row: Row) => string; caption: string;
      initialSort?: { key: string; dir: 'asc' | 'desc' }; limit?: number;
    } }, {
      props: { columns, rows, rowKey: (r: Row) => r.id, caption: 'Files', initialSort: { key: 'n', dir: 'desc' as const }, limit: 1 },
      slots: { 'cell-name': ({ row }: { row: Row }) => h('b', row.name) },
    });
    expect(w.findAll('.ci-table__row').map((r) => r.text())).toEqual(['Beta']);
  });
```

- [ ] **Step 2: Run and confirm they fail.** `npx vitest run tests/unit/hotspots-model.test.ts tests/component/download.test.ts tests/component/kit-interactive.test.ts` → FAIL.

- [ ] **Step 3: EvidenceTable `limit`.** In `EvidenceTable.vue`, add `limit?: number;` to the props. After `sorted`, add the computed below, and change the row `v-for` to `v-for="row in visible"`:

```ts
/** Part 2 P7: sort the WHOLE set, then show the first `limit` rows, so sorting a long
 *  table never re-orders only the rows that happen to be on screen. */
const visible = computed(() => (props.limit === undefined ? sorted.value : sorted.value.slice(0, props.limit)));
```

- [ ] **Step 4: The hotspots model.** Create `src/ui/read-models/hotspots.ts`:

```ts
// Part 2 §2.2/§3: the Hotspots screen's read model. The rows are every filtered file,
// highest priority first. The scatter plots only files whose two axes are known; a file
// missing either is counted, never drawn at 0.
import { hasValue, isSampleBacked, type MetricValue } from '../evidence';
import { byPriority, moduleLabel, type FileSummary } from './file-summaries';

export const MAX_PLOTTED = 400;
export const TABLE_PAGE = 100;
export const SHORTLIST_SIZE = 5;
/** The review quadrant's churn edge (half the sample range's 44). */
export const CHURN_THRESHOLD = 22;

export type CoverageBand = 'low' | 'mid' | 'high' | 'unknown';
export interface HotspotFilter { module: string | null; query: string }
export interface HotspotPoint { file: FileSummary; x: number; y: number; lines: number | null; band: CoverageBand }
export interface HotspotsModel {
  modules: readonly { name: string; label: string }[];
  rows: readonly FileSummary[];
  points: readonly HotspotPoint[];
  plottable: number;
  unplottable: number;
  shortlist: readonly FileSummary[];
  xMax: number;
  yMax: number;
  linesMax: number;
  usesSample: boolean;
}

export function coverageBand(m: MetricValue): CoverageBand {
  if (!hasValue(m)) return 'unknown';
  if (m.value < 60) return 'low';
  return m.value < 80 ? 'mid' : 'high';
}

const niceMax = (v: number): number => Math.max(10, Math.ceil(v / 10) * 10);

export function buildHotspotsModel(files: readonly FileSummary[], filter: HotspotFilter): HotspotsModel {
  const q = filter.query.trim().toLowerCase();
  const rows = files
    .filter((f) => (filter.module === null || f.module === filter.module) && (!q || f.path.toLowerCase().includes(q)))
    .sort(byPriority);
  const points: HotspotPoint[] = [];
  let plottable = 0;
  for (const f of rows) {
    if (!hasValue(f.complexity) || !hasValue(f.commits90d)) continue;
    plottable += 1;
    if (points.length < MAX_PLOTTED) {
      points.push({
        file: f, x: f.commits90d.value, y: f.complexity.value,
        lines: hasValue(f.lines) ? f.lines.value : null, band: coverageBand(f.branchCoverage),
      });
    }
  }
  const names = [...new Set(files.map((f) => f.module))].sort((a, b) => a.localeCompare(b));
  return {
    modules: names.map((name) => ({ name, label: moduleLabel(name) })),
    rows,
    points,
    plottable,
    unplottable: rows.length - plottable,
    shortlist: rows.filter((f) => hasValue(f.priority)).slice(0, SHORTLIST_SIZE),
    xMax: niceMax(Math.max(0, ...points.map((p) => p.x))),
    yMax: niceMax(Math.max(0, ...points.map((p) => p.y))),
    linesMax: Math.max(1, ...points.map((p) => p.lines ?? 0)),
    usesSample: rows.some((f) => isSampleBacked(f.priority) || isSampleBacked(f.complexity)),
  };
}

/** P8: a string cell starting with = + - @ (or tab/CR) is prefixed with ' so a
 *  spreadsheet never evaluates it. Numbers are never prefixed. */
function csvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_METRICS: readonly [string, (f: FileSummary) => MetricValue][] = [
  ['priority', (f) => f.priority],
  ['complexity', (f) => f.complexity],
  ['commits_90d', (f) => f.commits90d],
  ['branch_coverage_pct', (f) => f.branchCoverage],
  ['lines', (f) => f.lines],
];

/** P8: every row given. An unknown value is an empty cell whose `_state` column says
 *  why, so absent evidence is never exported as 0. RFC 4180 line endings. */
export function hotspotsCsv(rows: readonly FileSummary[]): string {
  const header = ['path', 'module', ...CSV_METRICS.flatMap(([name]) => [name, `${name}_state`])];
  const lines = rows.map((f) => [
    csvCell(f.path), csvCell(moduleLabel(f.module)),
    ...CSV_METRICS.flatMap(([, get]) => { const m = get(f); return [csvCell(m.value), csvCell(m.state)]; }),
  ].join(','));
  return `${[header.join(','), ...lines].join('\r\n')}\r\n`;
}
```

- [ ] **Step 5: The download helper.** Create `src/ui/export/download.ts`:

```ts
// Part 2 P8: hands a text file to the user through THIS leaf's own document. Electron shows
// its save dialog, so the file goes only where the user chooses. This module writes
// nothing to the vault, and nothing anywhere by itself. `ownerDocument.defaultView` is
// the window the leaf is actually in, which after a pop-out is not the module's window.
const REVOKE_AFTER_MS = 30_000;

export function downloadText(host: HTMLElement, filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error('download unavailable: the host element has no window');
  const url = win.URL.createObjectURL(new win.Blob([text], { type: mime }));
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  host.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    win.setTimeout(() => { win.URL.revokeObjectURL(url); }, REVOKE_AFTER_MS);
  }
}
```

- [ ] **Step 6: Run and confirm the tests pass.** `npx vitest run tests/unit/hotspots-model.test.ts tests/component/download.test.ts tests/component/kit-interactive.test.ts` → PASS.

- [ ] **Step 7: Gate and commit.** `npm run typecheck && npm run lint:fast && npx eslint src/ui/read-models src/ui/export src/ui/kit --max-warnings 0`

```bash
git add src/ui tests
git commit -m "feat(ui): hotspots read model, CSV export and leaf-scoped download

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: File-detail read model and sample findings

**Files:**
- Create: `src/ui/fixtures/sample-findings.ts`, `src/ui/read-models/file-detail.ts`
- Modify: `src/ui/read-models/use-read-models.ts`, `src/ui/inspector-copy.ts`
- Test: `tests/unit/file-detail-model.test.ts`

**Interfaces:**
- Consumes: `trendLabels`, `TREND_POINTS` (Task 1); `isSampleBacked` (Task 1)
- Produces:
  - `FindingKind = 'complexity'|'duplication'|'unused-exports'`, `FindingSeverity = 'high'|'medium'|'low'`
  - `SampleFinding { id; kind; severity; line: number | null }`, `sampleFindings(file: FileSummary): SampleFinding[]`
  - `FileFinding extends SampleFinding { title: string }`
  - `FileDetailCard { id: 'complexity'|'coverage'|'dependents'|'priority'; label; icon; value; unit; caption; tone: 'warning'|'success'|'accent' }`
  - `FileHistorySeries { id: 'complexity'|'coverage'; label; tone: 'accent'|'success'; points: {label; value}[] }`
  - `FileDetailModel { file; moduleLabel; category: string | null; bytes: MetricValue; cards; findingsCount: MetricValue; findings: readonly FileFinding[]; history; usesSample }`
  - `buildFileDetail(snapshot, files, entityId: EntityId | null): FileDetailModel | null`
  - `useReadModels()` gains `fileDetail: ComputedRef<FileDetailModel | null>` and `filesUseSample: ComputedRef<boolean>`

- [ ] **Step 1: Write the failing test.** Create `tests/unit/file-detail-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { buildFileDetail } from '../../src/ui/read-models/file-detail';
import { sampleFindings } from '../../src/ui/fixtures/sample-findings';
import { sample, unknown } from '../../src/ui/evidence';

const snap = buildSnapshotFixture({ files: 12, directories: 2, unavailable: 1 });
const files = fileSummariesFor(snap);

describe('file detail model', () => {
  it('is null without a selection, for an unknown id, and for a directory', () => {
    expect(buildFileDetail(snap, files, null)).toBeNull();
    expect(buildFileDetail(snap, files, 'nope')).toBeNull();
    const dir = snap.entities.find((e) => e.kind === 'directory')!;
    expect(buildFileDetail(snap, files, dir.id)).toBeNull();
  });
  it('has four sample cards, collected bytes and the entity category', () => {
    const f = files[3]!;
    const d = buildFileDetail(snap, files, f.id)!;
    expect(d.cards.map((c) => [c.id, c.value.state])).toEqual([['complexity', 'sample'], ['coverage', 'sample'], ['dependents', 'sample'], ['priority', 'sample']]);
    expect(d.bytes.state).toBe('collected');
    expect(d.category).toBe(snap.entities.find((e) => e.id === f.id)?.category);
    expect(d.moduleLabel).toBe(f.module);
    expect(d.usesSample).toBe(true);
  });
  it('ends each history series at the current value', () => {
    const f = files[3]!;
    const d = buildFileDetail(snap, files, f.id)!;
    expect(d.history.find((s) => s.id === 'complexity')?.points.at(-1)?.value).toBe(f.complexity.value);
    expect(d.history.find((s) => s.id === 'coverage')?.points.at(-1)?.value).toBe(f.branchCoverage.value);
  });
  it('omits a history series whose value is unknown', () => {
    const f: FileSummary = { ...files[3]!, branchCoverage: unknown('no report') };
    const d = buildFileDetail(snap, files.map((x) => (x.id === f.id ? f : x)), f.id)!;
    expect(d.history.map((s) => s.id)).toEqual(['complexity']);
  });
});

describe('sample findings', () => {
  it('is deterministic, matches the file\'s count, and puts high findings first', () => {
    const f: FileSummary = { ...files[2]!, findings: sample(3), highFindings: sample(1) };
    const list = sampleFindings(f);
    expect(sampleFindings(f)).toEqual(list);
    expect(list).toHaveLength(3);
    expect(list.map((x) => x.severity)).toEqual(['high', 'medium', 'low']);
    expect(list[0]?.id).toMatch(/^CX-dir-\d-0$/);
  });
  it('never puts a finding beyond the file\'s known lines, and has no line when lines are unknown', () => {
    for (const f of files) {
      for (const x of sampleFindings({ ...f, findings: sample(4), highFindings: sample(0) })) {
        if (f.lines.value === undefined) {
          expect(x.line).toBeNull();
        } else {
          expect(x.line).toBeGreaterThanOrEqual(1);
          expect(x.line).toBeLessThanOrEqual(f.lines.value);
        }
      }
    }
  });
  it('has no findings when the count is unknown', () => {
    expect(sampleFindings({ ...files[0]!, findings: unknown('x') })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and confirm it fails.** `npx vitest run tests/unit/file-detail-model.test.ts` → FAIL.

- [ ] **Step 3: Copy.** Append to `inspector-copy.ts`:

```ts
/** Part 2 §2.3: File detail cards, history and findings. */
export const NOT_MEASURED_REASON = 'Not measured in this scan.';
export const FILE_CARD_COMPLEXITY = 'Max. cognitive complexity';
export const FILE_CARD_COMPLEXITY_CAPTION = 'Highest function-level value, not a file sum';
export const FILE_CARD_COVERAGE = 'Branch coverage';
export const FILE_CARD_COVERAGE_CAPTION = (covered: string, total: string): string => `${covered} of ${total} instrumented branches`;
export const FILE_CARD_DEPENDENTS = 'Direct dependents';
export const FILE_CARD_DEPENDENTS_CAPTION = 'Illustrative fan-in';
export const FILE_CARD_PRIORITY = 'Review priority';
export const FILE_CARD_PRIORITY_CAPTION = 'Heuristic, not a failure probability';
export const FILE_HISTORY_COMPLEXITY = 'Max. complexity';
export const FILE_HISTORY_COVERAGE = 'Branch coverage (%)';
export const FINDING_TITLE: Readonly<Record<'complexity' | 'duplication' | 'unused-exports', string>> = {
  complexity: 'Complex function needs review',
  duplication: 'Repeated implementation detected',
  'unused-exports': 'Potentially unused export',
};
```

- [ ] **Step 4: Sample findings.** Create `src/ui/fixtures/sample-findings.ts`:

```ts
// Part 2 §2.3: SAMPLE static findings for one file, derived from the file's own sample
// counts, so a file's list agrees with its "findings" number everywhere it is shown.
// Seeded per entity and position. A line is only given when the file's line count is
// known, and it never exceeds that count.
import { hasValue } from '../evidence';
import type { FileSummary } from '../read-models/file-summaries';
import { fnv1a, mulberry32 } from './seeded-random';

export type FindingKind = 'complexity' | 'duplication' | 'unused-exports';
export type FindingSeverity = 'high' | 'medium' | 'low';
export interface SampleFinding { id: string; kind: FindingKind; severity: FindingSeverity; line: number | null }

const PREFIX: Readonly<Record<FindingKind, string>> = { complexity: 'CX', duplication: 'DU', 'unused-exports': 'UN' };
const SEVERITY: Readonly<Record<FindingKind, FindingSeverity>> = { complexity: 'high', duplication: 'medium', 'unused-exports': 'low' };

export function sampleFindings(file: FileSummary): SampleFinding[] {
  if (!hasValue(file.findings) || !hasValue(file.highFindings)) return [];
  const total = file.findings.value;
  const high = Math.min(file.highFindings.value, total);
  const kinds: FindingKind[] = [
    ...Array.from({ length: high }, (): FindingKind => 'complexity'),
    ...Array.from({ length: total - high }, (_, i): FindingKind => (i % 2 === 0 ? 'duplication' : 'unused-exports')),
  ];
  const lines = hasValue(file.lines) && file.lines.value > 0 ? file.lines.value : null;
  const slug = file.module.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'root';
  return kinds.map((kind, i) => {
    const r = mulberry32(fnv1a(`finding:${file.id}:${i}`));
    return { id: `${PREFIX[kind]}-${slug}-${i}`, kind, severity: SEVERITY[kind], line: lines === null ? null : 1 + Math.floor(r() * lines) };
  });
}
```

- [ ] **Step 5: The model.** Create `src/ui/read-models/file-detail.ts`:

```ts
// Part 2 §2.3: the File detail screen's read model, for the ONE selected file (P10).
// Source content is never read here (P9): the source facts are inventory metadata only.
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot } from '../../domain/model';
import { collected, formatMetric, hasValue, isSampleBacked, unknown, type MetricValue } from '../evidence';
import { sampleTrend } from '../fixtures/sample-signals';
import { sampleFindings, type SampleFinding } from '../fixtures/sample-findings';
import {
  FILE_CARD_COMPLEXITY, FILE_CARD_COMPLEXITY_CAPTION, FILE_CARD_COVERAGE, FILE_CARD_COVERAGE_CAPTION,
  FILE_CARD_DEPENDENTS, FILE_CARD_DEPENDENTS_CAPTION, FILE_CARD_PRIORITY, FILE_CARD_PRIORITY_CAPTION,
  FILE_HISTORY_COMPLEXITY, FILE_HISTORY_COVERAGE, FINDING_TITLE, NOT_MEASURED_REASON,
} from '../inspector-copy';
import { moduleLabel, type FileSummary } from './file-summaries';
import { TREND_POINTS, trendLabels } from './overview';

export interface FileDetailCard {
  id: 'complexity' | 'coverage' | 'dependents' | 'priority'; label: string; icon: string;
  value: MetricValue; unit: string; caption: string; tone: 'warning' | 'success' | 'accent';
}
export interface FileFinding extends SampleFinding { title: string }
export interface FileHistorySeries {
  id: 'complexity' | 'coverage'; label: string; tone: 'accent' | 'success';
  points: readonly { label: string; value: number }[];
}
export interface FileDetailModel {
  file: FileSummary;
  moduleLabel: string;
  category: string | null;
  bytes: MetricValue;
  cards: readonly FileDetailCard[];
  findingsCount: MetricValue;
  findings: readonly FileFinding[];
  history: readonly FileHistorySeries[];
  usesSample: boolean;
}

function bytesOf(snapshot: CodebaseSnapshot, id: EntityId): MetricValue {
  const obs = snapshot.observations.find((o) => o.entityId === id && o.measurement.metricId === 'byte-size');
  if (!obs) return unknown(NOT_MEASURED_REASON, 'inventory');
  return obs.status === 'measured' && obs.value !== null ? collected(obs.value, 'inventory') : unknown(obs.reason ?? NOT_MEASURED_REASON, 'inventory');
}

export function buildFileDetail(snapshot: CodebaseSnapshot, files: readonly FileSummary[], entityId: EntityId | null): FileDetailModel | null {
  if (!entityId) return null;
  const file = files.find((f) => f.id === entityId);
  if (!file) return null;
  const labels = trendLabels(snapshot.providerRun.capturedAt);
  const toPoints = (values: readonly number[]) => values.map((value, i) => ({ label: labels[i] ?? '', value }));
  const history: FileHistorySeries[] = [];
  if (hasValue(file.complexity)) {
    history.push({ id: 'complexity', label: FILE_HISTORY_COMPLEXITY, tone: 'accent', points: toPoints(sampleTrend(`${file.id}:complexity`, file.complexity.value, TREND_POINTS, 4, Infinity)) });
  }
  if (hasValue(file.branchCoverage)) {
    history.push({ id: 'coverage', label: FILE_HISTORY_COVERAGE, tone: 'success', points: toPoints(sampleTrend(`${file.id}:coverage`, file.branchCoverage.value, TREND_POINTS, 5)) });
  }
  const cards: FileDetailCard[] = [
    { id: 'complexity', label: FILE_CARD_COMPLEXITY, icon: 'flame', value: file.complexity, unit: '', caption: FILE_CARD_COMPLEXITY_CAPTION, tone: 'warning' },
    { id: 'coverage', label: FILE_CARD_COVERAGE, icon: 'flask-conical', value: file.branchCoverage, unit: '%',
      caption: FILE_CARD_COVERAGE_CAPTION(formatMetric(file.branchesCovered), formatMetric(file.branchesTotal)), tone: 'success' },
    { id: 'dependents', label: FILE_CARD_DEPENDENTS, icon: 'link', value: file.directDependents, unit: '', caption: FILE_CARD_DEPENDENTS_CAPTION, tone: 'accent' },
    { id: 'priority', label: FILE_CARD_PRIORITY, icon: 'info', value: file.priority, unit: ' / 100', caption: FILE_CARD_PRIORITY_CAPTION, tone: 'accent' },
  ];
  return {
    file,
    moduleLabel: moduleLabel(file.module),
    category: snapshot.entities.find((e) => e.id === file.id)?.category ?? null,
    bytes: bytesOf(snapshot, file.id),
    cards,
    findingsCount: file.findings,
    findings: sampleFindings(file).map((f) => ({ ...f, title: FINDING_TITLE[f.kind] })),
    history,
    usesSample: cards.some((c) => isSampleBacked(c.value)),
  };
}
```

- [ ] **Step 6: Expose it.** In `use-read-models.ts`, add `import { buildFileDetail } from './file-detail';` and `import { isSampleBacked } from '../evidence';`. Add these computeds, and return them alongside the rest:

```ts
  const fileDetail = computed(() => (store.snapshot ? buildFileDetail(store.snapshot, files.value, store.selectedEntityId) : null));
  /** A11: the Hotspots screen shows sample values whenever any file's plotted signal does. */
  const filesUseSample = computed(() => files.value.some((f) => isSampleBacked(f.priority) || isSampleBacked(f.complexity)));
```

- [ ] **Step 7: Run and confirm the tests pass.** `npx vitest run tests/unit/file-detail-model.test.ts tests/unit/read-models.test.ts` → PASS.

- [ ] **Step 8: Gate and commit.** `npm run typecheck && npm run lint:fast && npx eslint src/ui/read-models src/ui/fixtures src/ui/inspector-copy.ts --max-warnings 0`

```bash
git add src/ui tests
git commit -m "feat(ui): file-detail read model with seeded sample findings

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Architecture screen: map, matrix, module inspector

**Files:**
- Create:
  - `src/ui/unique-id.ts`
  - `src/ui/kit/tab-types.ts`, `src/ui/kit/Tabs.vue`
  - `src/ui/screens/NoSnapshot.vue`
  - `src/ui/screens/ArchitectureScreen.vue`
  - `src/ui/screens/architecture/map-layout.ts`, `ModuleMap.vue`, `DependencyMatrix.vue`, `ModuleInspector.vue`
- Modify: `src/ui/App.vue`, `src/ui/inspector-copy.ts`, `src/ui/styles/kit.css`, `src/ui/styles/screens.css`
- Test: `tests/unit/module-map-layout.test.ts`, `tests/component/architecture-screen.test.ts`

**Interfaces:**
- Consumes: `useReadModels().architecture`/`.files` (Task 3); `moduleNeighbours`, `edgeKey`, `ModuleSummary`, `ModuleEdge`, `MatrixCell` (Task 3); `moduleOf`, `moduleLabel` (Task 1)
- Produces:
  - `useUniqueId(prefix: string): string`
  - `TabItem { id: string; label: string }`
  - `<Tabs v-model:string :tabs :label>`, with slots `toolbar` and default (the panel)
  - `<NoSnapshot />`
  - map-layout: `MAP_W = 720`, `MAP_H = 420`, `NodePos { name; x; y }`, `nodePositions(names)`, `edgePath(a, b)`, `toPercent(p): { left: string; top: string }`
  - `ArchitectureScreen` local state: `tab: Ref<string>`, `selectedModule: Ref<string | null>`, `selectedEdge: Ref<{ from: string; to: string } | null>`, `violationsOnly: Ref<boolean>`. Task 7 extends it.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/module-map-layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAP_H, MAP_W, edgePath, nodePositions, toPercent } from '../../src/ui/screens/architecture/map-layout';

describe('module map layout', () => {
  it('places nodes deterministically inside the canvas, the first at the top', () => {
    const ps = nodePositions(['a', 'b', 'c', 'd']);
    expect(nodePositions(['a', 'b', 'c', 'd'])).toEqual(ps);
    expect(ps[0]!.y).toBeLessThan(MAP_H / 2);
    for (const p of ps) {
      expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(MAP_W);
      expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(MAP_H);
    }
  });
  it('centres a single node', () => {
    expect(nodePositions(['only'])).toEqual([{ name: 'only', x: MAP_W / 2, y: MAP_H / 2 }]);
  });
  it('bends opposite edges to opposite sides', () => {
    const [a, b] = nodePositions(['a', 'b']);
    expect(edgePath(a!, b!)).not.toEqual(edgePath(b!, a!));
    expect(edgePath(a!, b!)).toMatch(/^M[\d.-]+,[\d.-]+ Q[\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+$/);
  });
  it('converts to percentages of the canvas', () => {
    expect(toPercent({ name: 'x', x: MAP_W / 2, y: MAP_H / 4 })).toEqual({ left: '50.00%', top: '25.00%' });
  });
});
```

Create `tests/component/architecture-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import ArchitectureScreen from '../../src/ui/screens/ArchitectureScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(files = 60, directories = 6) {
  const snap = buildSnapshotFixture({ files, directories });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}
const mountArch = () => mount(ArchitectureScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('ArchitectureScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('asks for a codebase without a snapshot', () => {
    const w = mountArch();
    expect(w.text()).toContain('No snapshot yet');
    w.unmount();
  });

  it('shows collected modules and sample edges, cycles and unknown violations', () => {
    withSnapshot();
    const w = mountArch();
    const cards = w.findAll('.ci-metric-card');
    expect(cards).toHaveLength(4);
    expect(cards[0]!.find('.ci-metric-card__value').text()).toBe('6');
    expect(cards[0]!.find('.ci-provenance').exists()).toBe(false);
    expect(cards[1]!.find('.ci-provenance--sample').exists()).toBe(true);
    expect(cards[3]!.find('.ci-metric-card__value').text()).toBe('—');
    w.unmount();
  });

  it('draws one accessible node per module and labels the graph as sample', () => {
    withSnapshot();
    const w = mountArch();
    const nodes = w.findAll('.ci-module-map__node');
    expect(nodes).toHaveLength(6);
    expect(nodes[0]!.attributes('aria-label')).toMatch(/files, \d+ outgoing, \d+ incoming$/);
    expect(w.find('.ci-module-map svg').attributes('aria-hidden')).toBe('true');
    expect(w.find('.ci-module-map__eyebrow .ci-provenance--sample').exists()).toBe(true);
    w.unmount();
  });

  it('selecting a node shows it in the module inspector', async () => {
    withSnapshot();
    const w = mountArch();
    await w.findAll('.ci-module-map__node')[2]!.trigger('click');
    expect(w.findAll('.ci-module-map__node')[2]!.attributes('aria-pressed')).toBe('true');
    expect(w.find('.ci-module-inspector').text()).toContain(w.findAll('.ci-module-map__node')[2]!.find('.ci-module-map__name').text());
    w.unmount();
  });

  it('opens on the selected file\'s module (P12)', () => {
    const snap = withSnapshot();
    const file = snap.entities.find((e) => e.kind === 'file' && e.path.startsWith('dir-4/'))!;
    useCityStore().select(file.id);
    const w = mountArch();
    expect(w.find('.ci-module-map__node--selected .ci-module-map__name').text()).toBe('dir-4');
    w.unmount();
  });

  it('arrow keys move between tabs and focus the new tab; the matrix is n × n', async () => {
    withSnapshot();
    const w = mountArch();
    await w.find('[role="tab"]').trigger('keydown', { key: 'ArrowRight' });
    await nextTick();
    const matrixTab = w.findAll('[role="tab"]')[1]!;
    expect(matrixTab.attributes('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(matrixTab.element);
    expect(w.findAll('.ci-matrix thead th')).toHaveLength(7);
    expect(w.findAll('.ci-matrix tbody tr')).toHaveLength(6);
    w.unmount();
  });

  it('a matrix cell selects its edge and the edge\'s importing module', async () => {
    withSnapshot();
    const w = mountArch();
    await w.findAll('[role="tab"]')[1]!.trigger('click');
    const cell = w.find('.ci-matrix__cell');
    await cell.trigger('click');
    expect(cell.attributes('aria-pressed')).toBe('true');
    expect(cell.attributes('aria-label')).toMatch(/imports .*sample import statements$/);
    w.unmount();
  });

  it('a module-inspector file opens File detail, keeping the camera', async () => {
    withSnapshot();
    const store = useCityStore();
    const w = mountArch();
    await w.find('.ci-module-inspector__file').trigger('click');
    expect(store.route).toBe('file');
    expect(store.selectedEntityId).not.toBeNull();
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('violations only hides every edge while no rule exists', async () => {
    withSnapshot();
    const w = mountArch();
    expect(w.findAll('.ci-module-map__edge').length).toBeGreaterThan(0);
    await w.find('.ci-architecture__toggle input').setValue(true);
    expect(w.findAll('.ci-module-map__edge')).toHaveLength(0);
    w.unmount();
  });

  it('two mounted maps never share a marker id', () => {
    withSnapshot();
    const a = mountArch(); const b = mountArch();
    const id = (w: ReturnType<typeof mountArch>) => w.find('marker').attributes('id');
    expect(id(a)).not.toBe(id(b));
    a.unmount(); b.unmount();
  });
});
```

- [ ] **Step 2: Run and confirm they fail.** `npx vitest run tests/unit/module-map-layout.test.ts tests/component/architecture-screen.test.ts` → FAIL.

- [ ] **Step 3: Shared bits.** Create `src/ui/unique-id.ts`:

```ts
import { useId } from 'vue';

// Vue's useId() is unique only within ONE app, and every leaf mounts its own app
// (src/host/city-view.ts). The module-level counter keeps ids unique across leaves too,
// for the same reason CommandPalette.vue keeps its own `paletteSequence`.
let sequence = 0;

/** Call from <script setup> only (useId needs a component instance). */
export function useUniqueId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${useId()}-${sequence}`;
}
```

Create `src/ui/kit/tab-types.ts`:

```ts
export interface TabItem { id: string; label: string }
```

Create `src/ui/kit/Tabs.vue`:

```vue
<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useUniqueId } from '../unique-id';
import type { TabItem } from './tab-types';

const props = defineProps<{ tabs: readonly TabItem[]; label: string }>();
const model = defineModel<string>({ required: true });
const base = useUniqueId('ci-tabs');
const list = ref<HTMLElement | null>(null);

/** WAI-ARIA tabs with automatic activation: arrows, Home and End move AND select, and
 *  focus follows onto the new tab. Only the selected tab is a tab stop. */
function onKeydown(event: KeyboardEvent): void {
  const n = props.tabs.length;
  const i = props.tabs.findIndex((t) => t.id === model.value);
  const target = event.key === 'ArrowRight' ? (i + 1) % n
    : event.key === 'ArrowLeft' ? (i - 1 + n) % n
      : event.key === 'Home' ? 0
        : event.key === 'End' ? n - 1 : -1;
  const tab = props.tabs[target];
  if (!tab) return;
  event.preventDefault();
  model.value = tab.id;
  void nextTick(() => list.value?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
}
</script>

<template>
  <div class="ci-tabs">
    <div class="ci-tabs__bar">
      <div
        ref="list"
        role="tablist"
        class="ci-tabs__list"
        :aria-label="label"
        @keydown="onKeydown"
      >
        <button
          v-for="t in tabs"
          :id="`${base}-tab-${t.id}`"
          :key="t.id"
          type="button"
          role="tab"
          class="ci-tabs__tab"
          :aria-selected="t.id === model"
          :aria-controls="`${base}-panel`"
          :tabindex="t.id === model ? 0 : -1"
          @click="model = t.id"
        >
          {{ t.label }}
        </button>
      </div>
      <slot name="toolbar" />
    </div>
    <div
      :id="`${base}-panel`"
      role="tabpanel"
      class="ci-tabs__panel"
      :aria-labelledby="`${base}-tab-${model}`"
    >
      <slot />
    </div>
  </div>
</template>
```

Create `src/ui/screens/NoSnapshot.vue`:

```vue
<script setup lang="ts">
import { inject } from 'vue';
import { COPY_02 } from '../copy';
import { SCREEN_NO_SNAPSHOT } from '../inspector-copy';

const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});
</script>

<template>
  <div class="ci-overview__empty ci-no-snapshot">
    <p>{{ SCREEN_NO_SNAPSHOT }}</p>
    <button
      type="button"
      class="mod-cta"
      @click="onSelectCodebase"
    >
      {{ COPY_02 }}
    </button>
  </div>
</template>
```

- [ ] **Step 4: Copy.** Append to `inspector-copy.ts`:

```ts
/** Part 2 §2.1: Architecture screen. */
export const SCREEN_NO_SNAPSHOT = 'No snapshot yet. Select a codebase and run a scan to see this screen.';
export const ARCH_EYEBROW = 'Explore / Architecture';
export const ARCH_TITLE = 'Architecture, without the guesswork.';
export const ARCH_SUBTITLE = 'Explore module dependencies and compare them with your intended boundaries.';
export const ARCH_VIEWS_LABEL = 'Architecture views';
export const ARCH_TAB_MAP = 'Dependency map';
export const ARCH_TAB_MATRIX = 'Dependency matrix';
export const ARCH_VIOLATIONS_ONLY = 'Violations only';
export const ARCH_MAP_FOOTNOTE = 'Arrows: importer → imported module. Sample edges, not observed imports. City arcs make no dependency claim.';
export const ARCH_MAP_EYEBROW = 'Sample module graph';
export const ARCH_NODE_LABEL = (label: string, files: number, outgoing: number, incoming: number): string =>
  `${label}, ${files} files, ${outgoing} outgoing, ${incoming} incoming`;
export const ARCH_NODE_FILES = (files: number): string => `${files} files`;
export const ARCH_OMITTED_NOTE = (n: number): string => `${n} smaller modules are not shown in the graph.`;
export const ARCH_MATRIX_CAPTION = 'Sample import statements from each row module to each column module';
export const ARCH_MATRIX_CORNER = 'From ↓ / To →';
export const ARCH_MATRIX_SELF = 'Same module';
export const ARCH_MATRIX_NO_EDGE = 'No imports';
export const ARCH_MATRIX_CELL_LABEL = (from: string, to: string, n: string): string => `${from} imports ${to}: ${n} sample import statements`;
export const ARCH_MODULE_INSPECTOR_TITLE = 'Selected module';
export const ARCH_MODULE_NONE = 'Select a module in the map.';
export const ARCH_FACT_FILES = 'Files';
export const ARCH_FACT_LINES = 'Lines';
export const ARCH_FACT_IMPORTS = 'Imports';
export const ARCH_FACT_IMPORTED_BY = 'Imported by';
export const ARCH_NONE = 'None';
export const ARCH_TOP_FILES = 'Highest review priority';
```

- [ ] **Step 5: Map geometry.** Create `src/ui/screens/architecture/map-layout.ts`:

```ts
// Part 2 §2.1: the dependency map's geometry. Pure, so it is unit-tested without a DOM.
// Nodes sit on an ellipse starting at 12 o'clock. The SVG draws only the edges; the nodes
// are HTML buttons positioned by percentage over the same box (aspect-ratio 720 / 420).
export const MAP_W = 720;
export const MAP_H = 420;
const RX = 280;
const RY = 160;
const NODE_GAP = 44;
const BEND = 18;

export interface NodePos { name: string; x: number; y: number }

export function nodePositions(names: readonly string[]): NodePos[] {
  if (names.length === 1) return [{ name: names[0]!, x: MAP_W / 2, y: MAP_H / 2 }];
  return names.map((name, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / names.length;
    return { name, x: MAP_W / 2 + RX * Math.cos(a), y: MAP_H / 2 + RY * Math.sin(a) };
  });
}

/** A gently bent path from `a` to `b`, trimmed so the arrowhead stops short of the node.
 *  The bend is to the right of the direction of travel, so a→b and b→a never overlap. */
export function edgePath(a: NodePos, b: NodePos): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = a.x + ux * NODE_GAP; const y1 = a.y + uy * NODE_GAP;
  const x2 = b.x - ux * NODE_GAP; const y2 = b.y - uy * NODE_GAP;
  const cx = (x1 + x2) / 2 - uy * BEND; const cy = (y1 + y2) / 2 + ux * BEND;
  const f = (n: number): string => n.toFixed(1);
  return `M${f(x1)},${f(y1)} Q${f(cx)},${f(cy)} ${f(x2)},${f(y2)}`;
}

export function toPercent(p: NodePos): { left: string; top: string } {
  return { left: `${((p.x / MAP_W) * 100).toFixed(2)}%`, top: `${((p.y / MAP_H) * 100).toFixed(2)}%` };
}
```

- [ ] **Step 6: ModuleMap.vue.** Create `src/ui/screens/architecture/ModuleMap.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { edgeKey, type ModuleEdge, type ModuleSummary } from '../../read-models/architecture';
import { ARCH_MAP_EYEBROW, ARCH_NODE_FILES, ARCH_NODE_LABEL } from '../../inspector-copy';
import { useUniqueId } from '../../unique-id';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';
import { MAP_H, MAP_W, edgePath, nodePositions, toPercent } from './map-layout';

const props = defineProps<{
  modules: readonly ModuleSummary[]; edges: readonly ModuleEdge[];
  violating: ReadonlySet<string>; violationsOnly: boolean; selected: string | null;
}>();
const emit = defineEmits<{ select: [name: string] }>();
const markerId = useUniqueId('ci-map-arrow');

const positions = computed(() => new Map(nodePositions(props.modules.map((m) => m.name)).map((p) => [p.name, p])));

const nodes = computed(() => props.modules.flatMap((m) => {
  const pos = positions.value.get(m.name);
  if (!pos) return [];
  const outgoing = props.edges.filter((e) => e.from === m.name).length;
  const incoming = props.edges.filter((e) => e.to === m.name).length;
  return [{ m, style: toPercent(pos), label: ARCH_NODE_LABEL(m.label, m.fileCount, outgoing, incoming) }];
}));

const drawn = computed(() => props.edges.flatMap((e) => {
  const a = positions.value.get(e.from);
  const b = positions.value.get(e.to);
  const violation = props.violating.has(edgeKey(e.from, e.to));
  if (!a || !b || (props.violationsOnly && !violation)) return [];
  return [{ key: edgeKey(e.from, e.to), d: edgePath(a, b), violation, active: e.from === props.selected || e.to === props.selected }];
}));
</script>

<template>
  <figure class="ci-module-map">
    <figcaption class="ci-module-map__eyebrow">
      {{ ARCH_MAP_EYEBROW }}
      <ProvenanceBadge state="sample" />
    </figcaption>
    <div class="ci-module-map__canvas">
      <svg
        class="ci-module-map__edges"
        :viewBox="`0 0 ${MAP_W} ${MAP_H}`"
        aria-hidden="true"
      >
        <defs>
          <marker
            :id="markerId"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path
              class="ci-module-map__arrow"
              d="M0,0 L10,5 L0,10 z"
            />
          </marker>
          <marker
            :id="`${markerId}-v`"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path
              class="ci-module-map__arrow ci-module-map__arrow--violation"
              d="M0,0 L10,5 L0,10 z"
            />
          </marker>
        </defs>
        <path
          v-for="e in drawn"
          :key="e.key"
          class="ci-module-map__edge"
          :class="{ 'ci-module-map__edge--violation': e.violation, 'ci-module-map__edge--active': e.active }"
          :d="e.d"
          fill="none"
          :marker-end="`url(#${e.violation ? `${markerId}-v` : markerId})`"
        />
      </svg>
      <button
        v-for="n in nodes"
        :key="n.m.name"
        type="button"
        class="ci-module-map__node"
        :class="{ 'ci-module-map__node--selected': n.m.name === selected }"
        :style="n.style"
        :aria-pressed="n.m.name === selected"
        :aria-label="n.label"
        @click="emit('select', n.m.name)"
      >
        <span class="ci-module-map__name">{{ n.m.label }}</span>
        <span class="ci-module-map__meta">{{ ARCH_NODE_FILES(n.m.fileCount) }}</span>
      </button>
    </div>
  </figure>
</template>
```

- [ ] **Step 7: DependencyMatrix.vue.** Create `src/ui/screens/architecture/DependencyMatrix.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { formatMetric, hasValue } from '../../evidence';
import { edgeKey, type MatrixCell, type ModuleSummary } from '../../read-models/architecture';
import {
  ARCH_MATRIX_CAPTION, ARCH_MATRIX_CELL_LABEL, ARCH_MATRIX_CORNER, ARCH_MATRIX_NO_EDGE, ARCH_MATRIX_SELF,
} from '../../inspector-copy';

const props = defineProps<{
  modules: readonly ModuleSummary[]; matrix: readonly (readonly MatrixCell[])[];
  violating: ReadonlySet<string>; violationsOnly: boolean; selectedEdge: { from: string; to: string } | null;
}>();
const emit = defineEmits<{ 'select-edge': [edge: { from: string; to: string }] }>();

const labels = computed(() => new Map(props.modules.map((m) => [m.name, m.label])));
const labelOf = (name: string): string => labels.value.get(name) ?? name;
const maxImports = computed(() => Math.max(1, ...props.matrix.flat().flatMap((c) => (c.edge && hasValue(c.edge.imports) ? [c.edge.imports.value] : []))));
/** Intensity 1–4 from the edge's share of the largest edge; the number is always shown too. */
function level(cell: MatrixCell): number {
  const v = cell.edge?.imports.value;
  return v === undefined ? 1 : Math.max(1, Math.ceil((v / maxImports.value) * 4));
}
const isViolation = (c: MatrixCell): boolean => props.violating.has(edgeKey(c.from, c.to));
const isSelected = (c: MatrixCell): boolean => props.selectedEdge?.from === c.from && props.selectedEdge.to === c.to;
</script>

<template>
  <div class="ci-matrix__scroll">
    <table class="ci-matrix">
      <caption class="visually-hidden">
        {{ ARCH_MATRIX_CAPTION }}
      </caption>
      <thead>
        <tr>
          <th
            scope="col"
            class="ci-matrix__corner"
          >
            {{ ARCH_MATRIX_CORNER }}
          </th>
          <th
            v-for="m in modules"
            :key="m.name"
            scope="col"
          >
            {{ m.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, i) in matrix"
          :key="modules[i]?.name ?? i"
        >
          <th scope="row">
            {{ modules[i]?.label }}
          </th>
          <td
            v-for="cell in row"
            :key="cell.to"
            class="ci-matrix__td"
          >
            <template v-if="cell.from === cell.to">
              <span aria-hidden="true">—</span><span class="visually-hidden">{{ ARCH_MATRIX_SELF }}</span>
            </template>
            <button
              v-else-if="cell.edge"
              type="button"
              class="ci-matrix__cell"
              :class="[`ci-matrix__cell--l${level(cell)}`, {
                'ci-matrix__cell--violation': isViolation(cell),
                'ci-matrix__cell--dimmed': violationsOnly && !isViolation(cell),
                'ci-matrix__cell--selected': isSelected(cell),
              }]"
              :aria-pressed="isSelected(cell)"
              :aria-label="ARCH_MATRIX_CELL_LABEL(labelOf(cell.from), labelOf(cell.to), formatMetric(cell.edge.imports))"
              @click="emit('select-edge', { from: cell.from, to: cell.to })"
            >
              {{ formatMetric(cell.edge.imports) }}
            </button>
            <template v-else>
              <span aria-hidden="true">·</span><span class="visually-hidden">{{ ARCH_MATRIX_NO_EDGE }}</span>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 8: ModuleInspector.vue.** Create `src/ui/screens/architecture/ModuleInspector.vue`:

```vue
<script setup lang="ts">
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric } from '../../evidence';
import type { ModuleSummary } from '../../read-models/architecture';
import { moduleLabel } from '../../read-models/file-summaries';
import {
  ARCH_FACT_FILES, ARCH_FACT_IMPORTED_BY, ARCH_FACT_IMPORTS, ARCH_FACT_LINES, ARCH_MODULE_INSPECTOR_TITLE,
  ARCH_MODULE_NONE, ARCH_NONE, ARCH_TOP_FILES,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ module: ModuleSummary | null; incoming: readonly string[]; outgoing: readonly string[] }>();
const emit = defineEmits<{ 'open-file': [id: EntityId] }>();
</script>

<template>
  <div class="ci-module-inspector">
    <Panel
      :title="ARCH_MODULE_INSPECTOR_TITLE"
      :subtitle="module ? module.label : ARCH_MODULE_NONE"
    >
      <template v-if="module">
        <dl class="ci-facts">
          <dt>{{ ARCH_FACT_FILES }}</dt>
          <dd>{{ module.fileCount }}</dd>
          <dt>{{ ARCH_FACT_LINES }}</dt>
          <dd>
            {{ formatMetric(module.lines) }}
            <ProvenanceBadge
              v-if="module.lines.state !== 'collected'"
              :state="module.lines.state"
              :detail="module.lines.reason"
            />
          </dd>
          <dt>{{ ARCH_FACT_IMPORTS }} <ProvenanceBadge state="sample" /></dt>
          <dd>{{ outgoing.map(moduleLabel).join(', ') || ARCH_NONE }}</dd>
          <dt>{{ ARCH_FACT_IMPORTED_BY }} <ProvenanceBadge state="sample" /></dt>
          <dd>{{ incoming.map(moduleLabel).join(', ') || ARCH_NONE }}</dd>
        </dl>
        <p class="ci-module-inspector__heading">
          {{ ARCH_TOP_FILES }}
        </p>
        <ul class="ci-module-inspector__files">
          <li
            v-for="f in module.topFiles"
            :key="f.id"
          >
            <button
              type="button"
              class="ci-module-inspector__file"
              @click="emit('open-file', f.id)"
            >
              <span class="ci-file-cell">
                <span class="ci-file-cell__name">{{ f.name }}</span>
                <span class="ci-file-cell__path">{{ f.path }}</span>
              </span>
              <span class="ci-priority">{{ formatMetric(f.priority) }} / 100</span>
            </button>
          </li>
        </ul>
      </template>
    </Panel>
  </div>
</template>
```

- [ ] **Step 9: The screen.** Create `src/ui/screens/ArchitectureScreen.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { moduleNeighbours } from '../read-models/architecture';
import { moduleOf } from '../read-models/file-summaries';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import {
  ARCH_EYEBROW, ARCH_MAP_FOOTNOTE, ARCH_OMITTED_NOTE, ARCH_SUBTITLE, ARCH_TAB_MAP, ARCH_TAB_MATRIX, ARCH_TITLE,
  ARCH_VIEWS_LABEL, ARCH_VIOLATIONS_ONLY,
} from '../inspector-copy';
import type { TabItem } from '../kit/tab-types';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import Tabs from '../kit/Tabs.vue';
import NoSnapshot from './NoSnapshot.vue';
import ModuleMap from './architecture/ModuleMap.vue';
import DependencyMatrix from './architecture/DependencyMatrix.vue';
import ModuleInspector from './architecture/ModuleInspector.vue';

const TABS: readonly TabItem[] = [
  { id: 'map', label: ARCH_TAB_MAP },
  { id: 'matrix', label: ARCH_TAB_MATRIX },
];

const store = useCityStore();
const { architecture, files } = useReadModels();
const tab = ref('map');
const violationsOnly = ref(false);

/** P12: open on the selected file's module when it is in the graph. Derived once from the
 *  shared selection, so there is no new cross-screen state. */
function initialModule(): string | null {
  const names = architecture.value.modules.map((m) => m.name);
  const file = files.value.find((f) => f.id === store.selectedEntityId);
  const own = file ? moduleOf(file.path) : null;
  return own !== null && names.includes(own) ? own : names[0] ?? null;
}

const selectedModule = ref<string | null>(initialModule());
const selectedEdge = ref<{ from: string; to: string } | null>(null);
const moduleSummary = computed(() => architecture.value.modules.find((m) => m.name === selectedModule.value) ?? null);
const neighbours = computed(() => (selectedModule.value
  ? moduleNeighbours(architecture.value, selectedModule.value) : { incoming: [], outgoing: [] }));

function selectEdge(edge: { from: string; to: string }): void {
  selectedEdge.value = edge;
  selectedModule.value = edge.from;
}

/** Selection goes through the ONE owner and never moves the camera. */
function openFile(id: EntityId): void {
  store.select(id);
  store.navigate('file');
}
</script>

<template>
  <div class="ci-screen ci-screen--architecture">
    <PageHeader
      :eyebrow="ARCH_EYEBROW"
      :title="ARCH_TITLE"
      :subtitle="ARCH_SUBTITLE"
    />
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else>
      <div class="ci-overview__cards">
        <MetricCard
          v-for="card in architecture.cards"
          :key="card.id"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :caption="card.caption"
          :tone="card.tone"
        />
      </div>
      <div class="ci-architecture__grid">
        <Panel :footnote="ARCH_MAP_FOOTNOTE">
          <Tabs
            v-model="tab"
            :tabs="TABS"
            :label="ARCH_VIEWS_LABEL"
          >
            <template #toolbar>
              <label class="ci-architecture__toggle">
                <input
                  v-model="violationsOnly"
                  type="checkbox"
                >
                {{ ARCH_VIOLATIONS_ONLY }}
              </label>
            </template>
            <ModuleMap
              v-if="tab === 'map'"
              :modules="architecture.modules"
              :edges="architecture.edges"
              :violating="architecture.violatingEdgeKeys"
              :violations-only="violationsOnly"
              :selected="selectedModule"
              @select="selectedModule = $event"
            />
            <DependencyMatrix
              v-else-if="tab === 'matrix'"
              :modules="architecture.modules"
              :matrix="architecture.matrix"
              :violating="architecture.violatingEdgeKeys"
              :violations-only="violationsOnly"
              :selected-edge="selectedEdge"
              @select-edge="selectEdge"
            />
          </Tabs>
          <p
            v-if="architecture.omittedModules > 0"
            class="ci-architecture__note"
          >
            {{ ARCH_OMITTED_NOTE(architecture.omittedModules) }}
          </p>
        </Panel>
        <aside class="ci-architecture__inspectors">
          <ModuleInspector
            :module="moduleSummary"
            :incoming="neighbours.incoming"
            :outgoing="neighbours.outgoing"
            @open-file="openFile"
          />
        </aside>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 10: Route it.** In `src/ui/App.vue`, import `ArchitectureScreen from './screens/ArchitectureScreen.vue'` and add it before `<PlaceholderScreen v-else …>`:

```vue
      <ArchitectureScreen v-else-if="store.route === 'architecture'" />
```

- [ ] **Step 11: CSS.** First, give every existing `var(--font-ui-smaller)`, `var(--font-ui-small)`, `var(--font-ui-medium)` and `var(--font-ui-large)` in `src/ui/styles/kit.css` its em fallback (`0.8em`, `0.9em`, `1em`, `1.15em`), for example `var(--font-ui-smaller, 0.8em)`. This is the deferred minor. Task 10 adds the test that pins it for all three files.

Then append to `kit.css`:

```css
/* Part 2: tabs (kit/Tabs.vue). */
:where(.codebase-inspector-root) .ci-tabs__bar {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--ci-space-3);
  padding-bottom: var(--ci-space-3); border-bottom: 1px solid var(--ci-border);
}
:where(.codebase-inspector-root) .ci-tabs__list {
  display: inline-flex; gap: var(--ci-space-1); padding: var(--ci-space-1);
  border: 1px solid var(--ci-border); border-radius: var(--ci-radius-control);
}
:where(.codebase-inspector-root) button.ci-tabs__tab {
  height: auto; padding: var(--ci-space-1) var(--ci-space-3); border: none; box-shadow: none;
  background: transparent; color: var(--ci-text-muted); font-size: var(--font-ui-small, 0.9em);
}
:where(.codebase-inspector-root) button.ci-tabs__tab[aria-selected="true"] { background: var(--ci-raised); color: var(--ci-text); }
:where(.codebase-inspector-root) .ci-tabs__panel { padding-top: var(--ci-space-4); }
:where(.codebase-inspector-root) .ci-facts {
  display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--ci-space-2) var(--ci-space-4); margin: 0;
}
:where(.codebase-inspector-root) .ci-facts dt { color: var(--ci-text-muted); display: flex; gap: var(--ci-space-2); align-items: center; }
:where(.codebase-inspector-root) .ci-facts dd { margin: 0; overflow-wrap: anywhere; }
```

Append to `screens.css`:

```css
/* Part 2: Architecture. */
:where(.codebase-inspector-root) .ci-architecture__grid { display: grid; gap: var(--ci-space-4); grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr); align-items: start; }
@container (max-width: 900px) {
  :where(.codebase-inspector-root) .ci-architecture__grid { grid-template-columns: minmax(0, 1fr); }
}
:where(.codebase-inspector-root) .ci-architecture__inspectors { display: flex; flex-direction: column; gap: var(--ci-space-4); min-width: 0; }
:where(.codebase-inspector-root) .ci-architecture__toggle { display: inline-flex; align-items: center; gap: var(--ci-space-2); color: var(--ci-text-muted); font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-architecture__note { margin: var(--ci-space-3) 0 0; color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-module-map { margin: 0; }
:where(.codebase-inspector-root) .ci-module-map__eyebrow {
  display: flex; align-items: center; gap: var(--ci-space-2); margin-bottom: var(--ci-space-2);
  color: var(--ci-text-faint); font-size: var(--font-ui-smaller, 0.8em); text-transform: uppercase; letter-spacing: 0.08em;
}
:where(.codebase-inspector-root) .ci-module-map__canvas { position: relative; aspect-ratio: 720 / 420; min-height: 260px; }
:where(.codebase-inspector-root) .ci-module-map__edges { position: absolute; inset: 0; width: 100%; height: 100%; }
:where(.codebase-inspector-root) .ci-module-map__edge { stroke: var(--ci-text-faint); stroke-width: 1.2; opacity: 0.55; }
:where(.codebase-inspector-root) .ci-module-map__edge--active { opacity: 1; stroke: var(--ci-tone-accent); }
:where(.codebase-inspector-root) .ci-module-map__edge--violation { stroke: var(--ci-tone-danger); stroke-dasharray: 5 4; opacity: 1; }
:where(.codebase-inspector-root) .ci-module-map__arrow { fill: var(--ci-text-faint); }
:where(.codebase-inspector-root) .ci-module-map__arrow--violation { fill: var(--ci-tone-danger); }
:where(.codebase-inspector-root) button.ci-module-map__node {
  position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: flex-start;
  gap: 2px; height: auto; min-width: 7.5em; padding: var(--ci-space-2) var(--ci-space-3);
  border: 1px solid var(--ci-border); border-left: 3px solid var(--ci-tone-accent); border-radius: var(--ci-radius-card);
  background: var(--ci-panel); box-shadow: none; color: var(--ci-text); text-align: left; cursor: pointer;
}
:where(.codebase-inspector-root) button.ci-module-map__node--selected { border-color: var(--ci-tone-accent); background: var(--ci-raised); }
:where(.codebase-inspector-root) .ci-module-map__name { font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-module-map__meta { color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-matrix__scroll { overflow-x: auto; }
:where(.codebase-inspector-root) .ci-matrix { border-collapse: separate; border-spacing: 4px; font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-matrix th { color: var(--ci-text-muted); font-weight: normal; text-align: center; padding: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-matrix tbody th { text-align: left; }
:where(.codebase-inspector-root) .ci-matrix__td { min-width: 3.5em; height: 2.75em; text-align: center; border: 1px solid var(--ci-border); border-radius: var(--ci-radius-small); color: var(--ci-text-faint); }
:where(.codebase-inspector-root) button.ci-matrix__cell {
  width: 100%; height: 100%; min-height: 2.5em; border: none; box-shadow: none; border-radius: var(--ci-radius-small);
  color: var(--ci-text); font-family: var(--ci-font-mono); cursor: pointer;
}
:where(.codebase-inspector-root) button.ci-matrix__cell--l1 { background: color-mix(in srgb, var(--ci-tone-accent) 18%, transparent); }
:where(.codebase-inspector-root) button.ci-matrix__cell--l2 { background: color-mix(in srgb, var(--ci-tone-accent) 32%, transparent); }
:where(.codebase-inspector-root) button.ci-matrix__cell--l3 { background: color-mix(in srgb, var(--ci-tone-accent) 48%, transparent); }
:where(.codebase-inspector-root) button.ci-matrix__cell--l4 { background: color-mix(in srgb, var(--ci-tone-accent) 64%, transparent); }
:where(.codebase-inspector-root) button.ci-matrix__cell--violation { outline: 2px dashed var(--ci-tone-danger); outline-offset: -2px; }
:where(.codebase-inspector-root) button.ci-matrix__cell--dimmed { opacity: 0.3; }
:where(.codebase-inspector-root) button.ci-matrix__cell--selected { box-shadow: 0 0 0 2px var(--ci-focus); }
:where(.codebase-inspector-root) .ci-module-inspector__heading { margin: var(--ci-space-4) 0 var(--ci-space-2); color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); text-transform: uppercase; letter-spacing: 0.06em; }
:where(.codebase-inspector-root) .ci-module-inspector__files { list-style: none; margin: 0; padding: 0; }
:where(.codebase-inspector-root) button.ci-module-inspector__file {
  display: flex; justify-content: space-between; align-items: center; gap: var(--ci-space-3); width: 100%; height: auto;
  padding: var(--ci-space-2) 0; border: none; border-radius: 0; box-shadow: none; background: transparent;
  color: var(--ci-text); text-align: left; cursor: pointer;
}
:where(.codebase-inspector-root) button.ci-module-inspector__file:hover { background: var(--ci-raised); }
```

- [ ] **Step 12: Run and confirm the tests pass.** `npx vitest run tests/unit/module-map-layout.test.ts tests/component/architecture-screen.test.ts tests/component/workspace-shell.test.ts` → PASS.

- [ ] **Step 13: Gate and commit.** `npm run typecheck && npm run lint:fast && npx eslint src/ui --max-warnings 0`

```bash
git add src/ui tests
git commit -m "feat(ui): architecture screen — sample module map, matrix, module inspector

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Boundary rules: table, editor, boundary inspector

**Files:**
- Create: `src/ui/screens/architecture/BoundaryRuleTable.vue`, `RuleEditor.vue`, `BoundaryInspector.vue`
- Modify: `src/ui/screens/ArchitectureScreen.vue`, `src/ui/inspector-copy.ts`, `src/ui/styles/screens.css`
- Test: `tests/component/architecture-rules.test.ts`

**Interfaces:**
- Consumes: `review-store.addRule`/`removeRule`/`hasRule` (Task 2); `RuleEvaluation`, `ModuleEdge`, `ModuleSummary` (Task 3); `ArchitectureScreen` state (Task 6)
- Produces:
  - `RuleEditor` (props `modules`, `initialFrom`; emits `close`, `saved(id)`)
  - `BoundaryRuleTable` (props `rules`; emits `select(id)`, `remove(id)`, `add()`)
  - `BoundaryInspector` (props `evaluation`, `edge`, `violating`, `illustrative`; emits `open-file(id)`)

- [ ] **Step 1: Write the failing test.** Create `tests/component/architecture-rules.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import ArchitectureScreen from '../../src/ui/screens/ArchitectureScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { architectureGraphFor } from '../../src/ui/read-models/architecture';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const NOW = new Date('2026-09-21T10:00:00.000Z');
function setup() {
  const snap = buildSnapshotFixture({ files: 60, directories: 6 });
  useCityStore().setCity(snap, computeLayout(snap));
  const graph = architectureGraphFor(fileSummariesFor(snap));
  const edge = graph.edges[0]!;
  const names = graph.modules.map((m) => m.name);
  const free = names.flatMap((a) => names.map((b) => [a, b] as const))
    .find(([a, b]) => a !== b && !graph.edges.some((e) => e.from === a && e.to === b))!;
  return { edge, free };
}
const mountArch = () => mount(ArchitectureScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
const openRulesTab = async (w: ReturnType<typeof mountArch>) => { await w.findAll('[role="tab"]')[2]!.trigger('click'); };

describe('boundary rules', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('the rules tab starts empty with an add action that opens the editor', async () => {
    setup();
    const w = mountArch();
    await openRulesTab(w);
    expect(w.find('.ci-rule-table__empty').exists()).toBe(true);
    await w.find('.ci-rule-table__empty button').trigger('click');
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    w.unmount();
  });

  it('saves a rule from the editor, only with a rationale, and shows it on the rules tab', async () => {
    const { free } = setup();
    const w = mountArch();
    await w.find('.ci-page-header__actions button').trigger('click');
    const [from, to] = w.findAll('.ci-rule-editor select');
    await from!.setValue(free[0]);
    await to!.setValue(free[1]);
    expect(w.find('.ci-rule-editor button[type="submit"]').attributes('disabled')).toBeDefined();
    await w.find('.ci-rule-editor textarea').setValue('Keep layers apart');
    await w.find('.ci-rule-editor').trigger('submit');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(w.find('[role="tab"][aria-selected="true"]').text()).toBe('Boundary rules');
    expect(w.find('.ci-table').text()).toContain(`${free[0]} must not import ${free[1]}`);
    expect(w.find('.ci-table').text()).toContain('Passing');
    w.unmount();
  });

  it('warns when both modules are the same', async () => {
    setup();
    const w = mountArch();
    await w.find('.ci-page-header__actions button').trigger('click');
    const [from, to] = w.findAll('.ci-rule-editor select');
    await to!.setValue((from!.element as HTMLSelectElement).value);
    expect(w.find('.ci-rule-editor__error').text()).toBe('Choose two different modules.');
    w.unmount();
  });

  it('a rule over an existing edge is a sample violation: card, dashed edge, inspector', async () => {
    const { edge } = setup();
    await useReviewStore().addRule(edge.from, edge.to, 'No shortcuts', NOW);
    const w = mountArch();
    const violations = w.findAll('.ci-metric-card')[3]!;
    expect(violations.find('.ci-metric-card__value').text()).toBe(String(edge.imports.value));
    expect(violations.find('.ci-provenance--sample').exists()).toBe(true);
    await w.find('.ci-architecture__toggle input').setValue(true);
    expect(w.findAll('.ci-module-map__edge--violation')).toHaveLength(1);
    await openRulesTab(w);
    await w.find('.ci-table__row').trigger('click');
    expect(w.find('.ci-boundary').text()).toContain('No shortcuts');
    expect(w.findAll('.ci-boundary .ci-module-inspector__file').length).toBeGreaterThan(0);
    w.unmount();
  });

  it('refuses a duplicate pair with an inline message', async () => {
    const { free } = setup();
    await useReviewStore().addRule(free[0], free[1], 'x', NOW);
    const w = mountArch();
    await w.find('.ci-page-header__actions button').trigger('click');
    const [from, to] = w.findAll('.ci-rule-editor select');
    await from!.setValue(free[0]);
    await to!.setValue(free[1]);
    await w.find('.ci-rule-editor textarea').setValue('again');
    await w.find('.ci-rule-editor').trigger('submit');
    await flushPromises();
    expect(w.find('.ci-rule-editor__error').text()).toBe('A rule for these two modules already exists.');
    w.unmount();
  });

  it('removes a rule; Enter on Remove never activates the row', async () => {
    const { free } = setup();
    await useReviewStore().addRule(free[0], free[1], 'x', NOW);
    const w = mountArch();
    await openRulesTab(w);
    const remove = w.find('.ci-rule-table__remove');
    await remove.trigger('keydown', { key: 'Enter' });
    expect(w.find('.ci-boundary').text()).not.toContain('AR-001');
    await remove.trigger('click');
    await flushPromises();
    expect(useReviewStore().ruleCount).toBe(0);
    expect(w.find('.ci-rule-table__empty').exists()).toBe(true);
    w.unmount();
  });
});
```

- [ ] **Step 2: Run and confirm it fails.** `npx vitest run tests/component/architecture-rules.test.ts` → FAIL.

- [ ] **Step 3: Copy.** Append to `inspector-copy.ts`:

```ts
/** Part 2 §2.1: boundary rules (P5). */
export const ARCH_TAB_RULES = 'Boundary rules';
export const ARCH_ADD_RULE = 'Add boundary rule';
export const RULE_EDITOR_TITLE = 'Add boundary rule';
export const RULE_EDITOR_HINT = 'Record an intended boundary. It is evaluated against the sample module edges.';
export const RULE_EDITOR_FROM = 'Module';
export const RULE_EDITOR_TO = 'must not import';
export const RULE_EDITOR_RATIONALE = 'Rationale';
export const RULE_EDITOR_SAVE = 'Save rule';
export const RULE_EDITOR_CANCEL = 'Cancel';
export const RULE_EDITOR_SAME_MODULE = 'Choose two different modules.';
export const RULE_EDITOR_DUPLICATE = 'A rule for these two modules already exists.';
export const RULE_EDITOR_FAILED = 'Could not save this rule.';
export const RULES_EMPTY = 'No boundary rules yet. Add one to compare an intended boundary with the sample edges.';
export const RULES_TABLE_CAPTION = 'Boundary rules';
export const RULE_COL_ID = 'Rule';
export const RULE_COL_RULE = 'Boundary';
export const RULE_COL_STATUS = 'Status';
export const RULE_COL_IMPORTS = 'Violating imports';
export const RULE_COL_ACTIONS = 'Actions';
export const RULE_SENTENCE = (from: string, to: string): string => `${from} must not import ${to}`;
export const RULE_STATUS_LABEL: Readonly<Record<'passing' | 'violation' | 'not-evaluated', string>> = {
  passing: 'Passing', violation: 'Violation', 'not-evaluated': 'Not evaluated',
};
export const RULE_REMOVE = 'Remove';
export const RULE_REMOVE_LABEL = (id: string): string => `Remove rule ${id}`;
export const RULE_REMOVE_FAILED = 'Could not remove this rule.';
export const BOUNDARY_INSPECTOR_TITLE = 'Boundary inspector';
export const BOUNDARY_INSPECTOR_SUBTITLE = 'Intended rule vs. sample evidence.';
export const BOUNDARY_VIOLATING_IMPORTS = 'Violating imports';
export const BOUNDARY_EDGE_IMPORTS = (n: string): string => `${n} sample import statements`;
export const BOUNDARY_EDGE_VIOLATES = 'This edge breaks a boundary rule.';
export const BOUNDARY_EDGE_NO_RULE = 'No boundary rule covers this edge.';
export const BOUNDARY_NONE = 'Select a rule or a matrix cell to inspect it.';
export const BOUNDARY_ILLUSTRATIVE = 'Illustrative files';
```

- [ ] **Step 4: RuleEditor.vue.** Create `src/ui/screens/architecture/RuleEditor.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ModuleSummary } from '../../read-models/architecture';
import { useReviewStore } from '../../stores/review-store';
import { useUniqueId } from '../../unique-id';
import {
  RULE_EDITOR_CANCEL, RULE_EDITOR_DUPLICATE, RULE_EDITOR_FAILED, RULE_EDITOR_FROM, RULE_EDITOR_HINT,
  RULE_EDITOR_RATIONALE, RULE_EDITOR_SAME_MODULE, RULE_EDITOR_SAVE, RULE_EDITOR_TITLE, RULE_EDITOR_TO,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';

const props = defineProps<{ modules: readonly ModuleSummary[]; initialFrom: string | null }>();
const emit = defineEmits<{ close: []; saved: [id: string] }>();
const review = useReviewStore();
const base = useUniqueId('ci-rule');

const from = ref(props.initialFrom ?? props.modules[0]?.name ?? '');
const to = ref(props.modules.find((m) => m.name !== from.value)?.name ?? '');
const rationale = ref('');
const error = ref('');
const saving = ref(false);
const invalid = computed(() => from.value === '' || to.value === '' || from.value === to.value || rationale.value.trim() === '');

/** Intent only: the rule is recorded through the review port and evaluated against
 *  sample edges. Nothing in the source is touched. */
async function save(): Promise<void> {
  if (invalid.value || saving.value) return;
  error.value = '';
  if (review.hasRule(from.value, to.value)) { error.value = RULE_EDITOR_DUPLICATE; return; }
  saving.value = true;
  try {
    const rule = await review.addRule(from.value, to.value, rationale.value, new Date());
    if (rule) emit('saved', rule.id); else error.value = RULE_EDITOR_DUPLICATE;
  } catch {
    error.value = RULE_EDITOR_FAILED;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <CiDialog
    :label="RULE_EDITOR_TITLE"
    @close="emit('close')"
  >
    <form
      class="ci-rule-editor"
      @submit.prevent="save"
    >
      <h3 class="ci-rule-editor__title">
        {{ RULE_EDITOR_TITLE }}
      </h3>
      <p class="ci-rule-editor__hint">
        {{ RULE_EDITOR_HINT }}
      </p>
      <label :for="`${base}-from`">{{ RULE_EDITOR_FROM }}</label>
      <select
        :id="`${base}-from`"
        v-model="from"
        class="dropdown"
      >
        <option
          v-for="m in modules"
          :key="m.name"
          :value="m.name"
        >
          {{ m.label }}
        </option>
      </select>
      <label :for="`${base}-to`">{{ RULE_EDITOR_TO }}</label>
      <select
        :id="`${base}-to`"
        v-model="to"
        class="dropdown"
      >
        <option
          v-for="m in modules"
          :key="m.name"
          :value="m.name"
        >
          {{ m.label }}
        </option>
      </select>
      <label :for="`${base}-why`">{{ RULE_EDITOR_RATIONALE }}</label>
      <textarea
        :id="`${base}-why`"
        v-model="rationale"
        rows="3"
      />
      <p
        v-if="from !== '' && from === to"
        class="ci-rule-editor__error"
        role="alert"
      >
        {{ RULE_EDITOR_SAME_MODULE }}
      </p>
      <p
        v-else-if="error"
        class="ci-rule-editor__error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="ci-rule-editor__actions">
        <button
          type="button"
          @click="emit('close')"
        >
          {{ RULE_EDITOR_CANCEL }}
        </button>
        <button
          type="submit"
          class="mod-cta"
          :disabled="invalid || saving"
        >
          {{ RULE_EDITOR_SAVE }}
        </button>
      </div>
    </form>
  </CiDialog>
</template>
```

- [ ] **Step 5: BoundaryRuleTable.vue.** Create `src/ui/screens/architecture/BoundaryRuleTable.vue`:

```vue
<script setup lang="ts">
import { formatMetric } from '../../evidence';
import type { RuleEvaluation } from '../../read-models/architecture';
import { moduleLabel } from '../../read-models/file-summaries';
import {
  ARCH_ADD_RULE, RULE_COL_ACTIONS, RULE_COL_ID, RULE_COL_IMPORTS, RULE_COL_RULE, RULE_COL_STATUS, RULE_REMOVE,
  RULE_REMOVE_LABEL, RULE_SENTENCE, RULE_STATUS_LABEL, RULES_EMPTY, RULES_TABLE_CAPTION,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ rules: readonly RuleEvaluation[] }>();
const emit = defineEmits<{ select: [id: string]; remove: [id: string]; add: [] }>();

const columns: readonly TableColumn<RuleEvaluation>[] = [
  { key: 'id', label: RULE_COL_ID, sortValue: (r) => r.rule.id },
  { key: 'rule', label: RULE_COL_RULE, sortValue: (r) => `${r.rule.from}->${r.rule.to}` },
  { key: 'status', label: RULE_COL_STATUS, sortValue: (r) => r.status },
  { key: 'imports', label: RULE_COL_IMPORTS, numeric: true, sortValue: (r) => r.violatingImports.value ?? null },
  { key: 'actions', label: RULE_COL_ACTIONS },
];
</script>

<template>
  <div
    v-if="rules.length === 0"
    class="ci-rule-table__empty"
  >
    <p>{{ RULES_EMPTY }}</p>
    <button
      type="button"
      class="mod-cta"
      @click="emit('add')"
    >
      {{ ARCH_ADD_RULE }}
    </button>
  </div>
  <EvidenceTable
    v-else
    :columns="columns"
    :rows="rules"
    :row-key="(r) => r.rule.id"
    :caption="RULES_TABLE_CAPTION"
    @activate="emit('select', $event.rule.id)"
  >
    <template #cell-id="{ row }">
      <code>{{ row.rule.id }}</code>
    </template>
    <template #cell-rule="{ row }">
      {{ RULE_SENTENCE(moduleLabel(row.rule.from), moduleLabel(row.rule.to)) }}
    </template>
    <template #cell-status="{ row }">
      <span
        class="ci-rule-status"
        :class="`ci-rule-status--${row.status}`"
      >{{ RULE_STATUS_LABEL[row.status] }}</span>
      <ProvenanceBadge
        v-if="row.status !== 'not-evaluated'"
        state="sample"
      />
    </template>
    <template #cell-imports="{ row }">
      {{ formatMetric(row.violatingImports) }}
    </template>
    <template #cell-actions="{ row }">
      <button
        type="button"
        class="ci-rule-table__remove"
        :aria-label="RULE_REMOVE_LABEL(row.rule.id)"
        @click.stop="emit('remove', row.rule.id)"
        @keydown.stop
      >
        {{ RULE_REMOVE }}
      </button>
    </template>
  </EvidenceTable>
</template>
```

- [ ] **Step 6: BoundaryInspector.vue.** Create `src/ui/screens/architecture/BoundaryInspector.vue`:

```vue
<script setup lang="ts">
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric } from '../../evidence';
import type { ModuleEdge, RuleEvaluation } from '../../read-models/architecture';
import { moduleLabel, type FileSummary } from '../../read-models/file-summaries';
import {
  BOUNDARY_EDGE_IMPORTS, BOUNDARY_EDGE_NO_RULE, BOUNDARY_EDGE_VIOLATES, BOUNDARY_ILLUSTRATIVE, BOUNDARY_INSPECTOR_SUBTITLE,
  BOUNDARY_INSPECTOR_TITLE, BOUNDARY_NONE, BOUNDARY_VIOLATING_IMPORTS, RULE_SENTENCE, RULE_STATUS_LABEL,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{
  evaluation: RuleEvaluation | null; edge: ModuleEdge | null; violating: boolean; illustrative: readonly FileSummary[];
}>();
const emit = defineEmits<{ 'open-file': [id: EntityId] }>();
</script>

<template>
  <div class="ci-boundary">
    <Panel
      :title="BOUNDARY_INSPECTOR_TITLE"
      :subtitle="BOUNDARY_INSPECTOR_SUBTITLE"
    >
      <template v-if="evaluation">
        <p class="ci-boundary__id">
          <code>{{ evaluation.rule.id }}</code>
          <span
            class="ci-rule-status"
            :class="`ci-rule-status--${evaluation.status}`"
          >{{ RULE_STATUS_LABEL[evaluation.status] }}</span>
        </p>
        <p class="ci-boundary__rule">
          {{ RULE_SENTENCE(moduleLabel(evaluation.rule.from), moduleLabel(evaluation.rule.to)) }}
        </p>
        <p class="ci-boundary__rationale">
          {{ evaluation.rule.rationale }}
        </p>
        <p class="ci-boundary__count">
          {{ BOUNDARY_VIOLATING_IMPORTS }}: {{ formatMetric(evaluation.violatingImports) }}
          <ProvenanceBadge
            :state="evaluation.violatingImports.state"
            :detail="evaluation.violatingImports.reason"
          />
        </p>
      </template>
      <template v-else-if="edge">
        <p class="ci-boundary__flow">
          <code>{{ moduleLabel(edge.from) }}</code> → <code>{{ moduleLabel(edge.to) }}</code>
        </p>
        <p class="ci-boundary__count">
          {{ BOUNDARY_EDGE_IMPORTS(formatMetric(edge.imports)) }}
          <ProvenanceBadge state="sample" />
        </p>
        <p>{{ violating ? BOUNDARY_EDGE_VIOLATES : BOUNDARY_EDGE_NO_RULE }}</p>
      </template>
      <p
        v-else
        class="ci-boundary__empty"
      >
        {{ BOUNDARY_NONE }}
      </p>
      <template v-if="illustrative.length">
        <p class="ci-module-inspector__heading">
          {{ BOUNDARY_ILLUSTRATIVE }} <ProvenanceBadge state="sample" />
        </p>
        <ul class="ci-module-inspector__files">
          <li
            v-for="f in illustrative"
            :key="f.id"
          >
            <button
              type="button"
              class="ci-module-inspector__file"
              @click="emit('open-file', f.id)"
            >
              <span class="ci-file-cell">
                <span class="ci-file-cell__name">{{ f.name }}</span>
                <span class="ci-file-cell__path">{{ f.path }}</span>
              </span>
            </button>
          </li>
        </ul>
      </template>
    </Panel>
  </div>
</template>
```

- [ ] **Step 7: Extend the screen.** In `ArchitectureScreen.vue`:
- Add imports: `watch`; `useReviewStore`; `Icon`; the three new components; `ARCH_ADD_RULE`, `ARCH_TAB_RULES`, `RULE_REMOVE_FAILED`.
- Add `{ id: 'rules', label: ARCH_TAB_RULES }` to `TABS`.
- Add the state and functions below.
- Replace `selectEdge`.
- Fill the header's actions slot, render the rules tab and the boundary inspector, and add the dialog and live region, as shown.

```ts
const review = useReviewStore();
const selectedRuleId = ref<string | null>(null);
const editorOpen = ref(false);
const liveMessage = ref('');
const selectedRule = computed(() => architecture.value.rules.find((r) => r.rule.id === selectedRuleId.value) ?? null);
const selectedEdgeModel = computed(() => {
  const s = selectedEdge.value;
  return s ? architecture.value.edges.find((e) => e.from === s.from && e.to === s.to) ?? null : null;
});
/** The from-module's highest-priority files, shown only when there ARE imports to
 *  illustrate: a violating rule, or a selected edge. Labelled sample. */
const illustrative = computed(() => {
  const from = selectedRule.value?.rule.from ?? selectedEdgeModel.value?.from ?? null;
  const shows = selectedRule.value ? selectedRule.value.status === 'violation' : selectedEdgeModel.value !== null;
  if (!shows || from === null) return [];
  return architecture.value.modules.find((m) => m.name === from)?.topFiles.slice(0, 3) ?? [];
});
const edgeViolates = computed(() => {
  const e = selectedEdgeModel.value;
  return e ? architecture.value.violatingEdgeKeys.has(`${e.from}->${e.to}`) : false;
});
watch(() => architecture.value.rules, (rules) => {
  if (selectedRuleId.value && !rules.some((r) => r.rule.id === selectedRuleId.value)) selectedRuleId.value = null;
});

function selectEdge(edge: { from: string; to: string }): void {
  selectedEdge.value = edge;
  selectedRuleId.value = null;
  selectedModule.value = edge.from;
}
function selectRule(id: string): void {
  selectedRuleId.value = id;
  selectedEdge.value = null;
}
function onSaved(id: string): void {
  editorOpen.value = false;
  tab.value = 'rules';
  selectRule(id);
}
async function removeRule(id: string): Promise<void> {
  try {
    await review.removeRule(id);
  } catch {
    liveMessage.value = RULE_REMOVE_FAILED;
  }
}
```

Template changes. The PageHeader gains:

```vue
      <template #actions>
        <button
          v-if="store.snapshot"
          type="button"
          :disabled="architecture.modules.length < 2"
          @click="editorOpen = true"
        >
          <Icon name="plus" />
          {{ ARCH_ADD_RULE }}
        </button>
      </template>
```

After the `DependencyMatrix` element, inside `<Tabs>`:

```vue
            <BoundaryRuleTable
              v-else
              :rules="architecture.rules"
              @select="selectRule"
              @remove="removeRule"
              @add="editorOpen = true"
            />
```

In `<aside>`, before `ModuleInspector`:

```vue
          <BoundaryInspector
            :evaluation="selectedRule"
            :edge="selectedEdgeModel"
            :violating="edgeViolates"
            :illustrative="illustrative"
            @open-file="openFile"
          />
```

Just before the root `</div>`:

```vue
    <p
      class="visually-hidden"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <RuleEditor
      v-if="editorOpen"
      :modules="architecture.modules"
      :initial-from="selectedModule"
      @close="editorOpen = false"
      @saved="onSaved"
    />
```

- [ ] **Step 8: CSS.** Append to `screens.css`:

```css
:where(.codebase-inspector-root) .ci-rule-table__empty { display: flex; flex-direction: column; align-items: flex-start; gap: var(--ci-space-3); color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-rule-status { font-weight: var(--font-semibold); margin-right: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-rule-status--violation { color: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-rule-status--passing { color: var(--ci-tone-success); }
:where(.codebase-inspector-root) .ci-rule-status--not-evaluated { color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-boundary__id { display: flex; align-items: center; gap: var(--ci-space-2); margin: 0; }
:where(.codebase-inspector-root) .ci-boundary__rule { margin: var(--ci-space-3) 0 var(--ci-space-1); font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-boundary__rationale,
:where(.codebase-inspector-root) .ci-boundary__empty { margin: 0; color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-boundary__count { display: flex; align-items: center; gap: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-rule-editor { display: flex; flex-direction: column; gap: var(--ci-space-2); min-width: min(26em, 80vw); padding: var(--ci-space-4); }
:where(.codebase-inspector-root) .ci-rule-editor__title { margin: 0; }
:where(.codebase-inspector-root) .ci-rule-editor__hint { margin: 0 0 var(--ci-space-2); color: var(--ci-text-muted); font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-rule-editor__error { margin: 0; color: var(--ci-error); font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-rule-editor__actions { display: flex; justify-content: flex-end; gap: var(--ci-space-2); margin-top: var(--ci-space-3); }
```

- [ ] **Step 9: Run and confirm the tests pass.** `npx vitest run tests/component/architecture-rules.test.ts tests/component/architecture-screen.test.ts` → PASS.

- [ ] **Step 10: Gate and commit.** `npm run typecheck && npm run lint:fast && npx eslint src/ui --max-warnings 0`. `ArchitectureScreen.vue` must stay under 400 lines. If it grows past ~300, extract the rules-state block into a composable `src/ui/screens/architecture/use-boundary-selection.ts` and report that.

```bash
git add src/ui tests
git commit -m "feat(ui): boundary rules — editor, table and inspector over sample edges

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Hotspots screen

**Files:**
- Create: `src/ui/screens/HotspotsScreen.vue`, `src/ui/screens/hotspots/HotspotScatter.vue`, `PriorityList.vue`, `HotspotTable.vue`, `PriorityFormulaDialog.vue`
- Modify: `src/ui/App.vue`, `src/ui/inspector-copy.ts`, `src/ui/styles/screens.css`
- Test: `tests/component/hotspots-screen.test.ts`

**Interfaces:**
- Consumes: `buildHotspotsModel`, `hotspotsCsv`, `TABLE_PAGE`, `CHURN_THRESHOLD`, `HotspotsModel`, `HotspotPoint` (Task 4); `downloadText` (Task 4); EvidenceTable `limit` (Task 4); `HIGH_COMPLEXITY` (overview.ts); `NoSnapshot`, `useUniqueId` (Task 6)
- Produces: the `hotspots` route. Selecting a dot selects without navigating; "Open detail", shortlist items and table rows select and navigate to `file`.

- [ ] **Step 1: Write the failing test.** Create `tests/component/hotspots-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import HotspotsScreen from '../../src/ui/screens/HotspotsScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(files = 40, directories = 3) {
  const snap = buildSnapshotFixture({ files, directories });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountHot = () => mount(HotspotsScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('HotspotsScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('asks for a codebase without a snapshot', () => {
    const w = mountHot();
    expect(w.text()).toContain('No snapshot yet');
    w.unmount();
  });

  it('plots one dot per file and shortlists five', () => {
    withSnapshot();
    const w = mountHot();
    expect(w.findAll('.ci-scatter__dot')).toHaveLength(40);
    expect(w.findAll('.ci-shortlist__item')).toHaveLength(5);
    w.unmount();
  });

  it('the module filter narrows dots and rows; the text filter can empty the table', async () => {
    withSnapshot();
    const w = mountHot();
    await w.find('.ci-hotspots__module').setValue('dir-1');
    expect(w.findAll('.ci-scatter__dot').length).toBeLessThan(40);
    expect(w.findAll('.ci-table__row').every((r) => r.text().includes('dir-1/'))).toBe(true);
    await w.find('.ci-hotspot-table input').setValue('no-such-file');
    expect(w.text()).toContain('No files match this filter.');
    w.unmount();
  });

  it('shows 100 rows, then 100 more', async () => {
    withSnapshot(250);
    const w = mountHot();
    expect(w.findAll('.ci-table__row')).toHaveLength(100);
    await w.find('.ci-hotspot-table__more').trigger('click');
    expect(w.findAll('.ci-table__row')).toHaveLength(200);
    w.unmount();
  });

  it('a dot selects without navigating or moving the camera; Open detail navigates', async () => {
    withSnapshot();
    const store = useCityStore();
    store.navigate('hotspots');
    const w = mountHot();
    await w.findAll('.ci-scatter__dot')[3]!.trigger('click');
    expect(store.selectedEntityId).not.toBeNull();
    expect(store.route).toBe('hotspots');
    expect(store.camera).toBeNull();
    await w.find('.ci-hotspots__selected button').trigger('click');
    expect(store.route).toBe('file');
    w.unmount();
  });

  it('arrow keys move the single tab stop between dots; Enter selects', async () => {
    withSnapshot();
    const w = mountHot();
    const dots = () => w.findAll('.ci-scatter__dot');
    expect(dots().filter((d) => d.attributes('tabindex') === '0')).toHaveLength(1);
    await w.find('.ci-scatter svg').trigger('keydown', { key: 'ArrowRight' });
    await nextTick();
    expect(dots()[1]!.attributes('tabindex')).toBe('0');
    await w.find('.ci-scatter svg').trigger('keydown', { key: 'Enter' });
    expect(useCityStore().selectedEntityId).toBe(dots()[1]!.attributes('data-entity-id'));
    w.unmount();
  });

  it('explains the priority formula in a dialog that Escape closes', async () => {
    withSnapshot();
    const w = mountHot();
    await w.find('.ci-hotspots__how').trigger('click');
    expect(w.find('[role="dialog"]').text()).toContain('0.42 × complexity/48');
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });

  it('exports every filtered row as CSV through downloadText', async () => {
    withSnapshot(250);
    const w = mountHot();
    await w.find('.ci-hotspots__export').trigger('click');
    const [host, filename, text] = vi.mocked(downloadText).mock.calls[0]!;
    expect(host).toBe(w.find('.ci-screen--hotspots').element);
    expect(filename).toBe('codebase-hotspots.csv');
    expect(text.split('\r\n')).toHaveLength(252);
    w.unmount();
  });

  it('a table row opens File detail', async () => {
    withSnapshot();
    const store = useCityStore();
    const w = mountHot();
    await w.find('.ci-table__row').trigger('click');
    expect(store.route).toBe('file');
    expect(store.selectedEntityId).not.toBeNull();
    w.unmount();
  });
});
```

- [ ] **Step 2: Run and confirm it fails.** `npx vitest run tests/component/hotspots-screen.test.ts` → FAIL.

- [ ] **Step 3: Copy.** Append to `inspector-copy.ts`:

```ts
/** Part 2 §2.2: Hotspots screen. */
export const HOTSPOTS_EYEBROW = 'Explore / Hotspots';
export const HOTSPOTS_TITLE = 'Focus effort where it can matter.';
export const HOTSPOTS_SUBTITLE = 'Review files that combine difficult logic, repeated change and weak safety nets.';
export const HOTSPOTS_HOW_PRIORITY = 'How priority works';
export const HOTSPOTS_EXPORT = 'Export shortlist';
export const HOTSPOTS_CSV_FILENAME = 'codebase-hotspots.csv';
export const HOTSPOTS_SCATTER_TITLE = 'Complexity × change frequency';
export const HOTSPOTS_SCATTER_SUBTITLE = 'Each dot is one file. Select a dot to inspect its evidence.';
export const HOTSPOTS_SCATTER_FOOTNOTE = 'Size: source lines (ring: unknown) · Colour: branch coverage · Window: 90 days · Sample signals';
export const HOTSPOTS_SCATTER_LABEL = 'Files by complexity and commits in the last 90 days';
export const HOTSPOTS_X_AXIS = 'Commits in the last 90 days →';
export const HOTSPOTS_Y_AXIS = 'Max. function cognitive complexity →';
export const HOTSPOTS_QUADRANT_LABEL = 'Complex + frequently changed';
export const HOTSPOTS_DOT_LABEL = (name: string, complexity: string, commits: string, coverage: string): string =>
  `${name}: complexity ${complexity}, ${commits} commits, ${coverage} branch coverage`;
export const HOTSPOTS_BAND_LABEL: Readonly<Record<'low' | 'mid' | 'high' | 'unknown', string>> = {
  low: '< 60% branch coverage', mid: '60–79%', high: '≥ 80%', unknown: 'Coverage unknown',
};
export const HOTSPOTS_MODULE_FILTER = 'Module';
export const HOTSPOTS_ALL_MODULES = 'All modules';
export const HOTSPOTS_SHOWING = (n: number, total: number): string => `Showing the ${n} highest-priority of ${total} files.`;
export const HOTSPOTS_UNPLOTTABLE = (n: number): string => `${n} files lack complexity or commit data and are not plotted.`;
export const HOTSPOTS_SELECTED = (name: string): string => `Selected: ${name}`;
export const HOTSPOTS_OPEN_DETAIL = 'Open detail';
export const HOTSPOTS_SHORTLIST_TITLE = 'Highest review priorities';
export const HOTSPOTS_SHORTLIST_SUBTITLE = 'Use this as an investigation queue, not an automatic verdict.';
export const HOTSPOTS_SHORTLIST_DETAIL = (complexity: string, commits: string, coverage: string): string =>
  `${complexity} complexity · ${commits} commits · ${coverage} covered`;
export const HOTSPOTS_TABLE_TITLE = 'Hotspot inventory';
export const HOTSPOTS_TABLE_SUBTITLE = (n: number): string => `${n} files in the selected module scope.`;
export const HOTSPOTS_FILTER_PLACEHOLDER = 'Filter files…';
export const HOTSPOTS_SORT_NOTE = 'Sorted by review priority, descending';
export const HOTSPOTS_NO_RESULTS = 'No files match this filter.';
export const HOTSPOTS_SHOW_MORE = (n: number): string => `Show ${n} more`;
export const HOTSPOTS_COL_FILE = 'File';
export const HOTSPOTS_COL_PRIORITY = 'Priority';
export const HOTSPOTS_COL_COMPLEXITY = 'Complexity';
export const HOTSPOTS_COL_COMMITS = 'Commits / 90d';
export const HOTSPOTS_COL_COVERAGE = 'Branch coverage';
export const PRIORITY_DIALOG_TITLE = 'How priority works';
export const PRIORITY_FORMULA = 'min(100, round(100 × (0.42 × complexity/48 + 0.35 × commits90d/44 + 0.23 × (1 − covered/total))))';
export const PRIORITY_TERMS: readonly { term: string; meaning: string }[] = [
  { term: 'complexity', meaning: 'Maximum cognitive complexity of any function in the file.' },
  { term: 'commits90d', meaning: 'Commits that touched the file in the last 90 days.' },
  { term: 'covered/total', meaning: 'Instrumented branches covered by tests.' },
];
export const PRIORITY_CAVEAT = 'A transparent sample heuristic for ordering an investigation. It is not a defect probability, a maintainability index, an industry benchmark or a team-performance score.';
export const PRIORITY_UNKNOWN_RULE = 'A file missing any of these inputs has an unknown priority. It is never scored as 0.';
export const DIALOG_CLOSE = 'Close';
```

- [ ] **Step 4: HotspotScatter.vue.** Create `src/ui/screens/hotspots/HotspotScatter.vue`:

```vue
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric } from '../../evidence';
import { CHURN_THRESHOLD, type HotspotPoint, type HotspotsModel } from '../../read-models/hotspots';
import { HIGH_COMPLEXITY } from '../../read-models/overview';
import {
  HOTSPOTS_BAND_LABEL, HOTSPOTS_DOT_LABEL, HOTSPOTS_QUADRANT_LABEL, HOTSPOTS_SCATTER_LABEL, HOTSPOTS_X_AXIS, HOTSPOTS_Y_AXIS,
} from '../../inspector-copy';

const props = defineProps<{ model: HotspotsModel; selectedId: EntityId | null }>();
const emit = defineEmits<{ select: [id: EntityId] }>();

const W = 640; const H = 340; const L = 48; const R = 12; const T = 12; const B = 40;
const R_MIN = 3; const R_MAX = 10; const TICKS = 5;
const BANDS = ['low', 'mid', 'high', 'unknown'] as const;

const sx = (v: number): number => L + (v / props.model.xMax) * (W - L - R);
const sy = (v: number): number => T + (1 - v / props.model.yMax) * (H - T - B);
const radius = (p: HotspotPoint): number => (p.lines === null ? R_MIN : R_MIN + (R_MAX - R_MIN) * Math.sqrt(p.lines / props.model.linesMax));
const ticks = (max: number): number[] => Array.from({ length: TICKS + 1 }, (_, i) => (max / TICKS) * i);
const quadrant = computed(() => {
  const { xMax, yMax } = props.model;
  if (xMax <= CHURN_THRESHOLD || yMax <= HIGH_COMPLEXITY) return null;
  return { x: sx(CHURN_THRESHOLD), y: sy(yMax), width: sx(xMax) - sx(CHURN_THRESHOLD), height: sy(HIGH_COMPLEXITY) - sy(yMax) };
});
const dotLabel = (p: HotspotPoint): string => HOTSPOTS_DOT_LABEL(
  p.file.name, formatMetric(p.file.complexity), formatMetric(p.file.commits90d), formatMetric(p.file.branchCoverage, '%'),
);

/** Roving tabindex: exactly one dot is a tab stop. Arrows walk the dots in priority
 *  order, Home and End jump, and Enter or Space selects. Selecting never navigates. */
const active = ref(0);
watch(() => [props.model.points, props.selectedId] as const, ([points, id]) => {
  const i = points.findIndex((p) => p.file.id === id);
  active.value = i >= 0 ? i : Math.min(active.value, Math.max(0, points.length - 1));
}, { immediate: true });

const svg = ref<SVGSVGElement | null>(null);
function onKeydown(event: KeyboardEvent): void {
  const n = props.model.points.length;
  if (n === 0) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const p = props.model.points[active.value];
    if (p) emit('select', p.file.id);
    return;
  }
  const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (active.value + 1) % n
    : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (active.value - 1 + n) % n
      : event.key === 'Home' ? 0
        : event.key === 'End' ? n - 1 : -1;
  if (next < 0) return;
  event.preventDefault();
  active.value = next;
  void nextTick(() => svg.value?.querySelectorAll<SVGElement>('.ci-scatter__dot')[next]?.focus());
}
function onDot(i: number, id: EntityId): void {
  active.value = i;
  emit('select', id);
}
</script>

<template>
  <figure class="ci-scatter">
    <svg
      ref="svg"
      :viewBox="`0 0 ${W} ${H}`"
      role="group"
      :aria-label="HOTSPOTS_SCATTER_LABEL"
      @keydown="onKeydown"
    >
      <g aria-hidden="true">
        <rect
          v-if="quadrant"
          class="ci-scatter__quadrant"
          :x="quadrant.x"
          :y="quadrant.y"
          :width="quadrant.width"
          :height="quadrant.height"
        />
        <text
          v-if="quadrant"
          class="ci-scatter__quadrant-label"
          :x="W - R - 6"
          :y="T + 14"
          text-anchor="end"
        >{{ HOTSPOTS_QUADRANT_LABEL }}</text>
        <g class="ci-scatter__grid">
          <g
            v-for="t in ticks(model.yMax)"
            :key="`y${t}`"
          >
            <line
              :x1="L"
              :x2="W - R"
              :y1="sy(t)"
              :y2="sy(t)"
            />
            <text
              :x="L - 6"
              :y="sy(t) + 4"
              text-anchor="end"
            >{{ Math.round(t) }}</text>
          </g>
          <text
            v-for="t in ticks(model.xMax)"
            :key="`x${t}`"
            :x="sx(t)"
            :y="H - B + 16"
            text-anchor="middle"
          >{{ Math.round(t) }}</text>
          <text
            :x="(L + W - R) / 2"
            :y="H - 4"
            text-anchor="middle"
          >{{ HOTSPOTS_X_AXIS }}</text>
          <text
            :transform="`translate(12 ${(T + H - B) / 2}) rotate(-90)`"
            text-anchor="middle"
          >{{ HOTSPOTS_Y_AXIS }}</text>
        </g>
      </g>
      <circle
        v-for="(p, i) in model.points"
        :key="p.file.id"
        class="ci-scatter__dot"
        :class="[`ci-scatter__dot--${p.band}`, { 'ci-scatter__dot--ring': p.lines === null, 'ci-scatter__dot--selected': p.file.id === selectedId }]"
        :cx="sx(p.x)"
        :cy="sy(p.y)"
        :r="radius(p)"
        role="button"
        :data-entity-id="p.file.id"
        :tabindex="i === active ? 0 : -1"
        :aria-label="dotLabel(p)"
        :aria-pressed="p.file.id === selectedId"
        @click="onDot(i, p.file.id)"
      />
    </svg>
    <figcaption class="ci-scatter__legend">
      <span
        v-for="band in BANDS"
        :key="band"
        class="ci-scatter__key"
        :class="`ci-scatter__key--${band}`"
      >{{ HOTSPOTS_BAND_LABEL[band] }}</span>
    </figcaption>
  </figure>
</template>
```

- [ ] **Step 5: PriorityList.vue.** Create `src/ui/screens/hotspots/PriorityList.vue`:

```vue
<script setup lang="ts">
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric } from '../../evidence';
import type { FileSummary } from '../../read-models/file-summaries';
import { HOTSPOTS_NO_RESULTS, HOTSPOTS_SHORTLIST_DETAIL } from '../../inspector-copy';

defineProps<{ files: readonly FileSummary[] }>();
const emit = defineEmits<{ open: [id: EntityId] }>();
</script>

<template>
  <ol
    v-if="files.length"
    class="ci-shortlist"
  >
    <li
      v-for="(f, i) in files"
      :key="f.id"
    >
      <button
        type="button"
        class="ci-shortlist__item"
        @click="emit('open', f.id)"
      >
        <span class="ci-shortlist__rank">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="ci-shortlist__text">
          <span class="ci-shortlist__name">{{ f.name }}</span>
          <span class="ci-shortlist__detail">{{ HOTSPOTS_SHORTLIST_DETAIL(formatMetric(f.complexity), formatMetric(f.commits90d), formatMetric(f.branchCoverage, '%')) }}</span>
        </span>
        <span class="ci-priority">{{ formatMetric(f.priority) }}</span>
      </button>
    </li>
  </ol>
  <p
    v-else
    class="ci-hotspots__note"
  >
    {{ HOTSPOTS_NO_RESULTS }}
  </p>
</template>
```

- [ ] **Step 6: HotspotTable.vue.** Create `src/ui/screens/hotspots/HotspotTable.vue`:

```vue
<script setup lang="ts">
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric } from '../../evidence';
import type { FileSummary } from '../../read-models/file-summaries';
import { TABLE_PAGE } from '../../read-models/hotspots';
import {
  HOTSPOTS_COL_COMMITS, HOTSPOTS_COL_COMPLEXITY, HOTSPOTS_COL_COVERAGE, HOTSPOTS_COL_FILE, HOTSPOTS_COL_PRIORITY,
  HOTSPOTS_FILTER_PLACEHOLDER, HOTSPOTS_NO_RESULTS, HOTSPOTS_SHOW_MORE, HOTSPOTS_SORT_NOTE, HOTSPOTS_TABLE_TITLE,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';

defineProps<{ rows: readonly FileSummary[]; limit: number }>();
const query = defineModel<string>('query', { required: true });
const emit = defineEmits<{ open: [id: EntityId]; more: [] }>();

const columns: readonly TableColumn<FileSummary>[] = [
  { key: 'file', label: HOTSPOTS_COL_FILE, sortValue: (r) => r.path },
  { key: 'priority', label: HOTSPOTS_COL_PRIORITY, numeric: true, sortValue: (r) => r.priority.value ?? null },
  { key: 'complexity', label: HOTSPOTS_COL_COMPLEXITY, numeric: true, sortValue: (r) => r.complexity.value ?? null },
  { key: 'commits', label: HOTSPOTS_COL_COMMITS, numeric: true, sortValue: (r) => r.commits90d.value ?? null },
  { key: 'coverage', label: HOTSPOTS_COL_COVERAGE, numeric: true, sortValue: (r) => r.branchCoverage.value ?? null },
];
</script>

<template>
  <div class="ci-hotspot-table">
    <div class="ci-hotspot-table__toolbar">
      <input
        v-model="query"
        type="search"
        :placeholder="HOTSPOTS_FILTER_PLACEHOLDER"
        :aria-label="HOTSPOTS_FILTER_PLACEHOLDER"
      >
      <span class="ci-hotspot-table__note">{{ HOTSPOTS_SORT_NOTE }}</span>
    </div>
    <p
      v-if="rows.length === 0"
      class="ci-hotspots__note"
    >
      {{ HOTSPOTS_NO_RESULTS }}
    </p>
    <EvidenceTable
      v-else
      :columns="columns"
      :rows="rows"
      :row-key="(r) => r.id"
      :caption="HOTSPOTS_TABLE_TITLE"
      :initial-sort="{ key: 'priority', dir: 'desc' }"
      :limit="limit"
      @activate="emit('open', $event.id)"
    >
      <template #cell-file="{ row }">
        <span class="ci-file-cell">
          <span class="ci-file-cell__name">{{ row.name }}</span>
          <span class="ci-file-cell__path">{{ row.path }}</span>
        </span>
      </template>
      <template #cell-priority="{ row }">
        <span class="ci-priority">{{ formatMetric(row.priority) }} / 100</span>
      </template>
      <template #cell-complexity="{ row }">
        {{ formatMetric(row.complexity) }}
      </template>
      <template #cell-commits="{ row }">
        {{ formatMetric(row.commits90d) }}
      </template>
      <template #cell-coverage="{ row }">
        {{ formatMetric(row.branchCoverage, '%') }}
      </template>
    </EvidenceTable>
    <button
      v-if="rows.length > limit"
      type="button"
      class="ci-hotspot-table__more"
      @click="emit('more')"
    >
      {{ HOTSPOTS_SHOW_MORE(Math.min(TABLE_PAGE, rows.length - limit)) }}
    </button>
  </div>
</template>
```

- [ ] **Step 7: PriorityFormulaDialog.vue.** Create `src/ui/screens/hotspots/PriorityFormulaDialog.vue`:

```vue
<script setup lang="ts">
import {
  DIALOG_CLOSE, PRIORITY_CAVEAT, PRIORITY_DIALOG_TITLE, PRIORITY_FORMULA, PRIORITY_TERMS, PRIORITY_UNKNOWN_RULE,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <CiDialog
    :label="PRIORITY_DIALOG_TITLE"
    @close="emit('close')"
  >
    <div class="ci-formula">
      <h3 class="ci-formula__title">
        {{ PRIORITY_DIALOG_TITLE }}
      </h3>
      <p><code class="ci-formula__code">{{ PRIORITY_FORMULA }}</code></p>
      <dl class="ci-facts">
        <template
          v-for="t in PRIORITY_TERMS"
          :key="t.term"
        >
          <dt><code>{{ t.term }}</code></dt>
          <dd>{{ t.meaning }}</dd>
        </template>
      </dl>
      <p>{{ PRIORITY_CAVEAT }}</p>
      <p>{{ PRIORITY_UNKNOWN_RULE }}</p>
      <div class="ci-formula__actions">
        <button
          type="button"
          class="mod-cta"
          @click="emit('close')"
        >
          {{ DIALOG_CLOSE }}
        </button>
      </div>
    </div>
  </CiDialog>
</template>
```

- [ ] **Step 8: HotspotsScreen.vue.** Create `src/ui/screens/HotspotsScreen.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { downloadText } from '../export/download';
import { TABLE_PAGE, buildHotspotsModel, hotspotsCsv } from '../read-models/hotspots';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { useUniqueId } from '../unique-id';
import {
  HOTSPOTS_ALL_MODULES, HOTSPOTS_CSV_FILENAME, HOTSPOTS_EXPORT, HOTSPOTS_EYEBROW, HOTSPOTS_HOW_PRIORITY,
  HOTSPOTS_MODULE_FILTER, HOTSPOTS_OPEN_DETAIL, HOTSPOTS_SCATTER_FOOTNOTE, HOTSPOTS_SCATTER_SUBTITLE,
  HOTSPOTS_SCATTER_TITLE, HOTSPOTS_SELECTED, HOTSPOTS_SHORTLIST_SUBTITLE, HOTSPOTS_SHORTLIST_TITLE, HOTSPOTS_SHOWING,
  HOTSPOTS_SUBTITLE, HOTSPOTS_TABLE_SUBTITLE, HOTSPOTS_TABLE_TITLE, HOTSPOTS_TITLE, HOTSPOTS_UNPLOTTABLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Panel from '../kit/Panel.vue';
import Icon from '../kit/Icon.vue';
import NoSnapshot from './NoSnapshot.vue';
import HotspotScatter from './hotspots/HotspotScatter.vue';
import PriorityList from './hotspots/PriorityList.vue';
import HotspotTable from './hotspots/HotspotTable.vue';
import PriorityFormulaDialog from './hotspots/PriorityFormulaDialog.vue';

const store = useCityStore();
const { files } = useReadModels();
const moduleFilter = ref<string | null>(null);
const query = ref('');
const shown = ref(TABLE_PAGE);
const formulaOpen = ref(false);
const root = ref<HTMLElement | null>(null);
const moduleSelectId = useUniqueId('ci-hotspots-module');

const model = computed(() => buildHotspotsModel(files.value, { module: moduleFilter.value, query: query.value }));
const selected = computed(() => model.value.rows.find((f) => f.id === store.selectedEntityId) ?? null);
watch([moduleFilter, query], () => { shown.value = TABLE_PAGE; });

/** Selection goes through the ONE owner and never moves the camera. */
function openFile(id: EntityId): void {
  store.select(id);
  store.navigate('file');
}

/** P8: every filtered row, handed to the user through this leaf's own document. */
function exportCsv(): void {
  if (root.value) downloadText(root.value, HOTSPOTS_CSV_FILENAME, hotspotsCsv(model.value.rows));
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--hotspots"
  >
    <PageHeader
      :eyebrow="HOTSPOTS_EYEBROW"
      :title="HOTSPOTS_TITLE"
      :subtitle="HOTSPOTS_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-hotspots__how"
          @click="formulaOpen = true"
        >
          <Icon name="info" />
          {{ HOTSPOTS_HOW_PRIORITY }}
        </button>
        <button
          type="button"
          class="ci-hotspots__export"
          :disabled="model.rows.length === 0"
          @click="exportCsv"
        >
          <Icon name="download" />
          {{ HOTSPOTS_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else>
      <div class="ci-hotspots__grid">
        <Panel
          :title="HOTSPOTS_SCATTER_TITLE"
          :subtitle="HOTSPOTS_SCATTER_SUBTITLE"
          :footnote="HOTSPOTS_SCATTER_FOOTNOTE"
        >
          <template #actions>
            <label
              class="visually-hidden"
              :for="moduleSelectId"
            >{{ HOTSPOTS_MODULE_FILTER }}</label>
            <select
              :id="moduleSelectId"
              v-model="moduleFilter"
              class="dropdown ci-hotspots__module"
            >
              <option :value="null">
                {{ HOTSPOTS_ALL_MODULES }}
              </option>
              <option
                v-for="m in model.modules"
                :key="m.name"
                :value="m.name"
              >
                {{ m.label }}
              </option>
            </select>
          </template>
          <HotspotScatter
            :model="model"
            :selected-id="store.selectedEntityId"
            @select="store.select($event)"
          />
          <p
            v-if="model.plottable > model.points.length"
            class="ci-hotspots__note"
          >
            {{ HOTSPOTS_SHOWING(model.points.length, model.plottable) }}
          </p>
          <p
            v-if="model.unplottable > 0"
            class="ci-hotspots__note"
          >
            {{ HOTSPOTS_UNPLOTTABLE(model.unplottable) }}
          </p>
          <div
            v-if="selected"
            class="ci-hotspots__selected"
          >
            <span role="status">{{ HOTSPOTS_SELECTED(selected.name) }}</span>
            <button
              type="button"
              @click="openFile(selected.id)"
            >
              {{ HOTSPOTS_OPEN_DETAIL }}
            </button>
          </div>
        </Panel>
        <Panel
          :title="HOTSPOTS_SHORTLIST_TITLE"
          :subtitle="HOTSPOTS_SHORTLIST_SUBTITLE"
        >
          <PriorityList
            :files="model.shortlist"
            @open="openFile"
          />
        </Panel>
      </div>
      <Panel
        :title="HOTSPOTS_TABLE_TITLE"
        :subtitle="HOTSPOTS_TABLE_SUBTITLE(model.rows.length)"
      >
        <HotspotTable
          v-model:query="query"
          :rows="model.rows"
          :limit="shown"
          @open="openFile"
          @more="shown += TABLE_PAGE"
        />
      </Panel>
    </template>
    <PriorityFormulaDialog
      v-if="formulaOpen"
      @close="formulaOpen = false"
    />
  </div>
</template>
```

- [ ] **Step 9: Route it.** In `App.vue`, import `HotspotsScreen` and add `<HotspotsScreen v-else-if="store.route === 'hotspots'" />` after the Architecture branch.

- [ ] **Step 10: CSS.** Append to `screens.css`:

```css
/* Part 2: Hotspots. */
:where(.codebase-inspector-root) .ci-hotspots__grid { display: grid; gap: var(--ci-space-4); grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); align-items: start; }
@container (max-width: 900px) {
  :where(.codebase-inspector-root) .ci-hotspots__grid { grid-template-columns: minmax(0, 1fr); }
}
:where(.codebase-inspector-root) .ci-hotspots__note { margin: var(--ci-space-2) 0 0; color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-hotspots__selected { display: flex; align-items: center; justify-content: space-between; gap: var(--ci-space-3); margin-top: var(--ci-space-3); }
:where(.codebase-inspector-root) .ci-scatter { margin: 0; }
:where(.codebase-inspector-root) .ci-scatter svg { width: 100%; height: auto; display: block; }
:where(.codebase-inspector-root) .ci-scatter__grid line { stroke: var(--ci-border); stroke-dasharray: 3 4; }
:where(.codebase-inspector-root) .ci-scatter__grid text { fill: var(--ci-text-faint); font-size: 11px; }
:where(.codebase-inspector-root) .ci-scatter__quadrant { fill: var(--ci-raised); }
:where(.codebase-inspector-root) .ci-scatter__quadrant-label { fill: var(--ci-tone-danger); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; }
:where(.codebase-inspector-root) .ci-scatter__dot { stroke: var(--ci-surface); stroke-width: 1; opacity: 0.85; cursor: pointer; }
:where(.codebase-inspector-root) .ci-scatter__dot--low { fill: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-scatter__dot--mid { fill: var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-scatter__dot--high { fill: var(--ci-tone-success); }
:where(.codebase-inspector-root) .ci-scatter__dot--unknown { fill: var(--ci-text-faint); }
:where(.codebase-inspector-root) .ci-scatter__dot--ring { fill: none; stroke-width: 1.5; }
:where(.codebase-inspector-root) .ci-scatter__dot--ring.ci-scatter__dot--low { stroke: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-scatter__dot--ring.ci-scatter__dot--mid { stroke: var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-scatter__dot--ring.ci-scatter__dot--high { stroke: var(--ci-tone-success); }
:where(.codebase-inspector-root) .ci-scatter__dot--ring.ci-scatter__dot--unknown { stroke: var(--ci-text-faint); }
:where(.codebase-inspector-root) .ci-scatter__dot--selected { stroke: var(--ci-text); stroke-width: 2.5; opacity: 1; }
:where(.codebase-inspector-root) .ci-scatter__dot:focus-visible { outline: 2px solid var(--ci-focus); }
:where(.codebase-inspector-root) .ci-scatter__legend { display: flex; flex-wrap: wrap; gap: var(--ci-space-4); margin-top: var(--ci-space-2); color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-scatter__key::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: var(--ci-space-1); border-radius: 50%; background: var(--ci-text-faint); }
:where(.codebase-inspector-root) .ci-scatter__key--low::before { background: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-scatter__key--mid::before { background: var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-scatter__key--high::before { background: var(--ci-tone-success); }
:where(.codebase-inspector-root) .ci-shortlist { list-style: none; margin: calc(-1 * var(--ci-space-4)); padding: 0; }
:where(.codebase-inspector-root) .ci-shortlist li + li { border-top: 1px solid var(--ci-border); }
:where(.codebase-inspector-root) button.ci-shortlist__item {
  display: flex; align-items: flex-start; gap: var(--ci-space-3); width: 100%; height: auto; padding: var(--ci-space-4);
  border: none; border-radius: 0; box-shadow: none; background: transparent; color: var(--ci-text); text-align: left; cursor: pointer;
}
:where(.codebase-inspector-root) button.ci-shortlist__item:hover { background: var(--ci-raised); }
:where(.codebase-inspector-root) .ci-shortlist__rank { color: var(--ci-text-faint); font-family: var(--ci-font-mono); }
:where(.codebase-inspector-root) .ci-shortlist__text { display: flex; flex-direction: column; flex: 1 1 auto; white-space: normal; }
:where(.codebase-inspector-root) .ci-shortlist__name { font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-shortlist__detail { color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-hotspot-table__toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--ci-space-3); margin-bottom: var(--ci-space-3); }
:where(.codebase-inspector-root) .ci-hotspot-table__note { color: var(--ci-text-faint); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-hotspot-table__more { margin-top: var(--ci-space-3); }
:where(.codebase-inspector-root) .ci-formula { display: flex; flex-direction: column; gap: var(--ci-space-3); max-width: 36em; padding: var(--ci-space-4); }
:where(.codebase-inspector-root) .ci-formula__title { margin: 0; }
:where(.codebase-inspector-root) .ci-formula__code { font-family: var(--ci-font-mono); white-space: normal; overflow-wrap: anywhere; }
:where(.codebase-inspector-root) .ci-formula__actions { display: flex; justify-content: flex-end; }
```

- [ ] **Step 11: Run and confirm the tests pass.** `npx vitest run tests/component/hotspots-screen.test.ts tests/component/workspace-shell.test.ts` → PASS.

- [ ] **Step 12: Gate and commit.** `npm run typecheck && npm run lint:fast && npx eslint src/ui --max-warnings 0`

```bash
git add src/ui tests
git commit -m "feat(ui): hotspots screen — scatter, shortlist, inventory, formula, CSV export

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: File detail screen and the paths into it

**Files:**
- Create: `src/ui/screens/FileDetailScreen.vue`, `src/ui/screens/file/FileHeader.vue`, `SourceContextPanel.vue`, `FileFindingsPanel.vue`, `FileWorkItemsPanel.vue`
- Modify: `src/ui/App.vue`, `src/ui/components/FileInspector.vue`, `src/ui/shell/CommandPalette.vue`, `src/ui/screens/OverviewScreen.vue`, `src/ui/inspector-copy.ts`, `src/ui/styles/screens.css`
- Test: `tests/component/file-detail-screen.test.ts`; update `tests/component/command-palette.test.ts`, `tests/component/overview-screen.test.ts`, `tests/component/file-inspector.test.ts`

**Interfaces:**
- Consumes: `useReadModels().fileDetail` (Task 5); `FileDetailModel`, `FileFinding` (Task 5); `useClipboard` (existing); `review-store` work items (existing); `NoSnapshot` (Task 6)
- Produces:
  - The `file` route.
  - FileInspector "Investigate file" (`.ci-inspector__investigate`) → `navigate('file')`.
  - A palette file item → `select` + `navigate('file')`.
  - An Overview hotspot row → `select` + `navigate('file')`.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/file-detail-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FileDetailScreen from '../../src/ui/screens/FileDetailScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSelection() {
  const snap = buildSnapshotFixture({ files: 12, directories: 2 });
  const store = useCityStore();
  store.setCity(snap, computeLayout(snap));
  const file = snap.entities.find((e) => e.kind === 'file')!;
  store.select(file.id);
  store.navigate('file');
  return file;
}
const clipboard = { writeText: vi.fn(() => Promise.resolve()) };
const mountFile = () => mount(FileDetailScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), clipboard } } });

describe('FileDetailScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); clipboard.writeText.mockClear(); });

  it('asks for a codebase without a snapshot', () => {
    expect(mountFile().text()).toContain('No snapshot yet');
  });

  it('explains how to pick a file when nothing is selected', async () => {
    const snap = buildSnapshotFixture({ files: 3 });
    useCityStore().setCity(snap, computeLayout(snap));
    const w = mountFile();
    expect(w.text()).toContain('No file selected');
    await w.find('.ci-file-detail__browse').trigger('click');
    expect(useCityStore().route).toBe('hotspots');
    w.unmount();
  });

  it('shows the file identity, four cards, inventory facts and sample findings', () => {
    const file = withSelection();
    const w = mountFile();
    expect(w.find('.ci-page-header__title').text()).toBe(file.name);
    expect(w.text()).toContain(file.path);
    expect(w.findAll('.ci-metric-card')).toHaveLength(4);
    expect(w.find('.ci-source-context').text()).toContain('Bytes');
    expect(w.text()).toContain('Source preview arrives with the source provider.');
    expect(w.text()).toContain('No findings does not imply no defects.');
    w.unmount();
  });

  it('Show in city keeps the selection, opens the inspector and never moves the camera', async () => {
    const file = withSelection();
    const store = useCityStore();
    const w = mountFile();
    await w.find('.ci-file-detail__city').trigger('click');
    expect(store.route).toBe('city');
    expect(store.selectedEntityId).toBe(file.id);
    expect(store.inspectorOpen).toBe(true);
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('Inspect architecture navigates there', async () => {
    withSelection();
    const w = mountFile();
    await w.find('.ci-file-detail__architecture').trigger('click');
    expect(useCityStore().route).toBe('architecture');
    w.unmount();
  });

  it('adds one work item and lists it', async () => {
    const file = withSelection();
    const w = mountFile();
    await w.find('.ci-file-detail__add').trigger('click');
    await flushPromises();
    expect(useReviewStore().hasWorkItemFor(file.id)).toBe(true);
    expect(w.find('.ci-file-detail__add').attributes('disabled')).toBeDefined();
    expect(w.find('.ci-work-items').text()).toContain(`Investigate ${file.name}`);
    w.unmount();
  });

  it('copies the path through the clipboard seam and reports failure', async () => {
    const file = withSelection();
    const w = mountFile();
    await w.find('.ci-source-context__copy').trigger('click');
    await flushPromises();
    expect(clipboard.writeText).toHaveBeenCalledWith(file.path);
    clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
    await w.find('.ci-source-context__copy').trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Could not copy the path.');
    w.unmount();
  });
});
```

In `tests/component/command-palette.test.ts`, rename the test `'opening a file selects it, shows the city and opens the inspector — without touching the camera'` to `'opening a file selects it and shows File detail — without touching the camera'`. Replace its route and inspector assertions with:

```ts
    expect(store.route).toBe('file');
```

Keep the camera assertion. Remove the `inspectorOpen` assertion. Add a test:

```ts
  it('the combobox announces its listbox popup', () => {
    const w = mount(CommandPalette, { attachTo: document.body });
    expect(w.find('input').attributes('aria-haspopup')).toBe('listbox');
    w.unmount();
  });
```

In `tests/component/overview-screen.test.ts`, change `'opening a hotspot row selects the file and shows the city without moving the camera'` to expect `store.route` to be `'file'`, and rename it to `'opening a hotspot row selects the file and shows File detail without moving the camera'`.

In `tests/component/file-inspector.test.ts`, add one test that follows the file's existing mount helper and fixture pattern (read the top of the file first): with a file selected and the inspector open, clicking `.ci-inspector__investigate` sets `store.route` to `'file'`, keeps `store.selectedEntityId`, and leaves `store.camera` `null`.

- [ ] **Step 2: Run and confirm they fail.** `npx vitest run tests/component/file-detail-screen.test.ts tests/component/command-palette.test.ts tests/component/overview-screen.test.ts tests/component/file-inspector.test.ts` → FAIL.

- [ ] **Step 3: Copy.** Append to `inspector-copy.ts`:

```ts
/** Part 2 §2.3: File detail screen. */
export const FILE_EYEBROW = 'File / Evidence & impact';
export const FILE_NO_SELECTION_TITLE = 'No file selected';
export const FILE_NO_SELECTION = 'Select a file in the city, a hotspot table or the command palette to see its evidence here.';
export const FILE_BROWSE_HOTSPOTS = 'Browse hotspots';
export const FILE_SHOW_IN_CITY = 'Show in city';
export const FILE_INSPECT_ARCHITECTURE = 'Inspect architecture';
export const FILE_ADD_WORK_ITEM = 'Add work item';
export const FILE_COMMITS_CHIP = (n: string): string => `${n} commits / 90d`;
export const FILE_SAMPLE_CHIP = 'Sample signals';
export const FILE_SOURCE_TITLE = 'Source context';
export const FILE_SOURCE_SUBTITLE = 'Inventory facts for this file. File content is not read.';
export const FILE_SOURCE_PREVIEW_LATER = 'Source preview arrives with the source provider.';
export const FILE_COPY_PATH = 'Copy path';
export const FILE_COPY_FAILED = 'Could not copy the path. Select it and copy it manually.';
export const FILE_FACT_PATH = 'Path';
export const FILE_FACT_MODULE = 'Module';
export const FILE_FACT_CATEGORY = 'Category';
export const FILE_FACT_LINES = 'Lines';
export const FILE_FACT_BYTES = 'Bytes';
export const FILE_FINDINGS_TITLE = 'Evidence & decisions';
export const FILE_FINDINGS_SUBTITLE = (n: string): string => `${n} static findings for this file.`;
export const FILE_NO_FINDINGS = 'No sample findings for this file.';
export const FILE_FINDINGS_CAVEAT_TITLE = 'No findings does not imply no defects.';
export const FILE_FINDINGS_CAVEAT = 'Dynamic imports, reflection, configuration and runtime behaviour may need additional review.';
export const FINDING_META = (line: number | null): string => (line === null ? 'Sample finding · line unknown' : `Sample finding · line ${line}`);
export const SEVERITY_LABEL: Readonly<Record<'high' | 'medium' | 'low', string>> = { high: 'High', medium: 'Medium', low: 'Low' };
export const FILE_HISTORY_TITLE = 'Change & test history';
export const FILE_HISTORY_SUBTITLE = 'Sample per-file trends.';
export const FILE_HISTORY_FOOTNOTE = 'Complexity and branch coverage use different units.';
export const FILE_HISTORY_NONE = 'No history for this file.';
export const FILE_WORK_ITEMS_TITLE = 'Planned work';
export const FILE_WORK_ITEMS_SUBTITLE = 'Work items record intent; they never change the source.';
export const FILE_NO_WORK_ITEMS = 'No work items for this file yet.';
export const WORK_ITEM_STATUS_LABEL: Readonly<Record<'investigate' | 'planned' | 'in-progress' | 'verified', string>> = {
  investigate: 'Investigate', planned: 'Planned', 'in-progress': 'In progress', verified: 'Verified',
};
export const INVESTIGATE_FILE_LABEL = 'Investigate file';
```

- [ ] **Step 4: FileHeader.vue.** Create `src/ui/screens/file/FileHeader.vue`:

```vue
<script setup lang="ts">
import { formatMetric } from '../../evidence';
import type { FileDetailModel } from '../../read-models/file-detail';
import {
  FILE_ADD_WORK_ITEM, FILE_COMMITS_CHIP, FILE_EYEBROW, FILE_INSPECT_ARCHITECTURE, FILE_SAMPLE_CHIP, FILE_SHOW_IN_CITY,
  IN_PLAN_LABEL,
} from '../../inspector-copy';
import PageHeader from '../../kit/PageHeader.vue';
import Icon from '../../kit/Icon.vue';

defineProps<{ detail: FileDetailModel; inPlan: boolean; pending: boolean }>();
const emit = defineEmits<{ 'show-in-city': []; 'inspect-architecture': []; 'add-work-item': [] }>();
</script>

<template>
  <div class="ci-file-header">
    <PageHeader
      :eyebrow="FILE_EYEBROW"
      :title="detail.file.name"
      :subtitle="detail.file.path"
    >
      <template #actions>
        <button
          type="button"
          class="ci-file-detail__city"
          @click="emit('show-in-city')"
        >
          <Icon name="building-2" />
          {{ FILE_SHOW_IN_CITY }}
        </button>
        <button
          type="button"
          class="ci-file-detail__architecture"
          @click="emit('inspect-architecture')"
        >
          <Icon name="network" />
          {{ FILE_INSPECT_ARCHITECTURE }}
        </button>
        <button
          type="button"
          class="mod-cta ci-file-detail__add"
          :disabled="inPlan || pending"
          @click="emit('add-work-item')"
        >
          <Icon name="plus" />
          {{ inPlan ? IN_PLAN_LABEL : FILE_ADD_WORK_ITEM }}
        </button>
      </template>
    </PageHeader>
    <ul class="ci-file-header__chips">
      <li class="ci-chip">
        {{ detail.moduleLabel }}
      </li>
      <li class="ci-chip">
        {{ FILE_COMMITS_CHIP(formatMetric(detail.file.commits90d)) }}
      </li>
      <li
        v-if="detail.usesSample"
        class="ci-chip ci-chip--sample"
      >
        {{ FILE_SAMPLE_CHIP }}
      </li>
    </ul>
  </div>
</template>
```

- [ ] **Step 5: SourceContextPanel.vue.** Create `src/ui/screens/file/SourceContextPanel.vue`:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useClipboard } from '../../clipboard';
import { COPY_27 } from '../../copy';
import { formatMetric, hasValue } from '../../evidence';
import type { FileDetailModel } from '../../read-models/file-detail';
import {
  FILE_COPY_FAILED, FILE_COPY_PATH, FILE_FACT_BYTES, FILE_FACT_CATEGORY, FILE_FACT_LINES, FILE_FACT_MODULE, FILE_FACT_PATH,
  FILE_SOURCE_PREVIEW_LATER, FILE_SOURCE_SUBTITLE, FILE_SOURCE_TITLE,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Icon from '../../kit/Icon.vue';

/** P9: metadata only. Nothing here reads file content or touches the source port. */
const props = defineProps<{ detail: FileDetailModel }>();
const clipboard = useClipboard();
const message = ref('');
watch(() => props.detail.file.id, () => { message.value = ''; });

async function copyPath(): Promise<void> {
  try {
    await clipboard.writeText(props.detail.file.path);
    message.value = COPY_27;
  } catch {
    message.value = FILE_COPY_FAILED;
  }
}
</script>

<template>
  <Panel
    :title="FILE_SOURCE_TITLE"
    :subtitle="FILE_SOURCE_SUBTITLE"
  >
    <template #actions>
      <button
        type="button"
        class="ci-source-context__copy"
        @click="copyPath"
      >
        <Icon name="copy" />
        {{ FILE_COPY_PATH }}
      </button>
    </template>
    <dl class="ci-facts ci-source-context">
      <dt>{{ FILE_FACT_PATH }}</dt>
      <dd><code>{{ detail.file.path }}</code></dd>
      <dt>{{ FILE_FACT_MODULE }}</dt>
      <dd>{{ detail.moduleLabel }}</dd>
      <dt>{{ FILE_FACT_CATEGORY }}</dt>
      <dd>{{ detail.category ?? '—' }}</dd>
      <dt>{{ FILE_FACT_LINES }}</dt>
      <dd>
        {{ formatMetric(detail.file.lines) }}
        <span
          v-if="!hasValue(detail.file.lines)"
          class="ci-source-context__reason"
        >{{ detail.file.lines.reason }}</span>
      </dd>
      <dt>{{ FILE_FACT_BYTES }}</dt>
      <dd>{{ formatMetric(detail.bytes) }}</dd>
    </dl>
    <p class="ci-source-context__note">
      {{ FILE_SOURCE_PREVIEW_LATER }}
    </p>
    <p
      class="ci-source-context__message"
      role="status"
    >
      {{ message }}
    </p>
  </Panel>
</template>
```

- [ ] **Step 6: FileFindingsPanel.vue and FileWorkItemsPanel.vue.** Create `src/ui/screens/file/FileFindingsPanel.vue`:

```vue
<script setup lang="ts">
import { formatMetric, type MetricValue } from '../../evidence';
import type { FileFinding } from '../../read-models/file-detail';
import {
  FILE_FINDINGS_CAVEAT, FILE_FINDINGS_CAVEAT_TITLE, FILE_FINDINGS_SUBTITLE, FILE_FINDINGS_TITLE, FILE_NO_FINDINGS,
  FINDING_META, SEVERITY_LABEL,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Callout from '../../kit/Callout.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

/** P13: rows are not interactive yet; the finding-review dialog arrives in Part 3. */
defineProps<{ findings: readonly FileFinding[]; count: MetricValue }>();
</script>

<template>
  <Panel
    :title="FILE_FINDINGS_TITLE"
    :subtitle="FILE_FINDINGS_SUBTITLE(formatMetric(count))"
  >
    <ul
      v-if="findings.length"
      class="ci-findings"
    >
      <li
        v-for="f in findings"
        :key="f.id"
        class="ci-finding"
      >
        <p class="ci-finding__head">
          <span
            class="ci-finding__severity"
            :class="`ci-finding__severity--${f.severity}`"
          >{{ SEVERITY_LABEL[f.severity] }}</span>
          <code class="ci-finding__id">{{ f.id }}</code>
        </p>
        <p class="ci-finding__title">
          {{ f.title }}
        </p>
        <p class="ci-finding__meta">
          {{ FINDING_META(f.line) }}
          <ProvenanceBadge state="sample" />
        </p>
      </li>
    </ul>
    <p
      v-else
      class="ci-hotspots__note"
    >
      {{ FILE_NO_FINDINGS }}
    </p>
    <Callout :title="FILE_FINDINGS_CAVEAT_TITLE">
      {{ FILE_FINDINGS_CAVEAT }}
    </Callout>
  </Panel>
</template>
```

Create `src/ui/screens/file/FileWorkItemsPanel.vue`:

```vue
<script setup lang="ts">
import type { WorkItem } from '../../stores/ports/review-repository';
import { FILE_NO_WORK_ITEMS, FILE_WORK_ITEMS_SUBTITLE, FILE_WORK_ITEMS_TITLE, WORK_ITEM_STATUS_LABEL } from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';

defineProps<{ items: readonly WorkItem[] }>();
</script>

<template>
  <Panel
    :title="FILE_WORK_ITEMS_TITLE"
    :subtitle="FILE_WORK_ITEMS_SUBTITLE"
  >
    <ul
      v-if="items.length"
      class="ci-work-items"
    >
      <li
        v-for="w in items"
        :key="w.id"
      >
        <span class="ci-work-items__title">{{ w.title }}</span>
        <span class="ci-chip">{{ WORK_ITEM_STATUS_LABEL[w.status] }}</span>
      </li>
    </ul>
    <p
      v-else
      class="ci-hotspots__note"
    >
      {{ FILE_NO_WORK_ITEMS }}
    </p>
  </Panel>
</template>
```

- [ ] **Step 7: FileDetailScreen.vue.** Create `src/ui/screens/FileDetailScreen.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import {
  ADD_TO_PLAN_FAILED, FILE_BROWSE_HOTSPOTS, FILE_EYEBROW, FILE_HISTORY_FOOTNOTE, FILE_HISTORY_NONE, FILE_HISTORY_SUBTITLE,
  FILE_HISTORY_TITLE, FILE_NO_SELECTION, FILE_NO_SELECTION_TITLE, WORK_ITEM_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import LineChart from '../kit/LineChart.vue';
import NoSnapshot from './NoSnapshot.vue';
import FileHeader from './file/FileHeader.vue';
import SourceContextPanel from './file/SourceContextPanel.vue';
import FileFindingsPanel from './file/FileFindingsPanel.vue';
import FileWorkItemsPanel from './file/FileWorkItemsPanel.vue';

const store = useCityStore();
const review = useReviewStore();
const { fileDetail } = useReadModels();
const liveMessage = ref('');
watch(() => store.selectedEntityId, () => { liveMessage.value = ''; });

const workItems = computed(() => {
  const id = fileDetail.value?.file.id;
  return id ? review.workItems.filter((w) => w.entityId === id) : [];
});

/** P11: back to the city with the same selection. Opening the inspector never moves the
 *  camera (city-store invariant). */
function showInCity(): void {
  store.navigate('city');
  store.openInspector();
}

/** Records intent only, through the review port. Nothing in the source is touched. */
async function addWorkItem(): Promise<void> {
  const detail = fileDetail.value;
  if (!detail) return;
  try {
    await review.addWorkItemForFile(detail.file.id, WORK_ITEM_TITLE(detail.file.name), new Date());
  } catch {
    liveMessage.value = ADD_TO_PLAN_FAILED;
  }
}
</script>

<template>
  <div class="ci-screen ci-screen--file">
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else-if="!fileDetail">
      <PageHeader
        :eyebrow="FILE_EYEBROW"
        :title="FILE_NO_SELECTION_TITLE"
        :subtitle="FILE_NO_SELECTION"
      />
      <div>
        <button
          type="button"
          class="ci-file-detail__browse"
          @click="store.navigate('hotspots')"
        >
          {{ FILE_BROWSE_HOTSPOTS }}
        </button>
      </div>
    </template>
    <template v-else>
      <FileHeader
        :detail="fileDetail"
        :in-plan="review.hasWorkItemFor(fileDetail.file.id)"
        :pending="review.isPendingFor(fileDetail.file.id)"
        @show-in-city="showInCity"
        @inspect-architecture="store.navigate('architecture')"
        @add-work-item="addWorkItem"
      />
      <p
        class="visually-hidden"
        role="status"
      >
        {{ liveMessage }}
      </p>
      <div class="ci-overview__cards">
        <MetricCard
          v-for="card in fileDetail.cards"
          :key="card.id"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :unit="card.unit"
          :caption="card.caption"
          :tone="card.tone"
        />
      </div>
      <div class="ci-file-detail__grid">
        <SourceContextPanel :detail="fileDetail" />
        <FileFindingsPanel
          :findings="fileDetail.findings"
          :count="fileDetail.findingsCount"
        />
      </div>
      <div class="ci-file-detail__grid">
        <Panel
          :title="FILE_HISTORY_TITLE"
          :subtitle="FILE_HISTORY_SUBTITLE"
          :footnote="FILE_HISTORY_FOOTNOTE"
        >
          <LineChart
            v-if="fileDetail.history.length"
            :label="FILE_HISTORY_TITLE"
            :series="fileDetail.history"
          />
          <p
            v-else
            class="ci-hotspots__note"
          >
            {{ FILE_HISTORY_NONE }}
          </p>
        </Panel>
        <FileWorkItemsPanel :items="workItems" />
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 8: Paths into File detail.**
- In `App.vue`, import `FileDetailScreen` and add `<FileDetailScreen v-else-if="store.route === 'file'" />` after the Hotspots branch.
- In `CommandPalette.vue`, change the file branch of `run` to the snippet below, and add `aria-haspopup="listbox"` to the `role="combobox"` input (a deferred minor):

```ts
  } else if (item.kind === 'file') {
    // Part 2 P11: a file from the palette opens its evidence, not the city.
    store.select(item.target);
    store.navigate('file');
  }
```

- In `OverviewScreen.vue`, change `openFile` to the snippet below and update its doc comment ("…the file detail is a separate, explicit navigation"):

```ts
function openFile(row: FileSummary): void {
  store.select(row.id);
  store.navigate('file');
}
```

- In `FileInspector.vue`, import `INVESTIGATE_FILE_LABEL`, and add this button immediately before the "Add to refactor plan" button. Update the header comment to list "Investigate file":

```vue
      <button
        type="button"
        class="ci-inspector__investigate"
        @click="store.navigate('file')"
      >
        {{ INVESTIGATE_FILE_LABEL }}
      </button>
```

- [ ] **Step 9: CSS.** Append to `screens.css`:

```css
/* Part 2: File detail. */
:where(.codebase-inspector-root) .ci-file-detail__grid { display: grid; gap: var(--ci-space-4); grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: start; }
@container (max-width: 900px) {
  :where(.codebase-inspector-root) .ci-file-detail__grid { grid-template-columns: minmax(0, 1fr); }
}
:where(.codebase-inspector-root) .ci-file-header__chips { display: flex; flex-wrap: wrap; gap: var(--ci-space-2); list-style: none; margin: var(--ci-space-3) 0 0; padding: 0; }
:where(.codebase-inspector-root) .ci-chip {
  display: inline-flex; align-items: center; padding: 2px var(--ci-space-2); border: 1px solid var(--ci-border);
  border-radius: var(--ci-radius-small); color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em);
}
:where(.codebase-inspector-root) .ci-chip--sample { border-color: var(--ci-sample); color: var(--ci-sample); }
:where(.codebase-inspector-root) .ci-source-context code { font-family: var(--ci-font-mono); overflow-wrap: anywhere; }
:where(.codebase-inspector-root) .ci-source-context__reason { color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-source-context__note { margin: var(--ci-space-4) 0 0; color: var(--ci-text-muted); font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-source-context__message { min-height: 1em; margin: var(--ci-space-2) 0 0; color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-findings { list-style: none; margin: 0 0 var(--ci-space-4); padding: 0; }
:where(.codebase-inspector-root) .ci-finding { padding: var(--ci-space-3) 0; border-bottom: 1px solid var(--ci-border); }
:where(.codebase-inspector-root) .ci-finding__head { display: flex; align-items: center; gap: var(--ci-space-2); margin: 0; }
:where(.codebase-inspector-root) .ci-finding__severity { padding: 1px var(--ci-space-2); border-radius: var(--ci-radius-small); font-size: var(--font-ui-smaller, 0.8em); font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-finding__severity--high { color: var(--ci-tone-danger); background: var(--background-modifier-error); }
:where(.codebase-inspector-root) .ci-finding__severity--medium { color: var(--ci-tone-warning); border: 1px solid var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-finding__severity--low { color: var(--ci-tone-success); border: 1px solid var(--ci-tone-success); }
:where(.codebase-inspector-root) .ci-finding__id { color: var(--ci-text-faint); font-family: var(--ci-font-mono); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-finding__title { margin: var(--ci-space-2) 0 var(--ci-space-1); font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-finding__meta { display: flex; align-items: center; gap: var(--ci-space-2); margin: 0; color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-work-items { list-style: none; margin: 0; padding: 0; }
:where(.codebase-inspector-root) .ci-work-items li { display: flex; justify-content: space-between; align-items: center; gap: var(--ci-space-3); padding: var(--ci-space-2) 0; border-bottom: 1px solid var(--ci-border); }
```

- [ ] **Step 10: Run and confirm the tests pass.** `npx vitest run tests/component/file-detail-screen.test.ts tests/component/command-palette.test.ts tests/component/overview-screen.test.ts tests/component/file-inspector.test.ts tests/component/workspace-shell.test.ts` → PASS.

- [ ] **Step 11: Gate and commit.** `npm run typecheck && npm run lint:fast && npx eslint src/ui --max-warnings 0`. `FileInspector.vue` must stay under 400 lines. `CityWorkspace.vue` must be unchanged: check with `git diff --stat`.

```bash
git add src/ui tests
git commit -m "feat(ui): file detail screen; inspector, palette and overview open it

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Shell: provenance badge (A11), drawer scrim and focus containment (A12), copy minors

**Files:**
- Create: `src/ui/shell/use-route-provenance.ts`
- Modify: `src/ui/shell/TopBar.vue`, `src/ui/shell/NavColumn.vue`, `src/ui/App.vue`, `src/ui/inspector-copy.ts`, `src/ui/styles/shell.css`, and any remaining `var(--font-ui-*)` without a fallback in `src/ui/styles/{shell,screens}.css`
- Test: `tests/component/shell-provenance.test.ts`, `tests/unit/kit-css-fallbacks.test.ts`, `tests/component/workspace-shell.test.ts` (two tests)

**Interfaces:**
- Consumes: `useReadModels()` with `overview`, `citySummary`, `architecture`, `fileDetail`, `filesUseSample` (Tasks 3, 5); `isSampleBacked` (Task 1)
- Produces: `useRouteProvenance(): ComputedRef<boolean>`, and a `.ci-topbar__sample` chip

- [ ] **Step 1: Write the failing tests.** Create `tests/component/shell-provenance.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const mountShell = () => mount(App, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });

describe('shell provenance badge (A11)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('is absent without a snapshot', () => {
    const w = mountShell();
    expect(w.find('.ci-topbar__sample').exists()).toBe(false);
    w.unmount();
  });

  it('shows on every screen that shows sample values, and not on a placeholder', async () => {
    const snap = buildSnapshotFixture({ files: 20, directories: 3 });
    const store = useCityStore();
    store.setCity(snap, computeLayout(snap));
    store.select(snap.entities.find((e) => e.kind === 'file')!.id);
    const w = mountShell();
    for (const route of ['overview', 'city', 'architecture', 'hotspots', 'file'] as const) {
      store.navigate(route);
      await nextTick();
      expect(w.find('.ci-topbar__sample').text(), route).toBe('Includes sample data');
    }
    store.navigate('settings');
    await nextTick();
    expect(w.find('.ci-topbar__sample').exists()).toBe(false);
    w.unmount();
  });

  it('moves the shell strings into copy without changing them', () => {
    const w = mountShell();
    expect(w.find('.ci-topbar__crumbs').attributes('aria-label')).toBe('Breadcrumb');
    expect(w.find('.ci-topbar__crumbs').text()).toContain('Workspace');
    expect(w.find('.ci-topbar__search kbd').text()).toBe('Ctrl K');
    w.unmount();
  });
});
```

Create `tests/unit/kit-css-fallbacks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Part 2 §5 (deferred minor): every Obsidian font-size variable the WP-02 stylesheets read
// carries an em fallback, so a theme that drops one never collapses text to the UA default.
describe('WP-02 stylesheets', () => {
  for (const name of ['kit.css', 'shell.css', 'screens.css']) {
    it(`${name}: every var(--font-ui-*) has a fallback`, () => {
      const css = readFileSync(resolve(process.cwd(), 'src', 'ui', 'styles', name), 'utf8');
      expect(css.match(/var\(--font-ui-[a-z]+\)/g) ?? []).toEqual([]);
    });
  }
});
```

Add to `tests/component/workspace-shell.test.ts`, next to the existing drawer test:

```ts
  it('the open drawer has a scrim that closes it on click and restores focus', async () => {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    leaf.getBoundingClientRect = () => ({ width: 600 } as DOMRect);
    const w = mountShell(leaf);
    const menu = w.find('.ci-topbar__menu');
    (menu.element as HTMLElement).focus();
    await menu.trigger('click');
    await w.find('.ci-shell__scrim').trigger('click');
    expect(w.find('.ci-shell').classes()).not.toContain('ci-shell--nav-open');
    expect(w.find('.ci-shell__scrim').exists()).toBe(false);
    expect(document.activeElement).toBe(menu.element);
    w.unmount();
    leaf.remove();
  });

  it('Tab and Shift+Tab wrap inside the open drawer', async () => {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    leaf.getBoundingClientRect = () => ({ width: 600 } as DOMRect);
    const w = mountShell(leaf);
    await w.find('.ci-topbar__menu').trigger('click');
    const buttons = w.findAll('.ci-shell__nav button');
    const first = buttons[0]!.element as HTMLElement;
    const last = buttons.at(-1)!.element as HTMLElement;
    last.focus();
    await w.find('.ci-shell__nav').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    await w.find('.ci-shell__nav').trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    w.unmount();
    leaf.remove();
  });
```

- [ ] **Step 2: Run and confirm they fail.** `npx vitest run tests/component/shell-provenance.test.ts tests/unit/kit-css-fallbacks.test.ts tests/component/workspace-shell.test.ts` → FAIL.

- [ ] **Step 3: Copy.** Append to `inspector-copy.ts`:

```ts
/** Part 2 §5: shell strings that were hard-coded in TopBar.vue (unchanged text). */
export const BREADCRUMB_LABEL = 'Breadcrumb';
export const BREADCRUMB_ROOT = 'Workspace';
export const PALETTE_SHORTCUT_HINT = 'Ctrl K';
```

- [ ] **Step 4: The route flag.** Create `src/ui/shell/use-route-provenance.ts`:

```ts
// Spec §9 A11 / Part 2 §4: the shell-level "Includes sample data" badge. True whenever the
// screen on show displays any sample-backed value. Placeholder routes show none.
import { computed, type ComputedRef } from 'vue';
import { isSampleBacked } from '../evidence';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';

export function useRouteProvenance(): ComputedRef<boolean> {
  const store = useCityStore();
  const { overview, citySummary, architecture, fileDetail, filesUseSample } = useReadModels();
  return computed(() => {
    if (!store.snapshot) return false;
    switch (store.route) {
      case 'overview': return overview.value?.usesSample ?? false;
      case 'city': return citySummary.value.some((c) => isSampleBacked(c.value));
      case 'architecture': return architecture.value.usesSample;
      case 'hotspots': return filesUseSample.value;
      case 'file': return fileDetail.value?.usesSample ?? false;
      default: return false;
    }
  });
}
```

- [ ] **Step 5: TopBar.** In `TopBar.vue`, import `useRouteProvenance`, and add `BREADCRUMB_LABEL`, `BREADCRUMB_ROOT`, `PALETTE_SHORTCUT_HINT`, `SAMPLE_DATA_DETAIL`, `SAMPLE_DATA_NOTICE` to the copy import. Add `const usesSample = useRouteProvenance();`. Replace `aria-label="Breadcrumb"` with `:aria-label="BREADCRUMB_LABEL"`, `<span>Workspace</span>` with `<span>{{ BREADCRUMB_ROOT }}</span>`, and `<kbd>Ctrl K</kbd>` with `<kbd>{{ PALETTE_SHORTCUT_HINT }}</kbd>`. Insert before `<slot name="snapshot" />`:

```vue
    <span
      v-if="usesSample"
      class="ci-provenance ci-provenance--sample ci-topbar__sample"
      :title="SAMPLE_DATA_DETAIL"
    >{{ SAMPLE_DATA_NOTICE }}</span>
```

- [ ] **Step 6: Drawer (A12).** In `App.vue`, add this directly after `<NavColumn … />`:

```vue
    <div
      v-if="navOpen && !navInline"
      class="ci-shell__scrim"
      aria-hidden="true"
      @click="closeNav"
    />
```

In `NavColumn.vue`, replace `onKeydown` with the code below, and update its doc comment to say A12 is now complete (Escape, scrim and focus containment):

```ts
/** A drawer only (spec §9 A12): Escape closes it; Tab and Shift+Tab wrap inside it, so
 *  focus never reaches the covered content. The inline column claims neither key, so the
 *  city's own escape chain still resolves Escape. */
function onKeydown(event: KeyboardEvent): void {
  if (!props.drawer) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    emit('close');
    return;
  }
  if (event.key !== 'Tab') return;
  const nav = event.currentTarget as HTMLElement;
  const items = [...nav.querySelectorAll<HTMLElement>('button:not([disabled])')];
  const first = items[0];
  const last = items.at(-1);
  const active = nav.ownerDocument.activeElement;
  if (!first || !last) return;
  if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
}
```

- [ ] **Step 7: CSS.** Append to `shell.css`:

```css
/* Part 2 (A12): the scrim under an open drawer; a click on it closes the drawer. */
:where(.codebase-inspector-root) .ci-shell__scrim { position: absolute; inset: 0; z-index: 29; background: var(--background-modifier-cover); }
/* Part 2 (A11): the shell-level sample badge. */
:where(.codebase-inspector-root) .ci-topbar__sample { flex: none; }
```

Give every remaining bare `var(--font-ui-*)` in `shell.css` and `screens.css` its em fallback (`smaller → 0.8em`, `small → 0.9em`, `medium → 1em`, `large → 1.15em`).

- [ ] **Step 8: Run and confirm the tests pass.** `npx vitest run tests/component/shell-provenance.test.ts tests/unit/kit-css-fallbacks.test.ts tests/component/workspace-shell.test.ts tests/component/nav-column.test.ts tests/component/command-palette.test.ts` → PASS.

- [ ] **Step 9: Gate and commit.** `npm run typecheck && npm run lint:fast && npx eslint src/ui --max-warnings 0`

```bash
git add src/ui tests
git commit -m "feat(ui): shell sample badge (A11), drawer scrim and focus wrap (A12), copy minors

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Harness captures, evidence-note counts, full verification

**Files:**
- Modify: `tests/harness/page.ts`, `tests/harness/mount.ts`, `scripts/harness-shot.mjs`, `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`, `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`
- Possibly modify: `src/ui/styles/screens.css` (visual fixes found in the comparison)

- [ ] **Step 1: `?select=` in the harness.** In `tests/harness/mount.ts`, add `select?: string;` to `HarnessOptions`. Add a line to the header comment in `page.ts`: `//   ?select=first|<path>  select a file (for the file route)`. After `applyScreenState(store, options.screen);`, add:

```ts
  if (options.select) {
    const target = options.select === 'first'
      ? store.layout?.lots[0]?.entityId
      : store.snapshot?.entities.find((e) => e.kind === 'file' && e.path === options.select)?.id;
    if (target) store.select(target);
  }
```

In `page.ts`, pass the parameter through: `void mountHarness(leaf, { screen, route, select: params.get('select') ?? undefined });`. With `exactOptionalPropertyTypes`, spread it instead: `...(params.get('select') ? { select: params.get('select')! } : {})`.

- [ ] **Step 2: New shots.** In `scripts/harness-shot.mjs`, add these entries after the `wp02-overview-narrow-dark` entry:

```js
  // WP-02 Part 2: compare against docs/concept/prototype/screenshots/{architecture,hotspots,file}-{dark,light}.png.
  { id: 'wp02-architecture-dark', query: '?screen=s05&theme=dark&route=architecture' },
  { id: 'wp02-architecture-light', query: '?screen=s05&theme=light&route=architecture' },
  { id: 'wp02-architecture-narrow-dark', query: '?screen=s10&theme=dark&route=architecture&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-hotspots-dark', query: '?screen=s05&theme=dark&route=hotspots' },
  { id: 'wp02-hotspots-light', query: '?screen=s05&theme=light&route=hotspots' },
  { id: 'wp02-hotspots-narrow-dark', query: '?screen=s10&theme=dark&route=hotspots&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-file-dark', query: '?screen=s05&theme=dark&route=file&select=first' },
  { id: 'wp02-file-light', query: '?screen=s05&theme=light&route=file&select=first' },
  { id: 'wp02-file-narrow-dark', query: '?screen=s10&theme=dark&route=file&select=first&width=700', viewport: { width: 760, height: 900 } },
```

If `tests/harness/harness.test.ts` pins the shot list or count, update it to match, and report it.

- [ ] **Step 3: Capture and compare.** Run `npm run harness-shot`. The existing city shots must still show the drawn city. Open each new PNG in `harness-shots/` next to its prototype counterpart:
- `docs/concept/prototype/screenshots/architecture-dark.png` and `architecture-matrix-dark.png`
- `hotspots-dark.png`
- `file-dark.png`
- their light versions

Fix layout or spacing defects in `screens.css` only. **Expected, intended differences, not to be fixed:**
- sample labels everywhere
- "Root files" naming
- the metadata-only source panel (P9)
- no "Plan a boundary refactor" or "Export architecture" (P13)
- the fixture's `dir-N` module names
- Obsidian's own chrome

List every difference you leave in your report.

- [ ] **Step 4: Evidence-note counts.** Run `npx vitest run tests/unit/gate-evidence.test.ts tests/unit/evidence-numbers.test.ts`. The failures name each stale value: per-layer test-file counts, the total, and any derived src counts. Update exactly those values in `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` and `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md` **with the Edit tool** (these files are CRLF; never `sed -i`). Commit 6f99d30 is the pattern to follow (`git show 6f99d30`). The per-layer *test* counts come from the full suite run in Step 5. Put them in the G8 table exactly as Part 1 did, and do not change prose that is not a derived number. Re-run the two tests until they pass.

- [ ] **Step 5: Full verification.** Run `npm run verify`.
Expected: exit 0, except for `tests/unit/install-script.test.ts`. That test fails in a worktree without `.obsidian/`, which is environmental. Paste its failure verbatim in the report. Anything else failing is a real failure: fix it, or stop and report it.

- [ ] **Step 6: Commit.**

```bash
git add tests/harness scripts/harness-shot.mjs docs/superpowers/notes src/ui/styles
git commit -m "test(harness): Part 2 captures; refresh WP-01 evidence counts

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Overview is the start page (user directive, 2026-09-21; supersedes Part 1 A1)

> Added after plan approval. **Execute it after Task 10 and before Task 11**, so Task 11's evidence counts and `npm run verify` include it.

**Files:**
- Modify: `src/domain/route-ids.ts`, `src/ui/screens/NoSnapshot.vue`, `src/ui/screens/OverviewScreen.vue`
- Modify (tests): every test that mounts `App.vue` or a real `CityView` and assumes a fresh leaf shows the city. Each such test seeds route `'city'` explicitly.
- Test: `tests/unit/route-state.test.ts`, `tests/component/workspace-shell.test.ts`, `tests/component/overview-screen.test.ts`
- **Do not touch** `src/host/city-view.ts` (399/400) or `src/ui/screens/CityWorkspace.vue`.

**Interfaces:**
- Produces: `DEFAULT_ROUTE = 'overview'`. A missing or unknown persisted route decodes to `'overview'`, because the existing decode path already falls back to `DEFAULT_ROUTE`; verify it does, and do not add a second fallback.
- Produces: the "select a codebase" button on Overview and on `NoSnapshot` now calls `store.navigate('city')` and **then** `onSelectCodebase()`. The WP-01 scan states (scanning, failed, partial, …) live only on the city route (Part 1 A8), so the user sees the scan they just started.

- [ ] **Step 1: Write the failing tests.**
  - In `tests/unit/route-state.test.ts`, change the assertions that expect a default or missing or unknown route to be `'city'` so they expect `'overview'`. Keep the tests that check a *persisted* `'city'` is restored.
  - In `tests/component/workspace-shell.test.ts`, the test `'opens on the city, rendered inside the shell content area'` becomes `'opens on Overview; the city renders inside the shell content area once navigated'`. Assert that a fresh mount shows `.ci-screen--overview` and no `.ci-app`. Then call `useCityStore().navigate('city')`, `await nextTick()`, and assert `.ci-shell__content .ci-app` exists.
  - In `tests/component/overview-screen.test.ts`, add: with no snapshot, clicking `.ci-overview__select-source` calls the injected `onSelectCodebase` spy once and leaves `store.route === 'city'`.
  - Add the same check for `NoSnapshot` in `tests/component/architecture-screen.test.ts`: clicking its `.mod-cta` button navigates to `'city'` and calls the spy.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/route-state.test.ts tests/component/workspace-shell.test.ts tests/component/overview-screen.test.ts tests/component/architecture-screen.test.ts`
- [ ] **Step 3: Implement.**
  - In `route-ids.ts`, set `export const DEFAULT_ROUTE: RouteId = 'overview';` and replace its doc comment with: `/** A fresh leaf opens on Overview (user directive 2026-09-21, superseding Part 1 A1). */`.
  - In `NoSnapshot.vue` and `OverviewScreen.vue`, replace `@click="onSelectCodebase"` with a function that does `store.navigate('city'); onSelectCodebase();`. `NoSnapshot.vue` needs `useCityStore`.
- [ ] **Step 4: Sweep the suite for city-default assumptions.** Run `npx vitest run tests/component tests/host tests/acceptance tests/integration tests/unit`, ignoring the known `gate-evidence`, `evidence-numbers` and `install-script` failures. For every other test that now fails because a fresh leaf shows Overview instead of the city, seed the city route **in that file's existing setup helper** (one place per file, not per test):
  - Pinia-mounted `App`: call `useCityStore().navigate('city')` after `setActivePinia` and before `mount`.
  - Real `CityView` (tests/host, tests/acceptance): seed the route through the same view-state path the test already uses (`setState({ …, route: 'city' })` or the helper's state object).

  Never weaken an assertion. If a failure is anything other than the default-route change, stop and report it. List every file you changed and why in the report.
- [ ] **Step 5: Run and confirm they pass.** Run the same command again. Only the three known failures may remain. Also run `npm run typecheck && npm run lint:fast && npx eslint src/domain/route-ids.ts src/ui/screens --max-warnings 0`.
- [ ] **Step 6: Commit.**

```bash
git add src tests
git commit -m "feat(ui): Overview is the start page; source selection shows the city's scan states

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:**

  | Spec item | Task |
  |---|---|
  | P1 | 1 |
  | P2–P4, P6 | 3 |
  | P5 | 2, 7 |
  | P7 | 4, 8 |
  | P8 | 4, 8 |
  | P9–P11 | 9 |
  | P12 | 6 |
  | P13 | deliberately absent (6, 7, 9) |
  | §2.1 | 6, 7 |
  | §2.2 | 8 |
  | §2.3 | 5, 9 |
  | §3 | 3–5 |
  | §4 A13 | 1 |
  | §4 A11 / A12 | 10 |
  | §5 minors: pending-aware load | 2 |
  | §5 minors: copy / aria-haspopup / em fallbacks | 10 (plus 9, 6) |
  | §5 minors: "(root)" wording | 1 |
  | §6 harness / evidence | 11 |

- **Line budgets:**
  - `ArchitectureScreen.vue` ends at about 250 lines. Task 7 names the extraction to use if it passes about 300.
  - `App.vue` gains about 12 lines.
  - `FileInspector.vue` gains about 8 lines.
  - `city-view.ts` and `CityWorkspace.vue` are untouched.
- **Type names used across tasks:**
  - `FileSummary`, `MetricValue`, `ModuleSummary`, `ModuleEdge`, `RuleEvaluation`, `HotspotsModel`, `HotspotPoint`, `FileDetailModel`, `FileFinding`, `BoundaryRule`, `WorkItem`
  - `useReadModels()` returns `{ files, overview, citySummary, architecture, fileDetail, filesUseSample }`.
