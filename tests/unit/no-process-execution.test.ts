// Part 6 acceptance evidence (2) for the Fallow Ingestion deliverable: importing a report
// runs no code, and nothing under src/ can start a process or hand a path to the shell.
// A static scan of every source file, comments stripped (they legitimately NAME what is
// banned, to say why). It covers:
// - any mention of the child_process or worker_threads modules in code, in any spelling a
//   static import, a dynamic import() or a window.require() call would use;
// - a call to spawn, spawnSync, exec, execSync, execFile, execFileSync or fork, bare or
//   as a member (`cp.spawn(`), EXCEPT a member `.exec(`: that is RegExp.prototype.exec,
//   used today by src/domain/path-safety.ts and src/ui/stores/review-store.ts. The only
//   way to hold a child_process object is the module, which the first check bans, and
//   tests/unit/node-access-boundary.test.ts pins window.require to node-access.ts;
// - `openPath` (Electron's shell.openPath) anywhere in code.
// Not exhaustive: a specifier assembled at run time would evade any text scan. What it
// covers is stated per test below, as node-access-boundary.test.ts does.
import { describe, expect, it } from 'vitest';
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

/** Block, line and HTML comments out; `//` after a ':' is kept (a URL, not a comment). */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const BANNED_MODULE = /\b(child_process|worker_threads)\b/;
const PROCESS_CALL = /(?<![\w$.])(spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\s*\(|\.(spawn|spawnSync|execSync|execFile|execFileSync|fork)\s*\(/;
const OPEN_PATH = /\bopenPath\b/;

/** Every reason this source could start a process or open a path, as short labels. */
function processHazards(source: string): string[] {
  const code = codeOf(source);
  return [
    ...(BANNED_MODULE.test(code) ? ['process module'] : []),
    ...(PROCESS_CALL.test(code) ? ['process call'] : []),
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
  ])('does not flag %s', (source) => {
    expect(processHazards(source)).toEqual([]);
  });
});
