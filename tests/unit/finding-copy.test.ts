// Part 6 Y35/Y36: how a reported finding reads — its title, the review dialog's rule row
// and File detail's meta line — and the report's evidence line (R6).
import { describe, expect, it } from 'vitest';
import type { FindingDetail } from '../../src/application/evidence/model';
import {
  FINDING_DIALOG_RULE_VALUE, FINDING_META, FINDING_TITLE, FINDING_TITLE_FOR, REPORT_EVIDENCE_TEXT, RULE_TEXT,
} from '../../src/ui/inspector-copy';

const complexity = (exceeded: string): FindingDetail => ({
  kind: 'complexity', cognitive: 27, cyclomatic: 24, lineCount: 40, exceeded, cognitiveThreshold: 15, cyclomaticThreshold: 20,
});
const DUPLICATION: FindingDetail = { kind: 'duplication', tokenCount: 93, lineCount: 15, partnerFiles: 1 };
const UNUSED: FindingDetail = { kind: 'unused', typeOnly: false };

describe('finding copy (Part 6 Y35/Y36)', () => {
  it('titles a finding by its symbol and what the tool reported; the category title is the fallback', () => {
    expect(FINDING_TITLE_FOR('complexity', 'complexity', 'partitionDistrict', complexity('cognitive_crap')))
      .toBe('partitionDistrict · Cognitive complexity 27 (threshold 15)');
    expect(FINDING_TITLE_FOR('complexity', 'complexity', 'walk', complexity('cyclomatic'))).toBe('walk · Cyclomatic complexity 24 (threshold 20)');
    expect(FINDING_TITLE_FOR('duplication', 'duplication', null, DUPLICATION)).toBe('Duplicated block · 15 lines');
    expect(FINDING_TITLE_FOR('unused-exports', 'unused-export', 'fs', UNUSED)).toBe('fs · Unused export');
    expect(FINDING_TITLE_FOR('unused-exports', 'unused-type', 'LabelOptions', { kind: 'unused', typeOnly: true })).toBe('LabelOptions · Unused type');
    expect(FINDING_TITLE_FOR('unused-exports', 'unused-member', null, UNUSED)).toBe(FINDING_TITLE['unused-exports']);
  });

  it('the dialog rule row gives both measures and thresholds, "Reported above threshold" for complexity, and COPY-20 for unused', () => {
    expect(FINDING_DIALOG_RULE_VALUE('complexity', complexity('cognitive_crap')))
      .toBe('Complexity: cognitive 27 (threshold 15), cyclomatic 24 (threshold 20). Reported above threshold.');
    expect(FINDING_DIALOG_RULE_VALUE('duplication', DUPLICATION)).toBe('Duplication: 15 lines, 93 tokens, also in 1 other file.');
    expect(FINDING_DIALOG_RULE_VALUE('duplication', { kind: 'duplication', tokenCount: 60, lineCount: 4, partnerFiles: 0 }))
      .toBe('Duplication: 4 lines, 60 tokens, repeated within this file.');
    expect(FINDING_DIALOG_RULE_VALUE('unused-export', UNUSED))
      .toBe('Unused export. No static consumers reported in this analysis scope. Verify dynamic or framework usage before removal.');
    // Fix round 1: the unused-type rule already says "type"; it is not repeated.
    expect(FINDING_DIALOG_RULE_VALUE('unused-type', { kind: 'unused', typeOnly: true }))
      .toBe('Unused type. No static consumers reported in this analysis scope. Verify dynamic or framework usage before removal.');
    expect(FINDING_DIALOG_RULE_VALUE('unused-export', { kind: 'unused', typeOnly: true })).toMatch(/^Unused export \(type only\)\. /);
  });

  it('the File detail meta line gives the line or the range, then the rule; an unknown rule reads verbatim', () => {
    expect(FINDING_META(7, null, 'unused-export')).toBe('Line 7 · Unused export');
    expect(FINDING_META(3, 6, 'duplication')).toBe('Lines 3–6 · Duplication');
    expect(FINDING_META(3, 3, 'duplication')).toBe('Line 3 · Duplication');
    expect(FINDING_META(null, null, 'complexity')).toBe('Line unknown · Complexity');
    expect(RULE_TEXT('x-new-rule')).toBe('x-new-rule');
    expect(RULE_TEXT('constructor')).toBe('constructor');
  });

  it('the report\'s evidence line no longer calls findings sample data (R6)', () => {
    expect(REPORT_EVIDENCE_TEXT).toContain('fallow evidence (an imported report or a run you started)');
    expect(REPORT_EVIDENCE_TEXT).not.toMatch(/Findings[^.]*sample data/);
  });
});
