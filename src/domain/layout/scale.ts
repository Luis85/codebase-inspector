/**
 * The cap is the 95th percentile of measured physical-lines in the snapshot, floored at
 * 100 lines and rounded UP to two significant figures — NOT hardcoded at 600.
 *
 * A percentile rather than the maximum, because deriving the cap as max(lines) would
 * make clampedCount permanently 0 and the cap fixture unsatisfiable. A hardcoded cap is
 * either never reached or wrong for the next repository.
 *
 * Accepted consequence, stated rather than discovered: a file's height depends on
 * unrelated files, so the same file changes height between refreshes.
 *
 * Ruling M14: the same algorithm and the same 100-unit floor serve byte-size too. For
 * byte-size the floor is 100 BYTES, which is small but harmless — inventing a second,
 * metric-specific floor is not authorised by spec 4.3.
 */
export function deriveCap(measuredValues: readonly number[]): number {
  if (measuredValues.length === 0) return 100;
  const sorted = [...measuredValues].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  const p95 = Math.max(100, sorted[Math.max(0, idx)]!);
  return roundUpToTwoSignificantFigures(p95);
}

function roundUpToTwoSignificantFigures(value: number): number {
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.ceil(value / magnitude) * magnitude;
}

/** height = 8 + 120 * sqrt(min(lines, cap) / cap). The 8-unit base keeps an empty
 *  MEASURED file selectable. */
export function heightFor(value: number, cap: number): number {
  return 8 + 120 * Math.sqrt(Math.min(value, cap) / cap);
}

const SCALE_NAME ='physical lines · square-root scale';

/** Ruling M14: computeLayout's opts.metricId accepts 'physical-lines' | 'byte-size'.
 *  Both metrics share deriveCap/heightFor verbatim; only the unit and display name
 *  differ per metric, and physical-lines is the default when opts is omitted. */
export function unitForMetric(metricId: 'physical-lines' | 'byte-size'): 'lines' | 'bytes' {
  return metricId === 'physical-lines' ? 'lines' : 'bytes';
}

export function scaleNameFor(metricId: 'physical-lines' | 'byte-size'): string {
  return metricId === 'physical-lines' ? SCALE_NAME : 'byte size · square-root scale';
}
