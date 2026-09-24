# WP-03 Part 1 — dependency evidence from fallow: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read the dependency evidence fallow already documents in every combined report into a validated relation model with directional queries. Make cycles, boundary violations and unresolved imports reviewable findings. Drive Architecture, File detail, Overview, Data & scans and the city (directed arcs through an amended renderer port) from that evidence instead of sample edges.

**Architecture:**
- Path-level `RelationEvidence` is built in `src/application/evidence/` beside the findings (pure, snapshot-independent).
- It is resolved to entity ids in a UI read model, `src/ui/read-models/relations.ts`.
- It is queried through pure graph code in `src/domain/relations/`.
- The city draws arcs through one new renderer-port method, `setRelations`, implemented in `src/visualization/relation-arcs.ts`.
- Screens read read models, stores and copy only (Part 6 E20). Every value is a `MetricValue`, and absent evidence is `unknown`, never `0`.

**Tech Stack:** TypeScript 6.0.3, Vue 3.5.43 (`<script setup>`), Pinia 4.0.3, zod 4.6.5, three (as pinned), Vitest 5.0.1 (`vitest.config.ts` projects `node` and `jsdom`) + @vue/test-utils 2.5.1, Node 24 (`node:*` in tests and scripts only), fallow 3.21.0 / 3.27.0 (fixture recording, `npm run test:fallow` and `npm run analyze` only — never a dependency).

**Spec:** `docs/superpowers/specs/2026-09-24-wp03-part1-dependencies-design.md` (N1–N40). Binding with it:
- the WP-01 spec §4 (amended only by N28);
- the Part 1–7 specs;
- the Part 3–7 ledgers and the polish ledger.

Planning rulings are **J1…** and pre-flight rulings are **JF1…**, both in `docs/superpowers/notes/2026-09-24-wp03-part1-ledger.md`. Execution rulings are "WP-03 E1"….

**Branch:** `feat/wp-03-part1` (from 2bb64d5, the PR #1 head), worktree `C:\Projects\codebase-inspector\.claude\worktrees\wp-03-part1`. `node_modules` is installed. The integration (fast-forward onto `feat/wp-01-codebase-city`) happens after the final review.

**Before Task 1:** the controller runs the pre-flight scan: it checks every "Consumes" name against the code and records JF rulings. Before each dispatch, it re-checks every "Consumes" name against what earlier tasks committed.

## Global Constraints

**Size** (eslint `max-lines`; measured at 2bb64d5 with `wc -l`)
- `src/**/*.{ts,vue}` max **400** lines. `tests/**/*.ts` max **450** lines. A file that would pass its cap is split, never compressed.
- `src/host/city-view.ts` and `src/ui/screens/CityWorkspace.vue` are capped at **360** by `tests/benchmarks/city-budget.test.ts`. This plan does not edit either.
- `src/ui/components/CityViewport.vue` is **400/400**: never edited.
- `src/visualization/city-renderer.ts` is **388**. Task 11 extracts `makeInertPort` before adding anything (J9).
- `src` files this plan touches, with their size now:
  - **application:** `application/evidence/model.ts` 102, `normalize-fallow.ts` 268, `read-fallow-report.ts` 183, `raw-fallow.ts` 103, `fallow-report-schema.ts` 164, `resolve-findings.ts` 76.
  - **read models:** `ui/read-models/architecture.ts` 162, `evidence-index.ts` 164, `findings.ts` 171, `file-detail.ts` 84, `file-summaries.ts` 116, `overview.ts` 152, `city-summary.ts` 22, `sources.ts` 97, `report.ts` 114, `use-read-models.ts` 185, `use-lens-view.ts` 38.
  - **stores:** `ui/stores/evidence-store.ts` 81, `lens-store.ts` 41 (read only).
  - **copy:** `ui/audit-copy/quality.ts` 148, `fallow.ts` 200, `sources.ts` 49; `ui/inspector-copy.ts` 300.
  - **components and screens:** `ui/components/FileInspector.vue` 212, `CityStage.vue` 81; `ui/screens/ArchitectureScreen.vue` 243, `FileDetailScreen.vue` 149, `QualityScreen.vue` 223.
  - **architecture:** `ui/screens/architecture/ModuleMap.vue` 103, `DependencyMatrix.vue` 89, `BoundaryRuleTable.vue` 85, `BoundaryInspector.vue` 87, `ModuleInspector.vue` 65, `RuleEditor.vue` 129.
  - **other screens:** `ui/screens/quality/FindingFilters.vue` 126, `FindingReviewDialog.vue` 266; `ui/screens/file/FileFindingsPanel.vue` 88; `ui/screens/sources/FallowReportFacts.vue` 126.
  - **visualization and host:** `visualization/renderer-port.ts` 101, `city-renderer.ts` 388, `disposal.ts` 63; `host/theme-bridge.ts` 41.
  - **fixtures:** `ui/fixtures/sample-signals.ts` 39, `sample-module-edges.ts` 27 (deleted).
  - **CSS (no cap):** `ui/styles/kit.css` 283, `screens-explore.css` 139.
- Test files this plan touches, with their size now:
  - **unit:** `tests/unit/architecture-model.test.ts` 116, `evidence-index.test.ts` 220, `fallow-copy.test.ts` 50, `fallow-report-reader.test.ts` 243, `file-detail-model.test.ts` 64, `finding-copy.test.ts` 53, `findings-model.test.ts` 146, `normalize-fallow-ids.test.ts` 181, `normalize-fallow.test.ts` 199, `resolve-findings.test.ts` 79, `sources-model.test.ts` 69.
  - **component:** `tests/component/architecture-rules.test.ts` 197, `architecture-screen.test.ts` 155, `connect-fallow.test.ts` 384, `fallow-card.test.ts` 226, `file-detail-screen.test.ts` 121, `file-inspector.test.ts` 233, `findings-lens.test.ts` 302, `overview-screen.test.ts` 143, `quality-fallow.test.ts` 215, `quality-screen.test.ts` 323, `renderer-reported.test.ts` 226.
  - **fixtures:** `tests/fixtures/evidence-report.ts` 153, `fallow-fixture.ts` 104, `fallow-expected.ts` 54.
  - **harness and real-binary:** `tests/harness/seed.ts` 162, `tests/harness/mount.ts` 374, `tests/harness/harness-evidence.test.ts` 120, `tests/fallow-real/fallow-real.test.ts` 154.
- **At or near the tests cap — never grow them.** Edit one line in place when a renderer double needs `setRelations` (J10): `tests/host/city-view-store-wiring.test.ts` **450**, `tests/component/welcome-state.test.ts` **446**, `tests/host/city-view.test.ts` **440**, `tests/host/window-migration.test.ts` **420**, `tests/unit/evidence-numbers.test.ts` **403**. New tests go in new files, named in each task.

**Layering**
- `src/domain/relations/**` imports nothing outside `src/domain/**` (eslint Rule 2 enforces it), and it holds no fallow words.
- `src/application/**` imports no adapter, no host, no UI and no Node module.
- `src/visualization/**` imports no host, adapter or application module. It may import `src/domain/**` types.
- `src/ui/**` never imports `src/adapters/**` or `src/host/**`. Screens read application types through read models.
- `obsidianmd/no-nodejs-modules` stays an error in `src/**`.
- **No process change:** the run argv, spawn options and process guards are untouched. No new command, no `viz`, no `trace`. `fallow-argv-policy.test.ts` must pass unchanged.

**Evidence (Part 6, Z23/Z25, N5)**
- Absent evidence is never rendered or exported as `0`. No composite score and no invented confidence.
- Every surface that shows an edge, an edge count, a neighbourhood or an arc shows `RELATIONS_SCOPE_NOTE`. A file with no evidenced edge is "No evidenced imports", never "no imports".
- Every edge's type reads `RELATION_TYPE_UNKNOWN`. Static coupling is never called execution.
- Every value from a report is rendered through Vue text interpolation only: never `v-html`, `innerHTML` or an `href`.
- A report path goes through `pathMapper` (Y26), never an absolute read.

**Storage**
- No new durable key. `CityViewState`, `getState()` and `data.json` are unchanged. The review format stays v2.

**TypeScript and lint** (carried from Parts 6 and 7)
- **ES2020 only:** tsconfig `lib` is ES2020, so no `.at()`, `Object.hasOwn`, `replaceAll` or `findLast` in `src`.
- **oxlint:** it runs with `--deny-warnings` and `consistent-function-scoping`, so a closure that captures nothing is hoisted to module scope. No `[...set]` spread in `src`; use `Array.from(set)`.
- **PF1:** timers in `src` are read through a local binding at call time. Tests use `node:timers/promises`.
- **PF2:** no no-op closure initialisers.
- **PF14:** store and composable members a screen destructures are arrow-function properties, never methods.
- **Type assertions:** no `as` a type already has (Part 7 E13). `npx eslint <file> --max-warnings 0` catches it.
- **`exactOptionalPropertyTypes`:** never assign `undefined` to an optional property; spread it in conditionally.
- **Dead exports:** an export no other module imports is a new `npm run analyze` finding. Keep helpers module-private.

**Browser globals and accessibility** (carried)
- No bare `window`, `document`, `setTimeout` or `localStorage` in `src/ui/**` or `src/visualization/**`. Never `x instanceof HTMLElement`.
- Element ids come from `useUniqueId()`.
- **E40:** a button that can become blocked while focused uses `aria-disabled="true"` plus a guarded handler, never `disabled`.
- Announce only real outcomes (E17), through `reannounce(live, message)`.
- The canvas stays `aria-hidden`. Every arc has a keyboard-reachable text row.

**Copy and CSS**
- **Where strings go:**
  - `src/ui/audit-copy/relations.ts` (new): Architecture, File detail and city Relations strings;
  - `src/ui/audit-copy/quality.ts`: the kinds, rules, cards and dialog;
  - `src/ui/audit-copy/fallow.ts`: `FALLOW_BOUNDARIES_NOT_CONFIGURED`;
  - `src/ui/audit-copy/sources.ts`: `EVIDENCE_SOURCE_FALLOW_PARTIAL`.
  - Re-export each new module through `src/ui/inspector-copy.ts`, as the others are. Never `src/ui/copy.ts`.
  - Existing Architecture strings in `inspector-copy.ts` are changed or removed in place (spec §2).
- **CSS:**
  - only in `src/ui/styles/{kit,screens-explore}.css`;
  - under `:where(.codebase-inspector-root)`, with BEM `ci-*` classes;
  - colours only through `--ci-*` tokens;
  - never edit `src/ui/styles.css`, and no Vue `<style>` blocks.

**Test infrastructure**
- **Test projects:**
  - `node` runs `tests/{unit,contracts,integration,host,build}`;
  - `jsdom` runs `tests/{component,acceptance,benchmarks,harness}`, plus the listed host files (`vitest.config.ts`).
- **Timeouts:** a slow whole-`src` scan or a real-process wait gets an explicit per-test timeout (`30_000` for whole-src scans, Part 7 E21).
- **The RED rule:** every new test must fail without its code, and the implementer runs it RED and pastes the output. A pin on behaviour that already holds is proved by the mutation the task names. Every `.every(...)` assertion is preceded by a non-empty check (E27).
- **No mocks for the parser:** tests build reports through the real parser and normaliser (`tests/fixtures/evidence-report.ts`, `tests/fixtures/fallow-fixture.ts`).
- **Editing files:** only with the Edit/Write tools. Never `sed -i`, heredocs or scripts: files are CRLF on Windows.

**Gates and commits**
- **Per-task gate:** `npm run typecheck && npm run lint:fast && npx eslint <touched src and test files> --max-warnings 0 && npx vitest run <the task's test files and every existing test file the task edits>`. Run the gate commands in the foreground.
- **Evidence-note counts:** the WP-01 evidence-note counts are updated **once, in Task 15** (L28). Until then `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` may fail on file counts and the `src/` floor. Do not run the full suite per task, and do not "fix" those two tests early.
- **Whole-`src` scans:** `tests/host/clean-vault-install.test.ts` and `tests/unit/no-process-execution.test.ts` scan all of `src/`. Under load, re-run them alone before calling a failure real.
- **Commits:** commit after each task, with only the task's own files (never the ledger). Every message is `git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.

**Process**
- Implementers and reviewers never spawn subagents. Reviewers are read-only and create no files in the worktree.
- Implementers report:
  - the files changed, with line counts;
  - the gate output;
  - the RED and GREEN output (or the mutation run for a pin);
  - every deviation from this plan, and why.
- Cheap review minors inside a task's own files are fixed in that task's fix round, never deferred.

## Review Focus

Five input classes the spec implies and no happy-path test covers. Each has a test in its owning task:
1. **A cycle whose `edges[i].path` is not `files[i]`, or whose `edges` is missing** (older writers, or a fallow bug). It must give hops with `line: null` and never crash or shift lines onto the wrong hop. Task 4, "misaligned edges".
2. **The same file pair reported both as a cycle hop and as a boundary violation.** It must give one edge with both sources ("Cycle, Boundary"), counted once. Task 6, "one pair, two sources".
3. **A report imported with a strip prefix.** Relation paths must be stripped exactly like finding paths, or every edge goes unmatched. Task 4, "strip prefix".
4. **A highlighted cycle longer than the arc limit** (more than 24 hops), or a highlighted cycle that disappears after a rescan or re-import. It must cap at 24 with a hidden count, and the highlight must clear without stale arcs. Task 12, "long cycle" and "vanished cycle".
5. **Stale evidence** (a report attached to an older snapshot). Relations must still resolve against the current paths, read `stale` everywhere, and still draw arcs, with the stale state visible in the Relations section. Task 6, "stale", and Task 12, "stale arcs".

---

### Task 1: The relations fixture project and its recordings

**Files:**
- Create: `tests/fixtures/fallow/relations-project/**` (package.json, `.fallowrc.json`, the TypeScript files listed below)
- Create: `tests/fixtures/fallow/relations-combined-3.27.0.json`, `relations-combined-3.21.0.json`, `relations-no-boundaries-3.27.0.json`
- Modify: `tests/fixtures/fallow/README.md`, `tsconfig.test.json` (exclude), `eslint.config.mjs` (ignores), `.oxlintrc.json` (ignorePatterns), `tests/fixtures/fallow-fixture.ts` (the fixture names)
- Test: `tests/unit/fallow-relations-fixtures.test.ts` (new)

**Interfaces:**
- Produces:
  - `RELATION_FIXTURES = ['relations-combined-3.27.0', 'relations-combined-3.21.0', 'relations-no-boundaries-3.27.0'] as const`, in `fallow-fixture.ts`;
  - `FallowFixture` widened to include them, so that `fallowText`, `fallowDoc` and `rawReport` accept them;
  - `RELATIONS_PROJECT_DIR`, the absolute path of the project, for Task 13.

- [ ] **Step 1: Write the project.** Every file is tiny. Use exactly these contents:
  - `package.json`: `{ "name": "relations-fixture", "private": true, "type": "module", "main": "src/index.ts" }`.
  - `.fallowrc.json`:
    ```json
    { "boundaries": {
        "zones": [
          { "name": "ui", "patterns": ["src/ui/**"] },
          { "name": "core", "patterns": ["src/core/**"] },
          { "name": "data", "patterns": ["src/data/**"] }
        ],
        "rules": [
          { "from": "ui", "allow": ["core"], "allowTypeOnly": ["data"] },
          { "from": "core", "allow": [] },
          { "from": "data", "allow": [] }
        ] } }
    ```
  - `src/index.ts` imports and uses `runA` from `./core/a`, `render` from `./ui/view`, `helper` from `./barrel/index`, and `./does-not-exist` (the unresolved import, on its own line 4).
  - `src/core/a.ts` imports `runB` from `./b`; `b.ts` imports `runC` from `./c`; `c.ts` imports `runA` from `./a`. Each exports its `run*` function, which calls the next one behind a depth guard. This is the 3-file import cycle.
  - `src/barrel/index.ts`: `export * from './x'; export { helper } from './y';`. `src/barrel/x.ts`: `export * from './index'; export const x = 1;`. `src/barrel/y.ts`: `export const helper = (): number => 1;`. This is the re-export cycle.
  - `src/ui/view.ts`: `import { runA } from '../core/a'; import type { Row } from '../data/types'; import { db } from '../data/db';` and `export const render = (r: Row): number => runA(0) + db.size + r.id;`. The `db` import is the boundary violation.
  - `src/data/types.ts`: `export interface Row { id: number }`. `src/data/db.ts`: `export const db = new Map<string, number>();`.
  - `src/orphan.ts`: `export const orphan = 1;` (disconnected; imported by nothing).
- [ ] **Step 2: Exclude the project from tooling.** In `tsconfig.test.json` `exclude`, `eslint.config.mjs` `ignores` and `.oxlintrc.json` `ignorePatterns`, add `tests/fixtures/fallow/relations-project/**` next to the existing `tests/fixtures/fallow/project/**` entry.
- [ ] **Step 3: Record, from the repository root in Git Bash.** Use the cached binaries only (`npx --offline --yes fallow@<version>`), and write nothing into the project. Check `git status --short tests/fixtures/fallow/relations-project` is empty afterwards.
  ```bash
  npx --offline --yes fallow@3.27.0 --format json --no-cache --quiet --root tests/fixtures/fallow/relations-project > tests/fixtures/fallow/relations-combined-3.27.0.json
  npx --offline --yes fallow@3.21.0 --format json --no-cache --quiet --root tests/fixtures/fallow/relations-project > tests/fixtures/fallow/relations-combined-3.21.0.json
  mv tests/fixtures/fallow/relations-project/.fallowrc.json /tmp/relations-fallowrc.json && npx --offline --yes fallow@3.27.0 --format json --no-cache --quiet --root tests/fixtures/fallow/relations-project > tests/fixtures/fallow/relations-no-boundaries-3.27.0.json; mv /tmp/relations-fallowrc.json tests/fixtures/fallow/relations-project/.fallowrc.json
  ```
  If `npx --offline` cannot resolve a version, set `FALLOW_BIN` to the cached `fallow.exe` under `%LOCALAPPDATA%/npm-cache/_npx/<hash>/node_modules/@fallow-cli/win32-x64-msvc/` (3.27.0 is in `ee3f2ca80543beb5`, 3.21.0 in `8335d9a462546d2d`), run it directly, and write the command used in the README.
- [ ] **Step 4: Inspect the recordings.** For each file, print `check.circular_dependencies`, `check.re_export_cycles`, `check.boundary_violations`, `check.unresolved_imports`, `check.summary` and `workspace_diagnostics[].kind` with a one-off `node -e`. Expected on 3.27.0, with boundaries:
  - `circular_dependencies` holds the `src/core/a.ts, b.ts, c.ts` cycle, and possibly the barrel pair (fallow 3.27.0 reported the barrel pair as a circular dependency too in the probe);
  - `re_export_cycles` has one `multi-node` entry over `src/barrel/index.ts, src/barrel/x.ts`;
  - `boundary_violations` has exactly one entry, `src/ui/view.ts → src/data/db.ts`;
  - `unresolved_imports` has one entry, `./does-not-exist` in `src/index.ts`;
  - there is no `boundaries-not-configured` diagnostic.

  The no-boundaries recording has `boundary_violations: []` and a `boundaries-not-configured` diagnostic. **Write the observed facts** (counts, and whether 3.21.0 emits `edges`) into the README table. Later tasks' expected values come from these files, never from this plan's guesses.
- [ ] **Step 5: Document.** In `tests/fixtures/fallow/README.md`, add a "Relations project (WP-03 Part 1, N34)" section: what each file contributes, the three recording commands, and the observed facts from Step 4.
- [ ] **Step 6: Widen the fixture list.** In `tests/fixtures/fallow-fixture.ts`:
  ```ts
  export const RELATION_FIXTURES = ['relations-combined-3.27.0', 'relations-combined-3.21.0', 'relations-no-boundaries-3.27.0'] as const;
  export type FallowFixture = (typeof FALLOW_FIXTURES)[number] | (typeof RELATION_FIXTURES)[number];
  export const RELATIONS_PROJECT_DIR = fileURLToPath(new URL('./fallow/relations-project/', import.meta.url));
  ```
- [ ] **Step 7: Write the fixture test** (`tests/unit/fallow-relations-fixtures.test.ts`). Each recording must:
  - be accepted by `parseFallowReportText`;
  - have `kind: 'combined'` and schema 12 (3.27.0) or 11 (3.21.0);
  - contain the four `check` keys as arrays;
  - have `health.file_scores` as an array.

  Also assert that the no-boundaries file has a `boundaries-not-configured` diagnostic and the 3.27.0 file does not. Run it: it passes on its own. This task has no production code, and the recordings are its deliverable. The RED proof is a mutation: rename `.fallowrc.json`'s diagnostic expectation to the wrong file, watch it fail, and revert.
- [ ] **Step 8: Gate and commit.**
  ```bash
  npm run typecheck && npm run lint:fast && npx eslint tests/fixtures/fallow-fixture.ts tests/unit/fallow-relations-fixtures.test.ts --max-warnings 0 && npx vitest run tests/unit/fallow-relations-fixtures.test.ts
  git add tests/fixtures/fallow tsconfig.test.json eslint.config.mjs .oxlintrc.json tests/fixtures/fallow-fixture.ts tests/unit/fallow-relations-fixtures.test.ts
  git commit -m "test(fixtures): record the fallow relations project on 3.21.0 and 3.27.0 (WP-03 N34)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

### Task 2: The relation graph and its queries (domain)

**Files:**
- Create: `src/domain/relations/graph.ts`, `src/domain/relations/queries.ts`
- Modify: `src/ui/read-models/architecture.ts` (delete `cyclicComponents` and import `stronglyConnected` instead: the one behaviour-preserving move, N16)
- Test: `tests/unit/relation-queries.test.ts` (new); `tests/unit/architecture-model.test.ts` (only if it imports `cyclicComponents`; point it at the domain function)

**Interfaces:**
- Produces (exact):
  ```ts
  // graph.ts
  export interface DirectedEdge { readonly from: string; readonly to: string }
  export interface RelationIndex {
    readonly edges: readonly DirectedEdge[];                        // distinct, first-seen order, no self-loops
    readonly outgoing: ReadonlyMap<string, readonly string[]>;      // sorted by id
    readonly incoming: ReadonlyMap<string, readonly string[]>;      // sorted by id
  }
  export function createRelationIndex(edges: readonly DirectedEdge[]): RelationIndex;
  // queries.ts
  export type RelationDirection = 'in' | 'out' | 'both';
  export interface NeighbourEdge { readonly from: string; readonly to: string; readonly hop: 1 | 2; readonly direction: 'in' | 'out' }
  export interface Neighbourhood { readonly edges: readonly NeighbourEdge[]; readonly hidden: number }
  export function neighbourhood(index: RelationIndex, node: string, opts: { direction: RelationDirection; hops: 1 | 2; limit: number }): Neighbourhood;
  export function stronglyConnected(nodes: readonly string[], edges: readonly DirectedEdge[]): string[][];
  export function aggregateEdges(edges: readonly DirectedEdge[], groupOf: (node: string) => string): { from: string; to: string; count: number }[];
  ```

- [ ] **Step 1: Write the failing tests** (`tests/unit/relation-queries.test.ts`). Use one hand-authored graph:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { createRelationIndex } from '../../src/domain/relations/graph';
  import { aggregateEdges, neighbourhood, stronglyConnected } from '../../src/domain/relations/queries';

  // a→b, b→c, c→a (a cycle); d→a; a→e; e→f; g isolated; a→b duplicated; h→h self-loop.
  const E = [
    { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }, { from: 'd', to: 'a' },
    { from: 'a', to: 'e' }, { from: 'e', to: 'f' }, { from: 'a', to: 'b' }, { from: 'h', to: 'h' },
  ];
  const index = createRelationIndex(E);

  describe('createRelationIndex (N16)', () => {
    it('merges duplicate pairs and drops self-loops', () => {
      expect(index.edges).toHaveLength(6);
      expect(index.edges.some((e) => e.from === 'h')).toBe(false);
    });
    it('sorts adjacency by id', () => {
      expect(index.outgoing.get('a')).toEqual(['b', 'e']);
      expect(index.incoming.get('a')).toEqual(['c', 'd']);
    });
  });

  describe('neighbourhood (N17)', () => {
    it('out, 1 hop', () => {
      expect(neighbourhood(index, 'a', { direction: 'out', hops: 1, limit: 10 }).edges)
        .toEqual([{ from: 'a', to: 'b', hop: 1, direction: 'out' }, { from: 'a', to: 'e', hop: 1, direction: 'out' }]);
    });
    it('in, 1 hop', () => {
      expect(neighbourhood(index, 'a', { direction: 'in', hops: 1, limit: 10 }).edges.map((e) => e.from)).toEqual(['c', 'd']);
    });
    it('both orders hop, then out before in, then the other end', () => {
      const got = neighbourhood(index, 'a', { direction: 'both', hops: 1, limit: 10 }).edges;
      expect(got.map((e) => `${e.direction}:${e.from}>${e.to}`)).toEqual(['out:a>b', 'out:a>e', 'in:c>a', 'in:d>a']);
    });
    it('2 hops continues in the same direction and never back through the node', () => {
      const got = neighbourhood(index, 'a', { direction: 'out', hops: 2, limit: 10 }).edges;
      expect(got.map((e) => `${e.hop}:${e.from}>${e.to}`)).toEqual(['1:a>b', '1:a>e', '2:b>c', '2:e>f']);
      // c→a is NOT hop 2 of 'out': it goes back through a.
    });
    it('limit keeps the first n and counts the rest as hidden', () => {
      const got = neighbourhood(index, 'a', { direction: 'both', hops: 2, limit: 3 });
      expect(got.edges).toHaveLength(3);
      expect(got.hidden).toBe(neighbourhood(index, 'a', { direction: 'both', hops: 2, limit: 100 }).edges.length - 3);
    });
    it('an edge reached both ways appears once, at its lowest hop', () => {
      const cyc = createRelationIndex([{ from: 'x', to: 'y' }, { from: 'y', to: 'x' }, { from: 'y', to: 'z' }]);
      const got = neighbourhood(cyc, 'x', { direction: 'both', hops: 2, limit: 10 }).edges;
      expect(got.filter((e) => e.from === 'y' && e.to === 'x')).toHaveLength(1);
    });
    it('a disconnected node has an empty neighbourhood', () => {
      expect(neighbourhood(index, 'g', { direction: 'both', hops: 2, limit: 10 })).toEqual({ edges: [], hidden: 0 });
    });
  });

  describe('stronglyConnected (N18)', () => {
    it('keeps groups of more than one node; overlapping cycles form one group', () => {
      const edges = [...E, { from: 'c', to: 'b' }];
      expect(stronglyConnected(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], edges)).toEqual([['a', 'b', 'c']]);
    });
  });

  describe('aggregateEdges (N19)', () => {
    it('counts distinct file edges between different groups', () => {
      const group = (n: string): string => (n === 'a' || n === 'b' ? 'G1' : 'G2');
      expect(aggregateEdges(index.edges, group)).toEqual([
        { from: 'G1', to: 'G2', count: 2 },   // b→c, a→e
        { from: 'G2', to: 'G1', count: 2 },   // c→a, d→a
      ]);
    });
  });
  ```
- [ ] **Step 2: Run the tests to see them fail.** `npx vitest run tests/unit/relation-queries.test.ts` gives FAIL (the modules do not exist).
- [ ] **Step 3: Implement `graph.ts`.**
  ```ts
  // WP-03 N16: a directed graph over string node ids, built once and queried many times.
  // Pure and provider-neutral: no fallow words, no UI. Duplicate (from, to) pairs merge and
  // self-loops are dropped, so every query sees each directed pair once.
  export interface DirectedEdge { readonly from: string; readonly to: string }

  export interface RelationIndex {
    readonly edges: readonly DirectedEdge[];
    readonly outgoing: ReadonlyMap<string, readonly string[]>;
    readonly incoming: ReadonlyMap<string, readonly string[]>;
  }

  function add(map: Map<string, string[]>, key: string, value: string): void {
    const list = map.get(key);
    if (list) list.push(value); else map.set(key, [value]);
  }

  const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

  export function createRelationIndex(edges: readonly DirectedEdge[]): RelationIndex {
    const seen = new Map<string, Set<string>>();
    const distinct: DirectedEdge[] = [];
    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();
    for (const { from, to } of edges) {
      if (from === to) continue;
      let targets = seen.get(from);
      if (!targets) { targets = new Set(); seen.set(from, targets); }
      if (targets.has(to)) continue;
      targets.add(to);
      distinct.push({ from, to });
      add(outgoing, from, to);
      add(incoming, to, from);
    }
    for (const list of outgoing.values()) list.sort(byId);
    for (const list of incoming.values()) list.sort(byId);
    return { edges: distinct, outgoing, incoming };
  }
  ```
  Use code-unit ordering (`byId`), not `localeCompare`: ids are NUL-joined entity ids, and ordering must not depend on the locale (J3).
- [ ] **Step 4: Implement `queries.ts`.** `neighbourhood`:
  ```ts
  type Side = 'in' | 'out';
  const SIDES: Readonly<Record<RelationDirection, readonly Side[]>> = { out: ['out'], in: ['in'], both: ['out', 'in'] };
  const pairKey = (from: string, to: string): string => JSON.stringify([from, to]);

  export function neighbourhood(index: RelationIndex, node: string, opts: { direction: RelationDirection; hops: 1 | 2; limit: number }): Neighbourhood {
    const sides = SIDES[opts.direction];
    const seen = new Set<string>();
    const found: NeighbourEdge[] = [];
    const push = (from: string, to: string, hop: 1 | 2, direction: Side): void => {
      const key = pairKey(from, to);
      if (seen.has(key)) return;
      seen.add(key);
      found.push({ from, to, hop, direction });
    };
    const next = (side: Side, n: string): readonly string[] => (side === 'out' ? index.outgoing : index.incoming).get(n) ?? [];
    for (const side of sides) {
      for (const other of next(side, node)) push(side === 'out' ? node : other, side === 'out' ? other : node, 1, side);
    }
    if (opts.hops === 2) {
      for (const side of sides) {
        const layer: { near: string; far: string }[] = [];
        for (const near of next(side, node)) {
          for (const far of next(side, near)) {
            if (far !== node) layer.push({ near, far });
          }
        }
        layer.sort((a, b) => byId(a.far, b.far) || byId(a.near, b.near));
        for (const { near, far } of layer) push(side === 'out' ? near : far, side === 'out' ? far : near, 2, side);
      }
    }
    return { edges: found.slice(0, opts.limit), hidden: Math.max(0, found.length - opts.limit) };
  }
  ```
  Copy `byId` locally; do not export it from `graph.ts` unless Task 6 also imports it (the dead-export rule). Then:
  - `stronglyConnected`: move `cyclicComponents` from `architecture.ts` verbatim, renamed, with `localeCompare` replaced by `byId` for the member and group sort (J3).
  - `aggregateEdges`: count distinct `(groupOf(from), groupOf(to))` pairs where they differ, and return the result sorted by `from`, then `to`, with `byId`.
- [ ] **Step 5: Re-point Architecture.** In `src/ui/read-models/architecture.ts`, delete `cyclicComponents` and call `stronglyConnected(names, edges)`. The Architecture tests stay green: this task changes no Architecture behaviour. Its sample edges go in Task 7.
- [ ] **Step 6: Run the tests.** `npx vitest run tests/unit/relation-queries.test.ts tests/unit/architecture-model.test.ts` gives PASS.
- [ ] **Step 7: Gate and commit** (`feat(domain): relation index, neighbourhood, strongly connected groups and aggregation (WP-03 N16–N19)`).

### Task 3: The report reader reads the relation sections

**Files:**
- Modify: `src/application/evidence/fallow-report-schema.ts`, `src/application/evidence/raw-fallow.ts`, `src/application/evidence/read-fallow-report.ts`
- Modify: `tests/fixtures/fallow-fixture.ts` (`DROPPED_KEYS` loses `'file_scores'`; J4)
- Test: `tests/unit/fallow-relations-reader.test.ts` (new). `tests/unit/fallow-report-reader.test.ts` is only edited if its "drops file_scores" assertion needs the J4 change.

**Interfaces:**
- Consumes: `RELATION_FIXTURES`, `fallowDoc`, `fallowOutcome`, `rawReport` (Task 1).
- Produces, in `raw-fallow.ts`:
  ```ts
  export interface RawCycleEdge { path: string; line: number; col: number }
  export interface RawCircularDependency { files: readonly string[]; line: number; col: number; edges?: readonly RawCycleEdge[] }
  export interface RawReExportCycle { files: readonly string[]; kind: 'multi-node' | 'self-loop' }
  export interface RawBoundaryViolation { from_path: string; to_path: string; from_zone: string; to_zone: string; import_specifier: string; line: number; col: number }
  export interface RawUnresolvedImport { path: string; specifier: string; line: number; col: number }
  export interface RawFileScore { path: string; fan_in: number; fan_out: number }
  // RawCheckSection gains (all optional, N2):
  circular_dependencies?: readonly RawCircularDependency[];
  re_export_cycles?: readonly RawReExportCycle[];
  boundary_violations?: readonly RawBoundaryViolation[];
  unresolved_imports?: readonly RawUnresolvedImport[];
  // RawHealthSection gains:
  file_scores?: readonly RawFileScore[];
  ```

- [ ] **Step 1: Write the failing tests** (`tests/unit/fallow-relations-reader.test.ts`):
  ```ts
  import { describe, expect, it } from 'vitest';
  import { deepKeys, fallowDoc, fallowOutcome, rawReport } from '../fixtures/fallow-fixture';

  const checkOf = (r: ReturnType<typeof rawReport>) => (r.kind === 'combined' ? r.check : undefined);
  const healthOf = (r: ReturnType<typeof rawReport>) => (r.kind === 'combined' ? r.health : undefined);

  describe('relation sections (N1)', () => {
    it.each(['relations-combined-3.27.0', 'relations-combined-3.21.0'] as const)('%s: reads the four check arrays and file_scores', (name) => {
      const r = rawReport(name);
      expect(checkOf(r)?.circular_dependencies?.length).toBeGreaterThan(0);
      expect(checkOf(r)?.re_export_cycles).toHaveLength(1);
      expect(checkOf(r)?.boundary_violations).toHaveLength(1);
      expect(checkOf(r)?.unresolved_imports).toHaveLength(1);
      expect(healthOf(r)?.file_scores?.length).toBeGreaterThan(0);
    });
    it('keeps only the read fields', () => {
      const keys = deepKeys(rawReport('relations-combined-3.27.0'));
      for (const dropped of ['actions', 'introduced', 'is_cross_package', 'specifier_col', 'maintainability_index', 'dead_code_ratio']) {
        expect(keys.has(dropped)).toBe(false);
      }
      expect(keys.has('fan_in')).toBe(true);
    });
    it('an absent section stays absent (N2)', () => {
      const doc = fallowDoc('relations-combined-3.27.0', (d) => { delete d.check!.circular_dependencies; delete (d.health as Record<string, unknown>).file_scores; });
      const r = rawReport(doc);
      expect(checkOf(r)?.circular_dependencies).toBeUndefined();
      expect(healthOf(r)?.file_scores).toBeUndefined();
    });
  });

  describe('each element is walked by hand, first failure wins (E31)', () => {
    const cycles = (d: { check?: unknown }) => (d.check as { circular_dependencies: Record<string, unknown>[] }).circular_dependencies;
    it('a bad cycle file', () => {
      expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => { cycles(d)[0]!.files = [1]; })))
        .toBe('invalid check.circular_dependencies.0.files.0');
    });
    it('a bad cycle edge', () => {
      expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => { cycles(d)[0]!.edges = [{ path: 'a', line: -1, col: 0 }]; })))
        .toBe('invalid check.circular_dependencies.0.edges.0.line');
    });
    it('a bad violation', () => {
      expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => {
        (d.check as { boundary_violations: Record<string, unknown>[] }).boundary_violations[0]!.to_zone = 7;
      }))).toBe('invalid check.boundary_violations.0.to_zone');
    });
    it('a bad re-export kind', () => {
      expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => {
        (d.check as { re_export_cycles: Record<string, unknown>[] }).re_export_cycles[0]!.kind = 'triangle';
      }))).toBe('invalid check.re_export_cycles.0.kind');
    });
    it('a bad file score', () => {
      expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => {
        (d.health as { file_scores: Record<string, unknown>[] }).file_scores[0]!.fan_in = 1.5;
      }))).toBe('invalid health.file_scores.0.fan_in');
    });
    it('a tool string over 1,024 characters (N1)', () => {
      expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => {
        (d.check as { unresolved_imports: Record<string, unknown>[] }).unresolved_imports[0]!.specifier = 'x'.repeat(1025);
      }))).toBe('invalid check.unresolved_imports.0.specifier');
    });
    it('a huge array of bad elements fails at the first one', () => {
      const bad = Array.from({ length: 50_000 }, () => ({}));
      expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => { (d.check as Record<string, unknown>).unresolved_imports = bad; })))
        .toBe('invalid check.unresolved_imports.0.path');
    });
    it('dead-code reports carry the same arrays at the top level', () => {
      const doc = fallowDoc('dead-code-3.27.0');
      expect(fallowOutcome(doc)).toBe('accepted');
      const r = rawReport(doc);
      expect(r.kind === 'dead-code' ? r.circular_dependencies : null).toEqual([]);
    });
  });
  ```
  Paths in the expected strings follow `pathDetail` (dot-joined), as in `fallow-report-reader.test.ts`. If zod reports the first issue at a different path for one case, check the existing reader test's convention before changing an expectation, and record any change as a deviation.
- [ ] **Step 2: Run the tests to see them fail.** The four arrays come back `undefined`, because the shell strips them.
- [ ] **Step 3: Update the schema** (`fallow-report-schema.ts`, about 164 → 200 lines):
  - Add `const TOOL_TEXT = z.string().max(1024);` (N1's bound for tool strings; J5).
  - Export element schemas:
    - `CYCLE_SHELL = z.object({ files: z.array(z.unknown()), line: COUNT, col: COUNT, edges: z.array(z.unknown()).optional() })`;
    - `CYCLE_FILE = TOOL_TEXT`;
    - `CYCLE_EDGE = z.object({ path: TOOL_TEXT, line: COUNT, col: COUNT })`;
    - `RE_EXPORT_CYCLE_SHELL = z.object({ files: z.array(z.unknown()), kind: z.enum(['multi-node', 'self-loop']) })`;
    - `BOUNDARY_VIOLATION = z.object({ from_path: TOOL_TEXT, to_path: TOOL_TEXT, from_zone: TOOL_TEXT, to_zone: TOOL_TEXT, import_specifier: TOOL_TEXT, line: COUNT, col: COUNT })`;
    - `UNRESOLVED_IMPORT = z.object({ path: TOOL_TEXT, specifier: TOOL_TEXT, line: COUNT, col: COUNT })`;
    - `FILE_SCORE = z.object({ path: TOOL_TEXT, fan_in: COUNT, fan_out: COUNT })`.
  - Add to `CHECK_SHELL_FIELDS`: `circular_dependencies`, `re_export_cycles`, `boundary_violations`, `unresolved_imports`, each `z.array(z.unknown()).optional()`.
  - Add to `HEALTH_SHELL_FIELDS`: `file_scores: z.array(z.unknown()).optional()`.
  - Update the header comment: `file_scores` is now read for three fields (N1).
- [ ] **Step 4: Update the raw types** (`raw-fallow.ts`) exactly as in **Interfaces**, and update its header comment.
- [ ] **Step 5: Update the reader** (`read-fallow-report.ts`, 183 → about 250). `ShellCheck` gains the four optional `unknown[]` fields; `ShellHealth` gains `file_scores?: unknown[]`. Add:
  ```ts
  /** N2: an absent array stays absent; a present one is walked by hand (E31). */
  function optionalArray<T>(items: unknown[] | undefined, check: Parameters<typeof firstArrayFailure<T>>[1], path: Path): Built<T[] | undefined> {
    if (items === undefined) return { ok: true, value: undefined };
    const result = firstArrayFailure(items, check, path);
    return result.ok ? { ok: true, value: result.values } : result;
  }

  /** Two levels, like buildDupes: the cycle shell, then its files, then its edges. */
  function checkCycle(item: unknown): { ok: true; value: RawCircularDependency } | { ok: false; path: PropertyKey[] } {
    const shell = CYCLE_SHELL.safeParse(item);
    if (!shell.success) return { ok: false, path: shell.error.issues[0]?.path ?? [] };
    const files = firstArrayFailure(shell.data.files, CYCLE_FILE, ['files']);
    if (!files.ok) return files;
    const edges = shell.data.edges === undefined ? undefined : firstArrayFailure(shell.data.edges, CYCLE_EDGE, ['edges']);
    if (edges !== undefined && !edges.ok) return edges;
    return { ok: true, value: { files: files.values, line: shell.data.line, col: shell.data.col, ...(edges === undefined ? {} : { edges: edges.values }) } };
  }
  ```
  Write `checkReExportCycle` the same way (the files walk plus `kind`). Hoist both validators to module scope (oxlint). In `buildCheck`, after the unused walks, call `optionalArray` for the four arrays (prefix `[...prefix, '<key>']`), and spread each present result in conditionally. In `buildHealth`, add `file_scores` with `FILE_SCORE`. If `firstArrayFailure`'s parameter type cannot be named with `Parameters<…>` under TS 6, write the union `z.ZodType<T> | ((item: unknown) => ElementResult<T>)` and export `ElementResult` from the schema module (J6).
- [ ] **Step 6: Apply J4.** In `tests/fixtures/fallow-fixture.ts`, remove `'file_scores'` from `DROPPED_KEYS`. Add a comment that `file_scores` is kept for `path`/`fan_in`/`fan_out` only (N1). Then run `tests/unit/fallow-report-reader.test.ts`. If a case there asserts `file_scores` is absent, change it to assert that the only keys under `file_scores[0]` are `path`, `fan_in` and `fan_out`.
- [ ] **Step 7: Run the tests.** `npx vitest run tests/unit/fallow-relations-reader.test.ts tests/unit/fallow-report-reader.test.ts tests/unit/fallow-relations-fixtures.test.ts` gives PASS.
- [ ] **Step 8: Gate and commit** (`feat(evidence): read fallow cycles, re-export cycles, boundary violations, unresolved imports and file scores (WP-03 N1, N2)`).

### Task 4: The evidence model, the relation normaliser and the copy for the new kinds

**Files:**
- Create: `src/application/evidence/draft-finding.ts`, `src/application/evidence/normalize-relations.ts`
- Modify: `src/application/evidence/model.ts`, `src/application/evidence/normalize-fallow.ts`, `src/ui/audit-copy/quality.ts`, `src/ui/audit-copy/fallow.ts`
- Modify (fixtures and pinned tests): `tests/fixtures/evidence-report.ts` (`ALL_ANALYSED` gains the three categories, and `emptyEvidenceReport` gains `relations`/`notConfigured`), `tests/fixtures/fallow-expected.ts` (id helpers `cy`, `bv`, `ur`), `tests/unit/normalize-fallow.test.ts` (the category-set pins), `tests/unit/normalize-fallow-ids.test.ts` (the id regex), `tests/component/connect-fallow.test.ts` and `tests/component/fallow-card.test.ts` (the not-shown and category lines)
- Test: `tests/unit/normalize-relations.test.ts` (new), `tests/unit/relation-copy.test.ts` (new)

**Interfaces:**
- Consumes: the Task 3 raw types.
- Produces, in `model.ts`:
  ```ts
  export type FindingCategory = 'complexity' | 'duplication' | 'unused-exports' | 'cycle' | 'boundary' | 'unresolved-import';
  export const FINDING_CATEGORIES: readonly FindingCategory[] = ['complexity', 'duplication', 'unused-exports', 'cycle', 'boundary', 'unresolved-import'];
  export type FindingRule = 'complexity' | 'duplication' | 'unused-export' | 'unused-type'
    | 'circular-dependencies' | 're-export-cycle' | 'boundary-violation' | 'unresolved-imports';
  export interface RelationHop { readonly from: string; readonly to: string; readonly line: number | null }
  // FindingDetail gains:
  | { kind: 'cycle'; cycleKind: 'import' | 're-export'; members: readonly string[]; hops: readonly RelationHop[] }
  | { kind: 'boundary'; toPath: string; fromZone: string; toZone: string; specifier: string }
  | { kind: 'unresolved-import'; specifier: string }
  // EvidenceFinding gains:  related?: readonly string[];
  export interface ReportedCycle { findingId: string; files: readonly string[]; hops: readonly RelationHop[] }
  export interface ReportedReExportCycle { findingId: string; files: readonly string[]; kind: 'multi-node' | 'self-loop' }
  export interface ReportedBoundaryViolation { findingId: string; from: string; to: string; fromZone: string; toZone: string; specifier: string; line: number }
  export interface ReportedUnresolvedImport { findingId: string; path: string; specifier: string; line: number }
  export interface ReportedFan { path: string; fanIn: number; fanOut: number }
  export type BoundariesState = 'configured' | 'not-configured' | 'not-reported';
  export interface RelationEvidence {
    importCycles: readonly ReportedCycle[];
    reExportCycles: readonly ReportedReExportCycle[];
    boundaryViolations: readonly ReportedBoundaryViolation[];
    unresolvedImports: readonly ReportedUnresolvedImport[];
    /** null: the report has no `health.file_scores` (J7). */
    fan: readonly ReportedFan[] | null;
    boundaries: BoundariesState;
    /** A check section with both cycle arrays was read (the `cycle` category is analysed). */
    cyclesReported: boolean;
  }
  // NormalizedEvidence gains:  relations: RelationEvidence;  notConfigured: readonly FindingCategory[];
  ```
- Produces, in `draft-finding.ts` (moved out of `normalize-fallow.ts`, J8):
  ```ts
  export type FindingPrefix = 'CX' | 'DU' | 'UN' | 'CY' | 'BV' | 'UR';
  export interface DraftFinding { key: string; prefix: FindingPrefix; finding: Omit<EvidenceFinding, 'id'> }
  export type PathMapper = (reportPath: string) => string | null;
  ```
- Produces, in `normalize-relations.ts`:
  ```ts
  export interface RelationDrafts { drafts: readonly DraftFinding[]; assemble(idByKey: ReadonlyMap<string, string>): RelationEvidence }
  export function relationDrafts(check: RawCheckSection | null, health: RawHealthSection | null,
    diagnostics: readonly RawWorkspaceDiagnostic[], mapPath: PathMapper): RelationDrafts;
  ```
- `assignIds` in `normalize-fallow.ts` also returns `idByKey: Map<string, string>` (module-private).

- [ ] **Step 1: Write the failing tests** (`tests/unit/normalize-relations.test.ts`). Build reports with `rawReport(...)` and `normalizeFallow(raw, { stripPrefix: null })`. Take each expected value from the recording (Task 1's README facts), never from memory. Cases:
  - **Import cycles:** `relations.importCycles` holds the `src/core/a.ts → b.ts → c.ts` cycle. Its `files` are in fallow's order, and `hops[i]` is `files[i] → files[(i+1) % n]` with the recorded `edges[i].line`.
  - **Re-export cycles:** `relations.reExportCycles` has one `multi-node` entry, with its sorted files.
  - **Boundary violations and unresolved imports:** `relations.boundaryViolations[0]` is `{ from: 'src/ui/view.ts', to: 'src/data/db.ts', fromZone: 'ui', toZone: 'data', … }`. `relations.unresolvedImports[0]` is `{ path: 'src/index.ts', specifier: './does-not-exist', line: 4 }`.
  - **Fan:** `relations.fan` contains `src/core/a.ts` with the recorded `fan_in`/`fan_out`.
  - **Boundaries state:** `configured` in both relation recordings; `not-configured` in `relations-no-boundaries-3.27.0` (with `notConfigured: ['boundary']`); `not-reported` for `combined-3.27.0` after deleting `check.boundary_violations`.
  - **Categories:** in `relations-combined-3.27.0` the three new ones are `analysed`. In the no-boundaries recording `boundary` is `not-analysed`.
  - **Findings:**
    - one `CY-` finding per import cycle and per re-export cycle, anchored on the alphabetically first member, with `related` holding the others in sorted order, rule `circular-dependencies` or `re-export-cycle`, `severity: null`, and `detail.members`/`hops`;
    - a `BV-` finding anchored on `src/ui/view.ts` at the recorded line, with `related: ['src/data/db.ts']`;
    - a `UR-` finding on `src/index.ts` with no `related` key (`'related' in f` is false).
  - **Ids:** each relation's `findingId` equals its finding's `id`.
  - **Keys stable across line changes:** changing every `line` in the recording keeps every `CY-`/`BV-`/`UR-` id.
  - **Misaligned edges (Review Focus 1):** with `edges[0].path` set to a different member, hop 0 has `line: null` and hops 1–2 keep their lines. With `edges` deleted, every hop has `line: null`. Neither case throws.
  - **Refused paths:** a cycle with a member `../outside.ts` is dropped whole, and `../outside.ts` is in `rejectedPaths`. The same holds for a violation whose `to_path` is absolute (`C:/x.ts`).
  - **Strip prefix (Review Focus 3):** prefix every relation path in the recording with `pkg/` and normalise with `{ stripPrefix: 'pkg/' }`. The cycles, violation, unresolved import and fan paths come back unprefixed.
  - **Not shown:** `notShown` no longer lists `circular_dependencies`, `re_export_cycles`, `boundary_violations` or `unresolved_imports`. It still lists `boundary_coverage_violations` when that count is non-zero (set it to 2 in a copy).

  And `tests/unit/relation-copy.test.ts`:
  - `FINDING_TITLE_FOR` for each new detail kind gives the rule label: "Import cycle · 3 files", "Boundary violation · ui → data", "Unresolved import · ./does-not-exist";
  - `FINDING_DIALOG_RULE_VALUE` for each kind includes the rule id and, for a cycle, the member count;
  - `RULE_TEXT('circular-dependencies')` is `circular-dependencies` (fallow's id, verbatim).
- [ ] **Step 2: Run the tests to see them fail.** The model has no relations.
- [ ] **Step 3: Update the model** (`model.ts`) exactly as in **Interfaces**. Update the `id` comment on `EvidenceFinding` to list all six prefixes.
- [ ] **Step 4: Create `draft-finding.ts`** with the three types. Remove `DraftFinding` and `PathMapper` from `normalize-fallow.ts` and import them (J8).
- [ ] **Step 5: Implement `normalize-relations.ts`** (about 170 lines):
  ```ts
  // WP-03 N3/N4/N9/N10: fallow's dependency evidence, path-level and snapshot-independent,
  // and the findings drawn from it. A relation and its finding share one id (assemble).
  import type { RawCheckSection, RawHealthSection, RawWorkspaceDiagnostic, RawCircularDependency } from './raw-fallow';
  import type { DraftFinding, PathMapper } from './draft-finding';
  import type { RelationEvidence, RelationHop, BoundariesState } from './model';

  const BOUNDARIES_NOT_CONFIGURED = 'boundaries-not-configured';

  /** Every path mapped, or null when any was refused (the whole record is then dropped, N3). */
  function mapAll(paths: readonly string[], mapPath: PathMapper): string[] | null {
    const out: string[] = [];
    let refused = false;
    for (const p of paths) {
      const mapped = mapPath(p);        // records a refused path in `rejected` itself
      if (mapped === null) refused = true; else out.push(mapped);
    }
    return refused ? null : out;
  }

  const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

  /** N3: hops[i] = files[i] → files[(i+1) % n], with edges[i].line only when edges[i] is really files[i]'s import. */
  function hopsOf(raw: RawCircularDependency, mapped: readonly string[]): RelationHop[] {
    return mapped.map((from, i) => {
      const edge = raw.edges?.[i];
      const line = edge !== undefined && edge.path === raw.files[i] ? edge.line : null;
      return { from, to: mapped[(i + 1) % mapped.length]!, line };
    });
  }

  function boundariesOf(check: RawCheckSection | null, diagnostics: readonly RawWorkspaceDiagnostic[]): BoundariesState {
    if (check === null || check.boundary_violations === undefined) return 'not-reported';
    return diagnostics.some((d) => d.kind === BOUNDARIES_NOT_CONFIGURED) ? 'not-configured' : 'configured';
  }
  ```
  Then `relationDrafts` builds, in this order: import cycles, re-export cycles, boundary violations, unresolved imports. Each produces:
  - a `DraftFinding` with its N9 key and prefix, anchored as N10 says (sorted members, anchor = first; `line` = the anchor's hop line for import cycles, null for re-export cycles);
  - a pending relation record holding that key.

  `assemble(idByKey)` maps each pending record to its `Reported*` with `findingId: idByKey.get(key)!`. It is always present, because `assignIds` saw every key. It returns the `RelationEvidence`, with:
  - `fan`: `health?.file_scores === undefined ? null : …`, each path mapped, and refused paths dropped;
  - `boundaries`: from `boundariesOf`;
  - `cyclesReported`: `check !== null && check.circular_dependencies !== undefined && check.re_export_cycles !== undefined`.

  Keys: `import|` + sorted members joined with `\n`; `re-export|` + members joined with `\n`; `${from}|${to}|${specifier}`; `${path}|${specifier}`. Findings:
  - **Import cycle:** `{ category: 'cycle', rule: 'circular-dependencies', severity: null, path: anchor, line, endLine: null, symbol: null, detail: { kind: 'cycle', cycleKind: 'import', members: sorted, hops }, ...(related.length ? { related } : {}) }`.
  - **Re-export cycle:** the same shape, with rule `re-export-cycle`, `cycleKind: 're-export'` and `hops: []`.
  - **Boundary violation:** `{ category: 'boundary', rule: 'boundary-violation', path: from, line, related: [to], detail: { kind: 'boundary', toPath: to, fromZone, toZone, specifier } }`.
  - **Unresolved import:** `{ category: 'unresolved-import', rule: 'unresolved-imports', path, line, detail: { kind: 'unresolved-import', specifier } }`, with no `related`.
- [ ] **Step 6: Wire the normaliser** (`normalize-fallow.ts`; keep it under 300 lines).
  - `assignIds` returns `{ findings, idByKey }`, recording `idByKey.set(draft.key, id)` for the first draft of each key.
  - `normalizeFallow` calls `const rel = relationDrafts(s.check, s.health, raw.workspace_diagnostics ?? [], mapPath)` and appends `...rel.drafts` after the unused drafts. It then sets `relations: rel.assemble(idByKey)` and `notConfigured: relations.boundaries === 'not-configured' ? ['boundary'] : []`.
  - `categories` gains `cycle: analysed(relations.cyclesReported)`, `boundary: analysed(relations.boundaries === 'configured')` and `'unresolved-import': analysed(s.check?.unresolved_imports !== undefined)`.
  - `SHOWN_SUMMARY_KEYS` gains `'circular_dependencies'`, `'re_export_cycles'`, `'boundary_violations'` and `'unresolved_imports'`.
- [ ] **Step 7: Update the copy for the new kinds** (`audit-copy/quality.ts`):
  - Retype `FINDING_KIND_LABEL` and `FINDING_TITLE` as `Readonly<Record<FindingCategory, string>>` and add:
    - `cycle`: 'Import cycle' / 'Import cycle reported';
    - `boundary`: 'Boundary violation' / 'Import crosses a configured boundary';
    - `'unresolved-import'`: 'Unresolved import' / 'Import could not be resolved'.
  - Add to `FINDING_RULE_LABEL`: `'circular-dependencies': 'circular-dependencies'`, `'re-export-cycle': 're-export-cycle'`, `'boundary-violation': 'boundary-violation'`, `'unresolved-imports': 'unresolved-imports'`. These are fallow's ids, verbatim (spec §2).
  - In `FINDING_TITLE_FOR` and `FINDING_DIALOG_RULE_VALUE`, replace `default:` with `case 'unused':` plus these cases, and end both switches with a `never` check:
    - **cycle:** the title is `${detail.cycleKind === 'import' ? 'Import cycle' : 'Re-export cycle'} · ${detail.members.length} files`; the dialog value is `${label}: ${detail.members.length} files in the cycle. Reported by fallow; type-only imports are not reported.`;
    - **boundary:** the title is `Boundary violation · ${detail.fromZone} → ${detail.toZone}`; the dialog value is `${label}: imports ${detail.toPath} (${detail.fromZone} → ${detail.toZone}), which the analysed folder's fallow boundaries do not allow.`;
    - **unresolved-import:** the title is `Unresolved import · ${detail.specifier}`; the dialog value is `${label}: ${detail.specifier} could not be resolved in this analysis scope.`.

  In `audit-copy/fallow.ts`, add `export const FALLOW_BOUNDARIES_NOT_CONFIGURED = 'Boundaries are not configured in fallow, so none were checked.';`.
- [ ] **Step 8: Update the pinned tests and fixtures.** Change these in place, keeping each test's intent:
  - `ALL_ANALYSED` gains the three new categories;
  - `emptyEvidenceReport` gains `relations: { importCycles: [], reExportCycles: [], boundaryViolations: [], unresolvedImports: [], fan: null, boundaries: 'not-reported', cyclesReported: false }` and `notConfigured: []`;
  - `normalize-fallow.test.ts`'s three-key category literals become six-key. The recorded `combined-3.27.0` has `boundaries-not-configured`, so `boundary: 'not-analysed'` there; `cycle` and `unresolved-import` are `analysed`;
  - the "not shown includes circular_dependencies" case now expects it absent, and uses `boundary_coverage_violations` for the not-shown path instead;
  - the id regex becomes `/^(CX|DU|UN|CY|BV|UR)-[0-9a-f]{8}$/`;
  - `connect-fallow.test.ts`: the injected `summary.circular_dependencies = 2` not-shown line becomes `summary.boundary_coverage_violations = 2`;
  - `fallow-card.test.ts`: the category lines list six categories.

  Record every changed pin in the task report.
- [ ] **Step 9: Run the tests.**
  ```bash
  npx vitest run tests/unit/normalize-relations.test.ts tests/unit/relation-copy.test.ts tests/unit/normalize-fallow.test.ts tests/unit/normalize-fallow-ids.test.ts tests/unit/normalize-fallow-id-collisions.test.ts tests/unit/finding-copy.test.ts tests/unit/fallow-copy.test.ts tests/component/connect-fallow.test.ts tests/component/fallow-card.test.ts tests/unit/evidence-model.test.ts tests/harness/harness-evidence.test.ts
  ```
  Expected: PASS. `evidence-model.test.ts` pins the `EvidenceReport` keys, not the `NormalizedEvidence` keys. If it pins the latter, add the two new keys.
- [ ] **Step 10: Gate and commit** (`feat(evidence): cycles, boundary violations and unresolved imports as findings, with path-level relation evidence (WP-03 N3, N4, N9–N11)`).

### Task 5: The evidence index, the Quality model and the lens

**Files:**
- Modify: `src/application/evidence/resolve-findings.ts`, `src/ui/read-models/evidence-index.ts`, `src/ui/read-models/findings.ts`, `src/ui/read-models/file-detail.ts` (the findings list reads `touching`), `src/ui/read-models/use-lens-view.ts`, `src/ui/audit-copy/quality.ts` (the structure card strings)
- Test: `tests/unit/evidence-index-relations.test.ts` (new), `tests/unit/findings-structure.test.ts` (new); edit in place `tests/unit/findings-model.test.ts` (card count 4 → 5) and `tests/unit/evidence-index.test.ts` (the partial expectations, if the not-configured rule changes them)

**Interfaces:**
- Consumes: `EvidenceFinding.related`, `NormalizedEvidence.notConfigured`, `FALLOW_BOUNDARIES_NOT_CONFIGURED` (Task 4).
- Produces:
  ```ts
  // evidence-index.ts
  export interface TouchingFinding { readonly finding: EvidenceFinding; readonly anchorId: EntityId }
  // EvidenceIndex gains:
  touching: ReadonlyMap<EntityId, readonly TouchingFinding[]>;
  count(n: number, c: FindingCategory | readonly FindingCategory[] | null): MetricValue;
  // findings.ts
  export const STRUCTURE_CATEGORIES: readonly FindingCategory[] = ['cycle', 'boundary', 'unresolved-import'];
  // FileFinding (file-detail.ts) gains: related: readonly string[]; anchored: boolean; anchorPath: string;  (J14)
  export function touchingFindings(file: FileSummary, evidence: EvidenceIndex): FileFinding[];
  // QualityCard.id: 'open' | 'structure' | FindingCategory
  ```

- [ ] **Step 1: Write the failing tests.** In `tests/unit/evidence-index-relations.test.ts`, use `snapshotWithPaths(<every path in the relations project>)` and a report built from `relations-combined-3.27.0` through `buildEvidenceReport` with the snapshot's id. Cases:
  - **`byFile` is anchor-only:** the cycle's `CY-` finding is listed under exactly one file, its alphabetically first member.
  - **`touching` covers every file involved:** the same finding is listed under every member, with that same `anchorId`. The `BV-` finding is under both `src/ui/view.ts` and `src/data/db.ts`.
  - **Counts:** `totals.findings` counts each finding once (it equals `matchedFindings`). `perFile(db.ts).findings` counts the violation.
  - **Unmatched related paths:** a snapshot missing `src/core/c.ts` keeps the cycle (its anchor `src/core/a.ts` matches), and `'src/core/c.ts'` is in `unmatchedPaths`.
  - **Not configured:** on the no-boundaries recording, `count(0, 'boundary')` is `unknown` with reason `FALLOW_BOUNDARIES_NOT_CONFIGURED`. `count(n, null)` is **not** `partial`, because every other category is analysed (N11).
  - **Category lists:** `count(3, ['cycle', 'boundary', 'unresolved-import'])` is `collected` on the relations recording, `partial` on the no-boundaries recording, and `unknown` when none of the three is analysed. For the last case, delete the check section: use `health-3.27.0` against the same snapshot.
  - **The lens:** `useLensView().reported` (mounted in a Pinia test app, as `findings-lens.test.ts` does) contains every cycle member and both ends of the violation.

  In `tests/unit/findings-structure.test.ts`:
  - `buildQualityModel(...)` has five cards, and the `structure` card counts open cycle, boundary and unresolved findings;
  - each finding appears once in `findings`;
  - `touchingFindings(db.ts file, index)` includes the violation with `anchored: false`, its fingerprint is `${viewTsId}#${id}`, and it has `related: ['src/data/db.ts']`.
- [ ] **Step 2: Run the tests to see them fail.**
- [ ] **Step 3: Update `resolveFindings`.** It also adds every `related` path that is not in `snapshotPaths` to `unmatched`, for every finding. Keep the anchor rule unchanged.
- [ ] **Step 4: Update `evidence-index.ts`** (keep it under 230):
  - `groupByFile` also builds `touching`: the anchor first, then each matched related path's file id, and never the same finding twice under one file.
  - `perFile` counts `touching` (so `evidenceOf` is fed the touching list's `finding`s).
  - `counterFor`'s total rule: `expected = FINDING_CATEGORIES.filter((c) => !report.normalized.notConfigured.includes(c))`; the total is present when every expected category is analysed, and partial when only some are.
  - A single not-configured category returns `unknown(FALLOW_BOUNDARIES_NOT_CONFIGURED, 'fallow')`.
  - A category list is present when all of it is analysed, partial when some is, and `notAnalysed()` when none is. A list whose only analysed-or-configured members are not-configured returns the not-configured unknown.
  - `category(c)` is unchanged.
- [ ] **Step 5: Update `findings.ts`.**
  - `titledFindings` stays anchor-only (Quality). Its rows gain `related: f.related ?? []` and `anchored: true`.
  - Add `touchingFindings(file, evidence)`, which maps `evidence.touching.get(file.id)` with `fingerprint: findingFingerprint(anchorId, f.id)` and `anchored: anchorId === file.id`.
  - The cards gain `{ id: 'structure', label: QUALITY_CARD_STRUCTURE, icon: 'git-fork', value: countList(STRUCTURE_CATEGORIES), caption: QUALITY_CARD_STRUCTURE_CAPTION, tone: 'warning' }` after `duplication`. `openFindingsValue` still reads `cards[0]`.
  - Add `QUALITY_CARD_STRUCTURE = 'Import structure'` and `QUALITY_CARD_STRUCTURE_CAPTION = 'Cycles, boundary violations and unresolved imports'` to `audit-copy/quality.ts`.
- [ ] **Step 6: Update `file-detail.ts`.** `findings: touchingFindings(file, evidence)`.
- [ ] **Step 7: Update `use-lens-view.ts`.** `reportedIdsFor` reads `index.touching.keys()` (N12). Update its comment.
- [ ] **Step 8: Fix the pins in place.** `findings-model.test.ts` `toHaveLength(4)` → 5. In `evidence-index.test.ts`, any `partial` expectation that came only from categories now analysed stays correct; change only what the new rule changes, and list each change.
- [ ] **Step 9: Run the tests.**
  ```bash
  npx vitest run tests/unit/evidence-index-relations.test.ts tests/unit/findings-structure.test.ts tests/unit/findings-model.test.ts tests/unit/evidence-index.test.ts tests/unit/resolve-findings.test.ts tests/unit/file-detail-model.test.ts tests/component/findings-lens.test.ts tests/component/quality-fallow.test.ts
  ```
  Expected: PASS.
- [ ] **Step 10: Gate and commit** (`feat(ui): touching findings, the not-configured rule, the Import structure card and a lens that paints every file a finding involves (WP-03 N11–N13)`).

### Task 6: The relation read model and fan-in

**Files:**
- Create: `src/ui/read-models/relations.ts`, `src/ui/audit-copy/relations.ts`
- Modify: `src/ui/inspector-copy.ts` (re-export `relations.ts`; remove `FILE_CARD_DEPENDENTS`/`_CAPTION`), `src/ui/read-models/use-read-models.ts` (expose `relations`), `src/ui/read-models/file-summaries.ts` (drop `directDependents`), `src/ui/fixtures/sample-signals.ts` (drop `directDependents`), `src/ui/read-models/file-detail.ts` (the `imported-by` card)
- Test: `tests/unit/relation-model.test.ts` (new); edit in place `tests/unit/file-detail-model.test.ts` (the dependents card)

**Interfaces:**
- Consumes: `RelationEvidence` (Task 4), `EvidenceIndex.count`/`state`/`report` (Task 5), `createRelationIndex` (Task 2).
- Produces (`relations.ts`):
  ```ts
  export type RelationSource = 'cycle' | 'boundary';
  export interface FileRef { readonly path: string; readonly id: EntityId | null }
  export interface RelationEdgeView { readonly from: EntityId; readonly to: EntityId; readonly fromPath: string; readonly toPath: string;
    readonly sources: readonly RelationSource[]; readonly line: number | null }
  export interface CycleView { readonly findingId: string; readonly kind: 'import' | 're-export'; readonly members: readonly FileRef[];
    readonly hops: readonly RelationHop[]; readonly matched: boolean; readonly fingerprint: string | null; readonly pathText: string }
  export interface BoundaryView { readonly findingId: string; readonly from: FileRef; readonly to: FileRef; readonly fromZone: string;
    readonly toZone: string; readonly line: number; readonly fingerprint: string | null }
  export interface UnresolvedView { readonly findingId: string; readonly file: FileRef; readonly specifier: string; readonly line: number }
  export interface RelationModel {
    readonly state: EvidenceIndexState;             // 'none' | 'current' | 'stale'
    readonly analysed: boolean;                     // the report's cycle category is analysed
    readonly boundaries: BoundariesState | 'none';
    readonly index: RelationIndex;                  // matched edges over EntityIds
    readonly edges: readonly RelationEdgeView[];
    edge(from: EntityId, to: EntityId): RelationEdgeView | undefined;
    readonly cycles: readonly CycleView[];          // import cycles first, then re-export cycles, each in report order
    readonly boundaryViolations: readonly BoundaryView[];
    readonly unresolved: readonly UnresolvedView[];
    readonly unmatchedEdges: number;
    fanIn(id: EntityId): MetricValue;
    fanOut(id: EntityId): MetricValue;
  }
  export function relationModelFor(files: readonly FileSummary[], evidence: EvidenceIndex): RelationModel;  // memo per index
  export function cyclePathText(hops: readonly RelationHop[]): string;   // "a.ts:35 → b.ts:15 → a.ts", ":?" for a null line
  ```
- `useReadModels()` gains `relations: ComputedRef<RelationModel>`.
- New copy constants (`audit-copy/relations.ts`, all from spec §2): `RELATIONS_SCOPE_NOTE`, `RELATIONS_SCOPE_SHORT`, `RELATIONS_STATIC_NOTE`, `RELATION_TYPE_UNKNOWN`, `RELATION_MEMBER_UNMATCHED`, `RELATION_FAN_NOT_SCORED`, `FILE_CARD_IMPORTED_BY`, `FILE_CARD_IMPORTED_BY_CAPTION`. Later tasks add the rest of §2 to this file.

- [ ] **Step 1: Write the failing tests** (`tests/unit/relation-model.test.ts`), with the snapshot and report of Task 5. Cases:
  - **Edges:** `edges` holds the three matched cycle hops and the violation `view.ts → db.ts`, each with its `sources` and line.
  - **One pair, two sources (Review Focus 2):** add a violation whose pair equals a cycle hop (`src/core/a.ts → src/core/b.ts`) to a copy of the recording. That edge appears once, with `sources: ['cycle', 'boundary']`, and `index.edges` has one entry for it.
  - **Cycles:** `cycles[0].pathText` equals `cyclePathText(hops)`, for example `src/core/a.ts:1 → src/core/b.ts:1 → src/core/c.ts:1 → src/core/a.ts`, with the lines from the recording. `fingerprint` is `${anchorId}#${findingId}`.
  - **Unmatched:** with `src/core/c.ts` missing from the snapshot, the cycle is kept with `matched: false`, the member `{ path: 'src/core/c.ts', id: null }` is present, and none of its hops is in `edges`. `unmatchedEdges` counts them (2 hops touch `c.ts`).
  - **Fan:** `fanIn(a.ts)` is `collected` with the recorded value. `fanIn(orphan.ts)` is either `collected` (if the recording scored it) or `unknown` with `RELATION_FAN_NOT_SCORED`; assert on whichever the recording shows, and name it in the test. Without `file_scores`, fan is unknown with `FALLOW_NOT_ANALYSED`. With no report, everything is unknown and `state === 'none'`.
  - **Stale (Review Focus 5):** a report attached with another `snapshotId` gives `state: 'stale'`, `fanIn(a.ts).state === 'stale'`, and the edges still resolve.
  - **Memoised:** `relationModelFor(files, index) === relationModelFor(files, index)`.
  - **`cyclePathText`:** `[{from:'a',to:'b',line:3},{from:'b',to:'a',line:null}]` gives `'a:3 → b:? → a'`.
- [ ] **Step 2: Run the tests to see them fail.**
- [ ] **Step 3: Implement `relations.ts`** (about 200 lines).
  - Resolve paths with `new Map(files.map((f) => [f.path, f.id]))`.
  - Build each edge from the matched cycle hops (source `cycle`, `line` = the hop's line) and the matched violations (source `boundary`, `line` = its line).
  - Merge same-pair edges: sources in the order `cycle`, `boundary`, and `line` = the first non-null.
  - `index = createRelationIndex(edges)`.
  - The present value's provenance is built as `evidence-index.ts` builds it (`{ source: 'fallow', detail: FALLOW_PROVENANCE_DETAIL(report.providerVersion, originOf(report)) }`), and the state is `stale` when `evidence.state === 'stale'`. Fan uses it.
  - Memoise with `WeakMap<EvidenceIndex, { files; model }>`.
- [ ] **Step 4: Expose it.** In `use-read-models.ts`, add `const relations = computed(() => relationModelFor(files.value, evidence.value));` and return it. Stay under 200 lines: move no-longer-needed code rather than compressing.
- [ ] **Step 5: Drop the sample fan-in and add Imported by.**
  - Remove `directDependents` from `sample-signals.ts` and `FileSummary`. The seeded-random sequence of the other sample signals must not change: keep consuming the `r()` draw that produced it, with a comment (J11). A changed draw order would silently change every sample value and every harness capture.
  - In `file-detail.ts`, the card becomes `{ id: 'imported-by', label: FILE_CARD_IMPORTED_BY, icon: 'link', value: relations.fanIn(file.id), unit: '', caption: FILE_CARD_IMPORTED_BY_CAPTION, tone: 'accent' }`. `buildFileDetail` takes a `relations: RelationModel` parameter (default `relationModelFor(files, evidence)`), and `fileDetailFor` in `use-read-models.ts` passes it.
  - `FileDetailCard.id` becomes `'complexity' | 'coverage' | 'imported-by' | 'priority'`.
  - Remove `FILE_CARD_DEPENDENTS`/`_CAPTION` from `inspector-copy.ts`. `grep -rn FILE_CARD_DEPENDENTS src tests` must come back empty.
- [ ] **Step 6: Run the tests.**
  ```bash
  npx vitest run tests/unit/relation-model.test.ts tests/unit/file-detail-model.test.ts tests/component/file-detail-screen.test.ts
  ```
  Expected: PASS. Update in place any File detail test that asserts the "Direct dependents" label: it now asserts "Imported by" with an unknown value in a no-report world.
- [ ] **Step 7: Gate and commit** (`feat(ui): relation read model over matched evidence, fallow fan-in as Imported by, sample fan-in removed (WP-03 N5–N8, N25 card)`).

### Task 7: The Architecture read model and the other relation surfaces

**Files:**
- Delete: `src/ui/fixtures/sample-module-edges.ts`
- Modify: `src/ui/read-models/architecture.ts`, `src/ui/read-models/use-read-models.ts`, `src/ui/read-models/overview.ts`, `src/ui/read-models/city-summary.ts`, `src/ui/read-models/sources.ts`, `src/ui/read-models/report.ts`, `src/ui/inspector-copy.ts` (spec §2 changed strings), `src/ui/audit-copy/relations.ts`, `src/ui/audit-copy/sources.ts`
- Modify (UI that reads the removed members; the minimal change only, since Task 9 redesigns the screen): `src/ui/screens/architecture/{BoundaryRuleTable,BoundaryInspector}.vue` (no `passing`), `src/ui/screens/ArchitectureScreen.vue` (the `illustrative` computed is removed, J12)
- Test: `tests/unit/architecture-relations.test.ts` (new); edit in place `tests/unit/architecture-model.test.ts`, `tests/unit/sources-model.test.ts`, `tests/component/architecture-rules.test.ts`, `tests/component/architecture-screen.test.ts`, `tests/component/overview-screen.test.ts`

**Interfaces:**
- Consumes: `RelationModel` (Task 6), `aggregateEdges` (Task 2), `evidence.count` (Task 5).
- Produces (`architecture.ts`):
  ```ts
  export interface ModuleEdge { from: string; to: string; meaning: 'evidenced-import'; imports: MetricValue }
  export interface ArchitectureGraph {
    allModules: readonly ModuleSummary[]; modules: readonly ModuleSummary[]; omittedModules: number;
    edges: readonly ModuleEdge[]; omittedEdges: number; relations: RelationModel;
  }
  export type RuleStatus = 'violation' | 'not-evaluated';
  export interface RuleEvaluation { rule: BoundaryRule; status: RuleStatus; violatingImports: MetricValue; reason: string | null }
  export interface ArchitectureCard { id: 'modules' | 'evidenced' | 'cycles' | 'violations'; … }   // other fields unchanged
  export function architectureGraphFor(files: readonly FileSummary[], relations: RelationModel): ArchitectureGraph;
  export function cyclesValue(relations: RelationModel): MetricValue;            // fallow's import-cycle count, in its evidence state
  export function cycleModules(cycle: CycleView): ReadonlySet<string>;           // moduleOf each matched member
  // ArchitectureModel: `usesSample` removed; gains `notAnalysed: boolean`.
  ```
- New copy (spec §2): `ARCH_CARD_EVIDENCED`, `RELATION_CARD_CYCLES`, `RELATION_CYCLES_CAPTION`, `ARCH_NOT_ANALYSED_NOTE`, `ARCH_EDGES_OMITTED_NOTE`, `RULE_NOT_EVALUATED_PARTIAL`, `OVERVIEW_IMPORTS_ROW`, `EVIDENCE_SOURCE_FALLOW_PARTIAL`. Changed: `ARCH_MAP_FOOTNOTE` (= `RELATIONS_SCOPE_NOTE`) and `OVERVIEW_ARCH_CAPTION(violations: string)`. Removed: `ARCH_CARD_EDGES`, `SAMPLE_EDGE_DETAIL`, `IMPORT_GRAPH_UNKNOWN_REASON` and the passing label.

- [ ] **Step 1: Write the failing tests** (`tests/unit/architecture-relations.test.ts`), with the relations snapshot and report:
  - **Module edges:** `edges` are the aggregated evidenced edges between top-level modules (all relation files are under `src`, so every module is `src` and there are **no** module edges). So use a snapshot whose paths are the relation paths re-rooted: `core/a.ts`, `ui/view.ts`, … (strip `src/` via the report's strip prefix, `{ stripPrefix: 'src/' }`). Then `ui → data` has `imports` = 1 in `collected` state, and `core` has no edge to itself.
  - **Cycle card:** its value is the import-cycle count (`collected`), and its caption is `RELATION_CYCLES_CAPTION(files, groups, reExports)` with the recorded numbers.
  - **Evidenced card:** the distinct matched file edges.
  - **Violations card:** fallow's violations plus your violated rules.
  - **No report:** every relation card is `unknown` with `FALLOW_NOT_ANALYSED`, `edges` is empty, and `notAnalysed` is true. Modules are still `collected` from the inventory.
  - **Rules (N23):** a rule `ui → data` is `violation` with `violatingImports` 1. A rule `core → ui` is `not-evaluated` with reason `RULE_NOT_EVALUATED_PARTIAL`. A rule naming a module outside the graph is `not-evaluated` with `RULE_NOT_EVALUATED_REASON`. With no report, it is `not-evaluated` with `FALLOW_NOT_ANALYSED`. No rule is ever `passing`: assert that `evaluateRules(...).every((e) => e.status !== ('passing' as RuleStatus))` holds on a non-empty list.
  - **Overview:** the Architecture exceptions card equals `cyclesValue(relations)`. The imports row is `{ label: OVERVIEW_IMPORTS_ROW, state: 'partial', source: EVIDENCE_SOURCE_FALLOW_PARTIAL }` with a report, and `unknown` / "Not collected" without one.
  - **Data & scans:** the `imports` provider row is `partial` with a report, `unknown` without one, and never `sample`.
  - **Sample file gone:** assert `existsSync('src/ui/fixtures/sample-module-edges.ts')` is false (`node:fs`; this is a node-project test).
- [ ] **Step 2: Run the tests to see them fail.**
- [ ] **Step 3: Rewrite `architecture.ts`.**
  - Modules are unchanged.
  - Edges come from `aggregateEdges(relations.index.edges, (id) => moduleOfId.get(id)!)`, keeping pairs with both modules among the shown `modules`. `omittedEdges` is the sum of the other pairs' counts.
  - `imports` is `relations.state === 'none' || !relations.analysed ? unknown(FALLOW_NOT_ANALYSED, 'fallow') : evidence-state value(count)`. Build it with the same helper Task 6 exposes. If that helper is private, export `relationValue(model, n)` from `relations.ts` and use it here (J13).
  - `architectureGraphFor` is memoised per `RelationModel` (N27).
  - `evaluateRules(rules, graph)`:
    - `violation` when a matched file edge goes from a file of `rule.from` to a file of `rule.to`, counting such edges;
    - otherwise `not-evaluated`, with the reason order: out of graph → `RULE_NOT_EVALUATED_REASON`; no report or not analysed → `FALLOW_NOT_ANALYSED`; else `RULE_NOT_EVALUATED_PARTIAL`.
  - Cards per N20.
- [ ] **Step 4: Update the memos.** In `use-read-models.ts`, `graph` becomes `computed(() => architectureGraphFor(files.value, relations.value))`, `cycles` becomes `computed(() => cyclesValue(relations.value))`, and `architectureModelFor` keys on the graph (which is now one per relation model). The `cyclesFor` memo is deleted if `cyclesValue` is cheap (it is: one count).
- [ ] **Step 5: Overview, city summary, sources, report.**
  - `overview.ts`: the `cycles` default becomes `unknown(FALLOW_NOT_ANALYSED, 'fallow')`. The card caption is `OVERVIEW_ARCH_CAPTION(<violations text>)`, where the violations text is `formatMetric(evidence.count(violations, 'boundary'))`, or the not-configured wording when that is unknown. The coverage row is per N26: `buildOverviewModel` gains a `relations` parameter (default `relationModelFor(files, evidence)`) to read its state.
  - `city-summary.ts`: same default.
  - `sources.ts:89`: the `imports` provider row's state is `'partial'` when `relations.analysed`, `'stale'` when stale, and `'unknown'` otherwise, with source `EVIDENCE_SOURCE_FALLOW_PARTIAL`. Thread `relations` through `buildSourcesModel`'s caller the same way.
  - `report.ts`: the rule status labels lose `passing`; nothing else changes.
- [ ] **Step 6: The minimal screen changes** (so the gate compiles):
  - `BoundaryRuleTable.vue`/`BoundaryInspector.vue`: remove the `passing` label branch, and show `reason` for `not-evaluated`.
  - `ArchitectureScreen.vue`: delete `illustrative` (it showed sample "illustrative" files for a sample edge; J12) and the props that carried it.
  - `BoundaryInspector.vue`: its `illustrative` prop goes.
  - Delete `sample-module-edges.ts`. `grep -rn "sampleModuleEdges\|SAMPLE_EDGE_DETAIL\|IMPORT_GRAPH_UNKNOWN_REASON\|ARCH_CARD_EDGES" src tests` must come back empty.
- [ ] **Step 7: Fix the pinned tests in place** (`architecture-model.test.ts`, `architecture-rules.test.ts`, `architecture-screen.test.ts`, `overview-screen.test.ts`, `sources-model.test.ts`). Every expectation that relied on sample edges now uses a report fixture (`attachSyntheticReport` once Task 14 extends it, or a relations report attached through the evidence store), or asserts the no-report state. List every changed assertion in the report.
- [ ] **Step 8: Run the tests.**
  ```bash
  npx vitest run tests/unit/architecture-relations.test.ts tests/unit/architecture-model.test.ts tests/unit/sources-model.test.ts tests/component/architecture-rules.test.ts tests/component/architecture-screen.test.ts tests/component/overview-screen.test.ts
  ```
  Expected: PASS.
- [ ] **Step 9: Gate and commit** (`feat(ui): Architecture, Overview and Data & scans read fallow's evidenced imports; the sample module edges are deleted; rules are violated or not evaluated (WP-03 N18–N20, N23, N26)`).

### Task 8: Quality — the new kinds on screen, the review dialog, and the review request

**Files:**
- Modify: `src/ui/stores/evidence-store.ts`, `src/ui/screens/QualityScreen.vue`, `src/ui/screens/quality/FindingReviewDialog.vue`, `src/ui/screens/file/FileFindingsPanel.vue` (marks a related finding), `src/ui/audit-copy/quality.ts` (`FINDING_RELATED_LABEL`, `FINDING_VIA_RELATED`)
- Test: `tests/component/quality-relations.test.ts` (new)

**Interfaces:**
- Consumes: `QualityFinding.related`/`anchored` (Task 5), `cyclePathText` (Task 6), `RELATION_MEMBER_UNMATCHED` (Task 6).
- Produces (`evidence-store.ts`): `requestFindingReview(fingerprint: string): void` and `consumeFindingReviewRequest(): string | null`. Both are arrow-function members (PF14). The request is cleared by `bindRepository`.

- [ ] **Step 1: Write the failing tests** (`tests/component/quality-relations.test.ts`). Mount `QualityScreen` in a Pinia app with the relations snapshot and report attached. Cases:
  - **Cards and filter:** five cards render, "Import structure" among them. The Type filter lists six kinds, and choosing "Import cycle" leaves only `CY-` rows.
  - **Review dialog:** opening a cycle's dialog shows an "Also involves" row listing the other members as text, and the cycle path text. A boundary finding's dialog lists its `to` file. For an unmatched related path, the row shows "not in this snapshot".
  - **Review request:** `requestFindingReview(<cycle fingerprint>)` before mount opens the dialog on that finding at mount, and a second mount does not reopen it (consumed). An unknown fingerprint opens nothing.
  - **Rebinding:** `bindRepository('other')` clears a pending request.
  - **File detail:** mount `FileDetailScreen` for `src/data/db.ts`. The violation is listed and marked with `FINDING_VIA_RELATED` ("Reported on src/ui/view.ts"); its Review button opens the same fingerprint as Quality.
- [ ] **Step 2: Run the tests to see them fail.**
- [ ] **Step 3: Implement.**
  - The store gains the pair (a `ref<string | null>`).
  - `QualityScreen.vue` consumes the request in `onMounted`, opening the dialog through the same function its Review buttons call when `quality.byFingerprint.has(fp)`.
  - `FindingReviewDialog.vue` adds, after the Rule row, a `<div>` row "Also involves" (only when `finding.related.length > 0`) with one `<li>` per path, plus `RELATION_MEMBER_UNMATCHED` when the path is not a snapshot file. For a cycle it also adds the path text (`cyclePathText(detail.hops)`) in a `<code>`. Keep the dialog under 300 lines. If it would pass, extract the row into `quality/FindingRelatedRow.vue`.
  - `FileFindingsPanel.vue` shows `FINDING_VIA_RELATED(anchorPath)` under a finding whose `anchored` is false, using `FileFinding.anchorPath` (Task 5, J14).
- [ ] **Step 4: Run the tests.** `npx vitest run tests/component/quality-relations.test.ts tests/component/quality-screen.test.ts tests/component/quality-fallow.test.ts tests/component/quality-dialog-status.test.ts tests/component/file-detail-screen.test.ts` gives PASS.
- [ ] **Step 5: Gate and commit** (`feat(ui): Quality shows cycles, boundary violations and unresolved imports with the files they involve, and opens on a requested finding (WP-03 N13–N15)`).

### Task 9: The Architecture screen — Cycles, Edges, Configured in fallow

**Files:**
- Create: `src/ui/screens/architecture/use-architecture-selection.ts`, `CycleList.vue`, `EdgeList.vue`, `FallowBoundaryTable.vue`
- Modify: `src/ui/screens/ArchitectureScreen.vue`, `ModuleMap.vue` (cycle highlight, not-analysed note), `DependencyMatrix.vue` (not-analysed note), `ModuleInspector.vue` (evidenced neighbours), `src/ui/audit-copy/relations.ts` (the Architecture strings of spec §2), `src/ui/styles/screens-explore.css`
- Modify: `src/ui/stores/relations-store.ts`, which is **created here as a stub** holding only `showCycleInCity`. Task 12 fills in the rest: J15 keeps this task from depending on Task 12.
- Test: `tests/component/architecture-cycles.test.ts`, `tests/component/architecture-edges.test.ts` (new)

**Interfaces:**
- Consumes: `ArchitectureGraph.relations` (Task 7), `cycleModules` (Task 7), `requestFindingReview` (Task 8), `CycleView`/`BoundaryView`/`UnresolvedView`/`RelationEdgeView` (Task 6).
- Produces:
  - `relations-store.ts` (stub): `useRelationsStore` with `highlightedCycleId: Ref<string | null>` and `showCycleInCity: (cycleId: string, anchorId: EntityId) => void`. The stub selects `anchorId` through the city store, sets `highlightedCycleId` and navigates to `city`, in that order: select first, because Task 12's selection watcher clears the highlight.
  - `EDGE_LIST_LIMIT = 200`, exported from `EdgeList.vue`'s sibling module `use-architecture-selection.ts`, because the benchmark in Task 13 imports it.

- [ ] **Step 1: Write the failing tests.**
  - `architecture-cycles.test.ts`:
    - five tabs render in the order Map, Matrix, Cycles, Edges, Rules;
    - Cycles lists the import cycle then the re-export cycle, each with its kind label, member count and path text;
    - selecting a cycle adds `ci-module-map__edge--cycle` on the Map to the edges between its modules (switch back to Map to check), and shows the path in the inspector column;
    - **Review finding** calls `requestFindingReview` with the cycle's fingerprint and navigates to `quality`;
    - **Show in city** selects the anchor file, sets `highlightedCycleId` and navigates to `city`, and the camera bookmark is unchanged;
    - a cycle with an unmatched member shows "not in this snapshot" and no **Show in city** button;
    - with no report, the tab shows `FALLOW_NOT_ANALYSED`.
  - `architecture-edges.test.ts`:
    - Edges lists the matched file edges with From, To, Source, Line and Type (`RELATION_TYPE_UNKNOWN`);
    - the direction filter relative to the selected module and the source filter reduce the rows;
    - From opens File detail on the importing file (`store.selectedEntityId` and `route === 'file'`);
    - unresolved imports are listed below the table and never as rows of it;
    - `RELATIONS_STATIC_NOTE` and `RELATIONS_SCOPE_NOTE` are visible;
    - with 250 synthetic edges, 200 rows render and `EDGE_LIST_HIDDEN(50)` shows. Build them with a custom `RelationModel`-shaped read through a report of 250 violations: synthesise the report JSON by copying the relations recording and adding violations between generated files present in the snapshot;
    - Rules shows **Configured in fallow** with the recorded violation and a Review finding button. On the no-boundaries report it shows `FALLOW_BOUNDARIES_NOT_CONFIGURED` and no table.
- [ ] **Step 2: Run the tests to see them fail.**
- [ ] **Step 3: Implement.**
  - Move the screen's selection refs and handlers (`selectedModule`, `selectedEdge`, `selectedRuleId`, the watchers, `selectModule`/`selectEdge`/`selectRule`) into `use-architecture-selection.ts`, adding `selectedCycleId`.
  - `ArchitectureScreen.vue` keeps the layout and tab switch, and must end under 300 lines.
  - `CycleList.vue` and `EdgeList.vue` use the kit `DataTable` where rows are tabular (Edges) and a list of buttons for Cycles. Buttons follow E40 where they can become blocked; none here can.
  - `FallowBoundaryTable.vue` renders under the rule table in the Rules tab.
  - CSS in `screens-explore.css`, BEM `ci-architecture__*`, `ci-cycle-list__*` and `ci-edge-list__*`, with tokens only.
- [ ] **Step 4: Run the tests.** `npx vitest run tests/component/architecture-cycles.test.ts tests/component/architecture-edges.test.ts tests/component/architecture-screen.test.ts tests/component/architecture-rules.test.ts` gives PASS.
- [ ] **Step 5: Gate and commit** (`feat(ui): Architecture Cycles and Edges tabs, fallow's configured boundaries, review and show-in-city actions (WP-03 N21, N22, N24)`).

### Task 10: File detail — the Relations panel

**Files:**
- Create: `src/ui/screens/file/FileRelationsPanel.vue`
- Modify: `src/ui/screens/FileDetailScreen.vue`, `src/ui/audit-copy/relations.ts` (`RELATIONS_TITLE`, `RELATIONS_NONE_FOR_FILE`, `RELATION_HIDDEN`, `RELATION_SOURCE_CYCLE`/`_BOUNDARY`, `RELATIONS_CYCLES_TITLE`, `RELATIONS_FAN_OUT`)
- Test: `tests/component/file-relations.test.ts` (new)

**Interfaces:**
- Consumes: `relationModelFor`, `neighbourhood` (Tasks 2, 6).
- Produces: `RELATION_ARC_LIMIT = 24`, exported from `src/ui/read-models/relations.ts` (added here; Task 12 imports it).

- [ ] **Step 1: Write the failing test.**
  - For `src/core/a.ts`, the panel lists its outgoing hop to `b.ts` and incoming hop from `c.ts` with lines and "Cycle", the cycle path text, and `fanOut` as "Imports (fallow)". Each row's button selects that file.
  - `src/orphan.ts` shows `RELATIONS_NONE_FOR_FILE`, never "no imports".
  - With no report, it shows `FALLOW_NOT_ANALYSED`.
  - `RELATIONS_SCOPE_NOTE` is present.
  - With more than 24 neighbours (a synthetic report), it shows 24 rows and `RELATION_HIDDEN(n)`.
- [ ] **Step 2: Run the test to see it fail.**
- [ ] **Step 3: Implement.** The panel reads `useReadModels().relations`, calls `neighbourhood(model.index, file.id, { direction: 'both', hops: 1, limit: RELATION_ARC_LIMIT })`, and maps the rows through `model.edge(from, to)` for the line and sources. It lists the cycles whose members include the file. `FileDetailScreen.vue` places it after the findings panel and stays under 200 lines.
- [ ] **Step 4: Run the tests.** `npx vitest run tests/component/file-relations.test.ts tests/component/file-detail-screen.test.ts` gives PASS.
- [ ] **Step 5: Gate and commit** (`feat(ui): File detail Relations panel over evidenced imports (WP-03 N25)`).

### Task 11: The renderer port amendment and the arcs

**Files:**
- Create: `src/visualization/relation-arcs.ts`, `src/visualization/inert-port.ts` (J9: `makeInertPort` moved out of `city-renderer.ts`, unchanged except for the new no-op)
- Modify: `src/visualization/renderer-port.ts` (the method, the type, the palette field, the CONTRACT NOTES), `src/visualization/city-renderer.ts`, `src/host/theme-bridge.ts`, `src/ui/styles/kit.css`
- Modify, every renderer double (one line each, in place; J10): `tests/fixtures/renderer-doubles.ts`, `tests/fixtures/city-view-doubles.ts`, `tests/acceptance/world.ts`, and the inline doubles in `tests/component/{camera-controls,camera-round-trip,city-viewport-wiring,city-viewport,codebase-file-list,file-inspector,findings-lens,responsive-floor,stage-height,status-surfaces,welcome-state}.test.ts` and `tests/host/{city-view-cancel,city-view-data-ports,city-view-scan-modes,city-view-store-wiring,city-view,lifecycle-leaks,multi-leaf,window-migration}.test.ts`. Find them all with `grep -rln "setReported" tests`, and add `setRelations: vi.fn(),` on the same line as `setReported`.
- Test: `tests/component/relation-arcs.test.ts` (new), `tests/unit/theme-bridge-relations.test.ts` (new)

**Interfaces:**
- Produces (exact, `renderer-port.ts`):
  ```ts
  export interface RelationArc { readonly from: EntityId; readonly to: EntityId; readonly role: 'outgoing' | 'incoming' | 'cycle' }
  // CityPalette gains:
  relations: { readonly outgoing: string; readonly incoming: string; readonly cycle: string };
  // CityRendererPort gains:
  /** WP-03 N28 (owner-approved §4.2 amendment). An overlay: no relayout, no recolour, no camera
   *  change, never picked. null or [] removes every arc. Kept across setColors and setLayout; an
   *  arc whose end is not a lot of the current layout is not drawn. A new renderer starts with
   *  none. At most MAX_RELATION_ARCS are drawn. Never throws. */
  setRelations(arcs: readonly RelationArc[] | null): void;
  ```
  `relation-arcs.ts`:
  ```ts
  export const MAX_RELATION_ARCS = 64;
  export interface RelationArcs {
    readonly root: Group;                 // named 'relation-arcs'
    setArcs(arcs: readonly RelationArc[] | null): void;
    setLots(lots: readonly CityLot[] | null): void;
    setColors(palette: CityPalette): void;
    drawnCount(): number;                  // arcs actually drawn (tests and diagnostics)
    dispose(): void;
  }
  export function createRelationArcs(): RelationArcs;
  ```

- [ ] **Step 1: Write the failing tests** (`tests/component/relation-arcs.test.ts`; jsdom; no GL is needed to build geometry). Use a tiny `LayoutResult` of four lots (reuse the builder `renderer-reported.test.ts` uses). Cases:
  - **Geometry:** after `setLots`, `setColors(palette)` and `setArcs([a→b outgoing, c→a incoming])`, `drawnCount()` is 2. The `LineSegments` position attribute has `2 × 24 × 2` vertices, the cone `InstancedMesh.count` is 2, and `root.children.length` is 2 (two draw calls).
  - **Arrowhead:** the cone for `a→b` sits nearer `b`'s top than `a`'s.
  - **Colour by role:** with distinct palette colours per role, the vertex colours of arc 0 equal `palette.relations.outgoing` and those of arc 1 equal `palette.relations.incoming`.
  - **Missing ends:** an arc to an entity that is not a lot is not drawn but is kept. After `setLots` with a layout that has it, it is drawn.
  - **`from === to`:** never drawn.
  - **The cap:** 70 arcs draw 64.
  - **Removal:** `setArcs(null)` and `setArcs([])` leave `drawnCount()` 0 and `root.children` empty.
  - **Colours only:** `setColors` again changes colours without rebuilding positions (the same position `BufferAttribute` array values).
  - **No leak:** after 50 `setArcs` calls with different arcs, every geometry that is no longer attached has been disposed. Spy on `BufferGeometry.prototype.dispose` and count calls against builds.
  - **Never throws:** `setArcs` before `setLots`/`setColors` does not throw and draws nothing, and draws once both arrive.
  - **Through the port:** following `renderer-reported.test.ts`'s "the port" section (whatever GL stand-in it uses), `setRelations` before the first layout is applied after `setLayout`, and `setRelations` survives a second `setLayout`. `makeInertPort().setRelations([...])` does not throw.

  `tests/unit/theme-bridge-relations.test.ts`: `readPalette` reads `--ci-relation-out`, `--ci-relation-in` and `--ci-relation-cycle` into `relations`. Use a fake `containerEl` whose `getCssPropertyValue` returns fixed colours, as the existing theme-bridge test does.
- [ ] **Step 2: Run the tests to see them fail.**
- [ ] **Step 3: Extract the inert port.** Move `makeInertPort` (and its `DEFAULT_CAMERA` dependency, if only it uses it; otherwise export the constant from the new file) into `inert-port.ts`, add `setRelations: () => {}`, and import it into `city-renderer.ts`. Run every test file that constructs the renderer (`grep -rl "createCityRenderer" tests`) plus `tests/benchmarks/city-renderer.test.ts`: they stay green before anything else changes.
- [ ] **Step 4: Implement `relation-arcs.ts`** (about 170 lines):
  ```ts
  // WP-03 N29: the selected file's evidenced relations as raised, directed arcs. One LineSegments
  // (every arc, 24 segments each, vertex colours) and one InstancedMesh of cones (the arrowheads):
  // two draw calls in all. An overlay: never picked, never moves a lot, never touches the camera.
  import {
    BufferGeometry, Color, ConeGeometry, Float32BufferAttribute, Group, InstancedMesh, LineBasicMaterial,
    LineSegments, Matrix4, MeshBasicMaterial, Quaternion, Vector3,
  } from 'three';
  import type { CityLot } from '../domain/layout/types';
  import type { CityPalette, EntityId, RelationArc } from './renderer-port';

  export const MAX_RELATION_ARCS = 64;
  const SEGMENTS = 24;
  const ARROW_AT = 0.92;
  const LIFT_PER_DISTANCE = 0.35;
  const LIFT_BASE = 2;
  const CONE_RADIUS = 0.35;
  const CONE_HEIGHT = 1.1;
  const UP = new Vector3(0, 1, 0);

  function topOf(lot: CityLot): Vector3 {
    return new Vector3(lot.center[0], lot.center[1] + lot.dimensions[1] / 2, lot.center[2]);
  }

  /** The quadratic Bézier point and tangent at t. */
  function bezier(p0: Vector3, p1: Vector3, p2: Vector3, t: number): { point: Vector3; tangent: Vector3 } {
    const u = 1 - t;
    const point = p0.clone().multiplyScalar(u * u).add(p1.clone().multiplyScalar(2 * u * t)).add(p2.clone().multiplyScalar(t * t));
    const tangent = p1.clone().sub(p0).multiplyScalar(2 * u).add(p2.clone().sub(p1).multiplyScalar(2 * t)).normalize();
    return { point, tangent };
  }

  function controlPoint(p0: Vector3, p2: Vector3): Vector3 {
    const horizontal = Math.hypot(p2.x - p0.x, p2.z - p0.z);
    return new Vector3((p0.x + p2.x) / 2, Math.max(p0.y, p2.y) + LIFT_PER_DISTANCE * horizontal + LIFT_BASE, (p0.z + p2.z) / 2);
  }
  ```
  `createRelationArcs()` keeps `arcs`, `lots` (a `Map<EntityId, CityLot>`) and `palette`, and one `rebuild()`:
  - remove and dispose the current `LineSegments`, `InstancedMesh`, geometries and materials;
  - return if any input is missing;
  - take the first `MAX_RELATION_ARCS` of `arcs` with both ends in `lots` and `from !== to`;
  - fill the positions (`2 × SEGMENTS` vertices per arc) and colours;
  - build the cone mesh with `setMatrixAt` (position `bezier(…, ARROW_AT).point`, rotation `new Quaternion().setFromUnitVectors(UP, tangent)`) and `setColorAt`.

  `setColors` alone only rewrites the colour attribute and the instance colours, then flags `needsUpdate`. `dispose()` disposes everything. The constants `LIFT_*` and `CONE_*` may be tuned against the harness capture in Task 14; any change there is recorded as a ruling.
- [ ] **Step 5: Wire it into the renderer** (`city-renderer.ts`, which must stay ≤ 400 after Step 3):
  - `const arcs = createRelationArcs(); scene.add(arcs.root);`
  - `swapCity` calls `arcs.setLots(next ? source.lots : null)`;
  - `setColors` calls `arcs.setColors(next)`;
  - the port gains `setRelations(list) { arcs.setArcs(list); scheduler.invalidate(); }`;
  - `dispose` calls `arcs.dispose()` before `disposeObject3D(scene)`.
- [ ] **Step 6: Palette and tokens.**
  - `theme-bridge.ts` adds `relations: { outgoing: hex('--ci-relation-out'), incoming: hex('--ci-relation-in'), cycle: hex('--ci-relation-cycle') }`.
  - `kit.css`'s `:where(.codebase-inspector-root)` block adds:
    ```css
    --ci-relation-out: var(--color-cyan, #53b8c4);
    --ci-relation-in: var(--color-orange, #d99a5b);
    --ci-relation-cycle: var(--color-red, #d9707a);
    ```
  - Every test palette literal that types `CityPalette` gains `relations`. Find them with `grep -rn "unavailable:" tests`.
- [ ] **Step 7: Update the doubles.** Add `setRelations: vi.fn(),` to every renderer double, in place, on the `setReported` line (J10). Verify that the capped files' line counts are unchanged:
  ```bash
  wc -l tests/host/city-view-store-wiring.test.ts tests/component/welcome-state.test.ts tests/host/city-view.test.ts tests/host/window-migration.test.ts
  ```
- [ ] **Step 8: Run the tests.**
  ```bash
  npx vitest run tests/component/relation-arcs.test.ts tests/unit/theme-bridge-relations.test.ts tests/component/renderer-reported.test.ts tests/benchmarks/city-renderer.test.ts tests/benchmarks/city-budget.test.ts tests/host/lifecycle-leaks.test.ts
  ```
  Also run every double file edited in Step 7 (`npx vitest run <each>`). Expected: PASS.
- [ ] **Step 9: Gate and commit** (`feat(visualization): setRelations, directed relation arcs in two draw calls, relation colours in the palette (WP-03 N28, N29, N32; owner-approved §4.2 amendment)`).

### Task 12: The city Relations section, its store and the renderer wiring

**Files:**
- Create: `src/ui/read-models/city-relations.ts`, `src/ui/read-models/use-city-relations.ts`, `src/ui/screens/city/CityRelationsPanel.vue`, `src/ui/screens/city/use-relation-renderer.ts`
- Modify: `src/ui/stores/relations-store.ts` (complete it; Task 9 made the stub), `src/ui/components/FileInspector.vue` (mount the panel), `src/ui/components/CityStage.vue` (`useRelationRenderer()`), `src/ui/audit-copy/relations.ts` (`RELATIONS_DIRECTION_*`, `RELATIONS_HOPS_LABEL`, `RELATIONS_SHOW_ARCS`, `RELATIONS_HIGHLIGHT_CYCLE`), `src/ui/styles/screens-explore.css`
- Test: `tests/unit/city-relations.test.ts`, `tests/component/city-relations-panel.test.ts`, `tests/component/relation-renderer-wiring.test.ts` (new)

**Interfaces:**
- Consumes: `RELATION_ARC_LIMIT` (Task 10), `RelationArc` (Task 11), `relations-store` stub (Task 9), `useCityRendererHandle` (existing).
- Produces:
  ```ts
  // relations-store.ts (setup store, one per leaf)
  export type RelationControlDirection = 'both' | 'out' | 'in';
  useRelationsStore(): { direction; hops; showArcs; highlightedCycleId;
    setDirection: (d: RelationControlDirection) => void; setHops: (h: 1 | 2) => void; setShowArcs: (v: boolean) => void;
    highlightCycle: (id: string | null) => void; showCycleInCity: (cycleId: string, anchorId: EntityId) => void; reset: () => void }
  // city-relations.ts
  export interface CityRelationRow { readonly otherId: EntityId; readonly otherPath: string; readonly direction: 'in' | 'out';
    readonly hop: 1 | 2; readonly line: number | null; readonly sources: readonly RelationSource[] }
  export interface CityRelationsView { readonly state: EvidenceIndexState; readonly rows: readonly CityRelationRow[]; readonly hidden: number;
    readonly cycles: readonly CycleView[]; readonly highlighted: CycleView | null; readonly highlightHidden: number;
    readonly arcs: readonly RelationArc[] | null }
  export function cityRelationsFor(model: RelationModel, selected: EntityId | null,
    controls: { direction: RelationControlDirection; hops: 1 | 2; showArcs: boolean; highlightedCycleId: string | null }): CityRelationsView;
  ```

- [ ] **Step 1: Write the failing tests.**
  - `tests/unit/city-relations.test.ts` (pure):
    - For `a.ts`, both directions and 1 hop, the rows are `b.ts` (out) and `c.ts` (in), and the arcs are `[{a→b outgoing}, {c→a incoming}]`.
    - `direction: 'out'` keeps only the outgoing row and arc.
    - `showArcs: false` gives `arcs: null` but keeps the rows.
    - A highlighted cycle replaces the arcs with its matched hops (role `cycle`), while the rows stay the neighbourhood.
    - An unknown `highlightedCycleId` gives `highlighted: null` and the neighbourhood arcs (the **vanished cycle** case, Review Focus 4).
    - **Long cycle (Review Focus 4):** a 30-hop cycle highlighted gives 24 arcs and `highlightHidden: 6`.
    - No selection gives `arcs: null`. State `none` gives `arcs: null` and no rows.
    - **Stale arcs (Review Focus 5):** a stale model still gives arcs, and `state: 'stale'`.
  - `tests/component/city-relations-panel.test.ts`:
    - Mount `FileInspector` with `a.ts` selected and the relations report attached. The Relations section shows its controls, the two rows with their lines, the cycle row with a **Highlight cycle** toggle (`aria-pressed` false → true on click), `RELATIONS_SCOPE_NOTE` and `RELATIONS_STATIC_NOTE`.
    - A row button selects that file and the camera is not moved: `renderer.focus` and `setCamera` are not called.
    - Selecting another file clears the highlight.
    - Stale evidence shows the stale label.
    - Two leaves (two Pinia instances): changing leaf A's direction leaves leaf B's store at `both`, and B's camera is unchanged. Follow the pattern of `tests/host/multi-leaf.test.ts` or two separately mounted apps.
    - Detaching the report (or a different repository id) resets the store to its defaults.
  - `tests/component/relation-renderer-wiring.test.ts`:
    - Mount `CityStage` with a renderer double in the handle. Selecting `a.ts` calls `setRelations` with the two arcs; highlighting the cycle calls it with the cycle arcs; unticking **Show arcs** calls it with `null`.
    - A new renderer in the handle (a context-loss rebuild) receives the current arcs again.
    - A fresh renderer is never sent `null` as a command (the `use-lens-renderer.ts` rule).
    - In list mode no renderer exists, and the section still lists the rows.
- [ ] **Step 2: Run the tests to see them fail.**
- [ ] **Step 3: Implement.**
  - **The store:** `relations-store.ts` is modelled on `lens-store.ts`.
    - Its setters validate their input (an unknown direction or hop is a no-op).
    - A `flush: 'sync'` watcher on `[evidence.repositoryId, evidence.report !== null]` calls `reset()`.
    - A `flush: 'sync'` watcher on `useCityStore().selectedEntityId` sets `highlightedCycleId` to null.
    - `showCycleInCity` selects, then highlights, then navigates.
  - **The read model:** `city-relations.ts` implements `cityRelationsFor` with `neighbourhood` (limit `RELATION_ARC_LIMIT`). A row's line and sources come from `model.edge(from, to)`. A cycle's arcs are its matched hops mapped to ids through the model's members. `use-city-relations.ts` returns `computed(() => cityRelationsFor(relations.value, city.selectedEntityId, controls))`.
  - **The composable:** `use-relation-renderer.ts` copies `use-lens-renderer.ts`'s shape: `watch([() => handle.value, () => view.value.arcs], applyArcs, { immediate: true })`. It skips `null` for a fresh renderer and re-sends the arcs on a new renderer.
  - **The panel:** `CityRelationsPanel.vue` has:
    - a segmented control (buttons with `aria-pressed`) for Direction and for Hops, and a checkbox for Show arcs;
    - the rows as buttons;
    - the cycles, each with a Highlight toggle;
    - the notes.

    `FileInspector.vue` mounts it when the selection is a file, and stays under 260 lines.
  - **The stage:** `CityStage.vue` calls `useRelationRenderer()` next to `useLensRenderer()`.
- [ ] **Step 4: Run the tests.**
  ```bash
  npx vitest run tests/unit/city-relations.test.ts tests/component/city-relations-panel.test.ts tests/component/relation-renderer-wiring.test.ts tests/component/file-inspector.test.ts tests/component/findings-lens.test.ts tests/component/architecture-cycles.test.ts
  ```
  Expected: PASS.
- [ ] **Step 5: Gate and commit** (`feat(ui): city Relations section, per-leaf relation controls and the arcs wired to the renderer (WP-03 N30, N31)`).

### Task 13: The real-binary relation test and the dense-graph benchmark

**Files:**
- Create: `tests/fallow-real/fallow-real-relations.test.ts` (a sibling, because `fallow-real.test.ts` is 154 lines and the case needs its own setup; J16)
- Create: `tests/benchmarks/relations-budget.test.ts`
- Modify: `vitest.fallow.config.ts`, only if its `include` does not already match the new file

**Interfaces:**
- Consumes: `RELATIONS_PROJECT_DIR` (Task 1); the production runner path used by `fallow-real.test.ts` (read that file and reuse its helpers: the temp copy, the fs snapshot and diff, `FALLOW_BIN`); `relationModelFor`, `neighbourhood`, `aggregateEdges`, `createRelationArcs`, `EDGE_LIST_LIMIT`, `RELATION_ARC_LIMIT`.

- [ ] **Step 1: Write the real-binary test.** Copy `RELATIONS_PROJECT_DIR` to a temp folder (the helper `fallow-real.test.ts` uses) and take the fs snapshot. Run the production runner with `FALLOW_RUN_ARGS(root)` through the real `createFallowRunner()`, exactly as the existing file does, then:
  - parse and normalise with `parseFallowReportText` and `buildEvidenceReport`;
  - assert one import cycle over `src/core/{a,b,c}.ts`, one re-export cycle, the violation `src/ui/view.ts → src/data/db.ts`, and the unresolved `./does-not-exist`;
  - assert the fs diff is empty.

  Give it the same explicit timeout as the existing real test. With `FALLOW_BIN` unset and no fetched binary, it skips exactly as the existing file does.
- [ ] **Step 2: Run it.**
  ```bash
  FALLOW_BIN="$LOCALAPPDATA/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe" npm run test:fallow
  ```
  Expected: every case passes, the old ones included. The RED proof is a mutation: expect the violation's `to` to be `src/data/types.ts`, watch it fail, and revert.
- [ ] **Step 3: Write the benchmark** (`tests/benchmarks/relations-budget.test.ts`):
  - **The graph:** a synthetic snapshot of 5,000 files in 40 top-level folders (`snapshotWithPaths`), and a synthetic combined report of 200 import cycles (3–8 files each) plus violations, making 2,000 evidenced edges. Build it as JSON and pass it through the real parser and normaliser.
  - **Timing:** each measured body runs 20 times after 2 warm-up runs. Assert on the median:
    - `relationModelFor` (a fresh `EvidenceIndex` each run, so the memo is bypassed): < 50 ms;
    - `neighbourhood(both, 2, 24)` on the highest-degree file: < 2 ms, with `hidden > 0` asserted;
    - `aggregateEdges` to modules: < 10 ms;
    - `createRelationArcs().setArcs(64 arcs)` on a 5,000-lot layout: < 8 ms.
  - **Truncation is asserted, not only timed (N37):** mount `EdgeList` on this model and assert `EDGE_LIST_LIMIT` rows and `EDGE_LIST_HIDDEN(<edges − 200>)`. Assert that `cityRelationsFor` on the highest-degree file gives `RELATION_ARC_LIMIT` rows and a non-zero `hidden`.
  - **Output:** write the medians to `<tmpdir>/codebase-inspector-benchmark/relations.json` (the `city-benchmark.test.ts` convention), so Task 15 can cite them.

  Give the whole file a `30_000` ms per-test timeout.
- [ ] **Step 4: Run it.** `npx vitest run tests/benchmarks/relations-budget.test.ts` gives PASS. Paste the medians.
- [ ] **Step 5: Gate and commit** (`test: real fallow 3.27.0 relations run with no writes, and the dense-graph relations budget (WP-03 N33, N36, N37)`).

### Task 14: Harness seed and captures

**Files:**
- Modify: `tests/fixtures/evidence-report.ts` (`syntheticFallowJson` gains relation sections, J17), `tests/harness/seed.ts`, `tests/harness/mount.ts` (the Architecture `tab=` parameter and a `relations=cycle` parameter that highlights the first cycle), `scripts/harness-shot.mjs` (the new captures), `tests/harness/harness-evidence.test.ts` (it asserts the seeded relations)

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `syntheticFallowJson` emits, for every snapshot of 6 or more files:
    - `check.circular_dependencies`: one 3-file cycle over files 0 → 1 → 2 → 0, with `edges` on line 1;
    - `check.re_export_cycles`: one `multi-node` over files 3 and 4;
    - `check.boundary_violations`: two, 0 → 5 and 1 → 5, with zones `app` → `data`;
    - `check.unresolved_imports`: one, in file 0, `./missing`;
    - `health.file_scores` for every file (fan_in `i % 7`, fan_out `i % 5`).

    The four summary counts follow. A snapshot of fewer than 6 files gets empty arrays, never an out-of-range index. The existing per-N counts in its comment are extended, not changed. **Every existing test that counts synthetic findings** must be re-run; a test that counted "all findings" gains the 5 new ones. Fix each count in place and list it.

- [ ] **Step 1: Write the failing test.** Add a case to `tests/harness/harness-evidence.test.ts` (120 lines): the demo report carries one import cycle, one re-export cycle, two violations, one unresolved import and `file_scores`, and `relationModelFor` over it has 5 edges.
- [ ] **Step 2: Run it to see it fail.**
- [ ] **Step 3: Implement** the generator change and the seed/mount parameters. Then add these captures to `scripts/harness-shot.mjs`, each with `&report=demo`:
  - `wp03-city-relations-dark`, `wp03-city-relations-light` (`?screen=s07&theme=…&report=demo`, with the Relations section open on file 0);
  - `wp03-city-cycle-dark` (`&relations=cycle`);
  - `wp03-architecture-cycles-dark`, `wp03-architecture-edges-dark`, `wp03-architecture-rules-dark` (`&route=architecture&tab=cycles|edges|rules`).

  Re-frame `wp02-quality-*` and `wp02-architecture-*` if they need `&report=demo` to show the new cards or evidenced edges. Record which, and why.
- [ ] **Step 4: Run.**
  ```bash
  npx vitest run tests/harness/harness-evidence.test.ts tests/harness/harness.test.ts
  npm run harness-shot
  ```
  Every capture must be produced with no page error. Open the three `wp03-city-*` PNGs and check:
  - the arcs are visible and their arrowheads point at the target lot;
  - the colours differ by role;
  - nothing is clipped.

  If the arc lift or cone size (Task 11 constants) makes the arcs unreadable, tune the constants and record the values as an execution ruling.
- [ ] **Step 5: Re-run the synthetic-count tests** named in **Produces**, then gate and commit (`test(harness): relation evidence in the synthetic report and the WP-03 captures (WP-03 N38)`). Commit the PNGs only if earlier parts committed theirs; follow the existing convention for the output folder.

### Task 15: Evidence documents, the delivery record and the full verification

**Files:**
- Modify: `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` (a WP-03 Part 1 section, the refreshed G8 counts), `docs/superpowers/notes/2026-09-17-wp01-limitations.md` (§7, from spec §6), `docs/deliverables/Dependencies and Architecture.md` (the delivery record), `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` (only the counts they pin, refreshed from disk)

- [ ] **Step 1: The gate evidence.** Add a WP-03 Part 1 section with:
  - spec §5's acceptance table, each row naming the test file and case that holds it;
  - the Task 13 benchmark medians (from `relations.json`);
  - the `test:fallow` output: the binary path, version, platform, the fs-diff result, and the pass count;
  - the list of harness captures.
- [ ] **Step 2: The limitations.** Transcribe spec §6 into the limitations note's §7.
- [ ] **Step 3: The deliverable.** Add a "Delivery record" to `docs/deliverables/Dependencies and Architecture.md`, like Fallow Ingestion's: the branch, the spec path, and a table mapping 03.1–03.6 to N decisions, with the scope sentence (evidenced subset only).
- [ ] **Step 4: Refresh the counts from disk** (L28). Run the full suite once, read the file and test counts, the `src/` floor and the analyze figures from the actual output, and update `gate-evidence.test.ts`, `evidence-numbers.test.ts` and the G8 table together.
- [ ] **Step 5: Full verification.**
  ```bash
  npm run verify
  FALLOW_BIN="$LOCALAPPDATA/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe" npm run test:fallow
  npm run analyze
  npm run harness-shot
  ```
  Expected:
  - `verify` exits 0;
  - `test:fallow` passes every case;
  - `analyze` reports no finding beyond the baseline of 9. A new dead export is removed, not baselined;
  - `harness-shot` produces every capture.

  Paste the tail of each run.
- [ ] **Step 6: Commit** (`docs(evidence): WP-03 Part 1 acceptance, benchmarks, limitations, delivery record and refreshed counts`).

---

## Self-review notes (controller)

- **Spec coverage:**

  | Spec decisions | Task |
  |---|---|
  | N1–N2 | 3 |
  | N3–N4, N9–N11 | 4 |
  | N5 (copy on every surface) | 6, 7, 9, 10, 12 |
  | N6 | 6, 9, 12 |
  | N7–N8 | 6 |
  | N12–N13 | 5 |
  | N13 UI, N14, N15 | 8 |
  | N16–N19 | 2 |
  | N20, N23, N26, N27 | 7 |
  | N21, N22, N24 | 9 |
  | N25 | 6 (card), 10 (panel) |
  | N28, N29, N32 | 11 |
  | N30, N31 | 12 |
  | N33, N36, N37 | 13 |
  | N34 | 1 |
  | N35 | across tasks |
  | N38 | 14 |
  | N39, N40 | 15 |

- **Deviations from the spec's letter, each a planning ruling:**
  - `fan` is nullable (J7);
  - `DraftFinding` moves to its own module (J8);
  - `makeInertPort` moves to its own module (J9);
  - `illustrative` is removed (J12);
  - `relationValue` is exported (J13);
  - `anchorPath` is on `FileFinding` (J14);
  - the relations store is created as a stub in Task 9 (J15);
  - the real-binary relations test is a sibling file (J16).
