import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const mountShell = () => mount(App, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });

describe('shell provenance badge (A11)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('is absent without a snapshot', () => {
    const w = mountShell();
    expect(w.find('.ci-topbar__sample').exists()).toBe(false);
    w.unmount();
  });

  it('shows on every screen that shows sample values, and not on a placeholder', async () => {
    const snap = buildSnapshotFixture({ files: 20, directories: 3 });
    const store = useCityStore();
    store.setCity(snap, computeLayout(snap));
    store.select(snap.entities.find((e) => e.kind === 'file')!.id);
    const w = mountShell();
    for (const route of ['overview', 'city', 'architecture', 'hotspots', 'file', 'quality', 'tests', 'dependencies'] as const) {
      store.navigate(route);
      await nextTick();
      expect(w.find('.ci-topbar__sample').text(), route).toBe('Includes sample data');
    }
    store.navigate('settings');
    await nextTick();
    expect(w.find('.ci-topbar__sample').exists()).toBe(false);
    w.unmount();
  });

  it('moves the shell strings into copy without changing them', () => {
    const w = mountShell();
    expect(w.find('.ci-topbar__crumbs').attributes('aria-label')).toBe('Breadcrumb');
    expect(w.find('.ci-topbar__crumbs').text()).toContain('Workspace');
    expect(w.find('.ci-topbar__search kbd').text()).toBe('Ctrl K');
    w.unmount();
  });
});
