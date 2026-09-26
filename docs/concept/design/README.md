# Version 1.1 — first-release interaction refinement

Start with **[WP-01 review library](wp01-review/gallery.html)** or **[the offline interaction reference](wp01-review/index.html)**. The new **[design-to-implementation handoff](WP01-DESIGN-TO-IMPLEMENTATION.md)** resolves first-release interaction defaults and adds typed renderer contracts, eight build packets, and validation gates.

The existing 28 screen mockups/specifications and later-package concepts remain included below. Version 1.1 governs WP-01 behavior where it refines earlier optional wording. Existing implementation safety requirements remain binding. The older all-package SVG prototype is retained as a visual scenario browser, not the updated first-release interaction authority.

The new runnable reference uses a **Canvas 2D projection simulator**, not Three.js. Three.js is still the production requirement; only its integration contract is supplied here. No actual repository was scanned or modified.

**Reference validation: 31 state tests and 28 browser checks passed.** Actual Obsidian, Three.js, filesystem, assistive-technology, and performance gates remain open.

---

---
product: codebase-inspector
artifact: ui-ux-design-package
version: 1.0
status: proposed-design-baseline
date: 2026-09-17
---
# Codebase Inspector — UI/UX design package

An Obsidian-native, incrementally implementable design for a Three.js codebase city, evidence inspection, and Markdown investigations.

**Start with [the visual design library](index.html).** Extract the complete package first, then open `index.html`. The gallery links each mockup to its screen specification and review scenario. No hosted service or installation is required for the design assets.

## Included

**28 numbered screen mockups with 28 matching Markdown specifications**, **4 annotated concept/interaction boards**, an optional image-generated visual exploration, a local click-through review prototype, **27 component contracts**, semantic token CSS/JSON, information architecture, user flows, camera/selection/keyboard rules, evidence-state and recovery definitions, accessibility and responsive guidance, microcopy, a note template, **23 use-case PBIs**, an agent implementation prompt, and validation materials.

The numbers, files, findings, report excerpts, and dates shown in the screens are synthetic. These are proposed designs, not screenshots of a working Obsidian plugin or an analysis of your repository. The prototype uses an SVG stand-in for the production Three.js renderer and simulated workflows. [Validation status](validation/validation-status.md) distinguishes completed asset checks from unperformed host and usability testing.

## Read in this order

1. [Design brief](foundations/01-design-brief.md), [information architecture](foundations/02-information-architecture.md), and [package map](handoff/package-map.md).
2. [Visual system](foundations/03-design-system.md), [component library](components/component-library.md), [interaction contract](interactions/01-core-interactions.md), and [accessibility](foundations/04-accessibility-and-responsive.md).
3. The numbered screens for the package being implemented, then [UI backlog](handoff/ui-backlog.md) and [agent prompt](handoff/agent-implementation-prompt.md).

## First delivery boundary

**WP-01 covers S01–S13 and S23.** It includes source selection, scope review, cancellable real inventory, structural city, selection, search, top view, native themes/settings, narrow leaves, and HTML fallback. It does not need fallow, dependencies, findings, note creation, or an overview dashboard to be useful.

Later-release controls are shown only in later-release screens. Do not implement their navigation as empty placeholders in the first release.

## Concept boards

- [01 — Native city, dark/light](concepts/01-native-city-dark-light.png)
- [02 — Interaction and investigation](concepts/02-interaction-and-investigation.png)
- [03 — Responsive and recovery states](concepts/03-responsive-and-recovery.png)
- [04 — Components and evidence semantics](concepts/04-component-and-evidence-semantics.png)

The [optional image-generated exploration](concepts/00-visual-exploration.png) conveys an early visual direction. Its decorative branding, sidebar/menu, broad “Phase 1” labels, and simplified copy are **not authoritative**. The numbered screens and written contracts supersede those elements. Do not implement that board literally.

## Screen catalogue

| Screen | Package | Specification | Mockup |
|---|---|---|---|
| S01 — Welcome and first run | WP-01 | [Spec](screens/s01-welcome.md) | [PNG](mockups/s01-welcome.png) |
| S02 — Choose a codebase source | WP-01 | [Spec](screens/s02-source.md) | [PNG](mockups/s02-source.png) |
| S03 — Review scope and read access | WP-01 | [Spec](screens/s03-scope.md) | [PNG](mockups/s03-scope.png) |
| S04 — Scan progress and cancellation | WP-01 | [Spec](screens/s04-scanning.md) | [PNG](mockups/s04-scanning.png) |
| S05 — Structural city — dark | WP-01 | [Spec](screens/s05-city.md) | [PNG](mockups/s05-city.png) |
| S06 — Structural city — light | WP-01 | [Spec](screens/s06-city-light.md) | [PNG](mockups/s06-city-light.png) |
| S07 — File selection and inspector | WP-01 | [Spec](screens/s07-selected.md) | [PNG](mockups/s07-selected.png) |
| S08 — Search and filtered context | WP-01 | [Spec](screens/s08-search.md) | [PNG](mockups/s08-search.png) |
| S09 — Top-down orientation | WP-01 | [Spec](screens/s09-top.md) | [PNG](mockups/s09-top.png) |
| S10 — Narrow leaf and inspector drawer | WP-01 | [Spec](screens/s10-narrow.md) | [PNG](mockups/s10-narrow.png) |
| S11 — Accessible list and 3D fallback | WP-01 | [Spec](screens/s11-fallback.md) | [PNG](mockups/s11-fallback.png) |
| S12 — Cancelled scan with previous snapshot | WP-01 | [Spec](screens/s12-cancelled.md) | [PNG](mockups/s12-cancelled.png) |
| S13 — Native settings and profiles | WP-01 | [Spec](screens/s13-settings.md) | [PNG](mockups/s13-settings.png) |
| S14 — Connect fallow evidence | WP-02 | [Spec](screens/s14-provider.md) | [PNG](mockups/s14-provider.png) |
| S15 — Fallow findings lens | WP-02 | [Spec](screens/s15-findings.md) | [PNG](mockups/s15-findings.png) |
| S16 — Dependency neighborhood | WP-03 | [Spec](screens/s16-dependencies.md) | [PNG](mockups/s16-dependencies.png) |
| S17 — Finding investigation workbench | WP-04 | [Spec](screens/s17-workbench.md) | [PNG](mockups/s17-workbench.png) |
| S18 — Create investigation note | WP-04 | [Spec](screens/s18-note.md) | [PNG](mockups/s18-note.png) |
| S19 — Compare compatible snapshots | WP-05 | [Spec](screens/s19-compare.md) | [PNG](mockups/s19-compare.png) |
| S20 — Coverage with unknown evidence | WP-06 | [Spec](screens/s20-coverage.md) | [PNG](mockups/s20-coverage.png) |
| S21 — Explainable overview | WP-09 | [Spec](screens/s21-overview.md) | [PNG](mockups/s21-overview.png) |
| S22 — Provider failure and retained evidence | WP-02 | [Spec](screens/s22-failure.md) | [PNG](mockups/s22-failure.png) |
| S23 — No matching files | WP-01 | [Spec](screens/s23-no-results.md) | [PNG](mockups/s23-no-results.png) |
| S24 — Investigation note and focused city | WP-11 | [Spec](screens/s24-embed.md) | [PNG](mockups/s24-embed.png) |
| S25 — Diagnostics and security evidence | WP-07 | [Spec](screens/s25-security.md) | [PNG](mockups/s25-security.png) |
| S26 — Bundle contribution | WP-08 | [Spec](screens/s26-bundle.md) | [PNG](mockups/s26-bundle.png) |
| S27 — CI artifacts and explicit watch | WP-10 | [Spec](screens/s27-artifacts.md) | [PNG](mockups/s27-artifacts.png) |
| S28 — Runtime observation window | WP-12 | [Spec](screens/s28-runtime.md) | [PNG](mockups/s28-runtime.png) |

## Shared contracts and implementation support

[User flows](flows/user-flows.md) · [State and recovery model](interactions/02-states-and-recovery.md) · [Evidence/visual encoding](interactions/03-evidence-and-visual-encoding.md) · [Microcopy](interactions/04-microcopy.md) · [Component contract JSON](components/component-contracts.json) · [Token CSS](components/design-tokens.css) · [Token JSON](components/design-tokens.json) · [Investigation-note template](templates/investigation-note.md)

[Usability study plan](validation/usability-plan.md) · [Acceptance scenarios](validation/acceptance-tests.feature) · [Review checklist](validation/design-review-checklist.md) · [Source register](sources/sources.md)

## Design authority and open decisions

Safety/evidence/accessibility contracts take precedence over images; screen specs take precedence over simplified prototype behavior. Actual Three.js/fallow/Obsidian versions, final performance budgets, production component API names, exact reference scales at very large repository sizes, and user-tested breakpoints remain implementation decisions to validate.

The selected direction is a **proposed baseline**, not a claim that user research has approved it. Keep English UI, Obsidian-native themes and workspace, independent leaf state, explicit source/execution authority, and absence of invented health/deletion scores as fixed constraints unless deliberately revisited.

## Files and formats

All Markdown specs embed their matching screenshot with a relative path. The package also contains HTML reading copies, PNG mockups, local SVG city source illustrations, editable HTML/CSS/JS review sources, and JSON registries. No Figma source file, font files, compiled plugin, production source code, or external runtime asset dependency is included.
