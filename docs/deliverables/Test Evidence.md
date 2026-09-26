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

The plugin itself is tested inside a real installed Obsidian by `npm run test:e2e`, whose results gate requires 36 named scenarios (`tests/e2e/required-scenarios.json`) across 13 files: `smoke` (2: the plugin loads and opens its default route, and the Investigate route renders in a real leaf), `obsidian-facts` (7: the five host facts the notes rely on, plus code spans and email addresses staying inert), `lifecycle` (2: the test session releases the app, driver and copied folders on failure), `investigation` (1: the note spine, byte-identical human sections across a real refresh), `settings` (5: saved codebases listed, a scan-created codebase listed without a reload, the notes folder and excluded paths saved or refused with a reason, Connect and Clear binding), `plugin-lifecycle` (2: an unload releases views, events and timers; data survives a reload), `commands` (3: open-city and the ribbon, `cancel-scan` mid-run and refused, `import-analysis-report` and refused), `fallow` (3: run the installed fallow, cancel it mid-run and refused, a trusted executable shown in Settings), `notes-index` (2: a folder move and a move made while disabled), `notes-refresh` (3: edited markers refused, a partial frontmatter update reported, a note moved inside the root), `notes-root` (2: a note inside the codebase root excluded from the next scan, also when the root is reached through an alias), `preview` (2: a bound codebase previews under its folder and refuses a changed root; Open in Obsidian and Open note) and `city` (2: the city recolours between dark and light themes, and a restored leaf keeps its route after an app restart). The suite is local and opt-in: owner decision O3 gives it **no CI**, so its evidence is the recorded runs on one Windows 11 machine (Obsidian 1.13.4 as the gated baseline, plus one recorded `latest` run), listed in the gate-evidence document's WP-04 Part 2 section. It covers the plugin, not a codebase's coverage report, and changes nothing in this package's scope.
