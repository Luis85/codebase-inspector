// WP-04.2 NE15 (scenario 22's fast pin): the in-root overlap (IN29, IP26) and sourceNotePath (IN12) hold when the vault
// base path and the codebase root name one folder two ways — through a directory junction or an 8.3 short name —
// with a REAL temp directory and node-access.ts's own resolver, given the real Node modules (in this suite
// Platform.isDesktopApp is false, so node-access.ts's own fs is null). The textual answer is never removed.
import * as nodeFs from 'node:fs';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, rmdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as nodePath from 'node:path';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFixedClock } from '../fixtures/clock';
import { realPathOfNearest } from '../../src/adapters/filesystem/node-access';
import { createInvestigationNotes } from '../../src/host/investigation-notes';

const WINDOWS = process.platform === 'win32';
/** The real Node modules, injected as production's window.require'd ones would be. */
const nodeRealPath = (path: string): string | null => realPathOfNearest(path, { fs: nodeFs, path: nodePath });

async function notesOn(basePath: string, realPath?: (path: string) => string | null) {
  const fake = createFakeVault({ basePath });
  const harness = createFakeProfileStoreHarness();
  await harness.writeRaw({ profiles: [{ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['.git'], maxFileBytes: 1_000_000 }] });
  const notes = createInvestigationNotes(fake.app, {
    folders: createFakeInvestigationFolders(), profiles: harness.store, clock: createFixedClock('2026-09-26T10:00:00.000Z'),
    registerEvent: () => undefined, realPath,
  });
  return { fake, notes };
}

describe.runIf(WINDOWS)('an aliased codebase root (NE15; Windows only: junctions and 8.3 names are Windows filesystem features)', () => {
  // <temp>/vault/code and <temp>/vault/codex on disk, and <temp>/link, a junction naming <temp>/vault/code.
  let temp = '';
  let vault = '';
  let link = '';
  beforeAll(() => {
    temp = mkdtempSync(join(tmpdir(), 'ci-alias-'));
    vault = join(temp, 'vault');
    mkdirSync(join(vault, 'code'), { recursive: true });
    mkdirSync(join(vault, 'codex'));
    link = join(temp, 'link');
    symlinkSync(join(vault, 'code'), link, 'junction');
  });
  afterAll(() => {
    try {
      if (link !== '' && existsSync(link)) rmdirSync(link);   // the junction itself, never recursively into its target
    } finally {
      if (temp !== '') rmSync(temp, { recursive: true, force: true });
    }
  });

  it('realPathOfNearest resolves the deepest existing ancestor and re-appends the rest', () => {
    expect(nodeRealPath(join(link, 'notes', 'deep'))).toBe(join(realpathSync.native(join(vault, 'code')), 'notes', 'deep'));
    expect(nodeRealPath(link)).toBe(realpathSync.native(join(vault, 'code')));
  });

  it('a junction root: a folder inside it overlaps, with the root-relative folder', async () => {
    const { notes } = await notesOn(vault, nodeRealPath);
    expect(notes.plan('code/notes', 'x', link)).toMatchObject({ status: 'ok', overlapsRoot: true, rootRelativeFolder: 'notes' });
    expect(notes.plan('code', 'x', link)).toMatchObject({ status: 'ok', overlapsRoot: true, rootRelativeFolder: null });
  });

  it('a junction root: a folder outside it, or a sibling sharing its prefix, does not overlap', async () => {
    const { notes } = await notesOn(vault, nodeRealPath);
    expect(notes.plan('Notes', 'x', link)).toMatchObject({ status: 'ok', overlapsRoot: false, rootRelativeFolder: null });
    expect(notes.plan('codex/notes', 'x', link)).toMatchObject({ status: 'ok', overlapsRoot: false, rootRelativeFolder: null });
  });

  it.runIf(realpathSync.native(tmpdir()).toLowerCase() !== tmpdir().toLowerCase())(
    'an 8.3 vault base path and the long-form root overlap (runs only where the temp directory has an 8.3 form)',
    async () => {
      const longRoot = realpathSync.native(join(vault, 'code'));
      expect(longRoot.toLowerCase()).not.toBe(join(vault, 'code').toLowerCase());
      const { notes } = await notesOn(vault, nodeRealPath);
      expect(notes.plan('code/notes', 'x', longRoot)).toMatchObject({ status: 'ok', overlapsRoot: true, rootRelativeFolder: 'notes' });
    },
  );

  it('sourceNotePath finds a vault note under a junction root', async () => {
    const { fake, notes } = await notesOn(vault, nodeRealPath);
    await fake.app.vault.createFolder('code');
    await fake.app.vault.createFolder('code/notes');
    await fake.app.vault.create('code/notes/n.md', '# n');
    expect(notes.sourceNotePath(link, 'notes/n.md')).toBe('code/notes/n.md');
    expect(notes.sourceNotePath(link, 'notes/missing.md')).toBeNull();
  });

  it('control: without the resolver, the junction root is not seen as the same folder', async () => {
    const { notes } = await notesOn(vault);
    expect(notes.plan('code/notes', 'x', link)).toMatchObject({ status: 'ok', overlapsRoot: false, rootRelativeFolder: null });
  });
});

describe('the resolver only adds an overlap (NE15)', () => {
  it.each([
    ['resolves nothing', (): string | null => null],
    ['resolves every path somewhere unrelated', (path: string): string | null => `/unrelated${path}`],
  ] as const)('a textual overlap stays when the resolver %s', async (_label, realPath) => {
    const { notes } = await notesOn('/vault', realPath);
    expect(notes.plan('code/notes', 'x', '/vault/code')).toMatchObject({ status: 'ok', overlapsRoot: true, rootRelativeFolder: 'notes' });
    expect(notes.plan('Notes', 'x', '/vault/code')).toMatchObject({ status: 'ok', overlapsRoot: false, rootRelativeFolder: null });
  });

  it('realPathOfNearest answers null where there is no Node filesystem', () => {
    expect(realPathOfNearest(join(tmpdir(), 'x'))).toBeNull();
  });
});

// Fix round 1: realPathOfNearest's own rules with injected fake modules (POSIX paths, so this runs on every platform).
// On the fake disk `/`, `/real` and `/alias` exist, and `/alias` is an alias of `/real`; every other path is missing.
describe('realPathOfNearest with fake modules (NE15)', () => {
  const EXISTING: Record<string, string> = { '/': '/', '/real': '/real', '/alias': '/real' };
  /** A fake `realpathSync.native`: `errors` names paths that fail with another code; a missing path is ENOENT. */
  const fakeResolver = (errors: Record<string, string> = {}) => (path: string): string | null => realPathOfNearest(path, {
    fs: {
      realpathSync: {
        native: (p: string): string => {
          const code = errors[p] ?? (p in EXISTING ? undefined : 'ENOENT');
          if (code !== undefined) throw Object.assign(new Error(`${code}: ${p}`), { code });
          return EXISTING[p]!;
        },
      },
    },
    path: nodePath.posix,
  });

  it.each(['EACCES', 'ENOTDIR'])('an error other than a missing segment (%s) answers null, never an ancestor', (code) => {
    expect(fakeResolver({ '/real/locked': code })('/real/locked')).toBeNull();
    expect(fakeResolver({ '/real/locked': code })('/real/locked/deeper')).toBeNull();
    // Control: the same path, only missing, resolves through its existing ancestor.
    expect(fakeResolver()('/real/locked/deeper')).toBe('/real/locked/deeper');
  });

  it('a root that does not exist at all walks up to its nearest existing ancestor and re-appends the rest', () => {
    expect(fakeResolver()('/alias/gone/code')).toBe('/real/gone/code');
    expect(fakeResolver()('/nowhere/at/all')).toBe('/nowhere/at/all');
  });

  it('a missing aliased root gives no false overlap, and still overlaps where it names the same folder', async () => {
    const { notes } = await notesOn('/real', fakeResolver());
    expect(notes.plan('other/notes', 'x', '/alias/gone/code')).toMatchObject({ status: 'ok', overlapsRoot: false, rootRelativeFolder: null });
    expect(notes.plan('gone/codex/notes', 'x', '/alias/gone/code')).toMatchObject({ status: 'ok', overlapsRoot: false, rootRelativeFolder: null });
    // Control: a folder inside the same missing root, reached through the alias.
    expect(notes.plan('gone/code/notes', 'x', '/alias/gone/code')).toMatchObject({ status: 'ok', overlapsRoot: true, rootRelativeFolder: 'notes' });
  });
});
