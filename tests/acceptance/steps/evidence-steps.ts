// Step definitions for the RUN-LIFECYCLE evidence scenarios: cancelling a refresh
// without losing the retained snapshot, rejecting a late result, and refusing an
// approval after the root or scope changed.
//
// These drive the real ScanCoordinator over a REAL temporary directory through the real
// Node adapter (scan-harness.ts). Nothing here uses ScanCoordinator's `onProduce` test
// seam: a scenario that skips the collector proves nothing about the collector.
import { expect } from 'vitest';
import { join } from 'node:path';
import { CANCELLED_BANNER, identityOf, mayPublish } from '../../../src/application/run-state';
import { isApprovalValid } from '../../../src/application/approval';
import { openScopeModal } from '../../../src/host/modals/scope-modal';
import { COPY_10 } from '../../../src/ui/copy';
import { approvalFor, harnessOf, makeScanHarness, runningRunId, scopeFor } from '../scan-harness';
import { put, take } from '../world';
import type { StepTable } from '../feature-runner';
import type { World } from '../world';
import type { App } from 'obsidian';
import type { AnalysisScope, ApprovedInventoryRun, CodebaseProfile } from '../../../src/domain/model';
import type { RunIdentity } from '../../../src/application/run-state';

export const evidenceSteps: StepTable<World> = {
  // ---- Cancel a refresh without losing the valid snapshot -------------------------
  'a valid snapshot is visible': async (world) => {
    const harness = await makeScanHarness(world);
    const scope = scopeFor(harness.root);
    put(world, 'scope', scope);
    await harness.coordinator.start(approvalFor('profile-A', scope), scope);
    expect(harness.coordinator.state.status).toBe('complete');
    expect(harness.displayedSnapshotId).not.toBeNull();
    put(world, 'snapshot-A', harness.displayedSnapshotId);
  },

  'a refresh is running': async (world) => {
    const harness = harnessOf(world);
    const scope = take<AnalysisScope>(world, 'scope');
    harness.gate.arm();
    put(world, 'refresh-promise', harness.coordinator.start(approvalFor('profile-A', scope), scope));
    await Promise.resolve();
    put(world, 'runB', runningRunId(harness));
  },

  'I cancel the refresh': (world) => {
    const harness = harnessOf(world);
    harness.coordinator.cancel(take<string>(world, 'runB'));
    expect(harness.coordinator.state.status).toBe('cancelling');
  },

  'no more results from that run may publish': async (world) => {
    const harness = harnessOf(world);
    harness.gate.open();
    await take<Promise<void>>(world, 'refresh-promise');
    expect(harness.coordinator.state.status).toBe('cancelled');
    // Exactly ONE completion has ever been reported -- the first scan's.
    expect(harness.completions).toBe(1);
  },

  'the previous snapshot remains visible': (world) => {
    const harness = harnessOf(world);
    expect(harness.displayedSnapshotId).toBe(take<string>(world, 'snapshot-A'));
    expect(harness.store.get(harness.displayedSnapshotId!)!.completeness).toBe('complete');
  },

  'the interface distinguishes cancellation from analysis findings': (world) => {
    const harness = harnessOf(world);
    const notice = harness.notices.at(-1) ?? '';
    // COPY-10, ASSEMBLED AND CHECKED AGAINST THE CATALOGUE ENTRY ITSELF. The shipped
    // sentence is built in two halves (run-state.ts's CANCELLED_BANNER plus
    // lifecycle-notices.ts's retained-snapshot suffix) because the second half is
    // omitted entirely when there is no retained snapshot to name -- a single template
    // string cannot express that. Comparing the assembled result to COPY_10 with
    // {time} substituted is what stops the two halves drifting from the catalogue,
    // and it is the only consumer COPY_10 has (task 12, carried finding 3).
    const retained = harness.store.get(take<string>(world, 'snapshot-A'))!;
    const time = new Date(retained.providerRun.capturedAt).toLocaleTimeString();
    expect(notice).toBe(COPY_10.replace('{time}', time));
    expect(notice).toContain(CANCELLED_BANNER);
    // It is not dressed up as a result: no count, no finding, no partial-measurement
    // language anywhere in it.
    expect(notice).not.toMatch(/finding|measurements cover/i);
    expect(harness.store.get(take<string>(world, 'snapshot-A'))!.warnings).toEqual([]);
  },

  // ---- Reject late result publication ----------------------------------------------
  'I cancelled run A': async (world) => {
    const harness = await makeScanHarness(world);
    const scope = scopeFor(harness.root);
    put(world, 'scope', scope);
    harness.gate.arm();
    const promise = harness.coordinator.start(approvalFor('profile-A', scope), scope);
    await Promise.resolve();
    put(world, 'runA', runningRunId(harness));
    // Read from the SUBSCRIPTION's own record, never `coordinator.getLifecycle()`
    // (review M9): that accessor has no production caller at all, and a test suite
    // propping up a dead surface is how dead code starts looking live. `subscribe` is
    // how the host actually learns the lifecycle, so it is how this reads it.
    put(world, 'identity-A', identityOf(harness.lifecycles.at(-1)!));
    harness.coordinator.cancel(take<string>(world, 'runA'));
    harness.gate.open();
    await promise;
    expect(harness.coordinator.state.status).toBe('cancelled');
  },

  'I started run B': async (world) => {
    const harness = harnessOf(world);
    const scope = take<AnalysisScope>(world, 'scope');
    harness.gate.arm();
    put(world, 'runB-promise', harness.coordinator.start(approvalFor('profile-A', scope), scope));
    await Promise.resolve();
    put(world, 'runB', runningRunId(harness));
    expect(take<string>(world, 'runB')).not.toBe(take<string>(world, 'runA'));
  },

  'run A reports completion': (world) => {
    // The identity run A's own result carries -- recorded while A was actually running,
    // never hand-built -- arriving now, with run B in flight.
    put(world, 'late', take<RunIdentity>(world, 'identity-A'));
  },

  'run A does not replace the published snapshot or run B': async (world) => {
    const harness = harnessOf(world);
    const live = harness.lifecycles.at(-1)!;     // the subscription's record, not getLifecycle()
    expect(live.run.status).toBe('running');
    expect(mayPublish(take<RunIdentity>(world, 'late'), identityOf(live), live.run)).toBe(false);
    harness.gate.open();
    await take<Promise<void>>(world, 'runB-promise');
    expect(harness.coordinator.state.status).toBe('complete');
    // Run B published, and run A never did: exactly one completion, and it is B's.
    expect(harness.completions).toBe(1);
    expect(harness.lifecycles.at(-1)!.publishedSnapshotId).toBe(harness.displayedSnapshotId);
  },

  // ---- Reject approval after root or scope changes ---------------------------------
  'I approved one source root and exclusion scope': async (world) => {
    const harness = await makeScanHarness(world);
    const scope = scopeFor(harness.root, ['.git']);
    put(world, 'scope', scope);
    put(world, 'approval', approvalFor('profile-A', scope));
  },

  'either root or scope changes': (world) => {
    const scope = take<AnalysisScope>(world, 'scope');
    put(world, 'changed-scope', { ...scope, exclusions: ['.git', 'node_modules'] });
    put(world, 'changed-root', { ...scope, rootPath: join(scope.rootPath, 'src') });
  },

  'the previous approval cannot authorize inventory': async (world) => {
    const harness = harnessOf(world);
    const approval = take<ApprovedInventoryRun>(world, 'approval');
    for (const key of ['changed-scope', 'changed-root']) {
      const scope = take<AnalysisScope>(world, key);
      expect(isApprovalValid(approval, scope.rootPath, scope), key).toBe(false);
      await expect(harness.coordinator.start(approval, scope)).rejects.toThrow(/Approval is invalid/);
    }
    // Validated BEFORE any filesystem access: the port was never touched at all.
    expect(harness.port.readLog()).toEqual([]);
  },

  'I must review the updated scope': async (world) => {
    const changed = take<AnalysisScope>(world, 'changed-scope');
    const profile: CodebaseProfile = {
      profileId: 'profile-A', name: 'Alpha', bindingId: null,
      exclusions: [...changed.exclusions], maxFileBytes: changed.maxFileBytes,
    };
    // The REAL consent artefact, showing the CHANGED scope, and starting unapproved.
    const promise = openScopeModal({} as App, { profile, resolvedRoot: changed.rootPath });
    const modal = document.querySelector('.modal-container');
    expect(modal, 'the scope review did not reopen').not.toBeNull();
    expect(modal!.textContent).toContain('node_modules');
    expect(modal!.querySelector<HTMLInputElement>('[data-field="acknowledge"]')!.checked).toBe(false);
    expect(modal!.querySelector<HTMLButtonElement>('[data-action="confirm-scan"]')!.disabled).toBe(true);
    modal!.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    expect(await promise).toBeNull();
  },
};
