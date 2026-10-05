# Implementation-agent prompt — first structural city

Copy the following into the implementation session with repository access.

---

Implement **WP-01 of Codebase Inspector**, an Obsidian desktop plugin. The UI is English. The production visualization uses Three.js. The earlier UI/UX package covers the whole product; this session must implement only the first structural city and its supporting workflow.

Read the existing repository, its development instructions, the WP-01 implementation specification, the UI/UX screen specs S01–S13 and S23, and this WP-01 refinement package. Produce a brief contract inventory before editing. Reconcile implemented models with `integration/renderer-port.ts`; do not blindly add competing Snapshot, File, Profile, or ViewState models.

The review reference is a synthetic, dependency-free browser simulator. Use its behavior and tests as a specification, not as production architecture. Do not copy its Canvas 2D renderer, fake host shell, artificial scan states, global debug hook, or review toolbar into the plugin. Keep Three.js behind the renderer port. Keep its objects outside deep Vue reactivity. Use view-scoped UI state with shared immutable snapshot services.

Work through IP-01 to IP-08 in `docs/04-first-release-build-order.md`. After contracts and the minimal host shell, collector, renderer, and UI work may proceed in parallel with non-overlapping ownership. A single integrator resolves shared interface changes. Each agent reports edited files, tests executed, unfinished items, and any integration assumptions.

The required experience is: open a native ItemView; explicitly select a vault, vault subdirectory, or external root; review actual scan scope; collect a real read-only inventory; render the city; search and select files without moving the camera; focus deliberately; inspect exact measurements; use an equivalent HTML list; cancel/fail/refresh without losing the previous valid snapshot; survive lifecycle and theme changes.

Do not execute project scripts, fallow, Git, package installs, or source writes as a side effect of inventory. Opening a view or restoring workspace state does not authorize scanning. Keep scope approvals attached to actual source and scope identities. Reject stale results after cancellation or a new run.

Preserve per-leaf keyboard ownership: text inputs and sibling notes must not trigger city controls. Modal Escape returns to its trigger. Search Escape clears only its query. Closing Details preserves selection. Search preserves lot geometry. Top/3D restores the saved camera.

Port the model and UI invariants into the project's Vitest/host test strategy. Do not claim the browser reference's 31 state tests or 28 Chromium checks as tests of your implementation. Run real production tests and identify all unexecuted host, graphics, filesystem, accessibility, and performance gates.

Do not implement later packages or expose empty navigation for them. No findings, dependencies, health score, safe-to-delete rating, coverage, runtime analysis, or automatic note creation in WP-01.

Finish with a tested production build and a reproducible demonstration in a clean Obsidian test vault against a real codebase. Report evidence of source-safety, lifecycle cleanup, performance measurements, and remaining limitations. If any required gate fails, keep its status visible rather than hiding it behind a successful fixture render.

---
