import { describe, expect, it } from 'vitest';
import { EVIDENCE_BEGIN as B, EVIDENCE_END as E } from '../../src/application/investigation/note-model';
import { isEvidenceBlock, spliceEvidenceBlock } from '../../src/application/investigation/evidence-block';

const NEW = [B, 'new', E].join('\n');
const HEAD = '---\nstatus: open\n---\n\n';
const TAIL = '\n## Investigation notes\n\nmine, with <!-- a comment --> and trailing spaces   \n';

describe('spliceEvidenceBlock (IN23, IN31)', () => {
  it('replaces only what lies between the markers, byte for byte', () => {
    const note = `${HEAD}${B}\nold\n${E}${TAIL}`;
    const r = spliceEvidenceBlock(note, NEW);
    expect(r).toEqual({ ok: true, text: `${HEAD}${NEW}${TAIL}` });
  });
  it('keeps a CRLF note CRLF', () => {
    const note = `a\r\n${B}\r\nold\r\n${E}\r\nb\r\n`;
    expect(spliceEvidenceBlock(note, NEW)).toEqual({ ok: true, text: `a\r\n${B}\r\nnew\r\n${E}\r\nb\r\n` });
  });
  it('keeps an end marker on the last line with no newline', () => {
    expect(spliceEvidenceBlock(`${B}\nold\n${E}`, NEW)).toEqual({ ok: true, text: NEW });
  });
  it('takes the begin line\'s own ending with mixed endings (begin CRLF, end LF), byte for byte', () => {
    const note = `${B}\r\nold\n${E}\n`;
    expect(spliceEvidenceBlock(note, NEW)).toEqual({ ok: true, text: `${B}\r\nnew\r\n${E}\n` });
  });
  it('keeps a CRLF note whose end marker is last with no newline', () => {
    const note = `a\r\n${B}\r\nold\r\n${E}`;
    expect(spliceEvidenceBlock(note, NEW)).toEqual({ ok: true, text: `a\r\n${B}\r\nnew\r\n${E}` });
  });
  // Review Focus 1: marker variants.
  it.each([
    ['a duplicated begin', `${B}\n${B}\nx\n${E}\n`],
    ['an end before the begin', `${E}\nx\n${B}\n`],
    ['a vanished end', `${B}\nx\n`],
    ['an indented begin', `  ${B}\nx\n${E}\n`],
    ['a trailing-space end', `${B}\nx\n${E} \n`],
    ['a second block in a code fence', `${B}\nx\n${E}\n\`\`\`\n${B}\n${E}\n\`\`\`\n`],
    ['a BOM before a first-line begin marker', `﻿${B}\nx\n${E}\n`],
    ['an end marker with no begin at all', `x\n${E}\ny\n`],
    ['an indented end marker together with a trailing-space begin marker', `${B} \nx\n  ${E}\n`],
    ['a lone begin marker inside a fence alongside a real block', `${B}\nx\n${E}\n\`\`\`\n${B}\n\`\`\`\n`],
  ])('refuses %s and changes nothing', (_name, note) => {
    expect(spliceEvidenceBlock(note, NEW)).toEqual({ ok: false, reason: 'markers-edited' });
  });
  it('recognises only a well-formed block', () => {
    expect(isEvidenceBlock(NEW)).toBe(true);
    expect(isEvidenceBlock(`${B}\n${E}\n${E}`)).toBe(false);
    expect(isEvidenceBlock(`x\n${B}\n${E}`)).toBe(false);
  });
  // Fix round 1, finding 3: spliceEvidenceBlock must not trust its own `block` argument.
  it('refuses a block that is not itself well-formed (two begin markers), changing nothing', () => {
    const evil = [B, B, 'x', E].join('\n');
    expect(spliceEvidenceBlock(`${B}\nold\n${E}\n`, evil)).toEqual({ ok: false, reason: 'markers-edited' });
  });
  it('refuses a block holding a bare CR, which would double up into "\\r\\r\\n" in a CRLF note', () => {
    const evil = [B, 'x\r', E].join('\n');
    expect(spliceEvidenceBlock(`a\r\n${B}\r\nold\r\n${E}\r\nb\r\n`, evil)).toEqual({ ok: false, reason: 'markers-edited' });
  });
});
