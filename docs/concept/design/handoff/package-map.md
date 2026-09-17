# UI/UX delivery map

The design follows the existing 12 Obsidian implementation packages. A mockup for a later package is not permission to add nonfunctional navigation to an earlier release.

| Package | Design coverage | Mandatory UI outcome |
|---|---|---|
| WP-01 — Native codebase city | S01, S02, S03, S04, S05, S06, S07, S08, S09, S10, S11, S12, S13, S23 | Native real-source structural workflow |
| WP-02 — Fallow ingestion and lenses | S14, S15, S22 | Fallow ingestion and lenses |
| WP-03 — Dependencies and architecture | S16 | Dependencies and architecture |
| WP-04 — Investigation and notes | S17, S18 | Investigation and notes |
| WP-05 — Snapshot history | S19 | Snapshot history |
| WP-06 — Test evidence | S20 | Test evidence |
| WP-07 — Diagnostics and security | S25 | Diagnostics and security |
| WP-08 — Bundle footprint | S26 | Bundle footprint |
| WP-09 — Overview and prioritization | S21 | Overview and prioritization |
| WP-10 — Watch and CI artifacts | S27 | Watch and CI artifacts |
| WP-11 — Note embeds and focus links | S24 | Note embeds and focus links |
| WP-12 — Runtime evidence | S28 | Runtime evidence |

## WP-01 design slice

Implement S01–S13 plus S23, shared components C01–C12 and relevant native/status/responsive components. C13–C27 are not all prerequisites. Build the real plugin shell and source-to-city path; add failure, fallback, and lifecycle states before moving to provider dashboards.

The implementation order is: host adapter → source/snapshot contract → source/scope UI → filesystem/progress integration → pure layout → renderer → list/search/inspector → theme/leaf lifecycle → accessibility/fallback → release verification. UI fixture work may proceed in parallel, but it must integrate with real data before acceptance.

## Design versus implementation changes

Consolidate with existing source/snapshot/provider models before adding presentation DTOs. A renderer port and per-view presentation state are legitimate boundaries; duplicating the domain schema in UI stores is not. Use the screenshots for hierarchy and spacing and the textual rules for permissions, state, evidence meaning, and accessibility.

Screens S25–S28 provide complete workflow direction for later evidence families but require provider-specific schema mapping and error-fixture validation during implementation. They are not claims that those integrations already exist.

## Handoff precedence

1. Source-safety, privacy, accessibility, and evidence contracts.
2. Screen specification and component interaction contract.
3. Numbered screen mockup composition.
4. Review prototype behavior (deliberately partial).
5. Exploratory image-generated board.

Resolve any conflict explicitly; do not reproduce a decorative or misleading element from a concept image over the written baseline.
