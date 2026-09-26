---
project: codebase-inspector
title: WP-04 Part 2 — Native e2e coverage (design)
date: 2026-09-26
status: for owner approval
deliverable: docs/deliverables/Test Evidence.md
---

# WP-04 Part 2 — Native e2e coverage

## 1. Outcome and scope

Every plugin behaviour that only a real Obsidian can prove gets a native e2e test. Today those behaviours are covered only by fakes: `tests/mocks/obsidian.ts`, `tests/fixtures/fake-vault.ts`, jsdom component tests and host tests with hand-made `App` doubles. Part 2 adds **26 required native scenarios** (§5), for **36** in total, on the harness WP-04 Task 0 built (`npm run test:e2e`, `tests/e2e/*`, `wdio-obsidian-service` 3.2.1, `SessionLifecycle`, and the fail-closed gate over `tests/e2e/required-scenarios.json`). A bug a native test exposes is fixed here, RED first (O2).

**Out of Part 2:** the M80/F14 renderer retry cap, M95 pointer capture, the spec §7 root-unavailable producer, Y19 external `data.json` edits, the Z38 no-freeze budget, axe and mobile emulation (IP51), pop-out windows (NE20), and the owner's manual Part 7 check (item 3). Also out: CI (O3). No new harness and no new dependency (NE2).

Planning rulings (NP1…, in the ledger) refine these decisions where the code needs an exact shape. Each such decision cites its ruling.

## 2. Owner decisions (2026-09-26)

| # | Decision |
|---|---|
| O1 | **Scope: every candidate the audit confirms.** That covers lifecycle and leaks, data persistence across a reload, all six commands by id, the ribbon, the Settings tab, import with a real file, the E25 bound preview, and the city in dark and light plus a layout restore after an app restart. It also covers the note index (rename, delete, move, E14 reload repair), refresh `markers-edited` and `partial`, the O7 in-root exclusion, and the four Part 1 follow-ups: `%%`/`$`/`==` in code spans, email autolinks, 8.3/junction overlap aliasing, and refreshing a note moved into the root. |
| O2 | **A bug a native test exposes is fixed in this part, RED first.** Each fix proceeds in this order: the native test shows RED on the current code; a small `src` fix lands with its own fast-suite test; each fix gets a "WP-04.2 E" ruling with its cost. The known Settings-refresh bug is fixed (NE9). |
| O3 | **No CI.** The native suite stays local and opt-in (IN43). CI is recorded as a follow-up. |
| O4 | **Baseline gate plus one latest run.** Every run gates on 1.13.4 (IN49). At the finish, the whole suite also runs once with `OBSIDIAN_VERSION=latest` and must pass every required scenario. That run records its resolved version and is never treated as the reproducible baseline. |

## 3. Coverage audit: what the fakes prove and what they cannot

The audit covers every Obsidian API use in `src/`. The Obsidian-importing files are `main.ts`, `src/host/**`, `src/adapters/storage/**`, the Node-access and fallow adapters, and `src/ui/kit/Icon.vue`. Plugin data flows through `plugin-data-shape.ts`. In the **Decision** column, a number is the scenario in §5 that covers the row; "—" means the row is rejected, with its reason.

Not used anywhere in `src/` (grep, 353e2c1): `registerInterval`, `registerDomEvent`, `setInterval`, `requestUrl`, `openLinkText`, `fileManager.renameFile`, `detachLeavesOfType`, `layout-change`, `window-open`/`window-close`, and any `theme-dark`/`theme-light`/`document.body` selector. **Correction to the brief:** "Open in Obsidian" does not use `openLinkText`. It calls `workspace.getLeaf(true).openFile(file)` (`investigation-notes.ts:212`), and so does Open note.

| Behaviour (code) | Covered today by (fake) | What a fake cannot prove | Decision |
|---|---|---|---|
| `onload` registers only; `onunload` shuts fallow down and never detaches leaves (`main.ts:41–130`) | `tests/host/plugin-onload.test.ts` (an `Object.create(Plugin.prototype)` double, `vi.fn` app) | That real `Plugin.unload` releases every `registerEvent` ref. That `CityView.onClose` really runs on disable and `offref`s `css-change`. That no view, canvas or listener outlives the plugin. What Obsidian does to open city leaves. | 1 |
| Enabling opens no tab (no `onUserEnable`, user directive in `main.ts:112–120`) | `plugin-onload.test.ts:131–137` | That a real enable opens no leaf | 1 |
| `loadData`/`saveData` for `profiles`, `bindings`, `analyzers`, `reviews` (dispositions, work items), `investigations`; machine id in `loadLocalStorage` (`plugin-data-shape.ts`, `plugin-data-binding-store.ts:38–43`) | Unit store tests over the mock `Plugin#data` (JSON round-trip in memory) | That real `data.json` is written, re-read by a fresh `onload`, and still bound to this device's machine id | 2 |
| City leaf `getState`/`setState` from `workspace.json`; DeferredView reveal; no scan on restore (`city-view.ts:244–262`, `commands.ts:28–34`) | `city-view.test.ts:164–213`, `city-view-store-wiring.test.ts:354–439`, `multi-leaf.test.ts` (DeferredView model) | Obsidian's own layout save and restore order, the real DeferredView, and that a restored leaf starts nothing | 4 |
| Theme: `readPalette` through `getCssPropertyValue`, re-read on `workspace.on('css-change')` (`theme-bridge.ts`, `city-view.ts:180–188`) | `theme-bridge-relations.test.ts` (fake container), `city-view-store-wiring.test.ts:219` (callback read back from a `vi.fn`) | That Obsidian fires `css-change` on a real theme switch, that the tokens resolve in each theme (OKLCH, `color-mix`), and that the drawn canvas follows | 3 |
| `open-city` command and the ribbon icon (`commands.ts:37`, `main.ts:89`) | `commands.test.ts:35–66` (`openCity` only); the ribbon is only counted as registered | That the real command and a real ribbon click each open a new leaf | 5 |
| `cancel-scan` offered only while a scan runs, and it stops the walk (`commands.ts:56–72`) | `commands.test.ts:112–134` (double: `getActiveViewOfType` ignores its class argument) | The real `checkCallback` through `executeCommandById`, and a real walk that stops mid-run | 6 |
| `import-analysis-report` offered only with a snapshot, and it attaches a real file (`commands.ts:74–87`) | `commands.test.ts:143–175`; the spine imports once | The refusal without a snapshot through the real command registry | 7 |
| `run-fallow-analysis`, `cancel-fallow-analysis` (`commands.ts:89–115`), the real `child_process` spawn through `window.require` | `fallow-commands.test.ts`, `city-view-analysis.test.ts`; `npm run test:fallow` runs the binary outside Obsidian | That the plugin spawns fallow inside Electron's renderer, attaches its evidence, and that cancel kills a running child | 8, 9 |
| Settings tab: declarative `getSettingDefinitions` renderer and `update()` (`settings-tab.ts`, `setting-definitions.ts`) | `settings-tab*.test.ts` (the mock tab does not interpret the definition tree; `update()` does nothing) | That the real 1.13 renderer draws every row and control, and that the callbacks fire from real input | 10 |
| **Bug:** the Settings tab does not refresh after a write it did not make. The writers are `scan-codebase` creating a profile (`scan-flow.ts:109`), the exclusion migration (`:79`), `persistThenScan` (`:155`), a note's exclusion (`investigation-notes.ts:134`), and a fallow bind or trust in Data & scans. | none (`update()` is a no-op in the mock) | Only the real renderer shows the stale list | 11, 15 (NE9) |
| Notes folder validation and Excluded paths (`settings-tab.ts:214–275`) | `settings-notes-folder.test.ts`, `settings-tab-validation.test.ts` (callbacks called directly) | Real input, a real `Notice`, the value in `data.json`, and the next scan asking again | 12, 13 |
| Connect/Reconnect (source modal) and Clear binding (confirm modal) in Settings (`settings-tab.ts:282–325`) | `settings-tab.test.ts:153` (mock `Modal`) | Real modals from the settings tab, and the binding in `data.json` | 14 |
| Note index: `changed`, `rename`, `delete`; the start rebuild and the first-`resolved` repair (E14) (`investigation-note-index.ts`) | `investigation-note-index.test.ts` (fake vault; `resolved()` fired by hand) | That a real folder move fires one `rename` per note (the file's own comment relies on it), and that a change made while the plugin was off is repaired at the next load | 16, 17 |
| Refresh `markers-edited` and `partial` (`investigation-notes.ts:182–197`) | `investigation-notes.test.ts:310–358`, `investigate-refresh.test.ts` (fake vault, spy rejection) | That a real `vault.process` refuses with the bytes unchanged, and that the UI says `partial` after a real block write | 18, 19 |
| O7: a note created inside the root adds its folder to the exclusions (`investigation-notes.ts:128–166`) | `investigation-notes.test.ts` (fake base path) | That the real rescan leaves the note out and asks for the new scope | 20 |
| A note moved into the root and refreshed (Part 1 final review, unjudged) | none | What a refresh does in the real vault | 21 (NE14) |
| Overlap through an 8.3 or junction alias (Part 1 final review) | none (the fake base path is a string) | Whether the real base path and the chosen root compare equal | 22 (NE15) |
| E25 bound-profile preview; a changed root refuses (`investigation-services.ts:34–39`, `source-preview.ts:179–192`) | `investigation-ports.test.ts:151–176` (mocked `node:fs`) | A real binding in `data.json`, a real file read, and the real `no-binding` state after Reconnect | 23 |
| Open in Obsidian and Open note → `getLeaf(true).openFile` (`investigation-notes.ts:208–225`) | `investigation-notes.test.ts:394–440` (one shared fake leaf; `true` not asserted) | That a real new Markdown leaf opens on the file | 24 |
| `%%`, `$`, `==` inside `mdCode` code spans (Part 1 final review) | `tests/unit/markdown.test.ts` (string output only) | How Obsidian's own renderer treats them | 25 |
| Bare and angle-bracket email autolinks after `noteText` (Part 1 final review) | `note-text.test.ts` (string output only) | Whether Obsidian autolinks them | 26 |
| Pop-out migration (`onWindowMigrated`, `activeDocument` in a pop-out) | `window-migration.test.ts` (window harness) | A real pop-out | — (NE20: WebDriver cannot drive a second Electron window through this harness without a new seam) |
| `Platform.isWin`/`isLinux`/`isMacOS` branches on other systems | unit tests toggle the mock | Other operating systems | — (one machine; IN50, §8) |
| `Notice` DOM from the host | mock `Notice` adds `.notice` | — (the real `.notice` is asserted incidentally in 12 and 13) | — |

## 4. Decisions

### Harness use

- **NE1 — One harness.** Every new scenario uses the Task 0 `test` fixture (`tests/e2e/fixture.ts`): a fresh session and a fresh vault copy per **test**, guaranteed teardown, `retry: 0`, `expect.poll` for every wait, and explicit timeouts (IN44–IN46). A scenario that restarts Obsidian inside its session uses the service's own `browser.reloadObsidian()` with no arguments, which keeps the same copied vault and profile (NP6).
- **NE2 — No new dependency.** The one piece of new machinery is a PNG reader for the canvas check, written on `node:zlib` in `tests/e2e/png.ts` (NP9). Nothing is added to `package.json`.
- **NE3 — Files by concern (NP2).** Each file is capped at 450 lines, and shared steps live in `tests/e2e/inspector.ts`:
  - `plugin-lifecycle.e2e.ts`
  - `city.e2e.ts`
  - `commands.e2e.ts`
  - `fallow.e2e.ts`
  - `settings.e2e.ts`
  - `notes-index.e2e.ts`
  - `notes-refresh.e2e.ts`
  - `notes-root.e2e.ts`
  - `preview.e2e.ts`
  - `obsidian-facts.e2e.ts` (extended)

  Host probes (listener counts, timer and leaf tracking, the theme switch, opening the settings tab) live in `tests/e2e/host-probes.ts`. Fixtures written at run time (a synthetic source tree, a crafted report, junctions) live in `tests/e2e/workspace-files.ts`.
- **NE4 — Reaching Obsidian (IPF20).** Tests never match Obsidian's own UI text. They use selectors, the six command ids, `executeObsidian`, and the service's `page` helpers.
  - A test **may** match the plugin's own copy, but only by importing the constant from `src/ui/audit-copy/**` or `src/ui/inspector-copy.ts`, never as a literal (NP3). The plugin's words are English whatever the locale.
  - Obsidian internals reached from test code only (`app.setting`, `app.commands`, the `Events` listener table, `app.changeTheme`) are named in the probe table (§6). Each has a positive control.
- **NE5 — Positive controls and RED proofs (IPF5).**
  - **Positive controls:** every probe and every negative assertion has a positive control in the same test that shows the check can fail. Examples: a listener deliberately left registered is counted as a leak; an unescaped string does link; a run left alone does finish.
  - **RED proofs:** every new scenario is shown RED once before it is committed. A bug scenario is RED on the unfixed code. A scenario pinning behaviour that already holds is RED under the named mutation in the plan: a temporary `src` edit, built, run and reverted, with the output in the task report. Nothing mutated is committed.
- **NE6 — Required scenarios.** Each task appends its own scenario titles to `tests/e2e/required-scenarios.json` in the commit that adds them (IP46). The gate then requires all 36 to run exactly once.
- **NE7 — The fallow binary for native runs (NP7).**
  - **Lookup:** scenarios 8, 9 and 15 read `FALLOW_BIN`, or else `.fallow-bin/bin-path.txt` (written by `npm run test:fallow`).
  - **No binary:** the scenario **fails** with a message naming both. It never skips, because a skip fails the gate anyway (IN48).
  - `npm run test:e2e` itself fetches nothing.
- **NE8 — A mid-run window (NP8).**
  - **The tree:** `cancel-scan` and `cancel-fallow-analysis` need a run that is still going when the cancel arrives. Each scenario writes a synthetic source tree into the session vault; its size is fixed by the pre-flight probe (NPF).
  - **Control first:** it times one **uncancelled** run as its positive control, and fails if that run took under 2 s. A window too short to cancel in is a failure, never a pass.
  - **The cancel:** the command is sent only after its own `checkCallback(true)` answers true.

### Behaviour this part fixes or pins

- **NE9 — The Settings tab follows writes it did not make (O2, fixes the known bug).**
  - **The listener:** `plugin-data-shape.ts` gains one plugin-scoped write listener. `watchPluginData(plugin, slices, listener)` returns an unwatch, and every successful `writePluginDataSlice` to a listed slice notifies it after the write settles.
  - **The wiring:** `main.ts` watches `profiles`, `bindings`, `analyzers` and `investigations` for the settings tab, and unwatches in `onunload`.
  - **Coalescing:** the tab gains `refreshSoon()`. It starts one `refresh()` and, while one is in flight, queues at most one more. The tab's own writes therefore cost at most one extra re-read.
  - **Unchanged:** the `ProfileStore` port (WP-01 §4.5) does not change (NP10).
  - **Proof:** scenario 11 (profile) is RED on 353e2c1; scenario 15 (fallow executable) is expected RED there too, and if the audit's reading is wrong it takes a named mutation instead (§5). A fast host test pins the listener and the coalescing.
- **NE10 — What a disabled plugin leaves behind (scenario 1).**
  - **After disable:** zero `.codebase-inspector-root` elements and zero plugin canvases in any window. Every `Events` table on `app.workspace`, `app.vault` and `app.metadataCache` is back to its pre-enable listener count per event name. No interval the plugin created while enabled is still live.
  - **Leaves:** what Obsidian does with the city leaves on disable, and again on re-enable, is recorded as a probe, not asserted (NPF).
  - **Enabling:** opens no leaf.
- **NE11 — Persistence (scenario 2).** Five values are written through the real UI:
  - a profile (`scan-codebase`)
  - a binding (Settings Connect)
  - a notes folder (Settings)
  - a disposition (the review dialog)
  - a work item (the work item editor)

  After the plugin is disabled and enabled, `data.json` (read through the service's `page` from `configDir`) holds the same values, and the UI shows them again: Settings lists the profile, its folder and its binding; after a rescan and re-import, Investigate shows the disposition and the work item. The session's machine id is unchanged, so the binding is still this device's.
- **NE12 — A layout restore (scenario 4).**
  - **Setup:** a city leaf is navigated to Quality. The test waits for Obsidian's own layout save, then `reloadObsidian()`.
  - **After the restart:** the leaf comes back as that view type. Once revealed, it shows `.ci-screen--quality`, starts no scan, opens no modal, and shows the no-snapshot state (the snapshot store is in-memory, WP-01 §4.5).
  - **The saved state:** the leaf's state in `workspace.json` holds no absolute path (WP-01 §4.4). The positive control is that same state holding `route: 'quality'` before the restart.
- **NE13 — Theme (scenario 3).**
  - **Setup:** a scanned city leaf is drawn in the dark theme, then switched to light and back.
  - **The check:** each time, a background pixel of the canvas element's WebDriver screenshot matches the resolved `--ci-surface` of that theme within 3 per sRGB channel.
  - **Positive control:** the two themes' surfaces differ by more than 24 in some channel.
  - **Unchanged by the switch:** the same canvas element (no rebuild), the same `getState()` camera and selection, and no new renderer.
- **NE14 — A note moved into the root is still refreshed (the Part 1 follow-up, NP11).**
  - **The rule:** refresh writes only between the markers of a note the user placed. It is confirmed in the refresh dialog, and it neither adds nor needs an exclusion.
  - **What scenario 21 pins:** the refresh succeeds; every file under the root other than that note is byte-identical; the next rescan lists the note as a file of the codebase (as IN29 already says of a folder equal to the root).
  - This is recorded as a limitation, not a bug.
- **NE15 — Overlap through an alias (the Part 1 follow-up).**
  - **The rule:** overlap (IN29) must hold when the binding root and the vault base path name the same folder through a junction or an 8.3 short name.
  - **Scenario 22:** connects a codebase through an alias of the vault's `code/` folder (a junction made by `mklink /J`'s Node equivalent `fs.symlinkSync(…, 'junction')`, or an 8.3 name when the volume has them) and plans a note folder inside it. The create dialog must offer **Exclude this folder from scans**.
  - **If RED:** the fix compares both paths after resolving each one's nearest existing ancestor with `realpathSync.native`, inside `src/adapters/filesystem/`. It is reached through the host, keeps `planDestination` synchronous, and falls back to the textual comparison when resolution fails. The fix only adds overlaps (two resolved paths that name one folder); it never removes one the textual check finds.
  - **The control:** vault-folder mode (no alias) offers the checkbox.
- **NE16 — Email autolinks (scenario 26).**
  - **Controls:** `<a@x.io>` rendered unescaped links in reading view.
  - **Observed first:** whether Obsidian autolinks the bare `a@x.io` is recorded before any assertion.
  - **The requirement:** both forms after `noteText` produce no link in reading view or live preview.
  - **If the bare form links after escaping:** `noteText` also escapes `@` (O2), with its fast-suite pin.
- **NE17 — Code spans (scenario 25).** `mdCode` of a string holding `%%c%%`, `$x$` and `==x==` renders as one inline code element with the text intact, and with no comment, math or highlight, in reading view and live preview. The positive control is the same string outside a code span, which does produce all three.
- **NE18 — Open in Obsidian (scenario 24).**
  - **The report:** a report crafted at run time from the 3.27.0 recording, with one finding's path set to a Markdown file of the scanned `code/` folder, is imported through the real dialog (NP12).
  - **The button:** Open in Obsidian opens a new Markdown leaf on that vault path.
  - **The control:** a `.ts` anchor shows no button. Open note from the notes panel also opens a new leaf.
- **NE19 — E25 bound (scenario 23).**
  - **Setup:** a profile connected in Settings to `code/` is scanned and its report imported. The preview then shows the exact highlight.
  - **Reconnect:** the profile is reconnected to `code-copy/` (a byte-identical copy). The preview then shows the `no-binding` state, and the highlight is gone.
  - **The control:** the highlight before the Reconnect.
- **NE20 — Pop-out windows stay out.** No scenario opens a pop-out. The harness would need a second WebDriver window handle and a new seam in `tests/e2e/`. This is a recorded follow-up.

## 5. Scenarios (exact titles added to `tests/e2e/required-scenarios.json`)

| # | File | Title | RED proof |
|---|---|---|---|
| 1 | plugin-lifecycle | `unloading the plugin releases its views, events and timers` | mutation: drop `offref(cssChangeRef)` in `CityView.onClose` |
| 2 | plugin-lifecycle | `keeps profiles, bindings, the notes folder, dispositions and work items across a plugin reload` | mutation: `writePluginDataSlice` skips `saveData` |
| 3 | city | `draws the city in dark and light themes and recolours on css-change without rebuilding` | mutation: the `css-change` handler does nothing |
| 4 | city | `restores the city leaf's route after an app restart without scanning` | mutation: `setState` ignores its payload |
| 5 | commands | `open-city and the ribbon icon each open a new city tab` | mutation: the ribbon callback does nothing |
| 6 | commands | `cancel-scan stops a running scan and is refused when no scan runs` | mutation: `cancelScan()` does nothing |
| 7 | commands | `import-analysis-report attaches a real report file and is refused without a snapshot` | mutation: its `checkCallback` ignores `hasSnapshot()` |
| 8 | fallow | `run-fallow-analysis runs the installed fallow on the scanned codebase` | mutation: `requestFallowRun()` does nothing |
| 9 | fallow | `cancel-fallow-analysis stops a running analysis and is refused when none runs` | mutation: `cancelAnalysis()` does nothing |
| 10 | settings | `the settings tab renders each saved codebase in the real settings renderer` | mutation: `refresh()` skips `update()` |
| 11 | settings | `the settings tab lists a codebase that scan-codebase created` | RED on 353e2c1 (NE9) |
| 12 | settings | `the notes folder setting saves a valid folder and refuses an invalid one with its reason` | mutation: the folder is written without validation |
| 13 | settings | `an excluded-paths change is saved, a refused one names its reason, and the next scan asks for approval` | mutation: `changeExclusions` skips `exclusionInputReasons` |
| 14 | settings | `Connect binds a codebase to a vault folder and Clear binding asks before removing it` | mutation: the clear modal's confirm is bypassed |
| 15 | fallow | `the settings tab shows a fallow executable trusted in Data & scans` | RED expected on 353e2c1 (NE9); otherwise mutation: drop the `analyzers` watch |
| 16 | notes-index | `the note index follows a folder move and ignores an unrelated note` | mutation: the index drops `rename` events |
| 17 | notes-index | `relinks a note moved while the plugin was disabled once it is enabled again` | mutation: `start()` skips its whole-cache rebuild and the first-`resolved` repair |
| 18 | notes-refresh | `refresh refuses a note whose markers were edited and leaves it byte-identical` | mutation: a refused splice returns the new block |
| 19 | notes-refresh | `refresh reports partial when the frontmatter update fails after the block was written` | mutation: the `partial` catch returns `refreshed` |
| 20 | notes-root | `a note created inside the codebase root is excluded from the next scan` | mutation: `addExclusion` is not called |
| 21 | notes-refresh | `refreshing a note moved inside the codebase root changes nothing else under the root` | mutation: the splice also rewrites the note's human sections |
| 22 | notes-root | `offers the scan exclusion when the codebase root is reached through an alias` | RED expected on 353e2c1 (NE15); otherwise mutation: the overlap check always answers no |
| 23 | preview | `a bound codebase previews under its connected folder and refuses a changed root` | mutation: `resolveRoot` treats a bound profile as unbound |
| 24 | preview | `Open in Obsidian and Open note each open the file in a new tab` | mutation: `open()` uses `getLeaf(false)` |
| 25 | obsidian-facts | `code spans keep %%, $ and == inert in reading and live-preview views` | positive control: the same string outside a code span |
| 26 | obsidian-facts | `email addresses stay inert after noteText escaping` | positive control: `<a@x.io>` unescaped; a fix if the bare form links (NE16) |

Where a planned mutation cannot turn a scenario RED (the behaviour has a second guard), the implementer finds one that does. The mutation is named in the task report and recorded as a WP-04.2 E ruling.

## 6. Probe table (external facts)

**Confirm at pre-flight (Task 1):**
- The probes run from a scratch `tests/e2e/probes.e2e.ts`, which is never committed and never in the gate.
- Each probe has a positive control. Its outcome becomes an NPF ruling before Task 2.
- A probe that defeats its scenario's plan stops the plan for a ruling.

| # | Fact | Positive control | Used by |
|---|---|---|---|
| a | `Events` keeps listeners in `_[name]` arrays on `app.workspace`, `app.vault`, `app.metadataCache` (internal) | one `on('css-change')` left registered is counted +1; `offref` returns it to baseline | 1 |
| b | What Obsidian does with open city leaves on plugin disable and re-enable | the leaf count before disable | 1 (recorded) |
| c | `reloadObsidian()` with no argument keeps the copied vault, `data.json`, `workspace.json` and `localStorage`. Teardown still releases the app, the driver and the copied directories after it | a `localStorage` key and a vault file written before survive; `teardown.json` has `completed: true` | 2, 4, 17 |
| d | `app.changeTheme('obsidian' \| 'moonstone')` (internal) switches `theme-dark`/`theme-light` and fires `css-change` | a test listener counts one event per switch | 3 |
| e | A WebDriver element screenshot of the city canvas holds the renderer's clear colour | the two themes' surfaces differ and each pixel follows its own | 3 |
| f | `app.setting.open()` then `openTabById('codebase-inspector')` (internal) renders the declarative tab | our tab's content element holds the profile name we saved | 10–15 |
| g | Scan and fallow durations on a generated tree, and the tree size that gives a ≥ 2 s uncancelled run | the uncancelled run finishes (a snapshot, attached evidence) | 6, 9 |
| h | A junction can be made in the temp directory without elevation; whether the volume has 8.3 names; whether the scan accepts an alias root | the textual (vault-folder) path reaches the same files | 22 |
| i | Obsidian autolinks bare `a@x.io` and `<a@x.io>` | the angle form links | 26 |
| j | `app.fileManager.processFrontMatter` can be replaced for one call from test code, and restored | the unpatched call writes | 19 |
| k | The ribbon action is reachable as `.side-dock-ribbon-action[aria-label="Open codebase city"]`, our own string | a click opens a leaf | 5 |

Carried facts (already observed, Part 1): IPF16–IPF20, E12, E14, E25.

## 7. Constraints carried

- The WP-01 spec §4 frozen contracts. NE9 adds no port member (NP10).
- Every earlier spec and ledger, and `docs/deliverables/*.md`.
- Line caps: 400 for `src`, 450 for tests, including `tests/e2e/**` and `tests/support/**`.
- The city-view budget: `city-view.ts` and `CityWorkspace.vue` ≤ 360; `CityViewport.vue` never edited. Layering holds.
- Copy lives only in `src/ui/audit-copy`.
- CRLF files are edited only with Edit/Write.
- Explicit timeouts. A native test that restarts, scans a synthetic tree or runs fallow names its own `timeout` (NP5).
- `npm run analyze` stays at 9: a new dead export is removed, not baselined.
- The literal trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" on every commit, scanned before pushing.
- The native discipline IN42–IN51: no retries, a fresh vault per test, guaranteed teardown, a positive control per probe, a RED proof per scenario.

## 8. Limitations (known at design time)

- **Environment:** the suite runs on one Windows 11 machine, desktop only, gated on 1.13.4, with one recorded latest run (O4). No CI (O3).
- **Not covered:**
  - pop-out windows (NE20);
  - axe and mobile (IP51);
  - other operating systems' `Platform` branches.
- **Behaviours pinned rather than changed:**
  - A note the user moves into the codebase root is refreshed and scanned like any file there (NE14).
  - The theme check compares one background pixel, not the whole city.
- **Costs:**
  - Scenarios 8, 9 and 15 need a local fallow binary (NE7).
  - Each test starts its own Obsidian, so the suite takes minutes, not seconds.
