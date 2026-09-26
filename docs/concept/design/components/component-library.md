# Component library

Build these as reusable components behind the host adapter. The registry defines design-level interfaces, not a committed TypeScript API. Consolidate names and shapes with the implementation model before coding.

## Shared contract

Presentation components receive immutable view models and emit user intents. The application layer checks authorization, source identity, job ordering, and note-write safety. DOM/GPU objects are view-scoped. All interactive elements have accessible names, focus-visible states, disabled reasons when relevant, and a keyboard/non-drag route. Never globally reset Obsidian styles.

| ID | Component | Surface |
|---|---|---|
| C01 | InspectorWorkspace | ItemView + Vue root |
| C02 | ProfileSelector | Native menu / compact toolbar |
| C03 | SourceSelector | Native Modal + validated fields |
| C04 | ScopeReview | Native Modal / settings detail |
| C05 | ScanProgress | Progressbar + status + cancel |
| C06 | FileSearch | Labeled search input |
| C07 | CodebaseFileList | HTML list / accessible virtual list |
| C08 | CityViewport | Three.js renderer port + HTML wrapper |
| C09 | CameraControls | Labeled button group |
| C10 | FileInspector | Complementary panel / nonmodal drawer |
| C11 | MetricLegend | HTML text and swatches |
| C12 | SnapshotStatus | Compact footer + details |
| C13 | EvidenceBadge | Text badge + details popover |
| C14 | ProviderConnection | Native setup panel |
| C15 | DialogFrame | Native Modal |
| C16 | StatusBanner | Status / alert / inline feedback |
| C17 | EmptyState | HTML content + primary action |
| C18 | ResponsivePanelHost | Container-query panel composition |
| C19 | EvidenceTable | Semantic table |
| C20 | InspectorSettings | Native Setting controls |
| C21 | DependencyNeighborhood | Edge query + city overlay + HTML list |
| C22 | FindingWorkbench | Queue + evidence details |
| C23 | InvestigationComposer | Native Modal + Markdown preview |
| C24 | SnapshotComparison | Selectors + linked city/table |
| C25 | EvidenceOverview | Independent cards + investigation queue |
| C26 | FocusedNoteEmbed | Markdown renderer integration + static preview |
| C27 | ArtifactAndWatchPanel | Artifact form + separate session controls |

## C01 — InspectorWorkspace

**Surface:** ItemView + Vue root.

**Inputs:** `profile, snapshot, capabilities, leafState`.

**Events:** `modeRequested; closeRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** empty, restoring, ready, unavailable.

**Behavior:** Own one renderer/UI scope per leaf. Keep shared data immutable; never share camera or focus across leaves.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C02 — ProfileSelector

**Surface:** Native menu / compact toolbar.

**Inputs:** `profiles, activeId, localBindings`.

**Events:** `profileSelected; sourceEditRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** none, bound, unbound, invalid.

**Behavior:** Selection changes presentation context; it is not source authorization. Long roots belong in details, not truncated identity labels.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C03 — SourceSelector

**Surface:** Native Modal + validated fields.

**Inputs:** `sourceKind, typedPath, validation`.

**Events:** `sourceChanged; validateRequested; continueRequested; cancelled`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** editing, validating, valid, invalid.

**Behavior:** Validate path data through a port; do not interpolate into commands. Restore typed values and focus on errors.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C04 — ScopeReview

**Surface:** Native Modal / settings detail.

**Inputs:** `resolvedRoot, exclusions, limits, consent`.

**Events:** `consentChanged; scanRequested; backRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** unapproved, approved, invalidated.

**Behavior:** Consent defaults false and binds to reviewed inputs. It does not authorize analyzers or note creation.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C05 — ScanProgress

**Surface:** Progressbar + status + cancel.

**Inputs:** `stage, counts, optionalTotal, jobId, priorSnapshot`.

**Events:** `cancelRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** indeterminate, determinate, cancelling, complete, failed.

**Behavior:** Publish meaningful totals only. Throttle announcements; never swap a cancelled partial snapshot into the city.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C06 — FileSearch

**Surface:** Labeled search input.

**Inputs:** `query, matchCount, totalCount`.

**Events:** `queryChanged; clearRequested; focusResultsRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** idle, typing, matches, no-matches.

**Behavior:** WP-01 searches paths, not all symbols. Preserve geometry and selected identity across search changes.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C07 — CodebaseFileList

**Surface:** HTML list / accessible virtual list.

**Inputs:** `fileIds, grouping, selection, filters`.

**Events:** `selectionRequested; directoryFocusRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** loaded, filtered, empty, partial.

**Behavior:** All files remain accessible; native list buttons are preferable to an incomplete ARIA tree. Disambiguate duplicate basenames.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C08 — CityViewport

**Surface:** Three.js renderer port + HTML wrapper.

**Inputs:** `snapshot, layout, palette, selection, lens`.

**Events:** `entityPicked; hoverChanged; cameraChanged; rendererStateChanged`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** initializing, ready, paused, lost, fallback.

**Behavior:** Consumes normalized data only. No direct filesystem or process access. Cap labels, isolate GPU objects from deep Vue reactivity.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C09 — CameraControls

**Surface:** Labeled button group.

**Inputs:** `cameraMode, zoomBounds, selection, reducedMotion`.

**Events:** `fitRequested; focusRequested; topRequested; stepRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** enabled, at-bound, no-selection.

**Behavior:** Every gesture has a non-drag alternative. Bind keys only to the active camera region, not the host window.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C10 — FileInspector

**Surface:** Complementary panel / nonmodal drawer.

**Inputs:** `fileRecord, observations, findings, sourceBinding`.

**Events:** `focusRequested; pathCopyRequested; sourceOpenRequested; closeRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** selected, unavailable-metric, stale, removed.

**Behavior:** Keep exact raw values and scope. Hiding panel does not clear selection; Clear selection is distinct.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C11 — MetricLegend

**Surface:** HTML text and swatches.

**Inputs:** `metricDefinition, scale, units, bins, missingStates`.

**Events:** `definitionRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** category, numeric, binned, unavailable.

**Behavior:** Names the raw metric, aggregation, scale, and cap. Color alone is insufficient; unknown is never zero.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C12 — SnapshotStatus

**Surface:** Compact footer + details.

**Inputs:** `snapshotId, observedAt, scope, jobState`.

**Events:** `provenanceRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** complete-for-scope, retained, partial.

**Behavior:** Absolute time and scope are available in details. Important errors also appear near the affected content.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C13 — EvidenceBadge

**Surface:** Text badge + details popover.

**Inputs:** `provider, status, freshness, availability, sourceMatch`.

**Events:** `detailsRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** current, imported, stale, unknown, mismatch.

**Behavior:** Do not reduce execution state, quality verdict, and freshness to one colored dot.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C14 — ProviderConnection

**Surface:** Native setup panel.

**Inputs:** `capabilities, importState, executableConfig`.

**Events:** `importRequested; runReviewRequested; disconnectRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** unconfigured, importing, configured, running, failed.

**Behavior:** Only installed trusted executables; no auto-install/update. Report content cannot create execution authority.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C15 — DialogFrame

**Surface:** Native Modal.

**Inputs:** `title, initialFocus, dirtyState, actions`.

**Events:** `confirmRequested; cancelRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** pristine, dirty, submitting, failed.

**Behavior:** Use real modal focus containment, safe Escape, and focus restoration; preserve drafts on errors.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C16 — StatusBanner

**Surface:** Status / alert / inline feedback.

**Inputs:** `cause, consequence, recoveryActions`.

**Events:** `recoveryRequested; dismissed`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** info, warning, blocking-error.

**Behavior:** Explain what remains usable. No operational failure is turned into a clean result. Escape unsafe source strings.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C17 — EmptyState

**Surface:** HTML content + primary action.

**Inputs:** `reason, contextCounts, recovery`.

**Events:** `primaryRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** no-profile, no-files, no-matches, no-baseline.

**Behavior:** Different causes need different copy and actions. Do not show an empty city after a failed scan.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C18 — ResponsivePanelHost

**Surface:** Container-query panel composition.

**Inputs:** `leafWidth, panelWidths, openDrawer, selectedId`.

**Events:** `panelVisibilityChanged; panelSizeChanged`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** docked, collapsed, drawer, list-first.

**Behavior:** Use leaf dimensions, not entire app width. Keep one narrow overlay at a time and preserve focus/selection.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C19 — EvidenceTable

**Surface:** Semantic table.

**Inputs:** `columns, rows, sort, pagination`.

**Events:** `rowSelected; sortChanged; pageChanged`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** loaded, empty, partial, unmapped.

**Behavior:** Column headings name units/scope. Sort numeric values as numbers and give missing values an explicit policy.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C20 — InspectorSettings

**Surface:** Native Setting controls.

**Inputs:** `validatedSettings, profiles, storageSummary`.

**Events:** `settingsChanged; sourceRequested; clearBindingRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** valid, invalid, saving, error.

**Behavior:** Do not render future-release settings. Changes save configuration without starting scans or analyzers.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C21 — DependencyNeighborhood

**Surface:** Edge query + city overlay + HTML list.

**Inputs:** `edges, direction, hops, cap, hiddenCount`.

**Events:** `edgeSelected; directionChanged; expandRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** bounded, truncated, cycle, unresolved.

**Behavior:** Importer → imported target. Type-only, import, co-change and runtime relations are distinct, not interchangeable.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C22 — FindingWorkbench

**Surface:** Queue + evidence details.

**Inputs:** `findings, selectedFinding, provenance, sourceMatch`.

**Events:** `findingSelected; sourceReadRequested; noteRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** loaded, no-matches, stale, missing-source.

**Behavior:** Evidence supports and limitations are visible. No safe-to-delete score, automatic fix, or tests-will-pass claim.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C23 — InvestigationComposer

**Surface:** Native Modal + Markdown preview.

**Inputs:** `draft, vaultDestination, evidenceRefs, sourceInclusion`.

**Events:** `draftChanged; createRequested; discardRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** editing, validating, writing, collision, failed.

**Behavior:** Write human notes only on explicit action. No absolute machine paths/source text by default; never overwrite silently.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C24 — SnapshotComparison

**Surface:** Selectors + linked city/table.

**Inputs:** `baseline, current, compatibility, deltas, cameraLock`.

**Events:** `baselineChanged; selectionRequested; cameraLockChanged`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** compatible, incompatible, missing-provider.

**Behavior:** Shared layout/scale and explicit matching. Deleted/excluded/unavailable are distinct; provider failure is not resolution.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C25 — EvidenceOverview

**Surface:** Independent cards + investigation queue.

**Inputs:** `metrics, definitions, providerStates, orderingRules`.

**Events:** `evidenceRequested; priorityRuleChanged`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** inventory-only, partial-providers, complete-context.

**Behavior:** Every priority explains its inputs. Do not manufacture an aggregate quality percentage.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C26 — FocusedNoteEmbed

**Surface:** Markdown renderer integration + static preview.

**Inputs:** `pinnedReference, preview, availableSnapshot`.

**Events:** `openFocusRequested; artifactImportRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** static, unavailable, activated.

**Behavior:** No scan on render; bound renderer budget; no executable parameters. Human notes stay authoritative.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## C27 — ArtifactAndWatchPanel

**Surface:** Artifact form + separate session controls.

**Inputs:** `artifactValidation, sourceBinding, watchSession, jobs`.

**Events:** `artifactImportRequested; watchReviewRequested; stopRequested`. Events carry `viewId` and appropriate `profileId`, `snapshotId`, and entity/finding/job identifiers; never raw command strings as UI authority.

**States:** unbound, ready, watching, stopping, failed.

**Behavior:** Import is not execution consent. Explicit source/scope/session lifetime, debounce, cancellation, newest-result ordering.

**Verification:** test empty/loaded/error variants, keyboard focus, increased text size, dark/light palette inheritance, and cleanup when the owning view closes. Use a fixture with long Unicode paths and missing evidence. Confirm no hidden work occurs simply because this component mounts.

## States and component variants

Standard controls have default, hover, focus-visible, pressed/selected, disabled, and busy states. Busy is not disabled-by-default: keep Cancel available where work is cancellable. Selected, keyboard focus, and hovered are distinct visuals. A popover cannot be the sole source of a critical value.

Native host components may have their own visual density; adapt to their semantics rather than reproducing a screenshot through global styles. Virtualization, popup focus, and persisted state require contract tests, not only screenshot tests.
