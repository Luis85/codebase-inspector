// Part 7 Z28: a scriptable FallowAnalysisService for component, host and harness tests. It
// runs nothing: `next` says what each call answers, and `setState`/`setBinding` notify
// subscribers exactly as the real coordinator does. Final review: like the real service, a
// binding write (`setBinding`, a Forget, a time limit that succeeds, a purge) also tells the
// `onBindingChanged` listeners. The stored reads change only through `setBinding`: a test
// scripts what the next read answers.
import { IDLE, type AnalysisRunState } from '../../src/application/analysis/analysis-state';
import type { AnalyzerBindingRead } from '../../src/application/analysis/analyzer-record';
import type { FallowAnalysisService, ReviewResult, RunReview, StartOutcome } from '../../src/application/analysis/fallow-analysis-service';
import { FALLOW_ENV_ALLOW_LIST, FALLOW_RUN_ARGS, FALLOW_VERSION_ARGS } from '../../src/application/analysis/fallow-invocation';

export const HARNESS_EXECUTABLE = 'C:\\Tools\\fallow\\fallow.exe';

export function fakeRunReview(profileId: string, snapshotId: string, rootPath: string, overrides: Partial<RunReview> = {}): RunReview {
  return {
    profileId, snapshotId, rootPath,
    facts: { executablePath: HARNESS_EXECUTABLE, realPath: HARNESS_EXECUTABLE, size: 12_400_000, mtimeMs: Date.UTC(2026, 8, 20, 9, 30), format: 'pe', insideRoot: false },
    args: FALLOW_RUN_ARGS(rootPath), versionArgs: FALLOW_VERSION_ARGS, envNames: FALLOW_ENV_ALLOW_LIST,
    timeoutSeconds: 120, trustedVersion: null, subjectFingerprint: '0a1b2c3d', ...overrides,
  };
}

export interface FakeFallowAnalysis extends FallowAnalysisService {
  readonly calls: { method: string; profileId: string }[];
  next: { run: StartOutcome; trustAndRun: StartOutcome; review: ReviewResult | null; forget: 'forgotten' | 'busy'; setTimeLimit: 'saved' | 'invalid' };
  setState(profileId: string, state: AnalysisRunState): void;
  setBinding(profileId: string, read: AnalyzerBindingRead): void;
  listenerCount(): number;
  bindingListenerCount(): number;
}

export function createFakeFallowAnalysis(executableName: 'fallow.exe' | 'fallow' = 'fallow.exe'): FakeFallowAnalysis {
  const states = new Map<string, AnalysisRunState>();
  const bindings = new Map<string, AnalyzerBindingRead>();
  const listeners = new Set<(profileId: string) => void>();
  const bindingListeners = new Set<(profileId: string) => void>();
  const calls: { method: string; profileId: string }[] = [];
  const notify = (profileId: string): void => { for (const listener of Array.from(listeners)) listener(profileId); };
  const bindingChanged = (profileId: string): void => { for (const listener of Array.from(bindingListeners)) listener(profileId); };
  const call = (method: string, profileId: string): void => { calls.push({ method, profileId }); };
  const fake: FakeFallowAnalysis = {
    calls,
    next: { run: { kind: 'started' }, trustAndRun: { kind: 'started' }, review: null, forget: 'forgotten', setTimeLimit: 'saved' },
    setState(profileId, state) { states.set(profileId, state); notify(profileId); },
    setBinding(profileId, read) { bindings.set(profileId, read); notify(profileId); bindingChanged(profileId); },
    listenerCount: () => listeners.size,
    bindingListenerCount: () => bindingListeners.size,
    readBinding(profileId) {
      call('readBinding', profileId);
      return Promise.resolve({ ...(bindings.get(profileId) ?? { kind: 'none' }), executableName });
    },
    review(profileId, snapshot, executablePath) {
      call('review', profileId);
      const path = executablePath.trim();
      const base = fakeRunReview(profileId, snapshot.snapshotId, snapshot.scope.rootPath);
      return Promise.resolve(fake.next.review ?? { ok: true, review: { ...base, facts: { ...base.facts, executablePath: path, realPath: path } } });
    },
    checkTrust(profileId) { call('checkTrust', profileId); return Promise.resolve({ kind: 'trusted' }); },
    run(profileId) { call('run', profileId); return Promise.resolve(fake.next.run); },
    trustAndRun(profileId) { call('trustAndRun', profileId); return Promise.resolve(fake.next.trustAndRun); },
    cancel(profileId) { call('cancel', profileId); },
    forget(profileId) {
      call('forget', profileId);
      if (fake.next.forget === 'forgotten') bindingChanged(profileId);
      return Promise.resolve(fake.next.forget);
    },
    setTimeLimit(profileId) {
      call('setTimeLimit', profileId);
      if (fake.next.setTimeLimit === 'saved') bindingChanged(profileId);
      return Promise.resolve(fake.next.setTimeLimit);
    },
    purgeProfile(profileId) { call('purgeProfile', profileId); bindingChanged(profileId); return Promise.resolve(); },
    stateOf: (profileId) => states.get(profileId) ?? IDLE,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    onBindingChanged(listener) {
      bindingListeners.add(listener);
      return () => { bindingListeners.delete(listener); };
    },
    shutdown() { call('shutdown', ''); },
  };
  return fake;
}
