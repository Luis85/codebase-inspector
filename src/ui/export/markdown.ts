// Part 4 W6: the Markdown writer for the refactor plan and the audit report. User text
// stays on one line where Markdown structure depends on it, table cells escape pipes,
// and every value states its evidence — "(sample)", "(partial)", or "unknown (reason)",
// never a bare 0.
import { EVIDENCE_LABELS, formatMetric, hasValue, isSampleBacked, type MetricValue } from '../evidence';

export function mdLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/^(\s*)([#>*+-])/, '$1\\$2').replace(/^(\s*\d+)\./, '$1\\.');
}

export function mdCell(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

export function mdCode(s: string): string {
  const t = s.replace(/[\r\n]+/g, ' ');
  return t.includes('`') ? `\`\` ${t} \`\`` : `\`${t}\``;
}

export function mdQuote(s: string): string {
  return s.split(/\r?\n/).map((line) => `> ${line}`).join('\n');
}

export function mdValue(m: MetricValue, unit = ''): string {
  if (!hasValue(m)) return `unknown (${m.reason ?? EVIDENCE_LABELS[m.state]})`;
  const tags: string[] = [];
  if (m.state !== 'collected' && m.state !== 'sample') tags.push(EVIDENCE_LABELS[m.state].toLowerCase());
  if (isSampleBacked(m)) tags.push('sample');
  const v = formatMetric(m, unit);
  return tags.length > 0 ? `${v} (${tags.join(', ')})` : v;
}
