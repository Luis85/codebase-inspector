// WP-04 IN19, IN21, IN27 (IP9, IP10, IP11): pure note-name and note-folder rules — no
// Obsidian, no filesystem. Windows-forbidden characters and reserved stems are refused
// wherever a name is typed or built, because Obsidian on Windows silently drops trailing
// dots and a case-insensitive vault would otherwise let a same-name-different-case
// collision through `vault.create` (IPF16).
import { normalizeRelativePath } from '../../domain/path-safety';

// IPF1: module-private — tests reach sanitising through noteBaseName and validateNoteName.
const NOTE_NAME_MAX = 100;
const NOTE_FOLDER_MAX = 200;
const COLLISION_MAX = 99;
// IPF8: the longest possible suffix, ' (99)', reserved out of the 100-code-point budget.
const SUFFIX_RESERVE = ' (99)'.length;
const DEFAULT_ROOT = 'Codebase investigations';

// eslint-disable-next-line no-control-regex -- detecting control characters is the point.
const NAME_FORBIDDEN = /[\\/:*?"<>|#^[\]\u0000-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?=\.|$)/i;

function sanitizeNoteName(value: string): string {
  const cleaned = value.replace(NAME_FORBIDDEN, '').replace(/\s+/g, ' ').trim().replace(/^[.\s]+/, '');
  const cut = Array.from(cleaned).slice(0, NOTE_NAME_MAX).join('');
  return cut.replace(/[.\s]+$/, '').replace(RESERVED, '$1_');
}

export function noteBaseName(findingId: string, kindLabel: string, anchorName: string): string {
  const full = sanitizeNoteName(`${findingId} ${kindLabel} ${anchorName}`);
  return full === '' ? sanitizeNoteName(findingId) : full;
}

export function defaultNoteFolder(profileName: string): string {
  const name = sanitizeNoteName(profileName);
  return name === '' ? DEFAULT_ROOT : `${DEFAULT_ROOT}/${name}`;
}

export type NoteFolderProblem = 'empty' | 'not-relative' | 'too-long' | 'config-dir' | 'unsafe-name';
export type NoteFolderCheck = { ok: true; folder: string } | { ok: false; problem: NoteFolderProblem };

export function validateNoteFolder(value: string, configDir: string): NoteFolderCheck {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (trimmed === '') return { ok: false, problem: 'empty' };
  if (Array.from(trimmed).length > NOTE_FOLDER_MAX) return { ok: false, problem: 'too-long' };
  let folder: string;
  try {
    folder = normalizeRelativePath(trimmed);
  } catch {
    return { ok: false, problem: 'not-relative' };
  }
  const config = `${configDir.toLowerCase()}/`;
  if (`${folder.toLowerCase()}/`.startsWith(config)) return { ok: false, problem: 'config-dir' };
  if (folder.split('/').some((s) => sanitizeNoteName(s) !== s)) return { ok: false, problem: 'unsafe-name' };
  return { ok: true, folder };
}

export type NoteNameProblem = 'empty' | 'too-long' | 'unsafe-name';
export type NoteNameCheck = { ok: true; name: string } | { ok: false; problem: NoteNameProblem };

export function validateNoteName(value: string): NoteNameCheck {
  const trimmed = value.trim().replace(/\.md$/i, '');
  if (trimmed === '') return { ok: false, problem: 'empty' };
  if (Array.from(trimmed).length > NOTE_NAME_MAX) return { ok: false, problem: 'too-long' };
  if (sanitizeNoteName(trimmed) !== trimmed) return { ok: false, problem: 'unsafe-name' };
  return { ok: true, name: trimmed };
}

function trimForSuffix(base: string): string {
  const points = Array.from(base);
  const cut = points.length <= NOTE_NAME_MAX - SUFFIX_RESERVE ? base : points.slice(0, NOTE_NAME_MAX - SUFFIX_RESERVE).join('');
  return cut.replace(/[.\s]+$/, '');
}

export function freeNoteName(base: string, isTaken: (fileName: string) => boolean): string | null {
  if (!isTaken(`${base}.md`)) return `${base}.md`;
  const trimmed = trimForSuffix(base);
  for (let n = 2; n <= COLLISION_MAX; n += 1) {
    const candidate = `${trimmed} (${n}).md`;
    if (!isTaken(candidate)) return candidate;
  }
  return null;
}
