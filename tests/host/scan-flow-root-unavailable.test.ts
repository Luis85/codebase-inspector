// Gap closure GRA4 (spec §7): a refresh stats the root it is about to scan, and a missing or
// non-directory root is reported as unavailable. It never asks the user to approve a missing folder.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../mocks/obsidian';
import type { App } from 'obsidian';
import { runRefresh } from '../../src/host/scan-flow';
import { openScopeModal } from '../../src/host/modals/scope-modal';
import { createFixedClock } from '../fixtures/clock';
import type { AnalysisScope, CodebaseProfile } from '../../src/domain/model';
import type { ProfileStore } from '../../src/application/ports/profile-store';
import type { ScanCoordinator } from '../../src/application/scan-coordinator';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';

vi.mock('../../src/host/modals/scope-modal', () => ({ openScopeModal: vi.fn(async () => null) }));

const STORED: AnalysisScope = { rootPath: '/stored', exclusions: ['.git'], maxFileBytes: 1_000_000, followSymlinks: false };
const profile: CodebaseProfile = { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['.git'], maxFileBytes: 1_000_000 };
const app = {} as unknown as App;
const store = {} as unknown as ProfileStore;

function setUp(stat: { exists: boolean; isDirectory: boolean; unreadable?: string }) {
  const statFn = vi.fn(async (_path: string) => ({ ...stat, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 }));
  const port = { stat: statFn } as unknown as SourceFileSystemPort;
  const start = vi.fn(async () => undefined);
  const reportRootUnavailable = vi.fn();
  const coordinator = { start, reportRootUnavailable } as unknown as ScanCoordinator;
  return { port, statFn, start, reportRootUnavailable, coordinator };
}

describe('runRefresh against an unavailable root', () => {
  beforeEach(() => { vi.mocked(openScopeModal).mockClear(); });

  it('reports the stored root as unavailable, with no modal and no scan', async () => {
    const { port, statFn, start, reportRootUnavailable, coordinator } = setUp({ exists: false, isDirectory: false });
    await runRefresh(app, coordinator, profile, STORED, createFixedClock(), store, '/stored', port);
    expect(statFn).toHaveBeenCalledWith('/stored');
    expect(reportRootUnavailable).toHaveBeenCalledWith('/stored');
    expect(openScopeModal).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('reports a different bound root as unavailable, without opening the scope modal', async () => {
    const { port, statFn, start, reportRootUnavailable, coordinator } = setUp({ exists: false, isDirectory: false });
    await runRefresh(app, coordinator, profile, STORED, createFixedClock(), store, '/elsewhere', port);
    expect(statFn).toHaveBeenCalledWith('/elsewhere');
    expect(reportRootUnavailable).toHaveBeenCalledWith('/elsewhere');
    expect(openScopeModal).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('with no binding, stats the stored root', async () => {
    const { port, statFn, reportRootUnavailable, coordinator } = setUp({ exists: false, isDirectory: false });
    await runRefresh(app, coordinator, profile, STORED, createFixedClock(), store, null, port);
    expect(statFn).toHaveBeenCalledWith('/stored');
    expect(reportRootUnavailable).toHaveBeenCalledWith('/stored');
  });

  it('treats a root that is not a directory as unavailable', async () => {
    const { port, start, reportRootUnavailable, coordinator } = setUp({ exists: true, isDirectory: false });
    await runRefresh(app, coordinator, profile, STORED, createFixedClock(), store, '/stored', port);
    expect(reportRootUnavailable).toHaveBeenCalledWith('/stored');
    expect(start).not.toHaveBeenCalled();
  });

  it('GRB17b: an unreadable root is reported unavailable with its code, never offered for approval', async () => {
    const { port, start, reportRootUnavailable, coordinator } = setUp({ exists: true, isDirectory: false, unreadable: 'EACCES' });
    await runRefresh(app, coordinator, profile, STORED, createFixedClock(), store, '/stored', port);
    expect(reportRootUnavailable).toHaveBeenCalledWith('/stored', 'EACCES');
    expect(openScopeModal).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('control: an existing root equal to the stored root starts the scan', async () => {
    const { port, start, reportRootUnavailable, coordinator } = setUp({ exists: true, isDirectory: true });
    await runRefresh(app, coordinator, profile, STORED, createFixedClock(), store, '/stored', port);
    expect(reportRootUnavailable).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledTimes(1);
    expect(openScopeModal).not.toHaveBeenCalled();
  });
});
