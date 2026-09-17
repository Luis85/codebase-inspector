// Acceptance criterion 7, made a REAL test rather than a claim checked only by lint:
// node-access.ts is the only file in src/ that references `window.require`, and no
// file anywhere in src/ statically imports a Node built-in. eslint-plugin-obsidianmd's
// `no-nodejs-modules` already enforces the second half at lint time (task-5-context.md
// ruling M19) — this test is an independent, second mechanism that would still catch a
// regression even if that rule were ever accidentally scoped down, and it directly
// verifies the FIRST half (window.require's exclusivity), which no lint rule checks at
// all.
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
const IMPORT_SPECIFIER = /(?:import|export)[^;]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function importedSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1] ?? match[2];
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

describe('the single Node-access module boundary (spec 3.1, acceptance criterion 7)', () => {
  const files = listSourceFiles(SRC_ROOT);

  it('has at least one source file to check (the check itself is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('references window.require in EXACTLY node-access.ts, and nowhere else in src/', () => {
    const filesReferencingWindowRequire = files.filter(
      (f) => /window\.require/.test(stripComments(readFileSync(f, 'utf8'))),
    );
    const relPaths = filesReferencingWindowRequire.map((f) => relative(SRC_ROOT, f).replace(/\\/g, '/'));
    expect(relPaths).toEqual(['adapters/filesystem/node-access.ts']);
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
