// IP2: moved verbatim from src/ui/export/markdown.ts so application code (note-text.ts)
// can use it without importing UI. markdown.ts re-exports this so report.ts,
// work-items.ts and tests/unit/markdown.test.ts do not change.

/** The fence must be longer than the longest run of backticks already in the text, and
 *  a fence longer than one backtick (or text touching the fence) needs a space of
 *  padding so the fence markers do not merge with the content. */
export function mdCode(s: string): string {
  const t = s.replace(/[\r\n]+/g, ' ');
  const longestRun = (t.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(longestRun + 1);
  const pad = fence.length > 1 || t.startsWith('`') || t.endsWith('`');
  return `${fence}${pad ? ' ' : ''}${t}${pad ? ' ' : ''}${fence}`;
}
