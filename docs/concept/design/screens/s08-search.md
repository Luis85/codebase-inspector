---
id: S08
product: codebase-inspector
implementation_package: WP-01
status: proposed
reference_theme: dark
---

> **WP-01 refinement:** apply the [version 1.1 behavior baseline](../wp01-review/docs/01-behavior-baseline.md) and [validated interaction reference](../wp01-review/index.html) where they resolve earlier optional behavior. This screen remains a visual specification.

# S08 — Search and filtered context

![Search and filtered context — synthetic design fixture](../mockups/s08-search.png)

[Open review scenario](../prototype/index.html?screen=S08) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Find a path without destroying the spatial context.

**Delivery:** WP-01. Initial structural release. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

A query such as layout is entered in file-path search.

## Layout zones

1. Focused query field. 2. Match count and clear action. 3. Matching file list. 4. Nonmatching buildings dimmed in place.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Type query | Update counts/list/emphasis with bounded debounce. |
| Select match | Select that ID without re-layout. |
| Focus results | Explicitly frame matching scope, if implemented. |
| Clear search | Restore emphasis and counts; preserve geometry. |

## States, errors, and edge cases

No matches leads S23. Selection outside filter remains identified. Changing source resets or validates the query context.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C06, C07, C08, C09, C10, C11. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Included path index; match IDs; total snapshot files; current selection; query. Source text/symbol search is not implied.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

The query does not modify scope or evidence. The same file occupies the same lot before and after filtering.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
