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

  it('an advisory opens the package dialog', async () => {
    withSnapshot();
    const w = mountS();
    await w.find('.ci-advisory__open').trigger('click');
    expect(w.find('.ci-package-dialog').exists()).toBe(true);
    // Controller ruling: the VERDICTS regex is also run over the dialog's own text.
    expect(w.find('.ci-package-dialog').text()).not.toMatch(VERDICTS);
    await w.find('.ci-package-dialog__close').trigger('click');
    w.unmount();
  });

  // Fix round 1 (Important 1/2): every box starts unchecked, each input's id matches its
  // own label's `for`, "Not saved." lives in the checklist panel's own subtitle (not just
  // somewhere on the page), and — the actual bug — checking a box survives a round trip
  // through a different tab, because ReviewChecklist sits behind Tabs' `v-if` panels.
  it('the checklist starts unchecked, ids match labels, is unsaved, and survives a tab switch', async () => {
    withSnapshot();
    const w = mountS();
    const boxes = w.findAll('.ci-checklist input[type="checkbox"]');
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect((box.element as HTMLInputElement).checked).toBe(false);

    const labels = w.findAll('.ci-checklist label');
    expect(labels).toHaveLength(boxes.length);
    for (const [i, box] of boxes.entries()) {
      const id = box.attributes('id');
      expect(id).toBeTruthy();
      expect(labels[i]!.attributes('for')).toBe(id);
    }

    const checklistPanel = w.find('.ci-checklist').element.closest('.ci-panel');
    expect(checklistPanel).not.toBeNull();
    expect(checklistPanel!.querySelector('.ci-panel__subtitle')?.textContent).toContain('Not saved.');

    await boxes[0]!.setValue(true);
    expect((boxes[0]!.element as HTMLInputElement).checked).toBe(true);

    await w.find('[role="tab"][data-tab-id="policy"]').trigger('click');
    await w.find('[role="tab"][data-tab-id="advisories"]').trigger('click');

    const boxAfter = w.find('.ci-checklist input[type="checkbox"]');
    expect((boxAfter.element as HTMLInputElement).checked).toBe(true);
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

  it('an export throw sets the live region to EXPORT_FAILED', async () => {
    withSnapshot();
    vi.mocked(downloadText).mockImplementationOnce(() => { throw new Error('boom'); });
    const w = mountS();
    await w.find('.ci-security__export').trigger('click');
    expect(w.find('.ci-security__live').text()).toBe('Could not start the download.');
    w.unmount();
  });

  it('the evidence sources dialog lists secret scanning and runtime exploitability as unknown', async () => {
    withSnapshot();
    const w = mountS();
    await w.find('.ci-security__sources').trigger('click');
    const rows = w.findAll('.ci-evidence-dialog__row');
    expect(rows.length).toBeGreaterThan(0);
    const secrets = rows.find((r) => r.text().includes('Secret scanning'));
    const runtime = rows.find((r) => r.text().includes('Runtime exploitability'));
    expect(secrets).toBeTruthy();
    expect(runtime).toBeTruthy();
    expect(secrets!.find('.ci-provenance').text()).toBe('Unknown');
    expect(runtime!.find('.ci-provenance').text()).toBe('Unknown');
    w.unmount();
  });

  it('the secrets tab\'s configure-evidence button navigates to Data & scans', async () => {
    withSnapshot();
    const w = mountS();
    await w.find('[role="tab"][data-tab-id="secrets"]').trigger('click');
    await w.find('.ci-security__configure').trigger('click');
    expect(useCityStore().route).toBe('sources');
    w.unmount();
  });
});
