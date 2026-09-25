// WP-04 IN23/IN31 (IP7): a marker is a WHOLE line equal to the marker text (only a CR before
// the LF is tolerated). Exactly one begin followed by exactly one end, or the note is refused
// unchanged. Everything outside the two marker lines is returned byte for byte; the new block
// takes the begin line's own line ending.
import { EVIDENCE_BEGIN, EVIDENCE_END } from './note-model';

// IPF1: module-private — spliceEvidenceBlock's caller (Task 9) branches on the `ok`
// discriminant, never by naming this type.
type SpliceResult = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: 'markers-edited' };

interface Line { readonly start: number; readonly end: number; readonly content: string; readonly eol: string }

function linesOf(text: string): Line[] {
  const out: Line[] = [];
  let start = 0;
  while (start < text.length) {
    const nl = text.indexOf('\n', start);
    const end = nl < 0 ? text.length : nl + 1;
    const raw = text.slice(start, end);
    const eol = raw.endsWith('\r\n') ? '\r\n' : raw.endsWith('\n') ? '\n' : '';
    out.push({ start, end, content: raw.slice(0, raw.length - eol.length), eol });
    start = end;
  }
  return out;
}

/** IN31: refuses (text unchanged) unless the note holds exactly one begin line followed by
 *  exactly one end line. On success, the new block takes the begin line's own line ending;
 *  everything outside the two marker lines is returned byte for byte. */
export function spliceEvidenceBlock(note: string, block: string): SpliceResult {
  const lines = linesOf(note);
  const begins = lines.filter((l) => l.content === EVIDENCE_BEGIN);
  const ends = lines.filter((l) => l.content === EVIDENCE_END);
  const begin = begins[0];
  const end = ends[0];
  if (begins.length !== 1 || ends.length !== 1 || !begin || !end || end.start < begin.start) {
    return { ok: false, reason: 'markers-edited' };
  }
  const eol = begin.eol === '\r\n' ? '\r\n' : '\n';
  return { ok: true, text: `${note.slice(0, begin.start)}${block.split('\n').join(eol)}${end.eol}${note.slice(end.end)}` };
}

/** A well-formed block: the first line is EVIDENCE_BEGIN, the last is EVIDENCE_END, and no
 *  line between them equals either marker. */
export function isEvidenceBlock(block: string): boolean {
  const lines = block.split('\n');
  if (lines.length < 2) return false;
  if (lines[0] !== EVIDENCE_BEGIN || lines[lines.length - 1] !== EVIDENCE_END) return false;
  for (let i = 1; i < lines.length - 1; i += 1) {
    if (lines[i] === EVIDENCE_BEGIN || lines[i] === EVIDENCE_END) return false;
  }
  return true;
}
