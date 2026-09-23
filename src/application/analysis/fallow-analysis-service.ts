// Part 7 Z7/Z8/Z10/Z11/Z22/Z36: what the host and the UI call. It owns the binding and
// trust rules and every pre-run check; the coordinator owns the run itself. Every method
// takes the profile id and, where it needs a root, the snapshot the caller shows.
// - review and checkTrust INSPECT only (stat and a 4-byte header): nothing runs.
// - run starts only with current trust; otherwise it returns the review.
// - trustAndRun binds, then starts; trust is written only once the probe passed.
// - run and trustAndRun hold a per-profile reservation from entry to the start (busy otherwise).
import { normalizeAbsolutePath } from '../../domain/path-safety';
import type { CodebaseSnapshot } from '../../domain/model';
import type { AnalyzerBindingStore } from '../ports/analyzer-binding-store';
import type { Clock } from '../ports/clock';
import type { ExecutableFacts, ExecutableInspection, ExecutableInspectorPort } from '../ports/executable-inspector';
import type { SnapshotStore } from '../ports/snapshot-store';
import type { SourceFileSystemPort } from '../ports/source-filesystem-port';
import { AnalyzerStoreError, type AnalyzerBinding, type AnalyzerBindingRead } from './analyzer-record';
import { fingerprintTrust, isTrustCurrent, type TrustSubject } from './analyzer-trust';
import { isActive, type AnalysisRunState } from './analysis-state';
import type { AnalysisCoordinator } from './analysis-coordinator';
import {
  FALLOW_ENV_ALLOW_LIST, FALLOW_RUN_ARGS, FALLOW_TIMEOUT_DEFAULT_S, FALLOW_VERSION_ARGS, isValidTimeoutSeconds,
} from './fallow-invocation';
import type { FallowRunErrorCode } from './fallow-run-errors';

export type AnalyzerBindingView = AnalyzerBindingRead & { executableName: 'fallow.exe' | 'fallow' };

export interface RunReview {
  profileId: string;
  snapshotId: string;
  rootPath: string;
  facts: ExecutableFacts;
  args: readonly string[];
  versionArgs: readonly string[];
  envNames: readonly string[];
  timeoutSeconds: number;
  trustedVersion: string | null;
  /** fingerprintTrust(subject, ''): what "Trust and run" checks again. */
  subjectFingerprint: string;
}

export type ReviewResult =
  | { ok: true; review: RunReview }
  | { ok: false; code: 'executable-refused' | 'executable-missing' | 'root-unavailable'; detail: string };

export type TrustCheck =
  | { kind: 'trusted' }
  | { kind: 'review'; review: RunReview; reason: 'untrusted' | 'changed' }
  | { kind: 'unbound'; read: AnalyzerBindingRead }
  | { kind: 'refused'; code: FallowRunErrorCode; detail: string };

export type StartOutcome =
  | { kind: 'started' }
  | { kind: 'review'; review: RunReview; reason: 'untrusted' | 'changed' }
  | { kind: 'choose-executable'; read: AnalyzerBindingRead }
  | { kind: 'refused'; code: FallowRunErrorCode; detail: string }
  | { kind: 'busy' };

export interface FallowAnalysisService {
  readBinding(profileId: string): Promise<AnalyzerBindingView>;
  review(profileId: string, snapshot: CodebaseSnapshot, executablePath: string): Promise<ReviewResult>;
  checkTrust(profileId: string, snapshot: CodebaseSnapshot): Promise<TrustCheck>;
  run(profileId: string, snapshot: CodebaseSnapshot): Promise<StartOutcome>;
  trustAndRun(profileId: string, snapshot: CodebaseSnapshot, review: RunReview): Promise<StartOutcome>;
  cancel(profileId: string): void;
  forget(profileId: string): Promise<'forgotten' | 'busy'>;
  setTimeLimit(profileId: string, seconds: number): Promise<'saved' | 'invalid'>;
  purgeProfile(profileId: string): Promise<void>;
  stateOf(profileId: string): AnalysisRunState;
  subscribe(listener: (profileId: string) => void): () => void;
  /** Final review: told the profile id after every successful data.json write (bind, trust,
   *  revoke, forget, time limit, purge), wherever it came from (Settings or a card), so
   *  every open leaf re-reads the binding. */
  onBindingChanged(listener: (profileId: string) => void): () => void;
  shutdown(): void;
}

export interface FallowAnalysisServiceDeps {
  store: AnalyzerBindingStore;
  inspector: ExecutableInspectorPort;
  coordinator: AnalysisCoordinator;
  snapshots: SnapshotStore;
  getFilesystem: () => SourceFileSystemPort;
  machineId: string;
  clock: Clock;
}

type Refusal = { code: 'executable-refused' | 'executable-missing'; detail: string };
type Precheck =
  | { kind: 'trusted'; subject: TrustSubject; binding: AnalyzerBinding; version: string }
  | Exclude<TrustCheck, { kind: 'trusted' }>;

/** K35: `refusal[:detail]`, so the copy can name the expected file or the error code. */
function refusalOf(inspection: Extract<ExecutableInspection, { ok: false }>): Refusal {
  if (inspection.refusal === 'executable-missing') return { code: 'executable-missing', detail: '' };
  return { code: 'executable-refused', detail: inspection.detail === '' ? inspection.refusal : `${inspection.refusal}:${inspection.detail}` };
}

function normalisedPath(raw: string): string | null {
  try {
    return normalizeAbsolutePath(raw.trim());
  } catch {
    return null;
  }
}

/** Polish B2 (L13): a trust write the store refused is never an operational failure, so good
 *  evidence is not marked stale. Only the store's own refusal is mapped; anything else is a
 *  real error and still ends the run as the internal failure. */
function refusedTrustWrite(e: unknown): 'store-unsupported' | 'changed-since-review' | null {
  if (!(e instanceof AnalyzerStoreError)) return null;
  return e.code === 'unsupported' ? 'store-unsupported' : 'changed-since-review';
}

export function createFallowAnalysisService(deps: FallowAnalysisServiceDeps): FallowAnalysisService {
  const { inspector, coordinator, snapshots, machineId, clock } = deps;
  const bindingListeners = new Set<(profileId: string) => void>();
  /** A throwing listener is surfaced on its own microtask (the coordinator's `isolate` rule):
   *  it never fails the write that already succeeded, nor starves the other listeners. */
  const bindingChanged = (profileId: string): void => {
    for (const listener of Array.from(bindingListeners)) {
      try {
        listener(profileId);
      } catch (e) {
        queueMicrotask(() => { throw e; });
      }
    }
  };
  /** The binding store, announcing each write that succeeded (a rejected write changed nothing). */
  const store: AnalyzerBindingStore = {
    read: (profileId) => deps.store.read(profileId),
    bind: async (profileId, executablePath) => { await deps.store.bind(profileId, executablePath); bindingChanged(profileId); },
    setTimeoutSeconds: async (profileId, seconds) => { await deps.store.setTimeoutSeconds(profileId, seconds); bindingChanged(profileId); },
    grantTrust: async (profileId, trust, expectedPath) => { await deps.store.grantTrust(profileId, trust, expectedPath); bindingChanged(profileId); },
    revokeTrust: async (profileId) => { await deps.store.revokeTrust(profileId); bindingChanged(profileId); },
    forget: async (profileId) => { await deps.store.forget(profileId); bindingChanged(profileId); },
    purge: async (profileId) => { await deps.store.purge(profileId); bindingChanged(profileId); },
  };

  /** Polish B1 fix round 1: the profiles with a `run` or `trustAndRun` between its entry and
   *  `coordinator.start` (read, stat, inspect, bind). `isActive` alone cannot see them, so a
   *  second start could read a binding the first is replacing. Held until the start itself. */
  const starting = new Set<string>();
  const reserved = (profileId: string): boolean => starting.has(profileId) || isActive(coordinator.stateOf(profileId));
  async function reserve(profileId: string, body: () => Promise<StartOutcome>): Promise<StartOutcome> {
    if (reserved(profileId)) return { kind: 'busy' };
    starting.add(profileId);
    try {
      return await body();
    } finally {
      starting.delete(profileId);
    }
  }

  async function rootIsDirectory(rootPath: string): Promise<boolean> {
    try {
      const stat = await deps.getFilesystem().stat(rootPath);
      return stat.exists && stat.isDirectory;
    } catch {
      return false;
    }
  }

  function subjectOf(profileId: string, snapshot: CodebaseSnapshot, facts: ExecutableFacts): TrustSubject {
    const rootPath = snapshot.scope.rootPath;
    return { profileId, machineId, rootPath, args: FALLOW_RUN_ARGS(rootPath), facts };
  }

  function reviewOf(profileId: string, snapshot: CodebaseSnapshot, facts: ExecutableFacts, timeoutSeconds: number, trustedVersion: string | null): RunReview {
    const subject = subjectOf(profileId, snapshot, facts);
    return {
      profileId, snapshotId: snapshot.snapshotId, rootPath: subject.rootPath, facts, args: subject.args,
      versionArgs: FALLOW_VERSION_ARGS, envNames: FALLOW_ENV_ALLOW_LIST, timeoutSeconds, trustedVersion,
      subjectFingerprint: fingerprintTrust(subject, ''),
    };
  }

  const isLatest = (profileId: string, snapshot: CodebaseSnapshot): boolean =>
    snapshots.latestFor(profileId)?.snapshotId === snapshot.snapshotId;

  async function precheck(profileId: string, snapshot: CodebaseSnapshot): Promise<Precheck> {
    const read = await store.read(profileId);
    if (read.kind === 'unsupported') return { kind: 'refused', code: 'store-unsupported', detail: '' };
    if (read.kind !== 'bound') return { kind: 'unbound', read };
    const binding = read.binding;
    if (!(await rootIsDirectory(snapshot.scope.rootPath))) return { kind: 'refused', code: 'root-unavailable', detail: '' };
    const inspection = await inspector.inspect(binding.executablePath, snapshot.scope.rootPath);
    if (!inspection.ok) return { kind: 'refused', ...refusalOf(inspection) };
    const subject = subjectOf(profileId, snapshot, inspection.facts);
    const trust = binding.trust;
    if (trust !== null && isTrustCurrent(trust, subject, trust.version)) return { kind: 'trusted', subject, binding, version: trust.version };
    return {
      kind: 'review', review: reviewOf(profileId, snapshot, inspection.facts, binding.timeoutSeconds, trust?.version ?? null),
      reason: trust === null ? 'untrusted' : 'changed',
    };
  }

  function startPlan(profileId: string, snapshot: CodebaseSnapshot, subject: TrustSubject, timeoutSeconds: number, trustedVersion: string | null): StartOutcome {
    const started = coordinator.start({
      subject, snapshotId: snapshot.snapshotId, timeoutSeconds,
      onProbePassed: async (version) => {
        try {
          if (trustedVersion === null) {
            await store.grantTrust(profileId, { fingerprint: fingerprintTrust(subject, version), version, grantedAt: clock.nowIso() }, subject.facts.executablePath);
            return 'continue';
          }
          if (version === trustedVersion) return 'continue';
          await store.revokeTrust(profileId);
          return 'version-changed';
        } catch (e) {
          const verdict = refusedTrustWrite(e);
          if (verdict === null) throw e;
          return verdict;
        }
      },
    });
    return started ? { kind: 'started' } : { kind: 'busy' };
  }

  return {
    async readBinding(profileId) {
      return { ...(await store.read(profileId)), executableName: inspector.executableName };
    },

    async review(profileId, snapshot, executablePath) {
      const path = normalisedPath(executablePath);
      if (path === null) return { ok: false, code: 'executable-refused', detail: 'not-absolute' };
      if (!(await rootIsDirectory(snapshot.scope.rootPath))) return { ok: false, code: 'root-unavailable', detail: '' };
      const inspection = await inspector.inspect(path, snapshot.scope.rootPath);
      if (!inspection.ok) return { ok: false, ...refusalOf(inspection) };
      const read = await store.read(profileId);
      const bound = read.kind === 'bound' ? read.binding : null;
      const trustedVersion = bound !== null && bound.executablePath === path ? bound.trust?.version ?? null : null;
      return { ok: true, review: reviewOf(profileId, snapshot, inspection.facts, bound?.timeoutSeconds ?? FALLOW_TIMEOUT_DEFAULT_S, trustedVersion) };
    },

    async checkTrust(profileId, snapshot) {
      const checked = await precheck(profileId, snapshot);
      return checked.kind === 'trusted' ? { kind: 'trusted' } : checked;
    },

    run: (profileId, snapshot) => reserve(profileId, async () => {
      if (!isLatest(profileId, snapshot)) return { kind: 'refused', code: 'snapshot-changed', detail: '' };
      const checked = await precheck(profileId, snapshot);
      switch (checked.kind) {
        case 'trusted': return startPlan(profileId, snapshot, checked.subject, checked.binding.timeoutSeconds, checked.version);
        case 'review': return { kind: 'review', review: checked.review, reason: checked.reason };
        case 'unbound': return { kind: 'choose-executable', read: checked.read };
        default: return checked;
      }
    }),

    trustAndRun: (profileId, snapshot, reviewed) => reserve(profileId, async () => {
      if (reviewed.profileId !== profileId || reviewed.snapshotId !== snapshot.snapshotId || !isLatest(profileId, snapshot)) {
        return { kind: 'refused', code: 'snapshot-changed', detail: '' };
      }
      const read = await store.read(profileId);
      if (read.kind === 'unsupported') return { kind: 'refused', code: 'store-unsupported', detail: '' };
      if (!(await rootIsDirectory(snapshot.scope.rootPath))) return { kind: 'refused', code: 'root-unavailable', detail: '' };
      const inspection = await inspector.inspect(reviewed.facts.executablePath, snapshot.scope.rootPath);
      if (!inspection.ok) return { kind: 'refused', ...refusalOf(inspection) };
      const subject = subjectOf(profileId, snapshot, inspection.facts);
      if (fingerprintTrust(subject, '') !== reviewed.subjectFingerprint) return { kind: 'refused', code: 'changed-since-review', detail: '' };
      // Polish B1, defence in depth: the reservation keeps the service's own starts out; this
      // still refuses a run started on the coordinator directly during the awaits above.
      if (isActive(coordinator.stateOf(profileId))) return { kind: 'busy' };
      try {
        await store.bind(profileId, reviewed.facts.executablePath);
      } catch (e) {
        if (e instanceof AnalyzerStoreError && e.code === 'unsupported') return { kind: 'refused', code: 'store-unsupported', detail: '' };
        throw e;
      }
      const timeoutSeconds = read.kind === 'bound' ? read.binding.timeoutSeconds : FALLOW_TIMEOUT_DEFAULT_S;
      return startPlan(profileId, snapshot, subject, timeoutSeconds, null);
    }),

    cancel(profileId) {
      coordinator.cancel(profileId);
    },

    async forget(profileId) {
      if (reserved(profileId)) return 'busy';
      await store.forget(profileId);
      return 'forgotten';
    },

    async setTimeLimit(profileId, seconds) {
      if (!isValidTimeoutSeconds(seconds)) return 'invalid';
      await store.setTimeoutSeconds(profileId, seconds);
      return 'saved';
    },

    async purgeProfile(profileId) {
      coordinator.cancel(profileId);
      await store.purge(profileId);
    },

    stateOf: (profileId) => coordinator.stateOf(profileId),
    subscribe: (listener) => coordinator.subscribe(listener),
    onBindingChanged: (listener) => {
      bindingListeners.add(listener);
      return () => { bindingListeners.delete(listener); };
    },
    shutdown: () => { coordinator.shutdown(); bindingListeners.clear(); },
  };
}
