// Task 7 step 1 (brief-verbatim test code, plus ruling M29's two-part fix): approval is
// a modelled artefact (spec 4.1) -- "opening a view is not authorisation" needs
// something to check, and a scope fingerprint is what makes "a changed root
// invalidates approval" mechanical rather than advisory.
import { describe, expect, it } from 'vitest';
import { approve, fingerprintScope, fingerprintSource, isApprovalValid } from '../../src/application/approval';
import { createFixedClock } from '../fixtures/clock';
import type { AnalysisScope } from '../../src/domain/model';

const scope: AnalysisScope = {
  rootPath: 'C:\\Projects\\app', exclusions: ['.git', 'node_modules'],
  maxFileBytes: 1_000_000, followSymlinks: false,
};
const clock = createFixedClock();

describe('approval', () => {
  it('is valid for the exact root and scope it was granted for', () => {
    const a = approve('p1', scope.rootPath, scope, clock);
    expect(isApprovalValid(a, scope.rootPath, scope)).toBe(true);
  });

  it('is INVALIDATED by a changed root', () => {
    const a = approve('p1', scope.rootPath, scope, clock);
    expect(isApprovalValid(a, 'C:\\Projects\\other', scope)).toBe(false);
  });

  it('is INVALIDATED by a changed exclusion list', () => {
    const a = approve('p1', scope.rootPath, scope, clock);
    expect(isApprovalValid(a, scope.rootPath, { ...scope, exclusions: ['.git'] })).toBe(false);
  });

  it('is INVALIDATED by a changed size limit', () => {
    const a = approve('p1', scope.rootPath, scope, clock);
    expect(isApprovalValid(a, scope.rootPath, { ...scope, maxFileBytes: 2_000_000 })).toBe(false);
  });

  // Ruling M29 part 1: the brief's original test named this "case or trailing
  // separator" but its body only ever exercised the separator, and asserted the
  // (correct) non-invalidating direction -- a false description of its own body.
  // Renamed to say what it actually proves: a trailing separator resolves to the SAME
  // root and stays valid, while a prefix-collision sibling does not.
  it('is valid across a trailing separator (same resolved root), and invalid for a prefix-collision sibling', () => {
    const a = approve('p1', 'C:\\Projects\\app', scope, clock);
    expect(isApprovalValid(a, 'C:\\Projects\\app\\', scope)).toBe(true);   // same resolved root
    expect(isApprovalValid(a, 'C:\\Projects\\app-evil', scope)).toBe(false);
  });

  // Ruling M29 part 2: case was never tested despite being named in the original
  // test. fingerprintSource is deliberately CASE-SENSITIVE (unlike isContained, which
  // defers to the platform) -- see the comment at fingerprintSource for why the two
  // functions disagree on purpose.
  it('is INVALIDATED by a root that differs only in case (fingerprintSource is case-sensitive)', () => {
    const a = approve('p1', 'C:\\Projects\\app', scope, clock);
    expect(isApprovalValid(a, 'C:\\Projects\\App', scope)).toBe(false);
  });

  // Ruling M32 (fix round 1, Important 2): AnalysisScope.rootPath is documented as
  // "resolved, absolute" (domain/model.ts), but fingerprintScope never covers it, so
  // nothing previously enforced that the `resolvedRoot` argument and `scope.rootPath`
  // actually agree. This reproduces the exact hole: an approval granted for
  // 'C:\Projects\app' is still checked with resolvedRoot='C:\Projects\app' (so
  // sourceFingerprint matches) but a SCOPE whose own rootPath has drifted to
  // 'C:\Projects\other' -- since scopeFingerprint ignores rootPath entirely, the old
  // code would have returned true here, approving a mismatch between the validated
  // root and the root that would actually drive a scan.
  it('is INVALIDATED when resolvedRoot and scope.rootPath disagree, even though scopeFingerprint never covers rootPath', () => {
    const a = approve('p1', scope.rootPath, scope, clock);
    const driftedScope: AnalysisScope = { ...scope, rootPath: 'C:\\Projects\\other' };
    expect(isApprovalValid(a, scope.rootPath, driftedScope)).toBe(false);
  });

  it('stays valid when resolvedRoot and scope.rootPath agree (the normal case)', () => {
    const a = approve('p1', scope.rootPath, scope, clock);
    expect(isApprovalValid(a, scope.rootPath, scope)).toBe(true);
  });

  it('is exclusion-order insensitive, so re-sorting does not spuriously invalidate', () => {
    expect(fingerprintScope(scope)).toBe(fingerprintScope({ ...scope, exclusions: ['node_modules', '.git'] }));
  });

  it('records the operation as read-only-inventory and nothing else', () => {
    expect(approve('p1', scope.rootPath, scope, clock).operation).toBe('read-only-inventory');
  });

  it('carries an approvedAt timestamp from the injected clock, never Date.now()', () => {
    // A fixed clock set far from the real wall-clock time: if approve() ever called
    // Date.now()/new Date() instead of using the injected clock, approvedAt would be
    // today's real date, not this deliberately-implausible one -- so this is a genuine
    // regression test, not merely a round-trip of whatever the implementation returns.
    const farClock = createFixedClock('2099-06-15T12:00:00.000Z');
    const a = approve('p1', scope.rootPath, scope, farClock);
    expect(a.approvedAt).toBe('2099-06-15T12:00:00.000Z');
  });
});

describe('fingerprintSource', () => {
  it('normalises backslashes and strips a trailing separator before hashing', () => {
    expect(fingerprintSource('C:\\Projects\\app')).toBe(fingerprintSource('C:/Projects/app/'));
  });
});
