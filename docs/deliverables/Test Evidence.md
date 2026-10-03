---
type: Deliverable
order: 60
id: WP-06
title: Test coverage and test effectiveness
status: planned
dependsOn:
  - WP-02
parent: "[[Plugin MVP]]"
---
# Package 06 — Test coverage and test effectiveness

## Outcome

“I can inspect measured test evidence on the city without mistaking missing instrumentation for zero coverage.”

## Scope and tasks

Start with one validated coverage-report format produced by the team's actual workflow, then add other formats as separate adapters. Support line/branch/function/statement observations and raw covered/total counts. Mutation-test ingestion is a later subincrement; it must not block ordinary coverage.

Build report selection, root/source-map reconciliation, freshness/source checks, coverage lenses, exact inspector values, and filters combined with real complexity/change evidence. Use the established provider-run model and an explainable import summary.

## Constraints

Importing a report or opening a note never runs repository tests. Optional future execution needs separate trust because test/config code can execute arbitrary project logic.

Distinguish measured 0%, absent instrumentation, ignored/excluded files, invalid mapping, and unknown. Aggregate coverage by summing covered and total counts in a compatible scope—not averaging file percentages. No denominator means no valid percentage.

An aggregate coverage report cannot identify exact test-to-file relationships unless the input contains that relation. Passing tests and high line coverage are not proof of behavioral correctness; mutation results remain separate evidence with their own scope and provenance.

## Acceptance

Fixtures verify zero versus missing, denominator weighting, platform path normalization, multiple source roots, stale reports, and source-map failure. A coverage lens remains optional and a report import changes neither source files nor existing investigation notes automatically.

## The plugin's own native coverage (WP-04 Part 2)

The plugin itself is tested inside a real installed Obsidian by `npm run test:e2e`, whose results gate requires 41 named scenarios (`tests/e2e/required-scenarios.json`) across 13 files: `smoke` (2: the plugin loads and opens its default route, and the Investigate route renders in a real leaf), `obsidian-facts` (7: the five host facts the notes rely on, plus code spans and email addresses staying inert), `lifecycle` (2: the test session releases the app, driver and copied folders on failure), `investigation` (2: the note spine, byte-identical human sections across a real refresh, and — added by the WP-04 Part 2 polish pass, T6/T7 — the finding list paging through a report longer than one page while leaving out an unmatched finding), `settings` (7: saved codebases listed, a scan-created codebase listed without a reload, the notes folder and excluded paths saved or refused with a reason, Connect and Clear binding, and — added by the polish pass, P4/NE9 — a setting being typed keeping its text when a write elsewhere refreshes the tab — and, added by gap-closure Part D, a render waiting in the settings tab being released when another settings tab is opened), `plugin-lifecycle` (2: an unload releases views, events and timers; data survives a reload), `commands` (4: open-city and the ribbon, `cancel-scan` mid-run and refused, `import-analysis-report` and refused, and — added by the polish pass, P6/E14 — `scan-codebase` after a Reconnect asking to approve the newly connected folder), `fallow` (3: run the installed fallow, cancel it mid-run and refused, a trusted executable shown in Settings), `notes-index` (2: a folder move and a move made while disabled), `notes-refresh` (3: edited markers refused, a partial frontmatter update reported, a note moved inside the root), `notes-root` (3: a note inside the codebase root excluded from the next scan, also when the root is reached through an alias, and — added by the polish pass, P2/NPF15 — a note created in a folder that exists on disk before Obsidian has indexed it), `preview` (2: a bound codebase previews under its folder and refuses a changed root; Open in Obsidian and Open note) and `city` (2: the city recolours between dark and light themes, and a restored leaf keeps its route after an app restart). The suite is local and opt-in: owner decision O3 gives it **no CI**, so its evidence is the recorded runs on one Windows 11 machine (Obsidian 1.13.4 as the gated baseline, plus one recorded `latest` run), listed in the gate-evidence document's WP-04 Part 2 section and its WP-04 Part 2 polish subsection. It covers the plugin, not a codebase's coverage report, and changes nothing in this package's scope.

Native runs go through a CPU load gate: `npm run test:e2e` samples the machine for 10 s, waits up to 15 minutes for the load to drop below 50 %, and otherwise refuses with exit 3 and writes no native Vitest report (only the run's `load-gate.json`). Each run writes its own evidence, with per-case `environment.json` files, crash-safe session breadcrumbs and Node fatal reports, under `reports/native/runs/<UTC>-<version>/`; the recorded `__fastfail` crash produced no Node fatal report (a fast-fail bypasses Node's report), and its dump came from procdump. A native run also needs a Node whose libuv is 1.52 or newer (Node 24.16 or later) and is refused otherwise (exit 4), because a Windows TCP-connect fault in the libuv of Node 24.15.0 (1.51.0) intermittently crashed native Vitest workers with exit code 0xC0000409. Every run first removes the previous top-level `vitest-results.json` and `junit.xml`, so a refusal or a failed build never leaves an older report at the gate's path, and the libuv guard applies on Windows only, where it also stops a hand-started native run at config load.

The fast suite's own no-freeze case (`tests/integration/fallow-no-freeze.test.ts`, Z38) now runs a 2 s bare control first: when that control's own largest event-loop gap already shows the machine loaded (35 ms or more), the case skips and reports the control's own figure instead of asserting against a host that cannot measure the 50 ms budget honestly; otherwise it runs each of the two modes (a hanging and a streamed child) three times and asserts the 50 ms budget against the smallest of the three largest gaps, and a 2 s post-control skips the case if the machine became loaded part-way through.
