// Task 7 (IN37, IP29, IP30): an in-memory Obsidian vault. Later tasks (9, 13, 14, 16)
// drive `src/host/investigation-notes.ts` against this instead of a real vault. It is
// stricter where the real host is loose -- `createFolder` never auto-creates missing
// parents (IPF20 says real Obsidian does; IN28 requires the host to create one segment
// at a time regardless) -- and faithful where the ledger's Task 0 native probes recorded
// real behaviour (IPF16, IPF18, IPF19, IPF20).
//
// Harness-safe (IP30): no `vitest`, no `node:*`. Task 17's browser harness bundles this
// file directly.
import {
  CapacitorAdapter, FileSystemAdapter, TFile, TFolder, parseYaml, stringifyYaml,
} from '../mocks/obsidian';
import { isPlainObject } from '../../src/domain/plain-data';
import type { TAbstractFile } from '../mocks/obsidian';
import type { App } from 'obsidian';

export interface FakeVaultOptions {
  basePath?: string | null;                    // null: a CapacitorAdapter (no vault base path)
  configDir?: string;
  // IPF16: this Windows vault's `vault.create` also rejects a case-only variant of an
  // existing path. Default matches that observed host; Task 9 sets this false to cover a
  // case-sensitive (Linux) vault too (IP9's own "Low" risk note).
  caseInsensitive?: boolean;
}

export interface FakeVault {
  readonly app: App;
  text(path: string): string | undefined;
  paths(): string[];
  userWrite(path: string, text: string): void;
  userRename(oldPath: string, newPath: string): void;
  userDelete(path: string): void;
  resolve(): void;
  raceNextCreate(path: string, text: string): void;
  readonly opened: string[];
  readonly calls: { getMarkdownFiles: number; create: number; createFolder: number; process: number; processFrontMatter: number };
}

type Listener = (...args: unknown[]) => unknown;
interface FakeEventRef { name: string; cb: Listener }

// Module scope (oxlint consistent-function-scoping): captures nothing from an enclosing
// closure, so this is a plain factory, not a nested helper.
function createEmitter(): {
  on: (name: string, cb: Listener) => FakeEventRef;
  off: (name: string, cb: Listener) => void;
  trigger: (name: string, ...args: unknown[]) => void;
} {
  const listeners = new Map<string, Set<Listener>>();
  return {
    on(name, cb) {
      const set = listeners.get(name) ?? new Set<Listener>();
      set.add(cb);
      listeners.set(name, set);
      return { name, cb };
    },
    off(name, cb) { listeners.get(name)?.delete(cb); },
    trigger(name, ...args) { for (const cb of listeners.get(name) ?? []) cb(...args); },
  };
}

function splitPath(path: string): { parent: string; name: string } {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? { parent: '', name: path } : { parent: path.slice(0, idx), name: path.slice(idx + 1) };
}

function splitExtension(name: string): { basename: string; extension: string } {
  const idx = name.lastIndexOf('.');
  return idx <= 0 ? { basename: name, extension: '' } : { basename: name.slice(0, idx), extension: name.slice(idx + 1) };
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function findCaseInsensitiveKey(path: string, keys: Iterable<string>): string | undefined {
  const target = path.toLowerCase();
  for (const key of keys) { if (key.toLowerCase() === target) return key; }
  return undefined;
}

// Finds the leading `---` frontmatter block Obsidian recognises: an opening `---` line,
// content, then a line that is exactly `---`. Returns the YAML text (between the markers)
// and the body (everything after the closing marker's newline), or null when no such
// block opens the file.
function findFrontmatterBlock(text: string): { yamlText: string; body: string } | null {
  if (!text.startsWith('---\n')) return null;
  let pos = 4;
  while (pos <= text.length) {
    const nl = text.indexOf('\n', pos);
    const lineEnd = nl === -1 ? text.length : nl;
    if (text.slice(pos, lineEnd) === '---') {
      const bodyStart = nl === -1 ? text.length : nl + 1;
      return { yamlText: text.slice(4, pos), body: text.slice(bodyStart) };
    }
    if (nl === -1) return null;
    pos = nl + 1;
  }
  return null;
}

// IPF19: parsed VALUES match the real host; a block that fails to parse, or parses to
// anything other than a mapping, has no usable frontmatter (undefined, matching
// CachedMetadata['frontmatter']?: FrontMatterCache being optional).
function parseFrontmatterValue(text: string): unknown {
  const block = findFrontmatterBlock(text);
  if (!block) return undefined;
  try {
    const value = parseYaml(block.yamlText);
    return isPlainObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

// fileManager.processFrontMatter: parse the existing mapping (or start from {}), let the
// caller mutate it in place, then re-serialise. The body after the closing marker is
// carried over untouched -- byte for byte -- which is what makes the "body stays
// byte-identical" test meaningful.
function applyFrontMatter(text: string, fn: (frontmatter: unknown) => void): string {
  const block = findFrontmatterBlock(text);
  let obj: Record<string, unknown> = {};
  if (block) {
    try {
      const parsed = parseYaml(block.yamlText);
      if (isPlainObject(parsed)) obj = { ...parsed };
    } catch { /* malformed existing YAML: start fresh, matching a hand-broken note */ }
  }
  fn(obj);
  const body = block ? block.body : text;
  return `---\n${stringifyYaml(obj)}---\n${body}`;
}

interface FileRecord { file: TFile; text: string }

// Task 9: the host reads `TFolder.children` for case-only collisions (IP9), so a renamed or
// deleted file must leave its old folder's child list, as it does in the real vault.
function detach(file: TFile): void {
  const siblings = file.parent?.children;
  if (!siblings) return;
  const at = siblings.indexOf(file);
  if (at !== -1) siblings.splice(at, 1);
}

export function createFakeVault(options: FakeVaultOptions = {}): FakeVault {
  const caseInsensitive = options.caseInsensitive ?? true;
  const configDir = options.configDir ?? '.obsidian';
  const adapter = options.basePath === null
    ? new CapacitorAdapter()
    : new FileSystemAdapter(options.basePath ?? '/fake-vault');

  const rootFolder = new TFolder();
  rootFolder.path = '/';

  const files = new Map<string, FileRecord>();
  const folderObjects = new Map<string, TFolder>();
  const pendingRaces = new Map<string, string>();
  const opened: string[] = [];
  const calls = { getMarkdownFiles: 0, create: 0, createFolder: 0, process: 0, processFrontMatter: 0 };
  let clock = 0;
  const nextTime = (): number => { clock += 1; return clock; };

  const vaultEvents = createEmitter();
  const metaEvents = createEmitter();

  function resolveFolder(path: string): TFolder | null {
    if (path === '') return rootFolder;
    const exact = folderObjects.get(path);
    if (exact) return exact;
    if (!caseInsensitive) return null;
    const key = findCaseInsensitiveKey(path, folderObjects.keys());
    return key === undefined ? null : (folderObjects.get(key) ?? null);
  }

  function folderExists(path: string): boolean {
    return path === '' || resolveFolder(path) !== null;
  }

  // Fix round 2: `excludeFile` lets a caller (userRename) ask "is this path taken BY
  // SOMEONE ELSE" -- without it, a case-only match always includes the file's own
  // existing entry, so a case-only rename to itself (`note.md` -> `Note.md`, legitimate
  // in real Obsidian) would wrongly read as a collision with itself.
  function isTaken(path: string, excludeFile?: string): boolean {
    if (files.has(path) || folderObjects.has(path)) return true;
    if (!caseInsensitive) return false;
    const fileMatch = findCaseInsensitiveKey(path, files.keys());
    if (fileMatch !== undefined && fileMatch !== excludeFile) return true;
    return findCaseInsensitiveKey(path, folderObjects.keys()) !== undefined;
  }

  // Fix round 1 (WP-04 E12): the real metadata cache re-parses OFF the write, not
  // synchronously inside `vault.create`/`process`/`fileManager.processFrontMatter` -- the
  // Task 0 native probe had to poll for `changed` after each of those calls returned.
  // Firing synchronously here would let a later task's test pass against the fake while
  // depending on an event order the real host never gives it. `queueMicrotask` defers the
  // trigger to (at least) the next microtask tick, always after the write's own return
  // completes; callers must await the event, not just the write's promise.
  function fireChanged(file: TFile, text: string): void {
    const cache = { frontmatter: parseFrontmatterValue(text) };
    queueMicrotask(() => { metaEvents.trigger('changed', file, text, cache); });
  }

  function rawCreate(path: string, text: string): TFile {
    const { parent, name } = splitPath(path);
    const { basename, extension } = splitExtension(name);
    const file = new TFile();
    file.path = path; file.name = name; file.basename = basename; file.extension = extension;
    file.parent = resolveFolder(parent);
    file.vault = null;
    const time = nextTime();
    file.stat = { ctime: time, mtime: time, size: byteLength(text) };
    files.set(path, { file, text });
    file.parent?.children.push(file);
    vaultEvents.trigger('create', file);
    fireChanged(file, text);
    return file;
  }

  async function create(path: string, data: string): Promise<TFile> {
    calls.create += 1;
    const raceText = pendingRaces.get(path);
    if (raceText !== undefined) { pendingRaces.delete(path); rawCreate(path, raceText); }
    if (isTaken(path)) throw new Error('File already exists.');
    const { parent } = splitPath(path);
    if (!folderExists(parent)) throw new Error('Folder does not exist.');
    return rawCreate(path, data);
  }

  async function createFolder(path: string): Promise<TFolder> {
    calls.createFolder += 1;
    if (isTaken(path)) throw new Error('Folder already exists.');
    const { parent, name } = splitPath(path);
    if (!folderExists(parent)) throw new Error('Parent folder does not exist.');
    const folder = new TFolder();
    folder.path = path; folder.name = name;
    folder.parent = resolveFolder(parent);
    folderObjects.set(path, folder);
    folder.parent?.children.push(folder);
    vaultEvents.trigger('create', folder);
    return folder;
  }

  async function processFile(file: TFile, fn: (data: string) => string): Promise<string> {
    calls.process += 1;
    const record = files.get(file.path);
    if (!record) throw new Error(`fake vault: no file at ${file.path}`);
    const next = fn(record.text);
    record.text = next;
    record.file.stat = { ...record.file.stat, mtime: nextTime(), size: byteLength(next) };
    fireChanged(record.file, next);
    return next;
  }

  async function processFrontMatterImpl(file: TFile, fn: (frontmatter: unknown) => void): Promise<void> {
    calls.processFrontMatter += 1;
    const record = files.get(file.path);
    if (!record) throw new Error(`fake vault: no file at ${file.path}`);
    const next = applyFrontMatter(record.text, fn);
    record.text = next;
    record.file.stat = { ...record.file.stat, mtime: nextTime(), size: byteLength(next) };
    fireChanged(record.file, next);
  }

  const leaf = { openFile: (file: TFile): Promise<void> => { opened.push(file.path); return Promise.resolve(); } };

  const vault = {
    adapter,
    configDir,
    getAbstractFileByPath: (path: string): TAbstractFile | null => files.get(path)?.file ?? folderObjects.get(path) ?? null,
    // Task 9: the host walks folders from the root (IP9) and reads notes by exact path.
    getRoot: (): TFolder => rootFolder,
    getFileByPath: (path: string): TFile | null => files.get(path)?.file ?? null,
    getMarkdownFiles: (): TFile[] => {
      calls.getMarkdownFiles += 1;
      return Array.from(files.values()).filter((r) => r.file.extension === 'md').map((r) => r.file);
    },
    create,
    createFolder,
    process: processFile,
    on: vaultEvents.on,
    off: vaultEvents.off,
  };

  const metadataCache = {
    getFileCache: (file: TFile): { frontmatter: unknown } | null => {
      const record = files.get(file.path);
      return record ? { frontmatter: parseFrontmatterValue(record.text) } : null;
    },
    on: metaEvents.on,
    off: metaEvents.off,
  };

  const fileManager = { processFrontMatter: processFrontMatterImpl };
  const workspace = { getLeaf: (_newLeaf?: boolean): typeof leaf => leaf };

  // One cast at the boundary (IN37's brief): this double implements only the members the
  // host actually calls, not the full Obsidian App surface.
  const app = { vault, workspace, metadataCache, fileManager } as unknown as App;

  return {
    app,
    text: (path) => files.get(path)?.text,
    paths: () => Array.from(files.keys()).sort(),
    userWrite(path, text) {
      const record = files.get(path);
      if (!record) throw new Error(`fake vault: no file at ${path}`);
      record.text = text;
      record.file.stat = { ...record.file.stat, mtime: nextTime(), size: byteLength(text) };
      fireChanged(record.file, text);
    },
    // Fix round 1: the `user*` helpers model an event that ALREADY happened in the real
    // vault (someone else's edit), not a request the fake can refuse -- so a colliding
    // destination here is the test's own mistake, not a race to model; it throws loudly
    // rather than silently overwriting the file already at that path.
    userRename(oldPath, newPath) {
      const record = files.get(oldPath);
      if (!record) throw new Error(`fake vault: no file at ${oldPath}`);
      if (newPath !== oldPath && isTaken(newPath, oldPath)) {
        throw new Error(`fake vault: userRename destination already exists: ${newPath}`);
      }
      files.delete(oldPath);
      detach(record.file);
      const { parent, name } = splitPath(newPath);
      const { basename, extension } = splitExtension(name);
      record.file.path = newPath; record.file.name = name;
      record.file.basename = basename; record.file.extension = extension;
      record.file.parent = resolveFolder(parent);
      record.file.parent?.children.push(record.file);
      files.set(newPath, record);
      vaultEvents.trigger('rename', record.file, oldPath);
      fireChanged(record.file, record.text);
    },
    userDelete(path) {
      const record = files.get(path);
      if (!record) throw new Error(`fake vault: no file at ${path}`);
      files.delete(path);
      detach(record.file);
      vaultEvents.trigger('delete', record.file);
    },
    resolve() { metaEvents.trigger('resolved'); },
    raceNextCreate(path, text) { pendingRaces.set(path, text); },
    opened,
    calls,
  };
}
