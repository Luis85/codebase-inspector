// WP-04 IN10 (IP17): an exact line highlight only when EVERY check holds, in this order: report
// current, size, lines, modified, line-range. The first that fails is named, with a cause
// (`changed` or `unknown`). An unknown input fails its check towards stale, never towards exact.
// A finding with no line is its own verdict, never exact.
export type LocationCheck = 'report' | 'size' | 'lines' | 'modified' | 'line-range';

export interface LocationInputs {
  readonly reportCurrent: boolean;
  readonly observedBytes: number | null; readonly observedLines: number | null;
  readonly currentBytes: number | null; readonly currentLines: number | null; readonly currentMtimeMs: number | null;
  readonly analysedAt: string | null; readonly line: number | null;
}

export type LocationVerdict =
  | { readonly exact: true; readonly line: number }
  | { readonly exact: false; readonly failed: LocationCheck; readonly cause: 'changed' | 'unknown' }
  | { readonly exact: false; readonly failed: 'no-line' };

function compare(observed: number | null, current: number | null): 'changed' | 'unknown' | null {
  if (observed === null || current === null) return 'unknown';
  return observed === current ? null : 'changed';
}

export function locationVerdict(i: LocationInputs): LocationVerdict {
  if (i.line === null) return { exact: false, failed: 'no-line' };
  if (!i.reportCurrent) return { exact: false, failed: 'report', cause: 'changed' };
  const size = compare(i.observedBytes, i.currentBytes);
  if (size !== null) return { exact: false, failed: 'size', cause: size };
  const lines = compare(i.observedLines, i.currentLines);
  if (lines !== null) return { exact: false, failed: 'lines', cause: lines };
  const analysed = i.analysedAt === null ? Number.NaN : Date.parse(i.analysedAt);
  if (i.currentMtimeMs === null || Number.isNaN(analysed)) return { exact: false, failed: 'modified', cause: 'unknown' };
  if (i.currentMtimeMs > analysed) return { exact: false, failed: 'modified', cause: 'changed' };
  if (i.currentLines === null || i.line < 1 || i.line > i.currentLines) return { exact: false, failed: 'line-range', cause: 'changed' };
  return { exact: true, line: i.line };
}
