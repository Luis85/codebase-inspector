---
project: codebase-inspector
title: WP-02 — Inspector UI, Part 3: the six Audit screens (design)
status: approved
date: 2026-09-21
branch: feat/wp-02-part3 (from feat/wp-01-codebase-city at 904692e). Not stacked: fast-forwarded into feat/wp-01-codebase-city, so it lands on PR #1.
baseline: 904692e
---

# WP-02 design — Inspector UI, Part 3

The Part 1 spec (`2026-09-21-inspector-ui-shell-design.md`, §9 A1–A13) and the Part 2 spec
(`2026-09-21-inspector-ui-part2-design.md`, P1–P14; P14 supersedes A1) are binding. They
settle the architecture: screens read read models only, every value is a `MetricValue`,
`city-store` owns selection and route, review decisions sit behind `ReviewRepository`,
strings go in `inspector-copy.ts`, CSS goes in plain files. This document records only what
Part 3 adds: Code quality, Test confidence, Dependencies, Security, Evolution, Ownership,
and the Finding review, Package detail and Snapshot comparison dialogs.

## 1. Decisions

| # | Question | Decision |
|---|---|---|
| Q1 | Where do findings come from? | The existing seeded `sampleFindings(file)` over **every** file. Nothing new is generated; the Code quality table is the union of what File detail already shows per file. All findings are `sample`. |
| Q2 | Finding identity | A **fingerprint** `` `${entityId}#${finding.id}` ``. Today's display ids (`CX-<module>-<i>`) repeat across files in one module, so they cannot key anything. The fingerprint uses the file's `EntityId` (source-relative, durable across snapshots) plus the rule-scoped id, and never the line. The display id is unchanged. |
| Q3 | Dispositions | The review port gains `listDispositions`, `saveDisposition`, `removeDisposition`. A `FindingDisposition` is `{ fingerprint, status: 'acknowledged' \| 'dismissed', reason?: string, decidedAt }`. It is stored separately from generated results: a finding with no disposition is `open`. **Reopen removes the disposition.** Dismiss requires a trimmed, non-empty reason of at most 1000 characters, refused in the store as well as the dialog. Dispositions whose fingerprint no longer matches a finding are kept, not purged (a later snapshot may bring the finding back). Persisting before mutating and pending-aware reservation follow the existing work-item pattern. |
| Q4 | Work items for packages and modules | `WorkItem.entityId` becomes **`target: WorkTarget`**: `{ kind: 'file'; entityId } \| { kind: 'package'; name } \| { kind: 'module'; module }`, plus **`intent: 'refactor' \| 'tests' \| 'review' \| 'pairing' \| 'documentation'`**. Uniqueness and pending reservation are per `(target, intent)` through `workTargetKey(target, intent)`. Existing file items are `intent: 'refactor'`; `hasWorkItemFor(entityId)` keeps its meaning (a refactor item for that file). The port is in-memory only, so there is nothing to migrate. |
| Q5 | Package inventory: sample or real? | **Sample.** Reading the analysed codebase's `package.json` means reading source content through `SourceFileSystemPort`, a scope and approval decision, and host plumbing that `city-view.ts` (399/400) cannot take. The inventory is a fixed fixture of ten fictional `@sample/*` packages (`fixtures/sample-packages.ts`), labelled "Fictional packages". **One real, metadata-only signal:** manifests found in the inventory (`package.json` entities, by name and path) are listed as "Manifest found, contents not read". |
| Q6 | Package illustrative import locations | **Not shown.** Linking real files to fictional packages would make a claim about the user's code. The package shows only a sample reference count. |
| Q7 | Security findings | Advisories are the two fixture advisories on sample packages (`DEMO-ADV-001/002`), never CVEs. **No exploitability verdict anywhere:** runtime exploitability is `unknown` ("Not assessed, no runtime evidence"). **Secret candidates are `unknown` ("No secret-scanning provider")**: a fabricated token placed in one of the user's real files would read as a real finding. The Secret scanning tab explains candidate vs validated and shows the not-collected state. The review checklist is screen-local and not persisted. The durable action is "Create review item" (Q4, `package` / `review`). |
| Q8 | Snapshot history | A new **in-memory `snapshot-journal` store** records a light summary of each distinct snapshot the leaf shows: `{ snapshotId, repositoryId, capturedAt, files, lines: MetricValue, modules: {module, files, lines}[], fileIds }`. It is capped at 10 and cleared when `repositoryId` changes. It is fed by a watcher on `city-store.snapshot` in `App.vue` (not `city-view.ts`), and it is lost on reload (durable history is WP-05). All comparison values are `collected`. **A4 stands:** the selector still lists only the snapshot on screen, and there is no "activate snapshot". |
| Q9 | Compare actions | `SnapshotComparisonDialog` compares the current snapshot with an earlier journal entry (default: the one just before it; a select lists the others): file count, lines, files added / removed, per-module file and line deltas. Overview's **Compare** and a new City **Compare snapshots** open it in place, and are shown only when the journal holds at least two entries. Evolution always shows the journal; with one entry it says "Rescan to compare". |
| Q10 | Trend and coupling data | Change activity (bars), coverage trend and change coupling are **sample**. Coupling pairs are two real files from the same module, seeded, each labelled "Correlation, not a causal dependency". The 30/90-day toggle changes the sample series and the window card. |
| Q11 | Ownership | Module level only. **No individual names, authors, rankings or per-person data anywhere.** Teams are sample labels seeded per module from a fixed list (`Experience`, `Platform`, `Core systems`), labelled "Sample team labels, confirm real stewards". Concentration is a sample percentage per module. Review candidates are that module's files with priority ≥ `HOTSPOT_THRESHOLD`. **"Show in city"** sets the city search to `<module>/` and navigates to `city` (a path-substring search, exactly what the user could type); root files have no such action. Stewardship actions create module work items (`pairing`, `tests`, `documentation`) for the three most concentrated modules. |
| Q12 | Test confidence | Coverage per file is the existing sample `branchCoverage`. Module coverage is **weighted**: `ratioEvidence(sum covered, sum total)` per module. **Assertion strength is never inferred from coverage:** mutation score is `unknown` ("Not collected, unknown, not zero") with a Mutation testing tab showing the not-collected state. Test results are sample counts seeded per **real test file** (category `test` in the inventory); with no test files the tab shows an empty state rather than invented tests. |
| Q13 | Coverage map at scale | At most **400 tiles** (priority order within the module filter), with "Showing 400 of N". The map is one tab stop with arrow keys (the Hotspots scatter pattern); the gaps table is its accessible equivalent. Selecting a tile selects the file and shows the "Selected: name — Open detail" strip. |
| Q14 | The prototype's File inspector drawer | **Not built.** Its jobs are covered by the city's `FileInspector`, the selection strip and File detail. |
| Q15 | Exports | All through `downloadText` as CSV (findings with status and reason; coverage gaps; packages; advisories; stewardship). The CSV helpers move out of `hotspots.ts` into `export/csv.ts` (`csvCell`, `toCsv`); `hotspotsCsv` output is unchanged. Unknown is an empty cell plus a `_state` column (P8). |
| Q16 | Evidence dialog | One `EvidenceSourceDialog` (Test confidence "Coverage evidence", Security "Evidence sources") lists the screen's signal families with state and provenance, and states that the plugin reads no source content and runs no tools for them. |
| Q17 | Nav badge | Unchanged: the Code quality badge only shows `collected` counts, so it stays hidden while findings are sample. |

## 2. Screens

Every screen: `PageHeader` with eyebrow `Audit / <Screen>` and the prototype's title and
subtitle; four `MetricCard`s; `NoSnapshot` when there is no snapshot; `usesSample` wired into
`use-route-provenance.ts`. Screen folders follow Part 2 (`screens/<name>/*`).

- **Code quality**: cards are Open findings, Complexity, Unused exports, Duplication (sample counts; "open" subtracts disposed fingerprints). A filter toolbar has text, type, severity, module and status (default `Open`), plus Reset. `FindingsTable` is an EvidenceTable (severity, finding, location, evidence, status, Review) with 100 rows and "Show 100 more", a no-match state with "Reset filters", and the footnote "Findings are sample data. Decisions are kept in this session only and never written to the repository." Action: Export findings.
- **Finding review dialog** (`FindingReviewDialog`, `CiDialog`, shared by Code quality and File detail, whose finding rows become buttons, closing P13): severity, status, title, path and line (or "line unknown"), provider "Sample findings", confidence "Illustrative, manual confirmation required", and the disposition reason if any. Actions: Open file detail, Add work item, Acknowledge / Reopen, Dismiss…. Dismiss reveals the required reason field with inline validation. On close, focus returns to the opener; if the opener's row has left the filtered list, focus goes to the next row, else to the table's panel (the Part 2 "Remove" pattern).
- **Test confidence**: cards are Branch coverage (weighted), Files below 60 %, Test results (passed / total, sample), Mutation score (unknown). Tabs are Coverage map (tile map, module bars, gaps table with "Plan tests" → work item `tests`), Test results (per test file, "Open file detail"), Mutation testing (not-collected state, "Configure evidence" → `sources`). Actions: Coverage evidence, Export coverage gaps.
- **Dependencies**: a Callout "Fictional packages, real review flow" and the manifest list (Q5). Cards are Packages in fixture, Advisories to review, Unused candidates, License unknown. Tabs are Package inventory (search, relationship/status filter, table, Inspect), Dependency path (`<root folder> → direct → transitive`, fixture only), Licenses. `PackageDetailDialog`: record, advisory box ("Reachability and real exposure are unknown…"), "Create review item". Action: Export inventory. A footnote says no network or registry is consulted.
- **Security**: cards are Dependency advisories (sample), Secret-pattern candidates (unknown), License questions (sample), Runtime exploitability (unknown). Tabs are Dependency advisories (advisory list opening `PackageDetailDialog`, plus the local checklist and "No conclusion about your repository can be drawn from these demo findings"), Secret scanning (Q7), Review policy. Actions: Evidence sources, Export review.
- **Evolution**: a 30/90-day toggle and Compare snapshots (Q9). Cards are Source size (collected), Change window, Snapshots this session (collected), Files changed since previous (collected, or unknown "Needs a second snapshot in this session"). A new kit `BarChart` (SVG, `<title>`/`<desc>`, table fallback) shows change activity; `LineChart` shows the coverage trend; `ChangeCouplingTable` has Inspect → File detail; the `SnapshotJournal` is the real journal with "Compare" per earlier entry.
- **Ownership**: a Callout "Team-level continuity signals only…". Panels: concentration bars (tone warning at ≥ 70 %, footnote "High concentration is a prompt for a conversation, not proof of missing knowledge"), stewardship actions, and the stewardship table (module, sample team, files (collected), concentration, review candidates, Show in city). Action: Export ownership map.

## 3. Read models, fixtures, stores

| Unit | Responsibility |
|---|---|
| `fixtures/sample-packages.ts` | ten fictional packages, two advisories, licences; fixed, not seeded |
| `fixtures/sample-evolution.ts` | activity bars, coverage trend and coupling pairs, seeded per repository and window |
| `fixtures/sample-stewardship.ts` | team label and concentration per module, seeded by module name |
| `fixtures/sample-test-runs.ts` | passed / failed / duration per real test file, seeded by `EntityId` |
| `read-models/findings.ts` | `findingFingerprint`, `buildQualityModel(files, dispositions, filter)`, `findingsCsv` |
| `read-models/test-confidence.ts` | weighted module coverage, tiles (Q13), gaps, test runs, cards, `gapsCsv` |
| `read-models/dependencies.ts` | inventory, filters, licences, path, manifests (Q5), cards, `packagesCsv` |
| `read-models/security.ts` | advisories, cards (Q7), `advisoriesCsv` |
| `read-models/evolution.ts` | cards, series, coupling rows, `compareSnapshots(a, b)` |
| `read-models/ownership.ts` | stewardship rows, bars, action candidates, `stewardshipCsv` |
| `stores/snapshot-journal.ts` | Q8 |
| `stores/ports/review-repository.ts`, `stores/review-store.ts` | Q3, Q4 |
| `export/csv.ts` | Q15 |
| `kit/BarChart.vue` | Q10 |

Snapshot-level memos stay in `use-read-models.ts` (WeakMap keyed by the files array).
Filter-dependent models are built in the screen's computed from a memoized base.

## 4. Deferrals folded in

- **Mixed-source sample flag.** `Provenance` gains `includesSample?: true`. `aggregate` and `ratioEvidence` set it when any present input is sample-backed. `isSampleBacked` reads it, which fixes a partial aggregate over mixed collected and sample inputs.
- **Drawer `inert`.** While the narrow nav drawer is open, the top bar and content get `inert`, and lose it on close.
- **Sample in the chart labels.** The Hotspots scatter and Architecture map aria-labels, and every new chart or map, say "sample".
- **Architecture model memo.** `buildArchitectureModel` is memoized per `(graph, rules array)`, so every `useReadModels()` caller shares one model.
- **Harness `?tab=<id>`.** After mount, the harness clicks the `[role="tab"]` whose `data-tab-id` matches, so tabbed subviews (mutation, test results, dependency path, secret scanning) can be captured. No source change: `Tabs.vue` only gains a `data-tab-id` attribute.
- **Deferred again**, for the same reasons as Part 2 §5: CameraControls re-measuring after a nav-inline flip, and the duplicate leaf ResizeObservers. Both are city-internal, carry acceptance-test risk, and `CityWorkspace.vue` has no budget.
- **Contrast decision #4** (open-decisions note) is untouched. The new screens use existing button and chip styles, so they add instances of the same pairs but no new failing pair.

## 5. Testing

- **Unit:**
  - fingerprints are unique across files in one module
  - disposition store: acknowledge, reopen, dismiss requires a reason, pending, persist before mutate
  - work-item targets and intents: uniqueness per `(target, intent)`, and `hasWorkItemFor` unchanged
  - weighted module coverage; mutation always unknown
  - package filters; manifests found by name, never read
  - `compareSnapshots` (added, removed, module deltas)
  - journal: dedupe by id, cap, reset when the repository changes
  - stewardship data has no per-person field
  - CSV for each export (formula guard, unknown → empty plus state)
  - `includesSample`
- **Component:**
  - Code quality: filters, reset, show more, dialog acknowledge / reopen / dismiss-with-reason, focus return when the row leaves the list
  - File-detail finding opens the dialog
  - Test confidence: tabs, tile keyboard, Plan tests
  - Dependencies: filters, package dialog, create review item
  - Security: no verdict text; secrets unknown
  - Evolution: window toggle; compare dialog appears only with at least two entries
  - Ownership: Show in city sets the query and route; action creates a module item
  - Shell: provenance per route; drawer `inert`
- **Harness:** `quality`, `tests`, `dependencies`, `security`, `evolution` and `ownership` in dark, light and narrow; `tests&tab=mutation` and `dependencies&tab=path`. Compare against the prototype screenshots.
- **Evidence notes:** updated once, in the final task, followed by `npm run verify`, which also runs in the main checkout after the fast-forward.

## 6. Out of scope

- Real providers: findings, coverage, test runs, packages, advisories, secrets, history, ownership.
- Reading `package.json` or any other source content.
- Persistence beyond memory, including the journal.
- Activating an earlier snapshot.
- The Refactor workbench, where work items are edited (Part 4).
