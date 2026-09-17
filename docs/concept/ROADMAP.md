# Incremental implementation roadmap

All increments belong to one plugin. Do not publish twelve plugins or build every package before the first usable release.

| Package | User-visible result | Required dependencies |
|---|---|---|
| [01 — Native codebase city](packages/01-native-codebase-city.md) | Select a real root and explore its Three.js city inside Obsidian | None |
| [02 — Fallow ingestion](packages/02-fallow-ingestion.md) | Import or explicitly collect findings and color the city by real evidence | 01 |
| [03 — Dependencies and architecture](packages/03-dependency-architecture.md) | Explore directional relationships, cycles, and boundaries | 02 |
| [04 — Investigation and notes](packages/04-investigation-notes.md) | Inspect a finding and create a linked Markdown investigation | 02; 03 enriches it |
| [05 — Snapshot history](packages/05-snapshot-history.md) | Compare compatible states and record change evidence | 02 |
| [06 — Test evidence](packages/06-test-evidence.md) | Inspect coverage and optional mutation results | 02 |
| [07 — Diagnostics and security](packages/07-diagnostics-security.md) | Add lint and security-report providers | 02 |
| [08 — Bundle footprint](packages/08-bundle-footprint.md) | Connect source to built artifact sizes | 02; 05 enables comparisons |
| [09 — Overview and prioritization](packages/09-overview-prioritization.md) | See an explainable investigation queue and summary | 04, 05; other providers optional |
| [10 — Watching and CI artifacts](packages/10-watch-ci-artifacts.md) | Refresh safely and import/export portable evidence | 02, 05 |
| [11 — Note embeds and navigation](packages/11-note-embeds-navigation.md) | Open focused city views from notes and embed bounded previews | 04, 10 |
| [12 — Runtime evidence](packages/12-runtime-evidence.md) | Inspect observed execution with environment/time coverage | 02, 05; 06 recommended |

## Delivery rule

Each package ends with a real-data demonstration, written limitations, contract tests, and an installable plugin build. A fixture is a development tool, not a substitute for the real path-to-view workflow.

Package 01 must not wait for fallow. Package 02 must not require Git or tests. Missing optional providers must not break any prior increment.

## Suggested order

Build 01 → 02 → 03 → 04. This is the first useful evidence-backed product.

Then add 05 and 06, followed by 09 and 10. Add 07 and 08 when those reports are already available in the source workflow. Add 11 after the snapshot/reference contract has proven stable. Treat 12 as an optional integration with separate licensing and privacy review.

## Native entry points by increment

- WP-01: ribbon, “Open codebase city,” “Scan codebase,” “Cancel scan,” source/settings modal.
- WP-02: “Import analysis report,” “Run fallow analysis,” provider diagnostics.
- WP-04: “Create investigation note,” source preview, task/evidence templates.
- WP-05: snapshot selection and baseline comparison.
- WP-10: “Watch codebase,” “Stop watching,” portable snapshot import/export.
- WP-11: safe protocol links and Markdown embeds.

Register command IDs without the plugin ID prefix; Obsidian adds that prefix itself [S3]. Do not show commands for unimplemented capabilities.

## Estimation guidance

Estimate after the repository and supported host version are known. The biggest uncertainty in WP-01 is safe/complete source enumeration and view lifecycle behavior, not drawing a box in Three.js. The biggest uncertainty in WP-02 is the installed fallow contract and its side effects. Do not assign optimistic calendar promises before those spikes are measured.
