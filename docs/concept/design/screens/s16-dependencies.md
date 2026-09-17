---
id: S16
product: codebase-inspector
implementation_package: WP-03
status: proposed
reference_theme: dark
---
# S16 — Dependency neighborhood

![Dependency neighborhood — synthetic design fixture](../mockups/s16-dependencies.png)

[Open review scenario](../prototype/index.html?screen=S16) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Read direction and investigate a bounded set of actual dependency edges.

**Delivery:** WP-03. Later capability; do not expose before its implementation package. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

Actual normalized dependency edges are available and a file is selected.

## Layout zones

1. Direction and hop controls. 2. Bounded arcs. 3. Shown/hidden counts. 4. Edge list and inspector.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Outgoing/incoming | Change relation query; do not reverse stored semantics. |
| Expand one hop | Request bounded neighborhood; update hidden count. |
| Select edge | Read importer, imported target, relation type, and evidence. |
| Show edge list | Provide equivalent readable relationships. |

## States, errors, and edge cases

Cycles; unresolved targets; type-only edges; dense graphs; stale source; no outgoing edges.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C08, C09, C10, C11, C21. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Typed directional edges; node IDs; provenance; query depth; edge cap; hidden count.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

Importer → imported module direction is consistent in arcs and list. A static import is never labeled a runtime call.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
