# State ownership and command contract

## Separate domain data from transient presentation

The plugin has shared immutable snapshots and per-leaf interaction state. A leaf must not own a second copy of the scanner's mutable working inventory. A renderer must not own the authoritative selected file. The application layer interprets actions; visual components emit intent.

| Owner | Data | Persistence |
|---|---|---|
| Plugin/application services | Profiles, supported providers, immutable snapshots, approved run coordinator | Explicit local persistence |
| Machine-local binding store | Resolved external roots and trusted executable bindings | Machine-local; never assume portable across synced machines |
| View state | Profile ID, snapshot ID, selection ID, query, panel presentation, camera bookmark | Small host workspace state; no source text or process object |
| Per-leaf Pinia instance | Reactive representation of that leaf's state | Do not use a global singleton selection store |
| Renderer instance | Scene objects, resources, pick-index mapping, render scheduling | None; reconstruct from snapshot/layout/view state |
| Active run | ID, generation, approval fingerprint, progress, cancellation signal | Session only; a saved run is not resumed implicitly |

Obsidian custom views can be created multiple times; use the registered view factory and retrieve leaves through the workspace rather than maintaining one permanent view reference [O1]. Pop-out windows have their own document and window contexts [O2].

## Proposed events and effects

The executable reference model is in `src/interaction-state.js`. The typed production seam is `integration/renderer-port.ts`. Reconcile both with existing implemented domain contracts before adoption.

| Intent / result | State change | Permitted side effects | Forbidden side effects |
|---|---|---|---|
| FILE_SELECTED | Selected ID + inspector visible | Recolor/marker and row update | Fit camera, run analyzer, open editor |
| QUERY_CHANGED | Query + derived match set | Update list and dim instances | Recompute layout, clear selection |
| INSPECTOR_CLOSED | Inspector visibility only | Restore focus when appropriate | Clear selected file or query |
| FOCUS_REQUESTED | Camera bookmark | Frame selected geometry | Hide unmatched files or change scope |
| TOP_TOGGLED | View mode + saved 3D bookmark | Change projection pose | Lose previous 3D pose |
| SCAN_REQUESTED | No change until approval validation | Present scope review | Start filesystem access implicitly |
| SCAN_STARTED | Run ID/generation/running state | Start approved collector | Mutate current published snapshot |
| SCAN_PROGRESS | Progress for matching active run only | Bounded progress announcement | Publish partial working state as complete |
| SCAN_CANCEL_REQUESTED | Run is nonpublishable | Abort actual work; show stopping if needed | Claim process stopped before confirmation |
| SCAN_COMPLETED | Validated snapshot replaces compatible prior snapshot | Reconcile selected IDs and rebuild geometry once | Publish stale generation or mismatched scope |
| SCAN_FAILED | Failed-run state | Error with old snapshot retained | Replace quality data with zeros |
| RENDERER_UNAVAILABLE | View mode fallback | Show HTML inventory | Discard snapshot or restart scan |
| VIEW_DISPOSED | No future view mutations | Detach listeners, release owned resources | Leave scheduled work retaining DOM |

The reference shortens cancellation to an immediate `cancelled` model state because its only asynchronous work is timer-driven fixture publication. Production must distinguish `cancelling` from `cancelled` whenever the collector/worker needs time to stop. In both cases, publication becomes forbidden immediately.

## Async publication guard

Each scan is associated with `{profileId, sourceFingerprint, scopeFingerprint, runId, generation}`. A result may publish only if all identities still match, cancellation has not invalidated it, and validation succeeds. The previous snapshot is immutable until the atomic swap. A late progress/result from an older run is ignored and may be logged as such; it never overwrites a newer result.

The UI's single-profile reference tests the run-ID/generation behavior only. It does not test real root authorization, fingerprint generation, filesystem cancellation, or multi-view orchestration. Those remain explicit host/integration gates.

When two leaves show the same profile, their selection, camera, and query remain independent. Shared snapshot availability can update both views, but each independently reconciles whether its selected file still exists. If not, show a non-destructive “File is no longer in this snapshot” state rather than selecting another file by index.

## Search + selection + geometry invariants

File identity is not a render-array index. Every render batch has an explicit instance-to-file mapping. A match set of `null` means unfiltered; an empty set means no matches. Neither changes the lot layout. Unknown measurements stay typed as unknown; no sentinel numeric zero.

Store the previous 3D camera as a full value object. Top-view operations must not mutate it. The renderer event `camera-changed` is separate from a command to move the camera, so host synchronization does not produce loops. Compare semantic values or attach origins to avoid reapplying the same change.

## Focus ownership

Keep DOM focus outside domain state. View-specific focus coordinators remember an initiating element or stable control identity for modal return. If a trigger has disappeared, focus a documented safe control in that same view. Do not return focus to `document.body` or to another leaf. All source paths and labels are plain text, not HTML.

## Unit-test scope

The reference has deterministic state tests for preservation, top-mode restoration, cancellation, stale completions, path lookup, and Escape intent. They do not validate the production application's reducers automatically. Port the tests to the chosen implementation, keeping the invariants intact rather than merely copying function names.

Sources: `07-sources-and-limits.md`.
