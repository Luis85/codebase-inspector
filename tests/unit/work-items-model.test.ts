import { describe, expect, it } from 'vitest';
import { makeEntityId } from '../../src/domain/entity-id';
import { collected, sample } from '../../src/ui/evidence';
import type { FileSummary } from '../../src/ui/read-models/file-summaries';
import { buildWorkbenchModel, filesById, planMarkdown, workTargetLabel } from '../../src/ui/read-models/work-items';
import { NO_CHECKS, type WorkItem } from '../../src/ui/stores/ports/review-repository';

const id = (p: string) => makeEntityId('repo', 'file', p);
const summary = (p: string): FileSummary => {
  const s = sample(1);
  return { id: id(p), name: p.slice(p.lastIndexOf('/') + 1), path: p, module: p.split('/')[0]!, lines: collected(10, 'inventory'),
    complexity: s, commits90d: s, branchesCovered: s, branchesTotal: s, branchCoverage: s, priority: s };
};
const FILES = [summary('src/parser.ts'), summary('lib/io.ts')];
const item = (over: Partial<WorkItem>): WorkItem => ({
  id: 'wi-1', target: { kind: 'file', entityId: id('src/parser.ts') }, intent: 'refactor', title: 'Split parser',
  status: 'investigate', priority: 'medium', notes: '', checks: NO_CHECKS, createdAt: '2026-09-22T10:00:00.000Z', ...over,
});

describe('work-item read model (Part 4)', () => {
  it('labels file, package and module targets, and a file missing from the snapshot', () => {
    const index = filesById(FILES);
    expect(workTargetLabel({ kind: 'file', entityId: id('src/parser.ts') }, index)).toEqual({ name: 'parser.ts', detail: 'src/parser.ts', present: true });
    expect(workTargetLabel({ kind: 'file', entityId: id('gone/old.ts') }, index)).toEqual({ name: 'old.ts', detail: 'gone/old.ts', present: false });
    expect(workTargetLabel({ kind: 'package', name: '@sample/x' }, index)).toMatchObject({ name: '@sample/x', detail: 'Package' });
    expect(workTargetLabel({ kind: 'module', module: '(root)' }, index)).toMatchObject({ name: 'Root files', detail: 'Module' });
  });
  it('groups rows into the four status columns and counts the cards over every item', () => {
    const items = [item({}), item({ id: 'wi-2', status: 'verified', checks: [true, true, true] }), item({ id: 'wi-3', status: 'in-progress' })];
    const m = buildWorkbenchModel(items, FILES, '');
    expect(m.columns.map((c) => [c.status, c.rows.length])).toEqual([['investigate', 1], ['planned', 0], ['in-progress', 1], ['verified', 1]]);
    expect(m.cards.map((c) => c.value.value)).toEqual([3, 1, 1, 1]);
    expect(m.cards.every((c) => c.value.state === 'collected')).toBe(true);
    expect(m.rows.find((r) => r.item.id === 'wi-2')!.checksDone).toBe(3);
  });
  it('filters by title, target and notes, case-insensitively; the cards still count every item', () => {
    const items = [item({}), item({ id: 'wi-2', target: { kind: 'file', entityId: id('lib/io.ts') }, title: 'Tests', notes: 'Flaky READ path' })];
    expect(buildWorkbenchModel(items, FILES, 'parser').rows.map((r) => r.item.id)).toEqual(['wi-1']);
    expect(buildWorkbenchModel(items, FILES, 'read').rows.map((r) => r.item.id)).toEqual(['wi-2']);
    expect(buildWorkbenchModel(items, FILES, 'LIB/').rows.map((r) => r.item.id)).toEqual(['wi-2']);
    expect(buildWorkbenchModel(items, FILES, 'zzz').cards[0]!.value.value).toBe(2);
  });
  it('writes the plan as Markdown with checklists, relative paths, the session note, and a quoted note that cannot start a block', () => {
    const md = planMarkdown(buildWorkbenchModel([item({ notes: '# not a heading', checks: [true, false, false] })], FILES, '').rows, 'repo');
    expect(md).toContain('# Refactor plan — repo');
    expect(md).toContain('## wi-1 — Split parser');
    expect(md).toContain('- Target: `src/parser.ts`');
    expect(md).toContain('> \\# not a heading');
    expect(md).toContain('- [x] Characterize existing behaviour and define a safe boundary');
    expect(md).toContain('- [ ] Implement the agreed change and keep compatibility');
    expect(md).not.toContain(String.fromCharCode(0));
  });
});
