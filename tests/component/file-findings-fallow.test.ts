// Part 6 Y36: File detail's findings panel in its three states — Not analysed, analysed
// with no finding for this file (not zero complexity), and the reported findings.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import FileDetailScreen from '../../src/ui/screens/FileDetailScreen.vue';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import {
  EVIDENCE_BADGE, FALLOW_NOT_ANALYSED_TITLE, FILE_FINDINGS_SUBTITLE, FILE_NO_FINDINGS_REPORTED, SEVERITY_LABEL,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { SYNTHETIC_VERSION, attachSyntheticReport } from '../fixtures/evidence-report';

const mountFile = () => mount(FileDetailScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), clipboard: { writeText: vi.fn(() => Promise.resolve()) } } },
});
function onFile(index: number): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 10, directories: 2 });
  const store = useCityStore();
  store.setCity(snap, computeLayout(snap));
  store.select(snap.entities.filter((e) => e.kind === 'file')[index]!.id);
  store.navigate('file');
  return snap;
}

describe('File detail findings (Part 6 Y36)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('without a report: Not analysed, no badge, and Import report asks Data & scans for the dialog', async () => {
    onFile(0);
    const w = mountFile();
    expect(w.find('.ci-not-analysed__title').text()).toBe(FALLOW_NOT_ANALYSED_TITLE);
    expect(w.find('.ci-findings').exists()).toBe(false);
    expect(w.find('.ci-file-findings__none').exists()).toBe(false);
    expect(w.find('.ci-evidence-badge').exists()).toBe(false);
    await w.find('.ci-not-analysed__import').trigger('click');
    expect(useCityStore().route).toBe('sources');
    expect(useEvidenceStore().importRequested).toBe(true);
    w.unmount();
  });

  it('analysed, with no finding for this file: says so, and that it is not zero complexity (S15)', () => {
    onFile(5);
    // A report over the first two files only (same codebase, same snapshot id): file 5 has none.
    attachSyntheticReport(buildSnapshotFixture({ files: 2, directories: 2 }));
    const w = mountFile();
    expect(w.find('.ci-file-findings__none').text()).toBe(FILE_NO_FINDINGS_REPORTED);
    expect(w.find('.ci-not-analysed').exists()).toBe(false);
    expect(w.find('.ci-panel__header .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'imported'));
    w.unmount();
  });

  it('lists each reported finding with its title, line or range, rule and the tool\'s severity; stale says so', async () => {
    const snap = onFile(0);
    attachSyntheticReport(snap);
    const w = mountFile();
    expect(w.text()).toContain(FILE_FINDINGS_SUBTITLE('3'));
    const items = w.findAll('.ci-file-finding');
    expect(items).toHaveLength(3);
    const text = items.map((i) => i.text()).join('\n');
    expect(text).toContain('symbol0 · Unused export');
    expect(text).toContain('Line 1 · Unused export');
    expect(text).toContain('fn0 · Cognitive complexity 20 (threshold 15)');
    expect(text).toContain('Line 2 · Complexity');
    expect(text).toContain('Duplicated block · 4 lines');
    expect(text).toContain('Lines 3–6 · Duplication');
    expect(text).not.toContain('Sample finding');
    expect(items.map((i) => i.find('.ci-severity').text()).sort())
      .toEqual([SEVERITY_LABEL.critical, SEVERITY_LABEL.unrated, SEVERITY_LABEL.unrated].sort());
    attachSyntheticReport(snap, { snapshotId: 'snapshot-older' });
    await nextTick();
    expect(w.find('.ci-panel__header .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'stale'));
    w.unmount();
  });

  it('renders an imported symbol that looks like HTML as literal text in the finding title (spec §4)', () => {
    const symbol = '<img src=x onerror=alert(1)>';
    attachSyntheticReport(onFile(0), { symbol });
    const w = mountFile();
    const title = w.findAll('.ci-file-finding__title').find((t) => t.text().startsWith(symbol));
    expect(title?.text()).toBe(`${symbol} · Unused export`);
    expect(title?.html()).toContain('&lt;img');
    expect(w.find('.ci-findings img').exists()).toBe(false);
    w.unmount();
  });
});
