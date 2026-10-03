# WP-04 Part 2 polish pass: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the WP-04 Part 2 follow-ups and deferred minors, and apply the owner decisions O1–O4, without widening scope. The native gate grows from 36 to 40 required scenarios.

**Architecture:**
- No new layer and no new module in `src`.
- **The `src` changes:**
  - `ensureFolders` in `src/host/investigation-notes.ts` (Task 1);
  - the alias resolver and its callers in `node-access.ts` and `investigation-notes.ts` (Task 2);
  - `runRefresh`, `CityViewDeps` and `main.ts` for E14 (Task 3);
  - `settings-tab.ts` (Task 4);
  - one CSS rule (Task 5).
- **Tests:** everything else is test code (`tests/e2e/**`, fast tests, one fake), `vitest.config.ts` and the evidence documents.

**Tech Stack:**
- Code: TypeScript 6.0.3, Vue 3.5.43, Vitest 5.0.1 (+ @vue/test-utils 2.5.1), Node 24.
- Native: WebdriverIO 9.32.0 and `wdio-obsidian-service` 3.2.1, on Obsidian 1.13.4 (baseline) and `latest` once.
- fallow 3.27.0, only through `FALLOW_BIN`.

**Spec:** `docs/superpowers/specs/2026-09-26-wp04-part2-polish-design.md`. It holds the inventory P1–P8 and T1–T10, the owner decisions O1–O4, the design decisions PN1–PN7, and scenarios 37–40 (§5).
- **Rulings:** `docs/superpowers/notes/2026-09-26-wp04-part2-polish-ledger.md`. Planning rulings are **PP1…**, pre-flight rulings **PQ1…**, and execution rulings **"WP-04.2 Polish E1…"**.
- **Also binding:**
  - the WP-04 Part 2 spec (NE1–NE20) and ledger (O1–O4, NP1–NP20, NPF1–NPF15, WP-04.2 E1–E22);
  - the WP-04 Part 1 spec and ledger (IN42–IN51, IPF20);
  - the WP-01 spec §4;
  - every earlier spec and ledger;
  - `docs/deliverables/*.md`.

**Branch:** `feat/wp-04-part2-polish` in `.claude/worktrees/wp-04-part2-polish`, from `9644c08` (the PR 1 head). `npm ci` is done, and `.obsidian-cache/` was copied from the Part 2 worktree. At the end the branch is fast-forward-pushed onto `feat/wp-01-codebase-city` only; `feat/wp-04-part2-polish` itself is never pushed.

**Before Task 1:** the controller runs the pre-flight scan:
- re-measures every line count below with `wc -l`;
- greps every "Consumes" name;
- checks each pair of tasks for Produces ↔ Consumes consistency;
- records the scan as a table in the ledger (PQ rulings).

## Global Constraints

**Binding (owner):**
- the WP-01 spec §4 frozen contracts, every spec and ledger, and `docs/deliverables/*.md`;
- line caps: **400** for `src/**/*.{ts,vue}`, **450** for tests, including `tests/e2e/**` and `tests/support/**`. A file that would pass its cap is split, never compressed;
- the city-view budget: `city-view.ts` and `CityWorkspace.vue` ≤ 360, and `CityViewport.vue` is never edited;
- layering: only `src/adapters/filesystem/node-access.ts` may `window.require` `fs`, and `src/ui/**` never imports adapters or host;
- copy lives only in `src/ui/audit-copy`;
- CRLF files are edited only with Edit/Write, never `sed`, heredocs or scripts. The two evidence notes (`2026-09-17-wp01-gate-evidence.md`, `2026-09-17-wp01-implementation-report.md`) are CRLF;
- explicit timeouts on slow work;
- `npm run analyze` stays at **9**: a new dead export is removed, never baselined;
- **never `git stash`**. RED is shown by a temporary Edit that is reverted, or by a WIP commit restored with `git checkout HEAD -- <paths>`;
- every commit message ends with the literal trailer **"Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"**, whatever model runs;
- worktree-isolated sessions refuse shell commands that compute a program name at runtime, so run plain, separate commands.

**TypeScript and lint** (house rules carried from earlier plans):
- ES2020 `lib` only: no `.at()`, `Object.hasOwn`, `replaceAll` or `findLast`;
- oxlint `--deny-warnings`, with `consistent-function-scoping`;
- `Array.from(set)`, never `[...set]`;
- PF1 timers, PF2 no no-op closures, PF14 arrow-function store members;
- no redundant `as`, and no `undefined` assigned to an optional property.

**Native discipline** (IN42–IN51, NE1–NE8, PN7):
- **Sessions:** one `test` fixture session per test, `retry: 0`, `expect.poll` for every wait (never a sleep, never `browser.pause`), and teardown by the fixture.
- **Words:**
  - Never match Obsidian's own UI text (IPF20; the locale is German).
  - The plugin's words come only through constants imported from `src/ui/audit-copy/**`, `src/ui/inspector-copy.ts`, `ROUTE_META` (`src/ui/routes.ts`, E6) or the owning module (E7).
- **Imports:** native files never import `tests/fixtures/**` or `tests/mocks/**` (IP56). They may import `src/application/**` and the copy modules.
- **Settings:** they open in a separate window (NPF7). `executeObsidian` runs only outside it, so switch back with `closeSettings` first.
- **Refusals:** a refused command run by id does not throw (NPF13). Assert `commandAvailable(...) === false` and the absence of any effect.
- **Controls and RED:** every probe and every negative assertion has a positive control in the same test. Every new or changed scenario is shown RED once (IPF5), either on 9644c08 for a bug or under the named mutation (built, run, reverted, never committed), and the RED output goes in the task report.
- **The gate:** each task appends its new titles to `tests/e2e/required-scenarios.json`, exactly as spec §5 writes them.
- **Timeouts (NP5, PP5):**
  - `300_000` for an app restart or fallow;
  - `240_000` for a synthetic-tree scan;
  - the config's `120_000` otherwise; a plugin reload is not a restart.
- **Settings text fields** are edited with click, Ctrl+A, `addValue`, then a click on the page title (E2), never `setValue`.
- **City commands:** every step that runs a city-view command calls `activateCity()` first (E3).

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

`tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` may fail on file counts until Task 9. Do not "fix" them early, and do not run the full suite per task.

**Commits:** after each task, commit only its own files, never the ledger:

```
git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Process:**
- Implementers and reviewers never spawn subagents, and reviewers are read-only.
- Implementers report every file changed with its line count, the gate output, the RED and GREEN output, and every deviation from this plan.

**Size now** (at 9644c08; re-measured at pre-flight):

| Kind | File | Lines |
|---|---|---|
| src | `src/host/investigation-notes.ts` | 252 |
| src | `src/adapters/filesystem/node-access.ts` | 42 |
| src | `src/host/investigation-services.ts` | 51 |
| src | `src/host/scan-flow.ts` | 210 |
| src | `src/host/city-scan-controller.ts` | 168 |
| src | `src/main.ts` | 138 |
| src | `src/host/settings-tab.ts` | 341 |
| src | `src/ui/styles/shell.css` | 130 (no cap) |
| fast tests | `tests/fixtures/fake-vault.ts` | 345 |
| fast tests | `tests/fixtures/data-port-deps.ts` | 30 |
| fast tests | `tests/host/investigation-notes-alias.test.ts` | 148 |
| fast tests | `tests/host/investigation-ports.test.ts` | 176 |
| fast tests | `tests/host/investigation-notes.test.ts` | **440**: never grown; new cases go in new files |
| fast tests | `tests/host/city-view-scan-modes.test.ts` | 179 |
| fast tests | `tests/component/settings-tab-refresh-soon.test.ts` | 77 |
| fast tests | `tests/component/settings-tab.test.ts` | **437**: never grown |
| fast tests | `tests/unit/leaf-chrome.test.ts` | 44 |
| fast tests | `tests/integration/fallow-analysis.test.ts` | 287 |
| fast tests | `tests/mocks/obsidian.ts` | 385 |
| config | `vitest.config.ts` | 70 |
| native | `tests/e2e/inspector.ts` | **397** |
| native | `tests/e2e/host-probes.ts` | 179 |
| native | `tests/e2e/workspace-files.ts` | 91 |
| native | `tests/e2e/plugin-lifecycle.e2e.ts` | 217 |
| native | `tests/e2e/settings.e2e.ts` | 146 |
| native | `tests/e2e/commands.e2e.ts` | 132 |
| native | `tests/e2e/notes-root.e2e.ts` | 116 |
| native | `tests/e2e/notes-index.e2e.ts` | 105 |
| native | `tests/e2e/preview.e2e.ts` | 191 |
| native | `tests/e2e/investigation.e2e.ts` | 125 |
| native | `tests/e2e/smoke.e2e.ts` | 32 |
| evidence | `tests/unit/gate-evidence.test.ts` | 337 |
| evidence | `tests/unit/evidence-numbers.test.ts` | 404 |

- **`inspector.ts` stays ≤ 400 (NP2).** A new shared step that would push it past 400 goes into a new `tests/e2e/inspector-<concern>.ts` module, spread into `createInspectorPage` the way `inspector-fallow.ts` is. A step used by one scenario stays in that scenario's file.

## Review Focus

1. **E14 consent (PN5).**
   - Scanning the bound root always requires the scope modal's approval, and no approval is self-minted for it.
   - A cancel leaves the snapshot, profile, binding and exclusions untouched.
   - An unbound profile, or one bound to the snapshot's own root (compared by `sameRoot`, case-insensitively off Linux), still refreshes silently.
   - A binding owned by another device is ignored (null).
2. **Settings focus (PN4).**
   - A deferred `update()` always runs once focus leaves the tab's editable elements, so no refresh is lost.
   - Moving between two fields never re-renders under the new one.
   - The tab's own refusal notices still show.
   - With nothing focused, `update()` runs exactly as before, and `refreshSoon()` still coalesces.
3. **The resolver (PN1).**
   - The resolved comparison still only adds an overlap, in both `plan` and `sourceNotePath`.
   - A UNC or `\\?\` path never reaches `realpathSync`.
   - The memo never changes an answer for a root that exists and does not change.
   - `plan` still sees a folder created mid-session.
4. **An unindexed folder (PN2).**
   - A disk-only **file** at a folder segment still refuses as `write-failed`.
   - Nothing is written outside the planned folder.
   - An indexed folder takes no `stat` call.
5. **Native honesty.**
   - Every new or changed scenario has its RED on record, and every negative assertion its positive control.
   - No Obsidian text is matched.
   - The Z38 budget is still 50 ms, and the no-freeze test is collected exactly once.

---

### Task 1: A folder on disk that Obsidian has not indexed (NPF15, P2, scenario 37)

**Files:**
- Modify:
  - `src/host/investigation-notes.ts` (`ensureFolders`, lines 127–136);
  - `tests/fixtures/fake-vault.ts` (disk-only entries and an adapter `stat`);
  - `tests/mocks/obsidian.ts`, only if the adapter classes need a default `stat`;
  - `tests/e2e/notes-root.e2e.ts`;
  - `tests/e2e/required-scenarios.json`.
- Create: `tests/host/investigation-notes-unindexed.test.ts`.

**Interfaces:**
- Consumes:
  - `createInvestigationNotes(app, deps)` and `ensureFolders(app, folder)` (module-private);
  - `createFakeVault(options)`;
  - Obsidian's `DataAdapter.stat(normalizedPath): Promise<Stat | null>`, where `Stat.type` is `'file' | 'folder'` (`node_modules/obsidian/obsidian.d.ts`);
  - the native `cycleSelected`/`indexedCycle` steps in `notes-root.e2e.ts:19–31`.
- Produces:
  - `ensureFolders` skips a segment that `adapter.stat` reports as a folder;
  - `FakeVault` gains `diskOnly(path: string, type: 'file' | 'folder'): void`, with `app.vault.adapter.stat` answering indexed entries and disk-only ones;
  - scenario 37.

- [ ] **Step 1: RED, fast.** Create `tests/host/investigation-notes-unindexed.test.ts` over `createFakeVault({ basePath: '/vault' })`, with `fake.diskOnly('code', 'folder')`. Then:
  1. `notes.create(<a valid request into 'code/notes'>)` resolves `{ status: 'created', path: 'code/notes/<name>.md' }`.
  2. `createFolder` was called once (for `code/notes`), never for `code`.
  3. **Control:** with `fake.diskOnly('code', 'file')`, the same create is `{ status: 'refused', reason: 'write-failed' }` and `createFolder` is never called.
  4. **Control:** an indexed `code` folder takes no `stat` call.

  Build the request as `tests/host/investigation-notes.test.ts` does (read its helpers; do not grow that file).

  Fake semantics, mirroring Obsidian 1.13.4's bundle (spec P2):
  - `createFolder(path)` on a disk-only folder throws `'Folder already exists.'`.
  - `createFolder(child)` under a disk-only folder parent succeeds, and first indexes that parent (the real `mkdir` is recursive and reconciles the parent).
  - `create(path)` under a disk-only folder parent does the same.

  Run it with `npx vitest run tests/host/investigation-notes-unindexed.test.ts`. The expected RED is `write-failed` on the first case.
- [ ] **Step 2: Native RED, before any `src` change.** Add scenario 37 to `tests/e2e/notes-root.e2e.ts`, with this exact title: `creates a note in a folder that exists on disk before Obsidian has indexed it`.
  1. Copy the project into `code/` with `copyProject` (node:fs, so the watcher never indexes it, NPF15).
  2. **Positive control:** `app.vault.adapter.exists('code')` is true and `getAbstractFileByPath('code')` is null, read through `executeObsidian`.
  3. Scan `code` (`scanFolder`), import the recording, and select the cycle. Reuse the file's own steps, but **not** `indexedCycle`'s `createFolder('code')`.
  4. Create a note in `code/notes` with `createNoteIn('code/notes', true)`.
  5. Expect the notes panel to list it, and `getAbstractFileByPath('code')` to be a folder afterwards.

  Run `npm run build`, then the NP4 command with `-t`, on the unchanged `src`. **Expected RED:** the create refuses (`write-failed`), so the notes panel never lists the note. Record the output. Leave the existing `createFolder('code')` workarounds in scenarios 20, 22 and 23 as they are: they set up other facts.
- [ ] **Step 3: GREEN.** In `ensureFolders`:

```ts
// IN28: one createFolder per missing segment, root first; an existing segment is used as is. WP-04.2 NPF15 (PN2):
// a folder on disk the vault has not indexed yet is used as is too — createFolder would refuse it ("Folder already
// exists."), and the next createFolder or create below it indexes it. A file there still refuses.
async function ensureFolders(app: App, folder: string): Promise<void> {
  const segments = folder.split('/');
  for (let i = 1; i <= segments.length; i += 1) {
    const prefix = segments.slice(0, i).join('/');
    const existing = app.vault.getAbstractFileByPath(prefix);
    if (existing instanceof TFolder) continue;
    if (existing !== null) throw new Error(`not a folder: ${prefix}`);
    const onDisk = await app.vault.adapter.stat(prefix);
    if (onDisk?.type === 'folder') continue;
    if (onDisk !== null) throw new Error(`not a folder: ${prefix}`);
    await app.vault.createFolder(prefix);
  }
}
```

  Then run every fast test file that creates notes (`grep -rln "createInvestigationNotes\|createFakeVault" tests`) and fix any hand-made vault double that now lacks `adapter.stat`. Add it to the double; never guard the production call.
- [ ] **Step 4: Native GREEN.** Build, and run scenario 37 and all of `notes-root.e2e.ts`. Append the title to `required-scenarios.json`.
- [ ] **Step 5: Gate and commit.** Subject: `fix(notes): a note folder that exists on disk before Obsidian indexes it is used, not refused as write-failed (WP-04.2 NPF15, polish)`.

---

### Task 2: The alias check costs one lookup per root and never touches a network path (E20, E13, T8, P1, P5)

**Files:**
- Modify:
  - `src/adapters/filesystem/node-access.ts` (`realPathOfNearest`);
  - `src/host/investigation-notes.ts` (`insideOf`, `planDestination`, `sourceNotePath`, `createInvestigationNotes`);
  - `tests/host/investigation-notes-alias.test.ts`;
  - `tests/host/investigation-ports.test.ts`.

**Interfaces:**
- Consumes:
  - `realPathOfNearest(target, modules?)`;
  - `insideOf(container, path, realPath)`;
  - `relativeInside` and `joinRootPath` (`src/application/investigation/root-path.ts`);
  - `createInvestigationServices(plugin, deps)` (`investigation-services.ts:31`);
  - the alias test's `notesOn` and `fakeResolver` helpers.
- Produces:
  - `realPathOfNearest` returns null for a target starting with `\\` or `//`, without calling `realpathSync`;
  - `insideOf(container, path, resolved)`, where `resolved` is `{ container(): string | null; target(): string | null } | undefined`, both lazy;
  - a per-port memo of root and base resolutions. `InvestigationNotesDeps` is unchanged: `realPath?` stays optional (PP4).

- [ ] **Step 1: RED, fast.** In `tests/host/investigation-notes-alias.test.ts`, first check its size; if it would pass 450, add a sibling `investigation-notes-alias-cost.test.ts`. Add:
  - **UNC:** `realPathOfNearest('\\\\host\\share\\code', <counting fake modules>)` and `realPathOfNearest('//host/share/code', …)` are null, with zero `realpathSync.native` calls. Extend `fakeResolver` with a call counter.
  - **One root lookup per root:** with a counting resolver, 5 `sourceNotePath('/alias/root', 'n<i>.md')` calls on one port resolve `/alias/root` once and the vault base once, and nothing else.
    - **Control:** the answers are the same as without the memo. Reuse the junction case at `:81–88`: `sourceNotePath(link, 'notes/n.md')` is still `'code/notes/n.md'`.
  - **`plan` sees a folder made mid-session:** two `plan()` calls with different folders resolve the root once, and each target once.
  - **T8, only adds:** in the `it.each` at `:96–104`, create `docs/guide.md` on the fake vault (base `/vault`) and assert `notes.sourceNotePath('/vault/docs', 'guide.md')` is `'docs/guide.md'` under both resolvers. Prove it RED by a temporary mutation: `sourceNotePath` compares only the resolved pair, skipping the textual answer. Record the output and revert.
  - **E13 wiring**, in `tests/host/investigation-ports.test.ts`:
    1. `vi.mock('../../src/adapters/filesystem/node-access', …)` with `realPathOfNearest` mapping `/alias` → `/vault/code` (and each path to itself otherwise).
    2. Build the services as the file already does.
    3. Assert `built.notes.plan('code/notes', 'x', '/alias')` matches `{ status: 'ok', overlapsRoot: true, rootRelativeFolder: 'notes' }`.

    Prove it RED by deleting the wiring line (`investigation-services.ts:45`), then revert.
- [ ] **Step 2: GREEN.**
  - In `node-access.ts`, before touching `files`:

```ts
// WP-04.2 E20 (PN1): a UNC, \\?\ or \\.\ path is never resolved. Resolving an offline network share blocks the
// renderer for the SMB timeout (21 s measured); null keeps the textual answer.
if (/^[\\/]{2}/.test(target)) return null;
```

  - In `investigation-notes.ts`, change `insideOf` to take lazy resolutions. Inside `createInvestigationNotes`, create one memo, `const seen = new Map<string, string | null>()`, and a `memo(path)` that resolves through `deps.realPath` on the first call and returns the stored value after that.
    - `plan` / `create`: container `() => memo(rootPath)`, target `() => deps.realPath(joined)` (fresh).
    - `sourceNotePath`: container `() => memo(base)`, target `() => { const root = memo(rootPath); return root === null ? null : joinRootPath(root, relativePath); }`.
    - When `deps.realPath` is undefined, pass `undefined`, which keeps the text-only behaviour.
    - Update the comment above `insideOf` to state PN1: a scanned file is reached without following links (WP-01 §4.4), so resolving the root alone gives the same answer.
    - `planDestination` stays synchronous.
- [ ] **Step 3: Gate and commit.** Run the alias and ports tests, plus `tests/host/investigation-notes.test.ts` and every test constructing `createInvestigationNotes` (9 sites, `grep -rln createInvestigationNotes tests`). Subject: `perf(notes): the alias check resolves each root once per session and never touches a network path, with the services wiring pinned by a fast test (WP-04.2 E20, E13, polish)`.

---

### Task 3: A rescan after a Reconnect asks to approve the connected folder (E14, O1, P6, scenario 39)

**Files:**
- Modify:
  - `src/host/scan-flow.ts` (`runRefresh`, lines 161–210);
  - `src/host/city-scan-controller.ts` (`CityViewDeps`, `startScan`);
  - `src/main.ts` (the `CityView` deps at `:85–91`);
  - `tests/fixtures/data-port-deps.ts`;
  - `tests/host/city-view-scan-modes.test.ts` (or a sibling file if it would pass 450);
  - `tests/e2e/commands.e2e.ts`;
  - `tests/e2e/required-scenarios.json`;
  - `tests/e2e/inspector.ts`, only within its 400 budget (NP2).

**Interfaces:**
- Consumes:
  - `runRefresh(app, coordinator, profile, storedScope, clock, profileStore)`;
  - `openScopeModal(app, { profile, resolvedRoot })`;
  - `persistThenScan`;
  - `sameRoot(a, b, { caseSensitive })` (`src/application/investigation/root-path.ts:47`);
  - `LocalBindingStore.get(id)`, which answers only this device's records (the same lookup as `resolveRoot`, `investigation-services.ts:35–40`);
  - `Platform.isLinux`;
  - the native steps `scanFolder`, `rescan`, `rescanApproving`, `connect(folder, mode)`, `openCodebaseSettings`, `clearBinding` (read `inspector.ts:84–100` and `:381–397` for the exact names), `approveScope`, `snapshotId`, and `pluginData`/`onlyProfile`.
- Produces:
  - `CityViewDeps.boundRoot: (profile: CodebaseProfile) => Promise<string | null>`;
  - `runRefresh(app, coordinator, profile, storedScope, clock, profileStore, boundRoot: string | null)`;
  - scenario 39.

- [ ] **Step 1: RED, fast.** In `tests/host/city-view-scan-modes.test.ts`, following its existing M57 divergence case (`:139`):
  - With a snapshot on `/root/a`, a profile bound to `/root/b` (the deps' `boundRoot` answers `'/root/b'`), `scan-codebase` opens the scope modal with `resolvedRoot` `/root/b`. Approving it starts a scan whose scope `rootPath` is `/root/b`.
  - Cancelling the modal starts no scan and leaves the profile unchanged.
  - **Control:** `boundRoot` answers `'/root/a'`, then null. Either way it is a silent refresh on `/root/a`, as `:164` pins today.
  - **Case:** `'/ROOT/A'` against `/root/a` is the same root off Linux.

  Add `boundRoot: async () => null` to `tests/fixtures/data-port-deps.ts`.
- [ ] **Step 2: GREEN.**
  - `city-scan-controller.ts`:
    - Add `boundRoot` to `CityViewDeps`, with a doc comment ("WP-04.2 polish O1 (PN5): the profile's live binding root on this device, or null").
    - In `startScan`'s refresh branch, pass `await this.deps.boundRoot(profile)` to `runRefresh`.
  - `scan-flow.ts`: `runRefresh` gains `boundRoot: string | null`. Before the M57 fingerprint check:

```ts
// WP-04.2 polish O1 (PN5): a Reconnect names a new root, and WP-01 §4.1 says a changed root invalidates prior
// approval. So when the live binding's root is not the snapshot's, the scope modal opens on the bound root (the
// M57 path), and nothing is self-minted for it.
if (boundRoot !== null && !sameRoot(boundRoot, storedScope.rootPath, { caseSensitive: Platform.isLinux })) {
  const result = await openScopeModal(app, { profile, resolvedRoot: boundRoot });
  if (!result) return;   // cancelled: no approval, no scan, profile untouched
  await persistThenScan(coordinator, profileStore, profile.profileId, result);
  return;
}
```

    Update `runRefresh`'s doc comment: `rootPath` comes from the snapshot unless the live binding names another root.
  - `main.ts`: wire `boundRoot: async (profile) => (profile.bindingId === null ? null : (await bindingStore.get(profile.bindingId))?.rootPath ?? null)`.
  - Check `import { Platform } from 'obsidian'` is allowed in `scan-flow.ts` (it is a host file).
- [ ] **Step 3: Native.** Add scenario 39 to `tests/e2e/commands.e2e.ts`, with this exact title: `scan-codebase after a Reconnect to another folder asks to approve the connected folder`.
  1. `copyProject` into `code` and `code-copy`, then `scanFolder('code')`.
  2. Connect the profile to `code` (vault-folder mode), from Settings.
  3. **Positive control:** `rescan()` refreshes with no modal.
  4. Clear binding, then Connect to `code-copy` (E16's Reconnect).
  5. `scan-codebase`: the scope modal must open. Read its resolved root, from the modal's own element found in `src/host/scope-modal.ts` (read it; select by class or data attribute, never by Obsidian text). It names `code-copy`.
  6. Cancel the modal (its cancel control): the snapshot id is unchanged, and its root still ends in `code`.
  7. `scan-codebase` again, then approve: a new snapshot whose scope root ends in `code-copy`.

  Read snapshot roots through `executeObsidian` the way scenario 23 does (`preview.e2e.ts:129–130`).
  - **RED:** a mutation in `main.ts` where `boundRoot` answers null. The scope modal then never opens at step 5. Build, run, record and revert.
  - **Timeout:** default (no synthetic tree).

  Append the title to the gate.
- [ ] **Step 4: Gate and commit.** Also run `tests/host/city-view*.test.ts`, `tests/host/city-scan-controller.test.ts`, `tests/host/plugin-onload.test.ts`, and the native `preview.e2e.ts` (scenario 23 must stay green). Subject: `feat(scan): scan-codebase after a Reconnect to another folder asks to approve the connected folder (WP-04.2 E14, polish O1)`.

---

### Task 4: Settings never re-renders the field you are typing in (NE9 cost, P4, scenario 38)

**Files:**
- Modify:
  - `src/host/settings-tab.ts` (`refresh`, around `:84–119`);
  - `tests/e2e/settings.e2e.ts`;
  - `tests/e2e/required-scenarios.json`.
- Create: `tests/component/settings-tab-focus.test.ts`.

**Interfaces:**
- Consumes:
  - `CodebaseInspectorSettingTab.refresh()`, `refreshSoon()` and `containerEl`;
  - Obsidian's `SettingTab.update()`;
  - the native steps `openCodebaseSettings`, `settingsPage`, `editSetting`, `closeSettings`, `pluginData` and `onlyProfile`;
  - `SCOPE_MODAL` / `LIST` in `settings.e2e.ts`.
- Produces:
  - `refresh()` defers `update()` while an editable element inside `containerEl` holds focus;
  - a private `renderWhenIdle()` (name free);
  - scenario 38.

- [ ] **Step 1: Native RED on 9644c08 (PP6).** Scenario 38 goes in `tests/e2e/settings.e2e.ts`, with this exact title: `a setting being typed keeps its text when a write elsewhere refreshes the settings tab`.
  1. `copyProject`, `scanFolder('code')`, and read `profile`.
  2. `openCodebaseSettings(profile.name)`.
  3. **Marker:** set `data-ci-probe="1"` on the Name row's element through `browser.execute` (in the settings window). It is a row other than the one being typed in.
  4. Click into the Excluded paths `textarea`, Ctrl+End, then `addValue('\nfirst-half')`.
  5. With focus still in the textarea, switch to the main window (`browser.switchToWindow` on the app handle) **without** closing the settings. Make one watched write through `executeObsidian`, a write that goes through `writePluginDataSlice` or `updatePluginDataRecord` to a watched slice (`profiles`, `bindings`, `analyzers`, `investigations`).
     - **First choice:** the plugin instance's own service, `app.plugins.plugins['codebase-inspector'].analysis` (`main.ts:78`). Read `fallow-analysis-service.ts` for a method that writes `analyzers` for this profile without a run (e.g. `setTimeLimit`), and check it writes when the profile has no executable yet.
     - **Otherwise:** `profileStore.update` reached through the same instance, if one is held.
     - **Never** `saveData` directly: it bypasses the watcher.
     - Report which write was used, and add a helper to `host-probes.ts` only if it is shared.
  6. Wait until `data.json` shows it. Switch back to the settings window.
  7. Type `'second-half'`, then blur with a click on the page title (E2).
  8. `closeSettings`.
  9. **Expect:** the saved exclusions contain the line `first-halfsecond-half` (a `pluginData` read).
  10. **Positive control:** after the blur, the Name row's marker is gone (`browser.$('[data-ci-probe]').isExisting()` false before `closeSettings`). The write did re-render the tab.

  If this helper split pushes `settings.e2e.ts` past 450, move the scenario's own helpers into a `settings-typing.ts` module next to it.

  Run it on the unfixed `src` (build at this task's base). **Expected RED:** the typed text is lost, and the saved exclusions lack the line.
  - **If it is GREEN on 9644c08, stop** and report to the controller for a ruling (PP6). Do not change `src`.
  - If the switch to the main window itself blurs the textarea (check `document.activeElement` in the settings window after switching back, and record what you see), stop too. The controller rules on another trigger, such as a fallow `grantTrust` during a run.
- [ ] **Step 2: RED, fast.** In `tests/component/settings-tab-focus.test.ts` (jsdom; build the tab as `settings-tab-refresh-soon.test.ts` does, and spy on `update`):
  - An `input` inside `tab.containerEl`, attached to the document and focused: `await tab.refresh()` does not call `update`.
  - Moving focus to a second `input` inside the container (dispatch `focusout` with that `relatedTarget`) still does not call it.
  - Moving focus to `document.body` calls `update` exactly once, and a second `focusout` calls nothing more.
  - **Control:** with nothing focused, `refresh()` calls `update` once, as before.
  - **Coalescing:** two `refreshSoon()` while focused, then focus leaves, gives one `update`.
- [ ] **Step 3: GREEN.** In `settings-tab.ts`, replace `refresh()`'s closing `this.update();` with `this.renderWhenIdle();`:

```ts
/** WP-04.2 polish PN4: Obsidian's update() re-renders every render-type row, so it waits while a field of this
 *  tab holds focus, and runs once focus has left the tab's fields (Settings open in their own window: NPF7). */
private renderWhenIdle(): void {
  const doc = this.containerEl.ownerDocument;
  if (!isEditingIn(this.containerEl, doc.activeElement)) { this.update(); return; }
  if (this.renderPending) return;
  this.renderPending = true;
  const onFocusOut = (event: FocusEvent): void => {
    if (isEditingIn(this.containerEl, event.relatedTarget)) return;
    this.containerEl.removeEventListener('focusout', onFocusOut);
    this.renderPending = false;
    this.update();
  };
  this.containerEl.addEventListener('focusout', onFocusOut);
}
```

  - `isEditingIn(container, el)` is a module-level function. It is true when `el` is an `HTMLInputElement`, `HTMLTextAreaElement` or `HTMLSelectElement` (use `instanceof` against `el.ownerDocument.defaultView`'s constructors, or `el.matches('input, textarea, select')`), and `container.contains(el)`.
  - `renderPending` is a private boolean field.
  - Keep the "update() is called HERE" comment, amended to name PN4.
  - `oxlint`'s `consistent-function-scoping` may require the listener's shape to change; keep the behaviour.
  - Do not add timers.
- [ ] **Step 4: Native GREEN.** Build, and run scenario 38 plus all of `settings.e2e.ts` (scenarios 10–14 must stay green). Append the title to the gate.
- [ ] **Step 5: Gate and commit.** Also run `tests/component/settings-tab*.test.ts`. Subject: `fix(settings): a write elsewhere no longer re-renders the setting being typed in (WP-04.2 NE9 cost, polish)`.

---

### Task 5: The status bar no longer covers the city leaf's buttons (Task 9 minor, P3)

**Files:**
- Modify:
  - `src/ui/styles/shell.css` (`.ci-shell__content`, `:34–37`);
  - `tests/unit/leaf-chrome.test.ts` (or a sibling if clearer);
  - `tests/e2e/preview.e2e.ts` (delete `centred()` and its two uses).

**Interfaces:**
- Consumes: the `leaf-chrome.test.ts` CSS-reading pattern; scenario 24 (`Open in Obsidian and Open note each open the file in a new tab`).
- Produces: a 32 px `scroll-padding-block-end` on `.ci-shell__content`. `centred()` no longer exists.

- [ ] **Step 1: Native RED.** Delete `centred()` (`preview.e2e.ts:47–56`) and both calls (`:69`, `:186`), and the now-unused comment at `:184–185`. Build on the current CSS and run scenario 24 with `-t`. **Expected:** WebDriver's click is intercepted ("element click intercepted" naming the status bar). Record the output.
- [ ] **Step 2: RED, fast.** In `leaf-chrome.test.ts`, the same way it pins `padding: 0`, assert the `.ci-shell__content` rule declares `scroll-padding-block-end: calc(var(--ci-space-4) * 2)`.
- [ ] **Step 3: GREEN.** Add `scroll-padding-block-end: calc(var(--ci-space-4) * 2);` to `.ci-shell__content`, with a comment: WP-04.2 polish PN3; Obsidian's status bar is fixed over the leaf's foot, and Obsidian's own views reserve `--size-4-8` (32 px); scroll padding moves every scroll-into-view clear of it without changing the layout. Build, and run scenario 24. **Expected:** GREEN. If it is still RED, stop and report (PP8); do not reintroduce `centred()`.
- [ ] **Step 4: Gate and commit.** Also run `tests/component/stage-height.test.ts`. Subject: `fix(ui): the city leaf's scroll keeps its buttons clear of Obsidian's status bar, and the native centred() workaround is gone (WP-04.2 Task 9 minor, polish)`.

**Controller, after Task 5 (the last `src` task):** run `npm run test` once, and record the result in the ledger: file and test counts, any failure, and the Z38 outcome. The two evidence count tests are expected to fail on counts until Task 9.

---

### Task 6: The no-freeze case runs alone (Z38, O2, P7)

**Files:**
- Modify: `vitest.config.ts`, `tests/integration/fallow-analysis.test.ts`.
- Create:
  - `tests/integration/fallow-no-freeze.test.ts`;
  - `tests/integration/fallow-analysis-world.ts` (the shared helpers; not a `*.test.ts`, so not collected).

**Interfaces:**
- Consumes: the `no freeze` describe (`fallow-analysis.test.ts:266–287`) and the helpers it uses (`world()`, the tracked spawn, `afterEach` cleanup; read `:1–110`).
- Produces: the project `node-serial`, and the helpers module.

- [ ] **Step 1:** Move the helpers the no-freeze case needs into `fallow-analysis-world.ts` **unchanged** (exported), and import them in both test files. Move the `no freeze` describe verbatim into `fallow-no-freeze.test.ts`. The assertion stays `toBeLessThan(50)`, and the modes and the `60_000` timeout are unchanged.
- [ ] **Step 2:** In `vitest.config.ts`:
  - add `'tests/integration/fallow-no-freeze.test.ts'` to the `node` project's `exclude`;
  - add a third project with the same `resolve.alias` and `plugins`, and `test: { name: 'node-serial', environment: 'node', include: ['tests/integration/fallow-no-freeze.test.ts'], sequence: { groupOrder: 1 } }`;
  - add a comment citing O2 and PP10: every other project is group 0 and finishes first, so the 50 ms budget is measured on an otherwise idle worker pool.

  If Vitest requires `groupOrder` on every project once one sets it, set `0` explicitly on the other two.
- [ ] **Step 3: Proof.**
  - `npx vitest run tests/integration/fallow-analysis.test.ts tests/integration/fallow-no-freeze.test.ts`: both pass.
  - `npx vitest list --project node-serial`: exactly the no-freeze cases.
  - `npx vitest list --project node`: none of them. The total count of no-freeze cases is unchanged, and none is listed twice.
  - Run `npm run test` once, and paste the tail. The output shows the `node-serial` group running after the others; paste the lines that show it.
- [ ] **Step 4: Gate and commit.** Subject: `test(fallow): the no-freeze budget is measured alone, after every other test file (WP-04.2 Z38, polish O2)`.

---

### Task 7: Native test minors (T1–T5, T9, T10)

**Files:**
- Modify:
  - `tests/e2e/host-probes.ts`;
  - `tests/e2e/inspector.ts`;
  - `tests/e2e/plugin-lifecycle.e2e.ts`;
  - `tests/e2e/smoke.e2e.ts`;
  - `tests/e2e/notes-index.e2e.ts`;
  - `tests/e2e/notes-root.e2e.ts` (the timeout only).

**Interfaces:**
- Consumes:
  - `openPluginSettings` / `handleWhere` (`host-probes.ts:83–110`);
  - `listenerCounts` (`:23–35`);
  - `reviewFinding` (`inspector.ts:252–269`) and `evidence()` (`:282–289`);
  - `FINDING_STATUS_LABEL` (`src/ui/audit-copy/quality.ts:46`);
  - `FINDING_DIALOG_REASON` (find its module with `grep -rn "FINDING_DIALOG_REASON" src/ui`);
  - `ROUTE_META` (`src/ui/routes.ts:23–25`);
  - scenario 1 (`plugin-lifecycle.e2e.ts:80–148`) and scenario 2 (`:150–216`).
- Produces: `reviewFinding(disposition: ReviewDisposition)` with `type ReviewDisposition = Exclude<keyof typeof FINDING_STATUS_LABEL, 'open'>` (module-private or exported only if a scenario file needs it).

- [ ] **Step 1: T1.** In `openPluginSettings`, capture the handle inside the poll and delete the second call and its throw:

```ts
let handle: string | null = null;
await expect.poll(async () => (handle = await handleWhere(browser, hasSettings))).not.toBeNull();
await browser.switchToWindow(handle!);
```

  If the non-null assertion is refused by lint, use `if (handle === null) throw …` after the poll.
- [ ] **Step 2: T2.** In `listenerCounts`, replace the `if (Array.isArray…)` with a throw: `` throw new Error(`${source}:${name} is not a listener array`) ``. In scenario 1, next to its existing positive control (`:82`), add a negative control:
  1. Plant `app.vault._['ci-probe'] = {}` through `executeObsidian`.
  2. `await expect(listenerCounts(browser)).rejects.toThrow('vault:ci-probe')`.
  3. Delete the entry, in a `finally`.
  4. Then `listenerCounts` works again.

  **RED:** restore the silent `if` temporarily, and the new control fails. Record it.
- [ ] **Step 3: T4.** Type `reviewFinding` as in Produces, and delete the unreachable `else throw` (keep the two branches). In scenario 2:
  1. After acknowledging the first finding, select a **second, still open** finding. Pick one from the recording other than the cycle, and document the choice in a comment.
  2. `reviewFinding('dismissed')`.
  3. Before the reload, assert `data.json`'s review record for it is `{ status: 'dismissed', reason: 'native e2e' }` (read the stored shape in `plugin-data-review-repository.ts`).
  4. After the reload, assert `evidence().rows[FINDING_DIALOG_REASON]` (or the Reason row's label constant; find the label `EvidencePanel.vue:82–84` renders) reads `native e2e`.

  **RED:** a temporary mutation where the dismissal save does nothing (`FindingReviewDialog.vue`'s save-dismissal handler returns early). The chip poll fails. Record it and revert.
- [ ] **Step 4: T5.** In `evidence()`, before building rows:

```ts
if (terms.length !== values.length || new Set(terms).size !== terms.length) {
  throw new Error(`the evidence panel shows ${terms.length} labels and ${values.length} values, or a repeated label`);
}
```

  and use `values[i]!`. **RED:** temporarily remove the last `<dd>` in `EvidencePanel.vue:88–97`. Scenario 2 then fails in `evidence()` with that message. Record it and revert.
- [ ] **Step 5: T3.** Run scenario 2 under the mutation `listDispositions: async () => []` (`src/adapters/storage/plugin-data-review-repository.ts:238`). **Expected:** it passes every pre-reload assertion and fails at the post-reload disposition check. Record the failing line and revert. There is no test change for T3.
- [ ] **Step 6: T9.** In `smoke.e2e.ts`:
  - `navigate(ROUTE_META.investigate.title)`;
  - `groups.indexOf(ROUTE_META.investigate.group)`;
  - `(['investigate', 'workbench', 'report'] as const).map((id) => ROUTE_META[id].title)`.

  Keep the IN51 comment, amended. Then `grep -rnE "'(Investigate|Act|Refactor workbench|Audit report)'" tests/e2e` finds nothing.
- [ ] **Step 7: T10 (PP5).** Drop the third argument of scenarios 2 (`plugin-lifecycle.e2e.ts:216`), 17 (`notes-index.e2e.ts:104`) and 22 (`notes-root.e2e.ts:115`), so they take the config's `120_000`.
- [ ] **Step 8: Native run and commit.** Build, then run `plugin-lifecycle.e2e.ts`, `smoke.e2e.ts`, `notes-index.e2e.ts`, `notes-root.e2e.ts` and `settings.e2e.ts` (for T1): all green. Paste each scenario's duration. Subject: `test(e2e): the Part 2 native minors — one settings-window walk, a fail-closed listener table, a typed and exercised dismissal, a checked evidence panel, nav labels from ROUTE_META, and NP5 timeouts (WP-04.2 deferred minors, polish)`.

---

### Task 8: A report longer than one page, with an unmatched finding (T6, T7, scenario 40)

**Files:**
- Modify:
  - `tests/e2e/workspace-files.ts` (the expected count);
  - `tests/e2e/investigation.e2e.ts`;
  - `tests/e2e/commands.e2e.ts` and `tests/e2e/fallow.e2e.ts` (their count calls, if the helper's signature changes);
  - `tests/e2e/required-scenarios.json`.

**Interfaces:**
- Consumes:
  - `recordingFindings(file)`, `writeReport(to, edit)` and `copyProject` (`workspace-files.ts`);
  - `resolveFindings(findings, snapshotPaths)` (`src/application/evidence/resolve-findings.ts:9`);
  - `FINDINGS_PAGE` (`src/ui/read-models/findings.ts:40`; an `src/ui/read-models` constant, imported under E7 as the owning module);
  - `inspector.importReport`, `listedFindings` and `scanFolder`.
- Produces: `expectedFindingCount(projectRoot: string, file?: string): number`, which replaces `recordingFindingCount`. It is the count of `resolveFindings(recordingFindings(file), <the project's relative file paths>).matched`, with the paths from a walk like `hashTree`'s, files only, `/`-separated.

- [ ] **Step 1:** Add `expectedFindingCount`, and replace every `recordingFindingCount()` call (scenarios 7 and 8) with it, passing the copied project's absolute path. Delete `recordingFindingCount` (no dead export).
- [ ] **Step 2: Scenario 40** in `tests/e2e/investigation.e2e.ts`, with this exact title: `the finding list pages through a report longer than one page and leaves out unmatched findings`.
  1. `copyProject` → `code`, then `scanFolder('code')`.
  2. Write a report with `writeReport`: the recording plus 150 clones of `check.unused_exports[0]` (`src/barrel/x.ts`), each with `export_name: 'x' + i` and a distinct line if the normaliser needs one (check that the ids differ through `recordingFindings(file)`), plus **one** clone whose `path` is `src/missing.ts`.
  3. `importReport`, then `listedFindings()`.
  4. **Expect:** `listed` equals `expectedFindingCount(code, file)`.
  5. **Controls, before the UI checks:** `expectedFindingCount(code, file)` is greater than `FINDINGS_PAGE`, and `recordingFindings(file).length === expectedFindingCount(code, file) + 1` (the unmatched finding is in the report, and the count leaves it out).
  6. Also assert Show more was pressed at least once: count clicks inside a local copy of the loop, or assert `listed > FINDINGS_PAGE`, which is only reachable through it.

  **RED:**
  - (a) Temporarily make the Show more handler a no-op (`InvestigateScreen.vue:199`, `@more`). The loop's poll fails. Record it and revert.
  - (b) Temporarily make the expected count `recordingFindings(file).length`. The equality fails by one. Record it and revert.

  Append the title to the gate.
- [ ] **Step 3: Native run and commit.** Build, then run `investigation.e2e.ts` and `commands.e2e.ts`, plus `fallow.e2e.ts` with `FALLOW_BIN` set and no `fallow.exe` running. Subject: `test(e2e): the finding list pages through a report longer than one page, and expected counts leave out unmatched findings (WP-04.2 deferred minors, polish)`.

---

### Task 9: Evidence, the latest run and the full verification

**Files:**
- Modify:
  - `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` (CRLF): the G8 table counts, plus a "WP-04 Part 2 polish" subsection under the WP-04 Part 2 native coverage section. The subsection states what changed (P1–P7), the four new scenarios, the gate line and versions for both native runs, and **every** `npm run verify` run of this pass with its Z38 outcome.
  - `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md` (CRLF): the mirror.
  - `docs/deliverables/Test Evidence.md`: the native paragraph goes from 36 to 40 scenarios by file.
  - `tests/unit/gate-evidence.test.ts`, `tests/unit/evidence-numbers.test.ts`: only the pinned numbers, edited in place (`evidence-numbers.test.ts` stays ≤ 450).

**Interfaces:**
- Consumes: every earlier task; `reports/native/vitest-results.json`; a case's `environment.json`.

- [ ] **Step 1: Refresh the counts once** (L28) from `npm run test`'s output and the file layers on disk. Re-run the two evidence tests; they are expected to pass.
- [ ] **Step 2: Full verification**, in order, each in the foreground; paste each tail:
  1. `npm run verify`. Expected exit 0. **Disclose every run**, with its Z38 outcome.
  2. Confirm no `fallow.exe` is running: `tasklist /FI "IMAGENAME eq fallow.exe"`.
  3. `npm run test:e2e`, with `FALLOW_BIN` set to `%LOCALAPPDATA%/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe`. Expected: `Verified 40 executed native Vitest cases, including all 40 required scenarios.` Every native case is a required scenario, as in Part 2's 36/36; check the executed count against `required-scenarios.json`.
  4. The same with `OBSIDIAN_VERSION=latest`. Record the resolved app and installer versions.
  5. `npm run test:fallow` with the same `FALLOW_BIN`. Expected: PASS.
  6. `npm run analyze`. Expected: 9.
  7. `npm run harness-shot`. Open the Investigate and Settings captures (`wp04-investigate-*`, `wp02-settings-*`) and `s05-city-dark`, and say which were looked at and what changed (PN3 changes no layout).
- [ ] **Step 3: Commit.** Subject: `docs(evidence): WP-04 Part 2 polish pass, counts, both native runs and every verify run (polish Task 9)`.

**Controller, after Task 9:**
- Transcribe the execution rulings into the ledger, and commit it with its own `docs(ledger): …` commit.
- Run the final opus whole-branch review (`9644c08..HEAD`), one fix wave, and a scoped re-review.
- Re-run whatever the fix wave touches.
- Scan every commit's trailer one at a time.
- Fast-forward-push onto `feat/wp-01-codebase-city`.
- Add PR 1's "WP-04 Part 2 polish pass" section, then update its summary table and commit count. Replace text literally: `$` in the text is never a replacement pattern.

## Self-review notes (controller)

**Spec coverage:**

| Spec item | Task |
|---|---|
| P1 (E20) and T8 | 2 |
| P2 (NPF15) and scenario 37 | 1 |
| P3 (status bar) and scenario 24 | 5 |
| P4 (NE9 typing) and scenario 38 | 4 |
| P5 (E13) | 2 |
| P6 (E14) and scenario 39 | 3 |
| P7 (Z38) | 6 |
| P8 | no change |
| T1–T5, T9, T10 | 7 |
| T6, T7 and scenario 40 | 8 |
| Verification | 9 |

**Review Focus → tests:**

| Focus | Tests |
|---|---|
| 1 | Task 3 Step 1 (cancel, same root, case) and scenario 39's cancel |
| 2 | Task 4 Step 2 (field to field, a single update, coalescing) |
| 3 | Task 2 Step 1 (UNC, memo, mid-session folder, only adds) |
| 4 | Task 1 Step 1 (file control, stat count) |
| 5 | every task's RED record, and Task 6 Step 3 |

**Ordering:** `src` changes only in Tasks 1–5, and the controller's full-suite run follows Task 5. Tasks 7 and 8 share `inspector.ts` and `workspace-files.ts`, and Task 8 follows 7.
