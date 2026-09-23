// Part 7 Z4/Z5 and G6's "Windows launchers": only a regular file named fallow.exe (Windows)
// or fallow (elsewhere) whose first bytes are this platform's native format is accepted.
// npm launchers and scripts are refused by name or by their `#!`. Real temporary files,
// through the real node:fs/promises (M17). Nothing is ever executed.
import * as fsPromises from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createExecutableInspector } from '../../src/adapters/fallow/executable-inspector';
import type { NodeFsPromisesLike } from '../../src/adapters/filesystem/node-globals';
import { makeTempTree, type TempTree, type TempTreeSpec } from '../fixtures/temp-tree';

const fs = fsPromises as unknown as NodeFsPromisesLike;
const PE = { binary: Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]) };
const ELF = { binary: Uint8Array.from([0x7f, 0x45, 0x4c, 0x46]) };
const MACH_O = { binary: Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe]) };
const SCRIPT = '#!/usr/bin/env node\nrequire("../lib/fallow.js");\n';
const windows = createExecutableInspector({ fsPromises: fs, platform: 'win32' });
const linux = createExecutableInspector({ fsPromises: fs, platform: 'linux' });
const mac = createExecutableInspector({ fsPromises: fs, platform: 'darwin' });

const trees: TempTree[] = [];
async function tree(spec: TempTreeSpec): Promise<TempTree> {
  const t = await makeTempTree(spec);
  trees.push(t);
  return t;
}
afterEach(async () => {
  for (const t of trees.splice(0)) await t.cleanup();
});

describe('accepts a native binary (Z4)', () => {
  it('on each platform, with its facts', async () => {
    const t = await tree({ 'win/fallow.exe': PE, 'linux/fallow': ELF, 'mac/fallow': MACH_O });
    const exe = join(t.root, 'win', 'fallow.exe');
    const result = await windows.inspect(exe, join(t.root, 'repo'));
    expect(result).toEqual({
      ok: true,
      facts: {
        executablePath: exe, realPath: await fsPromises.realpath(exe), size: 4,
        mtimeMs: (await fsPromises.stat(exe)).mtimeMs, format: 'pe', insideRoot: false,
      },
    });
    expect(await linux.inspect(join(t.root, 'linux', 'fallow'), t.root)).toMatchObject({ ok: true, facts: { format: 'elf' } });
    expect(await mac.inspect(join(t.root, 'mac', 'fallow'), t.root)).toMatchObject({ ok: true, facts: { format: 'mach-o' } });
  });

  it('Review Focus 2: under a folder whose name has a space and a non-ASCII letter, the path is kept exactly', async () => {
    const t = await tree({ 'Program Files/J\u00f6rg tools/fallow.exe': PE });
    const exe = join(t.root, 'Program Files', 'J\u00f6rg tools', 'fallow.exe');
    expect(await windows.inspect(`  ${exe}  `, t.root)).toMatchObject({ ok: true, facts: { executablePath: exe } });
  });

  it('names the platform\'s only accepted base name', () => {
    expect(windows.executableName).toBe('fallow.exe');
    expect(linux.executableName).toBe('fallow');
  });
});

describe('refuses everything else (Z4, G6 Windows launchers)', () => {
  it('a relative path', async () => {
    expect(await windows.inspect('fallow.exe', '/repo')).toEqual({ ok: false, refusal: 'not-absolute', detail: '' });
  });

  it('npm launchers by name, before touching the disk', async () => {
    for (const name of ['fallow.cmd', 'fallow.bat', 'fallow.ps1', 'fallow.js', 'fallow.mjs', 'fallow.cjs', 'FALLOW.CMD']) {
      expect(await windows.inspect(`C:\\nowhere\\${name}`, 'C:\\repo'), name).toEqual({ ok: false, refusal: 'launcher', detail: 'fallow.exe' });
    }
    expect(await linux.inspect('/nowhere/fallow.sh', '/repo')).toEqual({ ok: false, refusal: 'launcher', detail: 'fallow' });
  });

  it('any other name; case matters outside Windows only', async () => {
    expect(await windows.inspect('C:\\tools\\node.exe', 'C:\\repo')).toEqual({ ok: false, refusal: 'wrong-name', detail: 'fallow.exe' });
    expect(await windows.inspect('C:\\tools\\fallow', 'C:\\repo')).toEqual({ ok: false, refusal: 'wrong-name', detail: 'fallow.exe' });
    expect(await linux.inspect('/tools/Fallow', '/repo')).toEqual({ ok: false, refusal: 'wrong-name', detail: 'fallow' });
    expect(await windows.inspect('C:\\nowhere\\FALLOW.EXE', 'C:\\repo')).toEqual({ ok: false, refusal: 'executable-missing', detail: '' });
  });

  it('a script behind the right name (npm\'s POSIX bin link to a JS launcher)', async () => {
    const t = await tree({ 'bin/fallow': SCRIPT });
    expect(await linux.inspect(join(t.root, 'bin', 'fallow'), t.root)).toEqual({ ok: false, refusal: 'launcher', detail: 'fallow' });
  });

  it('another platform\'s binary, or no binary at all', async () => {
    const t = await tree({ 'a/fallow.exe': ELF, 'b/fallow': PE, 'c/fallow': 'plain text' });
    expect(await windows.inspect(join(t.root, 'a', 'fallow.exe'), t.root)).toEqual({ ok: false, refusal: 'not-native', detail: '' });
    expect(await linux.inspect(join(t.root, 'b', 'fallow'), t.root)).toEqual({ ok: false, refusal: 'not-native', detail: '' });
    expect(await linux.inspect(join(t.root, 'c', 'fallow'), t.root)).toEqual({ ok: false, refusal: 'not-native', detail: '' });
  });

  it('a missing file, a folder, an unreadable file, and no Node at all', async () => {
    const t = await tree({ 'fallow.exe/inner.txt': 'x' });
    expect(await windows.inspect(join(t.root, 'missing', 'fallow.exe'), t.root)).toEqual({ ok: false, refusal: 'executable-missing', detail: '' });
    expect(await windows.inspect(join(t.root, 'fallow.exe'), t.root)).toEqual({ ok: false, refusal: 'not-a-file', detail: '' });
    const denied = createExecutableInspector({
      platform: 'win32',
      fsPromises: { ...fs, stat: () => Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) },
    });
    expect(await denied.inspect('C:\\tools\\fallow.exe', 'C:\\repo')).toEqual({ ok: false, refusal: 'unreadable', detail: 'EACCES' });
    const noNode = createExecutableInspector({ fsPromises: null, platform: 'win32' });
    expect(await noNode.inspect('C:\\tools\\fallow.exe', 'C:\\repo')).toEqual({ ok: false, refusal: 'unreadable', detail: 'UNAVAILABLE' });
  });
});

describe('an executable inside the codebase (Z5)', () => {
  it('is flagged by its path', async () => {
    const t = await tree({ 'repo/tools/fallow.exe': PE, 'elsewhere/fallow.exe': PE });
    const root = join(t.root, 'repo');
    expect(await windows.inspect(join(root, 'tools', 'fallow.exe'), root)).toMatchObject({ ok: true, facts: { insideRoot: true } });
    expect(await windows.inspect(join(t.root, 'elsewhere', 'fallow.exe'), root)).toMatchObject({ ok: true, facts: { insideRoot: false } });
  });

  it('Review Focus 3 (K22): is flagged when the root is reached through a symlink or junction', async () => {
    const t = await tree({ 'real/tools/fallow.exe': PE, link: { symlinkTo: 'real' } });
    const result = await windows.inspect(join(t.root, 'real', 'tools', 'fallow.exe'), join(t.root, 'link'));
    expect(result).toMatchObject({ ok: true, facts: { insideRoot: true } });
  });
});
