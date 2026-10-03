---
project: codebase-inspector
title: Gap closure — SDD ledger (rulings)
date: 2026-10-03
branch: feat/gap-closure
---

# Gap closure — rulings

This ledger records every ruling made while planning and executing the gap-closure sub-project, and what each one costs if it is wrong.

- **Spec:** `docs/superpowers/specs/2026-10-03-gap-closure-design.md`. It holds the owner decisions GCO1–GCO25, the inventory GRD1–GRD15, GRC1–GRC14, GRA1–GRA10 and GRB1–GRB18, the decisions GCN1–GCN12, and scenarios 41–46.
- **Plans:** one per part, written after the spec is approved, in landing order: D, C, A, B.
- **Branch:** `feat/gap-closure`, from `1baa572` (the PR 1 head).
- **Precedent:** every earlier ledger, notably the WP-04 Part 2 follow-ups ledger (FP1–FP12, FQ1, WP-04.2 Follow-up E1–E8).
- **Numbering:**
  - **GCO…** are owner decisions;
  - **GR(A|B|C|D)…** are the spec's inventory rows;
  - **GCN…** are the spec's decisions;
  - **GCP…** are planning rulings;
  - **GCQ…** are pre-flight rulings;
  - **"Gap-closure E1…"** are execution rulings.

  None of these prefixes occurs anywhere in `docs`, `src`, `tests` or `scripts` (checked with grep).
- Every ruling reads: **Ruling:** what — why — cost if wrong.

## Inventory (2026-10-03)

A read-only inventory at `1baa572` found 87 open items across PR 1's body, every ledger, the WP-01 limitations and the deliverables. They fall into six groups:
- 20 owner decisions;
- 23 rows of product gaps;
- 13 items carried out of scope;
- 11 test and harness issues;
- about 20 minors;
- about 25 groups that older text lists as open but that are closed.

Four read-only audits then gave every row its evidence and design. These are the spec's §3 tables.

## Planning rulings

| # | Ruling |
|---|---|
| GCP1 | **Ruling:** four parts in the order D, C, A, B, each with its own plan, execution, final review and push onto PR 1 (GCN1). — Part D makes native runs trustworthy (crash diagnostics, load gate), and Part C's gates then measure A and B as they land. Separate pushes keep each review surface reviewable. — Low: four PR 1 sections instead of one. |
| GCP2 | **Ruling (GRC1):** the review-repository port moves from `ui/stores/ports` to `application/ports`. `review-record-codec` stays in `ui/read-models`, and its import from `adapters/storage` is the one recorded exception to GCO10. — The codec depends on `ui/read-models/review-state(-import)`, which pulls in the report store, the seeded fixtures and copy; moving it is size L for no behaviour. The exception names the file, and the rule itself is unchanged. — Low: one adapter keeps a ui import until a later pass moves the codec. |
| GCP3 | **Ruling (GRA1):** if 84d92d7's 64.2 % cannot be reproduced to within 0.1 points by the calibrated occupancy definition, the baseline becomes shelf packing measured on HEAD's tree, with both figures recorded. — The original scan's scope and exclusions are not recorded, and the +10 rule needs a baseline the spike can recompute. — Low: the bar moves by however far HEAD's tree differs. |
| GCP4 | **Ruling (GRA6):** nav-inline (leaf ≥ threshold) and the city drawer (city inline ≥ threshold) keep one constant unless the measurement sweep shows the nav band clipping. — They gate different boxes, but one constant has kept them consistent since WP-02, and splitting them without evidence adds a state. — Low. |
| GCP5 | **Ruling (GRA8):** the profile name shows in the S05 toolbar; the TopBar keeps the folder name. — This avoids showing the same name twice, and the folder stays the place-of-record label. — Low. |
| GCP6 | **Ruling (GRA10):** the Three.js marker is cleared on unload only when it equals the bundled `REVISION`. This reverses LIM's "disclosed rather than suppressed". — Clearing only our own revision removes the false warning on every re-enable, while a genuine double bundle in the same session still warns. — Low: another plugin with the same revision could lose its marker, which is harmless. |
| GCP7 | **Ruling (GRB9):** the list of fallow 3.27.0 config file names comes from fallow's own documentation or the binary's strings, and the source is recorded. `extends` chains are not followed. — The provenance must name what fallow reads, and only fallow's own documentation can say that. — Low: a config file outside the list is not recorded; the list names its source. |
| GCP8 | **Ruling (GRB10, GCN10):** an older plugin build that meets a v2 analyzer slice reports it as invalid with its reason and refuses to write. — This is the existing contract for an unknown record shape (spec §7), and it never overwrites newer data. — Medium: after a downgrade, fallow bindings stay unusable until the newer build runs again. Recorded as the cost of GCO23. |
| GCP9 | **Ruling (GRA2):** the automatic reconstruction cap is **3**, and it resets only on Retry 3D. A list ↔ 3D round trip does not reset it. — Three tolerates transient losses (GPU driver resets) and stops a loop. A round-trip reset would let the loop return through the UI. — Low. |
| GCP10 | **Ruling (GRD4):** the native load gate's threshold is **50 % CPU over 10 s**, with a wait of up to 15 minutes, and a named refusal otherwise. — That is the threshold the landing runs practised by hand. A refusal writes no report and exits non-zero, so it can never read as a pass. — Low: a busy machine refuses rather than runs. |
| GCP11 | **Ruling (GRD1, GCO25):** procdump is downloaded only after the owner confirms the exact file, source and size in chat, and it is used only in the opt-in diagnostic mode of the native harness. Its path comes from an environment variable and is never committed. — Downloading a file needs explicit permission; GCO25 granted the method, not the download itself. — None. |
| GCP12 | **Ruling:** the spec and this ledger are committed before any plan, and the controller stops for the owner's review of the spec. Part D's plan is written only after approval (brainstorming's gate: written-spec approval permits writing plans). — None. |

## Pre-flight scans

(One per part, recorded before that part's first task.)

## Execution rulings

(Recorded during execution.)
