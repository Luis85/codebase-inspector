---
project: codebase-inspector
title: WP-01 — Native Obsidian Three.js codebase city (design)
status: approved
date: 2026-09-17
revised: 2026-09-17
---

# WP-01 design — Native Obsidian Three.js codebase city

This document records the decisions agreed before implementation. It does not
restate the concept kit. Where it is silent, `docs/concept/` governs — in
particular [architecture-and-contracts.md](../../concept/architecture/architecture-and-contracts.md),
[01-native-codebase-city.md](../../concept/packages/01-native-codebase-city.md),
and [quality-gates.md](../../concept/execution/quality-gates.md). Where this
document and the concept kit disagree, this document wins, because it reflects
decisions taken with the repository in front of us and with the Obsidian
documentation verified.

Section 10 records what was verified, what is inferred, and what remains open.
Claims marked **verified** trace to obsidianmd-owned sources or to a working
plugin in this workspace. Nothing else in this document should be treated as
documented fact.

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

Community-directory submission is **not** a goal for WP-01. Every policy and
lint rule is followed so that submission remains possible later, but the release
gate proves a clean-vault install, not directory readiness. See section 9.

## 2. Approach: skeleton first

The tasks are sequenced so that a loadable plugin exists in a real vault as
early as possible, and each later task replaces one layer of it.

Rejected alternatives:

- **Literal spec order (01.1 to 01.9).** Renderer and UI would be built against
  a model never drawn in the host, so host surprises land late.
- **Headless core first.** Best unit coverage, but it defers both the bundling
  risk and the "does it feel right" signal to the end — the failure mode
  `MIGRATION.md` warns about.

**The spike's target has moved.** The original premise was that the largest
unknown is whether a Vite library build containing Vue SFCs and Three.js loads
as an Obsidian plugin. Research settled that: at least three published community
plugins are Vue 3 SFCs built with Vite in CommonJS library mode, several
published plugins bundle Three.js, and a working Vite-built Vue plugin exists in
this workspace. What is genuinely unvalidated is **Node access from inside the
bundle** — see section 3 — which task 5 depends on absolutely. The spike now
targets that, and proves the rest in passing.

## 3. Repository and toolchain

```text
codebase-inspector/
  manifest.json  versions.json  package.json  package-lock.json
  vite.config.ts  tsconfig.json  tsconfig.test.json
  eslint.config.mjs  .oxlintrc.json  vitest.config.ts
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
artefacts written to `dist/`, never beside the source. `dist/` is gitignored,
which also satisfies Obsidian's own checklist item that `main.js` belongs in
releases rather than in the repository. **verified**

**Every script lives in `scripts/`.** Build, install, fixture generation, and
benchmark helpers are files under `scripts/`, invoked through npm scripts. The
community directory's source scanner ignores `scripts/` wholesale, so this costs
nothing there. **verified**

**`package-lock.json` is committed.** Obsidian's plugin checklist requires a
lock file. **verified**

### 3.1 Node access — the load-bearing decision

WP-01 reads an arbitrary filesystem tree. How it reaches Node is a frozen
decision, not an implementation detail, and the obvious approach is wrong.

**The rule:** all Node access goes through **one module**, `src/adapters/filesystem/node-access.ts`,
which obtains its modules at runtime through `window.require` with `node:`-prefixed
specifiers, guarded by `Platform.isDesktopApp`:

```ts
// The only place in the codebase that reaches Node. Everything else imports from here.
import { Platform } from 'obsidian';

export const fs = Platform.isDesktopApp ? window.require('node:original-fs') : null;
export const fsPromises = fs ? fs.promises : null;
export const nodePath = Platform.isDesktopApp ? window.require('node:path') : null;
```

Three separate reasons, each sufficient on its own:

1. **`window.require`, not a bundled import.** Obsidian injects its own CommonJS
   `require` into a plugin bundle, and there is credible evidence that it
   resolves only `obsidian`, `electron` and the CodeMirror packages, returning
   `null` for Node built-ins, while the renderer's `window.require` is
   Electron's real one. This is **inferred, not documented** — it is one
   plugin's detailed build comment, and it sits in tension with the official
   sample externalising `...builtinModules`. The spike settles it (section 5).
   Using `window.require` is correct either way, so the design does not wait for
   the answer.
2. **The official lint rule.** `eslint-plugin-obsidianmd`'s `no-nodejs-modules`
   flags any static import of a Node built-in, and `isDesktopOnly: true` grants
   no exemption. Obsidian's checklist states the rule in prose: do not use
   `fs`, `path` or `electron` at the top level; gate behind
   `Platform.isDesktopApp` and require them at runtime. **verified**
3. **`node:original-fs`, not `fs`.** Electron patches `fs` to be asar-aware.
   `original-fs` is the unpatched module and is the right one for walking an
   arbitrary source tree. This is what Obsidian's own first-party
   `obsidian-importer` plugin uses. **verified**

The externals list still includes Node built-ins in both bare and `node:`-prefixed
form, so that any transitive dependency referencing them is not bundled.

### 3.2 Build

Vite library mode emits `dist/main.js` as a single CommonJS file plus
`dist/styles.css`, and copies `manifest.json` into `dist/`, so `dist/` is the
complete installable plugin folder. `manifest.json` also stays at the repository
root, which is where the community directory reads it. **verified**

Settings that are load-bearing rather than taste:

| Setting | Value | Why |
|---|---|---|
| `lib.formats` | `['cjs']` | Obsidian loads CommonJS only; no ESM path exists. **verified** |
| `output.exports` | `'named'` | Emits `exports.default = Plugin` with the `__esModule` marker — the shape esbuild-built plugins load with. `'auto'` emits `module.exports = Plugin` instead. **verified** in this workspace's working plugin |
| `output.inlineDynamicImports` | `true` | Obsidian loads exactly one file; emitted chunks would `require()` files that are never installed |
| `output.entryFileNames` | `'main.js'` | |
| `output.assetFileNames` | `.css → 'styles.css'` | Lib mode otherwise names CSS after the entry, producing `main.css` |
| `cssCodeSplit` | `false` | |
| `build.target` | `'es2020'` | The host is a known Electron build, not the open web |
| `emptyOutDir` | `true` | Safe because `outDir` is `dist/`, not the repository root |
| `define` | `process.env.NODE_ENV` | Vue's esm-bundler build reads it; undefined in a bare CJS bundle |
| paths | anchored to `import.meta.url` | Never `process.cwd()`; subagent tasks may run from elsewhere |

Externalised: `obsidian`, `electron`, the nine `@codemirror/*` and three
`@lezer/*` packages, and all Node built-ins in bare and `node:` form. Bundled:
Vue, Pinia, Three.js and the addons used. **verified** against the official
esbuild config and this workspace's working Vite config.

**Vue is runtime-only, permanently.** `@vitejs/plugin-vue` compiles SFC
templates at build time; `vue` is never aliased to a full build. The runtime
template compiler uses `new Function`, and dynamic code execution is a review
risk. Expect `dist/main.js` around 0.8–1.2 MB minified with Vue, Pinia and
Three.js — normal for this class of plugin, not a defect.

**Import discipline**, enforced in review: named imports from `'three'`, never
`import * as THREE`; one addon path convention (`three/addons/...`), never mixed
with `three/examples/jsm/...`.

### 3.3 Manifest

```jsonc
{
  "id": "codebase-inspector",
  "name": "Codebase Inspector",
  "version": "0.1.0",
  "minAppVersion": "1.13.0",
  "description": "Explore any local codebase as an interactive 3D city inside a vault tab.",
  "author": "Luis85",
  "authorUrl": "https://github.com/Luis85",
  "isDesktopOnly": true
}
```

- `minAppVersion` is **three-segment**. A bare `1.13` breaks `semver.gt` inside
  the official `no-unsupported-api` rule, and no Obsidian release is named
  `1.13`. `1.13.0` matches the other plugins in this workspace. **verified**
- `description` is machine-validated: 10–250 characters, starts with a capital,
  ends with a period, no emoji or special characters, and must not contain the
  substrings "obsidian" or "plugin". **verified**
- **No non-schema keys.** The official linter reports any extra key as
  `disallowedKey`. `fundingUrl` is omitted. **verified**
- The installed folder name must be exactly `codebase-inspector`, matching `id`,
  or `onExternalSettingsChange` is never called. `install-to-vault.mjs` asserts
  this. **verified**
- `versions.json` exists but is only updated when `minAppVersion` changes. It is
  read from the repository root, never from the release assets. **verified**

### 3.4 Typecheck and lint

`vue-tsc --noEmit` over `tsconfig.json` (src) and `tsconfig.test.json` (tests),
both strict, with `isolatedModules` and `verbatimModuleSyntax`.

`oxlint --deny-warnings` is the fast pass. `eslint --max-warnings 0` adds
type-aware typescript-eslint rules, `eslint-plugin-vue`, and
**`eslint-plugin-obsidianmd`** — the real package name; the Foundations list's
"eslint-obsidian-plugin" does not exist. Its `recommended` config is what
converts a review round-trip into a build failure, and several of its rules are
load-bearing here: `no-nodejs-modules`, `hardcoded-config-path`,
`prefer-instanceof`, `detach-leaves`, `no-unsupported-api`,
`settings-tab/prefer-setting-definitions`. **verified**

**Two architectural rules are lint rules, not prose**, following the convention
already used in this workspace's other plugin:

1. **Size.** `max-lines` at 400 for `src/**` and 450 for `tests/**`.
2. **Layering.** `no-restricted-imports` enforces that `src/domain/**` imports
   nothing from Obsidian, Vue, Three.js, Node, or fallow, and that
   `src/visualization/**` reaches neither the filesystem nor the host. A
   layering documented only in prose is one commit away from being wrong.

### 3.5 Test and dev loop

Vitest with two projects: `node` (domain, adapters, filesystem integration) and
`jsdom` (Vue components and stores).

`.env` holds `CODEBASE_INSPECTOR_TEST_VAULT`, an absolute path to a vault
outside this repository; `.env.example` is committed, `.env` is not. The
development vault is `C:\Projects\renovation-planner`.
`scripts/install-to-vault.mjs` copies `dist/` into
`<vault>/.obsidian/plugins/codebase-inspector/` and refuses to run when the
variable is unset, when the target is not a vault, or when the resolved target
lies inside this repository. It also writes a `.hotreload` marker file, because
the `pjeby/hot-reload` plugin ignores any plugin folder lacking `.git` or
`.hotreload` — without it every manual checkpoint is a full Obsidian restart.

The script's hardcoded `.obsidian` is acceptable because a build script cannot
read `vault.configDir`; it takes an override
(`CODEBASE_INSPECTOR_TEST_VAULT_CONFIG_DIR`, default `.obsidian`). **Plugin
source must never hardcode it** — see section 4.3.

The dev vault is a working project checkout with other plugins installed, which
makes it a realistic host and a useful external codebase to inspect. It is not
isolated, so it cannot satisfy gate G1 alone; task 12 additionally installs into
a throwaway vault with no source checkout, no dev server, and no package
install.

**fallow** is a development-time quality gate on this repository's own source,
added at task 11 as `npm run analyze`. It is not a runtime dependency and is not
wired into the product until WP-02.

## 4. Frozen contracts

Written down and committed before any implementation task starts. Subagents may
not change them unilaterally; a subagent that believes one must change stops and
raises it.

### 4.1 Domain model

**Implemented in WP-01:** `Observation`, `CodeEntity` (kinds `repository`,
`directory`, `file`), `Measurement`, `ProviderRun`, `AnalysisScope`,
`CodebaseSnapshot`, `SourceReference`, `CodebaseProfile`, `LocalBinding`,
`CityViewState`. **Deferred:** findings, relations, the `external-package`
kind, and all WP-02+ extensions.

1. **Entity identity** is the repository id, the entity kind, and the POSIX
   root-relative path, joined by a NUL separator. Readable, stable across
   rescans, no hash needed. Hashing is used only for `fileSetDigest` and
   `contentHash`. A content hash is a revision marker and never participates in
   identity.
2. **The built-in inventory is itself a `ProviderRun`**, with
   `provider: 'builtin-inventory'` and `origin: 'collected'`. WP-01 therefore
   exercises the provenance machinery WP-02 needs, and a cancelled scan is
   naturally `status: 'partial'` rather than a special case.
3. **Two metrics only:** `physical-lines` (unit `lines`) and `byte-size` (unit
   `bytes`), each at `definitionVersion: '1'`.

**Physical lines** are defined exactly: empty text is 0 lines; CRLF is a single
separator; a trailing newline does not create a phantom final line; blank and
comment lines count. Binary, undecodable, skipped, and oversized content yield
an observation of status `unavailable` with a reason and a null value — never 0.
Byte size is a separate observation.

**Validation is runtime, not casts.** One validator module checks payload
limits, schema version, finite numbers, duplicate ids, reference integrity,
containment-tree cycles, and path safety. Persisted settings and restored view
state are untrusted input. `zod` is the validation library, matching this
workspace's convention.

### 4.2 Ports and renderer

**Ports** under `src/application/ports/`: `SourceFileSystemPort` (walk, read,
stat), `ProfileStore`, `LocalBindingStore`, `SnapshotStore`, `Clock`, and a
`CancellationToken`. The domain imports nothing from Obsidian, Vue, Three.js,
Node, or fallow — enforced by lint.

**Renderer interface:** `setLayout`, `setColors`, `setSelection`, `focus`,
`fit`, `resize`, `pause`, `resume`, `dispose`. The mount element and its owning
`Window` are injected at construction. The renderer never reads global host
state, never touches the filesystem, and never writes notes.

**Pop-out migration is handled by `dispose()` plus constructing a new
renderer** — there is no `rebind` method. The consequence is a binding
constraint on the renderer: it must be cheap to reconstruct from an existing
`LayoutResult` and `CityViewState`, with no data refetch and no scan. This makes
window migration and WebGL context loss the same recovery path rather than two.

**Cross-window rule**, which is the mechanically checkable form of "no
wrong-window DOM": inside the renderer and the view, no bare `window`,
`document`, `requestAnimationFrame`, `setInterval`, `ResizeObserver`,
`IntersectionObserver`, or `instanceof` on a DOM type. All go through the
injected `Window`, and DOM type checks use `node.instanceOf(T)` — plain
`instanceof` returns false across windows. **verified**

**Layout output:** a pure `LayoutResult` of lots
`{ entityId, x, z, width, depth, height, colorKey }` plus overall bounds. Layout
consumes a validated snapshot, never the filesystem.

### 4.3 Host rules

These are frozen because they are easy for an implementer to get wrong and
expensive to retrofit. All **verified**.

- **Deferred views.** Since Obsidian 1.7.2 every view is created as a
  `DeferredView`. Any code reaching a city view goes through
  `getLeavesOfType('codebase-inspector-city')` followed by
  `leaf.view instanceof CityView`. A cast on `leaf.view` is a defect. To act on
  a specific view, `await workspace.revealLeaf(leaf)` first; `loadIfDeferred()`
  only where reveal is unacceptable. This also means a background city tab is
  never constructed, so no WebGL context exists for it.
- **Never hold a reference to a view instance.** Obsidian may call the view
  factory more than once. Reach views through `getLeavesOfType`.
- **`onload` registers only.** No scanning, no expensive work, no data fetching.
  Startup work goes in `workspace.onLayoutReady()`. First-enable view opening
  uses `onUserEnable()`.
- **WebGL context creation happens in the view's `onOpen`, not its
  constructor.** Obsidian reconstructs saved views at startup.
- **Never `detachLeavesOfType` in `onunload`.** It relocates the user's tabs on
  every plugin update. Fine for an explicit user action.
- **`onunload` is typed `void` and is never awaited.** All teardown —
  Three.js disposal, Vue unmount, scan cancellation — must be synchronous and
  idempotent.
- **Vue mounts on `this.contentEl`** and unmounts in `onClose()`. Not
  `containerEl.children[1]`. Each view creates its own `createPinia()`; a
  module-level singleton would share state across leaves.
- **Cleanup that `Component` does not cover**, and so must be released by hand
  in `onClose`: `requestAnimationFrame` handles, every observer, Three.js
  geometries, materials, textures and render targets, `renderer.dispose()` plus
  `forceContextLoss()`, and any tooltip or overlay DOM appended outside
  `containerEl`. Browsers cap live WebGL contexts at roughly 8–16, so a leaked
  renderer per closed tab is an observable failure, not a theoretical one.
- **`getState()` returns identifiers and presentation state only** — profile id,
  camera pose, selected entity id, panel state. Never a snapshot, never a
  resolved absolute path, never scan authorisation. It persists into
  `workspace.json`, which is user-editable, so `setState` validates through the
  same validator as settings.
- **Active-view lookup uses `getActiveViewOfType`**, never the deprecated
  `workspace.activeLeaf`.
- **Config directory comes from `vault.configDir`**, never the literal
  `.obsidian`, and the absolute form is `join(adapter.getBasePath(), vault.configDir)`
  behind an `adapter instanceof FileSystemAdapter` guard — `instanceof`, never a
  cast, because mobile supplies a `CapacitorAdapter`.
- **`normalizePath()` is for vault-relative paths only.** It strips leading
  slashes and does **not** remove `..`, so it provides no path safety.
  Containment is decided with `path.resolve` plus a `path.relative` sign check.
- **Symlink skipping needs `fs.lstat`.** The adapter's `Stat` exposes only
  `type: 'file' | 'folder'`, with no symlink discriminator.
- **Theme colours** are read with `containerEl.getCssPropertyValue('--…')`, not
  `getComputedStyle(document.body)`, because the latter reads the wrong document
  after pop-out migration. Re-read every cached colour on
  `workspace.on('css-change')`, which carries no payload. Obsidian 1.13 moved
  base colours to OKLCH, so never parse a variable as an `r,g,b` triplet.
- **Settings are declarative**: `getSettingDefinitions()`, matching this
  workspace's existing `SettingsTab.ts`, so settings appear in 1.13+ settings
  search and `prefer-setting-definitions` stays quiet.

### 4.4 Why the Vault API is not the inventory

The concept kit's reasoning needs re-basing on what is actually documented. Two
facts suffice, both **verified**:

1. Neither `Vault` nor `DataAdapter` can address anything outside the vault at
   all, which settles the external-root case by itself.
2. *"The Vault API only allows access to the files visible inside the app, files
   included in hidden folders can only be accessed using the Adapter API."*

The claim that `getFiles()` misses non-indexed extensions such as `.ts` is
**undocumented** and must not be cited as a reason. It is cheap to settle
empirically at checkpoint #1.

## 5. Task sequence

| # | Task | Ends with | Checkpoint |
|---|---|---|---|
| S | Bundling and Node-access spike (throwaway) | See 5.1 | user confirms |
| 1 | Toolchain | `npm run verify` green; `install:vault` delivers files | — |
| 2 | Contracts, validator, fixture builder | Valid fixtures round-trip; invalid ones rejected with reasons | — |
| 3 | Host skeleton: manifest, plugin entry, `ItemView`, ribbon, `open-city`, minimal instanced-box renderer over a fixture snapshot | A real Obsidian tab shows a fixture city | manual #1 |
| 4 | Pure layout: deterministic nested districts, equal lots | No overlaps; identical input yields identical geometry | — |
| 5 | Inventory collector: the Node access module, bounded async walk, exclusions, cancellation, metrics | Cross-platform and no-source-write fixtures pass | — |
| 6 | Profiles and storage: declarative settings tab, local bindings, in-memory snapshot store | Profiles persist; a missing binding prompts reconnect | — |
| 7 | Source selection and scan wiring: folder dialog with pasted-path fallback, scan coordinator, `scan-codebase`, `cancel-scan`, progress | A real external project renders as a real city | manual #2 |
| 8 | Vue UI: app shell, search and file list, inspector, toolbar, theme bridge, keyboard-only path, non-WebGL fallback | Canvas and HTML selection stay synchronised | — |
| 9 | Renderer hardening: instancing with a batch-and-instance to entity map, picking, camera controls, hover, focus, fit and top-down, reduced motion, context loss | The correct file is selected; rendering happens on demand only | — |
| 10 | Lifecycle: multiple leaves, workspace state, hidden and resized leaves, pop-out migration, dispose, stale-result guard | No leaks and no wrong-window DOM | manual #3 |
| 11 | Safety and evidence gates, benchmark fixtures, fallow on our own source | G2, G3, and G5 evidence recorded | — |
| 12 | Release gate: install into a throwaway clean vault, benchmark record, limitations, implementation report | WP-01 complete and honestly reported | manual #4 |

Two deliberate ordering choices. Layout precedes the real scan, so the renderer
is fed by a pure function from the start. The Vue UI precedes renderer
hardening, so the keyboard and non-WebGL paths are built in rather than bolted
on.

Command ids are registered without the plugin-id prefix — `open-city`,
`scan-codebase`, `cancel-scan` — because Obsidian adds it. No command is
registered for an unimplemented capability.

**Task 7 source selection**: the primary path probes for
`window.electron.remote.dialog.showOpenDialogSync({ properties: ['openDirectory', 'dontAddToRecent'] })`
behind `Platform.isDesktopApp`, which is what Obsidian's own first-party
importer plugin does. `window.electron` is absent from the published types and
needs a local `declare`. The pasted absolute path always remains available, so
the dialog is never a prerequisite and its future removal is not a breaking
change.

**Task 10 pop-out migration**: the hook is
`this.containerEl.onWindowMigrated(win => …)` — an `HTMLElement` augmentation,
not a `View` method — and the returned destroy function must be retained and
called on close. The owning window is `containerEl.win` or
`leaf.getContainer().win`, never the global `window` or `activeWindow`.
`workspace.on('window-open' | 'window-close')` is not the per-view hook.

**Task 10 visibility**: resize is `View.onResize()`, which is per-view and needs
no teardown. There is **no documented API for "is my view visible."** The pause
trigger is `containerEl.isShown()` re-evaluated on `onResize`,
`active-leaf-change` and `layout-change` — composed from documented primitives,
not a supported API, and recorded as such. Deferred views already remove the
never-yet-shown case, so this work covers only a view hidden after being shown.

### 5.1 Spike scope and pass criteria

One throwaway plugin outside this repository, installed into the dev vault,
logging one distinct line per probe so a single failure does not mask the rest.

Probes: a registered `ItemView`; a Vue 3 SFC with a template, a scoped style
block and a reactive click handler mounted on `contentEl`; Pinia; a Three.js
`InstancedMesh` of ~1,000 boxes with `OrbitControls`; and — **the point of the
exercise** — directory reads through `window.require('node:original-fs')`,
`window.require('node:path')`, and for comparison a bundled static import of
`fs` and of `node:fs`.

Passes only if: `dist/` contains exactly `main.js`, `styles.css` and
`manifest.json`, with any fourth file a failure; the bundle is CommonJS; the
plugin enables with no console error; the SFC renders with its scoped styles
actually applied; the Three.js scene draws and orbits; **the `window.require`
reads return real directory entries**; `grep` finds no `new Function(` or
`eval(` in the production bundle; and disabling and re-enabling twice leaves no
errors. Record whether the bundled static imports work, since that is the
disputed claim, and record `dist/main.js` size as the baseline budget.

The spike also answers, cheaply: whether `vault.getFiles()` returns entries for
`.ts` files (section 4.4), and whether `styles.css` is auto-injected without any
loader code.

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
  proves the absence of a read, not merely absence from the interface. When the
  vault is the codebase, this covers `.obsidian`, other plugins' `data.json`,
  and `.git`.

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
- Teardown is synchronous and idempotent, because `onunload` is not awaited.

## 8. Execution model

Work proceeds on branch `feat/wp-01-codebase-city`, merged to `main` at the
release gate.

Each plan task is executed by a fresh implementer subagent, which receives the
task text, this document, explicit file ownership, and the test-driven
requirement. A fresh reviewer subagent then audits the diff against that task's
acceptance criteria and the relevant quality gate. Review findings are relayed
and fixed before the task is committed. One completed task is one commit.

At tasks 3, 7, 10, and 12, work pauses and the user runs a manual checklist in
Obsidian. Results are recorded, so that the release report can separate passed
automated checks, manually verified host checks, and untested behaviour.

## 9. Definition of done

An installable plugin build satisfies the real-root workflow for both a
vault-based and an external project; file measurements match fixtures; scanning
changes no file in the inspected project; accessibility and lifecycle checks
pass; benchmark results and limitations are recorded; and every visible command
and setting is implemented.

The README discloses, in plain terms, that the plugin reads files outside the
vault and why. This is required by Obsidian's developer policies for any future
directory submission, and it is honest documentation regardless. The README also
states positively that there is no network use and no telemetry. A recognised
`LICENSE` file is present.

Then the increment stops, before fallow.

## 10. Verification basis

Research was conducted on 2026-09-17 against `docs.obsidian.md`, the
`obsidianmd/obsidian-api` typings, `obsidianmd/eslint-plugin`, the official
sample plugin, Obsidian's first-party `obsidian-importer`, and a working
Vite + Vue Obsidian plugin in this workspace (`C:\Projects\renovation-planner`).

**Settled, contrary to the first draft of this document:** Vite library mode
builds loadable Obsidian plugins; Vue 3 SFCs and Three.js are both proven in
published plugins; `minAppVersion` must be three-segment; the lint package is
`eslint-plugin-obsidianmd`; deferred views change every view access; the pop-out
hook is `HTMLElement.onWindowMigrated`; reading files outside the vault is
permitted with README disclosure, not prohibited.

**Inferred, not documented, and therefore load-bearing risks rather than
facts:**

- That Obsidian's injected bundle `require` returns `null` for Node built-ins
  while `window.require` works. The spike settles it. The design is correct
  either way.
- That `styles.css` is auto-injected from the plugin folder. Universally
  practised, implied by the install list, never stated. Checked in the spike.
- That `adapter.list()` returns dot-entries.

**Open, and deliberately not resolved here:**

- Whether the community directory's build verification accepts a `dist/`
  output. Irrelevant until submission is a goal; recorded so it is not
  rediscovered.
- Whether a loaded view ever reverts to `DeferredView` when hidden again. If it
  does, `onClose` runs on tab switch and part of task 10's pause work is moot;
  if it does not, a long session accumulates one live WebGL context per city tab
  ever shown. Answered empirically at checkpoint #3.
- Whether the WebGL context survives pop-out migration. The chosen
  dispose-and-reconstruct strategy makes this a performance question rather than
  a correctness one.
- The ordering of `setState` relative to `onOpen` on workspace restore. No
  official statement exists. Established empirically at task 3 and recorded.
- Whether external process execution is permitted by policy. No official text
  exists either way. WP-02's concern, but the boundary is frozen now: the
  plugin never installs, downloads, or updates any executable, because
  *"install or update themselves or their dependencies"* is an explicit
  prohibition. **verified**
