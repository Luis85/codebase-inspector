// Part 7 Z19: every way a fallow run can be refused or fail. It sits BESIDE Part 6's
// FallowImportErrorCode: import refusals are about a picked file, run failures about a
// process. `detail` is always data for the copy (src/ui/audit-copy/fallow-run.ts), never copy.
import type { FallowImportErrorCode } from '../evidence/raw-fallow';

export type FallowRunErrorCode =
  | 'root-unavailable' | 'executable-missing' | 'executable-refused' | 'changed-since-review' | 'store-unsupported'
  | 'version-probe-failed' | 'version-unsupported' | 'version-changed' | 'spawn-failed' | 'timed-out'
  | 'output-too-large' | 'output-incomplete' | 'output-not-json' | 'output-unsupported' | 'output-invalid'
  | 'analyzer-error' | 'exit-code' | 'source-mismatch' | 'snapshot-changed' | 'superseded';

export const FALLOW_RUN_ERROR_CODES: readonly FallowRunErrorCode[] = [
  'root-unavailable', 'executable-missing', 'executable-refused', 'changed-since-review', 'store-unsupported',
  'version-probe-failed', 'version-unsupported', 'version-changed', 'spawn-failed', 'timed-out',
  'output-too-large', 'output-incomplete', 'output-not-json', 'output-unsupported', 'output-invalid',
  'analyzer-error', 'exit-code', 'source-mismatch', 'snapshot-changed', 'superseded',
];

/** Not operational: a changed trust subject, a newer data format, a newer snapshot or
 *  newer evidence, or a report that matches nothing. None of these marks evidence stale. */
const NOT_OPERATIONAL: readonly FallowRunErrorCode[] = [
  'changed-since-review', 'store-unsupported', 'version-changed', 'source-mismatch', 'snapshot-changed', 'superseded',
];

/** Z19/Z23: only these mark the old evidence stale, and only these (with `version-changed`)
 *  raise a Notice (Z34). */
export const OPERATIONAL_FAILURES: ReadonlySet<FallowRunErrorCode> =
  new Set(FALLOW_RUN_ERROR_CODES.filter((code) => !NOT_OPERATIONAL.includes(code)));

const FROM_IMPORT: Readonly<Record<FallowImportErrorCode, FallowRunErrorCode>> = {
  'too-large': 'output-too-large',
  'not-json': 'output-not-json',
  unsupported: 'output-unsupported',
  invalid: 'output-invalid',
  'source-mismatch': 'source-mismatch',
  // The reader never produces read-failed for text it was handed; mapped for totality.
  'read-failed': 'output-incomplete',
};

/** Z19: a Part 6 reader refusal of fallow's stdout, as a run failure. The detail is kept. */
export function fromImportCode(code: FallowImportErrorCode): FallowRunErrorCode {
  return FROM_IMPORT[code];
}
