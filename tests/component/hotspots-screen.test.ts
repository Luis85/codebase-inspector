import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import HotspotsScreen from '../../src/ui/screens/HotspotsScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(files = 40, directories = 3) {
  const snap = buildSnapshotFixture({ files, directories });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountHot = () => mount(HotspotsScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('HotspotsScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('asks for a codebase without a snapshot', () => {
    const w = mountHot();
    expect(w.text()).toContain('No snapshot yet');
    w.unmount();
  });

  it('plots one dot per file and shortlists five', () => {
    withSnapshot();
    const w = mountHot();
    expect(w.findAll('.ci-scatter__dot')).toHaveLength(40);
    expect(w.findAll('.ci-shortlist__item')).toHaveLength(5);
    w.unmount();
  });

  it('the module filter narrows dots and rows; the text filter can empty the table', async () => {
    withSnapshot();
    const w = mountHot();
    await w.find('.ci-hotspots__module').setValue('dir-1');
    expect(w.findAll('.ci-scatter__dot').length).toBeLessThan(40);
    expect(w.findAll('.ci-table__row').every((r) => r.text().includes('dir-1/'))).toBe(true);
    await w.find('.ci-hotspot-table input').setValue('no-such-file');
    expect(w.text()).toContain('No files match this filter.');
    w.unmount();
  });

  it('shows 100 rows, then 100 more', async () => {
    withSnapshot(250);
    const w = mountHot();
    expect(w.findAll('.ci-table__row')).toHaveLength(100);
    await w.find('.ci-hotspot-table__more').trigger('click');
    expect(w.findAll('.ci-table__row')).toHaveLength(200);
    w.unmount();
  });

  it('a dot selects without navigating or moving the camera; Open detail navigates', async () => {
    withSnapshot();
    const store = useCityStore();
    store.navigate('hotspots');
    const w = mountHot();
    await w.findAll('.ci-scatter__dot')[3]!.trigger('click');
    expect(store.selectedEntityId).not.toBeNull();
    expect(store.route).toBe('hotspots');
    expect(store.camera).toBeNull();
    await w.find('.ci-hotspots__selected button').trigger('click');
    expect(store.route).toBe('file');
    w.unmount();
  });

  it('arrow keys move the single tab stop between dots; Enter selects', async () => {
    withSnapshot();
    const w = mountHot();
    const dots = () => w.findAll('.ci-scatter__dot');
    expect(dots().filter((d) => d.attributes('tabindex') === '0')).toHaveLength(1);
    await w.find('.ci-scatter svg').trigger('keydown', { key: 'ArrowRight' });
    await nextTick();
    expect(dots()[1]!.attributes('tabindex')).toBe('0');
    await w.find('.ci-scatter svg').trigger('keydown', { key: 'Enter' });
    expect(useCityStore().selectedEntityId).toBe(dots()[1]!.attributes('data-entity-id'));
    w.unmount();
  });

  it('explains the priority formula in a dialog that Escape closes', async () => {
    withSnapshot();
    const w = mountHot();
    await w.find('.ci-hotspots__how').trigger('click');
    expect(w.find('[role="dialog"]').text()).toContain('0.42 × complexity/48');
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });

  it('exports every filtered row as CSV through downloadText', async () => {
    withSnapshot(250);
    const w = mountHot();
    await w.find('.ci-hotspots__export').trigger('click');
    const [host, filename, text] = vi.mocked(downloadText).mock.calls[0]!;
    expect(host).toBe(w.find('.ci-screen--hotspots').element);
    expect(filename).toBe('codebase-hotspots.csv');
    expect(text.startsWith('\uFEFFpath,module,')).toBe(true);
    expect(text.split('\r\n')).toHaveLength(252);
    w.unmount();
  });

  it('the Selected live region exists before a selection fills it (F7)', async () => {
    withSnapshot();
    const w = mountHot();
    const status = w.find('.ci-hotspots__selected [role="status"]');
    expect(status.exists()).toBe(true);
    expect(status.text()).toBe('');
    expect(w.find('.ci-hotspots__selected button').exists()).toBe(false);
    await w.findAll('.ci-scatter__dot')[0]!.trigger('click');
    expect(w.find('.ci-hotspots__selected [role="status"]').element).toBe(status.element);
    expect(status.text()).toMatch(/^Selected: /);
    w.unmount();
  });

  it('resets a module filter the new snapshot no longer has (F3)', async () => {
    withSnapshot(40, 3);
    const w = mountHot();
    await w.find('.ci-hotspots__module').setValue('dir-2');
    withSnapshot(40, 2);
    await nextTick(); await nextTick();
    expect((w.find('.ci-hotspots__module').element as HTMLSelectElement).selectedIndex).toBe(0);   // All modules
    expect(w.findAll('.ci-scatter__dot')).toHaveLength(40);
    w.unmount();
  });

  it('a table row opens File detail', async () => {
    withSnapshot();
    const store = useCityStore();
    const w = mountHot();
    await w.find('.ci-table__row').trigger('click');
    expect(store.route).toBe('file');
    expect(store.selectedEntityId).not.toBeNull();
    w.unmount();
  });
});
