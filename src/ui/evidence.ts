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
