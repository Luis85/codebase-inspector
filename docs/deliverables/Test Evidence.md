---
type: Deliverable
order: 100
id: WP-06
title: Test coverage and test effectiveness
status: planned
dependsOn: [WP-02]
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
