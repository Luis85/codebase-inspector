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

/** Resolves the profile a scan/refresh from THIS view should operate on: the profile
 *  already bound to `profileId` if one exists; else the first existing profile (WP-01's
 *  model is one profile per bound codebase root -- inventory-collector.ts's own comment
 *  makes the same assumption); else a freshly minted one, using the same defaults
 *  settings-tab.ts's "Add profile" uses.
 *
 *  Open decision, stated explicitly: this auto-created profile is NOT given a
 *  LocalBinding (task 6/7's concern) -- its resolved root lives only in the
 *  ApprovedInventoryRun/CodebaseSnapshot produced for it. Settings > Reconnect would
 *  show it as unbound until a later task wires the two paths together; task 8's scope
 *  is the scan lifecycle, not profile/binding management. */
export async function resolveOrCreateProfile(
  profileStore: ProfileStore, profileId: string | null,
): Promise<CodebaseProfile> {
  if (profileId) {
    const existing = await profileStore.get(profileId);
    if (existing) return existing;
  }
  const [first] = await profileStore.list();
  if (first) return first;
  const created: CodebaseProfile = {
    profileId: crypto.randomUUID(), name: 'New profile', bindingId: null,
    exclusions: [], maxFileBytes: DEFAULT_MAX_FILE_BYTES,
  };
  await profileStore.save(created);
  return created;
}

/** The full source -> scope consent chain (task 7), ending in `coordinator.start()`.
 *  A no-op if the user cancels either modal -- coordinator.state stays 'idle' in that
 *  case, exactly as if nothing had been clicked (spec 7: "cancelling the scope modal
 *  leaves no approval"). CityView learns the resulting profileId/snapshotId from the
 *  coordinator's own SCAN_COMPLETED notification, not from this function's return. */
export async function runInitialScan(
  app: App, coordinator: ScanCoordinator, profile: CodebaseProfile, filesystem: SourceFileSystemPort,
): Promise<void> {
  const selection = await openSourceModal(app, { profile, filesystem });
  if (!selection) return;
  const result = await openScopeModal(app, selection);
  if (!result) return;
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
