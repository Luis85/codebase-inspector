---
project: codebase-inspector
title: WP-04 Part 2 polish pass (design)
date: 2026-09-26
status: for owner approval
deliverable: docs/deliverables/Test Evidence.md
---

# WP-04 Part 2 polish pass

## 1. Outcome and scope

This pass closes the WP-04 Part 2 follow-ups and deferred minors, and settles the four open owner decisions, without widening scope.
- Every change keeps or strengthens the native gate. It grows from 36 to **40** required scenarios (§5), and no existing title is renamed.
- A bug found natively is fixed RED first, with a fast-suite test as well (Part 2 O2 carries over).

**Out of scope** (unchanged unless the owner asks):
- the M80/F14 renderer retry cap and M95 pointer capture;
- the spec §7 root-unavailable producer and Y19 external `data.json` edits;
- pop-out windows (NE20), axe and mobile (IP51), and CI (Part 2 O3);
- the owner's manual Part 7 check (item 3).

**Binding:**
- the WP-04 Part 2 spec (NE1–NE20) and ledger (O1–O4, NP1–NP20, NPF1–NPF15, WP-04.2 E1–E22);
- the WP-04 Part 1 spec and ledger (IN42–IN51, IPF20);
- the WP-01 spec §4 frozen contracts, every earlier spec and ledger, and `docs/deliverables/*.md`.

Rulings made while planning are **PP1…** in `docs/superpowers/notes/2026-09-26-wp04-part2-polish-ledger.md`, and this spec cites them where it depends on one.

## 2. Owner decisions (2026-09-26)

| # | Decision |
|---|---|
| O1 | **E14: a rescan follows the codebase's live binding, with approval.** When a snapshot exists and the profile's live binding on this device names a different root, `scan-codebase` opens the scope-approval modal on the binding's root instead of silently refreshing the snapshot's old root. Cancelling changes nothing. |
| O2 | **Z38: the 50 ms budget stays, and the test runs isolated.** The no-freeze case moves into its own file, in a third Vitest project that runs after every other file has finished. |
| O3 | **NP11 and E4 are kept as ruled.** A note you move into the root is refreshed normally, and scenario 1 keeps its measured `layout-change` allowance per city leaf. |
| O4 | **Scope: every confirmed item**, meaning the five product follow-ups and the ten test-quality minors, each with its RED proof. |

## 3. Inventory at 9644c08

Every row was checked against the code at `9644c08` by a read-only audit, and the E20 cost was measured with Node 24 on this machine. **Confirm** means the finding is real and this pass changes it. The inventory confirms all 15 items and rejects none.

### 3.1 Product follow-ups

| # | Item | Current behaviour and evidence | Change | Test |
|---|---|---|---|---|
| P1 | **E20: the alias check's cost** | <ul><li>`insideOf` (`investigation-notes.ts:51–57`) resolves **both** sides with `realPathOfNearest` (`node-access.ts:25–42`) whenever the textual check finds no relation.</li><li>That covers `plan()`, which runs on every keystroke in the create dialog (`CreateNoteDialog.vue:56–59`, reaching `insideOf` at `:118`), and `sourceNotePath()`, which runs on every finding selection (`use-investigation-preview.ts:44–49`, `insideOf` at `:236`).</li><li>Nothing is memoised.</li><li>**Measured** (10 000 calls each): an existing local path costs 136 µs (p99 315); an 8.3 path 453 µs; an 8.3 path with 3 missing segments 1 054 µs (p99 1 774). So a keystroke costs about 1.2 ms and a selection about 0.6 ms. That is not the "microseconds" E20 assumed, but it is harmless locally.</li><li>**An unreachable UNC root blocks the renderer:** `\\nonexistent-host\share\a` blocked for 1 272 ms, and `\\10.255.255.1\share\a` (an offline SMB server) for **21 059 ms** in one call. Today that happens on every keystroke and every selection.</li><li>No event can invalidate a memo: roots outside the vault get no vault events, and the plugin registers no `create` listener.</li></ul> | **Confirm** (PN1):<ul><li>A `\\`- or `//`-prefixed path is never resolved; it gets the textual answer.</li><li>`sourceNotePath` resolves the codebase **root** once and re-appends the relative path. A scanned file is reached without following links (WP-01 §4.4), so this changes no answer.</li><li>Root and vault-base resolutions go through a session memo keyed by the path string.</li><li>The create dialog's target folder is still resolved fresh on each call (local, about 1 ms), so a folder made mid-session is seen.</li></ul> | Fast, in `tests/host/investigation-notes-alias.test.ts`:<ul><li>N selections on one root cost one root resolution;</li><li>a UNC root makes zero `realpathSync` calls and falls back to the textual answer;</li><li>the junction case still overlaps.</li></ul>No native change: scenario 22 still guards the alias. |
| P2 | **NPF15: a folder on disk that is not indexed** | <ul><li>`ensureFolders` (`investigation-notes.ts:127–136`) calls `vault.createFolder` on any segment `getAbstractFileByPath` does not know.</li><li>On an existing but unindexed folder, Obsidian 1.13.4 throws "Folder already exists." (it checks `adapter.exists` first; read from the app bundle). The `catch` (`:174–178`) then turns this into `write-failed`.</li><li>The native scenarios work around it by creating `code/` through the vault API first (`notes-root.e2e.ts:19–26`, `preview.e2e.ts:147–155`).</li><li>The fake vault (`fake-vault.ts:229–241`) has no disk-only state, and its adapter has no `exists` or `stat`.</li></ul> | **Confirm** (PN2): before `createFolder`, `ensureFolders` asks `app.vault.adapter.stat(prefix)`:<ul><li>a folder on disk is skipped, and the next `createFolder` or `create` below it reconciles it into the index;</li><li>a file on disk refuses as today (`not a folder`, so `write-failed`).</li></ul> | <ul><li>**Fast:** a new `tests/host/investigation-notes-unindexed.test.ts` over a fake vault that gains disk-only folders and files and an adapter `stat`. The file case is the control.</li><li>**Native:** scenario 37 (§5), RED on 9644c08.</li></ul> |
| P3 | **The status bar covers the notes panel's buttons** (Task 9 minor) | <ul><li>Once a Markdown leaf exists, Obsidian's fixed status bar (`position: fixed; bottom: 0; right: 0; z-index: 15`, about 27 px) sits over the bottom-right of the city leaf.</li><li>The plugin removes the view's bottom padding (`shell.css:19–21`, pinned by `leaf-chrome.test.ts`). The scroll container `.ci-shell__content` (`shell.css:34–37`) therefore ends at the leaf's bottom edge, under the status bar.</li><li>A click that scrolls a button into view (WebDriver aligns it to the end) or a keyboard focus lands the button under the bar. Create is right-aligned in the right-hand column, which is exactly the bar's corner.</li><li>This also affects a person, not just the tests: focus is obscured (WCAG 2.4.11).</li><li>Obsidian's own views reserve `--size-4-8` (32 px) at the bottom.</li><li>The tests work around it with `centred()` (`preview.e2e.ts:50–56`, used at `:69` and `:186`).</li></ul> | **Confirm**; the plugin's zero padding is at fault (PN3). `.ci-shell__content` gains a 32 px `scroll-padding-block-end` built from `--ci-space-4`. Layout does not change, so the city stage height (`stage-height.test.ts`) is untouched. `centred()` is deleted. | <ul><li>A unit pin beside `leaf-chrome.test.ts`.</li><li>Scenario 24 without `centred()` is RED on 9644c08's CSS and green after.</li></ul> |
| P4 | **NE9's cost: a re-render while typing** | <ul><li>`refresh()` always ends in `update()` (`settings-tab.ts:84–108`). Obsidian 1.13.4's `update()` re-renders the open page, sparing only a focused **`control`**-type item (from the app bundle), and every text row here is `render`-type (`setting-definitions.ts:77–105`).</li><li>So a write that lands while a person types replaces the field they are typing in: the typed text is lost and focus moves to the row's container.</li><li>Writes that can land then:<ul><li>the tab's own commit of the previous field (on `change`, which fires on blur, E2; that commit refreshes twice, once from the watcher and once explicitly);</li><li>fallow `grantTrust`, `revokeTrust` or `bind` during a run;</li><li>a note's exclusion.</li></ul></li><li>The mock's `update()` is a no-op, so only a native test can see this.</li></ul> | **Confirm** (PN4): `update()` waits while an editable element inside the tab's own container holds focus. One deferred `update()` runs when focus leaves the tab's editable elements (a `focusout` whose `relatedTarget` is outside them). `refresh()` still re-reads at once, and coalescing is unchanged. | <ul><li>**Fast:** a new `tests/component/settings-tab-focus.test.ts` (jsdom).</li><li>**Native:** scenario 38 (§5), RED on 9644c08. If it is green there, the task stops for a ruling (PP6).</li></ul> |
| P5 | **E13: the `realPath` wiring is guarded only natively** | <ul><li>`realPath?` is optional (`investigation-notes.ts:28–35`) and wired only in `investigation-services.ts:45`.</li><li>`investigation-ports.test.ts` builds the services, but its `realPath` always resolves null there (`Platform.isDesktopApp` is false in the mock). Only native scenario 22 would notice the wiring being dropped.</li><li>Making it required would touch 9 test call sites to pass `() => null`, which behaves exactly like leaving it out.</li></ul> | **Confirm; take the wiring test** (PP4): a fast case in `investigation-ports.test.ts` mocks `node-access` with a resolver mapping an alias to the vault's `code/`, and asserts the built port's `plan` reports the overlap. `realPath` stays optional. | The new case is RED when the wiring line is removed (mutation). |

### 3.2 Owner-decided follow-ups

| # | Item | Current behaviour and evidence | Change | Test |
|---|---|---|---|---|
| P6 | **E14: a rescan after a Reconnect** | <ul><li>`startScan` (`city-scan-controller.ts:81–95`) refreshes against `existing.scope`. `runRefresh` (`scan-flow.ts:190–210`) takes `rootPath` from the stored scope in both branches.</li><li>No scan reads the binding; only the Settings tab and the preview's `resolveRoot` (`investigation-services.ts:35–40`) do.</li><li>WP-01 §4.1 says "a changed root … invalidates prior approval", and a Reconnect is the person naming a new root.</li></ul> | **O1** (PN5):<ul><li>`CityViewDeps` gains `boundRoot(profile)`: the profile's live binding root on this device, or null.</li><li>`runRefresh` gains that root. When it is non-null and not `sameRoot` with the stored root, the scope modal opens on the bound root (the M57 path), and approval scans it through `persistThenScan`.</li><li>An unbound profile, or one bound to the snapshot's own root, refreshes silently as before.</li></ul> | <ul><li>**Fast:** cases in `tests/host/city-view-scan-modes.test.ts` (differing root: modal on the bound root; cancel: no scan; same root: silent).</li><li>**Native:** scenario 39 (§5); scenario 23 is unchanged and stays green.</li></ul> |
| P7 | **Z38: the no-freeze budget** | <ul><li>`tests/integration/fallow-analysis.test.ts:266–287` asserts a worst event-loop gap under 50 ms during `hang` and `streamed` runs.</li><li>The `node` and `jsdom` projects run files in parallel under the Vitest defaults (`vitest.config.ts` sets no pool options).</li><li>It failed in 7 of 10 loaded full-suite runs (52–101 ms) and always passes alone (19–28 ms) (E19, E22).</li></ul> | **O2** (PN6): the `no freeze` describe moves to `tests/integration/fallow-no-freeze.test.ts`, with its shared helpers in a non-test support module. A third project, `node-serial`, has `sequence.groupOrder: 1` and holds only that file, and the `node` project excludes it. The budget stays at 50 ms. | Every `npm run verify` run in this pass is disclosed with its Z38 outcome (§6). |
| P8 | **NP11 and E4** | <ul><li>Scenario 21 pins NP11.</li><li>Scenario 1 allows exactly Outline's measured per-leaf `layout-change` growth (`plugin-lifecycle.e2e.ts:133–145`).</li></ul> | **O3: unchanged.** | — |

### 3.3 Test-quality follow-ups (the ledger's "Deferred minors")

| # | Minor | Current code and evidence | Verdict and change | Proof |
|---|---|---|---|---|
| T1 | `openPluginSettings` calls `handleWhere` twice | `host-probes.ts:107–109`. The second walk over every window handle can race the settings window closing, which is why `:109` throws "the settings window vanished". | **Confirm.** Capture the handle inside the `expect.poll` and drop the second call. | Behaviour-neutral: scenarios 2 and 10–15 stay green. |
| T2 | `listenerCounts` skips a non-array `_` entry silently | `host-probes.ts:31` (`if (Array.isArray(listeners))`). An event whose entry stops being an array drops out of both `before` and `after`, so a leak there goes unseen. | **Confirm.** Throw, naming `source:event`. | A new negative control in scenario 1 plants `app.vault._['ci-probe'] = {}` and expects the throw, then deletes it. Restoring the silent `if` fails the control. |
| T3 | Scenario 2's RED never reaches the post-reload assertions | Under "`writePluginDataSlice` skips `saveData`", the first failure is `plugin-lifecycle.e2e.ts:163` (no profile). No `data.json` read happens at `onload` (every store re-reads per call), so no write mutation can reach past the reload. | **Confirm.** Add a second recorded mutation, `listDispositions` returning `[]` (`plugin-data-review-repository.ts:238`). Writes still persist and the UI keeps its own writes in memory, so it fails only at the post-reload on-screen check (`:215`). | The mutation run is recorded in the task report and the ledger. |
| T4 | `reviewFinding`'s disposition is untyped, and its dismissed branch never runs | `inspector.ts:252` (`disposition: string`), with the branches at `:257–265`. The only caller is scenario 2, with `'acknowledged'`. | **Confirm.**<ul><li>Type it as `Exclude<keyof typeof FINDING_STATUS_LABEL, 'open'>` (a copy module, which NP3 allows), and drop the unreachable `else throw`.</li><li>Scenario 2 also dismisses a second finding and checks both the stored `{ status: 'dismissed', reason }` and the Reason row after the reload.</li></ul> | Mutation: the save-dismissal handler skips its save. |
| T5 | `evidence()` pairs dt and dd by index | `inspector.ts:285–288`, `values[i] ?? ''`. A missing trailing `dd` is masked, and a duplicate label collapses. | **Confirm.** Throw when the counts differ or a label repeats. | Mutation: remove the last `dd` (`EvidencePanel.vue:88–97`). Scenario 2 then fails in `evidence()` with the count message, instead of reading `''`. |
| T6 | `recordingFindingCount` does not drop unmatched paths | `workspace-files.ts:39–47` counts the normaliser's output. The app also drops findings whose anchor is not a snapshot file (`resolve-findings.ts:10–24`). The recording has none, so today's counts agree by luck. | **Confirm.** Expected counts come from `resolveFindings(…, snapshotFiles).matched`. | Scenario 40 imports a report with one unmatched finding. The old helper over-counts by one there (RED). |
| T7 | The Show more loop never runs natively | `inspector.ts:196–207`; `FINDINGS_PAGE = 100` (`findings.ts:40`); the recording lists 6 rows. | **Confirm.** Scenario 40 imports a crafted report of more than one page (clones of one `unused_exports` entry with distinct names; the size is far below the 16 MiB cap). | Mutation: `@more` does nothing. The loop's poll then fails. |
| T8 | The "only adds" tests cover `plan()`, not `sourceNotePath()` | `investigation-notes-alias.test.ts:96–104` asserts only `plan`. | **Confirm.** The same `it.each` also asserts that `sourceNotePath('/vault/docs', 'guide.md')` is `'docs/guide.md'` under both resolvers. | Mutation: `sourceNotePath` prefers the resolver's answer. |
| T9 | `smoke.e2e.ts` navigates with the literal 'Investigate' | It is wider than recorded: `:21` `'Investigate'`, `:28` the group `'Act'`, and `:30` the three Act labels. Both smoke tests are required scenarios. | **Confirm.** Use `ROUTE_META.investigate.title`, `ROUTE_META.investigate.group`, and `ROUTE_META[id].title` for the three routes (E6). | Behaviour-neutral: the values are identical and the smoke tests stay green. A grep shows no plugin literal is left in `tests/e2e`. |
| T10 | Scenario 17's generous timeout | `notes-index.e2e.ts:104` sets `240_000`. Scenario 17 only disables and re-enables the plugin: no restart, no synthetic tree, no fallow. Scenarios 2 (`plugin-lifecycle.e2e.ts:216`) and 22 (`notes-root.e2e.ts:115`) reload the plugin with `300_000`. In Part 2's last gate run they took **6.8 s, 10.4 s and 10.0 s**. | **Confirm**, widened to all three (PP5). A plugin reload is not an app restart under NP5, so each takes the config's default `120_000` (the third argument is dropped). | The gate run shows all three pass under the default. |

## 4. Decisions

- **PN1 — Resolving aliases costs one lookup per root, and never touches a network path (P1).**
  - **UNC paths:** `realPathOfNearest` returns null without a filesystem call for a path starting with `\\` or `//`, which covers UNC, `\\?\` and `\\.\`. That is the fail-safe branch E13 already allows: `insideOf` keeps the textual answer.
  - **The memo:** `createInvestigationNotes` owns a session `Map` of path to resolution, used for the codebase root and the vault base only.
  - **`sourceNotePath`** compares `realPath(base)` with the joined `realPath(root)` and relative path.
  - **`plan`** still resolves its target folder fresh on each call.
  - **Unchanged:** the resolved comparison still only adds an overlap (NE15), and `planDestination` stays synchronous.
- **PN2 — `ensureFolders` skips a folder that exists on disk (P2).** Before `createFolder(prefix)`, it asks `adapter.stat(prefix)`:
  - `type === 'folder'` continues to the next segment;
  - `type === 'file'` throws `not a folder` (as an indexed file already does);
  - `null` creates the folder.

  Nothing else in `create()` changes, and the note is still written only inside the planned folder.
- **PN3 — The city leaf keeps its content clear of the status bar (P3).** `.ci-shell__content` gains `scroll-padding-block-end: calc(var(--ci-space-4) * 2)`. That is 32 px, Obsidian's own `--size-4-8`. The largest token is `--ci-space-6` (24 px), and no token is added. Leaf padding stays 0, so the stage height and `leaf-chrome.test.ts` hold. If ChromeDriver's scroll does not honour it (scenario 24 stays RED after the fix), the task stops for a ruling.
- **PN4 — Settings never re-renders the field you are typing in (P4).**
  - **Deferral:** `refresh()` re-reads at once. When an `input`, `textarea` or `select` inside the tab's own `containerEl` holds focus, it defers `update()` rather than calling it.
  - **Release:** one `focusout` listener on the container runs the deferred `update()` once focus has moved outside the tab's editable elements. A `relatedTarget` inside them keeps it deferred, so moving from field to field never re-renders under the new field.
  - **Settings window:** focus is read from `containerEl.ownerDocument`, because Settings opens in its own window (NPF7).
  - **What it may cost:** a deferred `update()` can show a pre-commit value for one render, until the committing write's own refresh lands. No typed text is lost, because `change` has already carried it.
  - **Unchanged:** `refreshSoon()`'s coalescing.
- **PN5 — A Reconnect is a changed root (O1, P6; WP-01 §4.1).**
  - **The lookup:** `CityViewDeps.boundRoot(profile): Promise<string | null>` is `bindingStore.get(profile.bindingId)?.rootPath`, or null when `bindingId` is null or this device has no record. That is the same lookup `resolveRoot` makes, and `main.ts` wires it from the one `bindingStore`.
  - **The check:** `runRefresh(…, boundRoot)` compares with `sameRoot(boundRoot, storedScope.rootPath, { caseSensitive: Platform.isLinux })`. On a difference, it opens `openScopeModal(app, { profile, resolvedRoot: boundRoot })`, and on approval calls `persistThenScan`.
  - **Never:** no approval is self-minted for the bound root; a cancel leaves the snapshot, the profile and the binding unchanged; and `selectCodebase()` is unchanged.
  - **The test fixture:** the shared test deps (`tests/fixtures/data-port-deps.ts`) answer null.
- **PN6 — The no-freeze case runs alone (O2, P7).** `vitest.config.ts` gains the project `{ name: 'node-serial', environment: 'node', include: ['tests/integration/fallow-no-freeze.test.ts'], sequence: { groupOrder: 1 } }` (the same `obsidian` alias and `vue()` plugin), and the `node` project excludes that file. Every other file runs in group 0 and finishes first. The assertion (`< 50`), its modes and its timeout are unchanged.
- **PN7 — New native scenarios follow Part 2's discipline.**
  - **Sessions:** one fresh session per test, `retry: 0` and `expect.poll`.
  - **Controls and RED:** a positive control for every negative assertion, and a RED run on record, either on 9644c08 for a bug or under the named mutation.
  - **Words:** Obsidian's words are never matched (IPF20); the plugin's words come only from copy constants or `ROUTE_META` (E6, E7).
  - **Windows and commands:** Settings is driven in its own window (NPF7), and a refusal is never asserted as a throw (NPF13).
  - **Timeouts:** NP5.

## 5. Scenarios (exact titles appended to `tests/e2e/required-scenarios.json`)

| # | File | Title | RED proof | Positive control |
|---|---|---|---|---|
| 37 | notes-root | `creates a note in a folder that exists on disk before Obsidian has indexed it` | RED on 9644c08 (`write-failed`) | The folder is on disk (`adapter.exists`) and not indexed (`getAbstractFileByPath` is null) before the create. |
| 38 | settings | `a setting being typed keeps its text when a write elsewhere refreshes the settings tab` | RED on 9644c08 (typed text lost) | A marker set on another row's element is gone after focus leaves: the write did re-render the tab. |
| 39 | commands | `scan-codebase after a Reconnect to another folder asks to approve the connected folder` | mutation: `boundRoot` answers null | Before the Reconnect, `scan-codebase` refreshes with no modal. After it, cancel leaves the snapshot's root, and approve scans the new root. |
| 40 | investigation | `the finding list pages through a report longer than one page and leaves out unmatched findings` | mutation: `@more` does nothing; and the pre-fix count helper over-counts by one | The crafted report's matched count is over `FINDINGS_PAGE`, and the unmatched finding is in the imported report. |

**Changed scenarios** (titles unchanged), each with a RED run on record:
- **Scenario 1:** the non-array control (T2).
- **Scenario 2:** the dismissed disposition, the `evidence()` guard, and the post-reload mutation (T3–T5).
- **Scenario 24:** `centred()` removed (P3).
- **Scenarios 2, 17 and 22:** timeouts (T10), shown green only.
- **Smoke:** `ROUTE_META` (T9), shown green only.

## 6. Verification and evidence

- **`npm run verify`** exits 0. Every run in this pass is disclosed with its Z38 outcome, never a cherry-picked pass.
- **`npm run test:e2e`** passes on the baseline 1.13.4 and prints "Verified N executed native Vitest cases, including all 40 required scenarios", with each required scenario run exactly once. It also runs once with `OBSIDIAN_VERSION=latest`, recording the resolved version, with `FALLOW_BIN` set and no `fallow.exe` running (E11).
- **`npm run test:fallow`** passes with the same `FALLOW_BIN`.
- **`npm run analyze`** stays at 9.
- **`npm run harness-shot`** runs, and the captures this pass affects are looked at (Investigate, Settings).
- **The evidence counts are refreshed once:**
  - the gate-evidence G8 table and its mirror in the implementation report;
  - `docs/deliverables/Test Evidence.md`'s native paragraph (36 → 40);
  - the two count tests.

## 7. Limitations (known at design time)

- **PN1:**
  - A root that is unreachable at its first use keeps a null resolution until the plugin reloads, so an alias overlap for it falls back to the textual check.
  - A junction retargeted mid-session keeps its old resolution.
  - A mapped drive letter to an offline server is not a UNC path, so it blocks once per session instead of once per keystroke.
- **PN4:** a person who stays in one field keeps a stale page until they leave it.
- **PN5:**
  - A bound root that no longer exists fails at the scan, with the scan's own failure notice.
  - The preview's `no-binding` state after a Reconnect is unchanged until the person rescans.
- **PN6:** the full suite takes about the no-freeze file's own run time (a few seconds) longer.
