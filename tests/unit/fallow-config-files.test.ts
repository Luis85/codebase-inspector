// GRB9 / GCQ5 / GCP7: which fallow config files sit in a codebase's root. The name list is
// fallow 3.27.0's own (its help text, recorded in the module); the root is checked only, with
// no walk up and no `extends` chain followed.
import { describe, expect, it } from 'vitest';
import { FALLOW_CONFIG_FILE_NAMES, listConfigFiles } from '../../src/application/analysis/fallow-config-files';
import type { SourceFileSystemPort, StatResult } from '../../src/application/ports/source-filesystem-port';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';

describe('listConfigFiles (GRB9)', () => {
  it('names the fallow config files in the root, in fallow\'s own order of precedence', async () => {
    const { port, root } = createFakeSourceFileSystem({ '.fallowrc.json': '{}' });
    expect(await listConfigFiles(port, root)).toEqual(['.fallowrc.json']);
    const all = createFakeSourceFileSystem({ '.fallow.toml': '', 'fallow.toml': '', '.fallowrc.jsonc': '{}', '.fallowrc.json': '{}' });
    expect(await listConfigFiles(all.port, all.root)).toEqual(['.fallowrc.json', '.fallowrc.jsonc', 'fallow.toml', '.fallow.toml']);
    expect(FALLOW_CONFIG_FILE_NAMES).toEqual(['.fallowrc.json', '.fallowrc.jsonc', 'fallow.toml', '.fallow.toml']);
  });

  it('control: a root with no fallow config file gives an empty list', async () => {
    const { port, root } = createFakeSourceFileSystem({ 'package.json': '{}', 'src/a.ts': '' });
    expect(await listConfigFiles(port, root)).toEqual([]);
  });

  it('counts only files in the root itself: a directory of that name, or a nested config, is not one', async () => {
    const { port, root } = createFakeSourceFileSystem({ 'fallow.toml/inner.txt': '', 'packages/app/.fallowrc.json': '{}' });
    expect(await listConfigFiles(port, root)).toEqual([]);
  });

  it('counts a symbolic link by name (it exists and is not a directory), and a failing stat as absent', async () => {
    const { port, root } = createFakeSourceFileSystem({ '.fallowrc.jsonc': { symlinkTo: 'elsewhere.json' } });
    expect(await listConfigFiles(port, root)).toEqual(['.fallowrc.jsonc']);
    const throwing = { stat: () => Promise.reject(new Error('EACCES')) } as unknown as SourceFileSystemPort;
    expect(await listConfigFiles(throwing, root)).toEqual([]);
  });

  it('stats each name under the root, and nothing else', async () => {
    const asked: string[] = [];
    const missing: StatResult = { exists: false, isDirectory: false, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 };
    const port = { stat: (p: string) => { asked.push(p); return Promise.resolve(missing); } } as unknown as SourceFileSystemPort;
    await listConfigFiles(port, 'C:\\work\\app\\');
    expect(asked).toEqual(FALLOW_CONFIG_FILE_NAMES.map((n) => `C:\\work\\app\\${n}`));
  });
});
