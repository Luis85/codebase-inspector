// Part 7 Z15/Z38/Z40 and G6's "Disallow auto-install/download/fix paths": the only argv the
// plugin can build, no install/fix/watch word anywhere in the fallow code, no fallow
// dependency, and the real-binary tests kept out of `npm run verify`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { FALLOW_RUN_ARGS, FALLOW_VERSION_ARGS } from '../../src/application/analysis/fallow-invocation';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const FORBIDDEN: readonly string[] = ['npx', 'npm', 'fix', 'init', 'setup', 'watch', '--fail-on-issues', '--allow-remote-extends'];

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    return statSync(abs).isDirectory() ? tsFiles(abs) : name.endsWith('.ts') ? [abs] : [];
  });
}

function stringLiterals(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) found.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('the fallow argv policy (Z15)', () => {
  it('builds exactly two argument lists', () => {
    expect(FALLOW_RUN_ARGS('/repo')).toEqual(['--format', 'json', '--no-cache', '--quiet', '--root', '/repo']);
    expect(FALLOW_VERSION_ARGS).toEqual(['--version']);
  });

  it('has no install, fix, init, setup, watch or failing-flag word as a string in the fallow code', () => {
    const files = [...tsFiles(join(REPO, 'src', 'application', 'analysis')), ...tsFiles(join(REPO, 'src', 'adapters', 'fallow'))];
    expect(files.length).toBeGreaterThan(8);
    const hits = files.flatMap((file) => stringLiterals(file).filter((s) => FORBIDDEN.includes(s)).map((s) => `${file}: ${s}`));
    expect(hits).toEqual([]);
  });
});

describe('fallow stays out of the dependencies and out of verify (Z40)', () => {
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts: Record<string, string>;
  };

  it('depends on no fallow package', () => {
    const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((n) => n === 'fallow' || n.startsWith('@fallow-cli/'))).toEqual([]);
  });

  it('runs the real binary only through the opt-in script, never from verify', () => {
    expect(pkg.scripts['test:fallow']).toBe('node scripts/fetch-fallow.mjs && vitest run --config vitest.fallow.config.ts');
    expect(pkg.scripts.verify).not.toContain('test:fallow');
    expect(pkg.scripts.test).toBe('vitest run');
  });

  it('git-ignores the fetched binary and keeps linters out of it', () => {
    expect(readFileSync(join(REPO, '.gitignore'), 'utf8').split(/\r?\n/)).toContain('.fallow-bin/');
    expect(readFileSync(join(REPO, 'eslint.config.mjs'), 'utf8')).toContain("'.fallow-bin/**'");
    expect(readFileSync(join(REPO, '.oxlintrc.json'), 'utf8')).toContain('".fallow-bin/**"');
  });
});
