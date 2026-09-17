---
id: WP-09
title: Overview and explainable prioritization
status: planned
depends_on: [WP-04, WP-05]
---
# Package 09 — Overview and explainable prioritization

## Outcome

“I can understand what changed and choose the next investigation from evidence, not an unexplained score.”

## Scope

Build the overview after the city, adapters, investigation workflow, and comparison model work. Show profile, source/snapshot state, provider availability, compatible changes, selected metrics, investigation status, and a compact city preview or focus action. Other providers remain optional.

## Tasks

Define aggregation/read models; implement availability cards; connect snapshot comparison; create an explainable queue; associate existing investigation notes; add cross-view focus/navigation; reconcile summary totals with underlying evidence.

Start with explicit filters and a visible ordering policy, for example introduced findings, specified complexity/change combinations, or measured coverage gaps. Every entry exposes contributing signals and missing evidence. A team preference is a policy setting, not an objective scientific score.

## Obsidian-specific behavior

The overview is an in-plugin mode or registered view, not a second global application shell. Keep Markdown investigations authoritative for the human decision/status. Do not automatically resolve a task when its finding disappears. Clicking a card opens the filtered evidence; clicking a note opens the note through Obsidian.

## Acceptance

All counts reconcile; failed/absent providers appear distinctly; comparisons are only shown when compatible; every prioritized item has an explanation and drill-down. A fallow-only configuration remains useful. No fake charts are shown to fill empty dashboard space.
