---
project: codebase-inspector
title: WP-04 Part 1 — Investigation workbench and Markdown notes (design)
date: 2026-09-25
status: for owner approval
deliverable: docs/deliverables/Investigation and Notes.md
---

# WP-04 Part 1 — Investigation workbench and Markdown notes

## 1. Outcome and scope

"I can investigate a finding, record the evidence and uncertainties in my vault, and turn the result into a concrete engineering task or decision." (deliverable)

Part 1 delivers the deliverable's whole task table, 04.1–04.7 (O1):

| Task | Deliverable | Decisions |
|---|---|---|
| 04.1 | Finding list, native categories/rules, stable selection | IN1–IN6 |
| 04.2 | Safe bounded source preview and stale-location checks | IN7–IN13 |
| 04.3 | Evidence bundle and uncertainty/verification panel | IN14–IN17 |
| 04.4 | Vault note destination/settings and escaped note templates | IN18–IN25 |
| 04.5 | Create/open investigation; collision-safe filenames | IN26–IN30 |
| 04.6 | Human-section-preserving refresh and note-link reconciliation | IN31–IN36 |
| 04.7 | End-to-end finding → note → evidence tests | IN37–IN40 |

**Out of Part 1:** clone-group inspection and symbol tracing (the deliverable's optional items, O1), an external-editor action (O5), automatic status sync (O6), and every deliverable non-goal (automatic deletion, "safe to delete" percentages, auto-fix, ticket sync, replacing a backlog plugin). Also out, as the brief says: M80/F14, M95, the spec §7 root-unavailable producer, Y19, Z38, the WP-03 follow-ups, and the owner's manual Part 7 check.

The plan's planning rulings (IP1…, in the ledger) refine these decisions where a decision names a behaviour and the code needs its exact shape; each such decision cites its ruling.

## 2. Owner decisions (2026-09-25)

| # | Decision |
|---|---|
| O1 | Part 1 covers all of 04.1–04.7. Clone groups and symbol tracing are deferred. |
| O2 | A new **Investigate** screen (route). Quality, File detail, the city file inspector and Architecture open it on the same finding. |
| O3 | **Notes are the record.** A note is linked to its finding by its own frontmatter (`codebase_id` + `finding_fingerprint`), read through Obsidian's metadata cache. No link table; the review format stays v2. |
| O4 | **A folder setting plus a confirm dialog.** The setting holds a vault folder; creating a note shows the folder and filename, both editable and validated, and writes nothing until confirmed. |
| O5 | **No external-editor action** in Part 1. Source actions are the read-only preview and, for a Markdown file inside the vault, Open in Obsidian. |
| O6 | **Independent status.** The note's `status` is the user's own; the workbench shows it next to the review disposition and the file's work items, and offers Add work item pre-filled from the finding. Nothing syncs automatically. |
| O7 | **Notes may be written inside the codebase root**, after an explicit checkbox that also adds the folder to the scan exclusions (IN29). The README and the two storage disclosures are reworded to say so (IN41). |

## 3. Architecture

- **Pure application code** in `src/application/investigation/` (no Obsidian, no Node, **no copy**): note text escaping, names and folder validation; the note model, evidence block and marker splice; the stale-location rule and the source-preview service; the note-index reducer. The note's headings and prompts are one `NOTE_VOCABULARY` in `src/ui/audit-copy/investigation.ts`, passed in as an argument (IP3). `mdCode` moves verbatim from `src/ui/export/markdown.ts` to `src/application/markdown-code.ts` and is re-exported from the old place (IP2).
- **One application port**, `InvestigationNotesPort` (`src/application/ports/investigation-notes-port.ts`), with eight members: `list`, `create`, `refresh`, `open`, `subscribe`, plus `destination(codebaseId)` (the folder and whether it is the default), `plan(folder, baseName, rootPath)` (validation, the final collision-free name and the overlap, **without writing**) and `sourceNotePath(rootPath, relativePath)` (IN12) (IP12). Its implementation is `src/host/investigation-notes.ts` and `src/host/investigation-note-index.ts` (Obsidian `Vault`, `MetadataCache`, `FileManager`, `Workspace`, `stringifyYaml`), which registers its events through `plugin.registerEvent` on first use, never in `onload`.
- **The source preview** is an application service over the existing `SourceFileSystemPort` (`stat`, `readText(abs, maxBytes)`), wired by the host with the Node adapter.
- **UI**: a new route `investigate`, `src/ui/screens/InvestigateScreen.vue` and `src/ui/screens/investigate/*`, a read model `src/ui/read-models/investigation.ts`, a per-leaf session store `src/ui/stores/investigation-store.ts`, the city panel `src/ui/screens/city/CityFindingsPanel.vue`, and copy in `src/ui/audit-copy/investigation.ts` (re-exported through `inspector-copy.ts`). Ports reach the UI through `src/host/data-ports.ts`, as `fallowAnalysis` does.
- **Durable state:** one new `data.json` key, `investigations: { [profileId]: { folder: string } }` (IN18), owned by `src/adapters/storage/plugin-data-investigation-store.ts`. `CityViewState` gains nothing but the new `route` value.
- The plugin is `isDesktopOnly` (`manifest.json`). The preview's `unavailable` state for a missing filesystem adapter is kept as a defensive state and is reachable only in tests.

## 4. Decisions

### 04.1 Finding list and stable selection

- **IN1 — List source.** The Investigate list shows exactly Quality's findings (`buildQualityModel`): every category fallow reports (complexity, duplication, unused exports, cycle, boundary, unresolved import), counted once, on their anchor file. Without a report the screen shows the existing "no report" empty state with the Data & scans action; it never shows sample findings.
- **IN2 — Filters (IP19).** Free-text query, Type (`FINDING_KIND_LABEL`), **Rule** (new to this screen: the rules present, labelled `RULE_TEXT`), the tool's Severity ("Not rated" when fallow gives none), review Status (default `all`), and **Note** (has a note / no note). Quality's Module filter is not carried. Rows page by 100 with Show more.
- **IN3 — Order.** fallow's severity (`critical`, `high`, `moderate`, any other string by code unit, then not rated), then category order, then path, then line (a finding with no line after every numbered one), then finding id, all by code unit (J3): a total order, so the list never reshuffles between renders.
- **IN4 — Stable selection.** Selection is the finding's fingerprint, held per leaf in `investigation-store` (session only, never persisted). A re-import that still reports the fingerprint keeps the selection; one that does not clears it and shows `INVESTIGATE_FINDING_GONE`, which says its notes are listed under Notes for findings not in this report (IN34). An entry point that selects a finding the current filters hide resets the filters so the row is listed. Selecting in Investigate changes neither the city selection nor the camera; only Open file detail selects the anchor (IP20). The store resets synchronously when the bound codebase changes (IP37).
- **IN5 — Entry points (O2, IP33, IP34).** One `useOpenInvestigation()` opens Investigate on a fingerprint from: a sibling **Investigate** button after each File detail finding row's Review button; the Quality review dialog's links row; every Architecture cycle row and fallow boundary row, beside Review finding; and a new city inspector **Findings** section (`CityFindingsPanel.vue`, shown only while a report is attached: anchored findings, then related ones marked "Reported on <anchor>", at most 10 and then "N more on Investigate"). "A city finding opens the same evidence in the workbench" is pinned by a component test that clicks a city row and asserts the evidence panel shows that finding's id, rule, path and line.
- **IN6 — Route and list model.** `ROUTE_IDS` gains `'investigate'` before `'workbench'`; the Act nav reads Investigate, Refactor workbench, Audit report; icon `search` (IP21). `isRouteId` already guards persisted state. The list follows `CodebaseFileList.vue`'s model: native row buttons with one roving tab stop, arrows move focus and never select, Enter or click selects, `aria-current` on the selected row (IP18) — so focus movement never triggers a read (IN13).

### 04.2 Bounded source preview and stale locations

- **IN7 — What is read (IP14, IP15).** Only the selected finding's anchor file, only on selection or Reload. The root is the codebase's **live binding on this device**, and only when it equals the snapshot's `scope.rootPath`; otherwise the state is `no-binding` ("not connected on this device, or now points to another folder"). The limit is `min(snapshot.scope.maxFileBytes, 512 KiB)`. The path is the root plus the entity's POSIX path, checked with `normalizeRelativePath` and `isContained`. The service stats first: missing, a symbolic link or junction as the file or any parent below the root (`outside-root`), not a file, too large; only then `readText`. Nothing is written, ever.
- **IN8 — What is shown (IP16).** Up to 20 lines before and after the finding's line, clipped at the file's edges; a line past the end shows the last 41 lines; no line shows the first 41. Lines split on LF with an optional CR; the line count uses the scan's own `countPhysicalLines`. Each line is cut at 400 code points with a visible "…". Rendered as text in a `<pre>` through interpolation: no `v-html`, no highlighter, no links. C0 controls except tab, DEL, C1 and the bidi/format controls show as `\uXXXX`.
- **IN9 — Unavailable states,** each with its own copy, never an empty preview: no binding (or a changed root), outside the root, not a file, too large, binary, not UTF-8, missing, read error, and (defensive) no filesystem.
- **IN10 — Stale-location rule (IP17).** The exact line highlight is shown only when every check holds, in this order: (1) the report is attached to the current snapshot (not Y30-stale); (2) the file's current size equals the snapshot's `byte-size` observation; (3) its line count equals the `physical-lines` observation; (4) its mtime is not later than the analysis time (`collected.startedAt` for a collected report, `importedAt` for an imported one — an upper bound, and IN15 says so); (5) the line is within the file. Otherwise the window is still shown, with no highlight and `PREVIEW_STALE_LOCATION` naming the first failed check and whether it failed as `changed` or `unknown`. An unknown input fails towards stale, never towards exact. A finding with no line gets its own `no-line` verdict, never exact.
- **IN11 — A snapshot of now.** The preview says when it was read and never re-reads in the background; Reload re-reads.
- **IN12 — Open in Obsidian (O5).** Offered only when the anchor file is a `.md` file inside the vault: the host's `sourceNotePath(rootPath, relativePath)` returns its vault path when the vault base path contains it and `vault.getFileByPath` finds it. Code files are never presented as notes.
- **IN13 — One read per selection (IP39).** Reads happen only in the store's `readPreview`, on a selection change or Reload; each read takes a token and a stale token's result is dropped. Re-imports and list renders never read.

### 04.3 Evidence bundle and uncertainty/verification panel

- **IN14 — Evidence bundle.** For the selected finding: kind, rule and threshold (fallow's words), severity, anchor path and line, Also involves paths, the import-cycle path for a cycle, provider and version, origin (imported or collected) and time, snapshot id, evidence state (collected or stale), review disposition with reason, work items on the file, and the linked notes with their `status` ("No status" when absent, IP38). Every report value is interpolated text.
- **IN15 — Uncertainties** are generated factual statements, never scores: static analysis only (not execution evidence); the stale-location verdict (IN10), or "the line was not checked" before a preview is read; a stale report (Y30); an imported report's unknown analysis time; the partial relation graph for cycle, boundary and unresolved findings (`RELATIONS_SCOPE_NOTE`); "Not rated" severity; and one caveat per category (an unused export may be used dynamically or outside the scanned folder; duplication is textual similarity above fallow's threshold; complexity is a threshold on a metric; an unresolved import may be an alias fallow did not resolve).
- **IN16 — Verification checklist.** Per category, 2–4 suggested checks (e.g. unused export: "Search the whole repository, including other packages, for the symbol"; cycle: "Confirm each import in the cycle path still exists"). They seed the note's checklist at creation and are the user's text after that.
- **IN17 — No fabricated confidence; Add work item (IP22).** No percentages, no "safe to delete", no invented risk (Z23). `WorkItemEditor.vue` gains an optional `draft: { title; notes }` prop, used in create mode only; Investigate opens it with `Investigate <finding id> in <file name>` and plain-text notes (kind, rule, path, line). The one-refactor-item-per-file rule (Q4) is unchanged.

### 04.4 Destination, settings and escaped templates

- **IN18 — The setting (O4, IP11, IP27).** Per codebase, **Investigation notes folder**, in the Obsidian settings tab right after Excluded paths. Stored in `data.json` `investigations[profileId].folder`. Default when absent: `Codebase investigations/<sanitised profile name>`, or `Codebase investigations` when the name sanitises to nothing. A renamed profile changes the default for later notes only. Removing a profile purges its entry (after its analyzer purge); its notes stay in the vault. The inspector Settings screen shows the folder read-only under Privacy & storage.
- **IN19 — Folder validation (IP10).** Vault-relative, POSIX, through the project's `normalizeRelativePath` (not Obsidian's `normalizePath`): problems are `empty`, `not-relative`, `too-long` (over 200 code points), `config-dir` (`app.vault.configDir` or inside it, case-insensitive) and `unsafe-name` (a segment IN21 would change); trailing slashes are dropped first; the vault root is not a valid folder. An invalid setting is refused with its reason and the previous value kept. A hand-edited `data.json` value is shape-checked on read and fully validated in the dialog. Editing the folder in the dialog affects that note only.
- **IN20 — Frontmatter (IP4).** Exactly: `type: codebase-investigation`, `codebase_id` (profile id), `entity_id` (`file:<source_path>`), `source_path` (POSIX, root-relative), `snapshot_id`, `finding_id`, `finding_fingerprint` (the portable `<source_path>#<finding_id>`, the review export's `findingRef`), `provider: fallow`, `status: open`, `created` (ISO time). Serialised by Obsidian's `stringifyYaml` over an object of strings. Never a machine root, an absolute path, a NUL-joined in-memory id or a command.
- **IN21 — Filename (IP9).** `<finding id> <short title>.md`, the title being the kind label and the anchor file name. Sanitising removes `\ / : * ? " < > | # ^ [ ]`, control and bidi characters and leading dots, strips trailing dots and spaces, collapses whitespace, and cuts to 100 **code points**; an empty result becomes the finding id alone. A Windows reserved stem gets `_`, with or without an extension (`CON` → `CON_`, `nul.backup` → `nul_.backup`).
- **IN22 — Body.** Headings in this order: Context; Observed finding; Source, scope and time; Uncertainties; Investigation notes; Proposed change; Verification checklist; Decision. The first four are generated inside one evidence block; the last four are human sections, seeded once (the checklist from IN16, the others with a one-line italic prompt). The block never holds the review disposition or work items (IP23).
- **IN23 — The evidence block (IP7).** Delimited by `<!-- codebase-inspector:evidence:begin -->` and `<!-- codebase-inspector:evidence:end -->`, each a whole line (a CR before the LF is tolerated; an indented or trailing-space marker counts as edited). Refresh replaces only what lies between them (IN31).
- **IN24 — Escaping (IP5).** Every report- or user-derived string in the body goes through one function, `noteText()`: it flattens line breaks (CR, LF, U+2028, U+2029) and tabs to spaces; replaces C0/C1 and bidi/format controls with U+FFFD; caps the value at 256 code points; escapes `\ ` * _ [ ] < > # | ~ = $ % ^ ! { } & :` and the `.` of `www.`; and escapes a leading `-`, `+`, `N.` or `N)`. So no string can open a link, auto-link, embed, tag, HTML tag or comment, math, highlight, callout, block id, table or list. Paths and symbols go in code spans through `mdCode()`. A string holding a marker cannot open or close the block, because `<` is escaped.
- **IN25 — Size (IP6).** The block is at most 16 KiB UTF-8: it renders through a shrink ladder (50 list entries and 256 code points per value; then 20/256; 5/128; 0/64) and uses the first result within the bound. The last step is within the bound for any input.

### 04.5 Create and open

- **IN26 — The create dialog (O4).** Shows the folder (IN18) and the base name (IN21, with `.md` shown as a suffix), both editable and re-planned through `plan()` on every change, and the final vault path. When the folder resolves inside the codebase root (IN29) it shows the checkbox **Exclude this folder from scans**, checked. Create is `aria-disabled` with a guarded handler while invalid or while a write is in flight (E40). Creating does not open the note; the notes panel lists it and focus moves to its Open button (IP24).
- **IN27 — Never overwrite (IP9).** A name is taken when `getAbstractFileByPath` finds it or its folder has a child whose name matches case-insensitively; a taken name gets ` (2)` … ` (99)`, shown before confirm. The write is `vault.create`, whose failure on an existing file (a race) is reported; nothing is retried silently.
- **IN28 — Folders.** Missing folder segments are created with `vault.createFolder`, one at a time, after confirm; an existing segment is matched case-insensitively and its own case used; a segment that exists as a file refuses the create (`folder-is-file`).
- **IN29 — Inside the codebase root (O7, IP26).** Overlap means only "the note folder, joined to the vault base path, is inside the binding root". Then, if the box is checked, the folder's root-relative path is added to the profile's exclusions through the existing profile store (so the next scan's scope fingerprint changes and asks for approval, as any exclusion change does), unless it or a parent is already excluded. A failed exclusion keeps the note and says so. A folder **equal** to the root offers no checkbox and says the note will appear in the next scan (an empty exclusion would exclude everything). fallow is never asked to skip anything: it does not analyse Markdown.
- **IN30 — Open.** A linked note opens with `workspace.getLeaf(true).openFile(file)`. With several notes for one finding, all are listed by path and the chosen one opens.

### 04.6 Refresh and link reconciliation

- **IN31 — Refresh (IP25).** **Refresh evidence** on a linked note shows a confirm dialog with the snapshot change (old from frontmatter → new), any source-path change, and the new evidence state and line (the old ones are not stored). On confirm, `vault.process` re-reads the note and, inside the callback, requires exactly one begin marker line followed by exactly one end marker line; it replaces only the text between them (with the begin line's line ending) and returns everything else byte-identical. Any other marker count or order refuses the refresh (`REFRESH_MARKERS_EDITED`) and returns the text unchanged.
- **IN32 — Frontmatter on refresh.** `processFrontMatter` sets `snapshot_id` and `source_path` only. The values of `status`, `created` and every key the user added are unchanged; their YAML formatting (comments, quoting) is re-serialised by Obsidian (IP8).
- **IN33 — Reconciliation (O3, IP13).** The host keeps an index `finding_fingerprint → note paths` per codebase from `metadataCache.getFileCache(file).frontmatter`, where `type` is `codebase-investigation`. It is an incremental reducer: `changed`, `rename` and `delete` update one entry; `resolved` rebuilds from `getMarkdownFiles()`; listeners hear only real changes. A note without a string `codebase_id` is ignored; one with other identity keys that are not non-empty strings of at most 2,048 characters is malformed and counted for its codebase. Renamed or moved notes stay linked; a deleted note disappears.
- **IN34 — A changed analysis is not completion.** A finding no longer reported keeps its notes listed under **Notes for findings not in this report**; refreshing one writes "Not reported by the current analysis" into its block; `status` never changes.
- **IN35 — No scan creates notes.** Notes are written only by the create and refresh dialogs.
- **IN36 — Counts.** The Note filter and counts read the index; a note whose finding is not in the report is counted separately, never dropped.

### 04.7 End-to-end tests

- **IN37 — A fake vault (IP29, IP30).** `tests/fixtures/fake-vault.ts`: an in-memory `Vault`, `MetadataCache` (with `changed`, `resolved`, `rename`, `delete`), `FileManager.processFrontMatter` and `Workspace.getLeaf`. `yaml` becomes an explicit devDependency (already installed through Vite); the Obsidian mock gains `parseYaml`, `stringifyYaml`, `TFile`, `TFolder`, `TAbstractFile` and `Plugin.registerEvent`. Tests assert parsed YAML values, never YAML bytes. The fixtures import neither `vitest` nor `node:*`, so the harness can bundle them.
- **IN38 — The spine (IP35).** In `tests/acceptance/`: the WP-03 relations project copied to a temp folder and scanned with the real Node port, its 3.27.0 recording attached → Investigate → preview (exact highlight) → create → the note parses back to the same `finding_fingerprint` → the index links it → edit the human sections → refresh with a new report → the human body sections are **byte-identical**, the user's frontmatter keys are **value-identical**, and the block is new.
- **IN39 — Safety tests.** Injection through the report text that reaches a note — a symbol, a specifier, zone names and a file path (there is no message field) — holding `[[x]]`, `![[x]]`, `<script>`, a marker comment, `#tag`, `$x$`, `%%`, `==x==`, `https://x`, `www.x`, a line break with `# h`, `1)` and bidi controls; traversal (`../`, absolute, drive letter, the config folder); collisions (exact and case-only); a vanished or doubled marker; and the preview reading a real temp directory with an fs snapshot showing no write under the codebase root.
- **IN40 — Harness captures (IP36).** `wp04-investigate-dark`, `-light`, `-narrow-dark`, `-stale-dark` and `-create-dialog-dark`, pinned in `tests/build/harness-shot.test.ts`.

### Disclosures

- **IN41 — Texts that change (O7, IP31, IP32).** `SETTINGS_STORAGE_TEXT` (`audit-copy/settings.ts`) no longer says no vault note is created or changed; it says investigation notes are ordinary vault notes written only when you create or refresh one. `STORAGE_DISCLOSURE_TEXT` (`setting-definitions.ts`) names the notes-folder setting and says removing a codebase never deletes its notes. The README's "never writes … anything in the directory you select" gains the exception: an investigation note you create in a folder inside that directory. `FILE_SOURCE_PREVIEW_LATER` is reworded to point at Investigate (File detail itself still reads no content, P9).

## 5. Acceptance (deliverable), item by item

| Acceptance | Decisions | Test |
|---|---|---|
| A city finding opens the same evidence in the workbench | IN4, IN5 | component: city row → workbench evidence |
| One well-formed note in the chosen folder, no source-project edit | IN20–IN29 | e2e spine; fs-diff test (a note inside the root is an explicit, confirmed exception, O7) |
| Existing notes are not overwritten | IN27 | collision (exact, case-only) and race tests |
| Filenames and messages cannot inject unsafe markup | IN21, IN24 | injection tests |
| Human sections survive evidence refresh | IN31, IN32 | e2e refresh test |
| Stale line → stale evidence, not an exact highlight | IN10 | stale-location unit and component tests |

## 6. Probe table (external facts)

| Fact | Source | Used by |
|---|---|---|
| `Vault.create(path, data)` creates a file (since 0.9.7) | `node_modules/obsidian/obsidian.d.ts:7386` (1.13.1 typings) | IN27 |
| `Vault.createFolder`, `getAbstractFileByPath`, `getFileByPath`, `getFolderByPath`, `read`, `process(file, fn)`, `getMarkdownFiles` | `obsidian.d.ts:7351–7543` | IN27, IN28, IN31, IN33 |
| `Vault.on('rename' \| 'delete')` | `obsidian.d.ts:7570–7576` | IN33 |
| `MetadataCache.getFileCache`, `on('changed' \| 'resolved')` | `obsidian.d.ts:4417–4471` | IN33 |
| `FileManager.processFrontMatter(file, fn)` | `obsidian.d.ts:2954` | IN32 |
| `stringifyYaml`, `parseYaml` | `obsidian.d.ts:6815, 4817` | IN20, IN37 |
| `Workspace.getLeaf(true)` | `obsidian.d.ts:7892` | IN30 |
| `FileSystemAdapter.getBasePath()` is the vault base path | `src/host/modals/source-modal.ts:145–147` | IN12, IN29 |
| `SourceFileSystemPort.readText(abs, maxBytes)` is bounded, binary-sniffing, fatal UTF-8; its failures carry a free-text reason | `src/adapters/filesystem/node-source-filesystem.ts` | IN7, IN9 |
| The plugin is `isDesktopOnly`, `minAppVersion` 1.13.0 | `manifest.json` | §3 |
| **Confirm at pre-flight (in real Obsidian 1.13 or its bundled parser):** (a) `vault.create` rejects when the path exists; (b) backslash escapes suppress wikilinks, embeds, tags, comments, highlights, block ids and math in reading and live-preview views; (c) `metadataCache` fires `changed` after `vault.process` and `processFrontMatter`; (d) how `stringifyYaml` quotes `yes`, `null`, `0012`, `a: b`; (e) whether `createFolder` creates parents | not stated in the typings | IN27, IN24, IN33, IN20, IN28. Each has a fallback in the plan: the pre-check (a), escaping plus code spans (b), the `resolved` rebuild (c), string-typed validation on read (d), segment-by-segment creation (e). |

## 7. Constraints carried

The WP-01 spec §4 frozen contracts (the only change is the `RouteId` value, an additive vocabulary entry guarded by `isRouteId`; three tests that pin route and nav counts are edited in place); the WP-02 Part 1–7 and WP-03 Part 1 specs; every ledger; the 400/450 line caps; the city-view budget (`city-view.ts`, `CityWorkspace.vue` ≤ 360; `CityViewport.vue` never edited) and layering; E40; copy in audit-copy; CRLF files edited only with Edit/Write; explicit timeouts for slow scans; `npm run analyze` at 9; the literal trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>".

## 8. Limitations (known at design time)

- Stale detection is by size, line count and modification time, not content. For an imported report the analysis time is only bounded by the import time.
- A refresh re-serialises the frontmatter: the user's YAML comments and quoting style there are not kept (values are).
- The note index is per codebase and built from the metadata cache; a note written by another tool without the frontmatter keys is not linked.
- A note folder equal to the codebase root is scanned (it cannot be excluded without excluding everything).
- Clone groups, symbol tracing and an external editor are not in this part.
