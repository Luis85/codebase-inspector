// Part 6 acceptance evidence (2) for the Fallow Ingestion deliverable: importing a report
// runs no code, and nothing under src/ can start a process or hand a path to the shell.
// The detector itself (a real TypeScript AST parse, plus a text scan of a .vue file's
// <template> block) lives in tests/fixtures/process-guard.ts — see its header for what it
// covers, why round 1's regex-then-scanner approach still had a blind spot, and how it
// was fixed (fix round 2, E31). This file holds the whole-tree scan, the flags/does-not-
// flag tables, and a self-test that pins the fixed blind spot against every real file.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectSpawnCall, processHazards, type ProcessGuardKind } from '../fixtures/process-guard';

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

const kindOf = (file: string): ProcessGuardKind => (file.endsWith('.vue') ? 'vue' : 'ts');

describe('nothing under src/ runs a process (Part 6 acceptance 2)', () => {
  const files = listSourceFiles(SRC_ROOT);

  it('has source files to check (the scan is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no file mentions child_process or worker_threads, calls spawn/exec/execFile/fork, or opens a path', () => {
    const offenders = files
      .map((f) => ({ file: relative(SRC_ROOT, f).replace(/\\/g, '/'), hazards: processHazards(readFileSync(f, 'utf8'), kindOf(f)) }))
      .filter((o) => o.hazards.length > 0);
    expect(offenders).toEqual([]);
  });

  // Fix round 2 (E31, Important 2, self-test for the fixed regression): round 1's plain
  // token scanner missed an injected call in 68 of these 262 files (everything after a
  // template substitution or a regex literal). Appending a real call to every file and
  // asserting the detector still reports it pins that blind spot shut, independent of
  // the hand-written snippets below.
  it('flags an injected spawn(\'x\'); call in every real source file', () => {
    const missed = files
      .map((f) => relative(SRC_ROOT, f).replace(/\\/g, '/'))
      .filter((rel) => {
        const kind = kindOf(rel);
        const injected = injectSpawnCall(readFileSync(join(SRC_ROOT, rel), 'utf8'), kind);
        return !processHazards(injected, kind).includes('process call');
      });
    expect(missed).toEqual([]);
  });
});

// The detector itself, one case per spelling, independent of what src/ holds today.
describe('process hazard detection', () => {
  it.each<[string, ProcessGuardKind, string]>([
    ["import { spawn } from 'node:child_process';", 'ts', 'process module'],
    ["import * as cp from 'child_process';", 'ts', 'process module'],
    ["const cp = await import('node:child_process');", 'ts', 'process module'],
    ["const cp = window.require('child_process');", 'ts', 'process module'],
    ["const { Worker } = window.require('node:worker_threads');", 'ts', 'process module'],
    ["spawn('fallow', ['--format', 'json']);", 'ts', 'process call'],
    ["exec('fallow --version');", 'ts', 'process call'],
    ["execFile('fallow', []);", 'ts', 'process call'],
    ["runner.execFileSync('fallow');", 'ts', 'process call'],
    ["proc.spawn ('fallow');", 'ts', 'process call'],
    ["fork('worker.js');", 'ts', 'process call'],
    ["shell.openPath(report);", 'ts', 'shell.openPath'],
    ["const { openPath } = shell;", 'ts', 'shell.openPath'],
    // Fix round 1 (Important 2): a comment-stripping regex that does not know about
    // strings erased the real spawn( call between a string containing "/*" and the next
    // genuine "*/".
    ["const g = 'dir/*'; spawn('x'); /** doc */", 'ts', 'process call'],
    ["const s = '//'; exec(cmd)", 'ts', 'process call'],
    // Fix round 1 (minor 3): spellings the tokenizer version missed.
    ["spawn?.('fallow');", 'ts', 'process call'],
    ["cp.fork?.(['worker.js']);", 'ts', 'process call'],
    ["cp['spawn']('fallow');", 'ts', 'process call'],
    ["spawn.call(null, 'fallow');", 'ts', 'process call'],
    ["spawn.apply(null, ['fallow']);", 'ts', 'process call'],
    ['shell.openExternal(url);', 'ts', 'shell.openPath'],
    ['const { openItem } = shell;', 'ts', 'shell.openPath'],
    ['showItemInFolder(path);', 'ts', 'shell.openPath'],
    // Fix round 2 (Important 2, the scanner regression): a token scanner never re-enters
    // template or regex mode, so everything after a "${…}" substitution or a "/…/ "
    // literal was mis-tokenised. A real parse (tests/fixtures/process-guard.ts) does not
    // have this blind spot.
    ["const t = `${dir}/*`; spawn('x'); /** doc */", 'ts', 'process call'],
    ["const t = `a${x}b'c`; spawn('x');", 'ts', 'process call'],
    ["const re = /[/*]/; spawn('x'); /** doc */", 'ts', 'process call'],
    ["const re = /'/; spawn('x');", 'ts', 'process call'],
    ["cp[`spawn`]('x')", 'ts', 'process call'],
    // Fix round 2: a .vue <template> attribute, scanned as text (not parsed as TS).
    ['<template><button @click="exec(cmd)">Run</button></template>', 'vue', 'process call'],
    ['<template><button @click="shell.openPath(p)">Run</button></template>', 'vue', 'shell.openPath'],
  ])('flags %s (%s)', (source, kind, label) => {
    expect(processHazards(source, kind)).toContain(label);
  });

  it.each<[string, ProcessGuardKind]>([
    ["const drive = /^[A-Za-z]:/.exec(posix)?.[0] ?? null;", 'ts'],
    ["const digits = pattern.exec(id)?.[1];", 'ts'],
    ["// spawn('fallow') is Part 7's job, never this one", 'ts'],
    ["/* import { exec } from 'node:child_process' */ const x = 1;", 'ts'],
    ["const executable = 'fallow'; const spawned = false; const forked = 0;", 'ts'],
    // Fix round 1 (minor 3): prose inside a string, not a real call.
    ["const note = 'a fork (of…) in the road, not a process';", 'ts'],
    // Fix round 2: prose inside a template, still not a real call.
    ['const t = `${x} fork (now)`;', 'ts'],
    // A .vue template with no hazard in either its markup or its script.
    ['<template><p>Run nothing</p></template><script>const x = 1;</script>', 'vue'],
    // Neither a <template> nor a <script> wrapper: nothing to scan, so nothing to flag.
    ['<!-- openPath is not used --><p>Run nothing</p>', 'vue'],
  ])('does not flag %s', (source, kind) => {
    expect(processHazards(source, kind)).toEqual([]);
  });
});
