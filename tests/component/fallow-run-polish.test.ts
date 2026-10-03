// Polish C3-C6, C14, C15, C17: the run panel's hints, focus after a command, the installed
// route's focus and alert, busy-step inertness, nothing running on mount, and the clock.
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { ReviewResult } from '../../src/ui/read-models/fallow-run';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import { FALLOW_RUN_CANCELLING_HINT } from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { syntheticFallowJson } from '../fixtures/evidence-report';
import { createFakeFallowAnalysis, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const RUNNING = {
  status: 'running', rootPath: '/fixture/root', startedAt: '2026-09-23T10:00:00.000Z', timeoutSeconds: 120, version: '3.27.0', tested: true,
  identity: { profileId: 'p1', snapshotId: 'snapshot-fixture', rootFingerprint: 'a', subjectFingerprint: 'b', runId: 'r1', generation: 0 },
} as const;
const BOUND = { kind: 'bound', binding: { profileId: 'p1', executablePath: 'D:\\bin\\fallow.exe', timeoutSeconds: 120, trust: null } } as const;

const mountS = (provide: Record<string, unknown> = {}) => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: () => {}, onScanRequested: () => {}, onCancelScan: () => {}, ...provide } },
});
type Wrapper = ReturnType<typeof mountS>;

function setup(executableName: 'fallow.exe' | 'fallow' = 'fallow.exe'): { snap: CodebaseSnapshot; fake: FakeFallowAnalysis } {
  const snap = buildSnapshotFixture({ files: 6, repositoryId: 'p1' });
  useCityStore().setCity(snap, computeLayout(snap));
  const evidence = useEvidenceStore();
  evidence.setRepository(new InMemoryEvidenceStore());
  evidence.bindRepository('p1');
  const fake = createFakeFallowAnalysis(executableName);
  const analysis = useAnalysisStore();
  analysis.setService(fake);
  analysis.bindRepository('p1');
  return { snap, fake };
}

/** tests/component/connect-fallow.test.ts lines 40-49. */
async function setFile(w: Wrapper, file: File): Promise<void> {
  const input = w.find('.ci-connect-fallow__file');
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
}
async function pick(w: Wrapper, text: string, name = 'fallow-report.json'): Promise<void> {
  await setFile(w, new File([text], name, { type: 'application/json' }));
  await flushPromises();
}

beforeEach(() => { setActivePinia(createPinia()); });

describe('Polish C3: the cancelling hint', () => {
  it('a blocked Cancel while cancelling is described by the cancelling hint, not the busy hint', async () => {
    const { fake } = setup();
    fake.setState('p1', { status: 'cancelling', identity: RUNNING.identity });
    const w = mountS();
    await flushPromises();
    const cancel = w.find('.ci-fallow-run__cancel');
    expect(cancel.attributes('aria-disabled')).toBe('true');
    expect(document.getElementById(cancel.attributes('aria-describedby')!)?.textContent?.trim()).toBe(FALLOW_RUN_CANCELLING_HINT);
    w.unmount();
  });
});

describe('Polish C4: focus after a command-started run', () => {
  it('lands on Cancel analysis, not on the blocked Import', async () => {
    const { fake } = setup();
    fake.run = (id) => { fake.setState(id, RUNNING); return Promise.resolve({ kind: 'started' }); };
    const w = mountS();
    await flushPromises();
    useAnalysisStore().requestRun();
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.ci-fallow-run__cancel').element);
    w.unmount();
  });
});

describe('Polish C5, C6: the installed route\'s focus and alert', () => {
  it('C5: a refused auto-check leaves focus on the route heading, never on <body>', async () => {
    const { fake } = setup();
    fake.setBinding('p1', BOUND);
    fake.next.review = { ok: false, code: 'executable-missing', detail: '' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-card__import').trigger('click');
    await flushPromises();
    await w.find('.ci-connect-fallow__use-installed').trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.ci-fallow-installed h3').element);
    w.unmount();
  });

  it('C6: its alert sits above its actions, as on the import route', async () => {
    const { fake } = setup();
    fake.next.review = { ok: false, code: 'executable-missing', detail: '' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__path').setValue('C:\\nope\\fallow.exe');
    await w.find('.ci-fallow-installed__check').trigger('click');
    await flushPromises();
    const alert = w.find('[role="alert"]').element;
    const actions = w.find('.ci-fallow-installed .ci-connect-fallow__actions').element;
    expect(w.findAll('[role="alert"]')).toHaveLength(1);
    expect(alert.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    w.unmount();
  });
});

describe('Polish C14: a busy step and a running analysis are inert', () => {
  it('Escape, Cancel and the backdrop leave the dialog open while a check is in flight', async () => {
    const { fake } = setup();
    const answers: ((result: ReviewResult) => void)[] = [];
    fake.review = () => new Promise((resolve) => { answers.push(resolve); });
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__path').setValue('C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__check').trigger('click');
    await w.find('.ci-dialog').trigger('keydown', { key: 'Escape' });
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    await w.find('.ci-dialog__backdrop').trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    answers[0]!({ ok: false, code: 'executable-missing', detail: '' });
    await flushPromises();
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });

  it('Choose and Forget presses while running open nothing and forget nothing', async () => {
    const { fake } = setup();
    fake.setBinding('p1', BOUND);
    fake.setState('p1', RUNNING);
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await w.find('.ci-fallow-run__forget').trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(fake.calls.map((c) => c.method)).not.toContain('forget');
    w.unmount();
  });

  it('Enter in the path input checks the path', async () => {
    const { fake } = setup();
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__path').setValue('C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__path').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(fake.calls.map((c) => c.method)).toContain('review');
    w.unmount();
  });
});

describe('Polish C15 (Z36): nothing runs on bind or mount', () => {
  it('binding the store and mounting Data & scans only read the binding', async () => {
    const { fake } = setup();
    const w = mountS();
    await flushPromises();
    const methods = fake.calls.map((c) => c.method);
    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every((m) => m === 'readBinding')).toBe(true);
    w.unmount();
  });
});

describe('Polish C17 (Y27): the import takes its time from the host clock', () => {
  it('an attached report is stamped with the provided clock', async () => {
    const { snap } = setup();
    const w = mountS({ now: () => new Date('2026-09-23T12:34:56.000Z') });
    await flushPromises();
    await w.find('.ci-fallow-card__import').trigger('click');
    await flushPromises();
    await pick(w, syntheticFallowJson(snap));
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    expect(useEvidenceStore().report?.importedAt).toBe('2026-09-23T12:34:56.000Z');
    w.unmount();
  });
});
