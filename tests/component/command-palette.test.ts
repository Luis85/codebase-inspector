import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import App from '../../src/ui/App.vue';
import CommandPalette from '../../src/ui/shell/CommandPalette.vue';
import { paletteItems } from '../../src/ui/shell/palette-items';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const files = [
  { id: 'f1', path: 'src/domain/cost-engine.ts', name: 'cost-engine.ts' },
  { id: 'f2', path: 'src/ui/App.vue', name: 'App.vue' },
];

describe('paletteItems', () => {
  it('lists every route when the query is empty', () => {
    expect(paletteItems('', files).filter((i) => i.kind === 'route')).toHaveLength(15);
  });
  it('matches routes and file paths case-insensitively', () => {
    const items = paletteItems('COST', files);
    expect(items.map((i) => i.target)).toEqual(['f1']);
    expect(paletteItems('secur', files).map((i) => i.target)).toEqual(['security']);
  });
});

describe('CommandPalette', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const snap = buildSnapshotFixture({ files: 3 });
    useCityStore().setCity(snap, computeLayout(snap));
  });

  it('navigates to a route with arrow keys + Enter and closes', async () => {
    const w = mount(CommandPalette, { attachTo: document.body });
    const input = w.find('input');
    await input.setValue('overview');
    await input.trigger('keydown', { key: 'Enter' });
    expect(useCityStore().route).toBe('overview');
    expect(w.emitted('close')).toHaveLength(1);
    w.unmount();
  });

  it('opening a file selects it and shows File detail — without touching the camera', async () => {
    const store = useCityStore();
    store.navigate('overview');
    const w = mount(CommandPalette, { attachTo: document.body });
    await w.find('input').setValue('file-1');
    await w.find('input').trigger('keydown', { key: 'Enter' });
    expect(store.selectedEntityId).toContain('file-1.ts');
    expect(store.route).toBe('file');
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('the combobox announces its listbox popup', () => {
    const w = mount(CommandPalette, { attachTo: document.body });
    expect(w.find('input').attributes('aria-haspopup')).toBe('listbox');
    w.unmount();
  });

  it('shows an empty state for no matches', async () => {
    const w = mount(CommandPalette, { attachTo: document.body });
    await w.find('input').setValue('zzzz-nothing');
    expect(w.text()).toContain('No matching screens or files.');
    w.unmount();
  });

  it('ArrowDown moves to the second route and Enter activates it', async () => {
    const store = useCityStore();
    store.navigate('overview');
    const w = mount(CommandPalette, { attachTo: document.body });
    const input = w.find('input');
    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'Enter' });
    expect(store.route).toBe('city');
    w.unmount();
  });

  it('ArrowUp from the first item wraps to the last item', async () => {
    const store = useCityStore();
    store.navigate('overview');
    const w = mount(CommandPalette, { attachTo: document.body });
    const input = w.find('input');
    await input.trigger('keydown', { key: 'ArrowUp' });
    await input.trigger('keydown', { key: 'Enter' });
    expect(store.route).toBe('file');
    w.unmount();
  });

  it('two open palettes get distinct listbox ids so their aria references never collide', () => {
    const w1 = mount(CommandPalette, { attachTo: document.body });
    const w2 = mount(CommandPalette, { attachTo: document.body });
    const list1 = w1.find('[role="listbox"]');
    const list2 = w2.find('[role="listbox"]');
    expect(list1.attributes('id')).toBeTruthy();
    expect(list1.attributes('id')).not.toBe(list2.attributes('id'));
    expect(w1.find('input').attributes('aria-controls')).toBe(list1.attributes('id'));
    expect(w2.find('input').attributes('aria-controls')).toBe(list2.attributes('id'));
    w1.unmount();
    w2.unmount();
  });
});

describe('shell wiring', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  it('Ctrl+K inside the leaf opens the palette; Escape closes it', async () => {
    const w = mount(App, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });
    await w.find('.ci-shell').trigger('keydown', { key: 'k', ctrlKey: true });
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    await nextTick();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });
  it('shows the snapshot selector disabled when there is no snapshot', () => {
    const w = mount(App, { global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });
    expect(w.find('.ci-snapshot-selector select').attributes('disabled')).toBeDefined();
  });
});
