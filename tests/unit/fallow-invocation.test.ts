// Part 7 Z8/Z9/Z15/Z16/Z19 and the spec's §1 "Exit semantics" table: how fallow is invoked
// and how a finished process is read. Pure: no process is started here.
import { describe, expect, it } from 'vitest';
import {
  FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA, FALLOW_RUN_ARGS, FALLOW_TESTED_VERSIONS, FALLOW_VERSION_ARGS,
  classifyFallowExit, classifyVersionProbe, isValidTimeoutSeconds, parseFallowVersion,
} from '../../src/application/analysis/fallow-invocation';
import { FALLOW_RUN_ERROR_CODES, OPERATIONAL_FAILURES, fromImportCode, type FallowRunErrorCode } from '../../src/application/analysis/fallow-run-errors';
import type { ProcessOutcome } from '../../src/application/ports/analyzer-process';
import { fallowText } from '../fixtures/fallow-fixture';

const exited = (exitCode: number, stdout: string | null): ProcessOutcome =>
  ({ kind: 'exited', exitCode, stdout, stdoutBytes: stdout === null ? 0 : stdout.length, stderrTail: '' });
const ERROR_MESSAGE = "invalid root path '/nope': No such file or directory (os error 2)";
const ERROR_JSON = JSON.stringify({ error: true, message: ERROR_MESSAGE, exit_code: 2 });
const REPORT = fallowText('combined-3.27.0');

describe('the fallow invocation (Z15, Z16, Z10)', () => {
  it('runs combined mode with exactly these arguments, the root last and unquoted', () => {
    expect(FALLOW_RUN_ARGS('C:\\Program Files\\my repo')).toEqual(['--format', 'json', '--no-cache', '--quiet', '--root', 'C:\\Program Files\\my repo']);
    expect(FALLOW_VERSION_ARGS).toEqual(['--version']);
  });

  it('passes on only the allow-listed environment, plus NO_COLOR', () => {
    expect(FALLOW_ENV_ALLOW_LIST).toEqual(['PATH', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LOCALAPPDATA']);
    expect(FALLOW_ENV_EXTRA).toEqual({ NO_COLOR: '1' });
  });

  it('accepts a time limit only as whole seconds from 10 to 1800', () => {
    for (const ok of [10, 120, 1800]) expect(isValidTimeoutSeconds(ok), String(ok)).toBe(true);
    for (const bad of [9, 1801, 12.5, Number.NaN, '120', null]) expect(isValidTimeoutSeconds(bad), String(bad)).toBe(false);
  });
});

describe('the version probe (Z8, Z9)', () => {
  it('reads "fallow x.y.z" and says whether that version was tested', () => {
    expect(parseFallowVersion('fallow 3.27.0\n')).toEqual({ ok: true, version: '3.27.0', major: 3, tested: true });
    expect(parseFallowVersion('fallow 3.21.0')).toEqual({ ok: true, version: '3.21.0', major: 3, tested: true });
    expect(parseFallowVersion('fallow 3.28.0')).toEqual({ ok: true, version: '3.28.0', major: 3, tested: false });
    expect(FALLOW_TESTED_VERSIONS).toEqual(['3.21.0', '3.27.0']);
  });

  it('refuses anything else, including a version longer than the record can hold', () => {
    for (const bad of [null, '', '3.27.0', 'fallow v3.27.0', 'fallow 3.27', 'fallow 3.27.0 extra', `fallow ${'9'.repeat(40)}.0.0`]) {
      expect(parseFallowVersion(bad), String(bad)).toEqual({ ok: false });
    }
  });

  it('classifies every probe outcome', () => {
    expect(classifyVersionProbe(exited(0, 'fallow 3.27.0'))).toEqual({ ok: true, version: '3.27.0', tested: true });
    expect(classifyVersionProbe(exited(0, 'fallow 3.28.0'))).toEqual({ ok: true, version: '3.28.0', tested: false });
    expect(classifyVersionProbe(exited(0, 'fallow 4.0.0'))).toEqual({ ok: false, code: 'version-unsupported', detail: '4.0.0' });
    expect(classifyVersionProbe(exited(0, 'hello'))).toEqual({ ok: false, code: 'version-probe-failed', detail: 'no-version' });
    expect(classifyVersionProbe(exited(3, 'fallow 3.27.0'))).toEqual({ ok: false, code: 'version-probe-failed', detail: '3' });
    expect(classifyVersionProbe({ kind: 'timed-out', stderrTail: '' })).toEqual({ ok: false, code: 'version-probe-failed', detail: 'timeout' });
    expect(classifyVersionProbe({ kind: 'spawn-failed', errorCode: 'ENOENT' })).toEqual({ ok: false, code: 'executable-missing', detail: '' });
    expect(classifyVersionProbe({ kind: 'spawn-failed', errorCode: 'EACCES' })).toEqual({ ok: false, code: 'spawn-failed', detail: 'EACCES' });
    expect(classifyVersionProbe({ kind: 'signalled', signal: 'SIGSEGV', stderrTail: '' })).toEqual({ ok: false, code: 'version-probe-failed', detail: 'SIGSEGV' });
    expect(classifyVersionProbe({ kind: 'stdout-too-large', stderrTail: '' })).toEqual({ ok: false, code: 'version-probe-failed', detail: 'no-version' });
    expect(classifyVersionProbe({ kind: 'output-incomplete', stderrTail: '' })).toEqual({ ok: false, code: 'version-probe-failed', detail: 'no-version' });
    expect(classifyVersionProbe({ kind: 'cancelled', stderrTail: '' })).toEqual({ ok: false, code: 'version-probe-failed', detail: 'cancelled' });
  });
});

describe('exit semantics (spec §1)', () => {
  it('exit 0 or 1 with a supported report is completed: findings are not an operational failure (S8)', () => {
    for (const code of [0, 1]) {
      const result = classifyFallowExit(exited(code, REPORT), 120);
      expect(result.kind, String(code)).toBe('completed');
      if (result.kind === 'completed') expect(result.report.kind).toBe('combined');
    }
  });

  it('a cancelled run is cancelled, never failed', () => {
    expect(classifyFallowExit({ kind: 'cancelled', stderrTail: 'bye' }, 120)).toEqual({ kind: 'cancelled' });
  });

  it.each<[string, ProcessOutcome, FallowRunErrorCode, string]>([
    ['exit 0 with the error object', exited(0, ERROR_JSON), 'analyzer-error', ERROR_MESSAGE],
    ['exit 2 with the error object', exited(2, ERROR_JSON), 'analyzer-error', ERROR_MESSAGE],
    ['exit 2 with an error object and no message', exited(2, '{"error":true}'), 'analyzer-error', ''],
    ['exit 2 with a message longer than 500 characters', exited(2, JSON.stringify({ error: true, message: 'x'.repeat(600) })), 'analyzer-error', 'x'.repeat(500)],
    ['exit 2 with anything else', exited(2, 'boom'), 'exit-code', '2'],
    ['exit 0 with no output', exited(0, ''), 'output-not-json', ''],
    ['exit 0 with output that is not UTF-8', exited(0, null), 'output-not-json', ''],
    ['exit 1 with a truncated report', exited(1, REPORT.slice(0, Math.floor(REPORT.length / 2))), 'output-not-json', ''],
    ['exit 0 with an unsupported schema', exited(0, JSON.stringify({ kind: 'combined', schema_version: 99, version: '3.27.0' })), 'output-unsupported', 'combined@99'],
    ['exit 0 with an invalid report', exited(0, JSON.stringify({ kind: 'combined', schema_version: 12, version: 7 })), 'output-invalid', 'version'],
    ['exit 3', exited(3, REPORT), 'exit-code', '3'],
    ['a signal the adapter did not send', { kind: 'signalled', signal: 'SIGSEGV', stderrTail: '' }, 'exit-code', 'SIGSEGV'],
    ['the time limit', { kind: 'timed-out', stderrTail: '' }, 'timed-out', '120'],
    ['the stdout cap', { kind: 'stdout-too-large', stderrTail: '' }, 'output-too-large', ''],
    ['pipes that never closed', { kind: 'output-incomplete', stderrTail: '' }, 'output-incomplete', ''],
    ['a missing executable', { kind: 'spawn-failed', errorCode: 'ENOENT' }, 'executable-missing', ''],
    ['any other spawn failure', { kind: 'spawn-failed', errorCode: 'EACCES' }, 'spawn-failed', 'EACCES'],
  ])('%s', (_label, outcome, code, detail) => {
    expect(classifyFallowExit(outcome, 120)).toEqual({ kind: 'failed', code, detail });
  });
});

describe('run error codes (Z19)', () => {
  it('maps every Part 6 reader code onto a run code', () => {
    expect(fromImportCode('too-large')).toBe('output-too-large');
    expect(fromImportCode('not-json')).toBe('output-not-json');
    expect(fromImportCode('unsupported')).toBe('output-unsupported');
    expect(fromImportCode('invalid')).toBe('output-invalid');
    expect(fromImportCode('source-mismatch')).toBe('source-mismatch');
    expect(fromImportCode('read-failed')).toBe('output-incomplete');
  });

  it('treats exactly fourteen of the twenty-one codes as operational failures (final review: profile-removed is not one)', () => {
    expect(FALLOW_RUN_ERROR_CODES).toHaveLength(21);
    const quiet: FallowRunErrorCode[] = ['changed-since-review', 'store-unsupported', 'version-changed', 'source-mismatch', 'snapshot-changed', 'superseded', 'profile-removed'];
    for (const code of quiet) expect(OPERATIONAL_FAILURES.has(code), code).toBe(false);
    expect(OPERATIONAL_FAILURES.size).toBe(14);
    for (const code of FALLOW_RUN_ERROR_CODES.filter((c) => !quiet.includes(c))) expect(OPERATIONAL_FAILURES.has(code), code).toBe(true);
  });
});
