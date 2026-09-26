---
project: codebase-inspector
title: WP-02 — Part 6: durable review state, fallow report import with the findings lens, and the cancelling state (design)
status: draft, awaiting approval
date: 2026-09-23
branch: feat/wp-02-part6 (from feat/wp-01-codebase-city at d5ee2c9). Not stacked: fast-forwarded into feat/wp-01-codebase-city, so it lands on PR #1.
baseline: d5ee2c9
---

# WP-02 design — Part 6

These are binding:
- the Part 1 spec (`2026-09-21-inspector-ui-shell-design.md`, A1–A13);
- the Part 2 spec (`2026-09-21-inspector-ui-part2-design.md`, P1–P14);
- the Part 3 spec (`2026-09-21-inspector-ui-part3-design.md`, Q1–Q17);
- the Part 4 spec (`2026-09-22-inspector-ui-part4-design.md`, W1–W17);
- the Part 5 spec (`2026-09-22-inspector-ui-part5-design.md`, V1–V32).

Precedent, also binding:
- the Part 3 ledger (R1–R9, E1–E55);
- the Part 4 ledger (S1–S27, X0–X19, "Part 4 E1–E22");
- the Part 5 ledger (T1–T32, "Part 5 E1–E25").

This document records only what Part 6 adds. Its decisions are numbered **Y1–Y40**. The Part 6 ledger uses **U** for planning rulings and "Part 6 E<n>" for execution rulings.

## 0. Scope

Four items:

- **A. The cancelling state.** A `cancelling` view-surface state on the city. The toolbar Scan button moves from native `disabled` to `aria-disabled` (the carried-over T29).
- **B. Durable review state.** Work items, boundary rules and finding dispositions survive a restart. They are stored behind the existing `ReviewRepository` port in the plugin's `data.json`, keyed by `repositoryId`. Part 4 W1 said no plugin-data key would be added; Part 6 amends it.
- **C. Fallow report import.** The import-only half of the Fallow Ingestion deliverable: tasks 02.1–02.3 and 02.6.
  - raw fixtures for each supported version (02.1);
  - validators and a normaliser that keep scope and provenance (02.2);
  - an import dialog with profile matching and a review of unmatched paths (02.3);
  - findings in every screen, the missing, stale and not-analysed states, and the S15 findings lens (02.6).
  - Sample findings are removed.
- **D. Harness and evidence.**

The execution half of the deliverable is **Part 7**: 02.4 executable binding and trust, 02.5 the async runner, and 02.7's side-effect tests. That part adds the "Run fallow analysis" command and the S14 "installed analyzer" route. Nothing in Part 6 spawns a process.

The owner confirmed these choices at the Phase 1 design review:
- storage in `data.json`;
- imported findings are session-only;
- "Not analysed" replaces the sample findings;
- the lens is in scope;
- approach A for evidence: an adapter, plus a shared in-memory evidence repository per plugin;
- T29 is folded into the cancelling item.

## 1. Decisions

### A. The cancelling state

| # | Question | Decision |
|---|---|---|
| Y1 | What does the city show while a scan is cancelling? | `ViewSurfaceState` gains `{ kind: 'cancelling' }`.<br>In `deriveViewSurfaceState`, `runStatus === 'cancelling'` sits in the same priority slot as `running`: after the renderer and root checks, and before `cancelled`.<br>• It is a **banner** state, so it is not in `EMPTY_STATE_KINDS`. StatusBanner shows it over the city, whether or not a snapshot exists.<br>• With no snapshot (a first scan being cancelled), `CityWorkspace` shows only the StatusBanner. The state never falls through to `no-source`, so the COPY-01 welcome and its "Select a codebase" action (rendered only for `no-source`) do not reappear mid-cancel.<br>• Copy is `CANCELLING_BANNER`:<br>&nbsp;&nbsp;– with a snapshot: "Cancelling the scan… The current snapshot stays available."<br>&nbsp;&nbsp;– without one: "Cancelling the scan…"<br>• The copy lives in `src/ui/audit-copy/city.ts`, a new file re-exported by `inspector-copy.ts`. `surfaceCopy` takes the `hasSnapshot` flag through the state: `{ kind: 'cancelling'; hasSnapshot: boolean }`. |
| Y2 | Announcing it | `AnnouncementRegion` announces the transition into `cancelling` once, with the same text. That is a real, user-requested outcome (E17). Returning to `cancelled` is announced as it is today. A repeated cancel of a new run re-announces through `reannounce` (E17's re-announce rule). The Data & scans status line (Part 5 V6) is unchanged. It is on a different route, so the two are never on screen together. |
| Y3 | Toolbar Scan button (T29) | `:disabled` becomes `:aria-disabled="scannable ? undefined : 'true'"`, with `scannable = run.status !== 'running' && run.status !== 'cancelling'`.<br>A guarded handler refuses the press and announces nothing (E40/E44/E50, E17). The host guard (`withScanGuard`) stays.<br>The accessible name is unchanged (COPY_07). The existing `--ci-*` aria-disabled style, shared since Part 3's final review, is reused. |
| Y4 | Harness | `?run=` accepts `cancelling` as well as `running`. The seed puts the run store into `cancelling`. A new shot, `city-cancelling`, shows the banner. |

### B. Durable review state

| # | Question | Decision |
|---|---|---|
| Y5 | Where is it stored? | `PluginDataShape` gains `reviews?: unknown`. The stored value is `{ [repositoryId: string]: ReviewRecordSet }`.<br>`repositoryId` is the profile id. Profiles already live in `data.json`, so review state travels with its profile across Sync and backups, which §6 of the architecture doc allows for "shareable profile metadata".<br>Snapshots and findings are **not** stored there. |
| Y6 | Record-set format | `ReviewRecordSet = { v: 1; workItems: unknown[]; rules: unknown[]; dispositions: unknown[]; highWater: { workItem: number; rule: number } }`.<br>• Records are stored **in path form**, the same as the Part 5 v2 export:<br>&nbsp;&nbsp;– a file target is `{ kind: 'file', path }`;<br>&nbsp;&nbsp;– a disposition is `{ finding: '<path>#<findingId>', … }`.<br>• Raw entity ids are never stored. That keeps NUL bytes and the repository id out of `data.json`, and matches V12.<br>• The conversions reuse the Part 5 helpers: `findingRef`/`targetRef` on the way out, `makeEntityId` on the way in, with the strict `parseEntityId`.<br>• A record whose entity id does not parse is never written. The save rejects with `REVIEW_SAVE_UNREPRESENTABLE`, and the store's existing failure path announces it. |
| Y7 | Validating on read | On read, each record is validated with the Part 5 import record schemas (`WORK_ITEM`, `RULE`, `DISPOSITION` in `review-state-import.ts`). They are exported for reuse and not duplicated.<br>• An invalid record is **skipped but kept**. It is not listed, but it is never removed from disk, because every write is an upsert or remove **by id**, and records it does not touch are carried over verbatim. A hand edit or a newer format therefore never destroys data.<br>• A `v` other than 1, or a record set that is not an object, gives an empty read-only view of that codebase: its writes reject with `REVIEW_STORE_UNSUPPORTED`, and the set is never overwritten.<br>• Skipped records are counted. The port gains a synchronous **`diagnostics(): { skipped: number; unsupported: boolean }`**, which is valid after the first list. The in-memory adapter always returns `{ skipped: 0, unsupported: false }`. The review store mirrors it into `storageDiagnostics` after each `load()`. Settings › Privacy & storage shows one line, `REVIEW_RECORDS_SKIPPED(n)`, while n > 0, and `REVIEW_STORE_UNSUPPORTED_NOTE` while `unsupported` is true. |
| Y8 | Adapter | `src/adapters/storage/plugin-data-review-repository.ts` exports `createPluginDataReviewRepository(plugin, repositoryId)`, which implements `ReviewRepository`.<br>• Every write goes through `writePluginDataSlice(plugin, 'reviews', …)`, under the existing `withDataLock`, and mutates only its own codebase's entry.<br>• Reads go through `readPluginData`. Records are cached after the first read. The cache is refreshed after each of its own writes and on `reload()` (Y12). |
| Y9 | Size bound | Each codebase's serialised record set may be at most **1 MB** (`REVIEW_STORE_MAX_BYTES`, the same limit as `IMPORT_MAX_BYTES`), counted as the `JSON.stringify` length.<br>A save that would exceed it rejects with `REVIEW_STORE_FULL` before anything is written, and the existing failure paths announce it. Removals are never refused. |
| Y10 | Id allocation | The port gains **`allocateId(kind: 'workItem' \| 'rule'): string`**. It is synchronous and returns `wi-N` or `AR-NNN` (three digits minimum, as today).<br>• It increments an in-memory high-water mark, which is seeded by the first `list*` call.<br>• The adapter persists the high-water mark with every save of that kind, and never lowers it on removal. So an id is never handed out twice, across leaves (Y11) or after a restart.<br>• The store's per-bucket `nextId`/`nextRuleId` and `maxSuffix` are removed. The Part 5 bucket-counter rationale (a spent id `load()` cannot see) moves into the adapter's high-water mark.<br>• The in-memory adapter implements the same member, and so do tests. |
| Y11 | One instance per codebase, per plugin | `main.ts` builds one `ReviewRepositoryRegistry`: `for(repositoryId)` returns a cached instance per id.<br>• It reaches every `CityView` through a new `CityViewDeps` field, `reviewRepositoryFor: (id: string) => ReviewRepository`.<br>• `CityView.onOpen` calls `useReviewStore(this.pinia).setRepositoryFactory(deps.reviewRepositoryFor)` before mount. This goes in a new `src/host/data-ports.ts` helper, `wireDataPorts(pinia, deps)`, which Y28 also uses, so `city-view.ts` grows by about 2 lines.<br>• Two leaves on the same codebase therefore share one instance, one high-water mark and one cache. |
| Y12 | Keeping leaves in step | The port gains **`subscribe(listener: () => void): () => void`**.<br>• The adapter notifies after each successful write, from any leaf. A bound store subscribes on bind and unsubscribes on rebind, and on leaf close through a `detach()` action. Nothing in the codebase ever calls a store's `$dispose`, so `CityView.onClose` calls `unwireDataPorts(pinia)` from `src/host/data-ports.ts`, which detaches the review store and disposes the evidence store.<br>• On a notification the store calls `load()`, unless the notification came from its own in-flight operation. A store-held `ownWrites` counter skips exactly the notifications its own awaits produce.<br>• A stale leaf therefore cannot resurrect a deleted item: after the other leaf's removal it reloads before the user can act on it, because the reload runs within the same task as the write's resolution.<br>• The in-memory adapter implements `subscribe` too. |
| Y13 | Store split (the 400/400 rule, Part 5 E25) | The first task that touches `review-store.ts` splits it.<br>• **`src/ui/stores/review-buckets.ts`** holds the bucket map, `bindRepository`'s steps (a)–(e) without the counters, the repository factory, the subscription wiring and the `''` unbound bucket. It exports `createBucketState()` plus helpers that the store's actions call.<br>• `review-store.ts` keeps the state, the getters and the actions.<br>• The target is at most 320 lines for the store and at most 200 for the buckets module. A new `tests/unit/review-store-budget.test.ts` asserts that the store is at most 360 lines. |
| Y14 | Unbound bucket (Part 5 E16) | The `''` bucket stays in memory and is never persisted. `replaceAll` and `clearAll` return `false` while `boundKey === ''`. The UI guard (Import is `aria-disabled` with no snapshot) stays as well. |
| Y15 | Pending keys per codebase (Part 5 E15) | The four pending arrays become maps keyed by `repositoryId`: `pending: Map<string, { rule: string[]; work: string[]; item: string[]; fingerprint: string[] }>`.<br>• The getters (`isRulePending` and the others) read the bound codebase's entry.<br>• `hasPendingChanges` reads the bound entry only. `bulkBusy` stays global per store, per Part 5 E18/E19/E20: a bulk operation blocks every other write in that leaf and stays bound to the codebase it started in.<br>• A `finally` removes its key from the entry it was added to, found by the repository id it captured. |
| Y16 | Rejecting reload (Part 5 E25's parked test) | Now that a port can reject, `tests/unit/review-replace-all.test.ts` gains the case where `replaceAll`'s own `load()` rejects: `bulkBusy` is `false` afterwards, and the rejection surfaces. |
| Y17 | Purging on profile removal | `settings-tab.ts`'s remove path calls `reviewRegistry.purge(id)` after `profileStore.remove(id)`. That deletes `reviews[id]` under the lock and drops the cached instance.<br>The registry is passed to the settings tab by `main.ts`. `settings-tab.ts` stays under 400 lines, because the purge is one line. |
| Y18 | Clear, import and export | The port gains **`replaceAll(state: ReviewReplaceState): Promise<void>`**. `ReviewReplaceState` is `{ workItems; rules; dispositions }`.<br>• The store's `replaceAll` and `clearAll` call it **once**. A per-record loop over 2000 items would mean 2000 full `data.json` rewrites and 2000 reloads in every other leaf.<br>• The durable adapter writes once and atomically. It replaces the whole record set, including records that were skipped but kept, because this is an explicit user replace. It rejects unrepresentable, full or unsupported sets, and it never lowers `highWater`.<br>• Part 5 E18–E20 are unchanged: `bulkBusy`, the refusals, and staying bound to the codebase the operation started in.<br>The export format v2 is unchanged. Only its note text is reworded, because "one session" is no longer true. Import still replaces, never merges (T12). |
| Y19 | External changes to `data.json` | Obsidian Sync or a hand edit that changes `data.json` from outside is picked up on the next bind, or when the plugin reloads. `onExternalSettingsChange` is **not** wired. This is logged as deferred. |

### C. Fallow report import

| # | Question | Decision |
|---|---|---|
| Y20 | Supported input (02.1) | A single fallow JSON document, identified by `kind` and `schema_version`. The supported set is exactly what the fixtures cover:<br>• `combined` at schema 11 (fallow 3.21.0) and 12 (fallow 3.27.0);<br>• `dead-code` at 9, `health` at 11 and `dupes` at 10 (all fallow 3.27.0).<br>`version` must match `/^\d+\.\d+\.\d+/`.<br>Anything else is refused as `unsupported`, and the message names the supported kinds and versions (`FALLOW_UNSUPPORTED(kind, schema)`).<br>Size limit: **16 MB** (`FALLOW_REPORT_MAX_BYTES`), checked with `File.size` before reading and with the text length after. This repository's own combined report is 585 KB. |
| Y21 | Fixtures | `tests/fixtures/fallow/` holds:<br>• the fixture project `project/`: five small `.ts` files plus a `package.json` (`.ts`, because `unused_types` needs TypeScript), with one duplicated block, one unused export, one unused type and one function above the default complexity thresholds;<br>• raw outputs recorded **once** with `--format json --no-cache --quiet --root tests/fixtures/fallow/project`: `combined-3.27.0.json`, `dead-code-3.27.0.json`, `health-3.27.0.json`, `dupes-3.27.0.json` and `combined-3.21.0.json`;<br>• a `README.md` giving the exact commands, the fallow versions and the recording date.<br>The fixtures are committed verbatim, including `fragment` and `actions`, because the tests prove those are dropped.<br>The recording is a controller-run development step. No script under `src/` or `package.json` runs fallow for it.<br>The fixture project is excluded from `tsconfig`, eslint, oxlint and the repository's own fallow gate. `tsconfig.test.json` gets an `exclude` for `tests/fixtures/fallow/project/**`, and so do eslint's `ignores` and oxlint's `ignorePatterns`. The repository's own `analyze` script scans `src` only. A dry run of this design in a scratch directory with fallow 3.27.0 produced exactly one unused export, one unused type, one clone group across two files and one `critical` complexity finding, and it wrote no files. |
| Y22 | Raw schema discipline | `src/application/evidence/fallow-report-schema.ts` defines zod 4 schemas for **only the fields we read**. The objects use `z.object`, which **strips** unknown keys. Fields fallow adds later are therefore tolerated, but they never survive parsing, and that includes `fragment`, `actions` and `_meta` (U-ruling: with zod 4.6.5, `z.looseObject` keeps them). Every field we read is type-checked.<br>Our own formats (Y6, and the review export and import) stay `.strict()`. Every refinement uses `{ error: '…' }`, and failures read `error.issues`.<br>Fields that are read:<br>• top level: `kind`, `schema_version`, `version`, and `elapsed_ms` (ignored);<br>• `check.unused_exports[]` and `check.unused_types[]`: `{ path, export_name, is_type_only, line, col }`;<br>• `dupes.clone_groups[]`: `{ fingerprint, token_count, line_count, instances[]: { file, start_line, end_line } }`;<br>• `health.findings[]`: `{ path, name, line, col, cyclomatic, cognitive, line_count, exceeded, severity }`, and `health.summary`: `{ max_cyclomatic_threshold, max_cognitive_threshold }`;<br>• `check.summary` (for the not-shown counts, Y25) and `workspace_diagnostics[]`: `{ path, kind, message }`.<br>A single-command report has the same shape at the top level. The schema is a discriminated union on `kind`. |
| Y23 | Normalising (02.2) | `src/application/evidence/normalize-fallow.ts` is a pure function: `normalizeFallow(raw, { stripPrefix }) → NormalizedEvidence`. It is **snapshot-independent**, so the evidence index can resolve the same report again against a newer snapshot (Y30). Matching against a snapshot is a separate pure function, `resolveFindings(findings, snapshotPaths) → { matched, unmatchedPaths }` (Y26), in `src/application/evidence/resolve-findings.ts`.<br>`NormalizedEvidence = { findings: EvidenceFinding[]; categories: Record<FindingCategory, 'analysed' \| 'not-analysed'>; notShown: { key: string; count: number }[]; rejectedPaths: string[]; warnings: string[] }`. `rejectedPaths` holds the paths refused by `normalizeRelativePath`, and their findings are dropped.<br>`FindingCategory = 'complexity' \| 'duplication' \| 'unused-exports'`.<br>`EvidenceFinding = { id; category; rule; severity: string \| null; path; line: number \| null; endLine: number \| null; symbol: string \| null; detail: FindingDetail }`. `FindingDetail` is one of:<br>• `{ kind: 'complexity'; cognitive; cyclomatic; lineCount; exceeded; cognitiveThreshold; cyclomaticThreshold }`;<br>• `{ kind: 'duplication'; tokenCount; lineCount; partnerFiles: number }`;<br>• `{ kind: 'unused'; typeOnly: boolean }`.<br>Mapping:<br>• **Complexity:** one finding per `health.findings[]` entry. `rule` is `'complexity'`, `severity` is the tool's own string (`critical`/`high`/`moderate`), `symbol` is `name`.<br>• **Duplication:** one finding per (clone group, instance file). The rule is `'duplication'`, the severity is `null`, the line range is the instance's own, and `partnerFiles` counts the group's other distinct files.<br>• **Unused:** one finding per `unused_exports[]` entry (rule `'unused-export'`) and per `unused_types[]` entry (rule `'unused-type'`). The severity is `null` and `symbol` is `export_name`.<br>**Dropped at parse time and never stored:** `fragment`, `actions`, `suggestions`, `clone_families`, `vital_signs`, `file_scores`, `hotspots`, `targets` and `_meta`. No source text is kept anywhere (evidence rule: never read source file content). |
| Y24 | Stable finding ids | `id = PREFIX + '-' + fnv1a32hex(key)`:<br>• `CX`, key `path + '\|' + name + '\|' + (the name's occurrence index in that file)`;<br>• `DU`, key `fingerprint + '\|' + path`;<br>• `UN`, key `path + '\|' + export_name + '\|' + rule`.<br>These always match `FINDING_ID_PATTERN` (`/^[A-Za-z0-9-]{1,64}$/`). Re-importing a report where the finding still exists gives the same fingerprint `${fileId}#${id}`, so its disposition applies again. The line is never part of the key. |
| Y25 | Categories analysed, and sections not shown | `categories` is `analysed` when the report carries the category's section:<br>• `health` for complexity;<br>• `dupes` for duplication;<br>• `check` for unused exports.<br>Otherwise it is `not-analysed`. A `dead-code` report therefore marks complexity and duplication as **Not analysed**, never zero.<br>`notShown` lists every non-zero `check.summary` count Part 6 does not surface (unused files, dependencies, class members, circular dependencies, and so on), labelled from a fixed map in `audit-copy/fallow.ts`. A key missing from that map is shown by its raw key. They are shown as "Reported, not shown in this version". |
| Y26 | Path resolution and the explicit mapping (02.3) | Each report path is normalised with the Part 5 `normalizeRelativePath` and looked up in the snapshot's file paths.<br>• A finding whose path does not match is **dropped from `findings`**, and its path is added to `unmatchedPaths` (distinct and sorted). It never paints a lot or appears in a table.<br>• A path that is absolute, contains `..` or is otherwise refused by `normalizeRelativePath` is treated as unmatched, never resolved.<br>**Mapping:** `suggestStripPrefix(unmatched, snapshotPaths)` returns the shortest leading folder `p/` for which **every** unmatched path starting with `p/` matches once `p/` is removed, and at least one path does. The review step offers it as a checkbox, unchecked by default: `FALLOW_MAPPING_OFFER(p)`. Checking it re-runs `normalizeFallow` with `stripPrefix: p`. Nothing is applied without the user's choice.<br>**Mismatch:** if the report has findings but none match, even with the offered mapping, it is refused as `source-mismatch` (COPY-17) and cannot be attached. |
| Y27 | Provenance | `EvidenceReport = { provider: 'fallow'; providerVersion; reportKind; schemaVersion; fileName; importedAt (ISO, from the Clock); snapshotId; stripPrefix: string \| null; normalized: NormalizedEvidence }`.<br>• `fileName` is the picked file's `name`, capped at 255 and rendered as text only. It is never a path.<br>• The **source match is always `unverified`**: a fallow report carries no root or revision. `EvidenceBadge` (Y32) says so every time it appears. |
| Y28 | Session-only storage (approach A) | `src/adapters/storage/in-memory-evidence-store.ts` holds `InMemoryEvidenceStore implements EvidenceRepository`.<br>• The port is in `src/application/ports/evidence-repository.ts`: `get(repositoryId): EvidenceReport \| null`, `put(repositoryId, report)`, `remove(repositoryId)` and `subscribe(listener)`.<br>• `main.ts` builds one instance, shared by every leaf through `CityViewDeps.evidenceStore`. Nothing is written to `data.json` or the vault. After a restart every codebase reads **Not analysed** until a report is imported again. |
| Y29 | Pinia evidence store | `src/ui/stores/evidence-store.ts`, per leaf, holds `{ repositoryId, report, importRequested }` and exposes `bindRepository(id)`, `attach(report)`, `remove()` and `requestImport()`.<br>• App's repository watcher binds it next to report and review.<br>• It subscribes to the shared repository, so an import in one leaf shows in every leaf on the same codebase.<br>• `attach` and `remove` go through the port, and the store never keeps a copy that could diverge from it. |
| Y30 | Stale evidence | Evidence is **stale** when `report.snapshotId !== currentSnapshot.snapshotId`.<br>• Stale evidence is still shown, resolved again against the current snapshot's paths, with every value in the `stale` evidence state.<br>• It carries the S22 notice `COPY_16(absoluteDate)`: "Showing evidence from {date}. It is not current for this snapshot."<br>• Re-resolving is memoised per (report, snapshot) pair (E53: per leaf key). |
| Y31 | Failures keep old evidence | A failed import leaves the attached evidence untouched (acceptance 4). The failure codes are `too-large`, `not-json`, `unsupported`, `invalid` (first issue path), `source-mismatch` and `read-failed`.<br>Re-importing while evidence is attached shows a replace confirmation in the review step: `FALLOW_REPLACE_NOTE(date)`.<br>**Remove report** is on the fallow card, and it is `aria-disabled` while there is nothing to remove. Before removing it asks for confirmation in a `CiDialog`, then announces `FALLOW_REMOVED` (a real outcome). |

### D. Surfaces and the lens

| # | Question | Decision |
|---|---|---|
| Y32 | EvidenceBadge (C13) | `src/ui/kit/EvidenceBadge.vue` takes the props `version` and `state: 'imported' \| 'stale'`. The provider (fallow) and the source match (always unverified, Y27) are fixed in its copy, and a Part 7 provider can add props later. It renders a compact text pill, for example "fallow 3.27.0 · Imported · Unverified source match", or with "Stale" in place of "Imported".<br>It is never a coloured dot alone (C13). Its CSS is kit-scoped in `kit.css`. |
| Y33 | Evidence states in the models | Imported values are **`collected`**, with `provenance.source = 'fallow'` and `detail = 'imported report {version}'`. They are **`stale`** under Y30. With no report, or a category that was not analysed, they are **`unknown`**, with reason `FALLOW_NOT_ANALYSED`.<br>No new `EvidenceState` member is added. `usesSample` is removed from the quality model, so the shell's "Includes sample data" badge no longer takes anything from Quality. |
| Y34 | Where the counts come from | `FileSummary` loses `findings`, `highFindings` and `unusedExports`, and `FileSignals` loses its matching fields. Their sample generation is deleted, along with `src/ui/fixtures/sample-findings.ts`.<br>A new `src/ui/read-models/evidence-index.ts` exports `evidenceIndexFor(files, report \| null, snapshotId)`, which returns:<br>• `byFile: Map<EntityId, EvidenceFinding[]>`;<br>• the per-file counts `{ findings, high, unused }` as `MetricValue`s;<br>• the totals;<br>• `state: 'none' \| 'current' \| 'stale'`.<br>It is memoised per (files array, report) in a `WeakMap` of `WeakMap`s. `high` counts severity `critical` or `high`.<br>Consumers:<br>• `overview.ts`: the findings card and the high caption;<br>• `city-summary.ts`: the unused card;<br>• `file-detail.ts`: `findingsCount` and `findings`;<br>• `findings.ts`: the quality model;<br>• `NavColumn`'s Quality badge: shown only when the findings total is `collected`.<br>They all read from the index, through the `use-read-models.ts` memo. |
| Y35 | Quality screen | The model is built from the evidence index.<br>• **No report:** the table area is replaced by `NotAnalysed` (a new kit piece in `src/ui/kit/NotAnalysed.vue`), which shows `FALLOW_NOT_ANALYSED_TITLE` and `_BODY` and an **Import report** button that opens the S14 dialog (Y38). The cards read Unknown.<br>• **A category not analysed:** its card reads Unknown with the reason, and the kind filter still lists it.<br>• **Severity:** the column and filter show the tool's own severity, or "Not rated" when it is null (`FINDING_SEVERITY_UNRATED`).<br>&nbsp;&nbsp;– `FindingSeverity` becomes `'critical' \| 'high' \| 'moderate' \| 'unrated'` (`unrated` for `null`), and `SEVERITY_RANK` follows it.<br>&nbsp;&nbsp;– An unknown severity string from a future fallow is kept verbatim for display and ranks after `moderate`.<br>• **Title:** per finding. `symbol` plus the rule label, for example "`partitionDistrict` · Cognitive complexity 27 (threshold 15)" or "`fs` · Unused export". The category titles in `FINDING_TITLE` stay as the fallback.<br>• **Kind filter:** its values are the three categories. `unused-exports` covers both of its rules.<br>• **CSV:** `provenance` is `fallow {version} imported`, or `… stale`, and `line_state` is `reported`. A `rule` column is added after `kind`.<br>• **Review dialog:** `FINDING_DIALOG_PROVIDER_VALUE` becomes a function of (version, date). The confidence row is replaced by the tool's rule and threshold, and it says "Reported above threshold" for complexity. The Illustrative copy is deleted. |
| Y36 | File detail | FileFindingsPanel distinguishes three states:<br>• **Not analysed:** `FALLOW_NOT_ANALYSED_TITLE`, plus the Import action.<br>• **Analysed with no finding for this file:** `FILE_NO_FINDINGS_REPORTED`, "No findings reported for this file. That is not the same as zero complexity." (S15).<br>• **Findings:** each row shows the title, `line` (or the range), the rule and the tool's severity.<br>The EvidenceBadge heads the panel whenever evidence exists. `FINDING_META` no longer says "Sample finding". |
| Y37 | Data & scans: the fallow card | The `static` provider card becomes **`fallow`** (`SOURCES_PROVIDER.fallow`: title "fallow findings"). Its state is `unknown` (Not analysed), `collected` (Imported) or `stale`.<br>• `ProviderGrid` gains an optional per-card slot, used only by this card, for the diagnostics and actions.<br>• **Diagnostics** (a `<dl>`): version, report kind, schema, file name, imported at, categories (analysed or Not analysed), matched findings and files, unmatched paths (the count plus the first 20 in a `<details>`), reported-not-shown sections with their counts, and warnings (`workspace_diagnostics` messages, as text).<br>• **Actions:** **Import report…**, which opens Y38, and **Remove report** (Y31).<br>• `SOURCES_PLANNED` and `SOURCES_CALLOUT` drop the fallow sample wording.<br>• The planned-integrations panel says the installed-analyzer route comes later, as text with no control (WP-01: no rendered-but-disabled control). |
| Y38 | The S14 "Connect fallow" dialog | `src/ui/screens/sources/ConnectFallowDialog.vue` is a `CiDialog`. It follows the S14 copy and the Part 5 import pattern (`useBusyAction`, the repository id checked again before and after each async step).<br>• **Step 1:** the intro, the disclosure (`FALLOW_DISCLOSURE`: "The plugin does not download or install fallow. Imported reports cannot authorize commands or source access."), "Current structural snapshot: N files", and **Choose report…**. That button clicks a template-owned visually hidden `<input type="file" accept=".json,application/json">`, which is the only file read (`file.text()`).<br>• **Step 2, review:** version, kind and schema; categories; matched findings and files; unmatched paths (count plus the first 20); the mapping checkbox (Y26); reported-not-shown; the replace note when evidence exists; **Attach report** and **Cancel**.<br>• **Errors:** an inline `role="alert"` with `FALLOW_IMPORT_ERROR[code]`. A new pick clears the previous one, using `reannounce`.<br>• **Busy:** Attach is `aria-disabled`. Cancel, Escape and the backdrop are ignored (Part 4 E13).<br>• **Codebase switch:** if the codebase changes while the dialog is open, it closes without attaching (Part 4 E8/E11), and a result that arrives late is dropped.<br>• **Success:** closes, then announces `FALLOW_ATTACHED(findings, files)` in the Data & scans live region.<br>There is **no** "Use an installed analyzer" option in Part 6. |
| Y39 | Command "Import analysis report" | The command is `import-analysis-report` in `commands.ts`. `checkCallback` is true only when the active view is a `CityView` with a snapshot (`view.hasSnapshot()`).<br>• Its body calls `view.openReportImport()`, which does `cityStore.navigate('sources')` and then `evidenceStore.requestImport()`.<br>• `SourcesScreen` watches `importRequested`, opens Y38 and clears the flag. The user then picks the file inside the dialog, so the file picker always opens from a real click.<br>• The `commands.ts` header drops "No fourth command", and `tests/host/commands.test.ts` gains the fourth id. |
| Y40 | The S15 findings lens | **Control:** a toolbar `<select>` labelled `LENS_LABEL` ("Colour") with the options **Category** and **Reported findings**. It is rendered **only when the bound codebase has evidence**, so it is never a disabled control. The choice is in a new per-leaf `src/ui/stores/lens-store.ts`, `{ lens: 'category' \| 'findings' }`. It resets to `category` when the evidence goes away or the codebase changes. The city-store's `select`, `setQuery` and `setCamera` are untouched.<br>**Renderer:** `RendererPort` gains `setReported(ids: ReadonlySet<EntityId> \| null): void`.<br>&nbsp;&nbsp;• `null` restores the category colours.<br>&nbsp;&nbsp;• A set repaints the measured lots: ids in the set keep `categories[colorKey]`, and every other measured lot takes `palette.unavailable`.<br>&nbsp;&nbsp;• Unavailable-marker lots are unchanged.<br>&nbsp;&nbsp;• It is a **recolour only**: no relayout, no camera change, and the set is re-applied after `setColors`.<br>&nbsp;&nbsp;• `CityViewport.vue` is at 400/400, so it is not edited. A new composable, `src/ui/screens/city/use-lens-renderer.ts`, is used by `CityStage.vue` (75 lines). It injects `CITY_RENDERER_KEY`, watches the renderer handle, the lens and the evidence index, and calls `setReported`, re-applying it whenever the handle changes.<br>**Legend and heading:** in the findings lens, MetricLegend shows two rows, `LENS_LEGEND_REPORTED` ("Reported finding") and `LENS_LEGEND_NONE` ("No finding reported · metric unavailable"). A heading over the viewport shows:<br>&nbsp;&nbsp;• eyebrow `LENS_EYEBROW` ("fallow lens");<br>&nbsp;&nbsp;• title `LENS_TITLE` ("Reported findings");<br>&nbsp;&nbsp;• subtitle `LENS_SUBTITLE(findings, files)` ("N findings · M files · imported evidence");<br>&nbsp;&nbsp;• the EvidenceBadge.<br>Stale evidence keeps the lens available and shows COPY-16 under the heading.<br>**List mode:** the file list gets a "Reported" column in the findings lens, with the count or an em dash. No new colour is needed. |

## 2. Screens and surfaces touched

- **City:**
  - the cancelling banner (Y1–Y2);
  - the Scan button's `aria-disabled` (Y3);
  - the lens select, legend, heading and renderer recolour (Y40).
- **Shell:** App binds the evidence store (Y29). The sample badge no longer takes anything from Quality (Y33).
- **Data & scans:** the fallow card with its diagnostics and actions (Y37), and the S14 dialog (Y38).
- **Quality:** real findings, the Not-analysed state, severity, titles, CSV and the review dialog (Y35).
- **File detail:** the findings panel in its three states (Y36).
- **Overview, Report, city summary, nav badge:** counts from the evidence index (Y34).
- **Settings:** the skipped-records line (Y7).
- **Command palette:** "Import analysis report" (Y39).

## 3. Units

| Unit | Kind | Notes |
|---|---|---|
| `src/ui/view-surface.ts` | edit | the `cancelling` state (Y1) |
| `src/ui/components/AppToolbar.vue` | edit | Y3, and hosts the lens select (Y40) |
| `src/ui/components/AnnouncementRegion.vue` | edit | Y2 |
| `src/ui/stores/review-buckets.ts` | new | Y13 |
| `src/ui/stores/review-store.ts` | edit (split) | Y10, Y12–Y16 |
| `src/ui/stores/ports/review-repository.ts` | edit | `allocateId`, `subscribe`; the in-memory adapter follows |
| `src/adapters/storage/plugin-data-review-repository.ts` | new | Y6–Y10, Y12 |
| `src/adapters/storage/review-repository-registry.ts` | new | Y11, Y17 |
| `src/adapters/storage/plugin-data-shape.ts` | edit | the `reviews` key |
| `src/host/data-ports.ts` | new | `wireDataPorts(pinia, deps)` (Y11, Y28) |
| `src/host/city-scan-controller.ts` | edit | `CityViewDeps` gains `reviewRepositoryFor` and `evidenceStore` |
| `src/host/city-view.ts` | edit | about 6 lines: `wireDataPorts`, `hasSnapshot`, `openReportImport`; stays at most 360 |
| `src/host/commands.ts` | edit | Y39 |
| `src/host/settings-tab.ts` | edit | the purge (Y17) |
| `src/main.ts` | edit | builds the registry and the evidence store |
| `src/application/evidence/raw-fallow.ts` | new | the raw report types, the supported set, the size limit, the error codes (Y20, Y22). `src/application` never imports `src/adapters`, so these live here |
| `src/application/evidence/fallow-report-schema.ts` | new | Y22 (zod, `z.object` strip) |
| `src/application/evidence/read-fallow-report.ts` | new | reading the file, the size limit, JSON parsing, the schema, errors (Y20, Y31). The UI imports it through the existing ui → application edge; no ui → adapters edge is created |
| `src/domain/hash.ts` | new | `fnv1a32Hex` for finding ids (Y24) |
| `src/application/evidence/normalize-fallow.ts` | new | Y23–Y26 |
| `src/application/evidence/model.ts` | new | `EvidenceReport`, `EvidenceFinding`, `FindingCategory`, `FindingDetail` |
| `src/application/ports/evidence-repository.ts` | new | Y28 |
| `src/adapters/storage/in-memory-evidence-store.ts` | new | Y28 |
| `src/ui/stores/evidence-store.ts` | new | Y29 |
| `src/ui/stores/lens-store.ts` | new | Y40 |
| `src/ui/read-models/evidence-index.ts` | new | Y30, Y34 |
| `src/ui/read-models/{findings,file-detail,overview,city-summary,file-summaries,sources,use-read-models}.ts` | edit | Y33–Y37 |
| `src/ui/fixtures/sample-findings.ts` | **deleted** | Y34 |
| `src/ui/fixtures/sample-signals.ts` | edit | drops the finding fields (Y34) |
| `src/ui/kit/EvidenceBadge.vue`, `src/ui/kit/NotAnalysed.vue` | new | Y32, Y35 |
| `src/ui/screens/sources/ConnectFallowDialog.vue`, `FallowCardDetails.vue` | new | Y37, Y38 |
| `src/ui/screens/{QualityScreen,SourcesScreen}.vue`, `quality/*`, `file/FileFindingsPanel.vue`, `sources/ProviderGrid.vue`, `NavColumn.vue` | edit | Y35–Y38 |
| `src/ui/components/{MetricLegend,CityStage}.vue`, `src/ui/screens/city/{LensHeading.vue,use-lens-renderer.ts}` (new) | edit/new | Y40; `CityViewport.vue` (400/400) is not touched |
| `src/visualization/{renderer-port,instanced-city,city-renderer}.ts` | edit | `setReported` (Y40); `instanced-city.ts` is at 334 |
| `src/ui/audit-copy/{city,fallow}.ts` | new | re-exported by `inspector-copy.ts` |
| `tests/fixtures/fallow/**` | new | Y21 |
| `tests/harness/{page,seed,mount}.ts` | edit | `?run=cancelling`, `?report=demo` |

## 4. Error handling

- **Review adapter:** each of these rejects its operation, and the store's existing persist-first failure path announces it (E17, where it is a real outcome):
  - an over-size save (Y9);
  - an unsupported set (Y7);
  - an unrepresentable record (Y6);
  - a `saveData` failure.
  
  Local state never changes before the port has succeeded.
- **Fallow import:** each code in Y31 has its own message, shown in the dialog's `role="alert"`. Attached evidence is never cleared by a failure.
- **Renderer:** `setReported` before the first layout is a no-op, and the set is re-applied after the layout. A lost context rebuilds and re-applies the lens from the store.
- **Imported text** (the file name, symbols, paths, warnings) is rendered only through Vue text interpolation, never through `v-html`, `innerHTML` or an `href`. A test imports a symbol and a warning containing `<img src=x onerror=…>` and asserts that it appears as literal text.

## 5. Testing

- **Unit:**
  - `view-surface` gets the cancelling priority, both copies, and no `no-source` fall-through;
  - the toolbar Scan is `aria-disabled` while running or cancelling, and a guarded press does nothing;
  - `review-repository.contract.ts` runs against the in-memory and plugin-data adapters. It covers the round trip, reopening, skip-but-keep of an invalid record, an unsupported `v`, the high-water mark surviving reopen and removal, the size limit, purge, and that `subscribe` fires after every write;
  - the store split: all existing review-store tests pass unchanged, except those that assert the removed counters, which move to the contract suite; plus pending keys per codebase and the rejecting reload (Y16);
  - fallow: parse each fixture; unsupported kind and schema; size; not-json; `invalid` with its issue path; **fragments absent** from the normalised output (a deep scan finds no `fragment` key and no fixture source line); ids stable across two normalisations; ids matching `FINDING_ID_PATTERN`; categories per report kind; `notShown`; unmatched paths; `suggestStripPrefix` positive and negative; `source-mismatch`; staleness;
  - the evidence index: counts, `high`, `unknown` when absent, `stale` when the snapshot changed.
- **Acceptance evidence for the Fallow Ingestion deliverable:**
  - (1) a known fixture finding lands on the right file and line in the quality model and the lens set;
  - (2) import runs no code: a new static test asserts that no file under `src/` imports `child_process`, `node:child_process`, `worker_threads` or `electron`'s `shell.openPath`, and that no `spawn` or `exec` identifier appears;
  - (4) a failed import keeps the old evidence;
  - (6) with no report, every structural screen still works and nothing reads zero.
  - (3) and (5) belong to Part 7.
- **Component:**
  - the S14 dialog steps, errors, busy state, codebase switch, and the mapping checkbox;
  - the fallow card's diagnostics and Remove confirmation;
  - the Quality and File Not-analysed and analysed states;
  - the lens select appears only with evidence and resets on a codebase switch;
  - MetricLegend in the lens.
- **Host:**
  - `commands.test.ts`: four commands, and the import command's `checkCallback`;
  - a new `tests/host/data-ports.test.ts` for the wiring;
  - the settings purge.
  - Nothing is added to `city-view-store-wiring.test.ts` (450/450).
- **Renderer:** `setReported` repaints colours without re-layout. This is checked against the instanced-city test doubles, with the recorded `setColorAt` calls.
- **Harness:**
  - `?report=demo` builds a clearly labelled **synthetic** fallow-shaped combined report from the harness fixture's own paths, in `tests/harness/seed.ts`, run through the real parser and normaliser. Every surface showing it says "fallow · imported report", because it goes through the real path; the harness page footer says the data is synthetic.
  - New shots: `sources-fallow`, `connect-fallow-review`, `quality-fallow`, `city-lens`, `city-cancelling`.
  - Changed shots, intended: Quality, File and Overview without `?report` now show Not analysed.
  - `tests/unit/obsidian-mock-scope.test.ts` and `css-class-scope.test.ts` stay green.
- **Evidence notes:** updated once, in the final task, then `npm run verify`, which also runs in the main checkout after the fast-forward.

## 6. Out of scope

- Running fallow, binding an executable, trust, version probing, the runner, timeouts, cancelling an analysis, side-effect tests and "Run fallow analysis" (**Part 7**: 02.4, 02.5, 02.7).
- Keeping imported findings across a restart, and durable snapshots or findings history (the Snapshot History deliverable).
- Reacting to external `data.json` changes (Y19).
- Surfacing the fallow sections Part 6 lists as not shown: unused files and dependencies, cycles, boundaries, and so on.
- Replacing the other sample providers (history, coverage, packages, imports) and the sample `complexity` metric used by Hotspots. Those stay labelled sample.
- Whole-row activation in BoundaryRuleTable and CoverageGapsTable, the Option B hover below 3:1, and a CI gate on measured contrast (Part 5 E21).
- Changes to city-store `select`, `setQuery` and `setCamera`.
