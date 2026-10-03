---
id: S20
product: codebase-inspector
implementation_package: WP-06
status: proposed
reference_theme: light
---
# S20 — Coverage with unknown evidence

![Coverage with unknown evidence — synthetic design fixture](../mockups/s20-coverage.png)

[Open review scenario](../prototype/index.html?screen=S20) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Distinguish measured zero coverage from unavailable coverage.

**Delivery:** WP-06. Later capability; do not expose before its implementation package. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

A mapped test-coverage report is attached.

## Layout zones

1. Measured/unmeasured file counts. 2. Measured, measured-zero, unknown encodings. 3. Numerator/denominator inspector. 4. Report provenance.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Select metric | Separate lines/branches/functions/statements. |
| Select file | Show the mapped covered/total values and reason for missing evidence. |
| View report scope | Explain excluded or noninstrumented files. |

## States, errors, and edge cases

0 covered with nonzero total; no instrumentation; zero denominator; source-map mismatch; stale capture.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C08, C10, C11, C13, C19. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Coverage observations with covered/total, kind, source map/build identity, instrumented scope, provider run.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

Measured zero differs visually and textually from absent data. Aggregate ratios use totals, not averages of file percentages.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
