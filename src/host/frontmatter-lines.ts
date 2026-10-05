// Gap closure GRB5: a refresh changes two frontmatter values (snapshot_id and source_path). Obsidian's
// processFrontMatter re-serialises the whole block and drops the person's comments and quoting, so the note's own
// text is edited line by line here instead. Pure: no Obsidian import. The rewrite refuses (`ok: false`) whenever it
// cannot tell exactly which bytes a key owns, and the caller then falls back to processFrontMatter.
export interface RefreshedValues { readonly snapshot_id: string; readonly source_path: string }
export type FrontmatterRewrite = { readonly ok: true; readonly text: string } | { readonly ok: false };

const KEYS = ['snapshot_id', 'source_path'] as const;
type Key = typeof KEYS[number];

const REFUSED: FrontmatterRewrite = { ok: false };
// A line with its own terminator kept, so a CRLF note stays CRLF.
const LINES = /[^\n]*\n|[^\n]+$/g;
const KEY_LINE = /^(snapshot_id|source_path):(?:[ \t]+(.*?))?[ \t]*$/;
// Any line that names one of the keys without being a plain top-level `key:` line (indented, or quoted).
const OTHER_KEY_LINE = /^[ \t]*["']?(?:snapshot_id|source_path)["']?[ \t]*:/;
// Characters JSON leaves raw that a YAML double-quoted scalar must not hold unescaped.
const YAML_UNSAFE = /[\u007f-\u009f\u2028\u2029\ufeff]/g;

function terminator(line: string): string {
  return line.endsWith('\r\n') ? '\r\n' : line.endsWith('\n') ? '\n' : '';
}

function content(line: string): string {
  return line.slice(0, line.length - terminator(line).length);
}

/** The scalar as one YAML double-quoted line: JSON string escaping, plus \u escapes for the few characters YAML
 *  will not take raw. */
function scalar(value: string): string {
  return JSON.stringify(value).replace(YAML_UNSAFE, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

// A quoted value closing on this line with nothing after it (so no trailing comment).
function closesCleanly(value: string, quote: '"' | "'"): boolean {
  for (let i = 1; i < value.length; i += 1) {
    const c = value.charAt(i);
    if (quote === '"' && c === '\\') { i += 1; continue; }
    if (c !== quote) continue;
    if (quote === "'" && value.charAt(i + 1) === "'") { i += 1; continue; }
    return value.slice(i + 1).trim() === '';
  }
  return false;
}

// One value that is complete on its own line: quoted and closed, or a plain scalar with no ` #` comment.
function singleLineValue(value: string | undefined): boolean {
  if (value === undefined || value === '') return false;
  const first = value.charAt(0);
  if (first === '"' || first === "'") return closesCleanly(value, first);
  if ('|>[{&*!%@`#'.includes(first)) return false;
  return !/(^|\s)#/.test(value);
}

/** The frontmatter's own lines (between the opening and closing `---`), as indexes into `lines`; null when the
 *  note has no closed frontmatter block. */
function frontmatterRange(lines: readonly string[]): { start: number; end: number } | null {
  if (lines.length < 2 || content(lines[0] ?? '') !== '---') return null;
  for (let i = 1; i < lines.length; i += 1) if (content(lines[i] ?? '') === '---') return { start: 1, end: i };
  return null;
}

const continues = (next: string | undefined): boolean => next !== undefined && /^[ \t]+\S/.test(next);

export function rewriteFrontmatterLines(text: string, values: RefreshedValues): FrontmatterRewrite {
  const lines = text.match(LINES) ?? [];
  const range = frontmatterRange(lines);
  if (range === null) return REFUSED;
  const found = new Map<Key, number>();
  for (let i = range.start; i < range.end; i += 1) {
    const line = content(lines[i] ?? '');
    const match = KEY_LINE.exec(line);
    if (match === null) {
      if (OTHER_KEY_LINE.test(line)) return REFUSED;
      continue;
    }
    const key = match[1] === 'snapshot_id' ? 'snapshot_id' : 'source_path';
    if (found.has(key) || !singleLineValue(match[2]) || continues(lines[i + 1])) return REFUSED;
    found.set(key, i);
  }
  const out = lines.slice();
  for (const key of KEYS) {
    const at = found.get(key);
    if (at === undefined) return REFUSED;
    out[at] = `${key}: ${scalar(values[key])}${terminator(lines[at] ?? '')}`;
  }
  return { ok: true, text: out.join('') };
}
