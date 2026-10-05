// GRB11 (ruling GCQ3): scope fingerprints, the file-set digest and the analysis root
// fingerprint are held in memory only, so they are 64-bit and a 32-bit collision cannot
// pass for "same scope". The persisted trust fingerprint stays 32-bit: stored grants
// must keep validating (analyzer-record.ts requires eight hex digits).
import { describe, expect, it } from 'vitest';
import { fingerprintScope, fingerprintSource } from '../../src/application/approval';
import { fingerprintTrust, type TrustSubject } from '../../src/application/analysis/analyzer-trust';
import { fnv1a32Hex, fnv1a64Hex } from '../../src/domain/hash';
import type { AnalysisScope } from '../../src/domain/model';

// Two roots that collide under FNV-1a-32 once normalised (found by brute force), differing
// only in the last path segment.
const ROOT_A = 'C:\\repo\\ojcraj';
const ROOT_B = 'C:\\repo\\yjmtap';
// Two exclusions whose scope payloads collide under FNV-1a-32.
const EXCL_A = 'mnshml';
const EXCL_B = 'qjclup';

function scopeWith(exclusion: string): AnalysisScope {
  return { rootPath: 'C:\\repo', exclusions: [exclusion], maxFileBytes: 1_000_000, followSymlinks: false };
}

function scopePayload(exclusion: string): string {
  return JSON.stringify({ exclusions: [exclusion], maxFileBytes: 1_000_000, followSymlinks: false });
}

describe('64-bit in-memory fingerprints (GRB11)', () => {
  it('the colliding pairs really collide at 32 bits (precondition)', () => {
    expect(fnv1a32Hex('C:/repo/ojcraj')).toBe(fnv1a32Hex('C:/repo/yjmtap'));
    expect(fnv1a32Hex(scopePayload(EXCL_A))).toBe(fnv1a32Hex(scopePayload(EXCL_B)));
  });

  it('(a) fingerprintSource tells two 32-bit-colliding roots apart, in 16 hex digits', () => {
    expect(fingerprintSource(ROOT_A)).not.toBe(fingerprintSource(ROOT_B));
    expect(fingerprintSource(ROOT_A)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('(b) fingerprintScope tells two 32-bit-colliding exclusion lists apart, in 16 hex digits', () => {
    expect(fingerprintScope(scopeWith(EXCL_A))).not.toBe(fingerprintScope(scopeWith(EXCL_B)));
    expect(fingerprintScope(scopeWith(EXCL_A))).toMatch(/^[0-9a-f]{16}$/);
  });

  it('fnv1a64Hex matches the published FNV-1a 64-bit vectors', () => {
    expect(fnv1a64Hex('')).toBe('cbf29ce484222325');
    expect(fnv1a64Hex('a')).toBe('af63dc4c8601ec8c');
    expect(fnv1a64Hex('foobar')).toBe('85944171f73967e8');
  });

  it('hashes UTF-16 code units, as the 32-bit function does', () => {
    expect(fnv1a64Hex('\u00e9\u4e2d')).toMatch(/^[0-9a-f]{16}$/);
    expect(fnv1a64Hex('\u00e9')).not.toBe(fnv1a64Hex('e'));
  });

  it('(c) the persisted trust fingerprint is unchanged, 32-bit', () => {
    const subject: TrustSubject = {
      profileId: 'p1', machineId: 'm1', rootPath: 'C:\\repo', args: ['--root', 'C:\\repo'],
      facts: {
        executablePath: 'C:\\Tools\\fallow\\fallow.exe', realPath: 'C:\\Tools\\fallow\\fallow.exe',
        size: 12_400_000, mtimeMs: 1_758_600_000_123.75, format: 'pe', insideRoot: false,
      },
    };
    // Recorded from the unchanged code at 682f2bc, before fingerprintTrust stopped using fingerprintSource.
    expect(fingerprintTrust(subject, '')).toBe('c5b6acfb');
  });
});
