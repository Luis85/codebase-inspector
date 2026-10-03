// Part 6 Y40: the lens store. One per leaf; 'findings' needs evidence; it resets to
// 'category' — synchronously — when the bound codebase changes or its evidence goes away.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useLensStore, type LensId } from '../../src/ui/stores/lens-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { syntheticEvidenceReport } from '../fixtures/evidence-report';

const snap = buildSnapshotFixture({ files: 2, repositoryId: 'repo-a' });
let repository: InMemoryEvidenceStore;

beforeEach(() => {
  setActivePinia(createPinia());
  repository = new InMemoryEvidenceStore();
  useEvidenceStore().setRepository(repository);
});

function withEvidence(repositoryId = 'repo-a'): ReturnType<typeof useEvidenceStore> {
  const evidence = useEvidenceStore();
  evidence.bindRepository(repositoryId);
  expect(evidence.attach(syntheticEvidenceReport(snap))).toBe(true);
  return evidence;
}

describe('lens store (Y40)', () => {
  it('starts on the category lens', () => {
    expect(useLensStore().lens).toBe('category');
  });

  it('refuses the findings lens while the codebase has no evidence', () => {
    useEvidenceStore().bindRepository('repo-a');
    const lens = useLensStore();
    lens.setLens('findings');
    expect(lens.lens).toBe('category');
  });

  it('takes the findings lens once evidence is attached, and reset() returns to category', () => {
    withEvidence();
    const lens = useLensStore();
    lens.setLens('findings');
    expect(lens.lens).toBe('findings');
    lens.reset();
    expect(lens.lens).toBe('category');
  });

  it('ignores an unknown lens id', () => {
    withEvidence();
    const lens = useLensStore();
    lens.setLens('heat' as LensId);
    expect(lens.lens).toBe('category');
  });

  it('resets to category in the same call that removes the evidence', () => {
    const evidence = withEvidence();
    const lens = useLensStore();
    lens.setLens('findings');
    expect(evidence.remove()).toBe(true);
    expect(lens.lens).toBe('category');
  });

  it('resets on a codebase switch, even to a codebase that has evidence too', () => {
    repository.put('repo-b', syntheticEvidenceReport(snap, { symbol: 'otherHelper' }));
    const evidence = withEvidence('repo-a');
    const lens = useLensStore();
    lens.setLens('findings');
    evidence.bindRepository('repo-b');
    expect(evidence.report).not.toBeNull();
    expect(lens.lens).toBe('category');
  });

  it('keeps the lens when the report on the same codebase is replaced', () => {
    const evidence = withEvidence();
    const lens = useLensStore();
    lens.setLens('findings');
    expect(evidence.attach(syntheticEvidenceReport(snap, { symbol: 'replacement' }))).toBe(true);
    expect(lens.lens).toBe('findings');
  });
});
