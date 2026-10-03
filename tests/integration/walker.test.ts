// Real temporary directories (spec 6): Unicode, whitespace/dot edge cases, depth,
// duplicate basenames, nested ignore rules and Windows drive-path safety. Binary/
// oversized/unreadable content lives in walker-content.test.ts, and symlinks/junctions
// in walker-symlinks.test.ts — task-5-context.md section 6 warns this file alone would
// approach the 450-line tests/** limit covering all eleven brief scenarios at once.
import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { makeTempTree } from '../fixtures/temp-tree';
import type { TempTree } from '../fixtures/temp-tree';
import { isContained } from '../../src/domain/path-safety';
import type { WalkEntry, WalkOptions } from '../../src/application/ports/source-filesystem-port';

const OPTS: WalkOptions = { exclusions: [], maxFileBytes: 1_000_000, followSymlinks: false };

async function walkAll(root: string, opts: WalkOptions = OPTS): Promise<WalkEntry[]> {
  const port = createRealNodePort();
  const { token } = createCancellationToken();
  const out: WalkEntry[] = [];
  for await (const entry of port.walk(root, opts, token)) out.push(entry);
  return out;
}

function assertAllWithinRoot(entries: WalkEntry[], root: string): void {
  for (const entry of entries) {
    if (entry.kind === 'skipped') continue;
    const within = entry.absolutePath === root
      || entry.absolutePath.startsWith(`${root}/`) || entry.absolutePath.startsWith(`${root}\\`);
    expect(within, entry.absolutePath).toBe(true);
  }
}

const trees: TempTree[] = [];
afterEach(async () => {
  await Promise.all(trees.splice(0).map((t) => t.cleanup()));
});

describe('real temporary trees', () => {
  it('handles Unicode names, including combining marks and RTL segments', async () => {
    const tree = await makeTempTree({
      // é spelled as base "e" + a combining acute accent (U+0301), NOT the precomposed
      // form — a common real-world source of "looks the same, isn't the same bytes" bugs.
      'cafe\u0301/e\u0301clair.ts': 'export const x = 1;\n',
      // Arabic (RTL) directory and file name.
      'مجلد/ملف.ts': 'export const y = 2;\n',
    });
    trees.push(tree);
    const entries = await walkAll(tree.root);
    const files = entries.filter((e) => e.kind === 'file').map((e) => e.relativePath).sort();
    expect(files).toEqual(['cafe\u0301/e\u0301clair.ts', 'مجلد/ملف.ts'].sort());
    assertAllWithinRoot(entries, tree.root);
  });

  it('handles names with spaces and trailing dots', async () => {
    const tree = await makeTempTree({
      'dir/name with spaces.ts': 'export const a = 1;\n',
      'dir/trailing.dot.': 'export const b = 2;\n',
      'dir/trailing space .ts': 'export const c = 3;\n',
    });
    trees.push(tree);
    const entries = await walkAll(tree.root);
    const files = entries.filter((e) => e.kind === 'file').map((e) => e.relativePath).sort();
    expect(files).toEqual([
      'dir/name with spaces.ts', 'dir/trailing space .ts', 'dir/trailing.dot.',
    ].sort());
  });

  it('handles deep nesting beyond 20 levels', async () => {
    const depth = 25;
    const segments = Array.from({ length: depth }, (_, i) => `level-${i}`);
    const relPath = `${segments.join('/')}/leaf.ts`;
    const tree = await makeTempTree({ [relPath]: 'export const leaf = true;\n' });
    trees.push(tree);
    const entries = await walkAll(tree.root);
    const found = entries.find((e) => e.kind === 'file' && e.relativePath === relPath);
    expect(found).toBeDefined();
    assertAllWithinRoot(entries, tree.root);
  });

  it('handles duplicate basenames in different directories', async () => {
    const tree = await makeTempTree({
      'a/index.ts': 'export const a = 1;\n',
      'b/index.ts': 'export const b = 2;\n',
      'a/b/index.ts': 'export const ab = 3;\n',
    });
    trees.push(tree);
    const entries = await walkAll(tree.root);
    const files = entries.filter((e) => e.kind === 'file').map((e) => e.relativePath).sort();
    expect(files).toEqual(['a/b/index.ts', 'a/index.ts', 'b/index.ts'].sort());
  });

  it('applies nested ignore rules', async () => {
    const tree = await makeTempTree({
      'src/generated/x.ts': 'export const x = 1;\n',      // excluded: nested path match
      'other/generated/y.ts': 'export const y = 2;\n',    // kept: 'generated' alone is not excluded
      'a/node_modules/dep.ts': 'export const z = 3;\n',   // excluded: basename match, any depth
      'kept/z.ts': 'export const kept = 4;\n',
    });
    trees.push(tree);
    const opts: WalkOptions = { ...OPTS, exclusions: ['src/generated', 'node_modules'] };
    const entries = await walkAll(tree.root, opts);
    const files = entries.filter((e) => e.kind === 'file').map((e) => e.relativePath).sort();
    expect(files).toEqual(['kept/z.ts', 'other/generated/y.ts'].sort());
  });

  it('handles Windows drive paths and prefix collisions', async () => {
    // C:\Projects\app-evil is NOT inside C:\Projects\app — exercised here against REAL
    // OS-provided absolute paths (not hand-typed strings, unlike tests/unit/
    // path-safety.test.ts), since real paths can carry surprises (trailing separators,
    // 8.3 short names) a synthetic string never would.
    const parent = await mkdtemp(join(tmpdir(), 'codebase-inspector-collision-'));
    const appRoot = join(parent, 'app');
    const evilRoot = join(parent, 'app-evil');
    await mkdir(appRoot, { recursive: true });
    await mkdir(evilRoot, { recursive: true });
    await writeFile(join(appRoot, 'kept.ts'), 'export const kept = 1;\n');
    await writeFile(join(evilRoot, 'secret.ts'), 'export const secret = 1;\n');
    try {
      expect(isContained(appRoot, evilRoot)).toBe(false);
      expect(isContained(appRoot, join(evilRoot, 'secret.ts'))).toBe(false);
      const entries = await walkAll(appRoot);
      expect(entries.some((e) => e.kind !== 'skipped' && e.absolutePath.includes('app-evil'))).toBe(false);
      assertAllWithinRoot(entries, appRoot);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('yields nothing outside the approved root under any of the above', async () => {
    const tree = await makeTempTree({
      'cafe\u0301/e\u0301clair.ts': 'content\n',
      'مجلد/ملف.ts': 'content\n',
      'dir/trailing.dot.': 'content\n',
      'a/index.ts': 'content\n',
      'b/index.ts': 'content\n',
      'excluded/x.ts': 'content\n',
    });
    trees.push(tree);
    const entries = await walkAll(tree.root, { ...OPTS, exclusions: ['excluded'] });
    assertAllWithinRoot(entries, tree.root);
    expect(entries.some((e) => e.relativePath.startsWith('excluded'))).toBe(false);
  });
});
