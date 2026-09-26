---
id: S25
product: codebase-inspector
implementation_package: WP-07
status: proposed
reference_theme: dark
---
# S25 — Diagnostics and security evidence

![Diagnostics and security evidence — synthetic design fixture](../mockups/s25-security.png)

[Open review scenario](../prototype/index.html?screen=S25) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Separate package advisories from source diagnostics and exploitability claims.

**Delivery:** WP-07. Later capability; do not expose before its implementation package. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

Supported diagnostics/security reports have been imported.

## Layout zones

1. Separate report families. 2. Original rule/advisory IDs. 3. Exact source or package targets. 4. Attribution and limits.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Select record | Open matching location or package identity, not arbitrary source heat. |
| Inspect severity | Show provider-native severity and provenance. |
| Create investigation | Document uncertainty and verification. |

## States, errors, and edge cases

Duplicate reports; overlapping IDs; conflicting severities; untrusted URLs/HTML; nonexistent source mapping.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C13, C14, C19, C25. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Provider/rule/fingerprint, exact package version where applicable, source location, native severity, observation scope.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

An advisory never automatically marks all files vulnerable. Report content is escaped and cannot execute or open arbitrary paths.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
