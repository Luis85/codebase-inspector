# WP-04 Part 2 — Native e2e coverage: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every plugin behaviour that only a real Obsidian can prove gets a native e2e test. This adds 26 required scenarios on the WP-04 Task 0 harness, for 36 in total. A bug a scenario exposes is fixed here, RED first.

**Architecture:**
- **No new harness.** Scenarios are split by concern into ten `tests/e2e/*.e2e.ts` files on the existing `test` fixture (one fresh Obsidian session and vault copy per test).
- **Shared code:**
  - UI steps: `tests/e2e/inspector.ts`;
  - host probes over Obsidian internals, each with a positive control: `tests/e2e/host-probes.ts`;
  - fixtures written at run time: `tests/e2e/workspace-files.ts`;
  - a `node:zlib` PNG reader: `tests/e2e/png.ts`.
- **`src` changes are bug fixes only (O2):**
  - the Settings tab follows writes it did not make (NE9);
  - if their scenarios are RED, the alias-aware overlap (NE15) and `@` escaping (NE16).

**Tech Stack:**
- Native layer: Vitest 5.0.1, WebdriverIO 9.32.0 and `wdio-obsidian-service` 3.2.1; Obsidian 1.13.4 (baseline) and `latest` once (O4); Node 24 (`node:*` in tests only).
- Fixes: TypeScript 6.0.3 and Vue 3.5.43.
- fallow 3.27.0, only through `FALLOW_BIN`.

**Spec:** `docs/superpowers/specs/2026-09-26-wp04-part2-native-e2e-design.md`. It holds NE1–NE20, owner decisions O1–O4, 26 scenarios (§5) and probes a–k (§6).
- Also binding: the WP-04 Part 1 spec (IN42–IN51) and ledger (O8, IP45–IP58, IPF14–IPF20, E12, E14, E25), the WP-01 spec §4, every earlier spec and ledger, and `docs/deliverables/*.md`.
- Rulings live in `docs/superpowers/notes/2026-09-26-wp04-part2-ledger.md`:
  - planning rulings: **NP1…**
  - pre-flight rulings: **NPF1…**
  - execution rulings: **"WP-04.2 E1…"**

**Branch:** `feat/wp-04-part2` in `.claude/worktrees/wp-04-part2`, from `353e2c1` (the PR 1 head). `npm ci` is done, and `.obsidian-cache/` was copied from the Part 1 worktree. The spec, this plan and the ledger are committed together before Task 1. At the end the branch is fast-forward-pushed onto `feat/wp-01-codebase-city` only; `feat/wp-04-part2` itself is never pushed.

**Before Task 1:** the controller runs the pre-flight scan:
- re-measures every line count below with `wc -l`;
- greps every "Consumes" name;
- records the scan as a table in the ledger.

**Before Task 2:** the controller reads Task 1's probe outcomes and records each as an NPF ruling. A probe that defeats a scenario's plan stops the plan for a ruling.

## Global Constraints

**Binding (owner):**
- the WP-01 spec §4 frozen contracts, every spec and ledger, and `docs/deliverables/*.md`;
- line caps: 400 for `src`, 450 for tests, including `tests/e2e/**` and `tests/support/**`;
- the city-view budget (`city-view.ts` and `CityWorkspace.vue` ≤ 360, `CityViewport.vue` never edited) and layering;
- copy only in `src/ui/audit-copy`;
- CRLF files edited only with Edit/Write (never `sed`, heredocs or scripts; this checkout is LF, with `core.autocrlf=false`, but the rule holds);
- explicit timeouts on slow work;
- `npm run analyze` stays at **9** (a new dead export is removed, never baselined);
- never `git stash`;
- every commit message ends with the literal trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", whatever model runs.

**Native discipline** (IN42–IN51, NE1–NE8):
- **Sessions:** one `test` fixture session per test, `retry: 0`, `expect.poll` for every wait (never a sleep, never `browser.pause`), and teardown by the fixture.
- **IPF20:** never match Obsidian's own UI text. The plugin's own words are matched only through constants imported from `src/ui/audit-copy/**` or `src/ui/inspector-copy.ts` (NP3).
- **Controls and RED:** each probe has a positive control in the same test. Each new scenario is shown RED once (NE5): on the unfixed code for a bug, or under the spec §5 mutation, which is built, run, reverted and never committed. The RED output goes in the task report.
- **The gate:** each task appends its titles to `tests/e2e/required-scenarios.json`, exactly as spec §5 writes them (NE6).
- **Imports:** native files never import `tests/fixtures/**` or `tests/mocks/**` (IP56). They may import `src/application/**` and the copy modules.
- **Timeouts:** a test that restarts Obsidian, scans a synthetic tree or runs fallow passes its own timeout as the third `test` argument (NP5):
  - `300_000` for restarts and fallow;
  - `240_000` for synthetic scans;
  - the default `120_000` otherwise.

**Running native tests while developing (NP4):**
- Build once after each `src` change: `npm run build`.
- One file: `node node_modules/vitest/vitest.mjs run --config tests/e2e/vitest.config.mts tests/e2e/<file>.e2e.ts`.
- One test: add `-t "<title>"`.
- The full native gate: `npm run test:e2e` (build, run, results gate).
- Evidence per case lands in `reports/native/cases/*/`.

**Size now** (at 353e2c1; re-measured at pre-flight):
- **src:**
  - `src/main.ts` 131
  - `src/host/settings-tab.ts` 327
  - `src/adapters/storage/plugin-data-shape.ts` 118
  - `src/host/investigation-notes.ts` 237
  - `src/application/investigation/note-text.ts` 53
  - `src/adapters/filesystem/node-access.ts` 15
  - `src/application/investigation/root-path.ts` 49
- **tests:**
  - `tests/e2e/inspector.ts` 142
  - `tests/e2e/investigation.e2e.ts` 151
  - `tests/e2e/obsidian-facts.e2e.ts` 182
  - `tests/e2e/smoke.e2e.ts` 32
  - `tests/unit/plugin-data-shape.test.ts` 104
  - `tests/host/plugin-onload.test.ts` 245
  - `tests/unit/gate-evidence.test.ts` 336
  - `tests/unit/evidence-numbers.test.ts` **403**
- **At or near the cap:** never grow these; new tests go in new files.
  - `tests/component/settings-tab.test.ts` 436
  - `tests/host/city-view-store-wiring.test.ts` 439
  - `tests/host/city-view.test.ts` 421

**Layering:**
- `src/adapters/**` never imports UI.
- `src/host/**` may import adapters.
- Only files listed in `tests/unit/node-access-boundary.test.ts` may reach Node. A new Node use goes through `src/adapters/filesystem/node-access.ts`.
- `src/application/**` stays free of Obsidian and Node.

**Gates:**
- **Per-task gate:** `npm run typecheck && npm run lint:fast && npx eslint <touched files> --max-warnings 0`, plus the task's own native file(s). A task that touches `src` also runs its fast-suite test files and the three whole-`src` scans: `tests/host/clean-vault-install.test.ts`, `tests/unit/no-process-execution.test.ts` and `tests/unit/node-access-boundary.test.ts`, each with its `30_000` timeout.
- **`npm run analyze`:** at the end of Tasks 2, 8, 11 and 12.
- **Evidence counts:** refreshed once, in Task 12. Until then `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` may fail on file counts; do not "fix" them early.
- **The full suite** (`npm run verify`) runs after Task 11, the last task that may touch `src`.

**Commits:**
- Each task commits only its own files, never the ledger:
  `git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- Set work aside with a WIP commit, never `git stash`.
- Implementers and reviewers never spawn subagents. Reviewers create no files.
- Implementers report:
  - files and line counts;
  - gate output;
  - RED and GREEN output;
  - native case directories;
  - every deviation.

## Review Focus

The five failure modes most likely to bite, each with a named test in its task:
1. **A native test that passes because its check cannot fail.** Examples: a selector that matches nothing, a listener count read from the wrong table, a pixel read off the canvas, a cancel sent after the run already ended. Every probe carries a positive control, and every scenario has a RED proof. Tasks 1–11, each "positive control" step.
2. **State that leaks across a reload or restart.** A listener, interval, canvas or view that outlives `onunload`; a value written to `data.json` but not re-read by a fresh `onload`; a machine id that changes on restart, so a binding stops being "this device's". Task 3, "leaks" and "reload"; Task 10, "restart".
3. **A surface that shows a stale copy of data another surface changed.** Examples: Settings after `scan-codebase`, after Data & scans trusts fallow, and after a note adds an exclusion. Task 2, "scan-created codebase"; Task 5, "trusted executable"; Task 8, "exclusion added".
4. **A path that names one folder two ways.** An 8.3 name, a junction, or case on Windows, so containment and overlap disagree with the filesystem. Task 8, "alias".
5. **Report or note text that Obsidian renders as syntax** inside a code span or as an autolink. Task 11, "code spans" and "email".

---

### Task 1: Pre-flight probes and the shared native helpers

**Files:**
- Create: `tests/e2e/host-probes.ts`, `tests/e2e/workspace-files.ts`, `tests/e2e/png.ts`
- Scratch (never committed, deleted before the commit): `tests/e2e/probes.e2e.ts`
- Modify: `tests/e2e/inspector.ts` (new steps), `tests/e2e/investigation.e2e.ts` (moves `hashTree` and `cycleFinding` into `workspace-files.ts`; behaviour unchanged)

**Interfaces:**
- Consumes: `tests/e2e/fixture.ts` (`test`, `NativeContext`); `tests/e2e/session.ts` (`PLUGIN_ID`, `CITY_VIEW_TYPE`, `NativeBrowser`); `src/application/evidence/{read-fallow-report,normalize-fallow}.ts`.
- Produces:
  ```ts
  // tests/e2e/host-probes.ts
  export type ListenerCounts = Record<string, number>;        // 'workspace:css-change' -> 3
  export function listenerCounts(browser: NativeBrowser): Promise<ListenerCounts>;   // app.workspace/vault/metadataCache `_` tables (probe a)
  export function leakedListeners(before: ListenerCounts, after: ListenerCounts): string[]; // names whose count grew
  export function trackIntervals(browser: NativeBrowser): Promise<void>;  // wraps activeWindow.setInterval/clearInterval
  export function liveIntervals(browser: NativeBrowser): Promise<number>; // created since trackIntervals and not cleared
  export function setTheme(browser: NativeBrowser, mode: 'dark' | 'light'): Promise<void>; // app.changeTheme, polls body.theme-*
  export function openPluginSettings(browser: NativeBrowser): Promise<void>;  // app.setting.open + openTabById(PLUGIN_ID) (probe f)
  export function closeSettings(browser: NativeBrowser): Promise<void>;
  export function commandAvailable(browser: NativeBrowser, id: string): Promise<boolean>;  // checkCallback(true) / callback present
  export function pluginData(browser: NativeBrowser): Promise<Record<string, unknown>>;   // configDir/plugins/codebase-inspector/data.json
  export function reloadPlugin(browser: NativeBrowser): Promise<void>;  // page.disablePlugin + enablePlugin
  // tests/e2e/workspace-files.ts
  export const RECORDING: string;                    // tests/fixtures/fallow/relations-combined-3.27.0.json (absolute)
  export function copyProject(vault: string, folder: string): string;   // copies relations-project, returns the absolute folder
  export function hashTree(root: string): Record<string, string>;       // moved from investigation.e2e.ts
  export function cycleFinding(): { id: string; line: number };          // moved from investigation.e2e.ts
  export function writeSyntheticTree(root: string, files: number): void; // probe g sizes it
  export function writeReport(to: string, edit: (raw: Record<string, unknown>) => void): string; // recording, edited, re-serialised
  export function makeJunction(target: string, link: string): boolean;   // fs.symlinkSync(target, link, 'junction'); false if refused
  // tests/e2e/png.ts
  export interface Png { width: number; height: number; pixel(x: number, y: number): [number, number, number, number] }
  export function decodePng(bytes: Buffer): Png;   // 8-bit RGB/RGBA, non-interlaced, filters 0–4, node:zlib inflateSync
  // tests/e2e/inspector.ts (added)
  resolvedColor(token: string): Promise<[number, number, number]>; // the leaf's --ci-* token through a 1×1 2D canvas in its window
  canvasShot(file: string): Promise<Png>;           // the city canvas element's saveScreenshot, decoded
  settingsRow(name: string): ChainablePromiseElement;  // a .setting-item whose .setting-item-name equals `name` (our constant)
  ```

- [ ] **Step 1: Write the scratch probe file.** Write `tests/e2e/probes.e2e.ts` with one `test` per spec §6 probe (a–k). Each test writes `probe.json` with `writeEvidence` **before** it asserts anything, and each asserts its own positive control. Probe a:

  ```ts
  test('probe a: Events listener tables', async ({ native: { browser, directory } }) => {
    const count = () => browser.executeObsidian(({ app }) => {
      const table = (app.workspace as unknown as { _?: Record<string, unknown[]> })._ ?? {};
      return Array.isArray(table['css-change']) ? table['css-change'].length : -1;
    });
    const before = await count();
    await browser.executeObsidian(({ app }) => {
      const ref = app.workspace.on('css-change', () => undefined);
      (activeWindow as Window & { ciProbeRef?: unknown }).ciProbeRef = ref;
    });
    const during = await count();
    await browser.executeObsidian(({ app }) => {
      app.workspace.offref((activeWindow as Window & { ciProbeRef?: never }).ciProbeRef as never);
    });
    const after = await count();
    await writeEvidence(directory, 'probe', { before, during, after });
    expect(before).toBeGreaterThanOrEqual(0);
    expect(during).toBe(before + 1);   // positive control: a leak is visible
    expect(after).toBe(before);
  });
  ```

  The other probes, in the same shape:
  - **b:** open two city leaves, `page.disablePlugin(PLUGIN_ID)`, then record for the view type: `getLeavesOfType(...).length`, each leaf's `view.getViewType()`, and the `.codebase-inspector-root` count; `enablePlugin`, and record them again.
  - **c:** write `localStorage.setItem('ci-probe','1')` and a vault file `probe-c.md`, open a city leaf, `await browser.reloadObsidian()`, and read all three back.
  - **d:** register a `css-change` counter, call `app.changeTheme('moonstone')`, then `'obsidian'`, and record the counter and `document.body.classList` each time.
  - **e:** copy the project, scan `code` (the `inspector.scanFolder` step), open the city route, screenshot the `canvas` in the leaf in each theme, decode it, and record the corner pixel against `resolvedColor('--ci-surface')`.
  - **f:** scan (which creates the profile), `openPluginSettings`, and record the tab content's `outerHTML` length, whether the profile name appears, and the DOM path to the profile's rows (a list, a page or inline).
  - **g:** for 2 000, 10 000 and 30 000 files, time an uncancelled scan and, with `FALLOW_BIN`, an uncancelled fallow run.
  - **h:** `makeJunction(join(vault,'code'), join(tmpdir(),'ci-alias-<n>'))`; record the result, and `fs.realpathSync.native` of the vault path against `getVaultPath()` (the 8.3 form); then scan the junction in absolute-folder mode and record the snapshot's file count against the plain scan.
  - **i:** reading-view render of `a@x.io` and `<a@x.io>`, counting `a.external-link` and `a[href^="mailto:"]`.
  - **j:** replace `app.fileManager.processFrontMatter` with a rejecting function for one call, call it, restore it, and call it again.
  - **k:** click `.side-dock-ribbon-action[aria-label="Open codebase city"]` and count the city leaves.

- [ ] **Step 2: Run the probes.**
  Run: `npm run build` then `node node_modules/vitest/vitest.mjs run --config tests/e2e/vitest.config.mts tests/e2e/probes.e2e.ts`
  Expected: each positive control passes. Copy every `reports/native/cases/*probe*/probe.json` into the task report. Do **not** interpret a failed control as a probe outcome; report it and stop.

- [ ] **Step 3: Write the helpers from the observed facts.** Write `host-probes.ts`, `workspace-files.ts` and `png.ts` with the Produces signatures above, and add the three `inspector.ts` steps. `png.ts`:

  ```ts
  import { inflateSync } from 'node:zlib';

  export interface Png { width: number; height: number; pixel(x: number, y: number): [number, number, number, number] }

  /** 8-bit truecolour (2) or truecolour+alpha (6), non-interlaced: all a WebDriver screenshot produces. */
  export function decodePng(bytes: Buffer): Png {
    const chunks: Buffer[] = [];
    let width = 0; let height = 0; let channels = 0;
    for (let at = 8; at < bytes.length;) {
      const length = bytes.readUInt32BE(at);
      const type = bytes.toString('latin1', at + 4, at + 8);
      const data = bytes.subarray(at + 8, at + 8 + length);
      if (type === 'IHDR') {
        width = data.readUInt32BE(0); height = data.readUInt32BE(4);
        if (data[8] !== 8 || data[12] !== 0 || (data[9] !== 2 && data[9] !== 6)) throw new Error('unsupported PNG');
        channels = data[9] === 6 ? 4 : 3;
      } else if (type === 'IDAT') chunks.push(data);
      at += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(chunks));
    const stride = width * channels;
    const out = Buffer.alloc(height * stride);
    for (let y = 0; y < height; y += 1) {
      const filter = raw[y * (stride + 1)];
      for (let x = 0; x < stride; x += 1) {
        const value = raw[y * (stride + 1) + 1 + x]!;
        const left = x >= channels ? out[y * stride + x - channels]! : 0;
        const up = y > 0 ? out[(y - 1) * stride + x]! : 0;
        const upLeft = y > 0 && x >= channels ? out[(y - 1) * stride + x - channels]! : 0;
        const paeth = (): number => {
          const p = left + up - upLeft; const pa = Math.abs(p - left); const pb = Math.abs(p - up); const pc = Math.abs(p - upLeft);
          return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        };
        const predictor = [0, left, up, (left + up) >> 1, paeth()][filter ?? 0] ?? 0;
        out[y * stride + x] = (value + predictor) & 0xff;
      }
    }
    return {
      width, height,
      pixel: (x, y) => {
        const i = y * stride + x * channels;
        return [out[i]!, out[i + 1]!, out[i + 2]!, channels === 4 ? out[i + 3]! : 255];
      },
    };
  }
  ```

  In `investigation.e2e.ts`, replace its local `hashTree`, `cycleFinding` and `RECORDING` with imports from `./workspace-files`, with no other change.

- [ ] **Step 4: Positive control for the helpers.** In the scratch file, add one test that runs `decodePng` on the Step 2 probe e screenshot and checks it against the probe's own recorded pixel. Add one that runs `listenerCounts` → `leakedListeners` around the probe a leak, and expects `['workspace:css-change']`. Run both; expected PASS.

- [ ] **Step 5: Gate and commit.** Delete `tests/e2e/probes.e2e.ts`. Then:
  - run `npm run typecheck && npm run lint:fast && npx eslint tests/e2e --max-warnings 0`;
  - run the spine alone: `node node_modules/vitest/vitest.mjs run --config tests/e2e/vitest.config.mts tests/e2e/investigation.e2e.ts` (expected PASS: the move changed nothing);
  - commit `test(e2e): shared host probes, run-time fixtures and a PNG reader for native coverage (WP-04 Part 2 Task 1)`.

  `required-scenarios.json` does not change in this task.

---

### Task 2: Settings — native coverage and the refresh fix (NE9, scenarios 10–14)

**Files:**
- Create: `tests/e2e/settings.e2e.ts`, `tests/unit/plugin-data-watch.test.ts`
- Modify:
  - `src/adapters/storage/plugin-data-shape.ts`: `watchPluginData`, notifying from `writePluginDataSlice` and `updatePluginDataRecord`
  - `src/host/settings-tab.ts`: `refreshSoon()`, coalesced
  - `src/main.ts`: watch in `onload`, unwatch in `onunload`
  - `tests/host/plugin-onload.test.ts`: one case, the unwatch on unload
  - `tests/e2e/inspector.ts`: settings steps
  - `tests/e2e/required-scenarios.json`: + titles 10–14

**Interfaces:**
- Consumes: Task 1 `openPluginSettings`, `closeSettings`, `pluginData`, `settingsRow`, `copyProject`; `NOTES_FOLDER_SETTING_NAME`, `NOTES_FOLDER_PROBLEM` (`src/ui/audit-copy/investigation.ts:23,25`); `validationFailureText`-built Notice text (`src/domain/validator.ts`).
- Produces:
  ```ts
  // src/adapters/storage/plugin-data-shape.ts
  export function watchPluginData(plugin: Plugin, keys: readonly (keyof PluginDataShape)[], listener: () => void): () => void;
  // src/host/settings-tab.ts (public)
  refreshSoon(): void;   // one refresh() now; at most one more queued while it runs
  ```

- [ ] **Step 1: Write the native scenarios.** In `tests/e2e/settings.e2e.ts`, write scenarios 10–14 with the spec §5 titles. Scenario 11, which is RED today:

  ```ts
  test('the settings tab lists a codebase that scan-codebase created', async ({ native: { browser, page, inspector } }) => {
    copyProject(page.getVaultPath(), 'code');
    await inspector.openCity();
    // Positive control: the tab renders, and has no codebase yet.
    await openPluginSettings(browser);
    await expect.poll(() => settingsRow(NOTES_FOLDER_SETTING_NAME).isExisting()).toBe(false);
    await closeSettings(browser);
    await inspector.scanFolder('code');
    const saved = (await pluginData(browser)).profiles as { name: string }[];
    expect(saved).toHaveLength(1);
    await openPluginSettings(browser);
    await expect.poll(() => settingsRow(NOTES_FOLDER_SETTING_NAME).isExisting()).toBe(true);
    // The profile's own name, as data.json holds it, is on screen (probe f gives its element).
  }, 180_000);
  ```

  The other four scenarios:
  - **10:** after a scan, the settings tab renders the profile's rows: its name, the Excluded paths textarea, the notes folder input with the default folder, and Connect. Its positive control is the no-profile render from scenario 11.
  - **12:** type `${configDir}/x` into the notes folder input and blur it. A `.notice` holding `NOTES_FOLDER_PROBLEM['config-dir']` appears, and `data.json` `investigations` stays absent. Then type `Research/notes`: `investigations[profileId].folder === 'Research/notes'`, and the input shows it after `closeSettings`/`openPluginSettings`.
  - **13:** add `dist2` in Excluded paths, and the profile's `exclusions` include it. Then add `./dist`: a `.notice` holds the validation reason, the stored value is unchanged, and the textarea shows it. Finally `scan-codebase` opens the scope modal (`.modal-container [data-field="acknowledge"]` exists), because the scope fingerprint changed. The positive control is a second `scan-codebase` with no change, which opens no modal (`inspector.rescan()`).
  - **14:** Connect uses the source modal in vault-folder mode (`code`), and `data.json.bindings` holds one record whose `rootPath` ends with `code`. Clear binding opens a confirm modal: Cancel keeps the binding; confirming removes it.

- [ ] **Step 2: Show RED.**
  Run: `npm run build` then `node node_modules/vitest/vitest.mjs run --config tests/e2e/vitest.config.mts tests/e2e/settings.e2e.ts`
  Expected:
  - Scenario 11 FAILS: the tab still renders without the profile.
  - Scenarios 10 and 12–14: some pass. Show each one RED once under its spec §5 mutation. Paste all outputs.

- [ ] **Step 3: Write the fast failing test.** In `tests/unit/plugin-data-watch.test.ts`, over the mock `Plugin`:

  ```ts
  it('notifies a watcher after a write to a watched slice settles, never for another slice or an unchanged write', async () => {
    const plugin = new Plugin({} as never, {} as never);
    const heard: string[] = [];
    const stop = watchPluginData(plugin, ['profiles'], () => { heard.push('profiles'); });
    await writePluginDataSlice(plugin, 'reviews', () => ({ a: 1 }));
    await writePluginDataSlice(plugin, 'profiles', () => [{ profileId: 'p' }]);
    await writePluginDataSlice(plugin, 'profiles', (current) => current);   // unchanged: not written, not heard
    await updatePluginDataRecord(plugin, 'profiles', 'profileId', 'p', (r) => ({ ...(r as object), name: 'n' }));
    stop();
    await writePluginDataSlice(plugin, 'profiles', () => []);
    expect(heard).toEqual(['profiles', 'profiles']);
  });
  it('a throwing watcher neither fails the write nor stops the next watcher', async () => { /* two watchers, the first throws */ });
  ```

  Plus a `settings-tab` coalescing case in the same file, through `CodebaseInspectorSettingTab` built as `tests/component/settings-tab-purge.test.ts` builds it: three `refreshSoon()` calls while `profileStore.list` is pending must produce exactly two `list` calls. Run it; expected FAIL: `watchPluginData` is not exported.

- [ ] **Step 4: Implement.** In `plugin-data-shape.ts`:

  ```ts
  const watchers = new WeakMap<Plugin, Set<{ keys: ReadonlySet<keyof PluginDataShape>; listener: () => void }>>();

  /** WP-04.2 NE9: a write listener per plugin, so a surface that shows a slice (the Settings
   *  tab) hears writes it did not make. Heard after the write settles; a throwing listener is
   *  isolated. Returns the unwatch. */
  export function watchPluginData(plugin: Plugin, keys: readonly (keyof PluginDataShape)[], listener: () => void): () => void {
    const set = watchers.get(plugin) ?? new Set();
    watchers.set(plugin, set);
    const entry = { keys: new Set(keys), listener };
    set.add(entry);
    return () => { set.delete(entry); };
  }

  function notifyWritten(plugin: Plugin, key: keyof PluginDataShape): void {
    for (const entry of Array.from(watchers.get(plugin) ?? [])) {
      if (!entry.keys.has(key)) continue;
      try { entry.listener(); } catch { /* the listener's own failure, never the write's */ }
    }
  }
  ```

  Make `writePluginDataSlice` return whether it wrote. Call `notifyWritten(plugin, key)` after the locked write resolves, and only if it saved. `updatePluginDataRecord` notifies when it returns true.

  In `settings-tab.ts`:

  ```ts
  private refreshing: Promise<void> | null = null;
  private refreshQueued = false;

  /** WP-04.2 NE9: a write elsewhere (a scan's new profile, a note's exclusion, a fallow trust) re-reads
   *  the entries; while a refresh runs, at most one more is queued. */
  refreshSoon(): void {
    if (this.refreshing) { this.refreshQueued = true; return; }
    this.refreshing = this.refresh().finally(() => {
      this.refreshing = null;
      if (this.refreshQueued) { this.refreshQueued = false; this.refreshSoon(); }
    });
  }
  ```

  In `main.ts`, after `addSettingTab`:

  ```ts
  // WP-04.2 NE9: the tab follows every write to what it shows, whoever made it.
  this.unwatchSettings = watchPluginData(this, ['profiles', 'bindings', 'analyzers', 'investigations'], () => { settingTab.refreshSoon(); });
  ```

  Add `this.unwatchSettings?.(); this.unwatchSettings = null;` to `onunload`, with the field beside `unwatchAnalysis`. Add one `plugin-onload.test.ts` case: after `onunload`, a profile write no longer calls `refresh`.

- [ ] **Step 5: GREEN.**
  - Run the Step 3 file, then `npm run build` and the Step 2 native command. Expected: all PASS.
  - Run the three whole-`src` scans, `tests/host/plugin-onload.test.ts`, `tests/unit/plugin-data-shape.test.ts` and `tests/component/settings-tab*.test.ts`. Expected: PASS.
  - Run `npm run analyze`. Expected: 9.

- [ ] **Step 6: Commit.** Add titles 10–14 to `required-scenarios.json`, run the gate, and commit `fix(settings): follow data.json writes the tab did not make, with native Settings coverage (WP-04 Part 2 Task 2)`.

---

### Task 3: Plugin lifecycle — leaks and a reload (scenarios 1, 2)

**Files:**
- Create: `tests/e2e/plugin-lifecycle.e2e.ts`
- Modify: `tests/e2e/inspector.ts` (review and work-item steps), `tests/e2e/required-scenarios.json` (+ 1, 2)

**Interfaces:**
- Consumes: Task 1 `listenerCounts`, `leakedListeners`, `trackIntervals`, `liveIntervals`, `reloadPlugin`, `pluginData`, `copyProject`, `cycleFinding`, `RECORDING`; Task 2 settings steps; `inspector.scanFolder`, `importReport`, `selectFinding`.
- Produces (`inspector.ts`):
  - `reviewFinding(disposition: string): Promise<void>`: the evidence panel's Review button, then the review dialog's disposition control with that value, then save. Selectors come from `src/ui/screens/quality/FindingReviewDialog.vue`.
  - `addWorkItem(): Promise<string>`: the evidence panel's Add work item, then the editor's save. Returns the title the editor was pre-filled with (IP22). Selectors come from `src/ui/screens/workbench/WorkItemEditor.vue`.

- [ ] **Step 1: Write scenario 1.** Take `listenerCounts` and `trackIntervals` with the plugin disabled. Then:
  - `enablePlugin`; assert no city leaf exists (**enabling opens no tab**);
  - open two city leaves, scan `code`, and navigate one to Investigate (which starts the note index's four `registerEvent` listeners);
  - `disablePlugin`.

  Assert:
  - `leakedListeners(before, after)` is `[]`;
  - `liveIntervals` is 0;
  - `.codebase-inspector-root` and `.codebase-inspector-root canvas` counts are 0 in `document`.

  Write the probe b observations (leaf types before and after) to `writeEvidence(directory,'leaves',…)`. The positive control, first in the test, is the probe a leak made through `listenerCounts`, which `leakedListeners` reports.

- [ ] **Step 2: Write scenario 2** (timeout `300_000`):
  - scan `code`; Settings: set the notes folder `Research/notes`, and Connect to `code`;
  - `importReport(RECORDING)`, `selectFinding(cycleFinding().id)`, `reviewFinding(<a disposition value from FindingReviewDialog.vue>)`, `addWorkItem()`;
  - `const before = await pluginData(browser)`; `reloadPlugin`; `const after = await pluginData(browser)`; `expect(after).toEqual(before)`;
  - `before` must hold non-empty `profiles`, `bindings`, `investigations`, and a `reviews` record with one disposition and one work item. This is the positive control that the writes happened;
  - `localStorage` machine id (`app.loadLocalStorage` key from `plugin-data-binding-store.ts`) is unchanged;
  - UI after the reload: Settings shows the folder and the binding; `rescan`, `importReport`, `selectFinding`, and the evidence panel shows the disposition and the work item.

- [ ] **Step 3: RED proofs.** Run the spec §5 mutations: drop `offref(cssChangeRef)` for 1, and make `writePluginDataSlice` skip `saveData` for 2. Build, run, paste the FAIL, and revert (`git diff --stat src` must be empty afterwards).

- [ ] **Step 4: GREEN, then commit.** Run the file, expected PASS. Add titles 1 and 2 to `required-scenarios.json`, run the gate, and commit `test(e2e): plugin unload leaves nothing behind and data survives a reload (WP-04 Part 2 Task 3)`.

  If scenario 1 finds a leak, that is a bug under O2: stop, report the leaked name, and the controller dispatches the fix with a ruling.

---

### Task 4: Commands and the ribbon (scenarios 5, 6, 7)

**Files:**
- Create: `tests/e2e/commands.e2e.ts`
- Modify: `tests/e2e/inspector.ts` (`startScanNoWait`), `tests/e2e/required-scenarios.json` (+ 5, 6, 7)

**Interfaces:**
- Consumes: Task 1 `commandAvailable`, `writeSyntheticTree` (with the probe g size), `copyProject`, `RECORDING`; `inspector.openCity`, `scanFolder`, `importReport`.
- Produces (`inspector.ts`): `startScanNoWait(): Promise<void>`, which runs `scan-codebase` and returns once the run has started (`commandAvailable('codebase-inspector:cancel-scan')` is true).

- [ ] **Step 1: Scenario 5.**
  - `executeObsidianCommand('codebase-inspector:open-city')` twice: the leaf count goes 0 → 1 → 2.
  - Then click `.side-dock-ribbon-action[aria-label="Open codebase city"]`: 3.
  - The label is the plugin's own string from `main.ts:89`. If probe k found another selector, NPF names it.

- [ ] **Step 2: Scenario 6** (timeout `240_000`). The negative control comes first: with no scan, `commandAvailable(cancel-scan)` is false, and `executeObsidianCommand` rejects with "not found or failed".
  - **Positive control (NE8):** write the synthetic tree into `big/`, and scan `big` through the modals, timing it until the snapshot id changes. It must take ≥ 2 000 ms, else `throw new Error('mid-run window too short')`.
  - **The cancel:** `startScanNoWait()` (a refresh against the stored scope), `executeObsidianCommand('codebase-inspector:cancel-scan')`.
  - **Assertions:** the snapshot id stays the control's; `commandAvailable(cancel-scan)` goes back to false; the leaf shows the cancelled run state (the `runStore` status element from `src/ui/components/StatusBanner.vue`).

- [ ] **Step 3: Scenario 7.**
  - With a city leaf and no snapshot, `commandAvailable(import-analysis-report)` is false.
  - After `scanFolder('code')` it is true, and `importReport(RECORDING)` attaches the report.
  - Investigate then lists exactly the recording's normalised finding count (computed in Node through `parseFallowReportText` and `buildEvidenceReport`, as `cycleFinding` does). The row count is `.ci-investigate-row`, with Show more pressed until it is gone.

- [ ] **Step 4: RED proofs** under the spec §5 mutations. Then GREEN, titles, gate, and commit `test(e2e): open-city, the ribbon, cancel-scan mid-run and the import command by id (WP-04 Part 2 Task 4)`.

---

### Task 5: fallow from the command palette, and Settings after a trust (scenarios 8, 9, 15)

**Files:**
- Create: `tests/e2e/fallow.e2e.ts`
- Modify: `tests/e2e/inspector.ts` (`connectFallow(binary)`, `trustAndRun()`), `tests/e2e/required-scenarios.json` (+ 8, 9, 15)

**Interfaces:**
- Consumes: Task 1 `commandAvailable`, `writeSyntheticTree`, `openPluginSettings`, `pluginData`; Task 2 `refreshSoon` (through the real tab); the Data & scans fallow flow (`src/ui/screens/sources/ConnectFallowDialog.vue` `.ci-connect-fallow__*`, `FallowInstalledRoute.vue` `.ci-fallow-installed__*`, `FallowRunReview.vue`, `FallowRunPanel.vue` `.ci-fallow-run__*`).
- Produces (`inspector.ts`):
  ```ts
  fallowBinary(): string;   // FALLOW_BIN, else .fallow-bin/bin-path.txt, else throws naming both (NE7)
  connectFallow(binary: string): Promise<void>;   // Data & scans → Connect fallow → use installed → path → review
  ```

- [ ] **Step 1: Scenario 8** (timeout `300_000`):
  - scan `code`; `connectFallow(fallowBinary())`;
  - negative control first: the run command is available and nothing has been attached yet;
  - `executeObsidianCommand('codebase-inspector:run-fallow-analysis')`, then trust in the review;
  - poll until the run panel shows a collected report;
  - Investigate lists the same finding count as the imported recording's normaliser gives for this project, with origin collected.
  - Record fallow's version in `writeEvidence`.

- [ ] **Step 2: Scenario 9** (timeout `300_000`):
  - negative control: `commandAvailable(cancel-fallow-analysis)` is false and executing it rejects;
  - positive control: time one uncancelled run on the synthetic tree, which must take ≥ 2 000 ms (NE8);
  - then run again, poll `commandAvailable(cancel-fallow-analysis)` to true, and execute it;
  - the panel shows the cancelled state, no new collected report replaces the first, and no `fallow` child process remains (`tasklist /FI "IMAGENAME eq fallow.exe"` from Node, with a count of 0 once the poll settles).

- [ ] **Step 3: Scenario 15:** after `connectFallow` and a trust, `openPluginSettings`, and the codebase's fallow executable row shows the bound path. `pluginData().analyzers` holds it; that is the positive control that the write happened.
  - Show RED against the pre-NE9 build: check out `353e2c1 -- src/main.ts src/host/settings-tab.ts src/adapters/storage/plugin-data-shape.ts` into the working tree, build, run, then `git checkout HEAD -- src` and rebuild.
  - If it passes pre-NE9, use the spec §5 mutation instead.

- [ ] **Step 4: GREEN, titles, gate, commit** `test(e2e): run and cancel fallow by command id, and Settings shows a trusted executable (WP-04 Part 2 Task 5)`.

---

### Task 6: The note index in real Obsidian (scenarios 16, 17)

**Files:**
- Create: `tests/e2e/notes-index.e2e.ts`
- Modify: `tests/e2e/required-scenarios.json` (+ 16, 17)

**Interfaces:**
- Consumes: `inspector.scanFolder`, `importReport`, `selectFinding`, `createNote`, `notePaths`, `cachedFingerprint`; Task 1 `reloadPlugin`, `copyProject`, `cycleFinding`, `RECORDING`.

- [ ] **Step 1: Scenario 16:**
  - create a note;
  - create an unrelated note `Other/plain.md` and rename it (control: `notePaths()` unchanged, and the plain note's `cachedFingerprint` is `undefined`);
  - rename the **folder** holding the note through `app.fileManager.renameFile(folder, 'Moved folder')`;
  - poll `notePaths()` to `['Moved folder/<name>.md']` and `cachedFingerprint` to the fingerprint.

  This proves the per-file `rename` the index comment relies on.

- [ ] **Step 2: Scenario 17:**
  - create a note; `page.disablePlugin`;
  - move it with `app.fileManager.renameFile` to `Elsewhere/<name>.md` (no plugin listener exists);
  - `enablePlugin`, `openCity`, rescan, re-import, and select the finding;
  - `notePaths()` shows the new path.
  - Positive control: before the disable, `notePaths()` shows the old path.

- [ ] **Step 3: RED proofs** (spec §5), then GREEN, titles, gate, and commit `test(e2e): the note index follows a folder move and repairs a change made while disabled (WP-04 Part 2 Task 6)`.

---

### Task 7: Refresh outcomes in real Obsidian (scenarios 18, 19, 21)

**Files:**
- Create: `tests/e2e/notes-refresh.e2e.ts`
- Modify: `tests/e2e/inspector.ts` (`refreshNoteExpectingRefusal(path): Promise<string>`, which returns the dialog's `.ci-refresh-note__error` text), `tests/e2e/required-scenarios.json` (+ 18, 19, 21)

**Interfaces:**
- Consumes: `REFRESH_MARKERS_EDITED`, `REFRESH_PARTIAL` (`src/ui/audit-copy/investigation.ts:339,341`); the `refreshNote`, `readNote` and `frontmatter` steps; Task 1 `hashTree`.

- [ ] **Step 1: Scenario 18.** Create a note, rescan and re-import, then refresh once (positive control: its block changes).
  - Rescan again, then through `vault.process` duplicate the end marker line.
  - `const bytes = await readNote(path)`; `refreshNoteExpectingRefusal(path)` returns `REFRESH_MARKERS_EDITED`.
  - `readNote(path) === bytes`.

- [ ] **Step 2: Scenario 19.** Rescan, then patch `app.fileManager.processFrontMatter` to reject once (probe j), and restore it in a `finally` inside `executeObsidian`.
  - Refresh through the UI.
  - The announced or dialog text equals `REFRESH_PARTIAL(path)`.
  - The block holds the new snapshot id, while the frontmatter `snapshot_id` is still the old one.
  - Positive control: an unpatched refresh afterwards updates `snapshot_id`.

- [ ] **Step 3: Scenario 21 (NE14).** Hash `code/`.
  - Move the note into `code/notes/` with `renameFile`; rescan (the note is now a codebase file); re-import.
  - Refresh succeeds: the block is new and the human sections are byte-identical.
  - `hashTree(code)` equals the earlier hash, except for the note's own entry and its folder.
  - The rescan's file count is one more than before the move. That is the positive control that the note is inside the root.

- [ ] **Step 4: RED proofs** (spec §5), GREEN, titles, gate, and commit `test(e2e): refresh refuses edited markers, reports partial, and refreshes a note moved into the root (WP-04 Part 2 Task 7)`.

---

### Task 8: Notes inside the root, and alias overlap (scenarios 20, 22; NE15 fix if RED)

**Files:**
- Create: `tests/e2e/notes-root.e2e.ts`
- Modify: `tests/e2e/inspector.ts` (`createNoteIn(folder, exclude: boolean): Promise<string>`, `overlapOffered(): Promise<boolean>`), `tests/e2e/required-scenarios.json` (+ 20, 22)
- If scenario 22 is RED:
  - Modify: `src/adapters/filesystem/node-access.ts` (a synchronous `realPathOfNearest(path): string | null`), `src/host/investigation-notes.ts` (`planDestination` compares resolved paths when both resolve)
  - Create: `tests/host/investigation-notes-alias.test.ts`

**Interfaces:**
- Consumes: the `.ci-create-note__folder`, `.ci-create-note__exclude`, `.ci-create-note__overlap`, `.ci-create-note__confirm` elements (`CreateNoteDialog.vue:132–218`); Task 1 `makeJunction`, `copyProject`; Task 2 Connect in absolute-folder mode (the source modal's `absolute` radio and path field, `src/host/modals/source-modal.ts`).
- Produces (only if RED):
  ```ts
  // src/adapters/filesystem/node-access.ts
  export function realPathOfNearest(path: string): string | null;  // realpathSync.native of the deepest existing ancestor, the rest re-appended; null on any error
  ```

- [ ] **Step 1: Scenario 20:**
  - scan `code`; import; select;
  - `createNoteIn('code/notes', true)`;
  - `pluginData().profiles[0].exclusions` contains `notes`;
  - `scan-codebase` opens the scope modal (the fingerprint changed); approve;
  - the snapshot's file count equals the pre-note count.

  Positive control, in the same test: a second note in `code/other` with the box **un**checked, then a rescan: the count grows by one.

- [ ] **Step 2: Scenario 22.** Make a junction `<tmp>/ci-alias-<random>` → `<vault>/code`; if probe h made junctions impossible, use the 8.3 alias it recorded.
  - Connect the profile in absolute-folder mode to the alias, scan, import, select.
  - Open the create dialog with the folder `code/notes`.
  - Expected: `overlapOffered()` is true.
  - Positive control: vault-folder mode on the same folder offers it.
  - Remove the junction in a `finally` (`fs.rmSync(link)`, never recursive into the target).

- [ ] **Step 3: If 22 is RED (expected):**
  1. Write `tests/host/investigation-notes-alias.test.ts` first. It uses a real temp directory, a real junction (`fs.symlinkSync(target, link, 'junction')`, skipped with a recorded reason on non-Windows) and the fake vault with `basePath` set to the target. `plan()` with `rootPath` set to the link must return `overlapsRoot: true` and `rootRelativeFolder: 'notes'`. Run it: FAIL.
  2. Implement `realPathOfNearest` and use it in `planDestination`, where the base-path join is compared to the root. When both resolve, compare the resolved forms (case-insensitive unless `Platform.isLinux`); otherwise keep the textual comparison.
  3. GREEN, fast and native.
  4. Run the whole-`src` scans (the boundary test lists `node-access.ts` already) and `npm run analyze` (expected 9).

  If 22 is GREEN on 353e2c1, it is pinned by the spec §5 mutation, and no `src` change is made.

- [ ] **Step 4: Titles, gate, commit.** `fix(notes): overlap holds through a junction or 8.3 alias, with native in-root coverage (WP-04 Part 2 Task 8)`, or `test(e2e): …` if nothing in `src` changed.

---

### Task 9: The source preview in real Obsidian (scenarios 23, 24)

**Files:**
- Create: `tests/e2e/preview.e2e.ts`
- Modify: `tests/e2e/required-scenarios.json` (+ 23, 24)

**Interfaces:**
- Consumes: `.ci-source-preview__text [aria-current="true"]`, `.ci-source-preview__unavailable`, `.ci-source-preview__open-obsidian` (`SourcePreviewPanel.vue:107–171`), `.ci-notes-panel__open`; Task 1 `writeReport`, `copyProject`; Task 2 Connect/Reconnect steps.

- [ ] **Step 1: Scenario 23:**
  - copy `code` and `code-copy`; Connect to `code`; scan; import; select the cycle finding;
  - exactly one highlighted line (the positive control);
  - Reconnect to `code-copy`;
  - select the finding again (or Reload); `.ci-source-preview__unavailable` shows, and the highlighted count is 0;
  - `writeEvidence` the unavailable state's text.

- [ ] **Step 2: Scenario 24:**
  - write `code/docs/guide.md` (one line) before the scan;
  - `writeReport(join(directory,'md-anchor.json'), raw => …)` sets one `unused_files` path (or, if the recording has none, one `unused_exports` path) to `docs/guide.md`;
  - scan, import, select that finding;
  - `.ci-source-preview__open-obsidian` exists; click it; a new `markdown` leaf whose `view.file.path` is `code/docs/guide.md` appears (leaf count + 1);
  - Open note: create a note for the cycle finding and click `.ci-notes-panel__open[data-path=…]`: another new markdown leaf on that path;
  - control: selecting the `.ts` cycle finding shows no `open-obsidian` button.

- [ ] **Step 3: RED proofs, GREEN, titles, gate, commit** `test(e2e): bound preview and a changed root, Open in Obsidian and Open note (WP-04 Part 2 Task 9)`.

---

### Task 10: The city in real themes, and a layout restore (scenarios 3, 4)

**Files:**
- Create: `tests/e2e/city.e2e.ts`
- Modify: `tests/e2e/required-scenarios.json` (+ 3, 4)

**Interfaces:**
- Consumes: Task 1 `setTheme`, `canvasShot`, `resolvedColor`, `decodePng`; `inspector.openCity`, `scanFolder`, `navigate`; `browser.reloadObsidian()` (probe c).

- [ ] **Step 1: Scenario 3.**
  - Setup: scan `code`, then open the city route (the route with the canvas; `navigate` with the nav label constant for City from `src/ui/routes.ts`).
  - Positive control, first: `setTheme('dark')` and read `resolvedColor('--ci-surface')`; `setTheme('light')` and read it again. Some channel must differ by > 24.
  - Each theme, in the order dark, light, dark: `canvasShot` the corner pixel (probe e's coordinates) must match that theme's colour within 3 per channel.
  - Unchanged across the switches: the canvas element's WebDriver id, and the leaf's `getState()` camera and selection.

- [ ] **Step 2: Scenario 4** (timeout `300_000`):
  - open a city leaf, navigate to Quality, and `await app.workspace.requestSaveLayout.run()` inside `executeObsidian` (or poll `workspace.json` for `route` if probe c showed that API is absent);
  - positive control: `workspace.json`'s leaf state has `route: 'quality'`, and no substring equal to `page.getVaultPath()`;
  - `browser.reloadObsidian()`; reveal the city leaf (`app.workspace.revealLeaf(getLeavesOfType(type)[0])`);
  - `.ci-screen--quality` is displayed, `.ci-no-snapshot` exists, `.modal-container` count is 0, and `commandAvailable(cancel-scan)` is false.

- [ ] **Step 3: RED proofs, GREEN, titles, gate, commit** `test(e2e): the city recolours in real dark and light themes and a restored leaf keeps its route (WP-04 Part 2 Task 10)`.

---

### Task 11: Code spans and email autolinks (scenarios 25, 26; NE16 fix if needed)

**Files:**
- Modify: `tests/e2e/obsidian-facts.e2e.ts` (+2 tests, ≤ 450 lines), `tests/e2e/required-scenarios.json` (+ 25, 26)
- If the bare email links after `noteText`:
  - Modify: `src/application/investigation/note-text.ts` (escape `@`)
  - Create: a pin in a new `tests/unit/note-text-email.test.ts`
  - Update: the probe literals in `tests/support/probe-strings.ts` only if the IP52 pin requires it

**Interfaces:**
- Consumes: `mdCode` (`src/application/markdown-code.ts:8`), `noteText` (`src/application/investigation/note-text.ts:39`), and the file's own `renderReading` and `renderLivePreview`.

- [ ] **Step 1: Scenario 25:**
  - `const hostile = 'a %%c%% $x$ ==y== b'`;
  - render `hostile` (control: `mark`, `.math` present, `c` hidden) and `mdCode(hostile)` (one `code` element whose `textContent` is `hostile`, 0 `mark`, 0 `.math`) in reading view;
  - in live preview: 0 highlight, math or comment tokens for the code-span version, and each present for the control.

- [ ] **Step 2: Scenario 26:**
  - render `<a@x.io>` (control: it links), `a@x.io` (observed, recorded), `noteText('<a@x.io>')` and `noteText('a@x.io')` in reading view and live preview;
  - both escaped forms produce 0 `a.external-link` and 0 `mailto:` anchors.

- [ ] **Step 3: If the escaped bare form links (RED):**
  1. Write the unit pin first: `noteText('a@x.io')` equals `a\@x.io`. Run it: FAIL.
  2. Add `@` to the escaped set in `note-text.ts`, and re-run `tests/unit/note-text*.test.ts` and the IP52 pin.
  3. Native GREEN; whole-`src` scans; `npm run analyze` 9.

- [ ] **Step 4: Titles, gate, commit.** `test(e2e): code spans and email addresses stay inert in real Obsidian (WP-04 Part 2 Task 11)`, or `fix(notes): …` if `src` changed.

- [ ] **Step 5 (controller):** the full suite runs after this task: `npm run verify`. Expected: only the two evidence-count tests fail (Task 12 refreshes them); record the result in the ledger.

---

### Task 12: Evidence, the latest run and the full verification

**Files:**
- Modify:
  - `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`: the G8 table counts, plus a "WP-04 Part 2 native coverage" subsection giving the command, the gate line, versions, platform and commit, for the baseline run and the latest run (IP53: still no G8 row for native cases)
  - `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`: the mirror
  - `docs/deliverables/Test Evidence.md`: one paragraph naming the 36 native scenarios by file, and O3's no-CI
  - `tests/unit/gate-evidence.test.ts`, `tests/unit/evidence-numbers.test.ts`: only if their pinned numbers change (edited in place; `evidence-numbers.test.ts` stays ≤ 450)

**Interfaces:**
- Consumes: every earlier task; `reports/native/vitest-results.json`.

- [ ] **Step 1: Full verification, in order, each in the foreground:**
  - `npm run verify`. Expected exit 0 after the count refresh below.
  - `npm run test:e2e`. Expected: `Verified N executed native Vitest cases, including all 36 required scenarios.`
  - `OBSIDIAN_VERSION=latest npm run test:e2e` (PowerShell: `$env:OBSIDIAN_VERSION='latest'; npm run test:e2e`). Expected: the same line. Record the resolved app version from a case's `environment.json`.
  - `FALLOW_BIN=%LOCALAPPDATA%/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe npm run test:fallow`. Expected: PASS.
  - `npm run analyze`. Expected: 9.
  - `npm run harness-shot`. Open the captures in `reports/`; NE9 touches no UI, so they must be unchanged in kind. Say which ones were looked at.

- [ ] **Step 2: Refresh the evidence counts once** (L28, IP53) from `find tests -name "*.test.ts"` per layer and the verify output. Re-run the two evidence tests; expected PASS.

- [ ] **Step 3: Commit** `docs(evidence): WP-04 Part 2 native coverage, counts and the latest run (WP-04 Part 2 Task 12)`.

## Self-review notes (controller)

- **Spec coverage:** every §5 scenario has a task:
  - 1, 2 → Task 3
  - 3, 4 → Task 10
  - 5–7 → Task 4
  - 8, 9, 15 → Task 5
  - 10–14 → Task 2
  - 16, 17 → Task 6
  - 18, 19, 21 → Task 7
  - 20, 22 → Task 8
  - 23, 24 → Task 9
  - 25, 26 → Task 11

  NE9 → Task 2; NE15 → Task 8; NE16 → Task 11. Every §6 probe → Task 1. O4's latest run → Task 12.
- **Ordering:** Task 2 lands NE9 before Task 5 needs it. Task 1's helpers precede every consumer. `src` changes can happen only in Tasks 2, 8 and 11, so the full suite runs after Task 11.
- **Discovery by design:** some selectors (Settings rows, the review dialog, the fallow dialogs) depend on probe f and on reading the named component. Each task names the file to read and the element to find; a selector chosen there is reported, never guessed.
