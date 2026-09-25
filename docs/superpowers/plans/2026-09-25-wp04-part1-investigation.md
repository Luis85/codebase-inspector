# WP-04 Part 1 — Investigation workbench and Markdown notes: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn one fallow finding into an investigation. A new **Investigate** screen lists Quality's findings in a stable total order with native filters, shows the finding's evidence bundle, uncertainties and a verification checklist, and reads a bounded, read-only window of the anchor file that says when its line may have moved. From there the user creates a Markdown note in a vault folder they confirm (never overwriting, with escaped text and a delimited evidence block), refreshes that block later without touching the human sections, and finds every note again through its own frontmatter.

**Architecture:**
- Pure note and preview code lives in `src/application/investigation/`: escaping (`note-text.ts`), names and folders (`note-path.ts`), the frontmatter object and body renderer (`note-model.ts`), the marker-exact splice (`evidence-block.ts`), the stale-location rule (`stale-location.ts`), the source preview over `SourceFileSystemPort` (`source-preview.ts`), root-path arithmetic (`root-path.ts`) and the note-index reducer (`note-index.ts`). It holds no copy: every word reaches it as a `NoteVocabulary` argument (spec §3, IP3). `mdCode` moves to `src/application/markdown-code.ts` (spec §3, IP2).
- **One application port** (spec §3): `InvestigationNotesPort` (`src/application/ports/investigation-notes-port.ts`) with its eight members — `list`, `create`, `refresh`, `open`, `subscribe`, `destination`, `plan`, `sourceNotePath` (IP12). The folder setting's store is an adapter type, `InvestigationFolderStore`, declared in `src/adapters/storage/plugin-data-investigation-store.ts` and used only by the host (IP42).
- The host implements the notes port over Obsidian's `Vault`, `MetadataCache`, `FileManager` and `Workspace` (`src/host/investigation-notes.ts`, `src/host/investigation-note-index.ts`, events registered through `plugin.registerEvent` on first use, never in `onload`), builds the port and the source preview in `src/host/investigation-services.ts` (IP41), and hands them to each leaf through `CityViewDeps` and `wireDataPorts`, as `fallowAnalysis` reaches the UI.
- The UI gets a route `investigate`, `src/ui/screens/InvestigateScreen.vue` with `src/ui/screens/investigate/*`, read models `src/ui/read-models/investigation.ts` and `investigation-evidence.ts`, a per-leaf session store `src/ui/stores/investigation-store.ts`, and copy in `src/ui/audit-copy/investigation.ts` (re-exported through `inspector-copy.ts`).
- One new durable key: `data.json` `investigations: { [profileId]: { folder } }`, owned by `src/adapters/storage/plugin-data-investigation-store.ts`. `CityViewState` gains only the `route` value `'investigate'`.
- **Native acceptance (O8, Task 0):** describe's native Obsidian e2e harness, ported — `tests/e2e/` (a Node-only Vitest project over standalone WebdriverIO and `wdio-obsidian-service`), `tests/support/session-lifecycle.ts`, and `scripts/{native-tests,check-native-results}.mjs` behind `npm run test:e2e` (IN42–IN51). The fast suite and the in-memory vault (IN37) are unchanged.

**Tech Stack:** TypeScript 6.0.3, Vue 3.5.43 (`<script setup>`), Pinia 4.0.3, zod 4.6.5, Obsidian API 1.13.1 typings (`minAppVersion` 1.13.0), Vitest 5.0.1 (`vitest.config.ts` projects `node` and `jsdom`) + @vue/test-utils 2.5.1, `yaml` 2.9.1 (test double for `parseYaml`/`stringifyYaml` only, a new devDependency, IP29), Node 24.15 (`node:*` in tests and scripts only), `wdio-obsidian-service` 3.2.1 + `webdriverio` 9.32.0 with the `@puppeteer/browsers` 3.2.3 override (native layer only, IN42), fallow 3.21.0 / 3.27.0 (recordings, `npm run test:fallow` and `npm run analyze` only — never a dependency).

**Spec:** `docs/superpowers/specs/2026-09-25-wp04-part1-investigation-design.md` (IN1–IN51, owner decisions O1–O8; the spec adopts IP2–IP39 by number where it cites them). **19 tasks: Task 0 (native harness), then Tasks 1–18.** Binding with it:
- the WP-01 spec §4 frozen contracts (the only change is the additive `RouteId` value, guarded by `isRouteId` and `z.enum(ROUTE_IDS)` in `src/domain/validator.ts:235`);
- the WP-02 Part 1–7 specs and the WP-03 Part 1 spec (N1–N40);
- every ledger, including `docs/superpowers/notes/2026-09-24-wp03-part1-ledger.md` and `docs/superpowers/notes/2026-09-25-wp03-part1-polish-ledger.md`.

Planning rulings are **IP1…**, in `docs/superpowers/notes/2026-09-25-wp04-part1-ledger.md`. Pre-flight rulings are **IPF1…** and execution rulings "WP-04 E1…", all in that ledger.

**Branch:** `feat/wp-04-part1` in worktree `.claude/worktrees/wp-04-part1`, from `1cba08c`, the WP-03 polish head (polish ledger JP8). `node_modules` is installed. The spec, this plan and the ledger are committed together, before Task 1. Integration (fast-forward onto `feat/wp-01-codebase-city`) happens after the final review.

**Before Task 0:** the controller re-measures every line count below at the branch head and checks every Task 0 "Consumes" name.

**Before Task 1:** the controller runs the pre-flight scan. It checks every "Consumes" name against the code, re-measures every line count below at the branch head (Architecture files were being edited when this plan was written), and reads the outcomes of the spec §6 "confirm at pre-flight" row, which now run as Task 0's native tests in `tests/e2e/obsidian-facts.e2e.ts` (IN51 b) against a real Obsidian — (a) `vault.create` rejects on an existing path, (b) backslash escapes suppress wikilinks, embeds, tags, comments, highlights, block ids and math in reading and live-preview views, (c) `metadataCache` fires `changed` after `vault.process` and `processFrontMatter`, (d) how `stringifyYaml` quotes `yes`, `null`, `0012`, `a: b`, (e) whether `createFolder` creates parents — and records each result, from `reports/native/cases/*/probe.json`, as an IPF ruling. If Task 0 stopped under IN50 (no native session on this machine), the controller runs the five probes by hand in a real Obsidian 1.13 vault instead. Every one has a fallback already in this plan: the pre-check (a, Task 9), escaping plus code spans (b, Task 2), the `resolved` rebuild (c, Task 9), string-typed validation on read (d, Task 5), segment-by-segment creation (e, Task 9). A result that defeats its fallback stops the plan for a spec change. Before each dispatch it re-checks every "Consumes" name against what earlier tasks committed.

## Global Constraints

**Binding (owner)** — every task obeys all of these; the sections below spell each one out:
- the WP-01 spec §4 frozen contracts; the WP-02 Part 1–7 specs and the WP-03 Part 1 spec (N1–N40); every ledger, including `docs/superpowers/notes/2026-09-24-wp03-part1-ledger.md` and `docs/superpowers/notes/2026-09-25-wp03-part1-polish-ledger.md`;
- the 400 (src) / 450 (tests) line caps, the city-view budget (`city-view.ts` and `CityWorkspace.vue` ≤ 360; `CityViewport.vue` 400/400, never edited) and layering;
- E40 (`aria-disabled` plus a guarded handler), and copy in audit-copy (the new module `src/ui/audit-copy/investigation.ts`, re-exported through `inspector-copy.ts`);
- CRLF files are edited only with Edit/Write (never `sed`, heredocs or scripts);
- explicit timeouts for slow scans (`30_000` for whole-src scans);
- the `npm run analyze` baseline of **9** (a new dead export is removed, not baselined);
- never `git stash`; every commit message ends with the literal trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", whatever model runs;
- implementers never spawn subagents; the RED rule; tests build reports through the real parser (no parser mocks).

**Size** (eslint `max-lines`; measured at `6624cea` with `wc -l`; re-measure at pre-flight)
- `src/**/*.{ts,vue}` max **400** lines. `tests/**/*.ts` max **450** lines. A file that would pass its cap is split, never compressed.
- `src/host/city-view.ts` (297) and `src/ui/screens/CityWorkspace.vue` (189) are capped at **360** by `tests/unit/city-budget.test.ts`. **This plan edits neither**: the new ports reach the leaf through `CityViewDeps` (`city-scan-controller.ts`) and `wireDataPorts` (`data-ports.ts`), which `city-view.ts` already calls.
- `src/ui/components/CityViewport.vue` is **400/400**: never edited.
- `src` files this plan touches, with their size now:
  - **domain:** `domain/route-ids.ts` 16.
  - **adapters:** `adapters/storage/plugin-data-shape.ts` 115.
  - **host:** `main.ts` 124, `host/city-scan-controller.ts` 162, `host/data-ports.ts` 48, `host/setting-definitions.ts` 209, `host/settings-tab.ts` 304.
  - **ui shell and models:** `ui/routes.ts` 36, `ui/App.vue` 197, `ui/shell/use-route-provenance.ts` 44, `ui/read-models/use-read-models.ts` 185, `ui/export/markdown.ts` 56.
  - **copy:** `ui/inspector-copy.ts` 298, `ui/audit-copy/settings.ts` 102.
  - **screens and components:** `ui/components/FileInspector.vue` 215, `ui/screens/quality/FindingReviewDialog.vue` 285, `ui/screens/FileDetailScreen.vue` 161, `ui/screens/file/FileFindingsPanel.vue` 94, `ui/screens/ArchitectureScreen.vue` 252, `ui/screens/architecture/CycleList.vue` 90, `ui/screens/architecture/FallowBoundaryTable.vue` 118, `ui/screens/workbench/WorkItemEditor.vue` 316, `ui/screens/settings/PrivacyRows.vue` 99.
  - **CSS (no cap):** `ui/styles/screens-act.css` 83, `ui/styles/kit.css` 295.
  - **new src files** (each planned under 300 lines; the task names its split if it grows): `application/markdown-code.ts`; `application/investigation/{note-text,note-path,note-model,evidence-block,stale-location,source-preview,root-path,note-index}.ts`; `application/ports/investigation-notes-port.ts`; `adapters/storage/plugin-data-investigation-store.ts`; `host/{investigation-services,investigation-notes,investigation-note-index}.ts`; `ui/audit-copy/investigation.ts`; `ui/read-models/{investigation,investigation-evidence}.ts`; `ui/stores/investigation-store.ts`; `ui/screens/InvestigateScreen.vue`; `ui/screens/investigate/{InvestigationFilters,InvestigationList,EvidencePanel,UncertaintyPanel,SourcePreviewPanel,NotesPanel,CreateNoteDialog,RefreshNoteDialog,OrphanNotesPanel}.vue`, `ui/screens/investigate/use-open-investigation.ts`; `ui/screens/city/CityFindingsPanel.vue`.
- Test and tooling files this plan touches, with their size now:
  - **unit/component edits in place:** `tests/unit/route-state.test.ts` 73, `tests/component/command-palette.test.ts` 121, `tests/component/workspace-shell.test.ts` 322, `tests/component/settings-tab-validation.test.ts` 217, `tests/component/settings-fallow.test.ts` 189, `tests/component/settings-tab-purge.test.ts` 114, `tests/host/plugin-onload.test.ts` 231.
  - **fixtures and mocks:** `tests/fixtures/data-port-deps.ts` 26, `tests/mocks/obsidian.ts` 336.
  - **harness:** `tests/harness/mount.ts` 374, `tests/harness/page.ts` 78, `tests/harness/seed.ts` 196, `tests/harness/harness-evidence.test.ts` 163, `tests/build/harness-shot.test.ts` 180, `scripts/harness-shot.mjs` 329.
  - **evidence:** `tests/unit/gate-evidence.test.ts` 336, `tests/unit/evidence-numbers.test.ts` **403**.
  - **package:** `package.json` 45, `package-lock.json` (IP29; Task 0's native dependencies, IN42).
  - **tooling (Task 0):** `.gitignore` 6, `eslint.config.mjs` 258, `.oxlintrc.json` 12, `tsconfig.test.json` 13; read, not edited: `vitest.config.ts` 70, `vitest.fallow.config.ts` 12, `tsconfig.json` 16, `manifest.json` 10.
  - **new test and script files (Task 0):** `tests/support/{session-lifecycle,probe-strings}.ts`; `tests/unit/{session-lifecycle,native-results-gate}.test.ts`; `tests/e2e/{vitest.config.mts,tsconfig.json,required-scenarios.json,session.ts,fixture.ts,diagnostics.ts,inspector.ts,smoke.e2e.ts,obsidian-facts.e2e.ts,lifecycle.e2e.ts}`, `tests/e2e/vault/Welcome.md`; `scripts/{native-tests,check-native-results}.mjs`. Each planned under 200 lines.
- **At or near the tests cap — never grow them:** `tests/component/renderer-contract.test.ts` **450**, `city-viewport.test.ts` **448**, `welcome-state.test.ts` **446**, `picking.test.ts` **440**, `tests/host/city-view-store-wiring.test.ts` **439**, `tests/component/settings-tab.test.ts` **436**, `tests/contracts/review-repository.contract.ts` **423**, `tests/host/city-view.test.ts` **421**, `tests/component/consent-chain.test.ts` **420**, `responsive-floor.test.ts` **415**, `tests/host/window-migration.test.ts` **409**, `tests/unit/evidence-numbers.test.ts` **403**, `tests/unit/camera-rig.test.ts` **401**. The one exception is `settings-tab.test.ts` (Task 8): its constructor call is edited **on its existing line**, plus one import line (436 → 437, IP28). New tests go in new files, named in each task.

**Layering**
- `src/domain/**` is untouched except `route-ids.ts` (eslint Rule 2 keeps it pure).
- `src/application/**` imports no adapter, no host, no UI, no Obsidian and no Node module. It may import `src/domain/**` (`normalizeRelativePath`, `normalizeExclusion`, `isContained`, `countPhysicalLines`, `isPlainObject`). It holds **no copy** (IP3).
- `src/adapters/**` imports application ports and rules, never UI.
- `src/host/**` may import adapters, application and `src/ui/inspector-copy.ts` (as `settings-tab.ts` does).
- `src/ui/**` never imports `src/adapters/**` or `src/host/**`. It may import application types and pure functions. Screens read application data through read models and stores.
- `obsidianmd/no-nodejs-modules` stays an error in `src/**`. `obsidianmd/hardcoded-config-path`: the vault config folder is always `app.vault.configDir`, never a literal.
- **No process change:** nothing here spawns, and `fallow-argv-policy.test.ts` passes unchanged.
- **No source write:** `SourceFileSystemPort` has no write method, and nothing in this plan adds one. The only writes are `Vault.createFolder`, `Vault.create`, `Vault.process` and `FileManager.processFrontMatter`, all in `src/host/investigation-notes.ts`, and only from the create and refresh dialogs (IN35). A note may land inside the codebase root only through the create dialog's explicit overlap path (O7, IN29), and the only profile change is the exclusion that path adds through `ProfileStore.update`.

**Evidence (Part 6, Z23/Z25, IN17)**
- No percentage, score, "safe to delete" or invented risk anywhere, on screen or in a note.
- Every value from a report or a note is rendered through Vue text interpolation only: never `v-html`, `innerHTML` or an `href`. The source preview is text in a `<pre>` (IN8).
- A collected report's absolute paths (`collected.rootPath`, `executablePath`, `args`) never reach a note, the screen or `data.json` (Y28).
- Every surface showing a cycle, boundary or unresolved finding's evidence carries `RELATIONS_SCOPE_NOTE` (N5).

**Storage**
- One new durable key, `investigations`, written only through `writePluginDataSlice` under the plugin data lock (Polish E7: the mutate never edits its input in place). `CityViewState` and `getState()` change only by the new route value. The review format stays v2. Notes are the record of an investigation (O3): no link table.

**TypeScript and lint** (carried from Parts 6 and 7 and WP-03)
- **ES2020 only:** tsconfig `lib` is ES2020, so no `.at()`, `Object.hasOwn`, `replaceAll` or `findLast` in `src`.
- **oxlint:** `--deny-warnings` and `consistent-function-scoping`: a closure that captures nothing is hoisted to module scope. No `[...set]` spread in `src`; use `Array.from(set)`.
- **PF1:** timers in `src` are read through a local binding at call time. Tests use `node:timers/promises`.
- **PF2:** no no-op closure initialisers.
- **PF14:** store and composable members a screen destructures are arrow-function properties, never methods.
- **Type assertions:** no `as` a type already has (Part 7 E13). `npx eslint <file> --max-warnings 0` catches it. Obsidian's `processFrontMatter` callback parameter is `any`: type it `(frontmatter: unknown) => void` and narrow with `isPlainObject`.
- **`exactOptionalPropertyTypes`:** never assign `undefined` to an optional property; spread it in conditionally.
- **Dead exports:** an export no other `src` module imports is a new `npm run analyze` finding (tests do not count). Keep helpers module-private and test them through their exported caller.
- **Code-unit order:** every new sort compares strings with `<`/`>` (J3), never `localeCompare`.

**Browser globals and accessibility** (carried)
- No bare `window`, `document`, `setTimeout` or `localStorage` in `src/ui/**`. Never `x instanceof HTMLElement`. In `src/host/**`, `instanceof TFile`/`TFolder`/`FileSystemAdapter` is required (prefer-instanceof), never a cast.
- Element ids come from `useUniqueId()`.
- **E40:** a button that can become blocked while focused uses `aria-disabled="true"` plus a guarded handler, never `disabled`. This covers Create, Refresh, Reload, Add work item and Open.
- Announce only real outcomes (E17), through `reannounce(live, message)`. A refusal that changed nothing announces its reason in the dialog's own `role="alert"` line, never success.
- E20: a `<button>` holds phrasing content only; a row that already is a button gets a **sibling** Investigate button, never a nested one.

**Copy and CSS**
- **Where strings go:**
  - `src/ui/audit-copy/investigation.ts` (new): every Investigate screen, dialog, preview, entry-point, settings-row and note-vocabulary string, re-exported through `src/ui/inspector-copy.ts` with one `export * from './audit-copy/investigation';` line. Never `src/ui/copy.ts`.
  - New names use the prefixes `INVESTIGATE_`, `PREVIEW_`, `NOTE_`, `NOTES_`, `REFRESH_`, `UNCERTAINTY_`, `CHECKLIST_`. `INVESTIGATE_HOTSPOT_TITLE`, `INVESTIGATE_HOTSPOT_DETAIL`, `INVESTIGATE_MODULE_DETAIL`, `INVESTIGATE_FILE_TITLE`, `INVESTIGATE_LARGEST_DETAIL` (`inspector-copy.ts:75–81`) and `INVESTIGATE_FILE_LABEL` (`:265`) already exist and are never redefined (IP40).
  - Changed in place, per IN41 (O7) with the exact words of IP31: `SETTINGS_STORAGE_TEXT` (`audit-copy/settings.ts:48`, which says "No note in your vault is created or changed") and `STORAGE_DISCLOSURE_TEXT` (`host/setting-definitions.ts:53`) in Task 8; `FILE_SOURCE_PREVIEW_LATER` (`inspector-copy.ts:246`) in Task 15; the README sentence (`README.md:16–17`, not a source file) in Task 18.
- **CSS:**
  - only in `src/ui/styles/screens-act.css` (the Investigate screen) and `src/ui/styles/kit.css` (the city inspector's Findings section);
  - under `:where(.codebase-inspector-root)`, with BEM `ci-*` classes;
  - colours only through `--ci-*` tokens;
  - never edit `src/ui/styles.css`, and no Vue `<style>` blocks.

**Test infrastructure**
- **Test projects:**
  - `node` runs `tests/{unit,contracts,integration,host,build}`;
  - `jsdom` runs `tests/{component,acceptance,benchmarks,harness}`, plus the listed host files (`vitest.config.ts`).
- **Timeouts:** a slow whole-`src` scan or a real-process wait gets an explicit per-test timeout (`30_000` for whole-src scans, Part 7 E21). The acceptance spine (Task 16) copies and scans a real folder: give each of its tests `30_000`.
- **The RED rule:** every new test must fail without its code, and the implementer runs it RED and pastes the output. A pin on behaviour that already holds is proved by the mutation the task names. Every `.every(...)` assertion is preceded by a non-empty check (E27).
- **No mocks for the parser:** tests build reports through the real parser and normaliser (`tests/fixtures/evidence-report.ts`, `tests/fixtures/relations-report.ts`, the recordings under `tests/fixtures/fallow/`). The vault is the in-memory `tests/fixtures/fake-vault.ts` (Task 7), whose YAML goes through the real `yaml` library.
- **Editing files:** only with the Edit/Write tools. Never `sed -i`, heredocs or scripts: files are CRLF on Windows.
- **Harness-reachable fixtures:** `tests/fixtures/fake-vault.ts` and `tests/fixtures/fake-investigation.ts` are imported by the browser harness (Task 17), so they import neither `vitest` nor any `node:*` module (the WP-03 Task 14 lesson in `tests/fixtures/relations-report.ts:6–17`).

**Native layer** (O8, IN42–IN51; Task 0 builds it)
- **Separation:** `tests/e2e/**/*.e2e.ts` run only under `tests/e2e/vitest.config.mts` (Node environment, **no `obsidian` alias**: a native test imports the real `obsidian` types only, and nothing under `tests/e2e/` imports `tests/mocks/**` or `tests/fixtures/**`). The fast suite (`vitest.config.ts`) never collects them: its includes name `tests/{unit,contracts,integration,host,build}/**/*.test.ts` and `tests/{component,acceptance,benchmarks,harness}/**`, and `*.e2e.ts` matches none. Host-independent native code (`tests/support/**`) is unit-tested in the fast suite, under `tests/unit/` (IP45).
- **Commands:** `npm run test:e2e` = `npm run build` + the native project + the results gate. It is **never** part of `npm run verify`, and no per-task gate runs it except where a task names a native step; `verify` still typechecks (`tests/e2e/tsconfig.json`) and lints the native files (IP49, IP50).
- **Discipline:** sequential, isolated, **`retry: 0`**, `expect.poll` instead of sleeps, explicit timeouts (`testTimeout: 120_000`, `hookTimeout: 180_000`, poll `10_000`/`100`). A native failure is reproduced with the recorded versions before any selector or assertion changes; it is never retried away.
- **Lint and size:** the 450-line test cap applies to `tests/e2e/**` and `tests/support/**`; `tests/e2e/tsconfig.json` joins `parserOptions.project`; the only lint exceptions are the named `obsidianmd` rules of IP50, scoped to `tests/e2e/**`, each added only when it fires.
- **Types:** `tests/e2e/tsconfig.json` extends the root, with `lib` ES2022 and `types: ["node", "webdriverio", "wdio-obsidian-service"]`; `tsconfig.test.json` excludes `tests/e2e/**` and adds `ES2021.Promise` (for `AggregateError` in `tests/support/session-lifecycle.ts`). `src` stays ES2020 through `tsconfig.json` (IP49).
- **Nothing native is committed but code:** `.obsidian-cache/` and `reports/` are git-ignored; the fixture vault holds Markdown only (IP56).

**Gates and commits**
- **Per-task gate:** `npm run typecheck && npm run lint:fast && npx eslint <touched src and test files> --max-warnings 0 && npx vitest run <the task's test files and every existing test file the task edits>`. Run the gate commands in the foreground.
- **Evidence-note counts:** the WP-01 evidence-note counts are updated **once, in Task 18** (L28). Until then `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` may fail on file counts and the `src/` floor. Do not run the full suite per task, and do not "fix" those two tests early.
- **Whole-`src` scans:** `tests/host/clean-vault-install.test.ts`, `tests/unit/no-process-execution.test.ts` and `tests/unit/node-access-boundary.test.ts` scan all of `src/`. Run them in every task that adds a `src/host` or `src/application` file; under load, re-run them alone before calling a failure real.
- **`npm run analyze`:** the baseline is **9**. A new dead export is removed, never baselined. Run it at the end of Tasks 6, 10, 15 and 18.
- **Commits:** commit after each task, with only the task's own files (never the ledger). Every message is `git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"` — that literal trailer, whatever model runs. Never `git stash`; set work aside with a WIP commit.

**Process**
- Implementers and reviewers never spawn subagents. Reviewers are read-only and create no files in the worktree.
- Implementers report:
  - the files changed, with line counts;
  - the gate output;
  - the RED and GREEN output (or the mutation run for a pin);
  - every deviation from this plan, and why.
- Cheap review minors inside a task's own files are fixed in that task's fix round, never deferred.

## Review Focus

Six input classes the spec implies and no happy-path test covers. Each has a named test in its owning task:
1. **A note whose markers a person or tool has disturbed:** a duplicated begin marker, an end before a begin, an indented or trailing-space marker, a marker pasted inside a code fence elsewhere, a vanished end marker, CRLF line endings, and an end marker on the last line with no newline. Refresh must refuse (text byte-identical) or splice byte-exactly around the block. Task 3, "marker variants"; Task 16, "vanished marker".
2. **Report text that is Markdown or Obsidian syntax:** `[[x]]`, `![[x]]`, `<script>`, the literal end marker, `#tag`, `$x$`, `%%`, `==x==`, `^block`, a bare `https://` or `www.` URL, `1)` and `- ` at the start, a line break followed by `# heading` or `---`, and bidi controls, in a symbol, a specifier, a zone name or a path. None may open a link, embed, tag, comment, heading, list, table, math span, highlight or a second evidence block. Task 2, "hostile strings"; Task 16, "injection".
3. **Names that collide where `getAbstractFileByPath` cannot see it:** a case-only difference on a case-insensitive vault, a Windows reserved name with or without an extension, trailing dots or spaces, 99 names already taken, a file where a folder segment should be, and a create that races another writer. Task 2, "reserved and trailing"; Task 9, "case-only collision", "folder is a file" and "race".
4. **A source file that changed after the analysis in a way one check alone misses:** the same byte size with a different line count, CRLF versus LF, an unknown mtime or observation, a line past the end, a symlinked parent folder, and a binding reconnected to another folder since the scan. The highlight must go, naming the first failed check. Task 4, "one check at a time", "symlinked ancestor" and "root changed".
5. **Frontmatter edited by hand or by another tool:** numbers, lists or `null` where strings are expected, a note moved or renamed, two notes for one finding, a note for another codebase, a malformed note, and a note whose finding is no longer reported. Links must follow the note, malformed notes must be counted, and nothing may be dropped silently. Task 5, "hostile frontmatter"; Task 9, "rename and duplicate"; Task 14, "notes for findings not in this report".
6. **The real host disagreeing with our doubles, or failing mid-session:** Obsidian's own YAML quoting, metadata-cache timing, escape handling and `vault.create`/`createFolder` behaviour differing from `tests/mocks/obsidian.ts` and the fake vault; a native session whose start, body or initialisation throws. The probes must record the real behaviour (and a positive control must show the probe can fail), and every session must release the app, the driver and the copied directories. Task 0, "obsidian facts" and "session cleanup"; Task 16, "native spine".

---
### Task 0: The native Obsidian e2e harness (ported from describe)

Ported from `github.com/Luis85/describe` (MIT, same author; O8) at the files named below. Keep describe's code verbatim except for the adaptations this task lists; every other difference is a deviation to report.

**Files:**
- Create:
  - `tests/support/session-lifecycle.ts` (describe's, verbatim, 87 lines), `tests/support/probe-strings.ts`
  - `tests/unit/session-lifecycle.test.ts` (describe's `tests/native/session-lifecycle.test.ts`, import path adapted), `tests/unit/native-results-gate.test.ts` (describe's `tests/native/results-gate.test.ts`, adapted; IP45), `tests/unit/native-baseline.test.ts` (reads `manifest.json` and `tests/e2e/session.ts`'s `NATIVE_BASELINE_VERSION` as text and asserts the baseline is at or above `minAppVersion` by numeric segments; IP47)
  - `tests/e2e/vitest.config.mts`, `tests/e2e/tsconfig.json`, `tests/e2e/required-scenarios.json`, `tests/e2e/session.ts`, `tests/e2e/fixture.ts`, `tests/e2e/diagnostics.ts` (verbatim), `tests/e2e/inspector.ts`, `tests/e2e/smoke.e2e.ts`, `tests/e2e/obsidian-facts.e2e.ts`, `tests/e2e/lifecycle.e2e.ts` (verbatim), `tests/e2e/vault/Welcome.md`
  - `scripts/native-tests.mjs`, `scripts/check-native-results.mjs`
- Modify: `package.json` and `package-lock.json` (devDependencies, `overrides`, the `test:e2e` script, the third `typecheck` project), `.gitignore` (`.obsidian-cache/`, `reports/`), `eslint.config.mjs` (ignores, `parserOptions.project`, the `tests/**` globs, the IP50 block), `.oxlintrc.json` (`ignorePatterns`), `tsconfig.test.json` (exclude `tests/e2e/**`, `lib` + `ES2021.Promise`)
- Not modified (checked): `vitest.config.ts` (its includes collect `tests/unit/*.test.ts` and never `tests/e2e/**/*.e2e.ts`), `vitest.fallow.config.ts` (`tests/fallow-real/**` only), `tests/unit/gate-evidence.test.ts` (it counts `*.test.ts`/`*.steps.ts` per `tests/` directory, so `tests/e2e/` and `tests/support/` are not layers; the two new unit files join the `unit` layer's count in Task 18, IP53), `tests/host/clean-vault-install.test.ts` (scans `src/` and the release files only)
- Test: the three unit files (fast suite), and the three `.e2e.ts` files (native)

**Interfaces:**
- Consumes: `dist/{main.js,manifest.json,styles.css}` from `npm run build`; `manifest.json` `minAppVersion`; the command `codebase-inspector:open-city` (`src/host/commands.ts:38`); the view type `codebase-inspector-city` (`src/host/city-view.ts:50`); the DOM classes `.codebase-inspector-root`, `.ci-screen--<route>`, `.ci-nav__item`, `.ci-topbar__menu`.
- Produces:
  ```ts
  // tests/support/session-lifecycle.ts (verbatim)
  export interface SessionSteps<T> { prepare(): Promise<void>; connect(): Promise<T>; initialize(session: T): Promise<void>; disconnect(session: T): Promise<unknown>; cleanup(): Promise<void> }
  export class SessionLifecycle<T> { constructor(steps: SessionSteps<T>); start(): Promise<T>; close(): Promise<void> }
  export function withSession<T, R>(session: SessionLifecycle<T>, use: (client: T) => Promise<R>): Promise<R>;
  // tests/e2e/session.ts
  export type NativeBrowser = Awaited<ReturnType<typeof startWdioSession>>;
  export const PLUGIN_ID = 'codebase-inspector';
  export const CITY_VIEW_TYPE = 'codebase-inspector-city';
  export const requestedVersion: string;   // OBSIDIAN_VERSION ?? manifest.json minAppVersion (IN49, IP47)
  export function createNativeSession(afterReady?: (browser: NativeBrowser) => Promise<void>): SessionLifecycle<NativeBrowser>;
  // tests/e2e/fixture.ts
  export interface NativeContext {
    browser: NativeBrowser;
    page: ReturnType<NativeBrowser['getObsidianPage']>;
    inspector: InspectorPage;
    directory: string;                     // reports/native/cases/<id>-<name>/
  }
  export const test: TestAPI<{ native: NativeContext }>;
  // tests/e2e/inspector.ts (grows in Tasks 11 and 16)
  export type InspectorPage = ReturnType<typeof createInspectorPage>;
  export function createInspectorPage(browser: NativeBrowser): {
    root(): ChainablePromiseElement;                 // the city leaf's .codebase-inspector-root
    screen(route: string): ChainablePromiseElement;  // .ci-screen--<route> inside it
    openCity(): Promise<void>;                       // executeObsidianCommand('codebase-inspector:open-city'), polled
    navigate(title: string): Promise<void>;          // opens the drawer when the nav is not inline, then clicks the item
    recordErrors(): Promise<void>;                   // hooks console.error, 'error' and 'unhandledrejection' in the app window
    errors(): Promise<string[]>;
  };
  // tests/e2e/diagnostics.ts (verbatim)
  export function caseDirectory(id: string, name: string): Promise<string>;
  export function writeEvidence(directory: string, name: string, value: unknown): Promise<void>;
  export function captureBrowser(browser: NativeBrowser, directory: string): Promise<void>;
  // tests/support/probe-strings.ts (IP52)
  export const PROBE_HOSTILE = '[[x]] ![[x]] #tag $x$ %%c%% ==x== ^block https://x www.x <b>h</b>';
  export const PROBE_ESCAPED = '\\[\\[x\\]\\] \\!\\[\\[x\\]\\] \\#tag \\$x\\$ \\%\\%c\\%\\% \\=\\=x\\=\\= \\^block https\\://x www\\.x \\<b\\>h\\</b\\>';
  ```
  `tests/e2e/required-scenarios.json` (IP46) starts with these eight titles; Task 11 adds one and Task 16 one more:
  ```json
  [
    "loads the plugin without errors and opens the inspector on its default route",
    "vault.create rejects a path that already exists",
    "backslash escapes keep Obsidian syntax inert in reading and live-preview views",
    "the metadata cache reports notes changed by process and processFrontMatter",
    "stringifyYaml round-trips the frontmatter value shapes as strings",
    "folders can be created one segment at a time",
    "releases the app, driver and copied directories after a test body rejects",
    "releases an acquired real session when final initialization rejects"
  ]
  ```

- [ ] **Step 1: Prove a native session starts on this machine (IN50) — first, before anything else is written.**
  - Add the exact devDependencies `"wdio-obsidian-service": "3.2.1"` and `"webdriverio": "9.32.0"` and `"overrides": { "@puppeteer/browsers": "3.2.3" }` to `package.json`, run `npm install --no-audit --no-fund`, and check `npm ls @puppeteer/browsers` shows only 3.2.3. (Its optional peers `appium` and `appium-uiautomator2-driver` stay uninstalled.)
  - Add `.obsidian-cache/` and `reports/` to `.gitignore`.
  - Write `tests/support/session-lifecycle.ts` verbatim, `tests/e2e/tsconfig.json`, `tests/e2e/vitest.config.mts` (Step 3's text), `tests/e2e/vault/Welcome.md` (one line: `A fixture vault for codebase-inspector's native tests.`) and `tests/e2e/session.ts` (Step 3's text).
  - Write a first-contact `tests/e2e/smoke.e2e.ts` with one test only, named as its final title, that starts a session and checks the plugin is enabled:
    ```ts
    import { expect, test } from 'vitest';
    import { withSession } from '../support/session-lifecycle';
    import { createNativeSession, PLUGIN_ID } from './session';

    test('loads the plugin without errors and opens the inspector on its default route', async () => {
      const enabled = await withSession(createNativeSession(), (browser) => browser.executeObsidian(({ app }, id) =>
        (app as unknown as { plugins: { enabledPlugins: Set<string> } }).plugins.enabledPlugins.has(id), PLUGIN_ID));
      expect(enabled).toBe(true);
    });
    ```
  - Run `npm run build` then `node node_modules/vitest/vitest.mjs run --config tests/e2e/vitest.config.mts`. The first run downloads Obsidian `requestedVersion` and chromedriver into `.obsidian-cache/` (note the time and the cache size).
  - **If it passes**, record in the report: the resolved app and installer versions (`browser.getObsidianVersion()`, `getObsidianInstallerVersion()`), `process.platform`, and the wall time; continue.
  - **If no session starts** (download refused, installer extraction fails on Windows, the app does not launch, the driver cannot connect, or the baseline 1.13.4 is not downloadable — never retry with another version, IN49), **stop Task 0**: commit nothing, and report the command, its full output, the `.obsidian-cache/` listing and what was tried. The controller rules; the owner's fallback is the in-memory path (IN37, IN38) with the native scenarios dropped (IN50, IP58).
- [ ] **Step 2: Port the lifecycle unit tests** to `tests/unit/session-lifecycle.test.ts` (describe's file, with `from '../support/session-lifecycle'`). They pass on the verbatim code; prove each guarantee with a mutation, run and reverted: delete `await this.starting?.catch(() => undefined);` in `close()` (the late-connection case fails), and move `await this.steps.cleanup()` inside the `if (this.client !== undefined)` block (the "cleans partial startup when prepare rejects" case fails). Paste both runs.
- [ ] **Step 3: The session, config, fixture and helper.**
  - `tests/e2e/vitest.config.mts` is describe's 21 lines verbatim (`name: 'native-obsidian'`, `include: ['tests/e2e/**/*.e2e.ts']`, `pool: 'forks'`, `maxWorkers: 1`, `fileParallelism: false`, `sequence: { concurrent: false }`, `isolate: true`, `retry: 0`, `testTimeout: 120_000`, `hookTimeout: 180_000`, `expect.poll` `{ timeout: 10_000, interval: 100 }`, reporters `default`, `json`, `junit` into `reports/native/`, `passWithNoTests: false`). It has **no `resolve.alias`**: the native project never sees `tests/mocks/obsidian.ts`.
  - `tests/e2e/tsconfig.json`:
    ```json
    {
      "extends": "../../tsconfig.json",
      "compilerOptions": { "lib": ["ES2022", "DOM", "DOM.Iterable"], "types": ["node", "webdriverio", "wdio-obsidian-service"] },
      "include": ["./**/*.ts", "./**/*.mts", "../support/**/*.ts"],
      "exclude": ["./vault/**"]
    }
    ```
  - `tests/e2e/session.ts` is describe's, with three adaptations: the version comes from our manifest; no mobile emulation (`isDesktopOnly`, IP51); and the plugin and view ids are exported for the tests:
    ```ts
    import { readFileSync } from 'node:fs';
    import { resolve } from 'node:path';
    import { remote } from 'webdriverio';
    import ObsidianWorkerService, { launcher, type startWdioSession } from 'wdio-obsidian-service';
    import { SessionLifecycle } from '../support/session-lifecycle';

    export type NativeBrowser = Awaited<ReturnType<typeof startWdioSession>>;
    type SessionConfig = Parameters<typeof startWdioSession>[0];

    export const PLUGIN_ID = 'codebase-inspector';
    export const CITY_VIEW_TYPE = 'codebase-inspector-city';
    /** IN49 (IP47): the earliest public release satisfying manifest.json's minAppVersion (1.13.0 was never
     *  published); `latest` on request. Never downgraded. tests/unit/native-baseline.test.ts pins
     *  NATIVE_BASELINE_VERSION >= minAppVersion, so a raised minAppVersion fails fast. */
    export const NATIVE_BASELINE_VERSION = '1.13.4';
    export const requestedVersion = process.env.OBSIDIAN_VERSION ?? NATIVE_BASELINE_VERSION;

    export function createNativeSession(afterReady: (browser: NativeBrowser) => Promise<void> = () => Promise.resolve()): SessionLifecycle<NativeBrowser> {
      const capabilities: WebdriverIO.Capabilities = {
        browserName: 'obsidian',
        'wdio:obsidianOptions': {
          appVersion: requestedVersion, installerVersion: 'latest',
          plugins: [resolve('dist')], vault: resolve('tests/e2e/vault'), copy: true,
        },
      };
      const config: SessionConfig = {
        capabilities, cacheDir: resolve('.obsidian-cache'),
        logLevel: 'warn', waitforTimeout: 10_000, waitforInterval: 100,
        connectionRetryTimeout: 30_000, connectionRetryCount: 0,
      };
      // describe's version-pinned seam (IN42): startWdioSession()'s own sequence, keeping the
      // worker so afterSession() runs on success AND on partial failure.
      const preparation = new launcher({}, capabilities, config);
      const worker = new ObsidianWorkerService({}, capabilities, config);
      return new SessionLifecycle({
        async prepare() {
          await preparation.onPrepare(config, [capabilities]);
          await worker.beforeSession(config, capabilities);
        },
        connect: () => remote(config),
        async initialize(browser) {
          await worker.before(capabilities, [], browser);
          await afterReady(browser);
        },
        disconnect: (browser) => browser.deleteSession(),
        cleanup: () => worker.afterSession(),
      });
    }
    ```
  - `tests/e2e/fixture.ts` is describe's, with `inspector: createInspectorPage(browser)` in place of `ui`, and the environment evidence without the UI-mode field: `{ requestedVersion, appVersion, installerVersion, platform: process.platform, runner: 'vitest', commit: process.env.SOURCE_COMMIT ?? 'local', vault: page.getVaultPath() }`.
  - `tests/e2e/inspector.ts` (the project's UI helper, describe's `helpers.ts` pattern):
    ```ts
    import { expect } from 'vitest';
    import { CITY_VIEW_TYPE, type NativeBrowser } from './session';

    type ErrorWindow = Window & { ciErrors?: string[] };

    export function createInspectorPage(browser: NativeBrowser) {
      const root = () => browser.$(`.workspace-leaf-content[data-type="${CITY_VIEW_TYPE}"] .codebase-inspector-root`);
      return {
        root,
        screen: (route: string) => root().$(`.ci-screen--${route}`),
        async openCity(): Promise<void> {
          await browser.executeObsidianCommand('codebase-inspector:open-city');
          await expect.poll(() => root().isExisting()).toBe(true);
        },
        async navigate(title: string): Promise<void> {
          const item = root().$(`.ci-nav__item*=${title}`);
          if (!(await item.isDisplayed())) await root().$('.ci-topbar__menu').click();
          await item.click();
        },
        async recordErrors(): Promise<void> {
          await browser.executeObsidian(() => {
            const win: ErrorWindow = activeWindow;
            const errors: string[] = [];
            win.ciErrors = errors;
            const original = console.error.bind(console);
            console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); original(...args); };
            win.addEventListener('error', (e) => { errors.push(e.message); });
            win.addEventListener('unhandledrejection', (e) => { errors.push(String(e.reason)); });
          });
        },
        errors: () => browser.executeObsidian((): string[] => (activeWindow as ErrorWindow).ciErrors ?? []),
      };
    }
    ```
  - `tests/e2e/smoke.e2e.ts`, now through the fixture (IP48):
    ```ts
    import { describe, expect } from 'vitest';
    import { test } from './fixture';
    import { CITY_VIEW_TYPE, PLUGIN_ID } from './session';

    describe('codebase-inspector in the real Obsidian host', () => {
      test('loads the plugin without errors and opens the inspector on its default route', async ({ native: { browser, page, inspector } }) => {
        await page.disablePlugin(PLUGIN_ID);
        await inspector.recordErrors();
        await page.enablePlugin(PLUGIN_ID);
        await inspector.openCity();
        await expect.poll(() => inspector.screen('overview').isDisplayed()).toBe(true);
        expect(await browser.executeObsidian(({ app }, type) => app.workspace.getLeavesOfType(type).length, CITY_VIEW_TYPE)).toBe(1);
        expect(await inspector.errors()).toEqual([]);
      });
    });
    ```
    If a fresh vault logs an Obsidian error unrelated to the plugin, do **not** filter it: report the exact text; the controller rules on a named exception (IP48).
  - `tests/e2e/lifecycle.e2e.ts` is describe's verbatim (the two real-session cleanup tests, IN45).
  - Run `node node_modules/vitest/vitest.mjs run --config tests/e2e/vitest.config.mts tests/e2e/smoke.e2e.ts tests/e2e/lifecycle.e2e.ts`: 3 passed. RED proof for the smoke: change `'overview'` to `'city'` and watch it time out on the poll; revert.
- [ ] **Step 4: The Obsidian facts (IN51 b, spec §6 row a–e).** `tests/e2e/obsidian-facts.e2e.ts`, one test per fact, each writing its observations with `writeEvidence(directory, 'probe', …)` before asserting:
  - **(a) "vault.create rejects a path that already exists":** `create('probe-a.md', 'first')`, then `create('probe-a.md', 'second')` must reject and the text stay `'first'`; also record, without asserting, whether `create('PROBE-A.md', …)` rejects (a case-only duplicate on this file system).
  - **(b) "backslash escapes keep Obsidian syntax inert in reading and live-preview views":** render `PROBE_HOSTILE` (a **positive control**) and `PROBE_ESCAPED` with `obsidian.MarkdownRenderer.render(app, md, el, 'probe.md', component)` inside `executeObsidian`, and count `a.internal-link`, `.internal-embed`, `a.tag`, `mark`, `.math`, `a.external-link` and `b`, plus whether the text `c` survives (`%%` comments hide it). The control must show every one of them (or `c` hidden); the escaped text must show none, with `c` visible. Then open each as a note in live preview (`workspace.getLeaf(true).openFile(file, { state: { mode: 'source', source: false } })`) and count, in `.cm-content`, the live-preview token classes for links, embeds, tags, highlights, math and comments, with the same control/escaped rule. Record the class names found by the control (they are the evidence the escaped case is compared against).
  - **(c) "the metadata cache reports notes changed by process and processFrontMatter":** inside one `executeObsidian`, create a note with frontmatter, then for `vault.process` and for `processFrontMatter` await either a `metadataCache.on('changed')` for that path or a 5 s `activeWindow.setTimeout`, recording which; then `expect.poll` until `getFileCache(file)?.frontmatter` shows the new value (the plan's `resolved` rebuild is the fallback if an event is missing).
  - **(d) "stringifyYaml round-trips the frontmatter value shapes as strings":** `obsidian.stringifyYaml` of `{ a: 'yes', b: 'null', c: '0012', d: 'a: b', e: 'true', f: '~', g: '#x', h: '[[x]]', i: 'snapshot:p1:2026-09-25T10:00:00.000Z', j: 'src/a.ts#UN-00000001', k: 'file:src/a.ts' }`, then `obsidian.parseYaml` of it, must deep-equal the input with every value a string; record the raw YAML.
  - **(e) "folders can be created one segment at a time":** record whether `createFolder('p1/q1')` creates a missing parent (or rejects); then assert that `createFolder('p2')` followed by `createFolder('p2/q2')` gives both folders.
  - Run the file. Each outcome, and the evidence path, goes into the report; the controller turns them into IPF rulings before Task 1 (a failure of (a), (b) or (d) stops the plan for a spec change; (c) and (e) are recorded either way, IN51).
- [ ] **Step 5: The results gate (IN48).**
  - Write the failing unit test first, `tests/unit/native-results-gate.test.ts`: describe's, with `required` read from `tests/e2e/required-scenarios.json` (never a second copy of the list, IP46), the temp directory prefix `codebase-inspector-native-result-`, and the success message expectation `` `${required.length} executed native Vitest cases` ``. Run it RED (the script does not exist).
  - `scripts/check-native-results.mjs` (describe's, adapted):
    ```js
    import assert from 'node:assert/strict';
    import { readFile } from 'node:fs/promises';

    // IN48: fails closed. The list is shared with its unit test (IP46).
    const required = JSON.parse(await readFile(new URL('../tests/e2e/required-scenarios.json', import.meta.url), 'utf8'));
    const report = JSON.parse(await readFile('reports/native/vitest-results.json', 'utf8'));
    const results = report.testResults.flatMap((file) => file.assertionResults);
    assert.equal(report.success, true, 'Native Vitest did not report success.');
    assert.ok(results.length > 0 && results.every((test) => test.status === 'passed'), 'Skipped, pending or failed native cases cannot satisfy acceptance.');
    for (const title of required) {
      assert.equal(results.filter((test) => test.title === title).length, 1, `Required native case must run exactly once: ${title}`);
    }
    console.log(`Verified ${results.length} executed native Vitest cases, including all ${required.length} required scenarios.`);
    ```
  - `scripts/native-tests.mjs` (describe's intent; our build and a Windows-safe spawn, IP54):
    ```js
    import { spawnSync } from 'node:child_process';
    import { mkdir } from 'node:fs/promises';
    import { fileURLToPath } from 'node:url';

    // IN43: build, run the native project, then ALWAYS run the gate. Never part of `npm run verify`.
    const windows = process.platform === 'win32';
    const build = spawnSync(windows ? 'npm.cmd' : 'npm', ['run', 'build'], { stdio: 'inherit', shell: windows });
    if (build.status !== 0) process.exit(build.status ?? 1);
    await mkdir('reports/native', { recursive: true });
    const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
    const run = spawnSync(process.execPath, [vitest, 'run', '--config', 'tests/e2e/vitest.config.mts'], { stdio: 'inherit' });
    try {
      await import('./check-native-results.mjs');
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
    if (run.status !== 0) process.exitCode = run.status ?? 1;
    ```
  - `package.json` scripts gain `"test:e2e": "node scripts/native-tests.mjs"`.
  - Run the unit test GREEN.
- [ ] **Step 6: Wire types and lint (IP49, IP50).**
  - `tsconfig.test.json`: add `"tests/e2e/**"` to `exclude`, and `"lib": ["ES2020", "ES2021.Promise", "DOM", "DOM.Iterable"]`.
  - `package.json` `typecheck` gains `&& vue-tsc --noEmit -p tests/e2e/tsconfig.json`.
  - `eslint.config.mjs`: add `'.obsidian-cache/**'` and `'reports/**'` to `ignores`; add `'./tests/e2e/tsconfig.json'` to `parserOptions.project`; widen the two `tests/**/*.ts` globs (Rule 1's `max-lines` 450 and the `hardcoded-config-path` block) to `tests/**/*.{ts,mts}`; and, only if `npm run lint` reports them on `tests/e2e/**`, one block turning off exactly the firing rules among `obsidianmd/prefer-create-el`, `obsidianmd/no-tfile-tfolder-cast`, `obsidianmd/no-global-this`, `obsidianmd/no-unsupported-api` and `obsidianmd/prefer-active-doc`, with a comment that these files drive the host from a Node test runner. List each rule you added. Fix any other finding in the ported code without changing its behaviour, and list it.
  - `.oxlintrc.json`: add `".obsidian-cache/**"` and `"reports/**"` to `ignorePatterns`.
  - Check collection: `npx vitest list --project node` lists `tests/unit/session-lifecycle.test.ts` and `tests/unit/native-results-gate.test.ts`, and neither project lists anything under `tests/e2e/`.
- [ ] **Step 7: The whole native run.** `npm run test:e2e` builds, runs 8 native cases, and the gate prints `Verified 8 executed native Vitest cases, including all 8 required scenarios.` Paste that line, the resolved versions from any `reports/native/cases/*/environment.json`, and the per-probe outcomes. Then confirm `git status --short` shows neither `.obsidian-cache/` nor `reports/`.
- [ ] **Step 8: Gate and commit.**
  ```bash
  npm run typecheck && npm run lint:fast && npm run lint && npx vitest run tests/unit/session-lifecycle.test.ts tests/unit/native-results-gate.test.ts
  git add package.json package-lock.json .gitignore eslint.config.mjs .oxlintrc.json tsconfig.test.json tests/support tests/unit/session-lifecycle.test.ts tests/unit/native-results-gate.test.ts tests/e2e scripts/native-tests.mjs scripts/check-native-results.mjs
  git commit -m "test(e2e): native Obsidian acceptance harness ported from describe, with the Obsidian-facts probes (WP-04 O8, IN42–IN51)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

### Task 1: The Investigate route, its copy module and the selection store

**Files:**
- Modify: `src/domain/route-ids.ts` (insert `'investigate'` before `'workbench'`), `src/ui/routes.ts` (meta and Act nav, IP21), `src/ui/App.vue` (import and one `v-else-if`), `src/ui/shell/use-route-provenance.ts` (`case 'investigate': return false;` with its reason), `src/ui/inspector-copy.ts` (one re-export line), `src/ui/styles/screens-act.css`
- Create: `src/ui/audit-copy/investigation.ts`, `src/ui/stores/investigation-store.ts`, `src/ui/screens/InvestigateScreen.vue`
- Modify in place (one line each): `tests/unit/route-state.test.ts:11` (15 → 16, and the title "all 16 routes"), `tests/component/command-palette.test.ts:19` (15 → 16), `tests/component/workspace-shell.test.ts:62` (14 → 15)
- Test: `tests/component/investigate-route.test.ts` (new), `tests/unit/investigation-store.test.ts` (new)

**Interfaces:**
- Consumes: `ROUTE_IDS`, `isRouteId`, `validateCityViewState`, `defaultCityViewState`, `useCityStore`, `useEvidenceStore`, `useReadModels().quality`, `findingFingerprint`, `useImportReport`, kit `PageHeader`, `Callout`, `NotAnalysed`, `NoSnapshot`; fixtures `buildSnapshotFixture`, `attachSyntheticReport`, `snapshotWithOnlyFiles`, `computeLayout`.
- Produces:
  ```ts
  // route-ids.ts
  export const ROUTE_IDS = [ /* … */ 'ownership', 'investigate', 'workbench', 'report', 'sources', 'settings', 'file' ] as const;
  // routes.ts
  investigate: { id: 'investigate', title: 'Investigate', group: 'Act', icon: 'search', part: 4,
    goal: 'Investigate one finding with its evidence and uncertainties, and record the outcome in a note.' },
  // NAV_SECTIONS Act: ['investigate', 'workbench', 'report']
  // investigation-store.ts (grows in Task 10)
  export const useInvestigationStore: StoreDefinition<'investigation', …> // setup store
  //   selectedFingerprint: Ref<string | null>; findingGone: Ref<boolean>;
  //   open: (fingerprint: string) => void;   // select, clears the gone notice
  //   markGone: () => void;                  // clears the selection and raises the notice
  // audit-copy/investigation.ts (grows in every UI task)
  export const INVESTIGATE_EYEBROW = 'Act / Investigate';
  export const INVESTIGATE_TITLE = 'From a finding to a recorded decision.';
  export const INVESTIGATE_SUBTITLE = 'Check the evidence, state what is uncertain, and keep the result in a note in your vault.';
  export const INVESTIGATE_FINDING_GONE = 'The finding you were investigating is not in the current report. Its notes are listed under Notes for findings not in this report.';
  ```

- [ ] **Step 1: Write the failing tests.** `tests/unit/investigation-store.test.ts`:
  ```ts
  import { beforeEach, describe, expect, it } from 'vitest';
  import { createPinia, setActivePinia } from 'pinia';
  import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
  import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
  import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';

  describe('investigation store selection (IN4)', () => {
    beforeEach(() => { setActivePinia(createPinia()); });
    it('opens a fingerprint and clears the gone notice', () => {
      const s = useInvestigationStore();
      s.open('fp-1'); s.markGone();
      expect(s.selectedFingerprint).toBeNull();
      expect(s.findingGone).toBe(true);
      s.open('fp-2');
      expect(s.selectedFingerprint).toBe('fp-2');
      expect(s.findingGone).toBe(false);
    });
    it('markGone without a selection raises nothing', () => {
      const s = useInvestigationStore();
      s.markGone();
      expect(s.findingGone).toBe(false);
    });
    it('forgets the selection the moment the bound codebase changes (sync)', () => {
      const evidence = useEvidenceStore();
      evidence.setRepository(new InMemoryEvidenceStore());
      evidence.bindRepository('a');
      const s = useInvestigationStore();
      s.open('fp-1');
      evidence.bindRepository('b');
      expect(s.selectedFingerprint).toBeNull();   // no await: flush 'sync'
    });
  });
  ```
  `tests/component/investigate-route.test.ts` (import `'../mocks/obsidian'` first, mount `App` with `global.provide: { onSelectCodebase: vi.fn(), createCityRenderer: null }` as `shell-provenance.test.ts` does):
  - `isRouteId('investigate')` is true, and `validateCityViewState({ ...defaultCityViewState(), route: 'investigate' }).route` is `'investigate'`.
  - `NAV_SECTIONS.find((s) => s.group === 'Act')!.routes` equals `['investigate', 'workbench', 'report']`; the nav button labelled `Investigate` navigates there and `.ci-screen--investigate` renders.
  - With a snapshot and no report, the screen shows `.ci-not-analysed` and its Import button navigates to `sources`.
  - The top bar shows no sample badge on `investigate`.
  - **Gone:** with `attachSyntheticReport(snapshot)`, open the fingerprint of file 0's unused export (`findingFingerprint(file0.id, finding.id)`), mount, then attach `attachSyntheticReport(snapshotWithOnlyFiles(snapshot, [file1.path]))`. After `nextTick`, `INVESTIGATE_FINDING_GONE` shows in a `.ci-callout` and `useInvestigationStore().selectedFingerprint` is `null`. A second case re-attaches the full report and asserts the selection is kept and no callout shows.
- [ ] **Step 2: Run them to see them fail.** `npx vitest run tests/unit/investigation-store.test.ts tests/component/investigate-route.test.ts` gives FAIL (modules missing).
- [ ] **Step 3: Implement.**
  - The store:
    ```ts
    // WP-04 IN4: the Investigate selection, one per leaf (each CityView has its own Pinia), a
    // setup store like relations-store.ts. Session state only: nothing here reaches
    // CityViewState, getState() or data.json. The fingerprint is the finding's own
    // (findingFingerprint), so a re-import that keeps the finding keeps the selection.
    import { defineStore } from 'pinia';
    import { ref, watch } from 'vue';
    import { useEvidenceStore } from './evidence-store';

    export const useInvestigationStore = defineStore('investigation', () => {
      const evidence = useEvidenceStore();
      const selectedFingerprint = ref<string | null>(null);
      const findingGone = ref(false);
      // PF14: arrow-function members.
      const open = (fingerprint: string): void => {
        selectedFingerprint.value = fingerprint;
        findingGone.value = false;
      };
      const markGone = (): void => {
        if (selectedFingerprint.value === null) return;
        selectedFingerprint.value = null;
        findingGone.value = true;
      };
      watch(() => evidence.repositoryId, () => {
        selectedFingerprint.value = null;
        findingGone.value = false;
      }, { flush: 'sync' });
      return { selectedFingerprint, findingGone, open, markGone };
    });
    ```
  - `InvestigateScreen.vue`: `PageHeader`, a `role="status"` live paragraph (`ci-investigate__live`), `NoSnapshot` without a snapshot, `NotAnalysed` (Import → `useImportReport()`) without a report, and the gone `Callout` (tone `warning`). The gone watcher:
    ```ts
    const report = computed(() => quality.value.evidence.report);
    watch(() => {
      const fp = investigation.selectedFingerprint;
      return fp !== null && report.value !== null && !quality.value.byFingerprint.has(fp);
    }, (gone) => { if (gone) investigation.markGone(); }, { immediate: true });
    ```
    (Task 11 replaces `quality.value.byFingerprint` with the investigation model's own map, which has the same keys.)
  - `screens-act.css`: `.ci-screen--investigate` only (layout rules come in Task 11).
- [ ] **Step 4: Edit the three pinned counts in place** (one line each, as listed under **Files**).
- [ ] **Step 5: Run.** `npx vitest run tests/unit/investigation-store.test.ts tests/component/investigate-route.test.ts tests/unit/route-state.test.ts tests/component/command-palette.test.ts tests/component/workspace-shell.test.ts tests/component/kit-display.test.ts tests/component/shell-provenance.test.ts` gives PASS.
- [ ] **Step 6: Gate and commit** (`feat(ui): the Investigate route, its copy module and a per-leaf selection store (WP-04 IN4, IN6)`).

### Task 2: Note text escaping, note names and folder validation (pure)

**Files:**
- Create: `src/application/markdown-code.ts` (`mdCode`, moved verbatim from `src/ui/export/markdown.ts`, IP2), `src/application/investigation/note-text.ts`, `src/application/investigation/note-path.ts`
- Modify: `src/ui/export/markdown.ts` (delete the `mdCode` body; add `export { mdCode } from '../../application/markdown-code';`)
- Test: `tests/unit/investigation-note-text.test.ts` (new), `tests/unit/investigation-note-path.test.ts` (new); run `tests/unit/markdown.test.ts` unchanged

**Interfaces:**
- Consumes: `normalizeRelativePath` (`src/domain/path-safety.ts`).
- Produces:
  ```ts
  // markdown-code.ts
  export function mdCode(s: string): string;
  // note-text.ts
  export const NOTE_VALUE_MAX = 256;                          // code points, before escaping
  export function noteText(value: string, max?: number): string;   // one line, every Markdown/Obsidian opener escaped
  export function noteCode(value: string, max?: number): string;   // mdCode of the flattened, capped value (paths, ids)
  // note-path.ts
  export const NOTE_NAME_MAX = 100;
  export const NOTE_FOLDER_MAX = 200;
  export const COLLISION_MAX = 99;
  export function sanitizeNoteName(value: string): string;    // may return ''
  export function noteBaseName(findingId: string, kindLabel: string, anchorName: string): string;
  export function defaultNoteFolder(profileName: string): string;
  export type NoteFolderProblem = 'empty' | 'not-relative' | 'too-long' | 'config-dir' | 'unsafe-name';
  export type NoteFolderCheck = { ok: true; folder: string } | { ok: false; problem: NoteFolderProblem };
  export function validateNoteFolder(value: string, configDir: string): NoteFolderCheck;
  export type NoteNameProblem = 'empty' | 'too-long' | 'unsafe-name';
  export type NoteNameCheck = { ok: true; name: string } | { ok: false; problem: NoteNameProblem };
  export function validateNoteName(value: string): NoteNameCheck;   // the base, without `.md`
  export function freeNoteName(base: string, isTaken: (fileName: string) => boolean): string | null;
  ```

- [ ] **Step 1: Write the failing tests.** `tests/unit/investigation-note-text.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { noteCode, noteText } from '../../src/application/investigation/note-text';

  // Review Focus 2: every one of these would open markup somewhere in Obsidian.
  const HOSTILE = [
    '[[x]]', '![[x]]', '<script>alert(1)</script>', '<!-- codebase-inspector:evidence:end -->', '#tag', '$x$', '%%hidden%%',
    '==mark==', '^block', '`code`', '*a* _b_ ~~c~~', '| a | b |', '{{x}}', '&amp;', 'https://evil.example', 'www.evil.example',
  ];

  describe('noteText (IN24, IP5)', () => {
    it.each(HOSTILE)('escapes every opener in %s', (s) => {
      const out = noteText(s);
      expect(out).not.toMatch(/(^|[^\\])(\[\[|!\[\[|<|#|\$|%%|==|\^|`|\*|_|~|\||\{|&)/);
      expect(out).not.toMatch(/https?:\/\/|www\./i);
    });
    it('never contains the marker text as a whole line', () => {
      expect(noteText('<!-- codebase-inspector:evidence:end -->')).toBe('\\<\\!-- codebase-inspector\\:evidence\\:end --\\>');
    });
    it('flattens every line break, so a break cannot start a heading, rule or list', () => {
      expect(noteText('a\n# b\r\n---\u2028- c')).toBe('a \\# b --- - c');
    });
    it('escapes a leading list or ordered-list opener', () => {
      expect(noteText('- x')).toBe('\\- x');
      expect(noteText('+ x')).toBe('\\+ x');
      expect(noteText('12. x')).toBe('12\\. x');
      expect(noteText('3) x')).toBe('3\\) x');
    });
    it('breaks bare URLs', () => {
      expect(noteText('https://a.b')).toBe('https\\://a.b');
      expect(noteText('see www.a.b')).toBe('see www\\.a.b');
    });
    it('replaces invisible controls and bidi overrides with U+FFFD', () => {
      expect(noteText('a\u0007b\u202Ec')).toBe('a\uFFFDb\uFFFDc');
    });
    it('caps by code point with an ellipsis, before escaping', () => {
      expect(noteText('😀'.repeat(300), 10)).toBe(`${'😀'.repeat(9)}…`);
    });
  });

  describe('noteCode', () => {
    it('keeps a path in one code span, whatever it holds', () => {
      expect(noteCode('src/a`b.ts')).toBe('`` src/a`b.ts ``');
      expect(noteCode('a\nb')).toBe('`a b`');
    });
  });
  ```
  Every expectation above is exact for the Step 3 rule: breaks become one space, `#` is escaped, and a mid-line `-` or `---` is plain text on a line that starts with `a`.

  `tests/unit/investigation-note-path.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import {
    COLLISION_MAX, defaultNoteFolder, freeNoteName, noteBaseName, sanitizeNoteName, validateNoteFolder, validateNoteName,
  } from '../../src/application/investigation/note-path';

  describe('sanitizeNoteName (IN21)', () => {
    it('removes the forbidden characters and control characters, collapses whitespace', () => {
      expect(sanitizeNoteName('a\\b/c:d*e?f"g<h>i|j#k^l[m]n\u0000o   p')).toBe('abcdefghijklmno p');
    });
    it('drops leading dots and trailing dots and spaces (reserved and trailing)', () => {
      expect(sanitizeNoteName('..hidden')).toBe('hidden');
      expect(sanitizeNoteName('name. . ')).toBe('name');
    });
    it('suffixes a Windows reserved name, with or without an extension (reserved and trailing)', () => {
      expect(sanitizeNoteName('CON')).toBe('CON_');
      expect(sanitizeNoteName('nul.backup')).toBe('nul_.backup');
      expect(sanitizeNoteName('console')).toBe('console');
    });
    it('cuts at 100 code points', () => {
      expect(Array.from(sanitizeNoteName('é'.repeat(150)))).toHaveLength(100);
    });
  });

  describe('noteBaseName', () => {
    it('is "<id> <kind> <file>", and the id alone when the rest sanitises away', () => {
      expect(noteBaseName('UN-1a2b3c4d', 'Unused exports', 'view.ts')).toBe('UN-1a2b3c4d Unused exports view.ts');
      expect(noteBaseName('UN-1a2b3c4d', '', '[[#]]')).toBe('UN-1a2b3c4d');
    });
  });

  describe('validateNoteFolder (IN19)', () => {
    const ok = (v: string) => validateNoteFolder(v, '.obsidian');
    it('accepts a POSIX vault-relative folder and drops trailing slashes', () => {
      expect(ok('Codebase investigations/App/')).toEqual({ ok: true, folder: 'Codebase investigations/App' });
    });
    it.each([
      ['', 'empty'], ['   ', 'empty'], ['/abs', 'not-relative'], ['C:\\x', 'not-relative'], ['a/../b', 'not-relative'],
      ['a//b', 'not-relative'], ['./a', 'not-relative'], ['.obsidian/notes', 'config-dir'], ['.OBSIDIAN', 'config-dir'],
      ['a/b:c', 'unsafe-name'], ['a/CON', 'unsafe-name'], ['a/trailing.', 'unsafe-name'], ['x'.repeat(201), 'too-long'],
    ])('refuses %j as %s', (value, problem) => {
      expect(ok(value)).toEqual({ ok: false, problem });
    });
  });

  describe('validateNoteName', () => {
    it('strips a typed .md and refuses what sanitising would change', () => {
      expect(validateNoteName('My note.md')).toEqual({ ok: true, name: 'My note' });
      expect(validateNoteName('a#b')).toEqual({ ok: false, problem: 'unsafe-name' });
      expect(validateNoteName('.md')).toEqual({ ok: false, problem: 'empty' });
    });
  });

  describe('freeNoteName (IN27)', () => {
    it('takes the first free of base, base (2) … base (99)', () => {
      const taken = new Set(['X.md', 'X (2).md']);
      expect(freeNoteName('X', (n) => taken.has(n))).toBe('X (3).md');
    });
    it('gives up after (99)', () => {
      expect(freeNoteName('X', () => true)).toBeNull();
      expect(COLLISION_MAX).toBe(99);
    });
  });

  describe('defaultNoteFolder (IN18, IP11)', () => {
    it('sanitises the profile name and falls back when nothing is left', () => {
      expect(defaultNoteFolder('App/Core')).toBe('Codebase investigations/AppCore');
      expect(defaultNoteFolder('///')).toBe('Codebase investigations');
    });
  });
  ```
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
  - `note-text.ts`:
    ```ts
    // WP-04 IN24 (IP5): the ONE escaping function for every report- or user-derived string in a
    // note body. One line, capped, every CommonMark and Obsidian opener backslash-escaped.
    // Paths and ids go through noteCode instead (a code span is literal).
    import { mdCode } from '../markdown-code';

    export const NOTE_VALUE_MAX = 256;
    const LINE_BREAKS = /[\r\n\u2028\u2029]+/g;
    // eslint-disable-next-line no-control-regex -- detecting control characters is the point.
    const INVISIBLE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
    const PUNCTUATION = /[\\`*_[\]<>#|~=$%^!{}&:]/g;

    function flatten(value: string, max: number): string {
      const flat = value.replace(LINE_BREAKS, ' ').replace(/\t/g, ' ').replace(INVISIBLE, '\uFFFD').trim();
      const points = Array.from(flat);
      return points.length <= max ? flat : `${points.slice(0, max - 1).join('')}…`;
    }

    export function noteText(value: string, max: number = NOTE_VALUE_MAX): string {
      const escaped = flatten(value, max).replace(PUNCTUATION, '\\$&').replace(/\b(www)\./gi, '$1\\.');
      return escaped.replace(/^([-+])/, '\\$1').replace(/^(\d+)([.)])/, '$1\\$2');
    }

    export function noteCode(value: string, max: number = NOTE_VALUE_MAX * 2): string {
      return mdCode(flatten(value, max));
    }
    ```
  - `note-path.ts`:
    ```ts
    // eslint-disable-next-line no-control-regex -- see note-text.ts.
    const NAME_FORBIDDEN = /[\\/:*?"<>|#^[\]\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
    const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?=\.|$)/i;
    const DEFAULT_ROOT = 'Codebase investigations';

    export function sanitizeNoteName(value: string): string {
      const cleaned = value.replace(NAME_FORBIDDEN, '').replace(/\s+/g, ' ').trim().replace(/^[.\s]+/, '');
      const cut = Array.from(cleaned).slice(0, NOTE_NAME_MAX).join('');
      return cut.replace(/[.\s]+$/, '').replace(RESERVED, '$1_');
    }

    export function noteBaseName(findingId: string, kindLabel: string, anchorName: string): string {
      const full = sanitizeNoteName(`${findingId} ${kindLabel} ${anchorName}`);
      return full === '' ? sanitizeNoteName(findingId) : full;
    }

    export function defaultNoteFolder(profileName: string): string {
      const name = sanitizeNoteName(profileName);
      return name === '' ? DEFAULT_ROOT : `${DEFAULT_ROOT}/${name}`;
    }

    export function validateNoteFolder(value: string, configDir: string): NoteFolderCheck {
      const trimmed = value.trim().replace(/\/+$/, '');
      if (trimmed === '') return { ok: false, problem: 'empty' };
      if (Array.from(trimmed).length > NOTE_FOLDER_MAX) return { ok: false, problem: 'too-long' };
      let folder: string;
      try { folder = normalizeRelativePath(trimmed); } catch { return { ok: false, problem: 'not-relative' }; }
      const config = `${configDir.toLowerCase()}/`;
      if (`${folder.toLowerCase()}/`.startsWith(config)) return { ok: false, problem: 'config-dir' };
      if (folder.split('/').some((s) => sanitizeNoteName(s) !== s)) return { ok: false, problem: 'unsafe-name' };
      return { ok: true, folder };
    }
    ```
    `noteBaseName`'s second test gets the id alone because `'UN-1a2b3c4d  [[#]]'` sanitises to `'UN-1a2b3c4d'`; the `''` branch covers a finding id that itself sanitises away (never true for `FINDING_ID_PATTERN` ids, kept for a user-typed name). `validateNoteName` trims, drops one trailing `.md` (case-insensitive), then applies `empty`, `too-long` (over `NOTE_NAME_MAX` code points) and `unsafe-name` (`sanitizeNoteName(v) !== v`), in that order. `freeNoteName` is the loop over `${base}.md`, then `${base} (n).md` for n = 2…99, returning null after 99.
  - Move `mdCode` verbatim, with its comment, into `src/application/markdown-code.ts`, and re-export it from `src/ui/export/markdown.ts` so `report.ts`, `work-items.ts` and `tests/unit/markdown.test.ts` are unchanged.
- [ ] **Step 3a: Tie the escaping to the native probe (IP52).** Add to `tests/unit/investigation-note-text.test.ts`: `expect(noteText(PROBE_HOSTILE)).toBe(PROBE_ESCAPED)` (from `tests/support/probe-strings.ts`, Task 0), so the text Task 0 proved inert in a real Obsidian is exactly what `noteText` produces.
- [ ] **Step 4: Run.** `npx vitest run tests/unit/investigation-note-text.test.ts tests/unit/investigation-note-path.test.ts tests/unit/markdown.test.ts` gives PASS.
- [ ] **Step 5: Gate and commit** (`feat(investigation): note text escaping, note names and folder validation (WP-04 IN19, IN21, IN24)`).

### Task 3: The note model, the evidence block and the marker-exact splice

**Files:**
- Create: `src/application/investigation/note-model.ts`, `src/application/investigation/evidence-block.ts`
- Test: `tests/unit/investigation-note-model.test.ts` (new), `tests/unit/investigation-evidence-splice.test.ts` (new)

**Interfaces:**
- Consumes: `noteText`, `noteCode` (Task 2).
- Produces:
  ```ts
  // note-model.ts
  export const NOTE_TYPE = 'codebase-investigation';
  export const EVIDENCE_BEGIN = '<!-- codebase-inspector:evidence:begin -->';
  export const EVIDENCE_END = '<!-- codebase-inspector:evidence:end -->';
  export const EVIDENCE_BLOCK_MAX_BYTES = 16 * 1024;
  export const EVIDENCE_LIST_MAX = 50;
  export interface NoteIdentity { readonly codebaseId: string; readonly sourcePath: string; readonly snapshotId: string; readonly findingId: string }
  export interface NoteFrontmatter {
    readonly type: typeof NOTE_TYPE; readonly codebase_id: string; readonly entity_id: string; readonly source_path: string;
    readonly snapshot_id: string; readonly finding_id: string; readonly finding_fingerprint: string;
    readonly provider: 'fallow'; readonly status: 'open'; readonly created: string;
  }
  export function portableFingerprint(sourcePath: string, findingId: string): string;   // `${sourcePath}#${findingId}` (IP4)
  export function noteFrontmatter(identity: NoteIdentity, createdIso: string): NoteFrontmatter;
  export type EvidenceFacts =
    | {
      readonly reported: true; readonly findingId: string; readonly title: string; readonly kindLabel: string;
      readonly ruleText: string; readonly ruleDetail: string; readonly severityText: string; readonly sourcePath: string;
      readonly line: number | null; readonly endLine: number | null; readonly related: readonly string[];
      readonly cyclePath: readonly string[]; readonly provider: string; readonly analysedAt: string;
      readonly snapshotId: string; readonly evidenceState: string; readonly uncertainties: readonly string[];
    }
    | {
      readonly reported: false; readonly findingId: string; readonly sourcePath: string; readonly provider: string;
      readonly analysedAt: string; readonly snapshotId: string; readonly uncertainties: readonly string[];
    };
  export interface NoteVocabulary {
    readonly headings: { readonly context: string; readonly observed: string; readonly source: string; readonly uncertainties: string;
      readonly notes: string; readonly proposed: string; readonly checklist: string; readonly decision: string };
    readonly prompts: { readonly notes: string; readonly proposed: string; readonly decision: string };
    readonly labels: { readonly finding: string; readonly kind: string; readonly rule: string; readonly detail: string;
      readonly severity: string; readonly location: string; readonly related: string; readonly cyclePath: string;
      readonly provider: string; readonly analysed: string; readonly snapshot: string; readonly evidence: string;
      readonly notReported: string; readonly line: (line: number | null, endLine: number | null) => string;
      readonly more: (hidden: number) => string };
  }
  export function renderEvidenceBlock(facts: EvidenceFacts, words: NoteVocabulary): string;   // both markers included, ≤ 16 KiB UTF-8
  export function renderNoteBody(facts: EvidenceFacts, checklist: readonly string[], words: NoteVocabulary): string;
  // evidence-block.ts
  export type SpliceResult = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: 'markers-edited' };
  export function spliceEvidenceBlock(note: string, block: string): SpliceResult;
  export function isEvidenceBlock(block: string): boolean;   // first line EVIDENCE_BEGIN, last line EVIDENCE_END, no other marker line
  ```

- [ ] **Step 1: Write the failing tests.** In `tests/unit/investigation-note-model.test.ts`, build a `WORDS: NoteVocabulary` literal in the test (plain words, `line: (l) => (l === null ? 'Line unknown' : \`Line ${l}\`)`, `more: (n) => \`${n} more\``) and a `FACTS` literal with `reported: true`. Cases:
  - `noteFrontmatter({ codebaseId: 'p1', sourcePath: 'src/a.ts', snapshotId: 'snapshot:p1:1', findingId: 'UN-00000001' }, '2026-09-25T10:00:00.000Z')` equals exactly the ten keys of IN20, with `entity_id: 'file:src/a.ts'` and `finding_fingerprint: 'src/a.ts#UN-00000001'`, and `Object.values(fm).every((v) => typeof v === 'string')` (after a length check, E27). No value contains `\u0000`.
  - The block's first line is `EVIDENCE_BEGIN`, its last line is `EVIDENCE_END`, and the four IN22 generated headings appear in order between them; `renderNoteBody` then has the four human headings, in order, after `EVIDENCE_END`, and the checklist as `- [ ] ` lines.
  - **Size (IN25, IP6):** with `related` of 5,000 paths of 1,000 characters and a 100,000-character `title`, `new TextEncoder().encode(renderEvidenceBlock(big, WORDS)).length` is at most `EVIDENCE_BLOCK_MAX_BYTES`, and the block still ends with `EVIDENCE_END`. With 60 short related paths, exactly 50 are listed, then `WORDS.labels.more(10)`.
  - **Not reported (IN34):** a `reported: false` fact renders `WORDS.labels.notReported` under the context heading and still carries both markers.
  - **Injection:** a `title` of `'<!-- codebase-inspector:evidence:end -->'` and a `related` path of `'x\n<!-- codebase-inspector:evidence:begin -->'` leave exactly one line equal to each marker (`isEvidenceBlock(block)` is true).

  `tests/unit/investigation-evidence-splice.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { EVIDENCE_BEGIN as B, EVIDENCE_END as E } from '../../src/application/investigation/note-model';
  import { isEvidenceBlock, spliceEvidenceBlock } from '../../src/application/investigation/evidence-block';

  const NEW = [B, 'new', E].join('\n');
  const HEAD = '---\nstatus: open\n---\n\n';
  const TAIL = '\n## Investigation notes\n\nmine, with <!-- a comment --> and trailing spaces   \n';

  describe('spliceEvidenceBlock (IN23, IN31)', () => {
    it('replaces only what lies between the markers, byte for byte', () => {
      const note = `${HEAD}${B}\nold\n${E}${TAIL}`;
      const r = spliceEvidenceBlock(note, NEW);
      expect(r).toEqual({ ok: true, text: `${HEAD}${NEW}${TAIL}` });
    });
    it('keeps a CRLF note CRLF', () => {
      const note = `a\r\n${B}\r\nold\r\n${E}\r\nb\r\n`;
      expect(spliceEvidenceBlock(note, NEW)).toEqual({ ok: true, text: `a\r\n${B}\r\nnew\r\n${E}\r\nb\r\n` });
    });
    it('keeps an end marker on the last line with no newline', () => {
      expect(spliceEvidenceBlock(`${B}\nold\n${E}`, NEW)).toEqual({ ok: true, text: NEW });
    });
    // Review Focus 1: marker variants.
    it.each([
      ['a duplicated begin', `${B}\n${B}\nx\n${E}\n`],
      ['an end before the begin', `${E}\nx\n${B}\n`],
      ['a vanished end', `${B}\nx\n`],
      ['an indented begin', `  ${B}\nx\n${E}\n`],
      ['a trailing-space end', `${B}\nx\n${E} \n`],
      ['a second block in a code fence', `${B}\nx\n${E}\n\`\`\`\n${B}\n${E}\n\`\`\`\n`],
    ])('refuses %s and changes nothing', (_name, note) => {
      expect(spliceEvidenceBlock(note, NEW)).toEqual({ ok: false, reason: 'markers-edited' });
    });
    it('recognises only a well-formed block', () => {
      expect(isEvidenceBlock(NEW)).toBe(true);
      expect(isEvidenceBlock(`${B}\n${E}\n${E}`)).toBe(false);
      expect(isEvidenceBlock(`x\n${B}\n${E}`)).toBe(false);
    });
  });
  ```
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement `evidence-block.ts`.**
  ```ts
  // WP-04 IN23/IN31 (IP7): a marker is a WHOLE line equal to the marker text (only a CR before
  // the LF is tolerated). Exactly one begin followed by exactly one end, or the note is refused
  // unchanged. Everything outside the two marker lines is returned byte for byte; the new block
  // takes the begin line's own line ending.
  import { EVIDENCE_BEGIN, EVIDENCE_END } from './note-model';

  interface Line { readonly start: number; readonly end: number; readonly content: string; readonly eol: string }

  function linesOf(text: string): Line[] {
    const out: Line[] = [];
    let start = 0;
    while (start < text.length) {
      const nl = text.indexOf('\n', start);
      const end = nl < 0 ? text.length : nl + 1;
      const raw = text.slice(start, end);
      const eol = raw.endsWith('\r\n') ? '\r\n' : raw.endsWith('\n') ? '\n' : '';
      out.push({ start, end, content: raw.slice(0, raw.length - eol.length), eol });
      start = end;
    }
    return out;
  }

  export function spliceEvidenceBlock(note: string, block: string): SpliceResult {
    const lines = linesOf(note);
    const begins = lines.filter((l) => l.content === EVIDENCE_BEGIN);
    const ends = lines.filter((l) => l.content === EVIDENCE_END);
    const begin = begins[0];
    const end = ends[0];
    if (begins.length !== 1 || ends.length !== 1 || !begin || !end || end.start < begin.start) {
      return { ok: false, reason: 'markers-edited' };
    }
    const eol = begin.eol === '\r\n' ? '\r\n' : '\n';
    return { ok: true, text: `${note.slice(0, begin.start)}${block.split('\n').join(eol)}${end.eol}${note.slice(end.end)}` };
  }
  ```
  `isEvidenceBlock` splits on `\n`: the first line is `EVIDENCE_BEGIN`, the last is `EVIDENCE_END`, and no line in between equals either.
- [ ] **Step 4: Implement `note-model.ts`.** `noteFrontmatter` returns the ten keys in IN20's order (`entity_id: \`file:${sourcePath}\``, `finding_fingerprint: portableFingerprint(...)`). `renderEvidenceBlock` renders with a shrink ladder so the bound holds for any input (IP6):
  ```ts
  const SHRINK: readonly (readonly [list: number, value: number])[] = [[EVIDENCE_LIST_MAX, 256], [20, 256], [5, 128], [0, 64]];

  function utf8Length(s: string): number {
    let n = 0;
    for (const ch of s) {
      const cp = ch.codePointAt(0) ?? 0;
      n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    }
    return n;
  }

  export function renderEvidenceBlock(facts: EvidenceFacts, words: NoteVocabulary): string {
    let block = '';
    for (const [list, value] of SHRINK) {
      block = blockLines(facts, words, list, value).join('\n');
      if (utf8Length(block) <= EVIDENCE_BLOCK_MAX_BYTES) return block;
    }
    return block;   // [0, 64] is within the bound for any input: pinned by the size test
  }
  ```
  `blockLines` escapes every dynamic value with `noteText(v, value)` and every path and id with `noteCode(v, value * 2)`; words from `NoteVocabulary` are our own copy but go through `noteText` too, except the headings (`## ${words.headings.x}`) and the italic prompts (`_${prompt}_`). Lists (`related`, `cyclePath`) show at most `list` entries, then `words.labels.more(hidden)`. The layout, between the markers, is: `## context` + the title (or `notReported`); `## observed` + a `- label: value` line each for finding, kind, rule, detail, severity and location (path code span · `words.labels.line(line, endLine)`), then the related and cycle-path lists when non-empty; `## source` + provider, analysed at, snapshot (code span) and evidence state (`notReported` when `reported` is false); `## uncertainties` + one `- ` line each. `renderNoteBody` is the block, a blank line, then `## notes`, `## proposed`, `## checklist` (`- [ ] ${noteText(item)}` per item) and `## decision`, each human section seeded once with its italic prompt (IN22).
- [ ] **Step 5: Run.** `npx vitest run tests/unit/investigation-note-model.test.ts tests/unit/investigation-evidence-splice.test.ts` gives PASS.
- [ ] **Step 6: Gate and commit** (`feat(investigation): note frontmatter, evidence block and marker-exact splice (WP-04 IN20, IN22, IN23, IN25, IN31)`).

### Task 4: The stale-location rule and the bounded source preview

**Files:**
- Create: `src/application/investigation/stale-location.ts`, `src/application/investigation/root-path.ts`, `src/application/investigation/source-preview.ts`
- Test: `tests/unit/investigation-stale-location.test.ts` (new), `tests/unit/investigation-source-preview.test.ts` (new, the fake filesystem), `tests/integration/investigation-preview-real.test.ts` (new, the real Node adapter on a temp tree)

**Interfaces:**
- Consumes: `SourceFileSystemPort`, `ReadResult`, `StatResult`, `Clock`, `normalizeRelativePath`, `isContained`, `countPhysicalLines`; test fixtures `createFakeSourceFileSystem`, `makeTempTree`, `hashTree`, `createRealNodePort`, `createFixedClock`.
- Produces:
  ```ts
  // stale-location.ts
  export type LocationCheck = 'report' | 'size' | 'lines' | 'modified' | 'line-range';
  export interface LocationInputs {
    readonly reportCurrent: boolean;
    readonly observedBytes: number | null; readonly observedLines: number | null;
    readonly currentBytes: number | null; readonly currentLines: number | null; readonly currentMtimeMs: number | null;
    readonly analysedAt: string | null; readonly line: number | null;
  }
  export type LocationVerdict =
    | { readonly exact: true; readonly line: number }
    | { readonly exact: false; readonly failed: LocationCheck; readonly cause: 'changed' | 'unknown' }
    | { readonly exact: false; readonly failed: 'no-line' };
  export function locationVerdict(inputs: LocationInputs): LocationVerdict;
  // root-path.ts
  export function joinRootPath(root: string, relativePath: string): string;   // the root's own separator
  export function relativeInside(root: string, absolute: string): string | null; // POSIX, '' when equal, null outside
  export function sameRoot(a: string, b: string): boolean;
  // source-preview.ts
  export const PREVIEW_MAX_BYTES = 512 * 1024;
  export const PREVIEW_CONTEXT = 20;
  export const PREVIEW_LINE_MAX = 400;
  export type PreviewUnavailable =
    | 'no-binding' | 'no-filesystem' | 'outside-root' | 'not-a-file' | 'too-large' | 'binary' | 'not-utf8' | 'missing' | 'read-error';
  export interface PreviewRequest {
    readonly codebaseId: string; readonly expectedRoot: string; readonly relativePath: string;
    readonly maxFileBytes: number; readonly line: number | null;
  }
  export interface PreviewLine { readonly number: number; readonly text: string; readonly cut: boolean }
  export interface PreviewText {
    readonly lines: readonly PreviewLine[]; readonly lineCount: number; readonly size: number;
    readonly mtimeMs: number; readonly readAt: string;
  }
  export type PreviewResult =
    | { readonly status: 'ok'; readonly text: PreviewText }
    | { readonly status: 'unavailable'; readonly reason: PreviewUnavailable };
  export interface SourcePreviewDeps {
    readonly getFilesystem: () => SourceFileSystemPort | null;
    readonly resolveRoot: (codebaseId: string) => Promise<string | null>;
    readonly clock: Clock;
  }
  export interface SourcePreview { read(request: PreviewRequest): Promise<PreviewResult> }
  export function createSourcePreview(deps: SourcePreviewDeps): SourcePreview;
  ```

- [ ] **Step 1: Write the failing tests.** `tests/unit/investigation-stale-location.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { locationVerdict, type LocationInputs } from '../../src/application/investigation/stale-location';

  const EXACT: LocationInputs = {
    reportCurrent: true, observedBytes: 120, observedLines: 10, currentBytes: 120, currentLines: 10,
    currentMtimeMs: Date.parse('2026-09-25T09:00:00Z'), analysedAt: '2026-09-25T10:00:00.000Z', line: 4,
  };

  describe('locationVerdict (IN10)', () => {
    it('is exact only when every check holds', () => {
      expect(locationVerdict(EXACT)).toEqual({ exact: true, line: 4 });
    });
    // Review Focus 4: one check at a time, each alone enough to drop the highlight.
    it.each([
      ['a stale report', { reportCurrent: false }, 'report', 'changed'],
      ['the same size, other lines', { currentLines: 11 }, 'lines', 'changed'],
      ['another size', { currentBytes: 121 }, 'size', 'changed'],
      ['no size observation', { observedBytes: null }, 'size', 'unknown'],
      ['no line observation', { observedLines: null }, 'lines', 'unknown'],
      ['modified after the analysis', { currentMtimeMs: Date.parse('2026-09-25T10:00:01Z') }, 'modified', 'changed'],
      ['no mtime', { currentMtimeMs: null }, 'modified', 'unknown'],
      ['no analysis time', { analysedAt: null }, 'modified', 'unknown'],
      ['a line past the end', { line: 11 }, 'line-range', 'changed'],
    ] as const)('%s fails %s', (_name, change, failed, cause) => {
      expect(locationVerdict({ ...EXACT, ...change })).toEqual({ exact: false, failed, cause });
    });
    it('names the FIRST failed check', () => {
      expect(locationVerdict({ ...EXACT, reportCurrent: false, currentBytes: 1 })).toMatchObject({ failed: 'report' });
    });
    it('a finding with no line is never exact', () => {
      expect(locationVerdict({ ...EXACT, line: null })).toEqual({ exact: false, failed: 'no-line' });
    });
    it('an mtime equal to the analysis time passes', () => {
      expect(locationVerdict({ ...EXACT, currentMtimeMs: Date.parse(EXACT.analysedAt!) })).toMatchObject({ exact: true });
    });
  });
  ```
  `tests/unit/investigation-source-preview.test.ts`, over `createFakeSourceFileSystem` (root `/fake-root`) with `resolveRoot: () => Promise.resolve('/fake-root')` and `createFixedClock()`:
  - 100 lines `l1`…`l100`, `line: 50` → lines 30…70 (41), `lineCount` 100, `readAt` the clock's time; `line: 3` → lines 1…23 (clipped, not shifted, IP16); `line: null` → lines 1…41; `line: 500` → lines 60…100.
  - A 450-character line comes back as 400 code points with `cut: true`; a line holding `\u0001`, `\u202E` and a tab shows `\u0001` and `\u202E` as the six-character text `\u0001`/`\u202E` and keeps the tab.
  - `\r\n` and `\n` endings give the same lines and the same `lineCount` as `countPhysicalLines`.
  - Unavailable states (IN9), each asserted by its `reason`: `getFilesystem: () => null` → `no-filesystem` (the defensive state, §3); `resolveRoot` null → `no-binding`; **root changed** (`resolveRoot` gives `/fake-root` but `expectedRoot` is `/other-root`) → `no-binding`; `relativePath: '../x'` → `outside-root`; a `{ symlinkTo }` file → `outside-root`; **symlinked ancestor** (`'dir': { symlinkTo: 'real' }` is not expressible in the fake — use the real test below); `{ binary: true }` → `binary`; `{ oversizedBytes: 600_000 }` with `maxFileBytes: 10_000_000` → `too-large` (the 512 KiB cap); `{ unreadable: true }` → `read-error`; a missing path → `missing`; a directory → `not-a-file`.
  - Nothing is ever written: the port type has no write method; assert `readLog()` holds only the stat and read paths under `/fake-root`.

  `tests/integration/investigation-preview-real.test.ts` (node project), over `makeTempTree` and `createRealNodePort()`:
  - reads `src/a.ts` (UTF-8 with a multi-byte character) with the real `mtimeMs` and `size` equal to its byte length;
  - classifies a file with invalid UTF-8 bytes (`{ binary: new Uint8Array([0x41, 0xC3, 0x28]) }`, no NUL) as `not-utf8`, and one with a NUL as `binary` — this pins the adapter reason strings the service matches (IP15);
  - **symlinked ancestor:** `link` is a junction to `real/` (`{ symlinkTo: 'real' }`, which `makeTempTree` creates as a Windows junction) and `link/a.ts` → `outside-root`;
  - **no write:** `hashTree(root)` before and after five reads is identical.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement `stale-location.ts`.**
  ```ts
  // WP-04 IN10: an exact line highlight only when EVERY check holds, in this order; the first
  // that fails is named. An unknown input fails its check towards stale, never towards exact.
  function compare(observed: number | null, current: number | null): 'changed' | 'unknown' | null {
    if (observed === null || current === null) return 'unknown';
    return observed === current ? null : 'changed';
  }

  export function locationVerdict(i: LocationInputs): LocationVerdict {
    if (i.line === null) return { exact: false, failed: 'no-line' };
    if (!i.reportCurrent) return { exact: false, failed: 'report', cause: 'changed' };
    const size = compare(i.observedBytes, i.currentBytes);
    if (size !== null) return { exact: false, failed: 'size', cause: size };
    const lines = compare(i.observedLines, i.currentLines);
    if (lines !== null) return { exact: false, failed: 'lines', cause: lines };
    const analysed = i.analysedAt === null ? Number.NaN : Date.parse(i.analysedAt);
    if (i.currentMtimeMs === null || Number.isNaN(analysed)) return { exact: false, failed: 'modified', cause: 'unknown' };
    if (i.currentMtimeMs > analysed) return { exact: false, failed: 'modified', cause: 'changed' };
    if (i.currentLines === null || i.line < 1 || i.line > i.currentLines) return { exact: false, failed: 'line-range', cause: 'changed' };
    return { exact: true, line: i.line };
  }
  ```
- [ ] **Step 4: Implement `root-path.ts`.** `joinRootPath` uses `\` when the root has a drive letter or a backslash, else `/`, and trims the root's trailing separators. `relativeInside` returns null unless `isContained(root, absolute)`, then joins the absolute path's segments after the root's with `/`. `sameRoot(a, b)` is `isContained(a, b) && isContained(b, a)`.
- [ ] **Step 5: Implement `source-preview.ts`.** The order of checks is the IN9 order, and nothing reads before every path check has passed (IP15):
  ```ts
  const REASONS: readonly (readonly [prefix: string, reason: PreviewUnavailable])[] = [
    ['file exceeds the maximum size', 'too-large'],
    ['file appears to contain binary content', 'binary'],
    ['file is not valid UTF-8', 'not-utf8'],
  ];
  const classify = (reason: string): PreviewUnavailable => REASONS.find(([p]) => reason.startsWith(p))?.[1] ?? 'read-error';
  const unavailable = (reason: PreviewUnavailable): PreviewResult => ({ status: 'unavailable', reason });

  export function createSourcePreview(deps: SourcePreviewDeps): SourcePreview {
    async function read(request: PreviewRequest): Promise<PreviewResult> {
      const fs = deps.getFilesystem();
      if (fs === null) return unavailable('no-filesystem');
      const root = await deps.resolveRoot(request.codebaseId);
      if (root === null || !sameRoot(root, request.expectedRoot)) return unavailable('no-binding');
      let rel: string;
      try { rel = normalizeRelativePath(request.relativePath); } catch { return unavailable('outside-root'); }
      const abs = joinRootPath(root, rel);
      if (!isContained(root, abs)) return unavailable('outside-root');
      const segments = rel.split('/');
      for (let i = 1; i < segments.length; i += 1) {
        const dir = await fs.stat(joinRootPath(root, segments.slice(0, i).join('/')));
        if (!dir.exists) return unavailable('missing');
        if (dir.isSymbolicLink) return unavailable('outside-root');
      }
      const st = await fs.stat(abs);
      if (!st.exists) return unavailable('missing');
      if (st.isSymbolicLink) return unavailable('outside-root');
      if (!st.isFile) return unavailable('not-a-file');
      const limit = Math.min(request.maxFileBytes, PREVIEW_MAX_BYTES);
      if (st.size > limit) return unavailable('too-large');
      const result = await fs.readText(abs, limit);
      if (result.status === 'unavailable') return unavailable(classify(result.reason));
      return { status: 'ok', text: { ...windowOf(result.text, request.line), size: result.bytes.byteLength, mtimeMs: st.mtimeMs, readAt: deps.clock.nowIso() } };
    }
    return { read };
  }
  ```
  `windowOf` (module-private) splits on `/\r?\n/` after dropping one final line ending, takes `lineCount = countPhysicalLines(text)`, and picks `[max(1, L−20), min(count, L+20)]` for a line L within the file, the last 41 lines for L past the end, and the first 41 for no line (IP16). Each line is cut at 400 code points (`cut: true`), then every C0 control except tab, DEL, C1 and the bidi/format controls of `note-text.ts` is shown as `\uXXXX` (upper-case hex, four digits).
- [ ] **Step 6: Run.** `npx vitest run tests/unit/investigation-stale-location.test.ts tests/unit/investigation-source-preview.test.ts tests/integration/investigation-preview-real.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts` gives PASS (the last two with `30_000` already in their files).
- [ ] **Step 7: Gate and commit** (`feat(investigation): stale-location rule and the bounded read-only source preview (WP-04 IN7–IN10, IN13)`).

### Task 5: The note-index reducer

**Files:**
- Create: `src/application/investigation/note-index.ts`
- Test: `tests/unit/investigation-note-index.test.ts` (new)

**Interfaces:**
- Consumes: `NOTE_TYPE` (Task 3), `isPlainObject` (`src/domain/plain-data.ts`).
- Produces:
  ```ts
  export interface NoteLink {
    readonly path: string; readonly codebaseId: string; readonly fingerprint: string;   // portable, `<source_path>#<finding_id>`
    readonly findingId: string; readonly sourcePath: string; readonly snapshotId: string; readonly status: string | null;
  }
  export type NoteRecord =
    | { readonly kind: 'linked'; readonly link: NoteLink }
    | { readonly kind: 'malformed'; readonly path: string; readonly codebaseId: string };
  export type NoteRecords = ReadonlyMap<string, NoteRecord>;   // by vault path
  export type NoteEvent =
    | { readonly kind: 'reset'; readonly files: readonly { readonly path: string; readonly frontmatter: unknown }[] }
    | { readonly kind: 'changed'; readonly path: string; readonly frontmatter: unknown }
    | { readonly kind: 'renamed'; readonly oldPath: string; readonly path: string; readonly frontmatter: unknown }
    | { readonly kind: 'deleted'; readonly path: string };
  export function readNoteFrontmatter(path: string, frontmatter: unknown): NoteRecord | null;
  export function applyNoteEvent(records: NoteRecords, event: NoteEvent): NoteRecords;   // the SAME map when nothing changed
  export interface NoteIndex { readonly byFingerprint: ReadonlyMap<string, readonly NoteLink[]>; readonly malformed: number }
  export const EMPTY_NOTE_INDEX: NoteIndex;
  export function noteIndexFor(records: NoteRecords, codebaseId: string): NoteIndex;   // each list sorted by path, code unit
  ```

- [ ] **Step 1: Write the failing tests.**
  ```ts
  import { describe, expect, it } from 'vitest';
  import { applyNoteEvent, noteIndexFor, readNoteFrontmatter, type NoteRecords } from '../../src/application/investigation/note-index';

  const fm = (over: Record<string, unknown> = {}) => ({
    type: 'codebase-investigation', codebase_id: 'p1', entity_id: 'file:src/a.ts', source_path: 'src/a.ts',
    snapshot_id: 's1', finding_id: 'UN-00000001', finding_fingerprint: 'src/a.ts#UN-00000001', provider: 'fallow',
    status: 'open', created: '2026-09-25T10:00:00.000Z', ...over,
  });
  const EMPTY: NoteRecords = new Map();

  describe('readNoteFrontmatter (IN33)', () => {
    it('links a well-formed note', () => {
      expect(readNoteFrontmatter('n.md', fm())).toEqual({ kind: 'linked', link: {
        path: 'n.md', codebaseId: 'p1', fingerprint: 'src/a.ts#UN-00000001', findingId: 'UN-00000001',
        sourcePath: 'src/a.ts', snapshotId: 's1', status: 'open' } });
    });
    it('ignores a note that is not an investigation, or names no codebase', () => {
      expect(readNoteFrontmatter('n.md', { type: 'daily' })).toBeNull();
      expect(readNoteFrontmatter('n.md', fm({ codebase_id: 42 }))).toBeNull();
      expect(readNoteFrontmatter('n.md', null)).toBeNull();
      expect(readNoteFrontmatter('n.md', ['type'])).toBeNull();
    });
    // Review Focus 5: hostile frontmatter.
    it.each([
      ['a number fingerprint', { finding_fingerprint: 7 }], ['a list snapshot', { snapshot_id: ['s1'] }],
      ['a null finding id', { finding_id: null }], ['an empty source path', { source_path: '' }],
      ['an over-long fingerprint', { finding_fingerprint: 'x'.repeat(2049) }],
    ])('counts %s as malformed', (_name, over) => {
      expect(readNoteFrontmatter('n.md', fm(over))).toEqual({ kind: 'malformed', path: 'n.md', codebaseId: 'p1' });
    });
    it('keeps a non-string status as no status', () => {
      expect(readNoteFrontmatter('n.md', fm({ status: 3 }))).toMatchObject({ link: { status: null } });
    });
  });

  describe('applyNoteEvent and noteIndexFor', () => {
    const base = applyNoteEvent(EMPTY, { kind: 'reset', files: [
      { path: 'b.md', frontmatter: fm() }, { path: 'a.md', frontmatter: fm() },
      { path: 'other.md', frontmatter: fm({ codebase_id: 'p2' }) }, { path: 'bad.md', frontmatter: fm({ finding_id: 1 }) },
    ] });
    it('lists every note for a fingerprint, by path, for this codebase only (duplicates kept)', () => {
      const index = noteIndexFor(base, 'p1');
      expect(index.byFingerprint.get('src/a.ts#UN-00000001')!.map((l) => l.path)).toEqual(['a.md', 'b.md']);
      expect(index.malformed).toBe(1);
      expect(noteIndexFor(base, 'p2').byFingerprint.get('src/a.ts#UN-00000001')!.map((l) => l.path)).toEqual(['other.md']);
    });
    it('follows a rename and forgets a delete', () => {
      const moved = applyNoteEvent(base, { kind: 'renamed', oldPath: 'a.md', path: 'x/a.md', frontmatter: fm() });
      expect(noteIndexFor(moved, 'p1').byFingerprint.get('src/a.ts#UN-00000001')!.map((l) => l.path)).toEqual(['b.md', 'x/a.md']);
      const gone = applyNoteEvent(moved, { kind: 'deleted', path: 'b.md' });
      expect(noteIndexFor(gone, 'p1').byFingerprint.get('src/a.ts#UN-00000001')!.map((l) => l.path)).toEqual(['x/a.md']);
    });
    it('unlinks a note whose frontmatter was edited away', () => {
      const edited = applyNoteEvent(base, { kind: 'changed', path: 'a.md', frontmatter: { type: 'note' } });
      expect(noteIndexFor(edited, 'p1').byFingerprint.get('src/a.ts#UN-00000001')!.map((l) => l.path)).toEqual(['b.md']);
    });
    it('returns the same map when nothing changed, so no listener fires', () => {
      expect(applyNoteEvent(base, { kind: 'changed', path: 'a.md', frontmatter: fm() })).toBe(base);
      expect(applyNoteEvent(base, { kind: 'deleted', path: 'none.md' })).toBe(base);
      expect(applyNoteEvent(base, { kind: 'reset', files: [
        { path: 'b.md', frontmatter: fm() }, { path: 'a.md', frontmatter: fm() },
        { path: 'other.md', frontmatter: fm({ codebase_id: 'p2' }) }, { path: 'bad.md', frontmatter: fm({ finding_id: 1 }) },
      ] })).toBe(base);
    });
  });
  ```
- [ ] **Step 2: Run it to see it fail.**
- [ ] **Step 3: Implement.** Every value is read through one guard, `const text = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 2048 ? v : null);`. `type` must equal `NOTE_TYPE` and `codebase_id` must pass `text`, else null; any of `finding_fingerprint`, `finding_id`, `source_path`, `snapshot_id` failing `text` gives `malformed`; `status` is `text(status)` or null (IP38). `applyNoteEvent`:
  ```ts
  const same = (a: NoteRecord | undefined, b: NoteRecord): boolean => a !== undefined && JSON.stringify(a) === JSON.stringify(b);

  function put(records: NoteRecords, path: string, record: NoteRecord | null): NoteRecords {
    const had = records.get(path);
    if (record === null ? had === undefined : same(had, record)) return records;
    const next = new Map(records);
    if (record === null) next.delete(path); else next.set(path, record);
    return next;
  }

  export function applyNoteEvent(records: NoteRecords, event: NoteEvent): NoteRecords {
    switch (event.kind) {
      case 'reset': {
        const next = new Map<string, NoteRecord>();
        for (const f of event.files) { const r = readNoteFrontmatter(f.path, f.frontmatter); if (r) next.set(f.path, r); }
        const unchanged = next.size === records.size && Array.from(next).every(([p, r]) => same(records.get(p), r));
        return unchanged ? records : next;
      }
      case 'changed': return put(records, event.path, readNoteFrontmatter(event.path, event.frontmatter));
      case 'renamed': return put(put(records, event.oldPath, null), event.path, readNoteFrontmatter(event.path, event.frontmatter));
      case 'deleted': return put(records, event.path, null);
      default: { const never: never = event; throw new Error(`unhandled note event: ${JSON.stringify(never)}`); }
    }
  }
  ```
  (`Array.from(next).every` runs only after the size check; with `next.size === 0` the result is `true`, which is correct: two empty maps are equal.) `noteIndexFor` groups linked records of `codebaseId` by `fingerprint`, sorts each list by path with `<`/`>`, and counts that codebase's malformed records.
- [ ] **Step 4: Run.** PASS.
- [ ] **Step 5: Gate and commit** (`feat(investigation): the note index reducer over frontmatter (WP-04 IN33, IN36)`).

### Task 6: The investigation read model

**Files:**
- Create: `src/ui/read-models/investigation.ts`, `src/ui/read-models/investigation-evidence.ts`
- Modify: `src/ui/read-models/use-read-models.ts` (`investigation` computed, reading `useInvestigationStore().notes` — added as `EMPTY_NOTE_INDEX` in this task, wired in Task 10), `src/ui/stores/investigation-store.ts` (the `notes` shallowRef only), `src/ui/audit-copy/investigation.ts` (uncertainty, checklist and note-vocabulary words)
- Test: `tests/unit/investigation-model.test.ts` (new), `tests/unit/investigation-evidence.test.ts` (new)

**Interfaces:**
- Consumes: `buildQualityModel`, `QualityModel`, `QualityFinding`, `FindingStatus`, `severityRank`, `FINDING_CATEGORIES`, `findingRef` (`src/ui/read-models/review-state.ts:64`), `NoteIndex`, `NoteLink`, `EMPTY_NOTE_INDEX` (Task 5), `EvidenceFacts`, `NoteIdentity`, `NoteVocabulary` (Task 3), `LocationVerdict` (Task 4), `originOf`, `cyclePathText`, `RELATIONS_SCOPE_NOTE`, `FINDING_KIND_LABEL`, `RULE_TEXT`, `SEVERITY_TEXT`, `FINDING_DIALOG_RULE_VALUE`; fixtures `attachSyntheticReport`, `attachRelationsReport`, `RELATIONS_PATHS`, `snapshotWithPaths`.
- Produces:
  ```ts
  // investigation.ts
  export type NoteFilter = 'all' | 'with-note' | 'without-note';
  export interface InvestigationFilter {
    query: string; kind: FindingCategory | null; rule: string | null; severity: string | null;
    status: FindingStatus | 'all'; note: NoteFilter;
  }
  export const DEFAULT_INVESTIGATION_FILTER: Readonly<InvestigationFilter>;   // status 'all', note 'all' (IP19)
  export interface InvestigationRow extends QualityFinding { readonly portable: string | null; readonly notes: readonly NoteLink[] }
  export interface InvestigationModel {
    readonly rows: readonly InvestigationRow[];                   // IN3 order
    readonly byFingerprint: ReadonlyMap<string, InvestigationRow>;
    readonly rules: readonly string[];                             // present rules, code-unit order
    readonly severities: readonly string[];                        // quality.severities
    readonly orphanNotes: readonly NoteLink[];                     // notes whose fingerprint no row has (IN34, IN36), by path
    readonly withNotes: number;
    readonly malformedNotes: number;
    readonly evidence: EvidenceIndex;
  }
  export function buildInvestigationModel(quality: QualityModel, notes: NoteIndex): InvestigationModel;
  export function filterInvestigation(rows: readonly InvestigationRow[], filter: InvestigationFilter): readonly InvestigationRow[];
  // investigation-evidence.ts
  export interface EvidenceBundle {
    readonly kindLabel: string; readonly ruleText: string; readonly ruleDetail: string; readonly severityText: string;
    readonly location: string; readonly related: readonly string[]; readonly unmatchedRelated: ReadonlySet<string>;
    readonly cyclePath: string; readonly cycleFiles: readonly string[]; readonly provider: string;
    readonly origin: EvidenceOrigin; readonly analysedAt: string; readonly snapshotId: string;
    readonly state: 'current' | 'stale';
  }
  export function evidenceBundleFor(row: InvestigationRow, evidence: EvidenceIndex, files: readonly FileSummary[]): EvidenceBundle | null;
  export function analysedAtOf(report: EvidenceReport): string;          // collected.startedAt ?? importedAt
  export function uncertaintiesFor(row: InvestigationRow, bundle: EvidenceBundle, verdict: LocationVerdict | null): readonly string[];
  export function checklistFor(kind: FindingCategory): readonly string[];
  export function noteIdentityFor(row: InvestigationRow, codebaseId: string, snapshotId: string): NoteIdentity;
  export function evidenceFactsFor(row: InvestigationRow, bundle: EvidenceBundle, uncertainties: readonly string[]): EvidenceFacts;
  export function goneFactsFor(link: NoteLink, evidence: EvidenceIndex, snapshotId: string): EvidenceFacts;   // reported: false
  // audit-copy/investigation.ts (additions)
  export const NOTE_VOCABULARY: NoteVocabulary;
  export const UNCERTAINTY_STATIC: string; export const UNCERTAINTY_REPORT_STALE: string; export const UNCERTAINTY_NOT_RATED: string;
  export const UNCERTAINTY_IMPORT_TIME: string; export const UNCERTAINTY_LINE_NOT_CHECKED: string; export const UNCERTAINTY_NO_LINE: string;
  export const UNCERTAINTY_LINE_MATCHED: (line: number) => string;
  export const UNCERTAINTY_LINE_STALE: (check: LocationCheck, cause: 'changed' | 'unknown', line: number | null) => string;
  export const UNCERTAINTY_BY_KIND: Readonly<Record<FindingCategory, string>>;
  export const CHECKLIST_BY_KIND: Readonly<Record<FindingCategory, readonly string[]>>;
  ```
  The words, exactly:
  - `UNCERTAINTY_STATIC = 'Static analysis only: this is not evidence from running the code.'`
  - `UNCERTAINTY_REPORT_STALE = 'The report was attached to an earlier scan, so paths and lines may have changed since.'`
  - `UNCERTAINTY_NOT_RATED = 'fallow gives this finding no severity.'`
  - `UNCERTAINTY_IMPORT_TIME = 'When fallow ran is not known for an imported report; the import time is used as the latest possible analysis time.'`
  - `UNCERTAINTY_LINE_NOT_CHECKED = 'The reported line has not been checked against the current file.'`
  - `UNCERTAINTY_NO_LINE = 'fallow reports no line for this finding.'`
  - `UNCERTAINTY_LINE_MATCHED = (line) => \`Line ${line} matches the file as it was analysed: same size, same line count, not modified since.\``
  - `UNCERTAINTY_LINE_STALE`: `report` → "The report is stale, so line N may have moved."; `size` → "The file size (changed | is not known) since the scan. Line N may have moved."; `lines` → the same with "line count"; `modified` → "The file (changed after the analysis | modification time is not known). Line N may have moved."; `line-range` → "Line N is past the end of the file now." (N is "the reported line" when null).
  - `UNCERTAINTY_BY_KIND`: complexity "Complexity is a threshold on a metric, not a defect."; duplication "Duplication is textual similarity above fallow’s threshold; the copies may differ in meaning."; unused-exports "An unused export may still be used dynamically, by a framework convention, or by a consumer outside the analysed folder."; cycle "Type-only imports are not reported, so the cycle at run time may differ."; boundary "A boundary violation depends on the zones in the analysed folder’s fallow configuration."; unresolved-import "An unresolved import may be a path alias fallow did not resolve."
  - `CHECKLIST_BY_KIND`: complexity ["Read the function and confirm the reported measure.", "Check which tests cover the branches you would change.", "Decide whether a split lowers the measure without moving it elsewhere."]; duplication ["Compare every reported copy and confirm they do the same thing.", "Check whether the copies are meant to change together.", "Confirm an extraction would not couple unrelated modules."]; unused-exports ["Search the whole repository, including other packages, for the symbol.", "Check dynamic imports, reflection, framework conventions and public API consumers.", "Confirm the symbol is not an entry point named in configuration."]; cycle ["Confirm each import in the cycle path still exists.", "Check whether any of the imports is type-only.", "Decide which dependency direction is intended."]; boundary ["Confirm the import still exists at the reported line.", "Check the fallow boundary configuration for the intended rule.", "Decide whether the rule or the import should change."]; unresolved-import ["Check path aliases in the TypeScript or bundler configuration fallow read.", "Confirm the target file exists in the analysed folder.", "Check whether the import is generated or conditional."].
  - `NOTE_VOCABULARY.headings`: "Context", "Observed finding", "Source, scope and time", "Uncertainties", "Investigation notes", "Proposed change", "Verification checklist", "Decision" (IN22). Prompts: "What did you check, and what did you find?", "What would you change, and what would it affect?", "What was decided, by whom, and why?". Labels: "Finding", "Kind", "Rule", "Detail", "Severity", "Location", "Also involves", "Cycle path", "Provider", "Analysed at", "Snapshot", "Evidence", "Not reported by the current analysis" (IN34), `line` as `FINDING_META` words it without the rule, `more` as "N more".

- [ ] **Step 1: Write the failing tests.** `tests/unit/investigation-model.test.ts` (fixtures through the real parser):
  - **List source (IN1):** over `attachSyntheticReport(buildSnapshotFixture({ files: 8 }))`, `buildInvestigationModel(quality, EMPTY_NOTE_INDEX).rows.map((r) => r.fingerprint)` has the same **set** as `quality.findings` (after a length check).
  - **Order (IN3):** build a report whose findings cover `critical`, `high`, `moderate`, an unlisted word and unrated: `JSON.parse(syntheticFallowJson(snapshot))`, set `health.findings[3].severity = 'urgent'`, re-serialise, and read it through `parseFallowReportText` and `buildEvidenceReport` (unused exports carry no severity, so they are unrated); assert the row severities read `critical, high, moderate, urgent, unrated` in that order, then that two findings of one severity sort by category order, path, line (null last) and id. Assert the order is identical for two calls on shuffled inputs (a total order: `rows.map(fp)` equal).
  - **Filters (IN2):** each of `kind`, `rule`, `severity`, `status`, `note: 'with-note'`, `note: 'without-note'` and `query` narrows as stated; `rules` lists the present rules in code-unit order.
  - **Notes (IN33, IN36):** a `NoteIndex` holding one link under `findingRef(row.fingerprint)` and one under `'gone.ts#UN-99999999'`: the row has one note, `withNotes` is 1, and `orphanNotes` holds the gone one; `malformed` passes through.

  `tests/unit/investigation-evidence.test.ts`:
  - `evidenceBundleFor` on a relations import cycle (`attachRelationsReport(snapshotWithPaths(RELATIONS_PATHS))`) gives `cyclePath` equal to `cyclePathText(hops)`, `cycleFiles` the hop order, and `related` the other members.
  - `analysedAtOf` gives `collected.startedAt` for `collectedEvidenceReport(snapshot)` and `importedAt` otherwise.
  - `uncertaintiesFor` (IN15): always `UNCERTAINTY_STATIC`; `UNCERTAINTY_LINE_NOT_CHECKED` with no verdict; `UNCERTAINTY_REPORT_STALE` for a stale report; `RELATIONS_SCOPE_NOTE` for cycle, boundary and unresolved rows and not for the others; `UNCERTAINTY_NOT_RATED` for `unrated`; `UNCERTAINTY_IMPORT_TIME` for an imported report only; and the kind's own caveat last.
  - `checklistFor(kind)` has 2–4 entries for every `FINDING_CATEGORIES` member (after a length check).
  - **No fabricated confidence (IN17):** no string in any uncertainty, checklist or vocabulary value matches `/%|\bsafe to (delete|remove)\b|\bconfidence\b|\bscore\b|\brisk\b/i`.
  - `noteIdentityFor(row, 'p1', snapshot.snapshotId)` has `sourcePath === row.anchorPath`; `evidenceFactsFor` never contains `collected.rootPath` or `executablePath` in any string (serialise the facts and search).
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** The order (IP19 total order, J3 code units):
  ```ts
  const CATEGORY_ORDER = new Map<FindingCategory, number>(FINDING_CATEGORIES.map((c, i) => [c, i]));
  const byUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const lineKey = (line: number | null): number => (line === null ? Number.MAX_SAFE_INTEGER : line);

  function investigationOrder(a: QualityFinding, b: QualityFinding): number {
    return severityRank(a.severity) - severityRank(b.severity)
      || byUnit(a.severity, b.severity)
      || (CATEGORY_ORDER.get(a.kind) ?? FINDING_CATEGORIES.length) - (CATEGORY_ORDER.get(b.kind) ?? FINDING_CATEGORIES.length)
      || byUnit(a.file.path, b.file.path)
      || lineKey(a.line) - lineKey(b.line)
      || byUnit(a.id, b.id);
  }
  ```
  `byUnit(a.severity, b.severity)` only separates two different words of the same rank, which is rank 3 ("any other string alphabetically"). A row's `portable` is `findingRef(row.fingerprint)`; its notes are `notes.byFingerprint.get(portable) ?? []`. Memoise `buildInvestigationModel` on `(quality, notes)` with a `WeakMap` keyed by the quality model (as `baseCache` in `findings.ts`). `use-read-models.ts` gains `const investigation = computed(() => buildInvestigationModel(quality.value, investigationStore.notes));` and returns it.
- [ ] **Step 4: Run.** PASS, then `npm run analyze` (baseline 9; any new finding is a dead export to make module-private).
- [ ] **Step 5: Gate and commit** (`feat(ui): the investigation read model — order, filters, notes, uncertainties and checklist (WP-04 IN1–IN3, IN14–IN17)`).

### Task 7: An in-memory vault and YAML in the Obsidian mock

**Files:**
- Modify: `tests/mocks/obsidian.ts` (336 → about 380: `TAbstractFile`, `TFile`, `TFolder`, `parseYaml`, `stringifyYaml`, `Plugin.registerEvent`), `package.json` and `package-lock.json` (`"yaml": "2.9.1"` in `devDependencies`, IP29)
- Create: `tests/fixtures/fake-vault.ts`
- Test: `tests/unit/fake-vault.test.ts` (new); re-run `tests/unit/obsidian-mock-scope.test.ts` and `tests/host/plugin-onload.test.ts` unchanged

**Interfaces:**
- Consumes: the mock's `FileSystemAdapter` and `CapacitorAdapter`.
- Produces:
  ```ts
  // tests/mocks/obsidian.ts
  export class TAbstractFile { path = ''; name = ''; parent: TFolder | null = null; vault: unknown = null }
  export class TFile extends TAbstractFile { basename = ''; extension = ''; stat = { ctime: 0, mtime: 0, size: 0 } }
  export class TFolder extends TAbstractFile { children: TAbstractFile[] = []; isRoot(): boolean { return this.path === '/'; } }
  export function parseYaml(text: string): unknown;       // `yaml`'s parse
  export function stringifyYaml(value: unknown): string;  // `yaml`'s stringify
  // Plugin gains: registerEvent(_ref: unknown): void {}
  // tests/fixtures/fake-vault.ts
  export interface FakeVaultOptions { basePath?: string | null; configDir?: string }   // basePath null: a CapacitorAdapter (no vault base path)
  export interface FakeVault {
    readonly app: App;                                   // one cast at the boundary, inside the fixture
    text(path: string): string | undefined;              // a file's current content
    paths(): string[];                                   // every file path, sorted
    userWrite(path: string, text: string): void;         // an edit in Obsidian: write, then metadata 'changed'
    userRename(oldPath: string, newPath: string): void;  // vault 'rename', then metadata 'changed'
    userDelete(path: string): void;                      // vault 'delete'
    resolve(): void;                                     // metadata 'resolved'
    raceNextCreate(path: string, text: string): void;    // another writer creates `path` just before our create lands
    readonly opened: string[];                           // paths passed to workspace.getLeaf(true).openFile
    readonly calls: { getMarkdownFiles: number; create: number; createFolder: number; process: number; processFrontMatter: number };
  }
  export function createFakeVault(options?: FakeVaultOptions): FakeVault;
  ```
  The fake mirrors the Obsidian behaviour the host relies on, stricter where Obsidian is loose: `vault.create` rejects when the exact path exists **or** its parent folder is missing; `createFolder` rejects when the folder exists or its parent is missing (so the host must create one segment at a time, IN28); `getAbstractFileByPath` is exact and case-sensitive (as Obsidian's is) while `create` treats a case-only match as taken (a case-insensitive disk, IP9); `process(file, fn)` writes `fn(text)` and fires `changed`; `fileManager.processFrontMatter(file, fn)` parses the leading `---` block with `parseYaml`, calls `fn` on the object, and writes `---\n${stringifyYaml(obj)}---\n` followed by the unchanged body; `metadataCache.getFileCache(file)` returns `{ frontmatter }` parsed the same way (undefined when the block is absent or not a mapping). It imports neither `vitest` nor any `node:*` module (Task 17 bundles it).

- [ ] **Step 1: Write the failing test** (`tests/unit/fake-vault.test.ts`):
  - **YAML round trip (IN20):** `parseYaml(stringifyYaml(obj))` deep-equals `obj` for an object of strings including `'a: b'`, `'#x'`, `'[[x]]'`, `'- y'`, `"it's"`, `'"q"'`, `'yes'`, `'null'`, `'0012'`, `'true'`, `'snapshot:p1:2026-09-25T10:00:00.000Z'` and `'src/a.ts#UN-00000001'` (every value comes back a string).
  - `create` rejects on an existing path, a case-only duplicate and a missing parent; `createFolder('a/b')` rejects before `createFolder('a')`.
  - `processFrontMatter` changes one key and leaves the body byte-identical (compare the text after the second `---\n`).
  - `userRename` fires `rename` then `changed`; `userDelete` fires `delete`; listeners registered through `vault.on`/`metadataCache.on` receive them.
  - `raceNextCreate` makes the next `create` of that path reject with the other writer's text in place.
- [ ] **Step 2: Run it to see it fail.**
- [ ] **Step 3: Implement** the mock additions (`import { parse, stringify } from 'yaml';` at the top of the mock, with a comment: the real Obsidian serialiser is not this library, so no test asserts YAML bytes, only values — IP29) and the fixture. Add `"yaml": "2.9.1"` to `devDependencies` and run `npm install --no-audit --no-fund` once so the lockfile lists it at the top level (the version is already installed as a Vite dependency; nothing new is downloaded).
- [ ] **Step 4: Run.** `npx vitest run tests/unit/fake-vault.test.ts tests/unit/obsidian-mock-scope.test.ts tests/host/plugin-onload.test.ts` gives PASS.
- [ ] **Step 5: Gate and commit** (`test(fixtures): an in-memory vault and YAML in the obsidian mock (WP-04 IN37)`).

### Task 8: The Investigation notes folder setting

**Files:**
- Create: `src/adapters/storage/plugin-data-investigation-store.ts`, `tests/fixtures/fake-investigation-folders.ts`
- Modify: `src/adapters/storage/plugin-data-shape.ts` (`investigations?: unknown` and its comment), `src/host/setting-definitions.ts` (`ProfileEntry.investigationFolder`, the callback, the row right after "Excluded paths", `STORAGE_DISCLOSURE_TEXT` per IN41), `src/host/settings-tab.ts` (a 9th constructor parameter, `refresh`, `changeInvestigationFolder`, purge on delete), `src/main.ts` (build and pass the store), `src/ui/audit-copy/investigation.ts` (the row and refusal words), `src/ui/audit-copy/settings.ts` (`SETTINGS_STORAGE_TEXT` in place, per IN41)
- Modify in place, on the existing constructor line (IP28): `tests/component/settings-tab.test.ts:44` (+1 import line), `tests/component/settings-tab-validation.test.ts:24`, `tests/component/settings-fallow.test.ts:38` and `:179` (the pinned disclosure text), `tests/component/settings-tab-purge.test.ts:40`, `tests/host/plugin-onload.test.ts:164`
- Test: `tests/unit/investigation-folder-store.test.ts` (new), `tests/component/settings-notes-folder.test.ts` (new)

**Interfaces:**
- Consumes: `writePluginDataSlice`, `readPluginData`, `isPlainObject`, `validateNoteFolder`, `defaultNoteFolder`, `NOTE_FOLDER_MAX` (Task 2), `ValidationError`, `buildSettingDefinitions`.
- Produces (spec §3: one application port, so the folder store is an adapter type used only by the host, IP42):
  ```ts
  // plugin-data-investigation-store.ts
  export interface InvestigationFolderStore {
    read(profileId: string): Promise<string | null>;        // null: never set, or fails the shape check (the default applies, IN19)
    write(profileId: string, folder: string): Promise<void>; // the caller validates first (IN19)
    purge(profileId: string): Promise<void>;                // profile removal (IN18, IP27); notes stay in the vault
  }
  export function createPluginDataInvestigationStore(plugin: Plugin): InvestigationFolderStore;
  // module-private in the same file: decodeFolder(slice, profileId), applyFolder(slice, profileId, folder | null)
  // setting-definitions.ts
  // ProfileEntry gains `investigationFolder: string` (the stored value, or the default)
  // SettingDefinitionsCallbacks gains `onInvestigationFolderChange: (profileId: string, rawValue: string) => void`
  // tests/fixtures/fake-investigation-folders.ts
  export function createFakeInvestigationFolders(initial?: Record<string, string>): InvestigationFolderStore & { readonly folders: Map<string, string> };
  // audit-copy/investigation.ts
  export const NOTES_FOLDER_SETTING_NAME = 'Investigation notes folder';
  export const NOTES_FOLDER_SETTING_DESC = 'The vault folder new investigation notes go in. You confirm the folder and file name each time a note is created.';
  export const NOTES_FOLDER_PROBLEM: Readonly<Record<NoteFolderProblem, string>>;   // one sentence each
  export const PROFILE_INVESTIGATION_PURGE_FAILED: (reason: string) => string;
  ```
  `NOTES_FOLDER_PROBLEM`: empty "Enter a folder inside this vault."; not-relative "Use a folder path inside this vault, such as Notes/Investigations, without a leading slash, a drive letter, or . and .. segments."; too-long "Keep the folder path to 200 characters or fewer."; config-dir "Notes cannot go in the vault’s configuration folder."; unsafe-name "A folder name cannot contain \ / : * ? \" < > | # ^ [ ], start with a dot, end with a dot or space, or be a reserved Windows name."
  The two disclosures (IN41, O7) take exactly IP31's words:
  - `SETTINGS_STORAGE_TEXT` = 'Work items, finding decisions and boundary rules are saved for each codebase in this plugin’s own data for this vault, so they survive restarts. Imported findings and the report screen’s sections and note are kept for this session only. Investigation notes are ordinary notes in your vault, written only when you create or refresh one.'
  - `STORAGE_DISCLOSURE_TEXT` keeps its first two sentences and continues: '… marked with this device: another device never runs it without asking again. Each codebase’s investigation notes folder is stored there too. Removing a profile removes its review decisions, its executable setting and its notes folder setting; it never deletes the investigation notes you created. fallow findings, imported or collected, are kept for this session only. Nothing about them is sent anywhere else.'

- [ ] **Step 1: Write the failing tests.**
  - `tests/unit/investigation-folder-store.test.ts` (node project, the mock `Plugin`'s `loadData`/`saveData`): `read` returns the folder for `{ p1: { folder: 'Notes' } }`, and null for a missing entry, a non-object slice, `{ p1: 'Notes' }`, `{ p1: { folder: 7 } }`, an over-long string and an inherited key (`'toString'`); `write` of the stored value and `purge` of a missing entry save nothing (count `saveData` calls — Polish E7's same-reference rule); `write` and `purge` keep other profiles' entries; and `profiles`, `bindings`, `reviews` and `analyzers` are untouched.
  - `tests/component/settings-notes-folder.test.ts` (construct the tab as `settings-tab.test.ts` does, with an `app` whose `vault.configDir` is `'.obsidian'` and `createFakeInvestigationFolders()`):
    - the profile page lists "Investigation notes folder" right after "Excluded paths", showing the default `Codebase investigations/Alpha` for a profile named Alpha;
    - a valid change writes the folder and re-renders it;
    - `'../x'`, `'.obsidian/notes'` and `'a/CON'` are refused: nothing is written, a `Notice` shows `NOTES_FOLDER_PROBLEM[problem]`, and the field shows the stored value again;
    - deleting the profile purges its folder entry after the profile is gone; a failing purge shows `PROFILE_INVESTIGATION_PURGE_FAILED`.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** The adapter's module-private `decodeFolder`/`applyFolder` mirror `analyzer-record.ts`'s `ownEntry`/`withoutEntry` (own keys only, `Object.prototype.hasOwnProperty.call`, never `in`; a new object, never an in-place edit), and shape-check the entry (IN19) with `z.object({ folder: z.string().min(1).max(NOTE_FOLDER_MAX) }).strict()`. The store is three `writePluginDataSlice(plugin, 'investigations', …)` calls and one `readPluginData`. In `settings-tab.ts`:
  ```ts
  private async changeInvestigationFolder(profileId: string, rawValue: string): Promise<void> {
    const checked = validateNoteFolder(rawValue, this.app.vault.configDir);
    if (checked.ok) {
      try { await this.investigations.write(profileId, checked.folder); } catch (e) { this.showFailure(e); }
    } else {
      this.notify(NOTES_FOLDER_PROBLEM[checked.problem]);
    }
    await this.refresh();
  }
  ```
  `refresh()` sets `investigationFolder: (await this.investigations.read(profile.profileId)) ?? defaultNoteFolder(profile.name)` for each entry. `deleteProfile` purges after the analyzer purge, with the same `.catch` pattern and `PROFILE_INVESTIGATION_PURGE_FAILED`. The row renders a text input like `renderNameRow` and calls `onInvestigationFolderChange` on `change`.
- [ ] **Step 4: Edit the six test lines in place** (the constructor calls gain `, createFakeInvestigationFolders()` on their existing line; `settings-fallow.test.ts:179` gets the new disclosure text on its one line). `settings-tab.test.ts` ends at 437 lines.
- [ ] **Step 5: Run.** `npx vitest run tests/unit/investigation-folder-store.test.ts tests/component/settings-notes-folder.test.ts tests/component/settings-tab.test.ts tests/component/settings-tab-validation.test.ts tests/component/settings-fallow.test.ts tests/component/settings-tab-purge.test.ts tests/host/plugin-onload.test.ts tests/component/settings-privacy-storage.test.ts tests/component/settings-screen.test.ts` gives PASS (the last two render `SETTINGS_STORAGE_TEXT`; if either pins its old words, update that one line in place and list it).
- [ ] **Step 6: Gate and commit** (`feat(settings): the Investigation notes folder per codebase, and the storage disclosures (WP-04 IN18, IN19, IN41)`).

### Task 9: InvestigationNotesPort and the host implementation

**Files:**
- Create: `src/application/ports/investigation-notes-port.ts`, `src/host/investigation-notes.ts`, `src/host/investigation-note-index.ts`
- Test: `tests/host/investigation-notes.test.ts` (new), `tests/host/investigation-note-index.test.ts` (new)

**Interfaces:**
- Consumes: `createFakeVault` (Task 7), `createFakeInvestigationFolders` (Task 8), `createFakeProfileStoreHarness`, `createFixedClock`; `validateNoteFolder`, `validateNoteName`, `freeNoteName`, `defaultNoteFolder` (Task 2); `noteFrontmatter`, `NoteIdentity`, `isEvidenceBlock`, `spliceEvidenceBlock` (Task 3); `joinRootPath`, `relativeInside` (Task 4); `applyNoteEvent`, `noteIndexFor`, `readNoteFrontmatter`, `NoteIndex` (Task 5); `InvestigationFolderStore` (Task 8); `ProfileStore`, `Clock`, `normalizeExclusion`, `isPlainObject`; Obsidian `App`, `TFile`, `TFolder`, `FileSystemAdapter`, `EventRef`, `stringifyYaml`.
- Produces:
  ```ts
  // ports/investigation-notes-port.ts
  export interface NoteDestination { readonly folder: string; readonly isDefault: boolean }
  export type DestinationPlan =
    | { readonly status: 'ok'; readonly folder: string; readonly fileName: string; readonly path: string; readonly renamed: boolean;
        readonly overlapsRoot: boolean; readonly rootRelativeFolder: string | null }
    | { readonly status: 'invalid-folder'; readonly problem: NoteFolderProblem }
    | { readonly status: 'invalid-name'; readonly problem: NoteNameProblem }
    | { readonly status: 'folder-is-file' }
    | { readonly status: 'no-free-name' };
  export interface CreateNoteRequest {
    readonly identity: NoteIdentity; readonly folder: string; readonly baseName: string; readonly body: string;
    readonly excludeFolder: boolean; readonly rootPath: string | null;
  }
  export type CreateNoteResult =
    | { readonly status: 'created'; readonly path: string; readonly exclusion: 'added' | 'already' | 'not-requested' | 'failed' }
    | { readonly status: 'refused'; readonly reason: 'invalid' | 'exists' | 'write-failed' };
  export interface RefreshNoteRequest {
    readonly path: string; readonly codebaseId: string; readonly block: string; readonly snapshotId: string; readonly sourcePath: string;
  }
  export type RefreshNoteResult = 'refreshed' | 'markers-edited' | 'missing' | 'not-linked' | 'write-failed';
  export interface InvestigationNotesPort {
    destination(codebaseId: string): Promise<NoteDestination>;
    plan(folder: string, baseName: string, rootPath: string | null): DestinationPlan;
    list(codebaseId: string): NoteIndex;
    create(request: CreateNoteRequest): Promise<CreateNoteResult>;
    refresh(request: RefreshNoteRequest): Promise<RefreshNoteResult>;
    open(path: string): Promise<boolean>;
    sourceNotePath(rootPath: string, relativePath: string): string | null;   // IN12
    subscribe(listener: () => void): () => void;
  }
  // host/investigation-note-index.ts
  export interface NoteIndexSource { list(codebaseId: string): NoteIndex; subscribe(listener: () => void): () => void }
  export function createNoteIndexSource(app: App, registerEvent: (ref: EventRef) => void): NoteIndexSource;
  // host/investigation-notes.ts
  export interface InvestigationNotesDeps {
    readonly folders: InvestigationFolderStore; readonly profiles: ProfileStore; readonly clock: Clock;
    readonly registerEvent: (ref: EventRef) => void;
  }
  export function createInvestigationNotes(app: App, deps: InvestigationNotesDeps): InvestigationNotesPort;
  ```

- [ ] **Step 1: Write the failing tests.** `tests/host/investigation-notes.test.ts` (node project; `createFakeVault({ basePath: '/vault' })`, a fake profile store holding `{ profileId: 'p1', name: 'Alpha', exclusions: ['.git'], … }`):
  - **Plan:** `plan('Notes', 'UN-1 x', null)` → `ok` with `path: 'Notes/UN-1 x.md'`, `renamed: false`; with `Notes/UN-1 x.md` present → `UN-1 x (2).md`, `renamed: true`; **case-only collision** (`notes/un-1 x.md` present, with a folder `notes`) → the folder resolves to the existing `notes` and the name to `UN-1 x (2).md`; **folder is a file** (`Notes` is a file) → `folder-is-file`; `'../x'` → `invalid-folder`/`not-relative`; `'a#b'` as name → `invalid-name`; 99 taken → `no-free-name`.
  - **Overlap (IN29):** root `/vault/code`, folder `code/notes` → `overlapsRoot: true`, `rootRelativeFolder: 'notes'`; folder `Notes` → false; root `/vault` with folder `Notes` → true, `'Notes'`; folder equal to the root (`code`, root `/vault/code`) → true with `rootRelativeFolder: null`; a mobile vault (`basePath: null`) → false; a Windows root `C:\\v\\code` with base `C:\\v` → `'notes'`.
  - **Create (IN27, IN28):** folders `a`, `a/b` are created in that order (the fake refuses the other order), the text starts with `---\n`, `parseYaml` of the frontmatter equals `noteFrontmatter(identity, clock.nowIso())`, the body follows the closing `---\n` and a blank line, and `list('p1')` links it; nothing is written before `create` is called (count `calls.create`/`createFolder` after `plan`).
  - **Race:** `raceNextCreate(path, 'theirs')` → `refused`/`exists`, and `text(path)` is `'theirs'`; a request whose re-plan renames → `refused`/`exists`, nothing written.
  - **Exclusion (IN29):** requested and overlapping → the profile gains `notes` (`added`); `notes` or a parent already excluded → `already`, the profile unchanged; not requested → `not-requested`; the profile removed meanwhile → `failed`, and the note still exists.
  - **Refresh (IN31, IN32):** after the user adds a key `reviewer: me`, sets `status: done`, and writes under "Investigation notes", a refresh with a new block and `snapshotId: 's2'` returns `refreshed`; the text outside the block after the frontmatter is byte-identical; the frontmatter has `snapshot_id: 's2'`, and `reviewer`, `status` and `created` keep their values (IP8); edited markers → `markers-edited` and the whole text byte-identical; a missing path → `missing`; a note of another codebase or with its type removed → `not-linked`; a `block` that is not `isEvidenceBlock` → `write-failed` with nothing written.
  - **Open (IN30):** `open(path)` → true and `opened` holds the path; a missing path → false.
  - **Destination (IN18):** no stored folder → `{ folder: 'Codebase investigations/Alpha', isDefault: true }`; a stored folder wins; an unknown profile → `Codebase investigations`.
  - **sourceNotePath (IN12):** root `/vault/docs` and `guide.md` present in the vault → `'docs/guide.md'`; `a.ts` → null; a root outside `/vault` → null; a mobile vault → null; a `.md` not in the vault's file list → null.

  `tests/host/investigation-note-index.test.ts`:
  - building the source calls no vault or metadata API (`calls.getMarkdownFiles === 0`, no listener registered) until the first `list` or `subscribe`;
  - **rename and duplicate:** a second note with the same fingerprint lists both; `userRename` moves the link; `userDelete` drops it; a listener fires once per change and not for an unrelated Markdown file; `resolve()` with nothing changed fires nothing;
  - `registerEvent` receives exactly four refs on first use.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement `investigation-note-index.ts`.**
  ```ts
  // WP-04 IN33 (IP13): the host's note index. Nothing is read until the first list or
  // subscribe (onload registers only, spec 4.4). 'changed', 'rename' and 'delete' update one
  // entry; 'resolved' rebuilds from the whole cache. Listeners hear only real changes.
  export function createNoteIndexSource(app: App, registerEvent: (ref: EventRef) => void): NoteIndexSource {
    let records: NoteRecords = new Map();
    let started = false;
    const listeners = new Set<() => void>();
    const frontmatterOf = (file: TFile): unknown => app.metadataCache.getFileCache(file)?.frontmatter;
    const everyFile = (): NoteEvent => ({ kind: 'reset', files: app.vault.getMarkdownFiles().map((f) => ({ path: f.path, frontmatter: frontmatterOf(f) })) });
    const apply = (event: NoteEvent): void => {
      const next = applyNoteEvent(records, event);
      if (next === records) return;
      records = next;
      for (const listener of Array.from(listeners)) listener();
    };
    function start(): void {
      if (started) return;
      started = true;
      records = applyNoteEvent(records, everyFile());
      registerEvent(app.metadataCache.on('changed', (file, _data, cache) => { apply({ kind: 'changed', path: file.path, frontmatter: cache.frontmatter }); }));
      registerEvent(app.metadataCache.on('resolved', () => { apply(everyFile()); }));
      registerEvent(app.vault.on('rename', (file, oldPath) => {
        apply(file instanceof TFile && file.extension === 'md'
          ? { kind: 'renamed', oldPath, path: file.path, frontmatter: frontmatterOf(file) }
          : { kind: 'deleted', path: oldPath });
      }));
      registerEvent(app.vault.on('delete', (file) => { apply({ kind: 'deleted', path: file.path }); }));
    }
    let memo: { records: NoteRecords; codebaseId: string; index: NoteIndex } | null = null;
    return {
      list: (codebaseId) => {
        start();
        if (memo === null || memo.records !== records || memo.codebaseId !== codebaseId) memo = { records, codebaseId, index: noteIndexFor(records, codebaseId) };
        return memo.index;
      },
      subscribe: (listener) => { start(); listeners.add(listener); return () => { listeners.delete(listener); }; },
    };
  }
  ```
- [ ] **Step 4: Implement `investigation-notes.ts`.** The non-obvious parts:
  - `vaultBase()` is `app.vault.adapter instanceof FileSystemAdapter ? app.vault.adapter.getBasePath() : null`.
  - `canonicalFolder(folder)` walks the segments from the vault root and, where a child folder matches a segment case-insensitively, uses that child's own name (IP9); where a segment is a `TFile` the plan is `folder-is-file`.
  - A name is taken when `getAbstractFileByPath(\`${folder}/${name}\`) !== null` **or** the canonical folder has a child whose name lower-cases to the same string.
  - `plan` = folder check (`validateNoteFolder(folder, app.vault.configDir)`), name check (`validateNoteName`), `canonicalFolder`, `freeNoteName`, then the overlap `relativeInside(rootPath, joinRootPath(base, folder))` (`''` → `overlapsRoot: true, rootRelativeFolder: null`).
  - `create`:
    ```ts
    async create(request: CreateNoteRequest): Promise<CreateNoteResult> {
      const plan = this.plan(request.folder, request.baseName, request.rootPath);
      if (plan.status !== 'ok') return { status: 'refused', reason: 'invalid' };
      if (plan.renamed || !isEvidenceBlockBody(request.body)) return { status: 'refused', reason: plan.renamed ? 'exists' : 'invalid' };
      const text = `---\n${stringifyYaml(noteFrontmatter(request.identity, deps.clock.nowIso()))}---\n\n${request.body}`;
      try {
        await ensureFolders(app, plan.folder);                 // one createFolder per missing segment, root first (IN28)
        await app.vault.create(plan.path, text);               // never overwrites (IN27)
      } catch {
        return { status: 'refused', reason: app.vault.getAbstractFileByPath(plan.path) === null ? 'write-failed' : 'exists' };
      }
      const exclusion = request.excludeFolder && plan.overlapsRoot && plan.rootRelativeFolder !== null
        ? await addExclusion(deps.profiles, request.identity.codebaseId, plan.rootRelativeFolder)
        : 'not-requested';
      return { status: 'created', path: plan.path, exclusion };
    }
    ```
    `isEvidenceBlockBody(body)` checks that the body holds exactly one begin and one end marker line, begin first (reuse `spliceEvidenceBlock(body, '')`'s `ok`). `addExclusion`:
    ```ts
    async function addExclusion(profiles: ProfileStore, profileId: string, folder: string): Promise<'added' | 'already' | 'failed'> {
      let exclusion: string;
      try { exclusion = normalizeExclusion(folder); } catch { return 'failed'; }
      let outcome: 'added' | 'already' | 'failed' = 'failed';   // stays 'failed' if the profile is gone (update never calls mutate)
      try {
        await profiles.update(profileId, (p) => {
          if (p.exclusions.some((e) => exclusion === e || exclusion.startsWith(`${e}/`))) { outcome = 'already'; return p; }
          outcome = 'added';
          return { ...p, exclusions: [...p.exclusions, exclusion] };
        });
      } catch { return 'failed'; }
      return outcome;
    }
    ```
  - `refresh`:
    ```ts
    async refresh(request: RefreshNoteRequest): Promise<RefreshNoteResult> {
      if (!isEvidenceBlock(request.block)) return 'write-failed';
      const file = app.vault.getFileByPath(request.path);
      if (file === null) return 'missing';
      const record = readNoteFrontmatter(file.path, app.metadataCache.getFileCache(file)?.frontmatter);
      if (record?.kind !== 'linked' || record.link.codebaseId !== request.codebaseId) return 'not-linked';
      let refused = false;
      try {
        await app.vault.process(file, (data) => {
          const spliced = spliceEvidenceBlock(data, request.block);
          if (spliced.ok) return spliced.text;
          refused = true;
          return data;
        });
        if (refused) return 'markers-edited';
        await app.fileManager.processFrontMatter(file, (frontmatter: unknown) => {
          if (!isPlainObject(frontmatter)) return;
          frontmatter.snapshot_id = request.snapshotId;
          frontmatter.source_path = request.sourcePath;
        });
      } catch { return 'write-failed'; }
      return 'refreshed';
    }
    ```
  - `destination(codebaseId)` reads the folder store, then the profile's name through `profiles.get` for the default; `open(path)` is `getFileByPath` then `app.workspace.getLeaf(true).openFile(file)`; `sourceNotePath` returns the vault-relative path only for a `.md` path inside `vaultBase()` that `getFileByPath` finds.
  - `list` and `subscribe` delegate to one `createNoteIndexSource(app, deps.registerEvent)`, built in the factory but inert until used.
- [ ] **Step 5: Run.** `npx vitest run tests/host/investigation-notes.test.ts tests/host/investigation-note-index.test.ts tests/host/clean-vault-install.test.ts tests/unit/no-process-execution.test.ts` gives PASS.
- [ ] **Step 6: Gate and commit** (`feat(host): InvestigationNotesPort — plan, create, refresh, open and the live note index (WP-04 IN26–IN33)`).

### Task 10: Wiring the ports into each leaf, and the folder on the Settings screen

**Files:**
- Create: `src/host/investigation-services.ts`, `tests/fixtures/fake-investigation.ts`
- Modify: `src/host/city-scan-controller.ts` (`CityViewDeps` gains two fields), `src/host/data-ports.ts` (wire and unwire), `src/main.ts` (build the services once), `src/ui/stores/investigation-store.ts` (ports, notes, destination, preview), `src/ui/screens/settings/PrivacyRows.vue` (a read-only row), `src/ui/audit-copy/investigation.ts`, `tests/fixtures/data-port-deps.ts` (two inert ports)
- Test: `tests/host/investigation-ports.test.ts` (new), `tests/unit/investigation-store-ports.test.ts` (new), `tests/component/settings-notes-folder-row.test.ts` (new)

**Interfaces:**
- Consumes: `createInvestigationNotes` (Task 9), `createSourcePreview`, `PreviewRequest`, `PreviewResult` (Task 4), `createPluginDataInvestigationStore` (Task 8), `createNodeSourceFileSystem`, `ProfileStore`, `LocalBindingStore`, `EMPTY_NOTE_INDEX`.
- Produces:
  ```ts
  // host/investigation-services.ts
  export interface InvestigationServices { readonly notes: InvestigationNotesPort; readonly preview: SourcePreview }
  export function createInvestigationServices(plugin: Plugin, deps: {
    readonly profileStore: ProfileStore; readonly bindingStore: LocalBindingStore;
    readonly folders: InvestigationFolderStore; readonly clock: Clock;
  }): InvestigationServices;
  // CityViewDeps gains
  investigationNotes: InvestigationNotesPort;
  sourcePreview: SourcePreview;
  // investigation-store.ts gains
  export type PreviewState =
    | { readonly status: 'idle' }
    | { readonly status: 'loading'; readonly fingerprint: string }
    | { readonly status: 'ready'; readonly fingerprint: string; readonly result: PreviewResult };
  //   notes: ShallowRef<NoteIndex>; destination: Ref<NoteDestination | null>; preview: ShallowRef<PreviewState>;
  //   setPorts: (notes: InvestigationNotesPort, preview: SourcePreview) => void;
  //   readPreview: (fingerprint: string, request: PreviewRequest) => Promise<void>;   // IN13: a newer call wins
  //   plan: (folder: string, baseName: string, rootPath: string | null) => DestinationPlan | null;
  //   create: (request: CreateNoteRequest) => Promise<CreateNoteResult | null>;
  //   refresh: (request: RefreshNoteRequest) => Promise<RefreshNoteResult | null>;
  //   openNote: (path: string) => Promise<boolean>;
  //   sourceNotePath: (rootPath: string, relativePath: string) => string | null;
  // tests/fixtures/fake-investigation.ts
  export function inertInvestigationNotes(): InvestigationNotesPort;     // lists nothing, writes nothing
  export function scriptedSourcePreview(): SourcePreview & {
    readonly requests: PreviewRequest[]; resolveNext(result: PreviewResult): void;   // reads wait until resolved
  };
  // audit-copy/investigation.ts
  export const NOTES_FOLDER_ROW_TITLE = 'Investigation notes folder';
  export const NOTES_FOLDER_ROW_TEXT = 'New investigation notes for this codebase go here. Change it in Obsidian’s settings for this plugin.';
  export const NOTES_FOLDER_ROW_DEFAULT = '(default)';
  export const NOTES_FOLDER_ROW_NO_CODEBASE = 'Open a codebase to see its notes folder.';
  ```

- [ ] **Step 1: Write the failing tests.**
  - `tests/host/investigation-ports.test.ts` (as `tests/host/analysis-ports.test.ts`): `wireDataPorts` gives the store both ports before mount; `unwireDataPorts` disposes the store, and a later port change reaches no listener.
  - `tests/unit/investigation-store-ports.test.ts` (a real notes port over `createFakeVault`, bound through `useEvidenceStore().bindRepository('p1')`):
    - binding loads `notes` and `destination`; a note created through the port shows in `notes` without any call from the test; binding `'p2'` swaps both and drops the old subscription;
    - **IN13:** `readPreview('a', r1)` then `readPreview('b', r2)`; resolving r2 first and r1 second leaves `preview` at `b`'s result; `requests.length` is 2;
    - `open(other)` resets `preview` to `idle`, and a read that resolves after the reset is ignored;
    - with no ports set, `create`, `refresh` and `plan` return null and `openNote` false.
  - `tests/component/settings-notes-folder-row.test.ts`: `PrivacyRows` shows the folder and `(default)` for a bound codebase, the stored folder without it, and `NOTES_FOLDER_ROW_NO_CODEBASE` when unbound.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
  - `investigation-services.ts`:
    ```ts
    // WP-04: the investigation services, built once in onload and inert until a leaf uses them.
    // The preview's root comes from the codebase's LIVE binding on this device (IP14); the
    // filesystem is built per read and is null where there is no Node filesystem.
    function nodeFilesystem(): SourceFileSystemPort | null {
      try { return createNodeSourceFileSystem(); } catch { return null; }
    }

    export function createInvestigationServices(plugin: Plugin, deps: InvestigationServiceDeps): InvestigationServices {
      const resolveRoot = async (codebaseId: string): Promise<string | null> => {
        const profile = await deps.profileStore.get(codebaseId);
        if (!profile?.bindingId) return null;
        return (await deps.bindingStore.get(profile.bindingId))?.rootPath ?? null;
      };
      return {
        notes: createInvestigationNotes(plugin.app, {
          folders: deps.folders, profiles: deps.profileStore, clock: deps.clock,
          registerEvent: (ref) => { plugin.registerEvent(ref); },
        }),
        preview: createSourcePreview({ getFilesystem: nodeFilesystem, resolveRoot, clock: deps.clock }),
      };
    }
    ```
  - `main.ts` builds the folder store (already built in Task 8) and the services once, and passes `investigationNotes` and `sourcePreview` in the `CityView` deps literal. `data-ports.ts`: `useInvestigationStore(pinia).setPorts(deps.investigationNotes, deps.sourcePreview)` in `wireDataPorts`; `useInvestigationStore(pinia).$dispose()` in `unwireDataPorts`.
  - The store: `setPorts` stores both and rebinds; a `watch(() => evidence.repositoryId, …, { immediate: true, flush: 'sync' })` resets selection and preview, unsubscribes, and for a non-empty id sets `notes = port.list(id)`, subscribes (`() => { notes.value = port.list(id); }`) and loads `destination` (ignoring a result for a codebase no longer bound); `onScopeDispose` unsubscribes. `readPreview` uses a token:
    ```ts
    let previewToken = 0;
    const readPreview = async (fingerprint: string, request: PreviewRequest): Promise<void> => {
      if (sourcePreview === null) return;
      previewToken += 1;
      const token = previewToken;
      preview.value = { status: 'loading', fingerprint };
      const result = await sourcePreview.read(request).catch((): PreviewResult => ({ status: 'unavailable', reason: 'read-error' }));
      if (token === previewToken) preview.value = { status: 'ready', fingerprint, result };
    };
    ```
    `open` and `markGone` (Task 1) also bump `previewToken` and set `preview` to `idle`.
  - `tests/fixtures/data-port-deps.ts` adds `investigationNotes: inertInvestigationNotes()` and `sourcePreview: scriptedSourcePreview()` (and widens its `Pick`), so all 16 files that spread it type-check unchanged.
- [ ] **Step 4: Run.** `npx vitest run tests/host/investigation-ports.test.ts tests/unit/investigation-store-ports.test.ts tests/component/settings-notes-folder-row.test.ts tests/host/analysis-ports.test.ts tests/host/evidence-ports.test.ts tests/host/city-view-evidence.test.ts tests/host/plugin-onload.test.ts tests/component/settings-privacy-storage.test.ts tests/component/settings-screen.test.ts` gives PASS. Then `npm run analyze` (baseline 9).
- [ ] **Step 5: Gate and commit** (`feat(host): wire the notes port and source preview into each leaf, and show the folder in Settings (WP-04 IN7, IN18)`).

### Task 11: The Investigate screen — list, filters, evidence and Add work item

**Files:**
- Create: `src/ui/screens/investigate/InvestigationFilters.vue`, `InvestigationList.vue`, `EvidencePanel.vue`, `UncertaintyPanel.vue`
- Modify: `src/ui/screens/InvestigateScreen.vue` (layout, filter, selection, gone watcher on the investigation model, Add work item), `src/ui/screens/workbench/WorkItemEditor.vue` (an optional `draft` prop, IP22), `src/ui/audit-copy/investigation.ts`, `src/ui/styles/screens-act.css`
- Test: `tests/component/investigate-screen.test.ts` (new), `tests/component/investigate-evidence.test.ts` (new), `tests/component/work-item-editor-draft.test.ts` (new)

**Interfaces:**
- Consumes: `useReadModels().investigation`, `files`; `filterInvestigation`, `DEFAULT_INVESTIGATION_FILTER`, `evidenceBundleFor`, `uncertaintiesFor`, `checklistFor` (Task 6); `useInvestigationStore` (Tasks 1, 10); `useRovingIndex`; `useReviewStore().workItemsForFile`, `hasWorkItemFor`; `FindingReviewDialog` (for Review finding); `WorkItemEditor`; kit `Panel`, `Callout`, `EvidenceBadge`, `ProvenanceBadge`.
- Produces:
  ```ts
  // InvestigationList.vue
  defineProps<{ rows: readonly InvestigationRow[]; limit: number; selected: string | null }>();
  defineEmits<{ select: [fingerprint: string]; more: [] }>();
  // InvestigationFilters.vue — v-model:filter (InvestigationFilter), props rules/severities, emits reset
  // EvidencePanel.vue
  defineProps<{ row: InvestigationRow; bundle: EvidenceBundle }>();
  defineEmits<{ review: []; openFile: []; addWorkItem: [] }>();
  // UncertaintyPanel.vue
  defineProps<{ uncertainties: readonly string[]; checklist: readonly string[] }>();
  // WorkItemEditor.vue gains: draft?: { title: string; notes: string } | null   (create mode only)
  // audit-copy/investigation.ts
  export const INVESTIGATE_LIST_TITLE = 'Findings to investigate';
  export const INVESTIGATE_LIST_LABEL = 'Findings, most severe first';
  export const INVESTIGATE_FILTER_RULE = 'Rule'; export const INVESTIGATE_ALL_RULES = 'All rules';
  export const INVESTIGATE_FILTER_NOTE = 'Note'; export const INVESTIGATE_NOTE_ALL = 'With or without a note';
  export const INVESTIGATE_NOTE_WITH = 'Has a note'; export const INVESTIGATE_NOTE_WITHOUT = 'No note';
  export const INVESTIGATE_COUNTS: (rows: number, withNotes: number, orphans: number, malformed: number) => string;
  export const INVESTIGATE_NONE_SELECTED = 'Select a finding to see its evidence.';
  export const INVESTIGATE_NOTES_CHIP: (n: number) => string;   // "1 note", "2 notes"
  export const INVESTIGATE_EVIDENCE_TITLE = 'Evidence';
  export const INVESTIGATE_UNCERTAINTY_TITLE = 'What this evidence cannot tell you';
  export const INVESTIGATE_CHECKLIST_TITLE = 'Suggested checks';
  export const INVESTIGATE_CHECKLIST_HINT = 'These seed a new note’s checklist. After that they are yours to edit.';
  export const INVESTIGATE_WORK_TITLE: (findingId: string, fileName: string) => string;   // `Investigate ${id} in ${file}`
  export const INVESTIGATE_WORK_NOTES: (kind: string, rule: string, path: string, line: string) => string;   // plain text, no link
  // plus the evidence row labels: INVESTIGATE_ROW_ORIGIN, _ANALYSED, _SNAPSHOT, _STATE, _DISPOSITION, _WORK_ITEMS
  ```

- [ ] **Step 1: Write the failing tests.** Mount `InvestigateScreen` with a Pinia, `setCity(snapshot, computeLayout(snapshot))`, the evidence attached through the real parser, `useInvestigationStore().setPorts(inertInvestigationNotes(), scriptedSourcePreview())`, and a review repository (`createInMemoryReviewRepository()`) so Add work item can save.
  - `tests/component/investigate-screen.test.ts`:
    - rows render in IN3 order with severity chip, kind label, title, `path · Line N`, status chip and a notes chip; with 150 findings, 100 rows and a Show more button (the Quality page size);
    - **keyboard (IP18):** exactly one row has `tabindex="0"`; ArrowDown moves focus and does **not** change `selectedFingerprint`; Enter selects; Home/End jump; the selected row has `aria-current="true"`;
    - filters: type, rule, severity, status and note each narrow the rows; Reset restores; **an entry selection the filter hides** (store `open` of an acknowledged finding while status is `open`) resets the filter so the selected row is listed (IP19);
    - the gone watcher now reads `investigation.byFingerprint` and still passes Task 1's gone cases (re-run `tests/component/investigate-route.test.ts`);
    - no row renders a report value as markup: a symbol `<img src=x onerror=alert(1)>` (via `syntheticFallowJson`'s `symbol` option) shows as text and the screen holds no `img`.
  - `tests/component/investigate-evidence.test.ts`:
    - **IN14:** the evidence panel shows the finding id, `RULE_TEXT(rule)`, the rule detail (`FINDING_DIALOG_RULE_VALUE`), severity text, anchor path and line, provider `fallow 3.27.0`, origin and analysed time, snapshot id, state, the review disposition and its reason, and the file's work items; for the relations cycle, "Also involves", the cycle path and `RELATIONS_SCOPE_NOTE`;
    - a stale report shows the stale `ProvenanceBadge` and `UNCERTAINTY_REPORT_STALE`;
    - **IN15/IN16:** the uncertainty list is `uncertaintiesFor(...)` in order (with `UNCERTAINTY_LINE_NOT_CHECKED` before any preview) and the checklist is `checklistFor(kind)`;
    - **IN17:** Add work item opens `WorkItemEditor` with the title `INVESTIGATE_WORK_TITLE(id, file.name)` and notes `INVESTIGATE_WORK_NOTES(...)`; the notes contain no `[[`, `](` or `://`; saving adds one work item on the anchor file; with a refactor item already on the file the button reads In refactor plan and is `aria-disabled` with a guarded handler (E40);
    - Review finding opens `FindingReviewDialog` on the fingerprint; Open file detail selects the anchor and navigates to `file`; neither moves the camera (no renderer call; there is no renderer).
  - `tests/component/work-item-editor-draft.test.ts`: create mode with `draft` pre-fills title and notes; without `draft` it keeps `WORK_ITEM_TITLE(name)` and empty notes; edit mode ignores `draft`.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
  - `InvestigationList.vue` follows `CodebaseFileList.vue`'s keyboard model (native row buttons, one roving tab stop, focus never selects, Enter or click activates) with `useRovingIndex({ count, selectedIndex, focusAt, activate })`. The `<ul>` has `aria-label="INVESTIGATE_LIST_LABEL"`; each `<li>` holds one `<button type="button" class="ci-investigate-row">` whose content is `<span>`s only (E20), with `aria-current="true"` on the selected row.
  - `InvestigateScreen.vue` holds `filter` (a `ref<InvestigationFilter>`), `shown` (`FINDINGS_PAGE`), the selected row and bundle computeds, and these watchers: the gone watcher (Task 1, now over `investigation.byFingerprint`), and the filter reset:
    ```ts
    watch(() => investigation.selectedFingerprint, (fp) => {
      if (fp === null || rows.value.some((r) => r.fingerprint === fp)) return;
      if (model.value.byFingerprint.has(fp)) filter.value = { ...DEFAULT_INVESTIGATION_FILTER };
    });
    ```
    Layout: a two-column grid at ≥ 820 px leaf width (list left, detail right) and one column below, using the container query the other screens use (`screens-act.css`). The detail column holds `EvidencePanel` and `UncertaintyPanel`; Tasks 12–14 add three more panels below them.
  - `WorkItemEditor.vue`: `const props = defineProps<{ itemId: string | null; newFile: FileSummary | null; draft?: { title: string; notes: string } | null }>();` then `title` starts from `start?.title ?? props.draft?.title ?? (props.newFile ? WORK_ITEM_TITLE(props.newFile.name) : '')` and `notes` from `start?.notes ?? props.draft?.notes ?? ''` (two lines changed, one added).
- [ ] **Step 4: Run.** `npx vitest run tests/component/investigate-screen.test.ts tests/component/investigate-evidence.test.ts tests/component/work-item-editor-draft.test.ts tests/component/investigate-route.test.ts tests/component/workbench-screen.test.ts tests/component/work-editor-focus.test.ts tests/component/workbench-guards.test.ts` gives PASS (the last three are the existing `WorkItemEditor` tests).
- [ ] **Step 4a: Extend the native smoke (IN51 a).** Add to `tests/e2e/smoke.e2e.ts` a second test, `'renders the Investigate route in a real leaf'`: open the city, `inspector.navigate('Investigate')`, then `expect.poll` until `inspector.screen('investigate')` is displayed, showing `.ci-no-snapshot` (the session has no scan), and with the nav's Act group reading Investigate, Refactor workbench, Audit report in that order. Add the title to `tests/e2e/required-scenarios.json` (9 titles). Run `npm run test:e2e`: the gate prints 9 of 9. RED proof: navigate to `'Investigat'` (no such item) and watch the poll fail; revert. (If Task 0 stopped under IN50, skip this step and record that it was skipped.)
- [ ] **Step 5: Gate and commit** (`feat(ui): the Investigate screen — finding list, filters, evidence and Add work item (WP-04 IN1–IN6, IN14–IN17, IN51)`). Add `tests/e2e/smoke.e2e.ts` and `tests/e2e/required-scenarios.json` to the commit.

### Task 12: The source preview panel and Open in Obsidian

**Files:**
- Create: `src/ui/screens/investigate/SourcePreviewPanel.vue`
- Modify: `src/ui/screens/InvestigateScreen.vue` (the read trigger and the panel), `src/ui/read-models/investigation-evidence.ts` (`previewRequestFor`, `locationInputsFor`), `src/ui/audit-copy/investigation.ts`, `src/ui/styles/screens-act.css`
- Test: `tests/component/investigate-preview.test.ts` (new)

**Interfaces:**
- Consumes: `scriptedSourcePreview` (Task 10), `locationVerdict`, `LocationVerdict` (Task 4), `useInvestigationStore().readPreview`, `preview`, `sourceNotePath`, `openNote`; `analysedAtOf` (Task 6); the snapshot's `byte-size` and `physical-lines` observations for the anchor entity.
- Produces:
  ```ts
  // investigation-evidence.ts
  export function previewRequestFor(row: InvestigationRow, snapshot: CodebaseSnapshot): PreviewRequest;
  //   codebaseId = snapshot.repositoryId, expectedRoot = snapshot.scope.rootPath, relativePath = row.anchorPath,
  //   maxFileBytes = snapshot.scope.maxFileBytes (IP14), line = row.line
  export function locationInputsFor(row: InvestigationRow, snapshot: CodebaseSnapshot, evidence: EvidenceIndex, text: PreviewText): LocationInputs;
  // SourcePreviewPanel.vue
  defineProps<{ row: InvestigationRow; state: PreviewState; verdict: LocationVerdict | null; notePath: string | null }>();
  defineEmits<{ reload: []; openInObsidian: [] }>();
  // audit-copy/investigation.ts
  export const PREVIEW_TITLE = 'Source at the reported line';
  export const PREVIEW_SUBTITLE = 'A read-only window of the file as it is now. Nothing is written.';
  export const PREVIEW_LOADING = 'Reading the file…';
  export const PREVIEW_READ_AT: (time: string) => string;      // "Read at <time>"
  export const PREVIEW_RELOAD = 'Reload';
  export const PREVIEW_OPEN_IN_OBSIDIAN = 'Open in Obsidian';
  export const PREVIEW_LINE_LABEL: (line: number) => string;   // "Reported line 42"
  export const PREVIEW_CUT = '…';
  export const PREVIEW_STALE_LOCATION: (check: LocationCheck | 'no-line', cause: 'changed' | 'unknown' | null, line: number | null) => string;
  export const PREVIEW_UNAVAILABLE: Readonly<Record<PreviewUnavailable, string>>;
  ```
  `PREVIEW_STALE_LOCATION` reuses `UNCERTAINTY_LINE_STALE`'s words (one sentence per check, IN10's example for `modified`/`changed`: "The file changed after the analysis. Line 42 may have moved."), and `no-line` reads "fallow reports no line for this finding, so the first 41 lines are shown." `PREVIEW_UNAVAILABLE`: no-binding "This codebase’s folder is not connected on this device, or it now points to another folder than the scan read."; no-filesystem "Source preview needs the desktop app’s file access."; outside-root "The file is not inside the codebase folder, or its path goes through a link. It was not read."; not-a-file "The path is not a regular file."; too-large "The file is larger than the preview limit, so it was not read."; binary "The file looks binary, so it is not shown."; not-utf8 "The file is not UTF-8 text, so it is not shown."; missing "The file is not there any more."; read-error "The file could not be read."

- [ ] **Step 1: Write the failing test** (`tests/component/investigate-preview.test.ts`, with `scriptedSourcePreview`, a snapshot from `buildSnapshotFixture` whose anchor observations are known, and the synthetic report):
  - **IN13:** mounting the screen and rendering the list reads nothing (`requests.length === 0`); selecting a row reads once, with `previewRequestFor(row, snapshot)`; selecting another before the first resolves and resolving both out of order shows only the second.
  - **IN10 exact:** a result whose `size`, `lineCount` and `mtimeMs` match the observations and the analysis time highlights the row's line: the line element has `aria-current="true"` and `PREVIEW_LINE_LABEL(line)`, and no stale callout shows. The `<pre>` element's `textContent`, split on `\n`, equals the result's lines (numbers aside).
  - **IN10 stale:** one case per failed check (size, lines, modified, line-range, and a stale report) shows no highlight and `PREVIEW_STALE_LOCATION(...)`; the uncertainty panel now shows the same verdict instead of `UNCERTAINTY_LINE_NOT_CHECKED`.
  - **IN9:** `it.each` over the nine `PreviewUnavailable` reasons shows `PREVIEW_UNAVAILABLE[reason]` and no `<pre>`.
  - **IN8:** a line `'a\\u0001b'` (the six-character escape the service produced) renders as that text; a cut line ends with `PREVIEW_CUT`; nothing in the panel is an `<a>` or has `v-html` output (the panel holds no element other than those the template names).
  - **IN11:** `PREVIEW_READ_AT(formatAbsoluteTime(readAt, Intl))` shows; Reload reads again (`requests.length` 2), and while loading the Reload button is `aria-disabled="true"` and a second press reads nothing more (E40).
  - **IN12:** Open in Obsidian shows only when the store's `sourceNotePath` gives a path (stub the port's method); pressing it calls `openNote(path)`; a `.ts` anchor never shows it.
- [ ] **Step 2: Run it to see it fail.**
- [ ] **Step 3: Implement.** The read trigger in `InvestigateScreen.vue` fires only on a selection change, never on list render or re-import (IN11, IN13):
  ```ts
  watch(() => investigation.selectedFingerprint, (fp) => {
    const row = fp === null ? null : model.value.byFingerprint.get(fp) ?? null;
    const snapshot = store.snapshot;
    if (row !== null && snapshot !== null) void investigation.readPreview(row.fingerprint, previewRequestFor(row, snapshot));
  }, { immediate: true });
  ```
  The verdict is `computed(() => (state is ready and ok and for the selected row) ? locationVerdict(locationInputsFor(row, snapshot, evidence, text)) : null)`, passed to the preview panel and to `uncertaintiesFor`. `locationInputsFor` takes `reportCurrent` from `evidence.state === 'current'`, the observations of the anchor entity (`measured` with a value, else null), `currentBytes: text.size`, `currentLines: text.lineCount`, `currentMtimeMs: text.mtimeMs`, `analysedAt: analysedAtOf(report)` and `line: row.line`. The panel renders the lines inside one `<pre class="ci-source-preview__text">` as `<span class="ci-source-preview__line">` elements with `display: block`, written with no whitespace between the tags so the `<pre>` holds no stray text nodes; the line number is a separate `aria-hidden` span, and the target line gets `aria-current="true"` plus the visually hidden `PREVIEW_LINE_LABEL`.
- [ ] **Step 4: Run.** `npx vitest run tests/component/investigate-preview.test.ts tests/component/investigate-evidence.test.ts tests/component/investigate-screen.test.ts` gives PASS.
- [ ] **Step 5: Gate and commit** (`feat(ui): the source preview panel with stale-location checks and Open in Obsidian (WP-04 IN7–IN13)`).

### Task 13: Create an investigation note, and the linked notes

**Files:**
- Create: `src/ui/screens/investigate/NotesPanel.vue`, `src/ui/screens/investigate/CreateNoteDialog.vue`
- Modify: `src/ui/screens/InvestigateScreen.vue` (the panel, the dialog, the body and identity, the announcement and focus), `src/ui/audit-copy/investigation.ts`, `src/ui/styles/screens-act.css`
- Test: `tests/component/investigate-create.test.ts` (new)

**Interfaces:**
- Consumes: `renderNoteBody`, `NOTE_VOCABULARY`, `noteBaseName`, `evidenceFactsFor`, `noteIdentityFor`, `checklistFor`, `uncertaintiesFor`, `FINDING_KIND_LABEL`; `useInvestigationStore().plan`, `create`, `openNote`, `destination`; `createInvestigationNotes` over `createFakeVault` with `createFakeProfileStoreHarness` (tests); `reannounce`, `CiDialog`, `useUniqueId`.
- Produces:
  ```ts
  // NotesPanel.vue
  defineProps<{ notes: readonly NoteLink[]; createBlocked: boolean }>();
  defineEmits<{ create: []; open: [path: string]; refresh: [link: NoteLink] }>();   // `refresh` is wired in Task 14
  // CreateNoteDialog.vue
  defineProps<{ defaultFolder: string; defaultName: string; rootPath: string | null; identity: NoteIdentity; body: string }>();
  defineEmits<{ close: []; created: [result: Extract<CreateNoteResult, { status: 'created' }>] }>();
  // audit-copy/investigation.ts
  export const NOTE_PANEL_TITLE = 'Investigation notes';
  export const NOTE_PANEL_NONE = 'No note for this finding yet.';
  export const NOTE_STATUS: (status: string | null) => string;   // "Status: <status>" or "No status"
  export const NOTE_OPEN = 'Open'; export const NOTE_OPEN_LABEL: (path: string) => string;
  export const NOTE_OPEN_FAILED = 'That note is not in the vault any more.';
  export const NOTE_CREATE_OPEN = 'Create investigation note…';
  export const NOTE_CREATE_TITLE = 'Create an investigation note';
  export const NOTE_CREATE_FOLDER = 'Folder'; export const NOTE_CREATE_NAME = 'File name'; export const NOTE_CREATE_PATH = 'The note will be written to';
  export const NOTE_CREATE_RENAMED: (fileName: string) => string;   // "A note with that name exists, so this one will be <fileName>."
  export const NOTE_NAME_PROBLEM: Readonly<Record<NoteNameProblem, string>>;
  export const NOTE_CREATE_FOLDER_IS_FILE = 'A file with that name is in the way of the folder.';
  export const NOTE_CREATE_NO_FREE_NAME = 'Names up to (99) are taken. Choose another file name.';
  export const NOTE_CREATE_OVERLAP = 'This folder is inside the codebase you scanned, so the note is written inside it.';
  export const NOTE_CREATE_EXCLUDE = 'Exclude this folder from scans of the codebase';
  export const NOTE_CREATE_ROOT_IS_FOLDER = 'This folder is the codebase folder itself. The note will appear in the next scan.';
  export const NOTE_CREATE_CONFIRM = 'Create note';
  export const NOTE_CREATE_REFUSED: Readonly<Record<'invalid' | 'exists' | 'write-failed', string>>;
  export const NOTE_CREATED: (path: string) => string;
  export const NOTE_CREATED_EXCLUDED: (path: string, folder: string) => string;
  export const NOTE_EXCLUSION_FAILED: (path: string) => string;   // created, but the exclusion was not saved
  ```

- [ ] **Step 1: Write the failing test** (`tests/component/investigate-create.test.ts`; a real notes port over `createFakeVault({ basePath: '/vault' })`, a profile store holding the snapshot's `repositoryId`, and the snapshot's `scope.rootPath` set per case):
  - **IN26:** the dialog opens with the folder `destination.folder` and the name `noteBaseName(id, kind label, file name)`, shows `NOTE_CREATE_PATH` with the full vault path, and writes nothing while open (`calls.create` and `calls.createFolder` stay 0 after typing into both fields).
  - **IN19 in the dialog:** typing `'../x'`, `'/abs'`, `'C:\\x'` or `'.obsidian/x'` shows the matching `NOTES_FOLDER_PROBLEM`; Create has `aria-disabled="true"`, and pressing it writes nothing (E40).
  - **IN27:** with `<folder>/<name>.md` present, the dialog shows `NOTE_CREATE_RENAMED('<name> (2).md')` and the path before confirm; confirming writes `<name> (2).md` and leaves the first file byte-identical.
  - **IN29:** with `rootPath: '/vault/code'` and the folder `code/notes`, `NOTE_CREATE_OVERLAP` shows with the checkbox checked; confirming adds `notes` to the profile's exclusions and announces `NOTE_CREATED_EXCLUDED`; unchecking it leaves the exclusions unchanged; with the folder `Notes` neither shows; with the folder equal to the root, `NOTE_CREATE_ROOT_IS_FOLDER` shows and no checkbox.
  - **Create (IN20, IN28):** one confirm writes exactly one file (`paths()` grows by one); its frontmatter parses to the IN20 keys with `finding_fingerprint === findingRef(row.fingerprint)`; the dialog closes, `NOTE_CREATED(path)` is announced once, the notes panel lists the note with `NOTE_STATUS('open')`, and focus is on its Open button.
  - **E40 and the race:** two presses of Create before the first resolves create one file; `raceNextCreate(path, 'theirs')` shows `NOTE_CREATE_REFUSED.exists` in the dialog's `role="alert"`, announces nothing, and `text(path)` stays `'theirs'`.
  - **IN30:** Open calls the port (`opened` holds the path); with two notes for one finding both are listed, by path, and each opens its own file.
- [ ] **Step 2: Run it to see it fail.**
- [ ] **Step 3: Implement.** In `InvestigateScreen.vue`:
  ```ts
  const noteBody = computed(() => {
    const row = selected.value;
    const bundle = selectedBundle.value;
    if (row === null || bundle === null) return '';
    return renderNoteBody(evidenceFactsFor(row, bundle, uncertainties.value), checklistFor(row.kind), NOTE_VOCABULARY);
  });
  async function onCreated(result: { path: string; exclusion: 'added' | 'already' | 'not-requested' | 'failed' }): Promise<void> {
    creating.value = false;
    const folder = result.path.slice(0, result.path.lastIndexOf('/'));
    await reannounce(liveMessage, result.exclusion === 'added' ? NOTE_CREATED_EXCLUDED(result.path, folder)
      : result.exclusion === 'failed' ? NOTE_EXCLUSION_FAILED(result.path) : NOTE_CREATED(result.path));
    await nextTick();
    const buttons = Array.from(root.value?.querySelectorAll<HTMLElement>('.ci-notes-panel__open') ?? []);
    buttons.find((b) => b.dataset.path === result.path)?.focus();
  }
  ```
  The dialog computes `plan = computed(() => investigation.plan(folder.value, name.value, props.rootPath))` on every keystroke (IN26), shows the plan's problem words or `NOTE_CREATE_PATH` + `plan.path`, and guards Create:
  ```ts
  const blocked = computed(() => busy.value || plan.value === null || plan.value.status !== 'ok');
  async function confirm(): Promise<void> {
    const p = plan.value;
    if (blocked.value || p === null || p.status !== 'ok') return;
    busy.value = true;
    error.value = '';
    try {
      const baseName = p.fileName.slice(0, -'.md'.length);
      const result = await investigation.create({ identity: props.identity, folder: p.folder, baseName, body: props.body,
        excludeFolder: exclude.value, rootPath: props.rootPath });
      if (result === null) return;
      if (result.status === 'created') emit('created', result); else error.value = NOTE_CREATE_REFUSED[result.reason];
    } finally {
      busy.value = false;
    }
  }
  ```
  Nothing is opened automatically after creating (IP24); the Open button is where focus lands.
- [ ] **Step 4: Run.** `npx vitest run tests/component/investigate-create.test.ts tests/component/investigate-screen.test.ts` gives PASS.
- [ ] **Step 5: Gate and commit** (`feat(ui): create an investigation note from the workbench and list linked notes (WP-04 IN26–IN30)`).

### Task 14: Refresh a note's evidence, and notes for findings not in this report

**Files:**
- Create: `src/ui/screens/investigate/RefreshNoteDialog.vue`, `src/ui/screens/investigate/OrphanNotesPanel.vue`
- Modify: `src/ui/screens/InvestigateScreen.vue`, `src/ui/screens/investigate/NotesPanel.vue` (a Refresh evidence button per note), `src/ui/read-models/investigation-evidence.ts` (`refreshChangesFor`), `src/ui/audit-copy/investigation.ts`
- Test: `tests/component/investigate-refresh.test.ts` (new)

**Interfaces:**
- Consumes: `renderEvidenceBlock`, `goneFactsFor`, `evidenceFactsFor`, `NOTE_VOCABULARY`; `useInvestigationStore().refresh`; `InvestigationModel.orphanNotes`, `malformedNotes`, `withNotes`.
- Produces:
  ```ts
  // investigation-evidence.ts
  export interface RefreshChanges {
    readonly snapshot: { readonly from: string; readonly to: string } | null;     // null when unchanged
    readonly sourcePath: { readonly from: string; readonly to: string } | null;
    readonly state: 'current' | 'stale' | 'not-reported';
    readonly line: number | null;
  }
  export function refreshChangesFor(link: NoteLink, row: InvestigationRow | null, evidence: EvidenceIndex, snapshotId: string): RefreshChanges;
  // RefreshNoteDialog.vue
  defineProps<{ link: NoteLink; changes: RefreshChanges; block: string; codebaseId: string; snapshotId: string }>();
  defineEmits<{ close: []; refreshed: [path: string] }>();
  // OrphanNotesPanel.vue
  defineProps<{ notes: readonly NoteLink[]; malformed: number }>();
  defineEmits<{ open: [path: string]; refresh: [link: NoteLink] }>();
  // audit-copy/investigation.ts
  export const REFRESH_OPEN = 'Refresh evidence…'; export const REFRESH_OPEN_LABEL: (path: string) => string;
  export const REFRESH_TITLE = 'Refresh the evidence in this note';
  export const REFRESH_EXPLAIN = 'Only the generated evidence block changes. Your sections and the note’s status stay as they are.';
  export const REFRESH_SNAPSHOT: (from: string, to: string) => string;
  export const REFRESH_SOURCE_PATH: (from: string, to: string) => string;
  export const REFRESH_STATE: Readonly<Record<'current' | 'stale' | 'not-reported', string>>;   // not-reported: "Not reported by the current analysis"
  export const REFRESH_LINE: (line: number | null) => string;
  export const REFRESH_CONFIRM = 'Refresh evidence';
  export const REFRESH_DONE: (path: string) => string;
  export const REFRESH_MARKERS_EDITED = 'The note’s evidence markers were edited, moved or removed, so nothing was changed. Restore exactly one begin and one end marker line, or start a new note.';
  export const REFRESH_FAILED: Readonly<Record<'missing' | 'not-linked' | 'write-failed', string>>;
  export const NOTES_ORPHAN_TITLE = 'Notes for findings not in this report';
  export const NOTES_ORPHAN_TEXT = 'A changed analysis is not a finished task: these notes keep their status. Refresh one to record that the current analysis does not report its finding.';
  export const NOTES_MALFORMED: (n: number) => string;   // "1 investigation note could not be read: its frontmatter was changed."
  ```

- [ ] **Step 1: Write the failing test** (`tests/component/investigate-refresh.test.ts`; notes created through the real port, then edited with `userWrite`):
  - **IN31:** after re-attaching the report to a new snapshot, the dialog lists `REFRESH_SNAPSHOT(old, new)`, the state and the line; confirm returns `refreshed`, closes, announces `REFRESH_DONE(path)`; the text after the end-marker line is byte-identical and the block holds the new snapshot id; Refresh evidence is `aria-disabled` while it runs (E40).
  - **Vanished and edited markers:** with the end marker deleted by `userWrite`, confirm shows `REFRESH_MARKERS_EDITED` in the dialog's alert, announces nothing, and the note text is byte-identical.
  - **IN32:** the user's `status: done` and an added `reviewer: me` survive a refresh (value-equal, IP8); `created` is unchanged.
  - **IN34 (notes for findings not in this report):** after attaching a report without the finding, the note moves to `OrphanNotesPanel` with its status; refreshing it writes `REFRESH_STATE['not-reported']`'s words (the vocabulary's `notReported`) into the block and leaves `status` unchanged; the list's `INVESTIGATE_COUNTS` counts it separately (IN36).
  - **IN36:** a note with `finding_id: 1` is counted by `NOTES_MALFORMED(1)` and linked nowhere; the Note filter `with-note` lists exactly the rows with a linked note.
  - **O6:** the note's status is shown beside the finding's review disposition; editing the status in the note updates the chip and leaves `useReviewStore().dispositions` unchanged.
- [ ] **Step 2: Run it to see it fail.**
- [ ] **Step 3: Implement.** The block for a linked row is `renderEvidenceBlock(evidenceFactsFor(row, bundle, uncertainties), NOTE_VOCABULARY)`; for an orphan it is `renderEvidenceBlock(goneFactsFor(link, evidence, snapshot.snapshotId), NOTE_VOCABULARY)`. The confirm sends `{ path: link.path, codebaseId, block, snapshotId, sourcePath: row?.anchorPath ?? link.sourcePath }` and maps `markers-edited`, `missing`, `not-linked` and `write-failed` to their words, leaving the dialog open. `OrphanNotesPanel` shows under the list whenever `orphanNotes.length > 0 || malformedNotes > 0`. `refreshChangesFor` compares the note's `snapshotId` and `sourcePath` with the current ones (the note stores no line or state, so those show as they are now; IP25).
- [ ] **Step 4: Run.** `npx vitest run tests/component/investigate-refresh.test.ts tests/component/investigate-create.test.ts` gives PASS.
- [ ] **Step 5: Gate and commit** (`feat(ui): refresh a note's evidence block and list notes for findings not in this report (WP-04 IN31–IN36)`).

### Task 15: The entry points — Quality, File detail, the city inspector and Architecture

**Files:**
- Create: `src/ui/screens/investigate/use-open-investigation.ts`, `src/ui/screens/city/CityFindingsPanel.vue`
- Modify: `src/ui/screens/quality/FindingReviewDialog.vue` (an Investigate button in the links row), `src/ui/screens/file/FileFindingsPanel.vue` (a sibling Investigate button per row, E20), `src/ui/screens/FileDetailScreen.vue` (handle it), `src/ui/components/FileInspector.vue` (+2 lines: the Findings section), `src/ui/screens/architecture/CycleList.vue`, `src/ui/screens/architecture/FallowBoundaryTable.vue`, `src/ui/screens/ArchitectureScreen.vue`, `src/ui/inspector-copy.ts` (`FILE_SOURCE_PREVIEW_LATER` in place, IN41, IP32), `src/ui/audit-copy/investigation.ts`, `src/ui/styles/kit.css`
- Test: `tests/component/investigate-entry-points.test.ts` (new), `tests/component/city-findings-panel.test.ts` (new); re-run `tests/component/quality-screen.test.ts`, `quality-dialog-status.test.ts`, `finding-review-ready.test.ts`, `file-detail-screen.test.ts`, `file-findings-fallow.test.ts`, `file-inspector.test.ts`, `architecture-cycles.test.ts`, `architecture-screen.test.ts`, `relation-duplicates.test.ts`

**Interfaces:**
- Consumes: `touchingFindings`, `useReadModels().evidence`, `files`; `useInvestigationStore().open`; `useCityStore().navigate`; `FINDING_KIND_LABEL`, `RULE_TEXT`, `FINDING_VIA_RELATED`.
- Produces:
  ```ts
  // use-open-investigation.ts
  export function useOpenInvestigation(): (fingerprint: string) => void;   // open(fingerprint), then navigate('investigate')
  // CityFindingsPanel.vue: no props; reads the city selection and the evidence index.
  // Its row limit, `const CITY_FINDINGS_LIMIT = 10`, stays module-private (an exported constant nobody imports is a dead export).
  // audit-copy/investigation.ts
  export const INVESTIGATE_ACTION = 'Investigate';
  export const INVESTIGATE_FINDING_LABEL: (findingId: string, path: string) => string;   // "Investigate UN-… in src/a.ts"
  export const CITY_FINDINGS_TITLE = 'Findings';
  export const CITY_FINDINGS_ROW: (kind: string, rule: string, line: number | null) => string;   // "Unused exports · Unused export · Line 4"
  export const CITY_FINDINGS_MORE: (n: number) => string;   // "3 more on Investigate"
  // inspector-copy.ts, in place
  export const FILE_SOURCE_PREVIEW_LATER = 'A read-only preview of this file is on Investigate, at a reported finding’s line.';
  ```

- [ ] **Step 1: Write the failing tests.**
  - `tests/component/city-findings-panel.test.ts` (mounted like `file-inspector.test.ts`, with a renderer double and clipboard):
    - no report → no Findings section; a report → the section lists the selected file's `touchingFindings`, anchored first then related, each `CITY_FINDINGS_ROW` with an Investigate button labelled `INVESTIGATE_FINDING_LABEL`; a related row also shows `FINDING_VIA_RELATED(anchorPath)`;
    - 13 findings → 10 rows and `CITY_FINDINGS_MORE(3)`;
    - the section never calls the renderer (no `focus`, `setSelection` or `setCamera` call).
  - `tests/component/investigate-entry-points.test.ts`:
    - **The acceptance (IN4, IN5):** a wrapper renders `FileInspector` and, when `city.route === 'investigate'`, `InvestigateScreen`, in one Pinia:
      ```ts
      const Shell = defineComponent({
        setup() {
          const city = useCityStore();
          return () => h('div', [h(FileInspector), city.route === 'investigate' ? h(InvestigateScreen) : null]);
        },
      });
      ```
      Select a file with an unused export, open the inspector, click its row's Investigate. Then `useCityStore().route` is `investigate`, `useInvestigationStore().selectedFingerprint` is that finding's fingerprint, and the evidence panel's text contains the finding id, `RULE_TEXT(rule)`, the anchor path and `Line N`. The renderer double saw no camera call.
    - Quality: the review dialog's Investigate opens the same fingerprint and navigates; the dialog is gone.
    - File detail: each finding row has a sibling `.ci-file-finding__investigate` (not inside `.ci-file-finding__review`); it opens the anchor-based fingerprint, also for a related row; the Review button still opens the dialog.
    - Architecture (relations recording, `attachRelationsReport`): a cycle row's and a fallow boundary row's Investigate open the finding's fingerprint; neither shows for a row with `fingerprint === null`.
    - File detail's source panel shows the new `FILE_SOURCE_PREVIEW_LATER`.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** Every entry point calls `useOpenInvestigation()(fingerprint)` (IN5). `FindingReviewDialog.vue` adds, after Open file detail: `<button type="button" class="ci-finding-dialog__investigate" @click="investigate">{{ INVESTIGATE_ACTION }}</button>` with `function investigate(): void { emit('close'); openInvestigation(props.fingerprint); }`. `FileFindingsPanel.vue` adds a second button in each `<li>`, after the review button, emitting `investigate` with the fingerprint; `FileDetailScreen.vue` passes it to `useOpenInvestigation()`. `CycleList.vue` and `FallowBoundaryTable.vue` emit `investigate` beside `review` (same `fingerprint !== null` guard); `ArchitectureScreen.vue` handles both with one function. `FileInspector.vue` renders `<CityFindingsPanel v-if="selectedEntity.kind === 'file'" />` before `CityRelationsPanel`.
- [ ] **Step 4: Run** the two new files and every re-run file listed under **Files**. PASS. Then `npm run analyze` (baseline 9).
- [ ] **Step 5: Gate and commit** (`feat(ui): Investigate entry points on Quality, File detail, the city inspector and Architecture (WP-04 IN5, IN41)`).

### Task 16: The end-to-end spine and the safety cases

**Files:**
- Create: `tests/acceptance/investigation-spine.test.ts`, `tests/acceptance/investigation-safety.test.ts`, `tests/e2e/investigation.e2e.ts` (the native spine, IN51 d)
- Modify: `tests/e2e/inspector.ts` (the spine's UI steps), `tests/e2e/required-scenarios.json` (the tenth title)
- Test: the two acceptance files (jsdom project: `tests/acceptance/**/*.test.ts`), and the native spine (`npm run test:e2e`)

**Interfaces:**
- Consumes: everything above; `RELATIONS_PROJECT_DIR`, `relationsRecordingJson`, `parseFallowReportText`, `buildEvidenceReport`, `collectInventory`, `createRealNodePort`, `createCancellationToken`, `hashTree`, `createFakeVault`, `createFakeInvestigationFolders`, `createFakeProfileStoreHarness`, `createInvestigationNotes`, `createSourcePreview`, `syntheticFallowJson`, `snapshotWithPaths`, `parseYaml`, `isEvidenceBlock`; for the native spine, Task 0's `test` fixture, `InspectorPage` and `writeEvidence`, and the UI's own classes (`.ci-investigate-row`, `.ci-source-preview__text`, `.ci-notes-panel__create`, `.ci-notes-panel__open`, `.ci-connect-fallow__file`, `.ci-connect-fallow__attach`) and the host modals the component tests drive (`tests/component/source-modal.test.ts`, `tests/component/consent-chain.test.ts`).
- Produces, in `tests/e2e/inspector.ts`:
  ```ts
  scanFolder(folder: string): Promise<void>;          // command `codebase-inspector:scan-codebase` → source modal, vault-folder mode → scope approval, as a user
  importReport(absolutePath: string): Promise<void>;  // Data & scans → import dialog → setValue on its file input → Attach
  selectFinding(findingId: string): Promise<void>;    // Investigate → the row whose text holds the id
  createNote(): Promise<string>;                      // Create investigation note… → Create note; returns the new note's vault path
  refreshNote(path: string): Promise<void>;           // Refresh evidence… → Refresh evidence
  readNote(path: string): Promise<string>;            // page.read(path)
  frontmatter(path: string): Promise<Record<string, unknown>>;   // the real parseYaml, as describe's helper
  cachedFingerprint(path: string): Promise<unknown>;  // app.metadataCache.getFileCache(file)?.frontmatter?.finding_fingerprint
  ```

- [ ] **Step 1: Write the spine** (`investigation-spine.test.ts`, IN38; each test `30_000` ms):
  - **Setup:** copy `RELATIONS_PROJECT_DIR` to a temp folder with `cpSync(…, { recursive: true })`; take `hashTree(root)`; scan it with `collectInventory(createRealNodePort(), { rootPath: root, exclusions: [], maxFileBytes: 1_000_000, followSymlinks: false }, approval('p1'), token, clock)`; read `relations-combined-3.27.0.json` through `parseFallowReportText` and `buildEvidenceReport({ …, stripPrefix: null, importedAt: new Date().toISOString(), snapshotId: snapshot.snapshotId })` (the recording's `src/…` paths match the scanned project, IP35); a fake vault on a **separate** temp base path; the real notes port (profile `p1` in `createFakeProfileStoreHarness`) and the real source preview (`getFilesystem: () => createRealNodePort()`, `resolveRoot: () => Promise.resolve(root)`). Mount `InvestigateScreen`.
  - **Finding → Investigate:** select the import-cycle row; the preview shows the anchor file's lines as read from disk (`readFileSync`), with the reported line highlighted exactly (sizes and line counts match the scan; mtimes precede the import).
  - **→ create:** create with the defaults; the vault holds exactly one new note; its frontmatter parses (`parseYaml`) to `finding_fingerprint === \`${anchorPath}#${id}\`` and `codebase_id === 'p1'`; the notes panel lists it.
  - **→ edit:** `userWrite` the note with text under "Investigation notes" and "Decision", `status: in progress` and a new key `reviewer: me` (rebuild the frontmatter with `parseYaml`/`stringifyYaml`); keep `human` = the text after the end-marker line.
  - **→ refresh with a new report:** rescan (a new snapshot id), re-attach the recording to it, open the same finding (same fingerprint), refresh through the dialog. The text after the end-marker line equals `human` byte for byte; the frontmatter has the new `snapshot_id`, `status: in progress`, `reviewer: me` and the old `created`; the block differs from the first and names the new snapshot.
  - **No source write:** `hashTree(root)` equals the first hash, and the vault holds only the note and its folders.
- [ ] **Step 2: Write the safety cases** (`investigation-safety.test.ts`, IN39):
  - **Injection (IN39: a symbol, a specifier, zone names and a file path; there is no message field):** let `H = '[[x]] ![[x]] <script>alert(1)</script> <!-- codebase-inspector:evidence:end --> #tag $x$ %%c%% ==x== https://x www.x ‮evil\n# h\n1) item'`. Over an 8-file snapshot, `JSON.parse(syntheticFallowJson(snapshot, { symbol: H }))`, then set `check.unresolved_imports[0].specifier = H` and `check.boundary_violations[0].from_zone = H`, re-serialise, and read it through `parseFallowReportText` and `buildEvidenceReport`. Create a note for each of the three findings (the unused export, the unresolved import, the boundary violation). Each note has exactly one begin and one end marker line; no line outside our own `## ` headings starts with `#`, `1)` or `- ` other than our own list lines; the note text contains no unescaped `[[`, `<script`, `%%`, `==x==`, `$x$`, `https://`, `www.` or U+202E; and the parsed frontmatter has exactly the ten IN20 keys. The screen shows `H` as text (no `script` element).
  - **A hostile file name:** a snapshot `snapshotWithPaths(['src/[[x]]#^|a.ts'])` with a finding on it: the proposed file name contains none of `[ ] # ^ |`, and the note's `source_path` round-trips exactly.
  - **Traversal:** `'../x'`, `'/abs'`, `'C:\\x'`, `'.obsidian/x'` and `'a/./b'` are refused in the dialog and nothing is written (`paths()` unchanged).
  - **Collision (exact and case-only, IN27):** two creates for one finding give `<name>.md` and `<name> (2).md`, and the first is byte-identical after the second; with a lower-cased copy of `<name>.md` already in the folder, the dialog proposes `<name> (2).md` before confirm.
  - **Vanished or doubled marker (IN31):** the user deletes the end marker, and in a second note duplicates the begin marker; each refresh reports `REFRESH_MARKERS_EDITED`, and each note is byte-identical.
  - **Only the dialogs write (IN35):** attaching a new report, rescanning and re-selecting cause no vault write (`calls.create`, `createFolder`, `process` and `processFrontMatter` unchanged).
- [ ] **Step 2a: Write the native spine** (`tests/e2e/investigation.e2e.ts`, IN51 d, IP55) — one test, `'keeps human sections byte-identical across a real refresh and links the note through the metadata cache'`, in a real vault through the real UI:
  - **Setup (Node side):** copy `tests/fixtures/fallow/relations-project/` into the session's copied vault as `code/` (`cpSync(src, join(page.getVaultPath(), 'code'), { recursive: true })`), and hash it (`createHash('sha256')` over every file, a local helper: the fast suite's `hashTree` lives under `tests/fixtures/`, which native files never import, IP56). Wait until `app.vault.getFileByPath('code/package.json')` exists (`expect.poll`).
  - **Scan and attach:** `inspector.openCity()`, `inspector.scanFolder('code')`, then `inspector.importReport(resolve('tests/fixtures/fallow/relations-combined-3.27.0.json'))`; the recording's `src/…` paths match the scanned folder.
  - **Investigate and preview:** `inspector.selectFinding(<the import cycle's id, read from the recording>)`; `expect.poll` until `.ci-source-preview__text [aria-current="true"]` exists (the exact highlight in a real file).
  - **Create:** `const path = await inspector.createNote()`; `inspector.frontmatter(path)` has `finding_fingerprint` `` `${anchorPath}#${id}` `` and `codebase_id` a non-empty string; `expect.poll(() => inspector.cachedFingerprint(path))` equals it (Obsidian's own metadata cache, IN33); the notes panel shows one `.ci-notes-panel__open`.
  - **Edit:** inside `executeObsidian`, `vault.process` inserts `I checked a.ts.` after the `## Investigation notes` line and `Decided: keep.` after `## Decision`, then `processFrontMatter` sets `status: 'in progress'` and `reviewer: 'me'`; keep `human` = the text after the end-marker line (`readNote`).
  - **Refresh:** run `scan-codebase` again (a refresh against the stored scope gives a new snapshot id), re-import the recording, select the same finding, `inspector.refreshNote(path)`. Then the text after the end-marker line equals `human` byte for byte; `frontmatter(path)` has the new `snapshot_id`, `status: 'in progress'`, `reviewer: 'me'` and the first `created`; the block differs from the first and names the new snapshot; `cachedFingerprint(path)` is unchanged.
  - **No source write:** the hash of `code/` is unchanged (the note's folder is outside it).
  - Write `writeEvidence(directory, 'spine', { path, before, after })` (the two note texts), add the title to `required-scenarios.json` (10 titles), and run `npm run test:e2e`: the gate prints 10 of 10. RED proof: make `refreshNote` also append a line after `## Decision` and watch the byte-identity assertion fail; revert. (If Task 0 stopped under IN50, skip this step and record it; the in-memory spine above still holds IN38.)
- [ ] **Step 3: Run them.** Both acceptance files pass on the code as it stands; these are acceptance pins. The RED proof is two mutations, each run and reverted: make `noteText` skip escaping `[` (the injection case fails), and make `spliceEvidenceBlock` accept a missing end marker (the vanished-marker case fails). Paste both runs.
- [ ] **Step 4: Gate and commit** (`test(acceptance): finding → note → evidence spine, the native spine and the safety cases (WP-04 IN37–IN39, IN51)`).

### Task 17: Harness seed and captures

**Files:**
- Modify: `tests/harness/seed.ts` (`demoInvestigation`), `tests/harness/mount.ts` (the `investigate` option), `tests/harness/page.ts` (the `?investigate=` parameter and its doc line), `scripts/harness-shot.mjs` (five captures), `tests/build/harness-shot.test.ts` (pin them), `tests/harness/harness-evidence.test.ts` (the seed)

**Interfaces:**
- Consumes: `createFakeVault` (browser-safe, Task 7), `createInvestigationNotes`, the demo report (`demoEvidenceReport`), `renderNoteBody`, `NOTE_VOCABULARY`, `noteFrontmatter`, `stringifyYaml`.
- Produces:
  ```ts
  // seed.ts
  export function demoInvestigation(snapshot: CodebaseSnapshot, mode: 'demo' | 'stale' | 'create'): {
    notes: InvestigationNotesPort; preview: SourcePreview; fingerprint: string;
  };
  // HarnessOptions gains: investigate?: 'demo' | 'stale' | 'create';
  ```
  `demoInvestigation` seeds a fake vault with one linked note for the first finding (status `in progress`) and one note for a finding the report does not hold, and a scripted preview whose `size` and `lineCount` equal the anchor's observations (`demo`) or are one byte larger (`stale`), with 41 lines of plausible TypeScript.

- [ ] **Step 1: Write the failing tests.** `harness-evidence.test.ts` gains: `demoInvestigation(harnessSnapshot(), 'demo')` lists one linked note and one orphan for the harness codebase, and its preview result gives an exact `locationVerdict` for `demo` and a `size` failure for `stale`. `harness-shot.test.ts` gains one case pinning the five ids and their queries:
  - `wp04-investigate-dark` and `wp04-investigate-light`: `?screen=s05&theme=<theme>&route=investigate&report=demo&investigate=demo`, viewport 1280 × 1400 (the detail column is tall; checked against the live harness like the WP-03 captures);
  - `wp04-investigate-narrow-dark`: the same with `&width=700`, viewport 760 × 1600;
  - `wp04-investigate-stale-dark`: `&investigate=stale`;
  - `wp04-investigate-create-dialog-dark`: `&investigate=create`.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** `mount.ts`: after the report is attached, `useInvestigationStore(pinia).setPorts(notes, preview)`, `open(fingerprint)`; for `create`, click `.ci-notes-panel__create` and wait for `.ci-dialog`. Throw a harness error when `investigate=` is given without `report=demo` or a route other than `investigate` (the `fallow=` precedent), so a broken capture page-errors.
- [ ] **Step 4: Run.**
  ```bash
  npx vitest run tests/harness/harness-evidence.test.ts tests/harness/harness.test.ts tests/build/harness-shot.test.ts
  npm run harness-shot
  ```
  Every capture must be produced with no page error. Open the five `wp04-*` PNGs and check: the list and the detail column are both visible; the reported line is highlighted in `demo` and not in `stale`, with the stale sentence visible; the create dialog shows the folder, the name and the full path; nothing is clipped. Follow J19 for committing PNGs.
- [ ] **Step 5: Gate and commit** (`test(harness): the Investigate captures (WP-04 IN40)`).

### Task 18: Evidence documents, the delivery record and the full verification

**Files:**
- Modify: `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` (a WP-04 Part 1 section, the refreshed G8 counts), `docs/superpowers/notes/2026-09-17-wp01-limitations.md` (a "WP-04 Part 1 — investigation workbench and notes" section), `docs/deliverables/Investigation and Notes.md` (a Delivery record), `README.md` (the vault-write sentence, per IN41 and O7, with IP31's words), `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` (only the counts they pin, refreshed from disk)

- [ ] **Step 1: The gate evidence.** Add a "WP-04 Part 1 — investigation workbench and notes" section after the WP-03 one:
  - spec §5's acceptance table, each row naming the test file and case that holds it (the city → workbench case in `investigate-entry-points.test.ts`; the spine and fs-diff in `investigation-spine.test.ts`, with O7's confirmed in-root note stated as the one exception and its test in `investigate-create.test.ts`; collision and race in `investigate-create.test.ts` and `investigation-notes.test.ts`; injection in `investigation-safety.test.ts` and `investigation-note-text.test.ts`; refresh in `investigation-spine.test.ts` and `investigate-refresh.test.ts`; stale location in `investigation-stale-location.test.ts` and `investigate-preview.test.ts`);
  - the two Task 16 mutation runs;
  - the five spec §6 pre-flight probe results, (a)–(e), with their IPF rulings;
  - the list of `wp04-*` captures;
  - a **native acceptance** subsection (O8, IN48): the harness and its origin (describe, MIT), the command (`npm run test:e2e`, not part of `verify`), the required-scenario list, the gate's output line, the requested and resolved Obsidian app and installer versions, the platform and the commit from `reports/native/cases/*/environment.json`, the probe evidence, and the statement that native runs are local only (no CI) and desktop only (spec §8). Native cases are not a G8 layer (IP53); the two new `tests/unit/` files are counted in the `unit` row. If Task 0 stopped under IN50, say so here instead, with the controller's ruling.
- [ ] **Step 2: The limitations.** Transcribe spec §8, and add: the note serialiser in tests is `yaml`, not Obsidian's own (IP29); escaping relies on Obsidian honouring CommonMark backslash escapes for its own syntax (record the probe result); the plugin is desktop-only (`manifest.json` `isDesktopOnly: true`), so the `no-filesystem` preview state is reachable only in tests (spec §3).
- [ ] **Step 3: The deliverable.** Add a "Delivery record" to `docs/deliverables/Investigation and Notes.md`, like `Dependencies and Architecture.md`'s: the branch, the spec path, a table mapping 04.1–04.7 to IN decisions and tasks, and the scope sentence (clone groups, symbol tracing and an external editor deferred, O1/O5; notes inside the codebase root only after the explicit exclusion checkbox, O7).
- [ ] **Step 3a: The README (IN41, O7).** Replace the bullet at `README.md:16–17` with IP31's words exactly: "- It reads **file text and file metadata only**. It never writes, moves, renames or deletes anything in the directory you select, with one exception you confirm each time: an investigation note you create in a folder inside that directory." Then run `npx vitest run tests/host/clean-vault-install.test.ts` (it reads the README's other disclosures; they are unchanged).
- [ ] **Step 4: Refresh the counts from disk** (L28). Run the full suite once, read the file and test counts, the `src/` floor and the analyze figures from the actual output, and update `gate-evidence.test.ts`, `evidence-numbers.test.ts` (403 lines: edit counts in place, never grow it) and the G8 table together.
- [ ] **Step 5: Full verification.**
  ```bash
  npm run verify
  FALLOW_BIN="$LOCALAPPDATA/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe" npm run test:fallow
  npm run analyze
  npm run harness-shot
  npm run test:e2e
  ```
  Expected:
  - `verify` exits 0 (it typechecks and lints the native files, and never runs them);
  - `test:fallow` passes every case (this part changes no process code, so this is a regression check);
  - `analyze` reports no finding beyond the baseline of 9. A new dead export is removed, not baselined;
  - `harness-shot` produces every capture, the five `wp04-*` ones included;
  - `test:e2e` passes and its gate prints `Verified <n> executed native Vitest cases, including all 10 required scenarios.`, with `OBSIDIAN_VERSION` unset (the baseline 1.13.4); run it once more with `OBSIDIAN_VERSION=latest` and record that result too (a failure there is recorded, not hidden, and does not block unless the controller rules so).

  Paste the tail of each run, and keep `reports/native/` until the final review has read it (it is git-ignored).
- [ ] **Step 6: Commit** (`docs(evidence): WP-04 Part 1 acceptance, native evidence, limitations, delivery record and refreshed counts`).

---

## Self-review notes (controller)

- **Spec coverage:**

  | Spec decisions | Task |
  |---|---|
  | IN1 (list source), IN2 (native filters), IN3 (order) | 6 (model), 11 (screen) |
  | IN4 (stable selection, gone) | 1 (store, gone watcher), 11 (over the model), 15 (acceptance) |
  | IN5 (entry points, city Findings section) | 15 |
  | IN6 (route, keyboard list) | 1 (route), 11 (list) |
  | IN7 (what is read) | 4 (service), 10 (host wiring, live binding), 12 (request) |
  | IN8 (what is shown) | 4 (window), 12 (rendering) |
  | IN9 (unavailable states) | 4, 12 |
  | IN10 (stale-location rule) | 4 (rule), 12 (verdict on screen) |
  | IN11 (snapshot of now, Reload) | 12 |
  | IN12 (Open in Obsidian) | 9 (`sourceNotePath`, `open`), 12 (button) |
  | IN13 (one read per selection, cancelled) | 10 (store token), 12 (trigger) |
  | IN14 (evidence bundle) | 6, 11 |
  | IN15 (uncertainties) | 6, 11, 12 (the verdict) |
  | IN16 (verification checklist) | 6, 11, 13 (seeded into the note) |
  | IN17 (no fabricated confidence, Add work item) | 6, 11 |
  | IN18 (the setting and its default) | 8 (data.json, settings tab), 10 (Settings screen row, destination) |
  | IN19 (folder validation) | 2 (rules), 8 (settings tab), 13 (dialog) |
  | IN20 (frontmatter) | 3 (object), 9 (serialised), 13/16 (parsed back) |
  | IN21 (file name) | 2 |
  | IN22 (body headings) | 3 |
  | IN23 (evidence block markers) | 3 |
  | IN24 (escaping) | 2, 16 |
  | IN25 (16 KiB, 50 entries) | 3 |
  | IN26 (create dialog) | 13 |
  | IN27 (never overwrite, collisions) | 2 (names), 9 (plan, race), 13 (dialog) |
  | IN28 (folders one segment at a time) | 9 |
  | IN29 (overlap and exclusion) | 9 (plan, exclusion), 13 (checkbox) |
  | IN30 (open, several notes) | 9, 13 |
  | IN31 (refresh, markers) | 3 (splice), 9 (host), 14 (dialog) |
  | IN32 (frontmatter on refresh) | 9, 14 |
  | IN33 (reconciliation index) | 5 (reducer), 9 (host events) |
  | IN34 (changed analysis is not completion) | 6 (orphans), 14 |
  | IN35 (no scan creates notes) | 9 (only create/refresh write), 16 (pin) |
  | IN36 (Note filter and counts) | 5, 6, 14 |
  | IN37 (fake vault) | 7 |
  | IN38 (spine) | 16 |
  | IN39 (safety tests) | 2, 4 (preview no-write, symlink), 16 |
  | IN40 (harness captures) | 17 |
  | IN41 (the texts that change: two storage disclosures, the README sentence, `FILE_SOURCE_PREVIEW_LATER`) | 8 (disclosures), 15 (`FILE_SOURCE_PREVIEW_LATER`), 18 (README) |
  | O7 (notes may be written inside the root, after the checkbox) | 9 (plan, exclusion), 13 (dialog), 18 (evidence exception) |
  | §3 (one port, eight members; no copy in application; `mdCode` moved) | 2 (`mdCode`), 3 (vocabulary), 9 (port) |
  | §6 pre-flight probe row (a)–(e) | 0 (native tests in `obsidian-facts.e2e.ts`), before Task 1 (IPF rulings), 2 (`PROBE_ESCAPED` pin), 18 (recorded) |
  | O8 (native e2e adopted from describe as Task 0) | 0 |
  | IN42 (stack), IN43 (separate project, not in `verify`) | 0 |
  | IN44 (fresh session per file), IN45 (teardown guarantees), IN46 (discipline), IN47 (reaching Obsidian) | 0 |
  | IN48 (evidence and the fail-closed gate) | 0 (gate and its unit test), 11 and 16 (required list grows), 18 (recorded) |
  | IN49 (versions), IN50 (Windows first) | 0 (Step 1), 18 (baseline and `latest` runs) |
  | IN51 (scenarios) | 0 (smoke, facts, cleanup), 11 (Investigate smoke), 16 (native spine) |

- **The spec now carries the earlier deviations** (IP2–IP39, cited by number in IN2–IN41). What remains a plan-only choice:
  - the folder store is an adapter type, not an application port, so §3's "one application port" holds (IP42);
  - modules the spec does not list: `ui/read-models/investigation-evidence.ts` (the read model split before the cap), `application/investigation/root-path.ts`, `host/investigation-services.ts`, `tests/fixtures/fake-investigation.ts` and `fake-investigation-folders.ts` (IP41);
  - the defensive preview state is named `no-filesystem`, matching IN9's words (IP43);
  - the IN39 injection string also reaches a specifier and a zone name by editing the synthetic JSON before the real parser reads it (IP44);
  - the native layer's placement and adaptations from describe (IP45–IP58): its unit tests in `tests/unit/`, the required list in one JSON file, the default version read from the manifest, the smoke's route to the city view, the tsconfig and lint wiring, no axe or mobile emulation, the shared probe strings, native cases outside G8, a Windows-safe runner script, a UI-driven native spine, a Markdown-only fixture vault, exact pins, and the stop rule.
