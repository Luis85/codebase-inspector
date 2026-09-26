---
id: S27
product: codebase-inspector
implementation_package: WP-10
status: proposed
reference_theme: dark
---
# S27 — CI artifacts and explicit watch

![CI artifacts and explicit watch — synthetic design fixture](../mockups/s27-artifacts.png)

[Open review scenario](../prototype/index.html?screen=S27) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Import results and authorize a bounded watch session explicitly.

**Delivery:** WP-10. Later capability; do not expose before its implementation package. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

Watch/CI-artifact support is implemented.

## Layout zones

1. Artifact import and validation. 2. Separate explicit watch setup. 3. Job completion versus quality verdict table.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Import artifact | Validate before publishing; no implied source binding. |
| Start watch | Review source, scope, triggers, limits, and session lifetime. |
| Stop watch | Stop future work; clearly retain last complete snapshot. |
| Export snapshot | Preview included data and omit source text by default. |

## States, errors, and edge cases

Rapid events; pending jobs; source changed; unsupported schema; unbound artifact; plugin unload.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C05, C13, C14, C16, C27. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Artifact schema/capabilities, source binding status, watch-session permissions, job IDs and result states.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

An imported artifact never authorizes commands. Latest-job ordering prevents old results replacing new snapshots.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
