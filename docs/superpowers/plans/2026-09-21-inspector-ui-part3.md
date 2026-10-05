# WP-02 Part 3 — The six Audit screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholders for Code quality, Test confidence, Dependencies, Security, Evolution and Ownership with working screens built from the prototype. Along the way:
- add the Finding review, Package detail and Snapshot comparison dialogs;
- store finding dispositions through the review port;
- generalize work items to files, packages and modules;
- land the Part 3 deferrals.

**Architecture:** This builds on the Part 1 and Part 2 shell unchanged:
- Screens read read models only.
- Every value is a `MetricValue`.
- `city-store` owns selection and route.
- Review decisions go through `ReviewRepository`.

New sample data lives in `src/ui/fixtures/`. New pure builders sit in `src/ui/read-models/`, memoized per files array in `use-read-models.ts`. A new in-memory `snapshot-journal` store makes snapshot comparison real within a session.

**Tech Stack:** TypeScript, Vue 3.5 (`<script setup>`, `defineModel`), Pinia 4, Vitest 5 + @vue/test-utils (jsdom), plain CSS under `:where(.codebase-inspector-root)`, hand-rolled SVG. There is no chart library.

**Spec:** `docs/superpowers/specs/2026-09-21-inspector-ui-part3-design.md` (decisions Q1–Q17). It sits on top of the Part 1 spec (`2026-09-21-inspector-ui-shell-design.md`, §9 A1–A13) and the Part 2 spec (`2026-09-21-inspector-ui-part2-design.md`, P1–P14; P14 supersedes A1). All three are binding.

**Branch:** `feat/wp-02-part3` (from `feat/wp-01-codebase-city` at 904692e). **Not stacked:** at the end, `feat/wp-01-codebase-city` is fast-forwarded to this branch and pushed, so the work lands on PR #1. The integration step is the user's choice.

## Global Constraints

**Size**
- `src/**/*.{ts,vue}` max **400** lines. `tests/**/*.ts` max **450** lines (eslint `max-lines`).
- `src/host/city-view.ts` is at 399/400: **add nothing to it**.
- `src/ui/screens/CityWorkspace.vue` is at ~386: **do not grow it**.
- `tests/host/city-view-store-wiring.test.ts` is at 450/450: **do not grow it**.
- `src/ui/inspector-copy.ts` is at 283. Part 3 strings go in `src/ui/audit-copy/<screen>.ts`, and `inspector-copy.ts` re-exports each with one `export * from './audit-copy/<screen>';` line (Task 1). Screens still import from `inspector-copy`.
- Any screen above ~300 lines gets a sub-component in `screens/<screen>/`.

**Browser globals**
- No bare `window`, `document`, `setTimeout`, `ResizeObserver`, `matchMedia`, `getComputedStyle`, `localStorage` in `src/ui/**` (eslint `no-restricted-globals`).
- Use `el.ownerDocument`, `el.ownerDocument.defaultView`, `win.setTimeout`, `nextTick`.
- Never `x instanceof HTMLElement`; always `x.instanceOf(HTMLElement)`, because pop-out windows are separate realms.
- Listeners go on the leaf/shell root or on component elements, **never the document**. Two leaves must not cross-talk.
- Element ids come from `useUniqueId()` (`src/ui/unique-id.ts`).

**TypeScript and lint**
- tsconfig `lib` is ES2020: no `Array.prototype.at()`, `Object.hasOwn`, `replaceAll`, `findLast` or any other ES2021+ API in `src`.
- oxlint runs `--deny-warnings` with `consistent-function-scoping`: a closure that captures nothing must be hoisted to module scope.
- `obsidianmd/prefer-create-el` applies. The only scoped exemption is `src/ui/export/download.ts` and its test.
- `exactOptionalPropertyTypes` is on: never assign `undefined` to an optional property; spread it in conditionally.

**Evidence**
- Absent evidence is never rendered or exported as `0`. It is a `MetricValue` with `state: 'unknown'` and a `reason`.
- No composite health score.
- Sample values are always labelled (`ProvenanceBadge`, `isSampleBacked`, the shell badge).
- Mutation, runtime exploitability and secret candidates are always `unknown`, never 0 and never "passing".
- **No exploitability verdict** anywhere on Security or Dependencies.
- **No individual people** anywhere on Ownership: no names, authors, rankings or per-person fields.
- Source file **content is never read**. Manifests are detected by entity name only.
- **Nothing is written to the vault.** Exports go through `downloadText`.
- `city-store` invariants are unchanged: `select` never moves the camera. Do not modify `select`, `setQuery`, `setCamera` (calling them is fine).

**Copy and CSS**
- Every new visible string goes in `src/ui/audit-copy/*.ts` (re-exported by `inspector-copy.ts`), **never** `src/ui/copy.ts`. `copy.ts` exports may be imported.
- CSS lives only in `src/ui/styles/{kit,shell,screens}.css`, under `:where(.codebase-inspector-root)`, with BEM `ci-*` classes and colours only through `--ci-*` tokens (reading Obsidian `var(--…)` is fine; never redefine `--background-*`, `--text-*`, `--interactive-*`).
- Every `var(--font-ui-*)` carries an em fallback: `smaller → 0.8em`, `small → 0.9em`, `medium → 1em`, `large → 1.15em` (`tests/unit/kit-css-fallbacks.test.ts`).
- **Never edit `src/ui/styles.css`.** No Vue `<style>` blocks.
- Import the kit dialog as `CiDialog`.

**Test infrastructure**
- jsdom stubs load through vitest `setupFiles`, **not** the obsidian mock. Component tests that open a `CiDialog` also `import '../mocks/obsidian'`.
- The harness (`npm run harness` / `npm run harness-shot`, real Chromium) must keep drawing the city; it defaults its own route to `city`. `tests/unit/obsidian-mock-scope.test.ts` guards this.
- Tests that mount `App` or a real `CityView` and need the city must seed route `'city'` in their setup helper.
- Edit files only with the Edit/Write tools. **Never `sed -i`**: it rewrites CRLF files on Windows.

**Gates and commits**
- Per-task gate: `npm run typecheck && npm run lint:fast && npx vitest run <the task's test files>`, plus `npx eslint <touched files> --max-warnings 0`.
- **The WP-01 evidence-note counts are updated ONCE, in Task 15.** Before that, `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` are expected to fail on file counts. Do not run the full suite per task, and do not "fix" those two tests.
- `tests/unit/install-script.test.ts` fails in any worktree without `.obsidian/`. This is environmental: report it and do not fix it.
- Commit after each task. Every message ends with a blank line and `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

**Process**
- Implementers and reviewers never spawn subagents. Implementers report back: files changed, test output, any deviation from this plan, and why.
- The controller records every ruling in `docs/superpowers/notes/2026-09-21-wp02-part3-ledger.md`.

## File map

| File | Status | Task | Responsibility |
|---|---|---|---|
| `src/ui/evidence.ts` | modify | 1 | `Provenance.includesSample`; `isSampleBacked` reads it |
| `src/ui/export/csv.ts` | create | 1 | `csvCell`, `CsvColumn`, `metricColumns`, `toCsv` |
| `src/ui/read-models/hotspots.ts` | modify | 1 | `hotspotsCsv` on `toCsv` (unchanged output) |
| `src/ui/read-models/use-read-models.ts` | modify | 1, 4–7 | architecture memo; new models |
| `src/ui/audit-copy/*.ts` | create | 1, 4–13 | Part 3 strings |
| `src/ui/inspector-copy.ts` | modify | 1 | `export *` lines; "sample" in two a11y labels |
| `src/ui/stores/ports/review-repository.ts` | modify | 2 | `WorkTarget`, `WorkIntent`, `workTargetKey`, `FindingDisposition`, disposition methods |
| `src/ui/stores/review-store.ts` | modify | 2 | targets, intents, dispositions |
| `src/ui/screens/FileDetailScreen.vue` | modify | 2, 8 | `workItemsForFile`; finding dialog |
| `src/ui/stores/snapshot-journal.ts` | create | 3 | Q8 journal |
| `src/ui/read-models/snapshot-comparison.ts` | create | 3 | `journalEntryFor`, `compareSnapshots` |
| `src/ui/shell/use-journal-feed.ts` | create | 3 | feeds the journal from `city-store.snapshot` |
| `src/ui/read-models/findings.ts` | create | 4 | quality model, filters, CSV |
| `src/ui/read-models/file-detail.ts` | modify | 4 | `FileFinding.fingerprint` |
| `src/ui/fixtures/sample-test-runs.ts`, `src/ui/read-models/test-confidence.ts` | create | 5 | Test confidence |
| `tests/fixtures/snapshot-builder.ts` | modify | 5 | optional `testFiles` |
| `src/ui/fixtures/sample-packages.ts`, `src/ui/read-models/{dependencies,security,root-label}.ts` | create | 6 | Dependencies, Security |
| `src/ui/fixtures/{sample-evolution,sample-stewardship}.ts`, `src/ui/read-models/{evolution,ownership}.ts` | create | 7 | Evolution, Ownership |
| `src/ui/screens/QualityScreen.vue` + `quality/{FindingFilters,FindingsTable,FindingReviewDialog}.vue` | create | 8 | Code quality |
| `src/ui/screens/file/FileFindingsPanel.vue` | modify | 8 | finding rows open the dialog |
| `src/ui/screens/TestsScreen.vue` + `tests/{CoverageMap,CoverageGapsTable,TestRunsTable}.vue`, `screens/shared/{UnknownEvidenceState,EvidenceSourceDialog,evidence-source}`, `kit/{MeterList.vue,meter-types.ts}` | create | 9 | Test confidence |
| `src/ui/screens/DependenciesScreen.vue` + `dependencies/{PackageTable,DependencyPath,LicenseTable,PackageDetailDialog}.vue` | create | 10 | Dependencies |
| `src/ui/screens/SecurityScreen.vue` + `security/{AdvisoryList,ReviewChecklist}.vue` | create | 11 | Security |
| `src/ui/kit/BarChart.vue`, `src/ui/screens/EvolutionScreen.vue` + `evolution/{ChangeCouplingTable,SnapshotJournal,SnapshotComparisonDialog}.vue` | create | 12 | Evolution |
| `src/ui/screens/OverviewScreen.vue`, `src/ui/screens/CityScreen.vue` | modify | 12 | Compare opens the dialog |
| `src/ui/screens/OwnershipScreen.vue` + `ownership/{StewardshipActions,StewardshipTable}.vue` | create | 13 | Ownership |
| `src/ui/App.vue` | modify | 3, 6, 8–14 | route outlet, journal feed, `rootFolderLabel`, drawer `inert` (14) |
| `src/ui/shell/use-route-provenance.ts` | modify | 8–13 | one case per route |
| `src/ui/kit/Tabs.vue` | modify | 9 | `data-tab-id` |
| `src/ui/styles/{kit,screens,shell}.css` | modify | 8–13 | styles |
| `tests/harness/{page.ts,mount.ts}`, `scripts/harness-shot.mjs` | modify | 15 | `?tab=`, new shots |
| `docs/superpowers/notes/2026-09-17-wp01-{gate-evidence,implementation-report}.md` | modify | 15 | derived counts |

---

### Task 1: Foundations: the mixed-source sample flag, the shared CSV helper, the architecture memo, and the copy split

**Files:**
- Modify: `src/ui/evidence.ts`, `src/ui/read-models/hotspots.ts`, `src/ui/read-models/use-read-models.ts`, `src/ui/inspector-copy.ts`
- Create: `src/ui/export/csv.ts`, `src/ui/audit-copy/shared.ts`
- Test: `tests/unit/evidence.test.ts`, `tests/unit/csv.test.ts` (new), `tests/unit/hotspots-model.test.ts`, `tests/unit/read-models.test.ts`

**Interfaces:**
- Produces:
  - `Provenance { source: string; detail?: string; includesSample?: true }`.
  - `export/csv.ts`:
    - `csvCell(value: string | number | undefined): string`
    - `interface CsvColumn<T> { header: string; value: (row: T) => string | number | undefined }`
    - `metricColumns<T>(name: string, get: (row: T) => MetricValue<unknown>): CsvColumn<T>[]`, which returns the `name` and `name_state` columns
    - `toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string`, with a BOM, CRLF line endings and a trailing CRLF
  - `use-read-models.ts`: `architectureModelFor(graph, rules)`.
  - `audit-copy/shared.ts`: `SAMPLE_BADGE_DETAIL`, `SHOW_MORE`, `RESET_FILTERS`, `EXPORT_FAILED` (`NO_FILES_REASON` already exists in `inspector-copy.ts`; reuse it).

- [ ] **Step 1: Write the failing tests.**

In `tests/unit/evidence.test.ts`, add:

```ts
describe('includesSample (Part 3 §4)', () => {
  it('marks a partial aggregate whose present inputs mix collected and sample', () => {
    const m = sumEvidence([collected(3, 'inventory'), sample(4), unknown('x')]);
    expect(m.state).toBe('partial');
    expect(m.provenance.source).toBe('aggregate');
    expect(m.provenance.includesSample).toBe(true);
    expect(isSampleBacked(m)).toBe(true);
  });
  it('marks a ratio of a collected value over a sample value', () => {
    const r = ratioEvidence(collected(1, 'inventory'), sample(4));
    expect(isSampleBacked(r)).toBe(true);
  });
  it('leaves an all-collected aggregate unflagged', () => {
    const m = sumEvidence([collected(1, 'inventory'), collected(2, 'inventory')]);
    expect(m.provenance).toEqual({ source: 'inventory' });
    expect(isSampleBacked(m)).toBe(false);
  });
  it('does not add the flag when the source is already sample', () => {
    expect(sumEvidence([sample(1), sample(2)]).provenance).toEqual({ source: 'sample' });
  });
});
```

Create `tests/unit/csv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { csvCell, metricColumns, toCsv } from '../../src/ui/export/csv';
import { sample, unknown, type MetricValue } from '../../src/ui/evidence';

describe('csv', () => {
  it('guards formulas in strings only, and quotes per RFC 4180', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell(-1)).toBe('-1');
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(undefined)).toBe('');
  });
  it('writes a BOM, a header, CRLF rows and a value/state pair per metric; unknown is an empty cell', () => {
    interface Row { name: string; m: MetricValue }
    const rows: Row[] = [{ name: 'a', m: sample(3) }, { name: 'b', m: unknown('no data') }];
    const text = toCsv<Row>([{ header: 'name', value: (r) => r.name }, ...metricColumns<Row>('m', (r) => r.m)], rows);
    expect(text).toBe('﻿name,m,m_state\r\na,3,sample\r\nb,,unknown\r\n');
  });
});
```

In `tests/unit/read-models.test.ts`, add a test that two `useReadModels()` callers in one Pinia get the **same** `architecture.value` object:
- set a snapshot;
- mount two components that each call `useReadModels()`, the same way the file's existing memo tests do;
- assert `toBe` identity;
- then `await useReviewStore().addRule(...)` for two graph modules and assert that both callers see one new identical model with `rules.length === 1`.

If the file would pass 450 lines, put this test in a new `tests/unit/architecture-memo.test.ts` instead.

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/evidence.test.ts tests/unit/csv.test.ts tests/unit/read-models.test.ts`

- [ ] **Step 3: Implement `evidence.ts`.**
  - Change the interface to `export interface Provenance { source: string; detail?: string; includesSample?: true }`.
  - Add this below `sharedSource`:

```ts
/** Part 3 §4: a value built from inputs that include sample data says so, even when its
 *  state is `partial` and its source is `aggregate`. Never added to a `sample` source. */
function flagSample(prov: Provenance, inputs: readonly MetricValue<unknown>[]): Provenance {
  return prov.source !== 'sample' && inputs.some(isSampleBacked) ? { ...prov, includesSample: true } : prov;
}
```

  - In `aggregate`, change `const prov = { source: sharedSource(present) };` to `const prov = flagSample({ source: sharedSource(present) }, present);`.
  - In `ratioEvidence`, change `provenance: { source: sharedSource([numerator, denominator]) },` to `provenance: flagSample({ source: sharedSource([numerator, denominator]) }, [numerator, denominator]),`.
  - Replace the body of `isSampleBacked` with `return m.state === 'sample' || m.provenance.source === 'sample' || m.provenance.includesSample === true;`.
  - If an existing assertion elsewhere compares a mixed-source aggregate's `provenance` with `toEqual`, update it to include `includesSample: true` and list it in your report.

- [ ] **Step 4: Create `src/ui/export/csv.ts`,** moving `csvCell` out of `hotspots.ts`:

```ts
// Part 2 P8 / Part 3 Q15: one CSV writer for every export. Unknown evidence is an empty
// cell and its `_state` column says why, so absent evidence is never exported as 0.
import type { MetricValue } from '../evidence';

/** P8: a string cell starting with = + - @ (or tab/CR) is prefixed with ' so a
 *  spreadsheet never evaluates it. Numbers are never prefixed. */
export function csvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvColumn<T> { header: string; value: (row: T) => string | number | undefined }

export function metricColumns<T>(name: string, get: (row: T) => MetricValue<unknown>): CsvColumn<T>[] {
  return [
    { header: name, value: (row) => { const v = get(row).value; return typeof v === 'number' || typeof v === 'string' ? v : undefined; } },
    { header: `${name}_state`, value: (row) => get(row).state },
  ];
}

/** RFC 4180 line endings, and a UTF-8 byte-order mark so Excel reads non-ASCII paths. */
export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const header = columns.map((c) => csvCell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','));
  return `﻿${[header, ...lines].join('\r\n')}\r\n`;
}
```

  In `hotspots.ts`, delete `csvCell` and `CSV_METRICS` and rebuild `hotspotsCsv` on `toCsv`, with the same columns in the same order (`path`, `module`, then `priority`, `complexity`, `commits_90d`, `branch_coverage_pct`, `lines`, each through `metricColumns`). The existing `tests/unit/hotspots-model.test.ts` CSV assertions must pass **unchanged**.

- [ ] **Step 5: Memoize the architecture model** in `use-read-models.ts`:

```ts
/** Part 3 §4: one Architecture model per (graph, rule set), shared by every caller. The
 *  rules array is mutated in place by `addRule`, so the key is a signature, not identity. */
const architectureCache = new WeakMap<ArchitectureGraph, { signature: string; model: ArchitectureModel }>();
const rulesSignature = (rules: readonly BoundaryRule[]): string => rules.map((r) => `${r.id}:${r.from}>${r.to}`).join('|');
export function architectureModelFor(graph: ArchitectureGraph, rules: readonly BoundaryRule[]): ArchitectureModel {
  const signature = rulesSignature(rules);
  const hit = architectureCache.get(graph);
  if (hit && hit.signature === signature) return hit.model;
  const model = buildArchitectureModel(graph, rules);
  architectureCache.set(graph, { signature, model });
  return model;
}
```

  Change the computed to `const architecture = computed(() => architectureModelFor(graph.value, review.rules));`. Import the `ArchitectureModel` and `BoundaryRule` types.

- [ ] **Step 6: The copy split and the two a11y labels.**
  - Create `src/ui/audit-copy/shared.ts`:

```ts
// Part 3: strings shared by the six Audit screens. Re-exported by inspector-copy.ts.
export const SAMPLE_BADGE_DETAIL = 'Sample data';
export const SHOW_MORE = (n: number): string => `Show ${n} more`;
export const RESET_FILTERS = 'Reset filters';
export const EXPORT_FAILED = 'Could not start the download.';
```

  - At the end of `inspector-copy.ts`, add `/** Part 3: Audit screens. Each file is re-exported here, so screens import only from inspector-copy. */` and `export * from './audit-copy/shared';`. Tasks 4–13 add one line each.
  - Change `HOTSPOTS_SCATTER_LABEL` to `'Sample signals: files by complexity and commits in the last 90 days'`.
  - Append `, sample edges` to the string `ARCH_NODE_LABEL` returns.
  - Update any test that pins either string and list it in your report.

- [ ] **Step 7: Run and confirm they pass.** `npx vitest run tests/unit/evidence.test.ts tests/unit/csv.test.ts tests/unit/hotspots-model.test.ts tests/unit/read-models.test.ts tests/component/hotspots-screen.test.ts tests/component/architecture-screen.test.ts`, then the gate.

- [ ] **Step 8: Commit.** `feat(ui): sample flag through partial aggregates; shared CSV writer; one Architecture model per rule set`

---

### Task 2: Review port: work-item targets and intents, and finding dispositions

**Files:**
- Modify: `src/ui/stores/ports/review-repository.ts`, `src/ui/stores/review-store.ts`, `src/ui/screens/FileDetailScreen.vue`
- Test: `tests/unit/review-store.test.ts` (literals only), `tests/unit/review-dispositions.test.ts` (new)

**Interfaces:**
- Produces, in `review-repository.ts`:

```ts
export type WorkTarget =
  | { kind: 'file'; entityId: EntityId }
  | { kind: 'package'; name: string }
  | { kind: 'module'; module: string };
export type WorkIntent = 'refactor' | 'tests' | 'review' | 'pairing' | 'documentation';
export interface WorkItem { id: string; target: WorkTarget; intent: WorkIntent; title: string; status: WorkItemStatus; createdAt: string }
export function workTargetKey(target: WorkTarget, intent: WorkIntent): string;
export type DispositionStatus = 'acknowledged' | 'dismissed';
export interface FindingDisposition { fingerprint: string; status: DispositionStatus; reason?: string; decidedAt: string }
export const DISMISS_REASON_MAX = 1000;
// ReviewRepository gains:
listDispositions(): Promise<FindingDisposition[]>;
saveDisposition(d: FindingDisposition): Promise<void>;
removeDisposition(fingerprint: string): Promise<void>;
```

- Produces, in `review-store.ts`:
  - getters:
    - `hasWorkItem(target, intent)`
    - `isPending(target, intent)`
    - `hasWorkItemFor(entityId)` and `isPendingFor(entityId)`, unchanged in meaning: a `refactor` item for that file
    - `workItemsForFile(entityId): WorkItem[]` (any intent)
    - `dispositionFor(fingerprint): FindingDisposition | undefined`
    - `isDispositionPending(fingerprint): boolean`
  - actions:
    - `addWorkItem(target, intent, title, now): Promise<WorkItem | null>`
    - `addWorkItemForFile(entityId, title, now)`, which now delegates
    - `acknowledge(fingerprint, now): Promise<FindingDisposition | null>`
    - `dismiss(fingerprint, reason, now): Promise<FindingDisposition | null>`, which refuses an empty or over-long reason with null
    - `reopen(fingerprint): Promise<void>`

- [ ] **Step 1: Write the failing tests.** In `tests/unit/review-store.test.ts`, change every `WorkItem` literal from `entityId: 'eN'` to `target: { kind: 'file', entityId: 'eN' }, intent: 'refactor'`. Change nothing else. Create `tests/unit/review-dispositions.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import {
  createInMemoryReviewRepository, DISMISS_REASON_MAX, workTargetKey, type ReviewRepository,
} from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-21T10:00:00.000Z');
const noop = (): void => {};

describe('work-item targets (Part 3 Q4)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('keys uniqueness by target AND intent', async () => {
    const store = useReviewStore();
    const mod = { kind: 'module', module: 'src' } as const;
    expect(await store.addWorkItem(mod, 'pairing', 'Pair', NOW)).not.toBeNull();
    expect(await store.addWorkItem(mod, 'pairing', 'Again', NOW)).toBeNull();
    expect(await store.addWorkItem(mod, 'documentation', 'Doc', NOW)).not.toBeNull();
    expect(await store.addWorkItem({ kind: 'package', name: '@sample/x' }, 'review', 'Review', NOW)).not.toBeNull();
    expect(store.workItemCount).toBe(3);
  });

  it('keeps hasWorkItemFor meaning "a refactor item for this file"', async () => {
    const store = useReviewStore();
    await store.addWorkItem({ kind: 'file', entityId: 'e1' }, 'tests', 'Plan tests', NOW);
    expect(store.hasWorkItemFor('e1')).toBe(false);
    expect(store.workItemsForFile('e1')).toHaveLength(1);
    await store.addWorkItemForFile('e1', 'Investigate', NOW);
    expect(store.hasWorkItemFor('e1')).toBe(true);
    expect(store.workItemsForFile('e1')).toHaveLength(2);
  });

  it('never mixes up keys across kinds', () => {
    expect(workTargetKey({ kind: 'package', name: 'a' }, 'review')).not.toBe(workTargetKey({ kind: 'module', module: 'a' }, 'review'));
  });
});

describe('finding dispositions (Part 3 Q3)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('acknowledges and reopens through the port', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const d = await store.acknowledge('e1#CX-src-0', NOW);
    expect(d).toEqual({ fingerprint: 'e1#CX-src-0', status: 'acknowledged', decidedAt: NOW.toISOString() });
    expect(store.dispositionFor('e1#CX-src-0')?.status).toBe('acknowledged');
    expect(await repo.listDispositions()).toHaveLength(1);
    await store.reopen('e1#CX-src-0');
    expect(store.dispositionFor('e1#CX-src-0')).toBeUndefined();
    expect(await repo.listDispositions()).toHaveLength(0);
  });

  it('dismiss requires a trimmed, non-empty reason of at most 1000 characters', async () => {
    const store = useReviewStore();
    expect(await store.dismiss('f', '   ', NOW)).toBeNull();
    expect(await store.dismiss('f', 'x'.repeat(DISMISS_REASON_MAX + 1), NOW)).toBeNull();
    const d = await store.dismiss('f', '  exported for a plugin API  ', NOW);
    expect(d?.reason).toBe('exported for a plugin API');
    expect(store.dispositionFor('f')?.status).toBe('dismissed');
  });

  it('a later decision replaces the earlier one for the same fingerprint', async () => {
    const store = useReviewStore();
    await store.acknowledge('f', NOW);
    await store.dismiss('f', 'reason', NOW);
    expect(store.dispositions).toHaveLength(1);
    expect(store.dispositionFor('f')?.status).toBe('dismissed');
  });

  it('persists before mutating: a rejecting port leaves state unchanged and clears pending', async () => {
    const base = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...base, saveDisposition: () => Promise.reject(new Error('save failed')) });
    await expect(store.acknowledge('f', NOW)).rejects.toThrow('save failed');
    expect(store.dispositionFor('f')).toBeUndefined();
    expect(store.isDispositionPending('f')).toBe(false);
  });

  it('refuses a second decision while the first is saving', async () => {
    let release: () => void = noop;
    const base = createInMemoryReviewRepository();
    const slow: ReviewRepository = {
      ...base, saveDisposition: (d) => new Promise((res) => { release = () => { void base.saveDisposition(d).then(res); }; }),
    };
    const store = useReviewStore();
    store.setRepository(slow);
    const first = store.acknowledge('f', NOW);
    expect(store.isDispositionPending('f')).toBe(true);
    expect(await store.dismiss('f', 'why', NOW)).toBeNull();
    release();
    await first;
    expect(store.dispositionFor('f')?.status).toBe('acknowledged');
  });

  it('load() reads dispositions, including ones for findings no longer present', async () => {
    const repo = createInMemoryReviewRepository();
    await repo.saveDisposition({ fingerprint: 'gone#CX-x-0', status: 'dismissed', reason: 'r', decidedAt: NOW.toISOString() });
    const store = useReviewStore();
    store.setRepository(repo);
    await store.load();
    expect(store.dispositionFor('gone#CX-x-0')?.reason).toBe('r');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/review-store.test.ts tests/unit/review-dispositions.test.ts`

- [ ] **Step 3: Implement the port.** In `review-repository.ts`:
  - Add the types from **Interfaces**, and replace `entityId: EntityId;` in `WorkItem` with `target: WorkTarget; intent: WorkIntent;`.
  - Add the key function:

```ts
/** Part 3 Q4: one work item per (target, intent). The kind prefix keeps a package and a
 *  module with the same name apart. */
export function workTargetKey(target: WorkTarget, intent: WorkIntent): string {
  const subject = target.kind === 'file' ? target.entityId : target.kind === 'package' ? target.name : target.module;
  return `${target.kind}:${subject}:${intent}`;
}
```

  - Add a third `Map<string, FindingDisposition>` keyed by fingerprint to the in-memory repository, with `listDispositions`, `saveDisposition` (stores a copy) and `removeDisposition`.
  - Update the header comment: "Part 3 adds dispositions (Q3) and work-item targets (Q4)."

- [ ] **Step 4: Implement the store.** In `review-store.ts`:
  - **State:**
    - Replace `pendingEntityIds: EntityId[]` with `pendingWorkKeys: string[]`, moving its doc comment onto the new field.
    - Add `dispositions: FindingDisposition[]` and `pendingFingerprints: string[]`.
  - **Getters:**

```ts
    hasWorkItem: (state) => (target: WorkTarget, intent: WorkIntent): boolean =>
      state.workItems.some((w) => workTargetKey(w.target, w.intent) === workTargetKey(target, intent)),
    isPending: (state) => (target: WorkTarget, intent: WorkIntent): boolean =>
      state.pendingWorkKeys.includes(workTargetKey(target, intent)),
    /** Unchanged meaning since Part 1: this file already has a REFACTOR item. */
    hasWorkItemFor: (state) => (entityId: EntityId): boolean =>
      state.workItems.some((w) => w.intent === 'refactor' && w.target.kind === 'file' && w.target.entityId === entityId),
    isPendingFor: (state) => (entityId: EntityId): boolean =>
      state.pendingWorkKeys.includes(workTargetKey({ kind: 'file', entityId }, 'refactor')),
    workItemsForFile: (state) => (entityId: EntityId): WorkItem[] =>
      state.workItems.filter((w) => w.target.kind === 'file' && w.target.entityId === entityId),
    dispositionFor: (state) => (fingerprint: string): FindingDisposition | undefined =>
      state.dispositions.find((d) => d.fingerprint === fingerprint),
    isDispositionPending: (state) => (fingerprint: string): boolean => state.pendingFingerprints.includes(fingerprint),
```

  - **Actions:**
    - `addWorkItem` takes over the body of today's `addWorkItemForFile`, generalized. Keep its doc comment.
    - `load()` also reads `listDispositions()` (add it to the `Promise.all`).

```ts
    async addWorkItem(target: WorkTarget, intent: WorkIntent, title: string, now: Date): Promise<WorkItem | null> {
      const key = workTargetKey(target, intent);
      if (this.hasWorkItem(target, intent) || this.pendingWorkKeys.includes(key)) return null;
      const item: WorkItem = { id: `wi-${this.nextId}`, target, intent, title, status: 'investigate', createdAt: now.toISOString() };
      this.nextId += 1;
      this.pendingWorkKeys.push(key);
      try {
        await this.repository.saveWorkItem(item);
        if (!this.workItems.some((w) => w.id === item.id)) this.workItems.push(item);
        return item;
      } finally {
        this.pendingWorkKeys = this.pendingWorkKeys.filter((k) => k !== key);
      }
    },
    addWorkItemForFile(entityId: EntityId, title: string, now: Date): Promise<WorkItem | null> {
      return this.addWorkItem({ kind: 'file', entityId }, 'refactor', title, now);
    },
    /** Part 3 Q3: a decision is stored apart from the generated finding, keyed by its
     *  fingerprint. Same persist-first ordering and pending guard as work items. */
    async decide(disposition: FindingDisposition): Promise<FindingDisposition | null> {
      const fp = disposition.fingerprint;
      if (this.pendingFingerprints.includes(fp)) return null;
      this.pendingFingerprints.push(fp);
      try {
        await this.repository.saveDisposition(disposition);
        this.dispositions = [...this.dispositions.filter((d) => d.fingerprint !== fp), disposition];
        return disposition;
      } finally {
        this.pendingFingerprints = this.pendingFingerprints.filter((f) => f !== fp);
      }
    },
    acknowledge(fingerprint: string, now: Date): Promise<FindingDisposition | null> {
      return this.decide({ fingerprint, status: 'acknowledged', decidedAt: now.toISOString() });
    },
    dismiss(fingerprint: string, reason: string, now: Date): Promise<FindingDisposition | null> {
      const trimmed = reason.trim();
      if (trimmed === '' || trimmed.length > DISMISS_REASON_MAX) return Promise.resolve(null);
      return this.decide({ fingerprint, status: 'dismissed', reason: trimmed, decidedAt: now.toISOString() });
    },
    /** Reopening deletes the decision: a finding without one is open. */
    async reopen(fingerprint: string): Promise<void> {
      await this.repository.removeDisposition(fingerprint);
      this.dispositions = this.dispositions.filter((d) => d.fingerprint !== fingerprint);
    },
```

  - Update the header comment of `review-store.ts` for Part 3 Q3 and Q4.
  - `FileInspector.vue` needs no change.
- [ ] **Step 5: The one consumer.** In `FileDetailScreen.vue`, replace the `workItems` computed body with `const id = fileDetail.value?.file.id; return id ? review.workItemsForFile(id) : [];`.
- [ ] **Step 6: Run and confirm they pass.** `npx vitest run tests/unit/review-store.test.ts tests/unit/review-dispositions.test.ts tests/component/file-detail-screen.test.ts tests/component/file-inspector.test.ts tests/component/nav-column.test.ts`, then the gate.
- [ ] **Step 7: Commit.** `feat(ui): work items target files, packages or modules; finding dispositions behind the review port`

---

### Task 3: The in-memory snapshot journal and snapshot comparison

**Files:**
- Create: `src/ui/read-models/snapshot-comparison.ts`, `src/ui/stores/snapshot-journal.ts`, `src/ui/shell/use-journal-feed.ts`
- Modify: `src/ui/App.vue` (one import, one call)
- Test: `tests/unit/snapshot-journal.test.ts` (new)

**Interfaces:**
- Produces:

```ts
// read-models/snapshot-comparison.ts
export interface JournalModule { module: string; files: number; lines: MetricValue }
export interface JournalEntry {
  snapshotId: string; repositoryId: string; capturedAt: string;
  files: number; lines: MetricValue; modules: readonly JournalModule[]; fileIds: ReadonlySet<EntityId>;
}
export interface ModuleDelta { module: string; label: string; filesBefore: number; filesAfter: number; linesBefore: MetricValue; linesAfter: MetricValue; changed: boolean }
export interface SnapshotComparison {
  base: JournalEntry; current: JournalEntry;
  added: number; removed: number; kept: number; filesDelta: number; linesDelta: MetricValue;
  modules: readonly ModuleDelta[];
}
export function journalEntryFor(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): JournalEntry;
export function compareSnapshots(base: JournalEntry, current: JournalEntry): SnapshotComparison;
// stores/snapshot-journal.ts
export const JOURNAL_CAP = 10;
export const useSnapshotJournal: StoreDefinition; // state { entries: JournalEntry[] }, action record(entry)
// shell/use-journal-feed.ts
export function useJournalFeed(): void;
```

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/snapshot-journal.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { compareSnapshots, journalEntryFor } from '../../src/ui/read-models/snapshot-comparison';
import { JOURNAL_CAP, useSnapshotJournal } from '../../src/ui/stores/snapshot-journal';
import type { CodebaseSnapshot } from '../../src/domain/model';

const entry = (snap: CodebaseSnapshot) => journalEntryFor(snap, fileSummariesFor(snap));
const withId = (snap: CodebaseSnapshot, snapshotId: string): CodebaseSnapshot => ({ ...snap, snapshotId });

describe('journalEntryFor / compareSnapshots (Part 3 Q8, Q9)', () => {
  it('summarizes files, collected lines and modules', () => {
    const snap = buildSnapshotFixture({ files: 12, directories: 3 });
    const e = entry(snap);
    expect(e.files).toBe(12);
    expect(e.lines.state).toBe('collected');
    expect(e.modules.map((m) => m.module)).toEqual(['dir-0', 'dir-1', 'dir-2']);
    expect(e.modules.every((m) => m.files === 4)).toBe(true);
  });

  it('counts added, removed and kept files by identity, and module deltas', () => {
    const before = entry(buildSnapshotFixture({ files: 10, directories: 2 }));
    const after = entry(buildSnapshotFixture({ files: 13, directories: 2 }));
    const c = compareSnapshots(before, after);
    expect(c.added).toBe(3);
    expect(c.removed).toBe(0);
    expect(c.kept).toBe(10);
    expect(c.filesDelta).toBe(3);
    expect(c.linesDelta.state).toBe('collected');
    expect(c.modules.find((m) => m.module === 'dir-0')).toMatchObject({ filesBefore: 5, filesAfter: 7, changed: true });
  });

  it('an unknown line total makes the line delta unknown, never a 0 delta', () => {
    const before = entry(buildSnapshotFixture({ files: 3, unavailable: 3 }));
    const after = entry(buildSnapshotFixture({ files: 3 }));
    expect(compareSnapshots(before, after).linesDelta.state).toBe('unknown');
  });
});

describe('snapshot journal store', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('records each distinct snapshot once, oldest first', () => {
    const j = useSnapshotJournal();
    const snap = buildSnapshotFixture({ files: 3 });
    j.record(entry(snap));
    j.record(entry(snap));
    j.record(entry(withId(snap, 'second')));
    expect(j.entries.map((e) => e.snapshotId)).toEqual([snap.snapshotId, 'second']);
  });

  it('keeps at most JOURNAL_CAP entries, dropping the oldest', () => {
    const j = useSnapshotJournal();
    const snap = buildSnapshotFixture({ files: 2 });
    for (let i = 0; i < JOURNAL_CAP + 2; i += 1) j.record(entry(withId(snap, `s${i}`)));
    expect(j.entries).toHaveLength(JOURNAL_CAP);
    expect(j.entries[0]?.snapshotId).toBe('s2');
  });

  it('starts over when the repository changes', () => {
    const j = useSnapshotJournal();
    j.record(entry(buildSnapshotFixture({ files: 2, repositoryId: 'a' })));
    j.record(entry(buildSnapshotFixture({ files: 2, repositoryId: 'b' })));
    expect(j.entries.map((e) => e.repositoryId)).toEqual(['b']);
  });
});
```

  Check `buildSnapshotFixture`'s `snapshotId` first. If it is the same for two different specs, the "added" test still works because it compares entries directly. If the journal test needs distinct ids, use `withId` as shown.

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/snapshot-journal.test.ts`
- [ ] **Step 3: Implement `read-models/snapshot-comparison.ts`:**

```ts
// Part 3 Q8/Q9: a light, collected summary of one snapshot, and the difference between
// two. Everything here comes from the inventory; nothing is sample.
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot } from '../../domain/model';
import { hasValue, sumEvidence, unknown, type MetricValue } from '../evidence';
import { COMPARE_LINES_UNKNOWN } from '../inspector-copy';
import { moduleLabel, type FileSummary } from './file-summaries';

export interface JournalModule { module: string; files: number; lines: MetricValue }
export interface JournalEntry {
  snapshotId: string; repositoryId: string; capturedAt: string;
  files: number; lines: MetricValue; modules: readonly JournalModule[]; fileIds: ReadonlySet<EntityId>;
}
export interface ModuleDelta {
  module: string; label: string; filesBefore: number; filesAfter: number;
  linesBefore: MetricValue; linesAfter: MetricValue; changed: boolean;
}
export interface SnapshotComparison {
  base: JournalEntry; current: JournalEntry;
  added: number; removed: number; kept: number; filesDelta: number; linesDelta: MetricValue;
  modules: readonly ModuleDelta[];
}

const NONE: JournalModule = { module: '', files: 0, lines: unknown(COMPARE_LINES_UNKNOWN) };

export function journalEntryFor(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): JournalEntry {
  const groups = new Map<string, FileSummary[]>();
  for (const f of files) {
    const group = groups.get(f.module);
    if (group) group.push(f); else groups.set(f.module, [f]);
  }
  const modules = [...groups.entries()]
    .map(([module, fs]) => ({ module, files: fs.length, lines: sumEvidence(fs.map((f) => f.lines)) }))
    .sort((a, b) => a.module.localeCompare(b.module));
  return {
    snapshotId: snapshot.snapshotId, repositoryId: snapshot.repositoryId, capturedAt: snapshot.providerRun.capturedAt,
    files: files.length, lines: sumEvidence(files.map((f) => f.lines)), modules, fileIds: new Set(files.map((f) => f.id)),
  };
}

/** Both totals must have a value; a partial total makes the delta partial. */
function delta(before: MetricValue, after: MetricValue): MetricValue {
  if (!hasValue(before) || !hasValue(after)) return unknown(COMPARE_LINES_UNKNOWN, 'inventory');
  const partial = before.state !== 'collected' || after.state !== 'collected';
  return partial
    ? { state: 'partial', value: after.value - before.value, provenance: { source: 'inventory' }, reason: before.reason ?? after.reason ?? COMPARE_LINES_UNKNOWN }
    : { state: 'collected', value: after.value - before.value, provenance: { source: 'inventory' } };
}

const sameLines = (a: MetricValue, b: MetricValue): boolean => a.value === b.value && a.state === b.state;

export function compareSnapshots(base: JournalEntry, current: JournalEntry): SnapshotComparison {
  let kept = 0;
  for (const id of current.fileIds) if (base.fileIds.has(id)) kept += 1;
  const names = [...new Set([...base.modules, ...current.modules].map((m) => m.module))];
  const modules = names.map((module) => {
    const b = base.modules.find((m) => m.module === module) ?? NONE;
    const a = current.modules.find((m) => m.module === module) ?? NONE;
    return {
      module, label: moduleLabel(module), filesBefore: b.files, filesAfter: a.files, linesBefore: b.lines, linesAfter: a.lines,
      changed: b.files !== a.files || !sameLines(b.lines, a.lines),
    };
  }).sort((x, y) => x.label.localeCompare(y.label));
  return {
    base, current, kept, added: current.files - kept, removed: base.files - kept,
    filesDelta: current.files - base.files, linesDelta: delta(base.lines, current.lines), modules,
  };
}
```

  Create `src/ui/audit-copy/evolution.ts` now, with `export const COMPARE_LINES_UNKNOWN = 'Line totals are not known for both snapshots.';`, and add `export * from './audit-copy/evolution';` to `inspector-copy.ts`. Task 12 adds the rest of the Evolution strings to this file.

- [ ] **Step 4: Implement the store and the feed.**

```ts
// stores/snapshot-journal.ts — Part 3 Q8: the snapshots this leaf has shown in this
// session, in memory only (durable history is WP-05). One store per leaf's Pinia.
import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type { JournalEntry } from '../read-models/snapshot-comparison';

export const JOURNAL_CAP = 10;

export const useSnapshotJournal = defineStore('snapshot-journal', {
  state: () => ({ entries: [] as JournalEntry[] }),
  actions: {
    /** Oldest first. A snapshot already recorded is ignored; a different repository
     *  starts the journal over, so two codebases are never compared. */
    record(entry: JournalEntry): void {
      const last = this.entries[this.entries.length - 1];
      if (last && last.repositoryId !== entry.repositoryId) { this.entries = [markRaw(entry)]; return; }
      if (this.entries.some((e) => e.snapshotId === entry.snapshotId)) return;
      this.entries = [...this.entries, markRaw(entry)].slice(-JOURNAL_CAP);
    },
  },
});
```

```ts
// shell/use-journal-feed.ts — Part 3 Q8: records each snapshot the leaf shows. Called
// once, from App.vue (the shell), never from city-view.ts (no line budget).
import { watch } from 'vue';
import { fileSummariesFor } from '../read-models/file-summaries';
import { journalEntryFor } from '../read-models/snapshot-comparison';
import { useCityStore } from '../stores/city-store';
import { useSnapshotJournal } from '../stores/snapshot-journal';

export function useJournalFeed(): void {
  const store = useCityStore();
  const journal = useSnapshotJournal();
  watch(() => store.snapshot, (snapshot) => {
    if (snapshot) journal.record(journalEntryFor(snapshot, fileSummariesFor(snapshot)));
  }, { immediate: true });
}
```

  In `App.vue`, import `useJournalFeed` and call it once after `const store = useCityStore();`.

- [ ] **Step 5: Add a shell test.** Add one test to `tests/unit/snapshot-journal.test.ts`:
  - mount `App` with a snapshot set (use the `mountShell` pattern from `tests/component/shell-provenance.test.ts`);
  - `setCity` a second snapshot with a different `snapshotId`;
  - assert `useSnapshotJournal().entries` has length 2.

  If mounting `App` pulls too much into a unit test, put this test in `tests/component/workspace-shell.test.ts` instead, keeping it under 450 lines.
- [ ] **Step 6: Run and confirm they pass.** `npx vitest run tests/unit/snapshot-journal.test.ts tests/component/workspace-shell.test.ts`, then the gate.
- [ ] **Step 7: Commit.** `feat(ui): in-memory snapshot journal and collected snapshot comparison`

---

### Task 4: Code quality read model: fingerprints, dispositions, filters, CSV

**Files:**
- Create: `src/ui/read-models/findings.ts`, `src/ui/audit-copy/quality.ts`
- Modify: `src/ui/read-models/file-detail.ts`, `src/ui/read-models/use-read-models.ts`, `src/ui/inspector-copy.ts` (one `export *` line)
- Test: `tests/unit/findings-model.test.ts` (new)

**Interfaces:**
- Consumes: `FindingDisposition` (Task 2); `toCsv`, `metricColumns` (Task 1); `sampleFindings`, `FindingKind`, `FindingSeverity`; `filesByPriority`, `moduleLabel`.
- Produces:

```ts
export type FindingStatus = 'open' | 'acknowledged' | 'dismissed';
export function findingFingerprint(fileId: EntityId, findingId: string): string;   // `${fileId}#${findingId}`
// file-detail.ts: FileFinding gains `fingerprint: string`
export interface QualityFinding extends FileFinding { file: FileSummary; moduleLabel: string; status: FindingStatus; reason: string | null }
export interface QualityFilter { query: string; kind: FindingKind | null; severity: FindingSeverity | null; module: string | null; status: FindingStatus | 'all' }
export const DEFAULT_QUALITY_FILTER: Readonly<QualityFilter>;   // status 'open', everything else empty
export const FINDINGS_PAGE = 100;
export const SEVERITY_RANK: Readonly<Record<FindingSeverity, number>>;   // high 0, medium 1, low 2
export interface QualityCard { id: 'open' | FindingKind; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' }
export interface QualityModel {
  findings: readonly QualityFinding[]; byFingerprint: ReadonlyMap<string, QualityFinding>;
  modules: readonly { name: string; label: string }[]; cards: readonly QualityCard[]; usesSample: boolean;
}
export function buildQualityModel(files: readonly FileSummary[], dispositions: readonly FindingDisposition[]): QualityModel;
export function filterFindings(findings: readonly QualityFinding[], filter: QualityFilter): readonly QualityFinding[];
export function findingsCsv(rows: readonly QualityFinding[]): string;
// use-read-models.ts: useReadModels() also returns `quality: ComputedRef<QualityModel>`
```

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/findings-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildFileDetail } from '../../src/ui/read-models/file-detail';
import {
  buildQualityModel, DEFAULT_QUALITY_FILTER, filterFindings, findingsCsv,
} from '../../src/ui/read-models/findings';

const snap = buildSnapshotFixture({ files: 60, directories: 2 });
const files = fileSummariesFor(snap);
const NOW = '2026-09-21T10:00:00.000Z';

describe('code quality model (Part 3 Q1-Q3)', () => {
  it('lists every sample finding of every file, one per file finding count', () => {
    const m = buildQualityModel(files, []);
    const expected = files.reduce((n, f) => n + (f.findings.value ?? 0), 0);
    expect(m.findings).toHaveLength(expected);
    expect(m.findings.every((f) => f.status === 'open')).toBe(true);
  });

  it('fingerprints are unique even where display ids repeat across files', () => {
    const m = buildQualityModel(files, []);
    const ids = m.findings.map((f) => f.id);
    expect(new Set(ids).size).toBeLessThan(ids.length);   // display ids DO repeat within a module
    expect(new Set(m.findings.map((f) => f.fingerprint)).size).toBe(m.findings.length);
  });

  it('File detail and Code quality agree on a finding fingerprint', () => {
    const file = files.find((f) => (f.findings.value ?? 0) > 0)!;
    const detail = buildFileDetail(snap, files, file.id)!;
    const m = buildQualityModel(files, []);
    expect(m.byFingerprint.get(detail.findings[0]!.fingerprint)?.file.id).toBe(file.id);
  });

  it('applies dispositions by fingerprint and keeps the reason', () => {
    const [a, b] = buildQualityModel(files, []).findings;
    const m = buildQualityModel(files, [
      { fingerprint: a!.fingerprint, status: 'acknowledged', decidedAt: NOW },
      { fingerprint: b!.fingerprint, status: 'dismissed', reason: 'intended API', decidedAt: NOW },
      { fingerprint: 'gone#X', status: 'dismissed', reason: 'stale', decidedAt: NOW },
    ]);
    expect(m.byFingerprint.get(a!.fingerprint)?.status).toBe('acknowledged');
    expect(m.byFingerprint.get(b!.fingerprint)?.reason).toBe('intended API');
    const open = buildQualityModel(files, []).cards.find((c) => c.id === 'open')!.value.value!;
    expect(m.cards.find((c) => c.id === 'open')!.value.value).toBe(open - 2);
  });

  it('filters by status (default open), kind, severity, module and text', () => {
    const [a] = buildQualityModel(files, []).findings;
    const m = buildQualityModel(files, [{ fingerprint: a!.fingerprint, status: 'acknowledged', decidedAt: NOW }]);
    expect(filterFindings(m.findings, DEFAULT_QUALITY_FILTER)).not.toContain(m.byFingerprint.get(a!.fingerprint));
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'acknowledged' })).toHaveLength(1);
    const cx = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', kind: 'complexity' });
    expect(cx.every((f) => f.kind === 'complexity' && f.severity === 'high')).toBe(true);
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', severity: 'low' }).every((f) => f.kind === 'unused-exports')).toBe(true);
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', module: 'dir-1' }).every((f) => f.file.module === 'dir-1')).toBe(true);
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', query: 'no-such' })).toHaveLength(0);
  });

  it('with no files, every card is unknown, never 0', () => {
    const m = buildQualityModel([], []);
    expect(m.cards.every((c) => c.value.state === 'unknown')).toBe(true);
    expect(m.usesSample).toBe(false);
  });

  it('exports status and reason; an unknown line is an empty cell with its state', () => {
    const m = buildQualityModel(files, []);
    const f = m.findings[0]!;
    const [header, row] = findingsCsv([{ ...f, status: 'dismissed', reason: '=cmd' }]).replace('﻿', '').split('\r\n');
    expect(header).toBe('id,path,module,kind,severity,line,line_state,status,reason,provenance');
    expect(row).toContain(",dismissed,'=cmd,sample");
    expect(findingsCsv([{ ...f, line: null }]).split('\r\n')[1]).toContain(',,unknown,');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/unit/findings-model.test.ts`
- [ ] **Step 3: Copy.** Create `src/ui/audit-copy/quality.ts` and add `export * from './audit-copy/quality';` to `inspector-copy.ts`:

```ts
// Part 3 §2: Code quality screen and the Finding review dialog.
export const QUALITY_EYEBROW = 'Audit / Code quality';
export const QUALITY_TITLE = 'From findings to decisions.';
export const QUALITY_SUBTITLE = 'Triage static-analysis evidence without losing its source, scope, or uncertainty.';
export const QUALITY_EXPORT = 'Export findings';
export const QUALITY_CSV_FILENAME = 'codebase-quality-findings.csv';
export const QUALITY_CARD_OPEN = 'Open findings';
export const QUALITY_CARD_OPEN_CAPTION = (total: number, decided: number): string => `${total} findings in this snapshot · ${decided} decided`;
export const QUALITY_CARD_COMPLEXITY = 'Complexity findings';
export const QUALITY_CARD_COMPLEXITY_CAPTION = 'Functions with cognitive complexity of 30 or more';
export const QUALITY_CARD_UNUSED = 'Unused-export findings';
export const QUALITY_CARD_UNUSED_CAPTION = 'Verify entry points before removal';
export const QUALITY_CARD_DUPLICATION = 'Duplication findings';
export const QUALITY_CARD_DUPLICATION_CAPTION = 'Review semantics before extraction';
export const QUALITY_FILTER_QUERY = 'Find a file or finding…';
export const QUALITY_FILTER_KIND = 'Type';
export const QUALITY_FILTER_SEVERITY = 'Severity';
export const QUALITY_FILTER_MODULE = 'Module';
export const QUALITY_FILTER_STATUS = 'Status';
export const QUALITY_ALL_KINDS = 'All types';
export const QUALITY_ALL_SEVERITIES = 'All severities';
export const QUALITY_ALL_MODULES = 'All modules';
export const QUALITY_ALL_STATUSES = 'All statuses';
export const FINDING_KIND_LABEL: Readonly<Record<'complexity' | 'duplication' | 'unused-exports', string>> = {
  complexity: 'Complexity', duplication: 'Duplication', 'unused-exports': 'Unused exports',
};
export const FINDING_STATUS_LABEL: Readonly<Record<'open' | 'acknowledged' | 'dismissed', string>> = {
  open: 'Open', acknowledged: 'Acknowledged', dismissed: 'Dismissed',
};
export const QUALITY_RESET = 'Reset';
export const QUALITY_TABLE_TITLE = 'Findings';
export const QUALITY_TABLE_CAPTION = 'Static findings, one row per finding';
export const QUALITY_COL_SEVERITY = 'Severity';
export const QUALITY_COL_FINDING = 'Finding';
export const QUALITY_COL_LOCATION = 'Location';
export const QUALITY_COL_EVIDENCE = 'Evidence';
export const QUALITY_COL_STATUS = 'Status';
export const QUALITY_LOCATION = (line: number | null, module: string): string => `${line === null ? 'Line unknown' : `Line ${line}`} · ${module}`;
export const QUALITY_SHOWING = (shown: number, total: number): string => `Showing ${shown} of ${total} matching findings`;
export const QUALITY_NO_MATCH_TITLE = 'No findings match these filters';
export const QUALITY_NO_MATCH = 'Try another type, severity, module or status.';
export const QUALITY_FOOTNOTE = 'Findings are sample data. Decisions are kept in this session only and are never written to the repository.';
export const FINDING_DIALOG_TITLE = 'Review finding';
export const FINDING_DIALOG_PROVIDER = 'Provider';
export const FINDING_DIALOG_PROVIDER_VALUE = 'Sample findings';
export const FINDING_DIALOG_CONFIDENCE = 'Confidence';
export const FINDING_DIALOG_CONFIDENCE_VALUE = 'Illustrative. Manual confirmation required.';
export const FINDING_DIALOG_LOCATION = 'Location';
export const FINDING_DIALOG_REASON = 'Disposition note';
export const FINDING_OPEN_FILE = 'Open file detail';
export const FINDING_ADD_WORK_ITEM = 'Add work item';
export const FINDING_IN_PLAN = 'In refactor plan';
export const FINDING_ACKNOWLEDGE = 'Acknowledge';
export const FINDING_REOPEN = 'Reopen';
export const FINDING_DISMISS = 'Dismiss…';
export const FINDING_DISMISS_TITLE = 'Record a dismissal';
export const FINDING_DISMISS_HINT = 'Capture the reason. This only updates the review state for this session.';
export const FINDING_DISMISS_REASON = 'Reason';
export const FINDING_DISMISS_PLACEHOLDER = 'For example: intentionally exported through an external API; reference confirmed.';
export const FINDING_DISMISS_REQUIRED = 'Enter a reason before dismissing the finding.';
export const FINDING_DISMISS_TOO_LONG = (max: number): string => `Keep the reason to ${max} characters or fewer.`;
export const FINDING_DISMISS_SAVE = 'Record dismissal';
export const FINDING_DISMISS_CANCEL = 'Cancel';
export const FINDING_DECISION_FAILED = 'Could not save this decision.';
export const FINDING_ACKNOWLEDGED = 'Finding acknowledged. No repository suppression was written.';
export const FINDING_REOPENED = 'Finding reopened for review.';
export const FINDING_DISMISSED = 'Dismissal and reason saved for this session.';
export const FINDING_ROW_LABEL = (title: string, file: string, status: string): string => `${title}, ${file}, ${status}. Review finding`;
```

- [ ] **Step 4: Implement `src/ui/read-models/findings.ts`:**

```ts
// Part 3 Q1-Q3: every file's sample findings, merged with the review decisions held apart
// from them (keyed by fingerprint). A finding without a decision is open.
import type { EntityId } from '../../domain/entity-id';
import { sample, unknown, type MetricValue } from '../evidence';
import { toCsv, type CsvColumn } from '../export/csv';
import { sampleFindings, type FindingKind, type FindingSeverity } from '../fixtures/sample-findings';
import type { FindingDisposition } from '../stores/ports/review-repository';
import {
  FINDING_TITLE, NO_FILES_REASON, QUALITY_CARD_COMPLEXITY, QUALITY_CARD_COMPLEXITY_CAPTION, QUALITY_CARD_DUPLICATION,
  QUALITY_CARD_DUPLICATION_CAPTION, QUALITY_CARD_OPEN, QUALITY_CARD_OPEN_CAPTION, QUALITY_CARD_UNUSED,
  QUALITY_CARD_UNUSED_CAPTION,
} from '../inspector-copy';
import type { FileFinding } from './file-detail';
import { filesByPriority, moduleLabel, type FileSummary } from './file-summaries';

export type FindingStatus = 'open' | 'acknowledged' | 'dismissed';
export interface QualityFinding extends FileFinding { file: FileSummary; moduleLabel: string; status: FindingStatus; reason: string | null }
export interface QualityFilter { query: string; kind: FindingKind | null; severity: FindingSeverity | null; module: string | null; status: FindingStatus | 'all' }
export interface QualityCard { id: 'open' | FindingKind; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' }
export interface QualityModel {
  findings: readonly QualityFinding[];
  byFingerprint: ReadonlyMap<string, QualityFinding>;
  modules: readonly { name: string; label: string }[];
  cards: readonly QualityCard[];
  usesSample: boolean;
}

export const DEFAULT_QUALITY_FILTER: Readonly<QualityFilter> = { query: '', kind: null, severity: null, module: null, status: 'open' };
export const FINDINGS_PAGE = 100;
export const SEVERITY_RANK: Readonly<Record<FindingSeverity, number>> = { high: 0, medium: 1, low: 2 };

/** Q2: durable across snapshots (the EntityId is source-relative) and never the line. */
export function findingFingerprint(fileId: EntityId, findingId: string): string {
  return `${fileId}#${findingId}`;
}

type BaseFinding = Omit<QualityFinding, 'status' | 'reason'>;
const baseCache = new WeakMap<readonly FileSummary[], readonly BaseFinding[]>();
/** Generated once per files array, in priority order; decisions are merged per call. */
function baseFindings(files: readonly FileSummary[]): readonly BaseFinding[] {
  let hit = baseCache.get(files);
  if (!hit) {
    hit = filesByPriority(files).flatMap((file) => sampleFindings(file).map((f) => ({
      ...f, title: FINDING_TITLE[f.kind], fingerprint: findingFingerprint(file.id, f.id), file, moduleLabel: moduleLabel(file.module),
    })));
    baseCache.set(files, hit);
  }
  return hit;
}

export function buildQualityModel(files: readonly FileSummary[], dispositions: readonly FindingDisposition[]): QualityModel {
  const decided = new Map(dispositions.map((d) => [d.fingerprint, d]));
  const findings: QualityFinding[] = baseFindings(files).map((f) => {
    const d = decided.get(f.fingerprint);
    return { ...f, status: d?.status ?? 'open', reason: d?.reason ?? null };
  });
  const open = findings.filter((f) => f.status === 'open');
  const count = (kind: FindingKind | null): MetricValue =>
    (files.length === 0 ? unknown(NO_FILES_REASON) : sample(open.filter((f) => kind === null || f.kind === kind).length));
  const names = [...new Set(files.map((f) => f.module))].sort((a, b) => a.localeCompare(b));
  return {
    findings,
    byFingerprint: new Map(findings.map((f) => [f.fingerprint, f])),
    modules: names.map((name) => ({ name, label: moduleLabel(name) })),
    cards: [
      { id: 'open', label: QUALITY_CARD_OPEN, icon: 'code', value: count(null), caption: QUALITY_CARD_OPEN_CAPTION(findings.length, findings.length - open.length), tone: 'accent' },
      { id: 'complexity', label: QUALITY_CARD_COMPLEXITY, icon: 'flame', value: count('complexity'), caption: QUALITY_CARD_COMPLEXITY_CAPTION, tone: 'warning' },
      { id: 'unused-exports', label: QUALITY_CARD_UNUSED, icon: 'file-x', value: count('unused-exports'), caption: QUALITY_CARD_UNUSED_CAPTION, tone: 'accent' },
      { id: 'duplication', label: QUALITY_CARD_DUPLICATION, icon: 'copy', value: count('duplication'), caption: QUALITY_CARD_DUPLICATION_CAPTION, tone: 'accent' },
    ],
    usesSample: files.length > 0,
  };
}

export function filterFindings(findings: readonly QualityFinding[], filter: QualityFilter): readonly QualityFinding[] {
  const q = filter.query.trim().toLowerCase();
  return findings.filter((f) => (filter.status === 'all' || f.status === filter.status)
    && (filter.kind === null || f.kind === filter.kind)
    && (filter.severity === null || f.severity === filter.severity)
    && (filter.module === null || f.file.module === filter.module)
    && (!q || f.file.path.toLowerCase().includes(q) || f.title.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)));
}

const CSV_COLUMNS: readonly CsvColumn<QualityFinding>[] = [
  { header: 'id', value: (f) => f.id },
  { header: 'path', value: (f) => f.file.path },
  { header: 'module', value: (f) => f.moduleLabel },
  { header: 'kind', value: (f) => f.kind },
  { header: 'severity', value: (f) => f.severity },
  { header: 'line', value: (f) => f.line ?? undefined },
  { header: 'line_state', value: (f) => (f.line === null ? 'unknown' : 'sample') },
  { header: 'status', value: (f) => f.status },
  { header: 'reason', value: (f) => f.reason ?? undefined },
  { header: 'provenance', value: () => 'sample' },
];

/** Q15: the filtered set, with each decision next to the generated finding. */
export function findingsCsv(rows: readonly QualityFinding[]): string {
  return toCsv(CSV_COLUMNS, rows);
}
```

  Check that every icon name renders through `Icon.vue`'s Lucide set (`code`, `flame`, `file-x`, `copy`). Swap any that does not, and report it.
- [ ] **Step 5: `file-detail.ts`.**
  - Change `FileFinding` to `export interface FileFinding extends SampleFinding { title: string; fingerprint: string }`.
  - Build it with `fingerprint: findingFingerprint(file.id, f.id)`, imported from `./findings`. `findings.ts` imports only the type back, so there is no runtime cycle.
- [ ] **Step 6: `use-read-models.ts`.** Add the memo and expose `quality`:

```ts
const qualityCache = new WeakMap<readonly FileSummary[], { dispositions: readonly FindingDisposition[]; model: QualityModel }>();
/** `review.dispositions` is reassigned on every decision, so its identity is the key. */
export function qualityModelFor(files: readonly FileSummary[], dispositions: readonly FindingDisposition[]): QualityModel {
  const hit = qualityCache.get(files);
  if (hit && hit.dispositions === dispositions) return hit.model;
  const model = buildQualityModel(files, dispositions);
  qualityCache.set(files, { dispositions, model });
  return model;
}
```

  Inside `useReadModels`, add `const quality = computed(() => qualityModelFor(files.value, review.dispositions));` and return `quality`. Pinia returns a reactive proxy for `review.dispositions`. That proxy is stable until the array is reassigned, which is exactly what the store does, so identity is a valid key. Add a line to the memo test in `read-models.test.ts` asserting that two callers share one `quality.value`.
- [ ] **Step 7: Run and confirm they pass.** `npx vitest run tests/unit/findings-model.test.ts tests/unit/file-detail-model.test.ts tests/unit/read-models.test.ts`, then the gate.
- [ ] **Step 8: Commit.** `feat(ui): code-quality read model with durable finding fingerprints and dispositions`

---

### Task 5: Test confidence read model

**Files:**
- Create: `src/ui/fixtures/sample-test-runs.ts`, `src/ui/read-models/test-confidence.ts`, `src/ui/audit-copy/tests.ts`
- Modify: `tests/fixtures/snapshot-builder.ts` (optional `testFiles`), `src/ui/read-models/use-read-models.ts`, `src/ui/inspector-copy.ts`
- Test: `tests/unit/test-confidence-model.test.ts` (new)

**Interfaces:**
- Produces:

```ts
// fixtures/sample-test-runs.ts
export interface SampleTestRun { tests: number; failing: number; durationMs: number }
export function sampleTestRun(entityId: EntityId): SampleTestRun;
// read-models/test-confidence.ts
export const GAP_THRESHOLD = 60;
export const MAX_TILES = 400;
export interface ModuleCoverage { module: string; label: string; files: number; covered: MetricValue; total: MetricValue; coverage: MetricValue }
export interface CoverageTile { file: FileSummary; band: CoverageBand }
export interface TestRunRow { file: FileSummary; tests: MetricValue; failing: MetricValue; durationMs: MetricValue }
export interface TestsCard { id: 'coverage' | 'below' | 'results' | 'mutation'; label: string; icon: string; value: MetricValue; unit: string; caption: string; tone: 'success' | 'warning' | 'accent' }
export interface TestConfidenceModel {
  modules: readonly ModuleCoverage[]; hiddenModules: number; moduleOptions: readonly { name: string; label: string }[];
  gaps: readonly FileSummary[]; runs: readonly TestRunRow[]; cards: readonly TestsCard[]; usesSample: boolean;
}
export function buildTestConfidenceModel(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): TestConfidenceModel;
export function coverageTiles(files: readonly FileSummary[], module: string | null): { tiles: readonly CoverageTile[]; total: number };
export function gapsCsv(rows: readonly FileSummary[]): string;
// FixtureSpec gains `testFiles?: number`: the first N files are named `file-<i>.test.ts` (category `test`).
// useReadModels() also returns `testConfidence: ComputedRef<TestConfidenceModel | null>` (null without a snapshot).
```

- [ ] **Step 1: The fixture option.** In `tests/fixtures/snapshot-builder.ts`, add `testFiles?: number; // the first N files are test files (file-<i>.test.ts)` to `FixtureSpec`. In `buildSnapshotFixture`, build the file name as `` `file-${i}${i < (spec.testFiles ?? 0) ? '.test' : ''}.ts` `` in both path branches. Nothing changes when the option is absent.
- [ ] **Step 2: Write the failing tests.** Create `tests/unit/test-confidence-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildTestConfidenceModel, coverageTiles, gapsCsv, GAP_THRESHOLD, MAX_TILES } from '../../src/ui/read-models/test-confidence';
import { sampleTestRun } from '../../src/ui/fixtures/sample-test-runs';

describe('test confidence model (Part 3 Q12, Q13)', () => {
  it('weights module coverage by instrumented branches, not by file', () => {
    const snap = buildSnapshotFixture({ files: 30, directories: 3 });
    const files = fileSummariesFor(snap);
    const mod = buildTestConfidenceModel(snap, files).modules.find((x) => x.module === 'dir-0')!;
    const inMod = files.filter((f) => f.module === 'dir-0');
    const covered = inMod.reduce((n, f) => n + f.branchesCovered.value!, 0);
    const total = inMod.reduce((n, f) => n + f.branchesTotal.value!, 0);
    expect(mod.coverage.value).toBe(Math.round((covered / total) * 100));
    expect(mod.coverage.state).toBe('sample');
  });

  it('mutation is always unknown, never 0 and never passing', () => {
    const snap = buildSnapshotFixture({ files: 5 });
    const card = buildTestConfidenceModel(snap, fileSummariesFor(snap)).cards.find((c) => c.id === 'mutation')!;
    expect(card.value.state).toBe('unknown');
    expect(card.value.value).toBeUndefined();
  });

  it('gaps are known coverage below 60 %, most-changed first', () => {
    const snap = buildSnapshotFixture({ files: 80, directories: 2 });
    const m = buildTestConfidenceModel(snap, fileSummariesFor(snap));
    expect(m.gaps.length).toBeGreaterThan(0);
    expect(m.gaps.every((f) => f.branchCoverage.value! < GAP_THRESHOLD)).toBe(true);
    const commits = m.gaps.map((f) => f.commits90d.value!);
    expect(commits).toEqual([...commits].sort((a, b) => b - a));
  });

  it('test runs come only from real test files; none means unknown, not 0 of 0', () => {
    const none = buildSnapshotFixture({ files: 6 });
    const noRuns = buildTestConfidenceModel(none, fileSummariesFor(none));
    expect(noRuns.runs).toHaveLength(0);
    expect(noRuns.cards.find((c) => c.id === 'results')!.value.state).toBe('unknown');
    const some = buildSnapshotFixture({ files: 10, testFiles: 4 });
    const m = buildTestConfidenceModel(some, fileSummariesFor(some));
    expect(m.runs).toHaveLength(4);
    expect(m.runs.every((r) => r.file.name.endsWith('.test.ts'))).toBe(true);
    const total = m.runs.reduce((n, r) => n + r.tests.value!, 0);
    const failing = m.runs.reduce((n, r) => n + r.failing.value!, 0);
    expect(m.cards.find((c) => c.id === 'results')!.value.value).toBe(total - failing);
  });

  it('sample test runs are deterministic per entity', () => {
    expect(sampleTestRun('x')).toEqual(sampleTestRun('x'));
  });

  it('caps tiles at 400 in priority order, filtered by module', () => {
    const snap = buildSnapshotFixture({ files: 450, directories: 3 });
    const files = fileSummariesFor(snap);
    expect(coverageTiles(files, null).tiles).toHaveLength(MAX_TILES);
    expect(coverageTiles(files, null).total).toBe(450);
    expect(coverageTiles(files, 'dir-1').tiles.every((t) => t.file.module === 'dir-1')).toBe(true);
  });

  it('exports gaps with a state column per metric', () => {
    const snap = buildSnapshotFixture({ files: 40 });
    const m = buildTestConfidenceModel(snap, fileSummariesFor(snap));
    expect(gapsCsv(m.gaps).split('\r\n')[0]).toBe('﻿path,module,branch_coverage_pct,branch_coverage_pct_state,branches_covered,branches_covered_state,branches_total,branches_total_state,commits_90d,commits_90d_state');
  });
});
```

- [ ] **Step 3: Run it and confirm it fails.** `npx vitest run tests/unit/test-confidence-model.test.ts`
- [ ] **Step 4: Copy.** Create `src/ui/audit-copy/tests.ts` and re-export it:

```ts
// Part 3 §2: Test confidence screen.
export const TESTS_EYEBROW = 'Audit / Test confidence';
export const TESTS_TITLE = 'Measure confidence, not just coverage.';
export const TESTS_SUBTITLE = 'Connect tested branches to risky changes. Keep missing signals visible.';
export const TESTS_EVIDENCE = 'Coverage evidence';
export const TESTS_EXPORT = 'Export coverage gaps';
export const TESTS_CSV_FILENAME = 'branch-coverage-gaps.csv';
export const TESTS_CARD_COVERAGE = 'Branch coverage';
export const TESTS_CARD_COVERAGE_CAPTION = (covered: string, total: string): string => `${covered} / ${total} instrumented branches`;
export const TESTS_CARD_BELOW = 'Files below 60%';
export const TESTS_CARD_BELOW_CAPTION = 'Review priority depends on behaviour and change';
export const TESTS_CARD_RESULTS = 'Test results';
export const TESTS_CARD_RESULTS_CAPTION = (failing: string): string => `${failing} failing tests · sample test runs`;
export const TESTS_NO_TEST_FILES = 'No test files in this inventory.';
export const TESTS_CARD_MUTATION = 'Mutation score';
export const MUTATION_NOT_COLLECTED = 'Not collected · unknown, not zero';
export const TESTS_TABS_LABEL = 'Test confidence views';
export const TESTS_TAB_MAP = 'Coverage map';
export const TESTS_TAB_RESULTS = 'Test results';
export const TESTS_TAB_MUTATION = 'Mutation testing';
export const TESTS_MAP_TITLE = 'Coverage across the codebase';
export const TESTS_MAP_SUBTITLE = 'One tile per file. Select a tile to inspect its evidence.';
export const TESTS_MAP_FOOTNOTE = 'Coverage is execution evidence, not proof of assertions or correctness. Sample signals.';
export const TESTS_MAP_LABEL = 'Sample branch coverage, one tile per file';
export const TESTS_TILE_LABEL = (name: string, coverage: string): string => `${name}: ${coverage} branch coverage`;
export const TESTS_SHOWING = (n: number, total: number): string => `Showing the ${n} highest-priority of ${total} files.`;
export const TESTS_MODULES_TITLE = 'Branch coverage by module';
export const TESTS_MODULES_SUBTITLE = 'Weighted by instrumented branch count.';
export const TESTS_MODULES_HIDDEN = (n: number): string => `${n} smaller modules are not shown.`;
export const TESTS_MODULE_BAR_LABEL = (module: string, pct: string): string => `${module}: ${pct} branch coverage (sample)`;
export const TESTS_GAPS_TITLE = 'Coverage gaps worth investigating';
export const TESTS_GAPS_SUBTITLE = 'Files below 60% branch coverage, most-changed first.';
export const TESTS_GAPS_CAPTION = 'Coverage gaps';
export const TESTS_GAPS_NONE = 'No file with known coverage is below 60%.';
export const TESTS_COL_FILE = 'File';
export const TESTS_COL_BRANCHES = 'Covered / total';
export const TESTS_COL_COVERAGE = 'Coverage';
export const TESTS_COL_COMMITS = 'Commits / 90d';
export const TESTS_COL_ACTIONS = 'Actions';
export const TESTS_PLAN = 'Plan tests';
export const TESTS_PLANNED = 'Tests planned';
export const TESTS_PLAN_LABEL = (name: string): string => `Plan characterization tests for ${name}`;
export const TESTS_PLAN_TITLE = (name: string): string => `Characterize ${name} with tests`;
export const TESTS_PLAN_FAILED = 'Could not add this work item.';
export const TESTS_RUNS_TITLE = 'Sample test runs';
export const TESTS_RUNS_SUBTITLE = (tests: string, passing: string, failing: string): string => `${tests} tests · ${passing} passing · ${failing} failing, per test file.`;
export const TESTS_RUNS_CAPTION = 'Sample test runs per test file';
export const TESTS_RUNS_NONE = 'No test files in this inventory, so there are no test runs to show.';
export const TESTS_COL_TESTS = 'Tests';
export const TESTS_COL_RESULT = 'Result';
export const TESTS_COL_DURATION = 'Duration';
export const TESTS_RESULT_PASSING = 'Passing';
export const TESTS_RESULT_FAILING = (n: number): string => `${n} failing`;
export const TESTS_DURATION = (ms: number): string => `${(ms / 1000).toFixed(2)} s`;
export const TESTS_OPEN_FILE = 'Open file detail';
export const TESTS_SELECTED = (name: string): string => `Selected: ${name}`;
export const MUTATION_TITLE = 'Mutation testing';
export const MUTATION_SUBTITLE = 'No mutation-test provider is connected.';
export const MUTATION_EMPTY_TITLE = 'The strength of your assertions is unknown.';
export const MUTATION_EMPTY = 'There are no mutation-test results. Coverage alone cannot tell you whether tests detect meaningful changes.';
export const CONFIGURE_EVIDENCE = 'Configure evidence';
export const COVERAGE_BAND_LABEL: Readonly<Record<'low' | 'mid' | 'high' | 'unknown', string>> = {
  low: '< 60%', mid: '60–79%', high: '≥ 80%', unknown: 'Unknown',
};
```

- [ ] **Step 5: Implement the fixture and the model.**

```ts
// fixtures/sample-test-runs.ts — Part 3 Q12: SAMPLE results for one real test file,
// seeded by its entity id. Never invents test files: callers pass real ones only.
import type { EntityId } from '../../domain/entity-id';
import { fnv1a, mulberry32 } from './seeded-random';

export interface SampleTestRun { tests: number; failing: number; durationMs: number }

export function sampleTestRun(entityId: EntityId): SampleTestRun {
  const r = mulberry32(fnv1a(`tests:${entityId}`));
  const tests = 1 + Math.floor(r() * 40);
  const failing = r() > 0.9 ? Math.min(tests, 1 + Math.floor(r() * 2)) : 0;
  const durationMs = 5 + Math.floor(r() ** 2 * 2000);
  return { tests, failing, durationMs };
}
```

```ts
// read-models/test-confidence.ts — Part 3 Q12/Q13. Coverage is sample and weighted by
// branches; assertion strength (mutation) is never inferred from it and stays unknown.
import type { CodebaseSnapshot } from '../../domain/model';
import {
  countEvidence, formatMetric, hasValue, ratioEvidence, sample, sumEvidence, unknown, type MetricValue,
} from '../evidence';
import { metricColumns, toCsv, type CsvColumn } from '../export/csv';
import { sampleTestRun } from '../fixtures/sample-test-runs';
import {
  MUTATION_NOT_COLLECTED, NO_FILES_REASON, TESTS_CARD_BELOW, TESTS_CARD_BELOW_CAPTION, TESTS_CARD_COVERAGE,
  TESTS_CARD_COVERAGE_CAPTION, TESTS_CARD_MUTATION, TESTS_CARD_RESULTS, TESTS_CARD_RESULTS_CAPTION, TESTS_NO_TEST_FILES,
} from '../inspector-copy';
import { MAX_GRAPH_MODULES } from './architecture';
import { filesByPriority, moduleLabel, type FileSummary } from './file-summaries';
import { coverageBand, type CoverageBand } from './hotspots';

export const GAP_THRESHOLD = 60;
export const MAX_TILES = 400;

export interface ModuleCoverage { module: string; label: string; files: number; covered: MetricValue; total: MetricValue; coverage: MetricValue }
export interface CoverageTile { file: FileSummary; band: CoverageBand }
export interface TestRunRow { file: FileSummary; tests: MetricValue; failing: MetricValue; durationMs: MetricValue }
export interface TestsCard {
  id: 'coverage' | 'below' | 'results' | 'mutation'; label: string; icon: string;
  value: MetricValue; unit: string; caption: string; tone: 'success' | 'warning' | 'accent';
}
export interface TestConfidenceModel {
  modules: readonly ModuleCoverage[];
  hiddenModules: number;
  moduleOptions: readonly { name: string; label: string }[];
  gaps: readonly FileSummary[];
  runs: readonly TestRunRow[];
  cards: readonly TestsCard[];
  usesSample: boolean;
}

const commitsRank = (f: FileSummary): number => f.commits90d.value ?? -Infinity;
const byCommits = (a: FileSummary, b: FileSummary): number => commitsRank(b) - commitsRank(a) || a.path.localeCompare(b.path);

function moduleCoverage(files: readonly FileSummary[]): ModuleCoverage[] {
  const groups = new Map<string, FileSummary[]>();
  for (const f of files) {
    const g = groups.get(f.module);
    if (g) g.push(f); else groups.set(f.module, [f]);
  }
  return [...groups.entries()].map(([module, fs]) => {
    const covered = sumEvidence(fs.map((f) => f.branchesCovered));
    const total = sumEvidence(fs.map((f) => f.branchesTotal));
    return { module, label: moduleLabel(module), files: fs.length, covered, total, coverage: ratioEvidence(covered, total) };
  }).sort((a, b) => b.files - a.files || a.label.localeCompare(b.label));
}

function testRuns(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): TestRunRow[] {
  const testIds = new Set(snapshot.entities.filter((e) => e.kind === 'file' && e.category === 'test').map((e) => e.id));
  return files.filter((f) => testIds.has(f.id)).map((file) => {
    const run = sampleTestRun(file.id);
    return { file, tests: sample(run.tests), failing: sample(run.failing), durationMs: sample(run.durationMs) };
  }).sort((a, b) => (b.failing.value ?? 0) - (a.failing.value ?? 0) || a.file.path.localeCompare(b.file.path));
}

function resultsCard(runs: readonly TestRunRow[]): TestsCard {
  const base = { id: 'results' as const, label: TESTS_CARD_RESULTS, icon: 'flask-conical', tone: 'accent' as const };
  if (runs.length === 0) return { ...base, value: unknown(TESTS_NO_TEST_FILES, 'inventory'), unit: '', caption: '' };
  const tests = sumEvidence(runs.map((r) => r.tests));
  const failing = sumEvidence(runs.map((r) => r.failing));
  const passing: MetricValue = hasValue(tests) && hasValue(failing) ? { ...tests, value: tests.value - failing.value } : tests;
  return { ...base, value: passing, unit: ` / ${formatMetric(tests)}`, caption: TESTS_CARD_RESULTS_CAPTION(formatMetric(failing)) };
}

export function buildTestConfidenceModel(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): TestConfidenceModel {
  const all = moduleCoverage(files);
  const covered = sumEvidence(files.map((f) => f.branchesCovered), NO_FILES_REASON);
  const total = sumEvidence(files.map((f) => f.branchesTotal), NO_FILES_REASON);
  return {
    modules: all.slice(0, MAX_GRAPH_MODULES),
    hiddenModules: Math.max(0, all.length - MAX_GRAPH_MODULES),
    moduleOptions: [...all].sort((a, b) => a.label.localeCompare(b.label)).map((m) => ({ name: m.module, label: m.label })),
    gaps: files.filter((f) => hasValue(f.branchCoverage) && f.branchCoverage.value < GAP_THRESHOLD).sort(byCommits),
    runs: testRuns(snapshot, files),
    cards: [
      { id: 'coverage', label: TESTS_CARD_COVERAGE, icon: 'flask-conical', value: ratioEvidence(covered, total), unit: '%',
        caption: TESTS_CARD_COVERAGE_CAPTION(formatMetric(covered), formatMetric(total)), tone: 'success' },
      { id: 'below', label: TESTS_CARD_BELOW, icon: 'triangle-alert',
        value: countEvidence(files.map((f) => f.branchCoverage), (v) => v < GAP_THRESHOLD, NO_FILES_REASON),
        unit: '', caption: TESTS_CARD_BELOW_CAPTION, tone: 'warning' },
      resultsCard(testRuns(snapshot, files)),
      { id: 'mutation', label: TESTS_CARD_MUTATION, icon: 'info', value: unknown(MUTATION_NOT_COLLECTED), unit: '', caption: '', tone: 'accent' },
    ],
    usesSample: files.length > 0,
  };
}

/** Q13: at most MAX_TILES tiles, highest priority first; `total` is the filtered count. */
export function coverageTiles(files: readonly FileSummary[], module: string | null): { tiles: readonly CoverageTile[]; total: number } {
  const scoped = filesByPriority(files).filter((f) => module === null || f.module === module);
  return { tiles: scoped.slice(0, MAX_TILES).map((file) => ({ file, band: coverageBand(file.branchCoverage) })), total: scoped.length };
}

const GAP_COLUMNS: readonly CsvColumn<FileSummary>[] = [
  { header: 'path', value: (f) => f.path },
  { header: 'module', value: (f) => moduleLabel(f.module) },
  ...metricColumns<FileSummary>('branch_coverage_pct', (f) => f.branchCoverage),
  ...metricColumns<FileSummary>('branches_covered', (f) => f.branchesCovered),
  ...metricColumns<FileSummary>('branches_total', (f) => f.branchesTotal),
  ...metricColumns<FileSummary>('commits_90d', (f) => f.commits90d),
];

export function gapsCsv(rows: readonly FileSummary[]): string {
  return toCsv(GAP_COLUMNS, rows);
}
```

  - Compute `testRuns(snapshot, files)` once into a local variable, used by both `runs` and `resultsCard`. The block above shows two calls only for readability.
  - If `triangle-alert` does not exist in the bundled Lucide, use `alert-triangle` and report it.
- [ ] **Step 6: `use-read-models.ts`.** Add a `testsCache` (a WeakMap on the files array, storing `{ snapshot, model }`) and `testConfidenceModelFor(snapshot, files)`, following the `overviewModelFor` pattern. Expose `testConfidence = computed(() => (store.snapshot ? testConfidenceModelFor(store.snapshot, files.value) : null))`.
- [ ] **Step 7: Run and confirm they pass.** `npx vitest run tests/unit/test-confidence-model.test.ts tests/unit/read-models.test.ts tests/unit/hotspots-model.test.ts`, then the gate. The Hotspots test confirms the fixture change is inert.
- [ ] **Step 8: Commit.** `feat(ui): test-confidence read model: weighted module coverage, gaps, runs on real test files, unknown mutation`

---

### Task 6: Dependencies and Security read models over fictional packages

**Files:**
- Create: `src/ui/fixtures/sample-packages.ts`, `src/ui/read-models/root-label.ts`, `src/ui/read-models/dependencies.ts`, `src/ui/read-models/security.ts`, `src/ui/audit-copy/dependencies.ts`, `src/ui/audit-copy/security.ts`
- Modify: `src/ui/App.vue` (use `rootFolderLabel`), `src/ui/read-models/use-read-models.ts`, `src/ui/inspector-copy.ts`
- Test: `tests/unit/dependencies-model.test.ts` (new)

**Interfaces:**
- Produces:

```ts
// fixtures/sample-packages.ts — fixture DATA (names, versions, licences, advisory text) lives here, not in copy.
export type PackageRelationship = 'direct' | 'transitive' | 'development';
export type PackageStatus = 'review' | 'current' | 'update' | 'unused';
export interface SampleAdvisory { id: string; summary: string; patched: string }
export interface SamplePackage {
  name: string; version: string; license: string | null; relationship: PackageRelationship; status: PackageStatus;
  references: number; target: string | null; advisory: SampleAdvisory | null; via: string | null;
}
export const SAMPLE_PACKAGES: readonly SamplePackage[];
// read-models/root-label.ts
export function rootFolderLabel(rootPath: string): string;
// read-models/dependencies.ts
export type PackageFilter = 'all' | PackageRelationship | 'review' | 'unused';
export interface PackageRow { pkg: SamplePackage; references: MetricValue }
export interface LicenseRow { key: string; label: string; packages: number; needsReview: boolean }
export interface ManifestRow { id: EntityId; path: string }
export interface DependenciesCard { id: 'packages' | 'advisories' | 'unused' | 'license'; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' }
export interface DependenciesModel {
  packages: readonly PackageRow[]; licenses: readonly LicenseRow[]; path: readonly SamplePackage[];
  manifests: readonly ManifestRow[]; rootLabel: string; cards: readonly DependenciesCard[]; usesSample: true;
}
export function buildDependenciesModel(snapshot: CodebaseSnapshot): DependenciesModel;
export function filterPackages(rows: readonly PackageRow[], query: string, filter: PackageFilter): readonly PackageRow[];
export function packagesCsv(rows: readonly PackageRow[]): string;
// read-models/security.ts
export interface SecurityCard { id: 'advisories' | 'secrets' | 'licenses' | 'runtime'; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' }
export interface SecurityModel { advisories: readonly SamplePackage[]; cards: readonly SecurityCard[]; usesSample: true }
export function buildSecurityModel(): SecurityModel;
export function advisoriesCsv(rows: readonly SamplePackage[]): string;
// useReadModels() also returns `dependencies: ComputedRef<DependenciesModel | null>` and `security: ComputedRef<SecurityModel>`.
```

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/dependencies-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { makeEntityId } from '../../src/domain/entity-id';
import { SAMPLE_PACKAGES } from '../../src/ui/fixtures/sample-packages';
import { buildDependenciesModel, filterPackages, packagesCsv } from '../../src/ui/read-models/dependencies';
import { advisoriesCsv, buildSecurityModel } from '../../src/ui/read-models/security';
import { rootFolderLabel } from '../../src/ui/read-models/root-label';
import type { CodebaseSnapshot } from '../../src/domain/model';

function withManifests(snap: CodebaseSnapshot, paths: readonly string[]): CodebaseSnapshot {
  const extra = paths.map((path) => ({
    id: makeEntityId(snap.repositoryId, 'file', path), repositoryId: snap.repositoryId, kind: 'file' as const, path,
    name: path.slice(path.lastIndexOf('/') + 1), parentId: null, category: 'config' as const,
  }));
  return { ...snap, entities: [...snap.entities, ...extra] };
}

describe('dependencies model (Part 3 Q5, Q6)', () => {
  const snap = buildSnapshotFixture({ files: 4 });

  it('is the fictional fixture: 7 direct, 2 transitive, 1 development; every package is @sample', () => {
    const m = buildDependenciesModel(snap);
    expect(m.packages).toHaveLength(10);
    expect(SAMPLE_PACKAGES.every((p) => p.name.startsWith('@sample/'))).toBe(true);
    const by = (r: string) => SAMPLE_PACKAGES.filter((p) => p.relationship === r).length;
    expect([by('direct'), by('transitive'), by('development')]).toEqual([7, 2, 1]);
    expect(m.cards.every((c) => c.value.state === 'sample')).toBe(true);
  });

  it('lists manifests by NAME only, sorted, and never anything else', () => {
    const m = buildDependenciesModel(withManifests(snap, ['pkg/b/package.json', 'package.json', 'package.json.bak']));
    expect(m.manifests.map((x) => x.path)).toEqual(['package.json', 'pkg/b/package.json']);
  });

  it('filters by relationship, by status, and by name', () => {
    const rows = buildDependenciesModel(snap).packages;
    expect(filterPackages(rows, '', 'transitive').every((r) => r.pkg.relationship === 'transitive')).toBe(true);
    expect(filterPackages(rows, '', 'review').every((r) => r.pkg.status === 'review')).toBe(true);
    expect(filterPackages(rows, 'UI-KIT', 'all').map((r) => r.pkg.name)).toEqual(['@sample/ui-kit']);
    expect(filterPackages(rows, 'nothing', 'all')).toHaveLength(0);
  });

  it('licences: an unresolved licence is its own row that needs review', () => {
    const lic = buildDependenciesModel(snap).licenses;
    expect(lic.find((l) => l.key === 'MIT')?.packages).toBe(7);
    expect(lic.find((l) => l.needsReview)?.packages).toBe(1);
  });

  it('the dependency path runs through a direct to a transitive package; root label is the folder name', () => {
    const m = buildDependenciesModel(snap);
    expect(m.path.map((p) => p.relationship)).toEqual(['direct', 'transitive']);
    expect(m.path[1]?.via).toBe(m.path[0]?.name);
    expect(rootFolderLabel('C:\\work\\my-repo\\')).toBe('my-repo');
  });

  it('exports packages with a state per metric; an unresolved licence is an empty cell', () => {
    const csv = packagesCsv(buildDependenciesModel(snap).packages);
    expect(csv.split('\r\n')[0]).toBe('\uFEFFname,version,relationship,license,status,advisory,references,references_state,provenance');
    expect(csv).toContain('@sample/legacy-icons,0.9.0,direct,,unused,,0,sample,sample');
  });
});

describe('security model (Part 3 Q7)', () => {
  const m = buildSecurityModel();
  it('shows the two fixture advisories; runtime exploitability is unknown', () => {
    expect(m.advisories.map((p) => p.advisory?.id)).toEqual(['DEMO-ADV-001', 'DEMO-ADV-002']);
    expect(m.cards.find((c) => c.id === 'runtime')?.value.state).toBe('unknown');
  });
  it('secret candidates are not collected: unknown, never 0', () => {
    const secrets = m.cards.find((c) => c.id === 'secrets')!;
    expect(secrets.value.state).toBe('unknown');
    expect(secrets.value.value).toBeUndefined();
  });
  it('exports advisories with reachability unknown', () => {
    const [header, first] = advisoriesCsv(m.advisories).split('\r\n');
    expect(header).toBe('\uFEFFadvisory,package,installed,illustrative_patched,summary,reachability,provenance');
    expect(first).toContain(',unknown,sample');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/unit/dependencies-model.test.ts`
- [ ] **Step 3: The fixture.** Create `src/ui/fixtures/sample-packages.ts` with the prototype's inventory, fictional by construction:

```ts
// Part 3 Q5: a FICTIONAL package inventory. No registry, lockfile or manifest is read.
// Names, versions, licences and advisory text are fixture data, labelled on screen.
export type PackageRelationship = 'direct' | 'transitive' | 'development';
export type PackageStatus = 'review' | 'current' | 'update' | 'unused';
export interface SampleAdvisory { id: string; summary: string; patched: string }
export interface SamplePackage {
  name: string; version: string; license: string | null; relationship: PackageRelationship; status: PackageStatus;
  references: number; target: string | null; advisory: SampleAdvisory | null; via: string | null;
}

const pkg = (p: Partial<SamplePackage> & Pick<SamplePackage, 'name' | 'version' | 'relationship'>): SamplePackage => ({
  license: 'MIT', status: 'current', references: 0, target: null, advisory: null, via: null, ...p,
});

export const SAMPLE_PACKAGES: readonly SamplePackage[] = [
  pkg({ name: '@sample/document-parser', version: '2.4.0', relationship: 'direct', status: 'review', references: 12, target: '2.4.2',
    advisory: { id: 'DEMO-ADV-001', summary: 'Sample advisory: unsafe parsing of untrusted documents.', patched: '2.4.2' } }),
  pkg({ name: '@sample/archive-reader', version: '1.8.1', relationship: 'transitive', license: 'Apache-2.0', status: 'review', references: 3,
    target: '1.8.3', via: '@sample/document-parser',
    advisory: { id: 'DEMO-ADV-002', summary: 'Sample advisory: archive path validation requires review.', patched: '1.8.3' } }),
  pkg({ name: '@sample/ui-kit', version: '4.2.0', relationship: 'direct', references: 31 }),
  pkg({ name: '@sample/geometry', version: '3.1.2', relationship: 'direct', references: 22 }),
  pkg({ name: '@sample/serializer', version: '2.7.0', relationship: 'direct', references: 19 }),
  pkg({ name: '@sample/date-utils', version: '1.3.4', relationship: 'direct', status: 'update', references: 7, target: '1.4.0' }),
  pkg({ name: '@sample/legacy-icons', version: '0.9.0', relationship: 'direct', license: null, status: 'unused', references: 0 }),
  pkg({ name: '@sample/schema', version: '3.0.2', relationship: 'transitive', references: 16, via: '@sample/serializer' }),
  pkg({ name: '@sample/color', version: '1.2.0', relationship: 'direct', license: 'Apache-2.0', references: 11 }),
  pkg({ name: '@sample/test-harness', version: '5.1.0', relationship: 'development', references: 9 }),
];
```

- [ ] **Step 4: Copy.** Create `src/ui/audit-copy/dependencies.ts` and `src/ui/audit-copy/security.ts` and re-export both:

```ts
// Part 3 §2: Dependencies screen and the Package detail dialog.
export const DEPS_EYEBROW = 'Audit / Dependencies';
export const DEPS_TITLE = 'Know what your code depends on.';
export const DEPS_SUBTITLE = 'Separate internal coupling from the external packages in your supply chain.';
export const DEPS_EXPORT = 'Export inventory';
export const DEPS_CSV_FILENAME = 'sample-package-inventory.csv';
export const DEPS_CALLOUT_TITLE = 'Fictional packages, real review flow.';
export const DEPS_CALLOUT = 'Every @sample package, version and advisory is demonstration data, not a claim about published software or about your codebase.';
export const DEPS_MANIFESTS_TITLE = 'Manifests found';
export const DEPS_MANIFESTS_NOTE = 'Contents not read. A real package inventory arrives with a dependency provider.';
export const DEPS_MANIFESTS_NONE = 'No package.json in this inventory.';
export const DEPS_CARD_PACKAGES = 'Packages in fixture';
export const DEPS_CARD_PACKAGES_CAPTION = (direct: number, transitive: number, dev: number): string => `${direct} direct · ${transitive} transitive · ${dev} development`;
export const DEPS_CARD_ADVISORIES = 'Advisories to review';
export const DEPS_CARD_ADVISORIES_CAPTION = 'Reachability not established';
export const DEPS_CARD_UNUSED = 'Unused candidates';
export const DEPS_CARD_UNUSED_CAPTION = 'Verify entry points before removal';
export const DEPS_CARD_LICENSE = 'License unknown';
export const DEPS_CARD_LICENSE_CAPTION = 'Unresolved does not mean incompatible';
export const DEPS_TABS_LABEL = 'Dependency views';
export const DEPS_TAB_INVENTORY = 'Package inventory';
export const DEPS_TAB_PATH = 'Dependency path';
export const DEPS_TAB_LICENSES = 'Licenses';
export const DEPS_FILTER_QUERY = 'Find a package…';
export const DEPS_FILTER_LABEL = 'Relationship or status';
export const DEPS_FILTER_LABELS: Readonly<Record<'all' | 'direct' | 'transitive' | 'development' | 'review' | 'unused', string>> = {
  all: 'All dependencies', direct: 'Direct', transitive: 'Transitive', development: 'Development', review: 'Review', unused: 'Unused',
};
export const DEPS_TABLE_CAPTION = 'Sample package inventory';
export const DEPS_COL_PACKAGE = 'Package';
export const DEPS_COL_INSTALLED = 'Installed';
export const DEPS_COL_RELATIONSHIP = 'Relationship';
export const DEPS_COL_LICENSE = 'License';
export const DEPS_COL_STATUS = 'Status';
export const DEPS_REFERENCES = (n: string): string => `${n} illustrative import references`;
export const DEPS_RELATIONSHIP_LABEL: Readonly<Record<'direct' | 'transitive' | 'development', string>> = {
  direct: 'Direct', transitive: 'Transitive', development: 'Development',
};
export const DEPS_STATUS_LABEL: Readonly<Record<'review' | 'current' | 'update' | 'unused', string>> = {
  review: 'Review', current: 'Current', update: 'Update', unused: 'Unused',
};
export const DEPS_LICENSE_UNRESOLVED = 'Unresolved';
export const DEPS_COUNT = (n: number): string => `${n} packages · names and advisory data are fictional.`;
export const DEPS_NO_MATCH_TITLE = 'No packages found';
export const DEPS_NO_MATCH = 'Try a shorter name or a different relationship filter.';
export const DEPS_PATH_TITLE = 'An external dependency path';
export const DEPS_PATH_SUBTITLE = 'How a transitive package reaches your codebase, in the fixture.';
export const DEPS_PATH_DIRECT = 'Direct dependency';
export const DEPS_PATH_TRANSITIVE = 'Transitive dependency';
export const DEPS_INSPECT = 'Inspect package';
export const DEPS_LICENSES_TITLE = 'License inventory';
export const DEPS_LICENSES_SUBTITLE = 'Policy compatibility needs a project-specific legal review.';
export const DEPS_LICENSES_CAPTION = 'Licences in the sample inventory';
export const DEPS_COL_PACKAGES = 'Packages';
export const DEPS_COL_RECORDED = 'Recorded status';
export const DEPS_RECORDED_OK = 'Recorded';
export const DEPS_RECORDED_REVIEW = 'Needs review';
export const DEPS_FOOTNOTE = 'No network, registry or advisory-database calls are made.';
export const PACKAGE_DIALOG_SUBTITLE = 'Fictional package record, for review-flow illustration only.';
export const PACKAGE_DEMO_BADGE = 'Demo data';
export const PACKAGE_INSTALLED = 'Installed';
export const PACKAGE_TARGET = 'Illustrative target';
export const PACKAGE_REFERENCES = 'References';
export const PACKAGE_ADVISORY_UNKNOWN = 'Reachability and real exposure are unknown. Confirm affected versions and behaviour before upgrading. This is not a real advisory.';
export const PACKAGE_UNUSED_NOTE = 'No references in the fixture. Verify entry points, scripts and configuration before removal.';
export const PACKAGE_METADATA_NOTE = 'Metadata is illustrative. No package registry or real lockfile was consulted.';
export const PACKAGE_CREATE_REVIEW = 'Create review item';
export const PACKAGE_IN_REVIEW = 'Review item exists';
export const PACKAGE_REVIEW_TITLE = (name: string, advisory: string | null): string => `Review ${name} ${advisory ?? 'dependency usage'}`;
export const PACKAGE_REVIEW_FAILED = 'Could not add this review item.';
export const PACKAGE_CLOSE = 'Close';
```

```ts
// Part 3 §2: Security screen. No exploitability verdict anywhere (Q7).
export const SECURITY_EYEBROW = 'Audit / Security';
export const SECURITY_TITLE = 'Make security evidence actionable.';
export const SECURITY_SUBTITLE = 'Review findings in context. A detected pattern is not a confirmed exploit.';
export const SECURITY_SOURCES = 'Evidence sources';
export const SECURITY_EXPORT = 'Export review';
export const SECURITY_CSV_FILENAME = 'sample-security-review.csv';
export const SECURITY_CARD_ADVISORIES = 'Dependency advisories';
export const SECURITY_CARD_ADVISORIES_CAPTION = 'Fictional advisories · reachability unknown';
export const SECURITY_CARD_SECRETS = 'Secret-pattern candidates';
export const SECRETS_NOT_COLLECTED = 'Not collected · no secret-scanning provider';
export const SECURITY_CARD_LICENSES = 'License questions';
export const SECURITY_CARD_LICENSES_CAPTION = 'Recorded licence is unresolved';
export const SECURITY_CARD_RUNTIME = 'Runtime exploitability';
export const RUNTIME_NOT_ASSESSED = 'Not assessed · no runtime evidence';
export const SECURITY_TABS_LABEL = 'Security views';
export const SECURITY_TAB_ADVISORIES = 'Dependency advisories';
export const SECURITY_TAB_SECRETS = 'Secret scanning';
export const SECURITY_TAB_POLICY = 'Review policy';
export const SECURITY_ADVISORIES_TITLE = 'Advisories requiring review';
export const SECURITY_ADVISORIES_SUBTITLE = 'DEMO identifiers are not CVEs or real vulnerability records.';
export const SECURITY_REVIEW_BADGE = 'Review';
export const SECURITY_ADVISORY_VERSIONS = (installed: string, patched: string): string => `Installed ${installed} · illustrative patched version ${patched}`;
export const SECURITY_ADVISORY_LABEL = (id: string, name: string): string => `${id}, ${name}. Inspect package`;
export const SECURITY_CHECKLIST_TITLE = 'Review before remediation';
export const SECURITY_CHECKLIST_SUBTITLE = 'A consistent audit checklist for every dependency finding. Not saved.';
export const SECURITY_CHECKLIST: readonly string[] = [
  'Confirm package and version match',
  'Validate the affected code path is reachable',
  'Check input and deployment exposure',
  'Verify an upgrade and regression-test plan',
];
export const SECURITY_NO_CONCLUSION = 'No conclusion about your repository can be drawn from these demo findings.';
export const SECRETS_TITLE = 'A candidate is not a confirmed secret';
export const SECRETS_SUBTITLE = 'No secret-scanning provider is connected.';
export const SECRETS_EMPTY_TITLE = 'Secret candidates are unknown.';
export const SECRETS_EMPTY = 'Nothing has scanned this codebase for secret patterns. When a provider runs, candidates will be masked and need validation before they count as findings.';
export const POLICY_TITLE = 'Security review policy';
export const POLICY_SUBTITLE = 'The inspector does not automatically accept, suppress or fix findings.';
export const POLICY_ROWS: readonly { rule: string; value: string }[] = [
  { rule: 'Mask secret values', value: 'Always on' },
  { rule: 'Exploitability requires evidence', value: 'Review required' },
  { rule: 'No automatic remediation', value: 'Read-only' },
];
export const REACHABILITY_UNKNOWN = 'unknown';
```

- [ ] **Step 5: Implement the read models.**

```ts
// read-models/root-label.ts — the analysed root's folder name, for labels only.
export function rootFolderLabel(rootPath: string): string {
  const normalized = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.slice(normalized.lastIndexOf('/') + 1) || normalized;
}
```

  In `App.vue`, replace the body of `workspaceLabel` with `const root = store.snapshot?.scope.rootPath; return root ? rootFolderLabel(root) : NO_CODEBASE_LABEL;`.

```ts
// read-models/dependencies.ts — Part 3 Q5/Q6: the fictional inventory, plus ONE real,
// metadata-only signal: which package.json files the inventory holds (never read).
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot } from '../../domain/model';
import { sample, type MetricValue } from '../evidence';
import { metricColumns, toCsv, type CsvColumn } from '../export/csv';
import { SAMPLE_PACKAGES, type PackageRelationship, type SamplePackage } from '../fixtures/sample-packages';
import {
  DEPS_CARD_ADVISORIES, DEPS_CARD_ADVISORIES_CAPTION, DEPS_CARD_LICENSE, DEPS_CARD_LICENSE_CAPTION, DEPS_CARD_PACKAGES,
  DEPS_CARD_PACKAGES_CAPTION, DEPS_CARD_UNUSED, DEPS_CARD_UNUSED_CAPTION, DEPS_LICENSE_UNRESOLVED,
} from '../inspector-copy';
import { rootFolderLabel } from './root-label';

export type PackageFilter = 'all' | PackageRelationship | 'review' | 'unused';
export interface PackageRow { pkg: SamplePackage; references: MetricValue }
export interface LicenseRow { key: string; label: string; packages: number; needsReview: boolean }
export interface ManifestRow { id: EntityId; path: string }
export interface DependenciesCard { id: 'packages' | 'advisories' | 'unused' | 'license'; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' }
export interface DependenciesModel {
  packages: readonly PackageRow[]; licenses: readonly LicenseRow[]; path: readonly SamplePackage[];
  manifests: readonly ManifestRow[]; rootLabel: string; cards: readonly DependenciesCard[]; usesSample: true;
}

const UNRESOLVED = '(unresolved)';
const count = (pred: (p: SamplePackage) => boolean): number => SAMPLE_PACKAGES.filter(pred).length;

function licenses(): LicenseRow[] {
  const by = new Map<string, number>();
  for (const p of SAMPLE_PACKAGES) { const k = p.license ?? UNRESOLVED; by.set(k, (by.get(k) ?? 0) + 1); }
  return [...by.entries()].map(([key, packages]) => ({
    key, label: key === UNRESOLVED ? DEPS_LICENSE_UNRESOLVED : key, packages, needsReview: key === UNRESOLVED,
  })).sort((a, b) => b.packages - a.packages || a.label.localeCompare(b.label));
}

/** The fixture's one illustrative path: the first transitive package with an advisory. */
function dependencyPath(): SamplePackage[] {
  const transitive = SAMPLE_PACKAGES.find((p) => p.relationship === 'transitive' && p.advisory !== null);
  const direct = SAMPLE_PACKAGES.find((p) => p.name === transitive?.via);
  return direct && transitive ? [direct, transitive] : [];
}

export function buildDependenciesModel(snapshot: CodebaseSnapshot): DependenciesModel {
  const manifests = snapshot.entities
    .filter((e) => e.kind === 'file' && e.name === 'package.json')
    .map((e) => ({ id: e.id, path: e.path }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    packages: SAMPLE_PACKAGES.map((pkg) => ({ pkg, references: sample(pkg.references) })),
    licenses: licenses(),
    path: dependencyPath(),
    manifests,
    rootLabel: rootFolderLabel(snapshot.scope.rootPath),
    cards: [
      { id: 'packages', label: DEPS_CARD_PACKAGES, icon: 'package', value: sample(SAMPLE_PACKAGES.length),
        caption: DEPS_CARD_PACKAGES_CAPTION(count((p) => p.relationship === 'direct'), count((p) => p.relationship === 'transitive'), count((p) => p.relationship === 'development')), tone: 'accent' },
      { id: 'advisories', label: DEPS_CARD_ADVISORIES, icon: 'shield', value: sample(count((p) => p.advisory !== null)), caption: DEPS_CARD_ADVISORIES_CAPTION, tone: 'warning' },
      { id: 'unused', label: DEPS_CARD_UNUSED, icon: 'file', value: sample(count((p) => p.status === 'unused')), caption: DEPS_CARD_UNUSED_CAPTION, tone: 'accent' },
      { id: 'license', label: DEPS_CARD_LICENSE, icon: 'file-text', value: sample(count((p) => p.license === null)), caption: DEPS_CARD_LICENSE_CAPTION, tone: 'warning' },
    ],
    usesSample: true,
  };
}

export function filterPackages(rows: readonly PackageRow[], query: string, filter: PackageFilter): readonly PackageRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter(({ pkg }) => (filter === 'all' || pkg.relationship === filter || pkg.status === filter)
    && (!q || pkg.name.toLowerCase().includes(q)));
}

const PACKAGE_COLUMNS: readonly CsvColumn<PackageRow>[] = [
  { header: 'name', value: (r) => r.pkg.name },
  { header: 'version', value: (r) => r.pkg.version },
  { header: 'relationship', value: (r) => r.pkg.relationship },
  { header: 'license', value: (r) => r.pkg.license ?? undefined },
  { header: 'status', value: (r) => r.pkg.status },
  { header: 'advisory', value: (r) => r.pkg.advisory?.id },
  ...metricColumns<PackageRow>('references', (r) => r.references),
  { header: 'provenance', value: () => 'sample' },
];

export function packagesCsv(rows: readonly PackageRow[]): string {
  return toCsv(PACKAGE_COLUMNS, rows);
}
```

```ts
// read-models/security.ts — Part 3 Q7: fixture advisories on fictional packages, and NO
// exploitability verdict. Secret candidates and runtime exploitability are unknown.
import { sample, unknown, type MetricValue } from '../evidence';
import { toCsv, type CsvColumn } from '../export/csv';
import { SAMPLE_PACKAGES, type SamplePackage } from '../fixtures/sample-packages';
import {
  REACHABILITY_UNKNOWN, RUNTIME_NOT_ASSESSED, SECRETS_NOT_COLLECTED, SECURITY_CARD_ADVISORIES, SECURITY_CARD_ADVISORIES_CAPTION,
  SECURITY_CARD_LICENSES, SECURITY_CARD_LICENSES_CAPTION, SECURITY_CARD_RUNTIME, SECURITY_CARD_SECRETS,
} from '../inspector-copy';

export interface SecurityCard { id: 'advisories' | 'secrets' | 'licenses' | 'runtime'; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' }
export interface SecurityModel { advisories: readonly SamplePackage[]; cards: readonly SecurityCard[]; usesSample: true }

export function buildSecurityModel(): SecurityModel {
  const advisories = SAMPLE_PACKAGES.filter((p) => p.advisory !== null);
  return {
    advisories,
    cards: [
      { id: 'advisories', label: SECURITY_CARD_ADVISORIES, icon: 'shield', value: sample(advisories.length), caption: SECURITY_CARD_ADVISORIES_CAPTION, tone: 'warning' },
      { id: 'secrets', label: SECURITY_CARD_SECRETS, icon: 'lock', value: unknown(SECRETS_NOT_COLLECTED), caption: '', tone: 'accent' },
      { id: 'licenses', label: SECURITY_CARD_LICENSES, icon: 'file-text', value: sample(SAMPLE_PACKAGES.filter((p) => p.license === null).length), caption: SECURITY_CARD_LICENSES_CAPTION, tone: 'accent' },
      { id: 'runtime', label: SECURITY_CARD_RUNTIME, icon: 'info', value: unknown(RUNTIME_NOT_ASSESSED), caption: '', tone: 'accent' },
    ],
    usesSample: true,
  };
}

const ADVISORY_COLUMNS: readonly CsvColumn<SamplePackage>[] = [
  { header: 'advisory', value: (p) => p.advisory?.id },
  { header: 'package', value: (p) => p.name },
  { header: 'installed', value: (p) => p.version },
  { header: 'illustrative_patched', value: (p) => p.advisory?.patched },
  { header: 'summary', value: (p) => p.advisory?.summary },
  { header: 'reachability', value: () => REACHABILITY_UNKNOWN },
  { header: 'provenance', value: () => 'sample' },
];

export function advisoriesCsv(rows: readonly SamplePackage[]): string {
  return toCsv(ADVISORY_COLUMNS, rows);
}
```

- [ ] **Step 6: `use-read-models.ts`.** Add a `dependenciesCache` (a WeakMap on the snapshot object) with `dependenciesModelFor(snapshot)`. Expose `dependencies = computed(() => (store.snapshot ? dependenciesModelFor(store.snapshot) : null))`. Create one module-level `const SECURITY = buildSecurityModel();` (it takes no input) and expose `security = computed(() => SECURITY)`.
- [ ] **Step 7: Run and confirm they pass.** `npx vitest run tests/unit/dependencies-model.test.ts tests/component/workspace-shell.test.ts`, then the gate.
- [ ] **Step 8: Commit.** `feat(ui): fictional package inventory with real manifest detection; security model without verdicts`

---

### Task 7: Evolution and Ownership read models

**Files:**
- Create: `src/ui/fixtures/sample-evolution.ts`, `src/ui/fixtures/sample-stewardship.ts`, `src/ui/read-models/evolution.ts`, `src/ui/read-models/ownership.ts`, `src/ui/audit-copy/ownership.ts`
- Modify: `src/ui/audit-copy/evolution.ts` (from Task 3), `src/ui/read-models/overview.ts` (export `dateLabels`), `src/ui/read-models/use-read-models.ts`, `src/ui/inspector-copy.ts`
- Test: `tests/unit/evolution-ownership-model.test.ts` (new)

**Interfaces:**
- Consumes: `JournalEntry`, `compareSnapshots` (Task 3).
- Produces:

```ts
// read-models/overview.ts
export function dateLabels(capturedAt: string, count: number, stepDays: number): string[];   // trendLabels delegates to it
// fixtures/sample-evolution.ts
export type ChangeWindow = 30 | 90;
export const WINDOW_POINTS: Readonly<Record<ChangeWindow, { count: number; stepDays: number }>>;   // 90 → 7 × 14 days, 30 → 5 × 7 days
export function sampleActivity(seedKey: string, window: ChangeWindow): number[];
export interface SampleCoupling { a: FileSummary; b: FileSummary; rate: number; shared: number }
export function sampleCoupling(ordered: readonly FileSummary[], limit: number): SampleCoupling[];
// fixtures/sample-stewardship.ts
export const SAMPLE_TEAM_COUNT = 3;
export function sampleStewardship(module: string): { teamIndex: number; concentration: number };
// read-models/evolution.ts
export const COUPLING_ROWS = 6;
export interface EvolutionCard { id: 'size' | 'window' | 'snapshots' | 'changed'; label: string; icon: string; value: MetricValue; unit: string; caption: string; tone: 'accent' | 'warning' }
export interface CouplingRow { a: FileSummary; b: FileSummary; rate: MetricValue; shared: MetricValue }
export interface EvolutionModel {
  cards: readonly EvolutionCard[]; activity: readonly { label: string; value: number }[];
  coverage: readonly { id: string; label: string; tone: 'success'; points: readonly { label: string; value: number }[] }[];
  coupling: readonly CouplingRow[]; journal: readonly JournalEntry[]; comparison: SnapshotComparison | null; usesSample: true;
}
export function buildEvolutionModel(snapshot: CodebaseSnapshot, files: readonly FileSummary[], journal: readonly JournalEntry[], window: ChangeWindow): EvolutionModel;
// read-models/ownership.ts
export const CONCENTRATION_WARNING = 70;
export interface StewardshipRow { module: string; label: string; team: MetricValue<string>; files: MetricValue; concentration: MetricValue; reviewCandidates: MetricValue }
export interface StewardshipAction { intent: 'pairing' | 'tests' | 'documentation'; module: string; label: string; title: string; body: string }
export interface OwnershipModel { rows: readonly StewardshipRow[]; hiddenModules: number; actions: readonly StewardshipAction[]; usesSample: true }
export function buildOwnershipModel(files: readonly FileSummary[]): OwnershipModel;
export function stewardshipCsv(rows: readonly StewardshipRow[]): string;
// use-read-models.ts: `evolutionModelFor(snapshot, files, journal, window)` (memoized, exported; the screen owns the window)
// and useReadModels() also returns `ownership: ComputedRef<OwnershipModel>`.
```

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/evolution-ownership-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { journalEntryFor } from '../../src/ui/read-models/snapshot-comparison';
import { buildEvolutionModel } from '../../src/ui/read-models/evolution';
import { buildOwnershipModel, stewardshipCsv } from '../../src/ui/read-models/ownership';
import { sampleCoupling } from '../../src/ui/fixtures/sample-evolution';

const snap = buildSnapshotFixture({ files: 60, directories: 4 });
const files = fileSummariesFor(snap);
const current = journalEntryFor(snap, files);

describe('evolution model (Part 3 Q8-Q10)', () => {
  it('source size is collected; the activity series has 7 points at 90 days and 5 at 30', () => {
    const m90 = buildEvolutionModel(snap, files, [current], 90);
    expect(m90.cards.find((c) => c.id === 'size')!.value.state).toBe('collected');
    expect(m90.activity).toHaveLength(7);
    expect(buildEvolutionModel(snap, files, [current], 30).activity).toHaveLength(5);
  });

  it('with one snapshot, "files added or removed" is unknown and there is no comparison', () => {
    const m = buildEvolutionModel(snap, files, [current], 90);
    expect(m.cards.find((c) => c.id === 'changed')!.value.state).toBe('unknown');
    expect(m.comparison).toBeNull();
    expect(m.cards.find((c) => c.id === 'snapshots')!.value.value).toBe(1);
  });

  it('with two snapshots, compares the previous one with the current one (collected)', () => {
    const older = buildSnapshotFixture({ files: 55, directories: 4 });
    const prev = { ...journalEntryFor(older, fileSummariesFor(older)), snapshotId: 'older' };
    const m = buildEvolutionModel(snap, files, [prev, current], 90);
    expect(m.comparison?.added).toBe(5);
    expect(m.cards.find((c) => c.id === 'changed')!.value).toMatchObject({ state: 'collected', value: 5 });
    expect(m.journal[0]?.snapshotId).toBe(current.snapshotId);   // newest first
  });

  it('coupling pairs two distinct files of the same module, never a self pair or a repeat', () => {
    const pairs = sampleCoupling(files, 6);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every((p) => p.a.module === p.b.module && p.a.id !== p.b.id)).toBe(true);
    const keys = pairs.map((p) => [p.a.id, p.b.id].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('ownership model (Part 3 Q11)', () => {
  const m = buildOwnershipModel(files);
  it('is module-level: files are collected, teams and concentration are sample', () => {
    const row = m.rows[0]!;
    expect(row.files.state).toBe('collected');
    expect(row.team.state).toBe('sample');
    expect(row.concentration.state).toBe('sample');
  });
  it('holds no per-person field anywhere', () => {
    const keys = new Set([...m.rows.flatMap((r) => Object.keys(r)), ...m.actions.flatMap((a) => Object.keys(a))]);
    for (const forbidden of ['author', 'authors', 'person', 'people', 'contributor', 'contributors', 'owner', 'email', 'user']) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });
  it('proposes three knowledge-sharing actions for the three most concentrated modules', () => {
    expect(m.actions.map((a) => a.intent)).toEqual(['pairing', 'tests', 'documentation']);
    const top = [...m.rows].sort((a, b) => b.concentration.value! - a.concentration.value! || a.label.localeCompare(b.label)).slice(0, 3);
    expect(m.actions.map((a) => a.module)).toEqual(top.map((r) => r.module));
  });
  it('exports the stewardship map with a state per value', () => {
    expect(stewardshipCsv(m.rows).split('\r\n')[0]).toBe('\uFEFFmodule,team,team_state,files,files_state,concentration_pct,concentration_pct_state,review_candidates,review_candidates_state');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/unit/evolution-ownership-model.test.ts`
- [ ] **Step 3: `dateLabels`.** In `overview.ts`, extract the body of `trendLabels` into `export function dateLabels(capturedAt: string, count: number, stepDays: number): string[]`, with the same `MONTHS` and UTC formatting. Make `trendLabels(capturedAt)` return `dateLabels(capturedAt, TREND_POINTS, TREND_SPACING_DAYS)`. The existing overview tests must pass unchanged.
- [ ] **Step 4: Fixtures.**

```ts
// fixtures/sample-evolution.ts — Part 3 Q10: SAMPLE commit activity and change coupling.
// Coupling pairs real files of one module; it is correlation, never an import claim.
import type { FileSummary } from '../read-models/file-summaries';
import { fnv1a, mulberry32 } from './seeded-random';

export type ChangeWindow = 30 | 90;
export const WINDOW_POINTS: Readonly<Record<ChangeWindow, { count: number; stepDays: number }>> = {
  90: { count: 7, stepDays: 14 }, 30: { count: 5, stepDays: 7 },
};

export function sampleActivity(seedKey: string, window: ChangeWindow): number[] {
  const r = mulberry32(fnv1a(`activity:${seedKey}:${window}`));
  return Array.from({ length: WINDOW_POINTS[window].count }, () => 40 + Math.floor(r() * 70));
}

export interface SampleCoupling { a: FileSummary; b: FileSummary; rate: number; shared: number }

/** `ordered` is the caller's priority order; the first `limit` distinct pairs win. */
export function sampleCoupling(ordered: readonly FileSummary[], limit: number): SampleCoupling[] {
  const byModule = new Map<string, FileSummary[]>();
  for (const f of ordered) {
    const g = byModule.get(f.module);
    if (g) g.push(f); else byModule.set(f.module, [f]);
  }
  const seen = new Set<string>();
  const pairs: SampleCoupling[] = [];
  for (const a of ordered) {
    if (pairs.length >= limit) break;
    const siblings = (byModule.get(a.module) ?? []).filter((f) => f.id !== a.id);
    if (siblings.length === 0) continue;
    const r = mulberry32(fnv1a(`couple:${a.id}`));
    const b = siblings[Math.floor(r() * siblings.length)];
    if (!b) continue;
    const key = [a.id, b.id].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ a, b, rate: 40 + Math.floor(r() * 41), shared: 6 + Math.floor(r() * 19) });
  }
  return pairs.sort((x, y) => y.rate - x.rate);
}
```

  The `siblings` filter inside the loop is O(n) per file, but it only runs until `limit` pairs are found, normally within the first few files. Report it if a test on 10 000 files is slow.

```ts
// fixtures/sample-stewardship.ts — Part 3 Q11: a SAMPLE stewarding team (an index into
// the copy's team labels) and a SAMPLE concentration per MODULE. Nothing per person.
import { fnv1a, mulberry32 } from './seeded-random';

export const SAMPLE_TEAM_COUNT = 3;

export function sampleStewardship(module: string): { teamIndex: number; concentration: number } {
  const r = mulberry32(fnv1a(`steward:${module}`));
  return { teamIndex: Math.floor(r() * SAMPLE_TEAM_COUNT), concentration: 55 + Math.floor(r() * 26) };
}
```

- [ ] **Step 5: Copy.** Append to `src/ui/audit-copy/evolution.ts`:

```ts
export const EVOLUTION_EYEBROW = 'Audit / Evolution';
export const EVOLUTION_TITLE = 'See the direction, not just the snapshot.';
export const EVOLUTION_SUBTITLE = 'Compare structure, quality signals and change patterns over time.';
export const EVOLUTION_WINDOW_LABEL = 'Change window';
export const EVOLUTION_WINDOW = (days: number): string => `${days} days`;
export const EVOLUTION_COMPARE = 'Compare snapshots';
export const EVOLUTION_CARD_SIZE = 'Source size';
export const EVOLUTION_CARD_SIZE_CAPTION = 'Physical lines in this snapshot';
export const EVOLUTION_CARD_WINDOW = 'Change window';
export const EVOLUTION_CARD_WINDOW_CAPTION = 'Sample commit counts; no author comparisons';
export const EVOLUTION_CARD_SNAPSHOTS = 'Snapshots this session';
export const EVOLUTION_CARD_SNAPSHOTS_CAPTION = 'Kept in memory; history is not saved yet';
export const EVOLUTION_CARD_CHANGED = 'Files added or removed';
export const EVOLUTION_CARD_CHANGED_CAPTION = (added: number, removed: number): string => `${added} added · ${removed} removed since the previous snapshot`;
export const NEEDS_SECOND_SNAPSHOT = 'Needs a second snapshot in this session. Rescan to compare.';
export const EVOLUTION_ACTIVITY_TITLE = 'Change activity';
export const EVOLUTION_ACTIVITY_SUBTITLE = 'Sample repository commits per interval.';
export const EVOLUTION_ACTIVITY_LABEL = 'Sample commits per interval';
export const EVOLUTION_ACTIVITY_VALUE = 'Commits';
export const EVOLUTION_COVERAGE_TITLE = 'Coverage trend';
export const EVOLUTION_COVERAGE_SUBTITLE = 'Weighted branch coverage, sample history.';
export const EVOLUTION_COVERAGE_SERIES = 'Branch coverage (%)';
export const EVOLUTION_COVERAGE_NONE = 'Coverage is unknown, so there is no trend to draw.';
export const EVOLUTION_COUPLING_TITLE = 'Change coupling';
export const EVOLUTION_COUPLING_SUBTITLE = 'Files that often change in the same commits. Correlation, not a causal dependency.';
export const EVOLUTION_COUPLING_FOOTNOTE = 'Co-change rate: shared commits / commits touching either file · sample.';
export const EVOLUTION_COUPLING_CAPTION = 'Sample change coupling between file pairs';
export const EVOLUTION_COL_PAIR = 'File pair';
export const EVOLUTION_COL_RATE = 'Co-change rate';
export const EVOLUTION_COL_SHARED = 'Shared commits';
export const EVOLUTION_COUPLING_NONE = 'No module has two files to pair.';
export const EVOLUTION_JOURNAL_TITLE = 'Snapshot journal';
export const EVOLUTION_JOURNAL_SUBTITLE = 'The snapshots this view has shown in this session.';
export const EVOLUTION_JOURNAL_ENTRY = (files: number, lines: string): string => `${files} files · ${lines} lines`;
export const EVOLUTION_JOURNAL_CURRENT = 'On screen';
export const EVOLUTION_JOURNAL_COMPARE = 'Compare with current';
export const EVOLUTION_JOURNAL_ONE = 'Only one snapshot so far. Rescan to compare.';
export const COMPARE_TITLE = 'Compare snapshots';
export const COMPARE_SUBTITLE = 'Stable file identities make changes easier to follow. Every value here comes from the inventory.';
export const COMPARE_BASE_LABEL = 'Compare with';
export const COMPARE_COL_SIGNAL = 'Signal';
export const COMPARE_COL_BEFORE = 'Earlier';
export const COMPARE_COL_AFTER = 'Current';
export const COMPARE_COL_CHANGE = 'Change';
export const COMPARE_FILES = 'Files';
export const COMPARE_LINES = 'Source lines';
export const COMPARE_ADDED = 'Files added';
export const COMPARE_REMOVED = 'Files removed';
export const COMPARE_MODULES_CAPTION = 'Files and lines per module, earlier and current';
export const COMPARE_CLOSE = 'Close';
export const COMPARE_ENTRY = (capturedAt: string, id: string): string => `${capturedAt} · ${id.slice(0, 8)}`;
export const SIGNED = (n: number): string => (n > 0 ? `+${n.toLocaleString('en-US')}` : n.toLocaleString('en-US'));
```

  Create `src/ui/audit-copy/ownership.ts` and re-export it:

```ts
// Part 3 §2: Ownership screen. Module and team level only (Q11).
export const OWNERSHIP_EYEBROW = 'Audit / Ownership';
export const OWNERSHIP_TITLE = 'Make knowledge resilient.';
export const OWNERSHIP_SUBTITLE = 'Review module stewardship and concentrated knowledge, not developer productivity.';
export const OWNERSHIP_EXPORT = 'Export ownership map';
export const OWNERSHIP_CSV_FILENAME = 'sample-module-stewardship.csv';
export const OWNERSHIP_CALLOUT_TITLE = 'Team-level continuity signals only.';
export const OWNERSHIP_CALLOUT = 'Contribution history is an imperfect proxy for familiarity. No individual ranking or performance score is shown.';
export const SAMPLE_TEAM_LABELS: readonly string[] = ['Experience', 'Platform', 'Core systems'];
export const OWNERSHIP_BARS_TITLE = 'Knowledge distribution by module';
export const OWNERSHIP_BARS_SUBTITLE = 'Sample share of changes attributed to the largest contributing group.';
export const OWNERSHIP_BARS_FOOTNOTE = 'High concentration is a prompt for a conversation, not proof of missing knowledge.';
export const OWNERSHIP_BAR_LABEL = (module: string, pct: string): string => `${module}: ${pct} concentration (sample)`;
export const OWNERSHIP_ACTIONS_TITLE = 'Stewardship actions';
export const OWNERSHIP_ACTIONS_SUBTITLE = 'Turn concentrated knowledge into shared understanding.';
export const OWNERSHIP_ACTION_TITLE: Readonly<Record<'pairing' | 'tests' | 'documentation', (m: string) => string>> = {
  pairing: (m) => `Pair-review the ${m} module`,
  tests: (m) => `Make ${m} behaviour executable`,
  documentation: (m) => `Document ${m} decisions`,
};
export const OWNERSHIP_ACTION_BODY: Readonly<Record<'pairing' | 'tests' | 'documentation', string>> = {
  pairing: 'Walk through invariants and boundary decisions with a second reviewer.',
  tests: 'Capture current behaviour in characterization tests before it changes.',
  documentation: 'Write down the decisions and procedures that live in a few heads.',
};
export const OWNERSHIP_ACTION_ADD = (title: string): string => `Add work item: ${title}`;
export const OWNERSHIP_ACTION_ADDED = 'In refactor plan';
export const OWNERSHIP_ACTION_FAILED = 'Could not add this work item.';
export const OWNERSHIP_TABLE_TITLE = 'Module stewardship';
export const OWNERSHIP_TABLE_SUBTITLE = 'Stewarding teams are sample labels and need human confirmation.';
export const OWNERSHIP_TABLE_CAPTION = 'Module stewardship';
export const OWNERSHIP_COL_MODULE = 'Module';
export const OWNERSHIP_COL_TEAM = 'Stewarding team';
export const OWNERSHIP_COL_FILES = 'Files';
export const OWNERSHIP_COL_CONCENTRATION = 'Concentration';
export const OWNERSHIP_COL_CANDIDATES = 'Review candidates';
export const OWNERSHIP_COL_ACTIONS = 'Actions';
export const OWNERSHIP_SHOW_IN_CITY = 'Show in city';
export const OWNERSHIP_SHOW_IN_CITY_LABEL = (m: string): string => `Show the ${m} module in the city`;
export const OWNERSHIP_HIDDEN = (n: number): string => `${n} smaller modules are not shown.`;
```

- [ ] **Step 6: Implement the read models.**

```ts
// read-models/evolution.ts — Part 3 Q8-Q10. Size, snapshot count and the comparison are
// collected; activity, coverage trend and coupling are sample.
import type { CodebaseSnapshot } from '../../domain/model';
import { collected, hasValue, ratioEvidence, sample, sumEvidence, unknown, type MetricValue } from '../evidence';
import { sampleActivity, sampleCoupling, WINDOW_POINTS, type ChangeWindow } from '../fixtures/sample-evolution';
import { sampleTrend } from '../fixtures/sample-signals';
import {
  EVOLUTION_CARD_CHANGED, EVOLUTION_CARD_CHANGED_CAPTION, EVOLUTION_CARD_SIZE, EVOLUTION_CARD_SIZE_CAPTION,
  EVOLUTION_CARD_SNAPSHOTS, EVOLUTION_CARD_SNAPSHOTS_CAPTION, EVOLUTION_CARD_WINDOW, EVOLUTION_CARD_WINDOW_CAPTION,
  EVOLUTION_COVERAGE_SERIES, NEEDS_SECOND_SNAPSHOT,
} from '../inspector-copy';
import { filesByPriority, type FileSummary } from './file-summaries';
import { dateLabels } from './overview';
import { compareSnapshots, type JournalEntry, type SnapshotComparison } from './snapshot-comparison';

export const COUPLING_ROWS = 6;
export interface EvolutionCard { id: 'size' | 'window' | 'snapshots' | 'changed'; label: string; icon: string; value: MetricValue; unit: string; caption: string; tone: 'accent' | 'warning' }
export interface CouplingRow { a: FileSummary; b: FileSummary; rate: MetricValue; shared: MetricValue }
interface CoverageSeries { id: string; label: string; tone: 'success'; points: readonly { label: string; value: number }[] }
export interface EvolutionModel {
  cards: readonly EvolutionCard[];
  activity: readonly { label: string; value: number }[];
  coverage: readonly CoverageSeries[];
  coupling: readonly CouplingRow[];
  journal: readonly JournalEntry[];
  comparison: SnapshotComparison | null;
  usesSample: true;
}

function changedCard(comparison: SnapshotComparison | null): EvolutionCard {
  const base = { id: 'changed' as const, label: EVOLUTION_CARD_CHANGED, icon: 'git-compare', unit: '', tone: 'warning' as const };
  return comparison
    ? { ...base, value: collected(comparison.added + comparison.removed, 'inventory'), caption: EVOLUTION_CARD_CHANGED_CAPTION(comparison.added, comparison.removed) }
    : { ...base, value: unknown(NEEDS_SECOND_SNAPSHOT, 'session'), caption: '' };
}

export function buildEvolutionModel(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[], journal: readonly JournalEntry[], window: ChangeWindow,
): EvolutionModel {
  const { count, stepDays } = WINDOW_POINTS[window];
  const labels = dateLabels(snapshot.providerRun.capturedAt, count, stepDays);
  const toPoints = (values: readonly number[]) => values.map((value, i) => ({ label: labels[i] ?? '', value }));
  const coverageNow = ratioEvidence(sumEvidence(files.map((f) => f.branchesCovered)), sumEvidence(files.map((f) => f.branchesTotal)));
  const coverage: CoverageSeries[] = hasValue(coverageNow)
    ? [{ id: 'coverage', label: EVOLUTION_COVERAGE_SERIES, tone: 'success', points: toPoints(sampleTrend(`${snapshot.repositoryId}:coverage:${window}`, coverageNow.value, count, 3)) }]
    : [];
  const at = journal.findIndex((e) => e.snapshotId === snapshot.snapshotId);
  const current = at >= 0 ? journal[at] : undefined;
  const previous = at > 0 ? journal[at - 1] : undefined;
  const comparison = current && previous ? compareSnapshots(previous, current) : null;
  return {
    cards: [
      { id: 'size', label: EVOLUTION_CARD_SIZE, icon: 'file', value: sumEvidence(files.map((f) => f.lines)), unit: ' lines', caption: EVOLUTION_CARD_SIZE_CAPTION, tone: 'accent' },
      { id: 'window', label: EVOLUTION_CARD_WINDOW, icon: 'git-branch', value: collected(window, 'setting'), unit: ' days', caption: EVOLUTION_CARD_WINDOW_CAPTION, tone: 'accent' },
      { id: 'snapshots', label: EVOLUTION_CARD_SNAPSHOTS, icon: 'arrow-up-down', value: collected(journal.length, 'session'), unit: '', caption: EVOLUTION_CARD_SNAPSHOTS_CAPTION, tone: 'accent' },
      changedCard(comparison),
    ],
    activity: toPoints(sampleActivity(snapshot.repositoryId, window)),
    coverage,
    coupling: sampleCoupling(filesByPriority(files), COUPLING_ROWS).map((p) => ({ a: p.a, b: p.b, rate: sample(p.rate), shared: sample(p.shared) })),
    journal: [...journal].reverse(),
    comparison,
    usesSample: true,
  };
}
```

  `toPoints` captures `labels`, so it stays local; that is compatible with `consistent-function-scoping`.

```ts
// read-models/ownership.ts — Part 3 Q11: module stewardship only. There is no field for
// a person anywhere in this model; teams and concentration are sample.
import { collected, countEvidence, sample, type MetricValue } from '../evidence';
import { metricColumns, toCsv, type CsvColumn } from '../export/csv';
import { sampleStewardship } from '../fixtures/sample-stewardship';
import { OWNERSHIP_ACTION_BODY, OWNERSHIP_ACTION_TITLE, SAMPLE_TEAM_LABELS } from '../inspector-copy';
import { MAX_GRAPH_MODULES } from './architecture';
import { moduleLabel, type FileSummary } from './file-summaries';
import { HOTSPOT_THRESHOLD } from './overview';

export const CONCENTRATION_WARNING = 70;
export interface StewardshipRow { module: string; label: string; team: MetricValue<string>; files: MetricValue; concentration: MetricValue; reviewCandidates: MetricValue }
export interface StewardshipAction { intent: 'pairing' | 'tests' | 'documentation'; module: string; label: string; title: string; body: string }
export interface OwnershipModel { rows: readonly StewardshipRow[]; hiddenModules: number; actions: readonly StewardshipAction[]; usesSample: true }

const INTENTS = ['pairing', 'tests', 'documentation'] as const;
const byConcentration = (a: StewardshipRow, b: StewardshipRow): number =>
  (b.concentration.value ?? 0) - (a.concentration.value ?? 0) || a.label.localeCompare(b.label);

export function buildOwnershipModel(files: readonly FileSummary[]): OwnershipModel {
  const groups = new Map<string, FileSummary[]>();
  for (const f of files) {
    const g = groups.get(f.module);
    if (g) g.push(f); else groups.set(f.module, [f]);
  }
  const all = [...groups.entries()].map(([module, fs]): StewardshipRow => {
    const s = sampleStewardship(module);
    return {
      module, label: moduleLabel(module),
      team: sample(SAMPLE_TEAM_LABELS[s.teamIndex] ?? ''),
      files: collected(fs.length, 'inventory'),
      concentration: sample(s.concentration),
      reviewCandidates: countEvidence(fs.map((f) => f.priority), (v) => v >= HOTSPOT_THRESHOLD),
    };
  }).sort((a, b) => (b.files.value ?? 0) - (a.files.value ?? 0) || a.label.localeCompare(b.label));
  const rows = all.slice(0, MAX_GRAPH_MODULES);
  return {
    rows,
    hiddenModules: Math.max(0, all.length - MAX_GRAPH_MODULES),
    actions: [...rows].sort(byConcentration).slice(0, 3).map((r, i) => {
      const intent = INTENTS[i] ?? 'pairing';
      return { intent, module: r.module, label: r.label, title: OWNERSHIP_ACTION_TITLE[intent](r.label), body: OWNERSHIP_ACTION_BODY[intent] };
    }),
    usesSample: true,
  };
}

const COLUMNS: readonly CsvColumn<StewardshipRow>[] = [
  { header: 'module', value: (r) => r.label },
  ...metricColumns<StewardshipRow>('team', (r) => r.team),
  ...metricColumns<StewardshipRow>('files', (r) => r.files),
  ...metricColumns<StewardshipRow>('concentration_pct', (r) => r.concentration),
  ...metricColumns<StewardshipRow>('review_candidates', (r) => r.reviewCandidates),
];

export function stewardshipCsv(rows: readonly StewardshipRow[]): string {
  return toCsv(COLUMNS, rows);
}
```

  Check that the icons `git-branch`, `arrow-up-down` and `git-compare` render. Replace any that does not, and report it.
- [ ] **Step 7: `use-read-models.ts`.**
  - Export `evolutionModelFor(snapshot, files, journal, window)`, memoized in a WeakMap on the files array, storing `{ snapshot, journal, window, model }`. The journal's `entries` array is reassigned on every `record`, so its identity is a valid key.
  - Add `ownershipModelFor(files)`, memoized per files array.
  - Expose `ownership = computed(() => ownershipModelFor(files.value))`.
- [ ] **Step 8: Run and confirm they pass.** `npx vitest run tests/unit/evolution-ownership-model.test.ts tests/unit/read-models.test.ts tests/component/overview-screen.test.ts`, then the gate.
- [ ] **Step 9: Commit.** `feat(ui): evolution model on the session journal; ownership model at module level`

---

### Screen-task conventions (Tasks 8–13)

Every screen task follows the same pattern:

- **The screen follows `HotspotsScreen.vue`.**
  - Root: `<div ref="root" class="ci-screen ci-screen--<route>">`.
  - `PageHeader` with the actions slot.
  - `<NoSnapshot v-if="!store.snapshot" />`.
  - Cards: `<div class="ci-overview__cards">` with `MetricCard`s.
  - Two-column panels: `ci-overview__grid`.
  - A `role="status"` live region (`class="visually-hidden"`) for outcomes: exported, added, failed.
- **Outlet.** `App.vue` gains one `v-else-if="store.route === '<route>'"` branch, before `PlaceholderScreen`.
- **Provenance.** `use-route-provenance.ts` gains one `case`.
- **Shell provenance test.** `tests/component/shell-provenance.test.ts` adds the route to its `for` list, which asserts "Includes sample data".
- **Selection** always goes through `store.select(id)`. Opening File detail is `store.select(id); store.navigate('file')`. Nothing moves the camera.
- **Export.** `downloadText(root.value, FILENAME, csv)`. On a throw, set the live region to `EXPORT_FAILED`.
- **Work items** go through `review.addWorkItem(target, intent, title, new Date())`. A rejection sets the task's `*_FAILED` string in the live region. The control shows the "added" label when `review.hasWorkItem(target, intent)`, and is disabled while `review.isPending(target, intent)`.
- **CSS.**
  - New rules go in `src/ui/styles/screens.css` (kit parts in `kit.css`), under `:where(.codebase-inspector-root)`.
  - Colours come from the existing tokens: `--ci-tone-danger`, `--ci-tone-warning`, `--ci-tone-success`, the accent tone used by `.ci-line-chart__line--accent`, `--ci-text-muted`, `--ci-text-faint`, `--ci-border`, `--ci-panel`, `--ci-sample`.
  - Reuse `.ci-chip`, `.ci-file-cell`, `.ci-hotspots__note`, `.ci-finding__severity--*`.
  - Grid layouts collapse to one column in the same container query `.ci-overview__grid` uses.
- **Component tests.**
  - Pattern: `tests/component/hotspots-screen.test.ts` (`setActivePinia(createPinia())`, `buildSnapshotFixture`, `setCity(snap, computeLayout(snap))`, `mount(..., { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } })`, `w.unmount()`).
  - Mock the download: `vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }))`.
  - Any test that opens a `CiDialog` imports `'../mocks/obsidian'`.

---

### Task 8: Code quality screen, Finding review dialog, and File-detail findings that open it

**Files:**
- Create: `src/ui/screens/QualityScreen.vue`, `src/ui/screens/quality/FindingFilters.vue`, `src/ui/screens/quality/FindingsTable.vue`, `src/ui/screens/quality/FindingReviewDialog.vue`
- Modify: `src/ui/screens/file/FileFindingsPanel.vue`, `src/ui/screens/FileDetailScreen.vue`, `src/ui/App.vue`, `src/ui/shell/use-route-provenance.ts`, `src/ui/styles/screens.css`
- Test: `tests/component/quality-screen.test.ts` (new), `tests/component/file-detail-screen.test.ts`, `tests/component/shell-provenance.test.ts`

**Interfaces:**
- Consumes: `quality` from `useReadModels()`, `filterFindings`, `findingsCsv`, `DEFAULT_QUALITY_FILTER`, `FINDINGS_PAGE`, `SEVERITY_RANK` (Task 4); `acknowledge`, `dismiss`, `reopen`, `dispositionFor`, `isDispositionPending`, `addWorkItemForFile`, `hasWorkItemFor`, `isPendingFor`, `DISMISS_REASON_MAX` (Task 2).
- Produces:
  - `FindingReviewDialog.vue`: props `{ fingerprint: string }`; emits `close: []`, `openFile: [id: EntityId]`, `announce: [message: string]`. The dialog looks the finding up in `quality.value.byFingerprint`, so its status updates live after a decision.
  - `FileFindingsPanel.vue`: props `{ findings: readonly FileFinding[]; count: MetricValue; statuses: ReadonlyMap<string, QualityFinding> }`; emits `review: [fingerprint: string]`.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/quality-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(files = 60, directories = 3) {
  const snap = buildSnapshotFixture({ files, directories });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountQ = () => mount(QualityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
const flush = async () => { await Promise.resolve(); await nextTick(); await nextTick(); };

describe('QualityScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('asks for a codebase without a snapshot', () => {
    const w = mountQ();
    expect(w.text()).toContain('No snapshot yet');
    w.unmount();
  });

  it('shows four sample cards and the open findings, 100 at a time', async () => {
    withSnapshot(400, 4);
    const w = mountQ();
    expect(w.findAll('.ci-metric-card')).toHaveLength(4);
    expect(w.findAll('.ci-table__row')).toHaveLength(100);
    await w.find('.ci-findings-table__more').trigger('click');
    expect(w.findAll('.ci-table__row')).toHaveLength(200);
    w.unmount();
  });

  it('filters by module; no match offers a reset that restores the rows', async () => {
    withSnapshot();
    const w = mountQ();
    await w.find('.ci-finding-filters__module').setValue('dir-1');
    expect(w.findAll('.ci-table__row').every((r) => r.text().includes('dir-1'))).toBe(true);
    await w.find('.ci-finding-filters__query').setValue('no-such-thing');
    expect(w.text()).toContain('No findings match these filters');
    await w.find('.ci-findings-table__reset').trigger('click');
    expect(w.findAll('.ci-table__row').length).toBeGreaterThan(0);
    w.unmount();
  });

  it('acknowledging moves the finding out of the Open list; closing lands focus on a row, never the body', async () => {
    withSnapshot();
    const w = mountQ();
    const first = w.findAll('.ci-table__row')[0]!;
    (first.element as HTMLElement).focus();
    await first.trigger('click');
    const dialog = w.find('.ci-finding-dialog');
    expect(dialog.exists()).toBe(true);
    await w.find('.ci-finding-dialog__acknowledge').trigger('click');
    await flush();
    expect(useReviewStore().dispositions).toHaveLength(1);
    expect(w.find('.ci-finding-dialog__reopen').exists()).toBe(true);
    await w.find('.ci-finding-dialog__close').trigger('click');
    await flush();
    expect(document.activeElement?.classList.contains('ci-table__row')).toBe(true);
    w.unmount();
  });

  it('dismiss requires a reason; with one, the decision and reason are stored', async () => {
    withSnapshot();
    const w = mountQ();
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    await w.find('.ci-finding-dialog__dismiss').trigger('click');
    await w.find('.ci-finding-dialog__save-dismissal').trigger('click');
    await flush();
    expect(w.find('.ci-finding-dialog__error').text()).toBe('Enter a reason before dismissing the finding.');
    expect(useReviewStore().dispositions).toHaveLength(0);
    await w.find('.ci-finding-dialog textarea').setValue('Exported for the plugin API');
    await w.find('.ci-finding-dialog__save-dismissal').trigger('click');
    await flush();
    expect(useReviewStore().dispositions[0]).toMatchObject({ status: 'dismissed', reason: 'Exported for the plugin API' });
    w.unmount();
  });

  it('reopen removes the decision; add work item records a refactor item for the file', async () => {
    withSnapshot();
    const w = mountQ();
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    await w.find('.ci-finding-dialog__acknowledge').trigger('click');
    await flush();
    await w.find('.ci-finding-dialog__reopen').trigger('click');
    await flush();
    expect(useReviewStore().dispositions).toHaveLength(0);
    await w.find('.ci-finding-dialog__work-item').trigger('click');
    await flush();
    expect(useReviewStore().workItemCount).toBe(1);
    w.unmount();
  });

  it('exports the filtered findings through the leaf document', async () => {
    withSnapshot();
    const w = mountQ();
    await w.find('.ci-quality__export').trigger('click');
    expect(downloadText).toHaveBeenCalledOnce();
    const [host, name, text] = vi.mocked(downloadText).mock.calls[0]!;
    expect((host as HTMLElement).classList.contains('ci-screen--quality')).toBe(true);
    expect(name).toBe('codebase-quality-findings.csv');
    expect(text).toContain('id,path,module,kind,severity,line,line_state,status,reason,provenance');
    w.unmount();
  });
});
```

  In `tests/component/file-detail-screen.test.ts`, add a test:
  - select a file that has findings;
  - click the first `.ci-finding__review` button;
  - assert that `.ci-finding-dialog` exists and that its text contains that finding's id.

  In `tests/component/shell-provenance.test.ts`, add `'quality'` to the route list.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/quality-screen.test.ts tests/component/file-detail-screen.test.ts tests/component/shell-provenance.test.ts`
- [ ] **Step 3: `FindingFilters.vue`.**
  - Takes `defineModel<QualityFilter>('filter', { required: true })` and `modules: readonly {name,label}[]`; emits `reset`.
  - Renders, in order:
    - a search `<input class="ci-finding-filters__query">` (placeholder and aria-label `QUALITY_FILTER_QUERY`);
    - four `<select class="dropdown">` controls, classes `ci-finding-filters__kind|severity|module|status`, each with a visually hidden `<label :for>` whose id comes from `useUniqueId('ci-finding-filters')`. Options: "All …" = `null` (status: `'all'` = `QUALITY_ALL_STATUSES`), then `FINDING_KIND_LABEL`, `SEVERITY_LABEL`, the modules, `FINDING_STATUS_LABEL`;
    - a Reset button (`QUALITY_RESET`, icon `rotate-ccw`).
  - Each control writes a **new** object (`filter.value = { ...filter.value, kind: v }`), so the parent's watch sees the change.
- [ ] **Step 4: `FindingsTable.vue`.** It is an `EvidenceTable<QualityFinding>`:
  - Columns:
    - `severity` (sortValue `SEVERITY_RANK[r.severity]`)
    - `finding` (title, then `<code>` id)
    - `location` (sortValue `r.file.path`; shows `.ci-file-cell` name + `QUALITY_LOCATION(r.line, r.moduleLabel)`)
    - `evidence` (a `.ci-chip` with `FINDING_KIND_LABEL`, plus `<ProvenanceBadge state="sample" />`)
    - `status` (a chip `ci-chip ci-chip--status-<status>` with `FINDING_STATUS_LABEL`; a dismissed row also shows the reason truncated through CSS `text-overflow`)
  - `initial-sort` is severity ascending, and the table uses `:limit`.
  - Emits `open: [finding: QualityFinding]` from `@activate`, plus `more` and `reset`.
  - The footer holds `QUALITY_SHOWING(Math.min(limit, rows.length), rows.length)`, then a `.ci-findings-table__more` button (`SHOW_MORE(n)`) when `rows.length > limit`.
  - With `rows.length === 0`, it renders `.ci-findings-table__empty` with `QUALITY_NO_MATCH_TITLE`, `QUALITY_NO_MATCH` and a `.ci-findings-table__reset` button (`RESET_FILTERS`) that emits `reset`.
  - Every row's accessible name comes from an `aria-label` on the `tr`? **No:** EvidenceTable owns the `tr`. The cell text already reads "severity, title, file, status", which is enough; do not add one.
- [ ] **Step 5: `FindingReviewDialog.vue`.** Use `RuleEditor.vue` as the dialog pattern:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import { useReadModels } from '../../read-models/use-read-models';
import { useReviewStore } from '../../stores/review-store';
import { DISMISS_REASON_MAX } from '../../stores/ports/review-repository';
import { useUniqueId } from '../../unique-id';
import {
  DIALOG_CLOSE, FINDING_ACKNOWLEDGE, FINDING_ACKNOWLEDGED, FINDING_ADD_WORK_ITEM, FINDING_DECISION_FAILED, FINDING_DIALOG_CONFIDENCE,
  FINDING_DIALOG_CONFIDENCE_VALUE, FINDING_DIALOG_LOCATION, FINDING_DIALOG_PROVIDER, FINDING_DIALOG_PROVIDER_VALUE,
  FINDING_DIALOG_REASON, FINDING_DIALOG_TITLE, FINDING_DISMISS, FINDING_DISMISS_CANCEL, FINDING_DISMISS_HINT,
  FINDING_DISMISS_PLACEHOLDER, FINDING_DISMISS_REASON, FINDING_DISMISS_REQUIRED, FINDING_DISMISS_SAVE, FINDING_DISMISS_TITLE,
  FINDING_DISMISS_TOO_LONG, FINDING_DISMISSED, FINDING_IN_PLAN, FINDING_OPEN_FILE, FINDING_REOPEN, FINDING_REOPENED,
  FINDING_STATUS_LABEL, QUALITY_LOCATION, SEVERITY_LABEL, WORK_ITEM_TITLE,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

const props = defineProps<{ fingerprint: string }>();
const emit = defineEmits<{ close: []; openFile: [id: EntityId]; announce: [message: string] }>();
const { quality } = useReadModels();
const review = useReviewStore();
const base = useUniqueId('ci-finding-dialog');
const finding = computed(() => quality.value.byFingerprint.get(props.fingerprint) ?? null);
const dismissing = ref(false);
const reason = ref('');
const error = ref('');
const busy = computed(() => review.isDispositionPending(props.fingerprint));

/** Records a decision only; no repository suppression is ever written (Q3). */
async function run(action: () => Promise<unknown>, done: string): Promise<void> {
  error.value = '';
  try {
    await action();
    emit('announce', done);
  } catch {
    error.value = FINDING_DECISION_FAILED;
  }
}
const acknowledge = () => run(() => review.acknowledge(props.fingerprint, new Date()), FINDING_ACKNOWLEDGED);
const reopen = () => run(() => review.reopen(props.fingerprint), FINDING_REOPENED);
async function saveDismissal(): Promise<void> {
  const trimmed = reason.value.trim();
  if (trimmed === '') { error.value = FINDING_DISMISS_REQUIRED; return; }
  if (trimmed.length > DISMISS_REASON_MAX) { error.value = FINDING_DISMISS_TOO_LONG(DISMISS_REASON_MAX); return; }
  await run(() => review.dismiss(props.fingerprint, trimmed, new Date()), FINDING_DISMISSED);
  if (!error.value) { dismissing.value = false; reason.value = ''; }
}
async function addWorkItem(): Promise<void> {
  const f = finding.value;
  if (f) await run(() => review.addWorkItemForFile(f.file.id, WORK_ITEM_TITLE(f.file.name), new Date()), FINDING_IN_PLAN);
}
</script>
```

  Template:
  - `<CiDialog :label="FINDING_DIALOG_TITLE" @close="emit('close')">`, wrapping `<div class="ci-finding-dialog">`, only when `finding` exists.
  - `h3` title plus `<code>{{ finding.id }}</code>`.
  - The severity chip (`ci-finding__severity--<sev>`), the status chip, and a `ProvenanceBadge state="sample"`.
  - `finding.title`.
  - A `<dl>`:
    - Location: `finding.file.path` · `QUALITY_LOCATION(line, moduleLabel)`
    - Provider: `FINDING_DIALOG_PROVIDER_VALUE`
    - Confidence: `FINDING_DIALOG_CONFIDENCE_VALUE`
    - Disposition note: `finding.reason`, when set
  - Buttons:
    - `.ci-finding-dialog__open-file` (`FINDING_OPEN_FILE`, `emit('openFile', finding.file.id)`)
    - `.ci-finding-dialog__work-item` (`FINDING_ADD_WORK_ITEM`, or `FINDING_IN_PLAN` and disabled when `review.hasWorkItemFor(finding.file.id)`; also disabled while `review.isPendingFor(...)`)
  - When `dismissing`, a `<form @submit.prevent="saveDismissal">` with:
    - `h4` (`FINDING_DISMISS_TITLE`) and a hint;
    - `<label :for="`${base}-reason`">`, then a `<textarea :id :maxlength="DISMISS_REASON_MAX" :placeholder>`;
    - `.ci-finding-dialog__save-dismissal` (type submit, `mod-cta`) and a Cancel button.
  - Otherwise, a footer with:
    - `.ci-finding-dialog__dismiss` (`FINDING_DISMISS`, shown unless the status is `dismissed`);
    - `.ci-finding-dialog__acknowledge` when the status is `open`, or `.ci-finding-dialog__reopen` otherwise;
    - `.ci-finding-dialog__close` (`DIALOG_CLOSE`).
    - All disabled while `busy`.
  - `<p v-if="error" class="ci-finding-dialog__error" role="alert">`.
  - Opening the dismissal form focuses its textarea through `nextTick` and a template ref.
  - Line budget: about 170 lines. If it goes over 250, move the dismissal form into `quality/DismissalForm.vue`.
- [ ] **Step 6: `QualityScreen.vue`.**
  - State:
    - `filter = ref<QualityFilter>({ ...DEFAULT_QUALITY_FILTER })`, `shown = ref(FINDINGS_PAGE)`
    - `reviewing = ref<string | null>(null)` (a fingerprint), `openedIndex = ref(0)`, `liveMessage`, `root`
  - Computed: `rows = computed(() => filterFindings(quality.value.findings, filter.value))`.
  - `watch(filter, () => { shown.value = FINDINGS_PAGE; })`, plus the Hotspots F3 guard: if the filtered module disappears from `quality.modules`, reset it to `null`.
  - `open(finding)` sets `reviewing = finding.fingerprint` and records `openedIndex` as the position of `root.ownerDocument.activeElement` among the `.ci-table__row` elements, falling back to 0. Clicking a `tabindex="0"` row focuses it in a browser.
  - The close handler:

```ts
/** The row that opened the dialog may have left the filtered list (an Open finding that
 *  was just acknowledged). CiDialog restores focus to it when it is still there;
 *  otherwise land on the row now at the same place, the last row, or the panel — never
 *  the body (Part 2 F7 pattern). */
async function closeReview(): Promise<void> {
  reviewing.value = null;
  await nextTick();
  const el = root.value;
  const active = el?.ownerDocument.activeElement;
  if (!el || (active && el.contains(active))) return;   // CiDialog already restored focus inside the screen
  const rowsEl = [...el.querySelectorAll<HTMLElement>('.ci-table__row')];
  (rowsEl[Math.min(openedIndex.value, rowsEl.length - 1)] ?? el.querySelector<HTMLElement>('.ci-findings-table__reset') ?? el.querySelector<HTMLElement>('.ci-quality__panel'))?.focus();
}
```

  CiDialog's own fallback focuses `.ci-shell`, which is outside the screen, so the guard lets this function take over. The panel wrapper `.ci-quality__panel` gets `tabindex="-1"`.
  - `openFile(id)`: `reviewing.value = null; store.select(id); store.navigate('file')`.
  - `exportCsv()`: `downloadText(root.value, QUALITY_CSV_FILENAME, findingsCsv(rows.value))`.
  - Template:
    - header: eyebrow, title, subtitle; the Export button `.ci-quality__export` with icon `download`, disabled when `rows.length === 0`;
    - `NoSnapshot`, then the cards;
    - `<section class="ci-quality__panel" tabindex="-1">` with `FindingFilters` and `FindingsTable`;
    - a `<p class="ci-hotspots__note">` with `QUALITY_FOOTNOTE`;
    - `<FindingReviewDialog v-if="reviewing" :fingerprint="reviewing" @close="closeReview" @open-file="openFile" @announce="liveMessage = $event" />`.
- [ ] **Step 7: File detail.**
  - **`FileFindingsPanel.vue`:**
    - Drop the P13 comment.
    - Each `li` now holds a `<button type="button" class="ci-finding__review" @click="emit('review', f.fingerprint)">` wrapping the existing head, title and meta.
    - Add a status chip after the severity (`FINDING_STATUS_LABEL[statuses.get(f.fingerprint)?.status ?? 'open']`).
    - Add `:key="f.fingerprint"`.
  - **`FileDetailScreen.vue`:**
    - Pull `quality` from `useReadModels()`.
    - Pass `:statuses="quality.byFingerprint"`.
    - Hold `reviewing = ref<string | null>(null)` and render `FindingReviewDialog`. Its `openFile` just closes it, since this is already that file's detail. `announce` sets `liveMessage`.
  - Existing tests that asserted the rows are not interactive: update them and list them in your report.
- [ ] **Step 8: Wire the route.**
  - `App.vue`: `<QualityScreen v-else-if="store.route === 'quality'" />`.
  - `use-route-provenance.ts`: pull `quality` from `useReadModels()` and add `case 'quality': return quality.value.usesSample;`.
- [ ] **Step 9: CSS.** Add rules for:
  - `.ci-finding-filters`: a flex row that wraps, `gap: var(--ci-space-2)`, with the Reset button pushed to the end;
  - `.ci-findings-table__footer` and `.ci-findings-table__empty`;
  - `.ci-chip--status-open|acknowledged|dismissed`: accent, success and muted tones;
  - `.ci-finding-dialog` (`display: grid; gap: var(--ci-space-3); max-width: 36em`) and `.ci-finding-dialog__meta` (a two-column `dl`);
  - `.ci-finding-dialog__actions`: flex, end-aligned;
  - `.ci-finding__review`: a reset button that fills the `li`, left-aligned, `cursor: pointer`, keeping a visible focus outline through `--ci-focus`.

  Every `var(--font-ui-*)` carries its em fallback.
- [ ] **Step 10: Run and confirm they pass.** `npx vitest run tests/component/quality-screen.test.ts tests/component/file-detail-screen.test.ts tests/component/shell-provenance.test.ts tests/component/workspace-shell.test.ts tests/unit/kit-css-fallbacks.test.ts`, then the gate.
- [ ] **Step 11: Commit.** `feat(ui): Code quality screen with the Finding review dialog; File-detail findings open it`

---

### Task 9: Test confidence screen, the MeterList kit part, and the shared evidence dialog

**Files:**
- Create: `src/ui/screens/TestsScreen.vue`, `src/ui/screens/tests/{CoverageMap,CoverageGapsTable,TestRunsTable}.vue`, `src/ui/screens/shared/{UnknownEvidenceState,EvidenceSourceDialog}.vue`, `src/ui/kit/MeterList.vue`
- Modify: `src/ui/kit/Tabs.vue` (`data-tab-id`), `src/ui/audit-copy/shared.ts`, `src/ui/App.vue`, `src/ui/shell/use-route-provenance.ts`, `src/ui/styles/{kit,screens}.css`
- Test: `tests/component/tests-screen.test.ts` (new), `tests/component/shell-provenance.test.ts`

**Interfaces:**
- Consumes: `testConfidence` from `useReadModels()`, `coverageTiles`, `gapsCsv`, `MAX_TILES` (Task 5); `addWorkItem`, `hasWorkItem`, `isPending` (Task 2).
- Produces:
  - `kit/MeterList.vue`: props `{ items: readonly MeterItem[]; label: string }`, where `interface MeterItem { id: string; label: string; value: MetricValue; tone?: 'success' | 'warning' | 'danger' | 'accent'; ariaLabel: string }`. Export `MeterItem` from `kit/meter-types.ts`.
  - `shared/UnknownEvidenceState.vue`: props `{ title: string; body: string; icon?: string }`, plus a default slot for an action.
  - `shared/EvidenceSourceDialog.vue`: props `{ title: string; rows: readonly EvidenceSourceRow[] }`; emits `close`. `interface EvidenceSourceRow { label: string; state: EvidenceState; source: string }` lives in `screens/shared/evidence-source.ts`.
  - `Tabs.vue`: each tab button gets `:data-tab-id="t.id"`.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/tests-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import TestsScreen from '../../src/ui/screens/TestsScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(files = 60, testFiles = 0) {
  const snap = buildSnapshotFixture({ files, directories: 3, testFiles });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountT = () => mount(TestsScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
const tab = (w: ReturnType<typeof mountT>, id: string) => w.find(`[role="tab"][data-tab-id="${id}"]`);

describe('TestsScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('mutation is shown as not collected, never as 0', () => {
    withSnapshot();
    const w = mountT();
    const card = w.findAll('.ci-metric-card').find((c) => c.text().includes('Mutation score'))!;
    expect(card.text()).toContain('—');
    expect(card.text()).toContain('Not collected');
    expect(card.text()).not.toMatch(/\b0\b/);
    w.unmount();
  });

  it('one tile per file (capped), a single tab stop, arrows move it, Enter selects without navigating', async () => {
    withSnapshot(30);
    const store = useCityStore();
    store.navigate('tests');
    const w = mountT();
    const tiles = () => w.findAll('.ci-coverage-map__tile');
    expect(tiles()).toHaveLength(30);
    expect(tiles().filter((t) => t.attributes('tabindex') === '0')).toHaveLength(1);
    await w.find('.ci-coverage-map').trigger('keydown', { key: 'ArrowRight' });
    await nextTick();
    expect(tiles()[1]!.attributes('tabindex')).toBe('0');
    await w.find('.ci-coverage-map').trigger('keydown', { key: 'Enter' });
    expect(store.selectedEntityId).toBe(tiles()[1]!.attributes('data-entity-id'));
    expect(store.route).toBe('tests');
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('module bars are labelled sample; the gaps table plans tests as a work item', async () => {
    withSnapshot(80);
    const w = mountT();
    expect(w.findAll('.ci-meter').every((m) => (m.attributes('aria-label') ?? '').includes('sample'))).toBe(true);
    await w.find('.ci-coverage-gaps__plan').trigger('click');
    await Promise.resolve(); await nextTick();
    const item = useReviewStore().workItems[0]!;
    expect(item.intent).toBe('tests');
    expect(item.target.kind).toBe('file');
    w.unmount();
  });

  it('test results: real test files only, or an empty state; mutation tab explains the unknown', async () => {
    withSnapshot(20, 3);
    const w = mountT();
    await tab(w, 'results').trigger('click');
    expect(w.findAll('.ci-table__row')).toHaveLength(3);
    await tab(w, 'mutation').trigger('click');
    expect(w.text()).toContain('The strength of your assertions is unknown.');
    w.unmount();
    setActivePinia(createPinia());
    withSnapshot(20, 0);
    const w2 = mountT();
    await tab(w2, 'results').trigger('click');
    expect(w2.text()).toContain('No test files in this inventory');
    w2.unmount();
  });

  it('the evidence dialog lists each signal and its state; export sends every gap', async () => {
    withSnapshot(80);
    const w = mountT();
    await w.find('.ci-tests__evidence').trigger('click');
    expect(w.find('.ci-evidence-dialog').text()).toContain('Mutation testing');
    await w.find('.ci-evidence-dialog__close').trigger('click');
    await w.find('.ci-tests__export').trigger('click');
    const [, name, text] = vi.mocked(downloadText).mock.calls[0]!;
    expect(name).toBe('branch-coverage-gaps.csv');
    expect(text.split('\r\n').length).toBeGreaterThan(2);
    w.unmount();
  });
});
```

  Add `'tests'` to the route list in `tests/component/shell-provenance.test.ts`.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/tests-screen.test.ts`
- [ ] **Step 3: Kit and shared parts.**
  - **`Tabs.vue`:** add `:data-tab-id="t.id"` to the tab button. Nothing else changes.
  - **`kit/MeterList.vue`:** a `<ul class="ci-meters" :aria-label="label">`. Each `<li class="ci-meter" :aria-label="item.ariaLabel">` holds:
    - the label;
    - a `div.ci-meter__track` (`aria-hidden="true"`), whose `div.ci-meter__fill` has `ci-meter__fill--<tone>` and `:style="{ inlineSize: `${Math.max(0, Math.min(100, item.value.value ?? 0))}%` }"`, rendered **only when `hasValue(item.value)`**;
    - `formatMetric(item.value, '%')`;
    - a `ProvenanceBadge` when the state is not `collected`.

    An unknown value shows "—" and no bar, never an empty bar that reads as 0. The inline style is a runtime width, which `obsidianmd` allows through a Vue `:style` binding; if the lint rule objects, set the width through a CSS custom property (`:style="{ '--ci-meter': … }"`) and report it.
  - **`screens/shared/UnknownEvidenceState.vue`:** a centred block (`.ci-unknown-state`) with `Icon` (default `search`), `h3` title, `p` body and `<slot />`.
  - **`screens/shared/evidence-source.ts`:** the `EvidenceSourceRow` type.
  - **`screens/shared/EvidenceSourceDialog.vue`:** a `CiDialog` wrapping `.ci-evidence-dialog`, with:
    - an `h3` title;
    - a `ul`, one row per source: label, `ProvenanceBadge :state`, source text;
    - `p` `EVIDENCE_DIALOG_READ_ONLY`;
    - `.ci-evidence-dialog__close` (`DIALOG_CLOSE`).
  - Add to `audit-copy/shared.ts`:

```ts
export const EVIDENCE_DIALOG_READ_ONLY = 'For these signals the inspector reads no source content and runs no tools. Sample values come from deterministic fixtures and are labelled everywhere they appear.';
export const EVIDENCE_SOURCE_SAMPLE = 'Sample provider';
export const EVIDENCE_SOURCE_NONE = 'Not collected';
export const EVIDENCE_SOURCE_INVENTORY = 'Built-in scan';
```

  - Add to `audit-copy/tests.ts`: `export const TESTS_SOURCES_TITLE = 'Coverage evidence';` and `export const TESTS_SOURCE_LABELS = { coverage: 'Branch coverage', runs: 'Test runs', mutation: 'Mutation testing' } as const;`.
- [ ] **Step 4: `tests/CoverageMap.vue`.**
  - Props `{ tiles: readonly CoverageTile[]; selectedId: EntityId | null }`; emits `select: [id: EntityId]`.
  - A `div.ci-coverage-map` with `role="group"` and `:aria-label="TESTS_MAP_LABEL"`.
  - One `<button type="button" class="ci-coverage-map__tile ci-coverage-map__tile--<band>">` per tile, with:
    - `:data-entity-id`
    - `:aria-label="TESTS_TILE_LABEL(name, formatMetric(coverage,'%'))"`
    - `:aria-pressed`
    - a roving `:tabindex`
  - Copy `HotspotScatter.vue`'s roving logic exactly: the `active` ref and its watch, `onKeydown` (arrows, Home, End, Enter or Space), and focus through `nextTick` + `querySelectorAll('.ci-coverage-map__tile')[next]?.focus()`.
  - A legend `figcaption` from `COVERAGE_BAND_LABEL`.
- [ ] **Step 5: `tests/CoverageGapsTable.vue`.**
  - An EvidenceTable over the gaps, with `:limit` and "Show more" as in Hotspots. Columns:
    - file (`.ci-file-cell`)
    - `branches` ("covered / total" through `formatMetric`)
    - `coverage` (`%`)
    - `commits`
    - `actions`
  - The `actions` cell is a `.ci-coverage-gaps__plan` button with `@click.stop` and `@keydown.stop`, so the row does not also activate. Its label is `TESTS_PLAN` (or `TESTS_PLANNED`, disabled, when the item exists), with `aria-label` `TESTS_PLAN_LABEL(name)`.
  - Emits `plan: [file: FileSummary]` and `open: [id: EntityId]`.
  - Empty: `TESTS_GAPS_NONE`.
- [ ] **Step 6: `tests/TestRunsTable.vue`.**
  - An EvidenceTable over `runs`. Columns:
    - file (`.ci-file-cell`)
    - tests
    - result: a chip, `TESTS_RESULT_PASSING`, or `TESTS_RESULT_FAILING(n)` with the danger tone
    - module
    - duration: `TESTS_DURATION(ms)` with a `ProvenanceBadge state="sample"`
  - Row activation emits `open`.
  - Empty: `<UnknownEvidenceState :title="TESTS_RUNS_NONE" body="" />`, or a plain note.
- [ ] **Step 7: `TestsScreen.vue`.**
  - State: `tab = ref('map')`, `moduleFilter = ref<string | null>(null)`, `shown`, `evidenceOpen`, `liveMessage`, `root`.
  - `tiles = computed(() => coverageTiles(files.value, moduleFilter.value))`.
  - Header actions:
    - `.ci-tests__evidence` (icon `info`) opens `EvidenceSourceDialog` with these rows:
      - branch coverage: sample, `EVIDENCE_SOURCE_SAMPLE`
      - test runs: `sample` when `runs.length`, else `unknown`, with source `EVIDENCE_SOURCE_SAMPLE` or `EVIDENCE_SOURCE_NONE`
      - mutation: `unknown`, `EVIDENCE_SOURCE_NONE`
    - `.ci-tests__export` (icon `download`) calls `downloadText(root, TESTS_CSV_FILENAME, gapsCsv(model.gaps))`.
  - Cards come from `testConfidence.value.cards`.
  - `Tabs` with `[{id:'map',label:TESTS_TAB_MAP},{id:'results',…},{id:'mutation',…}]`:
    - **map:**
      - `ci-overview__grid`, holding:
        - Panel `TESTS_MAP_TITLE`, with a module select (`#actions` slot, visually hidden label, options from `moduleOptions`), `CoverageMap`, `TESTS_SHOWING` when `tiles.total > tiles.tiles.length`, and the selected-file strip copied from Hotspots (`role="status"` plus an Open detail button);
        - Panel `TESTS_MODULES_TITLE` with `MeterList`, whose items are the modules with `ariaLabel: TESTS_MODULE_BAR_LABEL(label, formatMetric(coverage,'%'))`, tone `warning` when the value is below 60, else `success`, plus `TESTS_MODULES_HIDDEN` when `hiddenModules > 0`.
      - Below the grid, Panel `TESTS_GAPS_TITLE` with `CoverageGapsTable`. Its `plan` handler calls `review.addWorkItem({ kind: 'file', entityId: f.id }, 'tests', TESTS_PLAN_TITLE(f.name), new Date())`.
    - **results:** Panel `TESTS_RUNS_TITLE`, subtitle `TESTS_RUNS_SUBTITLE(…)` from the results card's numbers, holding `TestRunsTable`.
    - **mutation:** Panel `MUTATION_TITLE`/`MUTATION_SUBTITLE`, holding `UnknownEvidenceState` (`MUTATION_EMPTY_TITLE`, `MUTATION_EMPTY`) with a button `CONFIGURE_EVIDENCE` → `store.navigate('sources')`.
  - Apply the F3 guard to `moduleFilter` when modules change.
  - Line budget: keep it under 300; the panels' inner markup already lives in the sub-components.
- [ ] **Step 8: Wire the route.**
  - `App.vue`: `<TestsScreen v-else-if="store.route === 'tests'" />`.
  - Provenance: `case 'tests': return testConfidence.value?.usesSample ?? false;`.
- [ ] **Step 9: CSS.** Add rules for:
  - `.ci-coverage-map`: a grid, `grid-template-columns: repeat(auto-fill, minmax(1.75em, 1fr))`, `gap: 4px`;
  - tiles: square (`aspect-ratio: 1`), `border-radius: var(--ci-radius-small)`, background `color-mix(in srgb, var(--ci-tone-<band>) 55%, transparent)` for low/mid/high (danger/warning/success), `--ci-text-faint` for unknown;
  - `[aria-pressed="true"]`: a 2px `--ci-focus` outline;
  - `.ci-meter`: a grid of label, track and value; track height 6px, `--ci-border` background, fill per tone;
  - `.ci-unknown-state`: centred, padded;
  - `.ci-evidence-dialog`: grid.

  MeterList styles go in `kit.css`.
- [ ] **Step 10: Run and confirm they pass.** `npx vitest run tests/component/tests-screen.test.ts tests/component/shell-provenance.test.ts tests/component/kit-interactive.test.ts tests/component/architecture-screen.test.ts tests/unit/kit-css-fallbacks.test.ts`, then the gate.
- [ ] **Step 11: Commit.** `feat(ui): Test confidence screen: coverage map, weighted module coverage, gaps, runs, unknown mutation`

---

### Task 10: Dependencies screen and the Package detail dialog

**Files:**
- Create: `src/ui/screens/DependenciesScreen.vue`, `src/ui/screens/dependencies/{PackageTable,DependencyPath,LicenseTable,PackageDetailDialog}.vue`
- Modify: `src/ui/App.vue`, `src/ui/shell/use-route-provenance.ts`, `src/ui/styles/screens.css`
- Test: `tests/component/dependencies-screen.test.ts` (new), `tests/component/shell-provenance.test.ts`

**Interfaces:**
- Consumes: `dependencies` from `useReadModels()`, `filterPackages`, `packagesCsv` (Task 6); `addWorkItem`, `hasWorkItem`, `isPending` (Task 2).
- Produces: `PackageDetailDialog.vue`, with props `{ pkg: SamplePackage }` and emits `close: []`, `announce: [message: string]`. Task 11 reuses it.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/dependencies-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import DependenciesScreen from '../../src/ui/screens/DependenciesScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 12, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountD = () => mount(DependenciesScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('DependenciesScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('labels the inventory fictional and says the manifest contents are not read', () => {
    withSnapshot();
    const w = mountD();
    expect(w.text()).toContain('Fictional packages, real review flow.');
    expect(w.text()).toContain('No package.json in this inventory.');
    expect(w.findAll('.ci-table__row')).toHaveLength(10);
    w.unmount();
  });

  it('filters by name and relationship; no match shows the empty state', async () => {
    withSnapshot();
    const w = mountD();
    await w.find('.ci-packages__filter').setValue('transitive');
    expect(w.findAll('.ci-table__row')).toHaveLength(2);
    await w.find('.ci-packages__query').setValue('zzz');
    expect(w.text()).toContain('No packages found');
    w.unmount();
  });

  it('a package dialog creates one review item keyed by package name', async () => {
    withSnapshot();
    const w = mountD();
    await w.findAll('.ci-table__row')[0]!.trigger('click');
    const dialog = w.find('.ci-package-dialog');
    expect(dialog.text()).toContain('This is not a real advisory.');
    await w.find('.ci-package-dialog__review').trigger('click');
    await Promise.resolve(); await nextTick();
    const item = useReviewStore().workItems[0]!;
    expect(item.target).toEqual({ kind: 'package', name: '@sample/document-parser' });
    expect(item.intent).toBe('review');
    expect(w.find('.ci-package-dialog__review').attributes('disabled')).toBeDefined();
    w.unmount();
  });

  it('shows the path and the licences tabs; export sends the inventory', async () => {
    withSnapshot();
    const w = mountD();
    await w.find('[role="tab"][data-tab-id="path"]').trigger('click');
    expect(w.findAll('.ci-dep-path__step')).toHaveLength(3);
    await w.find('[role="tab"][data-tab-id="licenses"]').trigger('click');
    expect(w.text()).toContain('Needs review');
    await w.find('.ci-dependencies__export').trigger('click');
    expect(vi.mocked(downloadText).mock.calls[0]![1]).toBe('sample-package-inventory.csv');
    w.unmount();
  });
});
```

  Add `'dependencies'` to the shell-provenance route list.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/dependencies-screen.test.ts`
- [ ] **Step 3: Components.**
  - **`PackageTable.vue`:**
    - Toolbar: a search input `.ci-packages__query` and a select `.ci-packages__filter` over `DEPS_FILTER_LABELS`, both `defineModel`s.
    - An EvidenceTable with these columns:
      - package: `<code>` name + `DEPS_REFERENCES(formatMetric(references))` + `ProvenanceBadge state="sample"`
      - installed (`<code>`)
      - relationship
      - license: `DEPS_LICENSE_UNRESOLVED` when null
      - status: a chip `ci-chip--dep-<status>`
    - Row activation emits `inspect: [pkg]`.
    - Footer `DEPS_COUNT(n)`; empty state `DEPS_NO_MATCH_TITLE` / `DEPS_NO_MATCH`.
  - **`DependencyPath.vue`:** props `{ rootLabel: string; path: readonly SamplePackage[] }`. An `ol.ci-dep-path` with three `li.ci-dep-path__step`: the root folder, then each package with its relationship label (`DEPS_PATH_DIRECT` / `DEPS_PATH_TRANSITIVE`), its version, and an `Inspect package` button emitting `inspect`. Arrows between steps are CSS (`::before` content `'→'`, `aria-hidden` by construction).
  - **`LicenseTable.vue`:** an EvidenceTable of licence, packages, and recorded status (`DEPS_RECORDED_REVIEW` for `needsReview`, else `DEPS_RECORDED_OK`). The rows are not activatable: pass no `@activate`.
  - **`PackageDetailDialog.vue`:** a `CiDialog` (`label` = the package name) wrapping `.ci-package-dialog`, containing:
    - `h3` name and subtitle `PACKAGE_DIALOG_SUBTITLE`;
    - chips: status, relationship, `PACKAGE_DEMO_BADGE`;
    - a `dl`: installed, target (`—` when null), license, references (sample);
    - if `pkg.advisory`: a `Callout tone="warning" :title="advisory.id"` holding `advisory.summary` and `PACKAGE_ADVISORY_UNKNOWN`;
    - else if the status is `unused`: `PACKAGE_UNUSED_NOTE`;
    - else: `PACKAGE_METADATA_NOTE`;
    - footer: `.ci-package-dialog__review` (`PACKAGE_CREATE_REVIEW`, or `PACKAGE_IN_REVIEW` when it exists; disabled when it exists or is pending) and `.ci-package-dialog__close`.

    Create the item with `review.addWorkItem({ kind: 'package', name: pkg.name }, 'review', PACKAGE_REVIEW_TITLE(pkg.name, pkg.advisory?.id ?? null), new Date())`. Emit `announce(PACKAGE_REVIEW_FAILED)` on a throw.
- [ ] **Step 4: `DependenciesScreen.vue`.**
  - Header: Export (`.ci-dependencies__export`) → `packagesCsv(filterPackages(...))`.
  - `Callout :title="DEPS_CALLOUT_TITLE" :badge="SAMPLE_BADGE_DETAIL"` with `DEPS_CALLOUT`.
  - A `.ci-manifests` block: `DEPS_MANIFESTS_TITLE`, then either a `ul` of `<code>` paths with `DEPS_MANIFESTS_NOTE`, or `DEPS_MANIFESTS_NONE`.
  - Cards.
  - `Tabs` (`inventory`, `path`, `licenses`) holding the three components.
  - Footnote `DEPS_FOOTNOTE`.
  - `<PackageDetailDialog v-if="inspecting" :pkg="inspecting" @close="inspecting = null" @announce="liveMessage = $event" />`.
- [ ] **Step 5: Wire the route.** `App.vue` branch for `'dependencies'`; provenance `case 'dependencies': return dependencies.value?.usesSample ?? false;`.
- [ ] **Step 6: CSS.** Add rules for:
  - `.ci-packages__toolbar`, `.ci-manifests`;
  - `.ci-dep-path`: a flex row that wraps into a column in a narrow container;
  - `.ci-chip--dep-review|update|unused|current`: warning, accent, warning and success tones;
  - `.ci-package-dialog`.
- [ ] **Step 7: Run and confirm they pass.** `npx vitest run tests/component/dependencies-screen.test.ts tests/component/shell-provenance.test.ts tests/unit/kit-css-fallbacks.test.ts`, then the gate.
- [ ] **Step 8: Commit.** `feat(ui): Dependencies screen over the fictional inventory, with manifest detection and package review items`

---

### Task 11: Security screen

**Files:**
- Create: `src/ui/screens/SecurityScreen.vue`, `src/ui/screens/security/{AdvisoryList,ReviewChecklist}.vue`
- Modify: `src/ui/App.vue`, `src/ui/shell/use-route-provenance.ts`, `src/ui/styles/screens.css`, `src/ui/audit-copy/security.ts`
- Test: `tests/component/security-screen.test.ts` (new), `tests/component/shell-provenance.test.ts`

**Interfaces:**
- Consumes: `security` from `useReadModels()`, `advisoriesCsv` (Task 6); `PackageDetailDialog` (Task 10); `UnknownEvidenceState` and `EvidenceSourceDialog` (Task 9).

- [ ] **Step 1: Write the failing tests.** Create `tests/component/security-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import SecurityScreen from '../../src/ui/screens/SecurityScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const VERDICTS = /\b(exploitable|not exploitable|vulnerable|safe|secure|confirmed exploit)\b/i;

function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 8 });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountS = () => mount(SecurityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('SecurityScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('shows the two demo advisories and no exploitability verdict anywhere', async () => {
    withSnapshot();
    const w = mountS();
    expect(w.findAll('.ci-advisory')).toHaveLength(2);
    for (const id of ['advisories', 'secrets', 'policy']) {
      await w.find(`[role="tab"][data-tab-id="${id}"]`).trigger('click');
      expect(w.text().replace('A detected pattern is not a confirmed exploit.', '')).not.toMatch(VERDICTS);
    }
    w.unmount();
  });

  it('secret candidates and runtime exploitability are unknown, never 0', async () => {
    withSnapshot();
    const w = mountS();
    for (const label of ['Secret-pattern candidates', 'Runtime exploitability']) {
      const card = w.findAll('.ci-metric-card').find((c) => c.text().includes(label))!;
      expect(card.text()).toContain('—');
    }
    await w.find('[role="tab"][data-tab-id="secrets"]').trigger('click');
    expect(w.text()).toContain('Secret candidates are unknown.');
    w.unmount();
  });

  it('an advisory opens the package dialog; the checklist is local and unsaved', async () => {
    withSnapshot();
    const w = mountS();
    await w.find('.ci-advisory__open').trigger('click');
    expect(w.find('.ci-package-dialog').exists()).toBe(true);
    await w.find('.ci-package-dialog__close').trigger('click');
    const box = w.find('.ci-checklist input[type="checkbox"]');
    await box.setValue(true);
    expect((box.element as HTMLInputElement).checked).toBe(true);
    expect(w.text()).toContain('Not saved.');
    w.unmount();
  });

  it('exports the advisories with reachability unknown', async () => {
    withSnapshot();
    const w = mountS();
    await w.find('.ci-security__export').trigger('click');
    const [, name, text] = vi.mocked(downloadText).mock.calls[0]!;
    expect(name).toBe('sample-security-review.csv');
    expect(text).toContain(',unknown,sample');
    w.unmount();
  });
});
```

  If a prototype string legitimately contains one of the verdict words (the subtitle contains "confirmed exploit" in the negative), strip it the way the test does, and report any other hit rather than weakening the regex. Add `'security'` to the shell-provenance route list.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/security-screen.test.ts`
- [ ] **Step 3: Components.**
  - **`AdvisoryList.vue`:** a `ul`, one `li.ci-advisory` per package, holding:
    - a `button.ci-advisory__open` (`aria-label` `SECURITY_ADVISORY_LABEL(id, name)`), which emits `inspect: [pkg]`;
    - inside the button: an `Icon` (`triangle-alert`), a `SECURITY_REVIEW_BADGE` chip, `<code>` advisory id, the name, `advisory.summary`, and `SECURITY_ADVISORY_VERSIONS(version, advisory.patched)`;
    - a `ProvenanceBadge state="sample"`.
  - **`ReviewChecklist.vue`:** a `ul.ci-checklist` of `SECURITY_CHECKLIST`. Each item is `<input type="checkbox" :id>` (ids from `useUniqueId`) with a `<label :for>`, and the local state is `ref<boolean[]>`. It is followed by a `Callout` (`SECURITY_NO_CONCLUSION`).
- [ ] **Step 4: `SecurityScreen.vue`.**
  - Header actions:
    - `.ci-security__sources` (icon `database`) opens `EvidenceSourceDialog` with these rows:
      - advisories: sample, `EVIDENCE_SOURCE_SAMPLE`
      - secret scanning: unknown, `EVIDENCE_SOURCE_NONE`
      - runtime exploitability: unknown, `EVIDENCE_SOURCE_NONE`

      Row labels go in `audit-copy/security.ts` as `SECURITY_SOURCE_LABELS = { advisories: 'Dependency advisories', secrets: 'Secret scanning', runtime: 'Runtime exploitability' } as const`, plus `SECURITY_SOURCES_TITLE = 'Security evidence sources'`.
    - `.ci-security__export` → `advisoriesCsv(security.advisories)`.
  - Cards.
  - `Tabs` (`advisories`, `secrets`, `policy`):
    - **advisories:** `ci-overview__grid` with Panel `SECURITY_ADVISORIES_TITLE` (holding `AdvisoryList`) and Panel `SECURITY_CHECKLIST_TITLE` (holding `ReviewChecklist`);
    - **secrets:** Panel `SECRETS_TITLE`/`SECRETS_SUBTITLE` holding `UnknownEvidenceState` (icon `lock`, `SECRETS_EMPTY_TITLE`, `SECRETS_EMPTY`) and a `CONFIGURE_EVIDENCE` button → `sources`;
    - **policy:** Panel `POLICY_TITLE` with a two-column `table` of `POLICY_ROWS`.
  - `PackageDetailDialog` for `inspecting`.
- [ ] **Step 5: Wire the route.** `App.vue` branch for `'security'`; provenance `case 'security': return security.value.usesSample;`.
- [ ] **Step 6: CSS.** Add rules for `.ci-advisory` (the button fills the `li`, as a grid of icon and body), `.ci-checklist`, and `.ci-policy`.
- [ ] **Step 7: Run and confirm they pass.** `npx vitest run tests/component/security-screen.test.ts tests/component/dependencies-screen.test.ts tests/component/shell-provenance.test.ts tests/unit/kit-css-fallbacks.test.ts`, then the gate.
- [ ] **Step 8: Commit.** `feat(ui): Security screen: fixture advisories without verdicts, unknown secrets and runtime evidence`

---

### Task 12: Evolution screen, the BarChart kit part, and the Snapshot comparison dialog (also from Overview and City)

**Files:**
- Create: `src/ui/kit/BarChart.vue`, `src/ui/screens/EvolutionScreen.vue`, `src/ui/screens/evolution/{ChangeCouplingTable,SnapshotJournal,SnapshotComparisonDialog}.vue`
- Modify: `src/ui/screens/OverviewScreen.vue`, `src/ui/screens/CityScreen.vue`, `src/ui/App.vue`, `src/ui/shell/use-route-provenance.ts`, `src/ui/styles/{kit,screens}.css`
- Test: `tests/component/evolution-screen.test.ts` (new), `tests/component/overview-screen.test.ts`, `tests/component/city-screen.test.ts`, `tests/component/shell-provenance.test.ts`, `tests/component/kit-display.test.ts`

**Interfaces:**
- Consumes: `evolutionModelFor`, `ChangeWindow` (Task 7); `useSnapshotJournal`, `compareSnapshots`, `JournalEntry` (Task 3).
- Produces:
  - `kit/BarChart.vue`: props `{ bars: readonly { label: string; value: number }[]; label: string; valueLabel: string }`. It is an SVG with `role="img"` and `aria-label`, plus a visually hidden table fallback, like `LineChart`.
  - `SnapshotComparisonDialog.vue`: props `{ initialBaseId?: string }`; emits `close`. It reads the journal and `store.snapshot` itself. The default base is the entry just before the current one.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/evolution-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import EvolutionScreen from '../../src/ui/screens/EvolutionScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useSnapshotJournal } from '../../src/ui/stores/snapshot-journal';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { journalEntryFor } from '../../src/ui/read-models/snapshot-comparison';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import type { CodebaseSnapshot } from '../../src/domain/model';

/** The screen does not feed the journal (App.vue does), so tests record entries directly. */
function show(snap: CodebaseSnapshot) {
  useCityStore().setCity(snap, computeLayout(snap));
  useSnapshotJournal().record(journalEntryFor(snap, fileSummariesFor(snap)));
}
const mountE = () => mount(EvolutionScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('EvolutionScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('with one snapshot: no Compare action, and "files added or removed" is unknown', () => {
    show(buildSnapshotFixture({ files: 20, directories: 2 }));
    const w = mountE();
    expect(w.find('.ci-evolution__compare').exists()).toBe(false);
    const card = w.findAll('.ci-metric-card').find((c) => c.text().includes('Files added or removed'))!;
    expect(card.text()).toContain('Needs a second snapshot');
    expect(w.text()).toContain('Only one snapshot so far.');
    w.unmount();
  });

  it('the 30/90-day toggle changes the sample activity series', async () => {
    show(buildSnapshotFixture({ files: 20 }));
    const w = mountE();
    expect(w.findAll('.ci-bar-chart__bar')).toHaveLength(7);
    await w.find('.ci-evolution__window [data-window="30"]').trigger('click');
    expect(w.findAll('.ci-bar-chart__bar')).toHaveLength(5);
    expect(w.find('.ci-evolution__window [data-window="30"]').attributes('aria-pressed')).toBe('true');
    w.unmount();
  });

  it('with two snapshots: Compare opens a dialog of collected differences', async () => {
    const first = buildSnapshotFixture({ files: 20, directories: 2 });
    show(first);
    show({ ...buildSnapshotFixture({ files: 24, directories: 2 }), snapshotId: 'second' });
    const w = mountE();
    await w.find('.ci-evolution__compare').trigger('click');
    const dialog = w.find('.ci-compare-dialog');
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain('Files added');
    expect(dialog.find('.ci-compare-dialog__added').text()).toBe('4');
    expect(dialog.text()).not.toContain('Sample');
    w.unmount();
  });

  it('a coupling row opens File detail for its first file', async () => {
    show(buildSnapshotFixture({ files: 30, directories: 2 }));
    const store = useCityStore();
    const w = mountE();
    await w.find('.ci-coupling .ci-table__row').trigger('click');
    expect(store.route).toBe('file');
    expect(store.selectedEntityId).not.toBeNull();
    w.unmount();
  });
});
```

  - **`overview-screen.test.ts`:** replace any assertion that "Compare navigates to evolution" with two tests. With one journal entry, `.ci-overview__compare` does not exist. With two, it opens `.ci-compare-dialog`.
  - **`city-screen.test.ts`:** add the same pair for `.ci-city-screen__compare`. Keep that file under 450 lines.
  - **`kit-display.test.ts`:** add a `BarChart` test. It renders one `.ci-bar-chart__bar` per value, puts `label` on the SVG as `aria-label`, and gives the fallback table one row per bar.
  - **`shell-provenance.test.ts`:** add `'evolution'`.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/evolution-screen.test.ts tests/component/overview-screen.test.ts tests/component/city-screen.test.ts tests/component/kit-display.test.ts`
- [ ] **Step 3: `kit/BarChart.vue`.** Use `LineChart.vue` as the pattern:

```vue
<script setup lang="ts">
import { computed } from 'vue';

interface Bar { label: string; value: number }
const props = defineProps<{ bars: readonly Bar[]; label: string; valueLabel: string }>();

const W = 600; const H = 200; const PAD_L = 32; const PAD_B = 22; const PAD_T = 8; const GAP = 0.35;
const niceMax = (v: number): number => Math.max(10, Math.ceil(v / 10) * 10);
const yMax = computed(() => niceMax(Math.max(0, ...props.bars.map((b) => b.value))));
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * yMax.value)));
const y = (v: number): number => PAD_T + (H - PAD_T - PAD_B) * (1 - v / yMax.value);
const slot = computed(() => (W - PAD_L - 8) / Math.max(1, props.bars.length));
const rects = computed(() => props.bars.map((b, i) => ({
  key: `${b.label}-${i}`, x: PAD_L + i * slot.value + (slot.value * GAP) / 2, width: slot.value * (1 - GAP),
  y: y(b.value), height: (H - PAD_B) - y(b.value), cx: PAD_L + (i + 0.5) * slot.value, label: b.label,
})));
</script>

<template>
  <figure class="ci-bar-chart">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="label"
    >
      <g class="ci-bar-chart__grid">
        <g
          v-for="t in ticks"
          :key="t"
        >
          <line
            :x1="PAD_L"
            :x2="W - 8"
            :y1="y(t)"
            :y2="y(t)"
          />
          <text
            :x="PAD_L - 6"
            :y="y(t) + 4"
            text-anchor="end"
          >{{ t }}</text>
        </g>
      </g>
      <rect
        v-for="r in rects"
        :key="r.key"
        class="ci-bar-chart__bar"
        :x="r.x"
        :y="r.y"
        :width="r.width"
        :height="r.height"
        rx="3"
      />
      <text
        v-for="r in rects"
        :key="`l-${r.key}`"
        class="ci-bar-chart__label"
        :x="r.cx"
        :y="H - 4"
        text-anchor="middle"
      >{{ r.label }}</text>
    </svg>
    <table class="visually-hidden">
      <caption>{{ label }}</caption>
      <thead>
        <tr>
          <th scope="col">
            Date
          </th>
          <th scope="col">
            {{ valueLabel }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(b, i) in bars"
          :key="`${b.label}-${i}`"
        >
          <th scope="row">
            {{ b.label }}
          </th>
          <td>{{ b.value }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
```

  `LineChart` has the same hard-coded `Date` header. Keep this one consistent with it; if the controller wants it in copy, both move together later. CSS for `kit.css` (bars use the accent tone):

```css
:where(.codebase-inspector-root) .ci-bar-chart svg { inline-size: 100%; block-size: auto; }
:where(.codebase-inspector-root) .ci-bar-chart__grid line { stroke: var(--ci-border); stroke-dasharray: 3 3; }
:where(.codebase-inspector-root) .ci-bar-chart__grid text,
:where(.codebase-inspector-root) .ci-bar-chart__label { fill: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-bar-chart__bar { fill: color-mix(in srgb, var(--interactive-accent) 70%, transparent); }
```

  If `.ci-line-chart__line--accent` uses a `--ci-*` accent token, use that token instead of `--interactive-accent`.
- [ ] **Step 4: `SnapshotComparisonDialog.vue`.**
  - Reads `useSnapshotJournal().entries` and `store.snapshot`.
  - `current` = the entry whose `snapshotId` matches `store.snapshot.snapshotId`. `earlier` = the entries before it, newest first.
  - `baseId = ref(props.initialBaseId ?? earlier[0]?.snapshotId ?? '')`, and `comparison = computed(() => …compareSnapshots(base, current))`.
  - `CiDialog` (`label` `COMPARE_TITLE`) wraps `.ci-compare-dialog`, holding:
    - `h3` and a subtitle;
    - a `<select>` (visually hidden label `COMPARE_BASE_LABEL`) over `earlier`, each option `COMPARE_ENTRY(dateLabel, snapshotId)`;
    - a `table` with columns Signal / Earlier / Current / Change, and these rows:
      - Files: `filesBefore`/`files`/`SIGNED(filesDelta)`
      - Source lines: `formatMetric(base.lines)`/`formatMetric(current.lines)`/`SIGNED` of `linesDelta` when it has a value, else `NO_VALUE`
      - Files added: a cell with class `ci-compare-dialog__added`
      - Files removed
    - a second `table` (caption `COMPARE_MODULES_CAPTION`) of `comparison.modules` where `changed`, showing label, files before → after, and lines before → after;
    - a Close button.
  - No `ProvenanceBadge`: every value is collected.
  - `dateLabel` is the same `MONTHS` + UTC day formatting. Use `dateLabels(entry.capturedAt, 1, 0)[0]` from `overview.ts`.
- [ ] **Step 5: The other Evolution components.**
  - **`ChangeCouplingTable.vue`:**
    - An EvidenceTable (caption `EVOLUTION_COUPLING_CAPTION`, wrapped in `div.ci-coupling`). Columns:
      - pair: `a.name`, then `↔ b.path` on a second line
      - rate: a tiny inline bar plus `formatMetric(rate,'%')` plus `ProvenanceBadge state="sample"`
      - shared
    - Row activation emits `open: [id]` with `a.id`.
    - Footnote `EVOLUTION_COUPLING_FOOTNOTE`; empty: `EVOLUTION_COUPLING_NONE`.
  - **`SnapshotJournal.vue`:**
    - Props `{ entries: readonly JournalEntry[]; currentId: string }` (newest first); emits `compare: [baseId: string]`.
    - An `ol.ci-journal`. Each entry shows the date label, `<code>` short id, and `EVOLUTION_JOURNAL_ENTRY(files, formatMetric(lines))`. The current entry shows the `EVOLUTION_JOURNAL_CURRENT` chip; every other entry has an `EVOLUTION_JOURNAL_COMPARE` button.
    - With one entry, show `EVOLUTION_JOURNAL_ONE` below the list.
- [ ] **Step 6: `EvolutionScreen.vue`.**
  - State: `window = ref<ChangeWindow>(90)`, `comparing = ref<{ baseId?: string } | null>(null)`.
  - `journal = useSnapshotJournal()`.
  - `model = computed(() => (store.snapshot ? evolutionModelFor(store.snapshot, files.value, journal.entries, window.value) : null))`.
  - Header actions:
    - `div.ci-evolution__window` (`role="group"`, `aria-label` `EVOLUTION_WINDOW_LABEL`) holding two buttons with `data-window="30|90"` and `:aria-pressed`;
    - `.ci-evolution__compare` (icon `arrow-up-down`), shown `v-if="journal.entries.length >= 2"`; it opens the dialog.
  - Body:
    - the cards;
    - `ci-overview__grid`, holding:
      - Panel `EVOLUTION_ACTIVITY_TITLE` with `BarChart :bars="model.activity" :label="EVOLUTION_ACTIVITY_LABEL" :value-label="EVOLUTION_ACTIVITY_VALUE"`;
      - Panel `EVOLUTION_COVERAGE_TITLE` with `LineChart`, or `EVOLUTION_COVERAGE_NONE`;
    - a second grid, holding:
      - Panel `EVOLUTION_COUPLING_TITLE` with `ChangeCouplingTable` (`@open` → select + navigate to `file`);
      - Panel `EVOLUTION_JOURNAL_TITLE` with `SnapshotJournal` (`@compare="comparing = { baseId: $event }"`);
    - `<SnapshotComparisonDialog v-if="comparing" v-bind="comparing" @close="comparing = null" />`.

    With `exactOptionalPropertyTypes`, bind `baseId` only when it is set: `v-bind="comparing.baseId ? { initialBaseId: comparing.baseId } : {}"`.
- [ ] **Step 7: Overview and City.**
  - **`OverviewScreen.vue`:**
    - The existing Compare button gets class `ci-overview__compare`, `v-if="journal.entries.length >= 2"`, and `@click="comparing = true"`. It no longer navigates. The "View evolution" action in the signals panel is unchanged.
    - Render `<SnapshotComparisonDialog v-if="comparing" @close="comparing = false" />`.
  - **`CityScreen.vue`:** add a `.ci-city-screen__compare` button to the header actions before "View inventory" (label `EVOLUTION_COMPARE`, icon `arrow-up-down`, same `v-if`), and the same dialog.
  - Update the header comment of `CityScreen.vue`: A4's "omitted until history exists" is now "shown once the session journal holds two snapshots (Part 3 Q9)".
  - `CityWorkspace.vue` is untouched.
- [ ] **Step 8: Wire the route.** `App.vue` branch for `'evolution'`; provenance `case 'evolution': return store.snapshot !== null;`. The model is always sample-backed through activity and coupling, and its `usesSample` is the literal `true`.
- [ ] **Step 9: CSS.** Add rules for:
  - `.ci-evolution__window`: a segmented control; `[aria-pressed="true"]` uses `--ci-raised` plus a border;
  - `.ci-journal`: a vertical timeline with dot markers and `--ci-border` lines;
  - `.ci-coupling__rate`: an inline bar;
  - `.ci-compare-dialog`: tables with `.ci-table` styling.
- [ ] **Step 10: Run and confirm they pass.** `npx vitest run tests/component/evolution-screen.test.ts tests/component/overview-screen.test.ts tests/component/city-screen.test.ts tests/component/kit-display.test.ts tests/component/shell-provenance.test.ts tests/unit/kit-css-fallbacks.test.ts`, then the gate.
- [ ] **Step 11: Commit.** `feat(ui): Evolution screen and snapshot comparison from the session journal (Overview and City too)`

---

### Task 13: Ownership screen

**Files:**
- Create: `src/ui/screens/OwnershipScreen.vue`, `src/ui/screens/ownership/{StewardshipActions,StewardshipTable}.vue`
- Modify: `src/ui/App.vue`, `src/ui/shell/use-route-provenance.ts`, `src/ui/styles/screens.css`
- Test: `tests/component/ownership-screen.test.ts` (new), `tests/component/shell-provenance.test.ts`

**Interfaces:**
- Consumes: `ownership` from `useReadModels()`, `stewardshipCsv`, `CONCENTRATION_WARNING`, `ROOT_MODULE` (Task 7); `MeterList` (Task 9); `addWorkItem`, `hasWorkItem`, `isPending` (Task 2); `store.setQuery`, `store.navigate`.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/ownership-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import OwnershipScreen from '../../src/ui/screens/OwnershipScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(directories = 4) {
  const snap = buildSnapshotFixture({ files: 40, directories });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountO = () => mount(OwnershipScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('OwnershipScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('states team-level only, and labels teams and concentration as sample', () => {
    withSnapshot();
    const w = mountO();
    expect(w.text()).toContain('Team-level continuity signals only.');
    expect(w.findAll('.ci-meter').every((m) => (m.attributes('aria-label') ?? '').includes('sample'))).toBe(true);
    expect(w.findAll('.ci-stewardship .ci-table__row')).toHaveLength(4);
    w.unmount();
  });

  it('Show in city searches the module path and navigates, without selecting or moving the camera', async () => {
    withSnapshot();
    const store = useCityStore();
    const w = mountO();
    await w.find('.ci-stewardship__city').trigger('click');
    expect(store.route).toBe('city');
    expect(store.query).toMatch(/^dir-\d\/$/);
    expect(store.selectedEntityId).toBeNull();
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('root files get no Show in city action', () => {
    const snap = buildSnapshotFixture({ files: 6 });
    useCityStore().setCity(snap, computeLayout(snap));
    const w = mountO();
    expect(w.find('.ci-stewardship__city').exists()).toBe(false);
    w.unmount();
  });

  it('a stewardship action creates one module work item with its intent', async () => {
    withSnapshot();
    const w = mountO();
    const btn = w.find('.ci-steward-action__add');
    await btn.trigger('click');
    await Promise.resolve(); await nextTick();
    const item = useReviewStore().workItems[0]!;
    expect(item.target.kind).toBe('module');
    expect(item.intent).toBe('pairing');
    expect(w.find('.ci-steward-action__add').attributes('disabled')).toBeDefined();
    w.unmount();
  });

  it('exports the stewardship map', async () => {
    withSnapshot();
    const w = mountO();
    await w.find('.ci-ownership__export').trigger('click');
    expect(vi.mocked(downloadText).mock.calls[0]![1]).toBe('sample-module-stewardship.csv');
    w.unmount();
  });
});
```

  Add `'ownership'` to the shell-provenance route list.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/ownership-screen.test.ts`
- [ ] **Step 3: Components.**
  - **`StewardshipActions.vue`:**
    - Props `{ actions: readonly StewardshipAction[] }`; emits `add: [action]`.
    - A `ul`, one `li.ci-steward-action` per action: `Icon` (`users` / `flask-conical` / `file-text` by intent), title, body, and a `button.ci-steward-action__add` (icon `plus`) with `aria-label` `OWNERSHIP_ACTION_ADD(title)`.
    - The button is disabled, with visible text `OWNERSHIP_ACTION_ADDED`, when `review.hasWorkItem({ kind: 'module', module }, intent)` or pending.
  - **`StewardshipTable.vue`:**
    - An EvidenceTable wrapped in `div.ci-stewardship`. Rows are not activatable. Columns:
      - module
      - team: a `.ci-chip` with `row.team.value` plus `ProvenanceBadge state="sample"`
      - files
      - concentration (`%`, sample)
      - review candidates
      - actions
    - The actions cell holds `button.ci-stewardship__city` (`OWNERSHIP_SHOW_IN_CITY`, `aria-label` `OWNERSHIP_SHOW_IN_CITY_LABEL(label)`), rendered only when `row.module !== ROOT_MODULE`. It emits `city: [module]`.
- [ ] **Step 4: `OwnershipScreen.vue`.**
  - Header: Export (`.ci-ownership__export`) → `stewardshipCsv(ownership.rows)`.
  - `Callout :title="OWNERSHIP_CALLOUT_TITLE" :badge="SAMPLE_BADGE_DETAIL"` with `OWNERSHIP_CALLOUT`.
  - `ci-overview__grid`, holding:
    - Panel `OWNERSHIP_BARS_TITLE` (footnote `OWNERSHIP_BARS_FOOTNOTE`) with `MeterList`. Items come from the rows: `value: row.concentration`, `tone: value >= CONCENTRATION_WARNING ? 'warning' : 'accent'`, `ariaLabel: OWNERSHIP_BAR_LABEL(label, formatMetric(value,'%'))`.
    - Panel `OWNERSHIP_ACTIONS_TITLE` with `StewardshipActions`.
  - Panel `OWNERSHIP_TABLE_TITLE` with `StewardshipTable`, then `OWNERSHIP_HIDDEN(n)` when `hiddenModules > 0`.
  - Handlers:

```ts
/** Q11: the city's own path search, exactly what the user could type. It dims files outside
 *  the module and never moves the camera or changes the selection. */
function showInCity(module: string): void {
  store.setQuery(`${module}/`);
  store.navigate('city');
}
async function addAction(a: StewardshipAction): Promise<void> {
  try {
    await review.addWorkItem({ kind: 'module', module: a.module }, a.intent, a.title, new Date());
  } catch {
    liveMessage.value = OWNERSHIP_ACTION_FAILED;
  }
}
```

  - No individual names, authors or per-person values anywhere in the template.
- [ ] **Step 5: Wire the route.** `App.vue` branch for `'ownership'`; provenance `case 'ownership': return ownership.value.usesSample && store.snapshot !== null;`.
- [ ] **Step 6: CSS.** Add rules for `.ci-steward-action` (a grid of icon, text and button) and `.ci-stewardship`.
- [ ] **Step 7: Run and confirm they pass.** `npx vitest run tests/component/ownership-screen.test.ts tests/component/shell-provenance.test.ts tests/unit/kit-css-fallbacks.test.ts`, then the gate. Also confirm that `grep -rn "author\|contributor" src/ui/screens/OwnershipScreen.vue src/ui/screens/ownership src/ui/read-models/ownership.ts` finds nothing but comments.
- [ ] **Step 8: Commit.** `feat(ui): Ownership screen: module stewardship, knowledge-sharing work items, no individual data`

---

### Task 14: Shell: content behind the drawer is `inert`

**Files:**
- Modify: `src/ui/App.vue`
- Test: `tests/component/workspace-shell.test.ts` (or `tests/component/nav-column.test.ts`, whichever already holds the drawer-scrim test; stay under 450 lines)

- [ ] **Step 1: Write the failing test.** Next to the existing Part 2 scrim test:
  - open the drawer (the leaf is narrow in jsdom, so the nav is a drawer);
  - assert `w.find('.ci-topbar').attributes('inert')` is defined and `w.find('.ci-shell__content').attributes('inert')` is defined;
  - close it with Escape and assert both attributes are gone.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.**
  - In `App.vue`, add `const drawerOpen = computed(() => navOpen.value && !navInline.value);`.
  - Bind `:inert="drawerOpen || undefined"` on `<TopBar>` (it falls through to its root; if `TopBar` sets `inheritAttrs: false`, wrap it instead) and on `<main class="ci-shell__content">`.
  - Replace `navOpen && !navInline` in the template with `drawerOpen`.

  `undefined` removes the attribute, so a closed drawer leaves no `inert=""` behind. The nav column itself is never inert.
- [ ] **Step 4: Run and confirm it passes.** Run the file, `tests/component/nav-column.test.ts`, and the gate.
- [ ] **Step 5: Commit.** `fix(ui): content behind the open nav drawer is inert`

---

### Task 15: Harness captures with `?tab=`, evidence-note counts, full verification

**Files:**
- Modify: `tests/harness/page.ts`, `tests/harness/mount.ts`, `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts` (if it pins the shot list), `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`, `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`
- Possibly modify: `src/ui/styles/screens.css` (visual fixes found in the comparison)

- [ ] **Step 1: `?tab=` in the harness.**
  - In `tests/harness/mount.ts`, add `tab?: string;` to `HarnessOptions`.
  - In the non-city branch, after `await nextTick();` and before the ready flag, add:

```ts
    if (options.tab) {
      // Part 3 §4: a headless capture cannot click, so the harness selects the tab.
      root.querySelector<HTMLElement>(`[role="tab"][data-tab-id="${options.tab}"]`)?.click();
      await nextTick();
    }
```

  - In `page.ts`, add the header line `//   ?tab=<id>          select a tab on a tabbed screen (after the route)`, and pass `...(params.get('tab') ? { tab: params.get('tab')! } : {})`.
- [ ] **Step 2: New shots.** In `scripts/harness-shot.mjs`, after the Part 2 entries, add:

```js
  // WP-02 Part 3: compare against docs/concept/prototype/screenshots/{quality,tests,dependencies,security,evolution,ownership}-{dark,light}.png
  // and the subviews mutation-unknown-dark.png, test-results-dark.png, dependency-path-dark.png.
  { id: 'wp02-quality-dark', query: '?screen=s05&theme=dark&route=quality' },
  { id: 'wp02-quality-light', query: '?screen=s05&theme=light&route=quality' },
  { id: 'wp02-quality-narrow-dark', query: '?screen=s10&theme=dark&route=quality&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-tests-dark', query: '?screen=s05&theme=dark&route=tests' },
  { id: 'wp02-tests-light', query: '?screen=s05&theme=light&route=tests' },
  { id: 'wp02-tests-narrow-dark', query: '?screen=s10&theme=dark&route=tests&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-tests-mutation-dark', query: '?screen=s05&theme=dark&route=tests&tab=mutation' },
  { id: 'wp02-tests-results-dark', query: '?screen=s05&theme=dark&route=tests&tab=results' },
  { id: 'wp02-dependencies-dark', query: '?screen=s05&theme=dark&route=dependencies' },
  { id: 'wp02-dependencies-light', query: '?screen=s05&theme=light&route=dependencies' },
  { id: 'wp02-dependencies-narrow-dark', query: '?screen=s10&theme=dark&route=dependencies&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-dependencies-path-dark', query: '?screen=s05&theme=dark&route=dependencies&tab=path' },
  { id: 'wp02-security-dark', query: '?screen=s05&theme=dark&route=security' },
  { id: 'wp02-security-light', query: '?screen=s05&theme=light&route=security' },
  { id: 'wp02-security-narrow-dark', query: '?screen=s10&theme=dark&route=security&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-evolution-dark', query: '?screen=s05&theme=dark&route=evolution' },
  { id: 'wp02-evolution-light', query: '?screen=s05&theme=light&route=evolution' },
  { id: 'wp02-evolution-narrow-dark', query: '?screen=s10&theme=dark&route=evolution&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-ownership-dark', query: '?screen=s05&theme=dark&route=ownership' },
  { id: 'wp02-ownership-light', query: '?screen=s05&theme=light&route=ownership' },
  { id: 'wp02-ownership-narrow-dark', query: '?screen=s10&theme=dark&route=ownership&width=700', viewport: { width: 760, height: 900 } },
```

  If `tests/build/harness-shot.test.ts` pins the shot list or count, update it and report it.
- [ ] **Step 3: Capture and compare.**
  - Run `npm run harness-shot`. The existing city shots must still show the drawn city.
  - Open each new PNG in `harness-shots/` next to its prototype counterpart in `docs/concept/prototype/screenshots/`.
  - Fix layout or spacing defects in the CSS files only.
  - **Expected, intended differences, not to be fixed:**
    - sample labels everywhere, and the shell "Includes sample data" badge;
    - secret candidates shown as not collected (Q7), where the prototype shows one synthetic token;
    - no illustrative import locations in the package dialog (Q6);
    - a journal with one entry and no Compare action, because the harness shows one snapshot (Q8/Q9);
    - an empty test-results tab, because the harness fixture has no test files;
    - the fixture's `dir-N` module names;
    - Obsidian's own chrome.
  - List every difference you leave in your report.
  - Also check that no new screen makes the owner's contrast decision #4 (`docs/superpowers/notes/2026-09-21-wp01b-open-decisions.md`) worse, meaning no new failing text/background pair. Report what you find; **do not change the tokens**.
- [ ] **Step 4: Evidence-note counts.**
  - Run `npx vitest run tests/unit/gate-evidence.test.ts tests/unit/evidence-numbers.test.ts`. The failures name each stale value: per-layer test-file counts, the total, and any derived src counts.
  - Update exactly those values in `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` and `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md` **with the Edit tool**. These files are CRLF; never `sed -i`.
  - Commit 904692e is the pattern to follow (`git show 904692e`). Change derived numbers only; per-layer test counts stay as transcribed except where the tests name them.
  - Update the sentence "Counts refreshed … after WP-02 Part 2" to say Part 3.
  - Re-run the two tests until they pass.
- [ ] **Step 5: Full verification.** Run `npm run verify`.
  - Expected: exit 0, except `tests/unit/install-script.test.ts`, which fails in a worktree without `.obsidian/` (environmental). Paste its failure verbatim in the report.
  - Anything else failing is a real failure: fix it, or stop and report it.
- [ ] **Step 6: Commit.** `test(harness): Part 3 captures with ?tab=; refresh WP-01 evidence counts after WP-02 Part 3`

---

## Self-review notes

- **Spec coverage:**

  | Spec item | Task |
  |---|---|
  | Q1–Q3 | 2, 4, 8 |
  | Q4 | 2, then used in 8–10 and 13 |
  | Q5, Q6 | 6, 10 |
  | Q7 | 6, 11 |
  | Q8 | 3, 7, 12 |
  | Q9 | 3, 12 |
  | Q10 | 7, 12 |
  | Q11 | 7, 13 |
  | Q12, Q13 | 5, 9 |
  | Q14 | deliberately absent |
  | Q15 | 1, 4–7 |
  | Q16 | 9, 11 |
  | Q17 | no change (NavColumn untouched) |
  | §4 `includesSample`, CSV, Architecture memo, a11y "sample" labels | 1 |
  | §4 `data-tab-id` | 9 |
  | §4 harness `?tab=` | 15 |
  | §4 `inert` | 14 |
  | §4 deferred-again city items | untouched |
  | §4 contrast #4 | checked in 15 |
  | §5 testing | every task, plus 15 |

- **Line budgets:**
  - `App.vue` grows by about 20 lines (six branches, six imports, the journal feed, `inert`).
  - `inspector-copy.ts` grows by 9 lines (re-exports plus two label edits).
  - `review-store.ts` ends near 210 and `use-read-models.ts` near 150.
  - Each screen is estimated under 300 lines, with sub-components named in its task.
  - `city-view.ts`, `CityWorkspace.vue` and `city-view-store-wiring.test.ts` are untouched.
- **Type names used across tasks:**
  - `WorkTarget`, `WorkIntent`, `FindingDisposition`, `JournalEntry`, `SnapshotComparison`
  - `QualityFinding`, `QualityFilter`, `TestConfidenceModel`, `CoverageTile`
  - `SamplePackage`, `PackageRow`, `DependenciesModel`, `SecurityModel`
  - `EvolutionModel`, `ChangeWindow`, `OwnershipModel`, `StewardshipRow`, `StewardshipAction`
  - `MeterItem`, `EvidenceSourceRow`
- **`useReadModels()` returns** `{ files, overview, citySummary, architecture, fileDetail, filesUseSample, quality, testConfidence, dependencies, security, ownership }`. Evolution is built through the exported `evolutionModelFor` because the screen owns the window.
- **Task order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15. Task 11 needs Task 9 (shared components) and Task 10 (`PackageDetailDialog`). Task 13 needs Task 9 (`MeterList`).
