---
id: UX-FOUNDATION-01
product: codebase-inspector
status: proposed-design-baseline
version: 1.0
---
# Design brief

## Product outcome

Codebase Inspector is an Obsidian desktop plugin for understanding the structure of a local codebase, inspecting analysis evidence, and recording engineering investigations in Markdown. Its first release is a real structural city rendered with Three.js, not a dashboard requiring every provider to be present.

**Primary task:** select a codebase → understand the scan scope → inspect the city → find a file → read exact measurements. Later: inspect a finding → understand its evidence and uncertainty → create an investigation note → revisit a compatible snapshot.

This package translates the existing 12 implementation packages into a proposed UI/UX specification. It does not replace their source-safety, analyzer, or data-contract requirements. No actual source repository was scanned for these designs; all quantities, paths, findings, and excerpts are synthetic fixtures. There has been no user study or Obsidian-host validation.

## Users and jobs

These are role-based design hypotheses, not research-validated personas.

| Role | Job to accomplish | Design consequence |
|---|---|---|
| Developer or maintainer | Find a file, understand its surrounding structure, inspect concrete findings | Search, exact paths, focused neighborhoods, fast keyboard operation |
| Technical lead or architect | Explain structure, assess boundaries, identify worthwhile investigations | Directory grouping, bounded relationships, provenance and comparison |
| Delivery/product colleague | Understand what an issue means and what needs doing without reading every source file | Plain-language descriptions, explicit uncertainty, linked investigation notes |
| New contributor | Build a mental model and navigate back to the source or architecture notes | Stable geometry, breadcrumbs, human explanations, repeatable focus links |

## Hard constraints

Use a native ItemView with the host ribbon, workspace, commands, settings, and theme. Do not add an account, avatar, logo in the product shell, a second global navigation sidebar, independent theme control, localhost server, iframe app, or mandatory companion application. The Obsidian view API supports custom workspace views and their lifecycle; the integration remains a host adapter [S1].

Package 1 supports current vault, a directory inside the vault, and an explicitly chosen external directory. It is desktop-only. Inventory must not run project scripts, Git, fallow, or dependency installation. Source writes remain out of scope. Deliberate Markdown note creation begins in WP-04 and is visibly a vault write, not a source-code edit.

All product UI and specifications are English. Filenames, technical IDs, and provider values retain their original spelling. Long and non-ASCII paths must work; “English UI” is not an ASCII-only data restriction.

## Experience principles

**Spatial orientation before metrics.** The city first explains what exists and where. A large building means many physical lines under the chosen display scale, not bad code.

**Evidence before judgment.** Every derived lens identifies the provider, scope, freshness, and metric. Missing evidence is not zero; an unused candidate is not safe-to-delete proof.

**2D and HTML are first-class.** An accessible file list and inspector provide the core information without WebGL. Use a table, treemap, or list whenever it communicates the question better than a 3D graph.

**Progressive capability.** Do not expose unimplemented modes. Later-release mockups show later-release capabilities; they are not a menu to render in WP-01. An implemented but unconfigured provider can have an explanatory setup state.

**Native context, independent state.** Obsidian owns its shell; each leaf owns camera, selection, search, and panel presentation. Profiles and validated snapshots may be shared as immutable data.

**Intentional work.** Enabling the plugin, reopening a view, displaying a note embed, and importing a report must not authorize filesystem scanning or process execution.

## Visual direction

Neutral native surfaces, restrained accent, six-pixel default corner radius, typographic hierarchy rather than marketing panels, and a dominant canvas. File categories use subdued semantic colors; active selection uses an independent outline and locator. No glowing neon city, decorative traffic, windows, fireworks, constantly rotating scene, or health-grade hero card.

The original image-generated board is a visual exploration, not the implementation source of truth. It includes legacy decorative branding/navigation and coarse phase language that the precise screen specifications deliberately supersede. Implement the numbered screen mockups and written contracts.

## Success evidence to collect

A new user can select the intended source and correctly describe what scanning will and will not do. A user can locate a named file through either the city or the list. Users can distinguish physical lines from complexity, a missing metric from measured zero, and a reported finding from a verified defect. A user can create a note without confusing it with a source-code change. The interface remains usable in narrow leaves, light/dark/custom themes, and without 3D.

These are validation goals; neither the mockups nor a successful browser render establish that they have been achieved.

References: [source register](../sources/sources.md).
