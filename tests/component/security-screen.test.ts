import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import SecurityScreen from '../../src/ui/screens/SecurityScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const VERDICTS = /\b(exploitable|not exploitable|vulnerable|safe|secure|confirmed exploit)\b/i;

function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 8 });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountS = () => mount(SecurityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('SecurityScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('shows the two demo advisories and no exploitability verdict anywhere', async () => {
    withSnapshot();
    const w = mountS();
    expect(w.findAll('.ci-advisory')).toHaveLength(2);
    for (const id of ['advisories', 'secrets', 'policy']) {
      await w.find(`[role="tab"][data-tab-id="${id}"]`).trigger('click');
      expect(w.text().replace('A detected pattern is not a confirmed exploit.', '')).not.toMatch(VERDICTS);
    }
    w.unmount();
  });

  it('secret candidates and runtime exploitability are unknown, never 0', async () => {
    withSnapshot();
    const w = mountS();
    for (const label of ['Secret-pattern candidates', 'Runtime exploitability']) {
      const card = w.findAll('.ci-metric-card').find((c) => c.text().includes(label))!;
      expect(card.text()).toContain('—');
    }
    await w.find('[role="tab"][data-tab-id="secrets"]').trigger('click');
    expect(w.text()).toContain('Secret candidates are unknown.');
    w.unmount();
  });

  it('an advisory opens the package dialog; the checklist is local and unsaved', async () => {
    withSnapshot();
    const w = mountS();
    await w.find('.ci-advisory__open').trigger('click');
    expect(w.find('.ci-package-dialog').exists()).toBe(true);
    // Controller ruling: the VERDICTS regex is also run over the dialog's own text.
    expect(w.find('.ci-package-dialog').text()).not.toMatch(VERDICTS);
    await w.find('.ci-package-dialog__close').trigger('click');
    const box = w.find('.ci-checklist input[type="checkbox"]');
    await box.setValue(true);
    expect((box.element as HTMLInputElement).checked).toBe(true);
    expect(w.text()).toContain('Not saved.');
    w.unmount();
  });

  it('exports the advisories with reachability unknown', async () => {
    withSnapshot();
    const w = mountS();
    await w.find('.ci-security__export').trigger('click');
    const [, name, text] = vi.mocked(downloadText).mock.calls[0]!;
    expect(name).toBe('sample-security-review.csv');
    expect(text).toContain(',unknown,sample');
    w.unmount();
  });
});
