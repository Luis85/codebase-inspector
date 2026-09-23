// Part 6 acceptance evidence (2) detector, used by tests/unit/no-process-execution.test.ts.
// Moved out of the test file (fix round 2, E31) so the test file can stay under its
// 450-line cap once the detector grew from a token scan into a full parse.
//
// Fix round 2 history: round 1 replaced a comment-stripping regex with
// `ts.createScanner`, which fixed strings that merely LOOK like comments but is itself a
// flat token stream with no parser behind it. A scanner alone never re-enters template or
// regex mode (`reScanTemplateToken`/`reScanSlashToken` need a parser to call them at the
// right position), so it silently mis-tokenises everything after a `${…}` substitution or
// a `/…/ ` regex literal — a probe that appended `spawn('fallow');` after such a token
// escaped detection in 68 of 262 real source files. This version parses instead of
// scanning: `ts.createSourceFile` builds a real AST, so template and regex literals (and
// what follows them) are never ambiguous.
//
// The AST walk covers:
// - `import ... from 'specifier'` and `export ... from 'specifier'`, a dynamic
//   `import('specifier')`, and a `require('specifier')` / `obj.require('specifier')`
//   call (`window.require`, matching node-access.ts's own spelling) — the module ban,
//   checked against the specifier string's or template's own text;
// - a `CallExpression` whose callee is a banned name: bare (`spawn(`, `spawn?.(`), a
//   member (`cp.spawn(`, `cp.fork?.(`), a computed/bracket member with a string or
//   template key (`cp['spawn'](`, `` cp[`spawn`](` ``), or `.call`/`.apply` on a banned
//   name (`spawn.call(`, `spawn.apply(`) — EXCEPT a bare member `.exec(`, which is
//   RegExp.prototype.exec (used by src/domain/path-safety.ts and
//   src/ui/stores/review-store.ts); bare `exec(` alone is still banned;
// - any `Identifier` (covering a plain reference, a member's `.name`, or a destructured
//   binding) named `openPath`, `openExternal`, `openItem` or `showItemInFolder` (U42),
//   and the same names reached through a computed/bracket member.
//
// `.vue` files are not valid TypeScript as a whole (the SFC wrapper and `<template>`
// block are HTML). Each `<script>`/`<script setup>` block's content is extracted and
// parsed on its own with the same walker; the `<template>` block is scanned with plain
// text regexes (`scanTemplateText`) so `@click="exec(cmd)"` and `shell.openPath(p)` in an
// attribute are still caught. Extracting the blocks independently, rather than
// tokenising the whole file as one stream, is also what fixes the round-1 regression
// where a stray backtick in template text swallowed the following `<script>` block: the
// two blocks are never tokenised together.
//
// Not exhaustive: a specifier or property name assembled at run time (string
// concatenation, a variable used as a computed key) evades this, as does anything inside
// a template's own mini-expression language beyond what the text regexes catch.
import ts from 'typescript';

export type ProcessGuardKind = 'ts' | 'vue';

const BANNED_MODULE = /\b(child_process|worker_threads)\b/;
const BARE_NAMES: ReadonlySet<string> = new Set(['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']);
// No bare "exec" here: a member `.exec(` is RegExp.prototype.exec.
const MEMBER_NAMES: ReadonlySet<string> = new Set(['spawn', 'spawnSync', 'execSync', 'execFile', 'execFileSync', 'fork']);
const OPENER_NAMES: ReadonlySet<string> = new Set(['openPath', 'openExternal', 'openItem', 'showItemInFolder']);

interface Found { module: boolean; call: boolean; open: boolean }

function literalText(node: ts.Node | undefined): string | undefined {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined;
}

/** The name a call's callee (or a `.call`/`.apply` receiver) resolves to: a bare
 *  identifier, a `.name` member, or a `['name']`/`` [`name`] `` computed member. */
function calleeName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  if (ts.isElementAccessExpression(expr)) return literalText(expr.argumentExpression);
  return undefined;
}

function specifierHazard(arg: ts.Expression | undefined, found: Found): void {
  const text = literalText(arg);
  if (text !== undefined && BANNED_MODULE.test(text)) found.module = true;
}

function visitCall(node: ts.CallExpression, found: Found): void {
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) { specifierHazard(node.arguments[0], found); return; }
  const name = calleeName(node.expression);
  if (name === 'require') { specifierHazard(node.arguments[0], found); return; }
  if (name === 'call' || name === 'apply') {
    const receiver = ts.isPropertyAccessExpression(node.expression) ? node.expression.expression : undefined;
    const receiverName = receiver && calleeName(receiver);
    if (receiverName !== undefined && (BARE_NAMES.has(receiverName) || MEMBER_NAMES.has(receiverName))) found.call = true;
    return;
  }
  if (ts.isIdentifier(node.expression) && BARE_NAMES.has(node.expression.text)) { found.call = true; return; }
  if ((ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression)) && name !== undefined) {
    if (MEMBER_NAMES.has(name)) found.call = true;
    else if (OPENER_NAMES.has(name)) found.open = true;
  }
}

function toList(found: Found): string[] {
  return [
    ...(found.module ? ['process module'] : []),
    ...(found.call ? ['process call'] : []),
    ...(found.open ? ['shell.openPath'] : []),
  ];
}

function processHazardsTs(source: string): string[] {
  const sourceFile = ts.createSourceFile('probe.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: Found = { module: false, call: false, open: false };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) specifierHazard(node.moduleSpecifier, found);
    else if (ts.isExportDeclaration(node)) specifierHazard(node.moduleSpecifier, found);
    else if (ts.isCallExpression(node)) visitCall(node, found);
    else if (ts.isIdentifier(node) && OPENER_NAMES.has(node.text)) found.open = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return toList(found);
}

// A `.vue` <template> block is HTML with embedded mini-expressions, not TypeScript: a
// plain text scan, same shape as the round-1 token check, applied to that text alone.
const TEMPLATE_CALL = /(?<![\w$.])(spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\s*\(|\.(spawn|spawnSync|execSync|execFile|execFileSync|fork)\s*\(/;
const TEMPLATE_OPEN = /\bopenPath\b|\bopenExternal\b|\bopenItem\b|\bshowItemInFolder\b/;

function scanTemplateText(text: string): string[] {
  const found: Found = { module: BANNED_MODULE.test(text), call: TEMPLATE_CALL.test(text), open: TEMPLATE_OPEN.test(text) };
  return toList(found);
}

const SCRIPT_BLOCK = /<script[^>]*>([\s\S]*?)<\/script>/gi;
const TEMPLATE_BLOCK = /<template[^>]*>([\s\S]*)<\/template>/i;

function processHazardsVue(source: string): string[] {
  const parts = new Set<string>();
  const templateMatch = TEMPLATE_BLOCK.exec(source);
  if (templateMatch) scanTemplateText(templateMatch[1] ?? '').forEach((h) => parts.add(h));
  for (const scriptMatch of source.matchAll(SCRIPT_BLOCK)) processHazardsTs(scriptMatch[1] ?? '').forEach((h) => parts.add(h));
  return (['process module', 'process call', 'shell.openPath'] as const).filter((h) => parts.has(h));
}

/** Every reason `source` could start a process or open a path, as short labels. */
export function processHazards(source: string, kind: ProcessGuardKind): string[] {
  return kind === 'vue' ? processHazardsVue(source) : processHazardsTs(source);
}

/** Fix round 2 self-test helper: injects a real `spawn('x');` call so the whole-tree
 *  scan's own detector can be pinned against every real file, not just hand-written
 *  snippets. For `.vue`, the call goes right before the LAST `</script>` close tag. */
export function injectSpawnCall(source: string, kind: ProcessGuardKind): string {
  if (kind !== 'vue') return `${source}\nspawn('x');\n`;
  const at = source.lastIndexOf('</script>');
  return at < 0 ? source : `${source.slice(0, at)}\nspawn('x');\n${source.slice(at)}`;
}
