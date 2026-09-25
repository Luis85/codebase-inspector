// WP-04 Task 15 (IN4, IN5, IN41; IP20, IP34): every entry point into Investigate — the
// city inspector's Findings panel, Quality's review dialog, File detail's finding rows
// and Architecture's cycle and fallow boundary rows — goes through the ONE
// useOpenInvestigation() composable: open(fingerprint), then navigate('investigate'),
// never touching the city selection (IP20).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, nextTick } from 'vue';
import '../mocks/obsidian';
import FileInspector from '../../src/ui/components/FileInspector.vue';
import InvestigateScreen from '../../src/ui/screens/InvestigateScreen.vue';
import FileDetailScreen from '../../src/ui/screens/FileDetailScreen.vue';
import ArchitectureScreen from '../../src/ui/screens/ArchitectureScreen.vue';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { RELATIONS_PATHS, attachRelationsReport } from '../fixtures/relations-report';
import { snapshotWithPaths } from '../fixtures/evidence-report';
import { inertInvestigationNotes, scriptedSourcePreview } from '../fixtures/fake-investigation';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';
import {
  ARCH_TAB_CYCLES, ARCH_TAB_RULES, CYCLE_KIND_LABEL, FILE_SOURCE_PREVIEW_LATER, FINDING_LINE_TEXT, RULE_TEXT,
} from '../../src/ui/inspector-copy';

const IMPORTED_AT = '2026-09-23T10:00:00.000Z';
const clipboardDouble = () => ({ writeText: vi.fn(async () => {}) });
const rendererDouble = () => ({
  setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setReported: vi.fn(),
  setRelations: vi.fn(), setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
  getCamera: vi.fn(() => ({ projection: 'orthographic' as const, mode: '3d' as const, position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number], zoom: 1 })),
  setCamera: vi.fn(), nudgeCamera: vi.fn(), focus: vi.fn(), fit: vi.fn(), resize: vi.fn(),
  pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
  getDiagnostics: vi.fn(() => ({ geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false })),
  debugLoseContext: vi.fn(),
});

/** A minimal combined report with exactly one unused-export finding — the real parser
 *  and normaliser, so the acceptance test's finding has a real id and fingerprint. */
function buildUnusedReport(snapshot: CodebaseSnapshot, path: string): EvidenceReport {
  const json = JSON.stringify({
    kind: 'combined', schema_version: 12, version: '3.27.0', elapsed_ms: 1, workspace_diagnostics: [], _meta: { synthetic: true },
    check: {
      summary: { total_issues: 1, unused_files: 0, unused_exports: 1, unused_types: 0, circular_dependencies: 0, re_export_cycles: 0, boundary_violations: 0, unresolved_imports: 0 },
      unused_exports: [{ path, export_name: 'onlyExport', is_type_only: false, line: 4, col: 0 }],
      unused_types: [], circular_dependencies: [], re_export_cycles: [], boundary_violations: [], unresolved_imports: [],
    },
    dupes: { clone_groups: [] },
    health: { findings: [], summary: { max_cyclomatic_threshold: 20, max_cognitive_threshold: 15 } },
  });
  const parsed = parseFallowReportText(json);
  if (!parsed.ok) throw new Error(`test setup: the report was refused (${parsed.code} ${parsed.detail})`);
  return buildEvidenceReport({ raw: parsed.report, fileName: 'entry.json', importedAt: IMPORTED_AT, snapshotId: snapshot.snapshotId, stripPrefix: null });
}

function attach(snapshot: CodebaseSnapshot, report: EvidenceReport): void {
  const store = useEvidenceStore();
  store.setRepository(new InMemoryEvidenceStore());
  store.bindRepository(snapshot.repositoryId);
  if (!store.attach(report)) throw new Error('test setup: the evidence store refused the report');
}

describe('Investigate entry points (WP-04 IN4, IN5, IN41)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('IN4/IN5: a city finding opens the same evidence in the workbench, keeping the selection and never moving the camera', async () => {
    const snap = buildSnapshotFixture({ files: 3, repositoryId: `repo-entry-city-${Math.random()}` });
    useCityStore().setCity(snap, computeLayout(snap));
    attach(snap, buildUnusedReport(snap, 'file-0.ts'));
    useInvestigationStore().setPorts(inertInvestigationNotes(), scriptedSourcePreview());
    const { quality } = useReadModels();
    const finding = quality.value.findings[0]!;
    const city = useCityStore();
    city.select(finding.file.id);
    city.openInspector();
    const renderer = rendererDouble();
    const Shell = defineComponent({
      setup() {
        return () => h('div', [
          h(FileInspector),
          city.route === 'investigate' ? h(InvestigateScreen) : null,
        ]);
      },
    });
    const w = mount(Shell, {
      attachTo: document.body,
      global: { provide: { clipboard: clipboardDouble(), [CITY_RENDERER_KEY as symbol]: { value: renderer }, onSelectCodebase: vi.fn() } },
    });
    await nextTick();
    const investigate = w.find('.ci-city-findings__investigate');
    expect(investigate.exists()).toBe(true);
    await investigate.trigger('click');
    await nextTick();
    expect(city.route).toBe('investigate');
    expect(useInvestigationStore().selectedFingerprint).toBe(finding.fingerprint);
    const evidenceText = w.find('.ci-evidence-panel__meta').text();
    expect(evidenceText).toContain(finding.id);
    expect(evidenceText).toContain(RULE_TEXT(finding.rule));
    expect(evidenceText).toContain(finding.file.path);
    expect(evidenceText).toContain(FINDING_LINE_TEXT(finding.line, finding.endLine));
    expect(renderer.setCamera).not.toHaveBeenCalled();
    expect(renderer.focus).not.toHaveBeenCalled();
    w.unmount();
  });

  it('Quality: the review dialog\'s Investigate opens the same fingerprint and navigates; the dialog is gone', async () => {
    const snap = buildSnapshotFixture({ files: 2, repositoryId: `repo-entry-quality-${Math.random()}` });
    useCityStore().setCity(snap, computeLayout(snap));
    attach(snap, buildUnusedReport(snap, 'file-0.ts'));
    const { quality } = useReadModels();
    const finding = quality.value.findings[0]!;
    const w = mount(QualityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
    await w.findAll('.ci-findings-table__open')[0]!.trigger('click');
    expect(w.find('.ci-finding-dialog').text()).toContain(finding.id);
    await w.find('.ci-finding-dialog__investigate').trigger('click');
    await nextTick();
    expect(w.find('.ci-finding-dialog').exists()).toBe(false);
    expect(useCityStore().route).toBe('investigate');
    expect(useInvestigationStore().selectedFingerprint).toBe(finding.fingerprint);
    w.unmount();
  });

  it('File detail: a sibling Investigate button (never nested in Review) opens the anchor fingerprint for an anchored and a related row; Review still opens the dialog', async () => {
    const snap = snapshotWithPaths(RELATIONS_PATHS, `repo-entry-file-${Math.random()}`);
    useCityStore().setCity(snap, computeLayout(snap));
    attachRelationsReport(snap);
    const { quality } = useReadModels();
    const boundaryFinding = quality.value.findings.find((f) => f.kind === 'boundary')!;

    function mountOn(path: string) {
      const file = snap.entities.find((e) => e.kind === 'file' && e.path === path)!;
      useCityStore().select(file.id);
      useCityStore().navigate('file');
      return mount(FileDetailScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), clipboard: clipboardDouble() } } });
    }

    const anchorWrapper = mountOn('ui/view.ts');
    await nextTick();
    expect(anchorWrapper.text()).toContain(FILE_SOURCE_PREVIEW_LATER);
    const anchorLi = anchorWrapper.find('.ci-file-finding');
    const review = anchorLi.find('.ci-file-finding__review');
    const investigate = anchorLi.find('.ci-file-finding__investigate');
    expect(investigate.exists()).toBe(true);
    // E20: a sibling of the row button, never nested inside it.
    expect(review.find('.ci-file-finding__investigate').exists()).toBe(false);
    await review.trigger('click');
    expect(anchorWrapper.find('.ci-finding-dialog').text()).toContain(boundaryFinding.id);
    await anchorWrapper.find('.ci-finding-dialog__close').trigger('click');
    expect(anchorWrapper.find('.ci-finding-dialog').exists()).toBe(false);
    await investigate.trigger('click');
    await nextTick();
    expect(useCityStore().route).toBe('investigate');
    expect(useInvestigationStore().selectedFingerprint).toBe(boundaryFinding.fingerprint);
    anchorWrapper.unmount();

    useInvestigationStore().open('some-other-fingerprint');
    const relatedWrapper = mountOn('data/db.ts');
    await nextTick();
    await relatedWrapper.find('.ci-file-finding__investigate').trigger('click');
    await nextTick();
    expect(useInvestigationStore().selectedFingerprint).toBe(boundaryFinding.fingerprint);
    relatedWrapper.unmount();
  });

  it('Architecture: a cycle row\'s and a fallow boundary row\'s Investigate open the finding\'s fingerprint; a cycle row with no anchor in the snapshot offers no Investigate', async () => {
    const filtered = RELATIONS_PATHS.filter((p) => p !== 'core/a.ts');
    const snap = snapshotWithPaths(filtered, `repo-entry-arch-${Math.random()}`);
    useCityStore().setCity(snap, computeLayout(snap));
    attachRelationsReport(snap);
    const { architecture } = useReadModels();
    const w = mount(ArchitectureScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
    const openTab = async (label: string): Promise<void> => {
      await w.findAll('[role="tab"]').find((t) => t.text() === label)!.trigger('click');
    };
    await openTab(ARCH_TAB_CYCLES);
    const rows = w.findAll('.ci-cycle-list__row');
    // core/a.ts (the cycle's own anchor) is missing from the snapshot: its row offers no Investigate.
    const coreRow = rows.find((r) => r.text().includes('core/b.ts'))!;
    expect(coreRow.find('.ci-cycle-list__investigate').exists()).toBe(false);
    const barrelRow = rows.find((r) => r.find('.ci-cycle-list__kind').text() === CYCLE_KIND_LABEL.import && r.text().includes('barrel'))!;
    const barrelCycle = architecture.value.relations.cycles.find((c) => c.kind === 'import' && c.pathText.includes('barrel/index.ts'))!;
    expect(barrelCycle.fingerprint).not.toBeNull();
    await barrelRow.find('.ci-cycle-list__investigate').trigger('click');
    await nextTick();
    expect(useCityStore().route).toBe('investigate');
    expect(useInvestigationStore().selectedFingerprint).toBe(barrelCycle.fingerprint);

    await openTab(ARCH_TAB_RULES);
    const boundaryRow = w.find('.ci-architecture__fallow .ci-table__row');
    const boundaryFinding = architecture.value.relations.boundaryViolations[0]!;
    expect(boundaryFinding.fingerprint).not.toBeNull();
    await boundaryRow.find('.ci-architecture__investigate').trigger('click');
    await nextTick();
    expect(useCityStore().route).toBe('investigate');
    expect(useInvestigationStore().selectedFingerprint).toBe(boundaryFinding.fingerprint);
    w.unmount();
  });
});
