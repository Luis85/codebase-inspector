// Part 4 W6: the Markdown writer for the refactor plan and the audit report. User text
// stays on one line where Markdown structure depends on it, table cells escape pipes,
// and every value states its evidence — "(sample)", "(partial)", or "unknown (reason)",
// never a bare 0.
import { EVIDENCE_LABELS, formatMetric, hasValue, isSampleBacked, type MetricValue } from '../evidence';

// IP2: mdCode moved to src/application/markdown-code.ts (application code needs it too,
// and may not import UI). Re-exported here so report.ts, work-items.ts and
// tests/unit/markdown.test.ts do not change.
export { mdCode } from '../../application/markdown-code';

/** Controller ruling Part 4 E5 (amends X18): a leading `#`, `>`, `*`, `+`, `-`, `|` (a table
 *  row, Part 5 V25) or `N.` would start a heading, quote, or list item wherever Markdown
 *  reads it — on its own line or after a `> ` quote prefix. Shared by `mdLine` (which also
 *  flattens the text to one line first) and `mdQuote` (which escapes each line but keeps
 *  the line breaks). */
function escapeBlockStart(s: string): string {
  return s.replace(/^(\s*)([#>*+|-])/, '$1\\$2').replace(/^(\s*\d+)\./, '$1\\.');
}

export function mdLine(s: string): string {
  return escapeBlockStart(s.replace(/[\r\n]+/g, ' '));
}

export function mdCell(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

/** Ruling Part 4 E5: each line is escaped the same way `mdLine` escapes its whole input, so a
 *  note line cannot start a heading, list item or nested quote once it is inside the
 *  blockquote. Line breaks are preserved (never collapsed) — only `mdLine` flattens. */
export function mdQuote(s: string): string {
  return s.split(/\r?\n/).map((line) => `> ${escapeBlockStart(line)}`).join('\n');
}

export function mdValue(m: MetricValue, unit = ''): string {
  if (!hasValue(m)) {
    // Part 5 V25: a failed or excluded value says so rather than reading "unknown (Failed)".
    if (m.state === 'failed' || m.state === 'excluded') {
      const label = EVIDENCE_LABELS[m.state].toLowerCase();
      return m.reason ? `${label} (${m.reason})` : label;
    }
    return `unknown (${m.reason ?? EVIDENCE_LABELS[m.state]})`;
  }
  const tags: string[] = [];
  if (m.state !== 'collected' && m.state !== 'sample') tags.push(EVIDENCE_LABELS[m.state].toLowerCase());
  if (isSampleBacked(m)) tags.push('sample');
  const v = formatMetric(m, unit);
  return tags.length > 0 ? `${v} (${tags.join(', ')})` : v;
}
