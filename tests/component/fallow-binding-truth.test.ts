// Polish C1, C2, C10: what the fallow card and the installed route say when the binding is
// unreadable or read-only, and a request that lands mid-step.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { ReviewResult, StartOutcome } from '../../src/ui/read-models/fallow-run';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import { FALLOW_EXE_HINT_POSIX, FALLOW_EXE_HINT_WINDOWS, FALLOW_EXE_UNSUPPORTED } from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { createFakeFallowAnalysis, fakeRunReview, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
});

function setupWith(fake: FakeFallowAnalysis): FakeFallowAnalysis {
  const analysis = useAnalysisStore();
  analysis.setService(fake);
  const evidence = useEvidenceStore();
  evidence.setRepository(new InMemoryEvidenceStore());
  const snap = buildSnapshotFixture({ files: 6, repositoryId: 'p1' });
  useCityStore().setCity(snap, computeLayout(snap));
  evidence.bindRepository('p1');
  analysis.bindRepository('p1');
  return fake;
}
const setup = (): FakeFallowAnalysis => setupWith(createFakeFallowAnalysis());

beforeEach(() => { setActivePinia(createPinia()); });

describe('Polish C1: the executable name without a binding read', () => {
  it('on POSIX the path hint is the POSIX one even when the binding read failed', async () => {
    const fake = createFakeFallowAnalysis('fallow');
    fake.readBinding = () => Promise.reject(new Error('EIO'));
    setupWith(fake);
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    expect(w.text()).toContain(FALLOW_EXE_HINT_POSIX);
    expect(w.text()).not.toContain(FALLOW_EXE_HINT_WINDOWS);
    w.unmount();
  });
});

describe('Polish C2: a read-only record', () => {
  it('blocks Choose executable…, described by the row that says why, and opens nothing', async () => {
    const fake = setup();
    fake.setBinding('p1', { kind: 'unsupported' });
    const w = mountS();
    await flushPromises();
    const choose = w.find('.ci-fallow-run__choose');
    expect(choose.attributes('aria-disabled')).toBe('true');
    const describedBy = choose.attributes('aria-describedby');
    expect(describedBy).toBeDefined();
    expect(document.getElementById(describedBy!)?.textContent?.trim()).toBe(FALLOW_EXE_UNSUPPORTED);
    await choose.trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });
});

describe('Polish C10: a request that lands mid-step', () => {
  it('a run request during a busy check waits for the check, then opens its review', async () => {
    const fake = setup();
    const answers: ((result: ReviewResult) => void)[] = [];
    fake.review = () => new Promise((resolve) => { answers.push(resolve); });
    fake.next.run = { kind: 'review', review: fakeRunReview('p1', 'snapshot-fixture', '/fixture/root'), reason: 'changed' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__path').setValue('C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__check').trigger('click');
    useAnalysisStore().requestRun();
    await flushPromises();
    expect((w.find('.ci-fallow-installed__path').element as HTMLInputElement).value).toBe('C:\\Tools\\fallow\\fallow.exe');
    expect(answers).toHaveLength(1);
    answers[0]!({ ok: false, code: 'executable-missing', detail: '' });
    await flushPromises();
    expect(w.find('.ci-fallow-review').exists()).toBe(true);
    expect(w.find('.ci-fallow-installed__retrust').exists()).toBe(true);
    expect(w.findAll('[role="dialog"]')).toHaveLength(1);
    w.unmount();
  });

  it('a request held during Trust and run is dropped once the run starts and the dialog closes', async () => {
    const fake = setup();
    const starts: ((outcome: StartOutcome) => void)[] = [];
    fake.trustAndRun = () => new Promise((resolve) => { starts.push(resolve); });
    fake.next.run = { kind: 'choose-executable', read: { kind: 'none' } };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__path').setValue('C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__check').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__trust').trigger('click');
    useAnalysisStore().requestRun();
    await flushPromises();
    starts[0]!({ kind: 'started' });
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });
});
