// Part 6 acceptance evidence (2), amended deliberately by Part 7 (spec Z37, U42). Importing
// a report runs no code, and nothing under src/ can start a process or hand a path to the
// shell — except exactly two adapter files, each for exactly one hazard:
// - src/adapters/fallow/node-process-access.ts may name node:child_process (its one
//   window.require);
// - src/adapters/fallow/fallow-runner.ts may call the async spawn (its one call).
// shell: true, every *Sync API, exec, execFile, fork, worker_threads and the Electron openers
// stay banned everywhere, those two files included. The detector is
// tests/fixtures/process-guard.ts; see its header for what it covers and its history.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectSpawnCall, injectStatement, processHazards, type ProcessGuardKind, type ProcessHazard } from '../fixtures/process-guard';

const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url));

/** Z37: EXACTLY these two files, each allowed EXACTLY its own hazard. */
const PROCESS_ALLOWED: ReadonlyMap<string, readonly ProcessHazard[]> = new Map<string, readonly ProcessHazard[]>([
  ['adapters/fallow/node-process-access.ts', ['process module']],
  ['adapters/fallow/fallow-runner.ts', ['spawn call']],
]);

/** Z37: what stays banned in those two files too, injected one statement at a time. */
const STILL_BANNED: readonly (readonly [string, ProcessHazard])[] = [
  ["spawnSync('x');", 'process call'],
  ["cp.execSync('x');", 'process call'],
  ["exec('x');", 'process call'],
  ["execFile('x', []);", 'process call'],
  ["cp.execFileSync('x');", 'process call'],
  ["cp.fork('x');", 'process call'],
  ["window.require('node:worker_threads');", 'process module'],
  ['const o = { shell: true };', 'shell option'],
  ['shell.openPath(p);', 'shell.openPath'],
  ['shell.openExternal(url);', 'shell.openPath'],
];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...listSourceFiles(abs));
    else if (/\.(ts|vue|js|mjs|cjs)$/.test(name)) out.push(abs);
  }
  return out;
}

const kindOf = (file: string): ProcessGuardKind => (file.endsWith('.vue') ? 'vue' : 'ts');
const rel = (abs: string): string => relative(SRC_ROOT, abs).replace(/\\/g, '/');
const hazardsOf = (relPath: string): ProcessHazard[] => processHazards(readFileSync(join(SRC_ROOT, relPath), 'utf8'), kindOf(relPath));

describe('nothing under src/ runs a process, except the two allow-listed adapter files (Z37)', () => {
  const files = listSourceFiles(SRC_ROOT).map(rel);

  it('has source files to check (the scan is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no file has a hazard it is not allowed', () => {
    const offenders = files
      .map((file) => ({ file, hazards: hazardsOf(file).filter((h) => !(PROCESS_ALLOWED.get(file) ?? []).includes(h)) }))
      .filter((o) => o.hazards.length > 0);
    expect(offenders).toEqual([]);
  });

  it('each allow-listed file exists and has exactly its allowed hazard, so the list cannot go stale', () => {
    for (const [file, allowed] of PROCESS_ALLOWED) {
      expect(existsSync(join(SRC_ROOT, file)), file).toBe(true);
      expect(hazardsOf(file), file).toEqual(allowed);
    }
  });

  it('flags an injected spawn(\'x\'); call in every real source file (E31\'s blind-spot pin)', () => {
    const missed = files.filter((file) => !processHazards(injectSpawnCall(readFileSync(join(SRC_ROOT, file), 'utf8'), kindOf(file)), kindOf(file)).includes('spawn call'));
    expect(missed).toEqual([]);
  });

  it('still flags every other process API, the shell option and the openers injected into each allow-listed file', () => {
    expect(STILL_BANNED.length).toBeGreaterThan(0);
    for (const file of PROCESS_ALLOWED.keys()) {
      const source = readFileSync(join(SRC_ROOT, file), 'utf8');
      for (const [statement, label] of STILL_BANNED) {
        expect(processHazards(injectStatement(source, 'ts', statement), 'ts'), `${file}: ${statement}`).toContain(label);
      }
    }
  });

  it('the one allowed process module is child_process: neither allow-listed file names worker_threads', () => {
    for (const file of PROCESS_ALLOWED.keys()) expect(readFileSync(join(SRC_ROOT, file), 'utf8'), file).not.toMatch(/worker_threads/);
  });

  it('flags an injected { shell: true } in every real source file', () => {
    const missed = files.filter((file) => !processHazards(injectStatement(readFileSync(join(SRC_ROOT, file), 'utf8'), kindOf(file), 'const o = { shell: true };'), kindOf(file)).includes('shell option'));
    expect(missed).toEqual([]);
  });
});

describe('process hazard detection', () => {
  it.each<[string, ProcessGuardKind, ProcessHazard]>([
    ["import { spawn } from 'node:child_process';", 'ts', 'process module'],
    ["import * as cp from 'child_process';", 'ts', 'process module'],
    ["const cp = await import('node:child_process');", 'ts', 'process module'],
    ["const cp = window.require('child_process');", 'ts', 'process module'],
    ["const { Worker } = window.require('node:worker_threads');", 'ts', 'process module'],
    ["spawn('fallow', ['--format', 'json']);", 'ts', 'spawn call'],
    ["exec('fallow --version');", 'ts', 'process call'],
    ["execFile('fallow', []);", 'ts', 'process call'],
    ["runner.execFileSync('fallow');", 'ts', 'process call'],
    ["cp.spawnSync('fallow');", 'ts', 'process call'],
    ["proc.spawn ('fallow');", 'ts', 'spawn call'],
    ["fork('worker.js');", 'ts', 'process call'],
    ['shell.openPath(report);', 'ts', 'shell.openPath'],
    ['const { openPath } = shell;', 'ts', 'shell.openPath'],
    ["const g = 'dir/*'; spawn('x'); /** doc */", 'ts', 'spawn call'],
    ["const s = '//'; exec(cmd)", 'ts', 'process call'],
    ["spawn?.('fallow');", 'ts', 'spawn call'],
    ["cp.fork?.(['worker.js']);", 'ts', 'process call'],
    ["cp['spawn']('fallow');", 'ts', 'spawn call'],
    ["spawn.call(null, 'fallow');", 'ts', 'spawn call'],
    ["spawn.apply(null, ['fallow']);", 'ts', 'spawn call'],
    ['shell.openExternal(url);', 'ts', 'shell.openPath'],
    ['const { openItem } = shell;', 'ts', 'shell.openPath'],
    ['showItemInFolder(path);', 'ts', 'shell.openPath'],
    ["const t = `${dir}/*`; spawn('x'); /** doc */", 'ts', 'spawn call'],
    ["const t = `a${x}b'c`; spawn('x');", 'ts', 'spawn call'],
    ["const re = /[/*]/; spawn('x'); /** doc */", 'ts', 'spawn call'],
    ["const re = /'/; spawn('x');", 'ts', 'spawn call'],
    ["cp[`spawn`]('x')", 'ts', 'spawn call'],
    ['<template><button @click="exec(cmd)">Run</button></template>', 'vue', 'process call'],
    ['<template><button @click="shell.openPath(p)">Run</button></template>', 'vue', 'shell.openPath'],
    ['<template><ScriptPanel/><p>a backtick ` here</p></template><script setup>\nspawn(\'fallow\');\n</script>', 'vue', 'spawn call'],
    ['<template><!-- the <script> below --><p>Run nothing</p></template><script setup>\nspawn(\'fallow\');\n</script>', 'vue', 'spawn call'],
    ["<template><p>x</p></template><script setup>\nspawn('fallow');\n</script >", 'vue', 'spawn call'],
    ["<template><button @click=\"spawn?.('x')\">Run</button></template>", 'vue', 'spawn call'],
    ["<template><button @click=\"cp['spawn']('x')\">Run</button></template>", 'vue', 'spawn call'],
    ["<template><button @click=\"cp.execSync('x')\">Run</button></template>", 'vue', 'process call'],
    ["const m = 'child_process'; window.require(m);", 'ts', 'process module'],
    ["(spawn)('x');", 'ts', 'spawn call'],
    ["(0, cp.spawn)('x');", 'ts', 'spawn call'],
    ["spawn!('x');", 'ts', 'spawn call'],
    ['spawn`x`;', 'ts', 'spawn call'],
    ["spawn['call'](null);", 'ts', 'spawn call'],
    // Part 7 Z37: the shell option, in each spelling.
    ["cp.spawn('x', [], { shell: true });", 'ts', 'shell option'],
    ["const o = { ['shell']: 'cmd.exe' };", 'ts', 'shell option'],
    ["const o = { 'shell': process.env.SHELL };", 'ts', 'shell option'],
    ['const o = { shell };', 'ts', 'shell option'],
  ])('flags %s (%s) as %s', (source, kind, label) => {
    expect(processHazards(source, kind)).toContain(label);
  });

  it.each<[string, ProcessGuardKind]>([
    ["const drive = /^[A-Za-z]:/.exec(posix)?.[0] ?? null;", 'ts'],
    ["const digits = pattern.exec(id)?.[1];", 'ts'],
    ["// spawn('fallow') is fallow-runner.ts's job, never this one", 'ts'],
    ["/* import { exec } from 'node:child_process' */ const x = 1;", 'ts'],
    ["const executable = 'fallow'; const spawned = false; const forked = 0;", 'ts'],
    ["const note = 'a fork (of…) in the road, not a process';", 'ts'],
    ['const t = `${x} fork (now)`;', 'ts'],
    ['<template><p>Run nothing</p></template><script>const x = 1;</script>', 'vue'],
    ['<!-- openPath is not used --><p>Run nothing</p>', 'vue'],
    ['pattern.exec.call(str);', 'ts'],
    // Part 7 Z37: `shell: false`, and a `shell` that is not a property assignment.
    ["const options = { shell: false, windowsHide: true };", 'ts'],
    ['interface O { shell: false }', 'ts'],
    ['const shell = 1; use(shell);', 'ts'],
  ])('does not flag %s', (source, kind) => {
    expect(processHazards(source, kind)).toEqual([]);
  });

  it('keeps the async spawn apart from every other process API', () => {
    expect(processHazards("spawn('x'); spawnSync('y');", 'ts')).toEqual(['spawn call', 'process call']);
  });
});
