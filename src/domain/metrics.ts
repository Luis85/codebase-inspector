/** Physical lines: empty text is 0; CRLF is ONE separator; a trailing newline adds no
 *  phantom line; blank and comment lines count. Binary, undecodable, skipped and
 *  oversized content never reach this function — they yield status 'unavailable' with a
 *  reason and a NULL value, never 0. */
export function countPhysicalLines(text: string): number {
  if (text.length === 0) return 0;
  const normalized = text.replace(/\r\n/g, '\n');
  const trimmed = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
  return trimmed.split('\n').length;
}

export function byteSize(bytes: Uint8Array): number {
  return bytes.byteLength;
}

// TWO METRICS ONLY (spec 4.1). Adding a third is a section 4 contract change.
export const METRIC_PHYSICAL_LINES = {
  metricId: 'physical-lines', unit: 'lines', definitionVersion: '1',
} as const;

export const METRIC_BYTE_SIZE = {
  metricId: 'byte-size', unit: 'bytes', definitionVersion: '1',
} as const;
