---
project: codebase-inspector
title: WP-02 Part 5 — SDD ledger (rulings)
date: 2026-09-22
branch: feat/wp-02-part5
---

# WP-02 Part 5 — rulings

This ledger records every ruling made while planning and executing Part 5, and what each one costs if it is wrong.

- Spec: `docs/superpowers/specs/2026-09-22-inspector-ui-part5-design.md` (V1–V32).
- Plan: `docs/superpowers/plans/2026-09-22-inspector-ui-part5.md`.
- Precedent: the Part 3 ledger (R1–R9, E1–E55, cited as E<n>) and the Part 4 ledger (S1–S27, X0–X19, E1–E22, cited as "Part 4 E<n>").
- Numbering: planning rulings here are T1…; execution rulings are "Part 5 E1"….

## Planning rulings

| # | Ruling | Cost if wrong |
|---|---|---|
| T1 | The split (V1, V2) cuts along existing seams, with no behaviour change. The scan lifecycle and the layout publisher leave `city-view.ts`. The Escape chain, the floor/responsive wiring and the selection notice leave `CityWorkspace.vue`. `CityView`'s public API stays as one-line delegations, so no host test, acceptance step or `commands.ts` changes. | Low. A mis-cut shows as a red host or acceptance test in Task 1, which is pure refactoring and easy to revert. |
| T2 | A 360-line cap test (`tests/unit/city-budget.test.ts`) keeps the freed headroom, which is at least 40 lines, as the brief requires. Later tasks change only the extracted modules. Task 3's `onCancelScan` goes in `provideScanCallbacks`, not `city-view.ts`. | Low. A future change that needs `city-view.ts` lines has to raise the cap deliberately. |
| T3 | The duplicate leaf observers are removed by sharing App's `useLeafWidth` measurement through `provideLeafLayout` (V4). CityWorkspace's floor logic reacts to a post-flush `layoutTick`. It observes neither the leaf nor `.ci-shell__content` any more. It falls back to its own single observer only when mounted without App. | Medium. The 320 px floor and the 820 px drawer depend on it. `window-migration` M3, `responsive-floor` and `workspace-shell` guard the behaviour, and the nav-flip test is rewritten, not deleted. |
| T4 | CameraControls re-applies its steps default on every layout tick until the user toggles the steps (V5). A user's choice is never overridden by a resize. | Low. A user who never toggles sees the steps collapse when the leaf narrows, which is the WP-01 rule applied consistently. |
| T5 | Cancel appears in the city toolbar and in Data & scans' Scan status panel. Both are always rendered and `aria-disabled` unless a run is `running` (V6). The toolbar never unmounts, so the focused Cancel never drops focus when the run ends. The button reuses `COPY_09` "Cancel scan", matching the command. Pressing Cancel announces nothing: the run state is the outcome (E17). | Low. A persistent disabled button adds one control to the toolbar. The alternative, a button inside the transient status banner, would drop focus to `<body>` when the run ends. |
| T6 | Focus after navigation (V7) moves only when the navigation removed the focused element. A focused heading is itself the announcement. When focus survives (nav, palette), a shell status region announces "<Screen> screen." once. Host-driven navigation with focus outside the leaf does neither. | Low. Screen-reader users hear exactly one cue per navigation. A different taste (always move focus) is a one-line change in `use-route-focus.ts`. |
| T7 | Review state is keyed by `repositoryId` with one in-memory repository per codebase (a bucket with its own id counters) (V8). A binding switch empties the lists synchronously. An in-flight save completes into its own codebase and never mutates the other codebase's lists (V9). Pending reservations stay global, so a same-key action briefly refuses across a switch. | Medium. This is the core of B6. The unit tests cover a switch mid-save and mid-load, and a round trip. The brief refusal window is only observable as a `null` (E17: nothing announced). |
| T8 | The report store is keyed the same way and restores the note on a round trip, instead of resetting it (V10, amending Part 4 E8). A note still never crosses codebases. | Low. A reviewer returning to codebase A finds their A note, which is the brief's "switching back restores them". |
| T9 | The v2 source block carries the folder label and `fnv1a32:` of the repository id (V11). This is an identity check, not a secret. The raw id (the profile UUID, embedded in every entity id) and the absolute path never appear. | Low. A 32-bit digest can collide in theory. The only effect would be that an import from another codebase is not refused, and its paths would still resolve only against this codebase. |
| T10 | Export uses only the strict `parseEntityId`. Anything that does not parse is left out and counted in `warnings`, and is never written verbatim (V12). | Low. A malformed id (unreachable today) loses its row in the export, and the warning says so. |
| T11 | Import validation is strict and whole-file (V14). Any unknown key, any failed rule, a file over 1 MB or any limit breach refuses the entire file with one inline error. There is no partial import. A v2 file from another codebase is refused. A v1 file, or one with no source, is accepted with the origin shown as unknown. | Medium. A hand-edited file with one bad field is refused entirely. Partial imports would make "what did I just replace?" unanswerable. The error names the first failing path. |
| T12 | Import replaces the current state, it never merges, and only after a confirmation that lists counts and origin (V16). It needs a snapshot on screen, because paths become entity ids of the current codebase. | Low. Merging can come with WP-05's durable store, where conflict rules belong. |
| T13 | `reannounce` uses a per-ref token, so a later announcement is never overwritten by an earlier pending one (V22). `useCsvExport` lets builder bugs throw (item 14). | Low. A builder bug now surfaces as an uncaught error in the console, not as "Could not start the download", which is the brief's intent. |
| T14 | The Quality and Dependencies rows stop being activatable. Each gets a real button column ("Review", "Details") whose accessible name starts with its visible text (V19). BoundaryRuleTable and CoverageGapsTable keep whole-row activation plus inner buttons: they are outside item 11 and stay deferred. | Low. Pointer users lose the whole-row click target in two tables. The button is the keyboard and screen-reader path. |
| T15 | Cross-screen looks move to the kit: `ci-severity`, `ci-ref-id`, `ci-band-legend`, `ci-file-cell`, `ci-priority`. File detail's card becomes `ci-file-finding` (V20). The class-scope test derives every block root from the markup instead of listing three (V21). | Low. The renames are mechanical, and the component tests and harness captures cover the looks. |
| T16 | The harness fixture becomes `partial` (V30). A real scan with unavailable line counts is partial (`inventory-collector.ts:267`), so the fixture, not the UI, was inconsistent (Part 4 E17). | Low. The harness shows a partial-read notice on screens that did not show it before, and the captures are re-checked. |
| T17 | `niceMax` is deleted: it has no production caller (V24). | None. |
| T18 | Contrast #4 is the owner's decision (V17). It is recorded as T32 after the Phase 1 pause and implemented in Task 15. | — |
| T19 (P1) | `clearAll` becomes pending-aware and returns `Promise<boolean>`: it refuses while any operation is pending, like `replaceAll`. The Task 14 drafter found that an update whose save lands after a clear is written back into the port and reappears on the next load. The Clear dialog shows `SETTINGS_CLEAR_BUSY` on a refusal. | Low. A user who clears mid-save sees one refusal and retries. |
| T20 (P2) | `reannounce` sets its message only if no later call happened **and** the region still holds the `''` it left, so a screen's direct write is never overwritten by a pending failure. | Low. |
| T21 (P3) | The Tests export button changes from `disabled` to `aria-disabled` plus a guarded handler (E40). It refuses a null model and zero gaps, which makes V23 testable. | Low. |
| T22 (P4) | Focus on the `.ci-shell` root after navigation (CiDialog's fallback when the palette's opener unmounted) counts as focus that fell out, so it moves to the heading. The programmatically focused heading and `<main>` show no focus ring, following the `.ci-shell:focus` precedent. | Low. A sighted keyboard user sees no ring on the heading. A visible cue is two deleted CSS lines. |
| T23 (P5) | `ci-screen`'s base rule moves to the kit, because every screen uses it. It is not added to the WP-01 allowlist. | None. |
| T24 (P6) | The harness awaits the bind's `load()` before seeding demo items. Otherwise the load can land after the seeding and wipe the items, and the "three non-null items" check would still pass. | Low. |
| T25 (P7) | `repositoryDigest` reuses `fnv1a` from `fixtures/seeded-random.ts`, and that header is amended. It is not moved to a new module, which would touch five fixtures. | None. |
| T26 (P8) | Import paths use the scanner's own `normalizeRelativePath`, which is stricter than V14 (it also refuses empty and `.` segments and control characters). An unknown origin reads `IMPORT_ORIGIN_UNKNOWN`, not the spec's "(v1)", because a v2 file with `source: null` is also unknown. A Part 4 v1 file with a verbatim fingerprint is refused as `invalid`. | Low. Such old files could only come from the unreachable Part 4 E22 case. |
| T27 (P9) | `CityViewDeps` moves to `city-scan-controller.ts` and is re-exported from `city-view.ts`, so every importer is unchanged. | None. |
| T28 (P10) | `container-box.test.ts`'s helper opens the drawer at 600 px before widening. The old sequence (drawer forced open while wide, with no width change) cannot happen in a real host, and with one leaf observer an unchanged width no longer re-measures. | Low. Re-measuring on an unchanged width would contradict V4. |
| T29 (P11) | The city toolbar wraps (`flex-wrap: wrap` in `shell.css`) now that it holds five controls. The existing Scan button keeps native `disabled` (WP-01) and is deferred. | Low. At narrow widths the toolbar takes two rows. The narrow captures show it. |
| T30 (P12) | Data & scans' Cancel guard reads the run store directly in `SourcesScreen`. A prop-based guard could be one render stale right after a run starts, and would refuse a real cancel. | None. |
| T31 (P14) | The `src` file floor in the evidence note is the real count rounded down to a multiple of ten. | None. |

## Execution rulings

(Appended per task.)
