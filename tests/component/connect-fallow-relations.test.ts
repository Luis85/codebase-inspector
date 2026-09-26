// WP-03 Part 1 final review (#3, #5): Connect fallow over the relations recordings. The
// review step and the fallow card read not-configured boundaries as "Not configured in
// fallow", never "Not analysed" (N11); a cycle with no files is refused as `invalid` at its
// own path, never thrown by the review (N1).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { FALLOW_CATEGORY_LINE, FALLOW_IMPORT_ERROR, FINDING_KIND_LABEL } from '../../src/ui/inspector-copy';
import { snapshotWithPaths } from '../fixtures/evidence-report';
import { RELATIONS_PATHS, attachRelationsReport, relationsRecordingJson } from '../fixtures/relations-report';

const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
});
type Wrapper = ReturnType<typeof mountS>;

/** The recording's own `src/` paths, so its findings match without the mapping offer. */
function withSnapshot(): CodebaseSnapshot {
  const snap = snapshotWithPaths(RELATIONS_PATHS.map((p) => `src/${p}`), 'repo-connect-relations');
  useCityStore().setCity(snap, computeLayout(snap));
  useEvidenceStore().bindRepository(snap.repositoryId);
  return snap;
}
async function pick(w: Wrapper, text: string): Promise<void> {
  await w.find('.ci-fallow-card__import').trigger('click');
  await flushPromises();
  const input = w.find('.ci-connect-fallow__file');
  Object.defineProperty(input.element, 'files', { value: [new File([text], 'relations.json', { type: 'application/json' })], configurable: true });
  await input.trigger('change');
  await flushPromises();
}
/** A snapshot on the stripped paths attachRelationsReport resolves against (JF14), with the
 *  recording (or `json`) attached. */
function attached(json?: string): void {
  const snap = snapshotWithPaths(RELATIONS_PATHS, `repo-card-relations-${Math.random()}`);
  useCityStore().setCity(snap, computeLayout(snap));
  attachRelationsReport(snap, json === undefined ? {} : { json });
}
const categoryLines = (w: Wrapper, scope: string): string[] => w.findAll(`${scope} .ci-fallow-facts__categories li`).map((li) => li.text());

/** The recording with its first import cycle's (or its re-export cycle's) `files` emptied. */
function emptyCycleJson(section: 'circular_dependencies' | 're_export_cycles'): string {
  const raw = JSON.parse(relationsRecordingJson()) as { check: Record<string, { files: unknown[] }[]> };
  raw.check[section]![0]!.files = [];
  return JSON.stringify(raw);
}

const NOT_CONFIGURED = [
  FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL.complexity, 'analysed'),
  FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL.duplication, 'analysed'),
  FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL['unused-exports'], 'analysed'),
  FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL.cycle, 'analysed'),
  FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL.boundary, 'not-configured'),
  FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL['unresolved-import'], 'analysed'),
];

describe('Connect fallow over the relations recordings (WP-03 N1, N11)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useEvidenceStore().setRepository(new InMemoryEvidenceStore());
    useCityStore().navigate('sources');
  });

  it('not-configured boundaries read "Not configured in fallow" in the review step, never "Not analysed"', async () => {
    withSnapshot();
    const w = mountS();
    await pick(w, relationsRecordingJson('relations-no-boundaries-3.27.0.json'));
    const lines = categoryLines(w, '.ci-connect-fallow');
    expect(lines).toEqual(NOT_CONFIGURED);
    expect(lines[4]).toBe(`${FINDING_KIND_LABEL.boundary}: Not configured in fallow`);
    w.unmount();
  });

  it('and on the fallow card once attached; a configured report still reads Analysed', () => {
    attached(relationsRecordingJson('relations-no-boundaries-3.27.0.json'));
    const w = mountS();
    expect(categoryLines(w, '.ci-fallow-card')).toEqual(NOT_CONFIGURED);
    expect(categoryLines(w, '.ci-fallow-card')[4]).toBe(`${FINDING_KIND_LABEL.boundary}: Not configured in fallow`);
    w.unmount();
    attached();
    const w2 = mountS();
    expect(categoryLines(w2, '.ci-fallow-card')[4]).toBe(FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL.boundary, 'analysed'));
    w2.unmount();
  });

  it.each([
    ['circular_dependencies', 'check.circular_dependencies.0.files'],
    ['re_export_cycles', 'check.re_export_cycles.0.files'],
  ] as const)('a %s element with no files is refused as invalid at its path, not thrown', async (section, at) => {
    withSnapshot();
    const w = mountS();
    await pick(w, emptyCycleJson(section));
    const alerts = w.findAll('.ci-connect-fallow__error');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.text()).toBe(FALLOW_IMPORT_ERROR.invalid(at));
    expect(w.find('.ci-connect-fallow__choose').exists()).toBe(true);   // still at the pick step
    expect(useEvidenceStore().report).toBeNull();
    w.unmount();
  });
});
