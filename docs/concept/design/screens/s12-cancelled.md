---
id: S12
product: codebase-inspector
implementation_package: WP-01
status: proposed
reference_theme: dark
---

> **WP-01 refinement:** apply the [version 1.1 behavior baseline](../wp01-review/docs/01-behavior-baseline.md) and [validated interaction reference](../wp01-review/index.html) where they resolve earlier optional behavior. This screen remains a visual specification.

# S12 — Cancelled scan with previous snapshot

![Cancelled scan with previous snapshot — synthetic design fixture](../mockups/s12-cancelled.png)

[Open review scenario](../prototype/index.html?screen=S12) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Understand that a cancelled run has not replaced a complete snapshot.

**Delivery:** WP-01. Initial structural release. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

A user cancelled a new inventory while an earlier complete snapshot existed.

## Layout zones

1. Cancelled banner. 2. Previous city unchanged. 3. Retained snapshot timestamp. 4. Explicit Scan again action.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Scan again | Enter the reviewed authorization path; create a new job ID. |
| Inspect old snapshot | Continue normally with visible old timestamp. |
| Dismiss banner | Do not turn evidence into current data. |

## States, errors, and edge cases

No previous snapshot returns to first-run/profile state with cancellation feedback, not a fake empty scan result.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C05, C08, C10, C12, C16. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Cancelled job identity; discarded partial result; retained complete snapshot and timestamp.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

No partial snapshot is published. A late response from the cancelled job cannot replace the retained snapshot.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
