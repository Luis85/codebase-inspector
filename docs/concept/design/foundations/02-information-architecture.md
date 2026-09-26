# Information architecture and host ownership

## Host versus plugin

| Surface | Owner | Contract |
|---|---|---|
| Vault file explorer, global ribbon, workspace tabs, command palette | Obsidian | Do not reimplement, reorder, or hijack |
| Codebase Inspector ItemView | Plugin host adapter | Create one UI/rendering scope per leaf; register through supported API |
| Source modal and settings rows | Obsidian adapter | Native Modal/Setting patterns; explicit focus and teardown |
| Codebase file list, inspector, quality lenses | Plugin UI | These concern the selected codebase, not the vault’s note navigation |
| Codebase snapshot and evidence | Application/domain | Validated immutable records, no DOM or GPU references |
| Three.js city | Visualization module | Geometry and rendering from normalized data, never direct filesystem access |
| Markdown investigations | Vault | Create/update only through explicit actions and supported Vault operations |

A visible host file explorer and a plugin codebase file list are not duplicate global navigation: one browses notes, the other the inspected source. Label the latter “Codebase files.” Let users collapse it. The host explorer can be closed independently.

## Navigation by capability

WP-01 has one city view. It does not need a navigation strip with one item. Commands: Open codebase city, Scan codebase, Cancel scan. Plugin settings are available through Obsidian Settings and the compact in-view settings action.

WP-02 adds evidence lenses and source-provider setup. WP-04 adds a local Findings mode. WP-05 adds Compare. WP-09 adds Overview. These modes belong to the same contextual inspection workspace; no permanent second global sidebar is required. A mode preserves its selected profile and compatible snapshot.

The review prototype’s scenario selector is **not product UI**. It is a design-review harness for jumping between states and release increments. Its host-theme preview button is also outside the product.

## Entity relationships

`CodebaseProfile → local SourceBinding → ScanJob → Snapshot → FileRecord`

`ProviderRun → Finding / MetricObservation / Relationship → Snapshot`

`InvestigationNote → profileId + snapshotId + findingIds + relative source references`

Absolute source paths are local bindings. A relative path is not globally unique without the codebase identity. Imported snapshots can be browsed without a local source binding; source-reading actions then need explicit binding and verification.

## State ownership and persistence

| State | Scope | Persistence policy |
|---|---|---|
| Profile label, source mode, exclusions | Plugin settings / local binding | Small validated data; do not serialize source text here |
| Approved root and execution consent | Explicit operation/session | Never restored as authority from an imported report or deep link |
| Snapshot | Application store | Immutable; separate from ordinary settings; retention user-visible |
| Camera, selected file, focused directory, query, panel widths | Workspace leaf | Presentation only; restore IDs if still valid |
| Provider connection | Local configuration | Restore configuration, not an approved pending execution |
| Draft investigation text | Composer draft | Preserve on recoverable error; confirm before intentional discard |
| Note embed | Markdown + bounded preview | Pin snapshot/reference; no scan or analyzer run on reading |

Opening the ribbon action should reveal an existing inspector leaf when sensible. “Open in new pane” is explicit. Never silently target another leaf’s source for scan commands. Resolve the active inspector leaf; otherwise ask for the profile.

## Return paths

Source selection returns to the prior leaf and preserves its last complete snapshot until a replacement is ready. Findings → city retains the finding/file context. Note → city resolves the pinned snapshot first, then the entity. A missing snapshot offers Import artifact or Select another snapshot; it does not silently resolve to a different revision. Settings close without starting a scan.

## Capability boundaries

An unimplemented feature is absent. A shipped feature with missing setup is discoverable in context, with a specific explanation. A disconnected provider disables only its lens, not the structural city. Importing older evidence is allowed when correctly marked; a mismatch must not be presented as current data.

References: [S1], [S3], [S4] in the [source register](../sources/sources.md).
