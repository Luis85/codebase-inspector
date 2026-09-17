---
project: codebase-inspector
title: WP-01 — Native Obsidian Three.js codebase city (design)
status: approved
date: 2026-09-17
---

# WP-01 design — Native Obsidian Three.js codebase city

This document records the decisions agreed before implementation. It does not
restate the concept kit. Where it is silent, `docs/concept/` governs — in
particular [architecture-and-contracts.md](../../concept/architecture/architecture-and-contracts.md),
[01-native-codebase-city.md](../../concept/packages/01-native-codebase-city.md),
and [quality-gates.md](../../concept/execution/quality-gates.md). Where this
document and the concept kit disagree, this document wins, because it reflects
decisions taken with the repository in front of us.

## 1. Scope

The deliverable is the complete WP-01 vertical slice: plugin distribution →
source selection → safe read-only scan → normalized snapshot → Three.js city →
inspection. A scaffold or a fixture-only city does not satisfy it.

Out of scope: fallow as a runtime provider, findings, dependency relations,
snapshot history, note writing, and every other WP-02+ capability. The increment
stops before fallow.

Repository state at the time of writing: `LICENSE`, `README.md`, and `docs/`
only. No implementation exists to reconcile. The repository root is itself an
Obsidian vault (`.obsidian/`, gitignored); this is incidental, and it is not the
test vault.

## 2. Approach: skeleton first

The tasks are sequenced so that a loadable plugin exists in a real vault as
early as possible, and each later task replaces one layer of it.

Rejected alternatives:

- **Literal spec order (01.1 to 01.9).** Renderer and UI would be built against
  a model never drawn in the host, so host surprises land late.
- **Headless core first.** Best unit coverage, but it defers both the bundling
  risk and the "does it feel right" signal to the end — the failure mode
  `MIGRATION.md` warns about.

The largest early unknown is not Three.js. It is whether a Vite library build
containing Vue SFCs and Three.js loads as an Obsidian plugin. A throwaway spike
answers that before the plan is written. If it fails, the bundler changes in the
plan rather than mid-implementation.

## 3. Repository and toolchain

```text
codebase-inspector/
  manifest.json  versions.json  package.json
  vite.config.ts  tsconfig.json  tsconfig.test.json
  eslint.config.ts  .oxlintrc.json  vitest.config.ts
  .env.example                      # .env is gitignored
  scripts/                          # every project script lives here
    install-to-vault.mjs
  src/        host/ application/ domain/ adapters/ visualization/ ui/
  tests/      unit/ contracts/ integration/ host/ fixtures/ benchmarks/
  dist/                             # build output only; gitignored
  docs/
```

`src/` follows the structure proposed in section 2 of the concept kit.

**No build output at the repository root.** `main.js` and `styles.css` are
artefacts, and they are written to `dist/`, never beside the source. `dist/` is
gitignored.

**Every script lives in `scripts/`.** Build, install, fixture generation, and
benchmark helpers are files under `scripts/`, invoked through npm scripts. No
loose script at the repository root.

**Build.** Vite library mode emits `dist/main.js` as a single CommonJS file,
plus `dist/styles.css`. The build also copies `manifest.json` into `dist/`, so
`dist/` is the complete, ready-to-install plugin folder. No additional chunks
and no worker assets in WP-01. Externalised: `obsidian`, `electron`, all Node
built-ins, `@codemirror/*`, `@lezer/*`. Bundled: Vue, Pinia, Three.js, and the
addons actually used. The release path requires no dev server, no network, and
no install in the inspected project.

**Manifest.** id `codebase-inspector`, name `Codebase Inspector`,
`isDesktopOnly: true`. `minAppVersion` starts at the Foundations value (1.13)
and appears in release notes only as a version actually tested, never as an
assumption. `versions.json` is maintained from the first release.

**Typecheck.** `vue-tsc --noEmit` over both `tsconfig.json` (src) and
`tsconfig.test.json` (tests), both strict. Two configs, so test globals never
loosen `src`.

**Lint.** `oxlint` is the fast pass. `eslint` adds type-aware typescript-eslint
rules, `eslint-plugin-vue`, and `eslint-obsidian-plugin`. Both run in
`npm run verify`.

**Size constraints.** The Foundations limits are enforced as failing lint rules,
not conventions: eslint `max-lines` at 400 for `src/**` and 450 for `tests/**`.
A file that outgrows its limit is a signal to split responsibilities.

**Test.** Vitest with two projects: `node` (domain, adapters, filesystem
integration) and `jsdom` (Vue components and stores).

**Test vault.** `.env` holds `CODEBASE_INSPECTOR_TEST_VAULT`, an absolute path
to a vault outside this repository. `.env.example` is committed; `.env` is not.
The development vault is `C:\Projects\renovation-planner`.
`scripts/install-to-vault.mjs` copies the contents of `dist/` into
`$CODEBASE_INSPECTOR_TEST_VAULT/.obsidian/plugins/codebase-inspector/`. This is
the artefact reloaded at every manual checkpoint. The script refuses to run when
the variable is unset, when the target is not a vault, or when the resolved
target lies inside this repository.

That vault is a working project checkout with other plugins installed, which
makes it a realistic host and a useful external codebase to inspect. It is not
an isolated vault, so it cannot satisfy gate G1 on its own. The release gate
(task 12) additionally installs `dist/` into a throwaway vault created for that
purpose, with no source checkout, no dev server, and no package install.

**fallow.** A development-time quality gate on this repository's own source,
introduced once there is source worth checking (task 11). It is not a runtime
dependency of the plugin, and it is not wired into the product until WP-02.

## 4. Frozen contracts

These are written down and committed before any implementation task starts,
because every later task depends on them. Subagents may not change them
unilaterally.

**Implemented in WP-01:** `Observation`, `CodeEntity` (kinds `repository`,
`directory`, `file`), `Measurement`, `ProviderRun`, `AnalysisScope`,
`CodebaseSnapshot`, `SourceReference`, `CodebaseProfile`, `LocalBinding`,
`CityViewState`.

**Deferred:** findings, relations, the `external-package` entity kind, and all
WP-02+ extensions.

Three decisions the concept kit left open:

1. **Entity identity** is the repository id, the entity kind, and the
   POSIX root-relative path, joined by a NUL separator. It is readable, stable
   across rescans, and needs no hash. Hashing is used only for `fileSetDigest`
   and `contentHash`. A content hash is a revision marker; it never participates
   in identity.
2. **The built-in inventory is itself a `ProviderRun`**, with
   `provider: 'builtin-inventory'` and `origin: 'collected'`. WP-01 therefore
   exercises the provenance machinery WP-02 needs, and a cancelled scan is
   naturally `status: 'partial'` rather than a special case.
3. **Two metrics only:** `physical-lines` (unit `lines`) and `byte-size`
   (unit `bytes`), each at `definitionVersion: '1'`.

**Physical lines** are defined exactly: empty text is 0 lines; CRLF is a single
separator; a trailing newline does not create a phantom final line; blank lines
and comment lines count. Binary, undecodable, skipped, and oversized content
yield an observation of status `unavailable` with a reason and a null value —
never 0. Byte size remains a separate observation.

**Ports** are frozen at the same time, under `src/application/ports/`:
`SourceFileSystemPort` (walk, read, stat), `ProfileStore`, `LocalBindingStore`,
`SnapshotStore`, `Clock`, and a `CancellationToken`. The domain imports nothing
from Obsidian, Vue, Three.js, Node, or fallow.

**Renderer interface** is frozen: `setLayout`, `setColors`, `setSelection`,
`focus`, `fit`, `resize`, `pause`, `resume`, `dispose`. The mount element and
its owning `Window` are injected. The renderer never reads global host state,
never touches the filesystem, and never writes notes.

**Layout output** is frozen: a pure `LayoutResult` carrying lots of
`{ entityId, x, z, width, depth, height, colorKey }` plus overall bounds. Layout
consumes a validated snapshot, never the filesystem.

**Validation is runtime, not casts.** One validator module checks payload
limits, schema version, finite numbers, duplicate ids, reference integrity,
containment-tree cycles, and path safety. Persisted settings and restored view
state are treated as untrusted input.

## 5. Task sequence

| # | Task | Ends with | Checkpoint |
|---|---|---|---|
| S | Bundling spike (throwaway) | Proof that a Vite CommonJS bundle importing Vue and Three.js loads in Obsidian 1.13 | user confirms |
| 1 | Toolchain | `npm run verify` green; `install:vault` delivers files | — |
| 2 | Contracts, validator, fixture builder | Valid fixtures round-trip; invalid ones are rejected with reasons | — |
| 3 | Host skeleton: manifest, plugin entry, `ItemView`, ribbon, `open-city`, minimal instanced-box renderer over a fixture snapshot | A real Obsidian tab shows a fixture city | manual #1 |
| 4 | Pure layout: deterministic nested districts, equal lots | No overlaps; identical input yields identical geometry | — |
| 5 | Inventory collector: Node filesystem adapter, bounded async walk, exclusions, cancellation, metrics | Cross-platform and no-source-write fixtures pass | — |
| 6 | Profiles and storage: preferences, local bindings, in-memory snapshot store, settings tab | Profiles persist; a missing binding prompts reconnect | — |
| 7 | Source selection and scan wiring: native source modal, scan coordinator, `scan-codebase`, `cancel-scan`, progress | A real external project renders as a real city | manual #2 |
| 8 | Vue UI: app shell, search and file list, inspector, toolbar, theme bridge, keyboard-only path, non-WebGL fallback | Canvas and HTML selection stay synchronised | — |
| 9 | Renderer hardening: instancing with a batch-and-instance to entity map, picking, camera controls, hover, focus, fit and top-down, reduced motion, context loss | The correct file is selected; rendering happens on demand only | — |
| 10 | Lifecycle: multiple leaves, workspace state, hidden and resized leaves, pop-out rebind, dispose, stale-result guard | No leaks and no wrong-window DOM | manual #3 |
| 11 | Safety and evidence gates, benchmark fixtures, fallow on our own source | G2, G3, and G5 evidence recorded | — |
| 12 | Release gate: install into a throwaway clean vault, benchmark record, limitations, implementation report | WP-01 complete and honestly reported | manual #4 |

Two deliberate ordering choices. Layout precedes the real scan, so the renderer
is fed by a pure function from the start. The Vue UI precedes renderer
hardening, so the keyboard and non-WebGL paths are built in rather than bolted
on.

Command ids are registered without the plugin-id prefix: `open-city`,
`scan-codebase`, `cancel-scan`. No command is registered for an unimplemented
capability.

## 6. Testing

Five layers:

- **Unit** — metrics, identity encoding, validator, layout. Pure and exhaustive.
- **Contract** — one shared suite that every implementation of a port must pass,
  so a test fake and the Node adapter cannot drift apart.
- **Integration** — real temporary directories generated per test: Unicode
  names, spaces, deep nesting, duplicate basenames, binary content, oversized
  files, unreadable files, symlinks and junctions, nested ignore rules, and
  Windows drive paths.
- **Host** — manual checklists the user executes in Obsidian at each checkpoint.
- **Benchmark** — a 1,000-file functional fixture and a 5,000-file performance
  fixture.

Every task is test-driven: a failing test precedes implementation.

Two gates get purpose-built proofs rather than assertions:

- **No source writes.** Hash every file in the fixture tree before and after a
  scan, and diff the whole tree, including modification times.
- **Secrets are never read.** The filesystem port records every path it opens,
  and the test asserts that excluded paths never appear in that read log. This
  proves the absence of a read, not merely absence from the interface.

## 7. Failure behaviour

Stated once, applied everywhere:

- Unavailable is never 0.
- A cancelled or partial scan is marked `partial`, and never replaces the last
  complete snapshot.
- Every scan carries a job token, so a late result for profile A cannot
  overwrite profile B.
- Validation failures surface as visible warnings carrying their reason. They
  are never dropped silently.
- Provider run completion, findings, and policy verdict remain separate fields.

## 8. Execution model

Work proceeds on branch `feat/wp-01-codebase-city`, merged to `main` at the
release gate.

Each plan task is executed by a fresh implementer subagent, which receives the
task text, this document, explicit file ownership, and the test-driven
requirement. A fresh reviewer subagent then audits the diff against that task's
acceptance criteria and the relevant quality gate. Review findings are relayed
and fixed before the task is committed. One completed task is one commit.

A subagent that believes a frozen contract must change stops and raises it,
rather than changing it.

At tasks 3, 7, 10, and 12, work pauses and the user runs a manual checklist in
Obsidian. Results are recorded, so that the release report can separate passed
automated checks, manually verified host checks, and untested behaviour.

## 9. Definition of done

An installable plugin build satisfies the real-root workflow for both a
vault-based and an external project; file measurements match fixtures; scanning
changes no file in the inspected project; accessibility and lifecycle checks
pass; benchmark results and limitations are recorded; and every visible command
and setting is implemented. Then the increment stops, before fallow.
