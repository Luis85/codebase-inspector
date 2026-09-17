---
type: Deliverable
order: 160
id: WP-12
title: Optional runtime execution evidence
status: planned
dependsOn: [WP-02, WP-05]
---
# Package 12 — Optional runtime execution evidence

## Outcome

“I can see code observed during a specific execution window without confusing an unobserved path with safely deletable code.”

## Scope and tasks

Select a documented runtime-report provider, verify current licensing and output contracts, add validated import/source mapping, retain build/environment/window metadata, create an execution lens and inspector, and integrate relevant evidence into investigations.

Keep observed production/runtime evidence separate from test coverage, static reachability, and static dependency relationships. Fallow's runtime documentation is an integration reference, not a requirement to buy or enable that service [S12].

## Evidence model

Retain environment, build/revision identity, time window, instrumentation scope, sampling limitations, source-map version, mapping status, and provider confidence/limitations only where actually supplied. Separate executed, not observed, not instrumented, and unmapped states.

The UI should say “Not observed during this window,” not “Never used.” Rare error/recovery flows and unsampled traffic are material limitations. A source-map mismatch is not valid negative execution evidence.

## Privacy and host rules

No automatic instrumentation, source upload, runtime telemetry, license activation, model download, or network access. Start with explicit report import. Any future remote integration needs its own disclosure and review against current Obsidian policies; the plugin itself must not include prohibited client telemetry [S5]. The static plugin remains functional without runtime evidence.

## Acceptance

Fixtures cover partial instrumentation, incomplete windows, build mismatch, sampled captures, source-map failure, and conflicting evidence. A runtime import cannot convert unobserved code into an automatic deletion recommendation. Unknown licensing/capability is a visible integration limitation, not a fabricated supported feature.
