// Task 7: "opening a view is not authorisation" needs an artefact to check against
// (spec 4.1). ApprovedInventoryRun's five fields are a frozen §4 contract -- this file
// only produces and validates that shape, never redefines it.
import type { Clock } from './ports/clock';
import type { AnalysisScope, ApprovedInventoryRun } from '../domain/model';

/** A tiny, deterministic, non-cryptographic string hash (FNV-1a). Same algorithm as
 *  inventory-collector.ts's fnv1a (duplicated rather than imported: that module's copy
 *  is scoped to fileSetDigest, a different concept, and importing across unrelated
 *  application-layer modules for eight lines is not worth the coupling). Not a security
 *  boundary -- a fingerprint exists to detect an incidental change, not to resist a
 *  deliberate forgery, and it costs no Node `crypto` dependency (no-nodejs-modules
 *  forbids importing one anywhere in src/** in any case). */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Normalises separators and strips a trailing separator, but never folds case.
 *
 *  This is deliberately NOT the same normalisation `isContained` uses (ruling M20's
 *  `options.caseSensitive`, which defers to whatever the actual platform's filesystem
 *  does). The two functions answer different questions: `isContained` asks "is this
 *  path inside that directory" -- a factual question the platform's own semantics
 *  should govern. `fingerprintSource` asks "did the user consent to open exactly THIS
 *  directory" -- a consent question, where the two error directions are not symmetric.
 *  Treating a case-differing root as STILL approved would silently extend consent the
 *  user never gave; treating it as not approved merely re-asks. For anything that gates
 *  filesystem access, the fail-safe direction is to invalidate and re-ask -- so this
 *  stays case-SENSITIVE even on a case-insensitive filesystem (ruling M29). Do not "fix"
 *  this to match isContained; the divergence is the point. */
function normalizeRootForFingerprint(resolvedRoot: string): string {
  return resolvedRoot.replace(/\\/g, '/').replace(/\/+$/, '');
}

export function fingerprintSource(resolvedRoot: string): string {
  return fnv1a(normalizeRootForFingerprint(resolvedRoot));
}

/** Sorted before hashing, so re-ordering the SAME exclusion set never spuriously
 *  invalidates an approval (acceptance criterion 3). */
export function fingerprintScope(scope: AnalysisScope): string {
  const payload = JSON.stringify({
    exclusions: [...scope.exclusions].sort(),
    maxFileBytes: scope.maxFileBytes,
    followSymlinks: scope.followSymlinks,
  });
  return fnv1a(payload);
}

/** The ONLY place an ApprovedInventoryRun is constructed. Takes the injected Clock --
 *  never Date.now(), never `new Date()` directly -- so approval timestamps are exactly
 *  as testable and deterministic as everything else this plan drives through Clock. */
export function approve(
  profileId: string, resolvedRoot: string, scope: AnalysisScope, clock: Clock,
): ApprovedInventoryRun {
  return {
    profileId,
    sourceFingerprint: fingerprintSource(resolvedRoot),
    scopeFingerprint: fingerprintScope(scope),
    approvedAt: clock.nowIso(),
    operation: 'read-only-inventory',
  };
}

/** A changed root or scope invalidates prior approval (spec 4.1, acceptance criterion
 *  2) -- mechanically, by recomputing both fingerprints and comparing, never by
 *  inspecting `approval` for anything beyond its own two fingerprint fields. */
export function isApprovalValid(
  approval: ApprovedInventoryRun, resolvedRoot: string, scope: AnalysisScope,
): boolean {
  return approval.sourceFingerprint === fingerprintSource(resolvedRoot)
    && approval.scopeFingerprint === fingerprintScope(scope);
}
