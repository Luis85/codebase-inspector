// WP-04 IN26–IN33 (IP9, IP12, IP26): the host side of InvestigationNotesPort, and the ONLY
// code that writes vault notes. Every write is one of `vault.createFolder`, `vault.create`,
// `vault.process` or `fileManager.processFrontMatter`, and each targets a path that `plan`
// built from a validated vault-relative folder (IN19: never absolute, never `..`, never the
// config folder) or an existing linked note — so nothing is written outside the chosen
// notes folder, or to an existing note whose frontmatter links it to this codebase. The
// codebase root is written to only when that folder lies inside it, which the create dialog
// shows and the user confirms (O7, IN29); the only profile change is the exclusion that
// path adds through `ProfileStore.update`.
import { FileSystemAdapter, Platform, TFile, TFolder, stringifyYaml } from 'obsidian';
import type { App, EventRef } from 'obsidian';
import { isPlainObject } from '../domain/plain-data';
import { normalizeExclusion, normalizeRelativePath } from '../domain/path-safety';
import { defaultNoteFolder, freeNoteName, validateNoteFolder, validateNoteName } from '../application/investigation/note-path';
import { EVIDENCE_BEGIN, EVIDENCE_END, noteFrontmatter } from '../application/investigation/note-model';
import { isEvidenceBlock, spliceEvidenceBlock } from '../application/investigation/evidence-block';
import { joinRootPath, relativeInside } from '../application/investigation/root-path';
import { readNoteFrontmatter } from '../application/investigation/note-index';
import type { Clock } from '../application/ports/clock';
import type { ProfileStore } from '../application/ports/profile-store';
import type {
  CreateNoteRequest, CreateNoteResult, DestinationPlan, InvestigationNotesPort, NoteDestination,
  RefreshNoteRequest, RefreshNoteResult,
} from '../application/ports/investigation-notes-port';
import type { InvestigationFolderStore } from '../adapters/storage/plugin-data-investigation-store';
import { createNoteIndexSource } from './investigation-note-index';

export interface InvestigationNotesDeps {
  readonly folders: InvestigationFolderStore; readonly profiles: ProfileStore; readonly clock: Clock;
  readonly registerEvent: (ref: EventRef) => void;
  /** WP-04.2 NE15: a path's filesystem form, or null (node-access's realPathOfNearest in the host). Absent: text only. */
  readonly realPath?: RealPath;
}

type RealPath = (path: string) => string | null;

// The smallest well-formed block: spliceEvidenceBlock refuses any block that is not one.
const EMPTY_BLOCK = `${EVIDENCE_BEGIN}\n${EVIDENCE_END}`;

// The same bound the index reads back (IP13): a longer or empty value would be malformed.
const IDENTITY_MAX = 2048;

// Windows and macOS default filesystems are case-insensitive; Linux is not. Read per call.
function containment(): { caseSensitive: boolean } {
  return { caseSensitive: Platform.isLinux };
}

// IN12, IN29: `path` relative to `container` (relativeInside), or null. When the text finds no relation, both are
// compared again in their filesystem form (NE15: a junction or an 8.3 name names one folder two ways), and the relative
// path comes from that matching pair. It only ever adds a relation: a textual one is never re-checked.
function insideOf(container: string, path: string, realPath: RealPath | undefined): string | null {
  const textual = relativeInside(container, path, containment());
  if (textual !== null || realPath === undefined) return textual;
  const realContainer = realPath(container);
  const realTarget = realPath(path);
  return realContainer === null || realTarget === null ? null : relativeInside(realContainer, realTarget, containment());
}

function identityText(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= IDENTITY_MAX;
}

// Defense in depth: the source path is a clean relative path, unchanged by normalising.
function cleanSourcePath(sourcePath: string): boolean {
  try { return normalizeRelativePath(sourcePath) === sourcePath; } catch { return false; }
}

function vaultBase(app: App): string | null {
  const adapter = app.vault.adapter;
  return adapter instanceof FileSystemAdapter ? adapter.getBasePath() : null;
}

function lower(name: string): string {
  return name.toLowerCase();
}

// IP9: an existing child whose name matches case-insensitively (exact first).
function childNamed(parent: TFolder | null, name: string): TFolder | TFile | null {
  if (parent === null) return null;
  const exact = parent.children.find((c) => c.name === name);
  const match = exact ?? parent.children.find((c) => lower(c.name) === lower(name));
  return match instanceof TFolder || match instanceof TFile ? match : null;
}

type CanonicalFolder = { readonly ok: true; readonly folder: string; readonly node: TFolder | null } | { readonly ok: false };

// IP9, IN28: walks the folder's segments from the vault root; an existing segment is matched
// case-insensitively and keeps its own case; a segment that exists as a file refuses.
function canonicalFolder(app: App, folder: string): CanonicalFolder {
  let parent: TFolder | null = app.vault.getRoot();
  const out: string[] = [];
  for (const segment of folder.split('/')) {
    const exact = app.vault.getAbstractFileByPath([...out, segment].join('/'));
    const child: TFolder | TFile | null = exact instanceof TFolder || exact instanceof TFile ? exact : childNamed(parent, segment);
    if (child instanceof TFile) return { ok: false };
    out.push(child === null ? segment : child.name);
    parent = child;
  }
  return { ok: true, folder: out.join('/'), node: parent };
}

// IP9, IN27: taken when the exact path exists OR the folder has a case-insensitive twin.
function nameTaken(app: App, folder: string, node: TFolder | null, fileName: string): boolean {
  if (app.vault.getAbstractFileByPath(`${folder}/${fileName}`) !== null) return true;
  return node !== null && node.children.some((c) => lower(c.name) === lower(fileName));
}

function planDestination(app: App, folder: string, baseName: string, rootPath: string | null, realPath: RealPath | undefined): DestinationPlan {
  const folderCheck = validateNoteFolder(folder, app.vault.configDir);
  if (!folderCheck.ok) return { status: 'invalid-folder', problem: folderCheck.problem };
  const nameCheck = validateNoteName(baseName);
  if (!nameCheck.ok) return { status: 'invalid-name', problem: nameCheck.problem };
  const canonical = canonicalFolder(app, folderCheck.folder);
  if (!canonical.ok) return { status: 'folder-is-file' };
  const fileName = freeNoteName(nameCheck.name, (candidate) => nameTaken(app, canonical.folder, canonical.node, candidate));
  if (fileName === null) return { status: 'no-free-name' };
  const base = vaultBase(app);
  const inside = base === null || rootPath === null ? null : insideOf(rootPath, joinRootPath(base, canonical.folder), realPath);
  return {
    status: 'ok', folder: canonical.folder, fileName, path: `${canonical.folder}/${fileName}`,
    renamed: fileName !== `${nameCheck.name}.md`,
    overlapsRoot: inside !== null, rootRelativeFolder: inside === null || inside === '' ? null : inside,
  };
}

// IN28: one createFolder per missing segment, root first; an existing segment is used as is.
async function ensureFolders(app: App, folder: string): Promise<void> {
  const segments = folder.split('/');
  for (let i = 1; i <= segments.length; i += 1) {
    const prefix = segments.slice(0, i).join('/');
    const existing = app.vault.getAbstractFileByPath(prefix);
    if (existing instanceof TFolder) continue;
    if (existing !== null) throw new Error(`not a folder: ${prefix}`);
    await app.vault.createFolder(prefix);
  }
}

// The body must hold exactly one begin and one end marker line, begin first.
function isEvidenceBlockBody(body: string): boolean {
  return spliceEvidenceBlock(body, EMPTY_BLOCK).ok;
}

// IN29 (IP26): adds the root-relative folder unless it or a parent is already excluded.
async function addExclusion(profiles: ProfileStore, profileId: string, folder: string): Promise<'added' | 'already' | 'failed'> {
  let exclusion: string;
  try { exclusion = normalizeExclusion(folder); } catch { return 'failed'; }
  const result: { outcome: 'added' | 'already' | 'failed' } = { outcome: 'failed' };   // stays 'failed' if the profile is gone
  try {
    await profiles.update(profileId, (p) => {
      if (p.exclusions.some((e) => exclusion === e || exclusion.startsWith(`${e}/`))) { result.outcome = 'already'; return p; }
      result.outcome = 'added';
      return { ...p, exclusions: [...p.exclusions, exclusion] };
    });
  } catch { return 'failed'; }
  return result.outcome;
}

export function createInvestigationNotes(app: App, deps: InvestigationNotesDeps): InvestigationNotesPort {
  const index = createNoteIndexSource(app, deps.registerEvent);   // inert until list or subscribe

  async function create(request: CreateNoteRequest): Promise<CreateNoteResult> {
    const plan = planDestination(app, request.folder, request.baseName, request.rootPath, deps.realPath);
    if (plan.status !== 'ok') return { status: 'refused', reason: 'invalid' };
    if (plan.renamed || !isEvidenceBlockBody(request.body)) return { status: 'refused', reason: plan.renamed ? 'exists' : 'invalid' };
    const frontmatter = noteFrontmatter(request.identity, deps.clock.nowIso());
    // Every value written must read back as a linked note (IP13), never as malformed.
    if (!cleanSourcePath(request.identity.sourcePath) || !Object.values(frontmatter).every(identityText)) {
      return { status: 'refused', reason: 'invalid' };
    }
    const text = `---\n${stringifyYaml(frontmatter)}---\n\n${request.body}`;
    try {
      await ensureFolders(app, plan.folder);
      await app.vault.create(plan.path, text);   // never overwrites (IN27); a rejection is the race guard (IPF16)
    } catch {
      const canonical = canonicalFolder(app, plan.folder);
      const taken = canonical.ok && nameTaken(app, canonical.folder, canonical.node, plan.fileName);
      return { status: 'refused', reason: taken ? 'exists' : 'write-failed' };
    }
    const exclusion = request.excludeFolder && plan.overlapsRoot && plan.rootRelativeFolder !== null
      ? await addExclusion(deps.profiles, request.identity.codebaseId, plan.rootRelativeFolder)
      : 'not-requested';
    return { status: 'created', path: plan.path, exclusion };
  }

  async function refresh(request: RefreshNoteRequest): Promise<RefreshNoteResult> {
    // The splice refuses a CR in the block too; checked here so it is never read as edited markers.
    if (!isEvidenceBlock(request.block) || request.block.includes('\r')) return 'write-failed';
    if (!cleanSourcePath(request.sourcePath) || !identityText(request.snapshotId)) return 'write-failed';
    const file = app.vault.getFileByPath(request.path);
    if (file === null) return 'missing';
    const record = readNoteFrontmatter(file.path, app.metadataCache.getFileCache(file)?.frontmatter);
    if (record?.kind !== 'linked' || record.link.codebaseId !== request.codebaseId) return 'not-linked';
    const state = { refused: false };
    try {
      // IN31: the callback may see newer text than the cache did, so the markers are
      // re-validated here; a refusal returns the text unchanged and is never retried.
      await app.vault.process(file, (data) => {
        const spliced = spliceEvidenceBlock(data, request.block);
        if (spliced.ok) return spliced.text;
        state.refused = true;
        return data;
      });
    } catch { return 'write-failed'; }
    if (state.refused) return 'markers-edited';
    try {
      // IN32 (IP8): only these two keys change; every other value is kept.
      await app.fileManager.processFrontMatter(file, (frontmatter: unknown) => {
        if (!isPlainObject(frontmatter)) return;
        frontmatter.snapshot_id = request.snapshotId;
        frontmatter.source_path = request.sourcePath;
      });
    } catch { return 'partial'; }   // WP-04 E15: the block was already replaced
    return 'refreshed';
  }

  async function destination(codebaseId: string): Promise<NoteDestination> {
    const stored = await deps.folders.read(codebaseId);
    if (stored !== null) return { folder: stored, isDefault: false };
    const profile = await deps.profiles.get(codebaseId);
    return { folder: defaultNoteFolder(profile?.name ?? ''), isDefault: true };
  }

  async function open(path: string): Promise<boolean> {
    const file = app.vault.getFileByPath(path);
    if (file === null) return false;
    try {
      await app.workspace.getLeaf(true).openFile(file);
    } catch { return false; }
    return true;
  }

  // IN12: only a `.md` file the vault itself holds, under the vault base path.
  function sourceNotePath(rootPath: string, relativePath: string): string | null {
    const base = vaultBase(app);
    if (base === null) return null;
    const inVault = insideOf(base, joinRootPath(rootPath, relativePath), deps.realPath);
    if (inVault === null || inVault === '') return null;
    const file = app.vault.getFileByPath(inVault);
    return file !== null && file.extension === 'md' ? file.path : null;
  }

  return {
    destination,
    plan: (folder, baseName, rootPath) => planDestination(app, folder, baseName, rootPath, deps.realPath),
    list: (codebaseId) => index.list(codebaseId),
    create,
    refresh,
    open,
    sourceNotePath,
    subscribe: (listener) => index.subscribe(listener),
  };
}
