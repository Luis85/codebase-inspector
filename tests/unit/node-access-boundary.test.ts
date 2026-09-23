// Acceptance criterion 7, made a REAL test rather than a claim checked only by lint:
// node-access.ts is the only file in src/ that references window.require (or an
// equivalent spelling), and no file anywhere in src/ statically imports a Node built-in.
// eslint-plugin-obsidianmd's `no-nodejs-modules` already enforces the import half at
// lint time for most spellings (task-5-context.md ruling M19).
//
// Fix-round-1 IMPORTANT finding 3: the FIRST version of this file only matched the
// single literal substring `window.require` and only recognised `from '...'`-style
// imports. The reviewer tabulated three spellings that typecheck fine (node-globals.d.ts
// widens Window.require to accept any string, and no-nodejs-modules does not parse
// member/bracket access at all) and are invisible to at least one of the two detectors:
// `window['require'](...)`, `const w = window; w.require(...)`, and a bare side-effect
// `import 'node:fs';` (this last one WAS already caught by no-nodejs-modules, but not by
// this file's own specifier regex, which required a `from` clause). All three are now
// covered — see the dedicated unit tests below for the detection functions themselves,
// and the whole-src-tree scan for the real, current state of the codebase.
//
// This file is deliberately NOT claimed to be exhaustive: a dynamically-constructed
// specifier string (`window[someVariable](...)`, string concatenation, etc.) would still
// evade a regex-based scan. What it DOES cover is stated precisely per test below,
// rather than as a blanket "catches any regression" claim.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url));

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      out.push(...listSourceFiles(abs));
    } else if (/\.(ts|vue)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(abs);
    }
  }
  return out;
}

// Every spelling a static import could use for a Node built-in: bare ('fs'), node:
// prefixed ('node:fs'), and the same set of names without a prefix for completeness.
const BUILTIN_NAMES = new Set(builtinModules.filter((n) => !n.startsWith('_')));

// Three alternatives: `from '...'` imports/re-exports, dynamic `import('...')`, and a
// bare side-effect import (`import '...'` with no `from` clause at all — fix-round-1
// finding 3's third table row).
const IMPORT_SPECIFIER = /(?:import|export)[^;'"]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

function importedSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
}

function isNodeBuiltinSpecifier(specifier: string): boolean {
  if (specifier.startsWith('node:')) return true;
  return BUILTIN_NAMES.has(specifier);
}

// Strips line and block comments before the window.require scan below — this codebase's
// own doc comments explain the design in PROSE that names "window.require" without
// calling it, and those explanations are exactly what makes the design reviewable; only
// a real code reference should fail this test. Naive (does not understand a string
// literal that itself contains a comment-opening sequence), an accepted trade-off for an
// internal boundary check over this project's own source, not a general-purpose tool.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Fix-round-1 finding 3: three independent patterns, not one literal substring.
// `\.require\b` — ANY dot-access property read named `require`, regardless of the
//   object it hangs off (window.require, w.require, someAlias.require) — this is what
//   catches `const w = window; w.require(...)`.
// `\[\s*['"]require['"]\s*\]` — the bracket-notation spelling of the same access,
//   `window['require']` / `w["require"]`.
// `\brequire\s*\(\s*['"]node:` — a bare CALL to something literally named `require`
//   with a `node:`-prefixed argument — catches a local variable actually named
//   `require` (`const require = window.require; require('node:fs')`), which the two
//   patterns above would miss (no `.require` and no bracket access at the CALL site).
const SUSPICIOUS_REQUIRE_PATTERNS: readonly RegExp[] = [
  /\.require\b/,
  /\[\s*['"]require['"]\s*\]/,
  /\brequire\s*\(\s*['"]node:/,
];

function referencesRequireLikeAccess(source: string): boolean {
  const stripped = stripComments(source);
  return SUSPICIOUS_REQUIRE_PATTERNS.some((pattern) => pattern.test(stripped));
}

describe('the single Node-access module boundary (spec 3.1, acceptance criterion 7)', () => {
  const files = listSourceFiles(SRC_ROOT);

  it('has at least one source file to check (the check itself is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  // Part 7 Z14 (K19): node-process-access.ts is the second, and only other, window.require.
  it('references a require-like access in EXACTLY node-access.ts and node-process-access.ts, and nowhere else in src/', () => {
    const offending = files.filter((f) => referencesRequireLikeAccess(readFileSync(f, 'utf8')));
    const relPaths = offending.map((f) => relative(SRC_ROOT, f).replace(/\\/g, '/')).sort();
    expect(relPaths).toEqual(['adapters/fallow/node-process-access.ts', 'adapters/filesystem/node-access.ts']);
  });

  it('never statically imports a Node built-in module anywhere in src/', () => {
    const offenders: { file: string; specifier: string }[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const specifier of importedSpecifiers(source)) {
        if (isNodeBuiltinSpecifier(specifier)) {
          offenders.push({ file: relative(SRC_ROOT, file).replace(/\\/g, '/'), specifier });
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// Direct unit tests for the detection functions themselves, one per row of the
// reviewer's table — these do not depend on the current state of src/ and would still
// fail if a future edit to the regexes regressed detection of any of these three
// spellings, independent of whether anything in src/ actually uses them right now.
describe('require-like access detection: one case per fix-round-1 table row', () => {
  it('catches window[\'require\'](...) — bracket notation', () => {
    expect(referencesRequireLikeAccess("const fs = window['require']('node:os');")).toBe(true);
  });

  it('catches an aliased w.require(...) — dot access on a non-"window"-named variable', () => {
    expect(referencesRequireLikeAccess("const w = window; const fs = w.require('node:os');")).toBe(true);
  });

  it('catches a bare side-effect import statement (no "from" clause)', () => {
    expect(importedSpecifiers("import 'node:fs';").some(isNodeBuiltinSpecifier)).toBe(true);
  });

  it('does not flag a legitimate side-effect import of a non-builtin (e.g. a stylesheet)', () => {
    expect(importedSpecifiers("import './styles.css';").some(isNodeBuiltinSpecifier)).toBe(false);
  });

  it('still catches the original literal window.require(...) spelling', () => {
    expect(referencesRequireLikeAccess("window.require('node:path');")).toBe(true);
  });

  it('does not flag PROSE mentioning window.require inside a comment', () => {
    expect(referencesRequireLikeAccess('// see window.require for details\nconst x = 1;')).toBe(false);
  });
});
