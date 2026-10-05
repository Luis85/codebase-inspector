# WP-04 Part 2 polish follow-ups: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the follow-ups the WP-04 Part 2 polish pass left open (E13, E7, Z38 and the 14 deferred minors) without widening scope. The native gate grows from 40 to 41 required scenarios.

**Architecture:**
- **One new `src` module**, `src/host/settings-render-wait.ts`, holding the Settings render wait that `settings-tab.ts` has today (FN1, Task 1).
- **Other `src` changes:** one type alias in `investigation-notes.ts` (FM2, Task 2) and three comments in `settings-tab.ts` (FM8, Task 1).
- **Everything else is test code:** fast tests, one fake, `tests/e2e/**`, one new config pin, and the evidence documents.

**Tech Stack:**
- Code: TypeScript 6.0.3, Vue 3.5.43, Vitest 5.0.1 (+ @vue/test-utils 2.5.1, jsdom 30.1.0), Node 24.
- Native: WebdriverIO 9.32.0 and `wdio-obsidian-service` 3.2.1, on Obsidian 1.13.4 (baseline) and `latest` once.
- fallow 3.27.0, only through `FALLOW_BIN`.

**Spec:** `docs/superpowers/specs/2026-09-27-wp04-part2-followups-design.md`. It holds the inventory FU1–FU3 and FM1–FM14, the owner decisions O1–O2, the design decisions FN1–FN4, scenario 41 (§5) and the Z38 measurement record (§3.3).
- **Rulings:** `docs/superpowers/notes/2026-09-27-wp04-part2-followups-ledger.md`. Planning rulings are **FP1…**, pre-flight rulings **FQ1…**, and execution rulings **"WP-04.2 Follow-up E1…"**.
- **Also binding:**
  - the polish spec (PN1–PN7) and ledger (O1–O4, PP1–PP15, PQ1–PQ2, WP-04.2 Polish E1–E13);
  - the WP-04 Part 2 spec (NE1–NE20) and ledger (NP1–NP20, NPF1–NPF15, WP-04.2 E1–E22);
  - the WP-04 Part 1 spec and ledger (IN42–IN51, IPF20);
  - the WP-01 spec §4;
  - every earlier spec and ledger;
  - `docs/deliverables/*.md`.

**Branch:** `feat/wp-04-part2-followups` in `.claude/worktrees/wp-04-part2-followups`, from `8466f03` (the PR 1 head). `npm ci` is done, and `.obsidian-cache/` was copied from the polish worktree. At the end the branch is fast-forward-pushed onto `feat/wp-01-codebase-city` only; `feat/wp-04-part2-followups` itself is never pushed.

**Before Task 1:** the controller runs the pre-flight scan:
- re-measures every line count below with `wc -l`;
- greps every "Consumes" name;
- checks each pair of tasks for Produces ↔ Consumes consistency;
- records the scan as a table in the ledger (FQ rulings).

## Global Constraints

**Binding (owner):**
- the WP-01 spec §4 frozen contracts, every spec and ledger, and `docs/deliverables/*.md`;
- line caps: **400** for `src/**/*.{ts,vue}`, **450** for tests, including `tests/e2e/**` and `tests/support/**`. A file that would pass its cap is split, never compressed;
- `tests/e2e/inspector.ts` is at exactly **400**. A new shared step goes in a new `tests/e2e/inspector-<concern>.ts` (NP2);
- the city-view budget: `city-view.ts` and `CityWorkspace.vue` ≤ 360, and `CityViewport.vue` is never edited;
- layering: only `src/adapters/filesystem/node-access.ts` may `window.require` `fs`, and `src/ui/**` never imports adapters or host;
- copy lives only in `src/ui/audit-copy`;
- CRLF files are edited only with Edit/Write, never `sed`, heredocs or scripts. The two evidence notes (`2026-09-17-wp01-gate-evidence.md`, `2026-09-17-wp01-implementation-report.md`) are CRLF, so check them for bare LF after editing;
- explicit timeouts on slow work;
- `npm run analyze` stays at **9**: a new dead export is removed, never baselined;
- **never run `git stash` in any form.** RED is shown by a temporary Edit that is reverted, or by a WIP commit restored with `git checkout HEAD -- <paths>`;
- **tests are written and run RED before the code.** A RED rebuilt after the code is written is not accepted (polish E1, E2);
- every commit message ends with the literal trailer **"Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"**, whatever model runs;
- worktree-isolated sessions refuse shell commands that compute a program name at runtime, so run plain, separate commands.

**TypeScript and lint** (house rules carried from earlier plans):
- ES2020 `lib` only: no `.at()`, `Object.hasOwn`, `replaceAll` or `findLast`;
- oxlint `--deny-warnings`, with `consistent-function-scoping`;
- `Array.from(set)`, never `[...set]`;
- PF1 timers, PF2 no no-op closures, PF14 arrow-function store members;
- no redundant `as`, and no `undefined` assigned to an optional property.

**Native discipline** (IN42–IN51, NE1–NE8, PN7, FN4):
- **Sessions:** one `test` fixture session per test, `retry: 0`, and `expect.poll` for every wait (never a sleep, never `browser.pause`). A fresh vault per test, with teardown guaranteed by the fixture.
- **Words:**
  - Never match Obsidian's own UI text (IPF20; the locale is German).
  - The plugin's words come only through constants imported from `src/ui/audit-copy/**`, `src/ui/inspector-copy.ts`, `ROUTE_META` (`src/ui/routes.ts`, E6) or the owning module (E7).
- **Imports:** native files never import `tests/fixtures/**` or `tests/mocks/**` (IP56). They may import `src/application/**` and the copy modules.
- **Settings:** they open in a separate window (NPF7). `executeObsidian` runs only outside it.
- **Refusals:** a refused command run by id does not throw (NPF13). Assert `commandAvailable(...) === false` and the absence of any effect.
- **Controls and RED:** every probe and every negative assertion has a positive control in the same test. Every new or changed scenario is shown RED once (IPF5), either on 8466f03 for a bug or under the named mutation (built, run, reverted, never committed), except those FP4 lists as green-only. The RED output goes in the task report.
- **The gate:** each task appends its new titles to `tests/e2e/required-scenarios.json`, exactly as spec §5 writes them.
- **Timeouts (NP5, PP5):**
  - `300_000` for an app restart or fallow;
  - `240_000` for a synthetic-tree scan;
  - the config's `120_000` otherwise.
- **Settings text fields** are edited with click, Ctrl+A, `addValue`, then a click on the page title (E2), never `setValue`.
- **City commands:** every step that runs a city-view command calls `activateCity()` first (E3).
- **`FALLOW_BIN`:** native runs set it as a pure-backslash path (E10): `Join-Path $env:LOCALAPPDATA 'npm-cache\_npx\ee3f2ca80543beb5\node_modules\@fallow-cli\win32-x64-msvc\fallow.exe'`. No `fallow.exe` may be running.
- **No retries.** A native failure is diagnosed and ruled, never re-run to green.

**Running native tests while developing (NP4):**
- After each `src` change: `npm run build`.
- One file: `node node_modules/vitest/vitest.mjs run --config tests/e2e/vitest.config.mts tests/e2e/<file>.e2e.ts`.
- One test: add `-t "<title>"`.
- Acceptance is always `npm run test:e2e`.

**Per-task gate** (each as its own foreground command):
- `npm run typecheck`
- `npm run lint:fast`
- `npx eslint <touched src and test files> --max-warnings 0`
- `npx vitest run <the task's fast test files and every existing fast test file the task edits>`
- for a task with native changes, the touched native file(s) through the NP4 command.

`tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` may fail on file counts until Task 5. Do not "fix" them early, and do not run the full suite per task. The controller runs it after Task 2, the last `src` task.

**Commits:** after each task, commit only its own files, never the ledger:

```
git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Process:**
- Implementers and reviewers never spawn subagents, and reviewers are read-only.
- Implementers report every file changed with its line count, the gate output, the RED and GREEN output, and every deviation from this plan.
- **Every `npm run test` or `npm run verify` an implementer runs is reported with its Z38 outcome:** pass with figures, fail with figures, or load-skip with the control's figure (after Task 3).

**Size now** (at 8466f03; re-measured at pre-flight):

| Kind | File | Lines |
|---|---|---|
| src | `src/host/settings-tab.ts` | 388 |
| src | `src/host/investigation-notes.ts` | 295 |
| src | `src/host/scan-flow.ts` | 228 (mutation target only) |
| fast tests | `tests/component/settings-tab-focus.test.ts` | 203 |
| fast tests | `tests/component/settings-tab.test.ts` | **437**: never grown |
| fast tests | `tests/mocks/obsidian.ts` | 395 |
| fast tests | `tests/fixtures/fake-vault.ts` | 391 |
| fast tests | `tests/unit/fake-vault.test.ts` | 305 |
| fast tests | `tests/host/investigation-notes-alias.test.ts` | 198 |
| fast tests | `tests/host/city-view-scan-modes.test.ts` | 275 |
| fast tests | `tests/integration/fallow-no-freeze.test.ts` | 35 |
| config | `vitest.config.ts` | 87 (not edited) |
| native | `tests/e2e/inspector.ts` | **400**: never grown |
| native | `tests/e2e/host-probes.ts` | 180 |
| native | `tests/e2e/workspace-files.ts` | 110 |
| native | `tests/e2e/plugin-lifecycle.e2e.ts` | 240 |
| native | `tests/e2e/settings.e2e.ts` | 216 |
| native | `tests/e2e/commands.e2e.ts` | 210 |
| native | `tests/e2e/preview.e2e.ts` | 193 |
| native | `tests/e2e/investigation.e2e.ts` | 166 |
| evidence | `tests/unit/gate-evidence.test.ts` | 337 |
| evidence | `tests/unit/evidence-numbers.test.ts` | 404 |

## Review Focus

1. **The render wait (FN1).**
   - `request()` keeps every PN4, E3 and E12 rule:
     - it renders at once when no field is focused;
     - it waits while one is;
     - it releases only when focus leaves the page's controls with the document focused;
     - it re-checks on release.
   - At most one `focusout` listener is ever attached (FU1).
   - `hidden()` releases a waiting render exactly once, after a microtask, and does nothing when none waits.
   - The tab's `hide()` calls `super.hide()`.
   - A deferred render's throw reaches `showFailure`, never an unhandled rejection or error.
   - `refreshSoon()`'s coalescing is unchanged.
2. **Scenario 41.**
   - It is RED on 8466f03, and its control proves that the render waited before the close.
   - It closes the window the way a person does, not through `setting.close()`.
3. **The Z38 guard (FN2).**
   - The 50 ms assertion is unchanged, and it runs whenever the control is under 35 ms.
   - A freeze on an idle machine still fails; it is never skipped.
   - The skip names the control's figure, and the test is still collected exactly once, in `node-serial`.
4. **The minors.**
   - Each RED-provable one (FM1, FM3, FM5, FM7, FM9, FM10, FM14) has its RED on record.
   - Each behaviour-neutral one changes no assertion's meaning.
   - No required title changes.
5. **Native honesty.**
   - No Obsidian text is matched.
   - Every new or changed scenario has its RED on record (or FP4's green-only ruling), and every negative assertion its positive control.

---

### Task 1: One Settings render wait, which `hide()` releases (FU1, FU2, FM8, FM9, scenario 41)

**Files:**
- Create:
  - `src/host/settings-render-wait.ts`;
  - `tests/component/settings-render-wait.test.ts`.
- Modify:
  - `src/host/settings-tab.ts` (the wait moves out; `hide()`; the FM8 comments);
  - `tests/component/settings-tab-focus.test.ts` (`moveFocus`; the tab-level E13 and `hide()` cases);
  - `tests/e2e/settings.e2e.ts` (scenario 41);
  - `tests/e2e/required-scenarios.json`.

**Interfaces:**
- Consumes:
  - `CodebaseInspectorSettingTab.refresh()`, and `renderWhenIdle()`, `renderPendingIn`, `isElementIn` and `isEditingIn` (`settings-tab.ts:35–45`, `:58–59`, `:124`, `:138–155`);
  - `SettingTab.hide()` (`obsidian.d.ts:6648`; the mock's `hide()` at `tests/mocks/obsidian.ts:172`);
  - the focus test's helpers (`settings-tab-focus.test.ts:50–54` and its tab builder);
  - scenario 38's helpers in `settings.e2e.ts:24–58` (`switchToMainWindow`, `writeNotesFolderElsewhere`, `tabNotesFolder`);
  - `openPluginSettings` and `closeSettings` (`host-probes.ts:100–121`);
  - `inspector.openCodebaseSettings`, `settingsRow` and `settingsPage`.
- Produces:
  - `createRenderWait(doc: () => Document, render: () => void, onError: (e: unknown) => void): RenderWait`, where `RenderWait` is `{ request(): void; hidden(): void }`;
  - the tab's `override hide()`;
  - scenario 41.

- [ ] **Step 1: RED, fast, on the unchanged `src`.** In `tests/component/settings-tab-focus.test.ts`:
  1. **E13:** spy on `document.addEventListener` and `document.removeEventListener`, counting `focusout` listeners attached minus removed. Then:
     - focus a field and `await tab.refresh()` (a wait, 1 listener);
     - with `document.hasFocus` mocked false (as the case at `:162` does; the file's `beforeEach` mocks it true), blur the field. jsdom's `blur()` fires a `focusout` with no `relatedTarget`, so the listener returns early and stays (`settings-tab.ts:148`). Then mock `hasFocus` true again;
     - `await tab.refresh()` (the immediate branch renders);
     - focus a field and `await tab.refresh()` again (a second wait).

     Expect at most 1 attached `focusout` listener at every point. **Expected RED:** 2 after the second wait.
  2. **E7:** focus a field, `await tab.refresh()` (a wait, `update` not called), then `tab.hide()` and `await Promise.resolve()`. Expect `update` called exactly once and 0 attached listeners.
     - **Control:** `tab.hide()` with no wait leaves `update` uncalled.
     - **Expected RED:** `update` is never called.

  Run `npx vitest run tests/component/settings-tab-focus.test.ts`, and record both REDs.
- [ ] **Step 2: Native RED, before any `src` change.** Add scenario 41 to `tests/e2e/settings.e2e.ts`, with this exact title: `a setting being typed when the settings window closes shows the write made elsewhere once the settings reopen`. Reuse scenario 38's helpers.
  1. Copy the project, `openCity`, `scanFolder('code')`, and read the profile.
  2. `openCodebaseSettings(profile.name)`; the handle is `settingsWindow`. Click Excluded paths, press Ctrl+End, and `addValue('\nfirst-half')`.
  3. `switchToMainWindow`, then `writeNotesFolderElsewhere(…, 'Research/elsewhere')`. Poll `pluginData` for the write, and poll `tabNotesFolder` until it shows it.
  4. `switchToWindow(settingsWindow)`. **Positive control:** the notes folder field (`settingsRow(NOTES_FOLDER_SETTING_NAME).$('input').getValue()`) still reads `defaultNoteFolder(profile.name)`, so the render waited. Read values only; never click or focus anything.
  5. `await browser.closeWindow()`, the person's close of the settings window. Switch to the window that holds the app (reuse `switchToMainWindow` with the closed handle), and poll until no window shows the settings (as `closeSettings` does; export a small `settingsGone(browser)` from `host-probes.ts` only if needed).
  6. `openCodebaseSettings(profile.name)` and expect the notes folder field to read `'Research/elsewhere'`. Then `closeSettings`.

  Run `npm run build`, then the NP4 command with `-t "<title>"`, on the unchanged `src`. **Expected RED:** step 6 reads the default folder. Record the output.
  - **If step 4's control fails** (the field already shows the write, so no wait was armed), stop and report: the scenario is not discriminating.
  - **If step 6 is already green on 8466f03**, stop and report. Neither the fix nor the scenario lands unreviewed (as PP6).
- [ ] **Step 3: GREEN.** Create `src/host/settings-render-wait.ts`:
  - `isElementIn` and `isEditingIn` move here verbatim, with their comments, and stay unexported.
  - `createRenderWait(doc, render, onError)` holds `let pending: { doc: Document; listener: (event: FocusEvent) => void } | null = null` and a local `drop()` that removes `pending`'s listener and clears it.
  - `request()` keeps `renderWhenIdle()`'s logic and its comment block (PN4, E3, E12), adding FU1:
    - **Nothing focused:** `drop()`, then `render()`, which throws to the caller as today.
    - **The same document already waits:** return.
    - **Otherwise:** `drop()`, then attach the listener. It keeps `:148`'s early return, then `drop()`, then re-runs `request()` inside `try`, passing a throw to `onError`.
  - `hidden()`: if `pending` is null, return. Otherwise `drop()`, then `queueMicrotask(() => { try { render(); } catch (e) { onError(e); } })`. A comment cites FU2 and why a microtask (spec FN1).

  In `settings-tab.ts`:
  - `renderWhenIdle`, `renderPendingIn` and the two helpers go.
  - `refresh()` ends in `this.renderWait.request()`. Keep its PN4 note, pointing at the module.
  - Add a field: `private readonly renderWait = createRenderWait(() => this.containerEl.ownerDocument, () => { this.update(); }, (e) => { this.showFailure(e); });`. It is a field initialiser, so check that `containerEl` is read lazily (it is, through the closure).
  - Add `override hide(): void { super.hide(); this.renderWait.hidden(); }`, with a one-line comment citing FU2.

  Run Step 1's cases GREEN, and all of `settings-tab-focus.test.ts`, `settings-tab.test.ts` and `settings-tab-refresh-soon.test.ts`.
- [ ] **Step 4: The module's own tests, FM9 and FM8.**
  - Create `tests/component/settings-render-wait.test.ts` (jsdom) over `createRenderWait` with a `vi.fn()` render and `onError`:
    - renders at once with nothing focused;
    - waits while a field is focused, then releases once on `focusout` to outside with the document focused;
    - holds at most one listener across wait, immediate render and wait (FU1);
    - `hidden()` renders once after a microtask and removes the listener; `hidden()` without a wait does nothing;
    - a throw in a deferred render reaches `onError`;
    - **FM9 re-arm:** arm on `document`, then point the `doc` getter at an iframe's `contentDocument` (`vi.spyOn(other, 'hasFocus').mockReturnValue(true)`), focus a field there and `request()`. The wait arms on the new document, and a `focusout` there renders once. A late `focusout` from the old document adds nothing.

    Prove the re-arm case RED under the temporary mutation "return when any wait is pending", in place of the same-document check. Record it and revert.
  - **FM9:** `moveFocus` in `settings-tab-focus.test.ts` only moves focus (`to === null ? from.blur() : to.focus()`): jsdom's `focus()`/`blur()` already fire `focusout`. The deliberate stray dispatches stay. All cases stay green.
  - **FM8:** the three "back in the field" comments (`settings-tab.ts:264–265`, `:277–279`, `:300–301`) add "once focus leaves the settings' fields (the render wait)".
- [ ] **Step 5: Native GREEN.** `npm run build`, then with the NP4 command:
  - scenario 41;
  - all of `settings.e2e.ts` (scenario 38 in particular);
  - `commands.e2e.ts -t "scan-codebase after a Reconnect"`: scenario 39 drives Settings Connect and Clear binding (polish PQ-R1).

  Append scenario 41's title to `required-scenarios.json`.
- [ ] **Step 6: Gate and commit.** Subject: `fix(settings): a render waiting when the settings window closes runs on hide(), and the wait holds one focusout listener (WP-04.2 E7, E13, follow-ups)`.

---

### Task 2: The fast-suite minors (FM1, FM2, FM3, FM7)

**Files:**
- Modify:
  - `tests/fixtures/fake-vault.ts` and `tests/unit/fake-vault.test.ts` (FM1);
  - `src/host/investigation-notes.ts` (FM2);
  - `tests/host/investigation-notes-alias.test.ts` (FM3);
  - `tests/host/city-view-scan-modes.test.ts` (FM7).

**Interfaces:**
- Consumes:
  - `reconcileFolder` (`fake-vault.ts:204–217`), `diskOnly`, and the fake's `vaultEvents`;
  - `type RealPath` and `type Memo` (`investigation-notes.ts:35–38`);
  - the alias test's `it.each` (`:97–109`) and the polish plan's T8 mutation;
  - `silentRefresh` and `waitForModal` (`city-view-scan-modes.test.ts:216–224`, `:43–50`), and `runRefresh`'s check (`scan-flow.ts:206`).
- Produces:
  - the fake fires `create` for a reconciled folder;
  - `type Memo = RealPath`;
  - a third, relation-free resolver row;
  - `silentRefresh` fails as an assertion.

- [ ] **Step 1 (FM1): RED, then GREEN.** In `tests/unit/fake-vault.test.ts`: `vault.on('create', (f) => paths.push(f.path))`, then `diskOnly('a', 'folder')`, then `createFolder('a/b')`, and expect `['a', 'a/b']`. **Expected RED:** `['a/b']`. Then add `vaultEvents.trigger('create', folder)` in `reconcileFolder`, after the parent is linked, and run GREEN. Also run every fast file that uses `createFakeVault` (`grep -rln createFakeVault tests`).
- [ ] **Step 2 (FM3): RED, then keep.** Add the row `['resolves each path to an unrelated folder of its own', (path: string): string | null => \`/unrelated/${path.split('/').join('_')}\`]` to the `it.each` at `:97–99`, and relabel the existing `/unrelated${path}` row as relation-preserving. It passes on the unchanged `src`. Then apply the polish plan's T8 mutation ("`sourceNotePath` compares only the resolved pair, skipping the textual answer") as a temporary Edit. **Expected RED:** the new row fails, and the relation-preserving row still passes. Record it and revert.
- [ ] **Step 3 (FM7): RED, then GREEN.** First apply the temporary mutation `if (boundRoot !== null)` at `scan-flow.ts:206`, run the file, and record today's failure shape (a 5 000 ms timeout). Revert. Then rewrite `silentRefresh`:

```ts
let settled = false;
const run = view.startScan().finally(() => { settled = true; });
for (let i = 0; i < 50 && !settled && document.querySelector('.modal-container') === null; i += 1) await Promise.resolve();
expect(document.querySelector('.modal-container')).toBeNull();
await run;
```

  Re-apply the mutation. **Expected:** it now fails at the `toBeNull` assertion within milliseconds. Record it, revert, and run GREEN.
- [ ] **Step 4 (FM2):** `type Memo = RealPath;`, keeping its doc comment. Run typecheck and `investigation-notes*.test.ts`.
- [ ] **Step 5: Gate and commit.** Subject: `test(minors): the fake vault announces a reconciled folder, T8 gets a relation-free resolver, silentRefresh fails as an assertion, Memo is RealPath (WP-04.2 follow-ups)`.

**After Task 2**, the controller runs `npm run test` once (the last `src` task) and records it with its Z38 outcome.

---

### Task 3: The Z38 load guard and the config pin (FU3, O1, FM10)

**Files:**
- Modify: `tests/integration/fallow-no-freeze.test.ts`.
- Create: `tests/build/vitest-projects.test.ts`.

**Interfaces:**
- Consumes:
  - the no-freeze case (`fallow-no-freeze.test.ts:14–35`) and its sampler;
  - Vitest's test context `skip(note?)` (`node_modules/vitest/dist/chunks/plugin.d.CN87HSxv.d.ts:356`: "A custom note passed down to `ctx.skip(note)`", which pre-flight confirms);
  - the default export of `vitest.config.ts` (`test.projects`).
- Produces:
  - `LOADED_CONTROL_MS = 35` and the control phase;
  - the config pin.

- [ ] **Step 1: RED under load, before the guard.** Write a scratch burner script outside the repo that starts one `node -e "for(;;){}"` per logical CPU and kills them on exit, with an explicit 10-minute cap. Run `npx vitest run --project node-serial` with the burner running, on the unchanged file. **Expected:** Z38 fails, or passes, with its figures; record whichever happens. Then run it once idle and record that too.
- [ ] **Step 2: The guard.** In the case, take the context (`async (ctx) => …`). Before the modes:
  1. Sample 2 s with the same 10 ms `setInterval` sampler and no child.
  2. Print `[no-freeze] control: largest event-loop gap N ms` through `process.stdout.write`.
  3. `if (N >= LOADED_CONTROL_MS) ctx.skip(\`machine loaded: the bare control's largest gap was ${N} ms (>= ${LOADED_CONTROL_MS} ms), so the 50 ms budget cannot be measured\`)`.

  Rules for the edit:
  - `LOADED_CONTROL_MS` is a module constant, with a comment citing O1, spec §3.3 and the measured figures (idle or real pre-run controls ≤ 25.6 ms; burn pre-run controls 38.4 to 50.9 ms).
  - The modes loop, `expect(...).toBeLessThan(50)`, the timeout (raise it by the control's 2 s, to `62_000`) and the file header are otherwise unchanged. The header gains one line on the guard.
  - Extract the sampler into a tiny local function only if the control and the modes would otherwise duplicate it.
- [ ] **Step 3: The guard's proofs.**
  - **Idle:** the case runs and passes, and the control line prints.
  - **Burner running:** the case is reported **skipped**, and the control figure is ≥ 35 in the output. If the control stays under 35 with the burner running, report the figures; do not tune the threshold (it is the owner's O1).
  - **A freeze still fails on an idle machine:** add a temporary synchronous 80 ms busy-wait inside the runner's stdout `data` handler in `src/adapters/fallow/fallow-runner.ts`. Run idle. **Expected:** the case runs (the control is under 35) and fails the 50 ms assertion. Record it, then revert and confirm `git diff src` is empty.
- [ ] **Step 4 (FM10): the config pin, RED first.** Create `tests/build/vitest-projects.test.ts`, which imports `vitest.config.ts`'s default export and asserts:
  - exactly one project, `node-serial`, has `include` equal to `['tests/integration/fallow-no-freeze.test.ts']`;
  - its `sequence.groupOrder` is greater than every other project's;
  - the `node` project's `exclude` contains the file.

  Show it RED under two temporary edits of `vitest.config.ts`: `groupOrder: 0`, and the exclude removed. Record both and revert (`git diff vitest.config.ts` is empty).
- [ ] **Step 5: Gate and commit.** The gate runs `npx vitest run tests/build/vitest-projects.test.ts` and `npx vitest run --project node-serial`, with the Z38 outcome reported. Subject: `test(z38): the no-freeze case skips with its figure when a bare control shows the machine loaded, and a pin keeps it alone in node-serial (WP-04.2 follow-ups O1)`.

---

### Task 4: The native minors (FM4, FM5, FM6, FM11, FM12, FM13, FM14)

**Files:**
- Create: `tests/e2e/inspector-binding.ts`.
- Modify:
  - `tests/e2e/commands.e2e.ts` (FM4, FM5, FM6);
  - `tests/e2e/preview.e2e.ts` (FM6, FM13);
  - `tests/e2e/plugin-lifecycle.e2e.ts` (FM11, FM14);
  - `tests/e2e/workspace-files.ts` (FM12, FM13, FM14);
  - `tests/e2e/investigation.e2e.ts` (FM13).

**Interfaces:**
- Consumes:
  - `clearBinding` (`commands.e2e.ts:41–51`) and its inline copy (`preview.e2e.ts:116–125`);
  - scenario 39 (`commands.e2e.ts:153–209`), `commandAvailable`, `savedBindings` and `pluginData`;
  - `hashTree` and `projectFilePaths` (`workspace-files.ts:27–36`, `:49–58`);
  - `writeReport(…, edit)` (`workspace-files.ts:~105`);
  - `cycleFinding` and `recordingFindings` (`workspace-files.ts:~69–73`);
  - `SECOND_FINDING` (`plugin-lifecycle.e2e.ts:35–37`, used at `:195` and `:237`);
  - `ProbeWindow` and the `_` casts (`plugin-lifecycle.e2e.ts:26`, `:97`, `:101`).
- Produces:
  - `clearBinding(browser, inspector)` exported from `inspector-binding.ts`;
  - a typed `writeReport` edit;
  - `unusedExportFinding(): string`;
  - one private `walk`.

- [ ] **Step 1 (FM5): RED, then GREEN.** In scenario 39:
  - move `expect(offered.endsWith(copy)).toBe(true)` to directly after `offered` is read;
  - in the cancel step, read `pluginData` once, assert `onlyProfile` and `savedBindings` both equal their `reconnected` values, and assert `commandAvailable(browser, 'cancel-scan')` is false.

  Apply the temporary mutation `resolvedRoot: storedScope.rootPath` at `scan-flow.ts:207`, `npm run build`, and run the scenario. **Expected RED:** it fails at the moved assertion, before any approval. Record it, revert, rebuild, and run GREEN.
- [ ] **Step 2 (FM14): derived, then the T4 RED.** Add `unusedExportFinding()` beside `cycleFinding` in `workspace-files.ts`. It returns the id of the recording's finding with category `'unused-exports'` on `src/barrel/x.ts`, and throws if there is none. Scenario 2 uses it in place of `SECOND_FINDING`. Then re-run polish T4's recorded mutation, "the save-dismissal handler skips its save" (`FindingReviewDialog.vue`). **Expected RED:** scenario 2 fails on the dismissed disposition. Record it, revert, rebuild, and run GREEN.
- [ ] **Step 3: The behaviour-neutral changes.**
  - **FM6:** move `clearBinding` verbatim to `inspector-binding.ts`, with its doc comment and preview's "Observed" note. `commands.e2e.ts` and `preview.e2e.ts` call it.
  - **FM4:** "rows 5–7 and 39" at `commands.e2e.ts:1` and `:53`.
  - **FM11:** one `type EventsTable = { _: Record<string, unknown> }` beside `ProbeWindow`, used at both casts.
  - **FM12:** one private `walk(root, onFile, onDir?)` used by `hashTree` and `projectFilePaths`, with identical outputs.
  - **FM13:** type the recording's `check.unused_exports` entries once in `workspace-files.ts`, as `{ path: string; export_name: string } & Record<string, unknown>`. `writeReport`'s `edit` receives that type, with the one cast inside `writeReport`. `investigation.e2e.ts:140`/`:143` and `preview.e2e.ts:164` drop their casts.
- [ ] **Step 4: Native GREEN.** Run all of `commands.e2e.ts`, `preview.e2e.ts`, `plugin-lifecycle.e2e.ts` and `investigation.e2e.ts` through the NP4 command, with `FALLOW_BIN` set. Also grep `tests/e2e` for `SECOND_FINDING` and for `as unknown as { _:`, and expect none.
- [ ] **Step 5: Gate and commit.** Subject: `test(native): scenario 39 checks the offered root at once and the cancel's bindings, clearBinding is shared, and scenario 2 derives its second finding (WP-04.2 follow-ups)`.

---

### Task 5: Evidence and verification

**Files:**
- Modify:
  - `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` (CRLF; the G8 table and the native count);
  - `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md` (CRLF; the mirror);
  - `docs/deliverables/Test Evidence.md` (native 40 → 41, and one sentence on the Z38 guard);
  - `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts`, only where they pin a count.

**Interfaces:**
- Consumes: every earlier task, and the controller's post-Task-2 `npm run test` record.
- Produces: refreshed counts, and the verification record for the ledger.

- [ ] **Step 1:** Run `npm run test`. Take the G8 figures from a run in which the no-freeze case **executed** (spec §6). A load-skipped run is reported with its control figure and does not supply G8. Refresh the counts once, with Edit/Write only, and check both CRLF notes for bare LF (`grep -c $'[^\r]$'` on each changed line range, or an equivalent check you report).
- [ ] **Step 2:** `npm run verify` must exit 0. Report every run with its Z38 outcome.
- [ ] **Step 3:** Run `npm run test:e2e` on 1.13.4. **Expected:** "Verified N executed native Vitest cases, including all 41 required scenarios." Then run it once with `OBSIDIAN_VERSION=latest`, recording the resolved version, with `FALLOW_BIN` set (E10) and no `fallow.exe` running. A failure is reported, never retried.
- [ ] **Step 4:** `npm run test:fallow` with the same `FALLOW_BIN`, and `npm run analyze` (expect 9).
- [ ] **Step 5:** `npm run harness-shot`. Look at the `wp02-settings-*` captures and report what they show.
- [ ] **Step 6: Commit.** Subject: `docs(evidence): WP-04 Part 2 follow-ups test counts, 41 required native scenarios and the Z38 guard`.

The controller transcribes the execution rulings into the ledger in its own commit, after the final review.
