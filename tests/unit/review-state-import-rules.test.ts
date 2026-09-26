// Part 5 V14/V15: the import parser. Rules, decisions, paths, report, source, warnings,
// and imported text staying plain text.
import { describe, expect, it } from 'vitest';
import { accepted, docWith, outcome, targetOf, type ReviewDoc } from '../fixtures/review-state-doc';
import { RULE_RATIONALE_MAX } from '../../src/ui/stores/ports/review-repository';

const NUL = String.fromCharCode(0);
type Change = (d: ReviewDoc) => void;

describe('review-state import: rules and decisions (Part 5 V14)', () => {
  it.each<[string, Change, string]>([
    ['a rule id that is not AR-<3–6 digits>', (d) => { d.rules[0]!.id = 'AR-1'; }, 'invalid rules.0.id'],
    ['a rule from a module to itself', (d) => { d.rules[0]!.to = 'ui'; }, 'invalid rules.0.to'],
    ['an empty from', (d) => { d.rules[0]!.from = ''; }, 'invalid rules.0.from'],
    ['a to over 255', (d) => { d.rules[0]!.to = 'm'.repeat(256); }, 'invalid rules.0.to'],
    ['a blank rationale', (d) => { d.rules[0]!.rationale = '  '; }, 'invalid rules.0.rationale'],
    // Part 5 E9(b): the import parser is bounded by the same constant the store enforces
    // (RuleEditor's rationale textarea and addRule's own refusal), so a reviewer's own
    // export always re-imports.
    ['a rationale over RULE_RATIONALE_MAX', (d) => { d.rules[0]!.rationale = 'r'.repeat(RULE_RATIONALE_MAX + 1); }, 'invalid rules.0.rationale'],
    ['a rule createdAt that is not ISO', (d) => { d.rules[0]!.createdAt = 'now'; }, 'invalid rules.0.createdAt'],
    ['a duplicate rule id', (d) => { d.rules.push({ ...d.rules[0]!, to: 'api' }); }, 'invalid rules.1.id'],
    ['a duplicate rule pair', (d) => { d.rules.push({ ...d.rules[0]!, id: 'AR-002' }); }, 'invalid rules.1.to'],
    ['more than 500 rules', (d) => {
      const first = d.rules[0]!;
      d.rules = Array.from({ length: 501 }, (_, i) => ({ ...first, id: `AR-${String(i + 1).padStart(3, '0')}`, to: `m${i}` }));
    }, 'invalid rules'],
    ['a finding without "#"', (d) => { d.dispositions[0]!.finding = 'src/a.ts'; }, 'invalid dispositions.0.finding'],
    ['a finding id with a space', (d) => { d.dispositions[0]!.finding = 'src/a.ts#CX a'; }, 'invalid dispositions.0.finding'],
    ['a finding id over 64', (d) => { d.dispositions[0]!.finding = `src/a.ts#${'x'.repeat(65)}`; }, 'invalid dispositions.0.finding'],
    ['an unknown decision status', (d) => { d.dispositions[0]!.status = 'open'; }, 'invalid dispositions.0.status'],
    ['a dismissal without a reason', (d) => { delete d.dispositions[0]!.reason; }, 'invalid dispositions.0.reason'],
    ['a dismissal with a blank reason', (d) => { d.dispositions[0]!.reason = '   '; }, 'invalid dispositions.0.reason'],
    ['a dismissal reason over 1000', (d) => { d.dispositions[0]!.reason = 'r'.repeat(1001); }, 'invalid dispositions.0.reason'],
    ['an acknowledgement with a reason', (d) => { d.dispositions[1]!.reason = 'why'; }, 'invalid dispositions.1.reason'],
    ['a decidedAt that is not ISO', (d) => { d.dispositions[0]!.decidedAt = 'today'; }, 'invalid dispositions.0.decidedAt'],
    ['a duplicate finding', (d) => { d.dispositions[1]!.finding = d.dispositions[0]!.finding; }, 'invalid dispositions.1.finding'],
    ['more than 5000 decisions', (d) => {
      const first = d.dispositions[1]!;
      d.dispositions = Array.from({ length: 5001 }, (_, i) => ({ ...first, finding: `f${i}.ts#X-1` }));
    }, 'invalid dispositions'],
  ])('refuses %s', (_name, change, expected) => {
    expect(outcome(docWith(change))).toBe(expected);
  });
});

describe('review-state import: paths (Part 5 V14)', () => {
  const BAD = ['../etc/passwd', 'src/../../x', 'src/..', '/etc/passwd', '\\\\server\\share', 'C:/x', 'c:x', 'src\\a.ts', '', `src/a${NUL}.ts`, 'p'.repeat(1025)];
  it.each(BAD)('refuses the file target path %j', (path) => {
    expect(outcome(docWith((d) => { targetOf(d).path = path; }))).toBe('invalid workItems.0.target.path');
  });
  it.each(BAD)('refuses the finding path %j', (path) => {
    expect(outcome(docWith((d) => { d.dispositions[0]!.finding = `${path}#CX-1`; }))).toBe('invalid dispositions.0.finding');
  });
  it('accepts a nested relative path and a path that contains "#"', () => {
    const state = accepted(docWith((d) => { targetOf(d).path = 'src/deep/a.b.ts'; d.dispositions[0]!.finding = 'docs/c#sharp.md#CX-1'; }));
    expect(state.dispositions[0]!.fingerprint.endsWith('#CX-1')).toBe(true);
  });
});

describe('review-state import: report, source and warnings (Part 5 V14)', () => {
  it.each<[string, Change, string]>([
    ['a missing section', (d) => { delete d.report.sections.plan; }, 'invalid report.sections.plan'],
    ['a section that is not a boolean', (d) => { d.report.sections.summary = 'yes'; }, 'invalid report.sections.summary'],
    ['a report note over 5000', (d) => { d.report.note = 'n'.repeat(5001); }, 'invalid report.note'],
    ['a malformed repository digest', (d) => { d.source = { folder: 'shop-api', repository: 'fnv1a32:XYZ' }; }, 'invalid source.repository'],
    ['a raw repository id as the digest', (d) => { d.source = { folder: 'shop-api', repository: 'repo-xyz' }; }, 'invalid source.repository'],
    ['an empty folder', (d) => { d.source = { folder: '', repository: 'fnv1a32:0123abcd' }; }, 'invalid source.folder'],
    ['a folder over 255', (d) => { d.source = { folder: 'f'.repeat(256), repository: 'fnv1a32:0123abcd' }; }, 'invalid source.folder'],
    ['more than 20 warnings', (d) => { d.warnings = Array.from({ length: 21 }, () => 'w'); }, 'invalid warnings'],
    ['a warning over 200', (d) => { d.warnings = ['w'.repeat(201)]; }, 'invalid warnings.0'],
  ])('refuses %s', (_name, change, expected) => {
    expect(outcome(docWith(change))).toBe(expected);
  });

  it('ignores the top-level note and up to 20 warnings', () => {
    expect(outcome(docWith((d) => { d.note = 'anything'; d.warnings = ['Left out 1 work item.']; }))).toBe('accepted');
  });

  it('keeps an HTML-looking title as plain text: it is data, never markup (V15)', () => {
    const title = '<img src=x onerror=alert(1)>';
    expect(accepted(docWith((d) => { d.workItems[0]!.title = title; })).workItems[0]!.title).toBe(title);
  });
});
