---
project: codebase-inspector
title: WP-01 — Native Obsidian Three.js codebase city (design)
status: approved
date: 2026-09-17
revised: 2026-09-17
revision: 3
---

# WP-01 design — Native Obsidian Three.js codebase city

This document records the decisions agreed before implementation. It does not
restate the concept kit or the design package; it resolves them against each
other and against verified Obsidian behaviour.

Section 11 records what was verified, what is inferred, and what remains open.
Claims marked **verified** trace to obsidianmd-owned sources or to a working
plugin in this workspace. Nothing else here is documented fact.

## 0. Precedence

Six bodies of material now govern WP-01. They are not ranked by recency, and
none of them overrides another by silence.

1. **This document's sections 3, 4.4 and 5** — toolchain, build, Node access,
   manifest, and Obsidian host rules. Verified against obsidianmd-owned sources
   and a working plugin. No design document addresses any of this.
2. **This document's sections 4 and 7–8** — frozen contracts, failure behaviour
   and execution model, as reconciled below with `renderer-port.ts`.
3. **The concept kit's safety and evidence gates** (`execution/quality-gates.md`
   G1–G8) and **`docs/deliverables/Native Codebase City.md`** — binding wherever
   this document is silent. The design package affirms this: *"Safety and
   evidence constraints from the implementation kit remain binding."*
4. **The v1.1 handoff** — `docs/concept/design/wp01-review/docs/01`–`08` and
   `integration/renderer-port.ts`. **Authoritative for behaviour**: interaction
   defaults, states, recovery and microcopy, and for anything on which this
   document and the concept kit are both silent.
5. **Screen specifications S01–S13 and S23** — layout zones and content,
   subordinate to the v1.1 handoff where it refines them.
6. **Mockup PNGs** — composition only. **The review prototype
   (`docs/concept/design/wp01-review/`), the Three.js prototype
   (`docs/concept/prototype/`), the older SVG prototype and
   `concepts/00-visual-exploration.png` are never behavioural sources and never
   ship.** Where two prototypes disagree, neither wins: the v1.1 handoff's
   documented value governs, and the disagreement is recorded here.

The working rule: **this document wins on how the plugin is built and how it
touches Obsidian; v1.1 wins on how it behaves.**

Two reading copies are byte-level concatenations of the primary files and are
cited only for convenience: `WP01-DESIGN-TO-IMPLEMENTATION.md` (= `wp01-review/docs/01`–`08`)
and `COMPLETE-DESIGN-SPECIFICATION.md`.

## 1. Scope

The deliverable is the complete WP-01 vertical slice: plugin distribution →
source selection → scope approval → safe read-only scan → normalized snapshot →
Three.js city → inspection. A scaffold or a fixture-only city does not satisfy
it.

**The behavioural surface is screens S01–S13 and S23**, as refined by the v1.1
handoff.

Out of scope, and stated explicitly because the shared design package shows all
of them: fallow and any analyzer; findings, coverage, dependency relations and
runtime evidence; note writing; snapshot history and comparison; **a `lens`
parameter on the city viewport** (C08 declares one; WP-01 builds C08 without
it); **any source-opening or open-in-editor action** (C10 declares
`sourceOpenRequested`; S07's binding table lists only Focus and Copy relative
path, and external process execution is an unresolved policy question — see
section 11); **trusted executable bindings** (WP-02+); **durable snapshot
persistence** (WP-05 — see section 4.3); and **any rendered-but-disabled control
for unimplemented behaviour**, which the design package itself forbids as an
empty placeholder. The "Follow symbolic links" row in S13 is therefore static
explanatory text, not a disabled toggle.

Community-directory submission is not a goal. Every policy and lint rule is
followed so submission stays possible, but the release gate proves a clean-vault
install, not directory readiness.

Repository state: `LICENSE`, `README.md` and `docs/` only. **No implementation
exists to reconcile.** Several v1.1 documents instruct an agent to "read the
existing code" and "reconcile `renderer-port.ts` with implemented types" — those
instructions are void here, and IP-01's deliverable reads *define*, not
*reconcile*.

## 2. Approach: skeleton first

Tasks are sequenced so a loadable plugin exists in a real vault early, and each
later task replaces one layer of it. Rejected: literal concept-kit order
(renderer and UI built against a model never drawn in the host) and headless
core first (defers bundling risk and the "does it feel right" signal to the end).

**The spike targets Node access**, not Vue or Three.js. Research settled those:
published community plugins build Vue 3 SFCs with Vite in CommonJS library mode,
published plugins bundle Three.js, and a working Vite-built Vue plugin exists in
this workspace. What is unvalidated is whether Node built-ins resolve from
inside the bundle — see section 3.1 — which task 5 depends on absolutely.

## 3. Repository and toolchain

```text
codebase-inspector/
  manifest.json  versions.json  package.json  package-lock.json
  vite.config.ts  tsconfig.json  tsconfig.test.json
  eslint.config.mjs  .oxlintrc.json  vitest.config.ts
  .env.example                      # .env is gitignored
  scripts/                          # every project script lives here
  src/        host/ application/ domain/ adapters/ visualization/ ui/
  tests/      unit/ contracts/ integration/ host/ fixtures/ benchmarks/
  dist/                             # build output only; gitignored
  docs/
```

**No build output at the repository root**; `main.js` and `styles.css` are
artefacts in `dist/`, which also satisfies Obsidian's checklist item that
`main.js` belongs in releases, not the repository. **Every script lives in
`scripts/`**; the community scanner ignores that directory wholesale.
**`package-lock.json` is committed**, as the checklist requires. All
**verified**.

### 3.1 Node access — the load-bearing decision

All Node access goes through **one module**,
`src/adapters/filesystem/node-access.ts`, obtaining modules at runtime through
`window.require` with `node:`-prefixed specifiers, guarded by
`Platform.isDesktopApp`:

```ts
// The only place in the codebase that reaches Node. Everything else imports from here.
import { Platform } from 'obsidian';

export const fs = Platform.isDesktopApp ? window.require('node:original-fs') : null;
export const fsPromises = fs ? fs.promises : null;
export const nodePath = Platform.isDesktopApp ? window.require('node:path') : null;
```

Three independent reasons:

1. **`window.require`, not a bundled import.** Obsidian injects its own
   CommonJS `require`, and there is credible evidence it returns `null` for Node
   built-ins while the renderer's `window.require` is Electron's real one. This
   is **inferred** — one plugin's build comment, in tension with the official
   sample externalising `...builtinModules`. The spike settles it; using
   `window.require` is correct either way.
2. **`no-nodejs-modules`** in `eslint-plugin-obsidianmd` flags any static import
   of a Node built-in, and `isDesktopOnly: true` grants no exemption. **verified**
3. **`node:original-fs`, not `fs`.** Electron patches `fs` to be asar-aware;
   `original-fs` is unpatched and correct for walking an arbitrary tree. This is
   what Obsidian's first-party `obsidian-importer` uses. **verified**

Externals still list Node built-ins in bare and `node:` form, so a transitive
dependency referencing them is not bundled.

### 3.2 Build

Vite library mode emits `dist/main.js` (single CommonJS file) plus
`dist/styles.css`, and copies `manifest.json` into `dist/`, making `dist/` the
complete installable plugin folder. `manifest.json` also stays at the repository
root, where the community directory reads it. **verified**

| Setting | Value | Why |
|---|---|---|
| `lib.formats` | `['cjs']` | Obsidian loads CommonJS only. **verified** |
| `output.exports` | `'named'` | Emits `exports.default = Plugin` with the `__esModule` marker — the shape esbuild-built plugins load with. **verified** in this workspace |
| `output.inlineDynamicImports` | `true` | One file is installed; emitted chunks would `require()` files that never ship |
| `output.entryFileNames` | `'main.js'` | |
| `output.assetFileNames` | `.css → 'styles.css'` | Lib mode otherwise emits `main.css` |
| `cssCodeSplit` / `cssMinify` | `false` / `false` | One stylesheet; shipped overrides stay readable |
| `build.target` | `'es2020'` | Known Electron host, not the open web |
| `emptyOutDir` | `true` | Safe: `outDir` is `dist/` |
| `define` | `process.env.NODE_ENV` | Vue's esm-bundler build reads it |
| paths | anchored to `import.meta.url` | Never `process.cwd()` |

Externalised: `obsidian`, `electron`, nine `@codemirror/*`, three `@lezer/*`, and
all Node built-ins in both forms. Bundled: Vue, Pinia, Three.js and the addons
used.

**Three.js is pinned exactly at `0.186.0`** (published 2026-09-08), with
`"@types/three": "^0.186.0"` — three ships no types of its own. The exact pin is
deliberate: Three.js publishes breaking changes in every `0.x` minor and does not
follow semver, so a caret range there is a range of unreviewed migration guides.
The types package is the opposite case — DefinitelyTyped ships pure fixes as
patches within a minor, so a caret picks up corrections with no runtime risk.
`"moduleResolution": "bundler"` is **required**, not preferred: `node16` fails
the addon imports with TS1479, and `node` no longer exists in TypeScript 7.

**r186 deprecated the CommonJS build**, and this needs a guard. `build/three.cjs`
is now a 631-byte stub that calls `process.emitWarning` and re-exports the ESM
file. That deprecation is about *consuming* three via `require()`, whereas we
*produce* CommonJS from three's ESM source — so it does not block us, and a
single CJS `main.js` containing `WebGLRenderer`, `InstancedMesh`, `setColorAt`,
`computeBoundingSphere`, `Raycaster` and `OrbitControls` was built and executed
successfully at this exact configuration. But if the bundler ever resolves the
`require` condition instead of `import`, it pulls the stub and injects a
`process` reference into the Obsidian renderer. Therefore:

```ts
resolve: { conditions: ['import', 'module', 'browser', 'default'] },
// or: resolve.alias = { three: 'three/build/three.module.js' }
```

plus a **build-time assertion that `dist/main.js` contains no
`THREE_CJS_DEPRECATED`**, added in task 1 and kept. `build/three.cjs` will be
removed in a future release, at which point the `require` condition disappears
entirely.

Migration items that apply to our usage:

- **r186** — `Object3D` gained `dispose()`. Any subclass overriding `dispose()`
  must call `super.dispose()`.
- **r177** — use `ColorManagement.workingToColorSpace()` and
  `colorSpaceToWorking()`. The old names still exist but `warnOnce`. This is
  directly on the host-CSS-colour conversion path in section 4.4.
- **r183** — `Clock` is deprecated in favour of `Timer` (core since r179).
- **r152, and this one is silent** — `ColorManagement.enabled` now defaults to
  **true**, so `new Color(hex)` already converts sRGB→working. **Never call
  `convertSRGBToLinear()` on a constructed colour.** The method still exists and
  was not removed, so double-converting raises no error and no warning; it simply
  renders every colour markedly darker and desaturated, losing roughly 2–3× of
  mid-tone luminance. The Three.js prototype in this repository does exactly this
  about twenty times, because r140 shipped `ColorManagement.enabled = false`.
  Section 3.4 bans the call by lint, because no test catches a uniformly darker
  render.
- **r155/r165** — `useLegacyLights` and `physicallyCorrectLights` are gone. Light
  intensities authored before r155 must be multiplied by π. Any lighting values
  lifted from the r140 prototype are wrong by that factor.

`WebGLRenderer` is **not** deprecated — zero deprecation markers in the 0.186.0
source or docs, and `dispose()`/`forceContextLoss()` are both present. The
project's feature focus has moved to `WebGPURenderer`, but no removal timeline
is published; for a box-and-raycast renderer, feature-freeze is a stability
asset. Three.js core plus `OrbitControls` measures ~554 kB minified (~137 kB
gzipped), about 21 kB more than 0.184.0.

**Vue is runtime-only, permanently** — SFC templates compile at build time and
`vue` is never aliased to a full build, because the runtime compiler uses
`new Function`. Expect `dist/main.js` around 0.8–1.2 MB minified. Named imports
from `'three'`, never `import * as THREE`; one addon path convention.

A task-9 acceptance criterion: SFC `<style scoped>` blocks all merge into the
single `dist/styles.css`, so a later component split must not quietly emit a
fourth file.

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

`minAppVersion` is **three-segment**; a bare `1.13` breaks `semver.gt` in the
official `no-unsupported-api` rule. `description` is machine-validated: 10–250
characters, initial capital, terminal period, no emoji, and must not contain the
substrings "obsidian" or "plugin". **No non-schema keys** — the linter reports
them as `disallowedKey`; `fundingUrl` is omitted. The installed folder must be
exactly `codebase-inspector`, or `onExternalSettingsChange` never fires.
`versions.json` is updated only when `minAppVersion` changes and is read from the
repository root, never from release assets. All **verified**.

### 3.4 Typecheck and lint

`vue-tsc --noEmit` over `tsconfig.json` (src) and `tsconfig.test.json` (tests),
both strict, with `isolatedModules` and `verbatimModuleSyntax`.

`oxlint --deny-warnings` is the fast pass. `eslint --max-warnings 0` adds
type-aware typescript-eslint rules, `eslint-plugin-vue` and
**`eslint-plugin-obsidianmd`** — the real package name. Load-bearing rules from
its `recommended` config: `no-nodejs-modules`, `hardcoded-config-path`,
`prefer-instanceof`, `detach-leaves`, `no-unsupported-api`,
`settings-tab/prefer-setting-definitions`. **verified**

**Two architectural rules are lint rules, not prose**, following this
workspace's existing convention:

1. **Size** — `max-lines` at 400 for `src/**`, 450 for `tests/**`.
2. **Layering** — `no-restricted-imports` enforces that `src/domain/**` imports
   nothing from Obsidian, Vue, Three.js, Node or fallow, and that
   `src/visualization/**` reaches neither the filesystem nor the host.
3. **Colour management** — `no-restricted-syntax` bans
   `convertSRGBToLinear` and `convertLinearToSRGB` in `src/visualization/**`.
   Double conversion is silent (section 3.2), so lint is the only thing that
   catches it.

### 3.5 Test and dev loop

Vitest with two projects: `node` (domain, adapters, filesystem integration) and
`jsdom` (Vue components and stores).

`.env` holds `CODEBASE_INSPECTOR_TEST_VAULT`; `.env.example` is committed. The
development vault is `C:\Projects\renovation-planner`.
`scripts/install-to-vault.mjs` copies `dist/` into
`<vault>/.obsidian/plugins/codebase-inspector/`, asserts the folder name matches
the manifest `id`, writes a `.hotreload` marker (the hot-reload plugin ignores
folders lacking `.git` or `.hotreload`), and refuses to run when the variable is
unset, the target is not a vault, or the target resolves inside this repository.
Its hardcoded `.obsidian` is acceptable for a build script and takes an override
(`CODEBASE_INSPECTOR_TEST_VAULT_CONFIG_DIR`); **plugin source must never hardcode
it** (section 4.4).

The dev vault is a working checkout with other plugins installed — a realistic
host and a useful external codebase to inspect, but not isolated, so it cannot
satisfy G1 alone. Task 13 additionally installs into a throwaway vault.

**fallow** is a development-time gate on our own source, added at task 12 as
`npm run analyze`. Not a runtime dependency; not wired into the product until
WP-02.

## 4. Frozen contracts

Committed before any implementation task starts. **Only the user may change
them.** A subagent that believes one must change stops and raises it — there is
no "integration owner" role with that authority.

### 4.1 Domain model

**Implemented:** `Observation`, `CodeEntity` (kinds `repository`, `directory`,
`file`), `Measurement`, `ProviderRun`, `AnalysisScope`, `ApprovedInventoryRun`,
`CodebaseSnapshot`, `SourceReference`, `CodebaseProfile`, `LocalBinding`,
`CityViewState`. **Deferred:** findings, relations, `external-package`, and all
WP-02+ extensions.

1. **Entity identity** is repository id, entity kind, and POSIX root-relative
   path, NUL-joined. Stable across rescans, no hash. Hashing is used only for
   `fileSetDigest` and `contentHash`; a content hash is a revision marker and
   never participates in identity.
2. **The built-in inventory is a `ProviderRun`** (`provider: 'builtin-inventory'`,
   `origin: 'collected'`).
3. **Two metrics only:** `physical-lines` (unit `lines`) and `byte-size` (unit
   `bytes`), each `definitionVersion: '1'`.
4. **File category is a domain concept**, not a renderer detail. A pure
   `classify(relativePath): CategoryId` function produces the `colorKey` that
   layout carries and the legend names. Classification is filename-based and is
   explicitly **not** semantic language analysis.

**Physical lines**: empty text is 0; CRLF is one separator; a trailing newline
adds no phantom line; blank and comment lines count. Binary, undecodable,
skipped and oversized content yield status `unavailable` with a reason and a
null value — never 0. Byte size is a separate observation.

**Run state and snapshot completeness are two axes, not one.**

```ts
type InventoryRunState =
  | 'idle' | 'running' | 'cancelling' | 'cancelled' | 'failed' | 'complete';

// on CodebaseSnapshot
completeness: 'complete' | 'partial';
warnings: readonly string[];
```

A **cancelled** run publishes nothing — the incomplete result is discarded, and
COPY-10 says so to the user. **`partial`** means read gaps inside a run that did
finish (COPY-13). A **failed** run leaves the previous snapshot intact and
labels the failed refresh. `cancelling` is distinct from `cancelled`: publication
is forbidden immediately, but the UI must not claim work stopped before the
collector confirms it.

**Approval is a modelled artefact**, because "opening a view is not
authorisation" needs something to check:

```ts
interface ApprovedInventoryRun {
  profileId: string;
  sourceFingerprint: string;   // over the resolved root
  scopeFingerprint: string;    // over exclusions + limits
  approvedAt: string;
  operation: 'read-only-inventory';
}
```

A changed root or scope invalidates prior approval. The scan coordinator
validates approval before any filesystem access.

**Validation is runtime, not casts** — one `zod`-based validator module checking
payload limits, schema version, finite numbers, duplicate ids, reference
integrity, containment-tree cycles and path safety. Persisted settings and
restored view state are untrusted input.

**Provenance is never read from a payload.** It is a property of the run that
produced a snapshot (`ProviderRun.provider`, `origin`, `capturedAt`), established
by the collector. A restored or imported value claiming provenance is data to be
validated, never a label to be displayed. The Three.js prototype demonstrates the
hole: its UI prints "Synthetic example" or "Imported JSON · not source-verified"
based on a `source` field read straight out of the imported file, so a crafted
file declaring `"source":"synthetic"` is displayed as synthetic. Our
`getState()`/`workspace.json` path is user-editable by section 4.4, so the same
shape of hole is reachable here.

**`docs/concept/prototype/fixtures/snapshot.schema.json` is not a candidate
schema.** It is a demo interchange format with nullable scalars, caller-assigned
ids, no directory entities, no completeness, no warnings, no reason strings and
no snapshot identity — and its own demo fixture violates its own category enum on
24 of 144 records, passing only because the validator silently re-infers. Task 2
therefore checks that **a category outside the classifier vocabulary is rejected,
never silently re-inferred.**

`CityViewState` carries `profileId`, `snapshotId`, `selectedEntityId`, `query`,
`viewMode: '3d' | 'top' | 'list'`, `camera`, `previous3dCamera`, and
`inspectorOpen`. `previous3dCamera` is load-bearing: without persisting it, the
top↔3D round trip is lost on workspace reload. There is no `lensId` in WP-01.

### 4.2 Renderer port

Reconciled with `docs/concept/design/wp01-review/integration/renderer-port.ts`,
which is the presentation DTO boundary derived from section 4.1 — not a
competing model. Names are ours; the capabilities are its.

```ts
export type CreateCityRenderer = (
  mountEl: HTMLElement,
  win: Window,                                   // the prototype omits this; we do not
  onEvent: (e: CityRendererEvent) => void,
) => CityRendererPort;

export interface CityRendererPort {
  setLayout(layout: LayoutResult,
            opts: { generation: number; signal: AbortSignal }): Promise<void>;
  setColors(palette: CityPalette): void;         // colorKey -> resolved colour
  setSelection(selectedEntityId: EntityId | null): void;
  setFilter(matching: ReadonlySet<EntityId> | null): void;  // null = unfiltered, empty = no matches
  setLabels(visible: boolean): void;
  setCameraMode(mode: '3d' | 'top'): void;
  getCamera(): CameraBookmark;
  setCamera(camera: CameraBookmark): void;
  nudgeCamera(delta: { orbit?: [number, number]; pan?: [number, number]; zoomFactor?: number }): void;
  focus(entityId: EntityId): void;
  fit(): void;
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  pause(): void;
  resume(): void;
  dispose(): void;
  getDiagnostics(): RendererDiagnostics;   // instrumentation
  debugLoseContext(): void;                // instrumentation
}

export type CityRendererEvent =
  | { type: 'entity-picked'; entityId: EntityId; snapshotId: string }
  | { type: 'hover-changed'; entityId: EntityId | null; snapshotId: string;
      position: { x: number; y: number } | null }   // canvas-relative, for tooltip anchoring
  | { type: 'camera-changed'; camera: CameraBookmark }
  | { type: 'unavailable'; reason: 'unsupported' | 'context-lost' | 'initialization-failed' };
```

Four of those exist because the Three.js prototype proved the hole:

- **`nudgeCamera`** — section 5.2 requires single-pointer camera controls for
  WCAG 2.5.7, and section 5 assigns the buttons to task 9. Without this the only
  route is `getCamera()` → mutate → `setCamera()`, which forces the Vue layer to
  understand the camera parameterisation and defeats the port.
- **`position` on `hover-changed`** — a tooltip carrying path, category and value
  must be anchored to the building. The event previously carried only an id.
- **`setLabels`** — both prototypes have it and section 4.3 makes district labels
  a task-4 output. Labels are DOM elements in a sibling overlay created through
  `containerEl.ownerDocument`, repositioned on render — which keeps them
  text-scalable for the 200% zoom check and cross-window correct.
- **`getDiagnostics`/`debugLoseContext`** — the G5 benchmark and checkpoint #3's
  leak check both need `info.memory.geometries` and a way to force
  `WEBGL_lose_context`. Ship the loss seam; **do not** ship a restore partner.

**The port never throws.** WebGL2 unavailability, context-creation failure and
initialization failure are reported through `onEvent` as `unavailable`. The view
always mounts and always has a surface. The prototype throws from its
constructor, which inside `onOpen` would break view construction and leave a
half-built leaf.

**The renderer consumes a `LayoutResult`, never a `CodebaseSnapshot`.** It never
computes layout, grouping or district assignment. A renderer API taking a
snapshot is a defect, not a convenience — the prototype's `loadSnapshot(snapshot)`
is the single most copy-pasteable mistake in this repository.

**The view owns sizing.** The renderer installs no `ResizeObserver` of its own;
`resize` is called by the view, re-applies `setPixelRatio` on **every** call
rather than once at construction, and no-ops on a zero-size box so hidden leaves
cost nothing. Resize never implies fit.

**Camera mode is spelled `'3d' | 'top'`** everywhere, matching
`CityViewState.viewMode`. `CameraBookmark` is adopted from `renderer-port.ts`
with `mode` respelled from `'three-dimensional' | 'top-down'`. Keep its
**absolute `position`/`target`/`up`** as the persisted form and derive spherical
angles internally: the prototype stores `theta/phi/radius` but recomputes
`radius` from layout extent, so under dispose-and-reconstruct a restored bookmark
would only be exact if the layout were byte-identical.

Five additions over the previous revision, each closing a hole:

- **`getCamera`/`setCamera`** — without them, dispose-and-reconstruct is
  unimplementable: nothing can harvest the camera off the dying renderer or seed
  its replacement, and `CityViewState.camera` has no operation that produces it.
  `CameraBookmark` is adopted verbatim: `{projection: 'orthographic', mode,
  position, target, up, zoom}`.
- **The `onEvent` out-channel** — the previous interface was write-only, so
  picking, hover, camera changes and context loss crossed the port with no
  contract.
- **`setFilter`** — search dims in place; this could not be expressed before
  without abusing `setColors`, which would collide with category colour.
- **`{generation, signal}` on `setLayout`** — section 7's job token extended to
  the renderer boundary, where it was absent.
- **`setCameraMode`** and a pinned `resize` signature with a **pixel-ratio cap
  of 2**.

**Camera ownership:** the renderer owns the live camera and emits
`camera-changed`; the view mirrors it into `CityViewState` for persistence. A
command to move the camera is a separate call from the event, so host
synchronisation does not loop.

**No `restored` event and no self-healing.** On `unavailable{context-lost}` the
*view* disposes and reconstructs. Window migration and context loss are one
recovery path, deliberately.

Both prototypes implement self-healing, so this rule will be argued against with
a working, screenshotted, test-passing implementation. It is not a
counter-argument: the Three.js prototype's own recorded run logged **33
`WebGL: INVALID_OPERATION: delete: object does not belong to this context`
warnings** in the loss-and-restore path — stale GPU handles surviving the
restore, which is precisely the failure dispose-and-reconstruct exists to
prevent. Its validation summary does not mention them.

**Pop-out migration is `dispose()` plus constructing a new renderer** — there is
no `rebind`. This was reached independently by the design package, whose bridge
document lists renderer persistence as *"None; reconstruct from snapshot/layout/
view state."* The binding consequence: the renderer must be cheap to reconstruct
from an existing `LayoutResult` and `CityViewState`, with no data refetch and no
scan. (`Native Codebase City.md` still says "pop-out rebind"; that wording
predates this decision.)

**`pause`/`resume` invariant:** hidden leaves suspend drawing and input, and
visibility never authorises a scan.

**Cross-window rule** — inside the renderer and view, no bare `window`,
`document`, `requestAnimationFrame`, `setInterval`, `ResizeObserver`,
`IntersectionObserver`, or `instanceof` on a DOM type. All go through the
injected `Window`; DOM type checks use `node.instanceOf(T)`, because plain
`instanceof` returns false across windows. **verified**

### 4.3 Layout output

```ts
interface CityLot {
  entityId: EntityId;
  directoryId: EntityId;
  center: [number, number, number];
  dimensions: [number, number, number];
  colorKey: CategoryId;
  metricState: 'measured' | 'unavailable';
}
interface LayoutResult {
  snapshotId: string;
  layoutVersion: string;
  lots: readonly CityLot[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  scale: { metricId: string; name: string; cap: number; unit: string; clampedCount: number };
}
```

`colorKey` is a **palette key, never a resolved colour**, so recolouring on
`css-change` never re-runs layout. Layout consumes a validated snapshot, never
the filesystem.

**Three presentation states, not two.** Measured-above-zero; **measured zero** —
a minimum-height box that **keeps its category colour** and stays selectable; and
**unavailable** — a neutral colour **plus a distinct silhouette or marker
geometry**, with the reason carried on the `Observation` and surfaced in the
inspector. Colour alone is not enough: the Three.js prototype gives measured-zero
and unavailable identical geometry and distinguishes unavailable only by a grey
that destroys the category signal, with no marker and no reason. Task 4's check
is that **measured-zero and unavailable are distinguishable without reading the
inspector.**

**Display scale:** physical lines on a square-root scale, labelled *"physical
lines · square-root scale"*. The design's reference formula is
`height = 8 + 120 * sqrt(min(lines, cap) / cap)`; the 8-unit base keeps an empty
measured file selectable. **The cap is derived from the snapshot, not hardcoded
at 600** — the design concedes its fixture never exercises the cap, so on a real
repository every file over 600 lines would render at identical height. The
legend names the actual cap and `clampedCount`; raw values are always in the
inspector. Footprint is an equal lot and never encodes the same metric as
height.

Two consequences to state rather than discover. Deriving the cap from the
snapshot means a file's height depends on unrelated files, so the same file
changes height between refreshes — accepted, because a hardcoded cap is either
never reached (the prototype's bites at ~5,690 lines against a fixture maximum of
568) or wrong for the next repository. And `clampedCount` is **the number of lots
whose raw value exceeded the cap**, with the legend naming the cap in source
units (lines), never scene units. Task 4 requires a fixture that actually
exercises the cap — neither prototype's does.

**Switching the height metric re-runs pure layout and arrives via `setLayout`.**
The full instance-matrix upload is accepted to keep the boundary clean. The
prototype has a `setMetric` that mutates matrices in place, which is faster and
moves height ownership into the renderer; we do not.

**Ports** under `src/application/ports/`: `SourceFileSystemPort` (walk, read,
stat), `ProfileStore`, `LocalBindingStore`, `SnapshotStore`, `Clock`,
`CancellationToken`. **`SnapshotStore` is in-memory for WP-01**; durable history
is WP-05. Reopening shows retained in-memory state marked with its age, and
never silently authorises a new scan.

### 4.4 Host rules

All **verified**.

- **Deferred views.** Since 1.7.2 every view is created as a `DeferredView`.
  Reach views via `getLeavesOfType('codebase-inspector-city')` then
  `leaf.view instanceof CityView`. A cast is a defect. `await workspace.revealLeaf(leaf)`
  before acting; `loadIfDeferred()` only where reveal is unacceptable. A
  background tab is never constructed, so no WebGL context exists for it.
- **Never hold a view reference** — the factory may run more than once.
- **`onload` registers only.** No scanning, no expensive work. Startup work goes
  in `workspace.onLayoutReady()`; first-enable view opening uses `onUserEnable()`.
- **WebGL context creation is in `onOpen`, not the constructor.**
- **Never `detachLeavesOfType` in `onunload`.**
- **`onunload` is typed `void` and never awaited** — teardown is synchronous and
  idempotent.
- **Vue mounts on `this.contentEl`**, unmounts in `onClose()`. Not
  `containerEl.children[1]`. Each view calls `createPinia()` itself.
  `.codebase-inspector-root` goes on that same element, because
  `container-type: inline-size` must sit on the element whose inline size is the
  leaf content width.
- **Manual cleanup** (`Component` does not cover it): `requestAnimationFrame`
  handles, every observer, Three.js geometries, materials, textures and render
  targets, `renderer.dispose()` plus `forceContextLoss()`, and any DOM appended
  outside `containerEl`. Browsers cap live WebGL contexts at roughly 8–16.
- **`getState()` returns identifiers and presentation state only** — never a
  snapshot, never a resolved absolute path, never scan authorisation. It
  persists to `workspace.json`, which is user-editable, so `setState` validates
  through the same validator as settings.
- **`getActiveViewOfType`**, never the deprecated `workspace.activeLeaf`.
- **`vault.configDir`**, never a literal `.obsidian`; absolute form is
  `join(adapter.getBasePath(), vault.configDir)` behind
  `adapter instanceof FileSystemAdapter` — `instanceof`, never a cast, because
  mobile supplies a `CapacitorAdapter`.
- **`normalizePath()` is vault-relative only.** It strips leading slashes and
  does not remove `..`, so it gives no path safety. Containment uses
  `path.resolve` plus a `path.relative` sign check.
- **Symlink skipping needs `fs.lstat`** — the adapter's `Stat` has no symlink
  discriminator.
- **Theme.** Read colours with `containerEl.getCssPropertyValue('--…')`, never
  `getComputedStyle(document.body)` (wrong document after migration). Re-read
  every cached colour on `workspace.on('css-change')`, which carries no payload.
  Recolouring never moves buildings, changes camera, or clears state.
- **Colour crossing into WebGL must be normalised.** Obsidian 1.13 moved base
  colours to OKLCH, and resolved values may be `oklch()` or `color-mix()`, which
  `THREE.Color.setStyle()` cannot parse. Convert through a 1×1 canvas 2D context
  in `containerEl.win.document` and feed Three.js sRGB bytes. This also keeps
  the conversion in the correct window.
- **Reduced motion is not a `css-change` event.** The camera tween reads
  `containerEl.win.matchMedia('(prefers-reduced-motion: reduce)')` with a change
  listener released with the view. CSS handles only the CSS-side durations.
- **Styling.** `styles.css` may not target `body`, `:root`, `.workspace`,
  `.theme-dark`/`.theme-light`, and may not redefine any `--background-*`,
  `--text-*` or `--interactive-*` variable. Tokens are Obsidian-derived aliases;
  file-category colours are the one plugin-owned palette and are declared as
  `--ci-cat-*` custom properties, never hex constants in the renderer. Note
  `:where(.codebase-inspector-root)` has zero specificity, so literal `color`/
  `background`/`font-family` declarations there lose to most theme rules; custom
  property declarations are unaffected. `design-tokens.css` plus the
  `03-design-system.md` mapping table are authoritative — `design-tokens.json`
  diverges from both and is a non-normative index.
- **Settings are hybrid.** Declarative `getSettingDefinitions()` for scalar
  settings (size limits, exclusions, symlink policy as static text). The profile
  and local-binding manager, exclusion review, clear-binding confirmation and
  storage disclosure are rendered in `PluginSettingTab.display()` or a modal,
  with a scoped `prefer-setting-definitions` disable. Whether
  `getSettingDefinitions()` can express a dynamic per-profile list is unverified
  — see section 11. **Decide before task 6 begins.**

## 5. Task sequence

| # | Task | Ends with | Check |
|---|---|---|---|
| S | Bundling and Node-access spike (throwaway) | See 5.1 | user |
| 1 | Toolchain | `npm run verify` green; `install:vault` delivers files | — |
| 2 | Contracts, validator, classifier, fixture builder | Valid fixtures round-trip; invalid rejected with reasons; fixtures include unavailable and measured-zero records | — |
| 3 | Host skeleton: manifest, plugin entry, `ItemView`, ribbon, `open-city`, first-run no-profile state, minimal instanced-box renderer behind a dev-only fixture path | Opening the view runs no scan and no filesystem access, and shows the welcome state; the packed plugin loads in a clean vault | **#1** |
| 4 | Pure layout: deterministic nested districts, equal lots, display scale, legend data, district labels | No overlaps; identical input yields identical geometry; three metric states distinguishable | — |
| 5 | Inventory collector: Node access module, bounded async walk, exclusions, cancellation, metrics | Cross-platform and no-source-write fixtures pass; plugin outputs stay outside collection scope | — |
| 6 | Profiles, bindings, hybrid settings tab | Profiles persist; a missing binding prompts reconnect | — |
| 7 | Source selection and scope consent: two native modals — three source modes with validation, then resolved root, exclusions, limits, unchecked acknowledgement, Scan disabled until approved, approval fingerprint | A scan cannot start without consent; a changed root invalidates approval | — |
| 8 | Scan wiring and run lifecycle: coordinator, `scan-codebase` (which doubles as refresh), `cancel-scan`, progress, `cancelling`→`cancelled`, atomic publication after validation, stale-callback rejection | A real external project renders as a real city; cancel retains the previous snapshot | **#2** |
| 9 | Vue UI: app shell, file list, search, inspector, state surface (C16/C17), responsive drawers, announcement region, copy-path | Canvas and HTML selection stay synchronised; every state has a surface | — |
| 10 | Renderer hardening: instancing with batch-and-instance to entity map, picking, camera, hover, focus, fit, top/3D, reduced motion, context loss | Correct file selected; rendering on demand only | — |
| 11 | Lifecycle: multiple leaves, workspace state, hidden and resized leaves, pop-out migration, dispose, per-leaf snapshot reconciliation | No leaks, no wrong-window DOM; a removed selected file is reported, never replaced by index | **#3** |
| 12 | Safety, evidence and accessibility gates; benchmark fixtures; fallow on our own source | G2, G3, G4 and G5 evidence recorded | — |
| 13 | Release gate: throwaway clean vault, scripted demo, benchmark record, limitations, implementation report | WP-01 complete and honestly reported | **#4** |

Ordering rationale unchanged: layout precedes the real scan so the renderer is
fed by a pure function; the Vue UI precedes renderer hardening so the keyboard
and non-WebGL paths are built in, not bolted on.

Commands registered without the plugin-id prefix: `open-city`, `scan-codebase`,
`cancel-scan`. **`scan-codebase` doubles as refresh** — its behaviour differs
when a snapshot already exists (the previous snapshot stays visible, a separate
running state shows, and publication is an atomic swap after validation). No
fourth command, and none for an unimplemented capability.

### 5.1 Spike scope and pass criteria

One throwaway plugin outside this repository, installed into the dev vault,
logging one line per probe. Probes: a registered `ItemView`; a Vue 3 SFC with
template, scoped style and reactive click handler mounted on `contentEl`; Pinia;
a Three.js `InstancedMesh` of ~1,000 boxes with `OrbitControls`; and — the point
— directory reads through `window.require('node:original-fs')` and
`window.require('node:path')`, compared against bundled static imports of `fs`
and `node:fs`.

Passes only if `dist/` contains exactly `main.js`, `styles.css` and
`manifest.json`; the bundle is CommonJS; the plugin enables with no console
error; the SFC renders with scoped styles applied; the Three.js scene draws and
orbits; **the `window.require` reads return real directory entries**; no
`new Function(` or `eval(` survives in the production bundle; and two
disable/enable cycles leave no errors. Record whether the static imports work
(the disputed claim) and `dist/main.js` size as the baseline budget.

The spike also answers cheaply whether `vault.getFiles()` returns entries for
`.ts` files, and whether `styles.css` is auto-injected with no loader code.

### 5.2 Resolved interaction defaults

These come from the v1.1 handoff and are binding. They are recorded here because
leaving them to an implementer would mean re-deciding them badly.

**Camera and pointer.** Orthographic projection in both 3D and top view, with an
oblique default. Drag threshold is **5 CSS pixels** — never device pixels;
movement beyond it is an orbit and release never selects. Wheel zoom only over
the focused canvas, never captured from lists or other leaves. No inertial
drift. Top→3D restores the saved `CameraBookmark` in full; top-view operations
never mutate it. Resize never implies Fit.

**Selection.** A click selects and opens the inspector; it does not move the
camera, change the search, or rebuild layout. Focus is a separate explicit
action. Empty-space click is a no-op. Double-click focus is deferred out of
WP-01. Moving keyboard focus in the list does not select. Closing the inspector
preserves the selection; clearing it is explicit. Ray picking runs only against
file lots — never labels, ground planes, district borders or overlays.

**Hover.** ~200 ms tooltip with path, category and value; no camera or selection
change; dismissed on leave or Escape; emits no screen-reader announcement. The
200 ms comes from the concept kit, not the v1.1 handoff, which is silent — and
**neither prototype implements any delay**, so the number is unreplicated. Keep
it as a decision rather than an inherited value: without hover intent the
renderer raycasts on every `pointermove`, which is what the Three.js prototype
does.

**Search.** Case-insensitive substring over included file paths; empty or
whitespace-only matches all. Placeholder "Search files or paths…". Debounce
~150 ms with immediate input text. Enter selects the first match in deterministic
order **without moving the camera**; Enter with no matches is a no-op. Escape
clears only a non-empty query and keeps focus in the field. **Dims non-matches
in place — never hides, relocates or relayouts.** A filter-hidden selection stays
selected and is explained ("Selected file is outside the current search"), never
silently replaced.

**Escape resolves exactly one layer per press:** modal → camera interaction/help
→ nonmodal drawer → query or selection, and only when the corresponding control
has focus. It must not disturb IME composition or a Markdown editor.

**Keyboard.** No host-wide default bindings; register commands so users bind
their own. `F`, `T`, `+`/`-`, arrows, Shift-arrows and Enter work only when the
canvas itself has focus. `/` focuses search only when this view owns focus and
the target is not editable. Composing input and Ctrl/Meta/Alt combinations are
ignored. The canvas is one named region with a help description, not thousands of
tabbable buildings. List rows are native buttons; no `role=tree` on an
incomplete implementation.

**Non-drag alternatives (WCAG 2.5.7).** Every dragging gesture needs a
single-pointer route. **Minimum set: zoom in and out, rotate left and right, pan
in four directions, Fit, Top, Focus** — all single-pointer. A keyboard-only
alternative is explicitly not sufficient, and neither is a single rotate button
with keyboard arrows for the rest: the Three.js prototype's camera dock offers
zoom, Fit and one "Rotate left", with no pointer-only pan and no rotate-right, so
its capture is not a sufficient reference. These are UI work in task 9 driving
`nudgeCamera`, not renderer work in task 10.

**Step increments**, adopted from the Three.js prototype, which is the only
source that supplies them: orbit 0.12 rad per arrow press, pan 30 px, keyboard
zoom ×1.15, button zoom ×1.2, rotate button π/8.

**Responsive.** Measured on the leaf, never the window, via container queries.
**One collapse threshold at 820 CSS px** — provisional and now contested: the
v1.1 handoff uses a container query at 820, the Three.js prototype uses viewport
media queries at 1200/960/700 and `window.innerWidth > 960` in JS, and the v1.1
document itself calls 820 *"a new provisional threshold … not a claim about
optimal device breakpoints."* Section 0 ranks v1.1 higher, so 820 with container
queries stands, but re-check it at checkpoint #3 against a normal leaf, a sidebar
leaf and a pop-out. Above it, list + canvas + inspector;
below, canvas with Files and Inspector drawers, one overlay at a time, each with
a visible close returning focus to its opener. Below a hard floor the view
renders list-first and **creates no WebGL context at all** — a leaf dragged into
a sidebar can be ~150 px, and this also protects the live-context cap. Switching
to the HTML inventory preserves query, selection and camera bookmark.

**Progress.** Unknown total means no percentage, no `aria-valuenow`, and no
fabricated ETA — report the stage and offer cancellation. Counts such as "96
files read so far" are not a percentage.

**Announcements.** A polite status region for scan stage transitions, snapshot
completion, cancellation, and control-initiated selection changes. Assertive
only for a blocking failure. Hover announces nothing. Throttle rapidly changing
counters.

**Microcopy.** Adopt COPY-01…COPY-14, COPY-27, COPY-28 and COPY-30 as the WP-01
strings. COPY-20 ("Unused candidate") is WP-02+ and must not leak forward. Drop
S01's "Analysis reports can be added later", which promises a capability WP-01
does not ship. The strings "Read-only source access" and "Source remains
unchanged" are factual claims made on the product's behalf: **they ship only
after task 12 records the G2 evidence**, and the release report cites it.

## 6. Testing

Six layers:

- **Unit** — metrics, identity encoding, classifier, validator, layout, and the
  **interaction-state invariants**. The design package's 31 state tests
  (`wp01-review/validation/model.test.cjs`) are ported to Vitest, keeping the
  invariants rather than copying function names. Highest-value: top-view round
  trip restores the exact 3D camera; late completion after cancel is ignored; an
  old run cannot overwrite a newer run; scan completion preserves inspection
  context.
- **Contract** — one shared suite every port implementation must pass, so a fake
  and the Node adapter cannot drift.
- **Integration** — real temporary directories: Unicode names, spaces, deep
  nesting, duplicate basenames, binary content, oversized files, unreadable
  files, symlinks and junctions, nested ignore rules, Windows drive paths.
- **Component** — jsdom tests replaying the design's browser checks B02–B10,
  B18–B19, B21 and B23–B26 against our production controls.
- **Accessibility** — keyboard-only; a screen reader (NVDA on Windows or
  equivalent); 200% text zoom; focus visibility and order; dark, light and one
  third-party theme; non-drag single-pointer equivalence; reduced motion; long
  Unicode paths. Checkpoint work except where a jsdom assertion suffices.
- **Benchmark** — 1,000-file functional and 5,000-file performance fixtures.

Every task is test-driven: a failing test precedes implementation.

Two gates get purpose-built proofs rather than assertions:

- **No source writes.** Hash every file in the fixture tree before and after a
  scan and diff the whole tree, including modification times.
- **Secrets are never read.** The filesystem port records every path it opens;
  the test asserts excluded paths never appear in that read log — proving the
  absence of a read, not absence from the interface. When the vault is the
  codebase this covers `vault.configDir`, other plugins' `data.json`, and `.git`.

**No prototype's results are ever cited as evidence for this implementation.**
The design package's 31 state tests and 28 browser checks prove a Canvas 2D
reference; its `type-contract-check.txt` proves one declaration file compiles,
and its two validation records describe different runs, so quoting "28" requires
saying which 28. The `docs/concept/prototype/` tree's 23 model tests, 37 browser
checks, 6 embedding checks, 7 server checks and one type check likewise prove a
standalone browser reference **on a software rasteriser** (ANGLE SwiftShader,
with the HTML injected via `page.set_content` because `file://` was blocked) —
not this implementation, and not a hardware GPU. It exercises no Obsidian host,
no filesystem, no repeated construct-and-dispose cycle, no second leaf, no window
migration, and asserts no timing at any scale.

Two different files are named `model.test.cjs` and test different things. Both
are worth porting: `docs/concept/design/wp01-review/validation/model.test.cjs`
(31 tests over the interaction state machine — camera, selection and inspector
invariants) and `docs/concept/prototype/tests/model.test.cjs` (23 tests over
normalisation, path safety, determinism and layout, covering tasks 2 and 4
directly — including "zero is a valid measurement", "unknown is not coerced to
zero", "identical inventory creates identical lot positions", "filtering does not
mutate layout or inventory", and "many directories are explicitly aggregated, not
dropped").

`tests/acceptance/wp01.feature` adopts `production-acceptance.feature`'s 21
scenarios, with three repairs: add "Vault is the codebase" and "theme change
while a city is open" (both required by `Native Codebase City.md` and missing),
and restore the late-result scenario to its **cross-profile** form, which is what
section 7 actually requires.

## 7. Failure behaviour

- Unavailable is never 0, in the model and in presentation.
- **A cancelled run publishes nothing.** `partial` means read gaps in a run that
  finished. A failed run leaves the previous snapshot intact and labels the
  failed refresh. Publication is an atomic swap after validation; the previous
  snapshot is immutable until then.
- `cancelling` is distinct from `cancelled`; the UI never claims work stopped
  before the collector confirms.
- **Run identity is the full tuple** `{profileId, sourceFingerprint,
  scopeFingerprint, runId, generation}`. A result may publish only if every
  identity still matches, cancellation has not invalidated it, and validation
  succeeds. A scope fingerprint is what makes "a changed root invalidates
  approval" mechanical rather than advisory.
- View-level states each have a surface: no source selected, invalid directory,
  read not approved, scanning with unknown or known denominator, cancelled,
  empty included scope, no search matches, partial read evidence, root moved or
  unavailable (inspect the retained snapshot; never scan a fallback root), 3D
  unavailable, and WebGL context lost (no scan restart).
- Validation failures surface as visible warnings carrying their reason, in
  `CodebaseSnapshot.warnings`. Never dropped silently.
- Provider run completion, findings and policy verdict remain separate fields.
- Teardown is synchronous and idempotent, because `onunload` is not awaited.

## 8. Execution model

Branch `feat/wp-01-codebase-city`, merged to `main` at the release gate.

Each task goes to a fresh **implementer** subagent with the task text, this
document, explicit file ownership and the test-driven requirement. A fresh
**reviewer** subagent then audits the diff against that task's acceptance
criteria and the relevant quality gate. Findings are relayed and fixed before
the task is committed. One task, one commit. Checkpoints at tasks 3, 8, 11 and
13 pause for a manual checklist in Obsidian.

**This model governs, and the v1.1 prompts do not.**
`wp01-review/docs/04-first-release-build-order.md` proposes three parallel work
streams with an "integration owner" who may change shared contracts; that is the
model section 2's ordering rationale replaces, and only the user may change a
section 4 contract. **`08-implementation-agent-prompt.md` and
`handoff/agent-implementation-prompt.md` are not pasted into an implementer
session** — their acceptance criteria are absorbed per task instead. Both assume
an existing implementation that does not exist, and `08`'s internal path
`docs/04-first-release-build-order.md` does not resolve from this repository
root.

Checkpoint #2 additionally verifies: the consent gate blocks a scan, a changed
root invalidates approval, and cancel retains the previous snapshot with its
timestamp.

## 9. Packet traceability

The v1.1 packets cut by user-visible use case; our tasks cut by architectural
layer and host risk. The tasks are the unit of execution; this table exists so no
packet's acceptance evidence is silently dropped.

| Packet | Produced by |
|---|---|
| IP-01 Consolidate contracts | 2 (plus the classifier and the renderer-port reconciliation in 4.1–4.2) |
| IP-02 Open a native inspector view | 1, 3, 6 |
| IP-03 Source selection and read-only inventory | 5, 7, 8, with the no-write proof in 12 |
| IP-04 Render the city with Three.js | 4, 10, with the benchmark in 12 |
| IP-05 Find and inspect without losing context | 9, plus fit/top/focus in 10 |
| IP-06 Refresh, cancel, fail, recover | 8, with per-leaf reconciliation in 11 |
| IP-07 Validate the actual Obsidian host | 11 and 12, checkpoints #3 and #4 |
| IP-08 Package and release | 13 |

Packets supply nothing on bundling, Node access, the toolchain, or Obsidian host
APIs; sections 3 and 4.4 stand unchallenged by them. Conversely the packets
carried real unowned work — the consent artefact, the run lifecycle, the
responsive drawer, path-copy recovery, accessibility validation — now absorbed
above.

## 10. Definition of done

An installable build satisfies the real-root workflow for a vault-based and an
external project; measurements match fixtures; scanning changes no file in the
inspected project; the accessibility matrix and lifecycle checks pass; benchmark
results and limitations are recorded; and every visible command and setting is
implemented.

The scripted demo runs: real external repository → scope approval → scan → find a
known file → confirm measurements → keyboard and HTML paths → cancel a refresh →
reopen → source unchanged; then repeated vault-based.

The README discloses that the plugin reads files outside the vault and why —
required by Obsidian's developer policies for any future submission, and honest
documentation regardless — and states positively that there is no network use
and no telemetry. A recognised `LICENSE` file is present.

Then the increment stops, before fallow.

## 11. Verification basis

Verified on 2026-09-17 against `docs.obsidian.md`, the `obsidianmd/obsidian-api`
typings, `obsidianmd/eslint-plugin`, the official sample plugin, Obsidian's
first-party `obsidian-importer`, and a working Vite + Vue plugin in this
workspace (`C:\Projects\renovation-planner`).

**Settled:** Vite library mode builds loadable plugins; Vue 3 SFCs and Three.js
are proven in published plugins; `minAppVersion` must be three-segment; the lint
package is `eslint-plugin-obsidianmd`; deferred views change every view access;
the pop-out hook is `HTMLElement.onWindowMigrated`; reading files outside the
vault is permitted with README disclosure.

**Inferred, and therefore risks rather than facts:**

- That Obsidian's injected `require` returns `null` for Node built-ins while
  `window.require` works. The spike settles it; the design is correct either way.
- That `styles.css` is auto-injected. Universally practised, never stated.
- That `adapter.list()` returns dot-entries.
- **The design package's Three.js and Obsidian citations** (`[T1]`–`[T4]`,
  `[O1]`–`[O2]` in `07-sources-and-limits.md`) use non-canonical URL forms —
  `threejs.org/docs/pages/InstancedMesh.html` rather than
  `threejs.org/docs/#api/en/objects/InstancedMesh` — which suggests they were
  constructed rather than fetched. Treat as inferred until re-fetched,
  particularly `[T4]`, the Three.js version pin, which the document itself
  hedges.

**Open:**

- **Whether `getSettingDefinitions()` can express a dynamic per-profile list
  with buttons and custom rows.** Blocks task 6; the hybrid in section 4.4 is the
  fallback.
- Whether Three.js 0.186.0 behaves correctly **inside Obsidian**. The bundling,
  types and API surface were verified empirically under Node and two bundlers,
  but WebGL2 context creation, the on-demand render loop and GPU disposal under
  Electron 43 were not exercised in the host. The spike covers it. **The Three.js
  prototype does not reduce this risk at all** — every rendering, colour,
  lighting, picking and disposal behaviour it demonstrates is r140's, and its own
  README says to *"revalidate rendering, color management, picking, lifecycle,
  and context recovery before integration."* Its visual result is not
  transferable, because of the two silent breaks in section 3.2.
- Whether a renderer reconstructed from a `CameraBookmark` and a `LayoutResult`
  lands where it left off. Dispose-and-reconstruct is agreed by both prototypes
  and demonstrated by neither: the Three.js prototype disposes exactly once, on
  `pagehide`, and never reconstructs.
- Visual regression against the design's mockups. r181 changed PBR energy
  conservation and indirect specular, so rough materials render brighter than in
  earlier versions. If any reference screenshot was taken against an older
  Three.js, expect to retake it. Magnitude unmeasured.
- The Three.js migration wiki omits r186's CommonJS deprecation entirely — it is
  documented only in the GitHub release notes and visible in the published
  tarball. Treat that wiki page as incomplete for r186 when upgrading.
- r187 is already in development and will make `WebGLRenderer` use `WeakRef` and
  `FinalizationRegistry` internally, which could interact with our
  strict-disposal-on-close pattern. Re-test at upgrade time.
- Whether a loaded view reverts to `DeferredView` when hidden again. If it does,
  `onClose` runs on tab switch and part of task 11's pause work is moot; if not,
  a long session accumulates one live WebGL context per city tab ever shown.
  Answered at checkpoint #3.
- Whether the WebGL context survives pop-out migration. Dispose-and-reconstruct
  makes this a performance question, not a correctness one.
- Ordering of `setState` relative to `onOpen` on workspace restore. No official
  statement; established empirically at task 3.
- Whether the community directory's build verification accepts a `dist/` output.
  Irrelevant until submission is a goal.
- Whether external process execution is permitted by policy. No official text
  either way. WP-02's concern, but the boundary is frozen now: the plugin never
  installs, downloads or updates any executable, because *"install or update
  themselves or their dependencies"* is an explicit prohibition. **verified**
