---
id: WP-11
title: Note embeds and focused navigation
status: planned
depends_on: [WP-04, WP-10]
---
# Package 11 — Note embeds and focused navigation

## Outcome

“I can connect architecture notes and investigations to a focused codebase view, and place bounded previews in documentation.”

## Scope

Implement safe navigation to known profile/entity/snapshot IDs and an optional Markdown code-block renderer for saved snapshot previews. Stabilize the internal renderer API through this second consumer before committing to a large public SDK.

Proposed block syntax, not an existing Obsidian feature:

````markdown
```codebase-inspector
profile: project-uuid
snapshot: snapshot-uuid
focus: src/domain
lens: filesystem.category
```
````

The block accepts a strict data schema, not arbitrary expressions, script, executable, or root path. Unknown profiles or missing snapshots display an explanation and an explicit open/reconnect action.

## Tasks

Define reference schema; implement parser/validator; register render child with host lifecycle cleanup; add preview/card UI; register focused navigation; keep selection/camera initialization isolated; add export/retention failure states; document optional integration API.

## Resource rules

A note containing twenty blocks must not create twenty continuously rendering WebGL contexts. Default to static/HTML previews with “Open in city.” Permit a bounded interactive preview only on explicit activation; stop and dispose on unmount. Reuse immutable snapshots, not a global mutable camera. Keep the HTML fallback.

## Navigation safety

A protocol link or note can select an already-known profile/entity; it cannot grant root/executable authorization, run analysis, delete code, or fetch remote payloads. Validate all parameters and scope relative focus paths. Show unavailable/stale references rather than silently substituting unrelated files.

## Acceptance

Opening/closing a note cleans up embeds, missing snapshots are explained, multi-embed performance stays bounded, pop-out notes behave correctly, and malicious block parameters have no filesystem/process side effects. An ordinary investigation note remains readable without the plugin.
