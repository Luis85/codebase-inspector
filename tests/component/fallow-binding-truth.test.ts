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
import { FALLOW_EXE_HINT_POSIX, FALLOW_EXE_HINT_WINDOWS, FALLOW_EXE_REFUSED, FALLOW_EXE_UNSUPPORTED } from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { createFakeFallowAnalysis, fakeRunReview, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
});

/** The codebase on screen, as App's repository watcher binds it. */
function showCodebase(repositoryId: string): void {
  const snap = buildSnapshotFixture({ files: 6, repositoryId });
  useCityStore().setCity(snap, computeLayout(snap));
  useEvidenceStore().bindRepository(repositoryId);
  useAnalysisStore().bindRepository(repositoryId);
}
function setupWith(fake: FakeFallowAnalysis): FakeFallowAnalysis {
  useAnalysisStore().setService(fake);
  useEvidenceStore().setRepository(new InMemoryEvidenceStore());
  showCodebase('p1');
  return fake;
}
const setup = (): FakeFallowAnalysis => setupWith(createFakeFallowAnalysis());

const PATH = 'C:\\Tools\\fallow\\fallow.exe';
const RUN_REVIEW: StartOutcome = { kind: 'review', review: fakeRunReview('p1', 'snapshot-fixture', '/fixture/root'), reason: 'changed' };
const CHECKED: ReviewResult = { ok: true, review: fakeRunReview('p1', 'snapshot-fixture', '/fixture/root') };
/** Every check stays in flight until the test answers it. */
function pendingChecks(fake: FakeFallowAnalysis): ((result: ReviewResult) => void)[] {
  const answers: ((result: ReviewResult) => void)[] = [];
  fake.review = () => new Promise((resolve) => { answers.push(resolve); });
  return answers;
}
/** Opens the installed route at its path step and starts a check (in flight with pendingChecks). */
async function startCheck(w: ReturnType<typeof mountS>): Promise<void> {
  await w.find('.ci-fallow-run__choose').trigger('click');
  await flushPromises();
  await w.find('.ci-fallow-installed__path').setValue(PATH);
  await w.find('.ci-fallow-installed__check').trigger('click');
}
const pathInput = (w: ReturnType<typeof mountS>): Element => w.find('.ci-fallow-installed__path').element;

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
  it('review fix 1 (E13): a request held during a check that ends refused is dropped; the refusal stays', async () => {
    const fake = setup();
    const answers = pendingChecks(fake);
    fake.next.run = RUN_REVIEW;
    const w = mountS();
    await flushPromises();
    await startCheck(w);
    useAnalysisStore().requestRun();
    await flushPromises();
    expect(answers).toHaveLength(1);
    answers[0]!({ ok: false, code: 'executable-missing', detail: '' });
    await flushPromises();
    expect(w.find('.ci-connect-fallow__error').text()).toBe(FALLOW_EXE_REFUSED['executable-missing'](''));
    expect((pathInput(w) as HTMLInputElement).value).toBe(PATH);
    expect(w.find('.ci-fallow-review').exists()).toBe(false);
    expect(w.findAll('[role="dialog"]')).toHaveLength(1);
    w.unmount();
  });

  it('review fix 3c: a request during a busy check is held (no remount), then applied once the check settles cleanly', async () => {
    const fake = setup();
    const answers = pendingChecks(fake);
    fake.next.run = RUN_REVIEW;
    const w = mountS();
    await flushPromises();
    await startCheck(w);
    const input = pathInput(w);
    useAnalysisStore().requestRun();
    await flushPromises();
    expect(fake.calls.map((c) => c.method)).toContain('run');
    expect(pathInput(w)).toBe(input);
    expect(w.find('.ci-fallow-review').exists()).toBe(false);
    answers[0]!(CHECKED);
    await flushPromises();
    expect(w.find('.ci-fallow-review').exists()).toBe(true);
    expect(w.find('.ci-fallow-installed__retrust').exists()).toBe(true);
    expect(w.findAll('[role="dialog"]')).toHaveLength(1);
    w.unmount();
  });

  it('review fix 2: a request in the same tick as the step starts is already held (the busy emit is sync)', async () => {
    const fake = setup();
    const answers = pendingChecks(fake);
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__path').setValue(PATH);
    const input = pathInput(w);
    const checking = w.find('.ci-fallow-installed__check').trigger('click');
    const importing = w.find('.ci-fallow-card__import').trigger('click');
    await Promise.all([checking, importing]);
    await flushPromises();
    expect(pathInput(w)).toBe(input);
    answers[0]!(CHECKED);
    await flushPromises();
    expect(w.find('.ci-connect-fallow__route').exists()).toBe(true);
    w.unmount();
  });

  it('review fix 3a: two requests held during one step, the newest wins', async () => {
    const fake = setup();
    const answers = pendingChecks(fake);
    fake.next.run = RUN_REVIEW;
    const w = mountS();
    await flushPromises();
    await startCheck(w);
    useAnalysisStore().requestRun();
    await flushPromises();
    await w.find('.ci-fallow-card__import').trigger('click');
    await flushPromises();
    answers[0]!(CHECKED);
    await flushPromises();
    expect(w.find('.ci-connect-fallow__route').exists()).toBe(true);
    expect(w.find('.ci-fallow-review').exists()).toBe(false);
    expect(w.findAll('[role="dialog"]')).toHaveLength(1);
    w.unmount();
  });

  it('review fix 3b: a held request is dropped on a codebase switch, and never lands on the next codebase', async () => {
    const fake = setup();
    const answers = pendingChecks(fake);
    fake.next.run = RUN_REVIEW;
    const w = mountS();
    await flushPromises();
    await startCheck(w);
    useAnalysisStore().requestRun();
    await flushPromises();
    showCodebase('p2');
    await flushPromises();
    answers[0]!(CHECKED);
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    await startCheck(w);
    await flushPromises();
    answers[1]!({ ok: true, review: fakeRunReview('p2', 'snapshot-fixture', '/fixture/root') });
    await flushPromises();
    expect(w.find('.ci-fallow-review').exists()).toBe(true);
    expect(w.find('.ci-fallow-installed__retrust').exists()).toBe(false);
    w.unmount();
  });

  it('a request held during Trust and run is dropped once the run starts and the dialog closes', async () => {
    const fake = setup();
    const starts: ((outcome: StartOutcome) => void)[] = [];
    fake.trustAndRun = () => new Promise((resolve) => { starts.push(resolve); });
    fake.next.run = { kind: 'choose-executable', read: { kind: 'none' } };
    const w = mountS();
    await flushPromises();
    await startCheck(w);
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
