// Part 6 Y6/Y7: the stored form is the Part 5 v2 export's own path form, and a read
// validates each record with the import's own schemas.
import { describe, expect, it } from 'vitest';
import { makeEntityId } from '../../src/domain/entity-id';
import type { BoundaryRule, FindingDisposition, WorkItem } from '../../src/ui/stores/ports/review-repository';
import { reviewStateJson } from '../../src/ui/read-models/review-state';
import { decodeRecords, encodeDisposition, encodeRule, encodeWorkItem } from '../../src/ui/read-models/review-record-codec';

const REPO = 'repo-codec';
const AT = '2026-09-23T10:00:00.000Z';
const fileId = (path: string, repositoryId = REPO): string => makeEntityId(repositoryId, 'file', path);
const ITEM: WorkItem = {
  id: 'wi-3', target: { kind: 'file', entityId: fileId('src/a.ts') }, intent: 'tests', title: 'Cover the parser',
  status: 'planned', priority: 'high', notes: 'Edge cases.', checks: [true, false, false], createdAt: AT, updatedAt: AT,
};
const RULE: BoundaryRule = { id: 'AR-004', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: AT };
const DECISION: FindingDisposition = { fingerprint: `${fileId('src/a.ts')}#UN-0a1b2c3d`, status: 'dismissed', reason: 'Public API', decidedAt: AT };
const SECTIONS = { summary: true, architecture: true, hotspots: true, security: true, plan: true };

describe('review record codec (Part 6 Y6, Y7)', () => {
  it('writes exactly what the v2 export writes for the same records', () => {
    const exported = JSON.parse(reviewStateJson({
      workItems: [ITEM], rules: [RULE], dispositions: [DECISION], report: { sections: SECTIONS, note: '' },
      exportedAt: new Date(AT), source: null,
    })) as { workItems: unknown[]; rules: unknown[]; dispositions: unknown[] };
    expect(encodeWorkItem(ITEM, REPO)).toEqual(exported.workItems[0]);
    expect(encodeRule(RULE)).toEqual(exported.rules[0]);
    expect(encodeDisposition(DECISION, REPO)).toEqual(exported.dispositions[0]);
  });

  it('reads back what it writes', () => {
    const decoded = decodeRecords({
      workItems: [encodeWorkItem(ITEM, REPO)], rules: [encodeRule(RULE)], dispositions: [encodeDisposition(DECISION, REPO)],
    }, REPO);
    expect(decoded).toEqual({ workItems: [ITEM], rules: [RULE], dispositions: [DECISION], skipped: 0 });
  });

  it.each<[string, () => unknown]>([
    ['a file target of another codebase', () => encodeWorkItem({ ...ITEM, target: { kind: 'file', entityId: fileId('src/a.ts', 'repo-other') } }, REPO)],
    ['a target that is not an entity id', () => encodeWorkItem({ ...ITEM, target: { kind: 'file', entityId: 'src/a.ts' } }, REPO)],
    ['a directory target', () => encodeWorkItem({ ...ITEM, target: { kind: 'file', entityId: makeEntityId(REPO, 'directory', 'src') } }, REPO)],
    ['a work item id the read would refuse', () => encodeWorkItem({ ...ITEM, id: 'wi-1234567' }, REPO)],
    ['a rule id the read would refuse', () => encodeRule({ ...RULE, id: 'AR-1' })],
    ['a decision without "#"', () => encodeDisposition({ ...DECISION, fingerprint: fileId('src/a.ts') }, REPO)],
    ['a decision of another codebase', () => encodeDisposition({ ...DECISION, fingerprint: `${fileId('src/a.ts', 'repo-other')}#UN-1` }, REPO)],
    ['a decision whose finding id the read would refuse', () => encodeDisposition({ ...DECISION, fingerprint: `${fileId('src/a.ts')}#UN 1` }, REPO)],
  ])('refuses (null) %s', (_name, encode) => {
    expect(encode()).toBeNull();
  });

  it('skips and counts what a read cannot use: invalid, repeated, or not a record; a missing list reads as empty', () => {
    const stored = encodeWorkItem(ITEM, REPO)!;
    const decoded = decodeRecords({
      workItems: [stored, { ...stored, title: '   ' }, stored, { ...stored, id: 'wi-4' }, 7],
      rules: 'not a list',
      dispositions: [{ ...encodeDisposition(DECISION, REPO)!, finding: '/etc/passwd#UN-1' }],
    }, REPO);
    expect(decoded).toEqual({ workItems: [ITEM], rules: [], dispositions: [], skipped: 5 });
    expect(decodeRecords(null, REPO)).toEqual({ workItems: [], rules: [], dispositions: [], skipped: 0 });
  });
});
