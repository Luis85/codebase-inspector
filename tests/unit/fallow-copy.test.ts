// Part 6 Y20, Y25, Y31: the fallow import copy. One message per refusal code, the
// supported set named from FALLOW_SUPPORTED itself, and not-shown labels that fall back
// to fallow's own key.
import { describe, expect, it } from 'vitest';
import { FALLOW_SUPPORTED } from '../../src/application/evidence/raw-fallow';
import {
  FALLOW_IMPORT_ERROR, FALLOW_SUPPORTED_TEXT, FALLOW_UNSUPPORTED, fallowNotShownLabel,
} from '../../src/ui/inspector-copy';

describe('fallow import copy (Part 6 Y20, Y25, Y31)', () => {
  it('has one message for every refusal code, and each says nothing was imported', () => {
    const codes = Object.keys(FALLOW_IMPORT_ERROR).sort();
    expect(codes).toEqual(['invalid', 'not-json', 'read-failed', 'source-mismatch', 'too-large', 'unsupported']);
    for (const code of codes) {
      expect(FALLOW_IMPORT_ERROR[code as keyof typeof FALLOW_IMPORT_ERROR]('')).toContain('Nothing was imported.');
    }
  });

  it('names every supported kind and schema', () => {
    expect(FALLOW_SUPPORTED_TEXT).toBe('combined (schema 11 or 12), dead-code (schema 9), health (schema 11) and dupes (schema 10)');
    expect(FALLOW_SUPPORTED.length).toBeGreaterThan(0);
    for (const s of FALLOW_SUPPORTED) expect(FALLOW_SUPPORTED_TEXT).toContain(s.kind);
  });

  it('says what an unsupported file is when the reader could tell', () => {
    expect(FALLOW_IMPORT_ERROR.unsupported('combined@13')).toBe(FALLOW_UNSUPPORTED('combined', '13'));
    expect(FALLOW_UNSUPPORTED('combined', '13')).toContain('“combined” report at schema 13');
    expect(FALLOW_IMPORT_ERROR.unsupported('')).toBe(`That file is not a fallow report this version can read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was imported.`);
  });

  it('names the first issue of an invalid report', () => {
    expect(FALLOW_IMPORT_ERROR.invalid('health.findings.0.cognitive')).toBe('That fallow report is not valid at health.findings.0.cognitive. Nothing was imported.');
    expect(FALLOW_IMPORT_ERROR.invalid('')).toBe('That fallow report is not valid. Nothing was imported.');
  });

  it('labels a known not-shown count and shows an unknown key as it is, never an inherited property', () => {
    expect(fallowNotShownLabel('unused_files')).toBe('Unused files');
    expect(fallowNotShownLabel('circular_dependencies')).toBe('Circular dependencies');
    expect(fallowNotShownLabel('clone_groups_omitted')).toBe('Clone groups left out of the report');
    expect(fallowNotShownLabel('unused_widgets')).toBe('unused_widgets');
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) expect(fallowNotShownLabel(key)).toBe(key);
  });
});
