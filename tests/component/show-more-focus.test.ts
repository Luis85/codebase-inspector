// Gap closure GRB15: after Show more, keyboard focus moves to the first newly shown row, in
// all four paged tables. The button either stays (focus would otherwise stay on it) or
// unmounts on the last page (focus would otherwise drop to <body>).
import { beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import HotspotTable from '../../src/ui/screens/hotspots/HotspotTable.vue';
import FindingsTable from '../../src/ui/screens/quality/FindingsTable.vue';
import CoverageGapsTable from '../../src/ui/screens/test-confidence/CoverageGapsTable.vue';
import InvestigationList from '../../src/ui/screens/investigate/InvestigationList.vue';
import { collected } from '../../src/ui/evidence';
import type { FileSummary } from '../../src/ui/read-models/file-summaries';
import type { QualityFinding } from '../../src/ui/read-models/findings';
import type { InvestigationRow } from '../../src/ui/read-models/investigation';

const TOTAL = 12;
const LIMIT = 5;
const STEP = 5;

const metric = (n: number) => collected(n, 'test');
function file(i: number): FileSummary {
  return {
    id: `file:f${i}` as FileSummary['id'], name: `f${i}.ts`, path: `src/f${i}.ts`, module: 'src',
    lines: metric(10), complexity: metric(5), commits90d: metric(1),
    branchesCovered: metric(1), branchesTotal: metric(2), branchCoverage: metric(50),
    priority: metric(1000 - i),
  };
}
const files = Array.from({ length: TOTAL }, (_, i) => file(i));
function finding(i: number): QualityFinding {
  return {
    id: `r${i}`, kind: 'complexity', rule: 'complexity', severity: 'high', line: i + 1, endLine: null, symbol: null,
    detail: {} as QualityFinding['detail'], title: `Finding ${i}`, fingerprint: `fp${i}`, related: [], anchored: true,
    anchorPath: `src/f${i}.ts`, file: file(i), moduleLabel: 'src', status: 'open', reason: null,
  };
}
const findings = Array.from({ length: TOTAL }, (_, i) => finding(i));
const investigation: InvestigationRow[] = findings.map((f) => ({ ...f, portable: null, notes: [] }));

/** Mounts `component`, and grows `limit` by STEP on `more` the way each screen does. */
function mountPaged(component: object, extra: Record<string, unknown>): VueWrapper {
  let limit = LIMIT;
  const w: VueWrapper = mount(component, {
    attachTo: document.body,
    props: { ...extra, limit, onMore: () => { limit += STEP; void w.setProps({ limit }); } },
  });
  return w;
}

async function showMore(w: VueWrapper, selector: string): Promise<void> {
  const button = w.get<HTMLButtonElement>(selector);
  button.element.focus();
  expect(document.activeElement).toBe(button.element);
  await button.trigger('click');
  await nextTick();
  await nextTick();
}

describe('Show more moves focus to the first newly shown row (GRB15)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('HotspotTable: the first new row (a tab stop) takes focus', async () => {
    const w = mountPaged(HotspotTable, { rows: files, query: '' });
    expect(document.activeElement).toBe(document.body);   // not on first render
    await showMore(w, '.ci-hotspot-table__more');
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(LIMIT + STEP);
    expect(document.activeElement).toBe(rows[LIMIT]!.element);
    w.unmount();
  });

  it('FindingsTable: the first new row\'s Review button takes focus', async () => {
    const w = mountPaged(FindingsTable, { rows: findings, stale: false });
    await showMore(w, '.ci-findings-table__more');
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(LIMIT + STEP);
    expect(document.activeElement).toBe(rows[LIMIT]!.get('button').element);
    w.unmount();
  });

  it('CoverageGapsTable: the first new row\'s Open button takes focus', async () => {
    const w = mountPaged(CoverageGapsTable, { rows: files });
    await showMore(w, '.ci-coverage-gaps__more');
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(LIMIT + STEP);
    expect(document.activeElement).toBe(rows[LIMIT]!.get('button').element);
    w.unmount();
  });

  it('InvestigationList: the first new row takes focus and becomes the tab stop', async () => {
    const w = mountPaged(InvestigationList, { rows: investigation, selected: null });
    await showMore(w, '.ci-investigate-list__more');
    const rows = w.findAll('.ci-investigate-row');
    expect(rows).toHaveLength(LIMIT + STEP);
    expect(document.activeElement).toBe(rows[LIMIT]!.element);
    expect(rows[LIMIT]!.attributes('tabindex')).toBe('0');
    w.unmount();
  });

  it('InvestigationList: on the last page the button unmounts and focus still lands on the new row', async () => {
    const w = mountPaged(InvestigationList, { rows: investigation.slice(0, 8), selected: null });
    await showMore(w, '.ci-investigate-list__more');
    expect(w.find('.ci-investigate-list__more').exists()).toBe(false);
    expect(document.activeElement).toBe(w.findAll('.ci-investigate-row')[LIMIT]!.element);
    w.unmount();
  });

  it('a limit that shrinks, or a re-sort, leaves focus alone', async () => {
    const w = mountPaged(HotspotTable, { rows: files, query: '' });
    await w.setProps({ limit: 3 });
    await w.get('.ci-table__sort').trigger('click');
    await nextTick();
    expect(w.findAll('tbody tr')).toHaveLength(3);
    expect(document.activeElement).toBe(document.body);
    w.unmount();
  });
});
