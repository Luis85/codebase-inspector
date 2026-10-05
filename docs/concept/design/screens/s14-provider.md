---
id: S14
product: codebase-inspector
implementation_package: WP-02
status: proposed
reference_theme: dark
---
# S14 — Connect fallow evidence

![Connect fallow evidence — synthetic design fixture](../mockups/s14-provider.png)

[Open review scenario](../prototype/index.html?screen=S14) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Choose report import or explicit execution of an already installed analyzer.

**Delivery:** WP-02. Later capability; do not expose before its implementation package. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

A user requests fallow evidence with no connected provider.

## Layout zones

1. Provider purpose. 2. Import-report route. 3. Installed-executable route. 4. No-installation disclosure.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Import report | Choose artifact, validate schema/version/scope, review mapping, then attach evidence. |
| Use installed analyzer | Review executable/version/root/arguments/side effects before approval. |
| Cancel | Continue structural city unchanged. |

## States, errors, and edge cases

Missing binary; executable from untrusted repo; unsupported report version; JSON parse error; report source mismatch.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C13, C14, C15, C16. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Provider capability descriptor; import metadata; run configuration; supported adapter versions. No report-provided command authority.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

The plugin does not download/install fallow. Unsupported data yields a specific error, not an all-green city.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
