---
id: S19
product: codebase-inspector
implementation_package: WP-05
status: proposed
reference_theme: dark
---
# S19 — Compare compatible snapshots

![Compare compatible snapshots — synthetic design fixture](../mockups/s19-compare.png)

[Open review scenario](../prototype/index.html?screen=S19) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Compare evidence without reshuffling the city or hiding incompatibilities.

**Delivery:** WP-05. Later capability; do not expose before its implementation package. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

Select two compatible snapshots in Compare.

## Layout zones

1. Baseline/current identities. 2. Shared-layout city pair. 3. Changed files and finding deltas. 4. Compatibility explanation.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Choose baseline/current | Validate compatibility before computing deltas. |
| Select changed file | Keep matching selection in both panes. |
| Move camera | Synchronize only when lock is enabled. |
| Inspect delta | Show raw before/after observations and scope. |

## States, errors, and edge cases

Renames; deleted vs excluded files; missing provider; changed threshold; incomplete snapshots.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C11, C13, C19, C24. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Snapshot identities, configuration digests, entity mapping, comparable observations, delta reason.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

A failed provider cannot resolve findings. Layout and scale do not change independently between panes.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
