// Polish final review: every start or Forget that does not happen says so. A removed codebase's
// refusal reaches the card; a busy answer to Run or Forget is announced even with no run on
// screen (another leaf, or a Trust and run still starting); and "Trust and run" never leaves the
// review silent. A new file: fallow-run-panel.test.ts is at its cap (L25).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import type { StartOutcome } from '../../src/ui/read-models/fallow-run';
import {
  FALLOW_EXE_FORGOTTEN, FALLOW_PROFILE_REMOVED, FALLOW_RUN_BUSY_HINT, FALLOW_RUN_ERROR, FALLOW_TRUST_NOT_STARTED,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { createFakeFallowAnalysis, fakeRunReview, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const BOUND = { kind: 'bound', binding: { profileId: 'p1', executablePath: 'C:\\Tools\\fallow\\fallow.exe', timeoutSeconds: 120, trust: null } } as const;
const REVIEW = fakeRunReview('p1', 'snapshot-fixture', '/fixture/root');

const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
});

function setup(): FakeFallowAnalysis {
  const fake = createFakeFallowAnalysis();
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

async function pressRun(w: ReturnType<typeof mountS>): Promise<void> {
  await w.find('.ci-fallow-run__run').trigger('click');
  await flushPromises();
}

beforeEach(() => { setActivePinia(createPinia()); });

describe('final review: a removed codebase says so on the card', () => {
  it('a Run refused as profile-removed shows and announces the removal, and opens no dialog', async () => {
    const fake = setup();
    fake.next.run = { kind: 'refused', code: 'profile-removed', detail: '' };
    const w = mountS();
    await flushPromises();
    await pressRun(w);
    expect(FALLOW_RUN_ERROR['profile-removed']('')).toBe(FALLOW_PROFILE_REMOVED);
    expect(w.find('.ci-fallow-run__reason').text()).toBe(FALLOW_PROFILE_REMOVED);
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_PROFILE_REMOVED);
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });

  it('a Forget refused as removed shows and announces the removal, never "forgotten"', async () => {
    const fake = setup();
    fake.setBinding('p1', BOUND);
    fake.next.forget = 'removed';
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__forget').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-run__reason').text()).toBe(FALLOW_PROFILE_REMOVED);
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_PROFILE_REMOVED);
    expect(w.text()).not.toContain(FALLOW_EXE_FORGOTTEN);
    w.unmount();
  });
});

describe('final review: a busy answer with no run on screen is announced', () => {
  it('Run answered busy announces the busy hint', async () => {
    const fake = setup();
    fake.next.run = { kind: 'busy' };
    const w = mountS();
    await flushPromises();
    await pressRun(w);
    expect(useAnalysisStore().active).toBe(false);
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_RUN_BUSY_HINT);
    w.unmount();
  });

  it('Forget answered busy announces the busy hint, never "forgotten"', async () => {
    const fake = setup();
    fake.setBinding('p1', BOUND);
    fake.next.forget = 'busy';
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__forget').trigger('click');
    await flushPromises();
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_RUN_BUSY_HINT);
    w.unmount();
  });
});

describe('final review: Trust and run never leaves the review silent', () => {
  it.each<[string, StartOutcome]>([
    ['choose-executable', { kind: 'choose-executable', read: { kind: 'none' } }],
    ['review', { kind: 'review', review: REVIEW, reason: 'untrusted' }],
  ])('an outcome that is neither started nor refused (%s) is shown in the dialog\'s alert', async (_kind, outcome) => {
    const fake = setup();
    fake.next.run = { kind: 'review', review: REVIEW, reason: 'untrusted' };
    fake.next.trustAndRun = outcome;
    const w = mountS();
    await flushPromises();
    await pressRun(w);
    await w.find('.ci-fallow-installed__trust').trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_TRUST_NOT_STARTED);
    w.unmount();
  });

  it('a Trust and run refused as profile-removed shows the removal in the alert', async () => {
    const fake = setup();
    fake.next.run = { kind: 'review', review: REVIEW, reason: 'untrusted' };
    fake.next.trustAndRun = { kind: 'refused', code: 'profile-removed', detail: '' };
    const w = mountS();
    await flushPromises();
    await pressRun(w);
    await w.find('.ci-fallow-installed__trust').trigger('click');
    await flushPromises();
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_PROFILE_REMOVED);
    w.unmount();
  });
});
