// Part 7 Z1/Z2 (K27): the data.json `analyzers` slice as pure data. BOTH store
// implementations (plugin-data-analyzer-store.ts and the in-memory test double) call
// `applyAnalyzerWrite`, so their write rules cannot drift. Our own format: zod `.strict()`.
// - A newer format (`v !== 1`, a non-object entry, or a non-object slice) is READ-ONLY:
//   every write but purge is refused, so it is never overwritten (Y7's rule).
// - A malformed v1 record or another device's record is never used, and is kept as it is;
//   `bind` replaces it (an explicit user choice) and `forget` deletes it.
// - Every write changes only its own profile's entry; the others are carried over verbatim.
import { z } from 'zod';
import { normalizeAbsolutePath } from '../../domain/path-safety';
import { isPlainObject } from '../../domain/plain-data';
import { FALLOW_TIMEOUT_DEFAULT_S, FALLOW_TIMEOUT_MAX_S, FALLOW_TIMEOUT_MIN_S } from './fallow-invocation';
import type { AnalyzerTrust } from './analyzer-trust';

export interface AnalyzerBinding {
  profileId: string;
  executablePath: string;
  timeoutSeconds: number;
  trust: AnalyzerTrust | null;
}

export type AnalyzerBindingRead =
  | { kind: 'none' }
  | { kind: 'bound'; binding: AnalyzerBinding }
  | { kind: 'other-machine' }
  | { kind: 'invalid' }
  | { kind: 'unsupported' };

export type AnalyzerWrite =
  | { op: 'bind'; executablePath: string }
  | { op: 'timeout'; seconds: number }
  | { op: 'grant'; trust: AnalyzerTrust; expectedPath: string }
  | { op: 'revoke' }
  | { op: 'forget' }
  | { op: 'purge' };

export type AnalyzerStoreErrorCode = 'unsupported' | 'not-bound' | 'changed';

/** A refused write: nothing was written. The service maps the code to a run error (Z22). */
export class AnalyzerStoreError extends Error {
  readonly code: AnalyzerStoreErrorCode;

  constructor(code: AnalyzerStoreErrorCode) {
    super(`analyzer store: ${code}`);
    this.name = 'AnalyzerStoreError';
    this.code = code;
  }
}

/** K21: the stored path is exactly its own normalised form, so what is shown, stored,
 *  fingerprinted and run is one string. normalizeAbsolutePath caps it at 1,024. */
function isNormalAbsolute(path: string): boolean {
  try {
    return normalizeAbsolutePath(path) === path;
  } catch {
    return false;
  }
}

const TRUST = z.object({
  fingerprint: z.string().regex(/^[0-9a-f]{8}$/, { error: 'fingerprint must be eight lower-case hex digits' }),
  version: z.string().max(32, { error: 'version is too long' }).regex(/^\d+\.\d+\.\d+$/, { error: 'version must be x.y.z' }),
  grantedAt: z.iso.datetime({ error: 'grantedAt must be an ISO 8601 time' }),
}).strict();

const RECORD = z.object({
  v: z.literal(1),
  provider: z.literal('fallow'),
  machineId: z.string().min(1).max(100),
  executablePath: z.string().min(1).max(1024).refine(isNormalAbsolute, { error: 'executablePath must be a normalised absolute path' }),
  timeoutSeconds: z.number().int().min(FALLOW_TIMEOUT_MIN_S).max(FALLOW_TIMEOUT_MAX_S),
  trust: TRUST.nullable(),
}).strict();

function ownEntry(slice: Record<string, unknown>, profileId: string): unknown {
  return Object.prototype.hasOwnProperty.call(slice, profileId) ? slice[profileId] : undefined;
}

/** Z2: `slice` is data.json's whole `analyzers` value. */
export function decodeAnalyzerRecord(slice: unknown, profileId: string, machineId: string): AnalyzerBindingRead {
  if (slice === undefined) return { kind: 'none' };
  if (!isPlainObject(slice)) return { kind: 'unsupported' };
  const entry = ownEntry(slice, profileId);
  if (entry === undefined) return { kind: 'none' };
  if (!isPlainObject(entry) || entry.v !== 1) return { kind: 'unsupported' };
  const parsed = RECORD.safeParse(entry);
  if (!parsed.success) return { kind: 'invalid' };
  if (parsed.data.machineId !== machineId) return { kind: 'other-machine' };
  const { executablePath, timeoutSeconds, trust } = parsed.data;
  return { kind: 'bound', binding: { profileId, executablePath, timeoutSeconds, trust } };
}

function withoutEntry(slice: Record<string, unknown>, profileId: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(slice).filter(([key]) => key !== profileId));
}

function withEntry(slice: Record<string, unknown>, profileId: string, machineId: string, b: Omit<AnalyzerBinding, 'profileId'>): Record<string, unknown> {
  const record = RECORD.parse({ v: 1, provider: 'fallow', machineId, executablePath: b.executablePath, timeoutSeconds: b.timeoutSeconds, trust: b.trust });
  return { ...withoutEntry(slice, profileId), [profileId]: record };
}

/** Z2/Z3: the new `analyzers` value after one write. Pure: it never mutates `slice`. */
export function applyAnalyzerWrite(slice: unknown, profileId: string, machineId: string, write: AnalyzerWrite): unknown {
  if (write.op === 'purge') {
    if (!isPlainObject(slice) || ownEntry(slice, profileId) === undefined) return slice;
    return withoutEntry(slice, profileId);
  }
  const read = decodeAnalyzerRecord(slice, profileId, machineId);
  if (read.kind === 'unsupported') throw new AnalyzerStoreError('unsupported');
  const base: Record<string, unknown> = isPlainObject(slice) ? slice : {};
  if (write.op === 'bind') {
    const timeoutSeconds = read.kind === 'bound' ? read.binding.timeoutSeconds : FALLOW_TIMEOUT_DEFAULT_S;
    return withEntry(base, profileId, machineId, { executablePath: write.executablePath, timeoutSeconds, trust: null });
  }
  if (write.op === 'forget') return read.kind === 'none' ? slice : withoutEntry(base, profileId);
  if (read.kind !== 'bound') throw new AnalyzerStoreError('not-bound');
  const b = read.binding;
  if (write.op === 'timeout') return withEntry(base, profileId, machineId, { ...b, timeoutSeconds: write.seconds });
  if (write.op === 'grant') {
    if (b.executablePath !== write.expectedPath) throw new AnalyzerStoreError('changed');
    return withEntry(base, profileId, machineId, { ...b, trust: write.trust });
  }
  return withEntry(base, profileId, machineId, { ...b, trust: null });
}
