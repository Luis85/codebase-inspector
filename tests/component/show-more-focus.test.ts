// Gap closure GRB15: after Show more, keyboard focus moves to the first newly shown row, in
// all four paged tables. The button either stays (focus would otherwise stay on it) or
// unmounts on the last page (focus would otherwise drop to <body>).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, nextTick, ref, type VNode } from 'vue';
import '../mocks/obsidian';
import HotspotTable from '../../src/ui/screens/hotspots/HotspotTable.vue';
import FindingsTable from '../../src/ui/screens/quality/FindingsTable.vue';
import CoverageGapsTable from '../../src/ui/screens/test-confidence/CoverageGapsTable.vue';
import InvestigationList from '../../src/ui/screens/investigate/InvestigationList.vue';
import EvidenceTable from '../../src/ui/kit/EvidenceTable.vue';
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
    id: `file:f${i}`, name: `f${i}.ts`, path: `src/f${i}.ts`, module: 'src',
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

/** Mounts what `render` returns inside a host that owns `limit` as every screen does: `more`
 *  grows it by STEP. (A host, not a component argument, because eslint reads the .vue
 *  imports as error-typed.) */
function paged(render: (limit: number, onMore: () => void) => VNode) {
  const limit = ref(LIMIT);
  const Host = defineComponent({ setup: () => () => render(limit.value, () => { limit.value += STEP; }) });
  return { w: mount(Host, { attachTo: document.body }), limit };
}

const hotspots = () => paged((limit, onMore) => h(HotspotTable, { rows: files, query: '', limit, onMore }));
const list = (rows: readonly InvestigationRow[], selected: string | null) =>
  paged((limit, onMore) => h(InvestigationList, { rows, selected, limit, onMore }));

async function showMore(selector: string): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`no ${selector}`);
  button.focus();
  expect(document.activeElement).toBe(button);
  button.click();
  await nextTick();
  await nextTick();
}

describe('Show more moves focus to the first newly shown row (GRB15)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('HotspotTable: the first new row (a tab stop) takes focus', async () => {
    const { w } = hotspots();
    expect(document.activeElement).toBe(document.body);   // not on first render
    await showMore('.ci-hotspot-table__more');
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(LIMIT + STEP);
    expect(document.activeElement).toBe(rows[LIMIT]!.element);
    w.unmount();
  });

  it('FindingsTable: the first new row\'s Review button takes focus', async () => {
    const { w } = paged((limit, onMore) => h(FindingsTable, { rows: findings, stale: false, limit, onMore }));
    await showMore('.ci-findings-table__more');
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(LIMIT + STEP);
    expect(document.activeElement).toBe(rows[LIMIT]!.get('button').element);
    w.unmount();
  });

  it('CoverageGapsTable: the first new row\'s Open button takes focus', async () => {
    const { w } = paged((limit, onMore) => h(CoverageGapsTable, { rows: files, limit, onMore }));
    await showMore('.ci-coverage-gaps__more');
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(LIMIT + STEP);
    expect(document.activeElement).toBe(rows[LIMIT]!.get('button').element);
    w.unmount();
  });

  it('InvestigationList: the first new row takes focus and becomes the tab stop', async () => {
    const { w } = list(investigation, null);
    await showMore('.ci-investigate-list__more');
    const rows = w.findAll('.ci-investigate-row');
    expect(rows).toHaveLength(LIMIT + STEP);
    expect(document.activeElement).toBe(rows[LIMIT]!.element);
    expect(rows[LIMIT]!.attributes('tabindex')).toBe('0');
    w.unmount();
  });

  it('InvestigationList: with a row selected, focus and the tab stop still follow Show more, and ArrowDown goes on from there', async () => {
    const { w } = list(investigation, 'fp2');
    expect(w.findAll('.ci-investigate-row')[2]!.attributes('tabindex')).toBe('0');
    await showMore('.ci-investigate-list__more');
    await nextTick();
    const rows = () => w.findAll('.ci-investigate-row');
    expect(document.activeElement).toBe(rows()[LIMIT]!.element);
    expect(rows()[LIMIT]!.attributes('tabindex')).toBe('0');
    expect(rows().filter((r) => r.attributes('tabindex') === '0')).toHaveLength(1);
    await w.get('.ci-investigate-list').trigger('keydown', { key: 'ArrowDown' });
    await nextTick();
    expect(document.activeElement).toBe(rows()[LIMIT + 1]!.element);
    w.unmount();
  });

  it('InvestigationList: on the last page the button unmounts and focus still lands on the new row', async () => {
    const { w } = list(investigation.slice(0, 8), null);
    await showMore('.ci-investigate-list__more');
    expect(w.find('.ci-investigate-list__more').exists()).toBe(false);
    expect(document.activeElement).toBe(w.findAll('.ci-investigate-row')[LIMIT]!.element);
    w.unmount();
  });

  // Gap closure E50: with teeth. After a shrink the old limit's row never exists, so a check on
  // activeElement alone passes whatever the watcher does; the spy fails on ANY focus() call the
  // shrink makes (RED: the guard removed and the row index clamped to the last shown row).
  it('a limit that shrinks leaves focus alone: nothing is focused at all', async () => {
    const { w, limit } = hotspots();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      limit.value = 3;
      await nextTick();
      await nextTick();
      expect(w.findAll('tbody tr')).toHaveLength(3);
      expect(focus).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(document.body);
    } finally {
      focus.mockRestore();
      w.unmount();
    }
  });

  it('a re-sort after a grow leaves focus where it is', async () => {
    const { w } = hotspots();
    await showMore('.ci-hotspot-table__more');
    const sort = w.get<HTMLButtonElement>('.ci-table__sort');
    sort.element.focus();
    await sort.trigger('click');
    await nextTick();
    expect(w.findAll('tbody tr')).toHaveLength(LIMIT + STEP);
    expect(document.activeElement).toBe(sort.element);
    w.unmount();
  });

  it('a static table whose new row has no control grows without throwing or moving focus', async () => {
    const { w, limit } = paged((shown) => h(EvidenceTable, {
      columns: [{ key: 'name', label: 'Name' }], rows: files.map((f) => f.id), rowKey: (r: unknown) => String(r),
      caption: 'Static', limit: shown, interactive: false,
    }));
    limit.value += STEP;
    await nextTick();
    await nextTick();
    expect(w.findAll('tbody tr')).toHaveLength(LIMIT + STEP);
    expect(document.activeElement).toBe(document.body);
    w.unmount();
  });
});
