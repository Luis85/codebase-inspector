// Real temporary directories (spec 6): symlinks and junctions, split out of
// walker.test.ts (task-5-context.md section 6). A Windows junction (directory reparse
// point) is created without elevation and DOES register `isSymbolicLink() === true` via
// lstat (verified directly before writing this file); a Windows FILE symlink needs
// Developer Mode or an elevated process (verified: EPERM without it), so that half is
// attempted but skipped, never required, when this machine cannot grant it.
import { afterEach, describe, expect, it } from 'vitest';
import { symlink, writeFile, mkdir, rm } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { makeTempTree } from '../fixtures/temp-tree';
import type { TempTree } from '../fixtures/temp-tree';
import type { WalkEntry, WalkOptions } from '../../src/application/ports/source-filesystem-port';

const OPTS: WalkOptions = { exclusions: [], maxFileBytes: 1_000_000, followSymlinks: false };

async function walkAll(root: string): Promise<WalkEntry[]> {
  const port = createRealNodePort();
  const { token } = createCancellationToken();
  const out: WalkEntry[] = [];
  for await (const entry of port.walk(root, OPTS, token)) out.push(entry);
  return out;
}

const trees: TempTree[] = [];
afterEach(async () => {
  await Promise.all(trees.splice(0).map((t) => t.cleanup()));
});

let fileSymlinksSupported = false;
{
  const probeDir = await mkdtemp(join(tmpdir(), 'codebase-inspector-symlink-probe-'));
  try {
    await writeFile(join(probeDir, 'target'), 'x');
    await symlink(join(probeDir, 'target'), join(probeDir, 'link'));
    fileSymlinksSupported = true;
  } catch { /* EPERM without Developer Mode / elevation on this machine — see file header */ }
  finally { await rm(probeDir, { recursive: true, force: true }); }
}

describe('real temporary trees: symlinks and junctions', () => {
  it('skips a directory junction without following it', async () => {
    const tree = await makeTempTree({
      'target/inside.ts': 'export const inside = 1;\n',
      linked: { symlinkTo: 'target' },
    });
    trees.push(tree);
    const entries = await walkAll(tree.root);
    const linkEntry = entries.find((e) => e.relativePath === 'linked');
    expect(linkEntry).toBeDefined();
    expect(linkEntry!.kind).toBe('skipped');
    expect((linkEntry as Extract<WalkEntry, { kind: 'skipped' }>).reason).toMatch(/symlink/i);
    // Never followed: the target's content is reachable at its OWN path, but not a
    // second time underneath the link.
    expect(entries.some((e) => e.relativePath === 'target/inside.ts')).toBe(true);
    expect(entries.some((e) => e.relativePath.startsWith('linked/'))).toBe(false);
  });

  it.skipIf(!fileSymlinksSupported)('skips a file symlink without following it', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'codebase-inspector-filelink-'));
    try {
      await mkdir(join(parent, 'root'), { recursive: true });
      await writeFile(join(parent, 'root', 'target.ts'), 'export const t = 1;\n');
      await symlink(join(parent, 'root', 'target.ts'), join(parent, 'root', 'link.ts'));
      const entries = await walkAll(join(parent, 'root'));
      const linkEntry = entries.find((e) => e.relativePath === 'link.ts');
      expect(linkEntry).toBeDefined();
      expect(linkEntry!.kind).toBe('skipped');
      expect((linkEntry as Extract<WalkEntry, { kind: 'skipped' }>).reason).toMatch(/symlink/i);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
