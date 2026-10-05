---
id: S15
product: codebase-inspector
implementation_package: WP-02
status: proposed
reference_theme: dark
---
# S15 — Fallow findings lens

![Fallow findings lens — synthetic design fixture](../mockups/s15-findings.png)

[Open review scenario](../prototype/index.html?screen=S15) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Distinguish reported findings from unavailable measurements.

**Delivery:** WP-02. Later capability; do not expose before its implementation package. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

Compatible fallow findings are attached to the structural snapshot.

## Layout zones

1. Reported-findings lens control. 2. Scope/freshness badge. 3. Count/category coloring. 4. Unknown/unreported hatch. 5. Evidence inspector.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Select reported file | Inspect provider finding identity and location. |
| Switch to category | Restore category colors without relayout. |
| Review provenance | See provider/version/scope/time/source match. |

## States, errors, and edge cases

Thresholded output is not complete complexity measurement. Stale imported data has an explicit badge/banner.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C06, C08, C10, C11, C13, C14. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Normalized finding IDs, locations, type, severity, provider scope; compatible source IDs; observation availability.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

No-finding files are not labeled healthy or zero complexity. Each highlighted record resolves to source-relative evidence.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
