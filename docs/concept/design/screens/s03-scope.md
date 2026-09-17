---
id: S03
product: codebase-inspector
implementation_package: WP-01
status: proposed
reference_theme: dark
---

> **WP-01 refinement:** apply the [version 1.1 behavior baseline](../wp01-review/docs/01-behavior-baseline.md) and [validated interaction reference](../wp01-review/index.html) where they resolve earlier optional behavior. This screen remains a visual specification.

# S03 — Review scope and read access

![Review scope and read access — synthetic design fixture](../mockups/s03-scope.png)

[Open review scenario](../prototype/index.html?screen=S03) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Understand the resolved root and exclusions before starting a read-only inventory.

**Delivery:** WP-01. Initial structural release. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

A source has been resolved but the scan has not been approved.

## Layout zones

1. Resolved root summary. 2. Default and user exclusions. 3. Specific read-access explanation. 4. Unchecked acknowledgement and disabled Scan action.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Review exclusions | Show exact configured scope; do not pretend a recursive count exists yet. |
| Approve checkbox | Enable Scan codebase for this reviewed root. |
| Scan codebase | Create a job and enter S04. |
| Back | Return S02 and invalidate review if root changes. |

## States, errors, and edge cases

Consent defaults to unchecked. Path normalization changes are visible. Root permissions can still change after review; failures recover without scanning a fallback root.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C03, C04, C15, C16. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Resolved root; exclusion rules; traversal limits; scan-only capabilities; source revision unavailable until observed.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

A scan cannot start while consent is false. Approving read access does not authorize an analyzer or note write.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
