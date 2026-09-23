// Part 7 Z32–Z35 on Data & scans: the fallow card's run controls per state, the C16 banner,
// the blocked controls while a run is in flight, the command's run request, and one
// announcement per finished run. The Planned integrations panel is gone.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { AnalysisIdentity } from '../../src/application/analysis/analysis-state';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import {
  COPY_15, FALLOW_EXE_CHANGE, FALLOW_EXE_CHOOSE, FALLOW_EXE_FORGET_FAILED, FALLOW_EXE_NONE, FALLOW_RUN_BUSY_HINT, FALLOW_RUN_CANCELLED,
  FALLOW_RUN_COMPLETED, FALLOW_RUN_ERROR, FALLOW_RUN_HINT, FALLOW_RUN_KEPT, FALLOW_RUN_START_FAILED, FALLOW_TRUST_VALUE,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport } from '../fixtures/evidence-report';
import { createFakeFallowAnalysis, fakeRunReview, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const ID: AnalysisIdentity = { profileId: 'p1', snapshotId: 'snapshot-fixture', rootFingerprint: 'a', subjectFingerprint: 'b', runId: 'r1', generation: 0 };
const AT = '2026-09-23T10:00:00.000Z';
const RUNNING = { status: 'running', identity: ID, rootPath: '/fixture/root', startedAt: AT, timeoutSeconds: 120, version: '3.27.0', tested: true } as const;
const BOUND = { kind: 'bound', binding: { profileId: 'p1', executablePath: 'C:\\Tools\\fallow\\fallow.exe', timeoutSeconds: 120, trust: null } } as const;

const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
});

function setup(options: { snapshot?: boolean; evidence?: boolean } = {}): FakeFallowAnalysis {
  const fake = createFakeFallowAnalysis();
  const analysis = useAnalysisStore();
  analysis.setService(fake);
  const evidence = useEvidenceStore();
  evidence.setRepository(new InMemoryEvidenceStore());
  if (options.snapshot !== false) {
    const snap = buildSnapshotFixture({ files: 6, repositoryId: 'p1' });
    useCityStore().setCity(snap, computeLayout(snap));
    if (options.evidence) attachSyntheticReport(snap);
    evidence.bindRepository('p1');
    analysis.bindRepository('p1');
  }
  return fake;
}

beforeEach(() => { setActivePinia(createPinia()); });

describe('the run panel (Z32)', () => {
  it('without a snapshot: Run and Choose are aria-disabled with the hint, and nothing is emitted', async () => {
    const fake = setup({ snapshot: false });
    const w = mountS();
    await flushPromises();
    const run = w.find('.ci-fallow-run__run');
    expect(run.attributes('aria-disabled')).toBe('true');
    expect(w.find(`#${run.attributes('aria-describedby') ?? 'missing'}`).text()).toBe(FALLOW_RUN_HINT);
    await run.trigger('click');
    expect(fake.calls.map((c) => c.method)).not.toContain('run');
    const choose = w.find('.ci-fallow-run__choose');
    expect(choose.attributes('aria-disabled')).toBe('true');
    expect(choose.attributes('aria-describedby')).toBe(run.attributes('aria-describedby'));
    await choose.trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });

  it('idle and unbound: Run, Choose executable…, no Forget, and the none text', async () => {
    setup();
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-fallow-run__run').attributes('aria-disabled')).toBeUndefined();
    expect(w.find('.ci-fallow-run__choose').text()).toBe(FALLOW_EXE_CHOOSE);
    expect(w.find('.ci-fallow-run__forget').exists()).toBe(false);
    expect(w.find('.ci-fallow-run__facts').text()).toContain(FALLOW_EXE_NONE);
    expect(w.text()).not.toContain('Planned integrations');
    w.unmount();
  });

  it('bound: the path, the trust state, Change executable…, and Forget', async () => {
    const fake = setup();
    fake.setBinding('p1', BOUND);
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-fallow-run__facts code').text()).toBe('C:\\Tools\\fallow\\fallow.exe');
    expect(w.find('.ci-fallow-run__facts').text()).toContain(FALLOW_TRUST_VALUE(null, false));
    expect(w.find('.ci-fallow-run__choose').text()).toBe(FALLOW_EXE_CHANGE);
    expect(w.find('.ci-fallow-run__forget').exists()).toBe(true);
    w.unmount();
  });

  it('while running: Cancel replaces Run, and Import, Remove, Change and Forget are blocked with the busy hint', async () => {
    const fake = setup({ evidence: true });
    fake.setBinding('p1', BOUND);
    fake.setState('p1', RUNNING);
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-fallow-run__run').exists()).toBe(false);
    for (const cls of ['.ci-fallow-card__import', '.ci-fallow-card__remove', '.ci-fallow-run__choose', '.ci-fallow-run__forget']) {
      expect(w.find(cls).attributes('aria-disabled'), cls).toBe('true');
    }
    expect(w.find('.ci-fallow-card__busy').text()).toBe(FALLOW_RUN_BUSY_HINT);
    await w.find('.ci-fallow-card__import').trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    await w.find('.ci-fallow-run__cancel').trigger('click');
    expect(fake.calls.filter((c) => c.method === 'cancel')).toEqual([{ method: 'cancel', profileId: 'p1' }]);
    w.unmount();
  });

  it('Forget calls the service and announces', async () => {
    const fake = setup();
    fake.setBinding('p1', BOUND);
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__forget').trigger('click');
    await flushPromises();
    expect(fake.calls.map((c) => c.method)).toContain('forget');
    expect(w.find('.ci-sources__live').text()).toContain('fallow executable forgotten');
    w.unmount();
  });
});

describe('the run banner (Z33)', () => {
  it('shows the running text, with the folder and the limit', async () => {
    const fake = setup();
    fake.setState('p1', RUNNING);
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-fallow-run__banner').attributes('role')).toBe('status');
    expect(w.find('.ci-fallow-run__banner').text()).toContain('fallow is analysing “root”');
    w.unmount();
  });

  it('a failure shows COPY-15, the reason, that the findings were kept, and the log as text', async () => {
    const fake = setup({ evidence: true });
    fake.setState('p1', { status: 'failed', runId: 'r1', code: 'analyzer-error', detail: 'bad root', logExcerpt: '<img src=x onerror=alert(1)>', evidenceKept: true, finishedAt: AT });
    const w = mountS();
    await flushPromises();
    const banner = w.find('.ci-fallow-run__banner');
    expect(banner.text()).toContain(COPY_15('fallow'));
    expect(w.find('.ci-fallow-run__reason').text()).toBe(FALLOW_RUN_ERROR['analyzer-error']('bad root'));
    expect(w.find('.ci-fallow-run__kept').text()).toBe(FALLOW_RUN_KEPT);
    expect(w.find('.ci-fallow-run__log pre').text()).toBe('<img src=x onerror=alert(1)>');
    expect(w.find('.ci-fallow-run__log img').exists()).toBe(false);
    w.unmount();
  });
});

describe('Run and the command request (Z32, Z35)', () => {
  it('Run with trust starts through the service and shows no dialog', async () => {
    const fake = setup();
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(fake.calls.map((c) => c.method)).toContain('run');
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });

  it('a review outcome opens the dialog on the review step; choose-executable on the path step', async () => {
    const fake = setup();
    fake.next.run = { kind: 'review', review: fakeRunReview('p1', 'snapshot-fixture', '/fixture/root'), reason: 'untrusted' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-review').exists()).toBe(true);
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    await flushPromises();
    fake.next.run = { kind: 'choose-executable', read: { kind: 'none' } };
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-installed__path').exists()).toBe(true);
    w.unmount();
  });

  it('a refused Run shows the failed form and announces the reason', async () => {
    const fake = setup();
    fake.next.run = { kind: 'refused', code: 'root-unavailable', detail: '' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-run__reason').text()).toBe(FALLOW_RUN_ERROR['root-unavailable'](''));
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_RUN_ERROR['root-unavailable'](''));
    w.unmount();
  });

  it('the command\'s run request is consumed once and runs', async () => {
    const fake = setup();
    useAnalysisStore().requestRun();
    const w = mountS();
    await flushPromises();
    expect(fake.calls.filter((c) => c.method === 'run')).toHaveLength(1);
    expect(useAnalysisStore().runRequested).toBe(false);
    w.unmount();
  });
});

describe('announcements (Z33, E17)', () => {
  it('announces a finished run once per run id, and not a run that had finished before the screen opened', async () => {
    const fake = setup();
    fake.setState('p1', { status: 'cancelled', runId: 'r0' });
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-sources__live').text()).toBe('');
    fake.setState('p1', RUNNING);
    fake.setState('p1', { status: 'completed', runId: 'r1', finishedAt: AT, version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 });
    await flushPromises();
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_RUN_COMPLETED(5, 4));
    fake.setState('p1', { status: 'cancelled', runId: 'r2' });
    await flushPromises();
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_RUN_CANCELLED);
    w.unmount();
  });

  it('announces the end of a run that was already in flight when the screen opened', async () => {
    const fake = setup();
    fake.setState('p1', RUNNING);
    const w = mountS();
    await flushPromises();
    fake.setState('p1', { status: 'completed', runId: 'r1', finishedAt: AT, version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 });
    await flushPromises();
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_RUN_COMPLETED(5, 4));
    w.unmount();
  });
});

describe('the banner follows the current run; failures never escape (PF15, carried notes)', () => {
  it('PF15: a refusal is cleared when a new run starts, so that run\'s own outcome shows', async () => {
    const fake = setup();
    fake.next.run = { kind: 'refused', code: 'root-unavailable', detail: '' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-run__reason').exists()).toBe(true);
    fake.setState('p1', RUNNING);
    fake.setState('p1', { status: 'completed', runId: 'r1', finishedAt: AT, version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 });
    await flushPromises();
    expect(w.find('.ci-fallow-run__banner').text()).toBe(FALLOW_RUN_COMPLETED(5, 4));
    expect(w.find('.ci-fallow-run__reason').exists()).toBe(false);
    w.unmount();
  });

  it('a Forget that fails on the data file is shown and announced, never thrown', async () => {
    const fake = setup();
    fake.setBinding('p1', BOUND);
    fake.forget = () => Promise.reject(new Error('data.json could not be written'));
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__forget').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-run__banner').text()).toBe(FALLOW_EXE_FORGET_FAILED);
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_EXE_FORGET_FAILED);
    expect(w.find('.ci-fallow-run__forget').attributes('aria-disabled')).toBeUndefined();
    w.unmount();
  });

  it('a Run whose pre-run check throws is shown and announced, never thrown, and the next Run clears it', async () => {
    const fake = setup();
    const run = fake.run.bind(fake);
    fake.run = () => Promise.reject(new Error('data.json could not be read'));
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-run__banner').text()).toBe(FALLOW_RUN_START_FAILED);
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_RUN_START_FAILED);
    fake.run = run;
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-run__banner').exists()).toBe(false);
    w.unmount();
  });

  it('an unreadable binding reads as none: no spinner, Run still asks the service', async () => {
    const fake = setup();
    fake.readBinding = () => Promise.reject(new Error('data.json could not be read'));
    fake.setBinding('p1', BOUND);
    const w = mountS();
    await flushPromises();
    expect(useAnalysisStore().binding).toBeNull();
    expect(w.find('.ci-fallow-run__banner').exists()).toBe(false);
    expect(w.find('.ci-fallow-run__facts').text()).toContain(FALLOW_EXE_NONE);
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(fake.calls.map((c) => c.method)).toContain('run');
    w.unmount();
  });

  it('a run request while the import route is open opens the review instead (the newer request wins)', async () => {
    const fake = setup();
    fake.next.run = { kind: 'review', review: fakeRunReview('p1', 'snapshot-fixture', '/fixture/root'), reason: 'changed' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-card__import').trigger('click');
    await flushPromises();
    expect(w.find('.ci-connect-fallow__route').exists()).toBe(true);
    useAnalysisStore().requestRun();
    await flushPromises();
    expect(w.find('.ci-connect-fallow__route').exists()).toBe(false);
    expect(w.find('.ci-fallow-review').exists()).toBe(true);
    expect(w.find('.ci-fallow-installed__retrust').exists()).toBe(true);
    expect(w.findAll('[role="dialog"]')).toHaveLength(1);
    w.unmount();
  });
});
