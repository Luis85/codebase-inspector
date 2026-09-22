import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import ReportScreen from '../../src/ui/screens/ReportScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 30, directories: 3 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}
const mountR = () => mount(ReportScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('ReportScreen (Part 4)', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('asks for a codebase without a snapshot', () => {
    const w = mountR();
    expect(w.text()).toContain('No snapshot yet');
    w.unmount();
  });

  it('composes the paper with the sample badge, numbered sections and the limitations', () => {
    withSnapshot();
    const w = mountR();
    const paper = w.find('.ci-report-paper');
    expect(paper.text()).toContain('Includes sample data');
    expect(paper.findAll('.ci-report-paper__section-title').map((h) => h.text())).toEqual([
      '01 / Executive summary', '02 / Architecture review', '03 / Quality hotspots', '04 / Security review', '05 / Refactor plan',
    ]);
    expect(paper.text()).toContain('Scope and limitations');
    expect(paper.find('.ci-provenance--sample').exists()).toBe(true);
    w.unmount();
  });

  it('toggling a section renumbers the rest; the plan lists real work items', async () => {
    const snap = withSnapshot();
    await useReviewStore().addWorkItemForFile(snap.entities.find((e) => e.kind === 'file')!.id, 'Split it', new Date());
    const w = mountR();
    await w.find('.ci-report-contents input[value="architecture"]').setValue(false);
    const titles = w.findAll('.ci-report-paper__section-title').map((h) => h.text());
    expect(titles).toContain('02 / Quality hotspots');
    expect(titles.join()).not.toContain('Architecture review');
    expect(w.find('.ci-report-paper').text()).toContain('Split it');
    w.unmount();
  });

  it('applies the reviewer note on request only, and announces it', async () => {
    withSnapshot();
    const w = mountR();
    await w.find('.ci-report-contents textarea').setValue('Confirm the parser boundary.');
    expect(w.find('.ci-report-paper').text()).not.toContain('Confirm the parser boundary.');
    await w.find('.ci-report-contents__apply').trigger('click');
    expect(w.find('.ci-report-paper').text()).toContain('Confirm the parser boundary.');
    expect(w.find('.ci-report__live').text()).toBe('Reviewer note applied to the report.');
    w.unmount();
  });

  it('exports Markdown with the chosen sections through the leaf document', async () => {
    withSnapshot();
    const w = mountR();
    await w.find('.ci-report__export').trigger('click');
    const [host, name, text, mime] = vi.mocked(downloadText).mock.calls[0]!;
    expect(host.classList.contains('ci-screen--report')).toBe(true);
    expect(name).toBe('codebase-audit-report.md');
    expect(mime).toBe('text/markdown;charset=utf-8');
    expect(text).toContain('## 01 / Executive summary');
    expect(text).toContain('(sample)');
    w.unmount();
  });
});
