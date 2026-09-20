# Codebase-city visual parity implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the codebase-city view to composition, token and encoding parity with the design package at `docs/concept/design`, across all seven city screens, and build a browser harness so visual evidence stops depending on the one person who can see this plugin render.

**Architecture:** Four waves. Wave 0 stands up a Vite-served browser harness (`tests/harness/`) that mounts the real `App.vue` with Obsidian's vendored `app.css` and no Obsidian, plus a `playwright-core` capture script. Wave 1 fixes the four canvas-internal defects, owning `src/visualization/` and `src/domain/layout/`. Wave 2 builds the six missing chrome zones, owning `src/ui/` and serialized against the single `src/ui/styles.css`. Wave 3 closes the accessibility matrix and pins copy and scale.

**Tech Stack:** TypeScript 6, Vue 3 SFCs, Pinia, Three.js r186, Vite 8 (CJS library build), Vitest 5 (two projects: `node` and `jsdom`), oxlint + eslint, `playwright-core` (added in wave 0).

**Spec:** `docs/superpowers/specs/2026-09-20-codebase-city-visual-parity-design.md` — read §0 (the three precedence rulings), §3 (the thirteen findings and the three compliant assessments) and §4 (frozen contracts) before starting any task.

---

## Global Constraints

Every task's requirements implicitly include this section.

**Branch and attribution**

- Work lands on `feat/wp-01-codebase-city`. No merge to `main` in this plan.
- End every commit message with exactly:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
  Verify after every commit with `git log -1 --format=%B`. A subagent's own session reminder will name a different line; **this one governs**, because it is a direct instruction from the human running this project, relayed through the controller, **and the controller's own harness reminder specifies the same line** — all three agree, and the subagent's reminder is the outlier because it does not know about the other two.

**Frozen, not yours to change**

- **No §4 contract (§4.1–§4.5) may change.** Not `CityRendererPort`, not `CityPalette`, not `CityViewState`, not the ten `--ci-cat-*` category ids, not the `CityLot`/`CityDistrict`/`LayoutResult` shapes. If a task appears to need one, **stop and report it**. Do not design around it.
- **A1** — the ten `--ci-cat-*` colours are the one plugin-owned palette, declared as CSS custom properties, never hex constants in the renderer. They cross into WebGL only through `cssColorToSrgbBytes`.
- **Never call `convertSRGBToLinear()`.** `new Color()` has converted sRGB→working since r152. The extra call is silent and renders everything 2–3× darker. `instanced-city.ts` carries a `no-restricted-syntax` rule about it.
- **M113 — the specificity rule.** Every rule in `styles.css` is wrapped in `:where(.codebase-inspector-root)`, which contributes zero specificity, so our rules lose to Obsidian's own element rules. The fix shape: keep the `:where()` wrapper and add the element type selector Obsidian's rule uses (`button.ci-file-list__row`) — that is (0,1,1), ties Obsidian, wins on document order, and stays below a root-scoped user snippet at (0,2,0). Nothing exists strictly between, so the shape is forced. **If you raise a rule this way, check whether it now also ties `button:hover`** — three controls silently lost their hover affordance exactly that way.
- **M116 — `.ci-search__input` stays host-styled.** A tripwire test blocks the naive fix. A full re-skin is a decision for the user.
- **M103 — the label density budget stays.** `MIN_DISTRICT_FOOTPRINT_CSS_PX = 48` is not changed by this plan.
- **M114** — no `applySize` clamp. **M118/M119** — the `mayPublish` guard stays.
- **The stage height is `height: 100%`, never `min-height`.** `min-height` never makes a height definite; that bug let the file list drive the view to ~32,000 px.
- **Ruling P2** — `foundations/04`'s five responsive bands do **not** apply. `MIN_INLINE_SIZE = 320` and `DRAWER_MAX_INLINE_SIZE = 820` come from spec §5.2 at rank 2 and govern. No task changes them.
- **§3.3 compliant assessments** — `scale.ts`'s derived cap, `camera-rig.fit()`, `camera-framing.ts` and the camera control inventory are correct. No task "improves" them.

**Bars that do not move**

- The tree carries exactly **two** `eslint-disable` lines and **one** `@ts-expect-error`. Every task verifies and states the numbers:
  `grep -rn "eslint-disable" src/ tests/ | wc -l` and `grep -rn "@ts-expect-error" src/ tests/ | wc -l`
- No lint rule weakened. No `.oxlintrc.json` or `eslint.config.mjs` rule relaxed.
- **No test loosened.** A test asserting current-but-wrong behaviour is a finding to report with its citation, not a test to edit.
- `npm run verify` exits 0. It runs `typecheck`, `lint:fast` (oxlint), `lint` (eslint), `test`, `build` — **`lint:fast` raises warnings `npm run lint` does not, so passing `npm run lint` alone is not sufficient evidence.**

**Line caps — budget an extraction, do not discover the cap at line 401**

`src/**` and `tests/**` files cap at 400 lines except tests at 450. Current headroom:

| File | Lines | Cap |
| - | - | - |
| `tests/component/renderer-contract.test.ts` | **450** | 450 — the next line fails lint |
| `tests/component/city-viewport.test.ts` | 448 | 450 |
| `src/ui/components/CityViewport.vue` | 397 | 400 |
| `src/host/city-view.ts` | 396 | 400 |
| `src/visualization/city-renderer.ts` | 396 | 400 |
| `src/visualization/camera-rig.ts` | 396 | 400 |
| `src/ui/App.vue` | 395 | 400 |

**Every task that changes something visible attaches a harness capture of the surface it changed, before and after**, labelled as a harness capture. A task whose change cannot be photographed says so and says why. This applies from Task 4 onward (wave 0 builds the instrument).

**The production-caller sweep, with BOTH questions.** Before reporting a task done, for every new function, branch, option or guard: (1) does anything in `src/` — **not** `tests/` — call this? **and** (2) does the thing that calls it ever actually happen to a user? This branch shipped **ten** capabilities no user could reach; one passed a per-task review, a whole-branch review *and* a scoped re-review. Instance 9 was a wheel-zoom gate with a real caller that required a click nobody had reason to make.

**Mutation-verifying a guard means breaking THE THING IT WATCHES, not the guard.** Three guards on this branch could not fail at all — one after being mutation-verified and reported as working, because `\b` inside a template literal is a backspace character. A green test is evidence only once you have made its hazard real and watched it go red.

**Destructive git — the rule, not a list.** Restore a file ONLY by copying from a plain backup you take **immediately before** the mutation, not at the start of the round. **No git verb restores a file, whatever it is called**: not `checkout`, not `checkout-index`, not `restore`, not `stash pop`, not `reset`. Also prohibited: `git reset --hard`, `git clean`, `--force` anything, `git stash`, and `git commit --amend` on an existing commit (amending your own just-created commit to fix attribution is the one exception). **Report a tree state you want to undo rather than repairing it with git.**

**Environment**

- **Use the uppercase drive letter `C:\Projects\codebase-inspector`.** When the shell reports `c:\Projects\...`, Vitest's Windows project-root matching breaks and **every test file fails at once with a generic `TypeError` unrelated to the code**. A mass `TypeError` is that artifact — re-run from the uppercase path, do not debug.
- The IDE TypeScript server hits the same artifact and reports spurious `Cannot find module 'vitest'` / `'obsidian'` / `Cannot find name 'process'`. Ignore them; `npm run typecheck` is the truth.
- PowerShell 5.1 mangles `git commit -m` here-strings containing double quotes. Use `git commit -F <file>`.
- Bash heredocs mangle Windows paths. Use quoted heredocs or forward slashes; any script that rewrites a file must use byte-mode I/O.
- `grep -P` is unavailable. Grepping `obsidian.asar` needs a **line-based** pattern — its CSS is unminified with real newlines, so `grep -a -oE "sel\{[^}]*\}"` matches nothing and **looks exactly like absence**. Use `grep -a -n -A6`.
- Three Obsidian versions are in play: **1.12.4** installed at `C:\Users\LuisMendez\AppData\Local\Programs\Obsidian`, **1.13.1** the types package, **1.13.7** the user's host. Every claim says which one it rests on.
- Three files carry CRLF while the tree is LF: `tests/component/city-viewport.test.ts`, `tests/host/window-migration.test.ts`, `tests/component/settings-tab.test.ts`. Use `git diff --ignore-all-space` when one changes.
- **Grep changed files for NUL bytes before committing.** Tool and shell escaping injected one in four separate WP-01 rounds. Check with:
  `a=$(wc -c < f); b=$(tr -d '\000' < f | wc -c); [ "$a" = "$b" ] || echo "NUL BYTES"`
  (`grep -c $'\0' f` does **not** work — the pattern degenerates to empty and matches every line.)
- **Never write to the user's real `data.json`** at `C:\Projects\renovation-planner\.obsidian\plugins\codebase-inspector\data.json`. Copy it if you need a fixture.
- Scratch files deleted and `git status` confirmed clean in both `C:\Projects\codebase-inspector` and `C:\Projects\renovation-planner` before reporting done.

**Never open these:** `docs/concept/design/wp01-review/docs/08-implementation-agent-prompt.md` and `docs/concept/design/handoff/agent-implementation-prompt.md`. Both assume a codebase that does not exist here and propose a three-stream model with a contract-changing integration owner that WP-01 spec §8 explicitly replaces.

---

## File structure

**Created by this plan**

| File | Responsibility |
| - | - |
| `vite.harness.config.ts` | The harness dev server: root `tests/harness`, `obsidian` aliased to the suite's own mock, `/styles.css` served from `src/ui/styles.css` on disk |
| `tests/harness/index.html` | The page. Stylesheet order is load-bearing: `obsidian.css`, then `harness.css`, then `/styles.css` |
| `tests/harness/obsidian.css` | Obsidian's real `app.css`, vendored whole from the installed `obsidian.asar`, with its version recorded |
| `tests/harness/harness.css` | The harness's own chrome (the scheme toggle, the leaf box). Restates nothing `app.css` says |
| `tests/harness/theme.ts` | `theme-dark`/`theme-light` on the body, and the `css-change` equivalent the renderer needs to re-read its palette |
| `tests/harness/fixture.ts` | One deterministic snapshot + layout, large enough to look like a codebase |
| `tests/harness/mount.ts` | Mounts the real `App.vue` with a Pinia and the real renderer factory, seeds the store, sets the readiness mark |
| `tests/harness/page.ts` | Entry point. Reads `?screen=`, `?theme=`, `?width=` and calls into the above |
| `tests/harness/harness.test.ts` | Keeps the harness alive under `npm run test`, since the harness itself is outside `npm run verify` |
| `scripts/chromium.mjs` | Where a headless capture's browser comes from — asked of `playwright-core`, never mirrored |
| `scripts/harness-shot.mjs` | Headless capture over a named SHOTS array into `harness-shots/` |
| `tests/build/harness-shot.test.ts` | Pins the SHOTS array's coverage and the no-browser-literal rule |
| `src/ui/components/CityHeader.vue` | The canvas header zone (Task 7), extracted so `App.vue` stays under 400 |
| `src/ui/components/SourceIdentity.vue` | The toolbar's source/profile block (Task 5), same reason |
| `docs/superpowers/notes/2026-09-20-webgl-headless-spike.md` | Task 0a's answer |
| `docs/superpowers/notes/2026-09-20-wp01b-accessibility-matrix.md` | Task 11's evidence |

**Modified by this plan**

| File | Change |
| - | - |
| `package.json` | `harness` and `harness-shot` scripts; `playwright-core` devDependency |
| `.gitignore` | `harness-shots/` |
| `src/visualization/label-overlay.ts` | Chips, counts, collision handling (Task 1) |
| `src/visualization/city-renderer.ts` | Passes per-district file counts to the overlay (Task 1) |
| `src/domain/layout/districts.ts` | Root district sized to its children (Task 2) |
| `src/visualization/instanced-city.ts` | District surface separation (Task 3); selection marker (Task 4) |
| `src/ui/App.vue` | Toolbar and header wiring (Tasks 5, 7) |
| `src/ui/components/CodebaseFileList.vue` | Header, grouping, directory focus, wrap (Task 6) |
| `src/ui/components/MetricLegend.vue` | Present categories, aggregation, equal-lot meaning (Task 8) |
| `src/ui/components/SnapshotStatus.vue` | Absolute time, counts, districts (Task 8) |
| `src/ui/components/FileInspector.vue` | Full path and scope (Task 9) |
| `src/ui/components/CameraControls.vue` | Compact overlay group (Task 10) |
| `src/ui/copy.ts` | New strings, all traced to `interactions/04-microcopy.md` (Tasks 5–9) |
| `src/ui/styles.css` | One named section per wave-2 task, in the existing `/* --- C0n … */` scheme |

---

# Wave 0 — the visual harness

## Task 0a: Spike — does headless Chromium draw WebGL?

**This is a spike. Its output is an answer, not code you keep.** Tasks 0b and 0c proceed either way; what the answer changes is whether wave 1's tasks can photograph their own work or must defer to the user's eye.

**Files:**
- Create (throwaway, deleted in step 5): `scripts/probe-webgl.mjs`
- Create (kept): `docs/superpowers/notes/2026-09-20-webgl-headless-spike.md`
- Modify: `package.json` (devDependency only)

**Interfaces:**
- Consumes: nothing.
- Produces: the note. Task 0c reads its `LAUNCH_ARGS` conclusion verbatim.

- [ ] **Step 1: Add `playwright-core` and install a browser**

`playwright-core`, **never `playwright`** — the latter downloads browsers during `npm install`, which must not happen on a machine with no browser.

```bash
npm install --save-dev --save-exact playwright-core@1.56.1
npx --yes playwright@1.56.1 install chromium
```

- [ ] **Step 2: Write the probe**

Create `scripts/probe-webgl.mjs`:

```js
// THROWAWAY. Deleted in step 5 of task 0a; its answer lives in
// docs/superpowers/notes/2026-09-20-webgl-headless-spike.md.
import { chromium } from 'playwright-core';

const PAGE = `data:text/html,<canvas id=c width=64 height=64></canvas><script>
  const gl = document.getElementById('c').getContext('webgl2');
  const out = { ok: false, renderer: null, pixel: null, reason: null };
  if (!gl) { out.reason = 'no webgl2 context'; }
  else {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    out.renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unmasked info unavailable';
    gl.clearColor(0.2, 0.6, 0.9, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const px = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    out.pixel = Array.from(px);
    out.ok = px[0] === 51 && px[1] === 153 && px[2] === 230;
    if (!out.ok) out.reason = 'readPixels did not return the cleared colour';
  }
  window.__probe = out;
<\/script>`;

const VARIANTS = [
  { name: 'default', args: [] },
  { name: 'swiftshader', args: ['--enable-unsafe-swiftshader'] },
  { name: 'angle-swiftshader', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
];

for (const variant of VARIANTS) {
  const browser = await chromium.launch({ args: variant.args });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(PAGE);
  const result = await page.evaluate(() => window.__probe);
  console.log(JSON.stringify({ variant: variant.name, args: variant.args, ...result, consoleErrors }, null, 2));
  await browser.close();
}
```

- [ ] **Step 3: Run the probe and read every variant**

```bash
node scripts/probe-webgl.mjs
```

Expected: three JSON blocks. The question is which variants report `"ok": true`, and what `renderer` each names. A `renderer` containing `SwiftShader` is the software path and is a **pass** — it draws, which is all the harness needs. `"ok": false` on every variant is the answer that matters, and it is a legitimate outcome.

- [ ] **Step 4: Record the answer**

Create `docs/superpowers/notes/2026-09-20-webgl-headless-spike.md` stating, for each variant: the exact args, `ok`, the `renderer` string, any console errors, the `playwright-core` version, the Chromium build Playwright resolved, and the OS. End with one section headed `Conclusion` naming either the `LAUNCH_ARGS` array Task 0c must use, or the sentence *"Headless Chromium cannot render WebGL on this machine; wave 1 captures are DOM-only and the canvas-internal findings stay with the user's eye."*

Write what the probe printed. **A spike that reports the hoped-for answer is worse than no spike**, because everything downstream is then built on it.

- [ ] **Step 5: Delete the probe and commit the answer**

```bash
rm scripts/probe-webgl.mjs
git add package.json package-lock.json docs/superpowers/notes/2026-09-20-webgl-headless-spike.md
git commit -F <message-file>
```

Commit message subject: `spike(harness): whether headless Chromium can draw our WebGL city`.

`git status` must show a clean tree. `scripts/probe-webgl.mjs` must not exist.

---

## Task 0b: The harness server and page

**Files:**
- Create: `vite.harness.config.ts`, `tests/harness/index.html`, `tests/harness/obsidian.css`, `tests/harness/harness.css`, `tests/harness/theme.ts`, `tests/harness/fixture.ts`, `tests/harness/mount.ts`, `tests/harness/page.ts`
- Modify: `package.json`
- Test: `tests/harness/harness.test.ts`

**Interfaces:**
- Consumes: `buildSnapshotFixture(spec)` from `tests/fixtures/snapshot-builder.ts`; `computeLayout(snapshot)` from `src/domain/layout/layout.ts`; `useCityStore().setCity(snapshot, layout)`; `createCityRenderer` from `src/visualization/city-renderer.ts`; `CITY_RENDERER_KEY`, `LAYOUT_GENERATION_KEY`, `createLayoutGenerationSource` from `src/ui/renderer-handle.ts`; `readPalette(containerEl)` from `src/host/theme-bridge.ts`.
- Produces:
  - `mountHarness(root: HTMLElement, options: HarnessOptions): Promise<void>` from `tests/harness/mount.ts`
  - `export interface HarnessOptions { screen: ScreenId; }`
  - `export type ScreenId = 's05' | 's06' | 's07' | 's08' | 's09' | 's10' | 's11'`
  - `applyWantedScheme(search: string): 'dark' | 'light'` and `applyScheme(scheme): void` from `tests/harness/theme.ts`
  - `harnessSnapshot(): CodebaseSnapshot` and `harnessLayout(): LayoutResult` from `tests/harness/fixture.ts`
  - The readiness mark `document.body.dataset.ciHarnessReady === 'true'`, set only after the city has drawn. Task 0c waits on `body[data-ci-harness-ready="true"]`.

- [ ] **Step 1: Vendor Obsidian's `app.css`**

`obsidian.asar` is at `C:\Users\LuisMendez\AppData\Local\Programs\Obsidian\resources\obsidian.asar` — **Obsidian 1.12.4**, which is the locally installed version and not the user's 1.13.7 host. The vendored file's header records that.

```bash
npx --yes @electron/asar extract-file \
  "C:/Users/LuisMendez/AppData/Local/Programs/Obsidian/resources/obsidian.asar" \
  app.css > tests/harness/obsidian.css
```

Prepend, as the first lines of the file:

```css
/* VENDORED, KEPT WHOLE. Obsidian 1.12.4's own app.css, extracted from
   resources/obsidian.asar on 2026-09-20. Not ours: never edited, never
   reformatted, never linted. It is here so the harness page has the host's real
   element defaults — button chrome included — which is what the plugin's own
   resets have to strip in a vault.

   It is 1.12.4 and the user's host is 1.13.7. Any claim resting on this file
   says so. */
```

Verify it is real and whole:

```bash
wc -l tests/harness/obsidian.css
grep -c -- "--background-primary" tests/harness/obsidian.css
```

Expected: thousands of lines, and a non-zero count for `--background-primary`. A count of 0 means the extraction produced something else — stop and report it rather than proceeding with a file that is not `app.css`.

- [ ] **Step 2: Write the failing test**

Create `tests/harness/harness.test.ts`:

```ts
// The harness is deliberately OUTSIDE `npm run verify` — it draws, it asserts no
// appearance, and there is no baseline to diff against. This file is what keeps it
// alive anyway: it runs under the ordinary suite, so a refactor that breaks the
// harness fails a test instead of being discovered the next time somebody wants a
// picture.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { harnessLayout, harnessSnapshot } from './fixture';
import { applyScheme } from './theme';

const indexHtml = readFileSync('tests/harness/index.html', 'utf8');

describe('harness page', () => {
  it('loads the three stylesheets in the order that makes the page real', () => {
    const hrefs = [...indexHtml.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    // Obsidian's own defaults FIRST, so our resets strip what they strip in a vault;
    // then the harness chrome; then the plugin sheet, which must win over both.
    expect(hrefs).toEqual(['./obsidian.css', './harness.css', '/styles.css']);
  });

  it('serves the plugin stylesheet from source, not from a build', () => {
    // `/styles.css` is answered by the config's own middleware from src/ui/styles.css
    // on disk. If this ever became `../../dist/styles.css`, the page would silently
    // show whatever was last built rather than what is being edited.
    const config = readFileSync('vite.harness.config.ts', 'utf8');
    expect(config).toContain('src/ui/styles.css');
    expect(config).not.toContain('dist/styles.css');
  });
});

describe('harness fixture', () => {
  it('is big enough to look like a codebase and small enough to stay deterministic', () => {
    const snapshot = harnessSnapshot();
    const layout = harnessLayout();
    const files = snapshot.entities.filter((e) => e.kind === 'file');
    expect(files.length).toBeGreaterThanOrEqual(140);
    expect(layout.lots).toHaveLength(files.length);
    expect(layout.districts.length).toBeGreaterThanOrEqual(6);
  });

  it('is deterministic — two builds produce identical layouts', () => {
    expect(JSON.stringify(harnessLayout())).toEqual(JSON.stringify(harnessLayout()));
  });

  it('carries at least one unavailable-metric file, so S05 shows the unknown encoding', () => {
    // interactions/03: "Do not use a 0-height building as a proxy for unknown." A
    // fixture with no unavailable file cannot photograph that rule being kept.
    expect(harnessLayout().lots.some((lot) => lot.metricState === 'unavailable')).toBe(true);
  });
});

describe('harness theme', () => {
  it('puts the host scheme classes on the body and nothing else', () => {
    applyScheme('light');
    expect(document.body.classList.contains('theme-light')).toBe(true);
    expect(document.body.classList.contains('theme-dark')).toBe(false);
    applyScheme('dark');
    expect(document.body.classList.contains('theme-dark')).toBe(true);
    expect(document.body.classList.contains('theme-light')).toBe(false);
  });
});
```

Add `'tests/harness/**/*.test.ts'` to the **jsdom** project's `include` array in `vitest.config.ts` — it reads the DOM.

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/harness/harness.test.ts
```

Expected: FAIL — `Cannot find module './fixture'` and `ENOENT: tests/harness/index.html`. If instead **every** test file in the run fails with a generic `TypeError`, that is the lowercase-drive-letter artifact: re-run from the uppercase path.

- [ ] **Step 4: Write the fixture**

Create `tests/harness/fixture.ts`:

```ts
// ONE deterministic snapshot, shaped like a real repository rather than like a
// minimal test case: the harness exists to be looked at, and a three-file city
// photographs nothing. 144 files over 6 districts matches the design package's own
// reference fixture, so a capture and `mockups/s05-city.png` are comparable as
// compositions.
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { LayoutResult } from '../../src/domain/layout/types';

export function harnessSnapshot(): CodebaseSnapshot {
  return buildSnapshotFixture({
    files: 144,
    directories: 6,
    repositoryId: 'harness-city',
    // One measured zero and three unavailable, so a capture shows the three distinct
    // metric states interactions/03 requires be distinguishable — a measured 0 is not
    // an unknown, and neither is drawn as the other.
    measuredZero: 1,
    unavailable: 3,
  });
}

export function harnessLayout(): LayoutResult {
  return computeLayout(harnessSnapshot());
}
```

Check `computeLayout`'s actual signature before writing this — if it takes `(snapshot, opts)`, pass no opts, which selects `physical-lines` (the default per ruling M14).

- [ ] **Step 5: Write the theme module**

Create `tests/harness/theme.ts`:

```ts
// Obsidian signals a palette change with a `css-change` workspace event carrying no
// payload; `city-view.ts` responds by calling `readPalette` again and forwarding the
// result to `setColors`. There is no workspace here, so the harness fires a plain DOM
// event and `mount.ts` does the same two steps. Without this, switching scheme would
// restyle every HTML surface and leave the WebGL city in the old palette — the exact
// split the design package's "theme changes must recolor materials AND labels" rule is
// about.
export type Scheme = 'dark' | 'light';

export const HARNESS_THEME_EVENT = 'ci-harness-theme';

const SCHEMES: readonly Scheme[] = ['dark', 'light'];

export function wantedScheme(search: string): Scheme {
  const asked = new URLSearchParams(search).get('theme');
  return SCHEMES.find((scheme) => scheme === asked) ?? 'dark';
}

export function applyScheme(scheme: Scheme): void {
  document.body.classList.toggle('theme-dark', scheme === 'dark');
  document.body.classList.toggle('theme-light', scheme === 'light');
  window.dispatchEvent(new Event(HARNESS_THEME_EVENT));
}

export function applyWantedScheme(search: string): Scheme {
  const scheme = wantedScheme(search);
  applyScheme(scheme);
  return scheme;
}
```

- [ ] **Step 6: Write the mount**

Create `tests/harness/mount.ts`. It mounts the **real** `App.vue` — not a stand-in — with its own Pinia, the real renderer factory, and the shared handles `App.vue` expects:

```ts
import { createApp, nextTick, shallowRef } from 'vue';
import { createPinia } from 'pinia';
import App from '../../src/ui/App.vue';
import { createCityRenderer } from '../../src/visualization/city-renderer';
import {
  CITY_RENDERER_KEY, LAYOUT_GENERATION_KEY, createLayoutGenerationSource,
} from '../../src/ui/renderer-handle';
import { readPalette } from '../../src/host/theme-bridge';
import { useCityStore } from '../../src/ui/stores/city-store';
import { harnessLayout, harnessSnapshot } from './fixture';
import { HARNESS_THEME_EVENT } from './theme';
import type { CityRendererPort } from '../../src/visualization/renderer-port';

export type ScreenId = 's05' | 's06' | 's07' | 's08' | 's09' | 's10' | 's11';

export interface HarnessOptions {
  screen: ScreenId;
}

export async function mountHarness(root: HTMLElement, options: HarnessOptions): Promise<void> {
  root.classList.add('codebase-inspector-root');

  const app = createApp(App);
  app.use(createPinia());

  const handle = shallowRef<CityRendererPort | null>(null);
  app.provide(CITY_RENDERER_KEY, handle);
  app.provide(LAYOUT_GENERATION_KEY, createLayoutGenerationSource());
  // S11 is the WebGL-unavailable screen, and the honest way to reach it is to supply
  // no factory at all — CityViewport's `inject('createCityRenderer', null)` default is
  // exactly the "no renderer available" path. Faking it with a throwing factory would
  // photograph error recovery instead of the fallback.
  if (options.screen !== 's11') app.provide('createCityRenderer', createCityRenderer);

  app.mount(root);

  const store = useCityStore();
  store.setCity(harnessSnapshot(), harnessLayout());

  applyScreenState(store, options.screen);

  // The renderer re-reads its palette on Obsidian's `css-change`; here, on ours.
  window.addEventListener(HARNESS_THEME_EVENT, () => {
    handle.value?.setColors(readPalette(root));
  });

  await waitUntilDrawn(root, options.screen);
  document.body.dataset.ciHarnessReady = 'true';
}
```

`applyScreenState` drives the store the way a user would, one screen at a time:

```ts
function applyScreenState(store: ReturnType<typeof useCityStore>, screen: ScreenId): void {
  const firstFile = store.layout?.lots[0]?.entityId ?? null;
  switch (screen) {
    case 's07':
      if (firstFile) { store.select(firstFile); store.openInspector(); }
      break;
    case 's08':
      // A query that matches some files and not the selected one, which is what puts
      // COPY-30's "outside these filters" notice on screen — one of the two surfaces
      // Task 9 turns into real controls.
      if (firstFile) store.select(firstFile);
      store.setQuery('main');
      store.confirmSearch();
      break;
    case 's09':
      store.setViewMode('top');
      break;
    case 's11':
      store.setViewMode('list');
      break;
    default:
      break;                                   // s05, s06 and s10 are the resting state
  }
}
```

`waitUntilDrawn` is what makes a capture trustworthy. **Waiting for the canvas element to exist is not waiting for the city to draw** — that is the mistake the source harness records paying for:

```ts
async function waitUntilDrawn(root: HTMLElement, screen: ScreenId): Promise<void> {
  await nextTick();
  if (screen === 's11') {
    // No canvas by design. The fallback list IS the drawn state.
    await until(() => root.querySelector('.ci-file-list__row') !== null);
    return;
  }
  await until(() => {
    const canvas = root.querySelector('canvas');
    // A canvas with a zero-sized drawing buffer has not drawn; a canvas sized to the
    // stage has. This is the difference between photographing the city and
    // photographing an empty box that will contain one shortly.
    return canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0;
  });
  // One more frame after the buffer exists, so what is photographed is a drawn frame
  // rather than a cleared one.
  await new Promise<void>((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(() => resolve()); }); });
}

async function until(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('the harness never reached its drawn state; a capture would photograph a loading frame');
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
}
```

- [ ] **Step 7: Write the page, the chrome and the entry HTML**

Create `tests/harness/page.ts`:

```ts
// A query parameter rather than a page per screen, for one reason: a headless
// screenshot needs a URL and nothing to click.
//   ?screen=s05..s11   which screen state to seed
//   ?theme=dark|light  which host scheme (default dark)
//   ?width=<px>        the leaf box's width, for the narrow screen
import { applyWantedScheme } from './theme';
import { mountHarness, type ScreenId } from './mount';

const SCREENS: readonly ScreenId[] = ['s05', 's06', 's07', 's08', 's09', 's10', 's11'];

const params = new URLSearchParams(window.location.search);
const asked = params.get('screen');
const screen: ScreenId = SCREENS.find((s) => s === asked) ?? 's05';

// S06 is the light screen by definition, so it carries its own scheme rather than
// requiring every caller to remember `&theme=light` — a capture that forgot would be
// named s06 and show the dark city, which is worse than no capture.
applyWantedScheme(screen === 's06' ? '?theme=light' : window.location.search);

const leaf = document.body.createDiv({ cls: 'ci-harness-leaf' });
const width = params.get('width');
if (width !== null && /^\d+$/.test(width)) leaf.style.width = `${width}px`;

void mountHarness(leaf, { screen });
```

`document.body.createDiv` is Obsidian's prototype extension. The harness page has no Obsidian, so `tests/mocks/dom-extensions.ts` must be imported first — check whether it self-installs on import, and if it exports an installer, call it as the first statement of `page.ts`. Use a plain `document.createElement` + `append` if neither is available; do **not** invent a second copy of the extension.

Create `tests/harness/harness.css`:

```css
/* The harness's own chrome only. It restates nothing obsidian.css already says, and
   it never styles anything inside .codebase-inspector-root — the whole point is to
   look at the plugin's own sheet doing its job. */
body { margin: 0; }
.ci-harness-leaf {
  /* A workspace leaf's own box. Obsidian's .view-content is height:100% inside a
     definite-height flex column, which is what makes the plugin's own `height: 100%`
     resolve; the harness has to supply the same definite height or the stage chain
     behaves differently here than in the host — and the height chain is precisely
     where this branch has already been bitten. */
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;
}
.ci-harness-leaf > .codebase-inspector-root { flex: 1 1 auto; min-height: 0; }
```

Create `tests/harness/index.html`:

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Codebase Inspector — harness</title>
		<!-- An empty icon, so no browser fetches /favicon.ico on its own: that request
		     404s, and scripts/harness-shot.mjs treats a console error as a real one. -->
		<link rel="icon" href="data:," />
		<!-- The ORDER is load-bearing and tests/harness/harness.test.ts pins it.
		     Obsidian's real app.css first, so element defaults are the host's; then the
		     harness chrome; then the plugin's own sheet, which must win over both. -->
		<link rel="stylesheet" href="./obsidian.css" />
		<link rel="stylesheet" href="./harness.css" />
		<link rel="stylesheet" href="/styles.css" />
	</head>
	<body class="theme-dark">
		<script type="module" src="./page.ts"></script>
	</body>
</html>
```

- [ ] **Step 8: Write the harness Vite config**

Create `vite.harness.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * The browser harness: the real view, the real stylesheet and Obsidian's own app.css,
 * in a browser, with no Obsidian. `npm run harness` starts it and prints the URL.
 *
 * What it is NOT: a test. Nothing here asserts what gets drawn, there is no baseline
 * to diff against, and it is deliberately outside `npm run verify`. The check that
 * keeps it alive is `tests/harness/harness.test.ts`, which vitest already runs.
 *
 * It changes nothing about what `npm run build` emits. `vite.config.ts` is untouched
 * and `dist/` must be byte-identical across the whole of wave 0.
 */
const obsidianMock = fileURLToPath(new URL('./tests/mocks/obsidian.ts', import.meta.url));
const pluginStylesheet = fileURLToPath(new URL('./src/ui/styles.css', import.meta.url));

/** Answers the page's `/styles.css` from src/ui/styles.css ON DISK, so what is on
 *  screen is the CSS being edited and never a stale build. */
function pluginStyles() {
  return {
    name: 'ci-plugin-styles',
    configureServer(server) {
      server.middlewares.use('/styles.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css');
        res.end(readFileSync(pluginStylesheet, 'utf8'));
      });
      server.watcher.add(pluginStylesheet);
    },
  };
}

export default defineConfig({
  root: 'tests/harness',
  // The same alias vitest uses. `tests/mocks/obsidian.ts` is the ONE stand-in; a
  // second one here would be a second answer that can disagree with the suite's.
  resolve: { alias: { obsidian: obsidianMock } },
  server: {
    // mount.ts, the fixtures and src/ are all outside `root`.
    fs: { allow: ['..', '../..'] },
  },
  plugins: [vue(), pluginStyles()],
});
```

Add to `package.json` scripts: `"harness": "vite --config vite.harness.config.ts"`.

- [ ] **Step 9: Run the test to verify it passes**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/harness/harness.test.ts
```

Expected: PASS, all six tests.

- [ ] **Step 10: Look at it, which is the point**

```bash
cd "C:/Projects/codebase-inspector" && npm run harness
```

Open each of `?screen=s05`, `s06`, `s07`, `s08`, `s09`, `s10&width=700`, `s11`. Every one must draw. **Report what you see, including anything that looks wrong** — that is this task's real deliverable, and several of §3's findings should be visible in it.

- [ ] **Step 11: Prove the build is untouched**

```bash
cd "C:/Projects/codebase-inspector" && npm run build && ls -l dist/ && sha256sum dist/main.js
```

Expected: `dist/` holds exactly `main.js`, `manifest.json`, `styles.css`, and `main.js` is **781,437 bytes** with sha256 beginning `c86ad07c`. A different size or hash means the harness config leaked into the production build — stop and report it.

- [ ] **Step 12: Full verification and commit**

```bash
cd "C:/Projects/codebase-inspector" && npm run verify
grep -rn "eslint-disable" src/ tests/ | wc -l    # expect 2
grep -rn "@ts-expect-error" src/ tests/ | wc -l  # expect 1
```

Check every changed file for NUL bytes, then:

```bash
git add vite.harness.config.ts tests/harness/ package.json vitest.config.ts
git commit -F <message-file>
```

Subject: `feat(harness): serve the real view in a browser, with Obsidian's app.css and no Obsidian`.

---

## Task 0c: The headless capture script

**Files:**
- Create: `scripts/chromium.mjs`, `scripts/harness-shot.mjs`
- Modify: `package.json`, `.gitignore`
- Test: `tests/build/harness-shot.test.ts`

**Interfaces:**
- Consumes: `body[data-ci-harness-ready="true"]` from Task 0b; the `LAUNCH_ARGS` conclusion from Task 0a's note.
- Produces: `npm run harness-shot` writing `harness-shots/<id>.png`; `resolveChromiumExecutable(): string` from `scripts/chromium.mjs`; `SHOTS` exported from `scripts/harness-shot.mjs` for the test to read.

- [ ] **Step 1: Write the failing test**

Create `tests/build/harness-shot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHOTS } from '../../scripts/harness-shot.mjs';

const source = readFileSync('scripts/chromium.mjs', 'utf8');

describe('harness-shot SHOTS', () => {
  it('covers every one of the seven city screens', () => {
    const screens = new Set(SHOTS.map((shot) => new URLSearchParams(shot.query).get('screen')));
    expect([...screens].toSorted()).toEqual(['s05', 's06', 's07', 's08', 's09', 's10', 's11']);
  });

  it('gives every shot a unique id, because the id is the filename', () => {
    const ids = SHOTS.map((shot) => shot.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('captures the default city in both schemes', () => {
    // S06 is the light screen, but the point of a scheme pair is the SAME screen in
    // both — a light-theme regression in S05's composition is invisible otherwise.
    const s05 = SHOTS.filter((shot) => new URLSearchParams(shot.query).get('screen') === 's05');
    const themes = new Set(s05.map((shot) => new URLSearchParams(shot.query).get('theme')));
    expect(themes).toEqual(new Set(['dark', 'light']));
  });
});

describe('chromium resolution', () => {
  it('asks playwright-core where the browser is rather than mirroring its layout', () => {
    // A hand-mirrored per-platform table broke on Windows in the project this pattern
    // came from, when Playwright renamed every build directory. The rule is that no
    // browser-layout literal is written down here.
    expect(source).toContain('executablePath');
    expect(source).not.toMatch(/chromium[-_]\d+/);
    expect(source).not.toContain('chrome-win');
    expect(source).not.toContain('chrome-linux');
    expect(source).not.toContain('chrome-mac');
  });
});
```

Add `'tests/build/**/*.test.ts'` to the **node** project's `include` array in `vitest.config.ts`.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/build/harness-shot.test.ts
```

Expected: FAIL — `Cannot find module '../../scripts/harness-shot.mjs'`.

- [ ] **Step 3: Write the browser resolver**

Create `scripts/chromium.mjs`:

```js
import { statSync } from 'node:fs';
import { chromium } from 'playwright-core';

/**
 * Where a headless capture's browser comes from — ASKED of playwright-core rather than
 * assembled here.
 *
 * `chromium.executablePath()` is a pure path computation: it honours
 * PLAYWRIGHT_BROWSERS_PATH, applies the revision this repository's playwright-core
 * pins, and knows the per-platform directory layout. It does NOT throw when the
 * browser is absent — it returns the path the browser WOULD be at, which is why the
 * existence check below is this function's own job and why the error can name the
 * exact path it wanted.
 *
 * What is deliberately NOT done: hunting a DIFFERENT revision on disk when the pinned
 * one is missing. Capturing with a Chromium the project did not pin is a quieter
 * problem than not capturing — an unannounced substitution renders a picture somebody
 * then reasons about as if it were the pinned browser's. CHROMIUM_OVERRIDE is the one
 * door out of that, and it differs from hunting in both halves: a person names the
 * build, and the capture says out loud that it is not the pinned one.
 */
export function resolveChromiumExecutable() {
  const override = process.env.CHROMIUM_OVERRIDE;
  if (override) {
    console.warn(`harness-shot: using CHROMIUM_OVERRIDE at ${override}, NOT the pinned build`);
    return override;
  }
  const wanted = chromium.executablePath();
  try {
    statSync(wanted);
  } catch {
    throw new Error(
      `harness-shot: no Chromium at ${wanted}. Run \`npx playwright install chromium\`, ` +
      'or set CHROMIUM_OVERRIDE to a browser you have named yourself.',
    );
  }
  return wanted;
}
```

- [ ] **Step 4: Write the capture script**

Create `scripts/harness-shot.mjs`. `LAUNCH_ARGS` comes from Task 0a's note — copy the conclusion's array, and cite the note in the comment:

```js
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { resolveChromiumExecutable } from './chromium.mjs';

/**
 * Headless capture of the browser harness, so a look at this plugin costs nobody a
 * GUI. Writes one PNG per entry below into harness-shots/.
 *
 * What this is NOT: a test. It draws; it asserts no appearance, and there is no
 * baseline to diff against — the same reason `npm run harness` is outside
 * `npm run verify`. It is deliberately absent from the gate. It exits non-zero on a
 * page error or an uncaught console error, which is a narrower claim than "the page
 * looks right": only that it did not fall over while being looked at.
 *
 * A harness capture is evidence about OUR PAGE IN A BROWSER. It is not evidence about
 * Obsidian: no host integration, no third-party theme, no real GPU, and an app.css
 * vendored from 1.12.4 while the user's host is 1.13.7. Every report that attaches one
 * says so.
 */
const OUT_DIR = 'harness-shots';
const VIEWPORT = { width: 1280, height: 800 };

// From docs/superpowers/notes/2026-09-20-webgl-headless-spike.md's Conclusion. Do not
// change these without re-running that spike — a wrong flag here does not error, it
// photographs a blank canvas.
const LAUNCH_ARGS = [/* the spike's answer */];

export const SHOTS = [
  { id: 's05-city-dark', query: '?screen=s05&theme=dark' },
  { id: 's05-city-light', query: '?screen=s05&theme=light' },
  { id: 's06-city-light', query: '?screen=s06' },
  { id: 's07-selected-dark', query: '?screen=s07&theme=dark' },
  { id: 's07-selected-light', query: '?screen=s07&theme=light' },
  { id: 's08-search-dark', query: '?screen=s08&theme=dark' },
  { id: 's09-top-dark', query: '?screen=s09&theme=dark' },
  { id: 's10-narrow-dark', query: '?screen=s10&theme=dark&width=700', viewport: { width: 760, height: 900 } },
  { id: 's11-fallback-dark', query: '?screen=s11&theme=dark' },
  { id: 's11-fallback-light', query: '?screen=s11&theme=light' },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await createServer({ configFile: 'vite.harness.config.ts', server: { open: false } });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');

  const browser = await chromium.launch({ executablePath: resolveChromiumExecutable(), args: LAUNCH_ARGS });
  const failures = [];

  for (const shot of SHOTS) {
    const page = await browser.newPage({ viewport: shot.viewport ?? VIEWPORT });
    const problems = [];
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });

    try {
      await page.goto(`${base}/${shot.query}`, { waitUntil: 'load' });
      // The readiness mark, not the canvas element: mount.ts sets it only after the
      // drawing buffer is sized AND two frames have passed. Waiting on the element
      // would photograph a box that is about to contain a city.
      await page.waitForSelector('body[data-ci-harness-ready="true"]', { timeout: 20_000 });
      await page.screenshot({ path: path.join(OUT_DIR, `${shot.id}.png`) });
      console.log(`harness-shot: wrote ${shot.id}.png`);
    } catch (error) {
      problems.push(`capture: ${error.message}`);
    }

    if (problems.length > 0) failures.push({ id: shot.id, problems });
    await page.close();
  }

  await browser.close();
  await server.close();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`harness-shot: ${failure.id}\n  ${failure.problems.join('\n  ')}`);
    process.exitCode = 1;
  }
}

await main();
```

Add to `package.json` scripts: `"harness-shot": "node scripts/harness-shot.mjs"`. Add `harness-shots/` to `.gitignore` — captures are evidence attached to a report, not tree content.

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/build/harness-shot.test.ts
```

Expected: PASS, all four tests.

- [ ] **Step 6: Take the baseline captures**

```bash
cd "C:/Projects/codebase-inspector" && npm run harness-shot
ls -l harness-shots/
```

Expected: exit 0 and ten PNGs. **Open every one.** A PNG that exists is not a PNG that shows the city — if `s05-city-dark.png` has an empty stage, Task 0a's `LAUNCH_ARGS` conclusion is wrong or WebGL is unavailable, and that is a finding to report, not to work around.

These ten are **the wave-0 baseline**. Every later task compares against them.

- [ ] **Step 7: Mutation-verify the readiness wait**

A green capture proves nothing until its hazard has been made real. Temporarily change `mount.ts`'s readiness mark to be set **before** `waitUntilDrawn` rather than after, re-run `npm run harness-shot`, and confirm the captures now show an undrawn stage. Then **restore `mount.ts` by copying from a plain backup taken immediately before that edit** — not with any git verb.

Record both the broken capture's appearance and the restored state in the task report.

- [ ] **Step 8: Full verification and commit**

```bash
cd "C:/Projects/codebase-inspector" && npm run verify
grep -rn "eslint-disable" src/ tests/ | wc -l    # expect 2
grep -rn "@ts-expect-error" src/ tests/ | wc -l  # expect 1
git status --short                                # harness-shots/ must NOT appear
```

Check for NUL bytes, then commit. Subject: `feat(harness): headless capture of all seven city screens`.

---

# Wave 1 — renderer and layout

Tasks 1–4 own disjoint files and may run in parallel, with one exception: **Task 1 is the only wave-1 task that edits `src/ui/styles.css`.** No wave-2 task starts until wave 1 is complete.

Every wave-1 task ends by running `npm run harness-shot` and attaching the before/after captures of the screens it changed, labelled as harness captures.

## Task 1: District label chips

Addresses finding **F1**: `src`/`application`/`commands` stack into illegible overlapping text, and labels carry no file count.

**M103 is not touched.** `MIN_DISTRICT_FOOTPRINT_CSS_PX = 48` is the rule about *when* a label draws. This task changes *how* a drawn label presents, and adds a rule about what happens when two drawn labels collide.

**Files:**
- Modify: `src/visualization/label-overlay.ts`, `src/visualization/city-renderer.ts:254`, `src/ui/styles.css` (the `.ci-city-labels__label` block at line ~362)
- Test: `tests/component/label-overlay.test.ts`

**Interfaces:**
- Consumes: `CityDistrict` (`directoryId`, `name`, `extent`, `labelAnchor`) and `CityLot.directoryId` from `src/domain/layout/types.ts`. **`CityDistrict` is a §4.3 type and is NOT extended** — the file count is derived from `layout.lots` by the caller and passed alongside, never added as a field.
- Produces: `LabelOverlay.setDistricts(districts: readonly CityDistrict[], fileCounts: ReadonlyMap<EntityId, number>): void` — a widened signature on an interface internal to `src/visualization/`, not on `CityRendererPort`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/component/label-overlay.test.ts`:

```ts
it('gives every label its district name and its file count', () => {
  const overlay = createLabelOverlay(mount);
  overlay.setDistricts(
    [district({ directoryId: 'd1', name: 'src/domain', extent: [200, 200] })],
    new Map([['d1', 24]]),
  );
  const label = mount.querySelector('.ci-city-labels__label');
  expect(label?.querySelector('.ci-city-labels__name')?.textContent).toBe('src/domain');
  // "24 files", not "24": a bare number beside a directory name reads as a size, a
  // line count or an index. The design's own chip says what it counts.
  expect(label?.querySelector('.ci-city-labels__count')?.textContent).toBe('24 files');
});

it('says "1 file", not "1 files"', () => {
  const overlay = createLabelOverlay(mount);
  overlay.setDistricts([district({ directoryId: 'd1', name: 'src', extent: [200, 200] })], new Map([['d1', 1]]));
  expect(mount.querySelector('.ci-city-labels__count')?.textContent).toBe('1 file');
});

it('hides the lower-priority label when two would overlap on screen', () => {
  // F1: three districts whose anchors project to nearly the same point produced
  // "src"/"application"/"commands" stacked into unreadable mush on the user's own
  // tree. Both are legible by M103's budget; the overlap is a second, independent
  // question, and the answer is that only the largest district keeps its label.
  const overlay = createLabelOverlay(mount);
  overlay.setDistricts([
    district({ directoryId: 'big', name: 'src', extent: [400, 400], labelAnchor: [0, 0, 0] }),
    district({ directoryId: 'small', name: 'application', extent: [120, 120], labelAnchor: [0.2, 0, 0.2] }),
  ], new Map([['big', 60], ['small', 12]]));

  overlay.update(orthographicCameraLookingDown(), 1280, 800);

  const shown = [...mount.querySelectorAll('.ci-city-labels__label')].filter((el) => !(el as HTMLElement).hidden);
  expect(shown).toHaveLength(1);
  expect(shown[0]?.textContent).toContain('src');
});

it('reveals the suppressed label again once the districts no longer overlap', () => {
  // The suppression must be self-revealing for the same reason M103's budget is: a
  // label permanently removed is a label the user cannot get back by zooming.
  const overlay = createLabelOverlay(mount);
  overlay.setDistricts([
    district({ directoryId: 'big', name: 'src', extent: [400, 400], labelAnchor: [0, 0, 0] }),
    district({ directoryId: 'small', name: 'application', extent: [120, 120], labelAnchor: [0.2, 0, 0.2] }),
  ], new Map([['big', 60], ['small', 12]]));

  overlay.update(orthographicCameraLookingDown(), 1280, 800);
  overlay.update(orthographicCameraZoomedIn(), 1280, 800);

  const shown = [...mount.querySelectorAll('.ci-city-labels__label')].filter((el) => !(el as HTMLElement).hidden);
  expect(shown).toHaveLength(2);
});
```

Reuse the file's existing `district(...)` and camera helpers; if it has none, write them at the top of the file rather than inline in each test.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/label-overlay.test.ts
```

Expected: FAIL — `setDistricts` takes one argument, and there is no `.ci-city-labels__name`.

- [ ] **Step 3: Implement**

In `label-overlay.ts`:

- Widen `setDistricts` to `(districts, fileCounts)`.
- Build each label as two spans rather than a text node:
  ```ts
  const el = root.createDiv({ cls: 'ci-city-labels__label' });
  el.createSpan({ cls: 'ci-city-labels__name', text: district.name });
  const count = fileCounts.get(district.directoryId) ?? 0;
  el.createSpan({ cls: 'ci-city-labels__count', text: count === 1 ? '1 file' : `${count} files` });
  ```
- Add `area: district.extent[0] * district.extent[1]` to `LabelRecord`, and sort `records` by descending area once in `setDistricts` so the collision pass has a stable priority order that does not depend on district iteration order.
- In `update`, after computing each record's `show` and screen position, run one collision pass over the records that want to show, in the existing (area-descending) order: keep a list of accepted screen rects, and clear `show` for any record whose rect intersects an accepted one. Measure each rect from `record.el.offsetWidth`/`offsetHeight` — cache it on the record and re-measure only when the label's text changes, since a per-frame `offsetWidth` read forces layout, which is exactly the cost ruling I3 removed.

In `city-renderer.ts:254`, derive the counts from the layout the renderer already holds:

```ts
const fileCounts = new Map<EntityId, number>();
for (const lot of source.lots) fileCounts.set(lot.directoryId, (fileCounts.get(lot.directoryId) ?? 0) + 1);
overlay.setDistricts(source.districts, fileCounts);
```

In `styles.css`, turn `.ci-city-labels__label` into a chip. The existing rule sets colour-free legibility properties and inherits `color` from the overlay root at runtime — **keep that**, and keep the `text-shadow`, because a chip that fails to paint still has to be readable:

```css
:where(.codebase-inspector-root) .ci-city-labels__label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: var(--ci-space-1) var(--ci-space-2);
  border-radius: var(--ci-radius-small);
  /* The chip's own ground. `--ci-panel` over an arbitrary district colour, with the
     border carrying the edge — foundations/03 prefers borders and spacing over
     layered shadows, and a shadow here would sit on the canvas's compositing path. */
  background: var(--ci-panel);
  border: 1px solid var(--ci-border);
  font-size: var(--font-ui-smaller, 0.8em);
  font-weight: 600;
  letter-spacing: 0.02em;
  text-shadow: 0 0 3px var(--ci-surface), 0 1px 2px var(--ci-surface);
}
:where(.codebase-inspector-root) .ci-city-labels__count {
  font-weight: 400;
  opacity: 0.75;
}
```

`.ci-city-labels__label` is a `div` inside an `aria-hidden` overlay that Obsidian styles nothing in, so **M113's element-selector escalation does not apply here** — state that in the report rather than applying the recipe reflexively.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/label-overlay.test.ts tests/unit/city-renderer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Mutation-verify the collision rule**

Break **the thing the test watches**, not the test: move the two districts' `labelAnchor` values apart so they no longer overlap, and confirm the overlap test goes red saying it found two labels where it wanted one. Then restore from a backup copy taken immediately before that edit. Record the red output.

- [ ] **Step 6: Capture, verify and commit**

```bash
cd "C:/Projects/codebase-inspector" && npm run harness-shot && npm run verify
grep -rn "eslint-disable" src/ tests/ | wc -l    # expect 2
grep -rn "@ts-expect-error" src/ tests/ | wc -l  # expect 1
```

Attach `s05-city-dark.png` and `s09-top-dark.png` before and after. Check NUL bytes. Commit; subject: `fix(labels): give district labels a chip, a file count and a collision rule`.

---

## Task 2: The root district's footprint

Addresses finding **F2**: the ground plate is substantially larger than the built area, leaving the lower half of the diamond empty.

**`camera-rig.fit()` and `camera-framing.ts` are correct and are NOT touched** (spec §3.3). `fit()` frames the projected silhouette of `layout.bounds`, and `computeBounds` derives those from district extents. The oversized plate is the cause and the bounds are the symptom.

**Files:**
- Modify: `src/domain/layout/districts.ts`
- Test: `tests/unit/layout-districts.test.ts`

**Interfaces:**
- Consumes: `CodeEntity`, `Observation`, `MetricLookup`.
- Produces: no signature change. `CityDistrict.extent` values change; `LayoutResult`'s shape does not.

- [ ] **Step 1: Measure before you change anything**

Write a temporary measurement — not a committed test — that builds the harness fixture's layout and prints, for every district: `name`, `depth`, `extent`, and the bounding box of the lots and child districts actually inside it.

**Report the numbers.** If the root district's extent already equals its children's bounding box plus padding, this task's premise is wrong — say so and stop, rather than changing a correct packing to chase a symptom whose cause is elsewhere.

- [ ] **Step 2: Write the failing test**

Append to `tests/unit/layout-districts.test.ts`:

```ts
it('sizes every district to what it actually contains', () => {
  // F2. The district slab is DRAWN at `extent` (instanced-city.ts's slab instance) and
  // `computeBounds` derives layout.bounds from the same numbers, so an extent larger
  // than its contents is both the empty plate the user sees and the reason `fit()`
  // frames more than the city.
  const snapshot = buildSnapshotFixture({ files: 144, directories: 6, repositoryId: 'r' });
  const layout = computeLayout(snapshot);

  for (const district of layout.districts) {
    const contained = contentsOf(layout, district);     // lots + child districts, as a rect
    if (contained === null) continue;                   // an empty district is its own minimum
    expect(district.extent[0]).toBeGreaterThanOrEqual(contained.width);
    expect(district.extent[1]).toBeGreaterThanOrEqual(contained.depth);
    // The slack is the declared padding, not an arbitrary margin.
    expect(district.extent[0]).toBeLessThanOrEqual(contained.width + 2 * DISTRICT_PADDING + 1);
    expect(district.extent[1]).toBeLessThanOrEqual(contained.depth + 2 * DISTRICT_PADDING + LABEL_HEIGHT + 1);
  }
});

it('leaves no district extending past its own contents by more than a third', () => {
  // The blunt version of the same claim, stated as a ratio so a regression is legible
  // in the failure message rather than in a coordinate.
  const layout = computeLayout(buildSnapshotFixture({ files: 144, directories: 6, repositoryId: 'r' }));
  const root = layout.districts.find((d) => d.parentId === null);
  expect(root).toBeDefined();
  const contained = contentsOf(layout, root!)!;
  expect(root!.extent[0] * root!.extent[1]).toBeLessThan(contained.width * contained.depth * 1.33);
});
```

Write `contentsOf(layout, district)` as a helper in the test file: the union of the axis-aligned footprints of every lot whose `directoryId` is this district, and every district whose `parentId` is this district. Return `null` when both are empty.

Export `DISTRICT_PADDING` and `LABEL_HEIGHT` from `districts.ts` if they are not already exported.

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/unit/layout-districts.test.ts
```

Expected: FAIL, with the root district's extent exceeding its contents. Record the actual numbers.

- [ ] **Step 4: Implement**

In `districts.ts`, after a district's children and lots are placed, set its `extent` from their union plus `DISTRICT_PADDING` (and `LABEL_HEIGHT` on the depth axis) rather than from whatever the shelf-packing reserved. Recentre `center` and `labelAnchor` on the new extent so the slab stays under its contents.

Do not change `LOT_FOOTPRINT`, `UNAVAILABLE_FOOTPRINT`, `GUTTER`, `MAX_DIRECT_SUBDISTRICTS` or the shelf-packing order — layout determinism is pinned by `tests/unit/layout-determinism.test.ts` and the packing itself is not the defect.

- [ ] **Step 5: Run the whole layout suite**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/unit/layout-districts.test.ts tests/unit/layout-determinism.test.ts tests/unit/layout-budget.test.ts
```

Expected: PASS. **If a pre-existing test fails because it asserted the old extents, that is a finding to report with its citation, not a test to edit** — bring it to review with the exact assertion and the old and new numbers.

- [ ] **Step 6: Capture, verify and commit**

Attach `s05-city-dark.png` and `s09-top-dark.png` before and after; the top-down view is where an oversized plate is most visible. Run `npm run verify`, state the two counts, check NUL bytes, commit.

Subject: `fix(layout): size each district to its contents, so the plate is the city`.

---

## Task 3: Light-theme figure and ground

Addresses finding **F3**: in light theme the district slab and the page background are both near-white, leaving almost no separation.

The tokens are already right — `districtSurface` is `--ci-panel` → `--background-secondary`, and `background` is `--ci-surface` → `--background-primary`. **The fix is not a new token and not an eleventh palette member** (A1). It is a renderer-side guarantee that the slab is separated from the ground it sits on, whatever the two host values happen to be.

**Files:**
- Modify: `src/visualization/color.ts`, `src/visualization/instanced-city.ts:207`
- Test: `tests/unit/color.test.ts`, `tests/unit/city-renderer.test.ts`

**Interfaces:**
- Consumes: `CityPalette.districtSurface`, `CityPalette.background`.
- Produces: `separatedFrom(surface: string, ground: string, minDelta?: number): string` from `src/visualization/color.ts` — a pure function returning an sRGB hex string.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/color.test.ts`:

```ts
describe('separatedFrom', () => {
  it('leaves a surface alone when it is already separated from its ground', () => {
    // Dark theme: a slab a few points off its ground is faint but present, and the
    // host's own choice is not ours to overrule when it is working.
    expect(separatedFrom('#2a2a2e', '#151518')).toBe('#2a2a2e');
  });

  it('lightens a near-white surface away from a white ground', () => {
    // F3, light theme: --background-secondary and --background-primary land within a
    // point or two of each other, and the plate disappears.
    const out = separatedFrom('#fcfcfd', '#ffffff');
    expect(out).not.toBe('#fcfcfd');
    expect(relativeLuminance(out)).toBeLessThan(relativeLuminance('#ffffff'));
  });

  it('moves AWAY from the ground rather than in a fixed direction', () => {
    // A fixed "darken by n" would be right in light and wrong in dark, which is the
    // shape of bug that makes one theme look deliberate and the other look broken.
    expect(relativeLuminance(separatedFrom('#101010', '#0a0a0a'))).toBeGreaterThan(relativeLuminance('#101010'));
    expect(relativeLuminance(separatedFrom('#f0f0f0', '#f6f6f6'))).toBeLessThan(relativeLuminance('#f0f0f0'));
  });

  it('returns a value the GPU path already accepts', () => {
    // A1: colours cross into WebGL through cssColorToSrgbBytes and nowhere else. A
    // return value that function cannot parse would fall back to neutral grey, which
    // looks like this task working and is not.
    const out = separatedFrom('#fcfcfd', '#ffffff');
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
  });
});
```

Add `relativeLuminance` to the test file if `color.ts` does not already export one.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/unit/color.test.ts
```

Expected: FAIL — `separatedFrom is not a function`.

- [ ] **Step 3: Implement**

In `color.ts`, add `separatedFrom`. Compute the WCAG relative luminance of both inputs; if the absolute difference is at least `minDelta` (default `0.045` — state the number as a decision in the comment, with the reason, not as a constant with no reason), return `surface` unchanged. Otherwise move `surface` **away from** `ground` along luminance until the delta is met, clamping at black and white.

In `instanced-city.ts`, at the `setColors` site:

```ts
slabMaterial.color = new Color(separatedFrom(palette.districtSurface, palette.background));
```

**`new Color()` only. Do not call `convertSRGBToLinear()`** — it is silent and renders everything 2–3× darker, and `instanced-city.ts` carries a `no-restricted-syntax` rule about exactly this.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/unit/color.test.ts tests/unit/city-renderer.test.ts tests/component/renderer-contract.test.ts
```

Expected: PASS. Note that `tests/component/renderer-contract.test.ts` is at **450/450 lines** — if this task needs an assertion there, an extraction comes first.

- [ ] **Step 5: Judge it by eye, which is the only test that matters here**

```bash
cd "C:/Projects/codebase-inspector" && npm run harness-shot
```

Compare `s05-city-light.png` and `s06-city-light.png` before and after. **A measured delta that still looks like one flat field is a failed fix**, and the capture is what says so.

- [ ] **Step 6: Verify and commit**

`npm run verify`, the two counts, NUL check. Subject: `fix(city): guarantee the district plate separates from the ground in every theme`.

---

## Task 4: Selection — outline plus locator marker

`foundations/03`: *"A selected building receives a high-contrast outline plus a locator marker."* The baseline capture shows a tall translucent column around the selected building. **This task's first job is to find out whether that column already is the locator marker.** If it is, the deliverable is a finding and a test that pins it — not a change.

**Files:**
- Modify (only if the finding requires it): `src/visualization/instanced-city.ts`
- Test: `tests/component/renderer-contract.test.ts` or `tests/unit/city-renderer.test.ts`

**Interfaces:**
- Consumes: `CityRendererPort.setSelection(entityId)`, `CityPalette.selection`.
- Produces: no signature change.

- [ ] **Step 1: Read the selection path and report what exists**

Read `instanced-city.ts`'s `selectionOutline` construction and its `setSelection` handler. Answer in the report, with line citations:

1. Is the drawn object an outline of the building's own box, a taller column, or both?
2. Does anything read as a **locator** — something that says *where* the selection is when the building itself is off screen or occluded?
3. Does the encoding survive the top-down camera, where height cues are gone (`interactions/03`: *"Top-down removes visible height cues"*)?

- [ ] **Step 2: Write the test that pins the answer**

If step 1 finds outline **and** locator, write a test asserting both are present and coloured from `palette.selection`, so a later refactor cannot quietly drop one:

```ts
it('draws both halves of the selection encoding', () => {
  // foundations/03: "a high-contrast outline PLUS a locator marker". Two objects,
  // because an outline alone vanishes the moment the building is occluded, and a
  // marker alone does not say which building.
  const { root } = buildCityForTest(layoutFixture());
  port.setSelection(layoutFixture().lots[0].entityId);
  expect(root.getObjectByName('ci-selection-outline')).toBeDefined();
  expect(root.getObjectByName('ci-selection-locator')).toBeDefined();
});

it('keeps the selection legible in the top-down camera', () => {
  // interactions/03: top-down removes height cues and "is not a different metric" —
  // an encoding that only reads in 3d makes the selected file unfindable in S09.
  const { root } = buildCityForTest(layoutFixture());
  port.setCameraMode('top');
  port.setSelection(layoutFixture().lots[0].entityId);
  expect((root.getObjectByName('ci-selection-locator') as Object3D).visible).toBe(true);
});
```

If step 1 finds only one half, the same tests are the failing tests, and step 3 adds the missing half.

- [ ] **Step 3: Run the test**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/renderer-contract.test.ts tests/unit/city-renderer.test.ts
```

Expected: PASS if the encoding is complete, FAIL naming the missing object if it is not. **Both outcomes are legitimate deliverables.** Do not add a second object to make a test pass if the first one already satisfies the design; report instead.

- [ ] **Step 4: Implement only what step 3 proved missing**

Any new object is named (`ci-selection-locator`), takes its colour from `palette.selection` through `new Color()` with no `convertSRGBToLinear()`, is excluded from picking (`instanced-city.ts:39` — raycast targets are file lots only), and is disposed alongside the rest of the scene. **`applySize` gains no clamp** (M114).

- [ ] **Step 5: Capture, verify and commit**

Attach `s07-selected-dark.png` and `s07-selected-light.png` plus a top-down capture with a selection. `npm run verify`, the two counts, NUL check.

Subject: `fix(city): pin both halves of the selection encoding` — or, if nothing changed, `test(city): pin the selection encoding that already satisfies foundations/03`.

---

## Wave 1 checkpoint — stop here

Report to the user, with the harness captures attached:

1. Before and after for S05 dark, S05 light, S06, S07, S09.
2. Task 2's measured numbers: the root district's extent before and after, against its contents.
3. Task 4's finding: whether the locator marker already existed.
4. **Ask the user to judge `--ci-raised` by eye.** It had no consumer before WP-01's last wave, is now the hover surface for three controls, and in default themes sits close to the surrounding surface. It has never been looked at. A harness capture cannot answer this — hover is not in a screenshot — so ask them to hover the camera buttons and the file-list rows in their own host and say whether the affordance reads.

**Do not start wave 2 until the user has answered.**

---

# Wave 2 — chrome

**Serialized.** Every task in this wave edits `src/ui/styles.css`, which is one 498-line file. Run Tasks 5 → 10 one at a time; each starts from the previous one's committed tree.

`styles.css` already carries one named section per component (`/* --- C01 shell layout --- */`, `/* --- FileSearch (C06) --- */`, and so on). **Each task edits only its own section**, and adds a new one in the same style if its component has none.

**M113 applies to every control this wave adds.** Keep the `:where(.codebase-inspector-root)` wrapper and add the element type selector Obsidian's own rule uses, giving (0,1,1). **Then check whether the raised rule now also ties `button:hover`** — three controls silently lost their hover affordance exactly that way, and the fix is an explicit `:hover` rule beside the base one, as `.ci-camera-controls button:hover` already does.

## Task 5: The toolbar's source identity, Scan and settings

Addresses finding **F7**: S05's layout zone 1 is *"Profile/search/scan toolbar"*; ours has a search field and two text buttons, and `COPY_07` ("Scan codebase") reaches a user only inside the scope modal.

**Files:**
- Create: `src/ui/components/SourceIdentity.vue`
- Modify: `src/ui/App.vue` (**395/400 lines — the extraction above is why**), `src/ui/styles.css`, `src/ui/copy.ts`
- Test: `tests/component/source-identity.test.ts`, `tests/host/city-view.test.ts`

**Interfaces:**
- Consumes: `useCityStore()` (`snapshot`), `useRunStore()` (lifecycle, for whether a scan is already running).
- Produces: `SourceIdentity.vue` rendering `.ci-source-identity`; a toolbar Scan control at `.ci-toolbar__scan`.

- [ ] **Step 1: Establish what identity data `src/ui/` can already reach**

Before writing anything, answer: is the profile's **name** reachable from a store in `src/ui/`, or only `snapshot.scope.rootPath`?

**If the profile name is not already in a store, stop and report it.** Adding a field to `CityViewState` or a new store is a §4 contract question and belongs to the user, not to this task. Ship the reachable part — the Scan control and the settings entry — and raise the identity block as a question with the exact field you would need.

- [ ] **Step 2: Write the failing test**

Create `tests/component/source-identity.test.ts`:

```ts
it('names the codebase being shown', () => {
  const wrapper = mountWithStore(SourceIdentity, { snapshot: snapshotFixture({ rootPath: '/work/renovation-planner' }) });
  expect(wrapper.text()).toContain('renovation-planner');
});

it('renders nothing at all before a snapshot exists', () => {
  // S01's welcome state owns the no-source screen. An identity block that renders an
  // empty shell there is a rendered-but-disabled control for behaviour that has not
  // happened, which the design package forbids outright.
  const wrapper = mountWithStore(SourceIdentity, { snapshot: null });
  expect(wrapper.find('.ci-source-identity').exists()).toBe(false);
});
```

Append a toolbar test to `tests/component/`:

```ts
it('offers Scan from the toolbar, not only from inside the scope modal', () => {
  // F7. S05's interaction table lists Scan as a toolbar trigger: "Review source
  // authorization before a new job." COPY_07 existed and was reachable only from the
  // modal it opens, which is a control nobody could find.
  const wrapper = mountApp({ snapshot: snapshotFixture() });
  const scan = wrapper.find('.ci-toolbar__scan');
  expect(scan.exists()).toBe(true);
  expect(scan.text()).toBe(COPY_07);
});

it('does not start a scan directly — the toolbar asks for authorization first', () => {
  // The frozen rule: components emit intents; the application validates and performs
  // work. A toolbar button that scanned would be the renderer obtaining authority to
  // read paths, which every layer of this spec forbids.
  const wrapper = mountApp({ snapshot: snapshotFixture() });
  wrapper.find('.ci-toolbar__scan').trigger('click');
  expect(scanCoordinatorSpy.start).not.toHaveBeenCalled();
  expect(emittedIntents()).toContain('scanRequested');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/source-identity.test.ts
```

Expected: FAIL — the component does not exist.

- [ ] **Step 4: Implement**

Create `SourceIdentity.vue` rendering the codebase name and its source kind, guarded by `v-if="store.snapshot"`. Add it and the Scan control to `App.vue`'s `.ci-app__toolbar`. Route the Scan click through the **existing** consent chain — the same path the command palette entry uses — never a direct coordinator call.

Style `.ci-source-identity` and `.ci-toolbar__scan` in a new `/* --- Toolbar identity and scan (C02) --- */` section. The Scan control is a `button`, so **M113 applies**: `:where(.codebase-inspector-root) button.ci-toolbar__scan` for the base, plus an explicit `:hover`.

Keep `App.vue` under 400 lines. If it will not fit, extract the whole toolbar into `src/ui/components/AppToolbar.vue` rather than trimming comments.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/ tests/host/city-view.test.ts
```

Expected: PASS.

- [ ] **Step 6: Production-caller sweep, both questions**

For the Scan control and every branch added: does anything in `src/` call it, **and does that call ever actually happen to a user?** A toolbar button gated on a state no snapshot ever reaches is instance eleven.

- [ ] **Step 7: Capture, verify and commit**

Attach `s05-city-dark.png` before and after. `npm run verify`, the two counts, NUL check, line count of `App.vue`. Subject: `feat(toolbar): name the codebase and put Scan where S05 says it is`.

---

## Task 6: The file list — header, grouping, directory focus, wrapping

Addresses findings **F9** and **F4**. `C07` declares `grouping` as an input and `directoryFocusRequested` as an event; neither exists. Rows break mid-word (`presentation/views/GeometrySidecarVie` / `w.ts`).

**`C07` also says the current shape is right:** *"native list buttons are preferable to an incomplete ARIA tree"*, and duplicate basenames must be disambiguated. **Do not build an ARIA tree.** Grouping means section headings over button rows.

**Files:**
- Modify: `src/ui/components/CodebaseFileList.vue`, `src/ui/styles.css` (the `C07` section at line ~256), `src/ui/copy.ts`
- Test: `tests/component/codebase-file-list.test.ts`

**Interfaces:**
- Consumes: `useCityStore()` (`snapshot`, `layout`, `selectedEntityId`, `matchingIds`), `useCityRendererHandle()` for the focus command.
- Produces: `.ci-file-list__header`, `.ci-file-list__group`, `.ci-file-list__group-focus`.

- [ ] **Step 1: Write the failing tests**

```ts
it('names the panel and says how much is in it', () => {
  const wrapper = mountList({ files: 144, directories: 6 });
  const header = wrapper.find('.ci-file-list__header');
  expect(header.text()).toContain('Codebase files');
  expect(header.text()).toContain('144');
});

it('groups rows under their directory, with a count per group', () => {
  // C07's `grouping` input. A flat list of 1,087 full paths is navigable only by
  // scrolling, and the districts the city is built from are invisible in it.
  const wrapper = mountList({ files: 144, directories: 6 });
  const groups = wrapper.findAll('.ci-file-list__group');
  expect(groups.length).toBe(6);
  expect(groups[0].text()).toMatch(/\b24 files\b/);
});

it('offers directory focus from the group heading', () => {
  // C07's `directoryFocusRequested`, which had no surface at all.
  const wrapper = mountList({ files: 144, directories: 6 });
  wrapper.findAll('.ci-file-list__group-focus')[0].trigger('click');
  expect(rendererDouble.focus).toHaveBeenCalledOnce();
});

it('still disambiguates duplicate basenames', () => {
  // C07's own requirement, and the reason the rows carry full paths today. Grouping
  // must not become an excuse to show a bare basename twice.
  const wrapper = mountList({ paths: ['src/a/index.ts', 'src/b/index.ts'] });
  const labels = wrapper.findAll('.ci-file-list__row').map((row) => row.text());
  expect(new Set(labels).size).toBe(2);
});

it('breaks long paths at a separator, never mid-word', () => {
  // F4: `presentation/views/GeometrySidecarVie` / `w.ts` in the user's own capture.
  const wrapper = mountList({ paths: ['presentation/views/GeometrySidecarView.ts'] });
  const row = wrapper.find('.ci-file-list__row');
  expect(getComputedStyle(row.element).overflowWrap).not.toBe('break-word');
});
```

The last assertion is weak on its own — jsdom computes little. Pair it with a harness capture in step 6, which is the real evidence.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/codebase-file-list.test.ts
```

- [ ] **Step 3: Implement**

Group `fileEntities` by `directoryId` using `store.layout.districts` for the group order, so **the list's order matches the city's districts** rather than introducing a second, disagreeing organisation. Render each group as a heading with its name, count and a focus button, followed by its rows.

Keep the existing `v-memo` on rows — it re-patches only the rows whose dimming actually flipped, and dropping it re-introduces a ~1,000-row repaint per keystroke.

For wrapping, in the `C07` section: `overflow-wrap: normal; word-break: keep-all;` with the path allowed to wrap at `/` by inserting `<wbr>` after each separator, or `white-space: nowrap; text-overflow: ellipsis` **only if** the full path stays available as accessible text — `foundations/04` forbids exposing crucial content only in an ellipsis tooltip, so an ellipsis alone is not acceptable.

`.ci-file-list__row` is a `button` Obsidian styles; **M113 already applies to it** (`button.ci-file-list__row` is in the file). Any new `button` — the group focus control — needs the same treatment plus its own `:hover`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/codebase-file-list.test.ts tests/component/view-surface-memo.test.ts tests/component/stage-height.test.ts
```

`stage-height.test.ts` is in this list deliberately: the file list is what drove the view to ~32,000 px, and grouping changes its height.

- [ ] **Step 5: Re-check the height chain**

The stage is `height: 100%`, never `min-height`. Confirm `.ci-app` still resolves a definite height with the taller grouped list, and that `.ci-app__list` still scrolls rather than stretching its flex line. Report the measured heights.

- [ ] **Step 6: Capture, verify and commit**

Attach `s05-city-dark.png` and `s10-narrow-dark.png` before and after. The narrow capture is where wrapping shows. `npm run verify`, the two counts, NUL check.

Subject: `feat(file-list): group rows by district, name the panel, and stop breaking paths mid-word`.

---

## Task 7: The canvas header

Addresses finding **F8**, admitted by ruling **P3**: the mockup shows an eyebrow, a title, a subtitle and a `Read-only snapshot` badge above the city, and rank 6 grants the mockups authority over what is present.

**Files:**
- Create: `src/ui/components/CityHeader.vue`
- Modify: `src/ui/App.vue`, `src/ui/styles.css`, `src/ui/copy.ts`
- Test: `tests/component/city-header.test.ts`

**Interfaces:**
- Consumes: `useCityStore()` (`snapshot`, `layout`).
- Produces: `.ci-city-header` with `.ci-city-header__eyebrow`, `__title`, `__subtitle`, `__badge`.

- [ ] **Step 1: Write the failing tests**

```ts
it('says what the city is and what it is made of', () => {
  const wrapper = mountWithStore(CityHeader, { files: 144, directories: 6 });
  expect(wrapper.find('.ci-city-header__title').text()).toBe('Codebase city');
  // The counts come from the layout, not from a second count kept beside it — the
  // footer says the same numbers and the two must not be able to disagree.
  expect(wrapper.find('.ci-city-header__subtitle').text()).toBe('144 files grouped into 6 directory districts');
});

it('says "1 directory district", not "1 directory districts"', () => {
  const wrapper = mountWithStore(CityHeader, { files: 3, directories: 1 });
  expect(wrapper.find('.ci-city-header__subtitle').text()).toContain('1 directory district');
});

it('carries the read-only claim as a badge', () => {
  const wrapper = mountWithStore(CityHeader, { files: 144, directories: 6 });
  expect(wrapper.find('.ci-city-header__badge').text()).toBe('Read-only snapshot');
});

it('renders nothing before a snapshot exists', () => {
  const wrapper = mountWithStore(CityHeader, { snapshot: null });
  expect(wrapper.find('.ci-city-header').exists()).toBe(false);
});

it('uses a real heading element, not a styled div', () => {
  // foundations/04: equivalent non-3D access. The city's own name is the landmark a
  // screen-reader user navigates to; a div that looks like a title is not one.
  const wrapper = mountWithStore(CityHeader, { files: 144, directories: 6 });
  expect(wrapper.find('.ci-city-header__title').element.tagName).toMatch(/^H[1-6]$/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/city-header.test.ts
```

- [ ] **Step 3: Implement**

Create `CityHeader.vue`. Derive both counts from `store.layout` (`lots.length`, `districts.length`) so the header and the footer read the same source. Add the copy to `copy.ts` with a comment recording that `Codebase city` and `Read-only snapshot` come from the S05 mockup under ruling P3, and that the eyebrow and subtitle are authored to the catalogue's tone because `interactions/04-microcopy.md` has no id for them. **Say which strings have a COPY id and which do not** — Task 12 pins the ones that do.

Mount it in `App.vue` at the top of `.ci-app__stage-column`, above `CityViewport`. **The stage height chain runs through this column**: the header is a fixed-height row and `CityViewport` keeps `flex: 1 1 auto; min-height: 0`. `height: 100%`, never `min-height`.

Add a `/* --- CityHeader --- */` section to `styles.css`. Type scale from `foundations/03`: the title is a section title, not a 22–26 px page title — this is a panel inside a leaf, and the mockup's own caption sizes are explicitly not an instruction.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/city-header.test.ts tests/component/stage-height.test.ts tests/component/city-viewport.test.ts
```

- [ ] **Step 5: Capture, verify and commit**

Attach S05 dark and light, and `s10-narrow-dark.png` — the header is a new row competing for height in a narrow leaf. `npm run verify`, the two counts, NUL check, `App.vue` line count.

Subject: `feat(city): give the canvas the header S05 composes it with`.

---

## Task 8: The legend and the footer

Addresses findings **F6**, **F10** and **F11**. `C11` requires the legend name the raw metric, **aggregation**, scale and cap; the checklist requires the **equal-lot meaning** be explained, which fails at baseline. `C12` requires **absolute time** be available in the footer's details.

**Files:**
- Modify: `src/ui/components/MetricLegend.vue`, `src/ui/components/SnapshotStatus.vue`, `src/ui/styles.css` (C11 and C12 sections), `src/ui/copy.ts`
- Test: `tests/component/metric-legend.test.ts`, `tests/component/snapshot-status.test.ts`

**Interfaces:**
- Consumes: `LayoutResult.scale` (`metricId`, `name`, `cap`, `unit`, `clampedCount`), `LayoutResult.lots` (for which categories are present), `CodebaseSnapshot.observedAt`, `scope`.
- Produces: `.ci-legend__encoding` (the three encoding statements), `.ci-snapshot-status__details`.

- [ ] **Step 1: Write the failing tests**

```ts
// metric-legend.test.ts
it('shows only the categories actually present in this city', () => {
  // F6. The baseline printed all ten while the city contained two, so eight swatches
  // stood for nothing a user could see.
  const wrapper = mountLegend({ categories: ['typescript', 'vue'] });
  const labels = wrapper.findAll('.ci-legend__label').map((el) => el.text());
  expect(labels).toEqual(['typescript', 'vue']);
});

it('explains the equal-lot meaning', () => {
  // design-review-checklist.md, "City and inspection": "Height metric/scale/cap and
  // equal-lot meaning are explained." The equal-lot half was never explained at all,
  // so this row failed at baseline.
  expect(mountLegend({}).find('.ci-legend__encoding').text()).toContain('One equal lot per file');
});

it('names the aggregation, not only the metric and scale', () => {
  // C11: "Names the raw metric, aggregation, scale, and cap."
  const text = mountLegend({ cap: 350, clamped: 56 }).text();
  expect(text).toContain('physical lines');
  expect(text).toContain('square-root scale');
  expect(text).toContain('350');
  expect(text).toContain('per file');          // the aggregation: no district statistic
});

it('says what the selection encoding is, since colour alone is insufficient', () => {
  // C11: "Color alone is insufficient; unknown is never zero."
  const text = mountLegend({}).find('.ci-legend__encoding').text();
  expect(text).toContain('outline');
  expect(text).toContain('Unknown');
});

// snapshot-status.test.ts
it('makes the absolute observation time available, not only a relative age', () => {
  // C12: "Absolute time and scope are available in details." The baseline said only
  // "Snapshot retained from just now", which is unusable as evidence.
  const wrapper = mountStatus({ observedAt: '2026-09-17T13:00:00Z' });
  expect(wrapper.find('.ci-snapshot-status__details').text()).toContain('17 Sep 2026');
});

it('states how much is included and how it is divided', () => {
  const wrapper = mountStatus({ files: 144, districts: 6 });
  expect(wrapper.text()).toContain('144 included files');
  expect(wrapper.text()).toContain('6 districts');
});

it('keeps both safety claims beside the snapshot they are about', () => {
  // These two are backed by G2's evidence record and must not be lost to a rewrite.
  const wrapper = mountStatus({ files: 144 });
  expect(wrapper.text()).toContain(CLAIM_READ_ONLY_ACCESS);
  expect(wrapper.text()).toContain(CLAIM_SOURCE_UNCHANGED);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/metric-legend.test.ts tests/component/snapshot-status.test.ts
```

- [ ] **Step 3: Implement**

`MetricLegend.vue`: derive the present categories from `new Set(store.layout.lots.map((l) => l.colorKey))` and iterate `CATEGORY_IDS` filtered by it, so the **order** stays the canonical one rather than becoming discovery order. Keep the scale line and add an `.ci-legend__encoding` block with the three statements. **`unavailable` is a metric state, not a category** — if any lot has `metricState === 'unavailable'`, the legend says what the unknown marker means, because `interactions/03` requires the unknown shape and its reason be exposed and never read as zero.

`SnapshotStatus.vue`: keep the existing `v-if="ageText"` guard and both claims inside it — a safety claim with no scan behind it is a claim about nothing. Add counts and a `<details>`/summary carrying the absolute time and the scope's root. Format the absolute time in the **view's owning window's** locale, not a bare `new Date().toLocaleString()` against a global.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/metric-legend.test.ts tests/component/snapshot-status.test.ts tests/unit/evidence-numbers.test.ts
```

- [ ] **Step 5: Capture, verify and commit**

Attach S05 dark before and after. `npm run verify`, the two counts, NUL check.

Subject: `feat(legend): explain the equal lot, the aggregation and the absolute snapshot time`.

---

## Task 9: The inspector's path and scope, and two real controls

Addresses findings **F12** and **F13**. The inspector shows a basename with no full path and no scope, against `C10`'s *"Keep exact raw values and scope"* and `foundations/04`'s *"Preserve the full path through wrapping, a copy action, and accessible text."* And the filter notice names two actions — *"Reveal file or clear selection"* — neither of which is a control.

**M116 holds: `.ci-search__input` is not touched by this task.**

**Files:**
- Modify: `src/ui/components/FileInspector.vue`, `src/ui/App.vue` (the `.ci-app__selection-notice` block), `src/ui/styles.css` (C10 section), `src/ui/copy.ts`
- Test: `tests/component/file-inspector.test.ts`, `tests/component/status-surfaces.test.ts`

**Interfaces:**
- Consumes: `useCityStore()` (`snapshot`, `selectedEntityId`), `store.select`, `store.clearSelection`, `useCityRendererHandle()`.
- Produces: `.ci-inspector__path`, `.ci-inspector__scope`, `.ci-selection-notice__reveal`, `.ci-selection-notice__clear`.

- [ ] **Step 1: Write the failing tests**

```ts
it('shows the full path, wrapped, not only the basename', () => {
  const wrapper = mountInspector({ path: 'presentation/views/GeometrySidecarView.ts' });
  expect(wrapper.find('.ci-inspector__path').text()).toBe('presentation/views/GeometrySidecarView.ts');
});

it('keeps the full path as accessible text rather than an ellipsis tooltip', () => {
  // foundations/04: "Do not expose crucial content only in an ellipsis tooltip."
  const wrapper = mountInspector({ path: 'a/very/long/path/that/would/be/truncated/File.ts' });
  const el = wrapper.find('.ci-inspector__path').element as HTMLElement;
  expect(getComputedStyle(el).textOverflow).not.toBe('ellipsis');
});

it('names the scope the values were measured in', () => {
  // C10: "Keep exact raw values and scope." A line count with no scope is a number
  // whose denominator the user cannot check.
  const wrapper = mountInspector({ path: 'src/a.ts', rootPath: '/work/repo' });
  expect(wrapper.find('.ci-inspector__scope').exists()).toBe(true);
});

it('turns the filter notice into the two actions it names', () => {
  // F13. "Reveal file or clear selection" named two actions as prose; a user reading
  // it had nothing to press.
  const wrapper = mountApp({ query: 'main', selectedOutsideFilter: true });
  expect(wrapper.find('.ci-selection-notice__reveal').exists()).toBe(true);
  expect(wrapper.find('.ci-selection-notice__clear').exists()).toBe(true);
});

it('clearing selection from the notice keeps the query', () => {
  // The two are separate actions: clearing the selection is not clearing the search.
  const wrapper = mountApp({ query: 'main', selectedOutsideFilter: true });
  wrapper.find('.ci-selection-notice__clear').trigger('click');
  expect(store.selectedEntityId).toBeNull();
  expect(store.query).toBe('main');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/file-inspector.test.ts tests/component/status-surfaces.test.ts
```

- [ ] **Step 3: Implement**

Render the full path in `.ci-inspector__path` with `overflow-wrap: anywhere` and no `text-overflow`. Keep the existing `Copy relative path` action — `foundations/04` asks for wrapping **and** a copy action, not one or the other. Add `.ci-inspector__scope` naming the scope root.

Replace the notice paragraph's prose tail with two buttons. **Reveal** re-selects and focuses the file without clearing the query; **Clear selection** clears only the selection. Both are `button`s, so **M113 applies**, and each needs its own `:hover` rule.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/ tests/unit/city-store.test.ts tests/unit/escape-intent.test.ts
```

`escape-intent.test.ts` is included because the notice now contains focusable controls inside a nonmodal surface, and the Escape chain must still do what it did.

- [ ] **Step 5: Confirm M116 is untouched**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run -t "search input"
git diff --ignore-all-space src/ui/styles.css | grep -c "ci-search__input"
```

Expected: the tripwire passes and the diff touches no `.ci-search__input` rule. State the count.

- [ ] **Step 6: Capture, verify and commit**

Attach `s07-selected-dark.png` and `s08-search-dark.png` before and after. `npm run verify`, the two counts, NUL check.

Subject: `feat(inspector): show the full path and scope, and make the filter notice actionable`.

---

## Task 10: Camera controls as a compact overlay

Addresses finding **F5**: eleven buttons in a full-width row below the stage, wrapping to two rows in a narrow leaf and consuming stage height. **The inventory is correct and does not shrink** — `C09` declares `stepRequested`, and `foundations/04` requires a non-drag single-pointer alternative for every gesture, which is what these eleven are.

**Files:**
- Modify: `src/ui/components/CameraControls.vue`, `src/ui/styles.css` (C09 section at line ~385)
- Test: `tests/component/camera-controls.test.ts`, `tests/component/responsive-floor.test.ts`

**Interfaces:**
- Consumes: `useCityRendererHandle()`, `useCityStageEl()`.
- Produces: `.ci-camera-controls--overlay`, and a disclosure for the step controls.

- [ ] **Step 1: Write the failing tests**

```ts
it('keeps every camera action reachable', () => {
  // foundations/04: a keyboard-only alternative alone is NOT sufficient for the
  // single-pointer requirement. Compacting the group must not remove a button.
  const wrapper = mountControls();
  const labels = wrapper.findAll('button').map((b) => b.attributes('aria-label'));
  expect(labels).toEqual(expect.arrayContaining([
    'Zoom in', 'Zoom out', 'Rotate left', 'Rotate right',
    'Pan up', 'Pan down', 'Pan left', 'Pan right', 'Fit', 'Top', 'Focus',
  ]));
});

it('sits over the stage rather than taking a row beneath it', () => {
  const wrapper = mountControls();
  expect(wrapper.find('.ci-camera-controls').classes()).toContain('ci-camera-controls--overlay');
});

it('keeps every action reachable when the step controls are collapsed', () => {
  // A disclosure that hides a control from the pointer entirely would trade F5 for an
  // accessibility regression — the pan and rotate steps ARE the non-drag alternative.
  const wrapper = mountControls({ stepsCollapsed: true });
  wrapper.find('.ci-camera-controls__more').trigger('click');
  expect(wrapper.findAll('button').length).toBe(12);   // eleven actions plus the disclosure
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/camera-controls.test.ts
```

- [ ] **Step 3: Implement**

Position the group absolutely inside `.ci-viewport` (which is already `position: relative` — see the note at `styles.css:352`), anchored bottom-right, over the canvas. Group the primaries (zoom ±, Fit, Top, Focus) and put the eight directional steps behind a disclosure that is **open by default above 820 px** and collapsible below it.

`.ci-camera-controls button` is already at (0,1,1) with an explicit `:hover` — **keep both**, and keep `box-shadow: none`, which is what stops `--input-shadow` painting under our border.

The overlay must not intercept pointers aimed at buildings outside its own box: give the container `pointer-events: none` and the buttons `pointer-events: auto`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/component/camera-controls.test.ts tests/component/responsive-floor.test.ts tests/component/canvas-camera.test.ts tests/component/picking.test.ts
```

`picking.test.ts` is included because an overlay over the canvas is exactly what can swallow a click aimed at a building.

- [ ] **Step 5: Capture, verify and commit**

Attach S05 dark and `s10-narrow-dark.png` before and after; the narrow capture is the one that shows the reclaimed height. `npm run verify`, the two counts, NUL check.

Subject: `fix(camera): compact the control group over the stage without losing a control`.

---

## Wave 2 checkpoint — stop here

Report to the user with captures of all seven screens in both schemes, and ask:

1. **Does the composition read?** Compare against `docs/concept/design/mockups/s05-city.png` as a composition — zone order, relative emphasis, what is present — never as pixels.
2. **The panel caps.** WP-01's caps moved the stage from 1,280 to 1,140 px at their ~1,876 px leaf. B2-as-scoped is satisfied but the trade was never confirmed. Now that the canvas header and the camera overlay have changed how the stage reads, ask whether 1,140 is right.

**Do not start wave 3 until the user has answered.**

---

# Wave 3 — verification

## Task 11: The manual accessibility matrix

Closes the rows that are NOT PERFORMED, and gates G4 and G7. **This task produces evidence, not features.** Anything it finds is reported as a finding; fixes are a separate decision.

**A harness capture is not host evidence.** Every row here is run in a real Obsidian host, and the report says which version.

**Files:**
- Create: `docs/superpowers/notes/2026-09-20-wp01b-accessibility-matrix.md`

- [ ] **Step 1: Run each row and record pass/fail/not-run**

One row per section, each recording what was done, what happened, and the Obsidian version:

1. Keyboard only — reach every S05 action, enter and leave the camera region with Escape/Tab, confirm arrow keys still behave normally in a Markdown editor.
2. NVDA (or the platform equivalent) — the canvas's named region and help description; the polite status region on scan transitions and selection changes; no announcement on hover.
3. 200% text scaling — dialogs and inspectors scroll internally, primary actions stay reachable.
4. Dark theme, default.
5. Light theme, default.
6. **One third-party theme.** The highest-value row: M113's specificity scheme has never met a theme that fights it. Name the theme and its version.
7. Narrow leaf, below 820 px.
8. Two simultaneous leaves — independent camera, query, selection, panel state.
9. Pop-out migration.
10. WebGL unavailable.
11. GPU context recovery.
12. Reduced motion.
13. Long Unicode paths.
14. Measured contrast of **our** pairs in rows 4, 5 and 6 — `--ci-text` on `--ci-surface`, `--ci-text-muted` on `--ci-panel`, `--ci-on-action` on `--ci-action`, and `--ci-raised` against `--ci-panel` for the hover surface. Record measured ratios against 4.5:1 for normal text and 3:1 for non-text. **Do not compare against `reference-contrast-checks.json`** — those six pairs are the prototype's palette and are unreachable for us (spec §2).

- [ ] **Step 2: Write the note**

Record pass/fail/**not-run**, never assumed compliance. A row that could not be run says why. State the Obsidian version for every row.

- [ ] **Step 3: Report findings separately**

Anything found is a finding with its citation, brought to the user. **Do not fix it inside this task** — a verification task that also changes behaviour cannot be trusted as verification.

- [ ] **Step 4: Commit**

Subject: `docs(evidence): the WP-01b accessibility matrix, measured rather than assumed`.

---

## Task 12: Pin the microcopy to the catalogue

No copy string in this plugin is bound to `interactions/04-microcopy.md` by any test. Wave 2 added strings; this is where the binding gets made.

**Files:**
- Create: `tests/contracts/microcopy.test.ts`
- Modify: `src/ui/copy.ts` (comments only, unless the user rules a string should change)

- [ ] **Step 1: Write the test**

```ts
// interactions/04-microcopy.md is the catalogue; src/ui/copy.ts is what ships. Nothing
// bound them, so a string could drift from its own source with nothing able to notice.
import { readFileSync } from 'node:fs';
import * as copy from '../../src/ui/copy';

const catalogue = readFileSync('docs/concept/design/interactions/04-microcopy.md', 'utf8');

// Only the strings that HAVE a catalogue id. Strings authored fresh (the canvas
// header's eyebrow, the snapshot age line) are listed in AUTHORED_FRESH instead, so
// the difference stays visible rather than being hidden by an incomplete map.
const PINNED: ReadonlyArray<readonly [string, string]> = [
  ['COPY_02', copy.COPY_02],
  ['COPY_07', copy.COPY_07],
  // …one entry per COPY_nn export that the catalogue actually contains
];

const AUTHORED_FRESH: readonly string[] = [
  // …one entry per exported string written for this plugin, each with a one-line
  // reason in a comment beside it
];

it('ships every catalogued string exactly as the catalogue writes it', () => {
  for (const [id, value] of PINNED) {
    expect(catalogue, `${id} is not in the catalogue as shipped`).toContain(value);
  }
});

it('accounts for every exported string, so none is uncatalogued by accident', () => {
  const exported = Object.entries(copy).filter(([, v]) => typeof v === 'string').map(([k]) => k);
  const accounted = new Set([...PINNED.map(([id]) => id), ...AUTHORED_FRESH]);
  expect(exported.filter((name) => !accounted.has(name))).toEqual([]);
});
```

- [ ] **Step 2: Run it and report the divergences**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/contracts/microcopy.test.ts
```

**A string that does not match the catalogue is a finding, not a string to edit.** Report it with both texts and let the user decide which is right — the catalogue is rank 5 and the shipped string may have been changed for a reason the WP-01 ledger records.

- [ ] **Step 3: Make it pass, or report why it cannot**

Fix only the strings the user rules should change. Commit. Subject: `test(copy): bind every shipped string to the microcopy catalogue`.

---

## Task 13: Pin the height scale's four preserved properties

`scale.ts` is **compliant** (spec §3.3): `interactions/03` permits another explicit scale provided the metric definition, display cap, exact raw values and legend are preserved and one scale is applied across all districts. Nothing pins that, so a future reader who finds `8 + 120 * sqrt(min(lines, 600) / 600)` in the design and a derived cap in the code will "correct" it.

**Files:**
- Create: `tests/contracts/height-scale.test.ts`

- [ ] **Step 1: Write the test**

```ts
// interactions/03: "Production may choose another explicit scale, but it must preserve
// the metric definition, display cap, exact raw values, and legend. Do not silently
// apply a different scale in each district." These five tests are those clauses.
it('preserves the metric definition', () => {
  const layout = computeLayout(buildSnapshotFixture({ files: 40, directories: 3, repositoryId: 'r' }));
  expect(layout.scale.metricId).toBe('physical-lines');
  expect(layout.scale.unit).toBe('lines');
});

it('preserves the display cap, and says how many values it clamped', () => {
  const layout = computeLayout(buildSnapshotFixture({ files: 40, lineCounts: LINE_COUNTS_WITH_OUTLIERS }));
  expect(layout.scale.cap).toBeGreaterThan(0);
  expect(layout.scale.clampedCount).toBeGreaterThan(0);
});

it('preserves the exact raw values, which the cap never rewrites', () => {
  // The cap is a DISPLAY cap. A clamped building is shorter; its observation is not.
  const snapshot = buildSnapshotFixture({ files: 2, lineCounts: [10, 5000] });
  const layout = computeLayout(snapshot);
  expect(snapshot.observations.find((o) => o.value === 5000)?.value).toBe(5000);
  expect(layout.scale.cap).toBeLessThan(5000);
});

it('preserves the legend name', () => {
  expect(computeLayout(buildSnapshotFixture({ files: 4 })).scale.name).toBe('physical lines · square-root scale');
});

it('applies ONE scale across every district, never one per district', () => {
  // The explicit prohibition. Two files with the same line count in different
  // districts must be the same height, or the city encodes district membership as
  // height and nobody can read it.
  const layout = computeLayout(buildSnapshotFixture({ files: 40, directories: 4, repositoryId: 'r' }));
  const byValue = new Map<number, number[]>();
  for (const lot of layout.lots) {
    if (lot.metricState !== 'measured') continue;
    const value = valueFor(layout, lot);
    byValue.set(value, [...(byValue.get(value) ?? []), lot.dimensions[1]]);
  }
  for (const [value, heights] of byValue) {
    expect(new Set(heights.map((h) => h.toFixed(6))).size, `value ${value} produced more than one height`).toBe(1);
  }
});
```

`LINE_COUNTS_WITH_OUTLIERS` is an explicit array in the test file whose top 5% exceed the p95 cap, so `clampedCount` is non-zero by construction rather than by luck. `valueFor` reads the lot's observation from the snapshot.

- [ ] **Step 2: Run it**

```bash
cd "C:/Projects/codebase-inspector" && npx vitest run tests/contracts/height-scale.test.ts
```

Expected: PASS on the first run, because `scale.ts` is already compliant. **A pass here is the finding.**

- [ ] **Step 3: Mutation-verify all five**

A test that passes on the first run has proved nothing until its hazard has been made real. For each of the five, break **the thing it watches** and watch it go red: change `SCALE_NAME`; return the raw value instead of the clamped one from `heightFor`; derive the cap per district inside `districts.ts`. Restore from a plain backup copy taken immediately before each edit — **not with any git verb**.

Record the red output for every one of the five. A test that stays green under its own mutation is a test that cannot fail, which is this branch's own defect class.

- [ ] **Step 4: Commit**

Subject: `test(scale): pin the four properties interactions/03 requires a substitute scale preserve`.

---

# Final gate

- [ ] `npm run verify` exits 0. State the test count against the 981 passed / 1 skipped baseline.
- [ ] `grep -rn "eslint-disable" src/ tests/ | wc -l` is **2**; `grep -rn "@ts-expect-error" src/ tests/ | wc -l` is **1**.
- [ ] No lint rule weakened: `git diff bfe6bc6 -- eslint.config.mjs .oxlintrc.json` shows no relaxation.
- [ ] No test loosened. Every assertion changed is listed with its reason and the user's ruling.
- [ ] `npm run build` and `node scripts/assert-bundle.mjs` pass; `dist/` holds exactly `main.js`, `manifest.json`, `styles.css`.
- [ ] Every row of `docs/concept/design/validation/design-review-checklist.md`'s **"City and inspection"** and **"Host behavior"** sections has a named verdict with evidence — including the rows already satisfied at baseline, so the checklist reads as a verdict on the whole rather than a diff. The "changed" state is recorded **not-applicable** (comparison is outside WP-01), not passed.
- [ ] `harness-shots/` regenerated and attached for all seven screens in both schemes, each labelled a harness capture.
- [ ] `git status` clean in both `C:\Projects\codebase-inspector` and `C:\Projects\renovation-planner`.
