---
project: codebase-inspector
title: WP-04 Part 2 — SDD ledger (rulings)
date: 2026-09-26
branch: feat/wp-04-part2
---

# WP-04 Part 2 — rulings

This ledger records every ruling made while planning and executing WP-04 Part 2 (native e2e coverage), and what each one costs if it is wrong.

- **Spec:** `docs/superpowers/specs/2026-09-26-wp04-part2-native-e2e-design.md`. It holds decisions NE1–NE20, owner decisions O1–O4, 26 scenarios and probes a–k.
- **Plan:** `docs/superpowers/plans/2026-09-26-wp04-part2-native-e2e.md`, 12 tasks.
- **Branch:** `feat/wp-04-part2`, from `353e2c1`, the PR 1 head after WP-04 Part 1.
- **Precedent (all binding):** the WP-04 Part 1 ledger (O8, IP45–IP58, IPF14–IPF20, E12, E14, E25), and every earlier ledger.
- **Numbering:**
  - **O1…** are owner decisions;
  - **NE1…** are the spec's decisions;
  - **NP1…** are planning rulings;
  - **NPF1…** are pre-flight rulings;
  - **"WP-04.2 E1…"** are execution rulings.
- Every ruling reads: **Ruling:** what — why — cost if wrong.

## Owner decisions (2026-09-26, before the spec)

| # | Decision |
|---|---|
| O1 | **All candidates** the audit confirms. That means:<ul><li>lifecycle and leaks;</li><li>persistence across a reload;</li><li>all six commands by id and the ribbon;</li><li>the Settings tab;</li><li>import with a real file;</li><li>the E25 bound preview;</li><li>the city in dark and light, and a layout restore after an app restart;</li><li>the note index and the E14 reload repair;</li><li>refresh `markers-edited` and `partial`;</li><li>the O7 in-root exclusion;</li><li>the four Part 1 follow-ups.</li></ul> |
| O2 | **Fix exposed bugs here, RED first**, each with a WP-04.2 E ruling and its cost. The Settings-refresh bug is fixed. |
| O3 | **No CI.** The native suite stays local and opt-in; CI is a follow-up. |
| O4 | **Baseline gate (1.13.4) plus one latest run** at the finish, which must pass every required scenario and records its resolved version. |

## Planning rulings

| # | Ruling |
|---|---|
| NP1 | **Ruling:** 12 tasks in this order:<ol><li>probes and helpers;</li><li>Settings with the NE9 fix;</li><li>lifecycle;</li><li>commands;</li><li>fallow;</li><li>note index;</li><li>refresh;</li><li>in-root and alias (NE15 if RED);</li><li>preview;</li><li>city;</li><li>code spans and email (NE16 if RED);</li><li>evidence.</li></ol> — Task 1's probes decide what every later scenario can observe; NE9 lands before Task 5 needs it; `src` may change only in Tasks 2, 8 and 11, so the full suite runs after Task 11. — Low: a mis-ordered dependency shows in the controller's Consumes re-check. |
| NP2 | **Ruling:** scenarios live in ten files by concern:<ul><li>`plugin-lifecycle`</li><li>`city`</li><li>`commands`</li><li>`fallow`</li><li>`settings`</li><li>`notes-index`</li><li>`notes-refresh`</li><li>`notes-root`</li><li>`preview`</li><li>`obsidian-facts`</li></ul>Shared UI steps go in `tests/e2e/inspector.ts`. Host probes go in `host-probes.ts`, run-time fixtures in `workspace-files.ts`, and the PNG reader in `png.ts`. If `inspector.ts` passes 400 lines, it splits into `inspector-<concern>.ts` modules re-exported by `createInspectorPage`. — The brief asks for a split by concern and shared steps in `inspector.ts`. Probes over Obsidian internals and Node-side fixture writers are different kinds of code from UI steps, and each file stays under the 450 cap. — None. |
| NP3 | **Ruling:** a native test may match the plugin's own words only through a constant imported from `src/ui/audit-copy/**` or `src/ui/inspector-copy.ts`, never through a literal. It never matches Obsidian's words (IPF20). The ribbon's `aria-label` "Open codebase city" is the one exception: it is the plugin's own literal (`main.ts:89`) with no constant, and it is used only as an attribute selector. — The locale is German here, while the plugin's copy is English everywhere, and a constant keeps a reworded string from silently breaking a test. — Low: renaming the ribbon label breaks scenario 5 loudly. |
| NP4 | **Ruling:** while developing, one native file runs as `npm run build` then `node node_modules/vitest/vitest.mjs run --config tests/e2e/vitest.config.mts tests/e2e/<file>.e2e.ts [-t "<title>"]`. Acceptance is always `npm run test:e2e`, which builds, runs everything and gates. — Rebuilding and running 36 sessions per edit would make RED proofs impractical; the gate still sees everything at the end. — None. |
| NP5 | **Ruling:** a test that restarts Obsidian or runs fallow passes `300_000` as its own timeout; a synthetic-tree scan passes `240_000`; everything else keeps the config's `120_000`. — The Global Constraints require explicit timeouts on slow work, and a restart alone costs ~15 s plus the service's 2 s pause. — Low: a slower machine needs a larger number, set by ruling, never a retry. |
| NP6 | **Ruling:** restarts use `browser.reloadObsidian()` with no arguments. The service then deletes the session without shutting the driver down and reopens the same copied vault and profile (`wdio-obsidian-service` `dist/index.js:3251–3260`). Probe c confirms that `data.json`, `workspace.json` and `localStorage` survive, and that teardown still releases everything. — A new vault or a new profile would make an app restart look like a fresh install and void scenarios 2 and 4. — Medium: if probe c fails, scenario 4 needs a ruling, and scenario 2 falls back to a plugin reload, which it already uses. |
| NP7 | **Ruling:** scenarios 8, 9 and 15 take the fallow binary from `FALLOW_BIN`, else `.fallow-bin/bin-path.txt`. A missing binary **fails** with a message naming both, never skips, and `test:e2e` fetches nothing. — A skip would fail the gate anyway (IN48), and a fetch would add network access to every native run. — Low: a clean checkout must run `npm run test:fallow` once, or set `FALLOW_BIN`. |
| NP8 | **Ruling:** a mid-run cancel is proved against a synthetic tree whose size probe g fixes. The uncancelled control run must take at least 2 000 ms, or the test fails. The cancel is sent only after the command's own `checkCallback(true)` answers true. — A small tree finishes before the cancel arrives: the test would then exercise nothing, or fail at random. The measured control makes a too-short window a visible failure. — Low: a much faster machine needs a bigger tree, by ruling. |
| NP9 | **Ruling:** the canvas pixel is read from WebDriver's element screenshot with a small PNG reader on `node:zlib` (`tests/e2e/png.ts`, 8-bit RGB/RGBA, filters 0–4). — WebGL `readPixels` without `preserveDrawingBuffer` returns cleared buffers, and a PNG library would be a new dependency (spec NE2). — Low: a screenshot format change fails the decoder loudly ("unsupported PNG"). |
| NP10 | **Ruling:** NE9 is a data-write listener in `plugin-data-shape.ts` (`watchPluginData`). Both write paths notify it, `writePluginDataSlice` (only when it actually saved) and `updatePluginDataRecord`, and the tab coalesces with `refreshSoon()`. `ProfileStore` gains no member. — Every writer the tab misses goes through those two functions (a scan's new profile, the exclusion migration, a note's exclusion, a fallow bind or trust). A `ProfileStore` event would change a frozen WP-01 §4.5 port and miss analyzers. — Low: a write that bypasses `plugin-data-shape.ts` would be missed; none exists (outside that module, `saveData`/`loadData` appear in `src/` only in comments). |
| NP11 | **Ruling (NE14, the Part 1 follow-up):** a note the user moved inside the codebase root is refreshed normally. The refresh writes only between its markers, after the dialog's confirm, and adds no exclusion; the next scan lists it as a codebase file. Scenario 21 pins that nothing else under the root changes. — O7's checkbox guards a note the **plugin** places inside the root. Here the user placed it, and refusing would strand a note the user deliberately keeps next to the code. — Low: the owner may prefer a refusal or a warning; that is one dialog line and a copy constant. |
| NP12 | **Ruling:** scenario 24's Markdown anchor comes from a report crafted at run time from the 3.27.0 recording, with one finding's path set to `docs/guide.md`, through the real importer. — fallow never reports Markdown files (IN29), so Open in Obsidian is unreachable through a real report; the importer and the preview are still the real ones. — Low: an importer rule that later rejects such a path turns the scenario RED, and it is reworked then. |
| NP13 | **Ruling:** the pre-flight probes run from a scratch `tests/e2e/probes.e2e.ts` that is deleted before Task 1's commit. Their outcomes, copied from `probe.json`, become NPF rulings. Each scenario that relies on a probe carries that probe's positive control itself. — They are facts about the test environment and Obsidian internals, not plugin behaviour; keeping them as required scenarios would pin internals the plugin never uses. Part 1 kept its facts because the plugin relies on them. — Low: a later Obsidian changing an internal fails the scenario's own control, not silently. |
| NP14 | **Ruling:** the brief's "exclusion confirm" is read as the scope approval the next scan asks for after Excluded paths changes (IN29, M62). Scenario 13 covers it, alongside the saved and the refused edit. — The Settings tab has no exclusion confirm dialog; the confirmation a person meets is the scope modal. — Low: if the owner meant the create dialog's exclusion checkbox, scenario 20 covers that. |
| NP15 | **Ruling (corrects the brief):** "Open in Obsidian" and Open note use `workspace.getLeaf(true).openFile(file)` (`investigation-notes.ts:212`), not `openLinkText`, which `src/` never calls. Scenario 24 asserts a new Markdown leaf on the vault path. — Found by the coverage audit (spec §3). — None. |
| NP16 | **Ruling:** pop-out windows stay out (NE20). — Driving a second Electron window needs a new seam in the harness, and the brief allows no new harness. — Low: `onWindowMigrated` and `activeDocument` in a pop-out remain covered only by `window-migration.test.ts`. |
| NP17 | **Ruling:** every scenario gets its own session (the fixture is per test). 36 sessions make `npm run test:e2e` take several minutes, which is accepted. — IN44 and the brief require a fresh vault copy per test file at least, and a per-test session is what the fixture already gives. — Low: time only. |
| NP18 | **Ruling:** `hashTree`, `cycleFinding` and `RECORDING` move from `investigation.e2e.ts` to `workspace-files.ts` unchanged, and the spine imports them. — Tasks 3, 6, 7 and 8 need them, and a second copy would be a duplication finding in review. — None. |
| NP19 | **Ruling:** scenario 15's RED proof runs against the pre-NE9 versions of `main.ts`, `settings-tab.ts` and `plugin-data-shape.ts`, checked out into the working tree, built, run and restored. If it passes there, the spec §5 mutation is used instead. — The audit says the tab misses analyzer writes, but that reading has not been run yet. — None. |
| NP20 | **Ruling (O4):** the latest run is a second full `npm run test:e2e` with `OBSIDIAN_VERSION=latest` in Task 12. It is not a second gate configuration. Its resolved version is recorded in the gate evidence, and a failure there is a Part 2 failure. — IN49: latest is never reproducible, so it does not belong in the default command. — Low: a new Obsidian release between runs can turn it red; that is reported, never retried. |

## Pre-flight scan

Filled in before Task 1: the line counts, the Consumes names, and the task-pair checks.

## Pre-flight rulings

Filled in after Task 1's probes (a–k), as NPF1 onward.

## Execution rulings

| # | Ruling |
|---|---|

## Deferred minors

Each is triaged by the final whole-branch review.
