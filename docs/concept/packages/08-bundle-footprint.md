---
id: WP-08
title: Bundle and dependency footprint
status: planned
depends_on: [WP-02]
---
# Package 08 — Bundle and dependency footprint

## Outcome

“I can distinguish repository size from what contributes to the shipped application.”

## Scope and tasks

Choose one report format that matches the actual build pipeline and verify its documented machine output. Add a build-artifact/chunk/module model, source mapping, dependency version identities, size observations, city highlighting, and an alternative treemap/list. WP-05 enables build comparisons.

Tasks: fixture capture; validator/normalizer; source-to-build mapping; chunk relationships; size metric definitions; inspector and filters; compatible comparison; double-counting tests.

## Rules

Source bytes, rendered bytes, minified bytes, and compressed sizes are distinct metrics. Per-module compressed estimates need not add exactly to an independently compressed chunk. Mark estimates and shared contribution explicitly.

Do not execute a project's build because its profile was opened. Importing artifact reports is sufficient. Build configurations and plugins are executable code and require separate trust if execution is ever added.

A source file absent from a particular bundle is not necessarily globally unused; it may belong to another entry, target, dynamic build, or test. Bundle size is not measured runtime latency or performance.

## Acceptance

A known file traces to real module/chunk records. Shared chunks, repeated dependencies, multiple versions, generated modules, and multiple build targets are not double-counted or silently conflated. Stale or mismatched build/source artifacts are marked unverified. Reports remain optional.
