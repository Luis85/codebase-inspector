// Gap closure GRB13 a: a removed codebase offers no Choose button, and says it was removed.
// The run panel on Data & scans offers neither Choose nor Forget for a `{ kind: 'removed' }`
// binding (the service's read of a purged profile: tests/unit/fallow-analysis-service-removed.test.ts);
// a Forget answered `removed` says the same.
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
import { FALLOW_CODEBASE_REMOVED, FALLOW_RUN_ERROR } from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { createFakeFallowAnalysis, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const BOUND = { kind: 'bound', binding: { profileId: 'p1', executablePath: 'C:\\Tools\\fallow\\fallow.exe', timeoutSeconds: 120, trust: null } } as const;

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

beforeEach(() => { setActivePinia(createPinia()); });

describe('GRB13 a: the run panel for a removed codebase', () => {
  it('offers no Choose and no Forget, and says the codebase was removed', async () => {
    const fake = setup();
    fake.setBinding('p1', { kind: 'removed' });
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-fallow-run__choose').exists()).toBe(false);
    expect(w.find('.ci-fallow-run__forget').exists()).toBe(false);
    expect(w.find('.ci-fallow-run__facts').text()).toContain(FALLOW_CODEBASE_REMOVED);
    w.unmount();
  });

  it('a bound codebase still offers Choose (the removed rule is not general)', async () => {
    const fake = setup();
    fake.setBinding('p1', BOUND);
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-fallow-run__choose').exists()).toBe(true);
    w.unmount();
  });

  it('after a Forget answered removed flips the binding to removed, focus moves to Run, not <body>', async () => {
    const fake = setup();
    fake.setBinding('p1', BOUND);
    fake.next.forget = 'removed';
    const forget = fake.forget.bind(fake);
    fake.forget = async (id) => {
      const answer = await forget(id);
      fake.setBinding(id, { kind: 'removed' });
      return answer;
    };
    const w = mountS();
    await flushPromises();
    const button = w.find<HTMLButtonElement>('.ci-fallow-run__forget');
    button.element.focus();
    expect(document.activeElement).toBe(button.element);
    await button.trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-run__forget').exists()).toBe(false);
    expect(w.find('.ci-fallow-run__choose').exists()).toBe(false);
    expect(document.activeElement).toBe(w.find('.ci-fallow-run__run').element);
    w.unmount();
  });

  it('a Forget answered removed says "This codebase was removed." and keeps the reason line', async () => {
    const fake = setup();
    fake.setBinding('p1', BOUND);
    fake.next.forget = 'removed';
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__forget').trigger('click');
    await flushPromises();
    const banner = w.find('.ci-fallow-run__banner');
    expect(banner.text()).toContain(FALLOW_CODEBASE_REMOVED);
    expect(banner.text()).toContain(FALLOW_RUN_ERROR['profile-removed'](''));
    expect(banner.text()).not.toContain('analysis failed');
    w.unmount();
  });
});
