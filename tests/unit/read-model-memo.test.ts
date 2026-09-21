// Final review F1: the per-snapshot read models are built once, however many callers
// (a screen and the shell's provenance badge) read them.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computeLayout } from '../../src/domain/layout/layout';
import { useCityStore } from '../../src/ui/stores/city-store';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

describe('read-model memoization', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('two callers share one Overview model per snapshot, and a new snapshot rebuilds it', () => {
    const store = useCityStore();
    const snap = buildSnapshotFixture({ files: 30, directories: 3 });
    store.setCity(snap, computeLayout(snap));
    const a = useReadModels();
    const b = useReadModels();
    expect(a.overview.value).not.toBeNull();
    expect(b.overview.value).toBe(a.overview.value);
    const next = buildSnapshotFixture({ files: 31, directories: 3 });
    store.setCity(next, computeLayout(next));
    expect(a.overview.value).not.toBe(null);
    expect(a.overview.value?.fileCount).toBe(31);
    expect(b.overview.value).toBe(a.overview.value);
  });

  it('two callers share one File detail model per (snapshot, file)', () => {
    const store = useCityStore();
    const snap = buildSnapshotFixture({ files: 12, directories: 2 });
    store.setCity(snap, computeLayout(snap));
    const [first, second] = fileSummariesFor(snap);
    store.select(first!.id);
    const a = useReadModels();
    const b = useReadModels();
    expect(a.fileDetail.value?.file.id).toBe(first!.id);
    expect(b.fileDetail.value).toBe(a.fileDetail.value);
    store.select(second!.id);
    expect(a.fileDetail.value?.file.id).toBe(second!.id);
    expect(b.fileDetail.value).toBe(a.fileDetail.value);
  });
});
