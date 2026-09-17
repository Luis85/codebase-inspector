---
id: S04
product: codebase-inspector
implementation_package: WP-01
status: proposed
reference_theme: dark
---

> **WP-01 refinement:** apply the [version 1.1 behavior baseline](../wp01-review/docs/01-behavior-baseline.md) and [validated interaction reference](../wp01-review/index.html) where they resolve earlier optional behavior. This screen remains a visual specification.

# S04 — Scan progress and cancellation

![Scan progress and cancellation — synthetic design fixture](../mockups/s04-scanning.png)

[Open review scenario](../prototype/index.html?screen=S04) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Know what is happening, cancel safely, and retain previous complete results.

**Delivery:** WP-01. Initial structural release. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

The user has explicitly approved a structural inventory.

## Layout zones

1. Running stage. 2. Indeterminate activity bar. 3. Completed stages. 4. Counts read so far. 5. Cancel and retained-snapshot explanation.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Cancel scan | Stop publication of partial work and enter S12 if a previous snapshot exists. |
| Complete scan | Validate and atomically publish the snapshot; enter S05. |
| Read failure | Show scope gaps or blocking error, not zero files. |

## States, errors, and edge cases

Unknown total: no percentage. Known denominator: accessible numerical progress is permitted. Large paths truncate visually with an accessible full value.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C05, C16, C17. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** jobId; profileId; stage; filesReadSoFar; exclusions; currentPath; elapsed time; optional legitimate total.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

The progressbar has no aria-valuenow for an unknown total. Cancelling never replaces the last complete snapshot.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
