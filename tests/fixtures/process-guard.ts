// Part 6 acceptance evidence (2) detector, used by tests/unit/no-process-execution.test.ts.
// Moved out of the test file (fix round 2, E31) so the test file can stay under its
// 450-line cap once the detector grew from a token scan into a full parse.
//
// History: round 1 replaced a comment-stripping regex with `ts.createScanner`, which
// fixed strings that merely LOOK like comments but is itself a flat token stream with no
// parser behind it — it never re-enters template or regex mode, so it mis-tokenised
// everything after a `${…}` substitution or a `/…/ ` regex literal (missed an injected
// call in 68 of 262 real files). Round 2 replaced the scanner with a real parse
// (`ts.createSourceFile`) for `.ts`/`.js` files, but for `.vue` files still found the
// `<script>` block with a plain regex (`/<script[^>]*>…<\/script>/gi`), which the `i`
// flag also matches against a component named `<ScriptPanel />` or `<script-list/>`, or
// against `<script>` inside an HTML comment — the real script was then never reached, or
// its content ran together with template markup that could itself confuse the TS parser
// (a stray backtick in template text swallowing the real script). Round 3 (E31) fixes
// this by parsing the `.vue` file itself with `@vue/compiler-sfc`'s `parse`, which is a
// real Vue SFC parser: `descriptor.script`/`descriptor.scriptSetup`/`descriptor.template`
// are never confused by a similarly-named component, a comment, or template markup.
//
// The AST walk (`processHazardsTs`, used directly for `.ts`/`.js` files and for each
// `.vue` script block) covers:
// - `import ... from 'specifier'` and `export ... from 'specifier'`, a dynamic
//   `import('specifier')`, and a `require('specifier')` / `obj.require('specifier')`
//   call (`window.require`, matching node-access.ts's own spelling) — the module ban,
//   checked against the specifier string's or template's own text;
// - (round 3) ANY string or no-substitution-template literal anywhere in the code whose
//   text matches the banned module names, not only ones used as a specifier argument —
//   `const m = 'child_process'; window.require(m);` is now caught too;
// - a `CallExpression` (or, round 3, a tagged template `` name`...` ``) whose callee is a
//   banned name: bare (`spawn(`, `spawn?.(`, `spawn!(`, `` spawn`x` ``), a member
//   (`cp.spawn(`, `cp.fork?.(`), a computed/bracket member with a string or template key
//   (`cp['spawn'](`, `` cp[`spawn`](` ``), or `.call`/`.apply`/`['call']`/`['apply']` on a
//   banned name (`spawn.call(`, `spawn['apply'](`) — EXCEPT a bare member `.exec(` (or
//   `.exec.call(`/`.exec.apply(`, round 3), which is RegExp.prototype.exec (used by
//   src/domain/path-safety.ts and src/ui/stores/review-store.ts); bare `exec(` alone is
//   still banned. (Round 3) the callee is unwrapped through a parenthesised expression,
//   a non-null assertion, an `as`/`satisfies`/old-style type assertion, and the right
//   side of a comma expression before matching, so `(spawn)('x')`, `(0, cp.spawn)('x')`
//   and `spawn!('x')` are not missed;
// - any `Identifier` (covering a plain reference, a member's `.name`, or a destructured
//   binding) named `openPath`, `openExternal`, `openItem` or `showItemInFolder` (U42),
//   and the same names reached through a computed/bracket member in call position.
//
// `.vue` template markup (`descriptor.template?.content`) is not TypeScript — it is
// scanned as plain text with regexes structurally matching round 1's `PROCESS_CALL`/
// `BRACKET_CALL`/`OPEN_PATH` (round 3 restored the optional-chain, bracket and
// `.call`/`.apply` forms that a prior version of this template scan had lost), so
// `@click="exec(cmd)"`, `@click="spawn?.('x')"` and `@click="cp['spawn']('x')"` in an
// attribute are all caught.
//
// Known, accepted gaps (round 3): a name ALIASED to a banned function and called through
// the alias (`const s = spawn; s();`) is invisible — this would need data-flow analysis,
// not a syntactic check. An opener name referenced but never called (`const f =
// shell['openPath'];`, no accompanying call) is also not caught — the AST walk only
// checks bracket/computed access to an opener name when it is itself a call's callee; a
// bare `.openPath`/`{ openPath }` reference IS still caught (an `Identifier` node,
// checked regardless of call position). Both are deliberate, so a broader alias/x-ray
// analysis is not attempted here (see "not exhaustive" below).
//
// Not exhaustive: a specifier or property name assembled at run time (string
// concatenation, a variable used as a computed key) evades this, as does anything inside
// a template's own mini-expression language beyond what the text regexes catch.
import ts from 'typescript';
import { parse as parseSfc } from '@vue/compiler-sfc';

export type ProcessGuardKind = 'ts' | 'vue';

const BANNED_MODULE = /\b(child_process|worker_threads)\b/;
const BARE_NAMES: ReadonlySet<string> = new Set(['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']);
// No bare "exec" here: a member `.exec(` is RegExp.prototype.exec.
const MEMBER_NAMES: ReadonlySet<string> = new Set(['spawn', 'spawnSync', 'execSync', 'execFile', 'execFileSync', 'fork']);
const OPENER_NAMES: ReadonlySet<string> = new Set(['openPath', 'openExternal', 'openItem', 'showItemInFolder']);

interface Found { module: boolean; call: boolean; open: boolean }
type CalleeShape = { shape: 'bare' | 'member'; name: string } | { shape: 'none' };

function literalText(node: ts.Node | undefined): string | undefined {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined;
}

/** Round 3: strips a parenthesised expression, a non-null assertion, an `as`/
 *  `satisfies`/old-style type assertion, and the right side of a comma expression, so
 *  `(spawn)('x')`, `spawn!('x')` and `(0, cp.spawn)('x')` still resolve to their target. */
function unwrap(expr: ts.Expression): ts.Expression {
  for (;;) {
    if (ts.isParenthesizedExpression(expr)) { expr = expr.expression; continue; }
    if (ts.isNonNullExpression(expr)) { expr = expr.expression; continue; }
    if (ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isTypeAssertionExpression(expr)) { expr = expr.expression; continue; }
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.CommaToken) { expr = expr.right; continue; }
    return expr;
  }
}

/** The unwrapped shape of a callee (or a `.call`/`.apply` receiver, or a tagged
 *  template's tag): a bare identifier (includes `exec`), or a member reached through
 *  `.name` or a computed `['name']`/`` [`name`] `` (excludes bare `exec`'s exemption —
 *  callers decide which name set applies to which shape). */
function calleeShape(expr: ts.Expression): CalleeShape {
  const inner = unwrap(expr);
  if (ts.isIdentifier(inner)) return { shape: 'bare', name: inner.text };
  if (ts.isPropertyAccessExpression(inner)) return { shape: 'member', name: inner.name.text };
  if (ts.isElementAccessExpression(inner)) {
    const name = literalText(inner.argumentExpression);
    return name === undefined ? { shape: 'none' } : { shape: 'member', name };
  }
  return { shape: 'none' };
}

function specifierHazard(arg: ts.Expression | undefined, found: Found): void {
  const text = literalText(arg);
  if (text !== undefined && BANNED_MODULE.test(text)) found.module = true;
}

function visitCall(node: ts.CallExpression, found: Found): void {
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) { specifierHazard(node.arguments[0], found); return; }
  const callee = calleeShape(node.expression);
  if (callee.shape === 'member' && (callee.name === 'call' || callee.name === 'apply')) {
    // Round 3 (the ".exec.call" false positive): the receiver's OWN shape decides which
    // name set applies, so `x.exec.call(y)` (receiver shape "member", name "exec") stays
    // exempt exactly like `x.exec(y)` does, while `spawn.call(y)` (receiver shape
    // "bare") is still banned.
    const inner = unwrap(node.expression);
    const receiver = ts.isPropertyAccessExpression(inner) || ts.isElementAccessExpression(inner) ? inner.expression : undefined;
    const receiverShape = receiver && calleeShape(receiver);
    if (receiverShape && receiverShape.shape !== 'none') {
      const banned = receiverShape.shape === 'bare' ? BARE_NAMES.has(receiverShape.name) : MEMBER_NAMES.has(receiverShape.name);
      if (banned) found.call = true;
    }
    return;
  }
  if (callee.shape !== 'none' && callee.name === 'require') { specifierHazard(node.arguments[0], found); return; }
  if (callee.shape === 'bare' && BARE_NAMES.has(callee.name)) { found.call = true; return; }
  if (callee.shape === 'member' && MEMBER_NAMES.has(callee.name)) { found.call = true; return; }
  if (callee.shape === 'member' && OPENER_NAMES.has(callee.name)) found.open = true;
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
    else if (ts.isTaggedTemplateExpression(node)) {
      const shape = calleeShape(node.tag);
      if ((shape.shape === 'bare' && BARE_NAMES.has(shape.name)) || (shape.shape === 'member' && MEMBER_NAMES.has(shape.name))) found.call = true;
    } else if (ts.isIdentifier(node) && OPENER_NAMES.has(node.text)) found.open = true;
    else if (ts.isStringLiteralLike(node) && BANNED_MODULE.test(node.text)) found.module = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return toList(found);
}

// A `.vue` <template> block is HTML with embedded mini-expressions, not TypeScript: a
// plain text scan, restored (round 3) to the same shape as round 1's PROCESS_CALL/
// BRACKET_CALL/OPEN_PATH so bracket, optional-chain and .call/.apply forms in an
// attribute are caught the same way they are in real script code.
const BARE_LIST = [...BARE_NAMES].join('|');
const MEMBER_LIST = [...MEMBER_NAMES].join('|');
const TEMPLATE_CALL = new RegExp(
  `(?<![\\w$.])(?:${BARE_LIST})(?:\\s*\\?\\.)?\\s*\\(`
  + `|\\.(?:${MEMBER_LIST})(?:\\s*\\?\\.)?\\s*\\(`
  + `|(?<![\\w$.])(?:${BARE_LIST})\\.(?:call|apply)\\s*\\(`,
);
const TEMPLATE_BRACKET_CALL = new RegExp(`\\[\\s*['"](?:${MEMBER_LIST})['"]\\s*\\]\\s*\\(`);
const TEMPLATE_OPEN = new RegExp(`\\b(?:${[...OPENER_NAMES].join('|')})\\b`);

function scanTemplateText(text: string): string[] {
  const found: Found = { module: BANNED_MODULE.test(text), call: TEMPLATE_CALL.test(text) || TEMPLATE_BRACKET_CALL.test(text), open: TEMPLATE_OPEN.test(text) };
  return toList(found);
}

/** Round 3: a real Vue SFC parse, not a regex, so a component named `<ScriptPanel />` or
 *  `<script-list/>`, or `<script>` mentioned inside an HTML comment, can never be
 *  mistaken for the real `<script>`/`<script setup>` block (or vice versa). */
function processHazardsVue(source: string): string[] {
  const { descriptor } = parseSfc(source, { filename: 'probe.vue' });
  const parts = new Set<string>();
  if (descriptor.template?.content) scanTemplateText(descriptor.template.content).forEach((h) => parts.add(h));
  if (descriptor.script?.content) processHazardsTs(descriptor.script.content).forEach((h) => parts.add(h));
  if (descriptor.scriptSetup?.content) processHazardsTs(descriptor.scriptSetup.content).forEach((h) => parts.add(h));
  return (['process module', 'process call', 'shell.openPath'] as const).filter((h) => parts.has(h));
}

/** Every reason `source` could start a process or open a path, as short labels. */
export function processHazards(source: string, kind: ProcessGuardKind): string[] {
  return kind === 'vue' ? processHazardsVue(source) : processHazardsTs(source);
}

/** Self-test helper: injects a real `spawn('x');` call so the whole-tree scan's own
 *  detector can be pinned against every real file, not just hand-written snippets. For
 *  `.vue`, the call goes right before the LAST `</script>` close tag. */
export function injectSpawnCall(source: string, kind: ProcessGuardKind): string {
  if (kind !== 'vue') return `${source}\nspawn('x');\n`;
  const at = source.lastIndexOf('</script>');
  return at < 0 ? source : `${source.slice(0, at)}\nspawn('x');\n${source.slice(at)}`;
}
