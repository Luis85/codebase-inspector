// Part 7 Z23/Z26/Z27 on real screens: a collected report reads "Collected · Verified source
// match" wherever a badge shows; evidence kept after a failed run says why it is stale; and
// the fallow card names the executable and when it was collected.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { formatAbsoluteTime } from '../../src/ui/copy';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { EVIDENCE_BADGE, FALLOW_ROW_COLLECTED, FALLOW_ROW_EXECUTABLE, FALLOW_STALE_NOTICE } from '../../src/ui/inspector-copy';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { collectedEvidenceReport } from '../fixtures/evidence-report';

const provide = { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() };

function attach(report: (snapId: string) => EvidenceReport): EvidenceReport {
  const snap = buildSnapshotFixture({ files: 6, repositoryId: 'p1' });
  useCityStore().setCity(snap, computeLayout(snap));
  const evidence = useEvidenceStore();
  evidence.setRepository(new InMemoryEvidenceStore());
  evidence.bindRepository('p1');
  const r = report(snap.snapshotId);
  expect(evidence.attach(r)).toBe(true);
  return r;
}

beforeEach(() => { setActivePinia(createPinia()); });

describe('collected evidence on the screens (Z26, Z27)', () => {
  it('Quality reads Collected · Verified source match', async () => {
    attach(() => collectedEvidenceReport(buildSnapshotFixture({ files: 6, repositoryId: 'p1' })));
    const w = mount(QualityScreen, { attachTo: document.body, global: { provide } });
    await flushPromises();
    expect(w.find('.ci-quality__evidence .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE('3.27.0', 'collected', 'collected'));
    w.unmount();
  });

  it('after a failed run, Quality says the evidence may not be current, and the badge reads Stale', async () => {
    const report = attach(() => ({ ...collectedEvidenceReport(buildSnapshotFixture({ files: 6, repositoryId: 'p1' })), staleReason: 'failed-run' }));
    const w = mount(QualityScreen, { attachTo: document.body, global: { provide } });
    await flushPromises();
    expect(w.find('.ci-quality__evidence .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE('3.27.0', 'stale', 'collected'));
    expect(w.text()).toContain(FALLOW_STALE_NOTICE(formatAbsoluteTime(report.importedAt, Intl), 'failed-run'));
    w.unmount();
  });

  it('the fallow card names the executable and when it was collected', async () => {
    attach(() => collectedEvidenceReport(buildSnapshotFixture({ files: 6, repositoryId: 'p1' })));
    const w = mount(SourcesScreen, { attachTo: document.body, global: { provide } });
    await flushPromises();
    const rows = w.findAll('.ci-fallow-card .ci-fallow-facts dt').map((dt) => dt.text());
    expect(rows).toContain(FALLOW_ROW_EXECUTABLE);
    expect(rows).toContain(FALLOW_ROW_COLLECTED);
    expect(w.find('.ci-fallow-facts__file').text()).toBe('fallow.exe');
    expect(w.find('.ci-fallow-card .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE('3.27.0', 'collected', 'collected'));
    w.unmount();
  });
});
