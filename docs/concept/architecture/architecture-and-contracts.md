# Architecture and contracts

## 1. Distribution and host boundary

Ship a single Obsidian plugin with ID `codebase-inspector`, display name `Codebase Inspector`, and initially `isDesktopOnly: true`. Build `main.js`, `manifest.json`, and `styles.css`. Choose the actual minimum supported Obsidian version after inspecting the APIs used and testing that version, not by copying an old example. Maintain `versions.json` for releases when appropriate.

`main.js` must provide the plugin class in Obsidian's expected module format and bundle non-host runtime dependencies [S1]. Use a Vue-capable production bundler configuration, for example Vite's library build with verified CommonJS output. Externalize `obsidian` and Node built-ins (and `electron` only if actually used); bundle Vue, Pinia, Three.js, and required addons. No dynamic dependency download, CDN, or dev-server requirement. Do not assume a browser Vite application is a loadable Obsidian plugin.

Keep extra JS chunks and worker assets out of WP-01 unless their installation and loading are explicitly solved and tested. Chunk long work cooperatively first; a packaged worker is an optimization when profiling justifies it.

## 2. Proposed source structure

```text
codebase-inspector/
  manifest.json
  versions.json
  package.json
  vite.config.ts
  src/
    main.ts                         # composition root only
    host/obsidian/
      CodebaseCityView.ts
      InspectorSettingTab.ts
      SourceSelectorModal.ts
      command-registration.ts
      ThemeBridge.ts
      WorkspaceStateAdapter.ts
      VaultNotesAdapter.ts          # WP-04
    application/
      InspectionService.ts
      ProfileService.ts
      ScanCoordinator.ts
      ports/
    domain/
      model/
      metrics/
      validation/
      queries/
    adapters/
      filesystem/
      persistence/
      fallow/                       # WP-02
      reports/
    visualization/
      layout/
      three/
        CityRenderer.ts
        BuildingBatch.ts
        PickingController.ts
        CameraController.ts
    ui/
      CodebaseCityApp.vue
      components/
      stores/
      styles/
  tests/
    unit/
    contracts/
    integration/
    host/
    fixtures/
    benchmarks/
  docs/
```

The core model has no imports from Obsidian, Vue, Three.js, Node, or fallow. The renderer consumes normalized visual data and emits selections; it cannot read files, execute processes, or write notes. The UI uses application services, not raw filesystem calls. Avoid an event bus or plugin registry unless a concrete need appears.

## 3. Native view and ownership

Register a custom `ItemView` with a stable proposed type such as `codebase-inspector-city`. The ribbon and open command reveal an existing appropriate leaf or create a normal workspace tab. Obsidian's view factory may run more than once; do not keep one global mutable view reference [S2].

Each leaf owns its Vue app, per-view Pinia state, renderer, DOM, observers, and subscriptions. The plugin owns profile metadata and scan coordination. Scans may be deduplicated by profile; do not give every leaf an independent uncontrolled background scan. Closing a leaf cancels/relinquishes its view work. Jobs without remaining consumers should stop unless an explicit watch session owns them.

Plugin enable registers capabilities and loads small preferences; it does not scan or execute analyzers automatically. Workspace restoration can restore a profile ID, selection, and camera, but cannot grant filesystem or executable permissions.

View close and plugin unload must release Vue apps, Three.js resources, controls, render callbacks, timers, subscriptions, observers, and watchers. The scan coordinator initiates process cancellation and rejects late results after shutdown. Do not depend on an asynchronous plugin unload hook being awaited by Obsidian. Ensure cleanup is idempotent across close/unload races.

For a hidden/zero-size leaf, pause rendering. On visible resize, update viewport, camera, and pixel ratio. Pop-out windows have different documents, windows, and constructors; use the view element's owning document/window and the supported migration hook when reinitializing a canvas [S6]. Overlays and Vue teleport targets must stay in that same document.

## 4. Source roots and filesystem completeness

Support a vault root, a vault-relative directory, and an explicitly selected external directory. Use a tested root resolver behind a port. For desktop vault root resolution, use the supported filesystem adapter API after verifying adapter type; do not assume every adapter has a filesystem path.

**Do not use `vault.getMarkdownFiles()` as a source inventory.** Even the broader Vault API addresses files visible to Obsidian; hidden folders require adapter access [S4]. Code projects need a controlled filesystem inventory independent of which extensions the host indexes. The same read-only collector can handle authorized vault-based and external roots.

Use Vault APIs for note creation and updates; avoid raw filesystem writes to indexed notes. Never assume that a `.ts` file can be opened as a Markdown editor. Initial source navigation is path copying and later a read-only preview; a supported vault file may open through the workspace, while external IDE opening is an explicit adapter/action.

Root rules: canonicalize the approved root; preserve case and valid filename characters; use native filesystem path operations for local resolution; normalize only portable snapshot separators. Validate containment structurally, not with an ambiguous string prefix. Reject parent traversal and URI-like paths in imported local references. Skip symlinks/junctions in WP-01, with a visible explanation. Do not pretend these checks sandbox a malicious executable or eliminate all filesystem race conditions.

Exclude `.git`, dependencies, build outputs, configured secrets, the active vault configuration directory (which may not be named `.obsidian`), plugin caches, and generated report/note destinations by default. Honor documented ignore rules; do not reject every dot-directory because useful code/config may live there. Record pruned directories rather than inventing a count of files never visited.

Use bounded asynchronous reads, cancellation, file-size/byte budgets, strict text-decoding policy, and changed-during-read detection. For a running editor/vault, report snapshot consistency as best-effort unless an immutable revision is available. A filesystem snapshot cannot see unsaved editor buffers as committed disk content.

## 5. Data contracts

Proposed minimal host-neutral model (not fallow's raw JSON schema):

```ts
type EntityId = string;
type RunId = string;

type Observation =
  | { status: 'measured' | 'derived' | 'partial'; value: number; reason?: string }
  | { status: 'unavailable'; value: null; reason: string };

interface CodeEntity {
  id: EntityId;
  kind: 'repository' | 'directory' | 'file' | 'external-package';
  label: string;
  parentId?: EntityId;
  relativePath?: string;
  contentHash?: string; // revision, not identity
}

interface Measurement {
  entityId: EntityId;
  metricId: string;
  definitionVersion: string;
  unit: string;
  observation: Observation;
  runId: RunId;
}

interface ProviderRun {
  id: RunId;
  provider: string;
  providerVersion: string;
  adapterVersion: string;
  status: 'complete' | 'partial' | 'failed' | 'not-run';
  origin: 'collected' | 'imported';
  sourceMatch: 'verified' | 'unverified' | 'stale';
  scopeId: string;
  capturedAt: string;
  warnings: string[];
}

interface AnalysisScope {
  id: string;
  digest: string;
  includedPatterns: string[];
  excludedPatterns: string[];
  fileSetDigest?: string;
  productionMode: boolean | null;
  thresholded: boolean;
  truncated: boolean;
}

interface CodebaseSnapshot {
  schemaVersion: 'codebase-inspector/snapshot-v1';
  id: string;
  profileId: string;
  capturedAt: string;
  repository: {
    id: string;
    label: string;
    revision?: { commit?: string; dirty: boolean | null; treeDigest?: string };
  };
  inventory: {
    includedFileCount: number;
    prunedDirectoryCount: number;
    warnings: string[];
  };
  entities: CodeEntity[];
  measurements: Measurement[];
  runs: ProviderRun[];
  scopes: AnalysisScope[];
  // WP-02/03 extend this with versioned findings and relations.
}
```

Validate at runtime: payload limits, supported versions, finite metrics, reference integrity, duplicate IDs, containment tree cycles, line ranges, and path safety. A TypeScript cast is not validation. Relationship cycles are allowed; parent/child containment cycles are not.

Identity = assigned repository ID + entity kind + root-relative path, with a documented stable encoding/hash. A content hash changes on edit; the file ID must not. Renames need explicit correspondence in WP-05. Do not embed absolute machine paths, source bodies, process credentials, or executable paths in portable snapshots.

A provider run can complete with findings. Completion status and policy verdict are different fields. Unknown, excluded, thresholded, stale, and failed evidence must not be transformed into numeric zero. Keep source text out of a snapshot unless explicitly requested in an export.

### Host-specific profile binding

```ts
type SourceReference =
  | { kind: 'vault'; relativeRoot: string }
  | { kind: 'external'; bindingId: string };

interface CodebaseProfile {
  id: string;
  repositoryId: string;
  label: string;
  source: SourceReference;
  excludes: string[];
  noteFolder?: string;
}

interface LocalBinding {
  bindingId: string;
  absoluteRoot: string;
  verifiedAt?: string;
  // A binding describes a path; it is not a sandbox permission token.
}

interface CityViewState {
  profileId?: string;
  snapshotId?: string;
  selectedEntityId?: string;
  lensId: string;
  camera?: { position: [number, number, number]; target: [number, number, number] };
}
```

Validate settings/view state as untrusted persisted input. Changing a profile or executable binding invalidates its prior run authorization. Revalidate local roots after restart; never execute merely because a synced note or setting names a path.

## 6. Storage boundary

Use `loadData/saveData` for small plugin preferences and shareable profile metadata [S1]. Keep large snapshots out of that object. Those settings may be included in a user's sync/backup; do not represent them as an encrypted or guaranteed machine-private store.

Use a `LocalBindingStore` and `SnapshotStore` behind application ports. Proposed persistence is a clearly disclosed, configurable user-local data/cache directory outside the source root and outside the vault; initialize it only when needed. Keep binding metadata separate from disposable snapshots. Provide inspect-location, purge-cache, and retention controls. Validate that the chosen store is not inside an inspected source root; request another location or use session-only memory if roots overlap. A user-local directory is not a guarantee that an external backup tool will never sync it.

WP-01 may keep snapshots in memory; WP-05 adds durable history. Store absolute root/executable bindings locally, not in shared note frontmatter. Newly created vault profiles with missing local bindings ask the user to reconnect the source. Do not persist executable trust as an automatically honored shared boolean.

Write notes only to a user-selected vault destination, through the Vault API. Proposed optional layout after WP-04:

```text
Codebase Inspector/
  <project-label>/
    Overview.md
    Investigations/
    Decisions/
    Reports/
```

Do not generate one note per source file. Do not copy raw analyzer payloads, whole source trees, or secret-bearing logs into notes. Exclude the output folder from inventory/watch loops when the vault is the codebase.

## 7. Rendering and interaction boundary

Use equal lots and deterministic nested layout; default height is physical line count and categorical color is file type. Keep exact raw values visible, explain logarithmic/clamped display scaling, and show unavailable metrics distinctly. Filters should hide/dim without unexpectedly rebuilding the entire city's arrangement. Recoloring must not relayout.

Use repeated geometry with `InstancedMesh`, shared materials, capped labels, and a lookup keyed by mesh/batch plus instance index [S7]. Update bounds after transforms as needed. Keep Three.js objects outside deep Vue reactivity. Use host-scoped colors derived through a theme bridge; keep semantic severity distinguishable through text/icons, not red/green alone.

A narrow renderer interface can provide `setLayout`, `setColors`, `setSelection`, `focus`, `fit`, `resize`, `pause`, `resume`, and `dispose`. Inject the mount element and owning window rather than reading global host state. Render on demand while idle; keep frames only while damping or animation requires them. Include a semantic searchable HTML list and inspector as the functional non-WebGL fallback.

## 8. Analyzer execution boundary — WP-02 onward

Import-only mode is always available. Execution is opt-in and uses a selected installed native executable. Obsidian directory policies prohibit plugin-managed dependency installation/update and require disclosure of external-file access [S5]. Do not run `npx` in a mode that could fetch/install software, download companions/models, or install tooling in the inspected repository.

Use asynchronous spawning with an argument array, bounded stdout/stderr, a verified cwd, controlled environment, timeout, cancellation, and no shell interpolation. On Windows, `.cmd`/`.bat` launchers are not equivalent to native binaries and have special execution rules [S10]; initially support a native `fallow.exe` binding rather than silently enabling a shell. A repository-local executable is code execution from that repository and needs explicit trust. Merely probing its version also executes it.

Inspect fallow capabilities and pin adapter fixtures to supported versions. Its global flags document JSON output, explicit roots, quiet mode, and no-cache behavior [S9]. Verify the selected command's cache/log/report writes with a filesystem-diff test. Use documented options to avoid source-tree writes; if that cannot be achieved, disclose it and offer import-only mode. Never use fix, init, or setup commands as part of an ordinary scan.

Authorization is an application safeguard, not a security sandbox: a native executable can access more than the target root. Safe report import does not require trusting or running the project.

## 9. Deferred host integrations

WP-04 adds evidence notes. WP-10 adds watch sessions and CI artifact exchange without requiring Obsidian on the CI runner. WP-11 adds protocol navigation and Markdown blocks; opening a note must never authorize a filesystem scan or executable. An optional headless CLI can later reuse the core but is not on the critical path.

## 10. Testing and version strategy

Test the production plugin bundle in an isolated vault, without the development server or project `node_modules`. Test against the actual minimum/current supported Obsidian versions and their embedded runtime, not only a separately installed Node.js. A browser harness tests UI/renderer but not host permission, adapter, lifecycle, or module-loading behavior. Record tested OS/runtime versions in release notes.
