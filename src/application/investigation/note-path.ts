// WP-04 IN19, IN21, IN27 (IP9, IP10, IP11): pure note-name and note-folder rules — no
// Obsidian, no filesystem. Windows-forbidden characters and reserved stems are refused
// wherever a name is typed or built, because Obsidian on Windows silently drops trailing
// dots and a case-insensitive vault would otherwise let a same-name-different-case
// collision through `vault.create` (IPF16).
import { normalizeRelativePath } from '../../domain/path-safety';

// IPF1: module-private — tests reach sanitising through noteBaseName and validateNoteName.
const NOTE_NAME_MAX = 100;
// Task 8 imports NOTE_FOLDER_MAX for its zod shape, so it stays exported (not in IPF1's list).
export const NOTE_FOLDER_MAX = 200;
const COLLISION_MAX = 99;
// IPF8: the longest possible suffix, ' (99)', reserved out of the 100-code-point budget.
const SUFFIX_RESERVE = ' (99)'.length;
const DEFAULT_ROOT = 'Codebase investigations';

function codeRange(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let c = lo; c <= hi; c += 1) out.push(c);
  return out;
}

// Review round 1, finding 1: every control and bidi/format code point is built from a NUMBER
// here, never a literal or escape-text character in source — the module that strips these
// characters out of a note name must not itself carry one as a raw source byte.
const CONTROL_AND_BIDI_CODES = codeRange(0x00, 0x1F).concat(
  codeRange(0x7F, 0x9F),
  [0x200E, 0x200F, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x2066, 0x2067, 0x2068, 0x2069],
);
const CONTROL_AND_BIDI_CHARS = CONTROL_AND_BIDI_CODES.map((c) => String.fromCharCode(c)).join('');
const NAME_FORBIDDEN = new RegExp(`[\\\\/:*?"<>|#^[\\]${CONTROL_AND_BIDI_CHARS}]`, 'g');

// Review round 1, finding 5: Microsoft's documented reserved device names — CON, PRN, AUX,
// NUL, COM0-9, LPT0-9, the superscript-digit variants (COM/LPT followed by superscript 1, 2
// or 3), and CONIN$/CONOUT$. The superscripts are built from code points for the same reason
// as CONTROL_AND_BIDI_CHARS above.
const SUPERSCRIPT_123 = [0xB9, 0xB2, 0xB3].map((c) => String.fromCharCode(c)).join('');
const RESERVED = new RegExp(`^(con|prn|aux|nul|com[0-9${SUPERSCRIPT_123}]|lpt[0-9${SUPERSCRIPT_123}]|conin\\$|conout\\$)(?=\\.|$)`, 'i');

// Review round 1, finding 4: the reserved-name suffix is applied to the UNCUT text, then the
// cut and trailing-dot/space strip happen, then the reserved check runs again — otherwise a
// name already at the 100-code-point cap (e.g. "CON." + 96 chars) grows to 101 code points
// when the suffix lands after the cut. This keeps sanitizeNoteName(sanitizeNoteName(x)) ===
// sanitizeNoteName(x) for every input, never just for the ones a test happens to try twice.
function sanitizeNoteName(value: string): string {
  const cleaned = value.replace(NAME_FORBIDDEN, '').replace(/\s+/g, ' ').trim().replace(/^[.\s]+/, '');
  const suffixed = cleaned.replace(RESERVED, '$1_');
  const cut = Array.from(suffixed).slice(0, NOTE_NAME_MAX).join('');
  const stripped = cut.replace(/[.\s]+$/, '');
  return stripped.replace(RESERVED, '$1_');
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
// Review round 1, finding 3: module-private — validateNoteFolder still exports the check
// itself; an exported function may return a non-exported alias.
type NoteFolderCheck = { ok: true; folder: string } | { ok: false; problem: NoteFolderProblem };

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
// Review round 1, finding 3: module-private, for the same reason as NoteFolderCheck.
type NoteNameCheck = { ok: true; name: string } | { ok: false; problem: NoteNameProblem };

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
