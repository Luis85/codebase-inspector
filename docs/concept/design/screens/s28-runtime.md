---
id: S28
product: codebase-inspector
implementation_package: WP-12
status: proposed
reference_theme: dark
---
# S28 — Runtime observation window

![Runtime observation window — synthetic design fixture](../mockups/s28-runtime.png)

[Open review scenario](../prototype/index.html?screen=S28) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Distinguish not observed, not instrumented, and unmapped execution evidence.

**Delivery:** WP-12. Later capability; do not expose before its implementation package. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

Optional runtime evidence is imported with build/window mapping.

## Layout zones

1. Environment/time window/build. 2. Observed/unobserved/uninstrumented colors and text. 3. Per-file observation inspector. 4. Sampling limitations.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Change observation window | Display explicitly provided capture and matching source. |
| Select file | Inspect observation and instrumentation state. |
| Review mapping | Explain unmapped source or mismatched build. |

## States, errors, and edge cases

Rare workflow; sampled capture; partial instrumentation; source-map mismatch; stale deployment; unmapped ranges.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C08, C10, C11, C13, C19. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Capture ID, build/environment, observation period, sampling, instrumented inventory, mapped observations.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

Not observed never becomes unused or safe to delete. Test coverage and runtime execution are not merged as the same evidence.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
