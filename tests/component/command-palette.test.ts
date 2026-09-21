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

  it('opening a file selects it, shows the city and opens the inspector — without touching the camera', async () => {
    const store = useCityStore();
    store.navigate('overview');
    const w = mount(CommandPalette, { attachTo: document.body });
    await w.find('input').setValue('file-1');
    await w.find('input').trigger('keydown', { key: 'Enter' });
    expect(store.selectedEntityId).toContain('file-1.ts');
    expect(store.route).toBe('city');
    expect(store.inspectorOpen).toBe(true);
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('shows an empty state for no matches', async () => {
    const w = mount(CommandPalette, { attachTo: document.body });
    await w.find('input').setValue('zzzz-nothing');
    expect(w.text()).toContain('No matching screens or files.');
    w.unmount();
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
