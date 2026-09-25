---
project: codebase-inspector
title: WP-03 Part 1 polish pass — SDD ledger (rulings)
date: 2026-09-25
branch: feat/wp-03-part1-polish
---

# WP-03 Part 1 polish pass — rulings

This ledger records every ruling made while planning and executing the WP-03 Part 1 polish pass, and what each one costs if it is wrong.

- Plan: `docs/superpowers/plans/2026-09-25-wp03-part1-polish.md` (4 tasks). There is no separate spec: the WP-03 Part 1 spec (N1–N40) binds, amended only by PO1 and PO2.
- Precedent, all binding: the Part 3–7 ledgers, the Part 7 polish ledger and the WP-03 Part 1 ledger (J, JF, "WP-03 E").
- Numbering: **PO1…** owner decisions; **JP1…** planning rulings; **JQ1…** pre-flight rulings; **"WP-03 Polish E1…"** execution rulings.
- Every ruling reads: **Ruling:** what — why — cost if wrong.

## Owner decisions (2026-09-25)

| # | Decision |
|---|---|
| PO1 | **Amends N20, WP-03 E8 and E24:** Architecture's Boundary violations card no longer adds your violated rules to fallow's violations. The two are separate numbers. |
| PO2 | **Amends WP-03 E26's "Violations only" item:** the toggle keeps edges that break your rules **or** a fallow boundary. |

## Planning rulings

| # | Ruling |
|---|---|
| JP1 | **Ruling:** the pass covers the actionable WP-03 follow-ups only: PO1, PO2, the two Task 9 deferred minors (cycle-category gating, the untested direction note), the Task 13 deferred minor (benchmark RED), the arrow wrap, and E26's kept highlight. Out: the inherent limitations (partial graph, no type-only flag, re-export cycles undrawn, rules never passing, 3.21.0 boundaries, recorded versions), the untuned arc constants (E22), and every item the owner listed as out of scope (M80/F14, M95, §7 root-unavailable, Y19, Z38, the manual Part 7 check). — The inherent items need evidence fallow does not report (O1) and E22 needs a visual judgement no reviewer can pin. — Low: arcs keep reading poorly in dense cities. |
| JP2 | **Ruling:** the Task 3 deferred minor (an arithmetic slip in a task report) is closed without a change. — It has no code or document impact. — None. |
| JP3 | **Ruling (PO1's shape):** the split is two cards: **Boundary violations** (fallow's distinct findings, caption "Reported by fallow") and a new fifth card **Your rules violated** (the count of your rules in violation; unknown with no rules or when nothing was analysed; caption "N rules · M not evaluated"). — Two cards carry two units into the Report and its Markdown export, which list cards by label and value and would otherwise lose your-rules count. The card grid is `auto-fit`, so five cards lay out as Quality's do. — Low: one more card on a busy screen; the owner may prefer a caption. |
| JP4 | **Ruling (PO2's shape):** `violatingEdgeKeys` becomes the union of your violated rule pairs and fallow's boundary-violation module pairs, so the Map, Matrix, Edges filter and the edge inspector's "This edge breaks a boundary rule." all agree. — One set drives all four surfaces today; splitting it would let them disagree. — Low: the edge inspector sentence now also covers fallow's boundaries, which it words generically already. |
| JP5 | **Ruling:** the Edges tab, Map and Matrix gate on "any edge category analysed" (cycles reported, or boundaries configured). The Cycles tab and the cycles card keep the cycle-category gate. The evidenced-imports card reads `partial` with a reason when only boundaries were analysed. — The deferred minor: boundary edges were hidden behind a cycle-only gate. `partial` states exactly what is counted. — Low: only a trimmed or future writer reaches this state (N2). |
| JP6 | **Ruling:** a re-imported report clears the highlighted cycle only when it no longer holds that cycle's finding id. — Finding ids are content hashes (E26), so a kept id is the same cycle. — Low: a rescan that keeps the cycle keeps the highlight, which is the useful behaviour. |
| JP7 | **Ruling:** the benchmark's missing RED (Task 13 minor) is closed by mutation runs recorded in the gate evidence, not by new tests, unless an assertion survives its mutation. — The truncation logic is already pinned; the gap was evidence. — None. |
| JP8 | **Ruling:** the polish pass runs before WP-04 Part 1, and WP-04 branches from the polish head rather than 6419392. — The owner asked for the polish first, "then" WP-04. — Low: WP-04's "stop if the branch moved" check is read against the polish head. |

## Pre-flight rulings

The pre-flight scan (2026-09-25, at 6419392) checked every "Consumes" name and path with `grep` and every line count with `wc -l`. Every name exists: `buildArchitectureModel`, `violationsValue`, `edgeKey`, `relationBoundaryValue`, `RelationEdgeView.sources/fromPath/toPath`, `boundaryFindings`, `moduleOf` (`file-summaries.ts:26`, the same function `FileSummary.module` is built from, line 84), `ARCH_VIOLATIONS_CAPTION`, `report.ts:58`'s `architecture.cards`, `CycleList`'s `notAnalysed` (`ArchitectureScreen.vue:171`), `EDGE_DIRECTION_NO_MODULE` (`audit-copy/relations.ts:83`), the relations store watchers (57–63) and the row CSS (`screens-explore.css:142–151`). `city-relations-panel.test.ts` is 307 lines.

| Pair / task | What one produces against what the other consumes | Found |
|---|---|---|
| T1 ↔ T2 | both edit `architecture.ts`, `audit-copy/relations.ts`, the Architecture tests; T2 reads T1's card list | sequential; T2's dispatch carries T1's committed card shape |
| T1 ↔ T4 | T4 re-captures the Architecture screens T1 changes | none |
| T2 ↔ T3 | `relations.ts` (T2) vs `relations-store.ts` (T3) | no shared file |
| T3 ↔ T4 | T4's `harness-shot` shows T3's CSS | none |
| T1 self | icon `shield-alert` is used nowhere in `src`; `shield` is | JQ1 |
| T2 self | `relationEdgesValue` needs `provenanceCache`, which is module-private in `relations.ts` | the helper lives in `relations.ts`; consistent |
| T3 self | tests and CSS agree | clean |
| T4 self | counts refreshed once, after every `src` task | clean |

| # | Ruling |
|---|---|
| JQ1 | **Ruling:** the Your rules violated card uses icon `shield`, not `shield-alert`. — `shield` is the icon already used by cards in `src`; `shield-alert` is untested there. — None. |

## Execution rulings

| # | Ruling |
|---|---|
| WP-03 Polish E1 | **Ruling:** a fallow boundary violation between two files of one module shows only on the Edges tab. — `aggregateEdges` drops same-module pairs, so the Map and Matrix never showed such an edge, and the Matrix diagonal is handled before any violation lookup. — Low: a same-module violation is not marked on the Map or Matrix. |
| WP-03 Polish E2 | **Ruling:** Task 2's fix round 1 (mutation evidence only, no code change) is closed by the controller reading the appended mutation output instead of a re-review. — The fix diff is empty; there is nothing for a re-reviewer to read but the report. — None. |
| WP-03 Polish E3 | **Ruling:** the first `npm run verify` run's no-freeze timing miss (55.6 ms against the 50 ms budget, `fallow-analysis.test.ts`) is a contention flake. It passed alone (22.3 ms) and on the second full run. — The Z38 budget is out of scope (JP1), and nothing in `src` on that path changed. — Low: a real regression would show again on the next run. |
| WP-03 Polish E4 | **Ruling:** the fifth Architecture card wraps onto its own row at 1280 px (the `auto-fit` grid). No CSS change. — The grid is shared with every screen's cards, and the capture lays it out cleanly. — Low: the owner may prefer five cards on one row. |
| WP-03 Polish E5 | **Ruling:** JP5 applies to Architecture only. File detail's Relations panel, the city Relations section and the Overview / Data & scans "Import relations" row keep the cycle-category gate; their now-false comment is corrected. — Only a trimmed or future writer reaches the boundary-only state (N2), and widening four more surfaces was not in the plan. — Low: in that state those surfaces say "not analysed" while Architecture shows the boundary edges. |
| WP-03 Polish E6 | **Ruling:** "Violations only" on the Edges tab keeps a file edge whose **module pair** is violated (JP4's one set), so a cycle-only edge that shares a module pair with a fallow violation is kept. — Your rules are defined per module pair, and one set keeps the Map, Matrix, Edges filter and inspector in agreement. — Low: where fallow zones do not follow top-level folders, the filter can keep an edge fallow did not flag. |
| WP-03 Polish E7 | **Ruling:** the final review's same-module fallow-violation test is deferred. — It needs a new recording with fallow zones inside one top-level folder; the behaviour is pinned structurally (E1). — Low: a regression there would not be caught by a test. |

Also recorded during execution:
- **Network error:** Task 3's implementer was cut off by an API network error and resumed with its work intact.
- **Final whole-branch review (opus, 6419392..09f71f3):** ready with fixes; 0 Critical, 1 Important, 8 Minor. The one fix wave fixed Important 1 (the Map badge and the Selected module panel read the cycle-only evidence value in a boundary-only report) and Minors 1, 4 (the Report's two lines), 5, 6, 7 and 8 (the N20 pointer), and corrected the comment of Minor 2. Minor 2's scope is E5, Minor 3 is E6, and Minor 4's same-module test is E7. The fix wave is 2de7752 and 64d6331; the scoped re-review found every finding addressed and no new breakage.

## Deferred minors

Each was triaged by the final whole-branch review as an acceptable follow-up.
- **Task 1:** the rules, cycles and violations cards set a caption that `MetricCard` never shows while the value is unknown (house style). The one false caption among them was fixed in the final fix wave.
- **Task 3:** two similar report-attach helpers in the panel test (the fixture's rebinds the repository, the local one does not), explained by a comment.
- **Task 4:** a copied closing clause in the gate-evidence refresh paragraph; it is still true.
