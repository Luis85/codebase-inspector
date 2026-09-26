// Part 7 Z8/Z9/Z10/Z15/Z16/Z17 and the spec's §1 "Exit semantics": HOW fallow is invoked
// and how a finished process is read, as pure data and pure functions. Report text goes
// through Part 6's parseFallowReportText, unchanged (U1). No Node, no process.
import { parseFallowReportText } from '../evidence/read-fallow-report';
import { FALLOW_REPORT_MAX_BYTES, type RawFallowReport } from '../evidence/raw-fallow';
import type { ProcessOutcome } from '../ports/analyzer-process';
import { fromImportCode, type FallowRunErrorCode } from './fallow-run-errors';

/** Z15: combined (bare) mode, JSON, no cache, quiet, an explicit root. Nothing else, ever. */
export function FALLOW_RUN_ARGS(root: string): readonly string[] {
  return ['--format', 'json', '--no-cache', '--quiet', '--root', root];
}
export const FALLOW_VERSION_ARGS: readonly string[] = ['--version'];

export const FALLOW_VERSION_TIMEOUT_MS = 5_000;
export const FALLOW_VERSION_MAX_BYTES = 4_096;
export const FALLOW_STDOUT_MAX_BYTES = FALLOW_REPORT_MAX_BYTES;
export const FALLOW_STDERR_TAIL_BYTES = 65_536;
export const FALLOW_KILL_GRACE_MS = 2_000;
export const FALLOW_CLOSE_GRACE_MS = 2_000;
export const FALLOW_TIMEOUT_DEFAULT_S = 120;
export const FALLOW_TIMEOUT_MIN_S = 10;
export const FALLOW_TIMEOUT_MAX_S = 1800;
const FALLOW_ERROR_MESSAGE_MAX = 500;
const VERSION_MAX = 32;

/** Z9: the versions the committed fixtures were recorded with (Y20/Y21). */
export const FALLOW_TESTED_VERSIONS: readonly string[] = ['3.21.0', '3.27.0'];

/** Z16: the only variables passed on. The adapter also drops FALLOW_* and NODE_OPTIONS. */
export const FALLOW_ENV_ALLOW_LIST: readonly string[] = ['PATH', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LOCALAPPDATA'];
export const FALLOW_ENV_EXTRA: Readonly<Record<string, string>> = { NO_COLOR: '1' };

/** Z10: whole seconds from 10 to 1800. */
export function isValidTimeoutSeconds(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= FALLOW_TIMEOUT_MIN_S && n <= FALLOW_TIMEOUT_MAX_S;
}

export type FallowVersion = { ok: true; version: string; major: number; tested: boolean } | { ok: false };
const VERSION_LINE = /^fallow (\d+)\.(\d+)\.(\d+)$/;

/** Z8: `fallow 3.27.0` (the probe's observed output), trimmed. */
export function parseFallowVersion(stdout: string | null): FallowVersion {
  if (stdout === null) return { ok: false };
  const match = VERSION_LINE.exec(stdout.trim());
  if (!match) return { ok: false };
  const version = `${match[1]}.${match[2]}.${match[3]}`;
  if (version.length > VERSION_MAX) return { ok: false };
  return { ok: true, version, major: Number(match[1]), tested: FALLOW_TESTED_VERSIONS.includes(version) };
}

export type VersionProbeResult = { ok: true; version: string; tested: boolean } | { ok: false; code: FallowRunErrorCode; detail: string };

/** Z8: a probe passes only with exit 0 and a `fallow 3.y.z` line. Details are data:
 *  'timeout', 'no-version', 'cancelled', an exit code or a signal name. */
export function classifyVersionProbe(outcome: ProcessOutcome): VersionProbeResult {
  switch (outcome.kind) {
    case 'exited': {
      if (outcome.exitCode !== 0) return { ok: false, code: 'version-probe-failed', detail: String(outcome.exitCode) };
      const parsed = parseFallowVersion(outcome.stdout);
      if (!parsed.ok) return { ok: false, code: 'version-probe-failed', detail: 'no-version' };
      if (parsed.major !== 3) return { ok: false, code: 'version-unsupported', detail: parsed.version };
      return { ok: true, version: parsed.version, tested: parsed.tested };
    }
    case 'timed-out': return { ok: false, code: 'version-probe-failed', detail: 'timeout' };
    case 'signalled': return { ok: false, code: 'version-probe-failed', detail: outcome.signal };
    case 'cancelled': return { ok: false, code: 'version-probe-failed', detail: 'cancelled' };
    case 'spawn-failed':
      return outcome.errorCode === 'ENOENT'
        ? { ok: false, code: 'executable-missing', detail: '' }
        : { ok: false, code: 'spawn-failed', detail: outcome.errorCode };
    default: return { ok: false, code: 'version-probe-failed', detail: 'no-version' };
  }
}

export type FallowExitResult =
  | { kind: 'completed'; report: RawFallowReport }
  | { kind: 'cancelled' }
  | { kind: 'failed'; code: FallowRunErrorCode; detail: string };

const failed = (code: FallowRunErrorCode, detail = ''): FallowExitResult => ({ kind: 'failed', code, detail });

/** fallow's operational error document, `{"error":true,"message":…}`: its message (capped),
 *  '' when it has none, or null when `stdout` is not such a document. */
function errorMessageOf(stdout: string | null): string | null {
  if (stdout === null) return null;
  const body = stdout.charCodeAt(0) === 0xfeff ? stdout.slice(1) : stdout;
  let doc: unknown;
  try {
    doc = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return null;
  const record = doc as Record<string, unknown>;
  if (record.error !== true) return null;
  return typeof record.message === 'string' ? record.message.slice(0, FALLOW_ERROR_MESSAGE_MAX) : '';
}

function classifyExited(exitCode: number, stdout: string | null): FallowExitResult {
  if (exitCode === 0 || exitCode === 1) {
    if (stdout === null) return failed('output-not-json');
    const read = parseFallowReportText(stdout);
    if (read.ok) return { kind: 'completed', report: read.report };
    // The error document names no kind, so the reader refuses it as unsupported first.
    const message = read.code === 'unsupported' ? errorMessageOf(stdout) : null;
    if (message !== null) return failed('analyzer-error', message);
    return failed(fromImportCode(read.code), read.detail);
  }
  if (exitCode === 2) {
    const message = errorMessageOf(stdout);
    return message === null ? failed('exit-code', '2') : failed('analyzer-error', message);
  }
  return failed('exit-code', String(exitCode));
}

/** The spec's §1 table. A completed analysis with findings (exit 0 or 1) is never a
 *  failure; nothing partial is ever returned as completed. */
export function classifyFallowExit(outcome: ProcessOutcome, timeoutSeconds: number): FallowExitResult {
  switch (outcome.kind) {
    case 'exited': return classifyExited(outcome.exitCode, outcome.stdout);
    case 'cancelled': return { kind: 'cancelled' };
    case 'signalled': return failed('exit-code', outcome.signal);
    case 'timed-out': return failed('timed-out', String(timeoutSeconds));
    case 'stdout-too-large': return failed('output-too-large');
    case 'output-incomplete': return failed('output-incomplete');
    case 'spawn-failed': return outcome.errorCode === 'ENOENT' ? failed('executable-missing') : failed('spawn-failed', outcome.errorCode);
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}
