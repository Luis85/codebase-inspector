# WP-01 — Native Obsidian Three.js codebase city — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the complete WP-01 vertical slice — plugin distribution → source selection → scope approval → safe read-only scan → normalized snapshot → Three.js city → inspection — as an installable, desktop-only Obsidian plugin.

**Architecture:** Skeleton first. A loadable plugin exists in a real vault by task 3, and each later task replaces one layer of it. A pure domain (model, classifier, validator, layout) feeds a `LayoutResult` across a renderer port to a Three.js instanced-box city; a Vue 3 + Pinia UI owns focus, keys, sizing and accessible naming; all Node access funnels through one module obtained at runtime through `window.require`.

**Tech Stack:** TypeScript (strict, `moduleResolution: "bundler"`), Vue 3 SFC (runtime-only), Pinia, Three.js `0.186.0` (exact pin) + `OrbitControls`, Vite library mode → single CommonJS `dist/main.js`, Vitest (node + jsdom projects), zod, oxlint + ESLint (`eslint-plugin-obsidianmd`), `vue-tsc`.

**Spec:** [docs/superpowers/specs/2026-09-17-codebase-inspector-wp01-design.md](docs/superpowers/specs/2026-09-17-codebase-inspector-wp01-design.md) — revision 5, status approved. **The spec travels with this plan; executors read both.** Section 0 defines six ranks of authority — read it first.

---

## How this plan is executed

Spec §8 governs. It is not negotiable and it replaces the execution model proposed by any v1.1 document.

1. **Branch:** `feat/wp-01-codebase-city`, cut from `main`. Merged to `main` only at task 13.
2. **One completed task = one commit.** No task is committed until its reviewer has signed off.
3. **Each task runs in a fresh implementer subagent**, handed: the spec, *this task's section only*, its explicit file ownership, and the test-driven requirement.
4. **A fresh reviewer subagent then audits the diff** against that task's acceptance criteria and the relevant quality gate (`docs/concept/execution/quality-gates.md` G1–G8). Findings are relayed and fixed *before* the commit.
5. **Checkpoints at tasks 3, 8, 11 and 13 pause for a manual checklist** the user runs in Obsidian. Each is written out in full at the end of its task.
6. **A §4 contract is frozen.** If an implementer believes a frozen contract (spec §4.1–§4.5) must change, it **stops and raises it with the user**. There is no "integration owner" role with that authority, and no working around it.

### Documents that must never be pasted into an implementer session

- `docs/concept/design/wp01-review/docs/08-implementation-agent-prompt.md`
- `docs/concept/design/handoff/agent-implementation-prompt.md`

Both assume an existing codebase that does not exist here, and both propose an execution model spec §8 replaces. Their acceptance criteria are already absorbed into the tasks below.

### Sources that are never behavioural evidence

Spec §0 rank 6. `docs/concept/prototype/`, `docs/concept/prototype-v2/`, `docs/concept/design/wp01-review/src/`, `wp01-review/index.html`, `wp01-review/captures/`, the SVG prototype and `concepts/00-visual-exploration.png` are **never behavioural sources and never ship**. The Three.js prototype vendors Three.js **r140** against our **0.186.0** pin, so every rendering, colour, lighting, picking and disposal behaviour it demonstrates is r140's.

**No prototype's test results are ever cited as evidence for this implementation.** Where this plan names a prototype file, it names it as *a piece of code or a test case to port*, and the ported test must pass against our implementation on its own.

---

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the spec.

### Dependencies and toolchain

| Constraint | Value | Spec |
|---|---|---|
| Three.js | **exactly `"three": "0.186.0"`** — no caret, no range | §3.2 |
| Three.js types | `"@types/three": "^0.186.0"` (three ships no types) | §3.2 |
| `moduleResolution` | **`"bundler"`** — required, not preferred. `node16` fails addon imports with TS1479; `node` no longer exists in TypeScript 7 | §3.2 |
| Vue | runtime-only, **permanently**. Never aliased to a full build — the runtime compiler uses `new Function` | §3.2 |
| Three.js imports | Named imports from `'three'`. **Never `import * as THREE`.** One addon path convention | §3.2 |
| `minAppVersion` | `"1.13.0"` — **three segments**; a bare `1.13` breaks `semver.gt` in `no-unsupported-api` | §3.3 |
| Plugin folder | exactly `codebase-inspector`, or `onExternalSettingsChange` never fires | §3.3 |
| `package-lock.json` | committed | §3 |
| Build output | `dist/` only; **never at the repository root**; `dist/` is gitignored | §3 |
| Scripts | **every script lives in `scripts/`** — the community scanner ignores that directory wholesale | §3 |

### Build (Vite library mode)

| Setting | Value |
|---|---|
| `lib.formats` | `['cjs']` |
| `output.exports` | `'named'` |
| `output.inlineDynamicImports` | `true` |
| `output.entryFileNames` | `'main.js'` |
| `output.assetFileNames` | `.css → 'styles.css'` |
| `cssCodeSplit` / `cssMinify` | `false` / `false` |
| `build.target` | `'es2020'` |
| `emptyOutDir` | `true` |
| `define` | `process.env.NODE_ENV` |
| paths | anchored to `import.meta.url`, **never `process.cwd()`** |
| `resolve.conditions` | `['import', 'module', 'browser', 'default']` — or `resolve.alias = { three: 'three/build/three.module.js' }` |

**Externalised:** `obsidian`, `electron`, nine `@codemirror/*`, three `@lezer/*`, and all Node built-ins **in both bare and `node:` form**.
**Bundled:** Vue, Pinia, Three.js and the addons used.

### Three.js 0.186.0 silent breaking changes — carry these into every task that touches colour or lighting

These are **silent**. No error, no warning, no failing test catches them. Tasks 3, 4, 9, 10 and 12 each restate the ones that apply to them.

1. **r152 — `ColorManagement.enabled` now defaults to `true`.** `new Color(hex)` already converts sRGB→working. **Never call `convertSRGBToLinear()` on a constructed colour.** The method still exists and was not removed, so double-converting raises no error and no warning; it simply renders every colour markedly darker and desaturated, losing roughly 2–3× of mid-tone luminance. **The Three.js prototype in this repository does exactly this about twenty times**, because r140 shipped `ColorManagement.enabled = false`. Banned by lint (below), because no test catches a uniformly darker render.
2. **r155/r165 — `useLegacyLights` and `physicallyCorrectLights` are gone.** Light intensities authored before r155 **must be multiplied by π**. **Any lighting value lifted from the r140 prototype is wrong by that factor.**
3. **r177 — use `ColorManagement.workingToColorSpace()` and `colorSpaceToWorking()`.** The old names still exist but `warnOnce`. This is directly on the host-CSS-colour conversion path.
4. **r183 — `Clock` is deprecated in favour of `Timer`** (core since r179).
5. **r186 — `Object3D` gained `dispose()`.** Any subclass overriding `dispose()` **must call `super.dispose()`**.
6. **r186 deprecated the CommonJS build.** `build/three.cjs` is a 631-byte stub that calls `process.emitWarning`. We *produce* CommonJS from three's ESM source, so this does not block us — but if the bundler ever resolves the `require` condition instead of `import`, it pulls the stub and injects a `process` reference into the Obsidian renderer. Hence `resolve.conditions` above **plus a build-time assertion that `dist/main.js` contains no `THREE_CJS_DEPRECATED`** (added in task 1, kept forever).
7. **r181 changed PBR energy conservation and indirect specular** — rough materials render brighter than in earlier versions. Any reference screenshot taken against an older Three.js must be retaken. Magnitude unmeasured (§11).

`WebGLRenderer` is **not** deprecated in 0.186.0 — zero deprecation markers, and `dispose()`/`forceContextLoss()` are both present.

### Architectural rules that are lint rules, not prose (§3.4)

1. **Size** — `max-lines` at **400** for `src/**`, **450** for `tests/**`.
2. **Layering** — `no-restricted-imports` enforces that `src/domain/**` imports **nothing** from Obsidian, Vue, Three.js, Node or fallow, and that `src/visualization/**` reaches **neither the filesystem nor the host**.
3. **Colour management** — `no-restricted-syntax` bans `convertSRGBToLinear` and `convertLinearToSRGB` in `src/visualization/**`.

Plus the `eslint-plugin-obsidianmd` `recommended` load-bearing rules: `no-nodejs-modules`, `hardcoded-config-path`, `prefer-instanceof`, `detach-leaves`, `no-unsupported-api`, `settings-tab/prefer-setting-definitions`.

### Host rules (§4.4) — all verified

- **All Node access goes through one module**, `src/adapters/filesystem/node-access.ts`, via `window.require` with `node:`-prefixed specifiers, guarded by `Platform.isDesktopApp`. **`node:original-fs`, never `fs`** — Electron patches `fs` to be asar-aware.
- **Deferred views.** Reach views via `getLeavesOfType('codebase-inspector-city')` then `leaf.view instanceof CityView`. **A cast is a defect.** `await workspace.revealLeaf(leaf)` before acting.
- **Never hold a view reference** — the factory may run more than once.
- **`onload` registers only.** Startup work → `workspace.onLayoutReady()`; first-enable view opening → `onUserEnable()`.
- **WebGL context creation is in `onOpen`, not the constructor.**
- **Pop-out migration** is signalled by `HTMLElement.onWindowMigrated` on `containerEl`; retain and call the destroy function it returns. Handling it is **dispose plus reconstruct**, never a rebind.
- **Never `detachLeavesOfType` in `onunload`.** `onunload` is typed `void` and never awaited.
- **Vue mounts on `this.contentEl`**, unmounts in `onClose()`. Not `containerEl.children[1]`. Each view calls `createPinia()` itself. `.codebase-inspector-root` goes on that same element.
- **`getState()` returns identifiers and presentation state only** — never a snapshot, never a resolved absolute path, never scan authorisation. `setState` validates through the same validator as settings.
- **`getActiveViewOfType`**, never `workspace.activeLeaf`.
- **`vault.configDir`**, never a literal `.obsidian` in plugin source; absolute form is `join(adapter.getBasePath(), vault.configDir)` behind `adapter instanceof FileSystemAdapter`.
- **`normalizePath()` is vault-relative only** — it strips leading slashes and does not remove `..`, so **it gives no path safety**. Containment uses `path.resolve` plus a `path.relative` sign check.
- **Symlink skipping needs `fs.lstat`** — the adapter's `Stat` has no symlink discriminator.
- **Theme:** read colours with `containerEl.getCssPropertyValue('--…')`, never `getComputedStyle(document.body)`. Re-read every cached colour on `workspace.on('css-change')` (no payload). Recolouring never moves buildings, changes camera, or clears state.
- **Colour crossing into WebGL must be normalised.** Obsidian 1.13 moved base colours to OKLCH; resolved values may be `oklch()` or `color-mix()`, which `THREE.Color.setStyle()` cannot parse. Convert through a 1×1 canvas 2D context in `containerEl.win.document`.
- **Reduced motion is not a `css-change` event** — read `containerEl.win.matchMedia('(prefers-reduced-motion: reduce)')` with a listener released with the view.
- **Cross-window rule:** inside the renderer and view, **no bare `window`, `document`, `requestAnimationFrame`, `setInterval`, `ResizeObserver`, `IntersectionObserver`, or `instanceof` on a DOM type.** All go through the injected `Window`; DOM type checks use `node.instanceOf(T)`.
- **Styling:** `styles.css` may not target `body`, `:root`, `.workspace`, `.theme-dark`/`.theme-light`, and may not redefine any `--background-*`, `--text-*` or `--interactive-*` variable. File-category colours are declared as `--ci-cat-*` custom properties, **never hex constants in the renderer**.
- **Manual cleanup** (`Component` does not cover it): `requestAnimationFrame` handles, every observer, Three.js geometries, materials, textures and render targets, `renderer.dispose()` **plus** `forceContextLoss()`, and any DOM appended outside `containerEl`. Browsers cap live WebGL contexts at roughly 8–16.

### Binding interaction defaults (§5.2)

| Value | Setting |
|---|---|
| Drag threshold | **5 CSS pixels** — never device pixels |
| Hover dwell | **~200 ms** before `hover-changed`; `null` emitted immediately on leave |
| Search debounce | **~150 ms** with immediate input text |
| Orbit step | **0.12 rad** per arrow press |
| Pan step | **30 px** |
| Keyboard zoom | **×1.15** |
| Button zoom | **×1.2** |
| Rotate button | **π/8** |
| Responsive collapse | **one container-query threshold at 820 CSS px** (measured on the leaf, never the window) |
| Hard floor | **320 CSS px** inline size — below it, list-first and **no WebGL context at all** |
| Pixel ratio | clamped to a **maximum of 2**, re-applied on **every** `resize` call |
| Projection | **Orthographic in both 3D and top view**, oblique default |
| Escape priority | modal → camera interaction/help → nonmodal drawer → query → selection |

Commands registered **without the plugin-id prefix**: `open-city`, `scan-codebase`, `cancel-scan`. **`scan-codebase` doubles as refresh.** No fourth command, and none for an unimplemented capability.

### Microcopy (§5.2) — the WP-01 strings, verbatim

| Id | Context | String |
|---|---|---|
| COPY-01 | First run | Understand your codebase. Start with its structure. |
| COPY-02 | Source action | Select a codebase |
| COPY-03 | External source | Read a local codebase outside this vault. |
| COPY-04 | Permission step | Review scope and read access |
| COPY-05 | Permission detail | Source text and file metadata are read. No project scripts, dependency installation, or source writes are performed. |
| COPY-06 | Permission checkbox | I approve read access to this directory for this scan. |
| COPY-07 | Start | Scan codebase |
| COPY-08 | Unknown progress | Reading included files. {count} files read so far. |
| COPY-09 | Cancel | Cancel scan |
| COPY-10 | Cancelled | Scan cancelled. The incomplete result was discarded. Your complete snapshot from {time} is unchanged. |
| COPY-11 | No matches | No matching files. The snapshot still contains {count} files. No paths match "{query}". |
| COPY-12 | Empty scope | No files are included in this scope. Review the selected directory and exclusions. |
| COPY-13 | Partial inventory | Some files could not be read. Measurements cover {measured} of {included} included files. |
| COPY-14 | Renderer unavailable | The 3D view is unavailable. File inspection still works. |
| COPY-27 | Copied path | Relative path copied. |
| COPY-28 | External binding lost | The saved source directory is unavailable on this machine. The stored snapshot can still be inspected. |
| COPY-30 | Selection outside filter | The selected file is outside these filters. Reveal file or clear selection. |

**COPY-20 ("Unused candidate") is WP-02+ and must not leak forward.** Drop S01's "Analysis reports can be added later". The strings **"Read-only source access"** and **"Source remains unchanged"** are factual claims made on the product's behalf: **they ship only after task 12 records the G2 evidence.**

### Out of scope, stated because the design package shows all of them (§1)

fallow and any analyzer; findings, coverage, dependency relations and runtime evidence; note writing; snapshot history and comparison; **a `lens` parameter on the city viewport** (C08 declares one; WP-01 builds C08 without it — there is no `lensId` in `CityViewState`); **any source-opening or open-in-editor action** (C10 declares `sourceOpenRequested`; S07's binding table lists only Focus and Copy relative path); trusted executable bindings; durable snapshot persistence (`SnapshotStore` is **in-memory for WP-01**); and **any rendered-but-disabled control for unimplemented behaviour**. The "Follow symbolic links" row in S13 is **static explanatory text, not a disabled toggle**.

---

## File Structure

```text
codebase-inspector/
  manifest.json  versions.json  package.json  package-lock.json
  vite.config.ts  tsconfig.json  tsconfig.test.json
  eslint.config.mjs  .oxlintrc.json  vitest.config.ts
  .env.example                       # .env is gitignored
  scripts/
    install-to-vault.mjs             # task 1
    assert-bundle.mjs                # task 1 — the THREE_CJS_DEPRECATED / eval guard
    make-benchmark-fixture.mjs       # task 12
  src/
    main.ts                          # task 3 — Plugin entry; registers only
    host/
      city-view.ts                   # task 3 — ItemView; owns onOpen/onClose/getState/setState
      view-state.ts                  # task 3 — CityViewState codec + validation at the boundary
      commands.ts                    # task 3 (open-city), task 8 (scan/cancel)
      theme-bridge.ts                # task 3 minimal, task 10 full — css-change → CityPalette
      settings-tab.ts                # task 6 — PluginSettingTab.display() hybrid half
      setting-definitions.ts         # task 6 — declarative getSettingDefinitions() half
      modals/
        source-modal.ts              # task 7 — C03 SourceSelector
        scope-modal.ts               # task 7 — C04 ScopeReview
        clear-binding-modal.ts       # task 6
      leaf-registry.ts               # task 11 — deferred-view-safe leaf enumeration
    application/
      ports/
        source-filesystem-port.ts    # task 5
        profile-store.ts             # task 6
        local-binding-store.ts       # task 6
        snapshot-store.ts            # task 8
        clock.ts                     # task 2
        cancellation-token.ts        # task 2
      approval.ts                    # task 7 — fingerprints + ApprovedInventoryRun
      run-state.ts                   # task 8 — InventoryRunState machine
      scan-coordinator.ts            # task 8 — the only thing that starts a walk
      inventory-collector.ts         # task 5 — walk → observations
    domain/
      model.ts                       # task 2 — the §4.1 types
      entity-id.ts                   # task 2 — NUL-joined identity
      classify.ts                    # task 2 — CategoryId vocabulary + classify()
      metrics.ts                     # task 2 — physical-lines, byte-size
      validator.ts                   # task 2 — zod, runtime, never casts
      layout/
        types.ts                     # task 4 — CityLot, CityDistrict, LayoutResult
        scale.ts                     # task 4 — p95 cap, sqrt height, clampedCount
        districts.ts                 # task 4 — deterministic nested grouping
        layout.ts                    # task 4 — the pure entry point
    adapters/
      filesystem/
        node-access.ts               # task 5 — THE ONLY place that reaches Node
        path-safety.ts               # task 2 — containment, normalisation
        node-source-filesystem.ts    # task 5 — SourceFileSystemPort over node-access
        walker.ts                    # task 5 — bounded async walk, exclusions, cancellation
      storage/
        plugin-data-profile-store.ts # task 6
        plugin-data-binding-store.ts # task 6
        in-memory-snapshot-store.ts  # task 8
    visualization/
      renderer-port.ts               # task 2 — types only, no implementation
      color.ts                       # task 3 — CSS string → sRGB bytes via 1x1 canvas
      render-scheduler.ts            # task 10 — on-demand invalidate()
      disposal.ts                    # task 10 — disposal discipline
      instanced-city.ts              # task 10 — InstancedMesh + batch/instance ↔ entity map
      picking.ts                     # task 10 — raycast, hover dwell, drag threshold
      camera-rig.ts                  # task 10 — orthographic 3d/top, bookmarks, tween
      label-overlay.ts               # task 10 — DOM labels in the injected win.document
      city-renderer.ts               # task 3 minimal, task 10 full — CreateCityRenderer
    ui/
      App.vue                        # task 9 — C01 shell
      styles.css                     # task 3 stub, task 9 full — token bridge
      stores/
        city-store.ts                # task 9 — snapshot, layout, selection, query
        run-store.ts                 # task 9 — InventoryRunState mirror
      interaction/
        escape-intent.ts             # task 9 — ported from wp01-review interaction-state.js
        keymap.ts                    # task 9 — canvas-focus-scoped key handling
      components/
        FileSearch.vue               # task 9 — C06
        CodebaseFileList.vue         # task 9 — C07
        CityViewport.vue             # task 9 — C08 wrapper; owns sizing
        CameraControls.vue           # task 9 — C09; WCAG 2.5.7 single-pointer set
        FileInspector.vue            # task 9 — C10
        MetricLegend.vue             # task 9 — C11
        SnapshotStatus.vue           # task 9 — C12
        StatusBanner.vue             # task 9 — C16
        EmptyState.vue               # task 9 — C17
        AnnouncementRegion.vue       # task 9 — polite status region
  tests/
    unit/ contracts/ integration/ component/ acceptance/ host/
    fixtures/ benchmarks/
  dist/                              # build output only; gitignored
  docs/
```

### Assets to port rather than write fresh (§6)

| Asset | Source | Ported in |
|---|---|---|
| Path-safety `normalizePath` | `docs/concept/prototype/src/model.js:15-20` | Task 2 → `src/adapters/filesystem/path-safety.ts` |
| File classifier (`inferCategory`) | `docs/concept/prototype/src/model.js:10-14` | Task 2 → `src/domain/classify.ts` — **vocabulary replaced** with §4.1's closed list |
| 23 normalisation / path-safety / determinism / layout tests | `docs/concept/prototype/tests/model.test.cjs` | Tasks 2 and 4 |
| 31 interaction-state invariant tests | `docs/concept/design/wp01-review/validation/model.test.cjs` | Task 9 |
| `escapeIntent()` Escape-priority function | `docs/concept/design/wp01-review/src/interaction-state.js:57-65` | Task 9 → `src/ui/interaction/escape-intent.ts` |
| On-demand render scheduler (`invalidate()`) | `docs/concept/prototype/src/viewer.js:203` | Task 10 → `src/visualization/render-scheduler.ts` |
| Disposal discipline (`dispose()` / `_disposeWorld()`) | `docs/concept/prototype/src/viewer.js:81-88, 214` | Task 10 → `src/visualization/disposal.ts` |
| 21 acceptance scenarios | `docs/concept/design/wp01-review/validation/production-acceptance.feature` | Task 12 → `tests/acceptance/wp01.feature`, **with three repairs** |

Porting means **keeping the invariant, not copying the function name or the implementation**. Every ported test must pass against our implementation on its own merits; none of these files' original results are cited as evidence.

---

## Task S: Bundling and Node-access spike (throwaway)

**This is a throwaway.** Its code lives **outside this repository** — at `C:\Projects\ci-spike\` — and **never enters it**. The only artefact that lands in `feat/wp-01-codebase-city` is the report.

**Its real target is whether Node built-ins resolve through `window.require` inside an Obsidian plugin bundle.** Vue and Three.js are *not* the question — research settled those: published community plugins build Vue 3 SFCs with Vite in CommonJS library mode, published plugins bundle Three.js, and a working Vite-built Vue plugin exists in this workspace (`C:\Projects\renovation-planner`). They are in the spike only to confirm the *combination* bundles and loads, cheaply, in one pass.

**Task 5 depends absolutely on the answer.** Spec §3.1 states the risk plainly: Obsidian injects its own CommonJS `require`, and there is credible evidence it returns `null` for Node built-ins while the renderer's `window.require` is Electron's real one. **This is inferred** — one plugin's build comment, in tension with the official sample externalising `...builtinModules`. Using `window.require` is correct either way; the spike tells us what the *failure mode* of the alternative is, so task 5 recognises it.

**Files:**
- Create (outside the repo, throwaway): `C:\Projects\ci-spike\` — `manifest.json`, `package.json`, `vite.config.ts`, `src/main.ts`, `src/Probe.vue`, `src/store.ts`, `src/static-import-probe.ts`
- Create (in the repo, committed): `docs/superpowers/notes/2026-09-17-wp01-spike-report.md`

**Interfaces:**
- Consumes: nothing.
- Produces: **the spike report**, which task 1 reads for the `dist/main.js` size baseline and task 5 reads for the Node-access verdict. Nothing else in the plan consumes spike *code*.

**Dependencies:** none. This is first.

- [ ] **Step 1: Create the throwaway plugin skeleton outside this repository**

```bash
mkdir -p /c/Projects/ci-spike/src && cd /c/Projects/ci-spike
npm init -y
npm i -D vite @vitejs/plugin-vue typescript obsidian @types/three@^0.186.0
npm i vue pinia three@0.186.0
```

`manifest.json`:

```json
{
  "id": "ci-spike",
  "name": "CI Spike",
  "version": "0.0.1",
  "minAppVersion": "1.13.0",
  "description": "Throwaway probe for bundling and runtime module access. Delete after use.",
  "author": "Luis85",
  "isDesktopOnly": true
}
```

`vite.config.ts` — the same shape task 1 will use, so the spike validates the real configuration:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';

const nodeBuiltins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

export default defineConfig({
  plugins: [vue()],
  resolve: { conditions: ['import', 'module', 'browser', 'default'] },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    target: 'es2020',
    emptyOutDir: true,
    cssCodeSplit: false,
    cssMinify: false,
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    lib: { entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)), formats: ['cjs'] },
    rollupOptions: {
      external: ['obsidian', 'electron', ...nodeBuiltins],
      output: {
        exports: 'named',
        inlineDynamicImports: true,
        entryFileNames: 'main.js',
        assetFileNames: (a) => (a.name?.endsWith('.css') ? 'styles.css' : '[name][extname]'),
      },
    },
  },
});
```

- [ ] **Step 2: Write the five probes**

`src/main.ts` — probes 1 (ItemView), 2/3 (Vue SFC + Pinia), 4 (Three.js), 5 (Node access). Each logs **exactly one line** prefixed `CI-SPIKE:`.

```ts
import { ItemView, Plugin, Platform, WorkspaceLeaf } from 'obsidian';
import { probeStaticImport } from './static-import-probe';

// Probe 5a — the point of the spike. Runtime resolution through the renderer's require.
function probeWindowRequire(): void {
  try {
    const fs = Platform.isDesktopApp ? (window as any).require('node:original-fs') : null;
    const path = Platform.isDesktopApp ? (window as any).require('node:path') : null;
    const entries = fs.readdirSync(path.join('C:', 'Projects'), { withFileTypes: true });
    console.log(`CI-SPIKE: window.require node:original-fs OK — ${entries.length} entries, first="${entries[0]?.name}"`);
  } catch (e) {
    console.log(`CI-SPIKE: window.require node:original-fs FAILED — ${String(e)}`);
  }
}

export default class SpikePlugin extends Plugin {
  async onload() {
    this.registerView('ci-spike-view', (leaf: WorkspaceLeaf) => new SpikeView(leaf));
    this.addRibbonIcon('box', 'CI Spike', () => {
      this.app.workspace.getLeaf('tab').setViewState({ type: 'ci-spike-view', active: true });
    });
    probeWindowRequire();
    probeStaticImport();
    const ts = this.app.vault.getFiles().filter((f) => f.extension === 'ts').length;
    console.log(`CI-SPIKE: vault.getFiles() .ts entries = ${ts}`);
  }
}
```

`src/static-import-probe.ts` — probe 5b, **the disputed claim**. A *bundled static import* of a Node built-in, which `no-nodejs-modules` will forbid in the real codebase. It exists here only to record whether Obsidian's injected `require` returns `null`:

```ts
// Deliberately violates no-nodejs-modules. Spike only — never copied into the repository.
import * as bareFs from 'fs';
import * as prefixedFs from 'node:fs';

export function probeStaticImport(): void {
  console.log(`CI-SPIKE: static import 'fs' = ${bareFs === null ? 'null' : typeof bareFs}, readdirSync = ${typeof (bareFs as any)?.readdirSync}`);
  console.log(`CI-SPIKE: static import 'node:fs' = ${prefixedFs === null ? 'null' : typeof prefixedFs}, readdirSync = ${typeof (prefixedFs as any)?.readdirSync}`);
}
```

`src/Probe.vue` — probe 2, an SFC with template, **scoped style** and a reactive click handler, plus probe 3 (Pinia):

```vue
<template>
  <div class="spike-box">
    <button @click="store.bump()">clicked {{ store.count }}</button>
    <div ref="canvasHost" class="spike-canvas" />
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSpikeStore } from './store';
import { mountThousandBoxes } from './three-probe';
const store = useSpikeStore();
const canvasHost = ref<HTMLElement | null>(null);
onMounted(() => { if (canvasHost.value) mountThousandBoxes(canvasHost.value); });
</script>
<style scoped>
.spike-box { padding: 12px; background: #2a2a2a; }
.spike-canvas { width: 100%; height: 400px; }
</style>
```

Probe 4 — ~1,000 boxes in one `InstancedMesh` with `OrbitControls`, mounted in `onOpen`:

```ts
// src/three-probe.ts
import { AmbientLight, BoxGeometry, DirectionalLight, InstancedMesh, Matrix4,
         MeshStandardMaterial, OrthographicCamera, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function mountThousandBoxes(host: HTMLElement): void {
  const win = host.ownerDocument.defaultView!;
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);
  const scene = new Scene();
  // r155/r165: intensities are physically correct. A pre-r155 value of 0.6 is 0.6 * Math.PI here.
  scene.add(new AmbientLight(0xffffff, 0.6 * Math.PI));
  const sun = new DirectionalLight(0xffffff, 1.2 * Math.PI);
  sun.position.set(30, 60, 20);
  scene.add(sun);
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial(), 1000);
  const m = new Matrix4();
  for (let i = 0; i < 1000; i++) {
    m.makeTranslation((i % 32) * 1.6, 0.5, Math.floor(i / 32) * 1.6);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  const aspect = host.clientWidth / host.clientHeight;
  const camera = new OrthographicCamera(-30 * aspect, 30 * aspect, 30, -30, 0.1, 500);
  camera.position.set(40, 40, 40);
  camera.lookAt(25, 0, 25);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.addEventListener('change', () => renderer.render(scene, camera));
  renderer.render(scene, camera);
  console.log('CI-SPIKE: three InstancedMesh 1000 boxes drawn, OrbitControls attached');
}
```

- [ ] **Step 3: Build and assert the bundle shape**

```bash
cd /c/Projects/ci-spike && npx vite build && cp manifest.json dist/
ls dist/                                             # expect EXACTLY: main.js  manifest.json  styles.css
head -c 200 dist/main.js                             # expect CommonJS, no ESM import statements
grep -c "new Function(" dist/main.js || true         # expect 0
grep -c "eval(" dist/main.js || true                 # expect 0
grep -c "THREE_CJS_DEPRECATED" dist/main.js || true  # expect 0
wc -c dist/main.js                                   # RECORD: the baseline size budget
```

- [ ] **Step 4: Install into the dev vault and run the probes**

```bash
mkdir -p "/c/Projects/renovation-planner/.obsidian/plugins/ci-spike"
cp dist/main.js dist/styles.css dist/manifest.json "/c/Projects/renovation-planner/.obsidian/plugins/ci-spike/"
```

Then, in Obsidian: enable **CI Spike**, open the developer console (Ctrl+Shift+I), click the ribbon icon, and read the `CI-SPIKE:` lines.

- [ ] **Step 5: Run the pass criteria — the user checks this**

**Manual checklist (spec §5.1). Every gating line must pass, or the spike has found something and task 1 waits.**

- [ ] `dist/` contains exactly `main.js`, `styles.css` and `manifest.json` — nothing else
- [ ] `dist/main.js` is CommonJS
- [ ] The plugin **enables with no console error**
- [ ] The SFC renders **and its scoped styles are applied** (the probe box has the `#2a2a2a` background and a `data-v-` attribute on the element)
- [ ] The Pinia counter increments on click
- [ ] The Three.js scene **draws and orbits** (drag rotates the 1,000 boxes)
- [ ] **`window.require('node:original-fs')` and `window.require('node:path')` reads return real directory entries** — the log line reads `OK` with a nonzero count and a plausible first name
- [ ] **No `new Function(` and no `eval(` survives in the production bundle**
- [ ] **Two disable/enable cycles leave no console error**
- [ ] `styles.css` is applied **with no loader code in `main.ts`** — confirms or refutes the auto-injection inference (§11)

**Record, do not gate on:**

- [ ] Whether the **static imports** work — the disputed claim. Log the exact result for `'fs'` and `'node:fs'`: real module, `null`, or throw.
- [ ] `dist/main.js` **size in bytes** — the baseline budget task 1 and task 12 measure against.
- [ ] Whether `vault.getFiles()` **returns entries for `.ts` files** — nothing in the design depends on the answer, but task 5 should not be surprised by it.

- [ ] **Step 6: Write the spike report**

Create `docs/superpowers/notes/2026-09-17-wp01-spike-report.md` with these sections, filled with **observed output, not expectations**:

```markdown
# WP-01 spike report

Date: <run date>   Obsidian version: <Help → About>   Electron/Chrome: <console `process.versions`>

## Verdict on the load-bearing question
window.require('node:original-fs'): PASS | FAIL  — <verbatim log line>
window.require('node:path'):        PASS | FAIL  — <verbatim log line>
Static `import * as fs from 'fs'`:       <real module | null | threw: msg>
Static `import * as fs from 'node:fs'`:  <real module | null | threw: msg>

**Consequence for task 5:** <one paragraph>

## Bundle shape
dist/ contents: <ls output>        main.js bytes: <n>  (BASELINE BUDGET)
CommonJS: yes/no    new Function(: n    eval(: n    THREE_CJS_DEPRECATED: n

## Probes
ItemView registered / opened: ...   Vue SFC + scoped style: ...   Pinia: ...
Three.js InstancedMesh 1000 + OrbitControls: ...   Two disable/enable cycles: ...

## Cheap answers to open questions (§11)
styles.css auto-injected with no loader code: yes/no
vault.getFiles() returns .ts entries: yes/no (count: n)

## Anything unexpected
<free text — this is the most valuable section>
```

- [ ] **Step 7: Delete the spike and commit only the report**

```bash
rm -rf "/c/Projects/renovation-planner/.obsidian/plugins/ci-spike"
rm -rf /c/Projects/ci-spike
cd /c/Projects/codebase-inspector
git checkout -b feat/wp-01-codebase-city
git add docs/superpowers/notes/2026-09-17-wp01-spike-report.md
git commit -m "docs: record the WP-01 bundling and Node-access spike result"
```

**Acceptance criteria, restated concretely:**

1. Every box in Step 5's gating checklist is ticked with observed evidence, or the failure is written up and raised with the user before task 1 starts.
2. `docs/superpowers/notes/2026-09-17-wp01-spike-report.md` exists, is committed on `feat/wp-01-codebase-city`, and states the Node-access verdict in its first section.
3. **No spike code exists anywhere in this repository**, and the throwaway plugin is removed from the dev vault.

---

## Task 1: Toolchain

**Ends with:** `npm run verify` green; `install:vault` delivers files.

**Files:**
- Create: `package.json`, `package-lock.json`, `manifest.json`, `versions.json`, `.gitignore`, `.env.example`
- Create: `vite.config.ts`, `tsconfig.json`, `tsconfig.test.json`, `vitest.config.ts`, `eslint.config.mjs`, `.oxlintrc.json`
- Create: `scripts/install-to-vault.mjs`, `scripts/assert-bundle.mjs`, `scripts/copy-manifest.mjs`
- Create: `src/main.ts` (a six-line stub — task 3 writes the real one)
- Create: `src/ui/styles.css` (the token bridge, so lib mode emits `styles.css`)
- Modify: `README.md` (add the §10 disclosure)
- Test: `tests/unit/manifest.test.ts`, `tests/host/build-output.test.ts`, `tests/unit/install-script.test.ts`

**Interfaces:**
- Consumes: the spike report's `dist/main.js` size baseline.
- Produces: `npm run verify`, `npm run build`, `npm run install:vault`; the `dist/` layout every later task's build check asserts against; the lint rule set every later task must satisfy.

**Dependencies:** Task S.

- [ ] **Step 1: Write the failing manifest test**

`tests/unit/manifest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../../manifest.json', import.meta.url)), 'utf8'));
const ALLOWED = new Set(['id', 'name', 'version', 'minAppVersion', 'description',
                         'author', 'authorUrl', 'isDesktopOnly']);

describe('manifest.json', () => {
  it('uses the exact plugin id the install folder must match', () => {
    // A different folder name means onExternalSettingsChange never fires.
    expect(manifest.id).toBe('codebase-inspector');
  });

  it('declares a three-segment minAppVersion so semver.gt does not break', () => {
    expect(manifest.minAppVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.minAppVersion).toBe('1.13.0');
  });

  it('is desktop only', () => {
    expect(manifest.isDesktopOnly).toBe(true);
  });

  it('has no non-schema keys, which the linter reports as disallowedKey', () => {
    expect(Object.keys(manifest).filter((k) => !ALLOWED.has(k))).toEqual([]);
  });

  it('omits fundingUrl', () => {
    expect(manifest).not.toHaveProperty('fundingUrl');
  });

  it('satisfies the machine-validated description rules', () => {
    const d: string = manifest.description;
    expect(d.length).toBeGreaterThanOrEqual(10);
    expect(d.length).toBeLessThanOrEqual(250);
    expect(d[0]).toBe(d[0].toUpperCase());
    expect(d.endsWith('.')).toBe(true);
    expect(d.toLowerCase()).not.toContain('obsidian');
    expect(d.toLowerCase()).not.toContain('plugin');
    expect(/\p{Extended_Pictographic}/u.test(d)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/unit/manifest.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open '.../manifest.json'`

- [ ] **Step 3: Write `manifest.json` and `versions.json`**

`manifest.json` — copied verbatim from spec §3.3:

```json
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

`versions.json` — updated **only when `minAppVersion` changes**, read from the repository root, never from release assets:

```json
{ "0.1.0": "1.13.0" }
```

- [ ] **Step 4: Run the manifest test to verify it passes**

Run: `npx vitest run tests/unit/manifest.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing build-output test**

`tests/host/build-output.test.ts`. This test is **kept forever** — it is half of the `THREE_CJS_DEPRECATED` guard spec §3.2 requires.

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
let main = '';

beforeAll(() => {
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true });
  main = readFileSync(dist + 'main.js', 'utf8');
}, 180_000);

describe('dist/', () => {
  it('contains exactly the three installable files', () => {
    expect(readdirSync(dist).sort()).toEqual(['main.js', 'manifest.json', 'styles.css']);
  });

  it('emits CommonJS with the named-exports shape Obsidian loads', () => {
    expect(main).toContain('__esModule');
    expect(main).toMatch(/exports\.default\s*=/);
    expect(main).not.toMatch(/^\s*import\s/m);
  });

  it('never pulls the r186 CommonJS stub', () => {
    // build/three.cjs is a 631-byte stub that calls process.emitWarning. If the bundler
    // resolves the `require` condition instead of `import`, this string appears and a
    // `process` reference is injected into the Obsidian renderer.
    expect(main).not.toContain('THREE_CJS_DEPRECATED');
    expect(main).not.toContain('process.emitWarning');
  });

  it('contains no runtime compiler, because Vue stays runtime-only', () => {
    expect(main).not.toContain('new Function(');
    expect(main).not.toMatch(/\beval\(/);
  });

  it('does not bundle externalised host modules', () => {
    expect(main).toMatch(/require\(["']obsidian["']\)/);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/host/build-output.test.ts`
Expected: FAIL — `npm run build` is not defined yet.

- [ ] **Step 7: Write `package.json`, `vite.config.ts`, the tsconfigs and `vitest.config.ts`**

`package.json`:

```json
{
  "name": "codebase-inspector",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build && node scripts/copy-manifest.mjs && node scripts/assert-bundle.mjs",
    "dev": "vite build --watch",
    "typecheck": "vue-tsc --noEmit -p tsconfig.json && vue-tsc --noEmit -p tsconfig.test.json",
    "lint:fast": "oxlint --deny-warnings",
    "lint": "eslint . --max-warnings 0",
    "test": "vitest run",
    "verify": "npm run typecheck && npm run lint:fast && npm run lint && npm run test && npm run build",
    "install:vault": "node scripts/install-to-vault.mjs"
  },
  "dependencies": {
    "pinia": "^2.2.0",
    "three": "0.186.0",
    "vue": "^3.5.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/three": "^0.186.0",
    "@vitejs/plugin-vue": "^5.1.0",
    "@vue/test-utils": "^2.4.0",
    "eslint": "^9.12.0",
    "eslint-plugin-obsidianmd": "^0.2.0",
    "eslint-plugin-vue": "^9.29.0",
    "jsdom": "^25.0.0",
    "obsidian": "latest",
    "oxlint": "^0.11.0",
    "typescript": "^5.6.0",
    "typescript-eslint": "^8.8.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "vue-tsc": "^2.1.0"
  }
}
```

**`"three": "0.186.0"` has no caret. This is deliberate and load-bearing** — Three.js publishes breaking changes in every `0.x` minor and does not follow semver, so a caret range there is a range of unreviewed migration guides. `@types/three` keeps its caret because DefinitelyTyped ships pure fixes as patches within a minor.

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';

// Both forms, so a transitive dependency referencing either is not bundled.
const nodeBuiltins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

const CODEMIRROR = ['@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands',
  '@codemirror/language', '@codemirror/lint', '@codemirror/search', '@codemirror/state',
  '@codemirror/text', '@codemirror/view'];
const LEZER = ['@lezer/common', '@lezer/highlight', '@lezer/lr'];

export default defineConfig({
  plugins: [vue()],
  // Guards the r186 CommonJS deprecation: never let the bundler resolve the `require`
  // condition, which would pull build/three.cjs — a process.emitWarning stub.
  resolve: { conditions: ['import', 'module', 'browser', 'default'] },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    target: 'es2020',              // known Electron host, not the open web
    emptyOutDir: true,             // safe: outDir is dist/
    cssCodeSplit: false,
    cssMinify: false,
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),   // never process.cwd()
    lib: {
      entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      formats: ['cjs'],            // Obsidian loads CommonJS only
    },
    rollupOptions: {
      external: ['obsidian', 'electron', ...CODEMIRROR, ...LEZER, ...nodeBuiltins],
      output: {
        exports: 'named',            // exports.default = Plugin with the __esModule marker
        inlineDynamicImports: true,  // one installable file; chunks would require() files that never ship
        entryFileNames: 'main.js',
        assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'styles.css' : '[name][extname]'),
      },
    },
  },
});
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

**`"moduleResolution": "bundler"` is required, not preferred.** `node16` fails the Three.js addon imports with TS1479, and `node` no longer exists in TypeScript 7.

`tsconfig.test.json` extends it with `"include": ["tests/**/*.ts", "src/**/*.ts", "src/**/*.vue"]` and `"types": ["vitest/globals", "node"]`.

`vitest.config.ts` — two projects, per spec §3.5:

```ts
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  test: {
    workspace: [
      { test: { name: 'node', environment: 'node',
                include: ['tests/{unit,contracts,integration,host,acceptance,benchmarks}/**/*.test.ts'] } },
      { plugins: [vue()],
        test: { name: 'jsdom', environment: 'jsdom',
                include: ['tests/component/**/*.test.ts'] } },
    ],
  },
});
```

- [ ] **Step 8: Write the `src/main.ts` stub and the `styles.css` token bridge**

`src/main.ts` — task 3 replaces it entirely:

```ts
import { Plugin } from 'obsidian';
import './ui/styles.css';

export default class CodebaseInspectorPlugin extends Plugin {
  override onload(): void {
    // Task 3 registers the view, the ribbon and the open-city command here.
    // onload REGISTERS ONLY: no scanning, no expensive work (spec 4.4).
  }
}
```

`src/ui/styles.css` — the token bridge from `docs/concept/design/foundations/design-tokens.css`, which §4.4 makes authoritative alongside the `03-design-system.md` mapping table. **`design-tokens.json` diverges from both and is a non-normative index — do not use it.** Note `:where(.codebase-inspector-root)` has **zero specificity**, so literal `color`/`background`/`font-family` declarations there lose to most theme rules; custom property declarations are unaffected.

```css
/* Token bridge. Never targets body, :root, .workspace, .theme-dark or .theme-light,
   and never redefines a --background-*, --text-* or --interactive-* variable. */
:where(.codebase-inspector-root) {
  --ci-surface: var(--background-primary);
  --ci-panel: var(--background-secondary);
  --ci-raised: var(--background-primary-alt);
  --ci-border: var(--background-modifier-border);
  --ci-text: var(--text-normal);
  --ci-text-muted: var(--text-muted);
  --ci-action: var(--interactive-accent);
  --ci-on-action: var(--text-on-accent);
  --ci-focus: var(--background-modifier-border-focus, var(--interactive-accent));
  --ci-error: var(--text-error);
  --ci-warning: var(--text-warning);
  --ci-space-1: 4px; --ci-space-2: 8px; --ci-space-3: 12px;
  --ci-space-4: 16px; --ci-space-5: 20px; --ci-space-6: 24px;
  --ci-radius-small: 4px; --ci-radius-control: 6px; --ci-radius-modal: 10px;
  --ci-control-min: 32px;
  --ci-focus-duration: 180ms;
  color: var(--ci-text);
  background: var(--ci-surface);
  font-family: var(--font-interface);
  container-type: inline-size;
}
:where(.codebase-inspector-root) :focus-visible {
  outline: 2px solid var(--ci-focus);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  :where(.codebase-inspector-root) { --ci-focus-duration: 0ms; }
}
```

Task 9 adds the ten `--ci-cat-*` custom properties — one per `CategoryId` — to this file. **Not before**, because task 2 settles the vocabulary.

- [ ] **Step 9: Write `scripts/copy-manifest.mjs` and `scripts/assert-bundle.mjs`**

`manifest.json` is copied into `dist/`, making `dist/` the complete installable plugin folder. **It also stays at the repository root**, where the community directory reads it.

```js
// scripts/copy-manifest.mjs
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
copyFileSync(fileURLToPath(new URL('../manifest.json', import.meta.url)),
             fileURLToPath(new URL('../dist/manifest.json', import.meta.url)));
```

```js
// scripts/assert-bundle.mjs — build-time guard, kept for the life of the project.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const files = readdirSync(dist).sort();
const main = readFileSync(dist + 'main.js', 'utf8');
const fail = (msg) => { console.error(`assert-bundle: ${msg}`); process.exitCode = 1; };

if (files.join(',') !== 'main.js,manifest.json,styles.css') {
  fail(`dist/ must contain exactly main.js, manifest.json and styles.css — found ${files.join(', ')}`);
}
if (main.includes('THREE_CJS_DEPRECATED') || main.includes('process.emitWarning')) {
  fail("dist/main.js pulled three's deprecated CommonJS stub. Check resolve.conditions in vite.config.ts.");
}
if (main.includes('new Function(') || /\beval\(/.test(main)) {
  fail('dist/main.js contains a runtime compiler. Vue must stay runtime-only, permanently.');
}
if (!main.includes('__esModule') || !/exports\.default\s*=/.test(main)) {
  fail('dist/main.js is not the named-CommonJS shape Obsidian loads.');
}
console.log(`assert-bundle: OK — dist/main.js is ${(main.length / 1024).toFixed(0)} kB`);
```

- [ ] **Step 10: Run the build-output test to verify it passes**

Run: `npx vitest run tests/host/build-output.test.ts`
Expected: PASS, 5 tests. Compare `dist/main.js`'s size against the spike's baseline — a large unexplained jump means something was bundled that should be external. Expect roughly 0.8–1.2 MB minified once the real code lands.

- [ ] **Step 11: Write the failing install-script test**

`tests/unit/install-script.test.ts` — the guards matter more than the copy:

```ts
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/install-to-vault.mjs', import.meta.url));
const run = (vault: string) =>
  execFileSync('node', [script], {
    env: { ...process.env, CODEBASE_INSPECTOR_TEST_VAULT: vault },
    encoding: 'utf8', stdio: 'pipe',
  });

describe('install-to-vault', () => {
  it('refuses to run when CODEBASE_INSPECTOR_TEST_VAULT is unset', () => {
    expect(() => run('')).toThrow(/CODEBASE_INSPECTOR_TEST_VAULT/);
  });

  it('refuses a target that is not a vault', () => {
    expect(() => run(mkdtempSync(join(tmpdir(), 'ci-notvault-')))).toThrow(/not a vault/i);
  });

  it('refuses a target that resolves inside this repository', () => {
    expect(() => run(fileURLToPath(new URL('../../', import.meta.url)))).toThrow(/inside this repository/i);
  });

  it('copies dist and writes the .hotreload marker', () => {
    const vault = mkdtempSync(join(tmpdir(), 'ci-vault-'));
    mkdirSync(join(vault, '.obsidian'), { recursive: true });
    writeFileSync(join(vault, '.obsidian', 'app.json'), '{}');
    run(vault);
    const dest = join(vault, '.obsidian', 'plugins', 'codebase-inspector');
    for (const f of ['main.js', 'manifest.json', 'styles.css', '.hotreload']) {
      expect(existsSync(join(dest, f)), f).toBe(true);
    }
  });
});
```

- [ ] **Step 12: Run it to verify it fails**

Run: `npx vitest run tests/unit/install-script.test.ts`
Expected: FAIL — `Cannot find module '.../scripts/install-to-vault.mjs'`

- [ ] **Step 13: Write `scripts/install-to-vault.mjs` and `.env.example`**

```js
// Build script. Its hardcoded '.obsidian' DEFAULT is acceptable here and takes an override.
// PLUGIN SOURCE MUST NEVER HARDCODE IT — use vault.configDir (spec 4.4).
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const vault = process.env.CODEBASE_INSPECTOR_TEST_VAULT;
const configDir = process.env.CODEBASE_INSPECTOR_TEST_VAULT_CONFIG_DIR || '.obsidian';
const die = (msg) => { console.error(`install-to-vault: ${msg}`); process.exit(1); };

if (!vault) die('CODEBASE_INSPECTOR_TEST_VAULT is unset. Copy .env.example to .env and set it.');

const vaultPath = resolve(vault);
if (!existsSync(join(vaultPath, configDir)) || !statSync(join(vaultPath, configDir)).isDirectory()) {
  die(`${vaultPath} is not a vault — no ${configDir}/ directory.`);
}

// Containment: path.relative sign check, never a string prefix test.
const rel = relative(repoRoot, vaultPath);
if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
  die('Refusing to install: the target resolves inside this repository.');
}

// The installed folder name must equal the manifest id, or onExternalSettingsChange never fires.
const manifest = JSON.parse(readFileSync(join(repoRoot, 'manifest.json'), 'utf8'));
if (manifest.id !== 'codebase-inspector') die(`manifest id is "${manifest.id}", expected "codebase-inspector".`);

const dest = join(vaultPath, configDir, 'plugins', manifest.id);
mkdirSync(dest, { recursive: true });
cpSync(join(repoRoot, 'dist'), dest, { recursive: true });
// The hot-reload plugin ignores folders lacking .git or .hotreload.
writeFileSync(join(dest, '.hotreload'), '');
console.log(`install-to-vault: installed to ${dest}`);
```

`.env.example` (committed; **`.env` is gitignored**):

```text
# Absolute path to a vault used for manual verification.
CODEBASE_INSPECTOR_TEST_VAULT=C:\Projects\renovation-planner
# Optional override when the vault's config directory is not .obsidian
# CODEBASE_INSPECTOR_TEST_VAULT_CONFIG_DIR=.obsidian
```

- [ ] **Step 14: Run it to verify it passes**

Run: `npx vitest run tests/unit/install-script.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 15: Write `eslint.config.mjs` and `.oxlintrc.json`**

The three architectural rules of §3.4 are **lint rules, not prose**:

```js
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default tseslint.config(
  { ignores: ['dist/**', 'docs/**', 'node_modules/**'] },
  ...tseslint.configs.recommendedTypeChecked,
  ...vue.configs['flat/recommended'],
  ...obsidianmd.configs.recommended,   // no-nodejs-modules, hardcoded-config-path,
                                       // prefer-instanceof, detach-leaves,
                                       // no-unsupported-api, prefer-setting-definitions
  { languageOptions: { parserOptions: { project: ['./tsconfig.json', './tsconfig.test.json'] } } },

  // Rule 1 — size
  { files: ['src/**/*.{ts,vue}'], rules: { 'max-lines': ['error', 400] } },
  { files: ['tests/**/*.ts'], rules: { 'max-lines': ['error', 450] } },

  // Rule 2 — layering
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['obsidian', 'electron', 'vue', 'pinia', 'three', 'three/*',
                  'fs', 'path', 'node:*', 'fallow', 'fallow/*'],
          message: 'src/domain stays pure: no host, framework, renderer, Node or fallow imports.' },
        { group: ['../adapters/*', '../host/*', '../ui/*', '../visualization/*', '../application/*',
                  '**/adapters/**', '**/host/**', '**/ui/**', '**/visualization/**', '**/application/**'],
          message: 'src/domain must not depend on an outer layer.' },
      ] }],
    },
  },
  {
    files: ['src/visualization/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['obsidian', 'electron', 'fs', 'path', 'node:*',
                  '**/host/**', '**/adapters/**', '**/application/**'],
          message: 'src/visualization reaches neither the filesystem nor the host.' },
      ] }],
      // Rule 3 — colour management. Double conversion is SILENT: no error, no warning,
      // just a 2-3x darker render. Lint is the only thing that catches it (spec 3.2, 3.4).
      'no-restricted-syntax': ['error',
        { selector: "MemberExpression[property.name='convertSRGBToLinear']",
          message: 'ColorManagement.enabled defaults to true since r152 — new Color(hex) already converts sRGB to working. Calling this renders everything markedly darker, with no error and no warning.' },
        { selector: "MemberExpression[property.name='convertLinearToSRGB']",
          message: 'Banned for the same reason as convertSRGBToLinear. Use ColorManagement.workingToColorSpace() (r177).' },
      ],
    },
  },
);
```

`.oxlintrc.json` is the fast pass — enable `correctness` and `suspicious`, run with `--deny-warnings`.

- [ ] **Step 16: Add the README disclosure**

Spec §10 requires the README to **disclose that the plugin reads files outside the vault and why**, and to **state positively that there is no network use and no telemetry**. A recognised `LICENSE` file is already present.

```markdown
## What this plugin reads, and what it never does

Codebase Inspector reads source files and file metadata from a directory you
explicitly select and approve — including directories **outside your vault**.
That is the point of the plugin: it builds a structural map of a local codebase.

- It reads **file text and file metadata only**. It never writes, moves, renames
  or deletes anything in the directory you select.
- It runs **no project scripts** and installs **no dependencies**.
- It makes **no network requests of any kind** and collects **no telemetry**.
- Reading begins only after you approve a specific directory and scope. Changing
  the directory or the scope invalidates that approval.
```

- [ ] **Step 17: Write `.gitignore`**

```text
node_modules/
dist/
.env
```

**`package-lock.json` is committed**, as the checklist requires. `dist/` is ignored; **there is no build output at the repository root**.

- [ ] **Step 18: Run the whole gate**

Run: `npm run verify`
Expected: PASS — typecheck clean on both tsconfigs, `oxlint --deny-warnings` clean, `eslint --max-warnings 0` clean, all 15 tests pass, build emits exactly three files and `assert-bundle` prints OK.

Run: `npm run install:vault`
Expected: `install-to-vault: installed to C:\Projects\renovation-planner\.obsidian\plugins\codebase-inspector`

- [ ] **Step 19: Commit**

```bash
git add -A
git commit -m "feat(toolchain): Vite CJS library build, strict typecheck, lint rules, vault install

Three.js pinned at exactly 0.186.0. resolve.conditions plus a build-time
assertion guard the r186 CommonJS stub. max-lines, layering and the
convertSRGBToLinear ban are lint rules per spec 3.4."
```

**Acceptance criteria, restated concretely:**

1. `npm run verify` exits 0.
2. `npm run install:vault` copies `main.js`, `styles.css`, `manifest.json` and a `.hotreload` marker into `<dev vault>/.obsidian/plugins/codebase-inspector/`, and **refuses** when the env var is unset, the target is not a vault, or the target resolves inside this repository.
3. `dist/` contains **exactly** three files; the repository root contains **no build output**.
4. `dist/main.js` contains no `THREE_CJS_DEPRECATED`, no `process.emitWarning`, no `new Function(` and no `eval(`.
5. `manifest.json` passes all six schema assertions; `minAppVersion` is three-segment.
6. `package-lock.json` is committed; every script lives in `scripts/`.
7. The README discloses out-of-vault reads, no network use and no telemetry.

---

## Task 2: Contracts, validator, classifier, fixture builder

**Ends with:** Valid fixtures round-trip; invalid rejected with reasons; fixtures include unavailable and measured-zero records.

**This task commits the §4 frozen contracts.** IP-01's deliverable reads **define**, not *reconcile*. No implementation exists here, and the v1.1 instructions to "read the existing code" and "reconcile `renderer-port.ts` with implemented types" are **void**.

**Files:**
- Create: `src/domain/model.ts`, `src/domain/entity-id.ts`, `src/domain/classify.ts`, `src/domain/metrics.ts`, `src/domain/validator.ts`
- Create: `src/adapters/filesystem/path-safety.ts`
- Create: `src/application/ports/clock.ts`, `src/application/ports/cancellation-token.ts`
- Create: `src/visualization/renderer-port.ts` (**types only** — no implementation until task 3)
- Create: `tests/fixtures/snapshot-builder.ts`
- Test: `tests/unit/entity-id.test.ts`, `tests/unit/classify.test.ts`, `tests/unit/metrics.test.ts`, `tests/unit/path-safety.test.ts`, `tests/unit/validator.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces — every later task imports from these, so the names are fixed here:
  - `type EntityId = string`; `type EntityKind = 'repository' | 'directory' | 'file'`
  - `makeEntityId(repositoryId: string, kind: EntityKind, path: string): EntityId`
  - `parseEntityId(id: EntityId): { repositoryId: string; kind: EntityKind; path: string }`
  - `CATEGORY_IDS` and `type CategoryId = 'typescript' | 'javascript' | 'vue' | 'test' | 'style' | 'markup' | 'config' | 'docs' | 'asset' | 'other'`
  - `classify(relativePath: string): CategoryId`
  - `countPhysicalLines(text: string): number`; `byteSize(bytes: Uint8Array): number`
  - `METRIC_PHYSICAL_LINES`, `METRIC_BYTE_SIZE`
  - `normalizeRelativePath(value: string): string` (throws on unsafe input); `isContained(root: string, candidate: string): boolean`
  - `validateSnapshot(input: unknown): CodebaseSnapshot`; `validateCityViewState(input: unknown): CityViewState`; `class ValidationError extends Error { readonly reasons: readonly string[] }`
  - types `Observation`, `CodeEntity`, `Measurement`, `ProviderRun`, `AnalysisScope`, `ApprovedInventoryRun`, `CodebaseSnapshot`, `SourceReference`, `CodebaseProfile`, `LocalBinding`, `CameraBookmark`, `CityViewState`, `InventoryRunState`
  - the whole of `src/visualization/renderer-port.ts` (`CityPalette`, `RendererDiagnostics`, `CreateCityRenderer`, `CityRendererPort`, `CityRendererEvent`)
  - `buildSnapshotFixture(spec: FixtureSpec): CodebaseSnapshot`, `tinyFixture()`, `capFixture()`, `unicodeFixture()`, `emptyFixture()`

**Dependencies:** Task 1.

**Ported from:** `docs/concept/prototype/src/model.js:10-20` (`inferCategory`, `normalizePath`) and 14 of the 23 tests in `docs/concept/prototype/tests/model.test.cjs`. **The prototype's category vocabulary is repudiated** — spec §4.1 settles a different, closed, lower-case list. **`docs/concept/prototype/fixtures/snapshot.schema.json` is not a candidate schema**: it has nullable scalars, caller-assigned ids, no directory entities, no completeness, no warnings, no reason strings and no snapshot identity — and its own demo fixture violates its own category enum on 24 of 144 records, passing only because the validator silently re-infers.

- [ ] **Step 1: Write the failing classifier test**

`tests/unit/classify.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, classify } from '../../src/domain/classify';

describe('classify', () => {
  it('exposes the closed WP-01 vocabulary and nothing else', () => {
    expect([...CATEGORY_IDS]).toEqual(['typescript', 'javascript', 'vue', 'test', 'style',
                                       'markup', 'config', 'docs', 'asset', 'other']);
  });

  it('lets test patterns beat extensions', () => {
    expect(classify('src/foo.test.ts')).toBe('test');
    expect(classify('src/foo.spec.tsx')).toBe('test');
    expect(classify('tests/helper.ts')).toBe('test');
    expect(classify('src/__tests__/helper.ts')).toBe('test');
    expect(classify('src/foo.ts')).toBe('typescript');
  });

  it('maps small source extensions without executing source', () => {
    expect(classify('x.ts')).toBe('typescript');
    expect(classify('x.tsx')).toBe('typescript');
    expect(classify('x.js')).toBe('javascript');
    expect(classify('x.mjs')).toBe('javascript');
    expect(classify('x.vue')).toBe('vue');
    expect(classify('x.css')).toBe('style');
    expect(classify('x.scss')).toBe('style');
    expect(classify('x.html')).toBe('markup');
    expect(classify('x.json')).toBe('config');
    expect(classify('x.yml')).toBe('config');
    expect(classify('x.md')).toBe('docs');
    expect(classify('x.png')).toBe('asset');
  });

  it('falls back to other, which is never absent', () => {
    expect(classify('LICENSE')).toBe('other');
    expect(classify('some/path/no-extension')).toBe('other');
    expect(classify('x.wat')).toBe('other');
    expect(classify('.gitignore')).toBe('other');
  });

  it('is case-insensitive on the extension', () => {
    expect(classify('X.TS')).toBe('typescript');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/classify.test.ts`
Expected: FAIL — `Cannot find module '../../src/domain/classify'`

- [ ] **Step 3: Write `src/domain/classify.ts`**

**File category is a domain concept, not a renderer detail** (§4.1). This pure function produces the `colorKey` layout carries and the legend names. Classification is **filename-based and explicitly not semantic language analysis**.

```ts
// The WP-01 category vocabulary is CLOSED (spec 4.1). The validator rejects anything
// outside it, the legend enumerates it, and styles.css declares one --ci-cat-<id> per
// member. ADDING A CATEGORY IS A SECTION 4 CONTRACT CHANGE: stop and raise it.
export const CATEGORY_IDS = ['typescript', 'javascript', 'vue', 'test', 'style',
  'markup', 'config', 'docs', 'asset', 'other'] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

const BY_EXTENSION: Readonly<Record<string, CategoryId>> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  vue: 'vue',
  css: 'style', scss: 'style', sass: 'style', less: 'style',
  html: 'markup', htm: 'markup', xml: 'markup', svg: 'markup',
  json: 'config', jsonc: 'config', yml: 'config', yaml: 'config', toml: 'config', ini: 'config',
  md: 'docs', mdx: 'docs', txt: 'docs', rst: 'docs',
  png: 'asset', jpg: 'asset', jpeg: 'asset', gif: 'asset', webp: 'asset',
  ico: 'asset', woff: 'asset', woff2: 'asset', ttf: 'asset', mp4: 'asset',
};

// Test patterns beat extensions, so foo.test.ts is `test`, not `typescript`.
const TEST_PATTERN = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[^.]+$/i;

/** Filename-based classification. Never opens or parses the file. */
export function classify(relativePath: string): CategoryId {
  if (TEST_PATTERN.test(relativePath)) return 'test';
  const base = relativePath.slice(relativePath.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return 'other';   // dot === 0 is a dotfile, which has no extension
  return BY_EXTENSION[base.slice(dot + 1).toLowerCase()] ?? 'other';
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/classify.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing path-safety test**

`tests/unit/path-safety.test.ts` — **ported from `docs/concept/prototype/tests/model.test.cjs`**, keeping the invariants. Spec §4.4: **Obsidian's `normalizePath()` is vault-relative only** — it strips leading slashes and does not remove `..`, so **it gives no path safety**. This module is the real thing.

```ts
import { describe, expect, it } from 'vitest';
import { isContained, normalizeRelativePath } from '../../src/adapters/filesystem/path-safety';

describe('normalizeRelativePath', () => {
  it('normalises Windows relative separators', () => {
    expect(normalizeRelativePath('src\\domain\\test.ts')).toBe('src/domain/test.ts');
  });

  it('preserves Unicode path segments', () => {
    expect(normalizeRelativePath('src/énergie/Öffnung.ts')).toBe('src/énergie/Öffnung.ts');
  });

  it('rejects absolute paths, drive letters, traversal and empty segments', () => {
    for (const p of ['/etc/a.ts', 'C:\\a.ts', 'C:/a.ts', 'src/../a.ts', 'src//a.ts', './a.ts', '..']) {
      expect(() => normalizeRelativePath(p), p).toThrow();
    }
  });

  it('rejects control characters, empty strings and over-long paths', () => {
    expect(() => normalizeRelativePath('')).toThrow();
    expect(() => normalizeRelativePath('a\u0000b.ts')).toThrow();
    expect(() => normalizeRelativePath('a\u001fb.ts')).toThrow();
    expect(() => normalizeRelativePath('x'.repeat(1025))).toThrow();
  });
});

describe('isContained', () => {
  it('accepts a real descendant', () => {
    expect(isContained('C:\\Projects\\app', 'C:\\Projects\\app\\src\\a.ts')).toBe(true);
  });

  it('rejects a sibling sharing a prefix', () => {
    // The classic prefix collision: a string prefix test says yes, path.relative says no.
    expect(isContained('C:\\Projects\\app', 'C:\\Projects\\app-evil\\a.ts')).toBe(false);
  });

  it('rejects traversal out of the root', () => {
    expect(isContained('C:\\Projects\\app', 'C:\\Projects\\app\\..\\other\\a.ts')).toBe(false);
  });

  it('treats the root itself as contained', () => {
    expect(isContained('C:\\Projects\\app', 'C:\\Projects\\app')).toBe(true);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/unit/path-safety.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Write `src/adapters/filesystem/path-safety.ts`**

Ported from `docs/concept/prototype/src/model.js:15-20`, with containment added. **Implement `isContained` as a pure string algorithm, not via `node:path`** — `no-nodejs-modules` forbids the static import, and a pure implementation keeps this module testable under the `node` Vitest project without a host and without an eslint-disable. (Task 5's walker does its live containment checks through `nodePath` from `node-access.ts`; this function is the pure, testable definition both agree on.)

```ts
const MAX_PATH_LENGTH = 1024;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * POSIX, root-relative, safe. This is NOT Obsidian's normalizePath(), which is
 * vault-relative only: it strips leading slashes and does not remove `..`, so it
 * offers no path safety at all (spec 4.4).
 */
export function normalizeRelativePath(value: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PATH_LENGTH) {
    throw new Error(`A relative path must be a non-empty string of at most ${MAX_PATH_LENGTH} characters.`);
  }
  if (CONTROL_CHARS.test(value)) {
    throw new Error('A relative path must not contain control characters.');
  }
  const path = value.replace(/\\/g, '/');
  if (/^(\/|[A-Za-z]:)/.test(path)) {
    throw new Error('A relative path must not be absolute or carry a drive letter.');
  }
  if (path.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) {
    throw new Error('A relative path must have no empty segments and no . or .. segments.');
  }
  return path;
}

/** Case-insensitive on Windows drive letters; segment-wise, so C:\app-evil is not
 *  inside C:\app. Equivalent to path.resolve + a path.relative sign check (spec 4.4). */
export function isContained(root: string, candidate: string): boolean {
  const seg = (p: string): string[] => {
    const out: string[] = [];
    for (const part of p.replace(/\\/g, '/').split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') { if (out.length === 0) return ['\u0000INVALID']; out.pop(); continue; }
      out.push(part);
    }
    return out;
  };
  const r = seg(root);
  const c = seg(candidate);
  if (r[0] === '\u0000INVALID' || c[0] === '\u0000INVALID') return false;
  if (c.length < r.length) return false;
  return r.every((part, i) => part.localeCompare(c[i]!, undefined, { sensitivity: 'accent' }) === 0);
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run tests/unit/path-safety.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 9: Write the failing entity-id and metrics tests**

`tests/unit/entity-id.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntityId, parseEntityId } from '../../src/domain/entity-id';

describe('makeEntityId', () => {
  it('is repository id, entity kind and POSIX root-relative path, NUL-joined', () => {
    expect(makeEntityId('repo-1', 'file', 'src/a.ts')).toBe('repo-1\u0000file\u0000src/a.ts');
  });

  it('is stable across rescans and carries no hash', () => {
    expect(makeEntityId('repo-1', 'file', 'src/a.ts')).toBe(makeEntityId('repo-1', 'file', 'src/a.ts'));
    expect(makeEntityId('repo-1', 'file', 'src/a.ts')).not.toMatch(/[0-9a-f]{16}/);
  });

  it('distinguishes a directory from a file at the same path', () => {
    expect(makeEntityId('r', 'directory', 'src')).not.toBe(makeEntityId('r', 'file', 'src'));
  });

  it('round-trips', () => {
    expect(parseEntityId(makeEntityId('r', 'file', 'src/a.ts')))
      .toEqual({ repositoryId: 'r', kind: 'file', path: 'src/a.ts' });
  });

  it('rejects a component containing NUL', () => {
    expect(() => makeEntityId('r\u0000x', 'file', 'a.ts')).toThrow();
    expect(() => makeEntityId('r', 'file', 'a\u0000b.ts')).toThrow();
  });
});
```

`tests/unit/metrics.test.ts` — spec §4.1's physical-lines definition is exact:

```ts
import { describe, expect, it } from 'vitest';
import { byteSize, countPhysicalLines } from '../../src/domain/metrics';

describe('countPhysicalLines', () => {
  it('counts empty text as 0', () => expect(countPhysicalLines('')).toBe(0));
  it('counts a single unterminated line as 1', () => expect(countPhysicalLines('a')).toBe(1));
  it('adds no phantom line for a trailing newline', () => {
    expect(countPhysicalLines('a\nb\n')).toBe(2);
    expect(countPhysicalLines('a\nb')).toBe(2);
  });
  it('treats CRLF as one separator', () => {
    expect(countPhysicalLines('a\r\nb\r\n')).toBe(2);
    expect(countPhysicalLines('a\r\nb\r\nc')).toBe(3);
  });
  it('counts blank and comment lines', () => expect(countPhysicalLines('a\n\n// c\n')).toBe(3));
  it('counts a file of only newlines', () => expect(countPhysicalLines('\n\n\n')).toBe(3));
});

describe('byteSize', () => {
  it('is a separate observation from physical lines', () => {
    expect(byteSize(new Uint8Array([1, 2, 3]))).toBe(3);
  });
});
```

- [ ] **Step 10: Run them to verify they fail**

Run: `npx vitest run tests/unit/entity-id.test.ts tests/unit/metrics.test.ts`
Expected: FAIL — both modules missing.

- [ ] **Step 11: Write `src/domain/entity-id.ts` and `src/domain/metrics.ts`**

```ts
// src/domain/entity-id.ts
export type EntityId = string;
export type EntityKind = 'repository' | 'directory' | 'file';

const SEP = '\u0000';

/** Identity is repository id + entity kind + POSIX root-relative path, NUL-joined.
 *  Stable across rescans, NO HASH. Hashing is used only for fileSetDigest and
 *  contentHash; a content hash is a revision marker and never participates in identity. */
export function makeEntityId(repositoryId: string, kind: EntityKind, path: string): EntityId {
  if (repositoryId.includes(SEP) || path.includes(SEP)) {
    throw new Error('An entity id component must not contain NUL.');
  }
  return `${repositoryId}${SEP}${kind}${SEP}${path}`;
}

export function parseEntityId(id: EntityId): { repositoryId: string; kind: EntityKind; path: string } {
  const parts = id.split(SEP);
  if (parts.length !== 3) throw new Error('Malformed entity id.');
  return { repositoryId: parts[0]!, kind: parts[1] as EntityKind, path: parts[2]! };
}
```

```ts
// src/domain/metrics.ts
/** Physical lines: empty text is 0; CRLF is ONE separator; a trailing newline adds no
 *  phantom line; blank and comment lines count. Binary, undecodable, skipped and
 *  oversized content never reach this function — they yield status 'unavailable' with a
 *  reason and a NULL value, never 0. */
export function countPhysicalLines(text: string): number {
  if (text.length === 0) return 0;
  const normalized = text.replace(/\r\n/g, '\n');
  const trimmed = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
  return trimmed.split('\n').length;
}

export function byteSize(bytes: Uint8Array): number {
  return bytes.byteLength;
}

// TWO METRICS ONLY (spec 4.1). Adding a third is a section 4 contract change.
export const METRIC_PHYSICAL_LINES = {
  metricId: 'physical-lines', unit: 'lines', definitionVersion: '1',
} as const;

export const METRIC_BYTE_SIZE = {
  metricId: 'byte-size', unit: 'bytes', definitionVersion: '1',
} as const;
```

- [ ] **Step 12: Run them to verify they pass**

Run: `npx vitest run tests/unit/entity-id.test.ts tests/unit/metrics.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 13: Write `src/domain/model.ts` — the §4.1 types**

No test drives a pure type file; the validator test (Step 16) drives it. **Deferred, and must not appear:** findings, relations, `external-package`, and all WP-02+ extensions.

```ts
import type { CategoryId } from './classify';
import type { EntityId, EntityKind } from './entity-id';

export interface SourceReference { repositoryId: string; path: string }

export interface CodeEntity {
  id: EntityId; repositoryId: string; kind: EntityKind;
  path: string;                  // POSIX, root-relative
  name: string;                  // display name
  parentId: EntityId | null;
  category: CategoryId | null;   // null for repository and directory
}

export interface Measurement {
  metricId: 'physical-lines' | 'byte-size';
  unit: 'lines' | 'bytes';
  definitionVersion: '1';
}

export interface Observation {
  entityId: EntityId;
  measurement: Measurement;
  status: 'measured' | 'unavailable';
  value: number | null;          // NEVER 0 for unavailable
  reason: string | null;         // required when status is 'unavailable'
}

export interface ProviderRun {
  runId: string;
  provider: 'builtin-inventory';  // the built-in inventory IS a ProviderRun
  origin: 'collected';
  capturedAt: string;
  completedAt: string | null;
}

export interface AnalysisScope {
  rootPath: string;              // resolved, absolute — NEVER persisted through getState()
  exclusions: readonly string[];
  maxFileBytes: number;
  followSymlinks: false;         // static in WP-01; S13's row is explanatory text, not a toggle
}

export interface ApprovedInventoryRun {
  profileId: string;
  sourceFingerprint: string;     // over the resolved root
  scopeFingerprint: string;      // over exclusions + limits
  approvedAt: string;
  operation: 'read-only-inventory';
}

export interface CodebaseSnapshot {
  snapshotId: string;
  schemaVersion: 1;
  repositoryId: string;
  providerRun: ProviderRun;
  scope: AnalysisScope;
  entities: readonly CodeEntity[];
  observations: readonly Observation[];
  fileSetDigest: string;
  completeness: 'complete' | 'partial';   // a SECOND axis, not the run state
  warnings: readonly string[];
}

export interface CodebaseProfile {
  profileId: string; name: string; bindingId: string | null;
  exclusions: readonly string[]; maxFileBytes: number;
}

export interface LocalBinding {
  bindingId: string; label: string; rootPath: string; machineId: string;
}

/** Adopted from renderer-port.ts verbatim, with mode respelled from
 *  'three-dimensional' | 'top-down'. ABSOLUTE position/target/up is the persisted form:
 *  the prototype stores theta/phi/radius but recomputes radius from layout extent, so
 *  under dispose-and-reconstruct a restored bookmark would only be exact if the layout
 *  were byte-identical. */
export interface CameraBookmark {
  projection: 'orthographic';
  mode: '3d' | 'top';
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  zoom: number;
}

export interface CityViewState {
  profileId: string | null;
  snapshotId: string | null;
  selectedEntityId: EntityId | null;
  query: string;
  viewMode: '3d' | 'top' | 'list';
  camera: CameraBookmark | null;
  previous3dCamera: CameraBookmark | null;  // load-bearing: without persisting it the
  inspectorOpen: boolean;                   // top<->3D round trip is lost on reload
}
// There is NO lensId in WP-01.

/** Run state and snapshot completeness are two axes, not one (spec 4.1). */
export type InventoryRunState =
  | { status: 'idle' }
  | { status: 'running'; runId: string; generation: number;
      approval: ApprovedInventoryRun; processedFiles: number }
  | { status: 'cancelling'; runId: string; generation: number }
  | { status: 'cancelled'; runId: string }
  | { status: 'failed'; runId: string; message: string }
  | { status: 'complete'; runId: string; snapshotId: string };
```

Also write the two small ports:

```ts
// src/application/ports/clock.ts
export interface Clock { now(): Date; nowIso(): string }

// src/application/ports/cancellation-token.ts
export interface CancellationToken {
  readonly cancelled: boolean;
  throwIfCancelled(): void;
  onCancelled(listener: () => void): () => void;
}
```

- [ ] **Step 14: Write `src/visualization/renderer-port.ts` — types only**

Copy spec §4.2 **verbatim**: `EntityId` re-export, `CityPalette`, `RendererDiagnostics`, `CreateCityRenderer`, `CityRendererPort`, `CityRendererEvent`. No implementation lands here until task 3. Head the file with these contract notes, so a later implementer cannot miss them:

```ts
// CONTRACT NOTES — spec 4.2. Changing any of these is a section 4 contract change:
// stop and raise it with the user.
//
// * The port NEVER THROWS. WebGL2 unavailability, context-creation failure and
//   initialization failure are reported through onEvent as `unavailable`. Promise
//   rejection counts as throwing: an aborted or superseded setLayout RESOLVES without
//   applying. The view always mounts and always has a surface. (The prototype throws
//   from its constructor, which inside onOpen would break view construction and leave
//   a half-built leaf.)
// * The renderer consumes a LayoutResult, NEVER a CodebaseSnapshot. It never computes
//   layout, grouping or district assignment. A renderer API taking a snapshot is a
//   defect, not a convenience.
// * The VIEW owns sizing. The renderer installs no ResizeObserver of its own. resize()
//   re-applies setPixelRatio on EVERY call, clamping the supplied ratio to a maximum
//   of 2, and no-ops on a zero-size box. Resize NEVER implies fit.
// * Hover intent belongs to the renderer: hover-changed fires only after the 200 ms
//   dwell; the renderer owns the timer and raycasts only when it fires. A null entityId
//   is emitted immediately on leave.
// * The VIEW owns focus, keys and accessible naming. mountEl is the single focusable,
//   named region. The renderer's canvas is aria-hidden and never tabbable, and NO key
//   event crosses the port.
// * Camera mode is spelled '3d' | 'top' EVERYWHERE. In 'list' mode no renderer exists
//   and setCameraMode is never called. When setCamera receives a bookmark whose mode
//   differs from the current mode, THE BOOKMARK WINS and the renderer switches.
// * Camera ownership: the renderer owns the live camera and emits camera-changed; the
//   view mirrors it into CityViewState. A command to move the camera is a separate call
//   from the event, so host synchronisation does not loop.
// * NO `restored` event and NO self-healing. On unavailable{context-lost} the VIEW
//   disposes and reconstructs. Ship debugLoseContext; do NOT ship a restore partner.
//   Both prototypes implement self-healing; the Three.js prototype's own recorded run
//   logged 33 "WebGL: INVALID_OPERATION: delete: object does not belong to this
//   context" warnings in that path. That is the failure this rule prevents.
// * Pop-out migration is dispose() plus constructing a new renderer. There is no
//   rebind. The renderer must therefore be cheap to reconstruct from an existing
//   LayoutResult and CityViewState, with no data refetch and no scan.
// * pause/resume: hidden leaves suspend drawing and input, and visibility NEVER
//   authorises a scan.
```

- [ ] **Step 15: Write `tests/fixtures/snapshot-builder.ts`**

The builder must emit **unavailable and measured-zero records** — an explicit acceptance criterion — and task 4 needs a fixture that **actually exercises the cap**, which neither prototype's does.

```ts
import { classify } from '../../src/domain/classify';
import { makeEntityId } from '../../src/domain/entity-id';
import type { CodebaseSnapshot } from '../../src/domain/model';

export interface FixtureSpec {
  files: number;
  directories?: number;
  measuredZero?: number;            // files whose physical-lines is a MEASURED 0
  unavailable?: number;             // files whose physical-lines is unavailable + reason
  lineCounts?: readonly number[];   // explicit per-file values; used by capFixture
  repositoryId?: string;
  completeness?: 'complete' | 'partial';
  warnings?: readonly string[];
}

export function buildSnapshotFixture(spec: FixtureSpec): CodebaseSnapshot { /* implement */ }

/** 12 files, 3 directories, one measured-zero and one unavailable. The default fixture. */
export function tinyFixture(): CodebaseSnapshot { /* buildSnapshotFixture({ files: 12, directories: 3, measuredZero: 1, unavailable: 1 }) */ }

/** 200 files whose values put the 95th percentile WELL BELOW the maximum, so
 *  clampedCount is provably nonzero: 190 files at 10-300 lines, 10 at 2,000-9,000.
 *  Task 4's cap check depends on this; neither prototype's fixture exercises the cap. */
export function capFixture(): CodebaseSnapshot { /* implement */ }

/** Combining marks, an RTL segment, spaces, and a 240-character path. */
export function unicodeFixture(): CodebaseSnapshot { /* implement */ }

/** Zero files. Valid, and must yield finite geometry bounds downstream. */
export function emptyFixture(): CodebaseSnapshot { /* implement */ }
```

- [ ] **Step 16: Write the failing validator test**

`tests/unit/validator.test.ts`. **Validation is runtime, not casts** — persisted settings and restored view state are untrusted input.

```ts
import { describe, expect, it } from 'vitest';
import { ValidationError, validateCityViewState, validateSnapshot } from '../../src/domain/validator';
import { buildSnapshotFixture, tinyFixture } from '../fixtures/snapshot-builder';

describe('validateSnapshot', () => {
  it('round-trips a valid fixture unchanged', () => {
    const fixture = tinyFixture();
    expect(validateSnapshot(JSON.parse(JSON.stringify(fixture)))).toEqual(fixture);
  });

  it('accepts a measured-zero observation, because zero is a valid measurement', () => {
    const s = buildSnapshotFixture({ files: 1, measuredZero: 1 });
    const o = validateSnapshot(s).observations.find((x) => x.measurement.metricId === 'physical-lines')!;
    expect(o.status).toBe('measured');
    expect(o.value).toBe(0);
  });

  it('accepts an unavailable observation with a null value and a reason', () => {
    const s = buildSnapshotFixture({ files: 1, unavailable: 1 });
    const o = validateSnapshot(s).observations.find((x) => x.status === 'unavailable')!;
    expect(o.value).toBeNull();
    expect(o.reason).toBeTruthy();
  });

  it('rejects an unavailable observation whose value is 0, never coercing it', () => {
    const s: any = buildSnapshotFixture({ files: 1, unavailable: 1 });
    s.observations[0].value = 0;
    expect(() => validateSnapshot(s)).toThrow(/unavailable/i);
  });

  it('rejects an unavailable observation with no reason', () => {
    const s: any = buildSnapshotFixture({ files: 1, unavailable: 1 });
    s.observations[0].reason = null;
    expect(() => validateSnapshot(s)).toThrow(/reason/i);
  });

  it('REJECTS a category outside the classifier vocabulary, never re-inferring it', () => {
    // The prototype's demo fixture violates its own enum on 24 of 144 records and passes,
    // because its validator silently re-infers. Ours must not (spec 4.1).
    const s: any = buildSnapshotFixture({ files: 1 });
    s.entities.find((e: any) => e.kind === 'file').category = 'TypeScript';
    expect(() => validateSnapshot(s)).toThrow(/category/i);
  });

  it('rejects duplicate entity ids', () => {
    const s: any = buildSnapshotFixture({ files: 2 });
    s.entities[2] = { ...s.entities[1] };
    expect(() => validateSnapshot(s)).toThrow(/duplicate/i);
  });

  it('rejects an observation referencing an entity that does not exist', () => {
    const s: any = buildSnapshotFixture({ files: 1 });
    s.observations[0].entityId = 'repo\u0000file\u0000ghost.ts';
    expect(() => validateSnapshot(s)).toThrow(/reference/i);
  });

  it('rejects a containment-tree cycle', () => {
    const s: any = buildSnapshotFixture({ files: 1, directories: 2 });
    const [a, b] = s.entities.filter((e: any) => e.kind === 'directory');
    a.parentId = b.id; b.parentId = a.id;
    expect(() => validateSnapshot(s)).toThrow(/cycle/i);
  });

  it('rejects unsafe paths', () => {
    const s: any = buildSnapshotFixture({ files: 1 });
    s.entities.find((e: any) => e.kind === 'file').path = '../escape.ts';
    expect(() => validateSnapshot(s)).toThrow();
  });

  it('rejects a non-finite, non-integer or negative measurement', () => {
    for (const v of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const s: any = buildSnapshotFixture({ files: 1 });
      s.observations[0].value = v;
      expect(() => validateSnapshot(s), String(v)).toThrow();
    }
  });

  it('rejects a wrong schema version instead of guessing', () => {
    const s: any = buildSnapshotFixture({ files: 1 });
    s.schemaVersion = 2;
    expect(() => validateSnapshot(s)).toThrow(/schema/i);
  });

  it('rejects a raw analysis report rather than guessing at it', () => {
    expect(() => validateSnapshot({ unusedFiles: [] })).toThrow();
  });

  it('rejects a payload over the size limit', () => {
    expect(() => validateSnapshot(buildSnapshotFixture({ files: 200_001 }))).toThrow(/limit/i);
  });

  it('carries every reason on the error, never dropping one silently', () => {
    const s: any = buildSnapshotFixture({ files: 1 });
    s.schemaVersion = 2;
    s.completeness = 'mostly';
    try { validateSnapshot(s); expect.unreachable(); }
    catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reasons.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('never reads provenance from the payload', () => {
    // Provenance is a property of the RUN that produced a snapshot, established by the
    // collector. A restored or imported value claiming provenance is data to be
    // validated, never a label to display. The Three.js prototype prints "Synthetic
    // example" straight from an imported `source` field; a crafted file therefore lies.
    const s: any = buildSnapshotFixture({ files: 1 });
    s.source = 'synthetic';
    s.providerRun.provider = 'hand-edited';
    expect(() => validateSnapshot(s)).toThrow(/provider/i);
  });
});

describe('validateCityViewState', () => {
  const cam = { projection: 'orthographic', mode: '3d', position: [1, 2, 3],
                target: [0, 0, 0], up: [0, 1, 0], zoom: 1 } as const;

  it('rejects a resolved absolute path smuggled through workspace.json', () => {
    // getState() persists to workspace.json, which is USER-EDITABLE (spec 4.4).
    expect(() => validateCityViewState({ profileId: 'p', rootPath: 'C:\\somewhere', query: '' })).toThrow();
  });

  it('rejects an unknown viewMode', () => {
    expect(() => validateCityViewState({ profileId: null, snapshotId: null, selectedEntityId: null,
      query: '', viewMode: 'vr', camera: null, previous3dCamera: null, inspectorOpen: false })).toThrow();
  });

  it('accepts a well-formed state and preserves previous3dCamera', () => {
    const s = validateCityViewState({ profileId: 'p', snapshotId: 's', selectedEntityId: null,
      query: '', viewMode: 'top', camera: { ...cam, mode: 'top' }, previous3dCamera: cam,
      inspectorOpen: false });
    expect(s.previous3dCamera).toEqual(cam);
  });
});
```

- [ ] **Step 17: Run it to verify it fails**

Run: `npx vitest run tests/unit/validator.test.ts`
Expected: FAIL — validator and fixture builder missing.

- [ ] **Step 18: Write `src/domain/validator.ts`**

One **zod**-based module checking payload limits, schema version, finite numbers, duplicate ids, reference integrity, containment-tree cycles and path safety. **Every failure contributes a reason string; `ValidationError.reasons` carries all of them**, because validation failures surface as visible warnings carrying their reason, in `CodebaseSnapshot.warnings` — **never dropped silently**.

```ts
export class ValidationError extends Error {
  constructor(readonly reasons: readonly string[]) {
    super(`Snapshot validation failed:\n- ${reasons.join('\n- ')}`);
    this.name = 'ValidationError';
  }
}
```

Structural rules zod cannot express, applied after parsing and **all collected before throwing**:

1. Every `entities[].id` is unique → `duplicate entity id: <id>`.
2. Every `observations[].entityId` exists in `entities` → `reference integrity: observation targets unknown entity <id>`.
3. Walking `parentId` from every entity terminates at a `repository` → `containment-tree cycle at <id>`.
4. Every `entities[].path` passes `normalizeRelativePath` → the thrown message becomes the reason.
5. `kind === 'file'` ⟹ `category` is in `CATEGORY_IDS` → `unknown category "<v>" on <id>`. **Rejected, never re-inferred.**
6. `status === 'unavailable'` ⟹ `value === null` **and** `reason` is a non-empty string → `unavailable observation must carry a null value and a reason`.
7. `status === 'measured'` ⟹ `value` is a non-negative safe integer.
8. `providerRun.provider === 'builtin-inventory'` **and** `origin === 'collected'` → `provider "<v>" is not a collected builtin-inventory run`. **Provenance is never read from a payload.**
9. `entities.length + observations.length` under the payload limit (200,000 entities) → `payload exceeds the entity limit`.
10. Unknown top-level keys are rejected (zod `.strict()`), which is what catches a smuggled `source` field.

`validateCityViewState` uses the same module and the same `.strict()` discipline, so `rootPath` is rejected as an unknown key.

- [ ] **Step 19: Run the validator test to verify it passes**

Run: `npx vitest run tests/unit/validator.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 20: Run the whole gate and commit**

```bash
npm run verify
git add -A
git commit -m "feat(domain): frozen contracts, runtime validator, classifier and fixture builder

Implements spec 4.1 and the type half of 4.2. The category vocabulary is closed;
a category outside it is rejected, never silently re-inferred. Unavailable is
null with a reason, never 0. Provenance is never read from a payload. Path
safety ported from the prototype's normalizePath, with containment added."
```

**Acceptance criteria, restated concretely:**

1. A valid fixture survives `JSON.parse(JSON.stringify(x))` → `validateSnapshot` unchanged.
2. Every invalid fixture is rejected **with a reason string**, and `ValidationError.reasons` carries **all** reasons, not the first.
3. `tests/fixtures/snapshot-builder.ts` emits fixtures that **include unavailable and measured-zero records**, and `capFixture()` has a provably nonzero clamped population.
4. **A category outside the closed vocabulary is rejected, never silently re-inferred.**
5. `unavailable` never carries `0`; `measured` `0` is accepted as a real measurement.
6. `validateCityViewState` rejects a resolved absolute path and an unknown `viewMode`.
7. `src/domain/**` imports nothing from Obsidian, Vue, Three.js, Node or fallow — the layering lint rule passes.
8. `src/visualization/renderer-port.ts` compiles and contains **types only**.

---

## Task 3: Host skeleton — CHECKPOINT #1

**Ends with:** Opening the view runs no scan and no filesystem access, and shows the welcome state; the packed `dist/` installs and enables in the dev vault.

**Files:**
- Modify: `src/main.ts` (the real entry), `src/ui/styles.css`
- Create: `src/host/city-view.ts`, `src/host/view-state.ts`, `src/host/commands.ts`, `src/host/theme-bridge.ts`
- Create: `src/visualization/color.ts`, `src/visualization/city-renderer.ts` (**minimal**)
- Create: `src/ui/App.vue` (a welcome-state shell only — task 9 builds the real UI)
- Create: `tests/fixtures/dev-fixture.ts` (the dev-only fixture path)
- Test: `tests/host/plugin-onload.test.ts`, `tests/host/city-view.test.ts`, `tests/unit/color.test.ts`, `tests/component/welcome-state.test.ts`

**Interfaces:**
- Consumes: `CodebaseSnapshot`, `CityViewState`, `validateCityViewState` (task 2); `CityRendererPort`, `CreateCityRenderer`, `CityPalette` (task 2).
- Produces:
  - `const CITY_VIEW_TYPE = 'codebase-inspector-city'`
  - `class CityView extends ItemView` with `getViewType()`, `getDisplayText()`, `getIcon()`, `onOpen()`, `onClose()`, `getState()`, `setState()`
  - `createCityRenderer: CreateCityRenderer` (the minimal implementation task 10 replaces)
  - `cssColorToSrgbBytes(win: Window, value: string): [number, number, number]`
  - `readPalette(containerEl: HTMLElement): CityPalette`
  - `registerCommands(plugin: Plugin): void`

**Dependencies:** Tasks 1, 2.

**Three.js hazards that land here:** this is the first task that constructs a `Color`. **`ColorManagement.enabled` defaults to `true` since r152, so `new Color(hex)` already converts sRGB→working — never call `convertSRGBToLinear()`.** The lint rule from task 1 enforces it; the comment in `color.ts` explains it. Any lighting value is written as `<pre-r155 value> * Math.PI`.

- [ ] **Step 1: Write the failing onload test**

`tests/host/plugin-onload.test.ts`. **`onload` registers only** — no scanning, no expensive work. Startup work goes in `workspace.onLayoutReady()`; first-enable view opening uses `onUserEnable()`.

```ts
import { describe, expect, it, vi } from 'vitest';
import CodebaseInspectorPlugin from '../../src/main';
import { CITY_VIEW_TYPE } from '../../src/host/city-view';

// A hand-rolled double; the `obsidian` module is externalised at build time.
function makePluginDouble() { /* returns a plugin instance with spied app/workspace/vault */ }

describe('onload', () => {
  it('registers the city view, the ribbon icon and three commands, and nothing else', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.registerView).toHaveBeenCalledWith(CITY_VIEW_TYPE, expect.any(Function));
    expect(p.addRibbonIcon).toHaveBeenCalledTimes(1);
    expect(p.addCommand.mock.calls.map((c: any[]) => c[0].id).sort())
      .toEqual(['cancel-scan', 'open-city', 'scan-codebase']);
  });

  it('registers commands WITHOUT the plugin-id prefix', () => {
    const p = makePluginDouble();
    p.onload();
    for (const [cmd] of p.addCommand.mock.calls) {
      expect(cmd.id).not.toMatch(/^codebase-inspector/);
    }
  });

  it('registers no command for an unimplemented capability', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.addCommand).toHaveBeenCalledTimes(3);
  });

  it('does no filesystem access and starts no scan during onload', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.app.vault.adapter.read).not.toHaveBeenCalled();
    expect(p.app.vault.adapter.list).not.toHaveBeenCalled();
  });

  it('defers startup work to onLayoutReady and first-enable opening to onUserEnable', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.app.workspace.onLayoutReady).toHaveBeenCalled();
  });

  it('never detaches leaves in onunload', () => {
    const p = makePluginDouble();
    p.onload();
    p.onunload();
    expect(p.app.workspace.detachLeavesOfType).not.toHaveBeenCalled();
  });

  it('types onunload as void, so teardown is never awaited', () => {
    const p = makePluginDouble();
    expect(p.onunload()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/host/plugin-onload.test.ts`
Expected: FAIL — `CITY_VIEW_TYPE` is not exported.

- [ ] **Step 3: Write `src/main.ts` and `src/host/commands.ts`**

```ts
import { Plugin, type WorkspaceLeaf } from 'obsidian';
import { CITY_VIEW_TYPE, CityView } from './host/city-view';
import { registerCommands } from './host/commands';
import './ui/styles.css';

export default class CodebaseInspectorPlugin extends Plugin {
  override onload(): void {
    // onload REGISTERS ONLY. No scanning, no expensive work (spec 4.4).
    this.registerView(CITY_VIEW_TYPE, (leaf: WorkspaceLeaf) => new CityView(leaf, this));
    this.addRibbonIcon('building-2', 'Open codebase city', () => { void openCity(this); });
    registerCommands(this);

    this.app.workspace.onLayoutReady(() => {
      // Startup work belongs here, not in onload. Nothing in WP-01 needs it yet;
      // task 11 attaches per-leaf snapshot reconciliation.
    });
  }

  override onUserEnable(): void {
    // First-enable view opening only. Never on every load.
    void openCity(this);
  }

  // Typed void and never awaited. Teardown is synchronous and idempotent.
  // NEVER detachLeavesOfType here (spec 4.4).
  override onunload(): void {}
}
```

`src/host/commands.ts` registers `open-city`, `scan-codebase` and `cancel-scan` **without the plugin-id prefix**. In task 3 the latter two have `checkCallback`s that return `false` (no profile, no approval) — **they are registered, not rendered as disabled controls**, and task 8 wires their bodies.

Reaching a view **always** goes through this shape — **a cast is a defect**:

```ts
export async function openCity(plugin: Plugin): Promise<void> {
  const { workspace } = plugin.app;
  const existing = workspace.getLeavesOfType(CITY_VIEW_TYPE);
  const leaf = existing[0] ?? workspace.getLeaf('tab');
  if (!existing[0]) await leaf.setViewState({ type: CITY_VIEW_TYPE, active: true });
  // Since 1.7.2 every view is created as a DeferredView, so reveal before acting.
  await workspace.revealLeaf(leaf);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/host/plugin-onload.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the failing colour-conversion test**

`tests/unit/color.test.ts`. **Obsidian 1.13 moved base colours to OKLCH**, and resolved values may be `oklch()` or `color-mix()`, which `THREE.Color.setStyle()` cannot parse. Conversion goes through a **1×1 canvas 2D context in `containerEl.win.document`** — which also keeps the conversion in the correct window.

```ts
import { describe, expect, it } from 'vitest';
import { cssColorToSrgbBytes } from '../../src/visualization/color';

// A canvas double returning the bytes a real 2D context would produce.
function fakeWin(fill: Record<string, [number, number, number, number]>): Window { /* ... */ }

describe('cssColorToSrgbBytes', () => {
  it('resolves a hex colour', () => {
    expect(cssColorToSrgbBytes(fakeWin({ '#336699': [0x33, 0x66, 0x99, 255] }), '#336699'))
      .toEqual([0x33, 0x66, 0x99]);
  });

  it('resolves an oklch() value THREE.Color.setStyle cannot parse', () => {
    const win = fakeWin({ 'oklch(0.63 0.13 250)': [70, 110, 170, 255] });
    expect(cssColorToSrgbBytes(win, 'oklch(0.63 0.13 250)')).toEqual([70, 110, 170]);
  });

  it('resolves a color-mix() value', () => {
    const win = fakeWin({ 'color-mix(in oklab, red 50%, blue)': [128, 0, 128, 255] });
    expect(cssColorToSrgbBytes(win, 'color-mix(in oklab, red 50%, blue)')).toEqual([128, 0, 128]);
  });

  it('falls back to a stated neutral rather than throwing on an unparseable value', () => {
    // The port never throws. An unresolvable token must not break the view.
    expect(cssColorToSrgbBytes(fakeWin({}), 'not-a-color')).toEqual([128, 128, 128]);
  });

  it('uses the INJECTED window document, never a bare document', () => {
    const win = fakeWin({ '#ffffff': [255, 255, 255, 255] });
    const spy = vi.spyOn(win.document, 'createElement');
    cssColorToSrgbBytes(win, '#ffffff');
    expect(spy).toHaveBeenCalledWith('canvas');
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/unit/color.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 7: Write `src/visualization/color.ts`**

```ts
/**
 * Obsidian 1.13 moved base colours to OKLCH. A resolved value may be oklch() or
 * color-mix(), which THREE.Color.setStyle() cannot parse. Painting into a 1x1 canvas
 * 2D context in the INJECTED window's document resolves anything the browser can,
 * and keeps the conversion in the correct window after a pop-out migration.
 *
 * DO NOT call convertSRGBToLinear() on the resulting Color. ColorManagement.enabled
 * has defaulted to true since r152, so new Color() already converts sRGB to working.
 * Double-converting raises no error and no warning; it just renders everything 2-3x
 * darker. Banned by no-restricted-syntax in eslint.config.mjs.
 */
export function cssColorToSrgbBytes(win: Window, value: string): [number, number, number] {
  const NEUTRAL: [number, number, number] = [128, 128, 128];
  try {
    const canvas = win.document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return NEUTRAL;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#808080';     // so an invalid value leaves the neutral in place
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r!, g!, b!];
  } catch {
    return NEUTRAL;
  }
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run tests/unit/color.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 9: Write `src/host/theme-bridge.ts`**

Reads colours with `containerEl.getCssPropertyValue('--…')`, **never `getComputedStyle(document.body)`** (wrong document after migration), and re-reads **every cached colour** on `workspace.on('css-change')`, which carries no payload. **Recolouring never moves buildings, changes camera, or clears state.**

```ts
export function readPalette(containerEl: HTMLElement): CityPalette {
  const win = containerEl.win;                       // never a bare window
  const read = (token: string) => cssColorToSrgbBytes(win, containerEl.getCssPropertyValue(token));
  const hex = (t: string) => { const [r, g, b] = read(t); return `#${...}`; };
  return {
    background: hex('--ci-surface'),
    districtSurface: hex('--ci-panel'),
    districtBorder: hex('--ci-border'),
    labelText: hex('--ci-text'),
    selection: hex('--ci-action'),
    unavailable: hex('--ci-text-muted'),
    categories: Object.fromEntries(CATEGORY_IDS.map((id) => [id, hex(`--ci-cat-${id}`)])) as ...,
  };
}
```

Add the ten `--ci-cat-*` custom properties to `src/ui/styles.css` — **one per `CategoryId`**, as Obsidian-derived aliases or plugin-owned values, **never hex constants in the renderer**. These are the one plugin-owned palette.

- [ ] **Step 10: Write the failing city-view test**

`tests/host/city-view.test.ts`:

```ts
describe('CityView', () => {
  it('creates no WebGL context in the constructor', () => {
    // WebGL context creation is in onOpen, not the constructor (spec 4.4).
    const view = new CityView(leafDouble, pluginDouble);
    expect(createRendererSpy).not.toHaveBeenCalled();
  });

  it('mounts Vue on contentEl, not containerEl.children[1]', async () => {
    const view = new CityView(leafDouble, pluginDouble);
    await view.onOpen();
    expect(view.contentEl.classList.contains('codebase-inspector-root')).toBe(true);
  });

  it('creates its own Pinia instance per view', async () => { /* two views, two stores */ });

  it('performs no filesystem access and starts no scan on open', async () => {
    const view = new CityView(leafDouble, pluginDouble);
    await view.onOpen();
    expect(pluginDouble.app.vault.adapter.list).not.toHaveBeenCalled();
    expect(scanCoordinatorSpy.start).not.toHaveBeenCalled();
  });

  it('shows the welcome state when no profile exists', async () => {
    const view = new CityView(leafDouble, pluginDouble);
    await view.onOpen();
    expect(view.contentEl.textContent).toContain('Understand your codebase. Start with its structure.');
    expect(view.contentEl.textContent).toContain('Select a codebase');
    // COPY-20 is WP-02+ and must not leak forward.
    expect(view.contentEl.textContent).not.toContain('Unused candidate');
    // S01's "Analysis reports can be added later" promises a capability WP-01 does not ship.
    expect(view.contentEl.textContent).not.toContain('Analysis reports can be added later');
  });

  it('returns identifiers and presentation state only from getState()', async () => {
    const state = view.getState();
    expect(Object.keys(state).sort()).toEqual(['camera', 'inspectorOpen', 'previous3dCamera',
      'profileId', 'query', 'selectedEntityId', 'snapshotId', 'viewMode']);
    expect(JSON.stringify(state)).not.toMatch(/[A-Za-z]:\\\\/);   // no resolved absolute path
  });

  it('validates setState through the same validator as settings', async () => {
    await view.setState({ viewMode: 'vr', rootPath: 'C:\\evil' } as any, {} as any);
    expect(view.getState().viewMode).not.toBe('vr');
    expect(view.getState()).not.toHaveProperty('rootPath');
  });

  it('unmounts Vue and disposes the renderer in onClose', async () => {
    await view.onOpen();
    await view.onClose();
    expect(disposeSpy).toHaveBeenCalled();
    expect(view.contentEl.childElementCount).toBe(0);
  });

  it('creates NO WebGL context below the 320 CSS px hard floor', async () => {
    leafDouble.width = 300;
    await view.onOpen();
    expect(createRendererSpy).not.toHaveBeenCalled();
    expect(view.contentEl.textContent).toContain('File inspection still works.');   // COPY-14
  });
});
```

- [ ] **Step 11: Run it to verify it fails, then write `src/host/city-view.ts` and `src/host/view-state.ts`**

Run: `npx vitest run tests/host/city-view.test.ts` → FAIL.

`CityView` responsibilities in task 3 (task 9 adds the real UI, tasks 10–11 the rest):

- `getViewType()` returns `CITY_VIEW_TYPE`; `getDisplayText()` and `getIcon()` are stable.
- `onOpen()` puts `.codebase-inspector-root` on `this.contentEl`, calls `createPinia()` **itself** (per view), mounts `App.vue`, and — **only above the 320 CSS px floor** — constructs the minimal renderer.
- `onClose()` unmounts Vue, disposes the renderer, and releases every listener.
- `getState()` / `setState()` go through `src/host/view-state.ts`, which calls `validateCityViewState` from task 2. **`workspace.json` is user-editable.**
- **Never hold a view reference anywhere** — the factory may run more than once.

- [ ] **Step 12: Write the minimal `src/visualization/city-renderer.ts`**

The smallest thing that satisfies `CreateCityRenderer` and draws instanced boxes behind the **dev-only fixture path** (`tests/fixtures/dev-fixture.ts`, reachable only when a dev flag is set — it is not a shipped feature and not a rendered control). Every method exists; most are no-ops task 10 fills in. **The port never throws**: WebGL2 unavailability and context-creation failure are reported through `onEvent` as `unavailable`.

```ts
export const createCityRenderer: CreateCityRenderer = (mountEl, win, onEvent) => {
  let renderer: WebGLRenderer | null = null;
  try {
    const canvas = win.document.createElement('canvas');   // injected window, never bare document
    canvas.setAttribute('aria-hidden', 'true');            // never tabbable
    renderer = new WebGLRenderer({ canvas, antialias: true });
  } catch {
    onEvent({ type: 'unavailable', reason: 'initialization-failed' });
    return makeInertPort();          // the view always mounts and always has a surface
  }
  // ... minimal InstancedMesh, orthographic camera, one render on setLayout
};
```

Lighting, if any is added here: **write every intensity as `<pre-r155 value> * Math.PI`** and say so in a comment. Values lifted from the r140 prototype are wrong by exactly that factor.

- [ ] **Step 13: Run the city-view tests to verify they pass**

Run: `npx vitest run tests/host/ tests/component/`
Expected: PASS.

- [ ] **Step 14: Establish the `setState` / `onOpen` ordering empirically**

Spec §11 lists this as open: *"Ordering of `setState` relative to `onOpen` on workspace restore. No official statement; established empirically at task 3."*

Add a temporary `console.log('CI-ORDER: <hook>')` to both, restart Obsidian with a city leaf in the saved workspace, and **record the observed order in the task-3 commit message and in `docs/superpowers/notes/2026-09-17-wp01-spike-report.md` under a new "Established at task 3" heading.** Then remove the logs. Task 11 depends on knowing this.

- [ ] **Step 15: Build, install and run checkpoint #1**

```bash
npm run verify && npm run install:vault
```

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat(host): plugin entry, deferred-safe CityView, commands and a minimal renderer

Opening the view performs no filesystem access and starts no scan. getState()
returns identifiers and presentation state only, and setState validates through
the domain validator because workspace.json is user-editable. Colour crosses
into WebGL through a 1x1 canvas in the injected window document.

setState/onOpen ordering observed on workspace restore: <record it here>."
```

### CHECKPOINT #1 — manual checklist, run in Obsidian

The user runs this. **Every line is observed in the running host, not inferred from a test.**

**Setup:** `npm run verify && npm run install:vault`, then reload Obsidian (Ctrl+R) in the dev vault `C:\Projects\renovation-planner`.

**Installation and enabling**
- [ ] Settings → Community plugins shows **Codebase Inspector**, version 0.1.0
- [ ] The installed folder is exactly `.obsidian/plugins/codebase-inspector` (not a suffixed variant)
- [ ] Enabling it produces **no console error** (Ctrl+Shift+I)
- [ ] Disabling and re-enabling **twice** produces no console error and no duplicated ribbon icon

**Opening the view**
- [ ] The ribbon icon opens a tab titled with the view's display text
- [ ] The tab shows the welcome state: **"Understand your codebase. Start with its structure."** and a **"Select a codebase"** action
- [ ] The text **"Unused candidate"** appears nowhere (COPY-20 is WP-02+)
- [ ] The text **"Analysis reports can be added later"** appears nowhere
- [ ] **No rendered-but-disabled control** for unimplemented behaviour is visible anywhere

**The safety claim under test**
- [ ] With the console open and a filter of `readdir|readFile|scan`, opening the view produces **no filesystem activity**
- [ ] Nothing in the UI claims a scan happened, or that anything was read
- [ ] Command palette → typing "codebase" shows exactly **three** commands: open city, scan codebase, cancel scan — and no fourth
- [ ] `scan-codebase` and `cancel-scan` are present but **do nothing** (they have no approval yet); neither throws

**Host rules**
- [ ] Opening a **second** city tab works; both show the welcome state independently
- [ ] Dragging a city tab into a **sidebar** narrower than 320 px shows the list-first surface with **"The 3D view is unavailable. File inspection still works."** and **creates no WebGL context** (console: no `WebGL context` line)
- [ ] Switching the theme (Settings → Appearance → light/dark) does not throw, and the view's surface colour follows the theme
- [ ] Closing the tab and reopening it restores the welcome state with no error
- [ ] `Ctrl+R` with a city tab open restores it; **record whether `setState` fires before or after `onOpen`** — write the answer into the spike report

**Stop and raise with the user if:** any filesystem call is observed on view open; the plugin fails to enable; a fourth command appears; a disabled placeholder control is visible; or WebGL initialises below 320 px.

---

## Task 4: Pure layout

**Ends with:** No overlaps; identical input yields identical geometry; three metric states distinguishable.

**Layout consumes a validated snapshot, never the filesystem.** It is a pure function, and it runs **before** the real scan exists so the renderer is fed by a pure function from the start.

**Files:**
- Create: `src/domain/layout/types.ts`, `src/domain/layout/scale.ts`, `src/domain/layout/districts.ts`, `src/domain/layout/layout.ts`
- Modify: `tests/fixtures/snapshot-builder.ts` (add `capFixture` values if not already exercising the cap)
- Test: `tests/unit/layout-determinism.test.ts`, `tests/unit/layout-scale.test.ts`, `tests/unit/layout-districts.test.ts`

**Interfaces:**
- Consumes: `CodebaseSnapshot`, `CategoryId`, `EntityId` (task 2); the fixtures from `tests/fixtures/snapshot-builder.ts`.
- Produces:
  - `interface CityLot { entityId; directoryId; center: [number,number,number]; dimensions: [number,number,number]; colorKey: CategoryId; metricState: 'measured' | 'measured-zero' | 'unavailable' }`
  - `interface CityDistrict { directoryId; parentId: EntityId | null; name: string; depth: number; center: [number,number,number]; extent: [number,number]; labelAnchor: [number,number,number]; aggregated: boolean }`
  - `interface LayoutResult { snapshotId: string; layoutVersion: string; lots: readonly CityLot[]; districts: readonly CityDistrict[]; bounds: { min: [number,number,number]; max: [number,number,number] }; scale: { metricId: string; name: string; cap: number; unit: string; clampedCount: number } }`
  - `computeLayout(snapshot: CodebaseSnapshot, opts?: { metricId?: 'physical-lines' | 'byte-size' }): LayoutResult`
  - `deriveCap(values: readonly number[]): number`
  - `heightFor(value: number, cap: number): number`

**Dependencies:** Tasks 1, 2.

**Ported from:** four tests in `docs/concept/prototype/tests/model.test.cjs` — *"identical inventory creates identical lot positions"*, *"every file has its own lot"*, *"many directories are explicitly aggregated, not dropped"*, and *"empty snapshot is valid and has finite geometry bounds"*. **The prototype's layout algorithm itself is not ported**: it produces a flat single-level grouping with hardcoded `['src','packages','apps']` special-casing, and spec §4.3 requires **deterministic nested districts** with a `parentId` and a `depth`.

**Three.js hazard that lands here:** none directly — layout is pure and imports no Three.js. But `colorKey` is a **palette key, never a resolved colour**, precisely so recolouring on `css-change` never re-runs layout. If an implementer is tempted to resolve a colour here, that is the mistake the rule exists to prevent.

- [ ] **Step 1: Write the failing display-scale test**

`tests/unit/layout-scale.test.ts`. Spec §4.3's formula and cap rule are exact:

```ts
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/domain/layout/layout';
import { deriveCap, heightFor } from '../../src/domain/layout/scale';
import { capFixture, emptyFixture, tinyFixture } from '../fixtures/snapshot-builder';

describe('deriveCap', () => {
  it('is the 95th percentile of measured physical-lines', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);   // p95 = 95
    expect(deriveCap(values)).toBe(100);   // 95 -> floored at 100
  });

  it('is floored at 100 lines', () => {
    expect(deriveCap([1, 2, 3, 4, 5])).toBe(100);
  });

  it('rounds up to two significant figures', () => {
    expect(deriveCap([...Array(95).fill(600), ...Array(5).fill(9000)])).toBe(600);
    expect(deriveCap([...Array(95).fill(612), ...Array(5).fill(9000)])).toBe(620);
    expect(deriveCap([...Array(95).fill(1234), ...Array(5).fill(9000)])).toBe(1300);
  });

  it('is NEVER hardcoded at 600', () => {
    expect(deriveCap([...Array(95).fill(2500), ...Array(5).fill(9000)])).not.toBe(600);
  });

  it('ignores unavailable observations, which have no value', () => {
    expect(deriveCap([])).toBe(100);
  });
});

describe('heightFor', () => {
  it('uses the reference formula 8 + 120 * sqrt(min(lines, cap) / cap)', () => {
    expect(heightFor(0, 600)).toBeCloseTo(8, 6);
    expect(heightFor(600, 600)).toBeCloseTo(128, 6);
    expect(heightFor(150, 600)).toBeCloseTo(8 + 120 * Math.sqrt(0.25), 6);
  });

  it('keeps an empty measured file selectable via the 8-unit base', () => {
    expect(heightFor(0, 600)).toBeGreaterThan(0);
  });

  it('clamps above the cap rather than growing', () => {
    expect(heightFor(9000, 600)).toBeCloseTo(heightFor(600, 600), 6);
  });
});

describe('scale on a real layout', () => {
  it('counts clampedCount as the number of LOTS whose RAW value exceeded the cap', () => {
    const { scale } = computeLayout(capFixture());
    expect(scale.clampedCount).toBeGreaterThan(0);
    expect(scale.clampedCount).toBe(10);   // capFixture puts exactly 10 files above p95
  });

  it('names the cap in SOURCE units, never scene units', () => {
    const { scale } = computeLayout(capFixture());
    expect(scale.unit).toBe('lines');
    expect(scale.name).toBe('physical lines · square-root scale');
    expect(scale.metricId).toBe('physical-lines');
  });

  it('yields finite bounds for an empty snapshot', () => {
    const { bounds } = computeLayout(emptyFixture());
    for (const v of [...bounds.min, ...bounds.max]) expect(Number.isFinite(v)).toBe(true);
  });

  it('gives every lot an EQUAL footprint, so footprint never encodes the height metric', () => {
    const { lots } = computeLayout(tinyFixture());
    const foot = lots.map((l) => `${l.dimensions[0]}x${l.dimensions[2]}`);
    expect(new Set(foot).size).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/layout-scale.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `src/domain/layout/scale.ts`**

```ts
/**
 * The cap is the 95th percentile of measured physical-lines in the snapshot, floored at
 * 100 lines and rounded UP to two significant figures — NOT hardcoded at 600.
 *
 * A percentile rather than the maximum, because deriving the cap as max(lines) would
 * make clampedCount permanently 0 and the cap fixture unsatisfiable. A hardcoded cap is
 * either never reached or wrong for the next repository.
 *
 * Accepted consequence, stated rather than discovered: a file's height depends on
 * unrelated files, so the same file changes height between refreshes.
 */
export function deriveCap(measuredValues: readonly number[]): number {
  if (measuredValues.length === 0) return 100;
  const sorted = [...measuredValues].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  const p95 = Math.max(100, sorted[Math.max(0, idx)]!);
  return roundUpToTwoSignificantFigures(p95);
}

function roundUpToTwoSignificantFigures(value: number): number {
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.ceil(value / magnitude) * magnitude;
}

/** height = 8 + 120 * sqrt(min(lines, cap) / cap). The 8-unit base keeps an empty
 *  MEASURED file selectable. */
export function heightFor(value: number, cap: number): number {
  return 8 + 120 * Math.sqrt(Math.min(value, cap) / cap);
}

export const SCALE_NAME = 'physical lines · square-root scale';
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/layout-scale.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Write the failing determinism and metric-state test**

`tests/unit/layout-determinism.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture, tinyFixture } from '../fixtures/snapshot-builder';

describe('computeLayout determinism', () => {
  it('produces identical geometry for identical input', () => {
    const s = tinyFixture();
    expect(computeLayout(s)).toEqual(computeLayout(s));
  });

  it('is insensitive to input ordering', () => {
    const s = tinyFixture();
    const reversed = { ...s, entities: [...s.entities].reverse(),
                             observations: [...s.observations].reverse() };
    expect(computeLayout(reversed).lots).toEqual(computeLayout(s).lots);
  });

  it('gives every file its own lot', () => {
    const { lots } = computeLayout(tinyFixture());
    expect(new Set(lots.map((l) => `${l.center[0]}/${l.center[2]}`)).size).toBe(lots.length);
  });

  it('overlaps no two lots', () => {
    const { lots } = computeLayout(buildSnapshotFixture({ files: 400, directories: 25 }));
    for (let i = 0; i < lots.length; i++) {
      for (let j = i + 1; j < lots.length; j++) {
        const a = lots[i]!, b = lots[j]!;
        const sepX = Math.abs(a.center[0] - b.center[0]) >= (a.dimensions[0] + b.dimensions[0]) / 2;
        const sepZ = Math.abs(a.center[2] - b.center[2]) >= (a.dimensions[2] + b.dimensions[2]) / 2;
        expect(sepX || sepZ, `lots ${i} and ${j} overlap`).toBe(true);
      }
    }
  });

  it('never mutates the snapshot it was given', () => {
    const s = tinyFixture();
    const before = JSON.stringify(s);
    computeLayout(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('carries a palette KEY, never a resolved colour', () => {
    // colorKey is a palette key so recolouring on css-change never re-runs layout.
    for (const lot of computeLayout(tinyFixture()).lots) {
      expect(lot.colorKey).not.toMatch(/^#|rgb|oklch/);
    }
  });
});

describe('three presentation states, not two', () => {
  const layout = () => computeLayout(buildSnapshotFixture({ files: 6, measuredZero: 2, unavailable: 2 }));

  it('distinguishes measured, measured-zero and unavailable', () => {
    const states = new Set(layout().lots.map((l) => l.metricState));
    expect(states).toEqual(new Set(['measured', 'measured-zero', 'unavailable']));
  });

  it('keeps the CATEGORY COLOUR on a measured-zero lot and keeps it selectable', () => {
    const zero = layout().lots.find((l) => l.metricState === 'measured-zero')!;
    expect(zero.colorKey).not.toBe('other');       // it kept its own category
    expect(zero.dimensions[1]).toBeGreaterThan(0); // minimum height, still pickable
  });

  it('gives an unavailable lot a DISTINCT SILHOUETTE, not just a neutral colour', () => {
    // Colour alone is not enough: the Three.js prototype gives measured-zero and
    // unavailable identical geometry and distinguishes unavailable only by a grey that
    // destroys the category signal. Task 4's check is that the two are distinguishable
    // WITHOUT READING THE INSPECTOR (spec 4.3).
    const l = layout();
    const zero = l.lots.find((x) => x.metricState === 'measured-zero')!;
    const un = l.lots.find((x) => x.metricState === 'unavailable')!;
    expect(un.dimensions).not.toEqual(zero.dimensions);
  });
});
```

- [ ] **Step 6: Run it to verify it fails, then write `districts.ts` and `layout.ts`**

Run: `npx vitest run tests/unit/layout-determinism.test.ts` → FAIL.

`src/domain/layout/districts.ts` builds **deterministic nested districts** from the snapshot's containment tree:

- Group by `parentId`, walking the real directory entities — **not by splitting a path string**, and with no special-casing of `src`/`packages`/`apps`.
- Sort children by path with a fixed collator, so ordering never depends on insertion order.
- Each district gets `parentId`, `depth`, `center`, `extent` (ground footprint), `labelAnchor` and `aggregated`.
- **When children are rolled up, `aggregated` is `true` and the files are still present** — "many directories are explicitly aggregated, not dropped".

`src/domain/layout/layout.ts` is the pure entry point. **`districts` exists because task 4 must produce district geometry and labels while §4.2 forbids the renderer from computing grouping or district assignment** — without it the renderer has no ground rectangle to draw, no name to show and no anchor to place a label at.

Metric-state mapping:

| Observation | `metricState` | Geometry | Colour |
|---|---|---|---|
| `measured`, value > 0 | `measured` | `heightFor(value, cap)` | its `CategoryId` |
| `measured`, value === 0 | `measured-zero` | the 8-unit base, full lot footprint | **its `CategoryId`** — keeps the category signal |
| `unavailable` | `unavailable` | **a distinct silhouette**: a narrower, marker-shaped footprint at the base height | the palette's `unavailable` neutral |

The reason for `unavailable` is carried on the `Observation` and surfaced in the inspector — but the **geometry difference is what makes the two distinguishable without reading it**.

- [ ] **Step 7: Run all three layout test files to verify they pass**

Run: `npx vitest run tests/unit/layout-*.test.ts`
Expected: PASS.

- [ ] **Step 8: Write the failing district test**

`tests/unit/layout-districts.test.ts`:

```ts
describe('districts', () => {
  it('nests: every district but the root has a parentId in the set, and a greater depth', () => { /* ... */ });
  it('gives each district a DISPLAY NAME, not a path', () => {
    const d = computeLayout(buildSnapshotFixture({ files: 9, directories: 3 })).districts;
    for (const x of d) expect(x.name).not.toContain('/');
  });
  it('places labelAnchor inside the district extent', () => { /* ... */ });
  it('aggregates rather than drops when there are many directories', () => {
    const l = computeLayout(buildSnapshotFixture({ files: 400, directories: 60 }));
    expect(l.lots.length).toBe(400);                            // nothing dropped
    expect(l.districts.some((d) => d.aggregated)).toBe(true);   // and it says so
  });
  it('assigns every lot a directoryId that exists in districts', () => { /* ... */ });
});
```

- [ ] **Step 9: Run it, implement to green, run the whole gate and commit**

```bash
npx vitest run tests/unit/layout-districts.test.ts   # FAIL, then implement, then PASS
npm run verify
git add -A
git commit -m "feat(layout): deterministic nested districts, p95 display scale, three metric states

The cap is the 95th percentile floored at 100 and rounded up to two significant
figures, not hardcoded at 600, so clampedCount is meaningful. measured-zero keeps
its category colour; unavailable gets a distinct silhouette, so the two are
distinguishable without reading the inspector. colorKey is a palette key, never a
resolved colour, so css-change never re-runs layout."
```

**Acceptance criteria, restated concretely:**

1. **No overlaps** — the 400-lot pairwise separation test passes.
2. **Identical input yields identical geometry** — `computeLayout(s)` deep-equals itself, and is insensitive to input ordering.
3. **Three metric states distinguishable** — `measured`, `measured-zero` and `unavailable` all appear; measured-zero **keeps its category colour** and stays selectable; unavailable has a **distinct silhouette**, not just a neutral colour.
4. `capFixture()` produces a **nonzero `clampedCount`**, and `scale.cap` names the cap in **lines**, never scene units.
5. Every lot has an **equal footprint**; footprint never encodes the height metric.
6. An empty snapshot yields **finite bounds**.
7. Layout **never mutates its input** and **never touches the filesystem**; `colorKey` is a palette key.
8. Many directories are **explicitly aggregated, not dropped** — `lots.length` is unchanged and `aggregated` is `true` somewhere.

---

## Task 5: Inventory collector

**Ends with:** Cross-platform and no-source-write fixtures pass; plugin outputs stay outside collection scope.

**This task depends absolutely on the spike's answer.** Read `docs/superpowers/notes/2026-09-17-wp01-spike-report.md` first. If `window.require('node:original-fs')` did **not** return real directory entries, **stop and raise it with the user** — the whole Node-access design in §3.1 rests on it.

**Files:**
- Create: `src/adapters/filesystem/node-access.ts` (**the only place in the codebase that reaches Node**)
- Create: `src/adapters/filesystem/walker.ts`, `src/adapters/filesystem/node-source-filesystem.ts`
- Create: `src/application/ports/source-filesystem-port.ts`
- Create: `src/application/inventory-collector.ts`
- Create: `tests/contracts/source-filesystem-port.contract.ts` (the shared suite), `tests/fixtures/fake-source-filesystem.ts`, `tests/fixtures/temp-tree.ts`
- Test: `tests/contracts/fake-filesystem.test.ts`, `tests/contracts/node-filesystem.test.ts`, `tests/integration/walker.test.ts`, `tests/integration/no-source-writes.test.ts`, `tests/integration/read-log.test.ts`, `tests/unit/inventory-collector.test.ts`

**Interfaces:**
- Consumes: `normalizeRelativePath`, `isContained` (task 2); `classify`, `countPhysicalLines`, `byteSize`, `makeEntityId`, `CodebaseSnapshot`, `Observation`, `CancellationToken`, `Clock` (task 2).
- Produces:
  - `const fs`, `const fsPromises`, `const nodePath` from `node-access.ts`
  - `interface SourceFileSystemPort { walk(root, opts, token): AsyncIterable<WalkEntry>; readText(absPath, maxBytes): Promise<ReadResult>; stat(absPath): Promise<StatResult>; readLog(): readonly string[] }`
  - `type WalkEntry = { kind: 'file' | 'directory'; absolutePath: string; relativePath: string; byteSize: number } | { kind: 'skipped'; relativePath: string; reason: string }`
  - `collectInventory(port, scope, approval, token, clock): Promise<CodebaseSnapshot>`
  - `runContractSuite(name: string, make: () => SourceFileSystemPort)` from the shared contract file

**Dependencies:** Tasks 1, 2, S (the spike verdict).

- [ ] **Step 1: Write `src/adapters/filesystem/node-access.ts` first — it is the contract**

There is no test to write before this file; it is six lines and the entire point is that it is **the only place in the codebase that reaches Node**. Every other module imports from here.

```ts
// The ONLY place in the codebase that reaches Node. Everything else imports from here.
//
// window.require, not a bundled import: Obsidian injects its own CommonJS require, and
// the renderer's window.require is Electron's real one. (The spike settled which;
// window.require is correct either way.) A static import would also trip
// no-nodejs-modules in eslint-plugin-obsidianmd, which isDesktopOnly does not exempt.
//
// node:original-fs, not fs: Electron patches fs to be asar-aware; original-fs is
// unpatched and correct for walking an arbitrary tree. This is what Obsidian's
// first-party obsidian-importer uses.
import { Platform } from 'obsidian';

export const fs = Platform.isDesktopApp ? window.require('node:original-fs') : null;
export const fsPromises = fs ? fs.promises : null;
export const nodePath = Platform.isDesktopApp ? window.require('node:path') : null;
```

- [ ] **Step 2: Write the failing shared contract suite**

`tests/contracts/source-filesystem-port.contract.ts` — **one shared suite every port implementation must pass, so a fake and the Node adapter cannot drift.**

```ts
import { describe, expect, it } from 'vitest';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';

export function runContractSuite(name: string, make: () => Promise<{ port: SourceFileSystemPort; root: string }>) {
  describe(`SourceFileSystemPort contract: ${name}`, () => {
    it('yields POSIX root-relative paths, never absolute ones', async () => { /* ... */ });
    it('never yields an entry outside the root', async () => { /* ... */ });
    it('reports a skipped entry with a REASON rather than omitting it', async () => { /* ... */ });
    it('reports an unreadable file as skipped with a reason, never as zero bytes', async () => { /* ... */ });
    it('reports a binary file as skipped with a reason, never as 0 lines', async () => { /* ... */ });
    it('reports a file over maxFileBytes as skipped with a reason', async () => { /* ... */ });
    it('does not follow symlinks, and says so as a reason', async () => { /* ... */ });
    it('stops promptly when the cancellation token is cancelled', async () => { /* ... */ });
    it('records every path it OPENS in readLog()', async () => { /* ... */ });
    it('records nothing in readLog() for an excluded path', async () => { /* ... */ });
    it('is deterministic: two walks yield the same ordered relative paths', async () => { /* ... */ });
  });
}
```

`tests/contracts/fake-filesystem.test.ts` and `tests/contracts/node-filesystem.test.ts` each call `runContractSuite` with their own factory.

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run tests/contracts/`
Expected: FAIL — port and implementations missing.

- [ ] **Step 4: Write `src/application/ports/source-filesystem-port.ts`**

Note `readLog()`: **the filesystem port records every path it opens.** This is not instrumentation for convenience — it is the mechanism that lets task 12 prove **the absence of a read**, rather than absence from the interface.

- [ ] **Step 5: Write `src/adapters/filesystem/walker.ts` and `node-source-filesystem.ts`**

A **bounded async walk**: an explicit stack, a per-tick yield so the main thread is never blocked, a maximum depth and a maximum entry count, and a cancellation check at every directory boundary.

Rules that are not negotiable:

- **Containment is checked on every entry** with `isContained` (task 2) against the resolved root — **before** any read.
- **Symlink skipping needs `fs.lstat`** — the adapter's `Stat` has no symlink discriminator. `followSymlinks` is `false` in WP-01, and a symlink is reported as `skipped` with a reason.
- **Exclusions are applied before opening anything.** Directory exclusions prune the subtree.
- **Plugin outputs stay outside collection scope.** When the vault *is* the codebase, the walk excludes `vault.configDir` (never a literal `.obsidian`), other plugins' `data.json`, and `.git`. The config directory is passed in by the caller — `src/adapters/**` must not reach the host to discover it.
- **Never writes.** The port exposes no write operation at all.

- [ ] **Step 6: Run the contract suite against both implementations**

Run: `npx vitest run tests/contracts/`
Expected: PASS — the same suite, twice.

- [ ] **Step 7: Write the failing cross-platform integration test**

`tests/integration/walker.test.ts`, against **real temporary directories** (§6):

```ts
describe('real temporary trees', () => {
  it('handles Unicode names, including combining marks and RTL segments', async () => { /* ... */ });
  it('handles names with spaces and trailing dots', async () => { /* ... */ });
  it('handles deep nesting beyond 20 levels', async () => { /* ... */ });
  it('handles duplicate basenames in different directories', async () => { /* ... */ });
  it('reports binary content as unavailable with a reason, never 0 lines', async () => { /* ... */ });
  it('reports an oversized file as unavailable with a reason', async () => { /* ... */ });
  it('reports an unreadable file as unavailable with a reason', async () => { /* ... */ });
  it('skips symlinks and junctions without following them', async () => { /* ... */ });
  it('applies nested ignore rules', async () => { /* ... */ });
  it('handles Windows drive paths and prefix collisions', async () => {
    // C:\Projects\app-evil is NOT inside C:\Projects\app.
  });
  it('yields nothing outside the approved root under any of the above', async () => { /* ... */ });
});
```

- [ ] **Step 8: Write the two purpose-built proofs**

Spec §6 requires these two gates get **purpose-built proofs rather than assertions**.

`tests/integration/no-source-writes.test.ts` — **hash every file in the fixture tree before and after a scan and diff the whole tree, including modification times**:

```ts
it('changes no file in the inspected project', async () => {
  const root = await makeTempTree(FIXTURE);
  const before = await hashTree(root);     // { relPath: { sha256, mtimeMs, size } }
  await collectInventory(port, scope, approval, token, clock);
  const after = await hashTree(root);
  expect(after).toEqual(before);           // contents, sizes AND modification times
});
```

`tests/integration/read-log.test.ts` — **the filesystem port records every path it opens; the test asserts excluded paths never appear in that read log**, proving the absence of a read, not absence from the interface:

```ts
it('never reads an excluded path, proving absence of a read', async () => {
  const root = await makeTempTree({
    'src/a.ts': 'export const a = 1;\n',
    '.env': 'SECRET=hunter2\n',
    '.git/config': '[core]\n',
    '.obsidian/plugins/other/data.json': '{"token":"secret"}',
  });
  await collectInventory(port, { ...scope, exclusions: ['.env', '.git', '.obsidian'] }, approval, token, clock);
  const log = port.readLog();
  expect(log.some((p) => p.includes('.env'))).toBe(false);
  expect(log.some((p) => p.includes('.git'))).toBe(false);
  expect(log.some((p) => p.includes('data.json'))).toBe(false);
  expect(log.some((p) => p.endsWith('src/a.ts'))).toBe(true);   // the log is real
});

it('excludes the vault config directory when the vault IS the codebase', async () => {
  // Exclude the ACTUAL vault config directory, not only a hard-coded '.obsidian'.
  const log = await scanVaultAsCodebase({ configDir: '.my-config' });
  expect(log.some((p) => p.includes('.my-config'))).toBe(false);
});

it('keeps plugin outputs outside collection scope, so refresh never self-analyses', async () => { /* ... */ });
```

- [ ] **Step 9: Write `src/application/inventory-collector.ts`**

Turns walk entries into `CodeEntity` + `Observation` records:

- Two observations per file: `physical-lines` and `byte-size`. **Byte size is a separate observation** from physical lines.
- `skipped` entries become `status: 'unavailable'`, `value: null`, and the walker's reason string. **Never 0.**
- Directory entities are created for every directory on a kept file's path, so layout has a containment tree.
- `providerRun` is constructed here, with `provider: 'builtin-inventory'` and `origin: 'collected'`. **Provenance is a property of the run, established by the collector** — never read from anything.
- `completeness` is `'partial'` whenever any entry is unavailable, and each distinct reason contributes a string to `warnings`.
- The result is passed through `validateSnapshot` before it is returned. **Publication is task 8's job**; this function only produces.

- [ ] **Step 10: Run the whole suite and commit**

```bash
npm run verify
git add -A
git commit -m "feat(inventory): single Node-access module, bounded walk, cancellation and metrics

All Node access goes through node-access.ts via window.require with node:-prefixed
specifiers and node:original-fs, never the asar-patched fs. One shared contract
suite runs against the fake and the Node adapter so they cannot drift. Two
purpose-built proofs: a whole-tree hash diff including mtimes, and a read-log
assertion that proves the ABSENCE of a read for excluded paths."
```

**Acceptance criteria, restated concretely:**

1. **Cross-platform fixtures pass** — Unicode, spaces, deep nesting, duplicate basenames, binary, oversized, unreadable, symlinks and junctions, nested ignores, and Windows drive paths including a prefix collision.
2. **The no-source-write proof passes**: a whole-tree hash diff **including modification times** shows no change.
3. **The read-log proof passes**: excluded paths — `.env`, `.git`, the **actual** `vault.configDir`, other plugins' `data.json` — never appear in the port's read log, while an included path does.
4. **Plugin outputs stay outside collection scope**, so a refresh never self-analyses.
5. The shared contract suite passes against **both** the fake and the Node adapter.
6. Cancellation stops the walk promptly and the collector publishes nothing.
7. `src/adapters/filesystem/node-access.ts` is **the only file in `src/` that references `window.require`**, and no file anywhere statically imports a Node built-in.
8. Unavailable content yields `null` with a reason — **never 0** — for both metrics.

---

## Task 6: Profiles, bindings, hybrid settings tab

**Ends with:** Profiles persist; a missing binding prompts reconnect.

> ### BLOCKED BY AN OPEN QUESTION — verify before implementing
>
> Spec §11 lists as **open**: *"Whether `getSettingDefinitions()` can express a dynamic per-profile list with buttons and custom rows. Blocks task 6; the hybrid in section 4.4 is the fallback."* Spec §4.4 flags the settings bullet as the one host rule that is **not** verified.
>
> **Steps 1–3 below are the verification step. They run before any implementation.** The outcome is recorded in a document, and the implementation follows whichever branch the evidence supports. **Do not skip to Step 4.**

**Files:**
- Create: `docs/superpowers/notes/2026-09-17-setting-definitions-verification.md` (the verification record)
- Create: `src/host/setting-definitions.ts`, `src/host/settings-tab.ts`, `src/host/modals/clear-binding-modal.ts`
- Create: `src/adapters/storage/plugin-data-profile-store.ts`, `src/adapters/storage/plugin-data-binding-store.ts`
- Create: `src/application/ports/profile-store.ts`, `src/application/ports/local-binding-store.ts`
- Test: `tests/contracts/profile-store.contract.ts`, `tests/contracts/binding-store.contract.ts`, `tests/unit/profile-store.test.ts`, `tests/component/settings-tab.test.ts`

**Interfaces:**
- Consumes: `CodebaseProfile`, `LocalBinding`, `validateSnapshot`-style validation from `src/domain/validator.ts` (task 2).
- Produces:
  - `interface ProfileStore { list(): Promise<readonly CodebaseProfile[]>; get(id): Promise<CodebaseProfile | null>; save(p): Promise<void>; remove(id): Promise<void> }`
  - `interface LocalBindingStore { get(bindingId): Promise<LocalBinding | null>; save(b): Promise<void>; clear(bindingId): Promise<void> }`
  - `class CodebaseInspectorSettingTab extends PluginSettingTab`
  - `getSettingDefinitions(): SettingDefinition[]` on the plugin (or its documented absence)

**Dependencies:** Tasks 1, 2, 3.

- [ ] **Step 1: VERIFICATION — establish what `getSettingDefinitions()` can express**

Find the answer in obsidianmd-owned sources, in this order, and **stop at the first that answers it**:

1. The `obsidianmd/obsidian-api` typings — the declared type of `getSettingDefinitions()`'s return, and whether any member permits a button, a custom row, or a dynamically sized list.
2. `eslint-plugin-obsidianmd`'s `settings-tab/prefer-setting-definitions` rule source — what shapes it recognises, and what it explicitly permits a `display()` fallback for.
3. `docs.obsidian.md`'s settings documentation.
4. A published community plugin, on `minAppVersion` ≥ 1.13.0, that renders a dynamic list through `getSettingDefinitions()`.

**Answer these three questions specifically:**

- **A.** Can a definition list be **recomputed** when the profile set changes, or is it read once at registration?
- **B.** Can a definition render a **button** (reconnect, clear binding) and a **custom row** (a storage disclosure paragraph)?
- **C.** Does `prefer-setting-definitions` accept a **scoped disable** in `PluginSettingTab.display()` for the parts that cannot be expressed?

- [ ] **Step 2: Write the verification record**

`docs/superpowers/notes/2026-09-17-setting-definitions-verification.md`:

```markdown
# Verification: can getSettingDefinitions() express a dynamic per-profile list?

Spec §11 open question, blocking task 6. Spec §4.4's hybrid is the documented fallback.

## Sources consulted
<obsidianmd-owned sources only, with the exact file or URL and the date>

## A. Can the definition list be recomputed when profiles change?
<answer + evidence>

## B. Can a definition render a button and a custom row?
<answer + evidence>

## C. Does prefer-setting-definitions accept a scoped disable in display()?
<answer + evidence>

## Decision
[ ] FULL DECLARATIVE — the profile manager is expressed in getSettingDefinitions().
[ ] HYBRID (the spec §4.4 fallback) — declarative getSettingDefinitions() for SCALAR
    settings only (size limits, exclusions, symlink policy as STATIC TEXT); the profile
    and local-binding manager, exclusion review, clear-binding confirmation and storage
    disclosure are rendered in PluginSettingTab.display() or a modal, with a SCOPED
    prefer-setting-definitions disable carrying a comment that cites this document.

## What this means for task 6
<one paragraph>
```

- [ ] **Step 3: Commit the verification before implementing**

```bash
git add docs/superpowers/notes/2026-09-17-setting-definitions-verification.md
git commit -m "docs: resolve the getSettingDefinitions open question blocking task 6"
```

**If the evidence is inconclusive, take the HYBRID branch.** Spec §4.4 already specifies it in full, it is the documented fallback, and it is correct either way. **Do not invent a third option, and do not leave the question open.**

- [ ] **Step 4: Write the failing profile-store contract suite**

`tests/contracts/profile-store.contract.ts` — one suite, run against a fake and against the real `plugin.loadData()/saveData()`-backed store:

```ts
export function runProfileStoreContract(name: string, make: () => ProfileStore) {
  describe(`ProfileStore contract: ${name}`, () => {
    it('round-trips a saved profile', async () => { /* ... */ });
    it('persists across a store reconstruction', async () => { /* ... */ });
    it('VALIDATES persisted data on read, because data.json is untrusted input', async () => {
      // Persisted settings are untrusted input (spec 4.1). A hand-edited data.json with
      // an unknown key, a wrong type, or an absolute path must be rejected with a reason,
      // not cast.
    });
    it('rejects a profile whose maxFileBytes is not a positive integer', async () => { /* ... */ });
    it('returns null rather than throwing for an unknown id', async () => { /* ... */ });
    it('removes a profile without disturbing its siblings', async () => { /* ... */ });
  });
}
```

`tests/contracts/binding-store.contract.ts` mirrors it, and adds:

```ts
it('returns null when the binding exists but its root is unavailable on this machine', async () => {
  // COPY-28: "The saved source directory is unavailable on this machine. The stored
  // snapshot can still be inspected."
});
it('never persists a resolved absolute path into anything getState() touches', async () => { /* ... */ });
```

- [ ] **Step 5: Run them to verify they fail, then implement the two stores**

Run: `npx vitest run tests/contracts/profile-store.contract.ts tests/contracts/binding-store.contract.ts` → FAIL, then implement to green.

The stores back onto `plugin.loadData()` / `plugin.saveData()`. **Every read validates**, because `data.json` is user-editable. A profile carries `bindingId`, never a path; the **binding** carries the `rootPath` and a `machineId`, so a profile synced to another machine has a missing binding rather than a wrong path.

- [ ] **Step 6: Write the failing settings-tab test**

`tests/component/settings-tab.test.ts`:

```ts
describe('settings tab', () => {
  it('lists every saved profile', async () => { /* ... */ });
  it('shows a reconnect action when a profile\'s binding is missing on this machine', async () => {
    expect(el.textContent).toContain('The saved source directory is unavailable on this machine. The stored snapshot can still be inspected.');
    expect(el.querySelector('[data-action="reconnect"]')).not.toBeNull();
  });
  it('confirms before clearing a binding', async () => { /* modal, not an immediate mutation */ });
  it('renders the symlink policy as STATIC EXPLANATORY TEXT, not a disabled toggle', async () => {
    // Spec §1 forbids any rendered-but-disabled control for unimplemented behaviour.
    const row = el.querySelector('[data-setting="follow-symlinks"]')!;
    expect(row.querySelector('input,button,select')).toBeNull();
  });
  it('renders a storage disclosure', async () => { /* ... */ });
  it('never hardcodes .obsidian anywhere in plugin source', async () => {
    // hardcoded-config-path in eslint-plugin-obsidianmd catches this; the test documents why.
  });
  it('does not render a control for any unimplemented capability', async () => { /* ... */ });
});
```

- [ ] **Step 7: Run it, implement the settings tab on the verified branch, run to green**

On the **HYBRID** branch (§4.4, the fallback):

```ts
// Declarative half: SCALAR settings only.
getSettingDefinitions(): SettingDefinition[] {
  return [
    { id: 'maxFileBytes', type: 'number', name: 'Maximum file size to read', ... },
    { id: 'exclusions', type: 'text', name: 'Excluded paths', ... },
    // Symlink policy is STATIC TEXT. Never a disabled toggle.
    { id: 'symlinkPolicy', type: 'info', name: 'Follow symbolic links',
      description: 'Symbolic links and junctions are never followed. They are reported as skipped, with a reason.' },
  ];
}
```

```ts
// eslint-disable-next-line obsidianmd/prefer-setting-definitions -- The profile and
// local-binding manager needs a dynamic per-profile list with buttons and custom rows,
// which getSettingDefinitions() cannot express. See
// docs/superpowers/notes/2026-09-17-setting-definitions-verification.md.
export class CodebaseInspectorSettingTab extends PluginSettingTab {
  display(): void { /* profile manager, exclusion review, clear-binding, storage disclosure */ }
}
```

- [ ] **Step 8: Run the whole gate and commit**

```bash
npm run verify
git add -A
git commit -m "feat(settings): profiles, local bindings and the hybrid settings tab

Resolves the getSettingDefinitions open question from spec 11; see
docs/superpowers/notes/2026-09-17-setting-definitions-verification.md. Persisted
data is validated on every read because data.json is user-editable. A profile
carries a bindingId, never a path, so a missing binding prompts reconnect instead
of scanning a wrong root. The symlink row is static explanatory text."
```

**Acceptance criteria, restated concretely:**

1. **The open question is resolved and recorded** in `docs/superpowers/notes/2026-09-17-setting-definitions-verification.md`, committed **before** the implementation commit, with obsidianmd-owned evidence and an explicit branch decision.
2. **Profiles persist** across a plugin reload and a store reconstruction.
3. **A missing binding prompts reconnect** with COPY-28's exact text, and the retained snapshot stays inspectable.
4. Every persisted read is **validated**, and a hand-edited `data.json` is rejected with a reason rather than cast.
5. The **symlink row is static explanatory text**, with no `input`, `button` or `select` in it.
6. Clearing a binding is **confirmed** first.
7. `eslint --max-warnings 0` passes, with at most one **scoped** `prefer-setting-definitions` disable carrying a comment that cites the verification document.
8. **No literal `.obsidian`** appears anywhere in `src/`.

---

## Task 7: Source selection and scope consent

**Ends with:** A scan cannot start without consent; a changed root invalidates approval.

**Files:**
- Create: `src/host/modals/source-modal.ts` (C03), `src/host/modals/scope-modal.ts` (C04)
- Create: `src/application/approval.ts`
- Test: `tests/unit/approval.test.ts`, `tests/component/source-modal.test.ts`, `tests/component/scope-modal.test.ts`

**Interfaces:**
- Consumes: `ApprovedInventoryRun`, `AnalysisScope`, `CodebaseProfile`, `LocalBinding` (tasks 2, 6); `isContained` (task 2).
- Produces:
  - `fingerprintSource(resolvedRoot: string): string`
  - `fingerprintScope(scope: AnalysisScope): string`
  - `approve(profileId, resolvedRoot, scope, clock): ApprovedInventoryRun`
  - `isApprovalValid(approval: ApprovedInventoryRun, resolvedRoot: string, scope: AnalysisScope): boolean`
  - `openSourceModal(app, opts): Promise<SourceSelection | null>`
  - `openScopeModal(app, selection): Promise<ApprovedInventoryRun | null>`

**Dependencies:** Tasks 1, 2, 3, 6.

**Two native modals**, in order: **three source modes with validation**, then **resolved root, exclusions, limits, unchecked acknowledgement, Scan disabled until approved, approval fingerprint**.

- [ ] **Step 1: Write the failing approval test**

`tests/unit/approval.test.ts`. **Approval is a modelled artefact**, because "opening a view is not authorisation" needs something to check. **A scope fingerprint is what makes "a changed root invalidates approval" mechanical rather than advisory.**

```ts
import { describe, expect, it } from 'vitest';
import { approve, fingerprintScope, fingerprintSource, isApprovalValid } from '../../src/application/approval';

const scope = { rootPath: 'C:\\Projects\\app', exclusions: ['.git', 'node_modules'],
                maxFileBytes: 1_000_000, followSymlinks: false } as const;

describe('approval', () => {
  it('is valid for the exact root and scope it was granted for', () => {
    const a = approve('p1', scope.rootPath, scope, clock);
    expect(isApprovalValid(a, scope.rootPath, scope)).toBe(true);
  });

  it('is INVALIDATED by a changed root', () => {
    const a = approve('p1', scope.rootPath, scope, clock);
    expect(isApprovalValid(a, 'C:\\Projects\\other', scope)).toBe(false);
  });

  it('is INVALIDATED by a changed exclusion list', () => {
    const a = approve('p1', scope.rootPath, scope, clock);
    expect(isApprovalValid(a, scope.rootPath, { ...scope, exclusions: ['.git'] })).toBe(false);
  });

  it('is INVALIDATED by a changed size limit', () => {
    const a = approve('p1', scope.rootPath, scope, clock);
    expect(isApprovalValid(a, scope.rootPath, { ...scope, maxFileBytes: 2_000_000 })).toBe(false);
  });

  it('is invalidated by a root that differs only in case or trailing separator', () => {
    const a = approve('p1', 'C:\\Projects\\app', scope, clock);
    expect(isApprovalValid(a, 'C:\\Projects\\app\\', scope)).toBe(true);   // same resolved root
    expect(isApprovalValid(a, 'C:\\Projects\\app-evil', scope)).toBe(false);
  });

  it('is exclusion-order insensitive, so re-sorting does not spuriously invalidate', () => {
    expect(fingerprintScope(scope)).toBe(fingerprintScope({ ...scope, exclusions: ['node_modules', '.git'] }));
  });

  it('records the operation as read-only-inventory and nothing else', () => {
    expect(approve('p1', scope.rootPath, scope, clock).operation).toBe('read-only-inventory');
  });

  it('carries an approvedAt timestamp from the injected clock, never Date.now()', () => { /* ... */ });
});
```

- [ ] **Step 2: Run it to verify it fails, then write `src/application/approval.ts`**

Run: `npx vitest run tests/unit/approval.test.ts` → FAIL, then implement to green.

- [ ] **Step 3: Write the failing source-modal test**

`tests/component/source-modal.test.ts` — **three source modes with validation**:

```ts
describe('source modal (C03)', () => {
  it('offers exactly three source modes', async () => {
    // e.g. the vault itself, a folder inside the vault, and an external directory.
    expect(modes).toHaveLength(3);
  });
  it('shows COPY-03 for the external mode', async () => {
    expect(el.textContent).toContain('Read a local codebase outside this vault.');
  });
  it('validates that the chosen directory exists and is a directory', async () => { /* ... */ });
  it('rejects a path that is not absolute', async () => { /* ... */ });
  it('reports an invalid directory with a visible reason, never silently', async () => { /* ... */ });
  it('resolves the vault root through adapter.getBasePath() behind an instanceof check', async () => {
    // instanceof FileSystemAdapter, never a cast, because mobile supplies CapacitorAdapter.
  });
  it('returns null on cancel and performs NO filesystem read', async () => { /* ... */ });
  it('never opens a file — only stats a directory', async () => { /* ... */ });
});
```

- [ ] **Step 4: Write the failing scope-modal test**

`tests/component/scope-modal.test.ts` — the consent artefact:

```ts
describe('scope modal (C04)', () => {
  it('shows COPY-04 as its heading', async () => {
    expect(el.textContent).toContain('Review scope and read access');
  });

  it('shows COPY-05 as the permission detail', async () => {
    expect(el.textContent).toContain('Source text and file metadata are read. No project scripts, dependency installation, or source writes are performed.');
  });

  it('shows the RESOLVED root, exclusions and limits', async () => { /* ... */ });

  it('starts with the acknowledgement UNCHECKED', async () => {
    expect(checkbox.checked).toBe(false);
    expect(el.textContent).toContain('I approve read access to this directory for this scan.');
  });

  it('keeps Scan DISABLED until the acknowledgement is checked', async () => {
    expect(scanButton.disabled).toBe(true);
    await check(checkbox);
    expect(scanButton.disabled).toBe(false);
    expect(scanButton.textContent).toContain('Scan codebase');
  });

  it('returns an approval fingerprinted over the resolved root and the scope', async () => {
    const approval = await confirm();
    expect(approval.sourceFingerprint).toBe(fingerprintSource(resolvedRoot));
    expect(approval.scopeFingerprint).toBe(fingerprintScope(scope));
  });

  it('re-disables Scan and clears the acknowledgement when an exclusion is edited', async () => {
    // A changed scope invalidates prior approval, in the UI as well as in the model.
  });

  it('performs NO filesystem read of file contents while reviewing scope', async () => { /* ... */ });

  it('returns null on cancel, and no approval exists afterwards', async () => { /* ... */ });

  it('does NOT claim "Read-only source access" or "Source remains unchanged" yet', async () => {
    // Those two strings are factual claims made on the product's behalf. They ship only
    // after task 12 records the G2 evidence (spec §5.2, §10).
    expect(el.textContent).not.toContain('Read-only source access');
    expect(el.textContent).not.toContain('Source remains unchanged');
  });

  it('returns focus to the control that opened it when dismissed', async () => { /* ... */ });
});
```

- [ ] **Step 5: Run both, implement the two modals to green**

Run: `npx vitest run tests/component/source-modal.test.ts tests/component/scope-modal.test.ts` → FAIL, then implement.

Both are **native Obsidian `Modal`s**, not Vue-rendered overlays — C03 and C04 are declared as `Native Modal` in the component library, and a native modal gets Obsidian's focus trap and Escape handling for free. **Escape resolves exactly one layer per press**, and a modal is the highest layer.

- [ ] **Step 6: Run the whole gate and commit**

```bash
npm run verify
git add -A
git commit -m "feat(consent): source selection and scope approval as a modelled artefact

Approval is fingerprinted over the resolved root and over exclusions plus limits,
so a changed root or scope invalidates it mechanically rather than advisorily.
Scan stays disabled until the acknowledgement is explicitly checked, and editing
the scope clears it. The two factual claims stay out of the UI until task 12."
```

**Acceptance criteria, restated concretely:**

1. **A scan cannot start without consent** — no code path produces an `ApprovedInventoryRun` except the scope modal's explicit confirmation, and the acknowledgement starts unchecked.
2. **A changed root invalidates approval** — `isApprovalValid` returns `false` for a different resolved root, a different exclusion list, or a different size limit.
3. Exclusion **ordering** does not spuriously invalidate an approval.
4. The scope modal shows COPY-04, COPY-05, COPY-06 and COPY-07 verbatim, and the **resolved** root.
5. Editing the scope **re-disables Scan** and clears the acknowledgement.
6. Neither modal reads file contents; the source modal only stats a directory.
7. **"Read-only source access" and "Source remains unchanged" appear nowhere** — they ship after task 12.
8. Dismissing either modal returns focus to its opener.

---

## Task 8: Scan wiring and run lifecycle — CHECKPOINT #2

**Ends with:** A real external project renders as a real city; cancel retains the previous snapshot.

**Files:**
- Create: `src/application/run-state.ts`, `src/application/scan-coordinator.ts`
- Create: `src/adapters/storage/in-memory-snapshot-store.ts`, `src/application/ports/snapshot-store.ts`
- Modify: `src/host/commands.ts` (wire `scan-codebase` and `cancel-scan`), `src/host/city-view.ts`
- Test: `tests/unit/run-state.test.ts`, `tests/unit/scan-coordinator.test.ts`, `tests/integration/scan-lifecycle.test.ts`

**Interfaces:**
- Consumes: `collectInventory` (task 5), `ApprovedInventoryRun`, `isApprovalValid` (task 7), `computeLayout` (task 4), `validateSnapshot` (task 2), `CityRendererPort.setLayout` (task 2/3).
- Produces:
  - `interface SnapshotStore { get(id): CodebaseSnapshot | null; put(s): void; latestFor(profileId): CodebaseSnapshot | null; ageOf(id): number }` — **in-memory for WP-01**; durable history is WP-05.
  - `class ScanCoordinator { start(approval, scope): Promise<void>; cancel(runId): void; readonly state: InventoryRunState }`
  - `type RunIdentity = { profileId; sourceFingerprint; scopeFingerprint; runId; generation }`
  - `mayPublish(identity: RunIdentity, current: RunIdentity, state: InventoryRunState): boolean`

**Dependencies:** Tasks 1–7.

**`scan-codebase` doubles as refresh.** Its behaviour differs when a snapshot already exists: **the previous snapshot stays visible, a separate running state shows, and publication is an atomic swap after validation.** There is no fourth command.

- [ ] **Step 1: Write the failing run-state test**

`tests/unit/run-state.test.ts`. **These are ported from `docs/concept/design/wp01-review/validation/model.test.cjs`** — the eight highest-value run-lifecycle invariants out of its 31. The rest land in task 9.

```ts
import { describe, expect, it } from 'vitest';
import { mayPublish, reduce } from '../../src/application/run-state';

describe('run lifecycle', () => {
  it('does not replace the snapshot before completion', () => {
    const s = reduce(idle, { type: 'SCAN_STARTED', approval });
    expect(s.publishedSnapshotId).toBe(idle.publishedSnapshotId);
  });

  it('treats a duplicate start during a run as a no-op', () => {
    const s = reduce(running, { type: 'SCAN_STARTED', approval });
    expect(s).toBe(running);
  });

  it('CANCELS TO cancelling FIRST, never claiming work stopped before the collector confirms', () => {
    // cancelling is distinct from cancelled: publication is forbidden IMMEDIATELY, but
    // the UI never claims work stopped until the collector confirms (spec §7).
    const s = reduce(running, { type: 'CANCEL_REQUESTED' });
    expect(s.run.status).toBe('cancelling');
    expect(mayPublish(identityOf(running), identityOf(s), s.run)).toBe(false);
  });

  it('reaches cancelled only on collector confirmation', () => {
    let s = reduce(running, { type: 'CANCEL_REQUESTED' });
    s = reduce(s, { type: 'COLLECTOR_STOPPED', runId: s.run.runId });
    expect(s.run.status).toBe('cancelled');
  });

  it('PUBLISHES NOTHING for a cancelled run and retains the previous snapshot', () => {
    let s = reduce(runningWithPrevious, { type: 'CANCEL_REQUESTED' });
    s = reduce(s, { type: 'COLLECTOR_STOPPED', runId: s.run.runId });
    expect(s.publishedSnapshotId).toBe('previous');
    expect(s.banner).toContain('Scan cancelled. The incomplete result was discarded.');
  });

  it('ignores a late completion after cancel', () => {
    let s = reduce(running, { type: 'CANCEL_REQUESTED' });
    const stale = running.run.runId;
    s = reduce(s, { type: 'SCAN_COMPLETED', runId: stale, snapshotId: 'late' });
    expect(s.publishedSnapshotId).not.toBe('late');
  });

  it('ignores progress after cancel', () => { /* ... */ });

  it('never lets an OLD run overwrite a NEWER run', () => {
    let s = reduce(running, { type: 'CANCEL_REQUESTED' });
    const old = running.run.runId;
    s = reduce(s, { type: 'COLLECTOR_STOPPED', runId: old });
    s = reduce(s, { type: 'SCAN_STARTED', approval });
    s = reduce(s, { type: 'SCAN_COMPLETED', runId: old, snapshotId: 'stale' });
    expect(s.publishedSnapshotId).not.toBe('stale');
  });

  it('leaves the previous snapshot INTACT on failure and labels the failed refresh', () => {
    const s = reduce(runningWithPrevious, { type: 'SCAN_FAILED', runId: running.run.runId, message: 'EACCES' });
    expect(s.publishedSnapshotId).toBe('previous');
    expect(s.run.status).toBe('failed');
  });

  it('preserves inspection context across a completion', () => {
    // selection, query, camera and inspector state survive a republish.
    let s = { ...runningWithPrevious, selectedEntityId: 'e1', query: 'layout' };
    s = reduce(s, { type: 'SCAN_COMPLETED', runId: s.run.runId, snapshotId: 'next' });
    expect(s.selectedEntityId).toBe('e1');
    expect(s.query).toBe('layout');
  });
});

describe('mayPublish — run identity is the FULL TUPLE', () => {
  const base = { profileId: 'p', sourceFingerprint: 'sf', scopeFingerprint: 'kf',
                 runId: 'r1', generation: 3 };

  it('permits publication only when every identity component still matches', () => {
    expect(mayPublish(base, base, { status: 'running', ...base } as any)).toBe(true);
  });

  for (const key of ['profileId', 'sourceFingerprint', 'scopeFingerprint', 'runId', 'generation'] as const) {
    it(`refuses publication when ${key} has changed`, () => {
      const current = { ...base, [key]: key === 'generation' ? 4 : 'other' };
      expect(mayPublish(base, current, { status: 'running', ...current } as any)).toBe(false);
    });
  }

  it('refuses publication in the cancelling state, immediately', () => {
    expect(mayPublish(base, base, { status: 'cancelling', runId: 'r1', generation: 3 })).toBe(false);
  });

  it('refuses publication in the CROSS-PROFILE late-result case', () => {
    // The restored form of the v1.1 late-result scenario: a result arriving for
    // profile A while profile B is active must not publish (spec §6, §7).
    expect(mayPublish(base, { ...base, profileId: 'other-profile' }, { status: 'idle' } as any)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails, then write `src/application/run-state.ts`**

Run: `npx vitest run tests/unit/run-state.test.ts` → FAIL, then implement.

**Run identity is the full tuple** `{profileId, sourceFingerprint, scopeFingerprint, runId, generation}`. **A result may publish only if every identity still matches, cancellation has not invalidated it, and validation succeeds.**

- [ ] **Step 3: Write the failing coordinator test**

`tests/unit/scan-coordinator.test.ts`:

```ts
describe('ScanCoordinator', () => {
  it('VALIDATES APPROVAL BEFORE ANY FILESYSTEM ACCESS', async () => {
    const port = spyPort();
    await expect(coordinator.start(staleApproval, changedScope)).rejects.toThrow(/approval/i);
    expect(port.walk).not.toHaveBeenCalled();
    expect(port.readLog()).toEqual([]);
  });

  it('refuses to start with no approval at all', async () => { /* ... */ });

  it('validates the produced snapshot BEFORE publishing it', async () => {
    coordinator.onProduce = () => corruptSnapshot;
    await coordinator.start(approval, scope);
    expect(store.latestFor('p')).toBeNull();
    expect(coordinator.state.status).toBe('failed');
  });

  it('publishes as an ATOMIC SWAP: the previous snapshot is immutable until then', async () => {
    store.put(previous);
    const seen: string[] = [];
    coordinator.subscribe((s) => seen.push(store.latestFor('p')!.snapshotId));
    await coordinator.start(approval, scope);
    // No intermediate state ever exposes a half-built snapshot.
    expect(new Set(seen)).toEqual(new Set(['previous', 'next']));
  });

  it('reports progress with a COUNT, never a fabricated percentage or ETA', async () => {
    const msgs = await collectProgressMessages();
    expect(msgs[0]).toMatch(/^Reading included files\. \d+ files read so far\.$/);
    expect(msgs.join(' ')).not.toMatch(/%|ETA|remaining/i);
  });

  it('exposes no aria-valuenow for an unknown total', async () => { /* checked in task 9 */ });

  it('rejects a stale callback rather than acting on it', async () => { /* ... */ });

  it('never starts a scan because a view became visible', async () => {
    // pause/resume invariant: visibility NEVER authorises a scan (spec 4.2).
    view.onResume();
    expect(coordinator.state.status).toBe('idle');
  });
});
```

- [ ] **Step 4: Run it, write `src/application/scan-coordinator.ts` to green**

The coordinator is **the only thing that starts a walk**. It:

1. Validates approval against the current resolved root and scope. **Before any filesystem access.**
2. Mints `{runId, generation}` and enters `running`.
3. Drives `collectInventory` with a `CancellationToken`.
4. On completion, validates the snapshot, checks `mayPublish`, then performs the **atomic swap**: `store.put(next)` and a single state transition. The previous snapshot is **immutable until then**.
5. On cancel: enters `cancelling` immediately (publication forbidden), waits for the collector, then `cancelled`. **Publishes nothing** and shows COPY-10.
6. On failure: leaves the previous snapshot intact and labels the failed refresh.
7. Recomputes layout from the published snapshot and hands it to `setLayout` with `{generation, signal}`.

- [ ] **Step 5: Wire `scan-codebase` and `cancel-scan` in `src/host/commands.ts`**

`scan-codebase` **doubles as refresh**: with no snapshot it runs the source→scope modal chain from task 7; with a snapshot it re-approves against the stored scope and starts a refresh, **keeping the previous city visible**. `cancel-scan`'s `checkCallback` returns `false` unless a run is `running`.

- [ ] **Step 6: Write the integration test**

`tests/integration/scan-lifecycle.test.ts` runs the whole chain over a real temporary tree: approve → scan → publish → refresh → cancel → verify retention. Assert that **the retained snapshot still shows its original timestamp** after a cancelled refresh.

- [ ] **Step 7: Run the whole gate, build, install and commit**

```bash
npm run verify && npm run install:vault
git add -A
git commit -m "feat(scan): coordinator, run lifecycle and atomic publication

Run identity is the full tuple {profileId, sourceFingerprint, scopeFingerprint,
runId, generation}; a result publishes only if every component still matches,
cancellation has not invalidated it, and validation succeeds. cancelling forbids
publication immediately while the UI waits for the collector to confirm. A
cancelled run publishes nothing. scan-codebase doubles as refresh."
```

### CHECKPOINT #2 — manual checklist, run in Obsidian

**Setup:** `npm run verify && npm run install:vault`, reload Obsidian. Have a **real external repository** ready — something with a few thousand files, not a fixture.

**Source selection and consent (task 7 re-verified in the running host)**
- [ ] "Select a codebase" opens the source modal with **three** source modes
- [ ] The external mode shows **"Read a local codebase outside this vault."**
- [ ] Choosing a non-existent directory shows a **visible reason** and does not proceed
- [ ] Proceeding opens the scope modal headed **"Review scope and read access"**
- [ ] It shows **"Source text and file metadata are read. No project scripts, dependency installation, or source writes are performed."**
- [ ] The **resolved** root is shown — not the text typed
- [ ] The acknowledgement **starts unchecked**, and reads **"I approve read access to this directory for this scan."**
- [ ] **"Scan codebase" is disabled** until it is checked
- [ ] Editing an exclusion **re-disables Scan** and clears the acknowledgement
- [ ] **"Read-only source access" and "Source remains unchanged" appear nowhere** (task 12 gates them)
- [ ] Cancelling the scope modal leaves **no approval**, and `scan-codebase` still does nothing

**A real external project renders as a real city**
- [ ] Approving and scanning a real repository produces a **city**, not a fixture
- [ ] Progress reads **"Reading included files. N files read so far."** with a rising N
- [ ] **No percentage, no progress bar fill, no ETA** appears at any point
- [ ] The legend names the **actual cap in lines** and a **clamped count**, and neither is 600-by-coincidence
- [ ] Spot-check three files: their inspector line counts match what an editor reports
- [ ] At least one **measured-zero** and one **unavailable** building are visible, and **you can tell them apart without opening the inspector**

**Refresh and cancel**
- [ ] Running `scan-codebase` again with a snapshot present **keeps the previous city visible** while it runs
- [ ] Cancelling mid-refresh shows **"Scan cancelled. The incomplete result was discarded. Your complete snapshot from {time} is unchanged."**
- [ ] The city is **unchanged** after the cancel — same buildings, same camera, same selection
- [ ] **The retained snapshot still shows its ORIGINAL timestamp**, not the cancelled run's
- [ ] The UI never claimed work had stopped before it actually had (watch for a `cancelling` phase)
- [ ] Making the root unavailable (rename the directory) and refreshing **fails without replacing** the snapshot, and offers inspection of the retained one — **it never scans a fallback root**

**The safety claim**
- [ ] `git status` in the scanned repository is **clean** afterwards
- [ ] Console filter `readdir|readFile`: no activity against `.git`, `.env` or the vault config directory

**Stop and raise with the user if:** a scan starts without an explicit approval; a cancelled run publishes anything; the previous snapshot's timestamp changes; a percentage or ETA appears; or the scanned repository shows any modification.

---

## Task 9: Vue UI

**Ends with:** HTML selection drives the canvas through `setSelection`; the canvas-to-HTML direction is task 10's check; every state has a surface.

**The Vue UI precedes renderer hardening so the keyboard and non-WebGL paths are built in, not bolted on.**

**Files:**
- Modify: `src/ui/App.vue`, `src/ui/styles.css` (add the ten `--ci-cat-*` properties if task 3 did not)
- Create: `src/ui/stores/city-store.ts`, `src/ui/stores/run-store.ts`
- Create: `src/ui/interaction/escape-intent.ts`, `src/ui/interaction/keymap.ts`
- Create: `src/ui/components/` — `FileSearch.vue` (C06), `CodebaseFileList.vue` (C07), `CityViewport.vue` (C08), `CameraControls.vue` (C09), `FileInspector.vue` (C10), `MetricLegend.vue` (C11), `SnapshotStatus.vue` (C12), `StatusBanner.vue` (C16), `EmptyState.vue` (C17), `AnnouncementRegion.vue`
- Test: `tests/unit/escape-intent.test.ts`, `tests/unit/city-store.test.ts`, `tests/component/*.test.ts` (one per component), `tests/component/browser-checks.test.ts`

**Interfaces:**
- Consumes: `CityRendererPort` (task 2), `LayoutResult` (task 4), `CodebaseSnapshot`, `CityViewState` (task 2), `InventoryRunState` (task 8).
- Produces:
  - `escapeIntent(ctx): 'close-modal' | 'close-help' | 'clear-query' | 'close-inspector' | 'clear-selection' | null`
  - `useCityStore()` — `snapshot`, `layout`, `selectedEntityId`, `query`, `matchingIds`, `viewMode`, `camera`, `previous3dCamera`, `inspectorOpen`
  - `useRunStore()` — mirrors `InventoryRunState`
  - the ten `--ci-cat-*` custom properties in `styles.css`

**Dependencies:** Tasks 1–8.

**Ported from:** `docs/concept/design/wp01-review/src/interaction-state.js:57-65` (`escapeIntent`) and the **31 interaction-state tests** in `wp01-review/validation/model.test.cjs` — **keeping the invariants rather than copying function names**. The eight run-lifecycle ones landed in task 8; the remaining 23 land here. Also the **browser checks B02–B10, B18–B19, B21 and B23–B26**, replayed in jsdom **against our production controls**, never against the prototype's.

**Three.js hazard that lands here:** the ten `--ci-cat-*` custom properties are the **one plugin-owned palette**, and they are **CSS custom properties, never hex constants in the renderer**. They cross into WebGL through `cssColorToSrgbBytes` (task 3) — **never through `new Color(...)` plus `convertSRGBToLinear()`**.

- [ ] **Step 1: Write the failing Escape-priority test**

`tests/unit/escape-intent.test.ts` — **ported from `wp01-review/validation/model.test.cjs`, six tests**:

```ts
import { describe, expect, it } from 'vitest';
import { escapeIntent } from '../../src/ui/interaction/escape-intent';

describe('escapeIntent — exactly one layer per press', () => {
  it('prioritises a modal over a query', () => {
    expect(escapeIntent({ modal: true, inSearch: true, query: 'x' })).toBe('close-modal');
  });
  it('closes camera interaction or help before a drawer', () => {
    expect(escapeIntent({ help: true, narrowDrawer: true, inInspector: true })).toBe('close-help');
  });
  it('clears only the query when the search field is focused and non-empty', () => {
    expect(escapeIntent({ inSearch: true, query: 'x', selected: true })).toBe('clear-query');
  });
  it('does nothing in an unrelated editable surface', () => {
    expect(escapeIntent({ query: 'x', selected: true })).toBeNull();
  });
  it('is suppressed during IME composition', () => {
    expect(escapeIntent({ inSearch: true, query: 'x', composing: true })).toBeNull();
  });
  it('clears the selection, not the query, when the canvas has focus', () => {
    expect(escapeIntent({ inCanvas: true, selected: true, query: 'x' })).toBe('clear-selection');
  });
  it('closes only the drawer for a narrow inspector', () => {
    expect(escapeIntent({ inInspector: true, narrowDrawer: true, selected: true })).toBe('close-inspector');
  });
  it('does not fire on an empty query in the search field', () => {
    expect(escapeIntent({ inSearch: true, query: '' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails, then write `src/ui/interaction/escape-intent.ts`**

Run: `npx vitest run tests/unit/escape-intent.test.ts` → FAIL, then port:

```ts
export interface EscapeContext {
  modal?: boolean; help?: boolean; inSearch?: boolean; query?: string;
  inInspector?: boolean; narrowDrawer?: boolean; inCanvas?: boolean;
  selected?: boolean; composing?: boolean;
}

/** Escape resolves EXACTLY ONE LAYER per press (spec 5.2):
 *  modal -> camera interaction/help -> nonmodal drawer -> query -> selection.
 *  It must not disturb IME composition or a Markdown editor. */
export function escapeIntent(ctx: EscapeContext): EscapeIntent | null {
  if (ctx.composing) return null;
  if (ctx.modal) return 'close-modal';
  if (ctx.help) return 'close-help';
  if (ctx.inSearch && ctx.query) return 'clear-query';
  if (ctx.inInspector && ctx.narrowDrawer) return 'close-inspector';
  if (ctx.inCanvas && ctx.selected) return 'clear-selection';
  return null;
}
```

- [ ] **Step 3: Write the failing city-store test — the remaining ported invariants**

`tests/unit/city-store.test.ts` — the other 17 of the 31:

```ts
describe('selection', () => {
  it('does not move the camera', () => { /* camera deep-equals before */ });
  it('preserves the query', () => { /* ... */ });
  it('does not change the search', () => { /* ... */ });
  it('does not rebuild layout', () => { /* layout is reference-identical */ });
  it('opens the inspector', () => { /* ... */ });
  it('cannot open the inspector without a selection', () => { /* ... */ });
  it('survives closing the inspector', () => { /* closing preserves selection */ });
  it('is cleared only explicitly', () => { /* ... */ });
  it('is a no-op on empty-space click', () => { /* ... */ });
  it('is NOT changed by moving keyboard focus in the list', () => { /* ... */ });
});

describe('search', () => {
  it('is case-insensitive substring over included file paths', () => { /* ... */ });
  it('preserves non-ASCII characters', () => { /* 'ÜBER' matches 'tests/überblick.ts' */ });
  it('matches everything on an empty or whitespace-only query', () => { /* ... */ });
  it('DIMS non-matches in place — never hides, relocates or relayouts', () => {
    const before = store.layout;
    store.setQuery('nothing-matches');
    expect(store.layout).toBe(before);              // reference-identical
    expect(store.matchingIds!.size).toBe(0);        // empty set, not null
  });
  it('distinguishes an empty result set from an unfiltered one', () => {
    // setFilter(null) = unfiltered; setFilter(empty set) = no matches.
    store.setQuery('');
    expect(store.matchingIds).toBeNull();
  });
  it('keeps a filter-hidden selection SELECTED and explains it', () => {
    store.select('e1'); store.setQuery('no-match');
    expect(store.selectedEntityId).toBe('e1');
    expect(store.banner).toContain('The selected file is outside these filters.');
  });
  it('selects the first match on Enter in deterministic order WITHOUT moving the camera', () => { /* ... */ });
  it('is a no-op on Enter with no matches', () => { /* ... */ });
});

describe('camera and view mode', () => {
  it('restores the EXACT 3D camera on a top-view round trip', () => {
    store.setCamera(bookmark3d);
    store.setViewMode('top');
    store.nudgeInTopView();
    store.setViewMode('3d');
    expect(store.camera).toEqual(bookmark3d);    // top-view operations never mutate it
  });
  it('retains selection and query across Fit', () => { /* ... */ });
  it('retains selection when switching to the HTML list', () => { /* ... */ });
  it('returns to the previous top mode from the HTML list', () => { /* ... */ });
});

describe('immutability', () => {
  it('leaves inputs unmutated across every transition', () => { /* JSON.stringify before/after */ });
  it('preserves state identity for an unknown action', () => { /* ... */ });
});
```

- [ ] **Step 4: Run it, implement the two stores to green**

Run: `npx vitest run tests/unit/city-store.test.ts` → FAIL, then implement. **Each view calls `createPinia()` itself** (task 3), so two leaves have independent stores.

- [ ] **Step 5: Write the failing component tests**

One file per component. These replay the design's browser checks **B02–B10, B18–B19, B21 and B23–B26 against our production controls**. Highlights:

```ts
// FileSearch.vue (C06)
it('uses the placeholder "Search files or paths…"', () => { /* ... */ });
it('debounces ~150 ms but shows the typed text immediately', async () => { /* ... */ });
it('clears only a non-empty query on Escape and KEEPS FOCUS in the field', async () => { /* ... */ });
it('is reachable with "/" only when this view owns focus and the target is not editable', async () => { /* ... */ });
it('ignores "/" during IME composition and with Ctrl/Meta/Alt held', async () => { /* ... */ });

// CodebaseFileList.vue (C07)
it('renders rows as NATIVE BUTTONS', () => { expect(row.tagName).toBe('BUTTON'); });
it('puts no role=tree on an incomplete implementation', () => {
  expect(el.querySelector('[role="tree"]')).toBeNull();
});
it('drives the canvas through setSelection when a row is activated', async () => {
  await click(row);
  expect(rendererDouble.setSelection).toHaveBeenCalledWith('repo file src/a.ts');
});
it('does not select on mere focus movement', async () => { /* ... */ });
it('shows COPY-11 when nothing matches', () => {
  expect(el.textContent).toContain('No matching files. The snapshot still contains');
});

// CityViewport.vue (C08)
it('OWNS SIZING: it installs the ResizeObserver, not the renderer', async () => {
  expect(rendererDouble.resize).toHaveBeenCalledWith(800, 600, expect.any(Number));
});
it('clamps the pixel ratio to 2 on EVERY resize', async () => { /* ... */ });
it('no-ops resize on a zero-size box', async () => { /* ... */ });
it('never calls fit() as a side effect of resize', async () => { /* ... */ });
it('is ONE named focusable region with a help description, not thousands of buttons', () => {
  expect(mount.tabIndex).toBe(0);
  expect(mount.getAttribute('aria-label')).toBeTruthy();
  expect(mount.querySelectorAll('[tabindex="0"]').length).toBe(1);
});
it('marks the canvas aria-hidden and never tabbable', () => { /* ... */ });
it('reads matchMedia from containerEl.win, never a bare window', () => { /* ... */ });
it('passes setMotion("reduced") when prefers-reduced-motion matches', async () => { /* ... */ });
it('renders COPY-14 when the renderer reports unavailable', async () => {
  onEvent({ type: 'unavailable', reason: 'unsupported' });
  expect(el.textContent).toContain('The 3D view is unavailable. File inspection still works.');
});
it('creates NO renderer below the 320 CSS px hard floor', () => { /* ... */ });

// CameraControls.vue (C09) — WCAG 2.5.7
it('offers a SINGLE-POINTER route for every dragging gesture', () => {
  // Minimum set: zoom in, zoom out, rotate left, rotate right, pan up/down/left/right,
  // Fit, Top, Focus. A keyboard-only alternative is explicitly NOT sufficient, and
  // neither is one rotate button with arrows for the rest (spec 5.2).
  for (const label of ['Zoom in', 'Zoom out', 'Rotate left', 'Rotate right',
                       'Pan up', 'Pan down', 'Pan left', 'Pan right', 'Fit', 'Top', 'Focus']) {
    expect(byLabel(label), label).not.toBeNull();
  }
});
it('drives nudgeCamera with the spec step increments', async () => {
  await click(byLabel('Rotate left'));
  expect(renderer.nudgeCamera).toHaveBeenCalledWith({ orbit: [-Math.PI / 8, 0] });
  await click(byLabel('Zoom in'));
  expect(renderer.nudgeCamera).toHaveBeenCalledWith({ zoomFactor: 1.2 });
  await click(byLabel('Pan left'));
  expect(renderer.nudgeCamera).toHaveBeenCalledWith({ pan: [-30, 0] });
});
it('uses the KEYBOARD increments for key presses', async () => {
  await key(mount, 'ArrowLeft');
  expect(renderer.nudgeCamera).toHaveBeenCalledWith({ orbit: [-0.12, 0] });
  await key(mount, '+');
  expect(renderer.nudgeCamera).toHaveBeenCalledWith({ zoomFactor: 1.15 });
});
it('honours F, T, +/-, arrows, Shift-arrows and Enter ONLY when the canvas has focus', async () => { /* ... */ });
it('ignores Ctrl/Meta/Alt combinations and composing input', async () => { /* ... */ });
it('registers no host-wide default bindings', () => { /* commands exist; hotkeys do not */ });

// FileInspector.vue (C10)
it('shows the RAW values, always', () => { /* raw lines and bytes, not scaled height */ });
it('surfaces the REASON for an unavailable measurement', () => { /* ... */ });
it('offers Focus and Copy relative path, and NOTHING that opens the source', () => {
  // C10 declares sourceOpenRequested; S07's binding table lists only these two, and
  // external process execution is an unresolved policy question (spec §1).
  expect(byLabel('Copy relative path')).not.toBeNull();
  expect(byLabel('Focus')).not.toBeNull();
  expect(el.textContent).not.toMatch(/open in|reveal in|editor/i);
});
it('shows COPY-27 after a successful copy', async () => {
  expect(live.textContent).toContain('Relative path copied.');
});
it('offers a USABLE ALTERNATIVE when the clipboard fails', async () => {
  clipboardDouble.writeText.mockRejectedValue(new Error('denied'));
  await click(byLabel('Copy relative path'));
  expect(el.querySelector('input[readonly]')!.value).toBe('src/a.ts');   // selectable text
});
it('closing it PRESERVES the selection', async () => { /* ... */ });

// MetricLegend.vue (C11)
it('names the scale "physical lines · square-root scale"', () => { /* ... */ });
it('names the ACTUAL cap in lines and the clamped count', () => { /* ... */ });
it('enumerates every member of the closed category vocabulary', () => {
  expect(swatches).toHaveLength(10);
});

// SnapshotStatus.vue (C12)
it('marks a retained snapshot with its AGE', () => { /* ... */ });
it('never silently authorises a new scan on reopen', () => { /* ... */ });

// StatusBanner.vue (C16) + EmptyState.vue (C17) — every view-level state has a surface
it.each([
  ['no source selected',        'Understand your codebase. Start with its structure.'],
  ['invalid directory',         /directory/i],
  ['read not approved',         /Review scope and read access/],
  ['scanning, unknown total',   /Reading included files\. \d+ files read so far\./],
  ['scanning, known total',     /\d+ of \d+/],
  ['cancelled',                 'Scan cancelled. The incomplete result was discarded.'],
  ['empty included scope',      'No files are included in this scope. Review the selected directory and exclusions.'],
  ['no search matches',         'No matching files. The snapshot still contains'],
  ['partial read evidence',     'Some files could not be read. Measurements cover'],
  ['root moved or unavailable', 'The saved source directory is unavailable on this machine. The stored snapshot can still be inspected.'],
  ['3D unavailable',            'The 3D view is unavailable. File inspection still works.'],
  ['WebGL context lost',        /rebuild|reconstruct/i],
])('gives %s a surface', (state, copy) => { /* ... */ });

it('never restarts a scan on WebGL context loss', () => { /* ... */ });

// AnnouncementRegion.vue
it('is POLITE for stage transitions, completion, cancellation and control-initiated selection', () => { /* ... */ });
it('is ASSERTIVE only for a blocking failure', () => { /* ... */ });
it('announces NOTHING on hover', () => { /* ... */ });
it('throttles a rapidly changing counter', async () => { /* ... */ });
it('exposes no aria-valuenow when the total is unknown', () => { /* ... */ });
```

- [ ] **Step 6: Run them, implement the components to green**

Responsive rules, measured **on the leaf, never the window, via container queries**:

```css
/* One collapse threshold at 820 CSS px. Provisional and contested — re-check it at
   checkpoint #3 against a normal leaf, a sidebar leaf and a pop-out (spec 5.2). */
@container (min-width: 820px) { /* list + canvas + inspector */ }
@container (max-width: 819px) { /* canvas with Files and Inspector drawers,
                                  ONE OVERLAY AT A TIME, each with a visible close
                                  that returns focus to its opener */ }
```

Below the **320 CSS px** hard floor the view renders list-first and **creates no WebGL context at all**. **Switching to the HTML inventory preserves query, selection and camera bookmark.**

- [ ] **Step 7: Run the whole gate and commit**

```bash
npm run verify
git add -A
git commit -m "feat(ui): app shell, list, search, inspector, camera controls and state surfaces

Escape resolves exactly one layer per press, ported from the v1.1 interaction
reference. Search DIMS non-matches in place and never relayouts; a filter-hidden
selection stays selected and is explained. Every camera drag gesture has a
single-pointer route (WCAG 2.5.7): zoom, rotate both ways, pan four ways, Fit,
Top and Focus. The canvas is one named region, not thousands of tabbable
buildings. Every view-level state has a surface."
```

**Acceptance criteria, restated concretely:**

1. **HTML selection drives the canvas through `setSelection`** — activating a list row calls the port with the right `EntityId`. (The canvas-to-HTML direction is task 10's check.)
2. **Every view-level state has a surface** — all twelve states in the parameterised test render their COPY string.
3. Escape resolves **exactly one layer per press**, in the specified order, and is suppressed during IME composition.
4. Search **dims in place**: `layout` is reference-identical before and after a query, and `matchingIds` distinguishes *empty* from *unfiltered*.
5. **WCAG 2.5.7**: eleven single-pointer controls exist — zoom in/out, rotate left/right, pan in four directions, Fit, Top, Focus — each driving `nudgeCamera` with the spec's increments (button zoom ×1.2, rotate π/8, pan 30 px) and keys using the keyboard increments (orbit 0.12 rad, zoom ×1.15).
6. `F`, `T`, `+`/`-`, arrows, Shift-arrows and Enter work **only when the canvas itself has focus**; `/` only when this view owns focus and the target is not editable; Ctrl/Meta/Alt and composing input are ignored. **No host-wide default bindings are registered.**
7. The canvas is **one named focusable region** with a help description; the WebGL canvas is `aria-hidden` and never tabbable; **no `role=tree`**.
8. The view **owns sizing** — it installs the `ResizeObserver`, clamps the pixel ratio to 2 on every call, no-ops on a zero-size box, and never triggers `fit()`.
9. The inspector offers **Focus and Copy relative path only** — nothing that opens source — shows raw values and the unavailable reason, and has a usable alternative when the clipboard fails.
10. Announcements are **polite** except for blocking failures, **silent on hover**, throttled, and expose **no `aria-valuenow`** for an unknown total.
11. The ten `--ci-cat-*` properties exist in `styles.css`, and **no hex colour constant appears in `src/visualization/`**.

---

## Task 10: Renderer hardening

**Ends with:** Correct file selected; rendering on demand only.

**Files:**
- Modify: `src/visualization/city-renderer.ts` (full implementation), `src/host/theme-bridge.ts`
- Create: `src/visualization/render-scheduler.ts`, `src/visualization/disposal.ts`, `src/visualization/instanced-city.ts`, `src/visualization/picking.ts`, `src/visualization/camera-rig.ts`, `src/visualization/label-overlay.ts`
- Test: `tests/unit/render-scheduler.test.ts`, `tests/unit/camera-rig.test.ts`, `tests/component/picking.test.ts`, `tests/component/renderer-contract.test.ts`

**Interfaces:**
- Consumes: `LayoutResult` (task 4), `CityPalette`, `CityRendererPort`, `CityRendererEvent`, `CameraBookmark` (task 2), `cssColorToSrgbBytes` (task 3).
- Produces: the full `createCityRenderer: CreateCityRenderer`, replacing task 3's minimal one. **The interface does not change** — it was frozen in task 2.

**Dependencies:** Tasks 1–9.

**Ported from:** `docs/concept/prototype/src/viewer.js:203` (the `invalidate()` on-demand scheduler) and `viewer.js:81-88, 214` (the disposal discipline). **Keep the shape, not the code** — and note the prototype's `invalidate()` also guards on `contextLost`, `suspended`, an in-flight frame and `document.hidden`, all of which we want. **Do not port its self-healing `webglcontextrestored` handler** (line 78): §4.2 forbids a restore partner, and the prototype's own recorded run logged **33 `WebGL: INVALID_OPERATION: delete: object does not belong to this context` warnings** in exactly that path.

### Three.js 0.186.0 hazards concentrated in this task

This is the lighting and colour task. **Every one of these is silent.**

1. **`ColorManagement.enabled` defaults to `true` (r152).** `new Color(hex)` already converts sRGB→working. **Never call `convertSRGBToLinear()`** — lint enforces it, but the reason is that no test catches a uniformly darker render. **The Three.js prototype does this about twenty times** because r140 shipped it disabled.
2. **Light intensities must be multiplied by π (r155/r165).** `useLegacyLights` and `physicallyCorrectLights` are gone. **Any value lifted from the r140 prototype is wrong by that factor.** Write every intensity literally as `<value> * Math.PI` with a comment.
3. **Use `ColorManagement.workingToColorSpace()` / `colorSpaceToWorking()` (r177)** — the old names still exist but `warnOnce`, and this path is exactly the host-CSS-colour conversion.
4. **Use `Timer`, not `Clock` (r183 deprecated `Clock`; `Timer` is core since r179).**
5. **`Object3D` gained `dispose()` (r186)** — any subclass overriding `dispose()` **must call `super.dispose()`**.
6. **r181 changed PBR energy conservation and indirect specular** — rough materials render brighter than before. If a reference screenshot looks wrong, it may be the screenshot that is stale (§11).

- [ ] **Step 1: Write the failing on-demand scheduler test**

`tests/unit/render-scheduler.test.ts`:

```ts
describe('render scheduler', () => {
  it('draws nothing while idle', async () => {
    const s = createScheduler(winDouble, drawSpy);
    await tick(10);
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it('coalesces many invalidations into ONE frame', async () => {
    const s = createScheduler(winDouble, drawSpy);
    for (let i = 0; i < 50; i++) s.invalidate();
    await nextFrame();
    expect(drawSpy).toHaveBeenCalledTimes(1);
  });

  it('draws nothing while paused', async () => { /* suspend -> invalidate -> no draw */ });
  it('draws nothing while the context is lost', async () => { /* ... */ });
  it('draws nothing while the owning document is hidden', async () => { /* ... */ });
  it('draws nothing after dispose', async () => { /* ... */ });

  it('uses the INJECTED window\'s requestAnimationFrame, never a bare one', () => {
    createScheduler(winDouble, drawSpy).invalidate();
    expect(winDouble.requestAnimationFrame).toHaveBeenCalled();
  });

  it('cancels its pending frame on dispose, leaving no orphan rAF handle', () => {
    const s = createScheduler(winDouble, drawSpy);
    s.invalidate(); s.dispose();
    expect(winDouble.cancelAnimationFrame).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, write `src/visualization/render-scheduler.ts` to green**

Ported from `viewer.js:203`, guards intact:

```ts
export function createScheduler(win: Window, draw: () => void) {
  let frame: number | null = null;
  let disposed = false, suspended = false, contextLost = false;
  const invalidate = (): void => {
    // Rendering is ON DEMAND ONLY. No sustained animation while idle or hidden (G5).
    if (disposed || contextLost || suspended || frame !== null || win.document.hidden) return;
    frame = win.requestAnimationFrame(() => { frame = null; draw(); });
  };
  const dispose = (): void => {
    disposed = true;
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
  };
  return { invalidate, dispose, /* setSuspended, setContextLost */ };
}
```

- [ ] **Step 3: Write the failing picking test**

`tests/component/picking.test.ts`:

```ts
describe('picking', () => {
  it('selects the CORRECT file via the batch-and-instance to entity map', async () => {
    // The instanceId -> EntityId map is the whole point: an off-by-one here selects a
    // neighbouring building, which looks plausible and is wrong.
    const picked = await clickAt(canvas, lotScreenPosition('src/domain/layout.ts'));
    expect(events).toContainEqual({ type: 'entity-picked',
      entityId: 'repo file src/domain/layout.ts', snapshotId: 's1' });
  });

  it('raycasts ONLY against file lots', async () => {
    // Never labels, ground planes, district borders or overlays (spec 5.2).
    await clickAt(canvas, districtGroundPosition());
    expect(events.filter((e) => e.type === 'entity-picked')).toHaveLength(0);
  });

  it('is a no-op on empty space', async () => { /* ... */ });

  it('does not select on release after a drag beyond 5 CSS PIXELS', async () => {
    await pointerDown(canvas, { x: 100, y: 100 });
    await pointerMove(canvas, { x: 107, y: 100 });   // 7 CSS px, not device px
    await pointerUp(canvas, { x: 107, y: 100 });
    expect(events.filter((e) => e.type === 'entity-picked')).toHaveLength(0);
  });

  it('DOES select on release within 5 CSS pixels', async () => { /* 3 px -> picked */ });

  it('measures the drag threshold in CSS pixels, not device pixels', async () => {
    winDouble.devicePixelRatio = 2;
    await dragBy(canvas, 4);                // 4 CSS px = 8 device px
    expect(events.filter((e) => e.type === 'entity-picked')).toHaveLength(1);
  });

  it('emits hover-changed only AFTER the 200 ms dwell', async () => {
    await pointerMove(canvas, overLot);
    await advance(199);
    expect(hoverEvents).toHaveLength(0);
    await advance(2);
    expect(hoverEvents[0]).toMatchObject({ type: 'hover-changed', entityId: expect.any(String),
      position: { x: expect.any(Number), y: expect.any(Number) } });
  });

  it('RAYCASTS ONLY WHEN THE DWELL FIRES, never on every pointermove', async () => {
    for (let i = 0; i < 40; i++) await pointerMove(canvas, { x: 100 + i, y: 100 });
    expect(raycastSpy).not.toHaveBeenCalled();
  });

  it('emits a null entityId IMMEDIATELY on leave', async () => {
    await pointerLeave(canvas);
    expect(hoverEvents.at(-1)).toMatchObject({ entityId: null, position: null });
  });

  it('anchors the hover position canvas-relative, for tooltip placement', async () => { /* ... */ });

  it('lets NO key event cross the port', () => {
    expect(typeof (port as any).onKeyDown).toBe('undefined');
  });

  it('does not select on click while the view is paused', async () => { /* ... */ });
});
```

- [ ] **Step 4: Run it, write `instanced-city.ts` and `picking.ts` to green**

`instanced-city.ts` builds the `InstancedMesh` set and — critically — the **batch-and-instance to entity map**, so `instanceId` resolves to the right `EntityId` even across several meshes (separate meshes for `measured`/`measured-zero` and for the `unavailable` marker silhouette).

Colour handling, stated once and enforced by lint:

```ts
// The palette arrives as RESOLVED sRGB STRINGS from the host (CityPalette). Feed them
// to new Color(), which since r152 already converts sRGB -> working, because
// ColorManagement.enabled defaults to true. DO NOT call convertSRGBToLinear() — it is
// silent, and it renders everything 2-3x darker.
mesh.setColorAt(i, new Color(palette.categories[lot.colorKey]));
```

`picking.ts` owns the **200 ms hover dwell timer** and the **5 CSS pixel drag threshold**, and raycasts **only when the dwell fires**.

- [ ] **Step 5: Write the failing camera-rig test**

`tests/unit/camera-rig.test.ts`:

```ts
describe('camera rig', () => {
  it('is ORTHOGRAPHIC in both 3D and top view, with an oblique 3D default', () => { /* ... */ });

  it('persists ABSOLUTE position/target/up, deriving spherical angles internally', () => {
    const b = rig.getCamera();
    expect(b).toMatchObject({ projection: 'orthographic', mode: '3d',
      position: expect.any(Array), target: expect.any(Array), up: expect.any(Array),
      zoom: expect.any(Number) });
    expect(b).not.toHaveProperty('theta');
    expect(b).not.toHaveProperty('radius');
  });

  it('round-trips a bookmark through dispose and RECONSTRUCT', () => {
    // Spec §11 open: "Whether a renderer reconstructed from a CameraBookmark and a
    // LayoutResult lands where it left off." Both prototypes agree on
    // dispose-and-reconstruct and NEITHER demonstrates it. This test is the answer.
    const b = rig.getCamera();
    const rebuilt = makeRig(sameLayout);
    rebuilt.setCamera(b);
    expect(rebuilt.getCamera()).toEqual(b);
  });

  it('round-trips a bookmark against a DIFFERENT layout extent', () => {
    // The reason absolute coordinates are the persisted form: the prototype recomputes
    // radius from layout extent, so a restored bookmark would only be exact if the
    // layout were byte-identical.
    const b = rig.getCamera();
    const rebuilt = makeRig(largerLayout);
    rebuilt.setCamera(b);
    expect(rebuilt.getCamera()).toEqual(b);
  });

  it('lets the BOOKMARK WIN when its mode differs from the current mode', () => {
    rig.setCameraMode('3d');
    rig.setCamera({ ...bookmark, mode: 'top' });
    expect(rig.getCamera().mode).toBe('top');
  });

  it('restores the saved 3D bookmark IN FULL on top -> 3D', () => { /* ... */ });
  it('never mutates the saved 3D bookmark from a top-view operation', () => { /* ... */ });

  it('applies the spec step increments', () => {
    rig.nudge({ orbit: [0.12, 0] });  rig.nudge({ pan: [30, 0] });  rig.nudge({ zoomFactor: 1.15 });
  });

  it('has NO INERTIAL DRIFT: it settles on the frame after the last input', async () => {
    await pointerUp(canvas);
    await nextFrame(); drawSpy.mockClear();
    await tick(500);
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it('JUMPS instead of tweening under setMotion("reduced")', async () => { /* ... */ });
  it('tweens under setMotion("standard")', async () => { /* ... */ });

  it('emits camera-changed as an EVENT, separate from the setCamera COMMAND', () => {
    // So host synchronisation does not loop (spec 4.2).
    rig.setCamera(bookmark);
    expect(events.filter((e) => e.type === 'camera-changed')).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Run it, write `camera-rig.ts` to green**

- [ ] **Step 7: Write the failing renderer-contract test**

`tests/component/renderer-contract.test.ts` — **the port never throws**:

```ts
describe('the port never throws', () => {
  it('reports WebGL2 unavailability through onEvent, not by throwing', () => {
    winDouble.HTMLCanvasElement.prototype.getContext = () => null;
    expect(() => createCityRenderer(mount, winDouble, onEvent)).not.toThrow();
    expect(events).toContainEqual({ type: 'unavailable', reason: 'unsupported' });
  });

  it('reports context-creation failure through onEvent', () => { /* ... */ });
  it('reports initialization failure through onEvent', () => { /* ... */ });
  it('returns a usable port even when unavailable, so the view always has a surface', () => { /* ... */ });

  it('RESOLVES an aborted setLayout without applying, and never rejects', async () => {
    const c = new AbortController();
    const p = port.setLayout(layout, { generation: 1, signal: c.signal });
    c.abort();
    await expect(p).resolves.toBeUndefined();
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it('RESOLVES a superseded setLayout without applying', async () => {
    const a = port.setLayout(layoutA, { generation: 1, signal: s1 });
    const b = port.setLayout(layoutB, { generation: 2, signal: s2 });
    await Promise.all([a, b]);
    expect(port.getDiagnostics().instanceCount).toBe(layoutB.lots.length);
  });

  it('accepts a LayoutResult and has NO method taking a CodebaseSnapshot', () => {
    expect((port as any).loadSnapshot).toBeUndefined();
  });

  it('re-applies setPixelRatio on EVERY resize, clamped to 2', () => {
    port.resize(800, 600, 3);
    expect(setPixelRatioSpy).toHaveBeenLastCalledWith(2);
    port.resize(800, 600, 1.5);
    expect(setPixelRatioSpy).toHaveBeenLastCalledWith(1.5);
  });

  it('no-ops resize on a zero-size box, so hidden leaves cost nothing', () => { /* ... */ });
  it('never fits as a side effect of resize', () => { /* ... */ });

  it('installs NO ResizeObserver of its own', () => {
    expect(winDouble.ResizeObserver).not.toHaveBeenCalled();
  });

  it('distinguishes setFilter(null) from setFilter(empty set)', () => {
    port.setFilter(null);            // unfiltered
    port.setFilter(new Set());       // no matches — everything dimmed
  });

  it('re-supplies EVERY colour the scene draws on setColors', () => { /* ... */ });
  it('does not move buildings, change camera or clear state on setColors', () => { /* ... */ });

  it('reports context loss as unavailable{context-lost} and offers NO restore partner', () => {
    port.debugLoseContext();
    expect(events).toContainEqual({ type: 'unavailable', reason: 'context-lost' });
    expect((port as any).restore).toBeUndefined();
    expect((port as any).onContextRestored).toBeUndefined();
  });

  it('re-renders on demand only: nothing draws after the scene settles', async () => { /* ... */ });

  it('switches camera mode with setCameraMode and never receives it in list mode', () => { /* ... */ });
});

describe('disposal', () => {
  it('disposes every geometry, material, texture and render target', () => {
    const before = port.getDiagnostics();
    port.dispose();
    expect(renderer.info.memory.geometries).toBe(0);
    expect(renderer.info.memory.textures).toBe(0);
  });

  it('calls renderer.dispose() AND forceContextLoss()', () => {
    port.dispose();
    expect(disposeSpy).toHaveBeenCalled();
    expect(forceContextLossSpy).toHaveBeenCalled();
  });

  it('cancels the pending animation frame and every listener', () => { /* ... */ });
  it('removes every DOM node it appended, including the label overlay', () => { /* ... */ });
  it('is idempotent', () => { port.dispose(); expect(() => port.dispose()).not.toThrow(); });

  it('calls super.dispose() in any Object3D subclass that overrides dispose', () => {
    // r186 gave Object3D a dispose(). A subclass that overrides it without calling
    // super leaks whatever the base class now releases.
  });

  it('leaks nothing across ten construct-and-dispose cycles', () => {
    for (let i = 0; i < 10; i++) { const p = createCityRenderer(mount, winDouble, noop); p.dispose(); }
    expect(renderer.info.memory.geometries).toBe(0);
  });
});
```

- [ ] **Step 8: Run it, complete `city-renderer.ts`, `disposal.ts` and `label-overlay.ts` to green**

`disposal.ts` is ported from `viewer.js:81-88, 214`: traverse the scene, dispose every geometry and material (and every texture on every material), dispose shadow maps, then `renderer.dispose()` **plus** `forceContextLoss()`, cancel the pending frame, release every listener, and clear the label overlay.

`label-overlay.ts` builds **DOM elements in a sibling overlay created through the injected `win.document`**, repositioned on render — which keeps them **text-scalable for the 200% zoom check** and **cross-window correct**. `setLabels(visible)` toggles it.

Lighting, written once:

```ts
// r155/r165 removed useLegacyLights and physicallyCorrectLights. Intensities are
// physically correct now, so any value authored before r155 must be multiplied by PI.
// Values lifted from the r140 prototype are wrong by exactly that factor.
// CityPalette has no ambient member — it is the seven fields of spec 4.2 and nothing
// more. Ambient light is neutral white; category colour comes from setColorAt.
scene.add(new AmbientLight(0xffffff, 0.55 * Math.PI));
const sun = new DirectionalLight(0xffffff, 1.1 * Math.PI);
```

- [ ] **Step 9: Run the whole gate, build, install and commit**

```bash
npm run verify && npm run install:vault
git add -A
git commit -m "feat(renderer): instancing, picking, camera, hover, labels, context loss

Rendering is on demand only: one coalesced frame per invalidation, nothing while
paused, hidden or disposed. Picking resolves through the batch-and-instance to
entity map and raycasts only file lots, only after the 200 ms dwell, with a 5 CSS
pixel drag threshold. The camera bookmark persists absolute position/target/up so
dispose-and-reconstruct round-trips against a different layout extent. There is
no restore partner: context loss is reported and the view reconstructs.

Three.js 0.186.0: colours go through new Color() with no convertSRGBToLinear
(ColorManagement.enabled defaults true since r152); every light intensity is
multiplied by PI (r155/r165)."
```

**Acceptance criteria, restated concretely:**

1. **Correct file selected** — picking resolves the batch-and-instance map to the right `EntityId`, raycasts **only file lots**, is a no-op on empty space, and does not select after a drag beyond **5 CSS pixels** (measured in CSS px at `devicePixelRatio` 2).
2. **Rendering on demand only** — nothing draws while idle, paused, context-lost, document-hidden or disposed; 50 invalidations coalesce into one frame; no inertial drift.
3. Hover fires **only after the 200 ms dwell**, raycasts **only then**, carries a canvas-relative `position`, and emits `null` immediately on leave.
4. **The port never throws** — unavailability and failure are `onEvent`; an aborted or superseded `setLayout` **resolves** without applying.
5. `getCamera()`/`setCamera()` round-trip **across dispose-and-reconstruct**, including against a **different layout extent**; a bookmark whose mode differs **wins**.
6. `resize` re-applies `setPixelRatio` **every call**, clamped to 2, no-ops at zero size, and **never fits**. The renderer installs **no `ResizeObserver`**.
7. Context loss reports `unavailable{context-lost}` and **ships no restore partner**.
8. Disposal leaves `renderer.info.memory.geometries` and `.textures` at 0 across **ten** construct-and-dispose cycles, calls `dispose()` **and** `forceContextLoss()`, and is idempotent.
9. **No `convertSRGBToLinear`/`convertLinearToSRGB` anywhere** (lint), and every light intensity is written as `<value> * Math.PI`.
10. No bare `window`, `document`, `requestAnimationFrame`, `setInterval`, `ResizeObserver`, `IntersectionObserver` or DOM `instanceof` appears in `src/visualization/`.

---

## Task 11: Lifecycle — CHECKPOINT #3

**Ends with:** No leaks, no wrong-window DOM; a removed selected file is reported, never replaced by index.

**Files:**
- Modify: `src/host/city-view.ts`, `src/main.ts`
- Create: `src/host/leaf-registry.ts`, `src/host/window-migration.ts`, `src/application/snapshot-reconciliation.ts`
- Test: `tests/host/multi-leaf.test.ts`, `tests/host/window-migration.test.ts`, `tests/unit/snapshot-reconciliation.test.ts`, `tests/host/lifecycle-leaks.test.ts`

**Interfaces:**
- Consumes: everything from tasks 3, 8, 9, 10.
- Produces:
  - `reconcileSelection(previous: CityViewState, next: CodebaseSnapshot): { state: CityViewState; notice: string | null }`
  - `forEachCityView(app, fn: (view: CityView) => void): void` (deferred-view-safe)

**Dependencies:** Tasks 1–10.

- [ ] **Step 1: Write the failing multi-leaf test**

`tests/host/multi-leaf.test.ts`:

```ts
describe('multiple leaves', () => {
  it('keeps selection independent between two city leaves', async () => { /* ... */ });
  it('keeps query, camera and inspector state independent', async () => { /* ... */ });
  it('gives each leaf its own Pinia instance', async () => { /* ... */ });
  it('gives each leaf its own renderer and its own WebGL context', async () => { /* ... */ });

  it('reaches views through getLeavesOfType plus an instanceof check, never a cast', () => {
    // Since 1.7.2 every view is created as a DeferredView. A cast is a defect.
    const views = forEachCityViewCollect(app);
    expect(views.every((v) => v instanceof CityView)).toBe(true);
  });

  it('reveals a leaf before acting on it', async () => {
    await openCity(plugin);
    expect(workspace.revealLeaf).toHaveBeenCalled();
  });

  it('never holds a view reference across factory invocations', () => {
    // The factory may run more than once (spec 4.4).
    expect(Object.values(plugin)).not.toContainEqual(expect.any(CityView));
  });

  it('constructs NO view for a background tab, so no WebGL context exists for it', async () => { /* ... */ });
});
```

- [ ] **Step 2: Run it, write `src/host/leaf-registry.ts` to green**

```ts
/** Deferred-view-safe enumeration. Since 1.7.2 every view is created as a DeferredView,
 *  so `leaf.view` may be a placeholder. instanceof, never a cast. */
export function forEachCityView(app: App, fn: (view: CityView) => void): void {
  for (const leaf of app.workspace.getLeavesOfType(CITY_VIEW_TYPE)) {
    const view = leaf.view;
    if (view instanceof CityView) fn(view);
  }
}
```

- [ ] **Step 3: Write the failing reconciliation test**

`tests/unit/snapshot-reconciliation.test.ts`. **A removed selected file is reported, never replaced by index** — this is the single most likely silent-wrongness bug in the task.

```ts
describe('per-leaf snapshot reconciliation', () => {
  it('keeps the selection when the file still exists in the next snapshot', () => {
    const r = reconcileSelection({ ...state, selectedEntityId: id('src/a.ts') }, nextWithA);
    expect(r.state.selectedEntityId).toBe(id('src/a.ts'));
    expect(r.notice).toBeNull();
  });

  it('REPORTS a removed selected file and NEVER replaces it by index', () => {
    const r = reconcileSelection({ ...state, selectedEntityId: id('src/gone.ts') }, nextWithoutGone);
    expect(r.state.selectedEntityId).toBeNull();
    expect(r.notice).toMatch(/no longer in|removed/i);
    // The wrong behaviour: silently selecting whatever is now at the old index.
    expect(r.state.selectedEntityId).not.toBe(nextWithoutGone.entities[3]!.id);
  });

  it('matches by ENTITY IDENTITY, not by position, when the file set is reordered', () => { /* ... */ });

  it('preserves query, camera and inspector state across reconciliation', () => { /* ... */ });

  it('reconciles each leaf INDEPENDENTLY against the same new snapshot', () => { /* ... */ });

  it('does not authorise a scan when reconciling', () => { /* ... */ });
});
```

- [ ] **Step 4: Run it, implement to green**

- [ ] **Step 5: Write the failing window-migration and leak tests**

`tests/host/window-migration.test.ts`:

```ts
describe('pop-out migration', () => {
  it('is signalled by HTMLElement.onWindowMigrated on containerEl', async () => {
    expect(containerEl.onWindowMigrated).toHaveBeenCalled();
  });

  it('RETAINS the destroy function it returns and calls it on close', async () => {
    await view.onClose();
    expect(migrationDestroySpy).toHaveBeenCalled();
  });

  it('DISPOSES and RECONSTRUCTS the renderer — there is no rebind', async () => {
    const before = view.renderer;
    await migrate(view, popoutWin);
    expect(disposeSpy).toHaveBeenCalled();
    expect(view.renderer).not.toBe(before);
    expect((view.renderer as any).rebind).toBeUndefined();
  });

  it('reconstructs from the EXISTING LayoutResult and CityViewState — no refetch, NO SCAN', async () => {
    await migrate(view, popoutWin);
    expect(computeLayoutSpy).not.toHaveBeenCalled();
    expect(coordinator.start).not.toHaveBeenCalled();
  });

  it('lands the camera where it left off', async () => {
    const before = view.renderer.getCamera();
    await migrate(view, popoutWin);
    expect(view.renderer.getCamera()).toEqual(before);
  });

  it('creates every DOM node in the NEW window, never the old one', async () => {
    await migrate(view, popoutWin);
    for (const el of view.contentEl.querySelectorAll('*')) {
      expect(el.ownerDocument).toBe(popoutWin.document);
    }
  });

  it('uses node.instanceOf(T) for DOM type checks, because instanceof is false across windows', () => { /* ... */ });

  it('re-reads the palette and the reduced-motion preference in the new window', async () => { /* ... */ });

  it('treats context loss and window migration as ONE recovery path', async () => {
    onEvent({ type: 'unavailable', reason: 'context-lost' });
    expect(disposeSpy).toHaveBeenCalled();
    expect(createRendererSpy).toHaveBeenCalledTimes(2);
    expect(coordinator.start).not.toHaveBeenCalled();   // context loss never restarts a scan
  });
});
```

`tests/host/lifecycle-leaks.test.ts`:

```ts
describe('no orphans after shutdown', () => {
  it('leaves no requestAnimationFrame handle', async () => { /* ... */ });
  it('leaves no observer', async () => { /* every ResizeObserver disconnected */ });
  it('leaves no timer or interval', async () => { /* ... */ });
  it('leaves no event handler', async () => { /* ... */ });
  it('leaves no active render loop', async () => { /* ... */ });
  it('removes DOM appended outside containerEl', async () => { /* the label overlay */ });
  it('releases the matchMedia change listener with the view', async () => { /* ... */ });
  it('releases the css-change subscription with the view', async () => { /* ... */ });
  it('survives ten open/close cycles with zero live WebGL contexts', async () => {
    // Browsers cap live contexts at roughly 8-16 (spec 4.4).
    for (let i = 0; i < 10; i++) { const v = newView(); await v.onOpen(); await v.onClose(); }
    expect(liveContexts()).toBe(0);
  });
  it('ignores a job that completes after its view closed', async () => { /* ... */ });
  it('pauses drawing and input for a hidden leaf, and NEVER scans on resume', async () => { /* ... */ });
  it('costs nothing for a zero-size leaf', async () => { /* ... */ });
});
```

- [ ] **Step 6: Run them, implement `window-migration.ts` and the view changes to green**

**Pop-out migration is `dispose()` plus constructing a new renderer — there is no `rebind`.** The binding consequence is that the renderer must be **cheap to reconstruct from an existing `LayoutResult` and `CityViewState`, with no data refetch and no scan**. (`Native Codebase City.md` still says "pop-out rebind"; that wording predates this decision — §4.2.)

- [ ] **Step 7: Run the whole gate, build, install and commit**

```bash
npm run verify && npm run install:vault
git add -A
git commit -m "feat(lifecycle): multi-leaf independence, pop-out migration and reconciliation

Views are reached through getLeavesOfType plus instanceof, never a cast, because
every view is created deferred since 1.7.2. Pop-out migration and context loss
are one recovery path: dispose and reconstruct from the existing LayoutResult and
CityViewState, with no refetch and no scan. A removed selected file is reported,
never replaced by index."
```

### CHECKPOINT #3 — manual checklist, run in Obsidian

**Setup:** `npm run verify && npm run install:vault`, reload Obsidian, scan a real repository so a city exists.

**Multiple leaves**
- [ ] Open **two** city tabs. Select a different file in each; **both selections hold independently**
- [ ] Type a different query in each; both hold
- [ ] Move the camera in one; the other **does not move**
- [ ] Split the workspace so both are visible at once; both render

**Hidden and resized leaves**
- [ ] Switch to another tab; the city tab **stops drawing** (console: no rAF activity; check `renderer.info.render.frame` stops climbing)
- [ ] Switch back; it resumes **without scanning** — `scan-codebase` was not triggered
- [ ] **Answer §11's open question:** does a hidden leaf revert to `DeferredView`? Watch for `onClose` firing on tab switch. **Record the answer in the spike report.** If it does not, a long session accumulates one live WebGL context per city tab ever shown — note that as a limitation for task 13
- [ ] Drag the leaf edge to resize continuously; the render keeps up and **does not re-fit** the camera
- [ ] Collapse the leaf to zero width and back; no error

**The 820 px threshold — re-check it, as §5.2 requires**
- [ ] In a **normal centre leaf** above 820 px: list + canvas + inspector all visible
- [ ] Narrow it below 820 px: canvas with **Files** and **Inspector** drawers, **one overlay at a time**, each with a **visible close that returns focus to its opener**
- [ ] In a **sidebar leaf**: does 820 still feel right, or does the layout break earlier? **Record your judgement** — this threshold is provisional and contested
- [ ] In a **pop-out window**: same question
- [ ] Below **320 px** inline size: list-first, **no WebGL context created**, and query/selection/camera bookmark are **preserved** when it widens again

**Pop-out migration**
- [ ] Drag a city tab out into its own window
- [ ] The city **still renders**, and the camera is **where it was**
- [ ] The tooltip and any overlay DOM appear in the **pop-out window**, not the main one
- [ ] Selection, query and inspector state survive the move
- [ ] Console shows **no** `WebGL: INVALID_OPERATION: delete: object does not belong to this context`
- [ ] Theme change while the pop-out is open recolours **both** windows correctly
- [ ] Drag it back; same checks

**Context loss**
- [ ] Trigger `debugLoseContext()` from the console
- [ ] The view reports the loss, then **reconstructs** — no self-healing, **no scan restart**
- [ ] The camera lands where it was
- [ ] No `INVALID_OPERATION` warnings appear

**Reconciliation**
- [ ] Select a file, then **delete it from the repository on disk** and run `scan-codebase`
- [ ] The view **reports that the selected file is gone** and **does not silently select a different file**
- [ ] Rename a different file and refresh; selection of an unaffected file is preserved

**Leaks**
- [ ] Open and close a city tab **ten times**; the console shows no growing handle count and no error
- [ ] Disable and re-enable the plugin with two city tabs open; no orphan canvas remains
- [ ] Reload Obsidian with two city tabs saved in the workspace; both restore with their own state
- [ ] Theme switch, 200% text zoom (Settings → Appearance → Font size), and one **third-party theme**: labels scale as text, nothing clips, focus stays visible

**Stop and raise with the user if:** a second leaf shares state with the first; a removed selected file is silently replaced; any `INVALID_OPERATION: delete` warning appears; a WebGL context survives close; or a scan starts on resume, migration or context loss.

---

## Task 12: Safety, evidence and accessibility gates

**Ends with:** G2, G3, G4, G5 and G8 evidence recorded.

**Files:**
- Create: `tests/acceptance/wp01.feature`, `tests/acceptance/wp01.steps.ts`
- Create: `tests/benchmarks/city-benchmark.test.ts`, `scripts/make-benchmark-fixture.mjs`
- Create: `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`
- Create: `docs/superpowers/notes/2026-09-17-wp01-accessibility-matrix.md`
- Modify: `package.json` (add `analyze`), `src/ui/components/` (ship the two gated claims)
- Test: everything above, plus `tests/integration/vault-is-the-codebase.test.ts`

**Interfaces:**
- Consumes: everything.
- Produces: the recorded evidence tasks 13 cites, and `npm run analyze`.

**Dependencies:** Tasks 1–11.

**Ported from:** `docs/concept/design/wp01-review/validation/production-acceptance.feature` — **all 21 scenarios**, with the **three repairs** spec §6 requires.

- [ ] **Step 1: Write `tests/acceptance/wp01.feature`**

Adopt the 21 scenarios verbatim in intent:

1. Select a file without moving the camera
2. Close details without clearing selection
3. Keep a selected file outside a new search
4. Escape in search clears only the query
5. Keyboard input belongs to the sibling note
6. Restore a 3D camera after top-view exploration
7. Dragging does not select on release
8. Return to the scope review trigger
9. Cancel a refresh without losing the valid snapshot
10. Reject late result publication
11. Preserve inventory without the renderer
12. Clipboard failure has a usable alternative
13. Do not scan while enabling or restoring the plugin
14. Reject approval after root or scope changes
15. Respect the approved source boundary
16. Report unreadable content without measured-zero substitution
17. Preserve independent state across two leaves
18. Reconcile a file removed from the next snapshot
19. Move a view to a pop-out window
20. Dispose the real Three.js renderer
21. Verify unchanged source after a real scan

**The three repairs (§6):**

- **Add "Vault is the codebase"** — required by `docs/deliverables/Native Codebase City.md` and missing from the original. It must cover excluding the **actual** `vault.configDir`, other plugins' `data.json`, and `.git`.
- **Add "Theme change while a city is open"** — likewise required and missing. Recolouring must not move buildings, change the camera, or clear state.
- **Restore the late-result scenario to its CROSS-PROFILE form**, which is what §7 actually requires: a result arriving for profile A while profile B is active must not publish.

```gherkin
Scenario: Vault is the codebase
  Given the vault itself is the approved source
  And the vault's configured config directory is ".my-config"
  When a scan completes
  Then no path under ".my-config" appears in the filesystem port's read log
  And no other plugin's data.json appears in the read log
  And no path under ".git" appears in the read log
  And the plugin's own outputs are outside collection scope

Scenario: Theme change while a city is open
  Given a city is rendered with a selection and a moved camera
  When the Obsidian theme changes from dark to light
  Then every colour the scene draws is re-supplied
  And no building has moved
  And the camera is unchanged
  And the selection is unchanged

Scenario: Reject late result publication across profiles
  Given a scan is running for profile "A"
  When the user switches the active profile to "B"
  And profile "A"'s scan completes
  Then nothing is published
  And profile "B"'s snapshot is unchanged
```

- [ ] **Step 2: Run the acceptance suite to verify it fails, then wire the steps to green**

Run: `npx vitest run tests/acceptance/` → FAIL, then implement `wp01.steps.ts` against the **production** modules. No prototype is referenced.

- [ ] **Step 3: Write the G2 no-source-write proof at full scale**

Extend task 5's whole-tree hash diff to the **1,000-file functional fixture** and run it **with the plugin already installed**, so the proof covers the real configuration. **Do not compare unavoidable Obsidian workspace updates as if they were source-code modifications** — the diff covers the inspected tree only.

Record in `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`:

```markdown
## G2 — Source safety and scope

### Boundary
Fixtures exercised: spaces, Unicode, Windows drive paths, prefix collisions, parent
traversal, symlinks and junctions, permission errors, binary and invalid text, nested
ignores, huge files, cancellation.  Result: <pass/fail, per case>

### No source writes
Method: SHA-256 of every file in the tree, plus size and mtimeMs, before and after a
scan, with the plugin already installed.  Fixture: <path, file count>
Result: <n> files, <n> differences.  Differences must be 0.

### Secrets are never read
Method: the SourceFileSystemPort records every path it OPENS; the test asserts excluded
paths never appear in that log. This proves the ABSENCE OF A READ, not absence from
the interface.
Excluded and verified absent: .env, .git, <the actual vault.configDir>, other plugins'
data.json.  Verified present (so the log is real): <an included path>.

### Pruned directories are reported honestly
<how, and what the user sees>

### Refresh excludes report/cache output
<evidence that a refresh does not self-analyse>
```

- [ ] **Step 4: Record the G3 evidence-truth gate**

```markdown
## G3 — Evidence truth
Physical lines: exact definition + <n> unit tests.  <link to tests/unit/metrics.test.ts>
No provider means not analyzed: <evidence>
Unavailable is never a measured zero: <evidence — the validator rejects value 0 on
  status 'unavailable', and the collector never coerces>
Provenance is never read from a payload: <evidence — validator test>
Run completion is separate from findings and policy verdict: WP-01 ships neither
  findings nor a policy verdict; the fields are separate in the model.
Nothing infers "safe to delete", "test will pass" or "not exploitable".
```

- [ ] **Step 5: Run the accessibility matrix**

`docs/superpowers/notes/2026-09-17-wp01-accessibility-matrix.md`. **Checkpoint work except where a jsdom assertion suffices** — record which layer each row was actually verified at.

| Check | How | Result |
|---|---|---|
| Keyboard-only: complete the scripted demo without a mouse | manual | |
| Screen reader: NVDA on Windows | manual | |
| 200% text zoom: no clipping, labels scale as text | manual | |
| Focus visibility and order | manual + jsdom | |
| Dark theme | manual | |
| Light theme | manual | |
| One third-party theme (name it) | manual | |
| Non-drag single-pointer equivalence (11 controls) | jsdom + manual | |
| Reduced motion: camera jumps, does not tween | jsdom + manual | |
| Long Unicode paths in list, inspector and tooltip | jsdom + manual | |
| The canvas is one named region, not thousands of buttons | jsdom | |
| Host shortcuts are not captured while the city lacks focus | manual | |
| Focus is preserved after a refresh | manual | |
| Tooltip and overlay DOM belong to the correct window | manual | |

- [ ] **Step 6: Write the benchmark fixtures and record G5**

`scripts/make-benchmark-fixture.mjs` generates a **1,000-file functional fixture** and a **5,000-file performance fixture**. `tests/benchmarks/city-benchmark.test.ts` measures **scan, normalization, layout, first paint, interaction and cleanup separately**.

```markdown
## G5 — Performance

### Reference hardware — recorded, because CI software rendering establishes nothing
CPU: <>  GPU: <>  OS: <>  Obsidian: <>  Electron/Chrome: <>
Viewport: <> CSS px  devicePixelRatio: <>  Fixture: <>  Settings: <>
Measurement method: <>

### Results (initial targets, NOT claims)
| Stage | 1,000 files | 5,000 files | Target |
|---|---|---|---|
| Scan | | | — |
| Normalization | | | — |
| Layout | | | — |
| First paint after snapshot available | | | within 3 s |
| Interaction p95 frame time | | | at or below ~33 ms |
| Cleanup | | | — |

### No sustained animation while idle or hidden
Method: renderer.info.render.frame after the scene settles, and while the leaf is hidden.
Result: <>

### Aggregation rather than silent disappearance at unsupported scale
Result: <n> lots at 5,000 files; districts aggregated: <n>; lots dropped: 0
```

**Diagnostics:** `getDiagnostics()` supplies `info.memory.geometries`, `drawCalls` and `lastFrameMs`; `debugLoseContext()` forces `WEBGL_lose_context`. **No prototype's numbers are cited** — the Three.js prototype's ran on a **software rasteriser** (ANGLE SwiftShader, with HTML injected via `page.set_content` because `file://` was blocked), exercises no Obsidian host, no filesystem, no repeated construct-and-dispose cycle, no second leaf, no window migration, and asserts no timing at any scale.

- [ ] **Step 7: Record G4 and G8**

```markdown
## G4 — Lifecycle and accessibility
Multiple leaves, independent selection, command reveal, close/reopen, disable/re-enable,
workspace restoration, hidden and resized leaves, theme switching, pop-out migration:
<checkpoint #3 results, by row>
No orphan canvas, observer, timer, watcher, event handler or active render loop after
shutdown: <evidence>
Job completion after a closed or rebound view is ignored: <evidence>
The file list and inspector work keyboard-only and without WebGL: <evidence>

## G8 — Testing coverage — WHICH LAYERS ACTUALLY RAN
| Layer | Ran | Count | Notes |
|---|---|---|---|
| Unit | | | |
| Contract | | | one suite, N implementations |
| Integration (real temp dirs) | | | |
| Component (jsdom, B02-B10/B18-B19/B21/B23-B26) | | | against OUR controls |
| Acceptance (21 + 3 repairs) | | | |
| Accessibility | | | manual rows named individually |
| Benchmark | | | reference hardware recorded |
```

- [ ] **Step 8: Add `npm run analyze` — fallow on our own source**

**fallow is a development-time gate on our own source, not a runtime dependency, and not wired into the product until WP-02.** Add `"analyze": "..."` to `package.json`, run it, and record the result. It does **not** join `npm run verify`.

- [ ] **Step 9: Ship the two gated claims**

Only now, with the G2 evidence recorded, add **"Read-only source access"** and **"Source remains unchanged"** to the UI. These are **factual claims made on the product's behalf**. Add a component test asserting each string is present, and a comment at each site citing the evidence document.

- [ ] **Step 10: Run the whole gate and commit**

```bash
npm run verify && npm run analyze
git add -A
git commit -m "test(gates): G2, G3, G4, G5 and G8 evidence, benchmarks and accessibility matrix

The 21 acceptance scenarios are adopted with three repairs: vault-is-the-codebase,
theme-change-while-open, and the late-result scenario restored to its cross-profile
form. No source writes is proved by a whole-tree hash diff including mtimes;
secrets-never-read is proved by the port's read log, which proves the absence of a
read. Benchmarks record reference hardware; no prototype result is cited.

The two factual claims now ship, because the G2 evidence exists."
```

**Acceptance criteria, restated concretely:**

1. **All 21 acceptance scenarios pass**, plus the **three repairs** — vault-is-the-codebase, theme-change-while-open, and the cross-profile late-result form.
2. **G2 recorded**: the boundary matrix, a whole-tree hash diff (including mtimes) showing **zero** differences with the plugin installed, and a read-log proof that excluded paths — including the **actual** `vault.configDir` — were never opened.
3. **G3 recorded**: the physical-lines definition with its tests, unavailable-is-never-zero, and provenance-never-read-from-a-payload.
4. **G4 recorded** from checkpoint #3, row by row.
5. **G5 recorded** with reference hardware, per-stage timings at 1,000 and 5,000 files, no sustained idle animation, and **zero lots dropped** at scale.
6. **G8 recorded**, stating **which layers actually ran** and with what counts.
7. The accessibility matrix is complete, with each row's verification layer named.
8. `npm run analyze` runs fallow over our own source and is **not** part of `npm run verify`.
9. **"Read-only source access" and "Source remains unchanged" now appear in the UI**, each with a comment citing the evidence document.
10. **No prototype's test results are cited anywhere in the evidence.**

---

## Task 13: Release gate — CHECKPOINT #4

**Ends with:** G1 evidence recorded; WP-01 complete and honestly reported.

**Files:**
- Create: `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`
- Create: `docs/superpowers/notes/2026-09-17-wp01-limitations.md`
- Modify: `README.md`, `manifest.json` / `versions.json` if the version moves
- Test: `tests/host/clean-vault-install.test.ts` (scripted where possible; the rest is checkpoint #4)

**Interfaces:**
- Consumes: every recorded piece of evidence from task 12.
- Produces: the merge to `main`.

**Dependencies:** Tasks 1–12.

- [ ] **Step 1: Build a clean release artefact**

```bash
npm ci                 # from the committed package-lock.json
npm run verify
```

The release files are `dist/main.js`, `dist/styles.css` and `dist/manifest.json` — nothing else.

- [ ] **Step 2: Install into a THROWAWAY CLEAN VAULT**

The dev vault is a working checkout with other plugins installed — a realistic host and a useful external codebase to inspect, **but not isolated, so it cannot satisfy G1 alone**. Create a brand-new vault with **no other plugins**, no dev server, no network, no source checkout and no runtime package install, and copy the three files in by hand.

- [ ] **Step 3: Run the scripted demo, twice**

Spec §10's demo, first against a **real external repository**, then repeated **vault-based**:

1. Real external repository → scope approval → scan
2. Find a known file
3. Confirm its measurements against an editor
4. Exercise the **keyboard** path and the **HTML** path
5. Cancel a refresh
6. Reopen
7. **Source unchanged** (`git status` clean)

- [ ] **Step 4: Write the limitations document**

`docs/superpowers/notes/2026-09-17-wp01-limitations.md` — honest, and it carries forward every §11 item still open at the end:

```markdown
# WP-01 limitations

## Measured, and what it means
<benchmark numbers, with reference hardware; initial targets, not claims>

## Known limitations
- Snapshots are IN-MEMORY ONLY. Durable history is WP-05. Reopening shows retained
  in-memory state marked with its age, and never silently authorises a new scan.
- No analyzer, no findings, no coverage, no dependency relations, no runtime evidence.
- No note writing, no snapshot comparison.
- No source-opening or open-in-editor action. External process execution is an
  unresolved policy question.
- No lens parameter on the city viewport.
- Symbolic links and junctions are never followed; they are reported as skipped.
- The height cap is derived per snapshot, so a file's height depends on unrelated
  files and can change between refreshes. Raw values are always in the inspector.
- The 820 CSS px collapse threshold is provisional. <what checkpoint #3 found>

## Open questions carried forward from spec §11
- Whether a loaded view reverts to DeferredView when hidden: <answer from checkpoint #3>
- Whether the WebGL context survives pop-out migration: <answer; a performance question
  only, because we dispose and reconstruct>
- setState/onOpen ordering on workspace restore: <answer from task 3>
- r187 will make WebGLRenderer use WeakRef and FinalizationRegistry internally, which
  could interact with strict-disposal-on-close. Re-test at upgrade time.
- The Three.js migration wiki OMITS r186's CommonJS deprecation entirely — it is
  documented only in the GitHub release notes and visible in the published tarball.
  Treat that wiki page as incomplete for r186 when upgrading.
- Visual regression against the design mockups: r181 changed PBR energy conservation
  and indirect specular, so any reference screenshot taken against an older Three.js
  needs retaking. Magnitude unmeasured.
- The design package's Three.js and Obsidian citations ([T1]-[T4], [O1]-[O2]) use
  non-canonical URL forms, which suggests they were constructed rather than fetched.
  Still to be re-fetched.
- Whether the community directory's build verification accepts a dist/ output.
  Irrelevant until submission is a goal.
```

- [ ] **Step 5: Write the implementation report**

`docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`, citing task 12's evidence:

```markdown
# WP-01 implementation report

## Definition of done (spec §10) — status, line by line
- [ ] Installable build satisfies the real-root workflow for a VAULT-BASED project
- [ ] ... and for an EXTERNAL project
- [ ] Measurements match fixtures
- [ ] Scanning changes no file in the inspected project — cites the G2 evidence
- [ ] The accessibility matrix passes — cites the matrix
- [ ] The lifecycle checks pass — cites checkpoint #3
- [ ] Benchmark results are recorded — cites the G5 record
- [ ] Limitations are recorded — cites the limitations document
- [ ] Every VISIBLE command and setting is implemented — enumerate them
- [ ] The README discloses out-of-vault reads, no network use and no telemetry
- [ ] A recognised LICENSE file is present

## The two factual claims
"Read-only source access" and "Source remains unchanged" ship, and this report cites
the G2 evidence that earns them: <link + summary>

## Which test layers actually ran
<the G8 table>

## G1 — Host distribution
Clean throwaway vault: <name/path>  Other plugins installed: NONE
No dev server, no network, no source checkout, no runtime package install: confirmed
ID and name correct: confirmed   Desktop-only: confirmed
The documented minimum host version was ACTUALLY TESTED: <version tested>
Dependency licenses verified: <list>
Current community submission policies reviewed: <date, outcome>

## Packet traceability (spec §9) — no packet's evidence was dropped
| Packet | Produced by | Evidence |
|---|---|---|
| IP-01 Consolidate contracts | 2 | |
| IP-02 Open a native inspector view | 1, 3, 6 | |
| IP-03 Source selection and read-only inventory | 5, 7, 8 + the no-write proof in 12 | |
| IP-04 Render the city with Three.js | 4, 10 + the benchmark in 12 | |
| IP-05 Find and inspect without losing context | 9 + fit/top/focus in 10 | |
| IP-06 Refresh, cancel, fail, recover | 8 + per-leaf reconciliation in 11 | |
| IP-07 Validate the actual Obsidian host | 11, 12, checkpoint #3 | |
| IP-08 Package and release | 13 | |

## What was NOT done, and why
<the limitations document, summarised>
```

- [ ] **Step 6: Run checkpoint #4, then merge**

```bash
git add -A
git commit -m "docs(release): WP-01 implementation report, limitations and G1 evidence"
git checkout main
git merge --no-ff feat/wp-01-codebase-city
```

**Then the increment stops, before fallow.**

### CHECKPOINT #4 — manual checklist, run in Obsidian

**This is the release gate. It runs in a brand-new throwaway vault with no other plugins.**

**G1 — host distribution**
- [ ] A **brand-new vault** exists, with **no other plugins installed**
- [ ] Only `main.js`, `styles.css` and `manifest.json` were copied in — **no dev server, no network, no source checkout, no runtime package install**
- [ ] The plugin appears with the correct **id** (`codebase-inspector`) and **name** (`Codebase Inspector`)
- [ ] It is marked **desktop-only**
- [ ] It enables with **no console error**
- [ ] **The documented `minAppVersion` (1.13.0) was actually tested** — either on that version, or the gap is stated in the report
- [ ] Dependency licenses are verified and listed
- [ ] Current community submission policies were reviewed (note the date)

**The scripted demo — external repository**
- [ ] Select a **real external repository** as the source
- [ ] Approve scope; the acknowledgement starts unchecked and Scan is disabled until checked
- [ ] Scan completes; a real city renders
- [ ] **Find a known file** by search; Enter selects the first match **without moving the camera**
- [ ] **Confirm its measurements** against an editor's line count
- [ ] Complete the whole path **with the keyboard only**
- [ ] Complete the whole path in the **HTML list** with the 3D view off
- [ ] **Cancel a refresh**; the previous city and its original timestamp survive
- [ ] **Reopen** the view; retained state is shown **with its age**, and no scan starts
- [ ] **`git status` in the repository is clean** — source unchanged

**The scripted demo — vault-based**
- [ ] Repeat every step above with **the vault itself** as the source
- [ ] The **actual** `vault.configDir` was never read
- [ ] No other plugin's `data.json` was read
- [ ] `.git` was never read

**Honest reporting**
- [ ] The UI shows **"Read-only source access"** and **"Source remains unchanged"**, and the report **cites the G2 evidence** for both
- [ ] The README discloses out-of-vault reads, **no network use** and **no telemetry**
- [ ] A recognised `LICENSE` file is present
- [ ] The limitations document names every §11 item still open
- [ ] The implementation report states **which test layers actually ran**
- [ ] **Every visible command and setting is implemented** — nothing renders that does nothing
- [ ] **No prototype result is cited anywhere** in the report or the evidence

**Stop and raise with the user if:** the plugin fails to enable in a clean vault; any scanned file changes; either factual claim ships without its evidence; a visible control does nothing; or a benchmark number is quoted without its reference hardware.

**Acceptance criteria, restated concretely:**

1. **G1 evidence recorded**: a clean throwaway vault, no other plugins, no dev server, no network, no source checkout, no runtime install; correct id and name; desktop-only; `minAppVersion` actually tested; licenses verified; policies reviewed.
2. **The scripted demo runs end to end twice** — once external, once vault-based — and the source is unchanged both times.
3. The **limitations** document carries forward every open §11 item, with the answers checkpoint #3 and task 3 produced filled in.
4. The **implementation report** walks spec §10's definition of done line by line, cites the G2 evidence for both factual claims, states which test layers actually ran, and completes the §9 packet traceability table.
5. The README discloses out-of-vault reads, no network use and no telemetry; `LICENSE` is present.
6. **Every visible command and setting is implemented.**
7. `feat/wp-01-codebase-city` is merged to `main`.
8. **The increment stops here, before fallow.**

---

## Spec coverage

Written for the reviewer who has to confirm nothing was dropped.

| Spec section | Covered by |
|---|---|
| §0 Precedence | The "How this plan is executed" section; the non-normative-sources rule at the top and in every task that names a prototype file |
| §1 Scope | Global Constraints → "Out of scope"; task 3's welcome-state test; task 9's inspector test (no source-opening); task 6's symlink-row test |
| §2 Approach: skeleton first | The task order itself; task S's framing |
| §3 Repository and toolchain | Task 1 |
| §3.1 Node access | Task S (the verdict), task 5 (`node-access.ts`) |
| §3.2 Build + Three.js migration items | Task 1 (build, `assert-bundle`), and the migration items carried into tasks 3, 4, 9, 10, 12 |
| §3.3 Manifest | Task 1, `tests/unit/manifest.test.ts` |
| §3.4 Typecheck and lint, the three architectural rules | Task 1, `eslint.config.mjs` |
| §3.5 Test and dev loop | Task 1 (`vitest.config.ts`, `install-to-vault.mjs`, `.env.example`); task 13 (throwaway vault) |
| §4.1 Domain model | Task 2 |
| §4.2 Renderer port | Task 2 (types), task 3 (minimal), task 10 (full) |
| §4.3 Layout output | Task 4 |
| §4.4 Host rules | Tasks 3, 6, 10, 11 |
| §4.5 Application ports | Tasks 2, 5, 6, 8 |
| §5 Task sequence | The thirteen tasks, in order, with the four checkpoints |
| §5.1 Spike scope and pass criteria | Task S |
| §5.2 Resolved interaction defaults | Global Constraints table; tasks 9 and 10 |
| §6 Testing (six layers, two purpose-built proofs, the ported assets) | Tasks 2, 4, 5, 9, 12; the "Assets to port" table |
| §7 Failure behaviour | Tasks 8 and 9 |
| §8 Execution model | "How this plan is executed" |
| §9 Packet traceability | Task 13's report table |
| §10 Definition of done | Task 13 |
| §11 Verification basis | Task S (Node access, `styles.css`, `vault.getFiles`), task 3 (`setState`/`onOpen` ordering), task 6 (`getSettingDefinitions`), task 10 (bookmark round-trip), checkpoint #3 (`DeferredView` on hide, pop-out context), task 13 (everything still open) |
