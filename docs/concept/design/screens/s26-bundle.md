---
id: S26
product: codebase-inspector
implementation_package: WP-08
status: proposed
reference_theme: light
---
# S26 — Bundle contribution

![Bundle contribution — synthetic design fixture](../mockups/s26-bundle.png)

[Open review scenario](../prototype/index.html?screen=S26) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Inspect shipped bytes without conflating them with source size or runtime speed.

**Delivery:** WP-08. Later capability; do not expose before its implementation package. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

A build artifact report with known module/chunk identity is imported.

## Layout zones

1. Build and byte metric selector. 2. Build treemap. 3. Source-to-chunk contribution. 4. Compression availability.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Select module | Resolve its artifact contributions and optional source link. |
| Change byte metric | Show only reported comparable definitions. |
| Compare build | Require compatible artifact metrics and mapping. |

## States, errors, and edge cases

Shared chunks; multiple dependency versions; missing source maps; unavailable gzip data; virtual modules.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C11, C13, C19, C25. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Build ID, chunks/modules, rendered/minified/compressed definitions, exact source mapping and unknowns.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

Source, rendered, and compressed sizes are not mixed. Compressed per-module estimates are not blindly summed as chunk size.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
