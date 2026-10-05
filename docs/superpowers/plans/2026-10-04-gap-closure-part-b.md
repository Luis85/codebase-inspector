# Gap closure — Part B (data, state and processes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close spec rows GRB1–GRB18:
- **Data and settings:** live external `data.json` edits, per-device fallow bindings, 64-bit scope fingerprints, wildcard-exclusion warnings.
- **Processes:** bounded scan concurrency, the Windows tree-kill probe, fallow config files in provenance.
- **Investigation notes and preview:** the preview root resolved in the host, the `root-changed` reason, refresh keeping YAML formatting, note-index resync, a notes folder that is the codebase root, `@` escaping.
- **Small UI and state fixes:** the removed and retired residuals, the duplicate-add race, focus after Show more, bidi controls and unreadable paths.
- **Accepted limits:** recorded with their reasons.

**Architecture:**
- The data layer gains one broadcast, `notifyExternalChange(plugin)`, which `main.ts`'s `onExternalSettingsChange` calls. Watchers, the review registry and the analysis service re-read from it, and nothing writes.
- The walker keeps its traversal and emission order, and prefetches up to 8 entries per directory.
- The analyzer slice gains a v2 record keyed by machine.
- Every other row is a small, local fix with its own RED.

**Tech Stack:** TypeScript 6.0.3, Vue 3.5.43, Pinia 4.0.3, Zod, Vitest 5.0.1 (jsdom), WebdriverIO with wdio-obsidian-service (native), Node 24.

**Spec:** `docs/superpowers/specs/2026-10-03-gap-closure-design.md`:
- §3.4 GRB1–GRB18;
- GCN3 (§4.5 `StatResult.unreadable?`; the GCO8 wording in spec §7 and in the G2 evidence);
- GCN5, GCN8, GCN10, GCN11, GCN12 (the approved copy);
- §5 scenarios 43–46;
- §7 (accepted limits);
- GCO7–GCO9, GCO23, GCO24.

**Rulings:** `docs/superpowers/notes/2026-10-03-gap-closure-ledger.md`, in particular GCP7 (fallow config names come from fallow's own sources) and GCP8 (older builds and v2). Pre-flight rulings continue as GCQ…, and execution rulings as "Gap-closure E30…".

**Branch:** `feat/gap-closure` in `.claude/worktrees/gap-closure`, at `003568a` (the PR 1 head after Part A and the CI fix). At the end it is fast-forward-pushed onto `feat/wp-01-codebase-city` as `Luis85`.

## Planning rulings (made while writing this plan; transcribed to the ledger as GCQ3–GCQ9)

- **GCQ3 (GRB11).** The persisted trust fingerprint stays 32-bit. `analyzer-trust.ts` embeds `root: fingerprintSource(...)` today. It switches to `fnv1a32Hex(normalizeRootForFingerprint(...))`, so every stored trust grant stays valid; the record schema requires 8 hex digits (`analyzer-record.ts:61`). Everything kept in memory goes 64-bit:
  - `fingerprintSource`, `fingerprintScope`, `fileSetDigest`;
  - `rootFingerprint` (`analysis-coordinator.ts:69`, compared at `analysis-state.ts:95`).

  — The spec says "the persisted trust hash is untouched", and that holds only if trust stops borrowing `fingerprintSource`. — Low: two hash widths now coexist, and each is named for what it is.
- **GCQ4 (GRB12).** A wildcard-exclusion warning joins `snapshot.warnings` but does not make the snapshot `partial`. Completeness is derived from skip reasons only. — A glob that matches nothing is a settings problem, not missing data, and `partial` would wrongly claim files were skipped. — Low.
- **GCQ5 (GRB9).** The config-file list is computed by `fallow-analysis-service.ts`, which has the filesystem port (`deps.getFilesystem()`, `:171`). It runs before the run, is passed in the coordinator's request, and is recorded as `CollectedRunProvenance.configFiles: readonly string[]`. — The coordinator has no filesystem dependency (`AnalysisCoordinatorDeps`, `:36-42`), and adding one widens a port for one stat loop. — Low.
- **GCQ6 (GRB10, GCP8).** An older build already reads any entry with `v !== 1` as `unsupported`. That state is read-only and refuses writes, so it never overwrites v2 — the substance of GCP8. Old builds cannot be changed to print a reason, so the reason text is shown only by this build: an invalid v2 entry reads as `invalid` carrying a `reason`. — Low.
- **GCQ7 (GRB1).** There is no `refreshBindings()` today. The analysis service gains `externalChange()`, which emits `bindingChanged` as a broadcast (`null` = every profile), and `analysis-store` treats `null` as a match. The review registry gains `externalChange()`, which tells each live repository to drop its in-flight read and notify. — Neither component knows which profile ids changed, and a broadcast re-read is cheap and read-only. — Low: every open leaf re-reads once per external change.
- **GCQ8 (GRB1, scenario 43).** The native test writes `data.json` from Node with `fs.writeFileSync` on the vault path, so the file's mtime is newer than the plugin's last save. That is what Obsidian's `_onConfigFileChange` compares: a 50 ms debounced `raw` event, then an mtime check (read from the 1.13.4 asar). It then waits for the settings tab to show the change. A probe comes first, with a positive control. — Low.
- **GCQ9 (GRB17b, closes E17).** These all report root-unavailable, with the `root-unavailable` cause:
  - an unreadable root at stat (`StatResult.unreadable`);
  - a root the walker cannot list (`readdirNames` on the root throws, `walker.ts:134`).

  The source modal names the code with the GCN12 copy "The folder cannot be read ({code})." — GCO5 says "missing or unreadable", and E17 deferred exactly this to GRB17. — Low.

## Global Constraints

**Repository rules:**
- **Line caps:** **400** for `src/**/*.{ts,vue}` and **450** for tests.
  - `tests/host/investigation-notes.test.ts` is at **440**, so new notes cases go into new files.
  - `tests/e2e/inspector.ts` is at 381.
  - `city-view.ts` (325) and `CityWorkspace.vue` (191) stay ≤ **360**.
  - `CityViewport.vue` is never edited.
- **Layering is enforced by lint (GCO10).** `ui` never imports `adapters` or `host`. Only `src/adapters/filesystem/node-access.ts` may `window.require` `fs`, and only `node-process-access.ts` may `window.require` `child_process`. There is no bare `window`/`document` in `src/ui` or `src/visualization`.
- **Copy lives only in the copy modules.** New strings go into `src/ui/audit-copy/*`, which `microcopy.test.ts` does not sweep. A string added to `src/ui/copy.ts` must join `PINNED` or `AUTHORED_FRESH`. The approved wording is spec GCN12, verbatim:
  - **Folder is root (GRB7):** "This folder is the codebase folder itself. Choose another folder for the note."
  - **Root changed (GRB8):** "This codebase is now connected to a different folder than the one scanned. Scan it again to preview files."
  - **Removed codebase heading (GRB13d):** "This codebase was removed."
  - **Wildcard exclusion (GRB12):** "The exclusion "{x}" contains * or ? and matches nothing. Edit it in Settings."
  - **Unreadable folder (GRB17b):** "The folder cannot be read ({code})."
  - **Config files (GRB9):** "fallow config files in the root: {list}" / "No fallow config file in the root"
- **Part C's gates are live:** the contrast gate (including the text-token-as-border sweep), axe and the layering lint. Every new or changed UI passes them.
- **CRLF files** (`gate-evidence.md`, `implementation-report.md`, `tests/unit/city-renderer.test.ts`) are edited only with Edit/Write. **New files are LF.** After writing a file, check `git ls-files --eol` once it is staged; Part A's subagents produced CRLF by accident.
- `npm run analyze` stays at **4**.
- **§4 changes only as GCN3 names them.** The only Part B change is `StatResult.unreadable?: string` (§4.5, additive, amended in writing).

**Process rules:**
- **Never run `git stash` in any form.** Show a RED with a temporary Edit, then revert it with an Edit.
- Tests are written and run RED before the code.
- Every commit message ends with the literal trailer **"Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"**. Stage explicit paths only.
- Run plain, separate shell commands.
- Disclose every `npm run test` / `npm run verify` run with its Z38 outcome.
- Subagents return their report as text (E14).

**TypeScript and lint:**
- ES2020 `lib` only.
- oxlint runs with `--deny-warnings`.
- Use `Array.from(set)` and the PF1 timers.
- No redundant `as`.

**Native runs:**
- Part B adds **scenarios 43–46** (from 42 to **46**) and changes scenario 23 (the preview's `root-changed` text) and the doc's scenario 26 (`@scope/pkg`).
- Each new or changed scenario needs a RED on record, a positive control, and `retry: 0`.
- Run a single native file by hand. `scripts/native-tests.mjs` has no file filter, so after `npm run build` run:

  ```
  & '<portable node>' node_modules\vitest\vitest.mjs run --config tests/e2e/vitest.config.mts <file>
  ```

  Set `FALLOW_BIN` and a fresh `NATIVE_RUN_DIR`, and sample the CPU load first (wait while it is ≥ 50 %).
- The full gate uses the portable Node: `C:\Users\LUISME~1\AppData\Local\Temp\claude\C--Projects-codebase-inspector--claude-worktrees-inspector-prototype-ui-18caac\841c5b72-4d1a-40a3-a435-aa83781f2391\scratchpad\node-24.21.0\node-v24.21.0-win-x64\node.exe scripts/native-tests.mjs`.
- `FALLOW_BIN` is `Join-Path $env:LOCALAPPDATA 'npm-cache\_npx\ee3f2ca80543beb5\node_modules\@fallow-cli\win32-x64-msvc\fallow.exe'`.
- No retries. Never kill foreign processes.

**Per-task gate** (each its own command):
- `npm run typecheck`
- `npm run lint:fast`
- `npx eslint <touched files> --max-warnings 0`
- `npx vitest run <the task's test files plus every existing test file importing a changed module>`
- for UI tasks, also `npx vitest run tests/component/axe-*.test.ts tests/unit/contrast-gate.test.ts`

The count tests may fail on counts until Task 17.

## Review Focus

1. **An external `data.json` change never writes, and never loses an own write in flight.** A re-read that races a pending own write must not hide it (`settleSlot` treats a notification as the store's own write while `ownWrites > 0`). Pinned in Task 16.
2. **Concurrency never opens what it must not.**
   - An excluded path is never opened.
   - Nothing new is dispatched after a cancel is observed.
   - The emission order is identical to the sequential walk.
   - One failed read in a window never drops or reorders the others, and the run reports cancelled only after in-flight reads drain.

   Pinned in Task 14.
3. **The v2 migration never loses another device's binding.** An invalid v2 entry is reported with its reason and is never silently overwritten by a bind. Pinned in Task 15.
4. **The YAML rewrite falls back whenever the frontmatter is not plain.** That means duplicate keys, a multi-line value, a nested key, a comment on the key's line, or no frontmatter. Values containing quotes, colons or `#` round-trip. Pinned in Task 5.
5. **A trust grant made before the upgrade is still honoured after it.** The 32-bit trust value is unchanged. Pinned in Task 1.

---

### Task 1: 64-bit in-memory fingerprints, 32-bit trust kept (GRB11, GCQ3)

**Files:**
- Modify: `src/domain/hash.ts` (adds `fnv1a64Hex`), `src/application/approval.ts:14-53`, `src/application/inventory-collector.ts:48-55,250`, `src/application/analysis/analyzer-trust.ts:28-40`.
- Create: `tests/unit/fingerprint-width.test.ts`.

- [ ] **Step 1: RED.** Find an FNV-1a-32 collision pair of two short ASCII strings by brute force in a scratch script; record the pair in the test. Assert three things:
  - (a) `fingerprintSource(a) !== fingerprintSource(b)` for two roots that differ only by that colliding pair — RED today;
  - (b) `fingerprintScope` likewise, for two exclusion lists;
  - (c) **the trust guard:** for a fixed subject, `fingerprintTrust(subject, '')` equals the exact 8-hex value it produces at `003568a`. Record that value from the current code before changing anything.
- [ ] **Step 2: Implement.** `fnv1a64Hex(text): string` is a 64-bit FNV-1a over UTF-16 code units, matching the 32-bit function's input convention. Use `BigInt`, or two 32-bit halves if the ES2020 lib makes BigInt awkward under the lint rules, with offset `0xcbf29ce484222325` and prime `0x100000001b3`. It returns 16 hex digits.
  - `approval.ts`'s private `fnv1a` and `inventory-collector.ts`'s private `fnv1a` are replaced by `fnv1a64Hex` from `domain/hash`.
  - `analyzer-trust.ts` uses `fnv1a32Hex(normalizeRootForFingerprint(subject.rootPath))` for its root field. Export `normalizeRootForFingerprint` if it is not already exported.
  - Grep for any test or fixture that pins an 8-hex approval or digest value; the explorer found none besides trust literals.
- [ ] **Step 3: GREEN.** Run the new test, `approval`, `analyzer-trust`, `analyzer-record`, `analysis-state`, `scan-coordinator`, `inventory-collector` and `normalize-fallow-ids` (its 32-bit ids are unchanged).
- [ ] **Step 4: Gate and commit.** Subject: `fix(scan): 64-bit scope and file-set fingerprints in memory, while the persisted trust fingerprint stays 32-bit (gap closure GRB11)`.

---

### Task 2: `@` escaped only where it could start an email (GRB16)

**Files:**
- Modify: `src/application/investigation/note-text.ts:28-44`, `tests/unit/note-text-email.test.ts`, `tests/e2e/obsidian-facts.e2e.ts` (the doc's scenario 26, `'email addresses stay inert after noteText escaping'`, at `:214`).

- [ ] **Step 1: RED (unit).**
  - `noteText('@scope/pkg')` → `'@scope/pkg'`, with no backslash.
  - `noteText('see @scope/pkg')` → no backslash before `@`.
  - **Controls:** `noteText('a@x.io')` → `'a\\@x.io'` and `noteText('<a@x.io>')` → `'\\<a\\@x.io\\>'` (today's pins).
  - A local part ending in each GFM local-part character class keeps its escape: letters, digits and `.!#$%&'*+/=?^_\`{|}~-`.
- [ ] **Step 2: Implement.** Drop `@` from `PUNCTUATION`. Escape `@` only when the character before it, in the original string, is a GFM email local-part character. Do this in the same single pass, so already-escaped punctuation does not shift the test: for example, a replace callback with an offset that inspects `value[offset - 1]`. A leading `@`, or one after whitespace or `(`, stays bare.
- [ ] **Step 3: Native.** In the email scenario, add an `@scope/pkg` case to the rendered note. In reading view and live preview:
  - its text shows no backslash;
  - it is not a link (0 `a.external-link`/`mailto:` anchors for it).

  The existing escaped forms stay inert.
  - **RED:** temporarily restore `@` in `PUNCTUATION` and show the backslash.
  - Run `obsidian-facts.e2e.ts` alone.
- [ ] **Step 4: Gate and commit.** Subject: `fix(notes): escape @ only where it could start an email, so a package scope reads without a backslash (gap closure GRB16)`.

---

### Task 3: Bidi controls shown visibly in findings (GRB17a)

**Files:**
- Create: `src/application/investigation/visible-controls.ts`, `tests/unit/visible-controls.test.ts`.
- Modify: `src/application/investigation/source-preview.ts:75-88` (uses the helper), `src/ui/read-models/findings.ts:75-80`.

- [ ] **Step 1: RED.** A finding whose `symbol` contains U+202E, and whose `detail` contains U+200B, renders through `touchingFindings` with both escaped as `\u202E` / `\u200B`. The `title` built from them is also escaped. **Control:** plain text is unchanged. Also cover C0 controls except tab and newline, and C1 controls.
- [ ] **Step 2: Implement.** `visibleControls(value: string): string` moves the preview's `CONTROL_ESCAPE` and `escapeControls` (`source-preview.ts:75-79`, built on `INVISIBLE_CONTROLS` from `note-text.ts`) into the new module. The preview imports it unchanged in behaviour. `touchingFindings` applies it to `symbol`, `detail` and the inputs of `FINDING_TITLE_FOR`.
- [ ] **Step 3: GREEN.** Run the new test, `investigation-source-preview`, `findings-model`, `findings-structure` and `findings-lens`.
- [ ] **Step 4: Gate and commit.** Subject: `fix(findings): bidi and invisible controls in a finding's symbol and detail are shown as escapes, like the preview (gap closure GRB17a)`.

---

### Task 4: Preview root resolved in the host, and `root-changed` (GRB4, GRB8)

**Files:**
- Modify:
  - `src/host/investigation-services.ts:22-40` (takes the snapshot store);
  - `src/main.ts:84`;
  - `src/application/investigation/source-preview.ts:21-22,184-192`;
  - `src/ui/audit-copy/investigation.ts:261-270` (a `'root-changed'` key);
  - `tests/e2e/preview.e2e.ts:138`.
- Create: `tests/host/investigation-preview-root.test.ts`.

- [ ] **Step 1: RED.**
  - (a) An unbound codebase whose host snapshot root is `/a`, previewed with `expectedRoot: '/b'`, gives `no-binding`. Today it reads `/b`.
  - (b) Unbound, host root `/a`, request `/a` reads the file.
  - (c) Bound to `/c` (a reconnect), request `/a` gives `root-changed`. Today it gives `no-binding`.
  - (d) Bound to `/a`, request `/a` reads.
- [ ] **Step 2: Implement.**
  - `InvestigationServiceDeps` gains the snapshot store. Find its API for the codebase's latest snapshot; the snapshot's `scope.rootPath` is the approved root. An unbound `resolveRoot` returns that root, or `null` when there is no snapshot.
  - `source-preview` no longer substitutes `expectedRoot` for an unbound resolve. `expectedRoot` only narrows the read: a resolved root that is not `sameRoot` as `expectedRoot` gives `root-changed` when the codebase is bound, and `no-binding` when it is unbound.
  - Add `'root-changed'` to the union, with the GCN12 copy. The typed `PREVIEW_UNAVAILABLE` record forces the key.
- [ ] **Step 3: Native.** Scenario 23 (`preview.e2e.ts:86`) expects `PREVIEW_UNAVAILABLE['root-changed']` at `:138`. **RED:** run it once with the old reason mapping restored temporarily. Run `preview.e2e.ts` alone.
- [ ] **Step 4: GREEN.** Run the new test plus every preview test: `investigation-source-preview`, `investigate-preview`, `investigate-preview-io`, `investigation-preview-real`, `investigation-ports` and `investigation-spine`.
- [ ] **Step 5: Gate and commit.** Subject: `fix(preview): the host resolves an unbound codebase's root from its snapshot, and a reconnected folder says to scan again (gap closure GRB4, GRB8)`.

---

### Task 5: Refresh rewrites two frontmatter lines, keeping the note's YAML (GRB5)

**Files:**
- Create: `src/host/frontmatter-lines.ts` (a pure line rewrite), `tests/unit/frontmatter-lines.test.ts`, `tests/host/investigation-notes-yaml.test.ts`.
- Modify: `src/host/investigation-notes.ts:228-247`, `tests/e2e/notes-refresh.e2e.ts`, `tests/e2e/required-scenarios.json`.

- [ ] **Step 1: RED (pure).** `rewriteFrontmatterLines(text, { snapshot_id, source_path })` returns `{ ok: true, text }` when all of these hold:
  - the note starts with a `---` frontmatter block;
  - it has exactly one top-level line `snapshot_id: …` and one `source_path: …`;
  - each value is single-line and has no trailing comment.

  It replaces only those two lines, with values written as YAML double-quoted scalars (JSON string escaping). Every other byte stays the same: comments, other keys' quoting, key order and line endings (CRLF in, CRLF out).

  It returns `{ ok: false }`, so the caller falls back, when any of these is true:
  - there is no frontmatter;
  - a key is duplicated;
  - a key is missing;
  - a value continues onto the next line (`|`, `>`, an indented continuation, or an open quote);
  - the key is nested (indented);
  - a comment is on the key's line.

  Values containing `"`, `'`, `:` and `#` round-trip through `JSON.parse` of the written scalar.
- [ ] **Step 2: RED (host).** A note with comments and single-quoted values is refreshed. Its frontmatter comments and quoting are byte-identical except for the two values. It is ONE `vault.process` call and no `processFrontMatter`. The result is `'refreshed'`. Fallback cases still call `processFrontMatter`, and `'partial'` stays possible only there.
- [ ] **Step 3: Implement.** Inside the existing `vault.process` callback, after `spliceEvidenceBlock`, apply `rewriteFrontmatterLines`. If it succeeds, return the combined text and skip `processFrontMatter`. Otherwise keep today's `processFrontMatter` path.
- [ ] **Step 4: Native scenario 44.** Add to `notes-refresh.e2e.ts` a test titled exactly `refreshing a note keeps its frontmatter comments and quoting`, and append the same title to `required-scenarios.json`.
  - **Positive control:** the two keys the refresh owns are updated.
  - **Assertion:** the comment line and a single-quoted other key are byte-identical after the refresh.
  - **RED:** with the rewrite temporarily bypassed, the comment is gone.
- [ ] **Step 5: Gate and commit.** Subject: `fix(notes): refresh rewrites only its two frontmatter lines, so comments and quoting survive (gap closure GRB5; scenario 44)`.

---

### Task 6: The note index resyncs when Investigate opens (GRB6)

**Files:**
- Modify:
  - `src/host/investigation-note-index.ts` (adds `rebuild()`);
  - `src/application/ports/investigation-notes-port.ts` (adds `resync(codebaseId): void`);
  - `src/host/investigation-notes.ts` (delegates);
  - `src/ui/stores/investigation-store.ts` (adds `resync()`);
  - `src/ui/screens/InvestigateScreen.vue` (calls it `onMounted`);
  - `tests/e2e/notes-index.e2e.ts`, `required-scenarios.json`.
- Create: `tests/host/investigation-note-index-resync.test.ts`.

- [ ] **Step 1: RED (host).** A linked note whose metadata arrives after the first `resolved` event is not listed today, because only the first `resolved` rebuilds (`:35-43`). After `resync('code')` it is listed.
  - **Control:** one `resync` per mount causes exactly one `everyFile()` pass (IP13).
  - A resync that finds nothing new notifies no listener.
- [ ] **Step 2: Implement.**
  - `rebuild()` runs `apply(everyFile())`.
  - The port gets `resync(codebaseId)`, which calls `rebuild()`.
  - The store gets `resync()`, which calls `notesPort?.resync(id)`.
  - `InvestigateScreen.vue` calls `investigation.resync()` in `onMounted`.
  - Every port double gains the method: grep the `InvestigationNotesPort` implementations in tests/fixtures.
- [ ] **Step 3: Native scenario 45.** Add to `notes-index.e2e.ts` a test titled exactly `a linked note the vault indexed late is listed when Investigate opens again`, and append the title to `required-scenarios.json`.
  - **Positive control:** an indexed note is listed at once.
  - **Late note:** write the late note's file from Node after the first `resolved` event, and use the existing NPF15 technique for a folder that exists on disk before indexing (`notes-root.e2e.ts:121`). Navigate away from Investigate and back. The late note is listed.
  - **RED:** with the `onMounted` call temporarily removed, the late note is not listed.
- [ ] **Step 4: Gate and commit.** Subject: `fix(notes): Investigate resyncs the note index when it opens, so a note the vault indexed late is listed (gap closure GRB6; scenario 45)`.

---

### Task 7: A notes folder that is the codebase folder is refused (GRB7)

**Files:**
- Modify:
  - `src/application/ports/investigation-notes-port.ts:19-25` (adds `| { status: 'folder-is-root' }`);
  - `src/host/investigation-notes.ts:124-142`;
  - `src/ui/screens/investigate/CreateNoteDialog.vue:64-86,183-186`;
  - `src/ui/audit-copy/investigation.ts:299`;
  - `tests/host/investigation-notes-alias.test.ts:62`;
  - `tests/component/investigate-create.test.ts:144-151` (or a new file if near the cap);
  - `tests/e2e/notes-root.e2e.ts`, `required-scenarios.json`.

- [ ] **Step 1: RED.**
  - The alias test's `toMatchObject({ status: 'ok', overlapsRoot: true, rootRelativeFolder: null })` becomes `{ status: 'folder-is-root' }`.
  - The create-dialog test "the root folder itself shows its own words and no checkbox" becomes: it shows the GCN12 refusal, and Create is disabled.
  - **Control:** a subfolder inside the root keeps `ok` with `overlapsRoot`.
- [ ] **Step 2: Implement.**
  - `planDestination` returns `{ status: 'folder-is-root' }` when `inside === ''`.
  - The dialog's exhaustive switch gets the new case, showing `NOTE_CREATE_FOLDER_IS_ROOT` (the GCN12 text) and disabling Create. Remove the old `rootIsFolder` branch and `NOTE_CREATE_ROOT_IS_FOLDER`, if nothing else uses them (grep).
  - The `DestinationPlan` doc comment at `:18` is updated.
- [ ] **Step 3: Native scenario 46.** Add to `notes-root.e2e.ts` a test titled exactly `a notes folder that is the codebase folder itself is refused, and nothing is written`, and append the title to `required-scenarios.json`.
  - **Positive control:** a valid folder in the same dialog is accepted.
  - **Assertion:** choosing the root shows the refusal, and no file is created on disk or in the vault.
  - **RED:** the dialog creates the note when the status check is temporarily removed.
- [ ] **Step 4: Gate and commit.** Subject: `fix(notes): a notes folder that is the codebase folder itself is refused with a reason, and nothing is written (gap closure GRB7; scenario 46)`.

---

### Task 8: Saved wildcard exclusions warn instead of silently matching nothing (GRB12, GCQ4)

**Files:**
- Modify: `src/application/inventory-collector.ts:207-268`, the copy module for scan warnings (find where existing snapshot warning text lives; otherwise `src/ui/audit-copy/storage.ts`).
- Create: `tests/unit/wildcard-exclusion-warning.test.ts`.

- [ ] **Step 1: RED.**
  - A scope with exclusions `['dist/*', 'node_modules']` produces exactly one warning, the GCN12 text with `{x}` = `dist/*`. The snapshot stays `complete` if nothing was skipped.
  - **Control:** no wildcard means no warning.
  - Two wildcards produce two warnings, in exclusion order.
  - The warning appears once per scan, not per entry.
- [ ] **Step 2: Implement.**
  - Before or after the walk, `collectInventory` adds one warning per stored exclusion containing `*` or `?`.
  - `completeness` is computed from the skip reasons only: keep `warningReasons` for skips, and append the wildcard warnings to the emitted `warnings`.
  - The validator's `exclusionRecordReasons` (`validator.ts:296-311`) stays permissive. M62 says never migrate stored globs away.
- [ ] **Step 3: GREEN.** Run the new test, `inventory-collector`, `snapshot-builder` users that pin `warnings` (grep `warnings:` in tests), the status surfaces (a warning may render) and axe.
- [ ] **Step 4: Gate and commit.** Subject: `fix(scan): a saved exclusion with * or ? is named in the snapshot's warnings, since it matches nothing (gap closure GRB12)`.

---

### Task 9: Removed and retired residuals (GRB13 a, c, d)

**Files:**
- Modify:
  - `src/application/analysis/fallow-analysis-service.ts:225-240` (`readBinding`) and `analyzer-record.ts` (a `removed` read kind);
  - `src/ui/stores/analysis-store.ts`, `src/ui/screens/sources/FallowRunPanel.vue` (no Choose for `removed`);
  - `src/ui/screens/settings/review-write-gate.ts:21-30` (blocks when the repository is retired);
  - the review store (exposes `retired`, set from the repository's `retire()` notification);
  - `src/ui/read-models/fallow-run.ts:36-38` and `src/ui/audit-copy/fallow-run.ts` (the removed heading).
- Create: `tests/component/fallow-removed-binding.test.ts`, `tests/component/review-retired-gate.test.ts`, `tests/unit/fallow-run-removed-heading.test.ts`.

- [ ] **Step 1: RED (three tests).**
  - (a) After `purge(profileId)`, `readBinding` returns `{ kind: 'removed' }`, and the panel shows no Choose button.
  - (c) With the repository retired, Clear and Import are blocked (`aria-disabled`) with the storage note.
  - (d) `forget` answering `removed` shows the heading "This codebase was removed." rather than the COPY_15 failure heading. The reason line stays.
- [ ] **Step 2: Implement** the three. Every consumer of `AnalyzerBindingRead` handles `removed` exhaustively (grep `kind === 'other-machine'`). The review store learns `retired` from the repository: add a `retired` getter to the repository port, read after each notify. `review-write-gate` adds `|| review.retired` to `blocked`.
- [ ] **Step 3: GREEN.** Run the three new tests, `fallow-analysis-service-removed`, `fallow-run-read-model`, `fallow-run-copy`, `settings-fallow`, `analysis-store`, the review-store tests, axe and contrast-gate.
- [ ] **Step 4: Gate and commit.** Subject: `fix(sources): a removed codebase offers no Choose and says it was removed, and a retired review set blocks Clear and Import (gap closure GRB13)`.

---

### Task 10: A stacked reload no longer lets a duplicate add through (GRB14)

**Files:**
- Modify: `src/ui/stores/review-buckets.ts:81-87`, `tests/unit/review-store-races.test.ts`. The file is at 190 lines; add to it, or use a new file if it grows past about 400.

- [ ] **Step 1: RED.** Use the existing `gate()`, `delayedSaves` and `holdListsOf` helpers. Start add #1, whose `settleOwnWrite` sees a changed ticket and awaits `store.load()`. Before that load lands, start a second, newer load that overtakes it. Then add #2 of the same item. Today add #2 returns non-null: a duplicate.
- [ ] **Step 2: Implement.** In `settleOwnWrite`, when the ticket changed, run `upsert()` (it is id-idempotent) **and** reload: `upsert(); return store.load().catch(noop);`. The item is then in `workItems` whichever load wins.
- [ ] **Step 3: GREEN.** Run the races, sync and resurrection tests (the Polish E4 blocks).
  - Confirm that "no resurrection" (`:76-120`) still holds. An upsert of a just-removed item must not resurrect it.
  - If it does, guard the upsert with the bucket's removed-id set, or rule on it with evidence.
- [ ] **Step 4: Gate and commit.** Subject: `fix(review): an add that a newer reload overtakes still lands, so a second identical add is refused (gap closure GRB14)`.

---

### Task 11: Focus moves to the first new row after Show more (GRB15)

**Files:**
- Modify:
  - `src/ui/kit/EvidenceTable.vue` (watches `limit`; focuses the first newly shown interactive row);
  - `src/ui/screens/investigate/InvestigationList.vue` (calls the roving index's `setActive(oldLimit)` after `more`);
  - the comment at `CoverageGapsTable.vue:29`.
- Create: `tests/component/show-more-focus.test.ts`.

- [ ] **Step 1: RED.** For each of HotspotTable, FindingsTable, CoverageGapsTable and InvestigationList: with more rows than the limit, focus Show more and click it. Assert `document.activeElement` is the first newly shown row (index = the old limit). Today it is `body` once the button unmounts, or it stays on the button.
- [ ] **Step 2: Implement.**
  - **EvidenceTable:** `watch(() => props.limit, (next, prev) => { if (next > prev && props.interactive) nextTick(() => rowEls[prev]?.focus()); })`. Use template refs on the `<tr>`s.
  - **InvestigationList:** after `more`, call `setActive(previousLimit)`. `useRovingIndex` focuses through `nextTick`.
  - Focus moves only when the change came from Show more, not on first render. Pass a flag, or compare against the previous value.
- [ ] **Step 3: GREEN.** Run the new test, the four tables' tests, axe and contrast-gate.
- [ ] **Step 4: Gate and commit.** Subject: `fix(tables): Show more moves focus to the first newly shown row in all four tables (gap closure GRB15)`.

---

### Task 12: fallow config files recorded in provenance (GRB9, GCQ5, GCP7)

**Files:**
- Create: `src/application/analysis/fallow-config-files.ts` (the name list with its source, plus `listConfigFiles(port, root)`), `tests/unit/fallow-config-files.test.ts`.
- Modify:
  - `src/application/evidence/model.ts:136-147` (`configFiles: readonly string[]`);
  - `src/application/analysis/analysis-coordinator.ts:122-143` (takes `configFiles` from the request);
  - `src/application/analysis/fallow-analysis-service.ts`;
  - `src/ui/screens/sources/FallowReportFacts.vue` (a row);
  - `src/ui/audit-copy/fallow.ts` (the GCN12 strings).

- [ ] **Step 1: The name list (GCP7).** Take fallow 3.27.0's config file names from its own documentation. Run `fallow --help`, or `fallow init --help`, with the FALLOW_BIN binary, and/or search the binary's strings for `.fallowrc`. Record the exact command and output excerpt in the module's header comment as the source. `extends` chains are not followed.
- [ ] **Step 2: RED.**
  - A fake port with `.fallowrc.json` in the root gives `listConfigFiles` → `['.fallowrc.json']`.
  - A collected run's provenance carries it.
  - FallowReportFacts shows "fallow config files in the root: .fallowrc.json".
  - **Control:** no config file gives "No fallow config file in the root".
- [ ] **Step 3: Implement.** The service stats each name under the root via `deps.getFilesystem()` before calling the coordinator. The coordinator copies the list into `report.collected`. An imported (not collected) report shows no row. Check every builder of `CollectedRunProvenance` in tests and fixtures, and add the field.
- [ ] **Step 4: GREEN.** Run the new test, the analysis-coordinator tests, fallow-analysis-service, evidence-model, FallowReportFacts' tests, axe and `npm run test:fallow` (a real run records the list).
- [ ] **Step 5: Gate and commit.** Subject: `feat(fallow): a collected run records which fallow config files were in the root (gap closure GRB9)`.

---

### Task 13: Windows tree kill — probe, then close or fix (GRB3, GCO9)

**Files:**
- Probe only: a scratch script in the session scratchpad, never committed.
- Then either:
  - **no children:** `tests/fallow-real/fallow-no-children.test.ts`, an opt-in Windows test;
  - **children:** `src/adapters/fallow/fallow-runner.ts:103-119`, `tests/unit/no-process-execution.test.ts:22-25,54`, `tests/unit/fallow-runner.test.ts:124`, and a real fixture with a grandchild.

- [ ] **Step 1: The probe.** It has three parts:
  - **Static:** search fallow.exe's imports and strings for `CreateProcess` and `git`.
  - **Dynamic:** run fallow over a git fixture and over this repository. While it runs, poll `Win32_Process` recursively for descendants of its PID, and also run a WMI process-creation subscription, through PowerShell `Get-CimInstance` and `Register-CimIndicationEvent`.
  - **Cancel-kill check:** cancel a run mid-way, then confirm that no descendant outlives it.

  Record the results in the report.
- [ ] **Step 2: The controller rules on the probe's record.**
  - **No children:** add the opt-in test `spawns no child process on Windows`. It skips unless `FALLOW_BIN` is set and the platform is win32, and polls descendants during a real run. Close GRB3 with the evidence.
  - **Children:** before the direct kill, run `taskkill.exe /PID <pid> /T /F` from `%SystemRoot%\System32` with a strict path check. Record it as a widening of Z14/Z15/Z37. `no-process-execution.test.ts` allows a spawn count of 2, and fallow-runner's test records the taskkill argv as its RED.
- [ ] **Step 3: Gate and commit.** Subject: `test(fallow): fallow 3.27.0 spawns no child on Windows, so the direct kill is the whole tree (gap closure GRB3)`, or the fix subject if children were found.

---

### Task 14: Bounded scan concurrency, a window of 8 per directory (GRB2, GCO8, GCN5)

**Files:**
- Modify:
  - `src/adapters/filesystem/walker.ts:110-252`;
  - `tests/integration/walker-concurrency.test.ts:1-200` (the four rewrites below);
  - `tests/unit/inventory-collector.test.ts:112-147`;
  - spec §7 and the G2 evidence wording (GCO8: "no excluded path is ever opened; nothing new is dispatched after a cancel; in-flight reads drain before the run reports cancelled"). The spec is LF; `gate-evidence.md` is CRLF, so edit it with Edit only.

- [ ] **Step 1: RED.**
  - (a) A naive window (`Promise.all` over 8 entries, emitted on completion) fails the existing order test at `:80`, which wraps reads in reverse delays. Write the windowed implementation behind that test, and show it fails until results are consumed in index order.
  - (b) Rewrite `:174` as: "no new lstat or read starts after the cancel is observed; reads ≤ 3 + W − 1; an excluded path never appears". With the dispatch guard temporarily removed, the test fails, which is the mutation RED.
- [ ] **Step 2: Implement.** Within each directory's entry loop, keep a queue of up to **8** in-flight `classifyEntry` preparations, one per upcoming entry in index order. Each runs `lstat` and, for a regular file within the size cap, `readAsText`.
  - Check exclusion and containment **before** dispatching an entry.
  - Check `token.throwIfCancelled()` before each dispatch, and never dispatch after it throws.
  - Consume the results strictly in index order, so the emitted order, the directory pushes onto the stack, and the `maxEntries` accounting are unchanged.
  - In `finally`, await every in-flight preparation (allSettled) before rethrowing, so the run reports cancelled only after the reads drain.
  - Keep `YIELD_EVERY` ticks.
- [ ] **Step 3: Rewrite the pins** as spec GRB2 says:
  - `:125`: the read log is compared as a **multiset**, because its order is now completion-dependent (GCN5).
  - `:138`: still exactly one lstat per entry.
  - The collector test (`:146-147`): asserts that no open is dispatched after the cancel.
  - Fix the header comments at `:10` and `:110`. They claim emission order protects `fileSetDigest`, but the digest sorts its paths (`inventory-collector.ts:250`); emission order protects the UI's order and the evidence order.
- [ ] **Step 4: Benchmark (print-only).** Re-measure `collectInventory` on the 1,000- and 5,000-file fixtures (`city-benchmark.test.ts`'s `scanMs`), before and after. Report the speed-up. Add no new assertion.
- [ ] **Step 5: The GCO8 wording, in writing.**
  - Spec §7: replace "a cancelled run opens nothing further" with the GCO8 sentence, citing GRB2.
  - The G2 evidence line in `gate-evidence.md`: likewise, in CRLF.
- [ ] **Step 6: GREEN.** Run the walker tests, inventory-collector, the source-filesystem-port contract, scan-lifecycle, the acceptance scan steps and city-benchmark.
- [ ] **Step 7: Gate and commit.** Subject: `feat(scan): read up to 8 entries per directory at once, with unchanged emission order; a cancel dispatches nothing new and drains in-flight reads (gap closure GRB2, GCO8)`.

---

### Task 15: Per-device fallow bindings, analyzer record v2 (GRB10, GCO23, GCN10, GCQ6)

**Files:**
- Modify:
  - `src/application/analysis/analyzer-record.ts` (all of it);
  - `src/adapters/storage/plugin-data-analyzer-store.ts`;
  - `tests/unit/analyzer-record.test.ts`;
  - `tests/contracts/analyzer-binding-store.contract.ts`;
  - the UI that shows `invalid` (`setting-definitions.ts:151-163`, `FallowRunPanel.vue:48`): it shows the reason.

- [ ] **Step 1: RED.**
  - (a) Bind on machine A, then bind on machine B, and A is still bound. Today B's bind replaces the whole entry (`withEntry`, `:97-100`).
  - (b) A v1 entry for A reads as bound on A. The next write on A stores v2 with A's device, under the data lock.
  - (c) An invalid v2 (a device's `executablePath` relative) reads `{ kind: 'invalid', reason }`, with a reason naming the field. A bind on that machine replaces only that device and keeps the other devices.
  - (d) `v: 3` reads `unsupported` and refuses writes.
  - (e) Purge stays format-blind.
- [ ] **Step 2: Implement.**
  - The v2 entry is `{ v: 2, provider: 'fallow', devices: { [machineId]: { executablePath, timeoutSeconds, trust } } }`, validated strictly per device.
  - The decoder reads v1 as a one-device v2.
  - `applyAnalyzerWrite` always writes v2: it migrates v1, edits only this machine's device, and `forget` removes only this device (the whole entry when the last device goes).
  - `AnalyzerBindingRead`'s `invalid` gains `reason: string`. Every consumer is updated (grep the kinds).
- [ ] **Step 3: GREEN.** Run the record, contract and store tests, consent, settings-fallow, analysis-store and fallow-analysis-service.
- [ ] **Step 4: Gate and commit.** Subject: `feat(fallow): each device keeps its own fallow binding (analyzer record v2, v1 migrated on write) (gap closure GRB10, GCO23)`.

---

### Task 16: Live external `data.json` edits, and native scenario 43 (GRB1, GCO7, GCQ7, GCQ8)

**Files:**
- Modify:
  - `src/adapters/storage/plugin-data-shape.ts` (adds `notifyExternalChange(plugin)`, which runs every watcher once);
  - `src/main.ts` (overrides `onExternalSettingsChange`);
  - `src/adapters/storage/review-repository-registry.ts` and `plugin-data-review-repository.ts` (adds `externalChange()`);
  - `src/application/analysis/fallow-analysis-service.ts` (adds `externalChange()`, a `bindingChanged(null)` broadcast);
  - `src/ui/stores/analysis-store.ts` (treats `null` as a match);
  - `src/ui/stores/investigation-store.ts` (re-runs `loadDestination` on a profiles/investigations change it hears);
  - `tests/e2e/settings.e2e.ts`, `required-scenarios.json`.
- Create: `tests/unit/plugin-data-external.test.ts`, `tests/host/external-settings-change.test.ts`.

- [ ] **Step 1: RED (unit).** `notifyExternalChange(plugin)`:
  - calls every watcher once, whatever its keys;
  - isolates a throwing watcher;
  - calls `saveData` zero times.
- [ ] **Step 2: RED (host).**
  1. `plugin.onExternalSettingsChange()` refreshes the settings tab.
  2. The review store re-lists from the new data.
  3. The analysis store re-reads its binding.
  4. A city leaf re-resolves the codebase name (GRA8's `profiles` watch already hears it).
  5. The investigation destination re-loads.
  6. **The stale-read race (Review Focus 1):** an own write is pending (`ownWrites > 0`) when the external change lands, and that own write is still visible after both settle.
  7. No `saveData` call happens from the re-read.
- [ ] **Step 3: Implement.**
  - **Data layer:** `notifyExternalChange` iterates the plugin's watchers with the same try/catch as `notifyWritten`.
  - **`main.ts`:** `override onExternalSettingsChange(): void { notifyExternalChange(this); reviewRegistry.externalChange(); analysis.externalChange(); }`. Read-only, and safe if called before onload has finished: guard on the services existing.
  - **Review registry:** `externalChange()` calls each live instance's `externalChange()`, which clears `reading` and calls `notify()`. It does not retire the instance.
  - **Analysis service:** `externalChange()` calls `bindingChanged(null)`, and `analysis-store`'s listener treats `null` as its id.
  - **Investigation store:** hears it through the notes port's subscription, or through a `watchPluginData` it already has via host wiring. Pick the existing channel and note which.
- [ ] **Step 4: Native scenario 43.** Add to `settings.e2e.ts` a test titled exactly `the settings tab follows a data.json changed outside the plugin and names an invalid record's reason`, and append the title to `required-scenarios.json`.
  - **Probe first (GCQ8).** Write `data.json` from Node (`writeFileSync` on `<vault>/.obsidian/plugins/<id>/data.json`, with a profile renamed). Wait up to 5 s. Check that the settings tab lists the new name.
  - **Positive control:** the tab lists the original name before the write.
  - **Second half:** write a record with an invalid profile, and assert the tab shows the reason. Use the existing validation-failure notice or row, the ProfileStore path at `settings-tab.ts:92-116`.
  - **RED:** with the override temporarily removed, the tab keeps the old name.
  - Restore `data.json` in `finally`.
- [ ] **Step 5: GREEN.** Run the new tests, plugin-data-watch, plugin-onload, review-repository-registry, the review-store tests, analysis-store, codebase-name, data-ports and the native `settings.e2e.ts` alone.
- [ ] **Step 6: Gate and commit.** Subject: `feat(settings): a data.json changed outside the plugin reloads every open store, read-only (gap closure GRB1, Y19; scenario 43)`.

---

### Task 17: The unreadable state, accepted limits, evidence and verification (GRB17b, GRB18, GCN11)

**Files:**
- Modify:
  - `src/application/ports/source-filesystem-port.ts:74-81` (`unreadable?: string`);
  - `src/adapters/filesystem/node-source-filesystem.ts:141-152` and `tests/fixtures/fake-source-filesystem.ts:142-145`;
  - `src/application/investigation/source-preview.ts` (`unreadable` → `read-error`);
  - `src/host/modals/source-modal.ts:222-233` (the GCN12 code copy);
  - `src/application/scan-coordinator.ts:151-157` and the walker root-list rethrow (GCQ9);
  - the WP-01 spec §4.5 (additive, in writing);
  - LIM, the two CRLF evidence notes, `Test Evidence.md`, the deliverables, and the count tests.
- Create: `tests/unit/stat-unreadable.test.ts`, `tests/host/source-modal-unreadable.test.ts`.

- [ ] **Step 1: RED (GRB17b).**
  - An injected EACCES on `lstat` gives `stat()` → `{ exists: true, unreadable: 'EACCES', … }`. Today it gives `{ exists: false }`.
  - The preview of that path reports `read-error`, not `missing`.
  - The source modal shows "The folder cannot be read (EACCES)."
  - A scan whose root stat is unreadable, or whose root listing throws, reports root-unavailable with the cause (GCQ9).
  - **Control:** ENOENT stays `exists: false` and `missing`.
- [ ] **Step 2: Implement.**
  - The node adapter maps an `ENOENT`/`ENOTDIR` lstat error to `exists: false`, and any other error code to `exists: true, unreadable: code`.
  - Every consumer of `StatResult` is checked: grep `.exists` on stat results. A consumer that treats `exists && !isDirectory` as "not a folder" must treat `unreadable` explicitly.
  - Amend §4.5 in writing.
- [ ] **Step 3: GRB18, accepted limits (GCN11).** Give each §7 Accept item a dated line in LIM with its reason: B6/GCO24, B11(a)(b), B12, B14(1)(2)(4)(5)(6), B15(1)(2)(5)(6), B16(b) and GCO15. Skip any LIM already carries, and check first.
- [ ] **Step 4: Evidence.**
  1. Run `npm run test`, and take the G8 figures from a run where Z38 executed. Refresh the counts, with Edit/Write only and a CRLF proof.
  2. `npm run verify` exits 0. Disclose every run.
  3. The native gate on 1.13.4, then latest: "Verified 46 executed native Vitest cases, including all 46 required scenarios."
  4. `npm run test:fallow`, `npm run analyze` (4) and `npm audit` (0).
  5. Update `Test Evidence.md`'s native paragraph to 46. Add a Part B section to `gate-evidence.md`.
  6. Update the deliverables' Delivery records:
     - Investigation and Notes: GRB4–GRB8, GRB16;
     - Fallow Ingestion: GRB3, GRB9, GRB10;
     - Native Codebase City: GRB2, GRB11, GRB12, GRB17.
  7. Run `npm run harness-shot`, and look at any capture whose screen Part B touched: Investigate, Sources/fallow facts, the tables after Show more.
- [ ] **Step 5: Commit.** Subject: `fix(fs): an unreadable path is reported as unreadable, not missing; accepted limits recorded; gap-closure Part B evidence (gap closure GRB17b, GRB18)`. If the src change and the docs are better split, use two commits.

After the push, the controller takes one look at PR 1's CI run and rules on any failure (GCN9). The PR 1 body moves the accepted items into "decided limitations" (GCN11).
