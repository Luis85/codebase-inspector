# Implementation handoff

## Preserve existing decisions

The intended product remains **codebase-inspector**, an Obsidian desktop-only plugin with a native workspace view. Sources may be the vault, a directory inside the vault, or an explicitly selected external directory. Scanning is read-only. Import a supported analysis report or explicitly run an already-installed fallow executable; never auto-install it or start scanning without user initiation.

The production code city remains **Three.js**. This HTML's projected Canvas renderer is a replaceable UI-review fixture, not a proposal to change the production stack. No existing codebase was fetched or modified for this delivery.

## Reconcile before adopting

Inspect the current plugin, city view, settings, entity identities, renderer lifecycle, report adapters, and existing persistence model before introducing any of the prototype's names or structures. Reuse implemented components and consolidate contracts. Do not introduce a parallel product model merely because this artifact uses convenient fixture types.

The prototype uses vanilla JavaScript to make a single HTML deliverable, not to prescribe application architecture. Map its view boundaries into the project's established TypeScript/Vue/Pinia/Obsidian structure as appropriate.

## Workspace composition

Use one workspace shell and a shared selection/snapshot store. Separate project/source identity, analysis snapshot, view filter state, and review decisions. A selected file should remain recognizable across city, quality, hotspots, coverage, and the refactor plan.

Suggested component boundaries are WorkspaceShell, PrimaryNavigation, SnapshotSelector, CommandPalette, PageHeader, MetricCard, EvidenceTable, FilterToolbar, ProviderBadge, FileInspector, FileDetail, ArchitectureMap, DependencyMatrix, EvidenceDialog, WorkItemEditor, ReportComposer, SourceWizard, and ScanStatus.

Global app state owns source/snapshot/selection/preferences/review decisions. View state owns query, sort, expanded groups, active tab, and chart lens. Rendering engines own geometry, buffers, camera, hover, and resource disposal. They should not own audit decisions or source access.

## City adapter

The shell should pass normalized file summaries, selected identity, filtered identities, color/height lens, theme, and reduced-motion preferences to a renderer adapter. The adapter emits selection, hover, and camera changes. Explicit focus is a separate command.

**Required invariants:** selection never moves the camera; search dims without repacking the layout; metric changes preserve file identity and camera; switching snapshots keeps stable spatial placement where possible; missing metrics remain unknown; selecting a city connection can reveal provenance when a real graph edge exists.

The inventory is not a fallback error page. It is a first-class, keyboard-accessible representation of the same dataset. Keep it available with or without graphics acceleration.

Dispose WebGL resources, subscriptions, listeners, and observers when an Obsidian leaf closes. Pause rendering when the leaf is hidden. The HTML renderer is event-driven; retain the production renderer's established lifecycle and performance strategy.

## Evidence contract

An analysis snapshot needs a source identifier, source scope, source revision, provider/version, collection time, configuration/exclusions digest, schema version, and evidence kind. Provider-specific raw evidence should be retained or referenced behind normalized facts, not discarded.

Do not assign values of zero to absent coverage, mutation results, vulnerabilities, runtime reachability, or contributor history. Distinguish collected, missing, unsupported, partial, stale, failed, and intentionally excluded states.

Stable file identities should be independent of absolute machine-specific paths. Use source-relative canonical paths initially and reconcile rename detection with the existing identity model. Store display path separately from identity.

A graph edge must state what it means: source import, symbol reference, runtime call, co-change relationship, or a modeled intended connection. The prototype's city arcs are explicitly illustrative. Production must not silently mix these edge types.

## Proposed integration order

### 0. Reconcile and bind the existing city

Inventory implemented components and models. Introduce a thin renderer boundary only if missing. Adapt existing Three.js selection to the shared inspector. Verify disposal, theme handling, and fixed camera behavior.

### 1. Establish the reusable review shell

Implement navigation, snapshot selection, command search, accessible dialogs, shared file inspection, table filters, theme tokens, and narrow Obsidian-pane behavior. A narrow pane does not imply mobile plugin support.

### 2. Connect source configuration and versioned evidence

Implement vault/vault-directory/external-directory selection with explicit authorization and read-only access. Add a strict provider adapter. Import known report schemas first; add explicit installed-tool execution separately. Preserve provenance and surface stale/partial/errors.

### 3. Deliver evidence-rich audit views incrementally

Bind real inventory and static findings to Overview, Quality, and File detail. Then add real import edges and boundary rules to Architecture. Add Hotspots only when correctly scoped Git and complexity data exist. Add Test confidence only when coverage is mapped to compatible source revisions.

Do not claim that all fields in this prototype are provided by fallow. Verify capabilities and versions at integration time. Git history, test reports, dependency metadata, and runtime signals may require independent providers.

### 4. Add review decisions and exports

Store finding dispositions independently from generated results, keyed by a durable finding fingerprint and relevant scope. Require dismissal rationale. Persist refactor tasks in the existing Obsidian/Markdown model; never imply that moving a task executes a source change. Include raw evidence references in exported reports.

### 5. Extend supply-chain and evolution views

Add real package inventories, advisory feeds, licensing context, snapshot deltas, and change coupling only after provider scope and semantics are defined. Treat individual authorship data as sensitive. Prefer module stewardship and knowledge-sharing prompts over individual rankings.

## Prototype-specific assumptions to replace

The 144-file/6-module fixture, sample file contents, complexity cutoffs, hotspot weights, 90-day commit values, synthetic branch coverage, package inventory, team labels, and intended rules are all examples. They are not inferred from the user's repository and should not become production defaults without review.

The priority score is a transparent sample heuristic:

`min(100, round(100 × (0.42 × complexity/48 + 0.35 × commits90d/44 + 0.23 × (1 − covered/total))))`.

It is not a defect probability, a standard maintainability index, an industry benchmark, or a team-performance score. Production should retain raw metrics, document model assumptions, and define behavior for missing inputs.

## Acceptance gates

A production slice should provide traceable evidence, preserve existing city interactions, use host theme variables, support keyboard operation, distinguish unknown data from passing results, avoid unsolicited process execution, and remain read-only against the analyzed source. Integration tests should cover source selection, provider version mismatch, changed revision, partial reports, rule evaluation, file rename, source removal, leaf disposal, and state persistence.

The prototype test results validate UI behavior only. They do not validate any of those production integrations.
