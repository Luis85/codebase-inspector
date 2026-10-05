// Part 2 P8 / Part 3 Q15: one CSV writer for every export. Unknown evidence is an empty
// cell and its `_state` column says why, so absent evidence is never exported as 0.
import type { MetricValue } from '../evidence';

/** P8: a string cell starting with = + - @ (or tab/CR) is prefixed with ' so a
 *  spreadsheet never evaluates it. Numbers are never prefixed. */
export function csvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvColumn<T> { header: string; value: (row: T) => string | number | undefined }

export function metricColumns<T>(name: string, get: (row: T) => MetricValue<unknown>): CsvColumn<T>[] {
  return [
    { header: name, value: (row) => { const v = get(row).value; return typeof v === 'number' || typeof v === 'string' ? v : undefined; } },
    { header: `${name}_state`, value: (row) => get(row).state },
  ];
}

/** RFC 4180 line endings, and a UTF-8 byte-order mark so Excel reads non-ASCII paths. */
export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const header = columns.map((c) => csvCell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','));
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
}
