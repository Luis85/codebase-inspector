---
id: S06
product: codebase-inspector
implementation_package: WP-01
status: proposed
reference_theme: light
---

> **WP-01 refinement:** apply the [version 1.1 behavior baseline](../wp01-review/docs/01-behavior-baseline.md) and [validated interaction reference](../wp01-review/index.html) where they resolve earlier optional behavior. This screen remains a visual specification.

# S06 — Structural city — light

![Structural city — light — synthetic design fixture](../mockups/s06-city-light.png)

[Open review scenario](../prototype/index.html?screen=S06) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

See the same source, layout, and selection through the host light theme.

**Delivery:** WP-01. Initial structural release. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

Same structural snapshot and selected file as S07, with a light host theme.

## Layout zones

1. Native light surfaces. 2. Identical geometry and selected identity. 3. Light-safe text/selection. 4. Exact measurements.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Change host theme | Recolor surfaces/materials/labels without changing layout, camera, or source. |
| Select file | Same semantics as S07. |
| Use controls | Same hit areas and focus behavior as dark mode. |

## States, errors, and edge cases

Custom accent, light high-contrast theme, increased text size, theme change in a pop-out window.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C01, C06, C07, C08, C09, C10, C11, C12. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Theme semantic variables resolved from owning document; shared snapshot and per-view presentation state.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

There is no in-plugin theme selector. Selected building and focus indicators remain distinguishable on light surfaces.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
