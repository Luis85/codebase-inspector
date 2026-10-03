# UI/UX implementation backlog

Status: **designed, not yet estimated or ready**. Each PBI is phrased as a use case and belongs to the corresponding implementation package. Refine contracts and validate prerequisites before marking ready. No engineering estimates are invented here.

## UX-PBI-01 — Select a codebase for inspection

**Package:** WP-01. **Screens:** S01–S03.

**User agreement:** the user can select a codebase for inspection without losing context or changing source unintentionally.

**Tasks:** Choose source modes; validate root; review exclusions; explicit read acknowledgement.

**Acceptance:** Valid directory and deliberate approval reach inventory; invalid input stays editable.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-02 — Observe and cancel an inventory

**Package:** WP-01. **Screens:** S04, S12.

**User agreement:** the user can observe and cancel an inventory without losing context or changing source unintentionally.

**Tasks:** Stage/status region; bounded progress; cancel intent; retained-result banner.

**Acceptance:** Cancelling cannot publish partial results or reset previous evidence.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-03 — Explore the structural city

**Package:** WP-01. **Screens:** S05, S09.

**User agreement:** the user can explore the structural city without losing context or changing source unintentionally.

**Tasks:** Instanced Three.js building view; category/height legend; fit/top controls.

**Acceptance:** Every included file maps to the correct building; exact values are available in HTML.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-04 — Select and inspect a file

**Package:** WP-01. **Screens:** S06, S07.

**User agreement:** the user can select and inspect a file without losing context or changing source unintentionally.

**Tasks:** Selected ID propagation; inspector; copy path; focus action; missing metrics.

**Acceptance:** Click selects without camera movement and does not fabricate missing measurements.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-05 — Find a file without losing context

**Package:** WP-01. **Screens:** S08, S23.

**User agreement:** the user can find a file without losing context without losing context or changing source unintentionally.

**Tasks:** Path search; result counts; dim nonmatches; no-results recovery.

**Acceptance:** Search does not reshape the layout and zero matches does not imply empty codebase.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-06 — Use the inspector without 3D

**Package:** WP-01. **Screens:** S11.

**User agreement:** the user can use the inspector without 3D without losing context or changing source unintentionally.

**Tasks:** List-first route; renderer recovery; accessible table; equivalent detail.

**Acceptance:** Core tasks succeed when WebGL is unavailable.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-07 — Use a narrow workspace leaf

**Package:** WP-01. **Screens:** S10.

**User agreement:** the user can use a narrow workspace leaf without losing context or changing source unintentionally.

**Tasks:** Leaf size observation; panel collapse; drawer controls; safe focus return.

**Acceptance:** No source task is lost when panel composition changes.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-08 — Manage codebase profiles and limits

**Package:** WP-01. **Screens:** S13.

**User agreement:** the user can manage codebase profiles and limits without losing context or changing source unintentionally.

**Tasks:** Native settings; local bindings; exclusions; retention/read disclosures.

**Acceptance:** Settings changes do not trigger scans or remove source files.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-09 — Keep views independent and cleanly dispose them

**Package:** WP-01. **Screens:** S05–S13.

**User agreement:** the user can keep views independent and cleanly dispose them without losing context or changing source unintentionally.

**Tasks:** Leaf-scoped camera/query; resize; hidden-state pause; pop-out rebind; unload.

**Acceptance:** Two views do not share selection or leak GPU/listener resources.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-10 — Use host themes and accessible controls

**Package:** WP-01. **Screens:** S06, S10, S11.

**User agreement:** the user can use host themes and accessible controls without losing context or changing source unintentionally.

**Tasks:** Semantic token bridge; keyboard/non-drag alternatives; contrast and text scaling.

**Acceptance:** Actual-host accessibility checks produce recorded outcomes rather than assumptions.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-11 — Attach fallow evidence to a snapshot

**Package:** WP-02. **Screens:** S14, S15.

**User agreement:** the user can attach fallow evidence to a snapshot without losing context or changing source unintentionally.

**Tasks:** Import route; executable review; schema/provenance; availability badges.

**Acceptance:** A report cannot grant command authority and a missing provider cannot produce healthy coloring.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-12 — Recover from a provider failure

**Package:** WP-02. **Screens:** S22.

**User agreement:** the user can recover from a provider failure without losing context or changing source unintentionally.

**Tasks:** Failed-run banner; safe diagnostics; stale retention; explicit retry.

**Acceptance:** Structural city remains usable and zero findings is not inferred.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-13 — Investigate a dependency neighborhood

**Package:** WP-03. **Screens:** S16.

**User agreement:** the user can investigate a dependency neighborhood without losing context or changing source unintentionally.

**Tasks:** Direction/hop query; edge cap; readable edge list; cycle context.

**Acceptance:** Graph and list agree on typed edge direction and source identity.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-14 — Inspect a finding and its evidence

**Package:** WP-04. **Screens:** S17.

**User agreement:** the user can inspect a finding and its evidence without losing context or changing source unintentionally.

**Tasks:** Queue; source match; excerpt permissions; evidence limitations; provenance.

**Acceptance:** No unsafe confidence score or unverified current-source excerpt appears.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-15 — Create an investigation note in the vault

**Package:** WP-04. **Screens:** S18.

**User agreement:** the user can create an investigation note in the vault without losing context or changing source unintentionally.

**Tasks:** Composer; destination validation; preview; collision/failed-write handling.

**Acceptance:** User text is preserved and source code is not edited.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-16 — Compare compatible snapshots

**Package:** WP-05. **Screens:** S19.

**User agreement:** the user can compare compatible snapshots without losing context or changing source unintentionally.

**Tasks:** Baseline selectors; compatibility reasons; common layout; identity deltas.

**Acceptance:** Missing providers and excluded files are not mistaken for improvements/deletions.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-17 — Interpret measured testing evidence

**Package:** WP-06. **Screens:** S20.

**User agreement:** the user can interpret measured testing evidence without losing context or changing source unintentionally.

**Tasks:** Coverage metric selector; correct aggregation; measured-zero and unknown states.

**Acceptance:** All numerator/denominator and mapping evidence is traceable.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-18 — Investigate diagnostics and package advisories

**Package:** WP-07. **Screens:** S25.

**User agreement:** the user can investigate diagnostics and package advisories without losing context or changing source unintentionally.

**Tasks:** Provider-native IDs/severity; exact targets; safe report rendering.

**Acceptance:** Package presence is not displayed as confirmed exploitable source code.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-19 — Inspect shipped artifact contribution

**Package:** WP-08. **Screens:** S26.

**User agreement:** the user can inspect shipped artifact contribution without losing context or changing source unintentionally.

**Tasks:** Build report import; byte-definition selector; source/chunk links; treemap.

**Acceptance:** Source/rendered/compressed bytes are not mixed or double-counted.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-20 — Prioritize investigations through explainable evidence

**Package:** WP-09. **Screens:** S21.

**User agreement:** the user can prioritize investigations through explainable evidence without losing context or changing source unintentionally.

**Tasks:** Independent cards; provider availability; transparent ordering; drill-down.

**Acceptance:** Every queue entry names its inputs and missing evidence.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-21 — Import CI artifacts and explicitly watch a source

**Package:** WP-10. **Screens:** S27.

**User agreement:** the user can import CI artifacts and explicitly watch a source without losing context or changing source unintentionally.

**Tasks:** Artifact validation; separate session approval; job ordering; stop/export.

**Acceptance:** Import is not execution permission and old jobs cannot replace newer results.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-22 — Return to a pinned codebase context from a note

**Package:** WP-11. **Screens:** S24.

**User agreement:** the user can return to a pinned codebase context from a note without losing context or changing source unintentionally.

**Tasks:** Portable reference syntax; bounded previews; missing-reference recovery.

**Acceptance:** Reading the note starts no work and does not rewrite human content.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## UX-PBI-23 — Interpret a runtime observation window

**Package:** WP-12. **Screens:** S28.

**User agreement:** the user can interpret a runtime observation window without losing context or changing source unintentionally.

**Tasks:** Build/environment/window selector; sampling/mapping states; separate test/runtime lenses.

**Acceptance:** Not observed remains bounded evidence, not proof of global nonuse.

**Done evidence:** unit/state contract checks, visual comparison to applicable mockups, relevant failure/focus test, and actual Obsidian-host demonstration when integration is involved. Preserve synthetic-fixture labels in design-only assets.

## Readiness gate

The responsible developer and designer agree on data inputs, ownership, empty/error/partial states, accessible interaction, source/execution authority, and test fixtures. Screens/images alone do not satisfy readiness. The delivery manager can sequence by package dependencies; no broad dashboard work is required to finish WP-01.
