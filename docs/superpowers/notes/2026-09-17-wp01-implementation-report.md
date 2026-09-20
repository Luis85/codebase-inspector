# WP-01 implementation report

Branch `feat/wp-01-codebase-city`. Written at task 13, the release gate.

This report records what WP-01 built and **what was actually verified, by whom or by
what**. Where a line of spec §10's definition of done has not been verified, it says so
in those words; it is not rounded up from adjacent automated evidence. The manual half
of this release — the clean-vault install and the scripted demo, run in a real Obsidian
by a person — is **checkpoint #4**, and every cell it owns is left as a marked blank
below rather than filled in from anything else.

Evidence is cited, never re-derived:
`2026-09-17-wp01-gate-evidence.md` (G2/G3/G4/G5/G8),
`2026-09-17-wp01-accessibility-matrix.md` (the fourteen-row matrix),
`2026-09-17-wp01-limitations.md` (what this increment does not do or does not know),
`2026-09-17-wp01-spike-report.md` and
`2026-09-17-setting-definitions-verification.md`.

---

## Gate status at this commit

| Gate | Status |
|---|---|
| **G1** — host distribution | **NOT PERFORMED** — it is checkpoint #4's own subject; see the G1 section below |
| **G2** — source safety and scope | **CLOSED** by the recorded evidence |
| **G3** — evidence truth | **CLOSED** by the recorded evidence |
| **G4** — lifecycle and accessibility | lifecycle half CLOSED; **accessibility half OPEN** |
| **G5** — performance | CLOSED for structure, **OPEN for real-host timing** — the figures are not GPU measurements |
| **G7** — accessibility | **OPEN** |
| **G8** — testing coverage | **CLOSED**, with the accessibility layer recorded as only partly run |

**13** of the matrix's **14** accessibility rows are **NOT PERFORMED**, in whole or in
part. Neither this document, nor the gate-evidence document, nor the matrix may be cited
as evidence that accessibility is gated.

---

## Definition of done (spec §10) — status, line by line

- [ ] **Installable build satisfies the real-root workflow for a VAULT-BASED project** —
      **NOT VERIFIED.** No human has run the demo against the vault itself in a clean
      vault. Checkpoint #4 owns it. Adjacent automated evidence: acceptance "Vault is
      the codebase", `tests/integration/vault-is-the-codebase.test.ts`.
- [ ] **… and for an EXTERNAL project** — **NOT VERIFIED.** Checkpoint #4 owns it.
      Adjacent: the whole `tests/integration/**` layer runs against real temporary
      directories outside any vault.
- [x] **Measurements match fixtures** — **MET, automatically.** `src/domain/metrics.ts`'s
      physical-line definition and its unit tests (`tests/unit/metrics.test.ts`), the
      twenty-obligation contract suite run against both the fake port and the real Node
      adapter, and the walker fixtures listed in G2's boundary table.
- [x] **Scanning changes no file in the inspected project** — **MET.** G2's no-write
      record: SHA-256 plus size and mtime of every file, directory and symlink, compared
      as one whole-tree equality before and after a scan, at 1,000 files, in a fixture
      that is itself a vault with this plugin installed. **0** differences in every run.
- [ ] **The accessibility matrix passes** — **NOT MET, and not close.** **13** of the
      **14** rows are NOT PERFORMED; exactly **1** is fully PASSED and **4** more have a
      PASSED jsdom half with an unperformed manual half. See
      `2026-09-17-wp01-accessibility-matrix.md` and the GATE STATUS block in
      `2026-09-17-wp01-gate-evidence.md`.
- [~] **The lifecycle checks pass** — **PARTLY.** The automated half is closed:
      `tests/host/lifecycle-leaks.test.ts` (no orphan canvas, observer, timer, handler
      or render loop; ten open/close cycles leaving zero live WebGL contexts) and
      `tests/component/renderer-disposal.test.ts`. Checkpoint #3 was closed by the user
      with "this looks better now. proceed" and a screenshot, after three reported
      defects were fixed — but the user did **not** walk every row and did not say they
      had. Six rows remain unitemised by a human; they are named in the gate-evidence
      document's checkpoint-#3 table and carried into the limitations document.
- [x] **Benchmark results are recorded** — **MET as a record, not as a claim.** G5's
      table, with its reference hardware, and the explicit statement that the figures
      are **not GPU measurements** and that the Electron/Chrome row is deliberately
      empty because nobody measured the user's host.
- [x] **Limitations are recorded** — **MET.** `2026-09-17-wp01-limitations.md`.
- [x] **Every VISIBLE command and setting is implemented** — **MET**, and enumerated
      below, with the enumeration machine-checked against `src/host/commands.ts` and
      `src/host/setting-definitions.ts` by `tests/host/clean-vault-install.test.ts`, so
      it cannot silently drift.
- [x] **The README discloses out-of-vault reads, no network use and no telemetry** —
      **MET**, and each of the three disclosures is asserted by
      `tests/host/clean-vault-install.test.ts`, which also sweeps `src/` for every
      network API. **Read the next paragraph before quoting the no-network line**: the
      shipped bundle carries two `new XMLHttpRequest` that `src/` does not, in dead
      vendor code. They are pinned by `tests/host/build-output.test.ts` and recorded in
      `2026-09-17-wp01-limitations.md`.
- [x] **A recognised LICENSE file is present** — **MET.** MIT, at the repository root,
      asserted by the same file.

`[~]` marks the one line that is partly met and is reported partly met rather than
ticked.

---

## The two factual claims

**"Read-only source access"** and **"Source remains unchanged."** ship at two sites:
`src/host/modals/scope-modal.ts`, the consent artefact where the claim is made *before*
the read, and `src/ui/components/SnapshotStatus.vue`, the persistent status line where
it is made *after*. Both are defined once in `src/ui/copy.ts` as `CLAIM_*`, not as
catalogue microcopy, precisely because they are assertions about what this software does
to someone's files. Each site carries a comment citing the evidence.

**The evidence that earns them** is section G2 of
`docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`, and it is three things, not
one:

1. **A whole-tree fingerprint diff** — SHA-256, size and mtime for every file, plus a
   fingerprint for directories and symlinks so a new empty directory or a re-pointed
   link is caught too — taken before and after a real scan and compared as a single
   equality. Run at full scale against a 1,000-file fixture that is a vault with this
   plugin's own `main.js`, `manifest.json` and `styles.css` installed, alongside another
   plugin's `data.json`, a `.git`, a `node_modules` and a `.env`. **0** differences.
2. **A read log that proves the absence of a READ, not absence from an interface.** The
   port records every path it opens — `walk`'s per-entry `onOpen`, `readText` and `stat`
   all append to one shared log, and the contract suite asserts the fake and the real
   adapter log identically. Excluded paths never appear in it: `.env`, `.git`,
   `node_modules`, another plugin's `data.json`, this plugin's own `data.json`, and the
   **actual** `vault.configDir` — proved with a deliberately non-default `.my-config` as
   well as `.obsidian`, and with the wrong name passed so that "we exclude the
   configured directory" is distinguishable from "we exclude a directory that happens to
   be called `.obsidian`". Every check has a positive control, because an empty log
   satisfies every absence trivially.
3. **A structural proof that nothing in the shipped source can spawn a process**: the
   acceptance step reads every `.ts`/`.vue` file under `src/` and fails on
   `child_process`, `execFile`, `spawnSync`, `spawn(`, `execSync` or `npm install`, with
   the file count asserted so the sweep cannot go vacuous.
   `src/adapters/filesystem/node-access.ts` is the only file in `src/` that reaches Node
   at all, enforced by `tests/unit/node-access-boundary.test.ts`.

**The standing condition on the claims.** If the G2 record ceases to hold, the claims
come back out. One decision is open against it: ruling M108's speed-versus-cancellation
trade (see the limitations document) would change the shape of the read-log property.

---

## Which test layers actually ran

Reproduce with `npx vitest run`; per-layer figures with `npx vitest run <directory>`.
This table is a **copy** of the G8 table in
`docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`, and
`tests/host/clean-vault-install.test.ts` asserts the two are identical, so the copy
cannot drift from the original.

<!-- g8:table:start -->

| Layer | Directory | Files | Ran | Tests | Notes |
|---|---|---|---|---|---|
| Unit | `tests/unit/**` | 40 | yes | 478 | domain, application, UI stores, interaction state, stylesheet-as-contract (comments stripped — see below), and this table's own guard |
| Contract | `tests/contracts/**` | 2 | yes | 40 | **one suite, two implementations** — `source-filesystem-port.contract.ts` runs against the fake port and the real Node adapter, so they cannot drift |
| Integration (real temp dirs) | `tests/integration/**` | 8 | yes | 25 | 24 passed + **the one skip**, the file-symlink environment gate. Walker, walker bounds/content/symlinks, scan lifecycle, read log, no-source-writes (including the 1,000-file full-scale proof), vault-is-the-codebase |
| Component (jsdom) | `tests/component/**` | 31 | yes | 303 | against **our** controls: the file list, search, inspector, camera controls, viewport, status surfaces, announcements, both modals, the settings tab, the renderer contract and disposal, (task 5) the toolbar's Scan control, and (task 7) the canvas header |
| Host (Obsidian doubles) | `tests/host/**` | 10 | yes | 114 | real `CityView` instances over doubles for what Obsidian provides: plugin onload, commands, multi-leaf, lifecycle leaks, window migration (against a genuinely separate jsdom realm), build output, and task 13's clean-vault install — the scriptable half of G1, which also holds the checkpoint-#4 checklist to the controls and keys `src/` actually ships. **This is the layer the rest of this document leans on most heavily** |
| Acceptance (21 + 3 repairs) | `tests/acceptance/**` | 1 | yes | 26 | 24 scenarios plus 2 structural guards (the feature file carries all 21 ported scenarios and the three repairs and nothing else; no step definition is unused) |
| Benchmark | `tests/benchmarks/**` | 1 | yes | 5 | reference hardware recorded above; **not a GPU measurement**, and this document says so in the same table as the numbers |
| Harness | `tests/harness/**` | 1 | yes | 6 | task 0b: keeps the browser dev harness (`npm run harness`) alive under the ordinary suite — pins the three-stylesheet load order, that `/styles.css` is served from `src/ui/styles.css` on disk rather than a build, the fixture's shape and determinism, and that scheme classes land on `<body>` and nothing else. Not a screenshot test: nothing here asserts what gets drawn, and headless-browser drawing is out of jsdom's reach — see the harness task's own report for what step 10 saw with real eyes |

| Build | `tests/build/**` | 1 | yes | 6 | task 0c: pins `scripts/harness-shot.mjs`'s `SHOTS` coverage (all seven city screens, including S11's two distinct entry paths -- the list-only fallback and a genuine WebGL failure) and `scripts/chromium.mjs`'s own browser-resolution rule (`executablePath()`, asked of playwright-core, never a hand-mirrored per-platform path). Not a screenshot test itself -- see the task's own report for what `npm run harness-shot` produced with real eyes |
<!-- g8:table:end -->

| Layer | Ran | Notes |
|---|---|---|
| Accessibility | **partly — G4/G7 remain OPEN** | the jsdom rows ran and are listed in `2026-09-17-wp01-accessibility-matrix.md`; **every manual row is NOT PERFORMED**. It is a checklist a human has not yet worked, not a directory of tests |

Three properties of the suite a reader should not have to discover:
the `mayPublish` supersession guard is **unreachable by construction** and is pinned by a
source-as-contract tripwire that **is not coverage**; stylesheet-as-contract tests strip
CSS comments, because one on this branch once passed with its own defect reinstated; and
`npm run analyze` **exits non-zero by design** with an accepted baseline of **11**
findings and is a review list rather than a gate. All three are set out in the
gate-evidence document.

---

## G1 — Host distribution

**G1 cannot be satisfied by the development vault.** `C:\Projects\renovation-planner` is
a working checkout with other plugins installed — a realistic host and a useful external
codebase to inspect, but **not isolated**. G1's evidence comes from step 2's brand-new
throwaway vault and from nowhere else.

What is established here, from the tree:

| Fact | Value | How it is known |
|---|---|---|
| Plugin id | `codebase-inspector` | `manifest.json`; asserted by `tests/unit/manifest.test.ts` and `tests/host/clean-vault-install.test.ts` |
| Plugin name | `Codebase Inspector` | `manifest.json`; asserted as above |
| Desktop-only | `true` | `manifest.json`; asserted by `tests/unit/manifest.test.ts` |
| Declared `minAppVersion` | `1.13.0` | `manifest.json`, and `versions.json` maps `0.1.0` → `1.13.0` |
| Release files | `main.js`, `styles.css`, `manifest.json` — nothing else | `scripts/assert-bundle.mjs` on every build; `tests/host/build-output.test.ts` |
| Built from | a clean `npm ci` against the committed `package-lock.json` (475 packages, 0 vulnerabilities), then `npm run build` | run at this commit |
| Artefact size | `main.js` 781,437 bytes; `styles.css` 21,525 bytes; `manifest.json` 300 bytes | the build above |
| Runtime module resolution | the bundle contains exactly **one** bare `require()` specifier, `obsidian` | `tests/host/build-output.test.ts` |

**Dependency licenses — verified, at the versions in `package-lock.json`.** Only these
four reach the shipped bundle:

| Package | Version | License |
|---|---|---|
| `three` | 0.186.0 | MIT |
| `vue` | 3.5.43 | MIT |
| `pinia` | 4.0.3 | MIT |
| `zod` | 4.6.5 | MIT |

Vue's own runtime packages (`@vue/runtime-core`, `@vue/runtime-dom`, `@vue/reactivity`,
`@vue/shared`) are MIT at the same version and ship inside `vue`. `@vue/devtools-api` is
**not** in the production bundle. The project's own license is MIT (`LICENSE`).

**Host and runtime versions, all three of them, and which claim rests on which.**

| | Version | What rests on it |
|---|---|---|
| Obsidian on the development machine | **1.12.4** | every `obsidian.asar` reading on this branch, including the host-control names in the checkpoint checklist below and the stylesheet-cascade facts in `tests/unit/host-cascade.test.ts` |
| `obsidian` types package | **1.13.1** | every API-shape claim in this report and every `d.ts` the build type-checks against |
| The user's host | **1.13.7**, Electron **39.6.0**, Chrome **142.0.7444.265** | nothing here — no measurement and no reading was taken on it. It is the host the checkpoint #4 run will actually use, and the one a real performance figure would have to come from |

**The documented `minAppVersion` was NOT tested.** Stated as a gap rather than closed:
`1.13.0` itself has not been run — 1.12.4 is below the declared minimum and 1.13.7 is
above it, and there is no 1.13.0 anywhere on this machine (the cached updater carries
1.12.4 too). The human at checkpoint #4 records which version they actually used; the gap
between that version and `1.13.0` remains.

**Current community submission policies: NOT REVIEWED.** No policy page was fetched or
read during this cycle, and none is quoted anywhere in this branch. Submission is not a
goal for WP-01, and whether the community directory's build verification accepts a
`dist/` output remains a carried-forward §11 question.

### To be filled in by the human at checkpoint #4

Nothing below is filled in from anything else. A blank that stays blank is a gate that
stays open.

| G1 item | Result |
|---|---|
| Brand-new throwaway vault (name / path) | ☐ ____________________ |
| Other plugins installed | ☐ NONE — confirmed / ☐ other: ____________ |
| Only the three files copied in, by hand | ☐ confirmed |
| No dev server, no network, no source checkout, no runtime package install | ☐ confirmed |
| Plugin appears with id `codebase-inspector` and name `Codebase Inspector` | ☐ confirmed |
| Marked desktop-only in the host's own UI | ☐ confirmed |
| Enables with **no console error** | ☐ confirmed / ☐ errors: ____________ |
| Obsidian version actually used | ☐ ____________ (declared minimum is `1.13.0`) |
| Date | ☐ ____________ |

---

## Every visible command and setting

Nothing renders that does nothing (spec §1). The two lists below are checked against the
source by `tests/host/clean-vault-install.test.ts`: the command list must equal the ids
`src/host/commands.ts` registers, and the settings list must equal the rows
`src/host/setting-definitions.ts` builds. Adding a control without listing it here, or
listing one that does not exist, reddens that file.

**Commands** — registered without the plugin-id prefix:

<!-- checkpoint4:commands:start -->

- `open-city` — "Open codebase city". Always visible; opens a NEW city tab every time.
- `scan-codebase` — "Scan codebase". Always visible (ruling M36); acts on the active
  city view, and does nothing observable when there is none.
- `cancel-scan` — "Cancel scan" (COPY-09). **Hidden from the palette unless the active
  view actually has a run to cancel** — its `checkCallback` returns false otherwise.

<!-- checkpoint4:commands:end -->

No hotkey is registered for any of them. A host shortcut is therefore never shadowed by
a plugin-wide binding, and there is no keybinding for the human to look for.

**Settings rows** — the whole surface is declarative (`getSettingDefinitions`):

<!-- checkpoint4:settings:start -->

- `Codebase profiles` — the list heading, with an empty state and a delete action.
- `Add profile` — the list's add action.
- `Name` — per profile; shown in the profile list.
- `Excluded paths` — per profile; one relative path per line. **Not patterns**: the walk
  does exact segment and prefix matching, and a `*` or `?` is refused with a visible
  reason.
- `Maximum file size to read` — per profile; larger files are skipped, never truncated.
- `Source folder` — per profile; renders as Connect, Reconnect (with COPY-28 when the
  saved directory is unavailable on this machine) or Clear binding, each wired to a real
  enabled callback.
- `Follow symbolic links` — **static explanatory text with no control at all**, because
  links are never followed. A disabled toggle would be a rendered control for
  unimplemented behaviour.
- `Storage` — static explanatory text: profiles and bindings are stored in this vault,
  in this plugin's own data file, and nothing about them is sent anywhere else.

<!-- checkpoint4:settings:end -->

---

## CHECKPOINT #4 — what the human must do

**This is the release gate. It runs in a brand-new throwaway vault with no other
plugins.**

**How far the names below are checked, exactly.** `tests/host/clean-vault-install.test.ts`
asserts that every control **this plugin ships** appears as visible text in `src/`, that
every key appears in a handler there, that the command and settings lists equal what
`src/host/commands.ts` and `src/host/setting-definitions.ts` actually build, and that
every control **Obsidian provides** appears byte-exactly in the installed host's own
`obsidian.asar`. It also refuses to let this section name a control **in prose** without
that name appearing in one of the `checkpoint4:` lists — the controls, host-controls and
keys lists below, plus the command and settings enumerations above — because round 1 did
exactly that, and shipped a command ("Reopen last closed tab") that Obsidian does not
have.

**The rule, exactly as the test implements it.** A control named in this section is
written in single-asterisk emphasis; ordinary emphasis here is written in bold. Every
single-asterisk phrase in this section must either appear in one of the `checkpoint4:`
lists, **or be this plugin's own name** — which is not a control at all, comes from
`manifest.json`, and is checked against it separately by the same file. The phrase is
matched **across a line break**, so a name that happens to wrap at the right margin is
checked exactly like one that does not. (Fix round 1's version of this guard forbade a
newline inside the phrase, and two of this document's own names already wrapped that way
and were invisible to it. A guard whose stated scope is wider than its real scope is the
same overclaim this document exists to avoid, one level in.)

**What that guard still does not cover, plainly.** A control named here with **no
emphasis at all** is outside it, and so is one written with **underscore emphasis** —
`_Undo close tab_` is invisible to a sweep that reads asterisks, which is the same escape
the evidence documents' own Numbers block lists as (c). In both cases the convention is
the whole of the mitigation: **use asterisks in this section, or put the name in a list.**
And the
host-control half is **machine-dependent**: it scans the Obsidian installed where the
suite runs, so on a machine with no Obsidian — CI, or any non-Windows box, where the
install path cannot even be formed — that scan **does not run at all** and those three
names go unchecked; the test then asserts only that this document still records the
version they were verified on. On this machine it runs, against 1.12.4.

### Step 2 — install into a throwaway clean vault

1. Create a **brand-new vault** in an empty directory. Open it once, and add **no**
   plugins, no themes and no snippets.
2. Create `<vault>/.obsidian/plugins/codebase-inspector/` **by hand** — the folder name
   must be exactly the manifest id or `onExternalSettingsChange` never fires.
3. Copy in exactly three files from this repository's `dist/`: `main.js`, `styles.css`,
   `manifest.json`. **Copy them by hand.** Do not use the repository's development
   install script: it also writes a `.hotreload` marker, which is a development
   affordance and has no place in this vault.
4. Enable *Codebase Inspector* in *Community plugins*. Open the developer console before
   enabling and keep it open.
5. **Pass:** it appears as *Codebase Inspector*, is marked desktop-only, enables with no
   console **error**, and the vault contains no other plugin. A Three.js **warning**
   about "multiple instances" on a re-enable is expected and is not a failure — the
   limitations document explains why its claim is false.

### Step 3 — the scripted demo, run twice

Run the whole sequence first against a **real external repository**, then again with
**the vault itself** as the source.

Controls you will use (each ships; each is verified to exist):

<!-- checkpoint4:controls:start -->

- `Select a codebase` — the welcome action, shown when no source is selected.
- `Review scope and read access` — COPY-04, the scope modal's own TITLE and nothing
  else. Its confirm button is *Scan codebase*, below; do not look for this string on a
  button.
- `Read-only source access` — the claim on the consent screen and in the status line.
- `Source remains unchanged.` — the second claim, at both the same places.
- `I approve read access to this directory for this scan.` — the acknowledgement
  checkbox. It starts **unchecked**, and Scan stays disabled until it is checked.
- `Scan codebase` — the scope modal's confirm button, and the command of the same name.
  A **refresh** is started from the *Command palette*, or by going through *Select a
  codebase* again; there is no separate on-screen Refresh button.
- `Cancel scan` — **a command-palette entry, not an on-screen button.** No component
  renders a cancel control; the palette entry is hidden unless the active view has a run
  in flight. Do not hunt for a button.
- `Search files or paths` — the search field.
- `List view` — toolbar toggle; switches to the HTML list and **destroys the WebGL
  context** rather than hiding it.
- `Return to city view` — the same toggle, the other way.
- `Files` — opens the file-list drawer; only meaningful on a narrow leaf.
- `Close` — closes that drawer and returns focus to its opener.
- `Snapshot retained from` — the age line shown on reopening a view.
- `The 3D view is unavailable. File inspection still works.` — COPY-14, if the renderer
  is unavailable. Seeing it is not a failure of the HTML path; it is the HTML path.
- `Continue` — the source modal's confirm button, after the radio choice and the typed
  path.
- `Open codebase city` — the command that opens a NEW city tab, every time.

<!-- checkpoint4:controls:end -->

Controls **Obsidian** provides, which this plugin does not ship and `src/` cannot
confirm. These were verified against Obsidian **1.12.4**, the host installed on the
development machine, by byte-exact scan of its own `obsidian.asar`
(`tests/host/clean-vault-install.test.ts` re-runs that scan against whatever host is
installed where the suite runs, and checks nothing here when there is none — see the
machine-dependence note above). **The user's host is 1.13.7 and was NOT checked** — no
1.13.7 install exists on this machine, and the cached updater carries 1.12.4 too. For
*Undo close tab* the label comes from the localisation key `undoCloseTab` and the command
is registered as `workspace:undo-close-pane`; the id is the thing to look for if a label
has moved.

<!-- checkpoint4:host-controls:start -->

- `Community plugins` — the Settings section where the plugin is enabled.
- `Command palette` — where *Scan codebase*, *Cancel scan* and *Undo close tab* are run
  from; this plugin registers no hotkey for anything.
- `Undo close tab` — `workspace:undo-close-pane`. Restores the closed leaf **with its own
  saved state**, which is what step 9 depends on.

<!-- checkpoint4:host-controls:end -->

Keys this plugin itself handles (Tab and Shift-Tab are the browser's own focus order and
are deliberately **not** in this list, because no source file reads them):

<!-- checkpoint4:keys:start -->

- `/` — focuses the search field, but only while this view owns focus and the target is
  not itself editable.
- `Enter` — in search, selects the first match **without moving the camera**; on the
  canvas, focuses the selected building.
- `Escape` — resolves exactly one layer per press: modal, then camera help, then a
  narrow-layout drawer (inspector or Files), then the query, then the selection. **The
  two drawer links apply only below 820 px**, where those panels really are overlays; on
  a wide leaf they are permanent columns, so Escape goes straight to the query or the
  selection and the inspector stays open. That is deliberate — a drawer that is not a
  drawer is not a layer — and is not a defect to report.
- `f` — Fit.
- `t` — Top, a toggle, so the 3D view is reachable again.
- `+` — zoom in.
- `-` — zoom out.
- `ArrowLeft` — orbit left; with Shift held, pan left.
- `ArrowRight` — orbit right; with Shift held, pan right.
- `ArrowUp` — orbit up; with Shift held, pan up.
- `ArrowDown` — orbit down; with Shift held, pan down.

Every camera key above acts **only** while the canvas itself has focus, and never with
Ctrl, Meta or Alt held, so a same-key host shortcut is never shadowed.

<!-- checkpoint4:keys:end -->

The sequence, and what a pass looks like:

1. **Select a real external repository** as the source. *Select a codebase* opens a modal
   with two radio choices — a folder inside this vault, or an absolute path — and a
   **typed text field** for the path; there is no native folder picker, which is why the
   keyboard-only run in step 6 can start here. Then *Continue*. **Pass:** the directory you
   typed is the one shown on the consent screen.
2. **Approve scope.** If the modal shows a scope error (an unusable exclusion or file-size
   value), Scan stays disabled until that is fixed too — that is correct, not a defect.
   **Pass:** the acknowledgement starts unchecked and *Scan codebase*
   is **disabled** until you check it.
3. **Scan.** **Pass:** it completes and a real city renders — buildings, districts,
   labels — not an empty stage.
4. **Find a known file** by typing part of its path into search and pressing `Enter`.
   **Pass:** the first match is selected and **the camera does not move**.
5. **Confirm its measurements** against an editor. Open the same file in any editor and
   compare its **physical line count** with the inspector's. **Pass:** they agree. The
   definition: CRLF is one separator, a trailing newline adds no phantom line, and blank
   and comment lines count.
6. **Complete the whole path with the keyboard only.** From step 1 to step 4 without
   touching the mouse. **Pass:** you never had to reach for it, and focus was visible the
   whole way. This is accessibility matrix row 1; record what you observe even if it
   passes.
7. **Complete the whole path in the HTML list with the 3D view off.** Press `List view`
   first; that unmounts the viewport and disposes the WebGL context rather than hiding
   it. **Pass:** every file is listed, a row activates and selects, the inspector still
   shows raw lines and bytes, and **no scan starts** — losing the renderer is never
   authorisation to re-enumerate the source.
8. **Cancel a refresh.** Start a second scan with the *Scan codebase* command, then run
   *Cancel scan* from the *Command palette* while it is still running. **Pass:** the
   previous city is still on screen with its **original** timestamp, and the notice says
   the incomplete result was discarded and names the time of the snapshot you still
   have.
9. **Reopen the view.** Close the tab and bring it back the way Obsidian restores a leaf
   — the *Undo close tab* command, id `workspace:undo-close-pane`. (Round 1 of this task
   called it "Reopen last closed tab", which Obsidian does not have; if the label ever
   differs on your host, the id is the stable thing to look for in Settings → Hotkeys.)
   **Pass:** the retained state is shown **with its age**
   ("Snapshot retained from …") and **no scan starts** on its own. Two things to know
   before you judge this step, both read out of `src/host/city-view.ts`: retention is
   keyed to **the view's own saved state** (`onOpen` looks the snapshot up by the
   `snapshotId` that view persisted), so a brand-new tab opened with *Open codebase
   city* correctly starts **empty** and that is not a failure; and the store is
   in-memory, so nothing survives an Obsidian restart. **If the reopened tab comes back
   empty, record it rather than treating it as a pass or a defect** — which reopen
   routes actually restore a custom view's state has not been confirmed by anybody.
10. **`git status` in the repository is clean.** **Pass:** no file changed. This is the
    observation that corroborates the two shipped claims in a real host.

Then repeat all ten with **the vault itself** as the source, and additionally confirm
that the **actual** `vault.configDir` was never read, that no other plugin's `data.json`
was read, and that `.git` was never read.

**Confirm those three by ABSENCE, using the search field**, not by looking for a skipped
row: an excluded directory is pruned **before** anything inside it is opened, so its
contents appear nowhere at all — not as files and not as skipped entries. Search for
`.obsidian` (or whatever this vault's config directory is actually called), for `.git`
and for `data.json`. **Pass:** no path under the config directory, no `.git` path and no
plugin's `data.json` is listed. The automated counterpart to this — a read log that
records every path the port opens, with positive controls so an empty log cannot satisfy
it — is the G2 evidence cited above; what you are adding is that it holds in a real host
against a real vault.

### What to record

| Item | Result |
|---|---|
| External demo, steps 1–10 | ☐ pass / ☐ fail at step ____ : ____________ |
| Vault-based demo, steps 1–10 | ☐ pass / ☐ fail at step ____ : ____________ |
| `git status` clean after the external demo | ☐ confirmed |
| Config directory, other plugins' `data.json`, `.git` never read | ☐ confirmed |
| Accessibility rows attempted (which, and what you saw) | ☐ ____________________ |
| Third-party theme tried (name it) | ☐ ____________________ |

**Stop and raise with the user if:** the plugin fails to enable in a clean vault; any
scanned file changes; either factual claim ships without its evidence; a visible control
does nothing; or a benchmark number is quoted anywhere without its reference hardware.

---

## Packet traceability (spec §9) — no packet's evidence was dropped

| Packet | Produced by | Evidence |
|---|---|---|
| IP-01 Consolidate contracts | 2 | `src/domain/model.ts`, `src/domain/validator.ts` and the frozen §4.1–§4.5 types; `tests/unit/validator.test.ts`, `tests/unit/metrics.test.ts` |
| IP-02 Open a native inspector view | 1, 3, 6 | `tests/host/plugin-onload.test.ts`, `tests/host/city-view.test.ts`, `tests/unit/manifest.test.ts`; the settings surface verified in `2026-09-17-setting-definitions-verification.md` |
| IP-03 Source selection and read-only inventory | 5, 7, 8 + the no-write proof in 12 | G2 in the gate-evidence document: the boundary table, the whole-tree hash diff (**0** differences), the read log with positive controls, `tests/contracts/source-filesystem-port.contract.ts` |
| IP-04 Render the city with Three.js | 4, 10 + the benchmark in 12 | `tests/unit/layout-determinism.test.ts`, `tests/unit/layout-districts.test.ts`, `tests/unit/layout-scale.test.ts`; G5's table, with its not-a-GPU-measurement caveat; `tests/component/renderer-contract.test.ts`, `renderer-disposal.test.ts` |
| IP-05 Find and inspect without losing context | 9 + fit/top/focus in 10 | `tests/component/file-search.test.ts`, `codebase-file-list.test.ts`, `file-inspector.test.ts`, `camera-controls.test.ts`; acceptance "Select a file without moving the camera" |
| IP-06 Refresh, cancel, fail, recover | 8 + per-leaf reconciliation in 11 | `tests/integration/scan-lifecycle.test.ts`, `tests/unit/run-state.test.ts`, `tests/host/multi-leaf.test.ts`; acceptance "Cancel a refresh without losing the valid snapshot", "Reject late result publication across profiles" |
| IP-07 Validate the actual Obsidian host | 11, 12, checkpoint #3 | `tests/host/lifecycle-leaks.test.ts`, `tests/host/window-migration.test.ts` (a genuinely separate jsdom realm); checkpoint #3 closed by the user, **not itemised row by row** — the gate-evidence document's checkpoint-#3 table says which rows a human confirmed and which they did not |
| IP-08 Package and release | 13 | `scripts/assert-bundle.mjs`, `tests/host/build-output.test.ts`, `tests/host/clean-vault-install.test.ts`; this report, `2026-09-17-wp01-limitations.md`; **G1 itself is checkpoint #4's, and is NOT PERFORMED** |

---

## What was NOT done, and why

The full record is `2026-09-17-wp01-limitations.md`. In summary:

- **The perceptual half of accessibility is unchecked by anybody** — contrast, focus-ring
  visibility, zoom reflow, screen-reader output and third-party themes. The structure is
  in place and machine-checked; "the structure is in place" is not "the product is
  accessible". The third-party theme row is the one to schedule first, because ruling
  M113's zero-specificity `:where()` arrangement has never met a theme that fights it.
- **No real-host performance figure exists.** Everything in G5 was measured with
  `WebGLRenderer` doubled under jsdom. The Electron/Chrome row is empty on purpose.
- **Nothing is durable.** Snapshots are in-memory only; durable history is WP-05.
- **No analysis of any kind** — no findings, coverage, dependency relations or runtime
  evidence; no note writing, no snapshot comparison, no open-in-editor.
- **The scope model is a denylist**, so "scan only these directories" is not
  expressible, and the snapshot ceiling fails a whole scan rather than degrading.
- **The scan is sequential by choice** (ruling M108), about four times slower than
  bounded concurrency measured, because concurrency opens files after a cancel and those
  reads enter the G2 evidence surface. **That trade is the user's to make.**
- **`npm run analyze` is red by design** at a baseline of **11** findings, each assessed,
  and nobody tuned it to green.
- **The shipped bundle contains an unreachable FileSaver island** carrying two
  `XMLHttpRequest` constructions, from pinia 4.0.3's own `dist/pinia.js` — the single
  entry its `exports` map offers, with no production variant to select. The devtools code
  that would call it is eliminated by the production `NODE_ENV` define; the helper is
  not. It is dead — every symbol in it is referenced only from inside it — and it is now
  guarded two ways in `tests/host/build-output.test.ts`: the network-API census over
  `dist/main.js` is pinned to exactly those two, and the devtools entry points that reach
  the island must be absent. Disclosed rather than suppressed: a reviewer greps the
  bundle, and they should find this written down before they find the string.
- **The file-symlink case is unverified on this machine** (Developer Mode is off); the
  directory-junction case, which is the one that matters for escaping an approved root,
  runs for real.

---

## Numbers in this document

**DERIVED — a stale value reddens a test.** The accessibility row counts (the total, the
open count, the fully-PASSED count and the half-passed count) are swept by
`tests/unit/evidence-numbers.test.ts`, which reads this document exactly as it reads the
gate-evidence document and the matrix: positively at every site that states one, and
negatively against every value they are not. **All four counts, in all four documents** —
until the final fix wave the fully-PASSED and half-passed counts were swept in the matrix
alone while this paragraph already called them derived, and a six-fold overstatement of
how many rows had passed survived the whole suite. Four shapes only: "N of the 14"; the
open count immediately beside an openness word; a count before "fully PASSED"; and a count
before "a PASSED jsdom half" — and **asterisk emphasis only**. The lettered list of what
escapes that sweep lives in the gate-evidence document's own Numbers block and applies
here identically, to all four counts. The G8 table above is asserted **identical**
to the gate-evidence document's by `tests/host/clean-vault-install.test.ts`, so it is as
derived as that one is — which means its layer set, its file counts and its sum, and NOT
its per-layer test counts. See the transcribed paragraph below. The command and settings
enumerations are derived from `src/host/commands.ts` and `src/host/setting-definitions.ts`
by the same file.

**TRANSCRIBED — no test can check these.** **The per-layer test counts inside the G8
table above are transcribed, not derived**, and that is worth saying here rather than
leaving a reader to infer it from the word "identical": vitest exposes no whole-suite
tally to a test inside that suite, and static `it(` counting is wrong where a runner
generates tests from a loop. What IS derived is their sum, the file counts, the layer
set, and the fact that this copy of the table matches the original byte for byte — so a
uniformly stale set of seven numbers stays green, and is the named residual in the
gate-evidence document's own Numbers block. Re-take with `npx vitest run <directory>`.

Also transcribed: the artefact byte sizes and the `npm ci` package count, taken from the
run recorded in the G1 section; the dependency versions, taken from `package-lock.json`
at this commit; the `npm run analyze` total of 11; and every figure cited from the G5
benchmark, which writes its results outside this repository by design.

**NEITHER — prose.** Version numbers, spec section numbers, ruling numbers, COPY ids,
packet ids, checkpoint numbers and dates are identifiers, not counts.
