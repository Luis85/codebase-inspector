// Part 7 §2: the run copy. COPY-15 is pinned against its own catalogue row (the microcopy
// contract sweeps copy.ts only, K43); every run error code has a message; refusals decode;
// and G6's "Do not claim an OS sandbox": the only copy that says "sandbox" says it is not one.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FALLOW_RUN_ERROR_CODES } from '../../src/application/analysis/fallow-run-errors';
import {
  COPY_15, FALLOW_EXE_FORGET_FAILED, FALLOW_EXE_REFUSED_TEXT, FALLOW_REVIEW_EFFECTS, FALLOW_RUN_ERROR, FALLOW_RUN_PROBING, FALLOW_RUN_RUNNING,
} from '../../src/ui/inspector-copy';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

describe('run copy (spec §2)', () => {
  it('COPY-15 is the catalogue row, with the provider substituted', () => {
    const catalogue = readFileSync(join(REPO, 'docs', 'concept', 'design', 'interactions', '04-microcopy.md'), 'utf8');
    const row = catalogue.split('\n').find((line) => line.startsWith('| COPY-15 |'));
    expect(row).toBeDefined();
    const text = row!.split('|')[3]!.trim();
    expect(COPY_15('fallow')).toBe(text.replace('{provider}', 'fallow'));
  });

  it('has a message for every run error code', () => {
    expect(Object.keys(FALLOW_RUN_ERROR).sort()).toEqual([...FALLOW_RUN_ERROR_CODES].sort());
    for (const code of FALLOW_RUN_ERROR_CODES) expect(FALLOW_RUN_ERROR[code]('x').length, code).toBeGreaterThan(10);
  });

  it('decodes an executable refusal and its detail (K35)', () => {
    expect(FALLOW_EXE_REFUSED_TEXT('wrong-name:fallow.exe')).toBe('That file is not named fallow.exe. Choose the native fallow executable.');
    expect(FALLOW_EXE_REFUSED_TEXT('unreadable:EACCES')).toBe('Could not read that file’s details (EACCES).');
    expect(FALLOW_EXE_REFUSED_TEXT('not-native')).toBe('That file is not a native executable for this computer. Choose the fallow binary built for this system.');
    expect(FALLOW_RUN_ERROR['executable-refused']('launcher:fallow.exe')).toContain('launcher script');
  });

  it('says current findings stay only when there are some (K26)', () => {
    expect(FALLOW_RUN_PROBING(true)).toBe('Checking the fallow version… Current findings stay available.');
    expect(FALLOW_RUN_PROBING(false)).toBe('Checking the fallow version…');
    expect(FALLOW_RUN_RUNNING('project', '23 Sept 2026, 10:00', 120, true))
      .toBe('fallow is analysing “project”. Started 23 Sept 2026, 10:00; it is stopped after 120 seconds. Current findings stay until it finishes.');
    expect(FALLOW_RUN_RUNNING('project', 'now', 120, false)).toBe('fallow is analysing “project”. Started now; it is stopped after 120 seconds.');
  });

  it('names the version-probe details in words', () => {
    expect(FALLOW_RUN_ERROR['version-probe-failed']('timeout')).toBe('fallow did not report its version within 5 seconds. Nothing was analysed.');
    expect(FALLOW_RUN_ERROR['version-probe-failed']('no-version')).toBe('That file did not report a fallow version. Nothing was analysed.');
    expect(FALLOW_RUN_ERROR['version-probe-failed']('3')).toBe('fallow’s version check ended with exit code 3. Nothing was analysed.');
    expect(FALLOW_RUN_ERROR['version-probe-failed']('SIGSEGV')).toBe('fallow’s version check ended unexpectedly (SIGSEGV). Nothing was analysed.');
    expect(FALLOW_RUN_ERROR['exit-code']('3')).toBe('fallow ended unexpectedly with exit code 3.');
    expect(FALLOW_RUN_ERROR['output-too-large']('')).toBe('fallow’s output was larger than 16 MB, so it was stopped and nothing was read.');
  });

  it('Polish C9 (QF10): a failed Forget says nothing was changed', () => {
    expect(FALLOW_EXE_FORGET_FAILED).toContain('Nothing was changed.');
  });

  it('G6: no copy claims a sandbox; the one mention says it is not one', () => {
    const dir = join(REPO, 'src', 'ui', 'audit-copy');
    const lines = readdirSync(dir).flatMap((name) => readFileSync(join(dir, name), 'utf8').split('\n')).filter((l) => /sandbox/i.test(l));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('This is not a sandbox');
    expect(FALLOW_REVIEW_EFFECTS[3]).toBe('Runs with your user account’s permissions. This is not a sandbox: the executable can read and change anything your account can.');
  });
});
