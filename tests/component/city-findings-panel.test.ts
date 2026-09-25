// WP-04 Task 15 (IP32/IP33): the city inspector's Findings section — no report, no
// section; with a report, the selected file's own touchingFindings, anchored rows
// first, then related ones marked FINDING_VIA_RELATED; at most 10 rows, then "N more on
// Investigate"; and it never drives the renderer (Focus/selection/camera stay City's own
// buttons' job, never this section's).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import CityFindingsPanel from '../../src/ui/screens/city/CityFindingsPanel.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { EvidenceReport } from '../../src/application/evidence/model';
import {
  CITY_FINDINGS_MORE, CITY_FINDINGS_ROW, CITY_FINDINGS_TITLE, FINDING_KIND_LABEL, FINDING_VIA_RELATED, RULE_TEXT,
} from '../../src/ui/inspector-copy';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';

const IMPORTED_AT = '2026-09-23T10:00:00.000Z';

interface Unused { path: string; name: string; line: number }
interface Boundary { from: string; to: string; line: number }

/** A minimal combined report the real parser and normaliser accept — only the two shapes
 *  this test needs (unused exports, anchored on their own file; boundary violations,
 *  anchored on `from` and related on `to`), so the "anchored first, then related" order
 *  and the 10-row cap can be built with exact, known counts. */
function buildReport(snapshot: CodebaseSnapshot, unused: readonly Unused[], boundaries: readonly Boundary[] = []): EvidenceReport {
  const json = JSON.stringify({
    kind: 'combined', schema_version: 12, version: '3.27.0', elapsed_ms: 1, workspace_diagnostics: [], _meta: { synthetic: true },
    check: {
      summary: {
        total_issues: unused.length + boundaries.length, unused_files: 0, unused_exports: unused.length, unused_types: 0,
        circular_dependencies: 0, re_export_cycles: 0, boundary_violations: boundaries.length, unresolved_imports: 0,
      },
      unused_exports: unused.map((u) => ({ path: u.path, export_name: u.name, is_type_only: false, line: u.line, col: 0 })),
      unused_types: [],
      circular_dependencies: [],
      re_export_cycles: [],
      boundary_violations: boundaries.map((b) => ({
        from_path: b.from, to_path: b.to, from_zone: 'app', to_zone: 'data', import_specifier: b.to, line: b.line, col: 0,
      })),
      unresolved_imports: [],
    },
    dupes: { clone_groups: [] },
    health: { findings: [], summary: { max_cyclomatic_threshold: 20, max_cognitive_threshold: 15 } },
  });
  const parsed = parseFallowReportText(json);
  if (!parsed.ok) throw new Error(`test setup: the custom report was refused (${parsed.code} ${parsed.detail})`);
  return buildEvidenceReport({
    raw: parsed.report, fileName: 'city-findings.json', importedAt: IMPORTED_AT, snapshotId: snapshot.snapshotId, stripPrefix: null,
  });
}

function attach(snapshot: CodebaseSnapshot, report: EvidenceReport): void {
  const store = useEvidenceStore();
  store.setRepository(new InMemoryEvidenceStore());
  store.bindRepository(snapshot.repositoryId);
  if (!store.attach(report)) throw new Error('test setup: the evidence store refused the report');
}

function selectPath(snapshot: CodebaseSnapshot, path: string) {
  const file = snapshot.entities.find((e) => e.kind === 'file' && e.path === path)!;
  useCityStore().select(file.id);
  return file;
}

function rendererDouble() {
  return { focus: vi.fn(), setSelection: vi.fn(), setCamera: vi.fn() };
}

function mountPanel(renderer = rendererDouble()) {
  return { wrapper: mount(CityFindingsPanel, { global: { provide: { [CITY_RENDERER_KEY as symbol]: { value: renderer } } } }), renderer };
}

describe('CityFindingsPanel (WP-04 IP32/IP33)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows no Findings section without a report', () => {
    const snap = buildSnapshotFixture({ files: 3, repositoryId: `repo-city-findings-${Math.random()}` });
    useCityStore().setCity(snap, computeLayout(snap));
    selectPath(snap, 'file-0.ts');
    const { wrapper } = mountPanel();
    expect(wrapper.find('.ci-city-findings').exists()).toBe(false);
  });

  it('lists anchored findings first, then related ones marked FINDING_VIA_RELATED, and never calls the renderer', () => {
    const snap = buildSnapshotFixture({ files: 4, repositoryId: `repo-city-findings-mix-${Math.random()}` });
    useCityStore().setCity(snap, computeLayout(snap));
    attach(snap, buildReport(
      snap,
      [{ path: 'file-0.ts', name: 'a', line: 1 }, { path: 'file-0.ts', name: 'b', line: 2 }],
      [{ from: 'file-1.ts', to: 'file-0.ts', line: 3 }],
    ));
    selectPath(snap, 'file-0.ts');
    const { wrapper, renderer } = mountPanel();
    expect(wrapper.find('.ci-city-findings__title').text()).toBe(CITY_FINDINGS_TITLE);
    const rows = wrapper.findAll('.ci-city-findings__row');
    expect(rows).toHaveLength(3);
    // The two anchored unused-export findings come first, in either order, neither
    // marked "Reported on …"; the related boundary finding (anchored on file-1.ts)
    // comes last, marked FINDING_VIA_RELATED.
    expect(rows[0]!.find('.ci-city-findings__via').exists()).toBe(false);
    expect(rows[1]!.find('.ci-city-findings__via').exists()).toBe(false);
    const anchoredText = `${rows[0]!.text()}\n${rows[1]!.text()}`;
    expect(anchoredText).toContain(CITY_FINDINGS_ROW(FINDING_KIND_LABEL['unused-exports'], RULE_TEXT('unused-export'), 1));
    expect(anchoredText).toContain(CITY_FINDINGS_ROW(FINDING_KIND_LABEL['unused-exports'], RULE_TEXT('unused-export'), 2));
    expect(rows[2]!.find('.ci-city-findings__via').text()).toBe(FINDING_VIA_RELATED('file-1.ts'));
    const investigate = rows[0]!.find('.ci-city-findings__investigate');
    expect(investigate.exists()).toBe(true);
    expect(investigate.attributes('aria-label')).toMatch(/^Investigate .+ in file-0\.ts$/);
    expect(renderer.focus).not.toHaveBeenCalled();
    expect(renderer.setSelection).not.toHaveBeenCalled();
    expect(renderer.setCamera).not.toHaveBeenCalled();
  });

  it('caps the list at 10 rows and shows CITY_FINDINGS_MORE for the rest', () => {
    const snap = buildSnapshotFixture({ files: 1, repositoryId: `repo-city-findings-many-${Math.random()}` });
    useCityStore().setCity(snap, computeLayout(snap));
    const unused = Array.from({ length: 13 }, (_v, i) => ({ path: 'file-0.ts', name: `sym${i}`, line: i + 1 }));
    attach(snap, buildReport(snap, unused));
    selectPath(snap, 'file-0.ts');
    const { wrapper } = mountPanel();
    expect(wrapper.findAll('.ci-city-findings__row')).toHaveLength(10);
    expect(wrapper.text()).toContain(CITY_FINDINGS_MORE(3));
  });
});
