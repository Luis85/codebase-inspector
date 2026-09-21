// WP-02 spec §3.2: every displayed signal carries its evidence state, so a missing value
// can never be rendered as a measured zero and sample data is always labelled.
export type EvidenceState = 'collected' | 'sample' | 'unknown' | 'stale' | 'partial' | 'failed' | 'excluded';

export interface Provenance { source: string; detail?: string }

export interface MetricValue<T = number> {
  state: EvidenceState;
  value?: T;
  provenance: Provenance;
  /** Why there is no value (required in practice for unknown/failed/excluded). */
  reason?: string;
}

export const EVIDENCE_LABELS: Readonly<Record<EvidenceState, string>> = {
  collected: 'Collected', sample: 'Sample', unknown: 'Unknown', stale: 'Stale',
  partial: 'Partial', failed: 'Failed', excluded: 'Excluded',
};

function provenance(source: string, detail?: string): Provenance {
  return detail === undefined ? { source } : { source, detail };
}

export function collected<T>(value: T, source: string, detail?: string): MetricValue<T> {
  return { state: 'collected', value, provenance: provenance(source, detail) };
}

export function sample<T>(value: T, detail?: string): MetricValue<T> {
  return { state: 'sample', value, provenance: provenance('sample', detail) };
}

export function unknown<T = number>(reason: string, source = 'none'): MetricValue<T> {
  return { state: 'unknown', provenance: { source }, reason };
}

export function hasValue<T>(m: MetricValue<T>): m is MetricValue<T> & { value: T } {
  return m.value !== undefined;
}

/** Fixed en-US grouping (the same fixed-locale rule copy.ts's time formatter follows). */
export function formatMetric(m: MetricValue, unit = ''): string {
  if (!hasValue(m)) return '—';
  return `${m.value.toLocaleString('en-US')}${unit}`;
}

/** States that carry a value, strongest first. An aggregate takes the WEAKEST state
 *  among its inputs (Part 2 §4, A13): partial > stale > sample > collected. */
const WITH_VALUE: readonly EvidenceState[] = ['collected', 'sample', 'stale', 'partial'];

function weakest(states: readonly EvidenceState[]): EvidenceState {
  return states.reduce<EvidenceState>((w, s) => (WITH_VALUE.indexOf(s) > WITH_VALUE.indexOf(w) ? s : w), 'collected');
}

function sharedSource(inputs: readonly MetricValue<unknown>[]): string {
  const first = inputs[0]?.provenance.source ?? 'aggregate';
  return inputs.every((m) => m.provenance.source === first) ? first : 'aggregate';
}

type Present = MetricValue & { value: number };

/** Spec §9 A13: one value computed from many. No inputs, or no input with a value, is
 *  `unknown`. Some inputs without a value is `partial`: the value covers only the present
 *  inputs, and the reason says how many are missing. A missing input is never counted
 *  as 0. */
export function aggregate<T>(
  inputs: readonly MetricValue[], compute: (present: readonly number[]) => T,
  emptyReason = 'Nothing to aggregate.',
): MetricValue<T> {
  if (inputs.length === 0) return unknown<T>(emptyReason);
  const present = inputs.filter((m): m is Present => hasValue(m));
  if (present.length === 0) return unknown<T>(inputs[0]?.reason ?? 'No input has a value.');
  const value = compute(present.map((m) => m.value));
  const prov = { source: sharedSource(present) };
  if (present.length < inputs.length) {
    return { state: 'partial', value, provenance: prov, reason: `${inputs.length - present.length} of ${inputs.length} inputs missing.` };
  }
  return { state: weakest(present.map((m) => m.state)), value, provenance: prov };
}

export function sumEvidence(inputs: readonly MetricValue[], emptyReason?: string): MetricValue {
  return aggregate(inputs, (vs) => vs.reduce((a, b) => a + b, 0), emptyReason);
}

export function countEvidence(inputs: readonly MetricValue[], predicate: (value: number) => boolean, emptyReason?: string): MetricValue {
  return aggregate(inputs, (vs) => vs.filter(predicate).length, emptyReason);
}

/** Rounded `numerator / denominator × scale`. Both sides must have a value, and a zero
 *  denominator is unknown, never a 0 %. */
export function ratioEvidence(numerator: MetricValue, denominator: MetricValue, scale = 100): MetricValue {
  if (!hasValue(numerator)) return unknown(numerator.reason ?? 'Numerator unavailable.');
  if (!hasValue(denominator)) return unknown(denominator.reason ?? 'Denominator unavailable.');
  if (denominator.value === 0) return unknown('Nothing to divide by.');
  const reason = [numerator, denominator].find((m) => m.state === 'partial')?.reason;
  const result: MetricValue = {
    state: weakest([numerator.state, denominator.state]),
    value: Math.round((numerator.value / denominator.value) * scale),
    provenance: { source: sharedSource([numerator, denominator]) },
  };
  return reason === undefined ? result : { ...result, reason };
}

/** True when a value rests on sample data, even when aggregation made it partial. */
export function isSampleBacked(m: MetricValue<unknown>): boolean {
  return m.state === 'sample' || m.provenance.source === 'sample';
}
