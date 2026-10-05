// GRB12 / E34: Data & scans shows the current snapshot's `warnings`, so a saved wildcard
// exclusion's warning (which the scan puts there) reaches the reader.
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const WILDCARD = 'The exclusion "dist/*" contains * or ? and matches nothing. Edit it in Settings.';
const BINARY = 'file appears to contain binary content';

function mountWith(warnings: readonly string[]) {
  const snap = buildSnapshotFixture({ files: 3, warnings });
  useCityStore().setCity(snap, computeLayout(snap));
  return mount(SourcesScreen, { attachTo: document.body, global: { provide: {} } });
}

describe('Data & scans: the snapshot warnings', () => {
  beforeEach(() => { setActivePinia(createPinia()); useCityStore().navigate('sources'); });

  it('shows each warning verbatim, on its own line, in the scope panel', () => {
    const w = mountWith([BINARY, WILDCARD]);
    const items = w.findAll('.ci-sources__scope .ci-sources__warnings li');
    expect(items.map((i) => i.text())).toEqual([BINARY, WILDCARD]);
    w.unmount();
  });

  it('shows no warnings block when the snapshot has none', () => {
    const w = mountWith([]);
    expect(w.find('.ci-sources__warnings').exists()).toBe(false);
    w.unmount();
  });

  it('shows no warnings block without a snapshot', () => {
    const w = mount(SourcesScreen, { attachTo: document.body, global: { provide: {} } });
    expect(w.find('.ci-sources__warnings').exists()).toBe(false);
    w.unmount();
  });
});
