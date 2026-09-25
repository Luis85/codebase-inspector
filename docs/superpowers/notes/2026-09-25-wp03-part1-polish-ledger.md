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

## Deferred minors
