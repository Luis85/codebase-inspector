import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';

describe('investigation store selection (IN4)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  it('opens a fingerprint and clears the gone notice', () => {
    const s = useInvestigationStore();
    s.open('fp-1'); s.markGone();
    expect(s.selectedFingerprint).toBeNull();
    expect(s.findingGone).toBe(true);
    s.open('fp-2');
    expect(s.selectedFingerprint).toBe('fp-2');
    expect(s.findingGone).toBe(false);
  });
  it('markGone without a selection raises nothing', () => {
    const s = useInvestigationStore();
    s.markGone();
    expect(s.findingGone).toBe(false);
  });
  it('forgets the selection the moment the bound codebase changes (sync)', () => {
    const evidence = useEvidenceStore();
    evidence.setRepository(new InMemoryEvidenceStore());
    evidence.bindRepository('a');
    const s = useInvestigationStore();
    s.open('fp-1');
    evidence.bindRepository('b');
    expect(s.selectedFingerprint).toBeNull();   // no await: flush 'sync'
  });
});
