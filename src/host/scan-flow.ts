// The "which profile, and how to get consent for it" logic scan-codebase's two modes
// (first scan vs refresh, spec 5: "scan-codebase doubles as refresh") both need. Kept
// out of city-view.ts to keep that file's own job (hosting: mounting Vue, owning the
// renderer, wiring the coordinator's output to setLayout) legible, and to stay under
// the 400-line src/** budget.
import { openSourceModal } from './modals/source-modal';
import { openScopeModal } from './modals/scope-modal';
import { approve } from '../application/approval';
import type { App } from 'obsidian';
import type { ScanCoordinator } from '../application/scan-coordinator';
import type { ProfileStore } from '../application/ports/profile-store';
import type { SourceFileSystemPort } from '../application/ports/source-filesystem-port';
import type { Clock } from '../application/ports/clock';
import type { AnalysisScope, CodebaseProfile } from '../domain/model';

const DEFAULT_MAX_FILE_BYTES = 5_000_000;

/** Ruling M44 (fix round 3, Critical; extended fix round 4, Important): a new profile
 *  is NEVER exclusion-less. Measured root cause of "0 files found" in the real host: an
 *  empty-exclusions profile scanning a vault-as-codebase reads `.git`, `node_modules`,
 *  the vault config directory, every plugin's `data.json` and any `.env` in scope --
 *  spec §6's secrets gate names `.git`, `.env` and the vault config directory
 *  explicitly, and checkpoint #2's own safety line reads "no activity against `.git`,
 *  `.env` or the vault config directory" verbatim. `.env` is the canonical secrets
 *  file; a vault that happens to contain none passes that line by ABSENCE, not by
 *  exclusion, and any codebase with one would have it opened and its contents put in
 *  the snapshot without this. `node_modules` is the single largest source of files
 *  that are not the user's own codebase, and its omission is what made the scan
 *  effectively non-terminating (measured: ~163,854 files on the dev vault). Every
 *  exclusion here is one the scope modal shows in an editable field BEFORE the user
 *  approves the scan (spec 7) -- the user sees and consents to exactly what is skipped,
 *  which is the whole point of that screen; nothing here is hidden.
 *
 *  `vaultConfigDir` is supplied by the CALLER, never discovered here: this file is not
 *  under `src/adapters/**`, but `hardcoded-config-path` is a protected rule regardless,
 *  and the one real host call site (CityView) already has `app.vault.configDir` --
 *  passing it down keeps this function testable with a plain string and keeps it, and
 *  settings-tab.ts's "Add profile" (which uses the SAME function, so the two paths
 *  cannot drift), from ever needing to reach `app` themselves. */
export function defaultExclusionsFor(vaultConfigDir: string): string[] {
  return ['.git', 'node_modules', '.env', vaultConfigDir];
}

/** The one place a default (exclusion-having) CodebaseProfile is constructed --
 *  scan-flow.ts's own `resolveOrCreateProfile` and settings-tab.ts's "Add profile" both
 *  call this, so the two paths cannot drift back apart (ruling M44's other half). */
export function createDefaultProfile(vaultConfigDir: string): CodebaseProfile {
  return {
    profileId: crypto.randomUUID(), name: 'New profile', bindingId: null,
    exclusions: defaultExclusionsFor(vaultConfigDir), maxFileBytes: DEFAULT_MAX_FILE_BYTES,
  };
}

/** Fix round 4, ruling M44's migration half (Critical): an EXISTING profile persisted
 *  with `exclusions: []` before this fix existed is not a considered user choice -- it
 *  was the bug this whole ruling exists to close, and `resolveOrCreateProfile` returning
 *  it untouched (the shape of the round-3 fix) reproduces the original failure verbatim
 *  on every already-installed profile. Fills it with the SAME defaults a freshly created
 *  profile gets and PERSISTS the result via `ProfileStore.update()` -- never `get()` +
 *  `save()`, per this store's own doc comment (task-6 Critical 1) -- so every later code
 *  path (Settings, the scope modal's prefilled field, the next refresh) sees the safe
 *  value from now on, not just this one call. A profile whose exclusions are non-empty
 *  -- including one the user deliberately emptied back OUT after this migration already
 *  ran once -- is left alone entirely; this only ever fires for EXACTLY empty. */
async function migrateEmptyExclusions(
  profileStore: ProfileStore, profile: CodebaseProfile, vaultConfigDir: string,
): Promise<CodebaseProfile> {
  if (profile.exclusions.length > 0) return profile;
  await profileStore.update(profile.profileId, (current) => (
    current.exclusions.length > 0 ? current : { ...current, exclusions: defaultExclusionsFor(vaultConfigDir) }
  ));
  return { ...profile, exclusions: defaultExclusionsFor(vaultConfigDir) };
}

/** Resolves the profile a scan/refresh from THIS view should operate on: the profile
 *  already bound to `profileId` if one exists; else the first existing profile (WP-01's
 *  model is one profile per bound codebase root -- inventory-collector.ts's own comment
 *  makes the same assumption); else a freshly minted one via `createDefaultProfile`. An
 *  existing profile is migrated (see `migrateEmptyExclusions`) before being returned.
 *
 *  Open decision, stated explicitly: this auto-created profile is NOT given a
 *  LocalBinding (task 6/7's concern) -- its resolved root lives only in the
 *  ApprovedInventoryRun/CodebaseSnapshot produced for it. Settings > Reconnect would
 *  show it as unbound until a later task wires the two paths together; task 8's scope
 *  is the scan lifecycle, not profile/binding management. */
export async function resolveOrCreateProfile(
  profileStore: ProfileStore, profileId: string | null, vaultConfigDir: string,
): Promise<CodebaseProfile> {
  if (profileId) {
    const existing = await profileStore.get(profileId);
    if (existing) return migrateEmptyExclusions(profileStore, existing, vaultConfigDir);
  }
  const [first] = await profileStore.list();
  if (first) return migrateEmptyExclusions(profileStore, first, vaultConfigDir);
  const created = createDefaultProfile(vaultConfigDir);
  await profileStore.save(created);
  return created;
}

/** The full source -> scope consent chain (task 7), ending in `coordinator.start()`.
 *  A no-op if the user cancels either modal -- coordinator.state stays 'idle' in that
 *  case, exactly as if nothing had been clicked (spec 7: "cancelling the scope modal
 *  leaves no approval"). CityView learns the resulting profileId/snapshotId from the
 *  coordinator's own SCAN_COMPLETED notification, not from this function's return.
 *
 *  Ruling M53 (fix round 6, Important): on APPROVAL ONLY, persists the just-approved
 *  `exclusions`/`maxFileBytes` back to the profile -- `ScopeModal` has no store
 *  reference at all (ruling M31's own reasoning: the consent screen's dependency
 *  surface carries nothing that could read the filesystem, and the same reasoning
 *  says it should not own persistence either), so without this, an edit made in the
 *  consent screen applied to that one run and was then silently discarded; the NEXT
 *  consent chain re-prefilled from the stale, wider profile scope with nothing visible
 *  marking the reversion. Never on cancel: `result` is only reached once `openScopeModal`
 *  has already resolved non-null, so a cancelled modal (checked above, at `if (!result)
 *  return`) leaves the profile untouched, exactly as "cancelling the scope modal leaves
 *  no approval" requires. Through `ProfileStore.update()`, never `get()` + `save()`
 *  (task-6 Critical 1) -- and deliberately NOT wrapped in a try/catch: a write failure
 *  here must not let the scan silently proceed against a profile it just failed to
 *  keep in sync, so it propagates and `coordinator.start` below is never reached.
 *  `result.scope` (not a value re-read from the profile afterward) is still what gets
 *  scanned -- persisting is a side effect on the STORE, never a rewrite of what this
 *  run itself does. Never persists `result.scope.rootPath`: a profile carries a
 *  `bindingId`, never a path (§4.1). */
export async function runInitialScan(
  app: App, coordinator: ScanCoordinator, profile: CodebaseProfile, filesystem: SourceFileSystemPort,
  profileStore: ProfileStore,
): Promise<void> {
  const selection = await openSourceModal(app, { profile, filesystem });
  if (!selection) return;
  const result = await openScopeModal(app, selection);
  if (!result) return;
  await profileStore.update(profile.profileId, (current) => (
    { ...current, exclusions: result.scope.exclusions, maxFileBytes: result.scope.maxFileBytes }
  ));
  await coordinator.start(result.approval, result.scope);
}

/** scan-codebase's REFRESH behaviour: silently re-approves against the SAME scope the
 *  previous snapshot recorded (spec 5: "re-approves against the stored scope") -- no
 *  modal, because the root and scope have not changed from what was already consented
 *  to. A changed root or scope is exactly what approval fingerprints exist to
 *  invalidate; refreshing an UNCHANGED one is not a new grant, so re-showing the same
 *  consent screen for the same answer would be friction with no safety benefit. */
export async function runRefresh(
  coordinator: ScanCoordinator, profile: CodebaseProfile, storedScope: AnalysisScope, clock: Clock,
): Promise<void> {
  const approval = approve(profile.profileId, storedScope.rootPath, storedScope, clock);
  await coordinator.start(approval, storedScope);
}
