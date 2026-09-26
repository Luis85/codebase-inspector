// Part 7 Z6/Z7: trust is a FINGERPRINT of exactly what the user reviewed, never a bare
// boolean (architecture §6). FNV-1a, as approval.ts: it detects an incidental change, it
// does not resist a deliberate forgery (spec §6). The time limit is deliberately NOT
// covered: changing it cannot widen what runs.
import { fnv1a32Hex } from '../../domain/hash';
import { fingerprintSource } from '../approval';
import type { ExecutableFacts } from '../ports/executable-inspector';

/** Z1: stored in data.json `analyzers[profileId].trust`, only after the version probe passed. */
export interface AnalyzerTrust {
  /** Eight lower-case hex digits. */
  fingerprint: string;
  /** The probed version, `x.y.z`. */
  version: string;
  /** ISO 8601, from the Clock. */
  grantedAt: string;
}

export interface TrustSubject {
  profileId: string;
  machineId: string;
  rootPath: string;
  /** Exactly the run argv, FALLOW_RUN_ARGS(rootPath). */
  args: readonly string[];
  facts: ExecutableFacts;
}

export function fingerprintTrust(subject: TrustSubject, version: string): string {
  const f = subject.facts;
  return fnv1a32Hex(JSON.stringify({
    v: 1,
    provider: 'fallow',
    profileId: subject.profileId,
    machineId: subject.machineId,
    exe: f.executablePath,
    real: f.realPath,
    size: f.size,
    mtime: Math.trunc(f.mtimeMs),
    // Case-sensitive on purpose (M29): a root that differs only in case re-asks.
    root: fingerprintSource(subject.rootPath),
    args: subject.args,
    version,
  }));
}

/** Z7: the stored trust still describes this subject at this version. */
export function isTrustCurrent(trust: AnalyzerTrust | null, subject: TrustSubject, version: string): boolean {
  return trust !== null && trust.version === version && trust.fingerprint === fingerprintTrust(subject, version);
}
