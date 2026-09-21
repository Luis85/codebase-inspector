import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import EvidenceTable from '../../src/ui/kit/EvidenceTable.vue';
import LineChart from '../../src/ui/kit/LineChart.vue';
import Dialog from '../../src/ui/kit/Dialog.vue';
import type { TableColumn } from '../../src/ui/kit/table-types';

interface Row { id: string; name: string; n: number | null }
const rows: Row[] = [{ id: 'a', name: 'Alpha', n: 2 }, { id: 'b', name: 'Beta', n: 9 }, { id: 'c', name: 'Gamma', n: null }];
const columns: TableColumn<Row>[] = [
  { key: 'name', label: 'File', sortValue: (r: Row) => r.name },
  { key: 'n', label: 'Count', numeric: true, sortValue: (r: Row) => r.n },
];

function mountTable() {
  // vue-tsc/vue-test-utils cannot infer the SFC's `generic="T"` parameter through a plain
  // `mount()` call (inference only works inside a consuming template); the props above are
  // still fully typed via the explicit `TableColumn<Row>[]` and `Row[]` annotations, so this
  // cast only bypasses the untyped component-reference side, not the props being checked.
  return mount(EvidenceTable as unknown as new () => { $props: {
    columns: TableColumn<Row>[]; rows: Row[]; rowKey: (row: Row) => string; caption: string;
    initialSort?: { key: string; dir: 'asc' | 'desc' };
  } }, {
    props: { columns, rows, rowKey: (r: Row) => r.id, caption: 'Files', initialSort: { key: 'n', dir: 'desc' as const } },
    slots: { 'cell-name': ({ row }: { row: Row }) => h('b', row.name), 'cell-n': ({ row }: { row: Row }) => String(row.n ?? '—') },
  });
}

describe('EvidenceTable', () => {
  it('applies the initial sort, unknowns last', () => {
    expect(mountTable().findAll('tbody tr').map((r) => r.text())).toEqual(['Beta9', 'Alpha2', 'Gamma—']);
  });
  it('toggles sort direction from the header button and reports aria-sort', async () => {
    const w = mountTable();
    const th = w.findAll('th')[1]!;
    await th.find('button').trigger('click');
    expect(th.attributes('aria-sort')).toBe('ascending');
    expect(w.findAll('tbody tr').map((r) => r.text())[0]).toBe('Alpha2');
  });
  it('activates a row on click and on Enter', async () => {
    const w = mountTable();
    await w.findAll('tbody tr')[0]!.trigger('click');
    await w.findAll('tbody tr')[1]!.trigger('keydown', { key: 'Enter' });
    expect(w.emitted('activate')?.map((e) => (e[0] as Row).id)).toEqual(['b', 'a']);
  });
  it('rows are keyboard focusable', () => {
    expect(mountTable().find('tbody tr').attributes('tabindex')).toBe('0');
  });
});

describe('LineChart', () => {
  it('draws one path per series and a data-table fallback', () => {
    const w = mount(LineChart, { props: { label: 'Signals', series: [
      { id: 'a', label: 'A', points: [{ label: 'Jun 01', value: 10 }, { label: 'Jun 15', value: 20 }] },
      { id: 'b', label: 'B', points: [{ label: 'Jun 01', value: 5 }, { label: 'Jun 15', value: 7 }] },
    ] } });
    expect(w.findAll('path.ci-line-chart__line')).toHaveLength(2);
    expect(w.find('table.visually-hidden').text()).toContain('Jun 15');
  });
});

describe('Dialog', () => {
  // Registered as CiDialog, not Dialog: vue/no-reserved-component-names rejects a local
  // component name that collides with the native <dialog> HTML element.
  const Host = defineComponent({
    components: { CiDialog: Dialog },
    setup() { const open = ref(false); return { open }; },
    template: `<div><button class="opener" @click="open = true">Open</button>
      <CiDialog v-if="open" label="Palette" @close="open = false"><input class="first"><button class="last">x</button></CiDialog></div>`,
  });

  it('focuses the first control, closes on Escape without letting it bubble, and restores focus', async () => {
    const w = mount(Host, { attachTo: document.body });
    const opener = w.find('.opener');
    (opener.element as HTMLElement).focus();
    await opener.trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.first').element);
    let bubbled = false;
    document.addEventListener('keydown', () => { bubbled = true; }, { once: true });
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(bubbled).toBe(false);
    expect(document.activeElement).toBe(opener.element);
    w.unmount();
  });

  it('wraps Tab from the last control to the first', async () => {
    const w = mount(Host, { attachTo: document.body });
    await w.find('.opener').trigger('click');
    (w.find('.last').element as HTMLElement).focus();
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(w.find('.first').element);
    w.unmount();
  });
});
