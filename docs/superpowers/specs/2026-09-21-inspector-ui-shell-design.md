---
project: codebase-inspector
title: WP-02 — Inspector UI from the full prototype, Part 1: shell and foundation (design)
status: approved
date: 2026-09-21
branch: claude/inspector-prototype-ui-18caac (stacked on feat/wp-01-codebase-city, PR #1)
baseline: c91a458
---

# WP-02 design — Inspector UI, Part 1: shell and foundation

This document records the decisions agreed in brainstorming on 2026-09-21 for bringing
the full UI prototype (`docs/concept/prototype/`) into the plugin. It covers the overall
architecture of the UI-first phase in full, and **Part 1** (shell, foundation, Overview,
City re-framing) in implementable detail. Parts 2–4 each get their own short spec, plan
and PR when reached.

The prototype's own `docs/IMPLEMENTATION-HANDOFF.md` governs where this document is
silent: preserve the Three.js city, reconcile with the existing model instead of adding a
parallel one, never show absent evidence as zero, never execute source changes.

## 1. Agreed decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Obsidian hosting | **One leaf** ("Codebase Inspector") with its own internal navigation column routing between screens. |
| D2 | Branching | **Stacked PRs.** PR #1 stays as is. Each Part is its own PR based on the previous branch, retargeted to `main` as its base merges. |
| D3 | Data during the UI phase | **Real data where it exists** (inventory, LOC, districts, snapshots) **plus a typed sample-signal provider** for everything else. Sample values are visibly labelled; absent values render as unknown. |
| D4 | Styling | **Semantic `--ci-*` token layer mapped onto Obsidian CSS variables.** Only data-viz scales (risk, district hues) carry their own light/dark values. No hard-coded prototype palette. |
| D5 | Interactivity | **Fully interactive, in-memory.** Every interaction works through Pinia stores backed by persistence ports; Part 1–4 ship in-memory implementations only. |
| D6 | Build strategy | **Foundation first, proven on one real screen (Overview).** Parts 2–4 fan out screen by screen. |
| D7 | Routing | A small **route store**, not `vue-router`. The current route persists in the leaf's view state. |
| D8 | Charts / icons | Hand-rolled **SVG** charts (no chart library; bundle footprint). Icons through Obsidian's `setIcon` (Lucide, the prototype's icon set). |

## 2. Roadmap

| Part | Content | Branch base |
|---|---|---|
| 1 | Shell, tokens, shared kit, read models, sample provider, stores/ports, command palette, snapshot selector; **Overview**; City re-framed inside the shell | PR #1 head |
| 2 | Architecture, Hotspots, File detail | Part 1 |
| 3 | Code quality, Test confidence, Dependencies, Security, Evolution, Ownership | Part 2 |
| 4 | Refactor workbench, Audit report, Data & scans, Settings, source wizard and remaining dialogs | Part 3 |
| later | Real providers replacing sample signals; persistence adapters (plugin data, Markdown work items, vault exports) | — |

## 3. Architecture

### 3.1 Layers

Domain, application and visualization layers are unchanged. New code lives under `src/ui/`.

```
host/city-view.ts ──mounts──▶ ui/App.vue → WorkspaceShell
                                ├─ NavColumn (Explore / Audit / Act / Configure)
                                ├─ TopBar: Breadcrumb · CommandPalette trigger · SnapshotSelector
                                └─ RouteOutlet → ui/screens/<Route>Screen.vue

ui/read-models/   pure builders → UI-shaped types (FileSummary, OverviewModel, …)
  inputs:  domain CodebaseSnapshot (real)  +  ui/fixtures/SampleSignalProvider
ui/stores/        route · city (existing, generalized selection) · review · preferences
ui/stores/ports/  ReviewRepository (in-memory now; plugin data / Markdown later)
ui/components/    shared kit (§4.2) + existing city components
ui/styles/        tokens.css · shell.css (split out of styles.css)
```

### 3.2 Rules

1. **Screens consume read models only.** No screen imports the domain snapshot or
   fixtures directly. Replacing a sample signal with a real provider changes only the
   read-model composition.
2. **One evidence value type.** Every displayed signal is a `MetricValue`:
   ```ts
   type EvidenceState = 'collected' | 'sample' | 'unknown' | 'stale' | 'partial' | 'failed' | 'excluded';
   interface MetricValue<T = number> {
     state: EvidenceState;
     value?: T;                    // absent unless state is collected | sample | stale | partial
     provenance: { source: string; detail?: string };  // e.g. { source: 'inventory' } | { source: 'sample' }
   }
   ```
   Components render the state: `sample` → badge, `unknown` → "—" with a reason label
   (never 0), `stale` / `partial` / `failed` → warning chip.
3. **One identity.** `EntityId` (`domain/entity-id.ts`) keys every row, card and building.
   Selection is held once in the existing `city-store` (`selectedEntityId`) and is visible
   across screens. The city-store's invariants (selection never moves the camera; search
   dims without re-layout) are unchanged.
4. **The city is reused, not rebuilt.** The Code city screen composes the existing
   `CityViewport`, `FileInspector`, camera controls and inventory. The renderer is created
   when the city route mounts and disposed when it unmounts, through the existing
   `CityViewport` lifecycle.
5. **Tokens.** `tokens.css` declares every `--ci-*` token as a mapping onto Obsidian
   variables (`--background-primary`, `--background-secondary`, `--interactive-accent`,
   `--text-muted`, …), extending the existing tokens read by `host/theme-bridge.ts`.
   Data-viz scales get explicit values under `.theme-dark` / `.theme-light`.
   Component styles are scoped per component.

## 4. Part 1 — detailed scope

### 4.1 Shell

- **`WorkspaceShell.vue`**: a CSS grid of nav column, top bar and content.
- **`NavColumn.vue`**: the profile switcher (the bound codebase profile, in place of the
  prototype's "sample-workspace"), grouped route list with count badges, Data & scans and
  Settings pinned at the bottom. Every one of the 15 routes is listed. Routes not yet built
  render **`PlaceholderScreen.vue`**: the route title, its goal from `screen-map.json`, and
  "Arrives in Part N".
- **`TopBar.vue`**: breadcrumb (Workspace / profile / screen), command-palette trigger with
  shortcut hint, `SnapshotSelector` (the existing snapshot list: Latest, baseline).
- **Dropped from the prototype:** ribbon, tab bar, status-bar footer and the theme toggle
  (Obsidian provides all of these). The prototype's "all measurements are synthetic" note
  becomes a shell-level `ProvenanceBadge` that appears whenever the current screen shows
  any `sample` value.
- **Narrow panes:** below `DRAWER_MAX_INLINE_SIZE` (820 px content box) the nav column
  collapses into a drawer opened from a menu button in the top bar, reusing
  `drawer-focus.ts` and `escape-intent.ts`. The existing 320 px list-first floor for the
  city is unchanged.

### 4.2 Shared kit

| Component | Responsibility |
|---|---|
| `PageHeader` | eyebrow (`AREA / SCREEN`), title, subtitle, action slot |
| `Panel` | titled card with optional header action and footnote |
| `MetricCard` | icon, label, `MetricValue`, unit, caption, optional `Sparkline` |
| `EvidenceTable` | column defs, sortable headers, file-identity cells (name + path), keyboard-navigable rows, row activation selects the entity |
| `ProvenanceBadge` | renders an `EvidenceState` + provenance as a chip |
| `Callout` | info / warning banner with optional badge |
| `Dialog` | modal with focus trap, focus restore, Escape through `escape-intent` |
| `CommandPalette` | fuzzy search over routes, files (by path) and commands; opens with Ctrl/Cmd+K while focus is in the leaf and through an Obsidian command |
| `Sparkline`, `LineChart` | SVG; tokens for colours; accessible `<title>`/`<desc>` and a data table fallback |
| `Icon` | wrapper over Obsidian `setIcon` |

Existing `StatusBanner`, `EmptyState`, `AnnouncementRegion` are reused unchanged.

### 4.3 Screens

**Overview (`OverviewScreen.vue`)**, following `screenshots/overview-*.png`:
verdict `Callout`; four `MetricCard`s (open quality findings, branch coverage,
architecture exceptions, change hotspots); "Signals over time" `LineChart` (two series,
different units, stated in the footnote); "Start investigating" list of three
investigation paths; "Where change meets complexity" `EvidenceTable` (file, complexity,
commits/90d, priority); "Evidence coverage" panel listing each signal family and its
`EvidenceState`. There is **no composite health score**. Actions pointing at unbuilt
routes navigate to their placeholders.

**Code city (`CityScreen.vue`)**: `PageHeader` ("Code city", actions: Compare snapshots,
View inventory) around the existing city composition, plus three summary cards below
(change hotspots, architectural cycles, potentially unused exports) built from read
models. The colour/height lens selectors remain as they are today.

### 4.4 Read models and sample signals

- **`SampleSignalProvider`** (`ui/fixtures/`): for each real file entity, deterministic
  sample values seeded from its `EntityId` (complexity, commits/90d, branch coverage,
  direct dependents, findings), plus sample trend series, sample investigations and sample
  evidence-coverage rows. Every value it returns has `state: 'sample'`. Signals no
  provider covers (mutation, runtime) are returned as `unknown`.
- **Builders** (`ui/read-models/`): pure functions such as
  `buildFileSummaries(snapshot, signals)`, `buildOverviewModel(snapshot, signals)`,
  `buildCitySummary(snapshot, signals)`. Memoized per snapshot id. Real inventory values
  (LOC, path, district) are `state: 'collected'` with `provenance.source = 'inventory'`.
- The prototype's priority heuristic is used for sample priority and is labelled as a
  sample heuristic, per the handoff.

### 4.5 Stores and ports

- **`route-store`**: `current: RouteId`, `navigate(id)`, history for back navigation within
  the leaf. `RouteId` is a closed union of the 15 routes.
- **`city-store`** (existing): unchanged apart from being the single cross-screen selection
  owner.
- **`preferences-store`**: nav collapsed state and default route. In-memory for Part 1.
- **`review-store`** over the `ReviewRepository` port (`list`, `save`, `remove` for work
  items, dispositions and rules), with `InMemoryReviewRepository`. In Part 1 it backs only
  a new "Add to refactor plan" action added to `FileInspector` (creates a work item for the
  selected file) and the Refactor workbench nav badge that counts work items.

### 4.6 View state

The leaf's persisted view state gains `route: RouteId`. `decodeCityViewState` (or its
successor) validates it; an unknown or missing route decodes to `overview`. The existing
camera bookmark and city fields are unchanged.

## 5. Data flow

```
scan → CodebaseSnapshot ─┐
SampleSignalProvider ────┴─▶ read-model builders (pure, memoized) ─▶ screens (computed)
screen action ─▶ store ─▶ port (in-memory)
select(entityId) from any screen ─▶ city-store ─▶ FileInspector · city highlight · table row
```

Switching snapshots rebuilds read models; the selection is kept if the `EntityId` exists
in the new snapshot and cleared otherwise.

## 6. States

- **Leaf level:** the existing `view-surface` states (unbound, scanning, failed, empty,
  stale, …) take precedence. The shell stays rendered and navigable; the content area
  shows `StatusBanner` / `EmptyState`.
- **Signal level:** per `MetricValue.state` (§3.2).
- **Route level:** unknown persisted route → Overview.

## 7. Testing

- **Unit:** read-model builders; `SampleSignalProvider` (deterministic for a given
  `EntityId`; never emits a value for an `unknown` signal); route, review and preferences
  stores; view-state route decoding.
- **Component (Vitest + Vue Test Utils):** nav keyboard operation and collapse;
  `CommandPalette` focus trap and Escape order; `MetricCard` for every `EvidenceState`;
  `EvidenceTable` sorting and row activation; placeholder routing.
- **Harness:** extend `harness-shot` to capture Overview and City in dark and light and at
  narrow width, for side-by-side review against `docs/concept/prototype/screenshots/`.
- **Regression:** existing city acceptance tests stay green (selection never moves the
  camera; renderer disposed on route leave and leaf close). `npm run verify` exits 0.

## 8. Out of scope for Part 1

All screens other than Overview and City (placeholders only); source wizard; dialogs other
than the command palette; any persistence beyond memory; any real provider for complexity,
churn, coverage, findings, dependencies, security, history or ownership.

## 9. Amendments from planning (2026-09-21)

Found while writing the Part 1 plan against the actual code. These override the sections
above where they conflict.

- **A1 — Default route is `city`, not `overview`** (§4.6, §6). 16 existing test files mount
  `App.vue` and expect the city; the prototype also opens on the city; a fresh leaf keeps
  WP-01's behaviour. An unknown persisted route degrades to "no route" (→ `city`) without
  discarding the rest of the view state.
- **A2 — The route lives in the leaf's existing `city-view` Pinia store** (§4.5), not a
  separate `route-store`, and there is no in-leaf history yet. `src/host/city-view.ts` is at
  399/400 lines; routing through the store that `pickUiState`/`seedStoreFromState` already
  sync persists the route with zero lines added there. `preferences-store` is deferred to
  Part 4 (Settings) — nothing in Part 1 needs it.
- **A3 — App.vue becomes the shell; today's App content moves unchanged to
  `screens/CityWorkspace.vue`** (§3.1). App is at 383/400 lines, so the city composition is
  moved, not extended. `CityScreen.vue` wraps it with the page header and summary cards.
- **A4 — SnapshotSelector lists only the snapshot on screen** (§4.1). There is no snapshot
  history in the store yet; the control exists so layout and focus order are final. "Compare
  snapshots" is omitted from the City header until history exists.
- **A5 — Command palette opens with Ctrl/Cmd+K inside the leaf only** (§4.2). The Obsidian
  command is deferred (it needs a `city-view.ts` hook, which has no line budget left).
- **A6 — Styles are plain CSS files** (`src/ui/styles/{kit,shell,screens}.css`, imported from
  `main.ts`), not Vue-scoped styles (§3.2 rule 5). The codebase uses no SFC `<style>` blocks,
  and `cssCodeSplit: false` merges everything into the single `styles.css` the bundle
  assertion requires. The existing `styles.css` is untouched (layout-budget and stage-height
  tests parse it).
- **A7 — The nav column is inline only when the leaf is ≥ 820 px, decided in JS**; the shell
  content area is its own size container, and `cityInlineSize()` subtracts an inline nav so
  the city's JS thresholds match the container queries evaluated on the content area.
- **A8 — Non-city routes handle "no snapshot" themselves** (§6). Overview shows its own
  "select a codebase" state; the full `view-surface` chain (scanning, failed, partial…) stays
  on the city route, unchanged.
- **A9 — New strings live in `src/ui/inspector-copy.ts`**, not `copy.ts` (bound to the WP-01
  microcopy catalogue by a contract test).
- **A10 — The review port holds work items only in Part 1**; dispositions and rules join it
  in Parts 3–4.
