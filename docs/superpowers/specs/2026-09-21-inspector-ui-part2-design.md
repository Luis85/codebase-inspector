---
project: codebase-inspector
title: WP-02 — Inspector UI, Part 2: Architecture, Hotspots, File detail (design)
status: approved
date: 2026-09-21
branch: feat/wp-02-part2, folded into feat/wp-01-codebase-city (PR #1). Not stacked: approved 2026-09-21, Part 2 lands on the existing PR.
baseline: e0440c1
---

# WP-02 design — Inspector UI, Part 2

The Part 1 spec (`2026-09-21-inspector-ui-shell-design.md`, including its §9 amendments
A1–A13) is binding. It already settles the architecture: screens read read models only,
every value is a `MetricValue`, `city-store` owns selection and route, review decisions
sit behind `ReviewRepository`, strings go in `inspector-copy.ts`, and CSS goes in plain
files. This document records only what Part 2 adds and the decisions it needs.

## 1. Decisions

| # | Question | Decision |
|---|---|---|
| P1 | What is a "module"? | The **top-level directory** of a file's path (the existing `moduleOf`). Files at the root form one module, displayed as **"Root files"** (never "(root)"). |
| P2 | How many modules do the map and matrix show? | The **12 largest modules by file count** (`MAX_GRAPH_MODULES = 12`, ties by name). A note states how many smaller modules are left out. Rules, cycles and violations are computed over the same 12 modules. |
| P3 | Where do module edges come from? | A **seeded sample generator** (`fixtures/sample-module-edges.ts`) seeded from the module names. It stays stable across rescans and snapshots. Each edge carries `meaning: 'source-import'` and a `sample` count of import statements. The screen labels the whole graph "Sample edges, not observed imports". The generator is replaced by a real import provider later, and nothing else changes. |
| P4 | Edge meaning | Every edge type declares its meaning (`source-import` is the only one in Part 2). Map arrows go from importer to imported module; the footnote says so. City arcs are unaffected and still make no dependency claim. |
| P5 | Boundary rules | Rules are **forbid rules** ("A must not import B") with a rationale. They are stored in the **review port**, which gains `listRules`, `saveRule` and `removeRule` (moving part of A10 forward). Evaluation is a pure function over the sample edges, so every verdict is labelled sample. No rules are seeded. The rules tab has an empty state with "Add boundary rule". |
| P6 | Cycles | **Tarjan SCC** over the sample edges. "Cyclic components" counts the SCCs that have more than one module. The algorithm is real; its input is sample. |
| P7 | Hotspots at scale | The scatter plots at most **400 files** (the highest priority in the current filter). A note gives "Showing 400 of N". The table shows **100 rows** plus a "Show 100 more" button. The shortlist is the top 5. CSV export always contains **every** filtered row. |
| P8 | CSV export target | **Download through the leaf's own document**: a `Blob` plus an `<a download>` built from `el.ownerDocument` and `el.win`. Electron shows its save dialog, so the file goes only where the user chooses. **Nothing is written to the vault.** Cells that start with `= + - @` are prefixed with `'` to prevent formula injection. An unknown value is an empty cell, and each metric has its own `_state` column, so absent evidence is never exported as 0. |
| P9 | Source preview | **Metadata only in Part 2.** File detail does not read file content and does not touch `SourceFileSystemPort`. The "Source context" panel shows path, module, category, lines and bytes (collected, from the inventory), a Copy path button, and the note "Source preview arrives with the source provider". Reading content later means deciding scope and approval, and adding host plumbing. `city-view.ts` has no line budget for that. |
| P10 | Which file does File detail show? | The **city-store selection**. There is no new state. If nothing is selected, or the selection is not a file, it shows an `EmptyState` that points to the command palette and the tables. |
| P11 | Paths into File detail | FileInspector gets an **"Investigate file"** action (select, then `navigate('file')`). **Command-palette file items** now open File detail instead of the city. Overview's hotspot rows, Hotspots rows and dots (through "Open detail"), shortlist items, and Module-inspector file rows also select and navigate to `file`. "Show in city" on File detail goes back to `city` and keeps the selection, and the camera does not move. |
| P12 | Architecture ↔ File detail | "Inspect architecture" on File detail navigates to `architecture`. That screen's initially selected module is **the selected file's module**, derived from the selection, so no new state is added. |
| P13 | Finding detail / boundary-refactor planning / architecture export | **Deferred.** Finding rows in File detail are not interactive (the finding-review dialog is Part 3). "Plan a boundary refactor" and "Export architecture" are Part 4, alongside the workbench and report. |

## 2. Screens

### 2.1 Architecture (`screens/ArchitectureScreen.vue` + `screens/architecture/*`)

- **PageHeader**: eyebrow `Explore / Architecture`, title "Architecture, without the guesswork.", and the subtitle from the prototype. Action: **Add boundary rule** (opens `RuleEditor`).
- **Four MetricCards**:
  - Modules (`collected`, derived from the inventory)
  - Sample module edges (`sample`)
  - Cyclic components (`sample`, caption names the members)
  - Boundary violations (`sample`; `unknown` with the reason "No boundary rules defined" when there are no rules)
- **Main panel** with three tabs (a roving-tabindex tablist) and a "Violations only" checkbox:
  - **Dependency map** (`ModuleMap.vue`): modules sit on a deterministic ellipse. Edges are SVG paths with arrowheads, and violating edges are dashed and use the danger tone. Nodes are **HTML buttons positioned over the SVG**, so they are real tab stops with accessible names ("Domain, 24 files, 3 outgoing, 2 incoming"). The SVG is `aria-hidden`, and the matrix is its accessible equivalent.
  - **Dependency matrix** (`DependencyMatrix.vue`): a `<table>` of from-rows × to-columns. A cell with an edge is a button showing the count; cell intensity comes from `--ci-*` scale tokens; an empty cell shows "·"; the diagonal shows "—". Selecting a cell selects that edge.
  - **Boundary rules** (`BoundaryRuleTable.vue`): an EvidenceTable of id, rule, status (Passing / Violation, both sample), violating imports, and a Remove button.
- **Inspector column**:
  - `BoundaryInspector` shows the selected rule (or the selected edge): from → to, rationale, violating import count, and up to 3 "illustrative files". These are the from-module's highest-priority files, labelled sample. Each opens File detail.
  - `ModuleInspector` shows the selected module: file count, lines (evidence-aware sum), incoming and outgoing modules, and its top 5 files by priority, each opening File detail.
- **RuleEditor** (`CiDialog`): from and to module selects (the 12 graph modules, with from ≠ to enforced) and a rationale textarea (required). Save goes through `review-store.addRule`, which assigns ids `AR-001`, `AR-002`, and so on. A duplicate from/to pair is refused with an inline message.
- **View state** (tab, selected module/rule/edge, violations-only) is local to the screen and not persisted.

### 2.2 Hotspots (`screens/HotspotsScreen.vue` + `screens/hotspots/*`)

- **PageHeader**: eyebrow `Explore / Hotspots`, title "Focus effort where it can matter.", prototype subtitle. Actions: **How priority works** (opens `PriorityFormulaDialog`) and **Export shortlist** (CSV, P8).
- **`HotspotScatter.vue`** (SVG, no chart library):
  - Axes: x = commits in 90 days, y = max function cognitive complexity, both starting at 0 and scaled to the data maximum.
  - Radius is proportional to √lines. A file with unknown lines is drawn as a hollow ring at the minimum radius.
  - Fill colour is the coverage band: < 60 %, 60–79 %, ≥ 80 %, or unknown (neutral).
  - The quadrant with complexity ≥ `HIGH_COMPLEXITY` (30) and commits ≥ 22 is shaded and labelled "Complex + frequently changed".
  - The module filter is a `<select>` in the panel header.
  - Only the selected dot is a tab stop. Arrow keys move between dots in priority order, and Enter selects. Clicking selects. A "Selected: name — Open detail" strip sits under the chart.
  - The table below is the accessible equivalent of the chart.
- **`PriorityList.vue`**: the top 5 by priority, each showing raw complexity, commits and coverage, with a priority chip. Activating an item opens File detail.
- **`HotspotTable.vue`**: a text filter and the module filter (shared with the scatter), then an EvidenceTable with file, priority, complexity, commits and branch coverage. Row activation opens File detail.
- **`PriorityFormulaDialog.vue`** (`CiDialog`): the formula verbatim, what each term means, and the handoff's caveat ("not a defect probability, maintainability index, benchmark or team-performance score"). Also states that a file missing any input has an **unknown** priority (A13).

### 2.3 File detail (`screens/FileDetailScreen.vue` + `screens/file/*`)

- **FileHeader**:
  - The "Back" link is **Show in city**.
  - Shows name, source-relative path, and chips for module, commits/90d (sample) and "Sample signals".
  - Actions: **Show in city**, **Inspect architecture**, **Add work item** (reuses `addWorkItemForFile`; shows "In refactor plan" when one exists).
- **Four MetricCards**: max cognitive complexity, branch coverage (caption "n of m instrumented branches"), direct dependents, review priority (`/ 100`, caption "Heuristic, not a failure probability").
- **`SourceContextPanel`**: follows P9.
- **`FileFindingsPanel`**: sample findings from `fixtures/sample-findings.ts`. The file's `findings` count is split into kinds (complexity, unused exports, duplication), each with a rule id (e.g. `CX-<module>-<n>`), a severity and a line. The line is shown only when lines are known and the line is within range; otherwise it reads "line unknown". The panel ends with a Callout: "No findings does not imply no defects. Dynamic imports, reflection, configuration and runtime behaviour may need additional review."
- **`FileHistoryPanel`**: a LineChart of sample complexity and coverage trends for the file (`sampleTrend`, seeded per entity), with a footnote about the different units.
- **`FileWorkItemsPanel`**: this file's work items from the review store, with their status.

## 3. Read models and fixtures

| Unit | Responsibility |
|---|---|
| `fixtures/sample-module-edges.ts` | `sampleModuleEdges(moduleNames)` → `{from,to,meaning:'source-import',imports:number}[]`, deterministic and seeded from the sorted names |
| `fixtures/sample-findings.ts` | `sampleFindings(file: FileSummary)` → deterministic findings, `state: 'sample'` |
| `read-models/modules.ts` | `buildModules(files)` → per-module file count, evidence-aware line sum, top files; `moduleLabel()` (P1) |
| `read-models/architecture.ts` | `buildArchitectureModel(files, rules)` → graph modules (P2), edges, SCCs, matrix, `evaluateRules`, cards, `usesSample` |
| `read-models/hotspots.ts` | `buildHotspotsModel(files, filter)` → points (P7 cap), shortlist, table rows, `usesSample`; `hotspotsCsv(rows)` |
| `read-models/file-detail.ts` | `buildFileDetail(file, workItems)` → cards, findings, history series, metadata rows, `usesSample` |
| `ui/export/download.ts` | `downloadText(el, filename, text, mime)` (P8) |

`useReadModels()` exposes the new models. Screens still import read models only.

## 4. Part 1 deferrals folded in

- **A13 — evidence-aware aggregation.** `evidence.ts` gains `sumEvidence(values)`,
  `ratioEvidence(num, den)` and `countEvidence(values, predicate)`. They follow these rules:
  - No inputs → `unknown`.
  - All inputs have values → a value whose state is the weakest input state, in the order `partial` > `stale` > `sample` > `collected`.
  - Some inputs lack values → `partial`, with the value computed over the present inputs and the reason "n of m inputs missing".
  - No input has a value → `unknown`.

  `priorityScore` becomes evidence-aware (an unknown input makes it unknown). `overview.ts`
  and `city-summary.ts` drop the `m.value ?? 0` pattern and use these helpers. Every new
  model uses them too.
- **A11 — shell ProvenanceBadge.** Every screen read model exposes `usesSample`.
  `shell/use-route-provenance.ts` maps the current route to that flag (placeholder routes
  → false). `TopBar` renders a `ProvenanceBadge` ("Includes sample data") when it is true.
- **A12 — drawer.** When the nav drawer is open, a scrim (`.ci-shell__scrim`) covers the
  content. Clicking the scrim closes the drawer and restores focus. Tab and Shift+Tab wrap
  inside the drawer. Escape behaves as before.

## 5. Deferred minors

**Folded in:**
- `review-store.load()` becomes pending-aware: `nextId = max(nextId, maxStoredId + 1)`, with the same rule for rule ids.
- The shell's hard-coded "Workspace", "Breadcrumb" and "Ctrl K" strings move to `inspector-copy.ts`.
- The palette combobox gets `aria-haspopup="listbox"`.
- The investigation copy uses `moduleLabel()`, so it no longer reads "Protect the (root) module".
- The `kit.css` font-size variables get `em` fallbacks.

**Deferred again:**
- CameraControls re-measuring after a nav-inline flip.
- The duplicate leaf ResizeObservers.

Both sit inside the WP-01 city composition, which has acceptance-test risk and no Part 2
dependency, and `CityWorkspace.vue` has no line budget.

## 6. Testing

- **Unit:**
  - edge generator (deterministic, no self-edges, only the given modules)
  - SCC (hand-built graphs)
  - rule evaluation
  - evidence aggregation, every state combination
  - hotspot cap and CSV (escaping, formula guard, unknown → empty and state column)
  - sample findings (line never beyond known lines)
  - review-store rules and pending-aware load
- **Component:**
  - Architecture: tabs keyboard, map node activation, matrix cell selection, rule add/refuse-duplicate/remove, violations-only
  - Hotspots: filters, scatter keyboard, table "show more", formula dialog, export calls `downloadText` with the full filtered set
  - File detail: empty state, Show in city keeps selection without a camera move, add work item
  - Shell: provenance badge per route, drawer scrim and focus wrap
  - Palette file item → `file`
- **Harness:** `harness-shot` captures `architecture`, `hotspots` and `file` in dark and light and at narrow width. The harness gains `?select=<path>` so the `file` shot has a selection. Compare against the prototype screenshots.
- **Evidence notes:** the WP-01 gate-evidence and implementation-report counts are updated **once, in the final task** (per-task gates run only the touched tests; the final task runs `npm run verify`).

## 7. Out of scope

- Reading real source content (P9).
- A real import graph.
- Finding review, workbench planning and architecture/report export (P13).
- Any persistence beyond memory.
- The city-internal minors listed in §5.
