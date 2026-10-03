// Part 7 Z29–Z31 (S14): the Connect fallow dialog offers two routes; the installed route
// checks a path by inspection only, reviews exactly what will run, and starts only on
// "Trust and run". Every value is text. A new file: connect-fallow.test.ts is at 370 lines.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import {
  FALLOW_DISCLOSURE, FALLOW_EXE_HINT_WINDOWS, FALLOW_EXE_LABEL, FALLOW_EXE_REFUSED, FALLOW_INSTALL_NOTE, FALLOW_REVIEW_ENV,
  FALLOW_REVIEW_EFFECTS, FALLOW_REVIEW_INSIDE_ROOT, FALLOW_REVIEW_TITLE_RUN, FALLOW_REVIEW_VERSION_KNOWN, FALLOW_REVIEW_VERSION_PENDING, FALLOW_ROUTE_IMPORT_TITLE,
  FALLOW_ROUTE_RUN_TEXT, FALLOW_ROUTE_RUN_TITLE, FALLOW_RUN_BUSY_HINT, FALLOW_RUN_ERROR, FALLOW_RUN_START_FAILED,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { syntheticFallowJson } from '../fixtures/evidence-report';
import { createFakeFallowAnalysis, fakeRunReview, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const RUNNING = {
  status: 'running', rootPath: '/fixture/root', startedAt: '2026-09-23T10:00:00.000Z', timeoutSeconds: 120, version: '3.27.0', tested: true,
  identity: { profileId: 'p1', snapshotId: 'snapshot-fixture', rootFingerprint: 'a', subjectFingerprint: 'b', runId: 'r1', generation: 0 },
} as const;
const BOUND ={ kind: 'bound', binding: { profileId: 'p1', executablePath: 'D:\\bin\\fallow.exe', timeoutSeconds: 120, trust: null } } as const;
const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
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
async function openRoutes(w: Wrapper): Promise<void> {
  await w.find('.ci-fallow-card__import').trigger('click');
  await flushPromises();
}
async function toInstalled(w: Wrapper): Promise<void> {
  await openRoutes(w);
  await w.find('.ci-connect-fallow__use-installed').trigger('click');
  await flushPromises();
}
async function checkPath(w: Wrapper, path: string): Promise<void> {
  await w.find('.ci-fallow-installed__path').setValue(path);
  await w.find('.ci-fallow-installed__check').trigger('click');
  await flushPromises();
}

beforeEach(() => { setActivePinia(createPinia()); });

describe('step 1 offers both routes (Z29)', () => {
  it('shows the import route, the installed route and the disclosure with the install note', async () => {
    setup();
    const w = mountS();
    await openRoutes(w);
    const routes = w.findAll('.ci-connect-fallow__route');
    expect(routes).toHaveLength(2);
    expect(routes[0]!.find('h4').text()).toBe(FALLOW_ROUTE_IMPORT_TITLE);
    expect(routes[0]!.find('.ci-connect-fallow__choose').exists()).toBe(true);
    expect(routes[1]!.find('h4').text()).toBe(FALLOW_ROUTE_RUN_TITLE);
    expect(routes[1]!.text()).toContain(FALLOW_ROUTE_RUN_TEXT);
    expect(routes[1]!.attributes('aria-labelledby')).toBe(routes[1]!.find('h4').attributes('id'));
    expect(w.find('.ci-connect-fallow__disclosure').text()).toBe(`${FALLOW_DISCLOSURE} ${FALLOW_INSTALL_NOTE}`);
    w.unmount();
  });
});

describe('the installed route (Z30, Z31)', () => {
  it('opens on the path step when nothing is bound, with the Windows hint, and checking a path only inspects it', async () => {
    const { fake } = setup();
    const w = mountS();
    await toInstalled(w);
    expect(w.find('label').text()).toBe(FALLOW_EXE_LABEL);
    expect(w.find('.ci-fallow-installed__path').attributes('aria-describedby')).toBeDefined();
    expect(w.text()).toContain(FALLOW_EXE_HINT_WINDOWS);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    expect(fake.calls.map((c) => c.method)).not.toContain('trustAndRun');
    expect(fake.calls.map((c) => c.method)).toContain('review');
    expect(w.find('.ci-fallow-review').exists()).toBe(true);
    w.unmount();
  });

  it('G6: the review shows the exact executable, the root as folder and cwd, one code per argument, the pending version and the effects', async () => {
    const { snap } = setup();
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Program Files\\fallow\\fallow.exe');
    expect(w.find('.ci-fallow-review__executable').text()).toBe('C:\\Program Files\\fallow\\fallow.exe');
    expect(w.find('.ci-fallow-review__root').text()).toBe(snap.scope.rootPath);
    expect(w.find('.ci-fallow-review__cwd').text()).toBe(snap.scope.rootPath);
    expect(w.findAll('.ci-fallow-review__argv code').map((c) => c.text())).toEqual([...FALLOW_RUN_ARGS(snap.scope.rootPath)]);
    expect(w.text()).toContain(FALLOW_REVIEW_VERSION_PENDING);
    expect(w.findAll('.ci-fallow-review__effects li').map((li) => li.text())).toEqual([...FALLOW_REVIEW_EFFECTS]);
    expect(w.find('.ci-fallow-review__inside').exists()).toBe(false);
    w.unmount();
  });

  it('warns when the executable is inside the codebase (Z5)', async () => {
    const { snap, fake } = setup();
    fake.next.review = { ok: true, review: fakeRunReview('p1', snap.snapshotId, snap.scope.rootPath, {
      facts: { ...fakeRunReview('p1', snap.snapshotId, snap.scope.rootPath).facts, insideRoot: true },
    }) };
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\repo\\tools\\fallow.exe');
    expect(w.find('.ci-fallow-review__inside').text()).toBe(FALLOW_REVIEW_INSIDE_ROOT);
    w.unmount();
  });

  it('renders a path with markup as literal text', async () => {
    setup();
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\<img src=x onerror=alert(1)>\\fallow.exe');
    expect(w.find('.ci-fallow-review__executable').text()).toBe('C:\\<img src=x onerror=alert(1)>\\fallow.exe');
    expect(w.find('.ci-fallow-review__executable img').exists()).toBe(false);
    w.unmount();
  });

  it('a refused check is shown in the dialog\'s alert, and nothing else happens', async () => {
    const { fake } = setup();
    fake.next.review = { ok: false, code: 'executable-refused', detail: 'launcher:fallow.exe' };
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow.cmd');
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_RUN_ERROR['executable-refused']('launcher:fallow.exe'));
    expect(w.find('.ci-fallow-review').exists()).toBe(false);
    w.unmount();
  });

  it('Trust and run starts through the service and closes the dialog; Change path goes back', async () => {
    const { fake } = setup();
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__change').trigger('click');
    await flushPromises();
    expect((w.find('.ci-fallow-installed__path').element as HTMLInputElement).value).toBe('C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__check').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__trust').trigger('click');
    await flushPromises();
    expect(fake.calls.map((c) => c.method)).toContain('trustAndRun');
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });

  it('a refused or busy Trust and run stays in the dialog with its reason', async () => {
    const { fake } = setup();
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    fake.next.trustAndRun = { kind: 'refused', code: 'root-unavailable', detail: '' };
    await w.find('.ci-fallow-installed__trust').trigger('click');
    await flushPromises();
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_RUN_ERROR['root-unavailable'](''));
    fake.next.trustAndRun = { kind: 'busy' };
    await w.find('.ci-fallow-installed__trust').trigger('click');
    await flushPromises();
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_RUN_BUSY_HINT);
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    w.unmount();
  });

  it('a file that changed since the review reopens a fresh review saying why', async () => {
    const { fake } = setup();
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    fake.next.trustAndRun = { kind: 'refused', code: 'changed-since-review', detail: '' };
    await w.find('.ci-fallow-installed__trust').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-installed__retrust').exists()).toBe(true);
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_RUN_ERROR['changed-since-review'](''));
    w.unmount();
  });
});

describe('the installed route: focus, the bound path, failures and a codebase switch (Z29, Z30, PF13, PF17)', () => {
  it('Use installed fallow… moves focus to the route heading; a bound executable is reviewed at once, by inspection only', async () => {
    const { fake } = setup();
    fake.setBinding('p1', BOUND);
    const w = mountS();
    await flushPromises();
    await toInstalled(w);
    expect(fake.calls.map((c) => c.method).filter((m) => m !== 'readBinding')).toEqual(['review']);
    expect(w.find('.ci-fallow-review__executable').text()).toBe(BOUND.binding.executablePath);
    expect(document.activeElement?.textContent?.trim()).toBe(FALLOW_REVIEW_TITLE_RUN);
    await w.find('.ci-fallow-installed__change').trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.ci-fallow-installed__path').element);
    w.unmount();
  });

  it('focuses the path step heading when nothing is bound', async () => {
    setup();
    const w = mountS();
    await toInstalled(w);
    expect(document.activeElement?.textContent?.trim()).toBe(FALLOW_ROUTE_RUN_TITLE);
    w.unmount();
  });

  it('PF17c: a path where no file exists says so on the path step', async () => {
    const { fake } = setup();
    fake.next.review = { ok: false, code: 'executable-missing', detail: '' };
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\nothing\\fallow.exe');
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_EXE_REFUSED['executable-missing'](''));
    w.unmount();
  });

  it('PF17b (amended): an unreadable file keeps its code; a data.json failure in the check blames the data file, not the executable', async () => {
    const { fake } = setup();
    fake.next.review = { ok: false, code: 'executable-refused', detail: 'unreadable:EACCES' };
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_EXE_REFUSED.unreadable('EACCES'));
    fake.review = () => Promise.reject(Object.assign(new Error('data.json could not be read'), { code: 'EACCES' }));
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_RUN_START_FAILED);
    expect(w.text()).not.toContain('UNKNOWN');
    expect(w.find('.ci-fallow-installed__check').attributes('aria-disabled')).toBeUndefined();
    w.unmount();
  });

  it('a thrown Trust and run (a data.json write) stays in the dialog with the start failure; Change path clears the alert (PF13)', async () => {
    const { fake } = setup();
    fake.trustAndRun = () => Promise.reject(new Error('data.json could not be written'));
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__trust').trigger('click');
    await flushPromises();
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_RUN_START_FAILED);
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    await w.find('.ci-fallow-installed__change').trigger('click');
    await flushPromises();
    expect(w.find('[role="alert"]').exists()).toBe(false);
    w.unmount();
  });

  it('PF17a: a codebase switch while a check is in flight holds the dialog, then drops the answer and closes once it settles', async () => {
    const { fake } = setup();
    const gate: { release: (() => void) | null } = { release: null };
    const review = fake.review.bind(fake);
    fake.review = async (profileId, snapshot, path) => {
      await new Promise<void>((r) => { gate.release = r; });
      return review(profileId, snapshot, path);
    };
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    expect(w.find('.ci-fallow-installed__check').attributes('aria-disabled')).toBe('true');
    useAnalysisStore().bindRepository('p2');
    await w.find('.ci-fallow-installed__check').trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    gate.release?.();
    await flushPromises();
    expect(w.find('.ci-fallow-review').exists()).toBe(false);
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(fake.calls.filter((c) => c.method === 'review')).toHaveLength(1);
    w.unmount();
  });
});

describe('final review: the review tells the truth, and an import cannot land mid-run', () => {
  it('the Environment row names the variables Windows always adds for fallow.exe, and not for fallow', async () => {
    for (const [name, windows] of [['fallow.exe', true], ['fallow', false]] as const) {
      setActivePinia(createPinia());
      setup(name);
      const w = mountS();
      await flushPromises();
      await toInstalled(w);
      await checkPath(w, name === 'fallow' ? '/opt/fallow/fallow' : 'C:\\Tools\\fallow\\fallow.exe');
      const facts = w.find('.ci-fallow-review__facts').text();
      expect(facts.includes('USERNAME'), name).toBe(windows);
      expect(facts, name).toContain(FALLOW_REVIEW_ENV(windows));
      w.unmount();
    }
  });

  it('a previously trusted version is described as checked and recorded after you trust it, never as pinned', async () => {
    const { snap, fake } = setup();
    fake.next.review = { ok: true, review: fakeRunReview('p1', snap.snapshotId, snap.scope.rootPath, { trustedVersion: '3.21.0' }) };
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    const facts = w.find('.ci-fallow-review__facts').text();
    expect(facts).toContain('recorded with the trust');
    expect(facts).not.toContain('checked again before the run');
    expect(facts).toContain(FALLOW_REVIEW_VERSION_KNOWN('3.21.0', true));
    w.unmount();
  });

  it('K9/Z32: an import the command opens during a running analysis cannot choose a file or attach one', async () => {
    const { snap, fake } = setup();
    fake.setState('p1', RUNNING);
    const w = mountS();
    await flushPromises();
    useEvidenceStore().requestImport();
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    const choose = w.find('.ci-connect-fallow__choose');
    expect(choose.attributes('aria-disabled')).toBe('true');
    expect(w.find(`#${choose.attributes('aria-describedby') ?? 'missing'}`).text()).toBe(FALLOW_RUN_BUSY_HINT);
    const input = w.find<HTMLInputElement>('.ci-connect-fallow__file');
    const clicked = vi.spyOn(input.element, 'click');
    await choose.trigger('click');
    expect(clicked).not.toHaveBeenCalled();
    // A file that still arrives (picked before the run started) is reviewed, but never attached.
    Object.defineProperty(input.element, 'files', { value: [new File([syntheticFallowJson(snap)], 'r.json')], configurable: true });
    await input.trigger('change');
    await flushPromises();
    const attach = w.find('.ci-connect-fallow__attach');
    expect(attach.attributes('aria-disabled')).toBe('true');
    await attach.trigger('click');
    await flushPromises();
    expect(useEvidenceStore().report).toBeNull();
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    w.unmount();
  });
});
