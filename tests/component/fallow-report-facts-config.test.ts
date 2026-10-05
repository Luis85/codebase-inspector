// GRB9 / GCN12: a collected report's facts name the fallow config files that were in the
// codebase's root; an imported report has no such row (it carries no root).
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import '../mocks/obsidian';
import FallowReportFacts from '../../src/ui/screens/sources/FallowReportFacts.vue';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { FALLOW_CONFIG_FILES, FALLOW_CONFIG_NONE, FALLOW_ROW_CONFIG } from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { collectedEvidenceReport, syntheticEvidenceReport } from '../fixtures/evidence-report';

const SNAP = buildSnapshotFixture({ files: 6, repositoryId: 'p1' });
const mountFacts = (report: EvidenceReport) => mount(FallowReportFacts, {
  props: { report, matchedFindings: 3, matchedFiles: 2, unmatchedPaths: [], showImportedAt: true },
});
const withConfig = (configFiles: readonly string[]): EvidenceReport => {
  const base = collectedEvidenceReport(SNAP);
  return { ...base, collected: { ...base.collected!, configFiles } };
};

describe('FallowReportFacts: the fallow config files row (GRB9)', () => {
  it('a collected run names the config files that were in the root', () => {
    const w = mountFacts(withConfig(['.fallowrc.json']));
    expect(w.findAll('dt').map((dt) => dt.text())).toContain(FALLOW_ROW_CONFIG);
    expect(w.find('.ci-fallow-facts__config').text()).toBe('fallow config files in the root: .fallowrc.json');
    expect(FALLOW_CONFIG_FILES(['.fallowrc.json'])).toBe('fallow config files in the root: .fallowrc.json');
  });

  it('several files read as a comma-separated list', () => {
    const w = mountFacts(withConfig(['.fallowrc.json', 'fallow.toml']));
    expect(w.find('.ci-fallow-facts__config').text()).toBe('fallow config files in the root: .fallowrc.json, fallow.toml');
  });

  it('control: no config file in the root reads "No fallow config file in the root"', () => {
    const w = mountFacts(withConfig([]));
    expect(w.find('.ci-fallow-facts__config').text()).toBe('No fallow config file in the root');
    expect(FALLOW_CONFIG_NONE).toBe('No fallow config file in the root');
  });

  it('control: an imported report has no config row', () => {
    const w = mountFacts(syntheticEvidenceReport(SNAP));
    expect(w.find('.ci-fallow-facts__config').exists()).toBe(false);
    expect(w.findAll('dt').map((dt) => dt.text())).not.toContain(FALLOW_ROW_CONFIG);
  });

  it('shows the file names as text, never as markup', () => {
    const evil = '<img src=x onerror=alert(1)>.json';
    const w = mountFacts(withConfig([evil]));
    expect(w.find('.ci-fallow-facts__config img').exists()).toBe(false);
    expect(w.find('.ci-fallow-facts__config').text()).toBe(`fallow config files in the root: ${evil}`);
  });
});
