// Part 6 Y28/Y29/Y39 (ruling R2): the evidence half of the data-port helpers city-view.ts
// calls, tested without a view. Task 4's tests/host/data-ports.test.ts covers the review half.
import { describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import { requestReportImport, unwireDataPorts, wireDataPorts } from '../../src/host/data-ports';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { emptyEvidenceReport } from '../fixtures/evidence-report';
import type { CityViewDeps } from '../../src/host/city-view';
import type { EvidenceRepository } from '../../src/application/ports/evidence-repository';

function depsWith(evidenceStore: EvidenceRepository): CityViewDeps {
  return {
    profileStore: createFakeProfileStoreHarness().store,
    getFilesystem: () => createFakeSourceFileSystem({}).port,
    snapshotStore: new InMemorySnapshotStore(createFixedClock()),
    clock: createFixedClock(),
    ...dataPortDeps(),
    evidenceStore,
  };
}

describe('data ports: evidence (Part 6 Y28/Y29)', () => {
  it('wireDataPorts hands every leaf the ONE shared repository', () => {
    const shared = new InMemoryEvidenceStore();
    const deps = depsWith(shared);
    const leafA = createPinia();
    const leafB = createPinia();
    wireDataPorts(leafA, deps);
    wireDataPorts(leafB, deps);
    useEvidenceStore(leafA).bindRepository('p1');
    useEvidenceStore(leafB).bindRepository('p1');
    const report = emptyEvidenceReport('s1');
    expect(useEvidenceStore(leafA).attach(report)).toBe(true);
    expect(shared.get('p1')).toBe(report);
    expect(useEvidenceStore(leafB).report).toBe(report);
  });

  it('unwireDataPorts drops the closing leaf\'s listener; the other leaf keeps following', () => {
    const shared = new InMemoryEvidenceStore();
    let live = 0;
    const subscribe = shared.subscribe.bind(shared);
    shared.subscribe = (listener) => {
      live += 1;
      const off = subscribe(listener);
      return () => { live -= 1; off(); };
    };
    const deps = depsWith(shared);
    const leafA = createPinia();
    const leafB = createPinia();
    wireDataPorts(leafA, deps);
    wireDataPorts(leafB, deps);
    useEvidenceStore(leafA).bindRepository('p1');
    useEvidenceStore(leafB).bindRepository('p1');
    expect(live).toBe(2);
    unwireDataPorts(leafA);
    expect(live).toBe(1);
    const report = emptyEvidenceReport('s1');
    shared.put('p1', report);
    expect(useEvidenceStore(leafB).report).toBe(report);
  });
});

describe('data ports: requestReportImport (Part 6 Y39)', () => {
  it('opens Data & scans and raises the import request, which is consumed once', () => {
    const pinia = createPinia();
    wireDataPorts(pinia, depsWith(new InMemoryEvidenceStore()));
    requestReportImport(pinia);
    expect(useCityStore(pinia).route).toBe('sources');
    expect(useEvidenceStore(pinia).consumeImportRequest()).toBe(true);
    expect(useEvidenceStore(pinia).consumeImportRequest()).toBe(false);
  });
});
