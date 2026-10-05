---
id: S17
product: codebase-inspector
implementation_package: WP-04
status: proposed
reference_theme: dark
---
# S17 — Finding investigation workbench

![Finding investigation workbench — synthetic design fixture](../mockups/s17-workbench.png)

[Open review scenario](../prototype/index.html?screen=S17) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Investigate the selected finding using provenance and evidence.

**Delivery:** WP-04. Later capability; do not expose before its implementation package. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

Open a finding from a city inspector or local Findings mode.

## Layout zones

1. Filterable finding queue. 2. Selected finding and exact location. 3. Optional verified excerpt. 4. Supports/unknown evidence. 5. Note action and provenance.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Select finding | Load its own record and preserve queue position. |
| Read excerpt | Require explicit source access and exact source match. |
| Focus file in city | Return to correct profile/snapshot/file. |
| Create note | Enter S18 with evidence prefilled. |

## States, errors, and edge cases

Missing source; changed content; unsupported precise trace; stale provider; suppressed finding; no finding matches.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C10, C13, C14, C19, C22. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Canonical finding, provider record, source hash check, evidence explanation, unavailable fields with reasons.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

A displayed excerpt is not assumed current from line number alone. No probability-of-safe-deletion or automatic-fix action appears.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
