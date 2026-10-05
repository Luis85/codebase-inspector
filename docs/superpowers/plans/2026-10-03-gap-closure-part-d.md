# Gap closure — Part D (harness, evidence and minors) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every native run trustworthy and diagnosable, close the accepted proof gaps, and finish the Part D minors (spec rows GRD1–GRD15). The native gate grows from 40 to 41 required scenarios (scenario 41).

**Architecture:**
- **Native harness only:** `scripts/native-tests.mjs`, `tests/e2e/**`, `tests/support/**` and one new script module.
- **Fast tests:** the Z38 test, a static guard, the parity test and the minor tests.
- **`src` changes:**
  - `src/application/analysis/fallow-analysis-service.ts`, `src/ui/stores/analysis-store.ts` and `src/ui/screens/sources/FallowInstalledRoute.vue` (GRD14's narrowed return type);
  - one copy constant removed from `src/ui/audit-copy/fallow-run.ts`.
- **Crash work (GRD1)** is investigation-led. The remedy is chosen from evidence, under rulings, never guessed.

**Tech Stack:** TypeScript 6.0.3, Vue 3.5.43, Vitest 5.0.1, Node 24.15.0, WebdriverIO 9.32.0 and `wdio-obsidian-service` 3.2.1 on Obsidian 1.13.4 (baseline) and `latest`, fallow 3.27.0 through `FALLOW_BIN`.

**Spec:** `docs/superpowers/specs/2026-10-03-gap-closure-design.md`, §3.1 (GRD1–GRD15), §5 (scenario 41), GCN7, GCO22, GCO25.
- **Rulings:** `docs/superpowers/notes/2026-10-03-gap-closure-ledger.md` (GCP1–GCP12). Execution rulings are "Gap-closure E1…".

**Branch:** `feat/gap-closure` in `.claude/worktrees/gap-closure`, from `1baa572`, with the spec committed (`4996187`). `npm ci` is done and `.obsidian-cache/` is copied. At the end the branch is fast-forward-pushed onto `feat/wp-01-codebase-city` only, on the owner's go-ahead (a push to a shared branch); `feat/gap-closure` itself is never pushed.

## Global Constraints

**Repository rules:**
- Caps: **400** lines for `src/**/*.{ts,vue}` and **450** for tests (`tests/e2e/**` and `tests/support/**` included).
- `tests/e2e/inspector.ts` is at exactly **400**: a new shared step goes in a new `tests/e2e/inspector-<concern>.ts`.
- Layering: only `src/adapters/filesystem/node-access.ts` may `window.require` `fs`, and `src/ui/**` never imports adapters or host.
- Copy lives only in `src/ui/audit-copy` (and the established copy modules).
- CRLF files are edited only with Edit/Write, never `sed`, heredocs or scripts. The two evidence notes (`2026-09-17-wp01-gate-evidence.md`, `2026-09-17-wp01-implementation-report.md`) are CRLF; check them byte-level afterwards.
- `npm run analyze` stays at **9**: a new dead export is removed, never baselined.

**Process rules:**
- **Never run `git stash` in any form.** RED is shown by a temporary Edit that is reverted.
- Tests are written and run RED before the code. A RED rebuilt after the code is written is not accepted.
- Every commit message ends with the literal trailer **"Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"**, whatever model runs. Stage explicit paths, never `git add -A`.
- Worktree-isolated sessions refuse shell commands that compute a program name at runtime: run plain, separate commands.
- Slow work gets explicit timeouts.
- **Disclose every `npm run test` / `npm run verify` run with its Z38 outcome:** pass with figures, fail with figures, or skip with the control figure.

**TypeScript and lint:**
- ES2020 `lib` only: no `.at()`, `Object.hasOwn`, `replaceAll` or `findLast`.
- oxlint `--deny-warnings`; `Array.from(set)`, never `[...set]`.
- PF1 timers; no redundant `as`; no `undefined` assigned to an optional property.

**Native discipline** (IN42–IN51, IPF20, E6/E7, NPF7, NPF13):
- One fixture session per test; `retry: 0`; `expect.poll` for every wait, never a sleep.
- Never match Obsidian's own UI text (the locale is German); attribute selectors such as `[data-setting-id="appearance"]` are not text.
- Plugin words come only from imported copy constants or `ROUTE_META`.
- Settings open in their own window (NPF7); a refusal is never asserted as a throw (NPF13).
- A positive control for every probe and every negative assertion.
- A RED on record for every new or changed scenario.
- `FALLOW_BIN` is a pure-backslash path: `Join-Path $env:LOCALAPPDATA 'npm-cache\_npx\ee3f2ca80543beb5\node_modules\@fallow-cli\win32-x64-msvc\fallow.exe'`.
- **No retries:** a failed or crashed run is reported as it is.
- After Task 1, every native run goes through the load gate.

**Running native tests while developing:** after a `src` change, `npm run build`. One file: `node node_modules/vitest/vitest.mjs run --config tests/e2e/vitest.config.mts tests/e2e/<file>.e2e.ts` (add `-t "<title>"` for one test). Acceptance is always `npm run test:e2e`.

**Per-task gate** (each its own command):
- `npm run typecheck`
- `npm run lint:fast`
- `npx eslint <touched files> --max-warnings 0`
- `npx vitest run <the task's fast test files>`
- the touched native files through the NP4 command.

`tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` may fail on counts until Task 8; do not fix them early.

**Size now** (at `4996187`):

| File | Lines |
|---|---|
| `scripts/native-tests.mjs` | 23 |
| `scripts/check-native-results.mjs` | 18 |
| `tests/e2e/vitest.config.mts` | 21 |
| `tests/e2e/diagnostics.ts` | 25 |
| `tests/e2e/fixture.ts` | 54 |
| `tests/e2e/session.ts` | 51 |
| `tests/support/session-lifecycle.ts` | 90 |
| `tests/unit/native-results-gate.test.ts` | 74 |
| `tests/integration/fallow-no-freeze.test.ts` | 59 |
| `tests/e2e/settings.e2e.ts` | 216 |
| `tests/e2e/city.e2e.ts` | 168 |
| `tests/e2e/commands.e2e.ts` | 213 |
| `tests/e2e/inspector.ts` | **400** |
| `tests/e2e/required-scenarios.json` | 42 |
| `src/application/analysis/fallow-analysis-service.ts` | 329 |
| `src/ui/stores/analysis-store.ts` | 137 |
| `src/ui/screens/sources/FallowInstalledRoute.vue` | 244 |
| `tests/unit/investigation-note-path.test.ts` | 92 |

## Review Focus

1. **The load gate never produces a pass:** a refused run exits non-zero, spawns no Vitest and leaves no report for the gate to read.
2. **Run-scoped evidence never mixes runs:** two runs keep separate case folders, and a crash run's evidence survives a later run.
3. **Breadcrumbs survive a hard crash:** they are written with synchronous appends, and they never throw into a test (a failing breadcrumb is swallowed and counted).
4. **The Z38 best-of-3 still fails a real freeze on an idle machine**, and it skips (never fails) when either control shows load.
5. **Scenario 41 releases through `hide()`, not through a focusout.** Its control proves the search was stale before the tab switch.

---

### Task 1: Run-scoped native evidence, crash breadcrumbs and the load gate (GRD1 steps 1–4, GRD4)

**Files:**
- Create:
  - `scripts/native-load-gate.mjs`;
  - `tests/unit/native-load-gate.test.ts`;
  - `tests/e2e/breadcrumbs.ts`.
- Modify:
  - `scripts/native-tests.mjs`;
  - `tests/e2e/vitest.config.mts`;
  - `tests/e2e/diagnostics.ts`;
  - `tests/e2e/fixture.ts`;
  - `tests/e2e/session.ts`;
  - `tests/unit/native-results-gate.test.ts`.

**Interfaces:**
- Produces:
  - `awaitQuietMachine(options): Promise<{ ok: boolean; load: number; waitedMs: number }>` from `scripts/native-load-gate.mjs`;
  - `sampleCpuPercent(windowMs: number): Promise<number>`;
  - `breadcrumb(phase: string, extra?: Record<string, unknown>): void` from `tests/e2e/breadcrumbs.ts`;
  - `runDirectory(): string` from `tests/e2e/diagnostics.ts`;
  - the env var `NATIVE_RUN_DIR`, set by `native-tests.mjs` and read by the config, diagnostics and breadcrumbs.

- [ ] **Step 1: RED, the load gate.** Create `tests/unit/native-load-gate.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { awaitQuietMachine } from '../../scripts/native-load-gate.mjs';

const fakeClock = () => { let now = 0; return { now: () => now, sleep: async (ms: number) => { now += ms; } }; };

describe('native load gate (GRD4, GCP10)', () => {
  it('runs at once when the machine is quiet', async () => {
    const clock = fakeClock();
    const sample = vi.fn(async () => 20);
    const result = await awaitQuietMachine({ sample, threshold: 50, maxWaitMs: 900_000, pollMs: 30_000, ...clock });
    expect(result).toEqual({ ok: true, load: 20, waitedMs: 0 });
    expect(sample).toHaveBeenCalledTimes(1);
  });

  it('waits while loaded and runs once the load drops', async () => {
    const clock = fakeClock();
    const loads = [80, 75, 30];
    const result = await awaitQuietMachine({ sample: async () => loads.shift() ?? 30, threshold: 50, maxWaitMs: 900_000, pollMs: 30_000, ...clock });
    expect(result).toEqual({ ok: true, load: 30, waitedMs: 60_000 });
  });

  it('refuses after the maximum wait, naming the load', async () => {
    const clock = fakeClock();
    const result = await awaitQuietMachine({ sample: async () => 90, threshold: 50, maxWaitMs: 60_000, pollMs: 30_000, ...clock });
    expect(result.ok).toBe(false);
    expect(result.load).toBe(90);
  });
});
```

  Run `npx vitest run tests/unit/native-load-gate.test.ts`. **Expected RED:** the module cannot be resolved.
- [ ] **Step 2: GREEN, the load gate.** Create `scripts/native-load-gate.mjs`:

```js
import { cpus } from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';

/** GRD4 (GCP10): the machine's total CPU use over `windowMs`, from os.cpus() tick deltas. */
export async function sampleCpuPercent(windowMs = 10_000) {
  const ticks = () => cpus().reduce((sum, cpu) => {
    const t = cpu.times;
    return { idle: sum.idle + t.idle, total: sum.total + t.user + t.nice + t.sys + t.idle + t.irq };
  }, { idle: 0, total: 0 });
  const before = ticks();
  await wait(windowMs);
  const after = ticks();
  const total = after.total - before.total;
  return total <= 0 ? 0 : Math.round(100 * (1 - (after.idle - before.idle) / total));
}

/** Waits for a quiet machine, up to maxWaitMs; never reports a pass for a run that did not happen. */
export async function awaitQuietMachine({ sample, threshold, maxWaitMs, pollMs, now = Date.now, sleep = (ms) => wait(ms) }) {
  const started = now();
  for (;;) {
    const load = await sample();
    const waitedMs = now() - started;
    if (load < threshold) return { ok: true, load, waitedMs };
    if (waitedMs + pollMs > maxWaitMs) return { ok: false, load, waitedMs };
    await sleep(pollMs);
  }
}
```

  Run the test GREEN. If a type error appears where the test imports an `.mjs` module, add a small `scripts/native-load-gate.d.mts` declaration beside it, in the style of the existing `scripts/harness-shot.mjs` import in `tests/build/harness-shot.test.ts`; read that first.
- [ ] **Step 3: Run-scoped evidence.** In `scripts/native-tests.mjs`:
  1. Compute the run directory before the build: `const runDir = path.resolve('reports/native/runs', `${new Date().toISOString().replace(/[:.]/gu, '-')}-${process.env.OBSIDIAN_VERSION ?? 'baseline'}`)`; create it.
  2. Set `process.env.NATIVE_RUN_DIR = runDir`, so the Vitest child inherits it.
  3. Before the build, call `awaitQuietMachine({ sample: () => sampleCpuPercent(10_000), threshold: 50, maxWaitMs: 15 * 60_000, pollMs: 30_000 })`. Log each wait to the console with the load figure. On `ok: false`, print `Native run refused: the machine stayed at ${load}% CPU (threshold 50%) for 15 minutes.` and `process.exit(3)` before the build, before removing the stale report, and before spawning Vitest. Write `load-gate.json` (load, waitedMs, ok) into the run directory in both cases.
  4. After Vitest finishes, copy `reports/native/vitest-results.json` and `junit.xml` into the run directory with `copyFile` (ignore a missing file). The gate keeps reading the top-level report.

  Keep the file's existing comments, and add one line citing GRD1 and GRD4.
- [ ] **Step 4: Cases under the run.** `tests/e2e/diagnostics.ts`:
  - Add `export function runDirectory(): string { return process.env.NATIVE_RUN_DIR ?? path.resolve('reports/native'); }`.
  - `caseDirectory` writes under `path.join(runDirectory(), 'cases', safe)`.
- [ ] **Step 5: Breadcrumbs.** Create `tests/e2e/breadcrumbs.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { runDirectory } from './diagnostics';

let failures = 0;

/** GRD1: one synchronous NDJSON line per session phase, so a worker that dies by __fastfail leaves its last phase on disk.
 *  Never throws into a test: a failed append is counted and reported in the next line. */
export function breadcrumb(phase: string, extra: Record<string, unknown> = {}): void {
  try {
    const memory = process.memoryUsage();
    appendFileSync(path.join(runDirectory(), 'breadcrumbs.ndjson'), `${JSON.stringify({
      at: new Date().toISOString(), pid: process.pid, phase, rss: memory.rss, heapUsed: memory.heapUsed,
      handles: process.getActiveResourcesInfo().length, breadcrumbFailures: failures, ...extra,
    })}\n`);
  } catch {
    failures += 1;
  }
}

/** Obsidian and chromedriver processes on the machine (one tasklist call); null where tasklist is unavailable. */
export function hostProcessCounts(): { obsidian: number; chromedriver: number } | null {
  if (process.platform !== 'win32') return null;
  const listed = spawnSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
  if (listed.status !== 0 || typeof listed.stdout !== 'string') return null;
  const names = listed.stdout.split(/\r?\n/u).map((line) => line.split('","')[0]?.replace(/^"/u, '').toLowerCase() ?? '');
  return { obsidian: names.filter((n) => n === 'obsidian.exe').length, chromedriver: names.filter((n) => n === 'chromedriver.exe').length };
}
```

  Then:
  - In `tests/e2e/session.ts`, wrap each step in `createNativeSession` with `breadcrumb('prepare:start')`/`breadcrumb('prepare:end')`, and the same for `connect`, `initialize`, `disconnect` and `cleanup`. Keep the existing order.
  - In `tests/e2e/fixture.ts`, call `breadcrumb('case:start', { file: task.file?.filepath, test: task.name, processes: hostProcessCounts() })` before the session, and `breadcrumb('case:end', { test: task.name, state: task.result?.state ?? 'unknown', processes: hostProcessCounts() })` in the `finally`.
- [ ] **Step 6: `environment.json` and Node fatal reports.**
  - In `fixture.ts`'s environment evidence, add:
    - `node: process.versions.node`, `uv: process.versions.uv`, `v8: process.versions.v8`;
    - `chromedriver: browser.capabilities` → the chromedriver version, if the capabilities expose one (read `browser.capabilities` once and record `chrome.chromedriverVersion` or the raw `browserVersion`);
    - `cpuPercentAtStart`: leave it out (the gate records the run's load).
  - In `tests/e2e/vitest.config.mts`, add `execArgv: ['--report-on-fatalerror', '--report-uncaught-exception', `--report-directory=${path.join(process.env.NATIVE_RUN_DIR ?? path.resolve('reports/native'), 'node-reports')}`]` inside `test`. Confirm the option name against Vitest 5.0.1's types (`node_modules/vitest/dist/chunks/plugin.d.*.d.ts`, search `execArgv`). If it lives under `poolOptions.forks.execArgv` in 5.0.1, use that.
- [ ] **Step 7: A crash-shaped gate fixture.** In `tests/unit/native-results-gate.test.ts`, add a case where one file still has a `pending` result, `success` is `false`, and the report holds fewer cases than required. Expect rejection with `Native Vitest did not report success.` This pins that a worker crash can never satisfy the gate. It passes on the current gate (green-only; this is coverage of an existing guard), so record a mutation RED: temporarily delete the `report.success` assertion in `check-native-results.mjs`; the case must then fail on its next guard, not pass. Revert.
- [ ] **Step 8: Native check.** Run `npm run build`, then `smoke.e2e.ts` through the NP4 command with `NATIVE_RUN_DIR` set by hand to a temporary run folder. Confirm:
  - `cases/<id>…/environment.json` carries the Node and chromedriver fields;
  - `breadcrumbs.ndjson` has `case:start`, every session phase and `case:end` for both smoke tests.

  Then run `npm run test:e2e` once on the baseline, through the gate. Report the run directory, its `load-gate.json`, and whether all 40 passed. A crash here is evidence for Task 6, never retried; report it.
- [ ] **Step 9: Gate and commit.** Subject: `test(native): run-scoped evidence, crash-safe breadcrumbs, Node fatal reports and a CPU load gate for native runs (gap closure GRD1, GRD4)`.

---

### Task 2: The Z38 best-of-3 and the post-control (GRD2, GCO22)

**Files:** Modify `tests/integration/fallow-no-freeze.test.ts`.

**Interfaces:** Consumes the existing `startGapSampler()`, `LOADED_CONTROL_MS`, `world()`, `trackedSpawn` and `FAKE`.

- [ ] **Step 1: The freeze mutation RED first, on the unchanged file.** Add a temporary synchronous 80 ms busy-wait inside the runner's stdout `data` handler (`src/adapters/fallow/fallow-runner.ts:163`). Run `npx vitest run --project node-serial` on an idle machine. **Expected:** `streamed` fails (FQ1). Record the output, keep the mutation for Step 3, and do not commit it.
- [ ] **Step 2: Rewrite the case.** Keep the pre-control and its skip. Then, for each mode, run it **3 times**, collecting each run's worst gap and printing `[no-freeze] ${mode} #${i}: largest event-loop gap … ms; final parse … ms (…)`. Assert `expect(Math.min(...worsts), `${mode}: smallest of three largest event-loop gaps`).toBeLessThan(50)`, with each outcome's `kind` still asserted as today. After both modes, run a **post-control** of 2 s with the same sampler, and print `[no-freeze] post-control: …`. If the post-control is ≥ `LOADED_CONTROL_MS`, call `ctx.skip(...)` naming both control figures. **Where the skip goes:** evaluate the post-control **before** the min assertions; collect the mode results first, then the post-control, then skip or assert. A load that started mid-run therefore skips rather than fails. Raise the timeout to `90_000`. Update the header comment: three lines citing GCO22 and why repetition separates code from load ("a stall the code causes repeats on the same input; foreign load spikes don't").
- [ ] **Step 3: Proofs.**
  - With the Step 1 mutation still in place, on an idle machine: `streamed` fails all three repetitions (RED). Record it, revert the mutation, and confirm `git diff src` is empty.
  - Idle run: the case passes and prints both controls and all six figures.
  - Under the burner (`C:\Users\LUISME~1\AppData\Local\Temp\claude\C--Projects-codebase-inspector--claude-worktrees-inspector-prototype-ui-18caac\841c5b72-4d1a-40a3-a435-aa83781f2391\scratchpad`; write a small burner script there that starts one `node -e "for(;;){}"` per CPU, kills them on exit, and caps itself at 10 minutes): run `npx vitest run --project node-serial` 3 times. Each must pass or skip, never fail; record all figures.
- [ ] **Step 4: Gate and commit.** Subject: `test(z38): the no-freeze case takes the best of three per mode and a post-control skips a run the machine loaded mid-way (gap closure GRD2, GCO22)`.

---

### Task 3: Scenario 41 — `hide()` releases the waiting render on a tab switch (GRD3)

**Files:** Modify `tests/e2e/settings.e2e.ts` and `tests/e2e/required-scenarios.json`.

**Interfaces:**
- Consumes scenario 38's helpers (`settings.e2e.ts:24-58`: `switchToMainWindow`, `writeNotesFolderElsewhere`, `tabNotesFolder`).
- Consumes `openPluginSettings` and `closeSettings` (`host-probes.ts`), and `inspector.openCodebaseSettings`, `settingsRow` and `settingsPage`.

- [ ] **Step 1: A probe, before writing the scenario (record the findings).** In a throwaway test, confirm on 1.13.4 through the settings window:
  1. the settings search input selector, by structure (`.modal.mod-settings` … `input[type="search"]` or the search component's input; never by text);
  2. that typing the codebase's notes folder value into the search lists our tab's result group (a result element referencing `data-setting-id="codebase-inspector"` or our tab's nav item), and that clearing it restores the normal view;
  3. that clicking `[data-setting-id="appearance"]` (a core tab's nav item) calls our tab's `hide()`. Check this by reading `app.setting.activeTab?.id` from the main window afterwards.

  If any of the three cannot be done by structure, stop and report NEEDS_CONTEXT with what you found.
- [ ] **Step 2: Write scenario 41**, with this exact title: `a render waiting in the settings tab is released when another settings tab is opened`.
  1. Copy the project, `openCity`, `scanFolder('code')`, and read the profile.
  2. `openCodebaseSettings(profile.name)`; the handle is `settingsWindow`. Click Excluded paths and type `\nfirst-half`, without leaving the field.
  3. Switch to the main window and write the notes folder elsewhere (`Research/elsewhere`). Poll `pluginData`, then `tabNotesFolder`, until both show it.
  4. Switch back to the settings window. **Positive control:** search for `Research/elsewhere` in the settings search; our tab's result group is **absent**, because the stored definitions are stale while the wait holds. Read only.
  5. Clear the search, then click `[data-setting-id="appearance"]`.
  6. Search `Research/elsewhere` again: our tab's result group is **present**.
  7. Record `app.setting.activeTab` and our tab's `settingItems` count as evidence (`writeEvidence`). Then `closeSettings`.
- [ ] **Step 3: RED.** Temporarily make `hidden()`'s body in `src/host/settings-render-wait.ts` a no-op (return at once), then `npm run build` and run the scenario. **Expected RED:** step 6 finds no result group. Record it, revert, rebuild, and run GREEN. Also run all of `settings.e2e.ts`.
- [ ] **Step 4:** Append the title to `required-scenarios.json`.
- [ ] **Step 5: Gate and commit.** Subject: `test(native): scenario 41 — a render waiting in the settings tab is released by hide() when another settings tab opens (gap closure GRD3)`.

---

### Task 4: The accepted proof gaps — E9, E17, NE13 and E4 (GRD5–GRD8)

**Files:**
- Create:
  - `tests/e2e/inspector-scan.ts` (the shared no-wait scan step);
  - `tests/unit/no-layout-change-listener.test.ts`.
- Modify:
  - `tests/e2e/city.e2e.ts` (scenarios 3 and 4);
  - `tests/e2e/fixture.ts` only if the new step must be spread into `createInspectorPage` the way `inspector-fallow.ts` is (read `inspector.ts`'s spread first).

**Interfaces:**
- Consumes `writeSyntheticTree` (`tests/e2e/workspace-files.ts:95`), `startScanNoWait` (`inspector.ts:179`), `commandAvailable` and `rendered` (`host-probes.ts`).
- Produces `scanFolderNoWait(folder: string): Promise<void>` on the inspector page, through `inspector-scan.ts`.

- [ ] **Step 1 (GRD8, fast): RED, then GREEN.**
  - Write `tests/unit/no-layout-change-listener.test.ts`. Read every `src/**/*.{ts,vue}` file (use the same file walk as the existing static guards; find one with `grep -rln "readdirSync" tests/unit | head`). Assert that no file matches `/['"]layout-change['"]/u`. Give the failure message the file name and cite E4: "a layout-change listener per leaf is what scenario 1's leak allowance would hide".
  - It passes at HEAD, so show RED by temporarily adding `this.registerEvent(this.app.workspace.on('layout-change', () => {}));` to `src/main.ts`'s `onload`. Record it and revert.
- [ ] **Step 2 (GRD5): the E9 RED, proof only.** In `src/host/commands.ts:80-85` (import-analysis-report), temporarily make the executing branch open the import even when the check refuses (an asymmetric guard). `npm run build`, then run scenario 7 (`commands.e2e.ts`, the import-analysis-report test). **Expected RED:** the scenario's no-effect assertions fail. Record it, revert, rebuild, and run GREEN. No commit for this step: the RED goes in the report and the ledger.
- [ ] **Step 3 (GRD6): scenario 4's own positive control.**
  - In `inspector-scan.ts`, add `scanFolderNoWait(folder)`: the same steps as `scanFolder` up to approving the scope modal, without waiting for completion. Read `scanFolder` in `inspector.ts` first and reuse its selectors.
  - In scenario 4 (`city.e2e.ts:121-167`), after its restored-state asserts:
    1. write a 2 000-file tree with `writeSyntheticTree`;
    2. `scanFolderNoWait` on it;
    3. `expect.poll(() => commandAvailable(browser, 'cancel-scan')).toBe(true)`;
    4. run `cancel-scan` by id;
    5. poll back to `false`.
  - Keep the existing `scanning: false` evidence.
  - **RED:** temporarily make the city's scan-running check always false (find `isScanRunning`, or the `cancel-scan` checkCallback's condition, in `src/host/commands.ts`). The new control fails. Record, revert, rebuild, GREEN.
- [ ] **Step 4 (GRD7): scenario 3 observes no reconstruct.**
  - In scenario 3 (`city.e2e.ts:69-120`), before the first theme switch, mark the canvas (`canvas.dataset.ciProbe = '1'`). Install a MutationObserver on its parent through `executeObsidian` (store it on `window` as `ciCanvasObserver`, counting removed nodes that carry the mark).
  - After the theme switches, assert 0 removals.
  - **Positive control:** detach the city leaf; the count becomes 1. Disconnect the observer in a `finally`.
  - **RED:** temporarily add a css-change handler in the city view that disposes and recreates the renderer on the same canvas. Find where `css-change` is handled (`grep -rn "css-change" src`). Record, revert, rebuild, GREEN.
- [ ] **Step 5:** Run all of `city.e2e.ts` and `commands.e2e.ts` through the NP4 command.
- [ ] **Step 6: Gate and commit.** Subject: `test(native): scenario 4 gets its own scan-running control, scenario 3 observes that a theme switch never reconstructs, and a guard keeps layout-change unregistered (gap closure GRD5–GRD8)`.

---

### Task 5: The Part D minors (GRD10–GRD14)

**Files:**
- Modify:
  - `tests/unit/investigation-note-path.test.ts`;
  - `tests/component/investigate-screen.test.ts` (paging and idle);
  - `src/application/analysis/fallow-analysis-service.ts`;
  - `src/ui/stores/analysis-store.ts`;
  - `src/ui/screens/sources/FallowInstalledRoute.vue`;
  - `src/ui/audit-copy/fallow-run.ts` (and its copy-audit test if it lists the constant);
  - `tests/e2e/notes-root.e2e.ts` (the comment only);
  - `docs/superpowers/notes/2026-09-17-wp01-limitations.md` (LF; check with `file`);
  - `docs/concept/design/wp01-review/docs/03-threejs-and-obsidian-bridge.md`;
  - `docs/superpowers/specs/2026-09-23-inspector-ui-part7-design.md` (the row at `:226`).
- Create: `tests/unit/yaml-parity.test.ts`.

**Interfaces:** Produces the narrowed type `TrustAndRunOutcome = Extract<StartOutcome, { kind: 'started' | 'refused' | 'busy' }>`, exported from the service only if the store needs it, so no dead export.

- [ ] **Step 1 (GRD13): RED, then GREEN.**
  - Add `expect` cases that `LPT0` and `CONOUT$` are reserved names to `investigation-note-path.test.ts` (read its existing reserved-name cases at `:25-29`). They should pass. Show RED by temporarily removing them from the reserved list in `src/application/investigation/note-path.ts`; record and revert.
  - In `investigate-screen.test.ts`, add two cases:
    - (a) after Show more, changing the filter resets to the first page (the first-page row count is shown);
    - (b) the idle state, with no findings loaded, renders the screen's idle copy (read `InvestigateScreen.vue` for the idle branch and its copy constant).
  - Both are coverage of existing behaviour, so record a mutation RED for each: (a) skip the paging reset; (b) delete the idle branch. Revert both.
- [ ] **Step 2 (GRD14): the recorded REDs and the narrowed type.**
  - **A10:** mutate the short-prefix handling in `src/adapters/fallow/executable-inspector.ts` (the format detection near `:74`/`:116`), so a 3-byte prefix counts as native. Run `tests/unit/executable-inspector.test.ts`; record the RED and revert.
  - **C13:** temporarily expose `refreshBinding` from the analysis store's returned object. `npm run typecheck` must report TS2578 "Unused '@ts-expect-error'" at `tests/unit/analysis-store.test.ts:211`. Record and revert.
  - **`trustAndRun`:**
    - First the RED: in `src/application/analysis/fallow-analysis-service.ts`, change `trustAndRun`'s declared return type to `Promise<Extract<StartOutcome, { kind: 'started' | 'refused' | 'busy' }>>` and make one return path temporarily return `{ kind: 'review' }`. Typecheck must fail. Remove the temporary return, keeping the narrowed type.
    - Propagate the type to `analysis-store.ts` (`:107` area).
    - Delete the now-unreachable branch at `FallowInstalledRoute.vue:127` and the `FALLOW_TRUST_NOT_STARTED` constant (`src/ui/audit-copy/fallow-run.ts:122`), with any copy-audit test entry that lists it.
    - `npm run analyze` must still print 9.
  - **Part 7 spec row:** at `docs/superpowers/specs/2026-09-23-inspector-ui-part7-design.md:226`, append " — superseded: see `src/ui/audit-copy/fallow-run.ts:188` (gap closure GRD14)".
- [ ] **Step 3 (GRD10): the YAML parity test.** Create `tests/unit/yaml-parity.test.ts`. Take the exact value table the native fact test `tests/e2e/obsidian-facts.e2e.ts:161-175` round-trips: move the table into a shared `tests/support/yaml-facts.ts` that both import, since native files may import `tests/support/**`. Assert that `stringifyYaml`/`parseYaml` from `tests/mocks/obsidian.ts` round-trip every value to an equal value and keep strings as strings. Update the native test to import the shared table, with no behaviour change. RED: a table value the mock would type-coerce, if any; otherwise green-only, which is noted.
- [ ] **Step 4 (GRD11, GRD12): docs.**
  - Fix the stale comment at `tests/e2e/notes-root.e2e.ts:19-22`: the create no longer refuses an unindexed folder (NPF15, `ca1a8b7`).
  - Amend LIM `:479-485` to say the plugin no longer depends on the watcher indexing `node:fs` copies, while the environment fact stays.
  - Re-fetch the `[T1]`–`[T4]` and `[O1]`–`[O2]` citations in `docs/concept/design/wp01-review/docs/03-threejs-and-obsidian-bridge.md` with WebFetch. For each, record the URL, today's access date and whether the cited claim still holds; correct a moved URL, and mark a claim that no longer holds as "superseded (2026-10-03)" with what the source now says.
  - If WebFetch is unavailable, stop and report NEEDS_CONTEXT.
- [ ] **Step 5: Gate and commit.** Subject: `test(minors): reserved names, paging and idle cases, the A10 and C13 REDs, a narrowed trustAndRun type, a YAML parity table and refreshed citations (gap closure GRD10–GRD14)`.

---

### Task 6: Crash baseline arm — reproduce `0xC0000409` with diagnostics and capture a dump (GRD1 steps 5–6, GCO25, GCP11)

**Files:**
- Create: `tests/e2e/procdump-setup.ts`.
- Modify: `tests/e2e/vitest.config.mts` (`setupFiles`, opt-in).

**Interfaces:**
- Consumes `runDirectory()` and `breadcrumb()` (Task 1).
- Produces the opt-in env var `NATIVE_PROCDUMP=<absolute path to procdump64.exe>`.

**Before this task the controller asks the owner** (GCP11) for permission to download Sysinternals ProcDump. The ask names the file (`Procdump.zip`), the source (`https://download.sysinternals.com/files/Procdump.zip`, Microsoft) and the size (about 0.7 MB). The tool is unpacked into the scratchpad, never the repository. The implementer receives only the path.

- [ ] **Step 1: The opt-in setup file.** Create `tests/e2e/procdump-setup.ts`.
  - When `process.env.NATIVE_PROCDUMP` is set, it spawns `[NATIVE_PROCDUMP, '-accepteula', '-ma', '-e', String(process.pid), path.join(runDirectory(), 'dumps')]`. Use `spawn` with `detached: false`, `windowsHide: true`, stdout and stderr appended to `<run>/dumps/procdump-<pid>.log`, and create the folder first.
  - It writes `breadcrumb('procdump:attached', { pid })`.
  - procdump ends by itself when the worker ends.
  - When the variable is unset, the file does nothing.

  Add it to `setupFiles` in `vitest.config.mts`. Each forked worker evaluates setup files, so every test file's worker is watched.
- [ ] **Step 2: Prove the attach.** Run `smoke.e2e.ts` with `NATIVE_PROCDUMP` set. The procdump log shows it attached to the worker's pid and exited cleanly when the worker ended, and `breadcrumbs.ndjson` holds `procdump:attached`. With the variable unset, nothing spawns.
- [ ] **Step 3: The baseline arm, with no remedy.** Run `npm run test:e2e` on the baseline 1.13.4 with `NATIVE_PROCDUMP` set, **up to 10 runs**, stopping at the first crash. Every run goes through the load gate. Record each run: its directory, outcome, the crash file and the last breadcrumb phase.
  - On a crash, the dump is in `<run>/dumps`.
  - If 10 runs pass with no crash, also run **10 latest runs** for the rate, then stop and report: the rate measured with diagnostics on is the result. GCN7 forbids landing a remedy without a reproduced crash.
- [ ] **Step 4: Read the dump.** If `cdb.exe` (Debugging Tools for Windows) is on the machine, find it under `C:\Program Files (x86)\Windows Kits\10\Debuggers\x64\`. Run `cdb -z <dump> -c "!analyze -v; .ecxr; kb; q"` and record the FAST_FAIL code (2 = GS cookie, 7 = abort, 10 = CFG) and the faulting stack's modules.
  - If cdb is absent, record the exception record from procdump's own log (code, subcode and faulting module, which procdump prints on capture), and report NEEDS_CONTEXT. Installing the Debugging Tools is a download the owner must approve.
- [ ] **Step 5: Commit** the setup file and the config change only. Never commit a dump, the procdump binary or its path. Subject: `test(native): an opt-in procdump attach per native worker for the 0xC0000409 investigation (gap closure GRD1, GCO25)`. The run records and dump analysis go in the task report for the ledger.

---

### Task 7: Crash remedy and its proof (GRD1 step 7, GCN7)

This task runs only if Task 6 reproduced the crash and read its stack. The controller rules which remedy to try first from Task 6's evidence:

| Faulting stack | First remedy |
|---|---|
| node.exe / libuv / V8 frames | Pin Node to the latest 22 LTS for the native run. Add an `engines` field and a version assertion in `native-tests.mjs`. Installing Node 22 is a download: owner approval first. |
| undici, llhttp or the WebDriver client's I/O | Bump webdriverio, and wdio-obsidian-service if a newer compatible release exists, within their majors. Then `npm install` and a lockfile refresh. |
| chromedriver / Electron side | No remedy this pass may take alone. Moving the baseline to 1.13.7 needs the owner (GCN7). Stop and report. |

- [ ] **Step 1:** Apply the ruled remedy, with the change set the ruling names.
- [ ] **Step 2:** Run `npm run test:e2e` on 1.13.4 until **11 consecutive green runs** (each through the load gate, with diagnostics on and procdump off), or until a crash.
  - A crash ends the attempt. Report it with its run directory. The controller then rules the next remedy from the table, or stops for the owner (spec §9).
  - Record every run.
- [ ] **Step 3:** Run latest once, green, on the remedy.
- [ ] **Step 4: Gate and commit.** Subject: `fix(native): <remedy> — 11 consecutive green 1.13.4 native runs (gap closure GRD1)`.

---

### Task 8: Evidence and verification (Part D)

**Files:**
- Modify:
  - `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` (CRLF);
  - `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md` (CRLF);
  - `docs/deliverables/Test Evidence.md` (native 40 → 41; one sentence on the load gate and the run-scoped evidence);
  - the count tests, only where they pin a count.

- [ ] **Step 1:** Run `npm run test`, take the G8 figures from a run in which the no-freeze case executed, and refresh the counts once (Edit/Write only). Then check both CRLF notes byte-level.
- [ ] **Step 2:** `npm run verify` must exit 0. Report every run with its Z38 outcome (the best-of-3 figures and both controls).
- [ ] **Step 3:** Run `npm run test:e2e` on 1.13.4 and then latest, through the load gate. **Expected:** "Verified 41 executed native Vitest cases, including all 41 required scenarios." on both. A failure or crash is reported with its run directory and never retried. `npm run test:fallow` and `npm run analyze` (expect 9) follow.
- [ ] **Step 4: Commit.** Subject: `docs(evidence): gap-closure Part D — 41 required native scenarios, the load gate, run-scoped evidence and the crash investigation`.

The controller records the GRD9 and GRD15 acceptances and the F closures in the ledger, together with the execution rulings, after the final review.
