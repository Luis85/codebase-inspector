---
id: S18
product: codebase-inspector
implementation_package: WP-04
status: proposed
reference_theme: light
---
# S18 — Create investigation note

![Create investigation note — synthetic design fixture](../mockups/s18-note.png)

[Open review scenario](../prototype/index.html?screen=S18) · [Component library](../components/component-library.md) · [Interaction contract](../interactions/01-core-interactions.md)

## Outcome and release boundary

Preview a deliberate Markdown note write without changing source code.

**Delivery:** WP-04. Later capability; do not expose before its implementation package. The grey bottom caption and the optional review-harness controls are not production interface. The host chrome is an illustrative context, not a pixel-perfect specification of Obsidian itself.

## Entry and preconditions

Create note was chosen from a selected finding.

## Layout zones

1. Explicit vault-write disclosure. 2. Title and destination. 3. Human investigation question. 4. Optional evidence/excerpt choices. 5. Markdown preview.

In production, panel sizes follow the leaf-container rules. The screenshot is a reference composition rather than a fixed resolution requirement. All long paths remain available as accessible text.

## User interactions

| Trigger | Expected behavior |
|---|---|
| Edit title/folder | Validate destination using vault semantics; preserve text. |
| Include excerpt | Explicit additional inclusion; show source-sharing implication. |
| Create note | Write after validation; show actual result and offer Open. |
| Cancel dirty draft | Confirm discard or keep editing. |

## States, errors, and edge cases

Name collision; read-only vault; invalid folder; stale evidence; missing snapshot; source excerpt unavailable.

Use the [state catalogue](../interactions/02-states-and-recovery.md) and [microcopy](../interactions/04-microcopy.md). Operational failure, missing observations, and quality findings are not the same state.

## Components and data

**Components:** C15, C16, C22, C23. See the [component contract registry](../components/component-contracts.json).

**Data consumed:** Vault-relative destination; user-authored question; profile/snapshot/finding references; optional source excerpt with provenance.

Components emit intents; the application validates and performs work. Neither the renderer nor a report artifact obtains authority to read paths, execute commands, or write notes.

## Keyboard, accessibility, and focus

Required actions are reachable through normal labeled HTML controls. Do not depend on hover, color, dragging, double-click, or a canvas-only route. Modal steps contain focus and return it to the opener; nonmodal inspector drawers do not pretend to be modal. Obsidian-wide shortcuts are not hijacked. See [accessibility and responsive rules](../foundations/04-accessibility-and-responsive.md).

## Acceptance checks

Default export omits absolute source paths and source text. Failed creation preserves the draft and does not announce success.

Verify this screen in light/dark host themes, at increased text size, and in a narrow leaf. Confirm late asynchronous results cannot publish to another profile/view. Preserve the distinction between validated observations and the synthetic fixture shown here.

## Prototype limits

The review prototype uses an SVG city stand-in and simulated in-memory workflows. It does not scan, run fallow, validate real reports, write notes, execute inside Obsidian, or implement every production edge case. The written contracts are normative for implementation; the prototype is for discussing hierarchy, flow, and states.
