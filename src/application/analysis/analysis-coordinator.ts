// Part 7 Z21/Z23/Z24: ONE coordinator per plugin (main.ts), shared by every leaf; one run
// per codebase. `start` returns at once and the run continues detached: nothing awaits a
// 120 s analysis. The body probes, lets the service store or check trust, runs, classifies
// (fallow-invocation.ts), builds the report with the unchanged Part 6 builder, and
// publishes atomically (`put` then RUN_COMPLETED, no await between: the scan-coordinator
// rule). After EVERY await it checks for a cancel first (ScanCoordinator.start's
// re-entrancy rule). An operational failure keeps the old evidence and marks it stale.
import { fingerprintSource } from '../approval';
import { buildEvidenceReport } from '../evidence/normalize-fallow';
import { resolveFindings } from '../evidence/resolve-findings';
import type { EvidenceReport } from '../evidence/model';
import type { AnalyzerProcessPort, ProcessOutcome, ProcessRequest } from '../ports/analyzer-process';
import type { CancellationToken } from '../ports/cancellation-token';
import type { Clock } from '../ports/clock';
import type { EvidenceRepository } from '../ports/evidence-repository';
import type { SnapshotStore } from '../ports/snapshot-store';
import { fingerprintTrust, type TrustSubject } from './analyzer-trust';
import {
  FALLOW_RUN_ARGS, FALLOW_STDERR_TAIL_BYTES, FALLOW_STDOUT_MAX_BYTES, FALLOW_VERSION_ARGS, FALLOW_VERSION_MAX_BYTES,
  FALLOW_VERSION_TIMEOUT_MS, classifyFallowExit, classifyVersionProbe,
} from './fallow-invocation';
import { OPERATIONAL_FAILURES, type FallowRunErrorCode } from './fallow-run-errors';
import {
  IDLE, isActive, mayPublish, reduceAnalysis, type AnalysisAction, type AnalysisIdentity, type AnalysisRunState,
} from './analysis-state';

export interface RunPlan {
  subject: TrustSubject;
  snapshotId: string;
  timeoutSeconds: number;
  /** null on a first run (Trust and run): the probe's version is then trusted by the service. */
  trustedVersion: string | null;
  /** Called once the probe passed, before the analysis (A7). */
  onProbePassed: (version: string) => Promise<'continue' | 'version-changed' | 'changed-since-review'>;
}

export interface AnalysisCoordinatorDeps {
  process: AnalyzerProcessPort;
  evidence: EvidenceRepository;
  snapshots: SnapshotStore;
  clock: Clock;
  createCancellationToken: () => { token: CancellationToken; cancel: () => void };
}

const logOf = (outcome: ProcessOutcome): string => ('stderrTail' in outcome ? outcome.stderrTail : '');

export class AnalysisCoordinator {
  private readonly states = new Map<string, AnalysisRunState>();
  private readonly listeners = new Set<(profileId: string) => void>();
  private readonly cancels = new Map<string, () => void>();
  private nextGeneration = 0;
  private shutDown = false;

  constructor(private readonly deps: AnalysisCoordinatorDeps) {}

  stateOf(profileId: string): AnalysisRunState {
    return this.states.get(profileId) ?? IDLE;
  }

  subscribe(listener: (profileId: string) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** False when this codebase already has a run in flight, or after shutdown. */
  start(plan: RunPlan): boolean {
    const profileId = plan.subject.profileId;
    if (this.shutDown || isActive(this.stateOf(profileId))) return false;
    const identity: AnalysisIdentity = {
      profileId, snapshotId: plan.snapshotId, rootFingerprint: fingerprintSource(plan.subject.rootPath),
      subjectFingerprint: fingerprintTrust(plan.subject, ''), runId: crypto.randomUUID(), generation: this.nextGeneration,
    };
    this.nextGeneration += 1;
    const { token, cancel } = this.deps.createCancellationToken();
    this.cancels.set(identity.runId, cancel);
    const evidenceAtStart = this.deps.evidence.get(profileId);
    this.dispatch(profileId, {
      type: 'PROBE_STARTED', identity, rootPath: plan.subject.rootPath, startedAt: this.deps.clock.nowIso(), timeoutSeconds: plan.timeoutSeconds,
    });
    void this.execute(plan, identity, token, evidenceAtStart).finally(() => { this.cancels.delete(identity.runId); });
    return true;
  }

  /** Cancelling forbids publication at once; `cancelled` follows the process's own end. */
  cancel(profileId: string): void {
    const state = this.stateOf(profileId);
    if (state.status !== 'probing' && state.status !== 'running') return;
    this.dispatch(profileId, { type: 'CANCEL_REQUESTED', runId: state.identity.runId });
    this.cancels.get(state.identity.runId)?.();
  }

  /** Z24: synchronous and idempotent. Nothing publishes, every child is killed, no new run
   *  starts, and every listener is dropped (the leaves are going away with the plugin). */
  shutdown(): void {
    this.shutDown = true;
    for (const [profileId, state] of Array.from(this.states)) {
      if (state.status === 'probing' || state.status === 'running') this.dispatch(profileId, { type: 'CANCEL_REQUESTED', runId: state.identity.runId });
    }
    this.deps.process.killAll();
    for (const cancel of Array.from(this.cancels.values())) cancel();
    this.listeners.clear();
  }

  private async execute(plan: RunPlan, identity: AnalysisIdentity, token: CancellationToken, evidenceAtStart: EvidenceReport | null): Promise<void> {
    const { profileId, runId } = identity;
    const root = plan.subject.rootPath;
    const request = (args: readonly string[], timeoutMs: number, maxStdoutBytes: number): ProcessRequest => ({
      executablePath: plan.subject.facts.executablePath, args, cwd: root, timeoutMs, maxStdoutBytes, maxStderrBytes: FALLOW_STDERR_TAIL_BYTES,
    });
    try {
      const probe = await this.deps.process.run(request(FALLOW_VERSION_ARGS, FALLOW_VERSION_TIMEOUT_MS, FALLOW_VERSION_MAX_BYTES), token);
      if (this.stopIfCancelled(profileId, runId)) return;
      const version = classifyVersionProbe(probe);
      if (!version.ok) { this.fail(profileId, runId, version.code, version.detail, logOf(probe)); return; }
      const verdict = await plan.onProbePassed(version.version);
      if (this.stopIfCancelled(profileId, runId)) return;
      if (verdict !== 'continue') { this.fail(profileId, runId, verdict, version.version, ''); return; }
      this.dispatch(profileId, { type: 'PROBE_PASSED', runId, version: version.version, tested: version.tested });
      if (this.stopIfCancelled(profileId, runId)) return;

      const startedAt = this.deps.clock.nowIso();
      const startedMs = this.deps.clock.now().getTime();
      const outcome = await this.deps.process.run(request(FALLOW_RUN_ARGS(root), plan.timeoutSeconds * 1000, FALLOW_STDOUT_MAX_BYTES), token);
      if (this.stopIfCancelled(profileId, runId)) return;
      const result = classifyFallowExit(outcome, plan.timeoutSeconds);
      if (result.kind === 'cancelled') {
        this.dispatch(profileId, { type: 'CANCEL_REQUESTED', runId });
        this.dispatch(profileId, { type: 'PROCESS_STOPPED', runId });
        return;
      }
      if (result.kind === 'failed') { this.fail(profileId, runId, result.code, result.detail, logOf(outcome)); return; }

      const snapshot = this.deps.snapshots.get(identity.snapshotId);
      if (snapshot === null) { this.fail(profileId, runId, 'snapshot-changed', '', ''); return; }
      const finishedAt = this.deps.clock.nowIso();
      const base = buildEvidenceReport({
        raw: result.report, fileName: plan.subject.facts.executablePath, importedAt: finishedAt, snapshotId: identity.snapshotId, stripPrefix: null,
      });
      const report: EvidenceReport = {
        ...base,
        collected: {
          origin: 'collected', sourceMatch: 'verified', runId, rootPath: root, executablePath: plan.subject.facts.executablePath,
          args: FALLOW_RUN_ARGS(root), exitCode: outcome.kind === 'exited' && outcome.exitCode === 1 ? 1 : 0,
          startedAt, durationMs: this.deps.clock.now().getTime() - startedMs, versionTested: version.tested,
        },
      };
      const paths = new Set(snapshot.entities.filter((e) => e.kind === 'file').map((e) => e.path));
      const { matched } = resolveFindings(report.normalized.findings, paths);
      const reported = report.normalized.findings.length > 0 || report.normalized.rejectedPaths.length > 0;
      if (reported && matched.length === 0) { this.fail(profileId, runId, 'source-mismatch', '', ''); return; }

      const latestSnapshotId = this.deps.snapshots.latestFor(profileId)?.snapshotId ?? null;
      const evidenceUnchanged = this.deps.evidence.get(profileId) === evidenceAtStart;
      if (!mayPublish(identity, this.stateOf(profileId), { latestSnapshotId, evidenceUnchanged })) {
        this.fail(profileId, runId, latestSnapshotId === identity.snapshotId ? 'superseded' : 'snapshot-changed', '', '');
        return;
      }
      // The atomic swap: no await between these two lines.
      this.deps.evidence.put(profileId, report);
      this.dispatch(profileId, {
        type: 'RUN_COMPLETED', runId, finishedAt, matchedFindings: matched.length, matchedFiles: new Set(matched.map((f) => f.path)).size,
      });
    } catch {
      if (!this.stopIfCancelled(profileId, runId)) this.fail(profileId, runId, 'spawn-failed', 'internal', '');
    }
  }

  private stopIfCancelled(profileId: string, runId: string): boolean {
    const state = this.stateOf(profileId);
    if (state.status !== 'cancelling' || state.identity.runId !== runId) return false;
    this.dispatch(profileId, { type: 'PROCESS_STOPPED', runId });
    return true;
  }

  /** Z23: an operational failure keeps the evidence and marks it stale; the others leave it as it was. */
  private fail(profileId: string, runId: string, code: FallowRunErrorCode, detail: string, logExcerpt: string): void {
    const evidenceKept = this.deps.evidence.get(profileId) !== null;
    if (evidenceKept && OPERATIONAL_FAILURES.has(code)) this.deps.evidence.markStale(profileId);
    this.dispatch(profileId, { type: 'RUN_FAILED', runId, code, detail, logExcerpt, evidenceKept, finishedAt: this.deps.clock.nowIso() });
  }

  private dispatch(profileId: string, action: AnalysisAction): void {
    const before = this.stateOf(profileId);
    const after = reduceAnalysis(before, action);
    if (after === before) return;
    this.states.set(profileId, after);
    for (const listener of Array.from(this.listeners)) listener(profileId);
  }
}
