import { describe, expect, it } from 'vitest';
import { makeEntityId } from '../../src/domain/entity-id';
import { REVIEW_STATE_SCHEMA, reviewStateJson } from '../../src/ui/read-models/review-state';
import { NO_CHECKS } from '../../src/ui/stores/ports/review-repository';

const fileId = makeEntityId('repo-xyz', 'file', 'src/a.ts');

describe('review-state export (Part 4 W14)', () => {
  it('writes the schema, relative paths and never a raw entity id', () => {
    const text = reviewStateJson({
      workItems: [{ id: 'wi-1', target: { kind: 'file', entityId: fileId }, intent: 'refactor', title: 't', status: 'planned', priority: 'high', notes: 'n', checks: NO_CHECKS, createdAt: 'c' }],
      rules: [{ id: 'AR-001', from: 'a', to: 'b', rationale: 'r', createdAt: 'c' }],
      dispositions: [{ fingerprint: `${fileId}#CX-a-1`, status: 'dismissed', reason: 'why', decidedAt: 'd' }],
      report: { sections: { summary: true, architecture: false, hotspots: true, security: true, plan: true }, note: 'x' },
      exportedAt: new Date('2026-09-22T10:00:00Z'),
    });
    expect(text).not.toContain(String.fromCharCode(0));
    expect(text).not.toContain(String.fromCharCode(92) + 'u0000');
    expect(text).not.toContain('repo-xyz');
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(data.schema).toBe(REVIEW_STATE_SCHEMA);
    expect(data.exportedAt).toBe('2026-09-22T10:00:00.000Z');
    expect(data.workItems).toEqual([expect.objectContaining({ id: 'wi-1', target: { kind: 'file', path: 'src/a.ts' }, checks: [false, false, false] })]);
    expect(data.dispositions).toEqual([{ finding: 'src/a.ts#CX-a-1', status: 'dismissed', reason: 'why', decidedAt: 'd' }]);
    expect(data.report).toEqual({ sections: { summary: true, architecture: false, hotspots: true, security: true, plan: true }, note: 'x' });
  });
});
