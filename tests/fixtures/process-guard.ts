// Part 6 acceptance evidence (2) detector, used by tests/unit/no-process-execution.test.ts.
// Moved out of the test file (fix round 2, E31) so the test file can stay under its
// 450-line cap once the detector grew from a token scan into a full parse.
//
// History: round 1 replaced a comment-stripping regex with `ts.createScanner`, which
// fixed strings that merely LOOK like comments but never re-entered template or regex
// mode (it missed an injected call in 68 of 262 real files). Round 2 parsed `.ts`/`.js`
// with `ts.createSourceFile`, but still found a `.vue` file's `<script>` with a regex, which
// a component named `<ScriptPanel />` or a `<script>` inside an HTML comment fooled. Round
// 3 (E31) parses `.vue` files with `@vue/compiler-sfc`'s `parse`.
//
// PART 7 (spec Z37, U42's "Part 7 must amend it deliberately"): the one legitimate process
// code now exists, so the labels are finer and the allow-list lives in the test:
// - 'spawn call' is the async `spawn` alone, in every spelling below;
// - 'process call' is every other process API: spawnSync, bare exec, execSync, execFile,
//   execFileSync and fork (a member `.exec(` stays RegExp.prototype.exec);
// - 'shell option' (new) is an object-literal property named `shell` — plain, string-keyed,
//   computed with a string key, or shorthand — whose value is not the literal `false`; since
//   polish A7 also `o.shell = x` (or `||=`, `??=`, `&&=`), `o['shell'] = x` and
//   `Object.defineProperty(o, 'shell', …)`;
// - 'process module' and 'shell.openPath' are unchanged;
// - 'unscannable' (polish G2) is a `.vue` file the SFC parser reported an error for, one
//   with a custom block, or one whose template or script is an external `src` block (its
//   file is never read): it fails the scan rather than passing unread.
// tests/unit/no-process-execution.test.ts allows exactly 'process module' in
// src/adapters/fallow/node-process-access.ts and exactly 'spawn call' in
// src/adapters/fallow/fallow-runner.ts. Everything else stays banned everywhere.
//
// The AST walk covers: import/export specifiers, dynamic import(), `require`/`x.require`
// calls, any string literal naming a banned module, calls (bare, member, bracket with a
// string or template key, `.call`/`.apply`, tagged templates, optional chains, non-null
// assertions, parentheses, type assertions and comma expressions), opener identifiers,
// and `shell` properties. A `.vue` <template> is scanned as text for calls and openers.
//
// Known, accepted gaps: an alias (`const s = spawn; s();`), `.bind(null)()` and
// `Reflect.apply` — for EVERY process API name, not only `spawn` — an uncalled bracket
// reference to an opener, a name built at run time, a `shell` option reached only through a
// computed name built at run time, and a `shell` option written inside a <template> (not
// scanned: prose there reads "shell:" too often to be a reliable signal). An opener is
// flagged by its name wherever it appears, so `.call`/`.apply`/`.bind` on one is flagged.
import ts from 'typescript';
import { parse as parseSfc } from '@vue/compiler-sfc';

export type ProcessGuardKind = 'ts' | 'vue';
export type ProcessHazard = 'process module' | 'spawn call' | 'process call' | 'shell option' | 'shell.openPath' | 'unscannable';
const HAZARD_ORDER: readonly ProcessHazard[] = ['process module', 'spawn call', 'process call', 'shell option', 'shell.openPath', 'unscannable'];

const BANNED_MODULE = /\b(child_process|worker_threads)\b/;
const SPAWN = 'spawn';
const BARE_NAMES: ReadonlySet<string> = new Set(['spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']);
// No bare "exec" here: a member `.exec(` is RegExp.prototype.exec.
const MEMBER_NAMES: ReadonlySet<string> = new Set(['spawnSync', 'execSync', 'execFile', 'execFileSync', 'fork']);
const OPENER_NAMES: ReadonlySet<string> = new Set(['openPath', 'openExternal', 'openItem', 'showItemInFolder']);

interface Found { module: boolean; spawn: boolean; call: boolean; shell: boolean; open: boolean; unscannable: boolean }
type CalleeShape = { shape: 'bare' | 'member'; name: string } | { shape: 'none' };

function literalText(node: ts.Node | undefined): string | undefined {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined;
}

function unwrap(expr: ts.Expression): ts.Expression {
  for (;;) {
    if (ts.isParenthesizedExpression(expr)) { expr = expr.expression; continue; }
    if (ts.isNonNullExpression(expr)) { expr = expr.expression; continue; }
    if (ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isTypeAssertionExpression(expr)) { expr = expr.expression; continue; }
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.CommaToken) { expr = expr.right; continue; }
    return expr;
  }
}

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

/** Which hazard calling something of this shape is: the async spawn, another process API, or none. */
function callHazard(shape: CalleeShape): 'spawn' | 'call' | null {
  if (shape.shape === 'none') return null;
  if (shape.name === SPAWN) return 'spawn';
  return (shape.shape === 'bare' ? BARE_NAMES : MEMBER_NAMES).has(shape.name) ? 'call' : null;
}

function mark(found: Found, hazard: 'spawn' | 'call' | null): void {
  if (hazard === 'spawn') found.spawn = true;
  else if (hazard === 'call') found.call = true;
}

function specifierHazard(arg: ts.Expression | undefined, found: Found): void {
  const text = literalText(arg);
  if (text !== undefined && BANNED_MODULE.test(text)) found.module = true;
}

/** Which hazard this call is. For `.call`/`.apply` the receiver's OWN shape decides (round 3):
 *  `x.exec.call(y)` stays exempt, `spawn.call(y)` does not. Shared with spawnCallCount (QF9). */
function callSiteHazard(node: ts.CallExpression, callee: CalleeShape): 'spawn' | 'call' | null {
  if (callee.shape !== 'member' || (callee.name !== 'call' && callee.name !== 'apply')) return callHazard(callee);
  const inner = unwrap(node.expression);
  const receiver = ts.isPropertyAccessExpression(inner) || ts.isElementAccessExpression(inner) ? inner.expression : undefined;
  return receiver ? callHazard(calleeShape(receiver)) : null;
}

function visitCall(node: ts.CallExpression, found: Found): void {
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) { specifierHazard(node.arguments[0], found); return; }
  const callee = calleeShape(node.expression);
  // Polish A7: Object.defineProperty(o, 'shell', …) sets the option too.
  if (callee.shape === 'member' && callee.name === 'defineProperty' && literalText(node.arguments[1]) === 'shell') found.shell = true;
  if (callee.shape !== 'none' && callee.name === 'require') { specifierHazard(node.arguments[0], found); return; }
  const hazard = callSiteHazard(node, callee);
  if (hazard !== null) { mark(found, hazard); return; }
  if (callee.shape === 'member' && OPENER_NAMES.has(callee.name)) found.open = true;
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name)) return literalText(name.expression);
  return undefined;
}

/** The assignments that can set a property: `=`, `||=`, `??=` and `&&=` (review fix 2). */
const SETTING_TOKENS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.EqualsToken, ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken,
]);

/** Polish A7: `o.shell = x` or `o['shell'] = x` (or `||=`, `??=`, `&&=`), where x is not the literal `false`. */
function isShellAssignment(node: ts.Node): boolean {
  if (!ts.isBinaryExpression(node) || !SETTING_TOKENS.has(node.operatorToken.kind)) return false;
  const target = unwrap(node.left);
  const name = ts.isPropertyAccessExpression(target) ? target.name.text
    : ts.isElementAccessExpression(target) ? literalText(target.argumentExpression) : undefined;
  return name === 'shell' && unwrap(node.right).kind !== ts.SyntaxKind.FalseKeyword;
}

function toList(found: Found): ProcessHazard[] {
  const on: Record<ProcessHazard, boolean> = {
    'process module': found.module, 'spawn call': found.spawn, 'process call': found.call, 'shell option': found.shell, 'shell.openPath': found.open,
    'unscannable': found.unscannable,
  };
  return HAZARD_ORDER.filter((h) => on[h]);
}

function processHazardsTs(source: string): ProcessHazard[] {
  const sourceFile = ts.createSourceFile('probe.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: Found = { module: false, spawn: false, call: false, shell: false, open: false, unscannable: false };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) specifierHazard(node.moduleSpecifier, found);
    else if (ts.isExportDeclaration(node)) specifierHazard(node.moduleSpecifier, found);
    else if (ts.isCallExpression(node)) visitCall(node, found);
    else if (ts.isTaggedTemplateExpression(node)) mark(found, callHazard(calleeShape(node.tag)));
    else if (ts.isIdentifier(node) && OPENER_NAMES.has(node.text)) found.open = true;
    else if (ts.isStringLiteralLike(node) && BANNED_MODULE.test(node.text)) found.module = true;
    else if (isShellAssignment(node)) found.shell = true;
    else if (ts.isPropertyAssignment(node) && propertyNameText(node.name) === 'shell'
      && unwrap(node.initializer).kind !== ts.SyntaxKind.FalseKeyword) found.shell = true;
    else if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'shell') found.shell = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return toList(found);
}

const BARE_LIST = Array.from(BARE_NAMES).join('|');
const MEMBER_LIST = Array.from(MEMBER_NAMES).join('|');
const callPattern = (bare: string, member: string): RegExp => new RegExp(
  `(?<![\\w$.])(?:${bare})(?:\\s*\\?\\.)?\\s*\\(`
  + `|\\.(?:${member})(?:\\s*\\?\\.)?\\s*\\(`
  + `|(?<![\\w$.])(?:${bare})\\.(?:call|apply)\\s*\\(`
  + `|\\[\\s*['"](?:${member})['"]\\s*\\]\\s*\\(`,
);
const TEMPLATE_SPAWN = callPattern(SPAWN, SPAWN);
const TEMPLATE_CALL = callPattern(BARE_LIST, MEMBER_LIST);
const TEMPLATE_OPEN = new RegExp(`\\b(?:${Array.from(OPENER_NAMES).join('|')})\\b`);

function scanTemplateText(text: string): ProcessHazard[] {
  return toList({
    module: BANNED_MODULE.test(text), spawn: TEMPLATE_SPAWN.test(text), call: TEMPLATE_CALL.test(text), shell: false, open: TEMPLATE_OPEN.test(text),
    unscannable: false,
  });
}

function processHazardsVue(source: string): ProcessHazard[] {
  const { descriptor, errors } = parseSfc(source, { filename: 'probe.vue' });
  const parts = new Set<ProcessHazard>();
  // Polish G2: fail closed. A parse error (an unclosed tag, a second <script setup>) or a block
  // this detector does not read (<docs>, an upper-case <SCRIPT>, any custom block) could hide a
  // call, so the file is reported instead of passing silently.
  // Review fix 1: an external `src` block parses cleanly with empty content, and its file is never read.
  const external = [descriptor.template, descriptor.script, descriptor.scriptSetup].some((block) => block?.src !== undefined);
  if (errors.length > 0 || descriptor.customBlocks.length > 0 || external) parts.add('unscannable');
  if (descriptor.template?.content) scanTemplateText(descriptor.template.content).forEach((h) => parts.add(h));
  if (descriptor.script?.content) processHazardsTs(descriptor.script.content).forEach((h) => parts.add(h));
  if (descriptor.scriptSetup?.content) processHazardsTs(descriptor.scriptSetup.content).forEach((h) => parts.add(h));
  return HAZARD_ORDER.filter((h) => parts.has(h));
}

/** Every reason `source` could start a process or open a path, as short labels, in HAZARD_ORDER. */
export function processHazards(source: string, kind: ProcessGuardKind): ProcessHazard[] {
  return kind === 'vue' ? processHazardsVue(source) : processHazardsTs(source);
}

/** Self-test helper: appends a statement (for `.vue`, right before the LAST `</script>`). */
export function injectStatement(source: string, kind: ProcessGuardKind, statement: string): string {
  if (kind !== 'vue') return `${source}\n${statement}\n`;
  const at = source.lastIndexOf('</script>');
  return at < 0 ? source : `${source.slice(0, at)}\n${statement}\n${source.slice(at)}`;
}

export function injectSpawnCall(source: string, kind: ProcessGuardKind): string {
  return injectStatement(source, kind, "spawn('x');");
}

/** Polish A6 (Z37): how many calls to the async `spawn` `source` makes, by the same callee
 *  rules as the hazard walk — `.call`/`.apply` on it and a tagged template included (QF9).
 *  tests/unit/no-process-execution.test.ts requires exactly one in fallow-runner.ts. */
export function spawnCallCount(source: string): number {
  const sourceFile = ts.createSourceFile('probe.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && callSiteHazard(node, calleeShape(node.expression)) === 'spawn') count += 1;
    else if (ts.isTaggedTemplateExpression(node) && callHazard(calleeShape(node.tag)) === 'spawn') count += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
}
