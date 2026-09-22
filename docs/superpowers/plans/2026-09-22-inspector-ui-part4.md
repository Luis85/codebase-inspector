# WP-02 Part 4 — Workbench, Report, Data & scans, Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the last four placeholders (Refactor workbench, Audit report, Data & scans, Settings) with working screens built from the prototype, add the Work-item editor, and land the Part 3 E55 cleanup first:
- split `screens.css`;
- shared note, empty, strip, cards and grid classes;
- one `useCsvExport` composable;
- a "Sample" mark on `MetricCard`;
- live regions inside dialogs;
- even chart ticks.

**Architecture:** This builds on the Part 1–3 shell unchanged:
- Screens read read models, stores and copy only.
- Every value is a `MetricValue`.
- `city-store` owns selection and route.
- Review decisions go through `ReviewRepository`, in memory.

Part 4 adds no provider and no persistence (spec W1, W2). It adds two small per-leaf Pinia stores (`report-store`, `preferences-store`), pure read models for work items, the report, sources and the review-state export, and a Markdown writer.

**Tech Stack:** TypeScript, Vue 3.5 (`<script setup>`, `defineModel`), Pinia 4, Vitest 5 + @vue/test-utils (jsdom), plain CSS under `:where(.codebase-inspector-root)`, hand-rolled SVG. There is no chart library.

**Spec:** `docs/superpowers/specs/2026-09-22-inspector-ui-part4-design.md` (decisions W1–W17). It sits on top of the Part 1 spec (`2026-09-21-inspector-ui-shell-design.md`, §9 A1–A13), the Part 2 spec (`2026-09-21-inspector-ui-part2-design.md`, P1–P14; P14 supersedes A1) and the Part 3 spec (`2026-09-21-inspector-ui-part3-design.md`, Q1–Q17). All four are binding. The Part 3 ledger rulings (E1–E55) are precedent.

**Branch:** `feat/wp-02-part4` (from `feat/wp-01-codebase-city` at 08cb58f), worktree `C:\Projects\codebase-inspector\.claude\worktrees\wp-02-part4`. **Not stacked:** at the end, `feat/wp-01-codebase-city` is fast-forwarded to this branch and pushed, so the work lands on PR #1. The integration step is the user's choice.

## Global Constraints

**Size**
- `src/**/*.{ts,vue}` max **400** lines. `tests/**/*.ts` max **450** lines (eslint `max-lines`).
- `src/host/city-view.ts` is at 399/400: **add nothing to it**.
- Do not grow `src/ui/screens/CityWorkspace.vue` or `tests/host/city-view-store-wiring.test.ts` (450/450).
- `src/ui/inspector-copy.ts` is at 292. Part 4 strings go in `src/ui/audit-copy/{workbench,report,sources,settings}.ts`, each re-exported with one `export * from './audit-copy/<name>';` line. Screens import copy only from `inspector-copy`.
- Any screen above ~300 lines gets a sub-component in `screens/<screen>/`.

**Browser globals**
- No bare `window`, `document`, `setTimeout`, `ResizeObserver`, `matchMedia`, `getComputedStyle`, `localStorage` in `src/ui/**` (eslint `no-restricted-globals`). No identifier named `window`.
- Use `el.ownerDocument`, `el.ownerDocument.defaultView`, `win.setTimeout`, `nextTick`.
- Never `x instanceof HTMLElement`; always `x.instanceOf(HTMLElement)`.
- Listeners go on the leaf/shell root or on component elements, **never the document**.
- Element ids come from `useUniqueId()` (`src/ui/unique-id.ts`).

**TypeScript and lint**
- tsconfig `lib` is ES2020: no `.at()`, `Object.hasOwn`, `replaceAll`, `findLast` or other ES2021+ API in `src`.
- oxlint runs `--deny-warnings` with `consistent-function-scoping`: a closure that captures nothing is hoisted to module scope.
- `obsidianmd/prefer-create-el` applies (the only exemption is `src/ui/export/download.ts` and its test).
- `exactOptionalPropertyTypes` is on: never assign `undefined` to an optional property; spread it in conditionally.

**Evidence**
- Absent evidence is never rendered or exported as `0`. It is a `MetricValue` with `state: 'unknown'` and a `reason`.
- No composite health score. No exploitability verdict.
- Sample values are always labelled (`ProvenanceBadge`, `isSampleBacked`, the shell badge, "(sample)" in Markdown).
- Mutation, runtime exploitability and secret candidates are always `unknown`.
- No per-person data: no names, authors, owners, teams on work items, rankings.
- Source file **content is never read**.
- **Nothing is written to the vault.** Exports go through `downloadText` (via `useCsvExport`).
- Do not modify `city-store` `select`, `setQuery`, `setCamera` (calling them, and `navigate`/`setViewMode`, is fine).
- Nothing new persists (W1): no plugin-data key, no `localStorage`.

**Copy and CSS**
- Every new visible string goes in `src/ui/audit-copy/*.ts`, **never** `src/ui/copy.ts`. `copy.ts` exports may be imported (e.g. `formatAbsoluteTime`, `COPY_02`).
- After Task 1, CSS lives only in `src/ui/styles/{kit,shell,screens,screens-explore,screens-audit,screens-act,screens-configure}.css`, under `:where(.codebase-inspector-root)`, with BEM `ci-*` classes and colours only through `--ci-*` tokens.
- Every `var(--font-ui-*)` carries an em fallback: `smaller → 0.8em`, `small → 0.9em`, `medium → 1em`, `large → 1.15em`.
- **Never edit `src/ui/styles.css`.** No Vue `<style>` blocks. Import the kit dialog as `CiDialog`.
- After Task 2, a screen never uses another screen's block class: shared looks use `ci-note`, `ci-empty`, `ci-selected-strip`, `ci-screen__cards`, `ci-screen__grid`, `ci-chip` (kit).

**Accessibility**
- Accessible names contain the visible label (WCAG 2.5.3).
- A button that can become blocked while focused uses `aria-disabled="true"` plus a guarded handler, never `disabled` (E40/E44/E50).
- Announce only real outcomes (E17): a store result of `null`/`false` announces nothing, or the refusal.
- Dialog outcomes that leave the dialog open are announced inside it through `CiDialog`'s `status` prop (Task 4).

**Test infrastructure**
- jsdom stubs load through vitest `setupFiles`. Component tests that open a `CiDialog` also `import '../mocks/obsidian'`.
- Tests that mount `App` or a real `CityView` and need the city seed route `'city'`. The harness must keep drawing the city (`tests/unit/obsidian-mock-scope.test.ts`).
- Every `.every(...)` assertion is preceded by a non-empty check (E27). No raw BOM byte in any file: use `String.fromCharCode(0xFEFF)` or the `\uFEFF` escape (E7/E39). Nothing under `src` imports from a `tests/` path, and no `src` folder is named `tests` (E42).
- Edit files only with the Edit/Write tools. **Never `sed -i`, heredocs or scripts**: files are CRLF on Windows.

**Gates and commits**
- Per-task gate: `npm run typecheck && npm run lint:fast && npx vitest run <the task's test files>`, plus `npx eslint <touched files> --max-warnings 0`.
- **The WP-01 evidence-note counts are updated ONCE, in Task 14.** Before that, `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` are expected to fail on file counts. Do not run the full suite per task, and do not "fix" those two tests.
- `tests/unit/install-script.test.ts` fails in any worktree without `.obsidian/`. It is environmental: report it and never fix it.
- Commit after each task. Every message ends with a blank line and `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

**Process**
- Implementers and reviewers never spawn subagents. Implementers report back: files changed with line counts, the gate output, every deviation from this plan and why.
- The controller records every ruling in `docs/superpowers/notes/2026-09-22-wp02-part4-ledger.md`.

## File map

| File | Status | Task | Responsibility |
|---|---|---|---|
| `src/ui/styles/screens.css` → `screens{,-explore,-audit,-act,-configure}.css` | split / create | 1 | E55 split |
| `src/main.ts`, `vite.harness.config.ts` | modify | 1 | import the new CSS files in cascade order |
| `tests/unit/kit-css-fallbacks.test.ts` | modify | 1 | cover every `screens*.css` |
| `src/ui/styles/kit.css` | modify | 2 | `ci-note`, `ci-empty`, `ci-selected-strip`, `ci-screen__cards/__grid`, `ci-chip` |
| `src/ui/screens/**/*.vue` (Part 1–3) | modify | 2, 3 | shared classes; `useCsvExport` |
| `tests/unit/css-class-scope.test.ts` | create | 2 | no cross-screen class reuse |
| `src/ui/export/use-csv-export.ts` | create | 3 | one export handler |
| `src/ui/kit/MetricCard.vue`, `src/ui/kit/Dialog.vue` | modify | 4 | sample mark; in-dialog status region |
| `src/ui/screens/quality/FindingReviewDialog.vue`, `src/ui/screens/dependencies/PackageDetailDialog.vue` | modify | 4 | announce inside the dialog |
| `src/ui/kit/chart-scale.ts`, `kit/{BarChart,LineChart}.vue`, `screens/hotspots/HotspotScatter.vue`, `read-models/hotspots.ts` | modify | 5 | even ticks |
| `src/ui/stores/ports/review-repository.ts`, `src/ui/stores/review-store.ts`, `src/ui/shell/NavColumn.vue` | modify | 6 | work-item fields and editing; open-item badge |
| `src/ui/export/markdown.ts`, `src/ui/read-models/work-items.ts`, `src/ui/audit-copy/workbench.ts` | create | 7 | workbench model, plan Markdown |
| `src/ui/stores/report-store.ts`, `src/ui/read-models/report.ts`, `src/ui/audit-copy/report.ts` | create | 8 | report model and Markdown |
| `src/ui/stores/preferences-store.ts`, `src/ui/read-models/{sources,review-state}.ts`, `src/ui/audit-copy/{sources,settings}.ts` | create | 9 | sources model, review-state JSON, density |
| `src/ui/screens/WorkbenchScreen.vue` + `workbench/{WorkBoard,WorkList,WorkItemEditor}.vue` | create | 10 | Refactor workbench |
| `src/ui/screens/ReportScreen.vue` + `report/{ReportPaper,ReportContents}.vue` | create | 11 | Audit report |
| `src/ui/screens/SourcesScreen.vue` + `sources/{ScopePanel,ScanStatusPanel,ProviderGrid}.vue` | create | 12 | Data & scans |
| `src/ui/screens/SettingsScreen.vue` + `settings/{SettingsSections,ClearReviewDialog}.vue` | create | 13 | Settings; density on the shell; placeholder removal |
| `src/ui/App.vue`, `src/ui/shell/use-route-provenance.ts`, `src/ui/inspector-copy.ts` | modify | 7–13 | outlet branches, provenance cases, re-exports |
| `tests/harness/{page.ts,mount.ts}`, `scripts/harness-shot.mjs` | modify | 14 | `?items=demo`, new shots |
| `docs/superpowers/notes/2026-09-17-wp01-{gate-evidence,implementation-report}.md` | modify | 14 | derived counts |

---

### Task 1: Split `screens.css` (E55)

A pure move: no rule changes, no selector changes. It lands first so no later task adds to a 399-line file.

**Files:**
- Modify: `src/ui/styles/screens.css` (keep lines 1–70: base, Overview, Priority, City)
- Create: `src/ui/styles/screens-explore.css` (current lines 71–216: Architecture, Hotspots, File detail)
- Create: `src/ui/styles/screens-audit.css` (current lines 217–399: Quality, Test confidence, Dependencies, Security, Evolution, Ownership)
- Create: `src/ui/styles/screens-act.css`, `src/ui/styles/screens-configure.css` (headers only; Tasks 10–13 fill them)
- Modify: `src/main.ts`, `vite.harness.config.ts`, `tests/unit/kit-css-fallbacks.test.ts`

**Interfaces:**
- Produces: the stylesheet list `['kit.css', 'shell.css', 'screens.css', 'screens-explore.css', 'screens-audit.css', 'screens-act.css', 'screens-configure.css']` in this cascade order. `tests/unit/city-stage-floor.test.ts` keeps reading `screens.css` (the `.ci-screen--city` rules stay there).

- [ ] **Step 1: Write the failing test.** In `tests/unit/kit-css-fallbacks.test.ts`:
  - Add a module constant `const SCREEN_SHEETS = ['screens.css', 'screens-explore.css', 'screens-audit.css', 'screens-act.css', 'screens-configure.css'] as const;`.
  - Change the fallback loop list from `['kit.css', 'shell.css', 'screens.css']` to `['kit.css', 'shell.css', ...SCREEN_SHEETS]`.
  - Change the aria-disabled assertion `expect(read('screens.css')).not.toMatch(/button\.[\w-]+\[aria-disabled="true"\]/);` into a loop over `SCREEN_SHEETS`, with the same expectation per file.
  - Add:

```ts
  it('no screen stylesheet reaches the 400-line mark (E55)', () => {
    for (const name of SCREEN_SHEETS) {
      expect(read(name).split('\n').length, name).toBeLessThan(400);
    }
  });
  it('main.ts imports every stylesheet in cascade order (E55)', () => {
    const main = readFileSync(resolve(process.cwd(), 'src', 'main.ts'), 'utf8');
    const order = ['kit.css', 'shell.css', ...SCREEN_SHEETS].map((n) => main.indexOf(`./ui/styles/${n}'`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
```

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/unit/kit-css-fallbacks.test.ts`. Expected: FAIL (ENOENT for `screens-explore.css`).
- [ ] **Step 3: Move the rules.**
  - Create `screens-explore.css`. Its first line is `/* WP-02 screens, Explore area: Architecture, Hotspots, File detail (moved from screens.css, Part 4 E55). */`. Then cut the current lines 71–216 of `screens.css` (from `/* Part 2: Architecture. */` through the last File-detail rule before `/* Part 3 Task 8: …`) and paste them, byte for byte.
  - Create `screens-audit.css`. Its first line is `/* WP-02 screens, Audit area: Code quality, Test confidence, Dependencies, Security, Evolution, Ownership (moved from screens.css, Part 4 E55). */`. Then cut the current lines 217–399 of `screens.css` (from `/* Part 3 Task 8: …` to the end) and paste them, byte for byte.
  - Create `screens-act.css` with the single line `/* WP-02 screens, Act area: Refactor workbench and Audit report (Part 4). */`.
  - Create `screens-configure.css` with the single line `/* WP-02 screens, Configure area: Data & scans and Settings (Part 4). */`.
  - Keep the files' existing line-ending style: the Write tool writes what you give it, so copy the moved text through Read, then Write.
  - Afterwards, `screens.css` ends with the City rules (about 70 lines).
- [ ] **Step 4: Imports.**
  - In `src/main.ts`, after `import './ui/styles/screens.css';`, add four lines in this order: `import './ui/styles/screens-explore.css';`, `import './ui/styles/screens-audit.css';`, `import './ui/styles/screens-act.css';`, `import './ui/styles/screens-configure.css';`.
  - In `vite.harness.config.ts`, extend the `pluginStylesheets` array to `['styles.css', 'styles/kit.css', 'styles/shell.css', 'styles/screens.css', 'styles/screens-explore.css', 'styles/screens-audit.css', 'styles/screens-act.css', 'styles/screens-configure.css']`.
- [ ] **Step 5: Run and confirm it passes.** `npx vitest run tests/unit/kit-css-fallbacks.test.ts tests/unit/city-stage-floor.test.ts tests/harness/harness.test.ts tests/unit/assert-bundle.test.ts`, then `npm run build` (the bundle assertion must still see one `styles.css`), then the gate.
- [ ] **Step 6: Commit.** `refactor(ui): split screens.css by area before Part 4 adds rules (E55)`

---

### Task 2: Shared note, empty, strip, cards, grid and chip classes (E55)

**Files:**
- Modify: `src/ui/styles/kit.css`, `src/ui/styles/screens.css`, `src/ui/styles/screens-explore.css`, `src/ui/styles/screens-audit.css`
- Modify (class names only): every `.vue` file listed by `grep -rln "ci-hotspots__note\|ci-hotspots__selected\|ci-overview__cards\|ci-overview__grid\|ci-overview__empty\|ci-findings-table__empty" src/ui`, which is:
  - Screens: Architecture, Dependencies, Evolution, FileDetail, Hotspots, NoSnapshot, Overview, Ownership, Quality, Security, Tests
  - `dependencies/{DependencyPath,PackageDetailDialog,PackageTable}`
  - `evolution/{ChangeCouplingTable,SnapshotComparisonDialog,SnapshotJournal}`
  - `file/{FileFindingsPanel,FileWorkItemsPanel}`
  - `hotspots/{HotspotTable,PriorityList}`
  - `quality/{FindingReviewDialog,FindingsTable}`
  - `test-confidence/CoverageGapsTable`
- Create: `tests/unit/css-class-scope.test.ts`
- Modify: `tests/component/hotspots-screen.test.ts` (4 selectors), `tests/component/tests-screen.test.ts` (1 selector)

**Interfaces:**
- Produces (kit.css): `ci-note`, `ci-empty`, `ci-empty__title`, `ci-selected-strip`, `ci-screen__cards`, `ci-screen__grid`, and `ci-chip` with its generic tones `--sample|--danger|--warning|--success|--unknown`. Every later task uses these names.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/css-class-scope.test.ts`:

```ts
// Part 4 E55: a screen never borrows another screen's block class; shared looks live in kit.css.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = resolve(process.cwd(), 'src', 'ui');
function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? vueFiles(p) : p.endsWith('.vue') ? [p] : [];
  });
}
const FILES = vueFiles(UI).map((p) => ({ path: relative(UI, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));

/** Block prefix → the only files allowed to use it. */
const OWNERS: Readonly<Record<string, RegExp>> = {
  'ci-overview__': /^screens\/(OverviewScreen\.vue|overview\/)/,
  'ci-hotspots__': /^screens\/(HotspotsScreen\.vue|hotspots\/)/,
  'ci-findings-table__': /^screens\/(QualityScreen\.vue|quality\/)/,
};
const RETIRED = ['ci-hotspots__note', 'ci-hotspots__selected', 'ci-overview__cards', 'ci-overview__grid', 'ci-overview__empty', 'ci-findings-table__empty'];

describe('CSS class scope (Part 4 E55)', () => {
  it('finds the Vue files', () => { expect(FILES.length).toBeGreaterThan(50); });
  it('uses no retired shared-by-accident class anywhere', () => {
    for (const f of FILES) for (const cls of RETIRED) expect(f.text.includes(cls), `${f.path} uses ${cls}`).toBe(false);
  });
  it('uses a screen block prefix only inside that screen', () => {
    for (const [prefix, owner] of Object.entries(OWNERS)) {
      for (const f of FILES) if (f.text.includes(prefix)) expect(owner.test(f.path), `${f.path} uses ${prefix}`).toBe(true);
    }
  });
  it('kit.css defines the shared classes', () => {
    const kit = readFileSync(join(UI, 'styles', 'kit.css'), 'utf8');
    for (const cls of ['.ci-note', '.ci-empty', '.ci-empty__title', '.ci-selected-strip', '.ci-screen__cards', '.ci-screen__grid', '.ci-chip ', '.ci-chip--sample']) {
      expect(kit.includes(`:where(.codebase-inspector-root) ${cls}`), cls).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/unit/css-class-scope.test.ts`.
- [ ] **Step 3: Kit rules.** Append to `kit.css`:

```css
/* Part 4 E55: shared looks that screens used to borrow from each other. */
:where(.codebase-inspector-root) .ci-note { margin: 0; color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-empty { display: flex; flex-direction: column; align-items: flex-start; gap: var(--ci-space-3); color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-empty__title { margin: 0; color: var(--ci-text); font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-selected-strip { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ci-space-2); color: var(--ci-text-muted); font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-screen__cards { display: grid; gap: var(--ci-space-4); grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
:where(.codebase-inspector-root) .ci-screen__grid { display: grid; gap: var(--ci-space-4); grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); }
@container (max-width: 900px) {
  :where(.codebase-inspector-root) .ci-screen__grid { grid-template-columns: minmax(0, 1fr); }
}
```

  Then **move** into `kit.css`, after the block above:
  - from `screens-explore.css`: the `.ci-chip` base rule (formerly screens.css:195) and `.ci-chip--sample`;
  - from `screens-audit.css`: `.ci-chip--danger|--warning|--success|--unknown`.
  Keep each rule's body unchanged. The screen-specific variants (`--status-*`, `--dep-*`, `.ci-stewardship .ci-chip`) stay where they are.
- [ ] **Step 4: Retire the old rules.**
  - In `screens.css`, delete `.ci-overview__cards`, `.ci-overview__grid` (with its `@container` block) and `.ci-overview__empty`.
  - In `screens-explore.css`:
    - Delete `.ci-hotspots__note`.
    - Rename `.ci-hotspots__selected` to `.ci-selected-strip`, and merge any declarations missing from the kit rule into the kit rule rather than keeping two rules.
    - Delete the moved chip rules.
  - In `screens-audit.css`, change the four `.ci-hotspots__note` descendant selectors to `.ci-note` (e.g. `.ci-findings-table__footer .ci-note`), and `.ci-findings-table__empty` to `.ci-empty`.
- [ ] **Step 5: Rename the class uses in the Vue files.** Use Edit, one file at a time:
  - `ci-hotspots__note` → `ci-note`
  - `ci-hotspots__selected` → `ci-selected-strip` (in HotspotsScreen too, so the test's retired list holds)
  - `ci-overview__cards` → `ci-screen__cards`
  - `ci-overview__grid` → `ci-screen__grid`
  - `class="ci-overview__empty ci-no-snapshot"` → `class="ci-empty ci-no-snapshot"`
  - In `PackageTable.vue`, `ci-findings-table__empty` → `ci-empty` and `ci-findings-table__empty-title` → `ci-empty__title`

  In `quality/FindingsTable.vue`:
  - `.ci-findings-table__empty` gets the extra class `ci-empty`, so it keeps its own hook for the Quality tests.
  - The title stays as it is.
  - Remove the retired class name from the markup: the empty wrapper becomes `class="ci-findings-table__none ci-empty"`.
  - Update any Quality test selector that read `.ci-findings-table__empty` to `.ci-findings-table__none`.
  - Keep `ci-findings-table__reset`.
- [ ] **Step 6: Tests.** In `tests/component/hotspots-screen.test.ts` and `tests/component/tests-screen.test.ts`, replace `.ci-hotspots__selected` with `.ci-selected-strip`. Update any other test selector the grep in Step 5 breaks, and list each one in your report.
- [ ] **Step 7: Run and confirm it passes.** `npx vitest run tests/unit/css-class-scope.test.ts tests/unit/kit-css-fallbacks.test.ts tests/component/hotspots-screen.test.ts tests/component/tests-screen.test.ts tests/component/quality-screen.test.ts tests/component/dependencies-screen.test.ts tests/component/overview-screen.test.ts tests/component/ownership-screen.test.ts tests/component/evolution-screen.test.ts tests/component/security-screen.test.ts tests/component/file-detail-screen.test.ts tests/component/architecture-screen.test.ts`, then the gate.
- [ ] **Step 8: Commit.** `refactor(ui): shared note/empty/strip/cards/grid/chip classes in the kit; no cross-screen class reuse (E55)`

---

### Task 3: One export handler, `useCsvExport` (E55)

**Files:**
- Create: `src/ui/export/use-csv-export.ts`
- Modify: `src/ui/screens/{Hotspots,Quality,Tests,Dependencies,Security,Ownership}Screen.vue`
- Test: `tests/unit/use-csv-export.test.ts` (new), `tests/component/hotspots-screen.test.ts`

**Interfaces:**
- Produces: `CSV_MIME = 'text/csv;charset=utf-8'`, `MARKDOWN_MIME = 'text/markdown;charset=utf-8'`, `JSON_MIME = 'application/json;charset=utf-8'` and `useCsvExport(root: Ref<HTMLElement | null>, liveMessage: Ref<string>): (filename: string, build: () => string, mime?: string) => void`.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/use-csv-export.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import { CSV_MIME, MARKDOWN_MIME, useCsvExport } from '../../src/ui/export/use-csv-export';
import { EXPORT_FAILED } from '../../src/ui/inspector-copy';

const host = {} as HTMLElement;

describe('useCsvExport (Part 4 E55)', () => {
  beforeEach(() => { vi.mocked(downloadText).mockReset(); });

  it('hands the built text to downloadText through the root, CSV by default', () => {
    const live = ref('');
    useCsvExport(ref(host), live)('a.csv', () => 'x');
    expect(downloadText).toHaveBeenCalledWith(host, 'a.csv', 'x', CSV_MIME);
    expect(live.value).toBe('');
  });
  it('passes another MIME type through', () => {
    useCsvExport(ref(host), ref(''))('r.md', () => '# r', MARKDOWN_MIME);
    expect(downloadText).toHaveBeenCalledWith(host, 'r.md', '# r', MARKDOWN_MIME);
  });
  it('announces EXPORT_FAILED when the download throws, and nothing is thrown', () => {
    vi.mocked(downloadText).mockImplementation(() => { throw new Error('no window'); });
    const live = ref('');
    expect(() => useCsvExport(ref(host), live)('a.csv', () => 'x')).not.toThrow();
    expect(live.value).toBe(EXPORT_FAILED);
  });
  it('does nothing without a root', () => {
    useCsvExport(ref(null), ref(''))('a.csv', () => 'x');
    expect(downloadText).not.toHaveBeenCalled();
  });
});
```

  In `tests/component/hotspots-screen.test.ts`, add a test: make the mocked `downloadText` throw once (`mockImplementationOnce`), click `.ci-hotspots__export`, and expect `w.find('.ci-hotspots__live').text()` to be `'Could not start the download.'`. The file already mocks `downloadText`. If it does not, add the mock line from Step 1.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/use-csv-export.test.ts tests/component/hotspots-screen.test.ts`
- [ ] **Step 3: Implement.** Create `src/ui/export/use-csv-export.ts`:

```ts
// Part 4 E55: the one export handler every screen uses. The download goes through the
// leaf's own document (P8), nothing is written to the vault, and a failure is announced
// in the screen's live region. Success announces nothing (E17): the save dialog that
// Electron shows is the outcome.
import type { Ref } from 'vue';
import { EXPORT_FAILED } from '../inspector-copy';
import { downloadText } from './download';

export const CSV_MIME = 'text/csv;charset=utf-8';
export const MARKDOWN_MIME = 'text/markdown;charset=utf-8';
export const JSON_MIME = 'application/json;charset=utf-8';

export function useCsvExport(root: Ref<HTMLElement | null>, liveMessage: Ref<string>): (filename: string, build: () => string, mime?: string) => void {
  return (filename, build, mime = CSV_MIME) => {
    const host = root.value;
    if (!host) return;
    try {
      downloadText(host, filename, build(), mime);
    } catch {
      liveMessage.value = EXPORT_FAILED;
    }
  };
}
```

- [ ] **Step 4: Use it in the six screens.** In each screen:
  - Add `import { useCsvExport } from '../export/use-csv-export';`.
  - Drop the `downloadText` import (and `EXPORT_FAILED` if it is no longer used).
  - Replace the handler body. For example, in `QualityScreen.vue`:

```ts
const exportText = useCsvExport(root, liveMessage);
/** Every filtered finding, handed to the user through this leaf's own document. */
function exportCsv(): void { exportText(QUALITY_CSV_FILENAME, () => findingsCsv(rows.value)); }
```

  The builders for the other screens:
  - Tests: `() => gapsCsv(testConfidence.value?.gaps ?? [])`. Keep the existing `!testConfidence` disabled guard on the button.
  - Dependencies: `() => packagesCsv(filtered.value)`.
  - Security: `() => advisoriesCsv(security.value.advisories)`.
  - Ownership: `() => stewardshipCsv(ownership.value.rows)`.
  - Hotspots: `() => hotspotsCsv(model.value.rows)`.

  Hotspots has no live region yet. Add `const liveMessage = ref('');`, and right after `</PageHeader>` add:

```vue
    <p
      class="visually-hidden ci-hotspots__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
```

- [ ] **Step 5: Run and confirm they pass.** `npx vitest run tests/unit/use-csv-export.test.ts tests/component/hotspots-screen.test.ts tests/component/quality-screen.test.ts tests/component/tests-screen.test.ts tests/component/dependencies-screen.test.ts tests/component/security-screen.test.ts tests/component/ownership-screen.test.ts tests/unit/css-class-scope.test.ts`, then the gate. Confirm with grep that `downloadText(` now appears in `src/ui` only in `export/download.ts` and `export/use-csv-export.ts`.
- [ ] **Step 6: Commit.** `refactor(ui): one useCsvExport handler for every export; Hotspots announces a failed download (E55)`

---

### Task 4: MetricCard "Sample" mark and live regions inside dialogs (E55)

**Files:**
- Modify: `src/ui/kit/MetricCard.vue`, `src/ui/kit/Dialog.vue`, `src/ui/screens/quality/FindingReviewDialog.vue`, `src/ui/screens/dependencies/PackageDetailDialog.vue`, `src/ui/screens/{QualityScreen,FileDetailScreen,DependenciesScreen,SecurityScreen}.vue`, `src/ui/styles/screens-audit.css`
- Test: `tests/component/kit-sample-mark.test.ts` (new), `tests/component/quality-screen.test.ts`, `tests/component/dependencies-screen.test.ts`

**Interfaces:**
- Produces:
  - `CiDialog` props become `{ label: string; status?: string }`. When `status` is set, it renders `<p class="visually-hidden ci-dialog__status" role="status">{{ status }}</p>` as the panel's first child. The element is always rendered, and only its text changes.
  - `FindingReviewDialog` emits `close`, `openFile` only (no `announce`).
  - `PackageDetailDialog` emits `close` only.
  - `MetricCard` renders `.ci-metric-card__sample` (a `ProvenanceBadge state="sample"`) when `isSampleBacked(value) && value.state !== 'sample'`.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/kit-sample-mark.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import '../mocks/obsidian';
import MetricCard from '../../src/ui/kit/MetricCard.vue';
import CiDialog from '../../src/ui/kit/Dialog.vue';
import { collected, sample, sumEvidence, unknown } from '../../src/ui/evidence';

describe('MetricCard sample mark (Part 4 E55)', () => {
  it('marks a partial aggregate that includes sample inputs as Sample as well as Partial', () => {
    const value = sumEvidence([collected(3, 'inventory'), sample(4), unknown('x')]);
    const w = mount(MetricCard, { props: { label: 'L', icon: 'code', value } });
    expect(w.find('.ci-provenance--partial').exists()).toBe(true);
    expect(w.find('.ci-metric-card__sample').text()).toBe('Sample');
    w.unmount();
  });
  it('does not double-mark a plain sample value, nor mark a collected one', () => {
    const a = mount(MetricCard, { props: { label: 'L', icon: 'code', value: sample(4) } });
    expect(a.findAll('.ci-provenance')).toHaveLength(1);
    expect(a.find('.ci-metric-card__sample').exists()).toBe(false);
    a.unmount();
    const b = mount(MetricCard, { props: { label: 'L', icon: 'code', value: collected(4, 'inventory') } });
    expect(b.find('.ci-provenance').exists()).toBe(false);
    b.unmount();
  });
});

describe('CiDialog status region (Part 4 E55)', () => {
  it('renders a role=status region inside the modal and updates its text', async () => {
    const w = mount(CiDialog, { props: { label: 'D', status: '' }, slots: { default: '<button>x</button>' }, attachTo: document.body });
    const region = w.find('[role="dialog"] .ci-dialog__status');
    expect(region.attributes('role')).toBe('status');
    await w.setProps({ status: 'Saved.' });
    expect(w.find('[role="dialog"] .ci-dialog__status').text()).toBe('Saved.');
    w.unmount();
  });
  it('renders no region without the prop', () => {
    const w = mount(CiDialog, { props: { label: 'D' }, slots: { default: '<button>x</button>' }, attachTo: document.body });
    expect(w.find('.ci-dialog__status').exists()).toBe(false);
    w.unmount();
  });
});
```

  In `tests/component/quality-screen.test.ts`, extend the acknowledge test:
  - after acknowledging, expect `w.find('.ci-finding-dialog .ci-dialog__status').text()` to be `'Finding acknowledged. No repository suppression was written.'`. First read the actual `FINDING_ACKNOWLEDGED` value in `audit-copy/quality.ts` and use it.
  - also expect `w.find('.ci-quality__live').text()` to be `''`.

  In `tests/component/dependencies-screen.test.ts`, change the create-review-item test so it expects the package dialog's `.ci-dialog__status` text to be `PACKAGE_REVIEW_ADDED`, imported from `inspector-copy`.
  Also update any existing assertion in these two files that read the outcome from the screen's live region, and list each one.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/kit-sample-mark.test.ts tests/component/quality-screen.test.ts tests/component/dependencies-screen.test.ts`
- [ ] **Step 3: MetricCard.** Import `isSampleBacked`, and add `import { SAMPLE_BADGE_DETAIL } from '../inspector-copy';`. Add `const alsoSample = computed(() => props.value.state !== 'sample' && isSampleBacked(props.value));`. Right after the existing `ProvenanceBadge` in the header, add:

```vue
      <ProvenanceBadge
        v-if="alsoSample"
        class="ci-metric-card__sample"
        state="sample"
        :detail="SAMPLE_BADGE_DETAIL"
      />
```

- [ ] **Step 4: Dialog.** Change `defineProps<{ label: string }>()` to `defineProps<{ label: string; status?: string }>()`. Add this as the first child of `.ci-dialog`, before `<slot />`:

```vue
      <p
        v-if="status !== undefined"
        class="visually-hidden ci-dialog__status"
        role="status"
      >
        {{ status }}
      </p>
```

  Its `p` is not focusable, so the `FOCUSABLE` query is unaffected.
- [ ] **Step 5: FindingReviewDialog.**
  - Remove `announce` from `defineEmits`.
  - Add `const status = ref('');`.
  - Replace `run` with the version below (E17: a refusal announces nothing):

```ts
/** Records a decision only; no repository suppression is ever written (Q3). The outcome
 *  is announced INSIDE the dialog (Part 4 E55): a region outside an aria-modal dialog is
 *  hidden from assistive technology while the dialog is open. */
async function run(action: () => Promise<unknown>, done: string): Promise<void> {
  error.value = '';
  try {
    const result = await action();
    if (result !== null && result !== false) status.value = done;
  } catch {
    error.value = FINDING_DECISION_FAILED;
  }
}
```

  - Pass `:status="status"` to `<CiDialog>`.
  - In `QualityScreen.vue` and `FileDetailScreen.vue`, delete `@announce="liveMessage = $event"` from `<FindingReviewDialog>`.
- [ ] **Step 6: PackageDetailDialog.**
  - Emits become `{ close: [] }`.
  - Add `const status = ref('');` and `const error = ref('');`.
  - In `createReview`:
    - on success: `if (item) status.value = PACKAGE_REVIEW_ADDED;`
    - in the catch: `error.value = PACKAGE_REVIEW_FAILED;`
  - Pass `:status="status"` to `CiDialog`.
  - Render `<p v-if="error" class="ci-package-dialog__error" role="alert">{{ error }}</p>` right after the "Create review item" button.
  - In `DependenciesScreen.vue` and `SecurityScreen.vue`, delete `@announce="liveMessage = $event"` from `<PackageDetailDialog>`.
  - Add `ref` to the Vue import.
  - In `screens-audit.css`, next to the other `.ci-package-dialog` rules, add `:where(.codebase-inspector-root) .ci-package-dialog__error { margin: 0; color: var(--ci-tone-danger); }`.
- [ ] **Step 7: Run and confirm they pass.** `npx vitest run tests/component/kit-sample-mark.test.ts tests/component/kit-display.test.ts tests/component/kit-interactive.test.ts tests/component/quality-screen.test.ts tests/component/dependencies-screen.test.ts tests/component/security-screen.test.ts tests/component/file-detail-screen.test.ts tests/unit/css-class-scope.test.ts`, then the gate.
- [ ] **Step 8: Commit.** `fix(ui): MetricCard marks sample-backed partial values; dialogs announce outcomes inside the modal (E55)`

---

### Task 5: Even chart ticks (E55)

**Files:**
- Modify: `src/ui/kit/chart-scale.ts`, `src/ui/kit/BarChart.vue`, `src/ui/kit/LineChart.vue`, `src/ui/read-models/hotspots.ts`, `src/ui/screens/hotspots/HotspotScatter.vue`
- Test: `tests/unit/chart-scale.test.ts` (new), `tests/unit/hotspots-model.test.ts`

**Interfaces:**
- Produces:
  - `interface NiceScale { max: number; step: number; ticks: readonly number[] }`
  - `niceTicks(value: number, target = 4, floor = 10): NiceScale`
  - `niceMax(v) = niceTicks(v).max`
  - `SCATTER_TICKS = 5`
  - `HotspotsModel` gains `xTicks: readonly number[]` and `yTicks: readonly number[]`.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/chart-scale.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { niceMax, niceTicks } from '../../src/ui/kit/chart-scale';

const evenIntegers = (ticks: readonly number[]): boolean => ticks.length > 1
  && ticks.every((t) => Number.isInteger(t))
  && ticks.every((t, i) => i === 0 || t - ticks[i - 1]! === ticks[1]! - ticks[0]!);

describe('niceTicks (Part 4 E55)', () => {
  it('never produces 12.5-style ticks', () => {
    expect(niceTicks(50)).toEqual({ max: 60, step: 20, ticks: [0, 20, 40, 60] });
    expect(niceTicks(37)).toEqual({ max: 40, step: 10, ticks: [0, 10, 20, 30, 40] });
  });
  it('keeps the floor and uses 2.5 steps only from 10 up', () => {
    expect(niceTicks(0)).toEqual({ max: 10, step: 5, ticks: [0, 5, 10] });
    expect(niceTicks(3)).toEqual({ max: 10, step: 5, ticks: [0, 5, 10] });
    expect(niceTicks(100, 4, 100)).toEqual({ max: 100, step: 25, ticks: [0, 25, 50, 75, 100] });
    expect(niceTicks(137, 4, 100)).toEqual({ max: 150, step: 50, ticks: [0, 50, 100, 150] });
  });
  it('gives evenly spaced integer ticks whose last tick is the max, across a range of inputs', () => {
    for (let v = 0; v <= 5000; v += 7) {
      for (const target of [4, 5]) {
        const s = niceTicks(v, target);
        expect(evenIntegers(s.ticks), `${v}/${target}`).toBe(true);
        expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
        expect(s.max).toBeGreaterThanOrEqual(Math.max(10, v));
      }
    }
  });
  it('niceMax is niceTicks(v).max', () => { expect(niceMax(43)).toBe(niceTicks(43).max); });
});
```

  In `tests/unit/hotspots-model.test.ts`, add an assertion to an existing model test:
  - `xTicks` and `yTicks` are non-empty;
  - they end at `xMax` and `yMax`;
  - all entries are integers.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/chart-scale.test.ts tests/unit/hotspots-model.test.ts`
- [ ] **Step 3: Implement `chart-scale.ts`.** Replace the file:

```ts
// E12 / Part 4 E55: one axis scale for every chart. The step is 1, 2, 2.5 or 5 × 10^n
// (2.5 only from 10 up, so every tick stays an integer), the ticks are evenly spaced
// from 0, and the last tick is the axis maximum. `floor` keeps a tiny or empty series
// from producing a 0..1 axis.
export interface NiceScale { max: number; step: number; ticks: readonly number[] }

export function niceTicks(value: number, target = 4, floor = 10): NiceScale {
  const top = Math.max(floor, Number.isFinite(value) ? value : 0);
  const raw = top / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factors = magnitude >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
  const step = factors.map((f) => f * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const max = Math.ceil(top / step) * step;
  const ticks: number[] = [];
  for (let i = 0; i * step <= max; i += 1) ticks.push(Math.round(i * step));
  return { max, step, ticks };
}

export const niceMax = (v: number): number => niceTicks(v).max;
```

- [ ] **Step 4: BarChart.**
  - Import `niceTicks` instead of `niceMax`.
  - Replace the `yMax` and `ticks` computeds with:
    - `const scale = computed(() => niceTicks(Math.max(0, ...props.bars.map((b) => heightValue(b.value)))));`
    - `const yMax = computed(() => scale.value.max);`
    - `const ticks = computed(() => scale.value.ticks);`
  - The template already draws `y(t)` and `{{ t }}`.
- [ ] **Step 5: LineChart.**
  - Delete `const TICKS = [0, 25, 50, 75, 100];`.
  - Import `niceTicks` from `./chart-scale`.
  - Replace `yMax` with:
    - `const scale = computed(() => niceTicks(Math.max(0, ...props.series.flatMap((s) => s.points.map((p) => p.value))), 4, 100));`
    - `const yMax = computed(() => scale.value.max);`
  - In the grid `v-for`, iterate `t in scale.ticks`, and use `y(t)` for both `y1`/`y2` and the label position. Use `{{ t }}` as the label, so the gridline and label sit at the same value.
  - Check the template's current expression before editing. It is `y(t * yMax / 100)` with label `Math.round(t * yMax / 100)`.
- [ ] **Step 6: Hotspots.**
  - In `read-models/hotspots.ts`:
    - export `const SCATTER_TICKS = 5;` and import `niceTicks`;
    - compute `const xs = niceTicks(Math.max(0, ...points.map((p) => p.x)), SCATTER_TICKS);` and the same for `ys` with `p.y`;
    - set `xMax: xs.max, yMax: ys.max, xTicks: xs.ticks, yTicks: ys.ticks`;
    - add both tick fields to `HotspotsModel`.
  - In `HotspotScatter.vue`:
    - delete the local `TICKS` constant and the `ticks(max)` helper;
    - iterate `model.yTicks` and `model.xTicks` in the two axis `v-for`s;
    - show labels as `{{ t }}`, with no `Math.round`.
- [ ] **Step 7: Run and confirm they pass.** `npx vitest run tests/unit/chart-scale.test.ts tests/unit/hotspots-model.test.ts tests/component/hotspots-screen.test.ts tests/component/evolution-screen.test.ts tests/component/overview-screen.test.ts tests/component/kit-display.test.ts tests/component/file-detail-screen.test.ts`, then the gate. If a test pinned an old tick label or axis maximum, update it to the new value and list it in your report.
- [ ] **Step 8: Commit.** `fix(ui): evenly spaced integer chart ticks from one niceTicks scale (E55)`

---

### Task 6: Review port: editable work items (W8, W9, W13)

**Files:**
- Modify: `src/ui/stores/ports/review-repository.ts`, `src/ui/stores/review-store.ts`, `src/ui/shell/NavColumn.vue`
- Test: `tests/unit/review-work-items.test.ts` (new), `tests/unit/review-store.test.ts` (three `WorkItem` literals), `tests/component/nav-column.test.ts`

**Interfaces:**
- Produces, in `review-repository.ts`:
  - `type WorkPriority = 'high' | 'medium' | 'low'`
  - `type WorkChecks = readonly [boolean, boolean, boolean]`
  - `NO_CHECKS: WorkChecks`
  - `WORK_TITLE_MAX = 160`, `WORK_NOTES_MAX = 5000`
  - `WorkItem` gains `priority: WorkPriority; notes: string; checks: WorkChecks; updatedAt?: string`
  - `interface WorkItemPatch { title?: string; status?: WorkItemStatus; priority?: WorkPriority; notes?: string; checks?: WorkChecks }`
  - `interface WorkItemInit { priority?: WorkPriority; notes?: string; status?: WorkItemStatus; checks?: WorkChecks }`
  - `allChecksDone(checks: WorkChecks): boolean`
  - `workItemProblem(item: Pick<WorkItem, 'title' | 'notes' | 'status' | 'checks'>): 'title-empty' | 'title-long' | 'notes-long' | 'unverified' | null`
- Produces, in `review-store`:
  - `addWorkItem(target, intent, title, now, init?: WorkItemInit): Promise<WorkItem | null>`
  - `updateWorkItem(id: string, patch: WorkItemPatch, now: Date): Promise<WorkItem | null>`
  - `removeWorkItem(id: string): Promise<boolean>` (false when refused as pending)
  - `clearAll(): Promise<void>`
  - getters `openWorkItemCount: number`, `isItemPending(id: string): boolean`
  - state `pendingItemIds: string[]`

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/review-work-items.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import {
  createInMemoryReviewRepository, NO_CHECKS, WORK_NOTES_MAX, WORK_TITLE_MAX, workItemProblem, type ReviewRepository,
} from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-22T10:00:00Z');
const LATER = new Date('2026-09-22T11:00:00Z');
const file = (entityId: string) => ({ kind: 'file' as const, entityId });

async function withItem() {
  const store = useReviewStore();
  const item = await store.addWorkItemForFile('e1', 'Split the parser', NOW);
  return { store, id: item!.id };
}

describe('editable work items (Part 4 W8/W9)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('creates items with medium priority, empty notes and no checks, or with the given init', async () => {
    const store = useReviewStore();
    const a = await store.addWorkItemForFile('e1', 't', NOW);
    expect(a).toMatchObject({ priority: 'medium', notes: '', checks: NO_CHECKS, status: 'investigate' });
    const b = await store.addWorkItem(file('e1'), 'tests', 't2', NOW, { priority: 'high', notes: 'why' });
    expect(b).toMatchObject({ priority: 'high', notes: 'why' });
    const c = await store.addWorkItem(file('e1'), 'documentation', 't3', NOW, { status: 'verified', checks: [true, false, false] });
    expect(c).toBeNull();
    const d = await store.addWorkItem(file('e1'), 'documentation', 't3', NOW, { status: 'verified', checks: [true, true, true] });
    expect(d).toMatchObject({ status: 'verified' });
  });

  it('updates title, status, priority, notes and checks, trimming the title and stamping updatedAt', async () => {
    const { store, id } = await withItem();
    const next = await store.updateWorkItem(id, { title: '  Split parser  ', status: 'planned', priority: 'low', notes: 'n', checks: [true, false, false] }, LATER);
    expect(next).toMatchObject({ title: 'Split parser', status: 'planned', priority: 'low', notes: 'n', checks: [true, false, false], updatedAt: LATER.toISOString() });
    expect(store.workItems[0]).toEqual(next);
  });

  it('refuses verified until all three checks are done, in the store', async () => {
    const { store, id } = await withItem();
    expect(await store.updateWorkItem(id, { status: 'verified', checks: [true, true, false] }, LATER)).toBeNull();
    expect(store.workItems[0]!.status).toBe('investigate');
    expect(await store.updateWorkItem(id, { status: 'verified', checks: [true, true, true] }, LATER)).not.toBeNull();
  });

  it('refuses an empty or over-long title and over-long notes', async () => {
    const { store, id } = await withItem();
    expect(await store.updateWorkItem(id, { title: '   ' }, LATER)).toBeNull();
    expect(await store.updateWorkItem(id, { title: 'x'.repeat(WORK_TITLE_MAX + 1) }, LATER)).toBeNull();
    expect(await store.updateWorkItem(id, { notes: 'x'.repeat(WORK_NOTES_MAX + 1) }, LATER)).toBeNull();
    expect(await store.updateWorkItem('nope', { title: 'a' }, LATER)).toBeNull();
    expect(workItemProblem({ title: 'a', notes: '', status: 'verified', checks: NO_CHECKS })).toBe('unverified');
  });

  it('persists before mutating: a rejecting port leaves the item unchanged and the rejection propagates', async () => {
    const { store, id } = await withItem();
    const repo: ReviewRepository = { ...createInMemoryReviewRepository(), saveWorkItem: () => Promise.reject(new Error('disk')) };
    store.setRepository(repo);
    await expect(store.updateWorkItem(id, { title: 'b' }, LATER)).rejects.toThrow('disk');
    expect(store.workItems[0]!.title).toBe('Split the parser');
    expect(store.isItemPending(id)).toBe(false);
  });

  it('is pending-aware per id for update and remove', async () => {
    const { store, id } = await withItem();
    const first = store.updateWorkItem(id, { title: 'b' }, LATER);
    expect(store.isItemPending(id)).toBe(true);
    expect(await store.updateWorkItem(id, { title: 'c' }, LATER)).toBeNull();
    expect(await store.removeWorkItem(id)).toBe(false);
    await first;
    expect(await store.removeWorkItem(id)).toBe(true);
    expect(store.workItems).toHaveLength(0);
  });

  it('counts open (not verified) items and clears everything through the port', async () => {
    const { store, id } = await withItem();
    await store.addWorkItemForFile('e2', 't', NOW);
    await store.updateWorkItem(id, { status: 'verified', checks: [true, true, true] }, LATER);
    expect(store.openWorkItemCount).toBe(1);
    await store.addRule('a', 'b', 'why', NOW);
    await store.acknowledge('e1#CX-1', NOW);
    await store.clearAll();
    expect(store.workItems).toHaveLength(0);
    expect(store.rules).toHaveLength(0);
    expect(store.dispositions).toHaveLength(0);
    expect(await store.repository.listWorkItems()).toHaveLength(0);
  });
});
```

  In `tests/unit/review-store.test.ts`, add `priority: 'medium', notes: '', checks: [false, false, false]` to the three `WorkItem` literals (lines 35, 49, 52), so typecheck passes.

  In `tests/component/nav-column.test.ts`, add a test:
  - add two work items through `useReviewStore().addWorkItemForFile(...)`;
  - update one to verified with all checks done;
  - assert that `badgeFor(w, 'Refactor workbench')` is `'1'`.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/review-work-items.test.ts tests/component/nav-column.test.ts`
- [ ] **Step 3: The port.** In `review-repository.ts`, after `WorkIntent`:

```ts
/** Part 4 W8: how urgent the reviewer judges the work; a user decision, not evidence. */
export type WorkPriority = 'high' | 'medium' | 'low';
/** Part 4 W8: the three verification checks, in the order the editor lists them. */
export type WorkChecks = readonly [boolean, boolean, boolean];
export const NO_CHECKS: WorkChecks = [false, false, false];
export const WORK_TITLE_MAX = 160;
export const WORK_NOTES_MAX = 5000;
```

  Then extend `WorkItem` with `priority: WorkPriority;`, `notes: string;`, `checks: WorkChecks;` and `updatedAt?: string;`. After `workTargetKey`, add:

```ts
/** Part 4 W9: what an edit may change. The target and intent are the item's identity
 *  (Q4), so they never change after creation. */
export interface WorkItemPatch { title?: string; status?: WorkItemStatus; priority?: WorkPriority; notes?: string; checks?: WorkChecks }
/** Part 4 W11: what the editor's create mode may set up front. `addWorkItem` validates
 *  the result with `workItemProblem`, so a new item can never start as an unchecked
 *  `verified`. */
export interface WorkItemInit { priority?: WorkPriority; notes?: string; status?: WorkItemStatus; checks?: WorkChecks }

export function allChecksDone(checks: WorkChecks): boolean {
  return checks[0] && checks[1] && checks[2];
}

/** Part 4 W9: the one validity rule, shared by the store (which refuses) and the editor
 *  (which explains). `verified` needs every check done. */
export function workItemProblem(item: Pick<WorkItem, 'title' | 'notes' | 'status' | 'checks'>): 'title-empty' | 'title-long' | 'notes-long' | 'unverified' | null {
  const title = item.title.trim();
  if (title === '') return 'title-empty';
  if (title.length > WORK_TITLE_MAX) return 'title-long';
  if (item.notes.length > WORK_NOTES_MAX) return 'notes-long';
  if (item.status === 'verified' && !allChecksDone(item.checks)) return 'unverified';
  return null;
}
```

- [ ] **Step 4: The store.**
  - Import `NO_CHECKS`, `workItemProblem`, `type WorkItemInit`, `type WorkItemPatch`.
  - Add `pendingItemIds: string[];` to `ReviewState`, with the doc comment `/** Part 4 W9: work-item ids with an update or removal in flight. */`, and `pendingItemIds: []` to the initial state.
  - Getters:

```ts
    /** Part 4 W13: the nav badge counts what is still to do. */
    openWorkItemCount: (state): number => state.workItems.filter((w) => w.status !== 'verified').length,
    isItemPending: (state) => (id: string): boolean => state.pendingItemIds.includes(id),
```

  - In `addWorkItem`:
    - add the parameter `init: WorkItemInit = {}`;
    - build the item as `{ id: \`wi-${this.nextId}\`, target, intent, title: title.trim(), status: init.status ?? 'investigate', priority: init.priority ?? 'medium', notes: init.notes ?? '', checks: init.checks ?? NO_CHECKS, createdAt: now.toISOString() }`;
    - after the existing duplicate/pending guard, add `if (workItemProblem(item) !== null) return null;`. Build the item before the guard's id reservation: create it with the current `nextId`, check it, then increment `nextId`.
  - Replace `removeWorkItem` and add `updateWorkItem` and `clearAll`:

```ts
    /** Part 4 W9: same persist-first ordering and pending reservation as `addWorkItem`,
     *  keyed by id. Refuses (null) an unknown id, a pending id, and any edit that
     *  `workItemProblem` rejects — `verified` needs all three checks, here as well as in
     *  the editor. */
    async updateWorkItem(id: string, patch: WorkItemPatch, now: Date): Promise<WorkItem | null> {
      const current = this.workItems.find((w) => w.id === id);
      if (!current || this.pendingItemIds.includes(id)) return null;
      const next: WorkItem = { ...current, ...patch, updatedAt: now.toISOString() };
      next.title = next.title.trim();
      if (workItemProblem(next) !== null) return null;
      this.pendingItemIds.push(id);
      try {
        await this.repository.saveWorkItem(next);
        this.workItems = this.workItems.map((w) => (w.id === id ? next : w));
        return next;
      } finally {
        this.pendingItemIds = this.pendingItemIds.filter((p) => p !== id);
      }
    },
    /** Persist first (a rejecting port leaves the item in place); refused (false) while
     *  an update or removal of the same id is in flight. */
    async removeWorkItem(id: string): Promise<boolean> {
      if (this.pendingItemIds.includes(id)) return false;
      this.pendingItemIds.push(id);
      try {
        await this.repository.removeWorkItem(id);
        this.workItems = this.workItems.filter((w) => w.id !== id);
        return true;
      } finally {
        this.pendingItemIds = this.pendingItemIds.filter((p) => p !== id);
      }
    },
    /** Part 4 W14: removes every work item, rule and disposition through the port, then
     *  reloads from it, so local state always matches what the port still holds, even
     *  after a partial failure (whose rejection still propagates). */
    async clearAll(): Promise<void> {
      try {
        await Promise.all([
          ...this.workItems.map((w) => this.repository.removeWorkItem(w.id)),
          ...this.rules.map((r) => this.repository.removeRule(r.id)),
          ...this.dispositions.map((d) => this.repository.removeDisposition(d.fingerprint)),
        ]);
      } finally {
        await this.load();
      }
    },
```

  - If `grep -rn "removeWorkItem(" src` finds a caller that relied on `Promise<void>`, keep it compiling and list it.
- [ ] **Step 5: Nav badge.** In `NavColumn.vue`, change `workbench: review.workItemCount || undefined,` to `workbench: review.openWorkItemCount || undefined,`, and add the comment `// Part 4 W13: items not yet verified.`.
- [ ] **Step 6: Run and confirm they pass.** `npx vitest run tests/unit/review-work-items.test.ts tests/unit/review-store.test.ts tests/unit/review-dispositions.test.ts tests/component/nav-column.test.ts tests/component/file-inspector.test.ts tests/component/quality-screen.test.ts`, then the gate.
- [ ] **Step 7: Commit.** `feat(ui): editable work items (priority, notes, checks, status) with a verified guard; the badge counts open items`

---

### Task 7: Markdown writer, workbench read model and workbench copy (W6, W8, W10)

**Files:**
- Create: `src/ui/export/markdown.ts`, `src/ui/read-models/work-items.ts`, `src/ui/audit-copy/workbench.ts`
- Modify: `src/ui/inspector-copy.ts` (one `export *` line)
- Test: `tests/unit/markdown.test.ts` (new), `tests/unit/work-items-model.test.ts` (new)

**Interfaces:**
- Consumes: `WorkItem`, `WorkTarget`, `WorkItemStatus`, `NO_CHECKS` (Task 6); `FileSummary`, `moduleLabel` (`read-models/file-summaries.ts`); `parseEntityId` (`domain/entity-id.ts`); `WORK_ITEM_STATUS_LABEL` (already in `inspector-copy.ts`).
- Produces:
  - `export/markdown.ts`: `mdLine(s)`, `mdCell(s)`, `mdCode(s)`, `mdQuote(s)`, `mdValue(m: MetricValue, unit?: string)`.
  - `read-models/work-items.ts`:
    - `WORK_STATUSES`
    - `interface TargetLabel { name: string; detail: string; present: boolean }`
    - `interface WorkRow { item: WorkItem; target: TargetLabel; checksDone: number }`
    - `interface WorkColumn { status: WorkItemStatus; rows: readonly WorkRow[] }`
    - `interface WorkbenchCard { id: 'total' | 'investigate' | 'in-progress' | 'verified'; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' | 'success' }`
    - `interface WorkbenchModel { rows: readonly WorkRow[]; columns: readonly WorkColumn[]; cards: readonly WorkbenchCard[]; total: number }`
    - `entityPath(id)`, `filesById(files)`, `workTargetLabel(target, index)`, `buildWorkbenchModel(items, files, query)`, `planMarkdown(rows, sourceLabel)`
  - `audit-copy/workbench.ts`: every string listed in Step 3.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/markdown.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mdCell, mdCode, mdLine, mdQuote, mdValue } from '../../src/ui/export/markdown';
import { collected, sample, sumEvidence, unknown } from '../../src/ui/evidence';

describe('markdown (Part 4 W6)', () => {
  it('keeps user text on one line and stops it from starting a block', () => {
    expect(mdLine('# Title\nnext')).toBe('\\# Title next');
    expect(mdLine('- item')).toBe('\\- item');
    expect(mdLine('1. one')).toBe('1\\. one');
  });
  it('escapes pipes and backslashes in table cells', () => {
    expect(mdCell('a|b\\c')).toBe('a\\|b\\\\c');
  });
  it('fences code spans that contain backticks', () => {
    expect(mdCode('src/a.ts')).toBe('`src/a.ts`');
    expect(mdCode('a`b')).toBe('`` a`b ``');
  });
  it('quotes every line of a note', () => { expect(mdQuote('a\nb')).toBe('> a\n> b'); });
  it('spells out the evidence of every value and never writes unknown as 0', () => {
    expect(mdValue(collected(1200, 'inventory'), ' lines')).toBe('1,200 lines');
    expect(mdValue(sample(3))).toBe('3 (sample)');
    expect(mdValue(unknown('No secret-scanning provider'))).toBe('unknown (No secret-scanning provider)');
    expect(mdValue(sumEvidence([collected(3, 'inventory'), sample(4), unknown('x')]))).toBe('7 (partial, sample)');
  });
});
```

  Create `tests/unit/work-items-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntityId } from '../../src/domain/entity-id';
import { collected, sample } from '../../src/ui/evidence';
import type { FileSummary } from '../../src/ui/read-models/file-summaries';
import { buildWorkbenchModel, filesById, planMarkdown, workTargetLabel } from '../../src/ui/read-models/work-items';
import { NO_CHECKS, type WorkItem } from '../../src/ui/stores/ports/review-repository';

const id = (p: string) => makeEntityId('repo', 'file', p);
const summary = (p: string): FileSummary => {
  const s = sample(1);
  return { id: id(p), name: p.slice(p.lastIndexOf('/') + 1), path: p, module: p.split('/')[0]!, lines: collected(10, 'inventory'),
    complexity: s, commits90d: s, branchesCovered: s, branchesTotal: s, branchCoverage: s, findings: s, highFindings: s,
    unusedExports: s, directDependents: s, priority: s };
};
const FILES = [summary('src/parser.ts'), summary('lib/io.ts')];
const item = (over: Partial<WorkItem>): WorkItem => ({
  id: 'wi-1', target: { kind: 'file', entityId: id('src/parser.ts') }, intent: 'refactor', title: 'Split parser',
  status: 'investigate', priority: 'medium', notes: '', checks: NO_CHECKS, createdAt: '2026-09-22T10:00:00.000Z', ...over,
});

describe('work-item read model (Part 4)', () => {
  it('labels file, package and module targets, and a file missing from the snapshot', () => {
    const index = filesById(FILES);
    expect(workTargetLabel({ kind: 'file', entityId: id('src/parser.ts') }, index)).toEqual({ name: 'parser.ts', detail: 'src/parser.ts', present: true });
    expect(workTargetLabel({ kind: 'file', entityId: id('gone/old.ts') }, index)).toEqual({ name: 'old.ts', detail: 'gone/old.ts', present: false });
    expect(workTargetLabel({ kind: 'package', name: '@sample/x' }, index)).toMatchObject({ name: '@sample/x', detail: 'Package' });
    expect(workTargetLabel({ kind: 'module', module: '(root)' }, index)).toMatchObject({ name: 'Root files', detail: 'Module' });
  });
  it('groups rows into the four status columns and counts the cards over every item', () => {
    const items = [item({}), item({ id: 'wi-2', status: 'verified', checks: [true, true, true] }), item({ id: 'wi-3', status: 'in-progress' })];
    const m = buildWorkbenchModel(items, FILES, '');
    expect(m.columns.map((c) => [c.status, c.rows.length])).toEqual([['investigate', 1], ['planned', 0], ['in-progress', 1], ['verified', 1]]);
    expect(m.cards.map((c) => c.value.value)).toEqual([3, 1, 1, 1]);
    expect(m.cards.every((c) => c.value.state === 'collected')).toBe(true);
    expect(m.rows.find((r) => r.item.id === 'wi-2')!.checksDone).toBe(3);
  });
  it('filters by title, target and notes, case-insensitively; the cards still count every item', () => {
    const items = [item({}), item({ id: 'wi-2', target: { kind: 'file', entityId: id('lib/io.ts') }, title: 'Tests', notes: 'Flaky READ path' })];
    expect(buildWorkbenchModel(items, FILES, 'parser').rows.map((r) => r.item.id)).toEqual(['wi-1']);
    expect(buildWorkbenchModel(items, FILES, 'read').rows.map((r) => r.item.id)).toEqual(['wi-2']);
    expect(buildWorkbenchModel(items, FILES, 'LIB/').rows.map((r) => r.item.id)).toEqual(['wi-2']);
    expect(buildWorkbenchModel(items, FILES, 'zzz').cards[0]!.value.value).toBe(2);
  });
  it('writes the plan as Markdown with checklists, relative paths and the session note', () => {
    const md = planMarkdown(buildWorkbenchModel([item({ notes: '# not a heading', checks: [true, false, false] })], FILES, '').rows, 'repo');
    expect(md).toContain('# Refactor plan — repo');
    expect(md).toContain('## wi-1 — Split parser');
    expect(md).toContain('- Target: `src/parser.ts`');
    expect(md).toContain('> # not a heading');
    expect(md).toContain('- [x] Characterize existing behaviour and define a safe boundary');
    expect(md).toContain('- [ ] Implement the agreed change and keep compatibility');
    expect(md).not.toContain(' ');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/markdown.test.ts tests/unit/work-items-model.test.ts`
- [ ] **Step 3: Copy.** Create `src/ui/audit-copy/workbench.ts`:

```ts
// Part 4: Refactor workbench and the Work-item editor. Re-exported by inspector-copy.ts.
import type { WorkIntent, WorkPriority } from '../stores/ports/review-repository';

export const WORKBENCH_EYEBROW = 'Act / Refactor workbench';
export const WORKBENCH_TITLE = 'Turn evidence into a refactoring plan.';
export const WORKBENCH_SUBTITLE = 'Keep the reason, affected files, and verification criteria together.';
export const WORKBENCH_EXPORT = 'Export plan';
export const WORKBENCH_MD_FILENAME = 'refactor-plan.md';
export const WORKBENCH_NEW = 'New work item';
export const WORKBENCH_NEW_HINT = 'Select a file in the city, a table or the command palette first.';
export const WORKBENCH_NEW_FOR = (name: string): string => `Plans work for the selected file, ${name}.`;
export const WORKBENCH_CARD_TOTAL = 'Work items';
export const WORKBENCH_CARD_TOTAL_CAPTION = 'Kept in this session only';
export const WORKBENCH_CARD_INVESTIGATE = 'Under investigation';
export const WORKBENCH_CARD_INVESTIGATE_CAPTION = 'Define scope and characterize behaviour';
export const WORKBENCH_CARD_PROGRESS = 'In progress';
export const WORKBENCH_CARD_PROGRESS_CAPTION = 'An explicit status, not source-code automation';
export const WORKBENCH_CARD_VERIFIED = 'Verified';
export const WORKBENCH_CARD_VERIFIED_CAPTION = 'All three checks completed';
export const WORKBENCH_FILTER = 'Filter work items…';
export const WORKBENCH_FILTER_LABEL = 'Filter work items';
export const WORKBENCH_VIEW_LABEL = 'Work item layout';
export const WORKBENCH_VIEW_BOARD = 'Board';
export const WORKBENCH_VIEW_LIST = 'List';
export const WORKBENCH_EMPTY_TITLE = 'No work items yet';
export const WORKBENCH_EMPTY = 'Add them from File detail, Code quality, Test confidence, Dependencies, Security or Ownership.';
export const WORKBENCH_NO_MATCH = 'No work items match this filter.';
export const WORKBENCH_FOOTNOTE = 'Statuses record your plan. Nothing here changes source code.';
export const WORKBENCH_COLUMN_COUNT = (n: number): string => `${n} ${n === 1 ? 'work item' : 'work items'}`;
export const WORKBENCH_CHECKS = (done: number): string => `${done}/3 checks`;
export const WORKBENCH_LIST_CAPTION = 'Work items';
export const WORKBENCH_COL_ITEM = 'Work item';
export const WORKBENCH_COL_TARGET = 'Target';
export const WORKBENCH_COL_INTENT = 'Intent';
export const WORKBENCH_COL_STATUS = 'Status';
export const WORKBENCH_COL_PRIORITY = 'Priority';
export const WORKBENCH_COL_CHECKS = 'Checks';
export const WORK_TARGET_PACKAGE = 'Package';
export const WORK_TARGET_MODULE = 'Module';
export const WORK_TARGET_MISSING = 'Not in this snapshot';
export const WORK_PRIORITY_LABEL: Readonly<Record<WorkPriority, string>> = { high: 'High', medium: 'Medium', low: 'Low' };
export const WORK_INTENT_LABEL: Readonly<Record<WorkIntent, string>> = {
  refactor: 'Refactor', tests: 'Tests', review: 'Review', pairing: 'Pairing', documentation: 'Documentation',
};
export const WORK_CHECK_LABELS: readonly [string, string, string] = [
  'Characterize existing behaviour and define a safe boundary',
  'Implement the agreed change and keep compatibility',
  'Run regression tests and review the evidence',
];
export const WORK_EDITOR_TITLE_EDIT = (id: string): string => `${id} / Work item`;
export const WORK_EDITOR_TITLE_NEW = 'New work item';
export const WORK_EDITOR_SUBTITLE = 'Edit the plan and record an explicit verification state.';
export const WORK_FIELD_TITLE = 'Title';
export const WORK_FIELD_PRIORITY = 'Priority';
export const WORK_FIELD_STATUS = 'Status';
export const WORK_FIELD_INTENT = 'Intent';
export const WORK_FIELD_TARGET = 'Target';
export const WORK_FIELD_NOTES = 'Investigation notes';
export const WORK_CHECKLIST_TITLE = 'Verification checklist';
export const WORK_CHECKLIST_HINT = 'Verified needs all three checks. Changing a status never changes source code.';
export const WORK_SAVE = 'Save changes';
export const WORK_CREATE = 'Create work item';
export const WORK_CANCEL = 'Cancel';
export const WORK_DELETE = 'Delete item';
export const WORK_DELETE_CONFIRM_TEXT = 'Delete this work item? It is removed for this session.';
export const WORK_DELETE_CONFIRM = 'Delete work item';
export const WORK_DELETE_KEEP = 'Keep it';
export const WORK_TITLE_REQUIRED = 'Enter a title.';
export const WORK_TITLE_TOO_LONG = (n: number): string => `Keep the title to ${n} characters or fewer.`;
export const WORK_NOTES_TOO_LONG = (n: number): string => `Keep the notes to ${n} characters or fewer.`;
export const WORK_VERIFIED_NEEDS_CHECKS = 'Complete all three checks before marking the item Verified.';
export const WORK_DUPLICATE = 'This file already has a work item with that intent.';
export const WORK_SAVE_FAILED = 'Could not save the work item.';
export const WORK_DELETE_FAILED = 'Could not delete the work item.';
export const WORK_UPDATED = (id: string): string => `${id} updated.`;
export const WORK_CREATED = (id: string): string => `${id} created.`;
export const WORK_DELETED = (id: string): string => `${id} deleted.`;
export const PLAN_MD_TITLE = (source: string): string => `Refactor plan — ${source}`;
export const PLAN_MD_NOTE = 'Kept in this session only. Statuses record the plan; no source code was changed.';
export const PLAN_MD_EMPTY = 'No work items.';
```

  At the end of `inspector-copy.ts`, add the comment `/** Part 4: Act and Configure screens. */` followed by `export * from './audit-copy/workbench';`.
- [ ] **Step 4: `export/markdown.ts`.**

```ts
// Part 4 W6: the Markdown writer for the refactor plan and the audit report. User text
// stays on one line where Markdown structure depends on it, table cells escape pipes,
// and every value states its evidence — "(sample)", "(partial)", or "unknown (reason)",
// never a bare 0.
import { EVIDENCE_LABELS, formatMetric, hasValue, isSampleBacked, type MetricValue } from '../evidence';

export function mdLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/^(\s*)([#>*+-])/, '$1\\$2').replace(/^(\s*\d+)\./, '$1\\.');
}

export function mdCell(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

export function mdCode(s: string): string {
  const t = s.replace(/[\r\n]+/g, ' ');
  return t.includes('`') ? `\`\` ${t} \`\`` : `\`${t}\``;
}

export function mdQuote(s: string): string {
  return s.split(/\r?\n/).map((line) => `> ${line}`).join('\n');
}

export function mdValue(m: MetricValue, unit = ''): string {
  if (!hasValue(m)) return `unknown (${m.reason ?? EVIDENCE_LABELS[m.state]})`;
  const tags: string[] = [];
  if (m.state !== 'collected' && m.state !== 'sample') tags.push(EVIDENCE_LABELS[m.state].toLowerCase());
  if (isSampleBacked(m)) tags.push('sample');
  const v = formatMetric(m, unit);
  return tags.length > 0 ? `${v} (${tags.join(', ')})` : v;
}
```

- [ ] **Step 5: `read-models/work-items.ts`.**

```ts
// Part 4: the Refactor workbench read model. Work items are the reviewer's own records,
// so their counts are `collected` (source 'review'); nothing here is evidence about the
// code. A file target that is no longer in the snapshot keeps its path and says so.
import { parseEntityId, type EntityId } from '../../domain/entity-id';
import { collected, type MetricValue } from '../evidence';
import { mdCode, mdLine, mdQuote } from '../export/markdown';
import type { WorkItem, WorkItemStatus, WorkTarget } from '../stores/ports/review-repository';
import {
  PLAN_MD_EMPTY, PLAN_MD_NOTE, PLAN_MD_TITLE, WORK_CHECK_LABELS, WORK_FIELD_INTENT, WORK_FIELD_PRIORITY, WORK_FIELD_STATUS,
  WORK_FIELD_TARGET, WORK_INTENT_LABEL, WORK_ITEM_STATUS_LABEL, WORK_PRIORITY_LABEL, WORK_TARGET_MISSING, WORK_TARGET_MODULE,
  WORK_TARGET_PACKAGE, WORKBENCH_CARD_INVESTIGATE, WORKBENCH_CARD_INVESTIGATE_CAPTION, WORKBENCH_CARD_PROGRESS,
  WORKBENCH_CARD_PROGRESS_CAPTION, WORKBENCH_CARD_TOTAL, WORKBENCH_CARD_TOTAL_CAPTION, WORKBENCH_CARD_VERIFIED,
  WORKBENCH_CARD_VERIFIED_CAPTION,
} from '../inspector-copy';
import { moduleLabel, type FileSummary } from './file-summaries';

export const WORK_STATUSES: readonly WorkItemStatus[] = ['investigate', 'planned', 'in-progress', 'verified'];

export interface TargetLabel { name: string; detail: string; present: boolean }
export interface WorkRow { item: WorkItem; target: TargetLabel; checksDone: number }
export interface WorkColumn { status: WorkItemStatus; rows: readonly WorkRow[] }
export interface WorkbenchCard {
  id: 'total' | 'investigate' | 'in-progress' | 'verified'; label: string; icon: string;
  value: MetricValue; caption: string; tone: 'accent' | 'warning' | 'success';
}
export interface WorkbenchModel { rows: readonly WorkRow[]; columns: readonly WorkColumn[]; cards: readonly WorkbenchCard[]; total: number }

/** The source-relative path inside an entity id; never the raw id (it holds NUL separators). */
export function entityPath(id: EntityId): string {
  try { return parseEntityId(id).path; } catch { return id.replace(/\0/g, '/'); }
}
const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1) || path;

const indexCache = new WeakMap<readonly FileSummary[], ReadonlyMap<EntityId, FileSummary>>();
export function filesById(files: readonly FileSummary[]): ReadonlyMap<EntityId, FileSummary> {
  let hit = indexCache.get(files);
  if (!hit) { hit = new Map(files.map((f) => [f.id, f])); indexCache.set(files, hit); }
  return hit;
}

export function workTargetLabel(target: WorkTarget, index: ReadonlyMap<EntityId, FileSummary>): TargetLabel {
  if (target.kind === 'package') return { name: target.name, detail: WORK_TARGET_PACKAGE, present: true };
  if (target.kind === 'module') return { name: moduleLabel(target.module), detail: WORK_TARGET_MODULE, present: true };
  const file = index.get(target.entityId);
  if (file) return { name: file.name, detail: file.path, present: true };
  const path = entityPath(target.entityId);
  return { name: baseName(path), detail: path, present: false };
}

const matches = (row: WorkRow, needle: string): boolean =>
  [row.item.title, row.target.name, row.target.detail, row.item.notes].some((s) => s.toLowerCase().includes(needle));

export function buildWorkbenchModel(items: readonly WorkItem[], files: readonly FileSummary[], query: string): WorkbenchModel {
  const index = filesById(files);
  const all: WorkRow[] = items.map((item) => ({ item, target: workTargetLabel(item.target, index), checksDone: item.checks.filter(Boolean).length }));
  const needle = query.trim().toLowerCase();
  const rows = needle === '' ? all : all.filter((r) => matches(r, needle));
  const count = (status: WorkItemStatus): MetricValue => collected(items.filter((i) => i.status === status).length, 'review');
  return {
    rows,
    total: items.length,
    columns: WORK_STATUSES.map((status) => ({ status, rows: rows.filter((r) => r.item.status === status) })),
    cards: [
      { id: 'total', label: WORKBENCH_CARD_TOTAL, icon: 'wrench', value: collected(items.length, 'review'), caption: WORKBENCH_CARD_TOTAL_CAPTION, tone: 'accent' },
      { id: 'investigate', label: WORKBENCH_CARD_INVESTIGATE, icon: 'search', value: count('investigate'), caption: WORKBENCH_CARD_INVESTIGATE_CAPTION, tone: 'warning' },
      { id: 'in-progress', label: WORKBENCH_CARD_PROGRESS, icon: 'code', value: count('in-progress'), caption: WORKBENCH_CARD_PROGRESS_CAPTION, tone: 'accent' },
      { id: 'verified', label: WORKBENCH_CARD_VERIFIED, icon: 'check', value: count('verified'), caption: WORKBENCH_CARD_VERIFIED_CAPTION, tone: 'success' },
    ],
  };
}

function targetLine(row: WorkRow): string {
  if (row.item.target.kind !== 'file') return `${row.target.detail} ${mdCode(row.target.name)}`;
  return row.target.present ? mdCode(row.target.detail) : `${mdCode(row.target.detail)} (${WORK_TARGET_MISSING})`;
}

/** Part 4 W6: the plan as Markdown, for `downloadText` only. */
export function planMarkdown(rows: readonly WorkRow[], sourceLabel: string): string {
  const out: string[] = [`# ${mdLine(PLAN_MD_TITLE(sourceLabel))}`, '', PLAN_MD_NOTE, ''];
  if (rows.length === 0) out.push(PLAN_MD_EMPTY, '');
  for (const row of rows) {
    const { item } = row;
    out.push(
      `## ${mdLine(`${item.id} — ${item.title}`)}`, '',
      `- ${WORK_FIELD_STATUS}: ${WORK_ITEM_STATUS_LABEL[item.status]}`,
      `- ${WORK_FIELD_PRIORITY}: ${WORK_PRIORITY_LABEL[item.priority]}`,
      `- ${WORK_FIELD_INTENT}: ${WORK_INTENT_LABEL[item.intent]}`,
      `- ${WORK_FIELD_TARGET}: ${targetLine(row)}`, '',
    );
    if (item.notes.trim() !== '') out.push(mdQuote(item.notes), '');
    WORK_CHECK_LABELS.forEach((label, i) => { out.push(`- [${item.checks[i] ? 'x' : ' '}] ${label}`); });
    out.push('');
  }
  return `${out.join('\n').replace(/\n+$/, '')}\n`;
}
```

- [ ] **Step 6: Run and confirm they pass.** `npx vitest run tests/unit/markdown.test.ts tests/unit/work-items-model.test.ts`, then the gate.
- [ ] **Step 7: Commit.** `feat(ui): Markdown writer and the Refactor workbench read model`

---

### Task 8: Audit report read model, report store and report copy (W6, W7)

**Files:**
- Create: `src/ui/stores/report-store.ts`, `src/ui/read-models/report.ts`, `src/ui/audit-copy/report.ts`
- Modify: `src/ui/inspector-copy.ts` (one `export *` line)
- Test: `tests/unit/report-model.test.ts` (new)

**Interfaces:**
- Consumes:
  - `mdCell`, `mdCode`, `mdLine`, `mdQuote`, `mdValue`, `WorkRow`, `WORK_INTENT_LABEL`, `WORK_PRIORITY_LABEL` (Task 7)
  - `OverviewModel` (`read-models/overview.ts`), `ArchitectureModel` (`read-models/architecture.ts`), `SecurityModel` (`read-models/security.ts`)
  - `RULE_STATUS_LABEL`, `WORK_ITEM_STATUS_LABEL` (`inspector-copy`), `formatAbsoluteTime` (`copy.ts`)
- Produces:
  - `report-store.ts`: `REPORT_SECTIONS`, `type ReportSection`, `REPORT_NOTE_MAX = 5000`, `useReportStore()` with state `{ sections: Record<ReportSection, boolean>; note: string }` and actions `setSection(section, on)`, `applyNote(text): boolean`, `reset()`.
  - `read-models/report.ts`:
    - `interface ReportFact { label: string; value: string }`
    - `interface ReportMetric { label: string; value: MetricValue; unit: string }`
    - `interface ReportRule { id: string; boundary: string; rationale: string; status: string }`
    - `interface ReportModel { title: string; facts: readonly ReportFact[]; summary: readonly ReportMetric[]; architecture: readonly ReportMetric[]; rules: readonly ReportRule[]; hotspots: readonly FileSummary[]; security: readonly ReportMetric[]; plan: readonly WorkRow[] }`
    - `interface ReportInput { snapshot: CodebaseSnapshot; files: readonly FileSummary[]; overview: OverviewModel; architecture: ArchitectureModel; security: SecurityModel; plan: readonly WorkRow[] }`
    - `buildReportModel(input): ReportModel`, `includedSections(sections): ReportSection[]`, `reportMarkdown(model, sections, note): string`

- [ ] **Step 1: Write the failing test.** Create `tests/unit/report-model.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildOverviewModel } from '../../src/ui/read-models/overview';
import { architectureGraphFor, buildArchitectureModel } from '../../src/ui/read-models/architecture';
import { buildSecurityModel } from '../../src/ui/read-models/security';
import { buildReportModel, includedSections, reportMarkdown } from '../../src/ui/read-models/report';
import { buildWorkbenchModel } from '../../src/ui/read-models/work-items';
import { REPORT_NOTE_MAX, useReportStore } from '../../src/ui/stores/report-store';
import { NO_CHECKS } from '../../src/ui/stores/ports/review-repository';

function model() {
  const snapshot = buildSnapshotFixture({ files: 40, directories: 3 });
  const files = fileSummariesFor(snapshot);
  const graph = architectureGraphFor(files);
  const plan = buildWorkbenchModel([{
    id: 'wi-1', target: { kind: 'package', name: '@sample/a|b' }, intent: 'review', title: 'Review a',
    status: 'planned', priority: 'high', notes: '', checks: NO_CHECKS, createdAt: '2026-09-22T10:00:00.000Z',
  }], files, '').rows;
  return buildReportModel({ snapshot, files, overview: buildOverviewModel(snapshot, files), architecture: buildArchitectureModel(graph, []), security: buildSecurityModel(), plan });
}
const ALL = { summary: true, architecture: true, hotspots: true, security: true, plan: true };

describe('report model and Markdown (Part 4 W6/W7)', () => {
  it('builds collected facts and reuses the screen models, with no composite score', () => {
    const m = model();
    expect(m.summary[0]).toMatchObject({ value: { state: 'collected', value: 40 } });
    expect(m.hotspots.length).toBeGreaterThan(0);
    expect(m.hotspots.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(m)).not.toMatch(/health score|overall score/i);
  });
  it('numbers the included sections in order and leaves out the excluded ones', () => {
    const md = reportMarkdown(model(), { ...ALL, architecture: false }, '');
    expect(md).toContain('## 01 / Executive summary');
    expect(md).toContain('## 02 / Quality hotspots');
    expect(md).not.toContain('Architecture review');
    expect(includedSections({ ...ALL, summary: false, plan: false })).toEqual(['architecture', 'hotspots', 'security']);
  });
  it('labels sample values, writes unknown values with their reason and never as 0', () => {
    const md = reportMarkdown(model(), ALL, '');
    expect(md).toContain('(sample)');
    const secrets = md.split('\n').find((l) => l.startsWith('- Secret'));
    expect(secrets).toBeDefined();
    expect(secrets).toMatch(/unknown \(/);
    expect(secrets).not.toMatch(/: 0\b/);
    expect(md).toContain('Includes sample data');
  });
  it('escapes table cells and quotes the reviewer note; always has limitations', () => {
    const md = reportMarkdown(model(), ALL, 'Line one\n# two');
    expect(md).toContain('@sample/a\\|b');
    expect(md).toContain('> Line one\n> # two');
    expect(md).toContain('## Scope and limitations');
  });
});

describe('report store (Part 4 W1)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  it('toggles sections, applies a trimmed note, refuses an over-long one and resets', () => {
    const r = useReportStore();
    r.setSection('security', false);
    expect(r.sections.security).toBe(false);
    expect(r.applyNote('  hi  ')).toBe(true);
    expect(r.note).toBe('hi');
    expect(r.applyNote('x'.repeat(REPORT_NOTE_MAX + 1))).toBe(false);
    expect(r.note).toBe('hi');
    r.reset();
    expect(r.sections.security).toBe(true);
    expect(r.note).toBe('');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/unit/report-model.test.ts`
- [ ] **Step 3: Copy.** Create `src/ui/audit-copy/report.ts`:

```ts
// Part 4: the Audit report. Re-exported by inspector-copy.ts.
export const REPORT_EYEBROW = 'Act / Audit report';
export const REPORT_TITLE = 'An audit you can explain.';
export const REPORT_SUBTITLE = 'A review-ready narrative with scope, evidence, limitations, and next actions.';
export const REPORT_EXPORT = 'Export Markdown';
export const REPORT_MD_FILENAME = 'codebase-audit-report.md';
export const REPORT_KICKER = 'Codebase Inspector';
export const REPORT_PAPER_TITLE = 'Codebase quality & architecture review';
export const REPORT_SAMPLE_BADGE = 'Includes sample data';
export const REPORT_MD_DISCLAIMER = 'Includes sample data. This is not an audit of your repository.';
export const REPORT_FACT_SOURCE = 'Source';
export const REPORT_FACT_SNAPSHOT = 'Snapshot';
export const REPORT_FACT_EXCLUSIONS = 'Scope exclusions';
export const REPORT_FACT_EVIDENCE = 'Evidence';
export const REPORT_FACT_SAFETY = 'Source safety';
export const REPORT_NO_EXCLUSIONS = 'None';
export const REPORT_EVIDENCE_TEXT = 'File inventory collected by the built-in read-only scan. Findings, history, coverage, import edges and packages are sample data. Mutation, runtime and secret scanning were not collected.';
export const REPORT_SAFETY_TEXT = 'Read-only inventory within the approved scope. No source file was changed and no tool was run.';
export const REPORT_SECTION_LABEL: Readonly<Record<'summary' | 'architecture' | 'hotspots' | 'security' | 'plan', string>> = {
  summary: 'Executive summary', architecture: 'Architecture review', hotspots: 'Quality hotspots',
  security: 'Security review', plan: 'Refactor plan',
};
export const REPORT_SECTION_HEADING = (n: number, title: string): string => `${String(n).padStart(2, '0')} / ${title}`;
export const REPORT_FILES = 'Files';
export const REPORT_LINES = 'Source lines';
export const REPORT_SUMMARY_NOTE = 'These independent signals are not a composite quality score.';
export const REPORT_RULES_TITLE = 'Boundary rules';
export const REPORT_NO_RULES = 'No boundary rules defined.';
export const REPORT_RULE_BOUNDARY = (from: string, to: string): string => `${from} must not import ${to}`;
export const REPORT_RULE_STATUS = (status: string): string => `${status} (sample edges)`;
export const REPORT_COL_RULE = 'Rule';
export const REPORT_COL_BOUNDARY = 'Intended boundary';
export const REPORT_COL_STATUS = 'Status';
export const REPORT_COL_RATIONALE = 'Rationale';
export const REPORT_COL_FILE = 'File';
export const REPORT_COL_PRIORITY = 'Priority';
export const REPORT_COL_COMPLEXITY = 'Max complexity';
export const REPORT_COL_COMMITS = 'Commits / 90d';
export const REPORT_COL_COVERAGE = 'Branch coverage';
export const REPORT_HOTSPOTS_NOTE = 'Priority is an investigation heuristic built from sample signals, not a defect probability.';
export const REPORT_SECURITY_NOTE = 'Advisories are fictional demo records. Reachability, runtime exposure and secrets were not assessed; no exploitability verdict is given.';
export const REPORT_NO_PLAN = 'No work items.';
export const REPORT_PLAN_LINE = (id: string, title: string, status: string, priority: string, target: string): string =>
  `${id}: ${title} — ${status}; ${priority} priority; ${target}`;
export const REPORT_NOTE_TITLE = 'Reviewer note';
export const REPORT_NO_NOTE = 'No reviewer note.';
export const REPORT_LIMITS_TITLE = 'Scope and limitations';
export const REPORT_LIMITS = 'Only the file inventory is measured; every other signal here is sample data or unknown. No source content was interpreted, no runtime traffic, credentials or real package advisories were analysed. Import graphs do not prove architectural intent. Coverage does not prove correctness. Missing evidence is unknown, not passing.';
export const REPORT_CONTENTS_TITLE = 'Report contents';
export const REPORT_CONTENTS_SUBTITLE = 'Choose what to include.';
export const REPORT_NOTE_PANEL_TITLE = 'Reviewer note';
export const REPORT_NOTE_PANEL_SUBTITLE = 'Kept in this session only.';
export const REPORT_NOTE_LABEL = 'Reviewer note';
export const REPORT_NOTE_APPLY = 'Apply note';
export const REPORT_NOTE_APPLIED = 'Reviewer note applied to the report.';
export const REPORT_NOTE_TOO_LONG = (n: number): string => `Keep the note to ${n} characters or fewer.`;
export const REPORT_CALLOUT_TITLE = 'Illustrative review';
export const REPORT_CALLOUT = 'This review is built partly from sample data. It is not a security certification or an audit of your repository.';
```

  In `inspector-copy.ts`, add `export * from './audit-copy/report';`.
- [ ] **Step 4: `stores/report-store.ts`.**

```ts
// Part 4 W1/W7: the Audit report's choices, held per leaf in memory. Lost when the leaf
// closes; durable history is WP-05.
import { defineStore } from 'pinia';

export const REPORT_SECTIONS = ['summary', 'architecture', 'hotspots', 'security', 'plan'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];
export const REPORT_NOTE_MAX = 5000;

const allOn = (): Record<ReportSection, boolean> => ({ summary: true, architecture: true, hotspots: true, security: true, plan: true });

export const useReportStore = defineStore('report', {
  state: () => ({ sections: allOn(), note: '' }),
  actions: {
    setSection(section: ReportSection, on: boolean): void {
      this.sections = { ...this.sections, [section]: on };
    },
    /** The note is applied, not live (the prototype's "Apply note"). Refuses an over-long note. */
    applyNote(text: string): boolean {
      if (text.length > REPORT_NOTE_MAX) return false;
      this.note = text.trim();
      return true;
    },
    reset(): void {
      this.sections = allOn();
      this.note = '';
    },
  },
});
```

- [ ] **Step 5: `read-models/report.ts`.**

```ts
// Part 4 W7: the Audit report, composed from the screens' own read models — never new
// numbers, no composite score, no verdict. Markdown goes to downloadText only (W6).
import type { CodebaseSnapshot } from '../../domain/model';
import { collected, sumEvidence, type MetricValue } from '../evidence';
import { formatAbsoluteTime } from '../copy';
import { mdCell, mdCode, mdLine, mdQuote, mdValue } from '../export/markdown';
import { REPORT_SECTIONS, type ReportSection } from '../stores/report-store';
import {
  REPORT_COL_BOUNDARY, REPORT_COL_COMMITS, REPORT_COL_COMPLEXITY, REPORT_COL_COVERAGE, REPORT_COL_FILE, REPORT_COL_PRIORITY,
  REPORT_COL_RATIONALE, REPORT_COL_RULE, REPORT_COL_STATUS, REPORT_EVIDENCE_TEXT, REPORT_FACT_EVIDENCE, REPORT_FACT_EXCLUSIONS,
  REPORT_FACT_SAFETY, REPORT_FACT_SNAPSHOT, REPORT_FACT_SOURCE, REPORT_FILES, REPORT_HOTSPOTS_NOTE, REPORT_LIMITS,
  REPORT_LIMITS_TITLE, REPORT_LINES, REPORT_MD_DISCLAIMER, REPORT_NO_EXCLUSIONS, REPORT_NO_NOTE, REPORT_NO_PLAN, REPORT_NO_RULES,
  REPORT_NOTE_TITLE, REPORT_PAPER_TITLE, REPORT_PLAN_LINE, REPORT_RULE_BOUNDARY, REPORT_RULE_STATUS, REPORT_RULES_TITLE,
  REPORT_SAFETY_TEXT, REPORT_SECTION_HEADING, REPORT_SECTION_LABEL, REPORT_SECURITY_NOTE, REPORT_SUMMARY_NOTE,
  RULE_STATUS_LABEL, WORK_ITEM_STATUS_LABEL, WORK_PRIORITY_LABEL,
} from '../inspector-copy';
import type { ArchitectureModel } from './architecture';
import { moduleLabel, type FileSummary } from './file-summaries';
import type { OverviewModel } from './overview';
import { rootFolderLabel } from './root-label';
import type { SecurityModel } from './security';
import type { WorkRow } from './work-items';

export interface ReportFact { label: string; value: string }
export interface ReportMetric { label: string; value: MetricValue; unit: string }
export interface ReportRule { id: string; boundary: string; rationale: string; status: string }
export interface ReportModel {
  title: string;
  facts: readonly ReportFact[];
  summary: readonly ReportMetric[];
  architecture: readonly ReportMetric[];
  rules: readonly ReportRule[];
  hotspots: readonly FileSummary[];
  security: readonly ReportMetric[];
  plan: readonly WorkRow[];
}
export interface ReportInput {
  snapshot: CodebaseSnapshot; files: readonly FileSummary[]; overview: OverviewModel;
  architecture: ArchitectureModel; security: SecurityModel; plan: readonly WorkRow[];
}

export function buildReportModel(input: ReportInput): ReportModel {
  const { snapshot, files, overview, architecture, security, plan } = input;
  return {
    title: REPORT_PAPER_TITLE,
    facts: [
      { label: REPORT_FACT_SOURCE, value: rootFolderLabel(snapshot.scope.rootPath) },
      { label: REPORT_FACT_SNAPSHOT, value: formatAbsoluteTime(snapshot.providerRun.capturedAt, Intl) },
      { label: REPORT_FACT_EXCLUSIONS, value: snapshot.scope.exclusions.join(', ') || REPORT_NO_EXCLUSIONS },
      { label: REPORT_FACT_EVIDENCE, value: REPORT_EVIDENCE_TEXT },
      { label: REPORT_FACT_SAFETY, value: REPORT_SAFETY_TEXT },
    ],
    summary: [
      { label: REPORT_FILES, value: collected(files.length, 'inventory'), unit: '' },
      { label: REPORT_LINES, value: sumEvidence(files.map((f) => f.lines)), unit: '' },
      ...overview.cards.map((c) => ({ label: c.label, value: c.value, unit: c.unit })),
    ],
    architecture: architecture.cards.map((c) => ({ label: c.label, value: c.value, unit: '' })),
    rules: architecture.rules.map((r) => ({
      id: r.rule.id,
      boundary: REPORT_RULE_BOUNDARY(moduleLabel(r.rule.from), moduleLabel(r.rule.to)),
      rationale: r.rule.rationale,
      status: REPORT_RULE_STATUS(RULE_STATUS_LABEL[r.status]),
    })),
    hotspots: overview.hotspots,
    security: security.cards.map((c) => ({ label: c.label, value: c.value, unit: '' })),
    plan,
  };
}

export function includedSections(sections: Readonly<Record<ReportSection, boolean>>): ReportSection[] {
  return REPORT_SECTIONS.filter((s) => sections[s]);
}

const metricLines = (metrics: readonly ReportMetric[]): string[] => metrics.map((m) => `- ${mdLine(m.label)}: ${mdValue(m.value, m.unit)}`);
const tableRow = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;

function planTarget(row: WorkRow): string {
  return row.item.target.kind === 'file' ? mdCode(row.target.detail) : `${row.target.detail} ${mdCell(row.target.name)}`;
}

function sectionBody(model: ReportModel, section: ReportSection): string[] {
  switch (section) {
    case 'summary': return [...metricLines(model.summary), '', REPORT_SUMMARY_NOTE];
    case 'architecture': return [
      ...metricLines(model.architecture), '', `**${REPORT_RULES_TITLE}**`, '',
      ...(model.rules.length === 0 ? [REPORT_NO_RULES] : [
        tableRow([REPORT_COL_RULE, REPORT_COL_BOUNDARY, REPORT_COL_STATUS, REPORT_COL_RATIONALE]), tableRow(['---', '---', '---', '---']),
        ...model.rules.map((r) => tableRow([mdCell(r.id), mdCell(r.boundary), mdCell(r.status), mdCell(r.rationale)])),
      ]),
    ];
    case 'hotspots': return [
      tableRow([REPORT_COL_FILE, REPORT_COL_PRIORITY, REPORT_COL_COMPLEXITY, REPORT_COL_COMMITS, REPORT_COL_COVERAGE]),
      tableRow(['---', '---:', '---:', '---:', '---:']),
      ...model.hotspots.map((f) => tableRow([
        mdCode(f.path), mdCell(mdValue(f.priority)), mdCell(mdValue(f.complexity)), mdCell(mdValue(f.commits90d)), mdCell(mdValue(f.branchCoverage, '%')),
      ])),
      '', REPORT_HOTSPOTS_NOTE,
    ];
    case 'security': return [...metricLines(model.security), '', REPORT_SECURITY_NOTE];
    case 'plan': return model.plan.length === 0 ? [REPORT_NO_PLAN] : model.plan.map((r) => `- ${REPORT_PLAN_LINE(
      r.item.id, mdLine(r.item.title), WORK_ITEM_STATUS_LABEL[r.item.status], WORK_PRIORITY_LABEL[r.item.priority], planTarget(r),
    )}`);
    default: return [];
  }
}

/** Part 4 W6: the whole report as Markdown. Sections are numbered in order of inclusion;
 *  metadata, the reviewer note and the limitations are always included. */
export function reportMarkdown(model: ReportModel, sections: Readonly<Record<ReportSection, boolean>>, note: string): string {
  const out: string[] = [`# ${model.title}`, '', `**${REPORT_MD_DISCLAIMER}**`, '', ...model.facts.map((f) => `- ${f.label}: ${mdLine(f.value)}`), ''];
  includedSections(sections).forEach((section, i) => {
    out.push(`## ${REPORT_SECTION_HEADING(i + 1, REPORT_SECTION_LABEL[section])}`, '', ...sectionBody(model, section), '');
  });
  out.push(`## ${REPORT_NOTE_TITLE}`, '', note.trim() === '' ? REPORT_NO_NOTE : mdQuote(note.trim()), '');
  out.push(`## ${REPORT_LIMITS_TITLE}`, '', REPORT_LIMITS, '');
  return out.join('\n');
}
```

  Check that the Security card labels start with "Secret" (for example "Secret-pattern candidates"), since the test finds that line by prefix. If the label differs, adjust the test's `startsWith` to the real `SECURITY_CARD_SECRETS` value and say so in the report.
- [ ] **Step 6: Run and confirm it passes.** `npx vitest run tests/unit/report-model.test.ts tests/unit/markdown.test.ts`, then the gate.
- [ ] **Step 7: Commit.** `feat(ui): Audit report read model, Markdown export and report store`

---

### Task 9: Sources model, review-state export, preferences store and Configure copy (W2–W5, W14, W15)

**Files:**
- Create: `src/ui/read-models/sources.ts`, `src/ui/read-models/review-state.ts`, `src/ui/stores/preferences-store.ts`, `src/ui/audit-copy/sources.ts`, `src/ui/audit-copy/settings.ts`
- Modify: `src/ui/inspector-copy.ts` (two `export *` lines)
- Test: `tests/unit/sources-model.test.ts` (new), `tests/unit/review-state.test.ts` (new)

**Interfaces:**
- Consumes: `InventoryRunState`, `CodebaseSnapshot` (`domain/model.ts`); `countPartialRead` (`src/ui/view-surface.ts`); `formatAbsoluteTime` (`copy.ts`); `rootFolderLabel`; `EVIDENCE_SOURCE_SAMPLE`, `EVIDENCE_SOURCE_NONE` (`audit-copy/shared.ts`); `entityPath` (Task 7); `ReportSection` (Task 8).
- Produces:
  - `read-models/sources.ts`:
    - `type RunView = { kind: 'idle' } | { kind: 'running'; processed: number } | { kind: 'cancelling' } | { kind: 'cancelled' } | { kind: 'failed'; message: string } | { kind: 'complete' }`
    - `runView(run: InventoryRunState): RunView`
    - `interface ScopeRow { id: string; label: string; value: string; mono: boolean }`
    - `interface ProviderCard { id: string; title: string; icon: string; state: EvidenceState; source: string; description: string; routes: readonly RouteId[] }`
    - `interface SourcesModel { scope: readonly ScopeRow[] | null; run: RunView; providers: readonly ProviderCard[] }`
    - `formatBytes(n)`, `buildSourcesModel(snapshot, run)`
  - `read-models/review-state.ts`: `REVIEW_STATE_SCHEMA`, `interface ReviewStateInput { workItems; rules; dispositions; report: { sections; note }; exportedAt: Date }`, `reviewStateJson(input): string`.
  - `stores/preferences-store.ts`: `type Density = 'comfortable' | 'compact'`, `DENSITIES`, `usePreferencesStore()` with `density` and `setDensity(d)`.
  - `audit-copy/sources.ts` and `audit-copy/settings.ts`: every string in Step 3.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/sources-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { buildSourcesModel, formatBytes, runView } from '../../src/ui/read-models/sources';
import type { InventoryRunState } from '../../src/domain/model';

const IDLE: InventoryRunState = { status: 'idle' };

describe('sources model (Part 4 W2/W3/W15)', () => {
  it('shows the real scope of the snapshot on screen', () => {
    const snap = buildSnapshotFixture({ files: 10, directories: 2 });
    const m = buildSourcesModel(snap, IDLE);
    const rows = Object.fromEntries((m.scope ?? []).map((r) => [r.id, r.value]));
    expect(rows.path).toBe(snap.scope.rootPath);
    expect(rows.exclusions).toBe(snap.scope.exclusions.join(', ') || 'None');
    expect(rows.symlinks).toBe('Not followed');
    expect(rows.completeness).toBe('Complete');
  });
  it('has no scope without a snapshot, and the inventory card is then unknown', () => {
    const m = buildSourcesModel(null, IDLE);
    expect(m.scope).toBeNull();
    expect(m.providers.find((p) => p.id === 'inventory')!.state).toBe('unknown');
  });
  it('reports a partial read with measured and included counts', () => {
    const snap = buildSnapshotFixture({ files: 10, directories: 2, unavailable: 2 });
    const m = buildSourcesModel(snap, IDLE);
    expect(m.scope!.find((r) => r.id === 'completeness')!.value).toMatch(/^Partial: 8 of 10 files measured/);
    expect(m.providers.find((p) => p.id === 'inventory')!.state).toBe('partial');
  });
  it('maps every run state', () => {
    const approval = { profileId: 'p', sourceFingerprint: 's', scopeFingerprint: 'c', approvedAt: 'a', operation: 'read-only-inventory' as const };
    expect(runView(IDLE)).toEqual({ kind: 'idle' });
    expect(runView({ status: 'running', runId: 'r', generation: 1, approval, processedFiles: 42 })).toEqual({ kind: 'running', processed: 42 });
    expect(runView({ status: 'cancelling', runId: 'r', generation: 1 })).toEqual({ kind: 'cancelling' });
    expect(runView({ status: 'cancelled', runId: 'r' })).toEqual({ kind: 'cancelled' });
    expect(runView({ status: 'failed', runId: 'r', message: 'EACCES' })).toEqual({ kind: 'failed', message: 'EACCES' });
    expect(runView({ status: 'complete', runId: 'r', snapshotId: 's' })).toEqual({ kind: 'complete' });
  });
  it('labels every non-inventory provider as sample or unknown, never collected', () => {
    const m = buildSourcesModel(buildSnapshotFixture({ files: 3 }), IDLE);
    const others = m.providers.filter((p) => p.id !== 'inventory');
    expect(others.length).toBe(7);
    expect(others.every((p) => p.state === 'sample' || p.state === 'unknown')).toBe(true);
    expect(m.providers.filter((p) => p.state === 'unknown').map((p) => p.id)).toEqual(['secrets', 'runtime']);
    expect(others.every((p) => p.routes.length > 0)).toBe(true);
  });
  it('formats byte limits', () => {
    expect(formatBytes(5_000_000)).toBe('5 MB');
    expect(formatBytes(1_500_000)).toBe('1.5 MB');
    expect(formatBytes(2_048)).toBe('2 KB');
    expect(formatBytes(512)).toBe('512 bytes');
  });
});
```

  Before relying on it, check that `buildSnapshotFixture({ unavailable: 2 })` produces `completeness: 'partial'` with 8 measured of 10 included. If it counts differently, assert the real numbers from `countPartialRead(snap)` instead, and report it.

  Create `tests/unit/review-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntityId } from '../../src/domain/entity-id';
import { REVIEW_STATE_SCHEMA, reviewStateJson } from '../../src/ui/read-models/review-state';
import { NO_CHECKS } from '../../src/ui/stores/ports/review-repository';

const fileId = makeEntityId('repo', 'file', 'src/a.ts');

describe('review-state export (Part 4 W14)', () => {
  it('writes the schema, relative paths and never a raw entity id', () => {
    const text = reviewStateJson({
      workItems: [{ id: 'wi-1', target: { kind: 'file', entityId: fileId }, intent: 'refactor', title: 't', status: 'planned', priority: 'high', notes: 'n', checks: NO_CHECKS, createdAt: 'c' }],
      rules: [{ id: 'AR-001', from: 'a', to: 'b', rationale: 'r', createdAt: 'c' }],
      dispositions: [{ fingerprint: `${fileId}#CX-a-1`, status: 'dismissed', reason: 'why', decidedAt: 'd' }],
      report: { sections: { summary: true, architecture: false, hotspots: true, security: true, plan: true }, note: 'x' },
      exportedAt: new Date('2026-09-22T10:00:00Z'),
    });
    expect(text).not.toContain('\\u0000');
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(data.schema).toBe(REVIEW_STATE_SCHEMA);
    expect(data.exportedAt).toBe('2026-09-22T10:00:00.000Z');
    expect(data.workItems).toEqual([expect.objectContaining({ id: 'wi-1', target: { kind: 'file', path: 'src/a.ts' }, checks: [false, false, false] })]);
    expect(data.dispositions).toEqual([{ finding: 'src/a.ts#CX-a-1', status: 'dismissed', reason: 'why', decidedAt: 'd' }]);
    expect(data.report).toEqual({ sections: { summary: true, architecture: false, hotspots: true, security: true, plan: true }, note: 'x' });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/sources-model.test.ts tests/unit/review-state.test.ts`
- [ ] **Step 3: Copy.** Create `src/ui/audit-copy/sources.ts`:

```ts
// Part 4: Data & scans. Re-exported by inspector-copy.ts.
export const SOURCES_EYEBROW = 'Configure / Data & scans';
export const SOURCES_TITLE = 'Know where every signal comes from.';
export const SOURCES_SUBTITLE = 'Explicit sources. Read-only analysis. No automatic installs or background scans.';
export const SOURCES_CHANGE = 'Change source';
export const SOURCES_RESCAN = 'Rescan';
export const SOURCES_CALLOUT_TITLE = 'One real provider is connected';
export const SOURCES_CALLOUT = 'The built-in read-only inventory is the only real provider. Every other signal is sample data or not collected.';
export const SOURCES_SCOPE_TITLE = 'Active source';
export const SOURCES_SCOPE_SUBTITLE = 'The scope the snapshot on screen was scanned with.';
export const SOURCES_SCOPE_EDIT = 'Edit profiles, exclusions and limits in Obsidian’s settings for Codebase Inspector. Changes apply at the next scan.';
export const SOURCES_ROW_FOLDER = 'Folder';
export const SOURCES_ROW_PATH = 'Path';
export const SOURCES_ROW_EXCLUSIONS = 'Exclusions';
export const SOURCES_ROW_LIMIT = 'Largest file read';
export const SOURCES_ROW_SYMLINKS = 'Symbolic links';
export const SOURCES_ROW_CAPTURED = 'Captured';
export const SOURCES_ROW_COMPLETENESS = 'Completeness';
export const SOURCES_NONE = 'None';
export const SOURCES_SYMLINKS_NOT_FOLLOWED = 'Not followed';
export const SOURCES_COMPLETE = 'Complete';
export const SOURCES_PARTIAL = (measured: number, included: number): string =>
  `Partial: ${measured} of ${included} files measured; the rest could not be read`;
export const SOURCES_STATUS_TITLE = 'Scan status';
export const SOURCES_STATUS_SUBTITLE = 'The last run in this leaf. Scan progress shows on the Code city.';
export const SOURCES_RUN_IDLE = 'No scan has run in this leaf yet.';
export const SOURCES_RUN_RUNNING = (n: number): string => `Scanning: ${n.toLocaleString('en-US')} files read so far. The total is unknown until the scan ends.`;
export const SOURCES_RUN_CANCELLING = 'Cancelling the scan…';
export const SOURCES_RUN_CANCELLED = 'The last scan was cancelled. Its incomplete result was discarded.';
export const SOURCES_RUN_FAILED = (message: string): string => `The last scan failed: ${message}`;
export const SOURCES_RUN_COMPLETE = 'The last scan completed.';
export const SOURCES_CANCEL_HINT = 'To cancel a running scan, use the “Cancel scan” command in the command palette.';
export const SOURCES_PROVIDERS_TITLE = 'Evidence providers';
export const SOURCES_USED_BY = 'Used by';
export const SOURCES_SOURCE_BUILTIN = 'Built-in scan';
export const SOURCES_SOURCE_FICTIONAL = 'Fictional packages';
export const SOURCES_PROVIDER: Readonly<Record<string, { title: string; description: string }>> = {
  inventory: { title: 'File inventory', description: 'Paths, sizes and line counts inside the approved scope, read-only.' },
  static: { title: 'Static findings', description: 'Complexity, unused exports and duplication. Sample data seeded per file.' },
  imports: { title: 'Module import graph', description: 'Module dependencies, cycles and boundary checks. Sample edges, not observed imports.' },
  history: { title: 'Change history', description: 'Commit activity, change coupling and team-level stewardship. Sample data.' },
  coverage: { title: 'Coverage and test runs', description: 'Instrumented branches and test-run summaries. Sample data.' },
  packages: { title: 'Packages and advisories', description: 'A fixed set of fictional packages and demo advisories. No registry is consulted.' },
  secrets: { title: 'Secret scanning', description: 'No secret-scanning provider is connected. Unknown, not zero.' },
  runtime: { title: 'Runtime and mutation', description: 'Runtime traces and mutation results have not been collected. Unknown, not passing.' },
};
export const SOURCES_PLANNED_TITLE = 'Planned integrations';
export const SOURCES_PLANNED = 'An external analyser may later be imported from a report or run as an already-installed tool, and only on your explicit request. Nothing is ever installed, and no integration is active today.';
```

  Create `src/ui/audit-copy/settings.ts`:

```ts
// Part 4: Settings. Re-exported by inspector-copy.ts.
export const SETTINGS_EYEBROW = 'Configure / Settings';
export const SETTINGS_TITLE = 'A workspace that fits your review.';
export const SETTINGS_SUBTITLE = 'Display preferences are real; production policies are stated explicitly.';
export const SETTINGS_EXPORT = 'Export review state';
export const SETTINGS_JSON_FILENAME = 'codebase-inspector-review-state.json';
export const SETTINGS_TABS_LABEL = 'Settings categories';
export const SETTINGS_TAB: Readonly<Record<'appearance' | 'analysis' | 'accessibility' | 'privacy' | 'about', string>> = {
  appearance: 'Appearance', analysis: 'Analysis & scope', accessibility: 'Accessibility', privacy: 'Privacy & storage', about: 'About',
};
export const SETTINGS_THEME = 'Theme';
export const SETTINGS_THEME_TEXT = 'The inspector follows Obsidian’s light or dark theme.';
export const SETTINGS_THEME_VALUE = 'Follows Obsidian';
export const SETTINGS_DENSITY = 'Information density';
export const SETTINGS_DENSITY_TEXT = 'Adjust row spacing without hiding evidence or actions. Kept in this session only.';
export const SETTINGS_DENSITY_LABEL: Readonly<Record<'comfortable' | 'compact', string>> = { comfortable: 'Comfortable', compact: 'Compact' };
export const SETTINGS_THRESHOLD = 'Hotspot review threshold';
export const SETTINGS_THRESHOLD_TEXT = (n: number): string => `Files with a sample priority of ${n} or more count as change hotspots. The formula is fixed and inspectable.`;
export const SETTINGS_PRIORITY_HELP = 'How priority works';
export const SETTINGS_ACCESS = 'Source access';
export const SETTINGS_ACCESS_TEXT = 'Read-only by design. No refactoring, deletion, package install or process execution is performed.';
export const SETTINGS_ACCESS_VALUE = 'Read-only';
export const SETTINGS_SCOPE = 'Profiles, exclusions and limits';
export const SETTINGS_SCOPE_TEXT = 'Edited in Obsidian’s settings for Codebase Inspector (Settings › Community plugins). Data & scans shows the values the snapshot on screen was scanned with.';
export const SETTINGS_SCOPE_VIEW = 'View current scope';
export const SETTINGS_MOTION = 'Reduced motion';
export const SETTINGS_MOTION_TEXT = 'Follows your system setting. The city never moves the camera when you select a file.';
export const SETTINGS_INVENTORY = 'Keyboard-accessible file inventory';
export const SETTINGS_INVENTORY_TEXT = 'Inspect every file in a structured list instead of the 3D view.';
export const SETTINGS_INVENTORY_OPEN = 'Open file inventory';
export const SETTINGS_SHORTCUTS = 'Keyboard shortcuts';
export const SETTINGS_SHORTCUT_LIST: readonly { keys: string; action: string }[] = [
  { keys: 'Ctrl/Cmd + K', action: 'Go to a screen or file (inside the inspector)' },
  { keys: 'Escape', action: 'Close a dialog, the command palette or the navigation drawer' },
  { keys: 'Arrow keys', action: 'Move between tabs, chart points and coverage tiles' },
  { keys: 'Enter or Space', action: 'Open the focused table row' },
];
export const SETTINGS_NETWORK = 'No network requests';
export const SETTINGS_NETWORK_TEXT = 'Everything the inspector shows is computed locally. No analytics, remote assets or registries.';
export const SETTINGS_NETWORK_VALUE = 'Local only';
export const SETTINGS_STORAGE = 'Session-only review state';
export const SETTINGS_STORAGE_TEXT = 'Work items, finding decisions, boundary rules and report notes live in this leaf’s memory. They are lost when the leaf closes. Nothing is written to your vault.';
export const SETTINGS_CLEAR = 'Clear review state';
export const SETTINGS_CLEAR_TEXT = 'Remove every work item, finding decision, boundary rule and the report note from this session. No repository content is affected.';
export const SETTINGS_CLEAR_OPEN = 'Clear review state…';
export const SETTINGS_CLEAR_DIALOG_TITLE = 'Clear review state?';
export const SETTINGS_CLEAR_DIALOG_TEXT = (items: number, decisions: number, rules: number): string =>
  `This removes ${items} work items, ${decisions} finding decisions and ${rules} boundary rules, and the report note. It cannot be undone. Export the review state first if you want a record.`;
export const SETTINGS_CLEAR_CONFIRM = 'Clear everything';
export const SETTINGS_CLEAR_CANCEL = 'Cancel';
export const SETTINGS_CLEARED = 'Review state cleared.';
export const SETTINGS_CLEAR_FAILED = 'Could not clear the review state.';
export const SETTINGS_ABOUT_READS = 'What it reads';
export const SETTINGS_ABOUT_READS_TEXT = 'File paths, sizes and line counts inside the scope you approve. Nothing outside that scope.';
export const SETTINGS_ABOUT_NEVER = 'What it never does';
export const SETTINGS_ABOUT_NEVER_TEXT = 'Change, delete or move source files; install packages; run tools; send data anywhere.';
export const SETTINGS_ABOUT_SAMPLE = 'Sample data';
export const SETTINGS_ABOUT_SAMPLE_TEXT = 'Signals without a real provider are sample data and are labelled everywhere they appear. Missing evidence is unknown, never zero.';
export const REVIEW_STATE_NOTE = 'Kept in memory for one session. Nothing was written to the vault.';
```

  In `inspector-copy.ts`, add `export * from './audit-copy/sources';` and `export * from './audit-copy/settings';`.
- [ ] **Step 4: `stores/preferences-store.ts`.**

```ts
// Part 4 W5 (Part 1 A2's deferred preferences store): leaf display preferences, in
// memory only (W1). Theme is never here: the inspector follows Obsidian's.
import { defineStore } from 'pinia';

export type Density = 'comfortable' | 'compact';
export const DENSITIES: readonly Density[] = ['comfortable', 'compact'];

export const usePreferencesStore = defineStore('preferences', {
  state: () => ({ density: 'comfortable' as Density }),
  actions: {
    setDensity(density: Density): void {
      if (DENSITIES.includes(density)) this.density = density;
    },
  },
});
```

- [ ] **Step 5: `read-models/sources.ts`.**

```ts
// Part 4 W2/W3/W15: Data & scans. The scope rows and the run state are real (collected
// from the snapshot on screen and the run store); every provider other than the
// built-in inventory is sample or unknown and says so.
import type { CodebaseSnapshot, InventoryRunState } from '../../domain/model';
import type { RouteId } from '../../domain/route-ids';
import type { EvidenceState } from '../evidence';
import { formatAbsoluteTime } from '../copy';
import { countPartialRead } from '../view-surface';
import {
  EVIDENCE_SOURCE_NONE, EVIDENCE_SOURCE_SAMPLE, SOURCES_COMPLETE, SOURCES_NONE, SOURCES_PARTIAL, SOURCES_PROVIDER,
  SOURCES_ROW_CAPTURED, SOURCES_ROW_COMPLETENESS, SOURCES_ROW_EXCLUSIONS, SOURCES_ROW_FOLDER, SOURCES_ROW_LIMIT,
  SOURCES_ROW_PATH, SOURCES_ROW_SYMLINKS, SOURCES_SOURCE_BUILTIN, SOURCES_SOURCE_FICTIONAL, SOURCES_SYMLINKS_NOT_FOLLOWED,
} from '../inspector-copy';
import { rootFolderLabel } from './root-label';

export type RunView =
  | { kind: 'idle' } | { kind: 'running'; processed: number } | { kind: 'cancelling' }
  | { kind: 'cancelled' } | { kind: 'failed'; message: string } | { kind: 'complete' };

export function runView(run: InventoryRunState): RunView {
  switch (run.status) {
    case 'running': return { kind: 'running', processed: run.processedFiles };
    case 'cancelling': return { kind: 'cancelling' };
    case 'cancelled': return { kind: 'cancelled' };
    case 'failed': return { kind: 'failed', message: run.message };
    case 'complete': return { kind: 'complete' };
    default: return { kind: 'idle' };
  }
}

export interface ScopeRow { id: string; label: string; value: string; mono: boolean }
export interface ProviderCard {
  id: string; title: string; icon: string; state: EvidenceState; source: string; description: string; routes: readonly RouteId[];
}
export interface SourcesModel { scope: readonly ScopeRow[] | null; run: RunView; providers: readonly ProviderCard[] }

export function formatBytes(n: number): string {
  const fmt = (v: number): string => v.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (n >= 1_000_000) return `${fmt(n / 1_000_000)} MB`;
  if (n >= 1_000) return `${fmt(n / 1_000)} KB`;
  return `${n} bytes`;
}

function scopeRows(snapshot: CodebaseSnapshot): ScopeRow[] {
  const { scope } = snapshot;
  const partial = countPartialRead(snapshot);
  return [
    { id: 'folder', label: SOURCES_ROW_FOLDER, value: rootFolderLabel(scope.rootPath), mono: false },
    { id: 'path', label: SOURCES_ROW_PATH, value: scope.rootPath, mono: true },
    { id: 'exclusions', label: SOURCES_ROW_EXCLUSIONS, value: scope.exclusions.join(', ') || SOURCES_NONE, mono: true },
    { id: 'limit', label: SOURCES_ROW_LIMIT, value: formatBytes(scope.maxFileBytes), mono: false },
    { id: 'symlinks', label: SOURCES_ROW_SYMLINKS, value: SOURCES_SYMLINKS_NOT_FOLLOWED, mono: false },
    { id: 'captured', label: SOURCES_ROW_CAPTURED, value: formatAbsoluteTime(snapshot.providerRun.capturedAt, Intl), mono: false },
    { id: 'completeness', label: SOURCES_ROW_COMPLETENESS, value: partial ? SOURCES_PARTIAL(partial.measured, partial.included) : SOURCES_COMPLETE, mono: false },
  ];
}

const provider = (id: string, icon: string, state: EvidenceState, source: string, routes: readonly RouteId[]): ProviderCard => ({
  id, icon, state, source, routes, title: SOURCES_PROVIDER[id]?.title ?? id, description: SOURCES_PROVIDER[id]?.description ?? '',
});

export function buildSourcesModel(snapshot: CodebaseSnapshot | null, run: InventoryRunState): SourcesModel {
  const inventory: EvidenceState = !snapshot ? 'unknown' : snapshot.completeness === 'partial' ? 'partial' : 'collected';
  return {
    scope: snapshot ? scopeRows(snapshot) : null,
    run: runView(run),
    providers: [
      provider('inventory', 'folder-tree', inventory, snapshot ? SOURCES_SOURCE_BUILTIN : EVIDENCE_SOURCE_NONE, ['city', 'overview']),
      provider('static', 'code', 'sample', EVIDENCE_SOURCE_SAMPLE, ['quality', 'file']),
      provider('imports', 'network', 'sample', EVIDENCE_SOURCE_SAMPLE, ['architecture']),
      provider('history', 'git-branch', 'sample', EVIDENCE_SOURCE_SAMPLE, ['hotspots', 'evolution', 'ownership']),
      provider('coverage', 'flask-conical', 'sample', EVIDENCE_SOURCE_SAMPLE, ['tests']),
      provider('packages', 'package', 'sample', SOURCES_SOURCE_FICTIONAL, ['dependencies', 'security']),
      provider('secrets', 'lock', 'unknown', EVIDENCE_SOURCE_NONE, ['security']),
      provider('runtime', 'activity', 'unknown', EVIDENCE_SOURCE_NONE, ['tests', 'security']),
    ],
  };
}
```

- [ ] **Step 6: `read-models/review-state.ts`.**

```ts
// Part 4 W14: the review state as JSON, for downloadText only. Targets and findings are
// written as source-relative paths, never raw entity ids (which carry NUL separators and
// the repository id). Import is deferred to WP-05 with durable persistence.
import type { BoundaryRule, FindingDisposition, WorkItem, WorkTarget } from '../stores/ports/review-repository';
import type { ReportSection } from '../stores/report-store';
import { REVIEW_STATE_NOTE } from '../inspector-copy';
import { entityPath } from './work-items';

export const REVIEW_STATE_SCHEMA = 'codebase-inspector.review-state.v1';

export interface ReviewStateInput {
  workItems: readonly WorkItem[];
  rules: readonly BoundaryRule[];
  dispositions: readonly FindingDisposition[];
  report: { sections: Readonly<Record<ReportSection, boolean>>; note: string };
  exportedAt: Date;
}

const exportedTarget = (t: WorkTarget): Record<string, string> =>
  (t.kind === 'file' ? { kind: 'file', path: entityPath(t.entityId) } : { ...t });

/** Fingerprints are `${entityId}#${ruleScopedId}` (Q2); the rule id never contains '#'. */
function findingRef(fingerprint: string): string {
  const at = fingerprint.lastIndexOf('#');
  return at < 0 ? fingerprint : `${entityPath(fingerprint.slice(0, at))}#${fingerprint.slice(at + 1)}`;
}

export function reviewStateJson(input: ReviewStateInput): string {
  const data = {
    schema: REVIEW_STATE_SCHEMA,
    exportedAt: input.exportedAt.toISOString(),
    note: REVIEW_STATE_NOTE,
    workItems: input.workItems.map((w) => ({
      id: w.id, target: exportedTarget(w.target), intent: w.intent, title: w.title, status: w.status,
      priority: w.priority, notes: w.notes, checks: [...w.checks], createdAt: w.createdAt,
      ...(w.updatedAt !== undefined ? { updatedAt: w.updatedAt } : {}),
    })),
    rules: input.rules.map((r) => ({ id: r.id, from: r.from, to: r.to, rationale: r.rationale, createdAt: r.createdAt })),
    dispositions: input.dispositions.map((d) => ({
      finding: findingRef(d.fingerprint), status: d.status, ...(d.reason !== undefined ? { reason: d.reason } : {}), decidedAt: d.decidedAt,
    })),
    report: { sections: { ...input.report.sections }, note: input.report.note },
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}
```

- [ ] **Step 7: Run and confirm they pass.** `npx vitest run tests/unit/sources-model.test.ts tests/unit/review-state.test.ts`, then the gate.
- [ ] **Step 8: Commit.** `feat(ui): Data & scans model over the real scope and run state; review-state JSON export; preferences store`

---

### Screen-task conventions (Tasks 10–13)

Every screen task follows the same pattern:

- **The screen follows `OwnershipScreen.vue`.**
  - Root: `<div ref="root" class="ci-screen ci-screen--<route>">`.
  - `PageHeader` with the actions slot.
  - When the screen has outcomes to announce (exports, saves, clears), a `<p class="visually-hidden ci-<route>__live" role="status">{{ liveMessage }}</p>` right after `</PageHeader>`.
  - Cards in `<div class="ci-screen__cards">` with `MetricCard`s; two-column panels in `ci-screen__grid`.
  - Muted notes use `ci-note`; empty states use `ci-empty` / `ci-empty__title`.
- **Outlet.** `App.vue` gains one `v-else-if="store.route === '<route>'"` branch, before `PlaceholderScreen` (Task 13 deletes the placeholder).
- **Provenance.** `use-route-provenance.ts` gains one `case` per route. In `tests/component/shell-provenance.test.ts`:
  - `report` joins the route list that expects "Includes sample data";
  - `workbench`, `sources` and `settings` are checked for the absence of `.ci-topbar__sample`, next to the existing `settings` check.
- **Selection** always goes through `store.select(id)`. Opening File detail is `store.select(id); store.navigate('file')`. Nothing moves the camera.
- **Export.** `const exportText = useCsvExport(root, liveMessage);` then `exportText(FILENAME, () => build(...), MIME)`. Never call `downloadText` directly.
- **Work items** go through `review-store`. A `null`/`false` result announces nothing (E17). A rejection sets the task's `*_FAILED` string, either in the live region or in the dialog's `role="alert"` error.
- **Blocked buttons** use `:aria-disabled="blocked ? 'true' : undefined"` plus an early `return` in the handler (E40/E44/E50). The kit's shared `button[aria-disabled="true"]` rule styles them (E54). Do not add a per-class aria-disabled rule; `kit-css-fallbacks.test.ts` forbids one in the screen sheets.
- **CSS.**
  - Workbench and Report rules go in `src/ui/styles/screens-act.css`. Data & scans and Settings rules go in `screens-configure.css`.
  - All rules sit under `:where(.codebase-inspector-root)`.
  - Colours come only from `--ci-*` tokens (`--ci-tone-danger|warning|success|accent`, `--ci-text`, `--ci-text-muted`, `--ci-text-faint`, `--ci-border`, `--ci-panel`, `--ci-raised`, `--ci-sample`, `--ci-focus`).
  - Grid layouts collapse to one column in a `@container (max-width: 900px)` block, like `.ci-screen__grid`.
  - Every `var(--font-ui-*)` carries its em fallback.
- **Component tests.**
  - Pattern: `tests/component/ownership-screen.test.ts`:
    - `setActivePinia(createPinia())`;
    - `buildSnapshotFixture`;
    - `useCityStore().setCity(snap, computeLayout(snap))`;
    - `mount(..., { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } })`;
    - `w.unmount()`.
  - Mock the download: `vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }))`.
  - Any test that opens a `CiDialog` imports `'../mocks/obsidian'`.
  - Flush async store calls with `const flush = async () => { await Promise.resolve(); await nextTick(); await nextTick(); };`.

---

### Task 10: Refactor workbench screen and the Work-item editor (W8–W12)

**Files:**
- Create: `src/ui/screens/WorkbenchScreen.vue`, `src/ui/screens/workbench/WorkBoard.vue`, `src/ui/screens/workbench/WorkList.vue`, `src/ui/screens/workbench/WorkItemEditor.vue`
- Modify: `src/ui/App.vue`, `src/ui/shell/use-route-provenance.ts`, `src/ui/styles/screens-act.css`
- Test: `tests/component/workbench-screen.test.ts` (new), `tests/component/shell-provenance.test.ts`

**Interfaces:**
- Consumes:
  - `buildWorkbenchModel`, `planMarkdown`, `filesById`, `workTargetLabel`, `WORK_STATUSES`, `WorkRow`, `WorkColumn` (Task 7)
  - `updateWorkItem`, `removeWorkItem`, `addWorkItem(..., init)`, `isItemPending`, `workItemProblem`, `WORK_TITLE_MAX`, `WORK_NOTES_MAX`, `WorkPriority` (Task 6)
  - `useCsvExport`, `MARKDOWN_MIME` (Task 3); `CiDialog` (Task 4)
  - the copy in `audit-copy/workbench.ts` (Task 7); `WORK_ITEM_TITLE`, `WORK_ITEM_STATUS_LABEL`, `NO_CODEBASE_LABEL` (`inspector-copy.ts`)
- Produces:
  - `WorkItemEditor.vue`: props `{ itemId: string | null; newFile: FileSummary | null }`; emits `close: []`, `done: [message: string]`.
  - `WorkBoard.vue`: props `{ columns: readonly WorkColumn[] }`; emits `open: [id: string]`.
  - `WorkList.vue`: props `{ rows: readonly WorkRow[] }`; emits `open: [id: string]`.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/workbench-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import WorkbenchScreen from '../../src/ui/screens/WorkbenchScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const NOW = new Date('2026-09-22T10:00:00Z');
const flush = async () => { await Promise.resolve(); await nextTick(); await nextTick(); };
function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 12, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap.entities.filter((e) => e.kind === 'file').map((e) => e.id);
}
const mountW = () => mount(WorkbenchScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('WorkbenchScreen (Part 4)', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('shows the empty state and four collected cards without any item', () => {
    const w = mountW();
    expect(w.find('.ci-workbench__empty').text()).toContain('No work items yet');
    expect(w.findAll('.ci-metric-card')).toHaveLength(4);
    expect(w.find('.ci-provenance--sample').exists()).toBe(false);
    w.unmount();
  });

  it('shows items on the board by status, and as table rows in the list view', async () => {
    const ids = withSnapshot();
    const review = useReviewStore();
    await review.addWorkItemForFile(ids[0]!, 'A', NOW);
    await review.addWorkItem({ kind: 'file', entityId: ids[1]! }, 'tests', 'B', NOW, { status: 'in-progress' });
    const w = mountW();
    const columns = w.findAll('.ci-work-board__column');
    expect(columns).toHaveLength(4);
    expect(columns[0]!.findAll('.ci-work-card')).toHaveLength(1);
    expect(columns[2]!.findAll('.ci-work-card')).toHaveLength(1);
    await w.find('.ci-workbench__view--list').trigger('click');
    expect(w.find('.ci-workbench__view--list').attributes('aria-pressed')).toBe('true');
    expect(w.findAll('.ci-table__row')).toHaveLength(2);
    await w.find('.ci-workbench__filter').setValue('B');
    expect(w.findAll('.ci-table__row')).toHaveLength(1);
    w.unmount();
  });

  it('edits an item and announces the saved outcome', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor__title').setValue('Split the parser');
    await w.find('.ci-work-editor__priority').setValue('high');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(useReviewStore().workItems[0]).toMatchObject({ title: 'Split the parser', priority: 'high' });
    expect(w.find('.ci-work-editor').exists()).toBe(false);
    expect(w.find('.ci-workbench__live').text()).toBe('wi-1 updated.');
    w.unmount();
  });

  it('refuses Verified until all three checks are done', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor__status').setValue('verified');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(w.find('.ci-work-editor__error').text()).toBe('Complete all three checks before marking the item Verified.');
    expect(useReviewStore().workItems[0]!.status).toBe('investigate');
    const boxes = w.findAll('.ci-work-editor__check input');
    expect(boxes).toHaveLength(3);
    for (const b of boxes) await b.setValue(true);
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(useReviewStore().workItems[0]!.status).toBe('verified');
    w.unmount();
  });

  it('deletes only after the inline confirmation', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor__delete').trigger('click');
    expect(useReviewStore().workItems).toHaveLength(1);
    await w.find('.ci-work-editor__keep').trigger('click');
    expect(w.find('.ci-work-editor__delete').exists()).toBe(true);
    await w.find('.ci-work-editor__delete').trigger('click');
    await w.find('.ci-work-editor__confirm-delete').trigger('click');
    await flush();
    expect(useReviewStore().workItems).toHaveLength(0);
    expect(w.find('.ci-workbench__live').text()).toBe('wi-1 deleted.');
    w.unmount();
  });

  it('New work item is aria-disabled without a file selection, and creates for the selection', async () => {
    const ids = withSnapshot();
    const w = mountW();
    const button = w.find('.ci-workbench__new');
    expect(button.attributes('aria-disabled')).toBe('true');
    expect(button.attributes('disabled')).toBeUndefined();
    await button.trigger('click');
    expect(w.find('.ci-work-editor').exists()).toBe(false);
    useCityStore().select(ids[0]!);
    await nextTick();
    expect(w.find('.ci-workbench__new').attributes('aria-disabled')).toBeUndefined();
    await w.find('.ci-workbench__new').trigger('click');
    await w.find('.ci-work-editor__intent').setValue('tests');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(useReviewStore().workItems[0]).toMatchObject({ intent: 'tests', target: { kind: 'file', entityId: ids[0] } });
    await w.find('.ci-workbench__new').trigger('click');
    await w.find('.ci-work-editor__intent').setValue('tests');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(w.find('.ci-work-editor__error').text()).toBe('This file already has a work item with that intent.');
    expect(useReviewStore().workItems).toHaveLength(1);
    w.unmount();
  });

  it('exports the plan as Markdown through the leaf document', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-workbench__export').trigger('click');
    const [host, name, text, mime] = vi.mocked(downloadText).mock.calls[0]!;
    expect((host as HTMLElement).classList.contains('ci-screen--workbench')).toBe(true);
    expect(name).toBe('refactor-plan.md');
    expect(text).toContain('## wi-1 — A');
    expect(mime).toBe('text/markdown;charset=utf-8');
    w.unmount();
  });
});
```

  In `tests/component/shell-provenance.test.ts`, assert that on `workbench` `.ci-topbar__sample` does not exist, following the existing `settings` check.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/workbench-screen.test.ts tests/component/shell-provenance.test.ts`
- [ ] **Step 3: `workbench/WorkBoard.vue`.**

```vue
<script setup lang="ts">
import type { WorkColumn } from '../../read-models/work-items';
import {
  WORK_INTENT_LABEL, WORK_ITEM_STATUS_LABEL, WORK_PRIORITY_LABEL, WORK_TARGET_MISSING, WORKBENCH_CHECKS, WORKBENCH_COLUMN_COUNT,
} from '../../inspector-copy';

defineProps<{ columns: readonly WorkColumn[] }>();
const emit = defineEmits<{ open: [id: string] }>();
</script>

<template>
  <div class="ci-work-board">
    <section
      v-for="col in columns"
      :key="col.status"
      class="ci-work-board__column"
      :class="`ci-work-board__column--${col.status}`"
      :aria-label="WORK_ITEM_STATUS_LABEL[col.status]"
    >
      <h3 class="ci-work-board__heading">
        <span
          class="ci-work-board__dot"
          aria-hidden="true"
        />
        {{ WORK_ITEM_STATUS_LABEL[col.status] }}
        <span class="ci-work-board__count">{{ WORKBENCH_COLUMN_COUNT(col.rows.length) }}</span>
      </h3>
      <!-- W10: each card is a real button; no drag and drop. Spans, never <p>, inside a button (E20). -->
      <button
        v-for="row in col.rows"
        :key="row.item.id"
        type="button"
        class="ci-work-card"
        @click="emit('open', row.item.id)"
      >
        <span class="ci-work-card__head">
          <code class="ci-work-card__id">{{ row.item.id }}</code>
          <span
            class="ci-chip"
            :class="`ci-chip--priority-${row.item.priority}`"
          >{{ WORK_PRIORITY_LABEL[row.item.priority] }}</span>
        </span>
        <span class="ci-work-card__title">{{ row.item.title }}</span>
        <span class="ci-work-card__target">
          {{ row.target.name }}
          <span
            v-if="!row.target.present"
            class="ci-note"
          >{{ WORK_TARGET_MISSING }}</span>
        </span>
        <span class="ci-work-card__meta">
          <span>{{ WORK_INTENT_LABEL[row.item.intent] }}</span>
          <span>{{ WORKBENCH_CHECKS(row.checksDone) }}</span>
        </span>
      </button>
    </section>
  </div>
</template>
```

- [ ] **Step 4: `workbench/WorkList.vue`.**

```vue
<script setup lang="ts">
import { WORK_STATUSES, type WorkRow } from '../../read-models/work-items';
import type { WorkPriority } from '../../stores/ports/review-repository';
import {
  WORK_INTENT_LABEL, WORK_ITEM_STATUS_LABEL, WORK_PRIORITY_LABEL, WORK_TARGET_MISSING, WORKBENCH_CHECKS, WORKBENCH_COL_CHECKS,
  WORKBENCH_COL_INTENT, WORKBENCH_COL_ITEM, WORKBENCH_COL_PRIORITY, WORKBENCH_COL_STATUS, WORKBENCH_COL_TARGET, WORKBENCH_LIST_CAPTION,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';

defineProps<{ rows: readonly WorkRow[] }>();
const emit = defineEmits<{ open: [id: string] }>();

const PRIORITY_RANK: Readonly<Record<WorkPriority, number>> = { high: 0, medium: 1, low: 2 };
const columns: readonly TableColumn<WorkRow>[] = [
  { key: 'item', label: WORKBENCH_COL_ITEM, sortValue: (r) => r.item.title },
  { key: 'target', label: WORKBENCH_COL_TARGET, sortValue: (r) => r.target.detail },
  { key: 'intent', label: WORKBENCH_COL_INTENT, sortValue: (r) => r.item.intent },
  { key: 'status', label: WORKBENCH_COL_STATUS, sortValue: (r) => WORK_STATUSES.indexOf(r.item.status) },
  { key: 'priority', label: WORKBENCH_COL_PRIORITY, sortValue: (r) => PRIORITY_RANK[r.item.priority] },
  { key: 'checks', label: WORKBENCH_COL_CHECKS, numeric: true, sortValue: (r) => r.checksDone },
];
</script>

<template>
  <EvidenceTable
    :columns="columns"
    :rows="rows"
    :row-key="(r) => r.item.id"
    :caption="WORKBENCH_LIST_CAPTION"
    @activate="emit('open', $event.item.id)"
  >
    <template #cell-item="{ row }">
      <span class="ci-file-cell">
        <span class="ci-file-cell__name">{{ row.item.title }}</span>
        <span class="ci-file-cell__path">{{ row.item.id }}</span>
      </span>
    </template>
    <template #cell-target="{ row }">
      <span class="ci-file-cell">
        <span class="ci-file-cell__name">{{ row.target.name }}</span>
        <span class="ci-file-cell__path">{{ row.target.present ? row.target.detail : `${row.target.detail} · ${WORK_TARGET_MISSING}` }}</span>
      </span>
    </template>
    <template #cell-intent="{ row }">
      {{ WORK_INTENT_LABEL[row.item.intent] }}
    </template>
    <template #cell-status="{ row }">
      <span class="ci-chip">{{ WORK_ITEM_STATUS_LABEL[row.item.status] }}</span>
    </template>
    <template #cell-priority="{ row }">
      <span
        class="ci-chip"
        :class="`ci-chip--priority-${row.item.priority}`"
      >{{ WORK_PRIORITY_LABEL[row.item.priority] }}</span>
    </template>
    <template #cell-checks="{ row }">
      {{ WORKBENCH_CHECKS(row.checksDone) }}
    </template>
  </EvidenceTable>
</template>
```

  `.ci-file-cell` is a shared Overview class that all tables already use. If Task 2's scope test flags it, it is not in `OWNERS`, so it is allowed.
- [ ] **Step 5: `workbench/WorkItemEditor.vue`.**

```vue
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { FileSummary } from '../../read-models/file-summaries';
import { useReadModels } from '../../read-models/use-read-models';
import { filesById, workTargetLabel, WORK_STATUSES, type TargetLabel } from '../../read-models/work-items';
import { useReviewStore } from '../../stores/review-store';
import {
  WORK_NOTES_MAX, WORK_TITLE_MAX, workItemProblem,
  type WorkChecks, type WorkIntent, type WorkItemStatus, type WorkPriority,
} from '../../stores/ports/review-repository';
import { useUniqueId } from '../../unique-id';
import {
  WORK_CANCEL, WORK_CHECK_LABELS, WORK_CHECKLIST_HINT, WORK_CHECKLIST_TITLE, WORK_CREATE, WORK_CREATED, WORK_DELETE,
  WORK_DELETE_CONFIRM, WORK_DELETE_CONFIRM_TEXT, WORK_DELETE_FAILED, WORK_DELETE_KEEP, WORK_DELETED, WORK_DUPLICATE,
  WORK_EDITOR_SUBTITLE, WORK_EDITOR_TITLE_EDIT, WORK_EDITOR_TITLE_NEW, WORK_FIELD_INTENT, WORK_FIELD_NOTES, WORK_FIELD_PRIORITY,
  WORK_FIELD_STATUS, WORK_FIELD_TARGET, WORK_FIELD_TITLE, WORK_INTENT_LABEL, WORK_ITEM_STATUS_LABEL, WORK_ITEM_TITLE,
  WORK_NOTES_TOO_LONG, WORK_PRIORITY_LABEL, WORK_SAVE, WORK_SAVE_FAILED, WORK_TARGET_MISSING, WORK_TITLE_REQUIRED,
  WORK_TITLE_TOO_LONG, WORK_UPDATED, WORK_VERIFIED_NEEDS_CHECKS,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';

const props = defineProps<{ itemId: string | null; newFile: FileSummary | null }>();
const emit = defineEmits<{ close: []; done: [message: string] }>();

const PRIORITIES: readonly WorkPriority[] = ['high', 'medium', 'low'];
/** W11: a file can be planned for these intents here; review and pairing come from Dependencies, Security and Ownership. */
const FILE_INTENTS: readonly WorkIntent[] = ['refactor', 'tests', 'documentation'];
const PROBLEM_TEXT: Readonly<Record<NonNullable<ReturnType<typeof workItemProblem>>, string>> = {
  'title-empty': WORK_TITLE_REQUIRED,
  'title-long': WORK_TITLE_TOO_LONG(WORK_TITLE_MAX),
  'notes-long': WORK_NOTES_TOO_LONG(WORK_NOTES_MAX),
  unverified: WORK_VERIFIED_NEEDS_CHECKS,
};

const review = useReviewStore();
const { files } = useReadModels();
const base = useUniqueId('ci-work-editor');
const existing = computed(() => (props.itemId === null ? null : review.workItems.find((w) => w.id === props.itemId) ?? null));
const start = existing.value;

const title = ref(start?.title ?? (props.newFile ? WORK_ITEM_TITLE(props.newFile.name) : ''));
const priority = ref<WorkPriority>(start?.priority ?? 'medium');
const status = ref<WorkItemStatus>(start?.status ?? 'investigate');
const intent = ref<WorkIntent>('refactor');
const notes = ref(start?.notes ?? '');
const checks = ref<[boolean, boolean, boolean]>(start ? [start.checks[0], start.checks[1], start.checks[2]] : [false, false, false]);
const error = ref('');
const confirming = ref(false);
const deleteButton = ref<HTMLButtonElement | null>(null);
const confirmButton = ref<HTMLButtonElement | null>(null);

const busy = computed(() => existing.value !== null && review.isItemPending(existing.value.id));
const heading = computed(() => (existing.value ? WORK_EDITOR_TITLE_EDIT(existing.value.id) : WORK_EDITOR_TITLE_NEW));
const target = computed<TargetLabel | null>(() => {
  if (existing.value) return workTargetLabel(existing.value.target, filesById(files.value));
  return props.newFile ? { name: props.newFile.name, detail: props.newFile.path, present: true } : null;
});

// An item removed elsewhere while its editor is open: nothing is left to edit.
watch(existing, (now) => { if (props.itemId !== null && now === null) emit('close'); });

function draftChecks(): WorkChecks {
  return [checks.value[0], checks.value[1], checks.value[2]];
}

/** W9: the same rule the store enforces, explained inline. E17: only a non-null result
 *  is announced; the screen announces it once the dialog has closed. */
async function save(): Promise<void> {
  if (busy.value) return;
  error.value = '';
  const draft = { title: title.value, notes: notes.value, status: status.value, checks: draftChecks() };
  const problem = workItemProblem(draft);
  if (problem) { error.value = PROBLEM_TEXT[problem]; return; }
  try {
    if (existing.value) {
      const saved = await review.updateWorkItem(existing.value.id, { ...draft, priority: priority.value }, new Date());
      if (saved) emit('done', WORK_UPDATED(saved.id));
      return;
    }
    if (!props.newFile) return;
    const fileTarget = { kind: 'file' as const, entityId: props.newFile.id };
    if (review.hasWorkItem(fileTarget, intent.value) || review.isPending(fileTarget, intent.value)) { error.value = WORK_DUPLICATE; return; }
    const created = await review.addWorkItem(fileTarget, intent.value, draft.title, new Date(), {
      priority: priority.value, notes: draft.notes, status: draft.status, checks: draft.checks,
    });
    if (created) emit('done', WORK_CREATED(created.id));
    else error.value = WORK_DUPLICATE;
  } catch {
    error.value = WORK_SAVE_FAILED;
  }
}

function askDelete(): void {
  confirming.value = true;
  void nextTick(() => confirmButton.value?.focus());
}
function keep(): void {
  confirming.value = false;
  void nextTick(() => deleteButton.value?.focus());
}
async function confirmDelete(): Promise<void> {
  const item = existing.value;
  if (!item || busy.value) return;
  try {
    if (await review.removeWorkItem(item.id)) emit('done', WORK_DELETED(item.id));
  } catch {
    error.value = WORK_DELETE_FAILED;
  }
}
</script>

<template>
  <CiDialog
    :label="heading"
    @close="emit('close')"
  >
    <form
      class="ci-work-editor"
      novalidate
      @submit.prevent="save"
    >
      <header class="ci-work-editor__header">
        <h3>{{ heading }}</h3>
        <p class="ci-note">
          {{ WORK_EDITOR_SUBTITLE }}
        </p>
      </header>
      <label :for="`${base}-title`">{{ WORK_FIELD_TITLE }}</label>
      <input
        :id="`${base}-title`"
        v-model="title"
        class="ci-work-editor__title"
        type="text"
        aria-required="true"
        :maxlength="WORK_TITLE_MAX"
      >
      <div class="ci-work-editor__grid">
        <div class="ci-work-editor__field">
          <label :for="`${base}-priority`">{{ WORK_FIELD_PRIORITY }}</label>
          <select
            :id="`${base}-priority`"
            v-model="priority"
            class="dropdown ci-work-editor__priority"
          >
            <option
              v-for="p in PRIORITIES"
              :key="p"
              :value="p"
            >
              {{ WORK_PRIORITY_LABEL[p] }}
            </option>
          </select>
        </div>
        <div class="ci-work-editor__field">
          <label :for="`${base}-status`">{{ WORK_FIELD_STATUS }}</label>
          <select
            :id="`${base}-status`"
            v-model="status"
            class="dropdown ci-work-editor__status"
          >
            <option
              v-for="s in WORK_STATUSES"
              :key="s"
              :value="s"
            >
              {{ WORK_ITEM_STATUS_LABEL[s] }}
            </option>
          </select>
        </div>
        <div
          v-if="!existing"
          class="ci-work-editor__field"
        >
          <label :for="`${base}-intent`">{{ WORK_FIELD_INTENT }}</label>
          <select
            :id="`${base}-intent`"
            v-model="intent"
            class="dropdown ci-work-editor__intent"
          >
            <option
              v-for="i in FILE_INTENTS"
              :key="i"
              :value="i"
            >
              {{ WORK_INTENT_LABEL[i] }}
            </option>
          </select>
        </div>
        <div class="ci-work-editor__field">
          <span class="ci-work-editor__label">{{ WORK_FIELD_TARGET }}</span>
          <span
            v-if="target"
            class="ci-work-editor__target"
          >
            {{ target.name }} <code>{{ target.detail }}</code>
            <span
              v-if="!target.present"
              class="ci-note"
            >{{ WORK_TARGET_MISSING }}</span>
          </span>
        </div>
      </div>
      <label :for="`${base}-notes`">{{ WORK_FIELD_NOTES }}</label>
      <textarea
        :id="`${base}-notes`"
        v-model="notes"
        class="ci-work-editor__notes"
        :maxlength="WORK_NOTES_MAX"
      />
      <fieldset class="ci-work-editor__checks">
        <legend>{{ WORK_CHECKLIST_TITLE }}</legend>
        <label
          v-for="(label, i) in WORK_CHECK_LABELS"
          :key="label"
          class="ci-work-editor__check"
        >
          <input
            v-model="checks[i]"
            type="checkbox"
          >
          {{ label }}
        </label>
      </fieldset>
      <p class="ci-note">
        {{ WORK_CHECKLIST_HINT }}
      </p>
      <p
        v-if="error"
        class="ci-work-editor__error"
        role="alert"
      >
        {{ error }}
      </p>
      <footer class="ci-work-editor__actions">
        <template v-if="confirming">
          <span class="ci-work-editor__confirm-text">{{ WORK_DELETE_CONFIRM_TEXT }}</span>
          <button
            ref="confirmButton"
            type="button"
            class="mod-warning ci-work-editor__confirm-delete"
            :aria-disabled="busy ? 'true' : undefined"
            @click="confirmDelete"
          >
            {{ WORK_DELETE_CONFIRM }}
          </button>
          <button
            type="button"
            class="ci-work-editor__keep"
            @click="keep"
          >
            {{ WORK_DELETE_KEEP }}
          </button>
        </template>
        <template v-else>
          <button
            v-if="existing"
            ref="deleteButton"
            type="button"
            class="mod-warning ci-work-editor__delete"
            @click="askDelete"
          >
            {{ WORK_DELETE }}
          </button>
          <span class="ci-work-editor__spacer" />
          <button
            type="button"
            class="ci-work-editor__cancel"
            @click="emit('close')"
          >
            {{ WORK_CANCEL }}
          </button>
          <button
            type="submit"
            class="mod-cta ci-work-editor__save"
            :aria-disabled="busy ? 'true' : undefined"
          >
            {{ existing ? WORK_SAVE : WORK_CREATE }}
          </button>
        </template>
      </footer>
    </form>
  </CiDialog>
</template>
```

  Check `oxlint`'s `consistent-function-scoping`: `draftChecks` reads `checks` (component state), so it stays inside `setup`. If the editor passes 250 lines, move the checklist `fieldset` into `workbench/WorkChecklist.vue` with `defineModel<[boolean, boolean, boolean]>({ required: true })`.
- [ ] **Step 6: `WorkbenchScreen.vue`.**

```vue
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { MARKDOWN_MIME, useCsvExport } from '../export/use-csv-export';
import { useReadModels } from '../read-models/use-read-models';
import { rootFolderLabel } from '../read-models/root-label';
import { buildWorkbenchModel, filesById, planMarkdown } from '../read-models/work-items';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { useUniqueId } from '../unique-id';
import {
  NO_CODEBASE_LABEL, WORKBENCH_EMPTY, WORKBENCH_EMPTY_TITLE, WORKBENCH_EXPORT, WORKBENCH_EYEBROW, WORKBENCH_FILTER,
  WORKBENCH_FILTER_LABEL, WORKBENCH_FOOTNOTE, WORKBENCH_MD_FILENAME, WORKBENCH_NEW, WORKBENCH_NEW_FOR, WORKBENCH_NEW_HINT,
  WORKBENCH_NO_MATCH, WORKBENCH_SUBTITLE, WORKBENCH_TITLE, WORKBENCH_VIEW_BOARD, WORKBENCH_VIEW_LABEL, WORKBENCH_VIEW_LIST,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Icon from '../kit/Icon.vue';
import WorkBoard from './workbench/WorkBoard.vue';
import WorkList from './workbench/WorkList.vue';
import WorkItemEditor from './workbench/WorkItemEditor.vue';

const store = useCityStore();
const review = useReviewStore();
const { files } = useReadModels();
const root = ref<HTMLElement | null>(null);
const liveMessage = ref('');
const query = ref('');
const view = ref<'board' | 'list'>('board');
const editing = ref<string | null>(null);
const creating = ref(false);
const hintId = useUniqueId('ci-workbench-new-hint');

const model = computed(() => buildWorkbenchModel(review.workItems, files.value, query.value));
/** W11: New work item plans work for the selected FILE only. */
const selectedFile = computed(() => (store.selectedEntityId ? filesById(files.value).get(store.selectedEntityId) ?? null : null));
const editorOpen = computed(() => editing.value !== null || (creating.value && selectedFile.value !== null));
const sourceLabel = computed(() => (store.snapshot ? rootFolderLabel(store.snapshot.scope.rootPath) : NO_CODEBASE_LABEL));
const exportText = useCsvExport(root, liveMessage);

function exportPlan(): void {
  exportText(WORKBENCH_MD_FILENAME, () => planMarkdown(model.value.rows, sourceLabel.value), MARKDOWN_MIME);
}
function openNew(): void {
  if (!selectedFile.value) return;
  creating.value = true;
}
/** CiDialog returns focus to its opener when it still exists; a deleted card is gone, so
 *  focus lands on the filter instead of the shell (Part 2 F7 pattern). */
async function closeEditor(message?: string): Promise<void> {
  editing.value = null;
  creating.value = false;
  if (message) liveMessage.value = message;
  await nextTick();
  const el = root.value;
  const active = el?.ownerDocument.activeElement;
  if (el && !(active && el.contains(active))) el.querySelector<HTMLElement>('.ci-workbench__filter')?.focus();
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--workbench"
  >
    <PageHeader
      :eyebrow="WORKBENCH_EYEBROW"
      :title="WORKBENCH_TITLE"
      :subtitle="WORKBENCH_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-workbench__export"
          :disabled="model.rows.length === 0"
          @click="exportPlan"
        >
          <Icon name="download" />
          {{ WORKBENCH_EXPORT }}
        </button>
        <button
          type="button"
          class="mod-cta ci-workbench__new"
          :aria-disabled="selectedFile ? undefined : 'true'"
          :aria-describedby="hintId"
          @click="openNew"
        >
          <Icon name="plus" />
          {{ WORKBENCH_NEW }}
        </button>
      </template>
    </PageHeader>
    <p
      :id="hintId"
      class="ci-note ci-workbench__new-hint"
    >
      {{ selectedFile ? WORKBENCH_NEW_FOR(selectedFile.name) : WORKBENCH_NEW_HINT }}
    </p>
    <p
      class="visually-hidden ci-workbench__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <div class="ci-screen__cards">
      <MetricCard
        v-for="c in model.cards"
        :key="c.id"
        :label="c.label"
        :icon="c.icon"
        :value="c.value"
        :caption="c.caption"
        :tone="c.tone"
      />
    </div>
    <div class="ci-workbench__toolbar">
      <input
        v-model="query"
        type="search"
        class="ci-workbench__filter"
        :placeholder="WORKBENCH_FILTER"
        :aria-label="WORKBENCH_FILTER_LABEL"
      >
      <div
        class="ci-workbench__views"
        role="group"
        :aria-label="WORKBENCH_VIEW_LABEL"
      >
        <button
          type="button"
          class="ci-workbench__view ci-workbench__view--board"
          :aria-pressed="view === 'board'"
          @click="view = 'board'"
        >
          {{ WORKBENCH_VIEW_BOARD }}
        </button>
        <button
          type="button"
          class="ci-workbench__view ci-workbench__view--list"
          :aria-pressed="view === 'list'"
          @click="view = 'list'"
        >
          {{ WORKBENCH_VIEW_LIST }}
        </button>
      </div>
    </div>
    <div
      v-if="model.total === 0"
      class="ci-empty ci-workbench__empty"
    >
      <p class="ci-empty__title">
        {{ WORKBENCH_EMPTY_TITLE }}
      </p>
      <p>{{ WORKBENCH_EMPTY }}</p>
    </div>
    <p
      v-else-if="model.rows.length === 0"
      class="ci-note ci-workbench__no-match"
    >
      {{ WORKBENCH_NO_MATCH }}
    </p>
    <WorkBoard
      v-else-if="view === 'board'"
      :columns="model.columns"
      @open="editing = $event"
    />
    <WorkList
      v-else
      :rows="model.rows"
      @open="editing = $event"
    />
    <p class="ci-note">
      {{ WORKBENCH_FOOTNOTE }}
    </p>
    <WorkItemEditor
      v-if="editorOpen"
      :item-id="editing"
      :new-file="editing === null ? selectedFile : null"
      @close="closeEditor()"
      @done="closeEditor($event)"
    />
  </div>
</template>
```

- [ ] **Step 7: Wire the route.**
  - In `App.vue`, add the import and `<WorkbenchScreen v-else-if="store.route === 'workbench'" />`.
  - In `use-route-provenance.ts`, add `case 'workbench': return false;` with the comment `// Part 4 W16: work items are the reviewer's own records, not sample values.`.
- [ ] **Step 8: CSS** (`screens-act.css`):

```css
/* Part 4 Task 10: Refactor workbench and the Work-item editor. */
:where(.codebase-inspector-root) .ci-workbench__toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: var(--ci-space-3);
  padding: var(--ci-space-3); border: 1px solid var(--ci-border); border-radius: var(--ci-radius-card); background: var(--ci-panel);
}
:where(.codebase-inspector-root) .ci-workbench__filter { flex: 0 1 18em; }
:where(.codebase-inspector-root) .ci-workbench__views { display: inline-flex; gap: var(--ci-space-1); margin-left: auto; }
:where(.codebase-inspector-root) .ci-workbench__view[aria-pressed="true"] { background: var(--ci-raised); color: var(--ci-text); font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-workbench__new-hint { margin-top: calc(-1 * var(--ci-space-3)); }
:where(.codebase-inspector-root) .ci-work-board { display: grid; gap: var(--ci-space-4); grid-template-columns: repeat(4, minmax(0, 1fr)); }
@container (max-width: 900px) {
  :where(.codebase-inspector-root) .ci-work-board { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 560px) {
  :where(.codebase-inspector-root) .ci-work-board { grid-template-columns: minmax(0, 1fr); }
}
:where(.codebase-inspector-root) .ci-work-board__column {
  display: flex; flex-direction: column; gap: var(--ci-space-3); min-height: 12em;
  padding: var(--ci-space-3); border: 1px solid var(--ci-border); border-radius: var(--ci-radius-card); background: var(--ci-panel);
}
:where(.codebase-inspector-root) .ci-work-board__heading { display: flex; align-items: center; gap: var(--ci-space-2); margin: 0; font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-work-board__count { margin-left: auto; color: var(--ci-text-faint); font-weight: normal; }
:where(.codebase-inspector-root) .ci-work-board__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ci-tone-accent); }
:where(.codebase-inspector-root) .ci-work-board__column--investigate .ci-work-board__dot { background: var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-work-board__column--verified .ci-work-board__dot { background: var(--ci-tone-success); }
:where(.codebase-inspector-root) button.ci-work-card {
  display: flex; flex-direction: column; align-items: stretch; gap: var(--ci-space-2); width: 100%; height: auto;
  padding: var(--ci-space-3); border: 1px solid var(--ci-border); border-radius: var(--ci-radius-small);
  background: var(--ci-raised); box-shadow: none; color: var(--ci-text); text-align: left; white-space: normal; cursor: pointer;
}
:where(.codebase-inspector-root) button.ci-work-card:focus-visible { outline: 2px solid var(--ci-focus); outline-offset: 2px; }
:where(.codebase-inspector-root) .ci-work-card__head, :where(.codebase-inspector-root) .ci-work-card__meta { display: flex; justify-content: space-between; gap: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-work-card__id { color: var(--ci-text-faint); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-work-card__title { font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-work-card__target, :where(.codebase-inspector-root) .ci-work-card__meta { color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-chip--priority-high { border-color: var(--ci-tone-danger); color: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-chip--priority-medium { border-color: var(--ci-tone-warning); color: var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-chip--priority-low { border-color: var(--ci-border); color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-work-editor { display: grid; gap: var(--ci-space-2); width: min(40em, 90vw); }
:where(.codebase-inspector-root) .ci-work-editor__header h3 { margin: 0; }
:where(.codebase-inspector-root) .ci-work-editor__grid { display: grid; gap: var(--ci-space-3); grid-template-columns: repeat(2, minmax(0, 1fr)); margin: var(--ci-space-2) 0; }
:where(.codebase-inspector-root) .ci-work-editor__field { display: flex; flex-direction: column; gap: var(--ci-space-1); }
:where(.codebase-inspector-root) .ci-work-editor__notes { min-height: 6em; resize: vertical; }
:where(.codebase-inspector-root) .ci-work-editor__checks { display: grid; gap: var(--ci-space-2); margin: var(--ci-space-2) 0 0; padding: 0; border: none; }
:where(.codebase-inspector-root) .ci-work-editor__checks legend { margin-bottom: var(--ci-space-2); font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-work-editor__check { display: flex; align-items: center; gap: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-work-editor__error { margin: 0; color: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-work-editor__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ci-space-2); margin-top: var(--ci-space-3); }
:where(.codebase-inspector-root) .ci-work-editor__spacer { flex: 1 1 auto; }
```

  `vw` is used only for the dialog width cap. If `.ci-dialog` already sets a max width, drop the `min()` and use `max-width: 40em`.
- [ ] **Step 9: Run and confirm they pass.** `npx vitest run tests/component/workbench-screen.test.ts tests/component/shell-provenance.test.ts tests/unit/kit-css-fallbacks.test.ts tests/unit/css-class-scope.test.ts`, then the gate.
- [ ] **Step 10: Commit.** `feat(ui): Refactor workbench with board, list, filter, plan export and the Work-item editor`

---

### Task 11: Audit report screen (W6, W7)

**Files:**
- Create: `src/ui/screens/ReportScreen.vue`, `src/ui/screens/report/ReportPaper.vue`, `src/ui/screens/report/ReportContents.vue`
- Modify: `src/ui/App.vue`, `src/ui/shell/use-route-provenance.ts`, `src/ui/styles/screens-act.css`
- Test: `tests/component/report-screen.test.ts` (new), `tests/component/shell-provenance.test.ts`

**Interfaces:**
- Consumes:
  - `buildReportModel`, `includedSections`, `reportMarkdown`, `ReportModel`, `ReportMetric` (Task 8); `useReportStore`, `REPORT_NOTE_MAX` (Task 8)
  - `buildWorkbenchModel` (Task 7); `useCsvExport`, `MARKDOWN_MIME` (Task 3)
  - `overview`, `architecture`, `security`, `files` from `useReadModels()`
- Produces:
  - `ReportPaper.vue`: props `{ model: ReportModel; sections: Readonly<Record<ReportSection, boolean>>; note: string }`.
  - `ReportContents.vue`: emits `announce: [message: string]`, and reads and writes `useReportStore()` directly.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/report-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import ReportScreen from '../../src/ui/screens/ReportScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 30, directories: 3 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}
const mountR = () => mount(ReportScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('ReportScreen (Part 4)', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('asks for a codebase without a snapshot', () => {
    const w = mountR();
    expect(w.text()).toContain('No snapshot yet');
    w.unmount();
  });

  it('composes the paper with the sample badge, numbered sections and the limitations', () => {
    withSnapshot();
    const w = mountR();
    const paper = w.find('.ci-report-paper');
    expect(paper.text()).toContain('Includes sample data');
    expect(paper.findAll('.ci-report-paper__section-title').map((h) => h.text())).toEqual([
      '01 / Executive summary', '02 / Architecture review', '03 / Quality hotspots', '04 / Security review', '05 / Refactor plan',
    ]);
    expect(paper.text()).toContain('Scope and limitations');
    expect(paper.find('.ci-provenance--sample').exists()).toBe(true);
    w.unmount();
  });

  it('toggling a section renumbers the rest; the plan lists real work items', async () => {
    const snap = withSnapshot();
    await useReviewStore().addWorkItemForFile(snap.entities.find((e) => e.kind === 'file')!.id, 'Split it', new Date());
    const w = mountR();
    await w.find('.ci-report-contents input[value="architecture"]').setValue(false);
    const titles = w.findAll('.ci-report-paper__section-title').map((h) => h.text());
    expect(titles).toContain('02 / Quality hotspots');
    expect(titles.join()).not.toContain('Architecture review');
    expect(w.find('.ci-report-paper').text()).toContain('Split it');
    w.unmount();
  });

  it('applies the reviewer note on request only, and announces it', async () => {
    withSnapshot();
    const w = mountR();
    await w.find('.ci-report-contents textarea').setValue('Confirm the parser boundary.');
    expect(w.find('.ci-report-paper').text()).not.toContain('Confirm the parser boundary.');
    await w.find('.ci-report-contents__apply').trigger('click');
    expect(w.find('.ci-report-paper').text()).toContain('Confirm the parser boundary.');
    expect(w.find('.ci-report__live').text()).toBe('Reviewer note applied to the report.');
    w.unmount();
  });

  it('exports Markdown with the chosen sections through the leaf document', async () => {
    withSnapshot();
    const w = mountR();
    await w.find('.ci-report__export').trigger('click');
    const [host, name, text, mime] = vi.mocked(downloadText).mock.calls[0]!;
    expect((host as HTMLElement).classList.contains('ci-screen--report')).toBe(true);
    expect(name).toBe('codebase-audit-report.md');
    expect(mime).toBe('text/markdown;charset=utf-8');
    expect(text).toContain('## 01 / Executive summary');
    expect(text).toContain('(sample)');
    w.unmount();
  });
});
```

  In `tests/component/shell-provenance.test.ts`, add `'report'` to the route list that expects "Includes sample data".
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/report-screen.test.ts tests/component/shell-provenance.test.ts`
- [ ] **Step 3: `report/ReportPaper.vue`.**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { formatMetric, hasValue, isSampleBacked } from '../../evidence';
import type { FileSummary } from '../../read-models/file-summaries';
import { includedSections, type ReportMetric, type ReportModel, type ReportRule } from '../../read-models/report';
import type { ReportSection } from '../../stores/report-store';
import {
  REPORT_COL_BOUNDARY, REPORT_COL_COMMITS, REPORT_COL_COMPLEXITY, REPORT_COL_COVERAGE, REPORT_COL_FILE, REPORT_COL_PRIORITY,
  REPORT_COL_RATIONALE, REPORT_COL_RULE, REPORT_COL_STATUS, REPORT_HOTSPOTS_NOTE, REPORT_KICKER, REPORT_LIMITS,
  REPORT_LIMITS_TITLE, REPORT_NO_NOTE, REPORT_NO_PLAN, REPORT_NO_RULES, REPORT_NOTE_TITLE, REPORT_RULES_TITLE,
  REPORT_SAMPLE_BADGE, REPORT_SECTION_HEADING, REPORT_SECTION_LABEL, REPORT_SECURITY_NOTE, REPORT_SUMMARY_NOTE,
  WORK_ITEM_STATUS_LABEL, WORK_PRIORITY_LABEL, WORK_TARGET_MISSING,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

const props = defineProps<{ model: ReportModel; sections: Readonly<Record<ReportSection, boolean>>; note: string }>();
const shown = computed(() => includedSections(props.sections));
const metricsOf = (section: ReportSection): readonly ReportMetric[] =>
  (section === 'summary' ? props.model.summary : section === 'architecture' ? props.model.architecture : props.model.security);
const alsoSample = (m: ReportMetric): boolean => m.value.state !== 'sample' && isSampleBacked(m.value);

const RULE_COLUMNS: readonly TableColumn<ReportRule>[] = [
  { key: 'id', label: REPORT_COL_RULE }, { key: 'boundary', label: REPORT_COL_BOUNDARY },
  { key: 'status', label: REPORT_COL_STATUS }, { key: 'rationale', label: REPORT_COL_RATIONALE },
];
const HOTSPOT_COLUMNS: readonly TableColumn<FileSummary>[] = [
  { key: 'file', label: REPORT_COL_FILE }, { key: 'priority', label: REPORT_COL_PRIORITY, numeric: true },
  { key: 'complexity', label: REPORT_COL_COMPLEXITY, numeric: true }, { key: 'commits', label: REPORT_COL_COMMITS, numeric: true },
  { key: 'coverage', label: REPORT_COL_COVERAGE, numeric: true },
];
</script>

<template>
  <article class="ci-report-paper">
    <div class="ci-report-paper__kicker">
      <span>{{ REPORT_KICKER }}</span>
      <span class="ci-chip ci-chip--sample">{{ REPORT_SAMPLE_BADGE }}</span>
    </div>
    <h3 class="ci-report-paper__title">
      {{ model.title }}
    </h3>
    <dl class="ci-report-paper__facts">
      <template
        v-for="f in model.facts"
        :key="f.label"
      >
        <dt>{{ f.label }}</dt>
        <dd>{{ f.value }}</dd>
      </template>
    </dl>
    <section
      v-for="(section, i) in shown"
      :key="section"
      class="ci-report-paper__section"
    >
      <h4 class="ci-report-paper__section-title">
        {{ REPORT_SECTION_HEADING(i + 1, REPORT_SECTION_LABEL[section]) }}
      </h4>
      <ul
        v-if="section === 'summary' || section === 'architecture' || section === 'security'"
        class="ci-report-paper__metrics"
      >
        <li
          v-for="m in metricsOf(section)"
          :key="m.label"
        >
          <span>{{ m.label }}</span>
          <strong>{{ formatMetric(m.value, m.unit) }}</strong>
          <ProvenanceBadge
            v-if="m.value.state !== 'collected'"
            :state="m.value.state"
          />
          <ProvenanceBadge
            v-if="alsoSample(m)"
            state="sample"
          />
          <span
            v-if="!hasValue(m.value) && m.value.reason"
            class="ci-note"
          >{{ m.value.reason }}</span>
        </li>
      </ul>
      <p
        v-if="section === 'summary'"
        class="ci-note"
      >
        {{ REPORT_SUMMARY_NOTE }}
      </p>
      <template v-if="section === 'architecture'">
        <h5 class="ci-report-paper__subtitle">
          {{ REPORT_RULES_TITLE }}
        </h5>
        <p
          v-if="model.rules.length === 0"
          class="ci-note"
        >
          {{ REPORT_NO_RULES }}
        </p>
        <EvidenceTable
          v-else
          :columns="RULE_COLUMNS"
          :rows="model.rules"
          :row-key="(r) => r.id"
          :caption="REPORT_RULES_TITLE"
          :interactive="false"
        >
          <template #cell-id="{ row }">
            <code>{{ row.id }}</code>
          </template>
          <template #cell-boundary="{ row }">
            {{ row.boundary }}
          </template>
          <template #cell-status="{ row }">
            {{ row.status }}
          </template>
          <template #cell-rationale="{ row }">
            {{ row.rationale }}
          </template>
        </EvidenceTable>
      </template>
      <template v-if="section === 'hotspots'">
        <EvidenceTable
          :columns="HOTSPOT_COLUMNS"
          :rows="model.hotspots"
          :row-key="(f) => f.id"
          :caption="REPORT_SECTION_LABEL.hotspots"
          :interactive="false"
        >
          <template #cell-file="{ row }">
            <span class="ci-file-cell">
              <span class="ci-file-cell__name">{{ row.name }}</span>
              <span class="ci-file-cell__path">{{ row.path }}</span>
            </span>
          </template>
          <template #cell-priority="{ row }">
            {{ formatMetric(row.priority) }} <ProvenanceBadge :state="row.priority.state" />
          </template>
          <template #cell-complexity="{ row }">
            {{ formatMetric(row.complexity) }}
          </template>
          <template #cell-commits="{ row }">
            {{ formatMetric(row.commits90d) }}
          </template>
          <template #cell-coverage="{ row }">
            {{ formatMetric(row.branchCoverage, '%') }}
          </template>
        </EvidenceTable>
        <p class="ci-note">
          {{ REPORT_HOTSPOTS_NOTE }}
        </p>
      </template>
      <p
        v-if="section === 'security'"
        class="ci-note"
      >
        {{ REPORT_SECURITY_NOTE }}
      </p>
      <template v-if="section === 'plan'">
        <p
          v-if="model.plan.length === 0"
          class="ci-note"
        >
          {{ REPORT_NO_PLAN }}
        </p>
        <ul
          v-else
          class="ci-report-paper__plan"
        >
          <li
            v-for="r in model.plan"
            :key="r.item.id"
          >
            <strong>{{ r.item.title }}</strong>
            <span class="ci-chip">{{ WORK_ITEM_STATUS_LABEL[r.item.status] }}</span>
            <span class="ci-note">{{ r.item.id }} · {{ WORK_PRIORITY_LABEL[r.item.priority] }} · {{ r.target.detail }}<template v-if="!r.target.present"> · {{ WORK_TARGET_MISSING }}</template></span>
          </li>
        </ul>
      </template>
    </section>
    <section class="ci-report-paper__section">
      <h4 class="ci-report-paper__section-title--fixed">
        {{ REPORT_NOTE_TITLE }}
      </h4>
      <p class="ci-report-paper__note">
        {{ note.trim() === '' ? REPORT_NO_NOTE : note }}
      </p>
    </section>
    <section class="ci-report-paper__section">
      <h4 class="ci-report-paper__section-title--fixed">
        {{ REPORT_LIMITS_TITLE }}
      </h4>
      <p>{{ REPORT_LIMITS }}</p>
    </section>
  </article>
</template>
```

  Note: the note and limitations headings use the `--fixed` class, so the test's numbered-title list sees only the numbered sections. The plan line shows the target's `detail`, which for a package or module is "Package" / "Module". If that reads poorly, show `r.target.name` followed by `r.target.detail`, and report it.
- [ ] **Step 4: `report/ReportContents.vue`.**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { REPORT_NOTE_MAX, REPORT_SECTIONS, useReportStore } from '../../stores/report-store';
import { useUniqueId } from '../../unique-id';
import {
  REPORT_CALLOUT, REPORT_CALLOUT_TITLE, REPORT_CONTENTS_SUBTITLE, REPORT_CONTENTS_TITLE, REPORT_NOTE_APPLIED, REPORT_NOTE_APPLY,
  REPORT_NOTE_LABEL, REPORT_NOTE_PANEL_SUBTITLE, REPORT_NOTE_PANEL_TITLE, REPORT_NOTE_TOO_LONG, REPORT_SECTION_LABEL,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Callout from '../../kit/Callout.vue';
import Icon from '../../kit/Icon.vue';

const emit = defineEmits<{ announce: [message: string] }>();
const report = useReportStore();
const noteId = useUniqueId('ci-report-note');
const draft = ref(report.note);
const error = ref('');

function apply(): void {
  error.value = '';
  if (report.applyNote(draft.value)) emit('announce', REPORT_NOTE_APPLIED);
  else error.value = REPORT_NOTE_TOO_LONG(REPORT_NOTE_MAX);
}
</script>

<template>
  <aside class="ci-report-contents">
    <Panel
      :title="REPORT_CONTENTS_TITLE"
      :subtitle="REPORT_CONTENTS_SUBTITLE"
    >
      <label
        v-for="s in REPORT_SECTIONS"
        :key="s"
        class="ci-report-contents__check"
      >
        <input
          type="checkbox"
          :value="s"
          :checked="report.sections[s]"
          @change="report.setSection(s, ($event.target as HTMLInputElement).checked)"
        >
        {{ REPORT_SECTION_LABEL[s] }}
      </label>
    </Panel>
    <Panel
      :title="REPORT_NOTE_PANEL_TITLE"
      :subtitle="REPORT_NOTE_PANEL_SUBTITLE"
    >
      <label
        class="visually-hidden"
        :for="noteId"
      >{{ REPORT_NOTE_LABEL }}</label>
      <textarea
        :id="noteId"
        v-model="draft"
        class="ci-report-contents__note"
        :maxlength="REPORT_NOTE_MAX"
      />
      <p
        v-if="error"
        class="ci-report-contents__error"
        role="alert"
      >
        {{ error }}
      </p>
      <button
        type="button"
        class="ci-report-contents__apply"
        @click="apply"
      >
        <Icon name="check" />
        {{ REPORT_NOTE_APPLY }}
      </button>
    </Panel>
    <Callout
      tone="warning"
      :title="REPORT_CALLOUT_TITLE"
    >
      {{ REPORT_CALLOUT }}
    </Callout>
  </aside>
</template>
```

  The test uses `input[value="architecture"]` with `setValue(false)`. `@vue/test-utils` sets `checked` and fires `change`, so the handler reads `checked`. The `$event.target as HTMLInputElement` cast follows the existing `FindingFilters` pattern. If lint forbids the cast, use a `v-model` on a computed getter/setter per section instead.
- [ ] **Step 5: `ReportScreen.vue`.**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { MARKDOWN_MIME, useCsvExport } from '../export/use-csv-export';
import { buildReportModel, reportMarkdown } from '../read-models/report';
import { useReadModels } from '../read-models/use-read-models';
import { buildWorkbenchModel } from '../read-models/work-items';
import { useCityStore } from '../stores/city-store';
import { useReportStore } from '../stores/report-store';
import { useReviewStore } from '../stores/review-store';
import { REPORT_EXPORT, REPORT_EYEBROW, REPORT_MD_FILENAME, REPORT_SUBTITLE, REPORT_TITLE } from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Icon from '../kit/Icon.vue';
import NoSnapshot from './NoSnapshot.vue';
import ReportPaper from './report/ReportPaper.vue';
import ReportContents from './report/ReportContents.vue';

const store = useCityStore();
const review = useReviewStore();
const report = useReportStore();
const { files, overview, architecture, security } = useReadModels();
const root = ref<HTMLElement | null>(null);
const liveMessage = ref('');
const exportText = useCsvExport(root, liveMessage);

const model = computed(() => {
  const snapshot = store.snapshot;
  const ov = overview.value;
  if (!snapshot || !ov) return null;
  const plan = buildWorkbenchModel(review.workItems, files.value, '').rows;
  return buildReportModel({ snapshot, files: files.value, overview: ov, architecture: architecture.value, security: security.value, plan });
});

/** W6: Markdown through the leaf's own document only; nothing is written to the vault. */
function exportReport(): void {
  const m = model.value;
  if (m) exportText(REPORT_MD_FILENAME, () => reportMarkdown(m, report.sections, report.note), MARKDOWN_MIME);
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--report"
  >
    <PageHeader
      :eyebrow="REPORT_EYEBROW"
      :title="REPORT_TITLE"
      :subtitle="REPORT_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="mod-cta ci-report__export"
          :disabled="!model"
          @click="exportReport"
        >
          <Icon name="download" />
          {{ REPORT_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <p
      class="visually-hidden ci-report__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <NoSnapshot v-if="!model" />
    <div
      v-else
      class="ci-report"
    >
      <ReportPaper
        :model="model"
        :sections="report.sections"
        :note="report.note"
      />
      <ReportContents @announce="liveMessage = $event" />
    </div>
  </div>
</template>
```

- [ ] **Step 6: Wire the route.**
  - In `App.vue`, add `<ReportScreen v-else-if="store.route === 'report'" />`.
  - In `use-route-provenance.ts`, add `case 'report': return true;` with the comment `// Part 4 W16: the report quotes the Overview, Hotspots and Security sample values.`.
- [ ] **Step 7: CSS** (`screens-act.css`):

```css
/* Part 4 Task 11: Audit report. */
:where(.codebase-inspector-root) .ci-report { display: grid; gap: var(--ci-space-4); grid-template-columns: minmax(0, 1fr) minmax(14em, 18em); align-items: start; }
@container (max-width: 900px) {
  :where(.codebase-inspector-root) .ci-report { grid-template-columns: minmax(0, 1fr); }
}
:where(.codebase-inspector-root) .ci-report-paper {
  display: flex; flex-direction: column; gap: var(--ci-space-4); padding: var(--ci-space-6);
  border: 1px solid var(--ci-border); border-radius: var(--ci-radius-card); background: var(--ci-panel);
}
:where(.codebase-inspector-root) .ci-report-paper__kicker { display: flex; justify-content: space-between; align-items: center; color: var(--ci-text-faint); font-size: var(--font-ui-smaller, 0.8em); letter-spacing: 0.08em; text-transform: uppercase; }
:where(.codebase-inspector-root) .ci-report-paper__title { margin: 0; font-size: var(--font-ui-large, 1.15em); }
:where(.codebase-inspector-root) .ci-report-paper__facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--ci-space-2) var(--ci-space-4); margin: 0; padding-bottom: var(--ci-space-4); border-bottom: 1px solid var(--ci-border); font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-report-paper__facts dt { color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-report-paper__facts dd { margin: 0; }
:where(.codebase-inspector-root) .ci-report-paper__section { display: flex; flex-direction: column; gap: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-report-paper__section-title,
:where(.codebase-inspector-root) .ci-report-paper__section-title--fixed { margin: 0; font-size: var(--font-ui-medium, 1em); }
:where(.codebase-inspector-root) .ci-report-paper__subtitle { margin: var(--ci-space-2) 0 0; font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-report-paper__metrics,
:where(.codebase-inspector-root) .ci-report-paper__plan { display: grid; gap: var(--ci-space-2); margin: 0; padding-left: var(--ci-space-4); }
:where(.codebase-inspector-root) .ci-report-paper__metrics li,
:where(.codebase-inspector-root) .ci-report-paper__plan li { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-report-paper__note { margin: 0; white-space: pre-wrap; }
:where(.codebase-inspector-root) .ci-report-contents { display: flex; flex-direction: column; gap: var(--ci-space-4); }
:where(.codebase-inspector-root) .ci-report-contents__check { display: flex; align-items: center; gap: var(--ci-space-2); padding: var(--ci-space-1) 0; }
:where(.codebase-inspector-root) .ci-report-contents__note { width: 100%; min-height: 8em; resize: vertical; }
:where(.codebase-inspector-root) .ci-report-contents__apply { width: 100%; margin-top: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-report-contents__error { margin: var(--ci-space-2) 0 0; color: var(--ci-tone-danger); }
```

- [ ] **Step 8: Run and confirm they pass.** `npx vitest run tests/component/report-screen.test.ts tests/component/shell-provenance.test.ts tests/unit/kit-css-fallbacks.test.ts tests/unit/css-class-scope.test.ts`, then the gate.
- [ ] **Step 9: Commit.** `feat(ui): Audit report composed from the screen models, with section choices, reviewer note and Markdown export`

---

### Task 12: Data & scans screen (W2–W4, W15)

**Files:**
- Create: `src/ui/screens/SourcesScreen.vue`, `src/ui/screens/sources/ScopePanel.vue`, `src/ui/screens/sources/ScanStatusPanel.vue`, `src/ui/screens/sources/ProviderGrid.vue`
- Modify: `src/ui/App.vue`, `src/ui/shell/use-route-provenance.ts`, `src/ui/styles/screens-configure.css`
- Test: `tests/component/sources-screen.test.ts` (new), `tests/component/shell-provenance.test.ts`

**Interfaces:**
- Consumes: `buildSourcesModel`, `ScopeRow`, `RunView`, `ProviderCard` (Task 9); `useRunStore` (`stores/run-store.ts`); the injected `onSelectCodebase` and `onScanRequested`; `ROUTE_META` (`src/ui/routes.ts`).
- Produces:
  - `ScopePanel.vue`: props `{ rows: readonly ScopeRow[] | null }`.
  - `ScanStatusPanel.vue`: props `{ run: RunView }`.
  - `ProviderGrid.vue`: props `{ providers: readonly ProviderCard[] }`; emits `open: [route: RouteId]`.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/sources-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useRunStore } from '../../src/ui/stores/run-store';
import { initialScanLifecycleState } from '../../src/application/run-state';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function mountS(onSelectCodebase = vi.fn(), onScanRequested = vi.fn()) {
  return mount(SourcesScreen, { attachTo: document.body, global: { provide: { onSelectCodebase, onScanRequested } } });
}
const withSnapshot = () => {
  const snap = buildSnapshotFixture({ files: 10, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
};

describe('SourcesScreen (Part 4)', () => {
  beforeEach(() => { setActivePinia(createPinia()); useCityStore().navigate('sources'); });

  it('without a snapshot: the scope panel asks for a codebase, the providers still render', () => {
    const w = mountS();
    expect(w.find('.ci-sources__scope').text()).toContain('No snapshot yet');
    expect(w.findAll('.ci-provider')).toHaveLength(8);
    expect(w.find('.ci-provider--inventory .ci-provenance--unknown').exists()).toBe(true);
    expect(w.find('.ci-sources__status').text()).toContain('No scan has run in this leaf yet.');
    w.unmount();
  });

  it('shows the real scope of the snapshot on screen', () => {
    const snap = withSnapshot();
    const w = mountS();
    expect(w.find('.ci-sources__scope').text()).toContain(snap.scope.rootPath);
    expect(w.find('.ci-sources__scope').text()).toContain('Not followed');
    expect(w.find('.ci-provider--inventory .ci-provenance').exists()).toBe(false);
    w.unmount();
  });

  it('Rescan and Change source go to the city first, then call the host', async () => {
    withSnapshot();
    let routeAtCall = '';
    const scan = vi.fn(() => { routeAtCall = useCityStore().route; });
    const select = vi.fn();
    const w = mountS(select, scan);
    await w.find('.ci-sources__rescan').trigger('click');
    expect(scan).toHaveBeenCalledOnce();
    expect(routeAtCall).toBe('city');
    useCityStore().navigate('sources');
    await w.find('.ci-sources__change').trigger('click');
    expect(select).toHaveBeenCalledOnce();
    expect(useCityStore().route).toBe('city');
    w.unmount();
  });

  it('Rescan is aria-disabled while a run is in flight, and the status explains how to cancel', async () => {
    const scan = vi.fn();
    const w = mountS(vi.fn(), scan);
    const approval = { profileId: 'p', sourceFingerprint: 's', scopeFingerprint: 'c', approvedAt: 'a', operation: 'read-only-inventory' as const };
    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'running', runId: 'r', generation: 1, approval, processedFiles: 12 } });
    await nextTick();
    const rescan = w.find('.ci-sources__rescan');
    expect(rescan.attributes('aria-disabled')).toBe('true');
    await rescan.trigger('click');
    expect(scan).not.toHaveBeenCalled();
    expect(w.find('.ci-sources__status').text()).toContain('12 files read so far');
    expect(w.find('.ci-sources__status').text()).toContain('Cancel scan');
    w.unmount();
  });

  it('shows a failed run with its message', async () => {
    const w = mountS();
    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'failed', runId: 'r', message: 'EACCES: permission denied' } });
    await nextTick();
    expect(w.find('.ci-sources__status').text()).toContain('The last scan failed: EACCES: permission denied');
    w.unmount();
  });

  it('a provider’s "used by" button navigates to that screen', async () => {
    withSnapshot();
    const w = mountS();
    await w.find('.ci-provider--secrets .ci-provider__route').trigger('click');
    expect(useCityStore().route).toBe('security');
    w.unmount();
  });
});
```

  In `tests/component/shell-provenance.test.ts`, assert that `.ci-topbar__sample` does not exist on `sources`.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/sources-screen.test.ts tests/component/shell-provenance.test.ts`
- [ ] **Step 3: `sources/ScopePanel.vue`.**

```vue
<script setup lang="ts">
import type { ScopeRow } from '../../read-models/sources';
import { SOURCES_SCOPE_EDIT, SOURCES_SCOPE_SUBTITLE, SOURCES_SCOPE_TITLE } from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import NoSnapshot from '../NoSnapshot.vue';

defineProps<{ rows: readonly ScopeRow[] | null }>();
</script>

<template>
  <div class="ci-sources__scope">
    <Panel
      :title="SOURCES_SCOPE_TITLE"
      :subtitle="SOURCES_SCOPE_SUBTITLE"
    >
      <NoSnapshot v-if="!rows" />
      <template v-else>
        <dl class="ci-sources__facts">
          <template
            v-for="r in rows"
            :key="r.id"
          >
            <dt>{{ r.label }}</dt>
            <dd>
              <code v-if="r.mono">{{ r.value }}</code>
              <template v-else>
                {{ r.value }}
              </template>
            </dd>
          </template>
        </dl>
        <p class="ci-note">
          {{ SOURCES_SCOPE_EDIT }}
        </p>
      </template>
    </Panel>
  </div>
</template>
```

- [ ] **Step 4: `sources/ScanStatusPanel.vue`.**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { RunView } from '../../read-models/sources';
import {
  SOURCES_CANCEL_HINT, SOURCES_RUN_CANCELLED, SOURCES_RUN_CANCELLING, SOURCES_RUN_COMPLETE, SOURCES_RUN_FAILED, SOURCES_RUN_IDLE,
  SOURCES_RUN_RUNNING, SOURCES_STATUS_SUBTITLE, SOURCES_STATUS_TITLE,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Icon from '../../kit/Icon.vue';

const props = defineProps<{ run: RunView }>();

/** W3: the real run state, mirrored from the host; nothing here is simulated. */
const view = computed<{ icon: string; text: string; tone: 'muted' | 'warning' | 'success' }>(() => {
  const r = props.run;
  switch (r.kind) {
    case 'running': return { icon: 'loader', text: SOURCES_RUN_RUNNING(r.processed), tone: 'muted' };
    case 'cancelling': return { icon: 'loader', text: SOURCES_RUN_CANCELLING, tone: 'muted' };
    case 'cancelled': return { icon: 'circle-slash', text: SOURCES_RUN_CANCELLED, tone: 'warning' };
    case 'failed': return { icon: 'alert-triangle', text: SOURCES_RUN_FAILED(r.message), tone: 'warning' };
    case 'complete': return { icon: 'check', text: SOURCES_RUN_COMPLETE, tone: 'success' };
    default: return { icon: 'clock', text: SOURCES_RUN_IDLE, tone: 'muted' };
  }
});
const inFlight = computed(() => props.run.kind === 'running' || props.run.kind === 'cancelling');
</script>

<template>
  <div class="ci-sources__status">
    <Panel
      :title="SOURCES_STATUS_TITLE"
      :subtitle="SOURCES_STATUS_SUBTITLE"
    >
      <p
        class="ci-sources__run"
        :class="`ci-sources__run--${view.tone}`"
      >
        <Icon :name="view.icon" />
        <span>{{ view.text }}</span>
      </p>
      <p
        v-if="inFlight"
        class="ci-note"
      >
        {{ SOURCES_CANCEL_HINT }}
      </p>
    </Panel>
  </div>
</template>
```

- [ ] **Step 5: `sources/ProviderGrid.vue`.**

```vue
<script setup lang="ts">
import type { RouteId } from '../../../domain/route-ids';
import type { ProviderCard } from '../../read-models/sources';
import { ROUTE_META } from '../../routes';
import { SOURCES_PROVIDERS_TITLE, SOURCES_USED_BY } from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ providers: readonly ProviderCard[] }>();
const emit = defineEmits<{ open: [route: RouteId] }>();
</script>

<template>
  <section class="ci-providers">
    <h3 class="ci-providers__title">
      {{ SOURCES_PROVIDERS_TITLE }}
    </h3>
    <div class="ci-providers__grid">
      <article
        v-for="p in providers"
        :key="p.id"
        class="ci-provider"
        :class="`ci-provider--${p.id}`"
      >
        <div class="ci-provider__head">
          <span class="ci-provider__icon"><Icon :name="p.icon" /></span>
          <ProvenanceBadge
            v-if="p.state !== 'collected'"
            :state="p.state"
          />
        </div>
        <h4 class="ci-provider__name">
          {{ p.title }}
        </h4>
        <p class="ci-note">
          {{ p.source }}
        </p>
        <p class="ci-provider__text">
          {{ p.description }}
        </p>
        <div class="ci-provider__routes">
          <span class="ci-note">{{ SOURCES_USED_BY }}</span>
          <button
            v-for="r in p.routes"
            :key="r"
            type="button"
            class="ci-provider__route"
            @click="emit('open', r)"
          >
            {{ ROUTE_META[r].title }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
```

- [ ] **Step 6: `SourcesScreen.vue`.**

```vue
<script setup lang="ts">
import { computed, inject } from 'vue';
import type { RouteId } from '../../domain/route-ids';
import { buildSourcesModel } from '../read-models/sources';
import { useCityStore } from '../stores/city-store';
import { useRunStore } from '../stores/run-store';
import {
  SOURCES_CALLOUT, SOURCES_CALLOUT_TITLE, SOURCES_CHANGE, SOURCES_EYEBROW, SOURCES_PLANNED, SOURCES_PLANNED_TITLE,
  SOURCES_RESCAN, SOURCES_SUBTITLE, SOURCES_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Panel from '../kit/Panel.vue';
import Callout from '../kit/Callout.vue';
import Icon from '../kit/Icon.vue';
import ScopePanel from './sources/ScopePanel.vue';
import ScanStatusPanel from './sources/ScanStatusPanel.vue';
import ProviderGrid from './sources/ProviderGrid.vue';

const store = useCityStore();
const runStore = useRunStore();
// W2: the two host callbacks the UI already injects (NoSnapshot, NavColumn, AppToolbar);
// the host's own modals and consent chain do the work.
const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});
const onScanRequested = inject<() => void>('onScanRequested', () => {});

const model = computed(() => buildSourcesModel(store.snapshot, runStore.run));
const inFlight = computed(() => runStore.run.status === 'running' || runStore.run.status === 'cancelling');

/** W3 (A8, P14): scan states live on the city route, so go there before the host starts. */
function changeSource(): void {
  store.navigate('city');
  onSelectCodebase();
}
function rescan(): void {
  if (inFlight.value) return;
  store.navigate('city');
  onScanRequested();
}
function open(route: RouteId): void {
  store.navigate(route);
}
</script>

<template>
  <div class="ci-screen ci-screen--sources">
    <PageHeader
      :eyebrow="SOURCES_EYEBROW"
      :title="SOURCES_TITLE"
      :subtitle="SOURCES_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-sources__change"
          @click="changeSource"
        >
          <Icon name="folder" />
          {{ SOURCES_CHANGE }}
        </button>
        <button
          type="button"
          class="mod-cta ci-sources__rescan"
          :aria-disabled="inFlight ? 'true' : undefined"
          @click="rescan"
        >
          <Icon name="refresh-cw" />
          {{ SOURCES_RESCAN }}
        </button>
      </template>
    </PageHeader>
    <Callout :title="SOURCES_CALLOUT_TITLE">
      {{ SOURCES_CALLOUT }}
    </Callout>
    <div class="ci-screen__grid">
      <ScopePanel :rows="model.scope" />
      <ScanStatusPanel :run="model.run" />
    </div>
    <ProviderGrid
      :providers="model.providers"
      @open="open"
    />
    <Panel :title="SOURCES_PLANNED_TITLE">
      <p class="ci-note">
        {{ SOURCES_PLANNED }}
      </p>
    </Panel>
  </div>
</template>
```

  Data & scans announces nothing: its actions leave the screen, and the scan's own announcements happen on the city route. So it has no live region (conventions: "when the screen has outcomes").
- [ ] **Step 7: Wire the route.**
  - In `App.vue`, add `<SourcesScreen v-else-if="store.route === 'sources'" />`.
  - In `use-route-provenance.ts`, add `case 'sources': return false;` with the comment `// Part 4 W16: scope facts and provider states, not sample values.`.
- [ ] **Step 8: CSS** (`screens-configure.css`):

```css
/* Part 4 Task 12: Data & scans. */
:where(.codebase-inspector-root) .ci-sources__facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--ci-space-2) var(--ci-space-4); margin: 0 0 var(--ci-space-3); font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-sources__facts dt { color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-sources__facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
:where(.codebase-inspector-root) .ci-sources__run { display: flex; align-items: flex-start; gap: var(--ci-space-2); margin: 0; }
:where(.codebase-inspector-root) .ci-sources__run--warning { color: var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-sources__run--success .ci-icon { color: var(--ci-tone-success); }
:where(.codebase-inspector-root) .ci-providers { display: flex; flex-direction: column; gap: var(--ci-space-3); }
:where(.codebase-inspector-root) .ci-providers__title { margin: 0; }
:where(.codebase-inspector-root) .ci-providers__grid { display: grid; gap: var(--ci-space-4); grid-template-columns: repeat(auto-fill, minmax(16em, 1fr)); }
:where(.codebase-inspector-root) .ci-provider {
  display: flex; flex-direction: column; gap: var(--ci-space-2); padding: var(--ci-space-4);
  border: 1px solid var(--ci-border); border-radius: var(--ci-radius-card); background: var(--ci-panel);
}
:where(.codebase-inspector-root) .ci-provider__head { display: flex; justify-content: space-between; align-items: center; }
:where(.codebase-inspector-root) .ci-provider__icon { display: inline-flex; padding: var(--ci-space-2); border: 1px solid var(--ci-border); border-radius: var(--ci-radius-small); color: var(--ci-tone-accent); }
:where(.codebase-inspector-root) .ci-provider__name { margin: 0; }
:where(.codebase-inspector-root) .ci-provider__text { margin: 0; color: var(--ci-text-muted); font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-provider__routes { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ci-space-2); margin-top: auto; }
```

- [ ] **Step 9: Run and confirm they pass.** `npx vitest run tests/component/sources-screen.test.ts tests/component/shell-provenance.test.ts tests/unit/kit-css-fallbacks.test.ts tests/unit/css-class-scope.test.ts`, then the gate.
- [ ] **Step 10: Commit.** `feat(ui): Data & scans shows the real scope, run state and provider provenance; rescans through the host`

---

### Task 13: Settings screen, density, review-state export and clearing; placeholder removal (W5, W14, W17)

**Files:**
- Create: `src/ui/screens/SettingsScreen.vue`, `src/ui/screens/settings/SettingsSections.vue`, `src/ui/screens/settings/ClearReviewDialog.vue`
- Modify: `src/ui/App.vue` (route, density class, placeholder removal), `src/ui/shell/use-route-provenance.ts`, `src/ui/inspector-copy.ts` (delete `PLACEHOLDER_ARRIVES`), `src/ui/styles/screens-configure.css`, `src/ui/styles/shell.css`
- Delete: `src/ui/screens/PlaceholderScreen.vue`
- Test: `tests/component/settings-screen.test.ts` (new), `tests/component/workspace-shell.test.ts`, `tests/component/shell-provenance.test.ts`

**Interfaces:**
- Consumes:
  - `usePreferencesStore`, `DENSITIES`, `Density`, `reviewStateJson` (Task 9); `clearAll` (Task 6); `useReportStore().reset` (Task 8)
  - `useCsvExport`, `JSON_MIME` (Task 3); `PriorityFormulaDialog` (`screens/hotspots/PriorityFormulaDialog.vue`, emits `close`)
  - `Tabs` (`kit/Tabs.vue`, `v-model`, `tabs`, `label`); `HOTSPOT_THRESHOLD` (`read-models/overview.ts`)
- Produces:
  - `SettingsSections.vue`: props `{ tab: SettingsTab }`; emits `priority: []`, `clear: []`.
  - `ClearReviewDialog.vue`: emits `close: []`, `done: [message: string]`.
  - `type SettingsTab = 'appearance' | 'analysis' | 'accessibility' | 'privacy' | 'about'`, exported from `SettingsSections.vue` through a `<script lang="ts">` block, or from `settings/settings-tabs.ts` if the SFC export is awkward.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/settings-screen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import SettingsScreen from '../../src/ui/screens/SettingsScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { usePreferencesStore } from '../../src/ui/stores/preferences-store';
import { useReportStore } from '../../src/ui/stores/report-store';
import { useReviewStore } from '../../src/ui/stores/review-store';

const flush = async () => { await Promise.resolve(); await nextTick(); await nextTick(); };
const mountS = () => mount(SettingsScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
const tab = (w: ReturnType<typeof mountS>, id: string) => w.find(`[role="tab"][data-tab-id="${id}"]`).trigger('click');

describe('SettingsScreen (Part 4)', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('opens on Appearance: the theme follows Obsidian and density is a real preference', async () => {
    const w = mountS();
    expect(w.text()).toContain('Follows Obsidian');
    await w.find('.ci-settings__density').setValue('compact');
    expect(usePreferencesStore().density).toBe('compact');
    w.unmount();
  });

  it('Analysis explains the threshold, opens the priority formula and links to the current scope', async () => {
    const w = mountS();
    await tab(w, 'analysis');
    expect(w.text()).toContain('65');
    await w.find('.ci-settings__priority').trigger('click');
    expect(w.find('.ci-formula').exists()).toBe(true);
    await w.find('.ci-formula').trigger('keydown', { key: 'Escape' });
    await w.find('.ci-settings__scope').trigger('click');
    expect(useCityStore().route).toBe('sources');
    w.unmount();
  });

  it('Accessibility opens the file inventory in the city list view', async () => {
    const w = mountS();
    await tab(w, 'accessibility');
    await w.find('.ci-settings__inventory').trigger('click');
    expect(useCityStore().viewMode).toBe('list');
    expect(useCityStore().route).toBe('city');
    w.unmount();
  });

  it('exports the review state as JSON through the leaf document', async () => {
    await useReviewStore().addWorkItemForFile('repo\0file\0src/a.ts', 'A', new Date());
    const w = mountS();
    await w.find('.ci-settings__export').trigger('click');
    const [host, name, text, mime] = vi.mocked(downloadText).mock.calls[0]!;
    expect((host as HTMLElement).classList.contains('ci-screen--settings')).toBe(true);
    expect(name).toBe('codebase-inspector-review-state.json');
    expect(mime).toBe('application/json;charset=utf-8');
    expect(JSON.parse(text as string)).toMatchObject({ schema: 'codebase-inspector.review-state.v1', workItems: [{ target: { kind: 'file', path: 'src/a.ts' } }] });
    w.unmount();
  });

  it('clears the review state only after confirmation, and announces it', async () => {
    await useReviewStore().addWorkItemForFile('repo\0file\0src/a.ts', 'A', new Date());
    useReportStore().applyNote('keep?');
    const w = mountS();
    await tab(w, 'privacy');
    await w.find('.ci-settings__clear').trigger('click');
    expect(w.find('.ci-clear-dialog').text()).toContain('1 work items');
    await w.find('.ci-clear-dialog__cancel').trigger('click');
    expect(useReviewStore().workItems).toHaveLength(1);
    await w.find('.ci-settings__clear').trigger('click');
    await w.find('.ci-clear-dialog__confirm').trigger('click');
    await flush();
    expect(useReviewStore().workItems).toHaveLength(0);
    expect(useReportStore().note).toBe('');
    expect(w.find('.ci-clear-dialog').exists()).toBe(false);
    expect(w.find('.ci-settings__live').text()).toBe('Review state cleared.');
    w.unmount();
  });
});
```

  If `PriorityFormulaDialog`'s root class is not `.ci-formula`, use its real root class and report it.

  In `tests/component/workspace-shell.test.ts`:
  - Replace the test `'navigates to a placeholder screen and back, unmounting the city'`. Keep its steps, but assert `w.find('.ci-screen--workbench').exists()` instead of `'arrives in Part 4'`, and rename it `'navigates to the workbench and back, unmounting the city'`.
  - Add:

```ts
  it('applies the compact density preference to the shell (Part 4 W5)', async () => {
    const w = mountShell();
    expect(w.find('.ci-shell').classes()).not.toContain('ci-shell--compact');
    usePreferencesStore().setDensity('compact');
    await nextTick();
    expect(w.find('.ci-shell').classes()).toContain('ci-shell--compact');
    w.unmount();
  });
```

  (import `usePreferencesStore`). In `tests/component/shell-provenance.test.ts`, the `settings` absence check already exists and stays.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/settings-screen.test.ts tests/component/workspace-shell.test.ts`
- [ ] **Step 3: `settings/SettingsSections.vue`.**

```vue
<script lang="ts">
export type SettingsTab = 'appearance' | 'analysis' | 'accessibility' | 'privacy' | 'about';
</script>

<script setup lang="ts">
import { HOTSPOT_THRESHOLD } from '../../read-models/overview';
import { useCityStore } from '../../stores/city-store';
import { DENSITIES, usePreferencesStore, type Density } from '../../stores/preferences-store';
import { useUniqueId } from '../../unique-id';
import {
  SETTINGS_ABOUT_NEVER, SETTINGS_ABOUT_NEVER_TEXT, SETTINGS_ABOUT_READS, SETTINGS_ABOUT_READS_TEXT, SETTINGS_ABOUT_SAMPLE,
  SETTINGS_ABOUT_SAMPLE_TEXT, SETTINGS_ACCESS, SETTINGS_ACCESS_TEXT, SETTINGS_ACCESS_VALUE, SETTINGS_CLEAR, SETTINGS_CLEAR_OPEN,
  SETTINGS_CLEAR_TEXT, SETTINGS_DENSITY, SETTINGS_DENSITY_LABEL, SETTINGS_DENSITY_TEXT, SETTINGS_INVENTORY,
  SETTINGS_INVENTORY_OPEN, SETTINGS_INVENTORY_TEXT, SETTINGS_MOTION, SETTINGS_MOTION_TEXT, SETTINGS_NETWORK,
  SETTINGS_NETWORK_TEXT, SETTINGS_NETWORK_VALUE, SETTINGS_PRIORITY_HELP, SETTINGS_SCOPE, SETTINGS_SCOPE_TEXT,
  SETTINGS_SCOPE_VIEW, SETTINGS_SHORTCUT_LIST, SETTINGS_SHORTCUTS, SETTINGS_STORAGE, SETTINGS_STORAGE_TEXT, SETTINGS_THEME,
  SETTINGS_THEME_TEXT, SETTINGS_THEME_VALUE, SETTINGS_THRESHOLD, SETTINGS_THRESHOLD_TEXT,
} from '../../inspector-copy';

defineProps<{ tab: SettingsTab }>();
const emit = defineEmits<{ priority: []; clear: [] }>();
const store = useCityStore();
const preferences = usePreferencesStore();
const densityId = useUniqueId('ci-settings-density');

function onDensity(event: Event): void {
  preferences.setDensity((event.target as HTMLSelectElement).value as Density);
}
function openInventory(): void {
  store.setViewMode('list');
  store.navigate('city');
}
</script>

<template>
  <div class="ci-settings__rows">
    <template v-if="tab === 'appearance'">
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_THEME }}</h3><p class="ci-note">{{ SETTINGS_THEME_TEXT }}</p></div>
        <span class="ci-chip">{{ SETTINGS_THEME_VALUE }}</span>
      </div>
      <div class="ci-setting-row">
        <div><h3><label :for="densityId">{{ SETTINGS_DENSITY }}</label></h3><p class="ci-note">{{ SETTINGS_DENSITY_TEXT }}</p></div>
        <select
          :id="densityId"
          class="dropdown ci-settings__density"
          :value="preferences.density"
          @change="onDensity"
        >
          <option
            v-for="d in DENSITIES"
            :key="d"
            :value="d"
          >
            {{ SETTINGS_DENSITY_LABEL[d] }}
          </option>
        </select>
      </div>
    </template>
    <template v-else-if="tab === 'analysis'">
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_THRESHOLD }}</h3><p class="ci-note">{{ SETTINGS_THRESHOLD_TEXT(HOTSPOT_THRESHOLD) }}</p></div>
        <button
          type="button"
          class="ci-settings__priority"
          @click="emit('priority')"
        >
          {{ SETTINGS_PRIORITY_HELP }}
        </button>
      </div>
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_ACCESS }}</h3><p class="ci-note">{{ SETTINGS_ACCESS_TEXT }}</p></div>
        <span class="ci-chip ci-chip--success">{{ SETTINGS_ACCESS_VALUE }}</span>
      </div>
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_SCOPE }}</h3><p class="ci-note">{{ SETTINGS_SCOPE_TEXT }}</p></div>
        <button
          type="button"
          class="ci-settings__scope"
          @click="store.navigate('sources')"
        >
          {{ SETTINGS_SCOPE_VIEW }}
        </button>
      </div>
    </template>
    <template v-else-if="tab === 'accessibility'">
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_MOTION }}</h3><p class="ci-note">{{ SETTINGS_MOTION_TEXT }}</p></div>
      </div>
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_INVENTORY }}</h3><p class="ci-note">{{ SETTINGS_INVENTORY_TEXT }}</p></div>
        <button
          type="button"
          class="ci-settings__inventory"
          @click="openInventory"
        >
          {{ SETTINGS_INVENTORY_OPEN }}
        </button>
      </div>
      <div class="ci-setting-row ci-setting-row--stacked">
        <h3>{{ SETTINGS_SHORTCUTS }}</h3>
        <dl class="ci-settings__shortcuts">
          <template
            v-for="s in SETTINGS_SHORTCUT_LIST"
            :key="s.keys"
          >
            <dt><kbd>{{ s.keys }}</kbd></dt>
            <dd>{{ s.action }}</dd>
          </template>
        </dl>
      </div>
    </template>
    <template v-else-if="tab === 'privacy'">
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_NETWORK }}</h3><p class="ci-note">{{ SETTINGS_NETWORK_TEXT }}</p></div>
        <span class="ci-chip ci-chip--success">{{ SETTINGS_NETWORK_VALUE }}</span>
      </div>
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_STORAGE }}</h3><p class="ci-note">{{ SETTINGS_STORAGE_TEXT }}</p></div>
      </div>
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_CLEAR }}</h3><p class="ci-note">{{ SETTINGS_CLEAR_TEXT }}</p></div>
        <button
          type="button"
          class="mod-warning ci-settings__clear"
          @click="emit('clear')"
        >
          {{ SETTINGS_CLEAR_OPEN }}
        </button>
      </div>
    </template>
    <template v-else>
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_ABOUT_READS }}</h3><p class="ci-note">{{ SETTINGS_ABOUT_READS_TEXT }}</p></div>
      </div>
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_ABOUT_NEVER }}</h3><p class="ci-note">{{ SETTINGS_ABOUT_NEVER_TEXT }}</p></div>
      </div>
      <div class="ci-setting-row">
        <div><h3>{{ SETTINGS_ABOUT_SAMPLE }}</h3><p class="ci-note">{{ SETTINGS_ABOUT_SAMPLE_TEXT }}</p></div>
      </div>
    </template>
  </div>
</template>
```

  Expand the one-line `<div><h3>…</h3><p>…</p></div>` groups to the repo's multi-line template style if `eslint-plugin-vue` demands it (`vue/max-attributes-per-line`, `vue/singleline-html-element-content-newline`). Run `npx eslint --fix` on this file only, then review the diff. If the file passes 300 lines after formatting, split each tab's rows into `settings/{AppearanceRows,AnalysisRows,AccessibilityRows,PrivacyRows,AboutRows}.vue` with the same markup.
- [ ] **Step 4: `settings/ClearReviewDialog.vue`.**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useReportStore } from '../../stores/report-store';
import { useReviewStore } from '../../stores/review-store';
import {
  SETTINGS_CLEAR_CANCEL, SETTINGS_CLEAR_CONFIRM, SETTINGS_CLEAR_DIALOG_TEXT, SETTINGS_CLEAR_DIALOG_TITLE, SETTINGS_CLEAR_FAILED,
  SETTINGS_CLEARED,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';

const emit = defineEmits<{ close: []; done: [message: string] }>();
const review = useReviewStore();
const report = useReportStore();
const busy = ref(false);
const error = ref('');
const text = computed(() => SETTINGS_CLEAR_DIALOG_TEXT(review.workItems.length, review.dispositions.length, review.rules.length));

/** W14: everything goes through the port first (clearAll reloads from it); the report
 *  choices and note are reset with it. The dialog closes and the screen announces. */
async function confirm(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await review.clearAll();
    report.reset();
    emit('done', SETTINGS_CLEARED);
  } catch {
    error.value = SETTINGS_CLEAR_FAILED;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <CiDialog
    :label="SETTINGS_CLEAR_DIALOG_TITLE"
    @close="emit('close')"
  >
    <div class="ci-clear-dialog">
      <h3>{{ SETTINGS_CLEAR_DIALOG_TITLE }}</h3>
      <p>{{ text }}</p>
      <p
        v-if="error"
        class="ci-clear-dialog__error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="ci-clear-dialog__actions">
        <button
          type="button"
          class="ci-clear-dialog__cancel"
          @click="emit('close')"
        >
          {{ SETTINGS_CLEAR_CANCEL }}
        </button>
        <button
          type="button"
          class="mod-warning ci-clear-dialog__confirm"
          :aria-disabled="busy ? 'true' : undefined"
          @click="confirm"
        >
          {{ SETTINGS_CLEAR_CONFIRM }}
        </button>
      </div>
    </div>
  </CiDialog>
</template>
```

  Cancel comes first, so `CiDialog` focuses the safe choice on open.
- [ ] **Step 5: `SettingsScreen.vue`.**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { JSON_MIME, useCsvExport } from '../export/use-csv-export';
import { reviewStateJson } from '../read-models/review-state';
import { useReportStore } from '../stores/report-store';
import { useReviewStore } from '../stores/review-store';
import type { TabItem } from '../kit/tab-types';
import {
  SETTINGS_EXPORT, SETTINGS_EYEBROW, SETTINGS_JSON_FILENAME, SETTINGS_SUBTITLE, SETTINGS_TAB, SETTINGS_TABS_LABEL, SETTINGS_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Tabs from '../kit/Tabs.vue';
import Icon from '../kit/Icon.vue';
import PriorityFormulaDialog from './hotspots/PriorityFormulaDialog.vue';
import SettingsSections, { type SettingsTab } from './settings/SettingsSections.vue';
import ClearReviewDialog from './settings/ClearReviewDialog.vue';

const TABS: readonly TabItem[] = (['appearance', 'analysis', 'accessibility', 'privacy', 'about'] as const).map((id) => ({ id, label: SETTINGS_TAB[id] }));

const review = useReviewStore();
const report = useReportStore();
const root = ref<HTMLElement | null>(null);
const liveMessage = ref('');
const tab = ref<string>('appearance');
const showPriority = ref(false);
const showClear = ref(false);
const exportText = useCsvExport(root, liveMessage);

/** W14: JSON through the leaf's own document only; relative paths, never raw entity ids. */
function exportState(): void {
  exportText(SETTINGS_JSON_FILENAME, () => reviewStateJson({
    workItems: review.workItems, rules: review.rules, dispositions: review.dispositions,
    report: { sections: report.sections, note: report.note }, exportedAt: new Date(),
  }), JSON_MIME);
}
function cleared(message: string): void {
  showClear.value = false;
  liveMessage.value = message;
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--settings"
  >
    <PageHeader
      :eyebrow="SETTINGS_EYEBROW"
      :title="SETTINGS_TITLE"
      :subtitle="SETTINGS_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-settings__export"
          @click="exportState"
        >
          <Icon name="download" />
          {{ SETTINGS_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <p
      class="visually-hidden ci-settings__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <Tabs
      v-model="tab"
      :tabs="TABS"
      :label="SETTINGS_TABS_LABEL"
    >
      <SettingsSections
        :tab="tab as SettingsTab"
        @priority="showPriority = true"
        @clear="showClear = true"
      />
    </Tabs>
    <PriorityFormulaDialog
      v-if="showPriority"
      @close="showPriority = false"
    />
    <ClearReviewDialog
      v-if="showClear"
      @close="showClear = false"
      @done="cleared"
    />
  </div>
</template>
```

  The prototype puts the categories in a vertical list. This plan uses the kit `Tabs` (a roving-tabindex tablist that the harness `?tab=` can select). The difference is intended; list it in Task 14.
- [ ] **Step 6: Shell wiring and placeholder removal.** In `App.vue`:
  - Import `SettingsScreen` and `usePreferencesStore`.
  - Add `const preferences = usePreferencesStore();`.
  - Add `'ci-shell--compact': preferences.density === 'compact'` to the `.ci-shell` class object.
  - Replace the `<PlaceholderScreen v-else :route="store.route" />` branch with `<SettingsScreen v-else-if="store.route === 'settings'" />`, and delete the `PlaceholderScreen` import.

  Delete `src/ui/screens/PlaceholderScreen.vue`, and delete `PLACEHOLDER_ARRIVES` from `inspector-copy.ts` (confirm with grep that nothing else uses it). In `use-route-provenance.ts`, add `case 'settings': return false;` and update the header comment's "Placeholder routes show none" to "Workbench, Data & scans and Settings show none (Part 4 W16)".

  In `shell.css`:

```css
/* Part 4 W5: compact density tightens rows and card padding only; nothing is hidden. */
:where(.codebase-inspector-root) .ci-shell--compact .ci-table td { padding-top: var(--ci-space-1); padding-bottom: var(--ci-space-1); }
:where(.codebase-inspector-root) .ci-shell--compact .ci-metric-card { padding: var(--ci-space-3); }
:where(.codebase-inspector-root) .ci-shell--compact .ci-screen { gap: var(--ci-space-3); }
```

  Check `tests/unit/leaf-chrome.test.ts` still passes (it parses `shell.css`).
- [ ] **Step 7: CSS** (`screens-configure.css`):

```css
/* Part 4 Task 13: Settings. */
:where(.codebase-inspector-root) .ci-settings__rows { display: flex; flex-direction: column; }
:where(.codebase-inspector-root) .ci-setting-row {
  display: flex; align-items: center; justify-content: space-between; gap: var(--ci-space-4);
  padding: var(--ci-space-4) 0; border-bottom: 1px solid var(--ci-border);
}
:where(.codebase-inspector-root) .ci-setting-row:last-child { border-bottom: none; }
:where(.codebase-inspector-root) .ci-setting-row h3 { margin: 0 0 var(--ci-space-1); font-size: var(--font-ui-medium, 1em); }
:where(.codebase-inspector-root) .ci-setting-row--stacked { flex-direction: column; align-items: stretch; }
:where(.codebase-inspector-root) .ci-settings__shortcuts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--ci-space-2) var(--ci-space-4); margin: 0; }
:where(.codebase-inspector-root) .ci-settings__shortcuts dd { margin: 0; color: var(--ci-text-muted); }
@container (max-width: 560px) {
  :where(.codebase-inspector-root) .ci-setting-row { flex-direction: column; align-items: flex-start; }
}
:where(.codebase-inspector-root) .ci-clear-dialog { display: grid; gap: var(--ci-space-3); max-width: 32em; }
:where(.codebase-inspector-root) .ci-clear-dialog h3 { margin: 0; }
:where(.codebase-inspector-root) .ci-clear-dialog__error { margin: 0; color: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-clear-dialog__actions { display: flex; justify-content: flex-end; gap: var(--ci-space-2); }
```

- [ ] **Step 8: Run and confirm they pass.** `npx vitest run tests/component/settings-screen.test.ts tests/component/workspace-shell.test.ts tests/component/shell-provenance.test.ts tests/component/nav-column.test.ts tests/unit/kit-css-fallbacks.test.ts tests/unit/css-class-scope.test.ts tests/unit/leaf-chrome.test.ts`, then the gate. `grep -rn "PlaceholderScreen\|PLACEHOLDER_ARRIVES" src tests` finds nothing.
- [ ] **Step 9: Commit.** `feat(ui): Settings with density, policies, review-state export and clearing; every route is now built`

---

### Task 14: Harness captures, evidence-note counts, full verification

**Files:**
- Modify: `tests/harness/page.ts`, `tests/harness/mount.ts`, `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts` (if it pins the shot list), `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`, `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`
- Possibly modify: `src/ui/styles/screens-act.css`, `src/ui/styles/screens-configure.css` (visual fixes found in the comparison)

- [ ] **Step 1: `?items=demo` in the harness.**
  - In `tests/harness/mount.ts`:
    - add `items?: 'demo';` to `HarnessOptions`;
    - import `useReviewStore`;
    - in the non-city branch, before the tab click, add:

```ts
    if (options.items === 'demo') {
      // Part 4: the workbench and report shots need work items; three fixed ones on the
      // first three files, one per status column the prototype shows.
      const review = useReviewStore();
      const ids = (store.layout?.lots ?? []).slice(0, 3).map((l) => l.entityId);
      const at = new Date('2026-09-17T12:00:00Z');
      if (ids[0]) await review.addWorkItem({ kind: 'file', entityId: ids[0] }, 'refactor', 'Separate calculation from persistence', at, { priority: 'high', status: 'planned', checks: [true, false, false] });
      if (ids[1]) await review.addWorkItem({ kind: 'file', entityId: ids[1] }, 'tests', 'Add regression tests for selection changes', at, { status: 'in-progress', checks: [true, true, false] });
      if (ids[2]) await review.addWorkItem({ kind: 'file', entityId: ids[2] }, 'documentation', 'Document the persistence boundary', at, { priority: 'low', status: 'verified', checks: [true, true, true] });
      await nextTick();
    }
```

  - In `page.ts`:
    - add the header line `//   ?items=demo        seed three work items (workbench, report)`;
    - pass `...(params.get('items') === 'demo' ? { items: 'demo' as const } : {})`.
- [ ] **Step 2: New shots.** In `scripts/harness-shot.mjs`, after the Part 3 entries, add:

```js
  // WP-02 Part 4: compare against docs/concept/prototype/screenshots/{workbench,report,sources,settings}-{dark,light}.png
  // and workbench-narrow.png, settings-narrow.png.
  { id: 'wp02-workbench-dark', query: '?screen=s05&theme=dark&route=workbench&items=demo' },
  { id: 'wp02-workbench-light', query: '?screen=s05&theme=light&route=workbench&items=demo' },
  { id: 'wp02-workbench-narrow-dark', query: '?screen=s10&theme=dark&route=workbench&items=demo&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-report-dark', query: '?screen=s05&theme=dark&route=report&items=demo' },
  { id: 'wp02-report-light', query: '?screen=s05&theme=light&route=report&items=demo' },
  { id: 'wp02-report-narrow-dark', query: '?screen=s10&theme=dark&route=report&items=demo&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-sources-dark', query: '?screen=s05&theme=dark&route=sources' },
  { id: 'wp02-sources-light', query: '?screen=s05&theme=light&route=sources' },
  { id: 'wp02-sources-narrow-dark', query: '?screen=s10&theme=dark&route=sources&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-settings-dark', query: '?screen=s05&theme=dark&route=settings' },
  { id: 'wp02-settings-light', query: '?screen=s05&theme=light&route=settings' },
  { id: 'wp02-settings-narrow-dark', query: '?screen=s10&theme=dark&route=settings&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-settings-privacy-dark', query: '?screen=s05&theme=dark&route=settings&tab=privacy' },
```

  If `tests/build/harness-shot.test.ts` pins the shot list or count, update it and report it.
- [ ] **Step 3: Capture and compare.**
  - Run `npm run harness-shot`. The existing city shots must still show the drawn city.
  - Open each new PNG in `harness-shots/` next to its prototype counterpart in `docs/concept/prototype/screenshots/`.
  - Fix layout or spacing defects in the CSS files only.
  - **Expected, intended differences, not to be fixed:**
    - no Print button on the report (W6); an "Includes sample data" badge instead of "Demo report" (W7);
    - no drag and drop, no team avatars on cards (W8, W10);
    - Data & scans shows the real scope and run state, with no simulated stale/failed/empty/complete buttons, no "Run demo scan", no fallow JSON and no state import (W2, W14, W15);
    - Settings has horizontal tabs, not a vertical list; no theme switch (it follows Obsidian); no connections, contrast or threshold controls (W5);
    - sample labels everywhere, and the shell "Includes sample data" badge on the report;
    - the fixture's `dir-N` module names; Obsidian's own chrome.
  - List every difference you leave in your report.
  - Also check that no new screen makes the owner's contrast decision #4 (`docs/superpowers/notes/2026-09-21-wp01b-open-decisions.md`) worse, meaning no new failing text/background pair. Report what you find; **do not change the tokens**.
- [ ] **Step 4: Evidence-note counts.**
  - Run `npx vitest run tests/unit/gate-evidence.test.ts tests/unit/evidence-numbers.test.ts`. The failures name each stale value.
  - Update exactly those values in `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` and `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md` **with the Edit tool**, once. Commit c07587c is the pattern (`git show c07587c -- docs`). Change derived numbers only.
  - Update the sentence "Counts refreshed … after WP-02 Part 3" to say Part 4.
  - Re-run the two tests until they pass.
- [ ] **Step 5: Full verification.** Run `npm run verify`.
  - Expected: exit 0, except `tests/unit/install-script.test.ts`, which fails in a worktree without `.obsidian/` (environmental). Paste its failure verbatim in the report.
  - Anything else failing is a real failure: fix it, or stop and report it.
- [ ] **Step 6: Commit.** `test(harness): Part 4 captures with ?items=demo; refresh WP-01 evidence counts after WP-02 Part 4`

---

## Self-review notes

- **Spec coverage:**

  | Spec item | Task |
  |---|---|
  | W1 nothing new persists | 8, 9 (in-memory stores); every screen's copy |
  | W2, W3, W4 real callbacks, run state, no Vue wizard | 9, 12 |
  | W5 Settings vs Obsidian settings | 9, 13 |
  | W6 Markdown via downloadText | 3, 7, 8, 10, 11 |
  | W7 report content | 8, 11 |
  | W8, W9 work-item fields and editing | 6, 10 |
  | W10 board, list, filter | 7, 10 |
  | W11 create for the selection | 10 |
  | W12 inline delete confirmation | 10 |
  | W13 open-item badge | 6 |
  | W14 review-state export and clearing | 6, 9, 13 |
  | W15 provider cards | 9, 12 |
  | W16 provenance | 10–13 |
  | W17 placeholder removal | 13 |
  | §4 CSS split | 1 |
  | §4 shared classes | 2 |
  | §4 `useCsvExport` | 3 |
  | §4 MetricCard mark, dialog live regions | 4 |
  | §4 even ticks | 5 |
  | §4 deferred again | untouched; reported in 14 |
  | §5 testing | every task, plus 14 |

- **Line budgets:**
  - `review-store.ts` grows from 189 to about 250.
  - `App.vue` grows from 148 to about 160 (four branches and imports, the density class, minus the placeholder).
  - `inspector-copy.ts` changes by +4/−1.
  - The editor is about 280 lines; if it passes 300, the checklist moves out (Task 10 Step 5).
  - Each screen is estimated under 200.
  - `city-view.ts`, `CityWorkspace.vue` and `city-view-store-wiring.test.ts` are untouched.
- **Type names used across tasks:**
  - `WorkPriority`, `WorkChecks`, `WorkItemPatch`, `WorkItemInit`, `NO_CHECKS`, `workItemProblem`
  - `TargetLabel`, `WorkRow`, `WorkColumn`, `WorkbenchModel`, `WorkbenchCard`
  - `ReportSection`, `ReportModel`, `ReportMetric`, `ReportRule`
  - `RunView`, `ScopeRow`, `ProviderCard`, `SourcesModel`
  - `Density`, `SettingsTab`, `NiceScale`
- **Task order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14. Dependencies:
  - Tasks 10–13 need 3 (export), 4 (dialog) and 6–9 (models).
  - Task 11 needs 7 (plan rows).
  - Task 13 needs 6 (`clearAll`) and 8 (`reset`).
  - Task 14 needs 6 (`WorkItemInit.status/checks`).
