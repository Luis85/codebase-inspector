// Part 7 Z1/Z2 (K27) + Part B GRB10/GCO23: the data.json `analyzers` slice as pure data. BOTH
// store implementations (plugin-data-analyzer-store.ts and the in-memory test double) call
// `applyAnalyzerWrite`, so their write rules cannot drift. Our own format: zod `.strict()`.
// - Record v2 is one entry per profile holding one binding PER DEVICE (GCO23, reversing K2):
//   `{ v: 2, provider: 'fallow', devices: { [machineId]: { executablePath, timeoutSeconds, trust } } }`.
//   A bind on one device never touches another device's binding.
// - A v1 record (one device) reads as a one-device v2 and is migrated by the next write on any
//   device: every write stores v2 and carries the other devices over verbatim (GCN10).
// - A newer or foreign format (`v` neither 1 nor 2, a `provider` present and other than 'fallow', a
//   non-object entry, or a non-object slice) is READ-ONLY (a missing provider reads invalid, E50):
//   every write but purge is refused, so it is never overwritten (Y7's rule, GCQ6).
// - A malformed entry or device reads as `invalid` with a reason naming the field. It is never
//   used and is kept as it is; `bind` replaces only this device, `forget` removes only this device.
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
  /** This device has no binding for the profile (other devices may have; they are not shown). */
  | { kind: 'none' }
  | { kind: 'bound'; binding: AnalyzerBinding }
  /** GRB10: this device's entry (or the entry around it) is malformed; `reason` names the field. */
  | { kind: 'invalid'; reason: string }
  | { kind: 'unsupported' }
  /** GRB13 a: the profile was removed (purged) this session. Only the service answers it (the
   *  stores never do), so a view left open on it offers no Choose; see `readBinding`. */
  | { kind: 'removed' };

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

const MACHINE_ID = z.string().min(1).max(100);

const DEVICE_FIELDS = {
  executablePath: z.string().min(1).max(1024).refine(isNormalAbsolute, { error: 'executablePath must be a normalised absolute path' }),
  timeoutSeconds: z.number().int().min(FALLOW_TIMEOUT_MIN_S).max(FALLOW_TIMEOUT_MAX_S),
  trust: TRUST.nullable(),
};
const DEVICE = z.object(DEVICE_FIELDS).strict();
type Device = z.infer<typeof DEVICE>;
/** v1: the one device is named by the record's own `machineId`. */
const V1 = z.object({ v: z.literal(1), provider: z.literal('fallow'), machineId: MACHINE_ID, ...DEVICE_FIELDS }).strict();
/** v2: the envelope only; each device is validated on its own (GRB10), so one device's bad
 *  entry never hides another's. */
const V2 = z.object({ v: z.literal(2), provider: z.literal('fallow'), devices: z.record(z.string(), z.unknown()) }).strict();

/** The first issue as text that names the field: "<path>: <message>", or the message alone when
 *  it already names the field (the custom messages above do). */
function reasonOf(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return 'the record does not match its format';
  const path = issue.path.map(String);
  const last = path[path.length - 1];
  if (last === undefined || issue.message.startsWith(last)) return issue.message;
  return `${path.join('.')}: ${issue.message}`;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function ownEntry(slice: Record<string, unknown>, profileId: string): unknown {
  return hasOwn(slice, profileId) ? slice[profileId] : undefined;
}

function without(record: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

/** `others` is every OTHER device's binding, verbatim (a malformed one included). `hasDevice` on
 *  an invalid entry says whether the fault is this device's (or cannot be pinned on another):
 *  Forget removes only then, and is otherwise a no-op (E44 b). */
type ParsedEntry =
  | { status: 'unsupported' }
  | { status: 'invalid'; reason: string; others: Record<string, unknown>; hasDevice: boolean }
  | { status: 'ok'; own: Device | undefined; others: Record<string, unknown> };

function parseEntry(entry: unknown, machineId: string): ParsedEntry {
  if (!isPlainObject(entry) || (entry.v !== 1 && entry.v !== 2)) return { status: 'unsupported' };
  // E44 c: an entry of another provider is not ours to read or relabel (read-only, like a newer v).
  // E50: a MISSING provider is likelier corruption than a foreign format, so it reads invalid.
  if (entry.provider !== undefined && entry.provider !== 'fallow') return { status: 'unsupported' };
  if (entry.v === 1) {
    const parsed = V1.safeParse(entry);
    if (!parsed.success) {
      // E44 a: a malformed v1 record whose `machineId` names ANOTHER device is that device's: it reads
      // as none here and is carried verbatim into devices (its owner then reads it as invalid).
      const owner = MACHINE_ID.safeParse(entry.machineId);
      if (owner.success && owner.data !== machineId) {
        const fields = Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'v' && key !== 'provider' && key !== 'machineId'));
        return { status: 'ok', own: undefined, others: { [owner.data]: fields } };
      }
      return { status: 'invalid', reason: reasonOf(parsed.error), others: {}, hasDevice: true };
    }
    const { machineId: owner, executablePath, timeoutSeconds, trust } = parsed.data;
    const device = { executablePath, timeoutSeconds, trust };
    return owner === machineId ? { status: 'ok', own: device, others: {} } : { status: 'ok', own: undefined, others: { [owner]: device } };
  }
  const parsed = V2.safeParse(entry);
  if (!parsed.success) {
    const { devices } = entry;
    const attributable = isPlainObject(devices);
    return {
      status: 'invalid', reason: reasonOf(parsed.error), others: attributable ? without(devices, machineId) : {},
      hasDevice: !attributable || hasOwn(devices, machineId),
    };
  }
  const { devices } = parsed.data;
  const others = without(devices, machineId);
  if (!hasOwn(devices, machineId)) return { status: 'ok', own: undefined, others };
  const own = DEVICE.safeParse(devices[machineId]);
  if (!own.success) return { status: 'invalid', reason: reasonOf(own.error), others, hasDevice: true };
  return { status: 'ok', own: own.data, others };
}

/** Z2: `slice` is data.json's whole `analyzers` value. */
export function decodeAnalyzerRecord(slice: unknown, profileId: string, machineId: string): AnalyzerBindingRead {
  if (slice === undefined) return { kind: 'none' };
  if (!isPlainObject(slice)) return { kind: 'unsupported' };
  const entry = ownEntry(slice, profileId);
  if (entry === undefined) return { kind: 'none' };
  const parsed = parseEntry(entry, machineId);
  if (parsed.status === 'unsupported') return { kind: 'unsupported' };
  if (parsed.status === 'invalid') return { kind: 'invalid', reason: parsed.reason };
  if (parsed.own === undefined) return { kind: 'none' };
  const { executablePath, timeoutSeconds, trust } = parsed.own;
  return { kind: 'bound', binding: { profileId, executablePath, timeoutSeconds, trust } };
}

function withoutEntry(slice: Record<string, unknown>, profileId: string): Record<string, unknown> {
  return without(slice, profileId);
}

/** Always v2: this device's binding on top of the other devices' (carried verbatim). */
function withDevice(slice: Record<string, unknown>, profileId: string, machineId: string, others: Record<string, unknown>, device: Device): Record<string, unknown> {
  const entry = { v: 2, provider: 'fallow', devices: { ...others, [MACHINE_ID.parse(machineId)]: DEVICE.parse(device) } };
  return { ...withoutEntry(slice, profileId), [profileId]: entry };
}

/** Z2/Z3: the new `analyzers` value after one write. Pure: it never mutates `slice`. */
export function applyAnalyzerWrite(slice: unknown, profileId: string, machineId: string, write: AnalyzerWrite): unknown {
  if (write.op === 'purge') {
    if (!isPlainObject(slice) || ownEntry(slice, profileId) === undefined) return slice;
    return withoutEntry(slice, profileId);
  }
  if (slice !== undefined && !isPlainObject(slice)) throw new AnalyzerStoreError('unsupported');
  const base: Record<string, unknown> = isPlainObject(slice) ? slice : {};
  const entry = ownEntry(base, profileId);
  const parsed: ParsedEntry = entry === undefined ? { status: 'ok', own: undefined, others: {} } : parseEntry(entry, machineId);
  if (parsed.status === 'unsupported') throw new AnalyzerStoreError('unsupported');
  const own = parsed.status === 'ok' ? parsed.own : undefined;
  if (write.op === 'bind') {
    const device = { executablePath: write.executablePath, timeoutSeconds: own?.timeoutSeconds ?? FALLOW_TIMEOUT_DEFAULT_S, trust: null };
    return withDevice(base, profileId, machineId, parsed.others, device);
  }
  if (write.op === 'forget') {
    if (parsed.status === 'ok' ? own === undefined : !parsed.hasDevice) return slice;
    if (Object.keys(parsed.others).length === 0) return withoutEntry(base, profileId);
    return { ...withoutEntry(base, profileId), [profileId]: { v: 2, provider: 'fallow', devices: parsed.others } };
  }
  if (own === undefined) throw new AnalyzerStoreError('not-bound');
  if (write.op === 'timeout') return withDevice(base, profileId, machineId, parsed.others, { ...own, timeoutSeconds: write.seconds });
  if (write.op === 'grant') {
    if (own.executablePath !== write.expectedPath) throw new AnalyzerStoreError('changed');
    return withDevice(base, profileId, machineId, parsed.others, { ...own, trust: write.trust });
  }
  return withDevice(base, profileId, machineId, parsed.others, { ...own, trust: null });
}
