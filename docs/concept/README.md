---
project: codebase-inspector
title: Codebase Inspector — Obsidian implementation kit
status: proposed
updated: 2026-09-17
---
# Codebase Inspector — Obsidian implementation kit

Codebase Inspector is an Obsidian plugin for exploring a codebase as an interactive Three.js city, enriching it with fallow and other analysis evidence, and connecting investigations to Markdown notes.

**This revision replaces the earlier standalone CLI/browser delivery plan.** The project and plugin ID are `codebase-inspector`; the human-readable name is **Codebase Inspector**. The city is a feature, not a separate product named Codebase City.

These files are implementation specifications, not executable plugin code. No current project repository was supplied or inspected for this revision. Reconcile these proposals with existing implementation before modifying code.

## Start here

1. [Product brief](PRODUCT.md) — scope and decisions.
2. [Migration decisions](MIGRATION.md) — what changes from the previous plan.
3. [Roadmap](ROADMAP.md) — twelve independently deliverable increments.
4. [Architecture and contracts](architecture/architecture-and-contracts.md) — boundaries, host integration, storage, and safety.
5. [Package 01](packages/01-native-codebase-city.md) — first executable vertical slice.
6. [Agent execution guide](execution/agent-execution-guide.md) and [quality gates](execution/quality-gates.md).
7. [Sources](SOURCES.md) — primary documentation checked on 17 September 2026.

## Fixed user decisions

- Project name: `codebase-inspector`.
- Product host: Obsidian plugin.
- First implementation package: a real codebase city using Three.js.
- Incremental delivery; users can point the plugin at a codebase.
- fallow is the initial analysis provider, not the only potential provider.

## Proposed implementation defaults

Desktop-only initial manifest, TypeScript, Vue 3, Pinia, Three.js, a single Obsidian plugin distribution, and a host-independent snapshot/layout core. No runtime web server, iframe, account, telemetry, cloud backend, dependency installer, or mandatory CLI.

These defaults are architecture proposals, not additional requirements previously stated by the user. Mobile is not included in the initial commitment. A read-only mobile viewer would require a separately verified execution path and manifest strategy.

## Release boundaries

- **R1 — Structural explorer:** Package 01 alone.
- **R2 — Evidence-backed investigation:** Packages 01–04.
- **R3 — Maintenance workflow:** Packages 05, 06, 09, and 10 added to R2; 07 and 08 are optional providers.
- **R4 — Knowledge embedding and advanced evidence:** Packages 11 and 12 as justified.

## Document conventions

`WP-xx` identifies a delivery increment, not an npm package or separate plugin. All types, command IDs, view IDs, note schemas, directory layouts, thresholds, and examples are proposed product contracts. They are not claims that these features already exist in Obsidian or fallow. Source references such as [S1] resolve in SOURCES.md.
