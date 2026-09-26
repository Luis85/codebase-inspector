import { describe, expect, it } from 'vitest';
import { makeEntityId } from '../../src/domain/entity-id';
import {
  REVIEW_STATE_SCHEMA, REVIEW_STATE_SCHEMA_V1, findingRef, repositoryDigest, reviewStateJson, reviewStateSource,
  type ReviewStateInput,
} from '../../src/ui/read-models/review-state';
import { REVIEW_STATE_SKIPPED } from '../../src/ui/inspector-copy';
import { NO_CHECKS, type WorkItem, type WorkTarget } from '../../src/ui/stores/ports/review-repository';

// 'repo-xyz' (not a bare 'repo', which the "report" key itself contains) so every
// not-leaked assertion below is meaningful.
const REPO = 'repo-xyz';
const ROOT = 'C:\\Users\\someone\\projects\\shop-api';
const fileId = makeEntityId(REPO, 'file', 'src/a.ts');
const SECTIONS = { summary: true, architecture: false, hotspots: true, security: true, plan: true };
const item = (id: string, target: WorkTarget): WorkItem => ({
  id, target, intent: 'refactor', title: 't', status: 'planned', priority: 'high', notes: 'n', checks: NO_CHECKS, createdAt: 'c',
});
const input = (over: Partial<ReviewStateInput> = {}): ReviewStateInput => ({
  workItems: [], rules: [], dispositions: [], report: { sections: SECTIONS, note: 'x' },
  exportedAt: new Date('2026-09-22T10:00:00Z'), source: null, ...over,
});
const data = (text: string) => JSON.parse(text) as Record<string, unknown>;

describe('review-state export (Part 4 W14, Part 5 V11–V12)', () => {
  it('writes the v2 schema, relative paths and never a raw entity id or a NUL', () => {
    const text = reviewStateJson(input({
      workItems: [item('wi-1', { kind: 'file', entityId: fileId })],
      rules: [{ id: 'AR-001', from: 'a', to: 'b', rationale: 'r', createdAt: 'c' }],
      dispositions: [{ fingerprint: `${fileId}#CX-a-1`, status: 'dismissed', reason: 'why', decidedAt: 'd' }],
    }));
    expect(text).not.toContain(String.fromCharCode(0));
    expect(text).not.toContain(String.fromCharCode(92) + 'u0000');
    expect(text).not.toContain(REPO);
    const d = data(text);
    expect(d.schema).toBe(REVIEW_STATE_SCHEMA);
    expect(REVIEW_STATE_SCHEMA).toBe('codebase-inspector.review-state.v2');
    expect(REVIEW_STATE_SCHEMA_V1).toBe('codebase-inspector.review-state.v1');
    expect(d.exportedAt).toBe('2026-09-22T10:00:00.000Z');
    expect(d.source).toBeNull();
    expect(d.workItems).toEqual([expect.objectContaining({ id: 'wi-1', target: { kind: 'file', path: 'src/a.ts' }, checks: [false, false, false] })]);
    expect(d.dispositions).toEqual([{ finding: 'src/a.ts#CX-a-1', status: 'dismissed', reason: 'why', decidedAt: 'd' }]);
    expect(d.report).toEqual({ sections: SECTIONS, note: 'x' });
    expect('warnings' in d).toBe(false);
  });

  it('writes the source as the folder label and a digest: never the raw repository id, never the absolute root (V11)', () => {
    const source = reviewStateSource({ repositoryId: REPO, scope: { rootPath: ROOT } });
    expect(source).toEqual({ folder: 'shop-api', repository: repositoryDigest(REPO) });
    expect(source?.repository).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    const text = reviewStateJson(input({ source, workItems: [item('wi-1', { kind: 'file', entityId: fileId })] }));
    expect(data(text).source).toEqual(source);
    for (const leak of [REPO, 'someone', 'projects', 'Users']) expect(text, leak).not.toContain(leak);
    expect(reviewStateSource(null)).toBeNull();
    expect(reviewStateSource({ repositoryId: REPO, scope: { rootPath: '/' } })?.folder).toBe('(root)');
  });

  it('repositoryDigest is FNV-1a 32 in eight hex digits, and tells codebases apart', () => {
    expect(repositoryDigest('')).toBe('fnv1a32:811c9dc5');
    expect(repositoryDigest('a')).toBe('fnv1a32:e40c292c');
    expect(repositoryDigest('repo-a')).not.toBe(repositoryDigest('repo-b'));
  });

  it('exports package and module targets as they are (V32)', () => {
    const d = data(reviewStateJson(input({
      workItems: [item('wi-2', { kind: 'package', name: '@scope/pkg' }), item('wi-3', { kind: 'module', module: 'src' })],
    })));
    expect((d.workItems as { target: unknown }[]).map((w) => w.target)).toEqual([
      { kind: 'package', name: '@scope/pkg' }, { kind: 'module', module: 'src' },
    ]);
    expect('warnings' in d).toBe(false);
  });

  it('leaves out a decision whose fingerprint has no "#" or does not parse, counts it, and never writes it (V12)', () => {
    const text = reviewStateJson(input({
      dispositions: [
        { fingerprint: 'legacy-fingerprint-xyz', status: 'acknowledged', decidedAt: 'd' },
        { fingerprint: 'not-an-entity#CX-1', status: 'acknowledged', decidedAt: 'd' },
        { fingerprint: `${fileId}#CX-a-1`, status: 'acknowledged', decidedAt: 'd' },
      ],
    }));
    const d = data(text);
    expect(d.dispositions).toEqual([{ finding: 'src/a.ts#CX-a-1', status: 'acknowledged', decidedAt: 'd' }]);
    expect(d.warnings).toEqual([REVIEW_STATE_SKIPPED(2, 'finding decisions')]);
    expect(text).not.toContain('legacy-fingerprint-xyz');
    expect(text).not.toContain('not-an-entity');
    expect(findingRef('legacy-fingerprint-xyz')).toBeNull();
    expect(findingRef(`${fileId}#CX-a-1`)).toBe('src/a.ts#CX-a-1');
  });

  it('leaves out a decision whose finding id (after the last "#") does not match the import\'s pattern, counts it, and never writes it (Part 5 E9(a))', () => {
    const tooLong = 'x'.repeat(65);
    const withSpace = 'has space';
    const text = reviewStateJson(input({
      dispositions: [
        { fingerprint: `${fileId}#${tooLong}`, status: 'acknowledged', decidedAt: 'd' },
        { fingerprint: `${fileId}#${withSpace}`, status: 'acknowledged', decidedAt: 'd' },
        { fingerprint: `${fileId}#CX-a-1`, status: 'acknowledged', decidedAt: 'd' },
      ],
    }));
    const d = data(text);
    expect(d.dispositions).toEqual([{ finding: 'src/a.ts#CX-a-1', status: 'acknowledged', decidedAt: 'd' }]);
    expect(d.warnings).toEqual([REVIEW_STATE_SKIPPED(2, 'finding decisions')]);
    expect(text).not.toContain(tooLong);
    expect(text).not.toContain(withSpace);
    expect(findingRef(`${fileId}#${tooLong}`)).toBeNull();
    expect(findingRef(`${fileId}#${withSpace}`)).toBeNull();
  });

  it('leaves out a file work item whose entity id does not parse, counts it, and never leaks the repository id (V12)', () => {
    // Two NUL-joined parts, not three: entityPath's fallback would have written "repo-xyz/src/b.ts".
    const broken = [REPO, 'src/b.ts'].join(String.fromCharCode(0));
    const text = reviewStateJson(input({
      workItems: [item('wi-1', { kind: 'file', entityId: broken }), item('wi-2', { kind: 'file', entityId: fileId })],
    }));
    const d = data(text);
    expect((d.workItems as { id: string }[]).map((w) => w.id)).toEqual(['wi-2']);
    expect(d.warnings).toEqual([REVIEW_STATE_SKIPPED(1, 'work items')]);
    expect(text).not.toContain(REPO);
    expect(text).not.toContain(String.fromCharCode(0));
  });
});
