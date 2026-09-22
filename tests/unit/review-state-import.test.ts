// Part 5 V14: the import parser. Top level, schemas, codebase binding, limits, work items.
import { describe, expect, it, vi } from 'vitest';
import { IMPORT_MAX_BYTES, parseReviewState, readReviewStateFile } from '../../src/ui/read-models/review-state-import';
import { REVIEW_STATE_SCHEMA_V1, reviewStateJson, reviewStateSource } from '../../src/ui/read-models/review-state';
import {
  DOC_NOW, DOC_REPO, DOC_SECTIONS, accepted, docFileId, docText, docWith, outcome, targetOf, type ReviewDoc,
} from '../fixtures/review-state-doc';

type Change = (d: ReviewDoc) => void;

describe('review-state import: schemas and codebase (Part 5 V14)', () => {
  it('round-trips the exporter\'s own v2 file, file, package and module targets included (V32)', () => {
    const state = accepted(JSON.parse(docText()));
    expect(state.workItems.map((w) => w.target)).toEqual([
      { kind: 'file', entityId: docFileId('src/a.ts') }, { kind: 'package', name: '@scope/pkg' }, { kind: 'module', module: 'src' },
    ]);
    expect(state.workItems[0]).toEqual({
      id: 'wi-1', target: { kind: 'file', entityId: docFileId('src/a.ts') }, intent: 'refactor', title: 'Split the parser',
      status: 'planned', priority: 'high', notes: 'Start with the lexer.', checks: [false, false, false], createdAt: DOC_NOW,
    });
    expect('updatedAt' in state.workItems[0]!).toBe(false);
    expect(state.workItems[1]!.updatedAt).toBe(DOC_NOW);
    expect(state.rules).toEqual([{ id: 'AR-001', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: DOC_NOW }]);
    expect(state.dispositions).toEqual([
      { fingerprint: `${docFileId('src/a.ts')}#CX-a-1`, status: 'dismissed', reason: 'Generated code', decidedAt: DOC_NOW },
      { fingerprint: `${docFileId('src/b.ts')}#DUP-2`, status: 'acknowledged', decidedAt: DOC_NOW },
    ]);
    expect(state.report).toEqual({ sections: DOC_SECTIONS, note: 'Confirm the parser boundary.' });
    expect(state.origin).toEqual({ folder: 'shop-api' });
    // And back: exporting what was imported writes the same file.
    const again = reviewStateJson({
      workItems: state.workItems, rules: state.rules, dispositions: state.dispositions, report: state.report,
      exportedAt: new Date(DOC_NOW), source: reviewStateSource({ repositoryId: DOC_REPO, scope: { rootPath: '/home/dev/shop-api' } }),
    });
    expect(again).toBe(docText());
  });

  it('accepts v1 (no source) with an unknown origin, and refuses a v1 file that carries a source', () => {
    expect(accepted(docWith((d) => { d.schema = REVIEW_STATE_SCHEMA_V1; delete d.source; })).origin).toBeNull();
    expect(outcome(docWith((d) => { d.schema = REVIEW_STATE_SCHEMA_V1; }))).toBe('invalid source');
  });

  it('accepts v2 exported with no codebase on screen (source null) with an unknown origin', () => {
    expect(accepted(docWith((d) => { d.source = null; })).origin).toBeNull();
  });

  it('refuses a v2 file from another codebase, naming its folder (Part 4 E8/E11)', () => {
    expect(outcome(JSON.parse(docText()), 'repo-other')).toBe('other-codebase shop-api');
  });

  it('refuses text over 1 MB, text that is not JSON, and JSON that is not a known schema', () => {
    expect(parseReviewState(' '.repeat(IMPORT_MAX_BYTES + 1), { repositoryId: DOC_REPO })).toEqual({ ok: false, code: 'too-large', detail: '' });
    for (const text of ['{', '', 'undefined']) expect(parseReviewState(text, { repositoryId: DOC_REPO }), text).toMatchObject({ ok: false, code: 'not-json' });
    for (const doc of [null, [], 'text', {}, docWith((d) => { d.schema = 'codebase-inspector.review-state.v3'; })]) {
      expect(outcome(doc), JSON.stringify(doc).slice(0, 40)).toBe('unknown-schema');
    }
  });

  it('reads a picked file only when it is at most 1 MB, and reports a failed read', async () => {
    const text = vi.fn(() => Promise.resolve('{}'));
    expect(await readReviewStateFile({ size: IMPORT_MAX_BYTES + 1, text } as unknown as Blob, { repositoryId: DOC_REPO })).toMatchObject({ ok: false, code: 'too-large' });
    expect(text).not.toHaveBeenCalled();
    const failing = { size: 10, text: () => Promise.reject(new Error('gone')) } as unknown as Blob;
    expect(await readReviewStateFile(failing, { repositoryId: DOC_REPO })).toEqual({ ok: false, code: 'read-failed', detail: '' });
    expect((await readReviewStateFile(new Blob([docText()]), { repositoryId: DOC_REPO })).ok).toBe(true);
  });

  it.each<[string, Change, string]>([
    ['at the top level', (d) => { d.extra = 1; }, 'invalid extra'],
    ['in a work item', (d) => { d.workItems[0]!.owner = 'x'; }, 'invalid workItems.0.owner'],
    ['in a target', (d) => { targetOf(d).entityId = 'x'; }, 'invalid workItems.0.target.entityId'],
    ['in a rule', (d) => { d.rules[0]!.severity = 'high'; }, 'invalid rules.0.severity'],
    ['in a decision', (d) => { d.dispositions[0]!.by = 'x'; }, 'invalid dispositions.0.by'],
    ['in the report', (d) => { d.report.sections.extra = true; }, 'invalid report.sections.extra'],
    ['in the source', (d) => { (d.source as Record<string, unknown>).path = '/abs'; }, 'invalid source.path'],
  ])('refuses an unknown key %s', (_name, change, expected) => {
    expect(outcome(docWith(change))).toBe(expected);
  });

  it('refuses a malformed exportedAt or top-level note', () => {
    expect(outcome(docWith((d) => { d.exportedAt = 'yesterday'; }))).toBe('invalid exportedAt');
    expect(outcome(docWith((d) => { d.note = 'x'.repeat(501); }))).toBe('invalid note');
  });
});

describe('review-state import: work items (Part 5 V14)', () => {
  it.each<[string, Change, string]>([
    ['an id that is not wi-<digits>', (d) => { d.workItems[0]!.id = 'wi-abc'; }, 'invalid workItems.0.id'],
    ['an id with seven digits', (d) => { d.workItems[0]!.id = 'wi-1234567'; }, 'invalid workItems.0.id'],
    ['a duplicate id', (d) => { d.workItems[1]!.id = 'wi-1'; }, 'invalid workItems.1.id'],
    ['an unknown target kind', (d) => { d.workItems[0]!.target = { kind: 'repo', path: 'x' }; }, 'invalid workItems.0.target.kind'],
    ['a package name over 214', (d) => { targetOf(d, 1).name = 'p'.repeat(215); }, 'invalid workItems.1.target.name'],
    ['a module name over 255', (d) => { targetOf(d, 2).module = 'm'.repeat(256); }, 'invalid workItems.2.target.module'],
    ['an unknown intent', (d) => { d.workItems[0]!.intent = 'rewrite'; }, 'invalid workItems.0.intent'],
    ['a blank title', (d) => { d.workItems[0]!.title = '   '; }, 'invalid workItems.0.title'],
    ['a title over 160 after trimming', (d) => { d.workItems[0]!.title = `  ${'t'.repeat(161)}  `; }, 'invalid workItems.0.title'],
    ['an unknown status', (d) => { d.workItems[0]!.status = 'done'; }, 'invalid workItems.0.status'],
    ['an unknown priority', (d) => { d.workItems[0]!.priority = 'urgent'; }, 'invalid workItems.0.priority'],
    ['notes over 5000', (d) => { d.workItems[0]!.notes = 'n'.repeat(5001); }, 'invalid workItems.0.notes'],
    ['two checks', (d) => { d.workItems[0]!.checks = [true, false]; }, 'invalid workItems.0.checks'],
    ['four checks', (d) => { d.workItems[0]!.checks = [true, false, true, true]; }, 'invalid workItems.0.checks'],
    ['a check that is not a boolean', (d) => { d.workItems[0]!.checks = [true, 'yes', false]; }, 'invalid workItems.0.checks.1'],
    ['a createdAt that is not ISO', (d) => { d.workItems[0]!.createdAt = '22/09/2026'; }, 'invalid workItems.0.createdAt'],
    ['an updatedAt that is not ISO', (d) => { d.workItems[1]!.updatedAt = 'later'; }, 'invalid workItems.1.updatedAt'],
    ['Verified without all three checks (the Verified guard)', (d) => { d.workItems[1]!.checks = [true, true, false]; }, 'invalid workItems.1.status'],
    ['a second item for the same target and intent', (d) => { d.workItems[2]!.target = { kind: 'file', path: 'src/a.ts' }; d.workItems[2]!.intent = 'refactor'; }, 'invalid workItems.2.target'],
  ])('refuses %s', (_name, change, expected) => {
    expect(outcome(docWith(change))).toBe(expected);
  });

  it('refuses more than 2000 work items', () => {
    const doc = docWith((d) => {
      const first = d.workItems[0]!;
      d.workItems = Array.from({ length: 2001 }, (_, i) => ({ ...first, id: `wi-${i + 1}`, target: { kind: 'file', path: `f${i}.ts` } }));
    });
    expect(outcome(doc)).toBe('invalid workItems');
  });

  it('keeps the same target under two different intents', () => {
    expect(outcome(docWith((d) => { d.workItems[2]!.target = { kind: 'file', path: 'src/a.ts' }; }))).toBe('accepted');
  });
});
