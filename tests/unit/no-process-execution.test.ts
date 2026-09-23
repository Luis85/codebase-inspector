// Part 6 acceptance evidence (2) for the Fallow Ingestion deliverable: importing a report
// runs no code, and nothing under src/ can start a process or hand a path to the shell.
// A static scan of every source file. It covers:
// - any mention of the child_process or worker_threads modules in code, in any spelling a
//   static import, a dynamic import() or a window.require() call would use, including
//   inside the specifier string itself;
// - a call to spawn, spawnSync, exec, execSync, execFile, execFileSync or fork: bare
//   (`spawn(`, `spawn?.(`, `spawn.call(`, `spawn.apply(`), as a member (`cp.spawn(`,
//   `cp.fork?.(`), or through a computed/bracket property (`cp['spawn'](`) — EXCEPT a
//   member `.exec(`: that is RegExp.prototype.exec, used today by src/domain/path-safety.ts
//   and src/ui/stores/review-store.ts. The only way to hold a child_process object is the
//   module, which the first check bans, and tests/unit/node-access-boundary.test.ts pins
//   window.require to node-access.ts;
// - `openPath`, `openExternal`, `openItem` and `showItemInFolder` (Electron's `shell`
//   module, U42) anywhere in code.
//
// Fix round 1 (E31, Important 2): the first version of this file stripped comments with a
// regex that did not know about strings, so `const g = 'dir/*'; spawn('x'); /** doc */`
// scanned clean — the regex's own `/\*...*\//` matched from the `/*` INSIDE the string
// through to the real trailing comment's `*/`, erasing the real `spawn(` call in between.
// This version tokenizes with the TypeScript scanner instead (`ts.createScanner`), which
// correctly finds string, template and regex literal boundaries no matter what they
// contain. Two character streams are built from the token positions:
// - `code`: comments AND every string/template/regex literal blanked out, so neither a
//   comment nor prose inside a string (`'a fork (of…)'`) can look like a call or a path;
// - `withStrings`: only comments blanked, literals left as written, so a banned module's
//   name is still found inside the quotes of an import/require specifier.
// HTML comments (`<!-- -->`, valid in a .vue template, not in TypeScript) are blanked
// before the scanner runs, since the scanner has no notion of them.
// Not exhaustive: a specifier or property name assembled at run time (string
// concatenation, a variable used as a computed key) would still evade this scan. What it
// covers is stated precisely per test below, rather than as a blanket claim.
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url));

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...listSourceFiles(abs));
    else if (/\.(ts|vue|js|mjs|cjs)$/.test(name)) out.push(abs);
  }
  return out;
}

const HTML_COMMENT = /<!--[\s\S]*?-->/g;

const TRIVIA_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.WhitespaceTrivia, ts.SyntaxKind.NewLineTrivia, ts.SyntaxKind.SingleLineCommentTrivia,
  ts.SyntaxKind.MultiLineCommentTrivia, ts.SyntaxKind.ShebangTrivia, ts.SyntaxKind.ConflictMarkerTrivia,
]);
const LITERAL_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral, ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail, ts.SyntaxKind.RegularExpressionLiteral,
]);

function blank(chars: string[], start: number, end: number): void {
  for (let i = start; i < end; i += 1) if (chars[i] !== '\n') chars[i] = ' ';
}

/** `code`: comments and every string/template/regex literal blanked out. `withStrings`:
 *  only comments blanked, so a literal's own text (an import specifier) is still there. */
function tokenize(source: string): { code: string; withStrings: string } {
  const withoutHtml = source.replace(HTML_COMMENT, (m) => ' '.repeat(m.length));
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false);
  scanner.setText(withoutHtml);
  const codeChars = withoutHtml.split('');
  const withStringsChars = withoutHtml.split('');
  let kind = scanner.scan();
  while (kind !== ts.SyntaxKind.EndOfFileToken) {
    const start = scanner.getTokenStart();
    const end = scanner.getTokenEnd();
    if (TRIVIA_KINDS.has(kind)) {
      blank(codeChars, start, end);
      blank(withStringsChars, start, end);
    } else if (LITERAL_KINDS.has(kind)) {
      blank(codeChars, start, end);
    }
    kind = scanner.scan();
  }
  return { code: codeChars.join(''), withStrings: withStringsChars.join('') };
}

const BANNED_MODULE = /\b(child_process|worker_threads)\b/;
// A process-starting name, EXCEPT as a bare `.name(` member (that form excludes `exec`,
// RegExp.prototype.exec): bare (`spawn(`), optionally-chained (`spawn?.(`), a real member
// (`cp.spawn(`, `cp.fork?.(`), or reached through `.call(`/`.apply(`.
const BARE_NAMES = 'spawn|spawnSync|exec|execSync|execFile|execFileSync|fork';
const MEMBER_NAMES = 'spawn|spawnSync|execSync|execFile|execFileSync|fork';
const PROCESS_CALL = new RegExp(
  `(?<![\\w$.])(?:${BARE_NAMES})(?:\\s*\\?\\.)?\\s*\\(`
  + `|\\.(?:${MEMBER_NAMES})(?:\\s*\\?\\.)?\\s*\\(`
  + `|(?<![\\w$.])(?:${BARE_NAMES})\\.(?:call|apply)\\s*\\(`,
);
// Fix round 1 (E31, minor 3): a computed/bracket property (`cp['spawn'](`) is checked
// against `withStrings`, not `code`: the method name lives inside the quotes that `code`
// blanks out, unlike the generic-prose case (`'a fork (of…)'`) this file must NOT flag.
const BRACKET_CALL = new RegExp(`\\[\\s*['"](?:${MEMBER_NAMES})['"]\\s*\\]\\s*\\(`);
const OPEN_PATH = /\bopenPath\b|\bopenExternal\b|\bopenItem\b|\bshowItemInFolder\b/;

/** Every reason this source could start a process or open a path, as short labels. */
function processHazards(source: string): string[] {
  const { code, withStrings } = tokenize(source);
  return [
    ...(BANNED_MODULE.test(withStrings) ? ['process module'] : []),
    ...(PROCESS_CALL.test(code) || BRACKET_CALL.test(withStrings) ? ['process call'] : []),
    ...(OPEN_PATH.test(code) ? ['shell.openPath'] : []),
  ];
}

describe('nothing under src/ runs a process (Part 6 acceptance 2)', () => {
  const files = listSourceFiles(SRC_ROOT);

  it('has source files to check (the scan is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no file mentions child_process or worker_threads, calls spawn/exec/execFile/fork, or opens a path', () => {
    const offenders = files
      .map((f) => ({ file: relative(SRC_ROOT, f).replace(/\\/g, '/'), hazards: processHazards(readFileSync(f, 'utf8')) }))
      .filter((o) => o.hazards.length > 0);
    expect(offenders).toEqual([]);
  });
});

// The detector itself, one case per spelling, independent of what src/ holds today.
describe('process hazard detection', () => {
  it.each([
    ["import { spawn } from 'node:child_process';", 'process module'],
    ["import * as cp from 'child_process';", 'process module'],
    ["const cp = await import('node:child_process');", 'process module'],
    ["const cp = window.require('child_process');", 'process module'],
    ["const { Worker } = window.require('node:worker_threads');", 'process module'],
    ["spawn('fallow', ['--format', 'json']);", 'process call'],
    ["exec('fallow --version');", 'process call'],
    ["execFile('fallow', []);", 'process call'],
    ["runner.execFileSync('fallow');", 'process call'],
    ["proc.spawn ('fallow');", 'process call'],
    ["fork('worker.js');", 'process call'],
    ["shell.openPath(report);", 'shell.openPath'],
    ["const { openPath } = shell;", 'shell.openPath'],
    // Fix round 1 (E31, Important 2): a comment-stripping regex that does not know about
    // strings erases real code between a string that merely CONTAINS `/*` or `//` and the
    // next genuine comment terminator.
    ["const g = 'dir/*'; spawn('x'); /** doc */", 'process call'],
    ["const s = '//'; exec(cmd)", 'process call'],
    // Fix round 1 (E31, minor 3): spellings the first version missed.
    ["spawn?.('fallow');", 'process call'],
    ["cp.fork?.(['worker.js']);", 'process call'],
    ["cp['spawn']('fallow');", 'process call'],
    ["spawn.call(null, 'fallow');", 'process call'],
    ["spawn.apply(null, ['fallow']);", 'process call'],
    ['shell.openExternal(url);', 'shell.openPath'],
    ['const { openItem } = shell;', 'shell.openPath'],
    ['showItemInFolder(path);', 'shell.openPath'],
  ])('flags %s', (source, label) => {
    expect(processHazards(source)).toContain(label);
  });

  it.each([
    "const drive = /^[A-Za-z]:/.exec(posix)?.[0] ?? null;",
    "const digits = pattern.exec(id)?.[1];",
    "// spawn('fallow') is Part 7's job, never this one",
    "/* import { exec } from 'node:child_process' */ const x = 1;",
    "<!-- openPath is not used --><p>Run nothing</p>",
    "const executable = 'fallow'; const spawned = false; const forked = 0;",
    // Fix round 1 (E31, minor 3): prose inside a string, not a real call.
    "const note = 'a fork (of…) in the road, not a process';",
  ])('does not flag %s', (source) => {
    expect(processHazards(source)).toEqual([]);
  });
});
